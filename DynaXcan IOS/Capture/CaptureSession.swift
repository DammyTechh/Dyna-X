import Foundation
import UIKit

protocol CaptureSessionOutputDelegate: AnyObject {
    func captureSession(_ session: CaptureSession, didOutput previewFrame: CapturePreviewFrame)
    func captureSession(_ session: CaptureSession, didUpdateEnvironment environment: EnvironmentReading)
    func captureSession(
        _ session: CaptureSession,
        didUpdateRecovery state: TrackingRecoveryEngine.RecoveryState
    )
    func captureSession(
        _ session: CaptureSession,
        didUpdatePassState passState: PassState,
        pass: ScanPass
    )
    func captureSession(_ session: CaptureSession, didUpdateFrameStats stats: FrameStats)
    func captureSession(_ session: CaptureSession, didUpdateGuidance guidance: GuidanceEvent)
    func captureSession(_ session: CaptureSession, didFinalize result: CaptureSessionResult)
    func captureSession(_ session: CaptureSession, didFail error: ScanError)
}

/// Framework boundary consumed by ScanCoordinator. StandardCyborg and ARKit
/// remain hidden behind CaptureSessionProtocol implementations.
final class CaptureSession {
    weak var outputDelegate: CaptureSessionOutputDelegate?

    private enum Lifecycle {
        case initialized
        case prepared
        case finalizing
        case ended
    }

    let capabilities: DeviceCapabilities
    let configuration: ScanConfiguration

    private(set) var environmentOverrideUsed = false

    private let adapter: CaptureSessionProtocol
    private let passController: PassController
    private let frameAccumulator: FrameAccumulator
    private let motionMonitor: MotionMonitor
    private let environmentChecker: EnvironmentChecker
    private let trackingRecoveryEngine: TrackingRecoveryEngine
    private let guidanceEngine: GuidanceEngine

    private let analysisQueue = DispatchQueue(
        label: "com.dynaxcan.environment-analysis",
        qos: .userInitiated
    )
    private let analysisLock = NSLock()
    private var analysisInFlight = false

    private var lifecycle: Lifecycle = .initialized
    private var notificationTokens: [NSObjectProtocol] = []
    private var latestMotionReading: MotionReading?
    private var latestDistanceReading: DistanceReading?
    private var latestEnvironmentReading: EnvironmentReading?
    private var providerGuidance: CaptureProviderGuidance?
    private var adapterIsAccumulating = false

    init(
        capabilities: DeviceCapabilities,
        configuration: ScanConfiguration,
        passController: PassController? = nil,
        trackingRecoveryEngine: TrackingRecoveryEngine? = nil,
        guidanceEngine: GuidanceEngine? = nil
    ) throws {
        guard capabilities.hardwareSupported else {
            throw ScanError.hardwareNotSupported
        }

        self.capabilities = capabilities
        self.configuration = configuration
        adapter = SCFusionManager.makeSession(
            for: capabilities,
            configuration: configuration
        )
        let passController = passController ?? PassController(
            minimumFramesPerPass: configuration.minimumFramesPerPass,
            minimumTotalFrames: configuration.minimumTotalFrames
        )
        self.passController = passController
        frameAccumulator = FrameAccumulator(
            minimumFramesPerPass: configuration.minimumFramesPerPass,
            minimumTotalFrames: configuration.minimumTotalFrames
        )
        motionMonitor = MotionMonitor(
            targetPitchDegrees: ScanPass.pass1Circumferential.targetPitchDegrees
        )
        environmentChecker = EnvironmentChecker(configuration: configuration)
        let trackingRecoveryEngine = trackingRecoveryEngine ?? TrackingRecoveryEngine()
        self.trackingRecoveryEngine = trackingRecoveryEngine
        let guidanceEngine = guidanceEngine ?? GuidanceEngine(
            configuration: configuration,
            trackingRecoveryEngine: trackingRecoveryEngine
        )
        self.guidanceEngine = guidanceEngine

        adapter.delegate = self
        passController.delegate = self
        motionMonitor.delegate = self
        guidanceEngine.delegate = self

        trackingRecoveryEngine.stateDidChange = { [weak self] state in
            DispatchQueue.main.async { [weak self] in
                guard let self, self.lifecycle == .prepared else { return }
                self.outputDelegate?.captureSession(self, didUpdateRecovery: state)
                self.recomputePauseReason()
            }
        }

        motionMonitor.rawDeviceMotionHandler = { [weak adapter] motion in
            (adapter as? DeviceMotionConsuming)?.consumeDeviceMotion(motion)
        }
    }

