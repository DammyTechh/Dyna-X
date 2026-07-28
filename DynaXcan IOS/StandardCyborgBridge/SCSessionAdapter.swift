import ARKit
import AVFoundation
import CoreMotion
import Foundation
import Metal
import StandardCyborgFusion
import StandardCyborgUI
import UIKit

/// TrueDepth capture provider. StandardCyborg owns camera delivery and fusion;
/// DynaXcan only coordinates lifecycle, statistics, and immutable PLY extraction.
final class SCSessionAdapter: NSObject, CaptureSessionProtocol {
    weak var delegate: CaptureSessionDelegate?

    private let scanConfiguration: ScanConfiguration
    private let cameraManager = CameraManager()
    private let stateLock = NSLock()
    private let serializationQueue = DispatchQueue(
        label: "com.dynaxcan.truedepth-serialization",
        qos: .userInitiated
    )

    private var reconstructionManager: SCReconstructionManager?
    private var frameStats = FrameStats()
    private var configured = false
    private var accumulating = false
    private var finishing = false
    private var startedAt: TimeInterval?
    private var reportedTrackingFailure = false
    private var consecutivePoorTrackingFrames = 0
    private var consecutiveGoodFramesAfterRecovery = 0
    private var isRecovering = false

    init(configuration: ScanConfiguration) {
        scanConfiguration = configuration
        super.init()
    }

    func configure() throws {
        if stateLock.withLock({ configured }) {
            return
        }

        guard CameraManager.isDepthCameraAvailable else {
            throw ScanError.hardwareNotSupported
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .denied:
            throw ScanError.cameraPermissionDenied
        case .restricted:
            throw ScanError.cameraPermissionRestricted
        case .authorized, .notDetermined:
            break
        @unknown default:
            throw ScanError.cameraSessionFailed(reason: "Unknown camera permission state.")
        }

        guard
            let metalDevice = MTLCreateSystemDefaultDevice(),
            let commandQueue = metalDevice.makeCommandQueue()
        else {
            throw ScanError.cameraSessionFailed(reason: "Metal is unavailable on this device.")
        }

        let manager = SCReconstructionManager(
            device: metalDevice,
            commandQueue: commandQueue,
            maxThreadCount: reconstructionThreadCount
        )
        manager.delegate = self
        manager.includesColorBuffersInMetadata = false
        manager.includesDepthBuffersInMetadata = false
        manager.setMaxDepth(scanConfiguration.workingDistance.maximum)

        reconstructionManager = manager
        cameraManager.delegate = self
        cameraManager.configureCaptureSession(maxResolution: 320, maxFramerate: 30)

        stateLock.withLock {
            configured = true
        }
    }

    func startPreview() {
        guard stateLock.withLock({ configured && !finishing }) else {
            notifyFailure(.cameraSessionFailed(reason: "Capture session is not configured."))
            return
        }

        cameraManager.startSession { [weak self] result in
            guard let self else { return }

            switch result {
            case .success:
                self.notify { $0.captureSessionDidStartPreview(self) }
            case .notAuthorized:
                self.notifyFailure(.cameraPermissionDenied)
            case .configurationFailed:
                self.notifyFailure(
                    .cameraSessionFailed(reason: "StandardCyborg could not configure TrueDepth capture.")
                )
            @unknown default:
                self.notifyFailure(.cameraSessionFailed(reason: "Unknown TrueDepth startup failure."))
            }
        }
    }

    func startAccumulating() {
        let canStart = stateLock.withLock { () -> Bool in
            guard configured, !finishing else { return false }
            accumulating = true
            if startedAt == nil {
                startedAt = ProcessInfo.processInfo.systemUptime
            }
            return true
        }

        guard canStart else {
            notifyFailure(.cameraSessionFailed(reason: "TrueDepth accumulation cannot start."))
            return
        }

        cameraManager.isFocusLocked = true
    }

    func pauseAccumulating() {
        stateLock.withLock {
            accumulating = false
        }
    }

