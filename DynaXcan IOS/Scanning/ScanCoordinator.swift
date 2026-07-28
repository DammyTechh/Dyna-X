import AVFoundation
import Foundation

protocol ScanCoordinatorDelegate: AnyObject {
    func coordinator(_ coordinator: ScanCoordinator, didEnterState state: ScanSessionState)
    func coordinator(_ coordinator: ScanCoordinator, didUpdatePreview frame: CapturePreviewFrame)
    func coordinator(_ coordinator: ScanCoordinator, didUpdateEnvironment environment: EnvironmentReading)
    func coordinator(_ coordinator: ScanCoordinator, didUpdateGuidance guidance: GuidanceEvent)
    func coordinator(_ coordinator: ScanCoordinator, didUpdateProgress stats: FrameStats)
    func coordinator(
        _ coordinator: ScanCoordinator,
        didUpdateRecovery state: TrackingRecoveryEngine.RecoveryState
    )
    func coordinator(
        _ coordinator: ScanCoordinator,
        didCompleteExport result: ExportCoordinator.ExportResult
    )
    func coordinator(_ coordinator: ScanCoordinator, didFail error: ScanError)
}

final class ScanCoordinator: NSObject {
    let configuration: ScanConfiguration
    let capabilities: DeviceCapabilities

    weak var delegate: ScanCoordinatorDelegate?
    var preferredExportFormat: ExportCoordinator.ExportFormat = .ply

    private let captureSession: CaptureSession
    private let guidanceEngine: GuidanceEngine
    private let exportCoordinator: ExportCoordinator
    private let recoveryEngine: TrackingRecoveryEngine
    let passController: PassController

    private var countdownTimer: Timer?
    private var environmentOverrideRequested = false
    private var isProcessing = false
    private var didStart = false
    private var finalizedCapture: CaptureSessionResult?
    private var completedExports: [ExportCoordinator.ExportFormat: ExportCoordinator.ExportResult] = [:]

    init(
        configuration: ScanConfiguration,
        capabilities: DeviceCapabilities
    ) throws {
        self.configuration = configuration
        self.capabilities = capabilities

        let recoveryEngine = TrackingRecoveryEngine()
        let passController = PassController(
            minimumFramesPerPass: configuration.minimumFramesPerPass,
            minimumTotalFrames: configuration.minimumTotalFrames
        )
        let guidanceEngine = GuidanceEngine(
            configuration: configuration,
            trackingRecoveryEngine: recoveryEngine
        )
        self.recoveryEngine = recoveryEngine
        self.passController = passController
        self.guidanceEngine = guidanceEngine
        exportCoordinator = ExportCoordinator()
        captureSession = try CaptureSession(
            capabilities: capabilities,
            configuration: configuration,
            passController: passController,
            trackingRecoveryEngine: recoveryEngine,
            guidanceEngine: guidanceEngine
        )
        super.init()
        captureSession.outputDelegate = self
    }

    deinit {
        countdownTimer?.invalidate()
    }

