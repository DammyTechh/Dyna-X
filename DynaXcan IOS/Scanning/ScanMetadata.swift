import UIKit

/// Immutable provenance record created for a completed export.
struct ScanMetadata: Codable {
    let scanId: String
    let createdAt: Date

    let bodySegment: String
    let clinicianNote: String?

    let deviceModel: String
    let systemVersion: String
    let scannerType: String

    let totalFramesCaptured: Int
    let framesAccepted: Int
    let framesPoorTracking: Int
    let framesDropped: Int
    let pass1FramesAccepted: Int
    let pass2FramesAccepted: Int
    let pass3FramesAccepted: Int
    let scanDurationSeconds: Double
    let environmentOverridden: Bool

    let exportFormat: String
    let exportedAt: Date

    static func create(
        scanId: String,
        bodySegment: BodySegment,
        scannerType: DeviceCapabilities.ScannerType,
        frameStats: FrameStats,
        exportFormat: String,
        environmentOverridden: Bool,
        clinicianNote: String? = nil
    ) -> ScanMetadata {
        let device = UIDevice.current
        let timestamp = Date()

        return ScanMetadata(
            scanId: scanId,
            createdAt: timestamp,
            bodySegment: bodySegment.rawValue,
            clinicianNote: clinicianNote,
            deviceModel: device.model,
            systemVersion: device.systemVersion,
            scannerType: scannerType.rawValue,
            totalFramesCaptured: frameStats.totalCaptured,
            framesAccepted: frameStats.accepted,
            framesPoorTracking: frameStats.poorTracking,
            framesDropped: frameStats.dropped,
            pass1FramesAccepted: frameStats.pass1Accepted,
            pass2FramesAccepted: frameStats.pass2Accepted,
            pass3FramesAccepted: frameStats.pass3Accepted,
            scanDurationSeconds: frameStats.durationSeconds,
            environmentOverridden: environmentOverridden,
            exportFormat: exportFormat,
            exportedAt: timestamp
        )
    }
}

struct FrameStats {
    var totalCaptured = 0
    var accepted = 0
    var poorTracking = 0
    var dropped = 0
    var pass1Accepted = 0
    var pass2Accepted = 0
    var pass3Accepted = 0
    var durationSeconds: Double = 0
}
