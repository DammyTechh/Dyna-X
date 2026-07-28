import Foundation

enum ScanSessionState {
    case requestingPermission
    case environmentCheck
    case countdownToPass(pass: ScanPass, secondsRemaining: Int)
    case scanning(pass: ScanPass)
    case passComplete(pass: ScanPass, framesAccepted: Int)
    case recovering
    case finalizing
    case processing(stage: String, progress: Float)
    case exportComplete
    case failed(ScanError)
    case cancelled
}