    deinit {
        removeLifecycleObservers()
        guidanceEngine.stop()
        motionMonitor.stop()
    }

    var currentPass: ScanPass { passController.currentPass }
    var currentPassState: PassState { passController.state }
    var currentFrameStats: FrameStats { frameAccumulator.frameStats }
    var trackingRecoveryState: TrackingRecoveryEngine.RecoveryState {
        trackingRecoveryEngine.state
    }

    /// Configures the selected provider, begins preview, and starts continuous
    /// motion/environment guidance. No scan frames accumulate yet.
    func prepare() throws {
        precondition(Thread.isMainThread)
        guard lifecycle == .initialized else {
            throw ScanError.cameraSessionFailed(reason: "Capture session was already prepared.")
        }
        guard ProcessInfo.processInfo.thermalState != .critical else {
            throw ScanError.thermalStateCritical
        }

        try adapter.configure()
        lifecycle = .prepared
        installLifecycleObservers()
        guidanceEngine.start()
        _ = motionMonitor.start()
        adapter.startPreview()

        outputDelegate?.captureSession(
            self,
            didUpdatePassState: passController.state,
            pass: passController.currentPass
        )
    }

    /// Begins the currently selected pass. An unacceptable environment blocks
    /// capture unless the clinician explicitly records an override.
    @discardableResult
    func beginCurrentPass(overrideEnvironment: Bool = false) -> Bool {
        precondition(Thread.isMainThread)
        guard lifecycle == .prepared else { return false }
        guard trackingRecoveryEngine.state != .failed else {
            outputDelegate?.captureSession(
                self,
                didUpdateGuidance: .trackingRecoveryFailed
            )
            return false
        }

        if latestEnvironmentReading?.isReadyToScan != true {
            guard overrideEnvironment else {
                emitEnvironmentBlockGuidance()
                return false
            }
            environmentOverrideUsed = true
        }

        return passController.startCurrentPass()
    }

    /// Called only from the explicit clinician "Next Pass" or "Finish" action.
    @discardableResult
    func confirmCurrentPass() -> Bool {
        precondition(Thread.isMainThread)
        guard lifecycle == .prepared else { return false }
        return passController.confirmCurrentPass()
    }

    func cancel() {
        precondition(Thread.isMainThread)
        fail(.scanCancelled, cancelAdapter: true)
    }

    private func finalize() {
        guard lifecycle == .prepared else { return }
        lifecycle = .finalizing
        setAdapterAccumulating(false)
        stopContinuousMonitoring()

        adapter.stopAndFinalize { [weak self] result in
            guard let self, self.lifecycle == .finalizing else { return }

            switch result {
            case .success(let providerResult):
                let finalStats = self.frameAccumulator.mergeFinalProviderStats(
                    providerResult.frameStats
                )
                let result = CaptureSessionResult(
                    pointCloudData: providerResult.pointCloudData,
                    frameStats: finalStats,
                    scannerType: providerResult.scannerType
                )
                self.lifecycle = .ended
                self.outputDelegate?.captureSession(self, didFinalize: result)

            case .failure(let error):
                self.fail(error, cancelAdapter: false)
            }
        }
    }

