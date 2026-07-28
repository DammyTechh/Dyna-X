import CoreVideo
import Foundation

struct EnvironmentReading: Equatable {
    let lighting: LightingClassification
    let distance: DistanceClassification
    let backgroundComplexity: BackgroundClassification
    let isReadyToScan: Bool
    let overrideAllowed: Bool
}

enum LightingClassification: Equatable {
    case tooDark
    case acceptable
    case tooBright
}

enum BackgroundClassification: Equatable {
    case clean
    case cluttered
    case unknown
}

struct EnvironmentEvaluation: Equatable {
    let environment: EnvironmentReading
    let distance: DistanceReading
    let meanLuminance: Float
    let peripheralDepthStandardDeviation: Float?
}

/// Lightweight CPU checks for the live RGB and depth buffers. Callers run this
/// on a dedicated analysis queue so camera delivery and the main thread remain free.
final class EnvironmentChecker {
    private let distanceEstimator: WorkingDistanceEstimator

    init(configuration: ScanConfiguration) {
        distanceEstimator = WorkingDistanceEstimator(configuration: configuration)
    }

    func evaluate(
        colorBuffer: CVPixelBuffer,
        depthBuffer: CVPixelBuffer?
    ) -> EnvironmentEvaluation {
        let luminance = meanCentralLuminance(in: colorBuffer)
        let lighting: LightingClassification
        if luminance < AppConfiguration.minimumLuminance {
            lighting = .tooDark
        } else if luminance > AppConfiguration.maximumLuminance {
            lighting = .tooBright
        } else {
            lighting = .acceptable
        }

        let distance = distanceEstimator.estimate(from: depthBuffer)
        let backgroundResult = peripheralDepthComplexity(in: depthBuffer)
        let background = backgroundResult.classification
        let isReady = lighting == .acceptable
            && distance.classification == .good
            && background == .clean

        return EnvironmentEvaluation(
            environment: EnvironmentReading(
                lighting: lighting,
                distance: distance.classification,
                backgroundComplexity: background,
                isReadyToScan: isReady,
                overrideAllowed: true
            ),
            distance: distance,
            meanLuminance: luminance,
            peripheralDepthStandardDeviation: backgroundResult.standardDeviation
        )
    }

    private func meanCentralLuminance(in pixelBuffer: CVPixelBuffer) -> Float {
        let lockFlags: CVPixelBufferLockFlags = .readOnly
        guard CVPixelBufferLockBaseAddress(pixelBuffer, lockFlags) == kCVReturnSuccess else {
            return 0
        }
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, lockFlags) }

        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let xStart = Int(Float(width) * 0.30)
        let xEnd = Int(Float(width) * 0.70)
        let yStart = Int(Float(height) * 0.30)
        let yEnd = Int(Float(height) * 0.70)
        let sampleStep = max(1, min(width, height) / 80)
        let format = CVPixelBufferGetPixelFormatType(pixelBuffer)

        var total: Float = 0
        var sampleCount = 0

        switch format {
        case kCVPixelFormatType_32BGRA:
            guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else { return 0 }
            let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
            let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)

            for y in stride(from: yStart, to: yEnd, by: sampleStep) {
                for x in stride(from: xStart, to: xEnd, by: sampleStep) {
                    let pixel = bytes.advanced(by: y * bytesPerRow + x * 4)
                    let blue = Float(pixel[0]) / 255
                    let green = Float(pixel[1]) / 255
                    let red = Float(pixel[2]) / 255
                    total += 0.2126 * red + 0.7152 * green + 0.0722 * blue
                    sampleCount += 1
                }
            }

        case kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
             kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange:
            guard let yPlane = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { return 0 }
            let bytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
            let bytes = yPlane.assumingMemoryBound(to: UInt8.self)
            let isVideoRange = format == kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange

            for y in stride(from: yStart, to: yEnd, by: sampleStep) {
                for x in stride(from: xStart, to: xEnd, by: sampleStep) {
                    let raw = Float(bytes[y * bytesPerRow + x])
                    let normalized = isVideoRange
                        ? max(0, min(1, (raw - 16) / 219))
                        : raw / 255
                    total += normalized
                    sampleCount += 1
                }
            }

        default:
            return 0
        }

        return sampleCount > 0 ? total / Float(sampleCount) : 0
    }

    private func peripheralDepthComplexity(
        in depthBuffer: CVPixelBuffer?
    ) -> (classification: BackgroundClassification, standardDeviation: Float?) {
        guard let depthBuffer else { return (.unknown, nil) }
        guard CVPixelBufferGetPixelFormatType(depthBuffer) == kCVPixelFormatType_DepthFloat32 else {
            return (.unknown, nil)
        }

        let lockFlags: CVPixelBufferLockFlags = .readOnly
        guard CVPixelBufferLockBaseAddress(depthBuffer, lockFlags) == kCVReturnSuccess else {
            return (.unknown, nil)
        }
        defer { CVPixelBufferUnlockBaseAddress(depthBuffer, lockFlags) }

        guard let baseAddress = CVPixelBufferGetBaseAddress(depthBuffer) else {
            return (.unknown, nil)
        }

        let width = CVPixelBufferGetWidth(depthBuffer)
        let height = CVPixelBufferGetHeight(depthBuffer)
        let floatsPerRow = CVPixelBufferGetBytesPerRow(depthBuffer) / MemoryLayout<Float>.size
        let values = baseAddress.assumingMemoryBound(to: Float.self)
        let sampleStep = max(1, min(width, height) / 64)
        let centralX = Int(Float(width) * 0.20)..<Int(Float(width) * 0.80)
        let centralY = Int(Float(height) * 0.20)..<Int(Float(height) * 0.80)

        var samples: [Float] = []
        var attempted = 0
        samples.reserveCapacity(4_096)

        for y in stride(from: 0, to: height, by: sampleStep) {
            for x in stride(from: 0, to: width, by: sampleStep) {
                if centralX.contains(x), centralY.contains(y) { continue }
                attempted += 1
                let depth = values[y * floatsPerRow + x]
                if depth.isFinite, depth > 0 {
                    samples.append(depth)
                }
            }
        }

        guard attempted > 0 else { return (.unknown, nil) }
        let validRatio = Float(samples.count) / Float(attempted)
        guard
            validRatio >= AppConfiguration.minimumValidDepthSampleRatio,
            samples.count > 1
        else {
            return (.unknown, nil)
        }

        let mean = samples.reduce(0, +) / Float(samples.count)
        let variance = samples.reduce(0) { partial, depth in
            let difference = depth - mean
            return partial + difference * difference
        } / Float(samples.count)
        let standardDeviation = sqrt(variance)
        let classification: BackgroundClassification = standardDeviation
            > AppConfiguration.maximumBackgroundDepthStandardDeviationMetres
            ? .cluttered
            : .clean

        return (classification, standardDeviation)
    }
}
