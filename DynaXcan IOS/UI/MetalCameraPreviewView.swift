import CoreImage
import MetalKit
import UIKit

/// Metal-backed preview shared by both capture providers. It consumes only the
/// provider-neutral color buffer exposed at the app's capture boundary.
final class MetalCameraPreviewView: MTKView, MTKViewDelegate {
    private let commandQueue: MTLCommandQueue
    private let imageContext: CIContext
    private let outputColorSpace = CGColorSpaceCreateDeviceRGB()
    private var image: CIImage?

    init() {
        guard
            let device = MTLCreateSystemDefaultDevice(),
            let commandQueue = device.makeCommandQueue()
        else {
            preconditionFailure("This device cannot display the camera preview.")
        }
        self.commandQueue = commandQueue
        imageContext = CIContext(mtlDevice: device)
        super.init(frame: .zero, device: device)
        delegate = self
        framebufferOnly = false
        enableSetNeedsDisplay = true
        isPaused = true
        autoResizeDrawable = true
        contentMode = .scaleAspectFill
        backgroundColor = DynaXBrand.background
        translatesAutoresizingMaskIntoConstraints = false
    }

    required init(coder: NSCoder) {
        preconditionFailure("MetalCameraPreviewView must be created in code.")
    }

    func display(_ frame: CapturePreviewFrame) {
        image = CIImage(cvPixelBuffer: frame.colorBuffer)
        setNeedsDisplay()
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard
            let image,
            let drawable = currentDrawable,
            let commandBuffer = commandQueue.makeCommandBuffer()
        else { return }

        let target = CGRect(origin: .zero, size: drawableSize)
        let scale = max(target.width / image.extent.width, target.height / image.extent.height)
        let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let offset = CGAffineTransform(
            translationX: (target.width - scaled.extent.width) / 2 - scaled.extent.minX,
            y: (target.height - scaled.extent.height) / 2 - scaled.extent.minY
        )
        imageContext.render(
            scaled.transformed(by: offset),
            to: drawable.texture,
            commandBuffer: commandBuffer,
            bounds: target,
            colorSpace: outputColorSpace
        )
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
