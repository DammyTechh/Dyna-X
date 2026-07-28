import Foundation

/// Reports tracking recovery state to the UI layer. It never injects poses;
/// StandardCyborgFusion and ARKit retain ownership of their recovery pipelines.
final class TrackingRecoveryEngine {
    enum RecoveryState: Equatable {
        case stable
        case recovering(durationSeconds: TimeInterval)
        case failed
    }

    static let maximumRecoveryDuration: TimeInterval = 5

    /// Called only for material transitions: entering recovery, recovering,
    /// or exceeding the recovery deadline.
    var stateDidChange: ((RecoveryState) -> Void)?

    private let lock = NSLock()
    private var recoveryStartTime: Date?
    private var storedState: RecoveryState = .stable

    var state: RecoveryState {
        lock.withLock { storedState }
    }

    func didEnterRecovery() {
        let transition = lock.withLock { () -> RecoveryState? in
            guard recoveryStartTime == nil, storedState != .failed else { return nil }
            recoveryStartTime = Date()
            storedState = .recovering(durationSeconds: 0)
            return storedState
        }
        if let transition { stateDidChange?(transition) }
    }

    func didRecoverTracking() {
        let transition = lock.withLock { () -> RecoveryState? in
            guard storedState != .failed else { return nil }
            guard recoveryStartTime != nil || storedState != .stable else { return nil }
            recoveryStartTime = nil
            storedState = .stable
            return storedState
        }
        if let transition { stateDidChange?(transition) }
    }

    func didFail() {
        let transition = lock.withLock { () -> RecoveryState? in
            guard storedState != .failed else { return nil }
            recoveryStartTime = nil
            storedState = .failed
            return storedState
        }
        if let transition { stateDidChange?(transition) }
    }

    /// Updates elapsed recovery time for guidance. A provider can recover at
    /// any point before the five-second deadline without losing scan data.
    func tick() {
        let transition = lock.withLock { () -> RecoveryState? in
            guard let recoveryStartTime else { return nil }
            let duration = Date().timeIntervalSince(recoveryStartTime)
            if duration > Self.maximumRecoveryDuration {
                self.recoveryStartTime = nil
                storedState = .failed
                return storedState
            }
            storedState = .recovering(durationSeconds: duration)
            return nil
        }
        if let transition { stateDidChange?(transition) }
    }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}
