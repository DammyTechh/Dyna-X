import ARKit
import AVFoundation

/// Reports depth hardware and camera permission without prompting the user.
struct DeviceCapabilities {
    enum ScannerType: String, Codable {
        /// The version-one capture provider supported by StandardCyborg CameraManager.
        case trueDepth

        /// Rear-facing ARKit scene reconstruction, preferred for version-one capture.
        case lidar

        case none
    }

    enum CameraPermission: String, Codable {
        case authorized
        case denied
        case notDetermined
        case restricted
    }

    /// Best scanner available for the current provider. LiDAR takes precedence.
    let scannerType: ScannerType
    let cameraPermission: CameraPermission
    let hasTrueDepth: Bool
    let hasLiDAR: Bool

    var canScan: Bool {
        scannerType != .none && cameraPermission == .authorized
    }

    var hardwareSupported: Bool {
        scannerType != .none
    }

    static func detect() -> DeviceCapabilities {
        let hasTrueDepth = ARFaceTrackingConfiguration.isSupported
        let hasLiDAR = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)

        let scannerType: ScannerType
        if hasLiDAR {
            scannerType = .lidar
        } else if hasTrueDepth {
            scannerType = .trueDepth
        } else {
            scannerType = .none
        }

        return DeviceCapabilities(
            scannerType: scannerType,
            cameraPermission: detectCameraPermission(),
            hasTrueDepth: hasTrueDepth,
            hasLiDAR: hasLiDAR
        )
    }

    private static func detectCameraPermission() -> CameraPermission {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: .authorized
        case .denied: .denied
        case .notDetermined: .notDetermined
        case .restricted: .restricted
        @unknown default: .notDetermined
        }
    }
}