    func start() {
        guard !didStart else { return }
        didStart = true

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            prepareCapture()
        case .notDetermined:
            enter(.requestingPermission)
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    guard let self else { return }
                    if granted {
                        self.prepareCapture()
                    } else {
                        self.fail(.cameraPermissionDenied)
                    }
                }
            }
        case .denied:
            fail(.cameraPermissionDenied)
        case .restricted:
            fail(.cameraPermissionRestricted)
        @unknown default:
            fail(.cameraPermissionDenied)
        }
    }

    /// Called by the environment gate after conditions are acceptable or an
    /// override has been explicitly recorded.
    func beginScanning() {
        guard !isProcessing else { return }
        beginCountdown(for: captureSession.currentPass)
    }

    func confirmPassComplete() {
        guard !isProcessing, captureSession.currentPass != .pass3Proximal else { return }
        guard captureSession.confirmCurrentPass() else { return }
        beginCountdown(for: captureSession.currentPass)
    }

    func confirmScanComplete() {
        guard !isProcessing, captureSession.currentPass == .pass3Proximal else { return }
        _ = captureSession.confirmCurrentPass()
    }

    func cancel() {
        guard !isProcessing else { return }
        countdownTimer?.invalidate()
        countdownTimer = nil
        captureSession.cancel()
    }

    func overrideEnvironmentCheck() {
        environmentOverrideRequested = true
        NSLog("DynaXcan environment check overridden by clinician")
    }

    func export(
        format: ExportCoordinator.ExportFormat,
        progressHandler: @escaping (Float, String) -> Void,
        completion: @escaping (Result<ExportCoordinator.ExportResult, ScanError>) -> Void
    ) {
        if let cached = completedExports[format] {
            progressHandler(1, "Ready to share")
            completion(.success(cached))
            return
        }
        guard
            let capture = finalizedCapture,
            let existing = completedExports.values.first
        else {
            completion(.failure(.exportFailed(reason: "The completed scan is not available.")))
            return
        }

        exportCoordinator.processExistingRawPointCloud(
            at: existing.rawPointCloudURL,
            scanId: existing.scanId,
            configuration: configuration,
            frameStats: capture.frameStats,
            scannerType: capture.scannerType,
            exportFormat: format,
            environmentOverridden: captureSession.environmentOverrideUsed,
            progressHandler: progressHandler,
            completion: { [weak self] result in
                if case .success(let export) = result {
                    self?.completedExports[format] = export
                }
                completion(result)
            }
        )
    }

    private func prepareCapture() {
        do {
            try captureSession.prepare()
            enter(.environmentCheck)
        } catch let error as ScanError {
            fail(error)
        } catch {
            fail(.cameraSessionFailed(reason: error.localizedDescription))
        }
    }

    private func beginCountdown(for pass: ScanPass) {
        countdownTimer?.invalidate()
        var remaining = 3
        enter(.countdownToPass(pass: pass, secondsRemaining: remaining))

        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) {
            [weak self] timer in
            guard let self else {
                timer.invalidate()
                return
            }
            remaining -= 1
            if remaining > 0 {
                self.enter(.countdownToPass(pass: pass, secondsRemaining: remaining))
            } else {
                timer.invalidate()
                self.countdownTimer = nil
                if self.captureSession.beginCurrentPass(
                    overrideEnvironment: self.environmentOverrideRequested
                ) {
                    self.enter(.scanning(pass: pass))
                } else {
                    self.enter(.environmentCheck)
                }
            }
        }
    }

    private func process(_ result: CaptureSessionResult) {
        isProcessing = true
        finalizedCapture = result
        enter(.finalizing)
        exportCoordinator.process(
            pointCloudData: result.pointCloudData,
            configuration: configuration,
            frameStats: result.frameStats,
            scannerType: result.scannerType,
            exportFormat: preferredExportFormat,
            environmentOverridden: captureSession.environmentOverrideUsed,
            progressHandler: { [weak self] progress, stage in
                guard let self else { return }
                self.enter(.processing(stage: stage, progress: progress))
            },
            completion: { [weak self] exportResult in
                guard let self else { return }
                switch exportResult {
                case .success(let result):
                    self.completedExports[result.format] = result
                    self.enter(.exportComplete)
                    self.delegate?.coordinator(self, didCompleteExport: result)
                case .failure(let error):
                    self.fail(error)
                }
            }
        )
    }

    private func enter(_ state: ScanSessionState) {
        precondition(Thread.isMainThread)
        delegate?.coordinator(self, didEnterState: state)
    }

    private func fail(_ error: ScanError) {
        countdownTimer?.invalidate()
        countdownTimer = nil
        enter(.failed(error))
        delegate?.coordinator(self, didFail: error)
    }
}

extension ScanCoordinator: CaptureSessionOutputDelegate {
    func captureSession(_ session: CaptureSession, didOutput previewFrame: CapturePreviewFrame) {
        delegate?.coordinator(self, didUpdatePreview: previewFrame)
    }

    func captureSession(
        _ session: CaptureSession,
        didUpdateEnvironment environment: EnvironmentReading
    ) {
        delegate?.coordinator(self, didUpdateEnvironment: environment)
    }

    func captureSession(
        _ session: CaptureSession,
        didUpdateRecovery state: TrackingRecoveryEngine.RecoveryState
    ) {
        delegate?.coordinator(self, didUpdateRecovery: state)
        switch state {
        case .stable:
            if case .paused = session.currentPassState {
                return
            }
            if case .active = session.currentPassState {
                enter(.scanning(pass: session.currentPass))
            }
        case .recovering:
            enter(.recovering)
        case .failed:
            enter(.recovering)
        }
    }

    func captureSession(
        _ session: CaptureSession,
        didUpdatePassState passState: PassState,
        pass: ScanPass
    ) {
        switch passState {
        case .waitingToStart:
            break
        case .active:
            enter(.scanning(pass: pass))
        case .paused(let reason):
            if reason == .trackingRecoveryFailed {
                enter(.recovering)
            }
        case .complete(let framesAccepted):
            enter(.passComplete(pass: pass, framesAccepted: framesAccepted))
        }
    }

    func captureSession(_ session: CaptureSession, didUpdateFrameStats stats: FrameStats) {
        delegate?.coordinator(self, didUpdateProgress: stats)
    }

    func captureSession(_ session: CaptureSession, didUpdateGuidance guidance: GuidanceEvent) {
        delegate?.coordinator(self, didUpdateGuidance: guidance)
    }

    func captureSession(_ session: CaptureSession, didFinalize result: CaptureSessionResult) {
        process(result)
    }

    func captureSession(_ session: CaptureSession, didFail error: ScanError) {
        if case .scanCancelled = error {
            enter(.cancelled)
        } else {
            fail(error)
        }
    }
}
