import CoreVideo
import Foundation

struct DistanceReading: Equatable {
    let estimatedMetres: Float
    let confidence: Float
    let classification: DistanceClassification
}

enum DistanceClassification: Equatable {
    case tooClose
    case good
    case tooFar
    case unknown
}

/// CPU depth sampler shared by TrueDepth and LiDAR. Both adapters expose
/// metric Float32 depth maps through CapturePreviewFrame.
final class WorkingDistanceEstimator {
    private let workingDistance: AppConfiguration.WorkingDistance

    init(configuration: ScanConfiguration) {
        workingDistance = configuration.workingDistance
    }

    func estimate(from depthBuffer: CVPixelBuffer?) -> DistanceReading {
        guard let depthBuffer else { return unknownReading }
        guard CVPixelBufferGetPixelFormatType(depthBuffer) == kCVPixelFormatType_DepthFloat32 else {
            return unknownReading
        }

        let lockFlags: CVPixelBufferLockFlags = .readOnly
        guard CVPixelBufferLockBaseAddress(depthBuffer, lockFlags) == kCVReturnSuccess else {
            return unknownReading
        }
        defer { CVPixelBufferUnlockBaseAddress(depthBuffer, lockFlags) }

        guard let baseAddress = CVPixelBufferGetBaseAddress(depthBuffer) else {
            return unknownReading
        }

        let width = CVPixelBufferGetWidth(depthBuffer)
        let height = CVPixelBufferGetHeight(depthBuffer)
        let floatsPerRow = CVPixelBufferGetBytesPerRow(depthBuffer) / MemoryLayout<Float>.size
        let values = baseAddress.assumingMemoryBound(to: Float.self)

        let xStart = Int(Float(width) * 0.30)
        let xEnd = Int(Float(width) * 0.70)
        let yStart = Int(Float(height) * 0.30)
        let yEnd = Int(Float(height) * 0.70)
        let sampleStep = max(1, min(width, height) / 64)

        var samples: [Float] = []
        var attemptedSamples = 0
        samples.reserveCapacity(4_096)

        for y in stride(from: yStart, to: yEnd, by: sampleStep) {
            for x in stride(from: xStart, to: xEnd, by: sampleStep) {
                attemptedSamples += 1
                let value = values[y * floatsPerRow + x]
                if value.isFinite, value > 0 {
                    samples.append(value)
                }
            }
        }

        guard attemptedSamples > 0, !samples.isEmpty else { return unknownReading }

        let confidence = min(1, Float(samples.count) / Float(attemptedSamples))
        guard confidence >= AppConfiguration.minimumValidDepthSampleRatio else {
            return DistanceReading(
                estimatedMetres: median(of: samples),
                confidence: confidence,
                classification: .unknown
            )
        }

        let distance = median(of: samples)
        let classification: DistanceClassification
        if distance < workingDistance.minimum {
            classification = .tooClose
        } else if distance > workingDistance.maximum {
            classification = .tooFar
        } else {
            classification = .good
        }

        return DistanceReading(
            estimatedMetres: distance,
            confidence: confidence,
            classification: classification
        )
    }

    private var unknownReading: DistanceReading {
        DistanceReading(
            estimatedMetres: 0,
            confidence: 0,
            classification: .unknown
        )
    }

    private func median(of values: [Float]) -> Float {
        let sorted = values.sorted()
        let middle = sorted.count / 2
        if sorted.count.isMultiple(of: 2) {
            return (sorted[middle - 1] + sorted[middle]) * 0.5
        }
        return sorted[middle]
    }
}