    private func fail(_ error: ScanError, cancelAdapter: Bool) {
        guard lifecycle != .ended else { return }
        lifecycle = .ended
        setAdapterAccumulating(false)
        stopContinuousMonitoring()
        if cancelAdapter {
            adapter.cancel()
        }
        outputDelegate?.captureSession(self, didFail: error)
    }

    private func stopContinuousMonitoring() {
        removeLifecycleObservers()
        guidanceEngine.stop()
        motionMonitor.stop()
    }

    private func setAdapterAccumulating(_ shouldAccumulate: Bool) {
        guard adapterIsAccumulating != shouldAccumulate else { return }
        adapterIsAccumulating = shouldAccumulate
        if shouldAccumulate {
            adapter.startAccumulating()
        } else {
            adapter.pauseAccumulating()
        }
    }

    private func recomputePauseReason() {
        guard lifecycle == .prepared else { return }
        switch passController.state {
        case .active, .paused:
            break
        case .waitingToStart, .complete:
            return
        }

        let reason: PauseReason?
        if trackingRecoveryEngine.state == .failed {
            reason = .trackingRecoveryFailed
        } else if latestMotionReading?.isExcessiveMotion == true
                    || providerGuidance == .slowDown {
            reason = .motionTooFast
        } else if !environmentOverrideUsed,
                  let distance = latestDistanceReading,
                  distance.classification == .tooFar {
            reason = .distanceOutOfRange
        } else {
            reason = nil
        }

        passController.setPauseReason(reason)
    }

    private func processPreviewFrame(_ previewFrame: CapturePreviewFrame) {
        let shouldAnalyze = analysisLock.withLock { () -> Bool in
            guard !analysisInFlight else { return false }
            analysisInFlight = true
            return true
        }
        guard shouldAnalyze else { return }

        analysisQueue.async { [weak self] in
            guard let self else { return }
            let evaluation = self.environmentChecker.evaluate(
                colorBuffer: previewFrame.colorBuffer,
                depthBuffer: previewFrame.depthBuffer
            )

            self.analysisLock.withLock {
                self.analysisInFlight = false
            }

            DispatchQueue.main.async { [weak self] in
                guard let self, self.lifecycle == .prepared else { return }
                self.latestDistanceReading = evaluation.distance
                self.latestEnvironmentReading = evaluation.environment
                self.outputDelegate?.captureSession(
                    self,
                    didUpdateEnvironment: evaluation.environment
                )
                self.guidanceEngine.update(distance: evaluation.distance)
                self.guidanceEngine.update(environment: evaluation.environment)
                self.recomputePauseReason()
            }
        }
    }

    private func emitEnvironmentBlockGuidance() {
        let event: GuidanceEvent
        if let distance = latestDistanceReading {
            switch distance.classification {
            case .tooClose:
                event = .moveBack(
                    currentMetres: distance.estimatedMetres,
                    targetMetres: configuration.workingDistance.ideal
                )
            case .tooFar:
                event = .moveCloser(
                    currentMetres: distance.estimatedMetres,
                    targetMetres: configuration.workingDistance.ideal
                )
            case .good, .unknown:
                event = .holdSteady
            }
        } else if latestEnvironmentReading?.lighting != .acceptable {
            event = .improveLighting
        } else {
            event = .holdSteady
        }
        outputDelegate?.captureSession(self, didUpdateGuidance: event)
    }

    private func updateGuidancePassSnapshot() {
        guidanceEngine.update(
            pass: passController.currentPass,
            state: passController.state,
            frameStats: frameAccumulator.frameStats,
            scanHasMinimumCoverage: frameAccumulator.isScanComplete
        )
    }

