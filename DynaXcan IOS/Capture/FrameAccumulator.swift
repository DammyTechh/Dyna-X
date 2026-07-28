import Foundation

struct PassFrameStats: Equatable {
    var accepted = 0
    var poorTracking = 0
    var dropped = 0
}

/// Converts cumulative provider statistics into per-frame deltas and attributes
/// those deltas to the pass that was active when they arrived.
final class FrameAccumulator {
    private let minimumFramesPerPass: Int
    private let minimumTotalFrames: Int

    private var lastProviderStats = FrameStats()
    private var passStats: [ScanPass: PassFrameStats] = [:]

    private(set) var frameStats = FrameStats()
    private(set) var consecutivePoorTrackingCount = 0

    init(minimumFramesPerPass: Int, minimumTotalFrames: Int) {
        precondition(minimumFramesPerPass > 0)
        precondition(minimumTotalFrames >= minimumFramesPerPass)
        self.minimumFramesPerPass = minimumFramesPerPass
        self.minimumTotalFrames = minimumTotalFrames

        for pass in ScanPass.allCases {
            passStats[pass] = PassFrameStats()
        }
    }

    @discardableResult
    func ingest(providerStats: FrameStats, for pass: ScanPass) -> FrameStats {
        let capturedDelta = nonnegativeDelta(providerStats.totalCaptured, lastProviderStats.totalCaptured)
        let acceptedDelta = nonnegativeDelta(providerStats.accepted, lastProviderStats.accepted)
        let poorDelta = nonnegativeDelta(providerStats.poorTracking, lastProviderStats.poorTracking)
        let droppedDelta = nonnegativeDelta(providerStats.dropped, lastProviderStats.dropped)

        var currentPassStats = passStats[pass] ?? PassFrameStats()
        currentPassStats.accepted += acceptedDelta
        currentPassStats.poorTracking += poorDelta
        currentPassStats.dropped += droppedDelta
        passStats[pass] = currentPassStats

        frameStats.totalCaptured += capturedDelta
        frameStats.accepted += acceptedDelta
        frameStats.poorTracking += poorDelta
        frameStats.dropped += droppedDelta
        frameStats.durationSeconds = max(frameStats.durationSeconds, providerStats.durationSeconds)
        applyAcceptedPassCounts()

        if acceptedDelta > 0 {
            consecutivePoorTrackingCount = 0
        } else if poorDelta > 0 {
            consecutivePoorTrackingCount += poorDelta
        }

        lastProviderStats = providerStats
        return frameStats
    }

    func mergeFinalProviderStats(_ providerStats: FrameStats) -> FrameStats {
        frameStats.totalCaptured = max(frameStats.totalCaptured, providerStats.totalCaptured)
        frameStats.poorTracking = max(frameStats.poorTracking, providerStats.poorTracking)
        frameStats.dropped = max(frameStats.dropped, providerStats.dropped)
        frameStats.durationSeconds = max(frameStats.durationSeconds, providerStats.durationSeconds)
        applyAcceptedPassCounts()
        return frameStats
    }

    func statistics(for pass: ScanPass) -> PassFrameStats {
        passStats[pass] ?? PassFrameStats()
    }

    func acceptedFrames(for pass: ScanPass) -> Int {
        statistics(for: pass).accepted
    }

    func currentPassProgress(for pass: ScanPass) -> Float {
        min(1, Float(acceptedFrames(for: pass)) / Float(minimumFramesPerPass))
    }

    var totalProgress: Float {
        min(1, Float(frameStats.accepted) / Float(minimumTotalFrames))
    }

    func isCurrentPassComplete(_ pass: ScanPass) -> Bool {
        acceptedFrames(for: pass) >= minimumFramesPerPass
    }

    var isScanComplete: Bool {
        frameStats.accepted >= minimumTotalFrames
    }

    private func applyAcceptedPassCounts() {
        frameStats.pass1Accepted = acceptedFrames(for: .pass1Circumferential)
        frameStats.pass2Accepted = acceptedFrames(for: .pass2Distal)
        frameStats.pass3Accepted = acceptedFrames(for: .pass3Proximal)
    }

    private func nonnegativeDelta(_ current: Int, _ previous: Int) -> Int {
        current >= previous ? current - previous : current
    }
}
