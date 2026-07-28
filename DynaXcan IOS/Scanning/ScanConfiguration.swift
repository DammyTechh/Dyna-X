import Foundation

/// Immutable configuration for one DynaXcan scan session.
struct ScanConfiguration {
    let bodySegment: BodySegment
    let minimumFramesPerPass: Int
    let minimumTotalFrames: Int
    let workingDistance: AppConfiguration.WorkingDistance
    let maximumDurationSeconds: TimeInterval

    /// Reserved for the version-two texture projection pipeline.
    let collectColorBuffers: Bool

    static func defaultConfiguration(
        for segment: BodySegment,
        scannerType: DeviceCapabilities.ScannerType
    ) -> ScanConfiguration {
        let minimumFramesPerPass: Int
        switch scannerType {
        case .lidar:
            minimumFramesPerPass = AppConfiguration.lidarMinimumFramesPerPass
        case .trueDepth:
            minimumFramesPerPass = AppConfiguration.truedepthMinimumFramesPerPass
        case .none:
            preconditionFailure("Cannot configure a scan without supported hardware")
        }

        ScanConfiguration(
            bodySegment: segment,
            minimumFramesPerPass: minimumFramesPerPass,
            minimumTotalFrames: AppConfiguration.minimumTotalFrames,
            workingDistance: AppConfiguration.workingDistance(for: segment),
            maximumDurationSeconds: AppConfiguration.maximumScanDurationSeconds,
            collectColorBuffers: false
        )
    }
}
