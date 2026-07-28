import CoreVideo
import CoreMotion
import Foundation
import simd

/// Camera frame delivered for preview and real-time quality analysis.
/// Pixel buffers remain retained for the lifetime of this value.
struct CapturePreviewFrame {
    let colorBuffer: CVPixelBuffer
    let depthBuffer: CVPixelBuffer?
    let cameraIntrinsics: simd_float3x3?
    let cameraTransform: simd_float4x4?
    let timestamp: TimeInterval
}

protocol CaptureSessionProtocol: AnyObject {
    var delegate: CaptureSessionDelegate? { get set }

    func configure() throws
    func startPreview()
    func startAccumulating()
    func pauseAccumulating()
    func stopAndFinalize(
        completion: @escaping (Result<CaptureSessionResult, ScanError>) -> Void
    )
    func cancel()
}

struct CaptureSessionResult {
    let pointCloudData: Data
    let frameStats: FrameStats
    let scannerType: DeviceCapabilities.ScannerType
}

/// Optional capability implemented by providers that consume fused device motion.
/// CaptureSession keeps this below its framework boundary and feeds it from the
/// app's single MotionMonitor instance.
protocol DeviceMotionConsuming: AnyObject {
    func consumeDeviceMotion(_ motion: CMDeviceMotion)
}
