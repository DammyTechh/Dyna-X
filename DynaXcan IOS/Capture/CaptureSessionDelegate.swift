import Foundation

enum CaptureProviderGuidance: Equatable {
    case slowDown
    case holdSteady
}

/// Events emitted by either native capture provider.
protocol CaptureSessionDelegate: AnyObject {
    func captureSessionDidStartPreview(_ session: CaptureSessionProtocol)
    func captureSession(
        _ session: CaptureSessionProtocol,
        didOutput previewFrame: CapturePreviewFrame
    )
    func captureSession(
        _ session: CaptureSessionProtocol,
        didUpdate frameStats: FrameStats
    )
    func captureSessionDidEnterRecovery(_ session: CaptureSessionProtocol)
    func captureSessionDidRecoverTracking(_ session: CaptureSessionProtocol)
    func captureSession(
        _ session: CaptureSessionProtocol,
        didUpdateProviderGuidance guidance: CaptureProviderGuidance?
    )
    func captureSession(
        _ session: CaptureSessionProtocol,
        didFail error: ScanError
    )
}

extension CaptureSessionDelegate {
    func captureSessionDidStartPreview(_ session: CaptureSessionProtocol) {}

    func captureSession(
        _ session: CaptureSessionProtocol,
        didOutput previewFrame: CapturePreviewFrame
    ) {}

    func captureSession(
        _ session: CaptureSessionProtocol,
        didUpdate frameStats: FrameStats
    ) {}

    func captureSessionDidEnterRecovery(_ session: CaptureSessionProtocol) {}

    func captureSessionDidRecoverTracking(_ session: CaptureSessionProtocol) {}

    func captureSession(
        _ session: CaptureSessionProtocol,
        didUpdateProviderGuidance guidance: CaptureProviderGuidance?
    ) {}

    func captureSession(
        _ session: CaptureSessionProtocol,
        didFail error: ScanError
    ) {}
}
