import Foundation

/// Structured failures emitted by the DynaXcan scanning pipeline.
enum ScanError: Error, LocalizedError {
    case hardwareNotSupported
    case cameraPermissionDenied
    case cameraPermissionRestricted
    case cameraSessionFailed(reason: String)
    case thermalStateCritical

    case trackingFailed
    case insufficientFrames(captured: Int, required: Int)
    case scanInterrupted
    case scanCancelled

    case meshingFailed(reason: String)
    case exportFailed(reason: String)
    case pointCloudPersistenceFailed(reason: String)

    var errorDescription: String? {
        switch self {
        case .hardwareNotSupported:
            "This device does not have a supported LiDAR or TrueDepth scanner."
        case .cameraPermissionDenied:
            "Camera access is required to scan. Please enable it in Settings."
        case .cameraPermissionRestricted:
            "Camera access is restricted on this device."
        case .cameraSessionFailed(let reason):
            "The camera could not start. \(reason)"
        case .thermalStateCritical:
            "The device is too hot to continue scanning. Please allow it to cool down."
        case .trackingFailed:
            "The camera lost its place during the scan. Please try again."
        case .insufficientFrames(let captured, let required):
            "Not enough scan coverage. Captured \(captured) frames; at least \(required) are required."
        case .scanInterrupted:
            "The scan was interrupted. Please try again."
        case .scanCancelled:
            "Scan cancelled."
        case .meshingFailed(let reason):
            "Could not build the 3D scan. \(reason)"
        case .exportFailed(let reason):
            "Could not prepare the scan file. \(reason)"
        case .pointCloudPersistenceFailed(let reason):
            "Could not save the original scan data. \(reason)"
        }
    }

    var code: String {
        switch self {
        case .hardwareNotSupported: "HARDWARE_NOT_SUPPORTED"
        case .cameraPermissionDenied: "CAMERA_PERMISSION_DENIED"
        case .cameraPermissionRestricted: "CAMERA_PERMISSION_RESTRICTED"
        case .cameraSessionFailed: "CAMERA_SESSION_FAILED"
        case .thermalStateCritical: "THERMAL_STATE_CRITICAL"
        case .trackingFailed: "TRACKING_FAILED"
        case .insufficientFrames: "INSUFFICIENT_FRAMES"
        case .scanInterrupted: "SCAN_INTERRUPTED"
        case .scanCancelled: "SCAN_CANCELLED"
        case .meshingFailed: "MESHING_FAILED"
        case .exportFailed: "EXPORT_FAILED"
        case .pointCloudPersistenceFailed: "POINT_CLOUD_PERSISTENCE_FAILED"
        }
    }
}