    func stopAndFinalize(
        completion: @escaping (Result<CaptureSessionResult, ScanError>) -> Void
    ) {
        guard let manager = reconstructionManager else {
            completeOnMain(completion, with: .failure(.cameraSessionFailed(reason: "Fusion is not configured.")))
            return
        }

        let mayFinalize = stateLock.withLock { () -> Bool in
            guard configured, !finishing else { return false }
            finishing = true
            accumulating = false
            updateDurationLocked()
            return true
        }

        guard mayFinalize else {
            completeOnMain(completion, with: .failure(.cameraSessionFailed(reason: "Finalization is already in progress.")))
            return
        }

        cameraManager.isFocusLocked = false
        cameraManager.stopSession { [weak self] in
            guard let self else { return }

            manager.finalize { [weak self] in
                guard let self else { return }

                let pointCloud = manager.buildPointCloud()
                self.serializationQueue.async { [weak self] in
                    guard let self else { return }

                    let result: Result<CaptureSessionResult, ScanError>
                    do {
                        let plyData = try Self.makePLYData(from: pointCloud)
                        let stats = self.stateLock.withLock { self.frameStats }
                        result = .success(
                            CaptureSessionResult(
                                pointCloudData: plyData,
                                frameStats: stats,
                                scannerType: .trueDepth
                            )
                        )
                    } catch let scanError as ScanError {
                        result = .failure(scanError)
                    } catch {
                        result = .failure(.pointCloudPersistenceFailed(reason: error.localizedDescription))
                    }

                    manager.reset()
                    self.stateLock.withLock {
                        self.finishing = false
                    }
                    self.completeOnMain(completion, with: result)
                }
            }
        }
    }

    func cancel() {
        let shouldCancel = stateLock.withLock { () -> Bool in
            guard configured, !finishing else { return false }
            finishing = true
            accumulating = false
            return true
        }
        guard shouldCancel else { return }

        cameraManager.isFocusLocked = false
        cameraManager.stopSession { [weak self] in
            guard let self, let manager = self.reconstructionManager else { return }
            manager.finalize { [weak self] in
                manager.reset()
                guard let self else { return }
                self.stateLock.withLock {
                    self.finishing = false
                }
            }
        }
    }

    private var reconstructionThreadCount: Int32 {
        UIDevice.current.userInterfaceIdiom == .pad ? 4 : 2
    }

    private func updateDurationLocked() {
        guard let startedAt else { return }
        frameStats.durationSeconds = ProcessInfo.processInfo.systemUptime - startedAt
    }

    private static func makePLYData(from pointCloud: SCPointCloud) throws -> Data {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("DynaXcan-TrueDepth-\(UUID().uuidString)")
            .appendingPathExtension("ply")

        defer {
            try? FileManager.default.removeItem(at: url)
        }

        guard pointCloud.writeToPLY(atPath: url.path) else {
            throw ScanError.pointCloudPersistenceFailed(
                reason: "StandardCyborg could not serialize the finalized point cloud."
            )
        }

        do {
            return try Data(contentsOf: url)
        } catch {
            throw ScanError.pointCloudPersistenceFailed(reason: error.localizedDescription)
        }
    }

    private func notify(_ body: @escaping (CaptureSessionDelegate) -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let delegate = self.delegate else { return }
            body(delegate)
        }
    }

    private func notifyFailure(_ error: ScanError) {
        notify { [weak self] delegate in
            guard let self else { return }
            delegate.captureSession(self, didFail: error)
        }
    }

    private func completeOnMain(
        _ completion: @escaping (Result<CaptureSessionResult, ScanError>) -> Void,
        with result: Result<CaptureSessionResult, ScanError>
    ) {
        if Thread.isMainThread {
            completion(result)
        } else {
            DispatchQueue.main.async { completion(result) }
        }
    }
}

