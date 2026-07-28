import Foundation

enum ScanPass: Int, CaseIterable, Codable, Hashable {
    case pass1Circumferential = 1
    case pass2Distal = 2
    case pass3Proximal = 3

    var displayName: String {
        switch self {
        case .pass1Circumferential: "Pass 1 — Circumferential"
        case .pass2Distal: "Pass 2 — Distal"
        case .pass3Proximal: "Pass 3 — Proximal"
        }
    }

    var instruction: String {
        switch self {
        case .pass1Circumferential:
            "Hold the phone level and move steadily around the patient."
        case .pass2Distal:
            "Angle the phone downward and complete another steady pass."
        case .pass3Proximal:
            "Angle the phone upward and complete the final steady pass."
        }
    }

    var targetPitchDegrees: Float {
        switch self {
        case .pass1Circumferential: AppConfiguration.pass1PitchDegrees
        case .pass2Distal: AppConfiguration.pass2PitchDegrees
        case .pass3Proximal: AppConfiguration.pass3PitchDegrees
        }
    }

    var nextPass: ScanPass? {
        ScanPass(rawValue: rawValue + 1)
    }
}

enum PassState: Equatable {
    case waitingToStart
    case active(framesAccepted: Int)
    case paused(reason: PauseReason)
    case complete(framesAccepted: Int)
}

enum PauseReason: Equatable {
    case trackingRecoveryFailed
    case motionTooFast
    case distanceOutOfRange
}

protocol PassControllerDelegate: AnyObject {
    func passController(
        _ controller: PassController,
        didChange state: PassState,
        pass: ScanPass
    )
    func passControllerDidConfirmAllPasses(_ controller: PassController)
}

/// Main-thread state machine for the three clinician-confirmed capture passes.
final class PassController {
    weak var delegate: PassControllerDelegate?

    private(set) var currentPass: ScanPass = .pass1Circumferential
    private(set) var state: PassState = .waitingToStart

    private let minimumFramesPerPass: Int
    private let minimumTotalFrames: Int
    private var currentFramesAccepted = 0
    private var totalFramesAccepted = 0

    init(minimumFramesPerPass: Int, minimumTotalFrames: Int) {
        precondition(minimumFramesPerPass > 0)
        precondition(minimumTotalFrames >= minimumFramesPerPass)
        self.minimumFramesPerPass = minimumFramesPerPass
        self.minimumTotalFrames = minimumTotalFrames
    }

    @discardableResult
    func startCurrentPass() -> Bool {
        guard state == .waitingToStart else { return false }
        transition(to: .active(framesAccepted: currentFramesAccepted))
        return true
    }

    func updateFrameCounts(currentPassAccepted: Int, totalAccepted: Int) {
        currentFramesAccepted = max(0, currentPassAccepted)
        totalFramesAccepted = max(0, totalAccepted)

        switch state {
        case .active:
            transition(to: stateForCurrentProgress())
        case .complete:
            transition(to: stateForCurrentProgress())
        case .waitingToStart, .paused:
            break
        }
    }

    /// Passing a reason pauses an active pass. Passing nil automatically resumes
    /// once all blocking conditions have recovered.
    func setPauseReason(_ reason: PauseReason?) {
        if let reason {
            switch state {
            case .active, .paused:
                transition(to: .paused(reason: reason))
            case .waitingToStart, .complete:
                break
            }
            return
        }

        guard case .paused = state else { return }
        transition(to: stateForCurrentProgress())
    }

    /// A completed pass never advances automatically. The clinician must call
    /// this explicitly after reviewing coverage and positioning.
    @discardableResult
    func confirmCurrentPass() -> Bool {
        guard case .complete = state else { return false }

        if let nextPass = currentPass.nextPass {
            currentPass = nextPass
            currentFramesAccepted = 0
            transition(to: .waitingToStart, force: true)
        } else {
            delegate?.passControllerDidConfirmAllPasses(self)
        }
        return true
    }

    private func stateForCurrentProgress() -> PassState {
        let passHasCoverage = currentFramesAccepted >= minimumFramesPerPass
        let scanHasCoverage = totalFramesAccepted >= minimumTotalFrames
        let mayComplete = passHasCoverage && (currentPass.nextPass != nil || scanHasCoverage)

        return mayComplete
            ? .complete(framesAccepted: currentFramesAccepted)
            : .active(framesAccepted: currentFramesAccepted)
    }

    private func transition(to newState: PassState, force: Bool = false) {
        guard force || state != newState else { return }
        state = newState
        delegate?.passController(self, didChange: newState, pass: currentPass)
    }
}
