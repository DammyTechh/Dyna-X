import Foundation

enum SCFusionManager {
    static func makeSession(
        for capabilities: DeviceCapabilities,
        configuration: ScanConfiguration
    ) -> CaptureSessionProtocol {
        switch capabilities.scannerType {
        case .lidar:
            LiDARSessionAdapter(configuration: configuration)
        case .trueDepth:
            SCSessionAdapter(configuration: configuration)
        case .none:
            fatalError("Cannot create a capture session without supported hardware")
        }
    }
}
