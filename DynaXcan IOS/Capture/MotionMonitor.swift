import CoreMotion
import Foundation

struct MotionReading: Equatable {
    let angularVelocityMagnitude: Float
    let pitchDegrees: Float
    let isExcessiveMotion: Bool
    let pitchOffsetFromTarget: Float
}

protocol MotionMonitorDelegate: AnyObject {
    func motionMonitor(_ monitor: MotionMonitor, didUpdate reading: MotionReading)
}

/// Sole owner of CMMotionManager for DynaXcan. Guidance consumes MotionReading,
/// while the raw handler allows the TrueDepth driver to receive gravity samples.
final class MotionMonitor {
    weak var delegate: MotionMonitorDelegate?

    /// Internal capture-boundary hook; never exposed to ScanCoordinator or UI.
    var rawDeviceMotionHandler: ((CMDeviceMotion) -> Void)?

    private let motionManager: CMMotionManager
    private let operationQueue: OperationQueue
    private let stateLock = NSLock()
    private var targetPitchDegrees: Float

    init(
        targetPitchDegrees: Float,
        motionManager: CMMotionManager = CMMotionManager()
    ) {
        self.targetPitchDegrees = targetPitchDegrees
        self.motionManager = motionManager

        let queue = OperationQueue()
        queue.name = "com.dynaxcan.motion-monitor"
        queue.maxConcurrentOperationCount = 1
        queue.qualityOfService = .userInitiated
        operationQueue = queue
    }

    deinit {
        stop()
    }

    var isAvailable: Bool {
        motionManager.isDeviceMotionAvailable
    }

    func updateTargetPitchDegrees(_ target: Float) {
        stateLock.withLock {
            targetPitchDegrees = target
        }
    }

    @discardableResult
    func start() -> Bool {
        guard motionManager.isDeviceMotionAvailable else { return false }
        guard !motionManager.isDeviceMotionActive else { return true }

        motionManager.deviceMotionUpdateInterval = 1.0 / 30.0
        motionManager.startDeviceMotionUpdates(
            using: .xArbitraryZVertical,
            to: operationQueue
        ) { [weak self] motion, _ in
            guard let self, let motion else { return }

            let rotationRate = motion.rotationRate
            let magnitude = Float(
                sqrt(
                    rotationRate.x * rotationRate.x
                        + rotationRate.y * rotationRate.y
                        + rotationRate.z * rotationRate.z
                )
            )
            let pitch = Float(motion.attitude.pitch * 180.0 / .pi)
            let target = self.stateLock.withLock { self.targetPitchDegrees }
            let reading = MotionReading(
                angularVelocityMagnitude: magnitude,
                pitchDegrees: pitch,
                isExcessiveMotion: magnitude
                    > AppConfiguration.excessiveAngularVelocityRadiansPerSecond,
                pitchOffsetFromTarget: pitch - target
            )

            self.rawDeviceMotionHandler?(motion)
            self.delegate?.motionMonitor(self, didUpdate: reading)
        }
        return true
    }

    func stop() {
        motionManager.stopDeviceMotionUpdates()
        operationQueue.cancelAllOperations()
    }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}