extension SCSessionAdapter: CameraManagerDelegate {
    func cameraDidOutput(
        colorBuffer: CVPixelBuffer,
        depthBuffer: CVPixelBuffer,
        depthCalibrationData: AVCameraCalibrationData
    ) {
        let isAccumulating = stateLock.withLock { () -> Bool in
            guard accumulating else { return false }
            frameStats.totalCaptured += 1
            updateDurationLocked()
            return true
        }

        let previewFrame = CapturePreviewFrame(
            colorBuffer: colorBuffer,
            depthBuffer: depthBuffer,
            cameraIntrinsics: depthCalibrationData.intrinsicMatrix,
            cameraTransform: nil,
            timestamp: ProcessInfo.processInfo.systemUptime
        )
        notify { [weak self] delegate in
            guard let self else { return }
            delegate.captureSession(self, didOutput: previewFrame)
        }

        guard isAccumulating, let reconstructionManager else { return }
        reconstructionManager.accumulate(
            depthBuffer: depthBuffer,
            colorBuffer: colorBuffer,
            calibrationData: depthCalibrationData
        )
    }
}

extension SCSessionAdapter: SCReconstructionManagerDelegate {
    func reconstructionManager(
        _ manager: SCReconstructionManager,
        didProcessWith metadata: SCAssimilatedFrameMetadata,
        statistics: SCReconstructionManagerStatistics
    ) {
        enum RecoveryEvent {
            case entered
            case recovered
            case failed
        }

        let result = stateLock.withLock { () -> (FrameStats, RecoveryEvent?) in
            var recoveryEvent: RecoveryEvent?
            switch metadata.result {
            case .succeeded:
                consecutivePoorTrackingFrames = 0
                if isRecovering {
                    consecutiveGoodFramesAfterRecovery += 1
                    if consecutiveGoodFramesAfterRecovery >= 5 {
                        isRecovering = false
                        consecutiveGoodFramesAfterRecovery = 0
                        recoveryEvent = .recovered
                    }
                } else {
                    frameStats.accepted += 1
                }

            case .poorTracking:
                consecutivePoorTrackingFrames += 1
                consecutiveGoodFramesAfterRecovery = 0
                frameStats.poorTracking += 1
                if consecutivePoorTrackingFrames
                    >= AppConfiguration.poorTrackingRecoveryThreshold,
                   !isRecovering {
                    isRecovering = true
                    recoveryEvent = .entered
                }

            case .lostTracking:
                consecutivePoorTrackingFrames += 1
                consecutiveGoodFramesAfterRecovery = 0
                frameStats.poorTracking += 1
                if !isRecovering {
                    isRecovering = true
                    recoveryEvent = .entered
                }

            case .failed:
                consecutiveGoodFramesAfterRecovery = 0
                isRecovering = false
                frameStats.poorTracking += 1
                if !reportedTrackingFailure {
                    reportedTrackingFailure = true
                    recoveryEvent = .failed
                }
            @unknown default:
                break
            }

            frameStats.dropped = statistics.droppedFrameCount
            updateDurationLocked()
            return (frameStats, recoveryEvent)
        }

        switch result.1 {
        case .entered:
            notify { [weak self] delegate in
                guard let self else { return }
                delegate.captureSessionDidEnterRecovery(self)
            }
        case .recovered:
            notify { [weak self] delegate in
                guard let self else { return }
                delegate.captureSessionDidRecoverTracking(self)
            }
        case .failed:
            // The manager is deliberately kept alive and unfinalized. The
            // capture coordinator decides whether the clinician rescans.
            notifyFailure(.trackingFailed)
        case nil:
            break
        }

        notify { [weak self] delegate in
            guard let self else { return }
            delegate.captureSession(self, didUpdate: result.0)
        }
    }

    func reconstructionManager(
        _ manager: SCReconstructionManager,
        didEncounterAPIError error: Error
    ) {
        notifyFailure(.cameraSessionFailed(reason: error.localizedDescription))
    }
}

extension SCSessionAdapter: DeviceMotionConsuming {
    func consumeDeviceMotion(_ motion: CMDeviceMotion) {
        guard
            stateLock.withLock({ accumulating }),
            let reconstructionManager
        else {
            return
        }
        reconstructionManager.accumulateDeviceMotion(motion)
    }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}