    private func installLifecycleObservers() {
        let center = NotificationCenter.default
        notificationTokens.append(
            center.addObserver(
                forName: ProcessInfo.thermalStateDidChangeNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                guard ProcessInfo.processInfo.thermalState == .critical else { return }
                self?.fail(.thermalStateCritical, cancelAdapter: true)
            }
        )
        notificationTokens.append(
            center.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.fail(.scanInterrupted, cancelAdapter: true)
            }
        )
    }

    private func removeLifecycleObservers() {
        let center = NotificationCenter.default
        notificationTokens.forEach { center.removeObserver($0) }
        notificationTokens.removeAll()
    }
}

extension CaptureSession: CaptureSessionDelegate {
    func captureSessionDidStartPreview(_ session: CaptureSessionProtocol) {}

    func captureSession(
        _ session: CaptureSessionProtocol,
        didOutput previewFrame: CapturePreviewFrame
    ) {
        guard lifecycle == .prepared else { return }
        outputDelegate?.captureSession(self, didOutput: previewFrame)
        processPreviewFrame(previewFrame)
    }

    func captureSession(
        _ session: CaptureSessionProtocol,
        didUpdate providerStats: FrameStats
    ) {
        guard lifecycle == .prepared else { return }

        let stats = frameAccumulator.ingest(
            providerStats: providerStats,
            for: passController.currentPass
        )

        let passAccepted = frameAccumulator.acceptedFrames(for: passController.currentPass)
        passController.updateFrameCounts(
            currentPassAccepted: passAccepted,
            totalAccepted: stats.accepted
        )
        outputDelegate?.captureSession(self, didUpdateFrameStats: stats)
        updateGuidancePassSnapshot()
        recomputePauseReason()
    }

    func captureSession(
        _ session: CaptureSessionProtocol,
        didFail error: ScanError
    ) {
        guard lifecycle == .prepared else { return }

        if case .trackingFailed = error {
            trackingRecoveryEngine.didFail()
            return
        }
        fail(error, cancelAdapter: true)
    }
}

extension CaptureSession: PassControllerDelegate {
    func passController(
        _ controller: PassController,
        didChange state: PassState,
        pass: ScanPass
    ) {
        switch state {
        case .active:
            setAdapterAccumulating(true)
        case .waitingToStart, .paused, .complete:
            setAdapterAccumulating(false)
        }

        if case .waitingToStart = state {
            motionMonitor.updateTargetPitchDegrees(pass.targetPitchDegrees)
        }

        outputDelegate?.captureSession(self, didUpdatePassState: state, pass: pass)
        updateGuidancePassSnapshot()
    }

    func passControllerDidConfirmAllPasses(_ controller: PassController) {
        finalize()
    }
}

extension CaptureSession {
    func captureSessionDidEnterRecovery(_ session: CaptureSessionProtocol) {
        guard lifecycle == .prepared else { return }
        trackingRecoveryEngine.didEnterRecovery()
    }

    func captureSessionDidRecoverTracking(_ session: CaptureSessionProtocol) {
        guard lifecycle == .prepared else { return }
        trackingRecoveryEngine.didRecoverTracking()
        guidanceEngine.notifyTrackingRecovered()
    }

    func captureSession(
        _ session: CaptureSessionProtocol,
        didUpdateProviderGuidance guidance: CaptureProviderGuidance?
    ) {
        guard lifecycle == .prepared else { return }
        providerGuidance = guidance
        guidanceEngine.update(providerGuidance: guidance)
        recomputePauseReason()
    }
}

extension CaptureSession: MotionMonitorDelegate {
    func motionMonitor(_ monitor: MotionMonitor, didUpdate reading: MotionReading) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.lifecycle == .prepared else { return }
            self.latestMotionReading = reading
            self.guidanceEngine.update(motion: reading)
            self.recomputePauseReason()
        }
    }
}

extension CaptureSession: GuidanceEngineDelegate {
    func guidanceEngine(_ engine: GuidanceEngine, didEmit event: GuidanceEvent) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.lifecycle == .prepared else { return }
            self.outputDelegate?.captureSession(self, didUpdateGuidance: event)
        }
    }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}
