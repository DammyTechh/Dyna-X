import Foundation

/// Central configuration for DynaXcan iOS.
/// Environment-specific and clinically tunable values live here.
enum AppConfiguration {
    // MARK: - Capture

    static let minimumFramesPerPass = 80
    static let lidarMinimumFramesPerPass = 60
    static let truedepthMinimumFramesPerPass = 80
    static let minimumTotalFrames = 300
    static let maximumScanDurationSeconds: TimeInterval = 180
    static let rawPointCloudRetentionSeconds: TimeInterval = 7 * 24 * 60 * 60

    // MARK: - Working distance

    struct WorkingDistance: Equatable {
        let minimum: Float
        let ideal: Float
        let maximum: Float

        init(minimum: Float, ideal: Float, maximum: Float) {
            precondition(minimum <= ideal && ideal <= maximum)
            self.minimum = minimum
            self.ideal = ideal
            self.maximum = maximum
        }
    }

    static let workingDistances: [BodySegment: WorkingDistance] = [
        .residualLimbTranstibial: WorkingDistance(minimum: 0.20, ideal: 0.30, maximum: 0.40),
        .residualLimbTransfemoral: WorkingDistance(minimum: 0.20, ideal: 0.30, maximum: 0.40),
        .foot: WorkingDistance(minimum: 0.20, ideal: 0.28, maximum: 0.38),
        .hand: WorkingDistance(minimum: 0.20, ideal: 0.28, maximum: 0.38),
        .lowerLeg: WorkingDistance(minimum: 0.30, ideal: 0.42, maximum: 0.55),
        .upperLimb: WorkingDistance(minimum: 0.30, ideal: 0.42, maximum: 0.55),
        .torso: WorkingDistance(minimum: 0.45, ideal: 0.60, maximum: 0.75),
        .spinalRegion: WorkingDistance(minimum: 0.45, ideal: 0.60, maximum: 0.75),
        .generic: WorkingDistance(minimum: 0.20, ideal: 0.40, maximum: 0.70)
    ]

    static func workingDistance(for segment: BodySegment) -> WorkingDistance {
        guard let distance = workingDistances[segment] ?? workingDistances[.generic] else {
            preconditionFailure("A generic working distance must be configured")
        }
        return distance
    }

    // MARK: - Pass angles

    static let pass1PitchDegrees: Float = 0
    static let pass2PitchDegrees: Float = -30
    static let pass3PitchDegrees: Float = 30
    static let pitchToleranceDegrees: Float = 15

    // MARK: - Quality thresholds

    static let minimumLuminance: Float = 0.25
    static let maximumLuminance: Float = 0.85
    static let poorTrackingRecoveryThreshold = 8
    static let excessiveAngularVelocityRadiansPerSecond: Float = 1.2
    static let minimumValidDepthSampleRatio: Float = 0.10
    static let maximumBackgroundDepthStandardDeviationMetres: Float = 0.18
    static let guidanceEvaluationInterval: TimeInterval = 0.5

    // MARK: - Export

    static let exportDirectoryPrefix = "DynaXcan_Scan_"
    static let plyExportPrefix = "DynaXcan_Scan_"
    static let rawExportPrefix = "DynaXcan_Raw_"
}
