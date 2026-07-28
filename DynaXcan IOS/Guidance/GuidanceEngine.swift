import Foundation

enum GuidanceEvent: Equatable {
    case moveCloser(currentMetres: Float, targetMetres: Float)
    case moveBack(currentMetres: Float, targetMetres: Float)
    case slowDown
    case improveLighting
    case holdSteady
    case trackingRecoveryAttempting(durationSeconds: TimeInterval)
    case returnToScanStart
    case trackingRecoveryFailed
    case trackingRecovered
    case passComplete(pass: ScanPass, framesAccepted: Int)
    case scanComplete(totalFrames: Int)

    var clinicalInstruction: String {
        switch self {
        case .moveCloser:
            "Move closer to the patient."
        case .moveBack:
            "Move back from the patient."
        case .slowDown:
            "Move the phone more slowly."
        case .improveLighting:
            "Improve the lighting before continuing."
        case .holdSteady:
            "Hold the phone steady."
        case .trackingRecoveryAttempting:
            "Hold still, recovering…"
        case .returnToScanStart:
            "Move back to where you started scanning."
        case .trackingRecoveryFailed:
            "We could not recover your position. Rescan this pass."
        case .trackingRecovered:
            "Position recovered. Continue scanning."
        case .passComplete:
            "Pass complete. Review it before continuing."
        case .scanComplete:
            "Scan complete."
        }
    }
}

protocol GuidanceEngineDelegate: AnyObject {
    func guidanceEngine(_ engine: GuidanceEngine, didEmit event: GuidanceEvent)
}

/// Serial, timer-driven guidance synthesizer. Inputs can arrive from different
/// queues; evaluation occurs at most every 500 ms in strict priority order.
final class GuidanceEngine {
    weak var delegate: GuidanceEngineDelegate?

    private enum Signature: Equatable {
        case moveCloser(distanceBucket: Int)
        case moveBack(distanceBucket: Int)
        case slowDown
        case improveLighting
        case holdSteady
        case trackingRecoveryAttempting
        case returnToScanStart
        case trackingRecoveryFailed
        case trackingRecovered
        case passComplete(ScanPass)
        case scanComplete
    }

    private struct Candidate {
        let event: GuidanceEvent
        let signature: Signature
        let isWarning: Bool
    }

    private let configuration: ScanConfiguration
    private let trackingRecoveryEngine: TrackingRecoveryEngine
    private let queue = DispatchQueue(label: "com.dynaxcan.guidance-engine")
    private let queueKey = DispatchSpecificKey<Void>()

    private var timer: DispatchSourceTimer?
    private var motionReading: MotionReading?
    private var distanceReading: DistanceReading?
    private var environmentReading: EnvironmentReading?
    private var pass: ScanPass = .pass1Circumferential
    private var passState: PassState = .waitingToStart
    private var frameStats = FrameStats()
    private var scanHasMinimumCoverage = false
    private var providerGuidance: CaptureProviderGuidance?
    private var recoveryWasActive = false
    private var recoveryNotificationPending = false

    private var lastEmittedSignature: Signature?
    private var lastEmittedWasWarning = false

    init(
        configuration: ScanConfiguration,
        trackingRecoveryEngine: TrackingRecoveryEngine
    ) {
        self.configuration = configuration
        self.trackingRecoveryEngine = trackingRecoveryEngine
        queue.setSpecific(key: queueKey, value: ())
    }

    deinit {
        stop()
    }

    func start() {
        queue.async { [weak self] in
            guard let self, self.timer == nil else { return }
            let timer = DispatchSource.makeTimerSource(queue: self.queue)
            timer.schedule(
                deadline: .now(),
                repeating: AppConfiguration.guidanceEvaluationInterval
            )
            timer.setEventHandler { [weak self] in self?.evaluate() }
            self.timer = timer
            timer.resume()
        }
    }

    func stop() {
        if DispatchQueue.getSpecific(key: queueKey) != nil {
            stopOnQueue()
        } else {
            queue.sync { stopOnQueue() }
        }
    }

    func update(motion reading: MotionReading) {
        queue.async { self.motionReading = reading }
    }

    func update(distance reading: DistanceReading) {
        queue.async { self.distanceReading = reading }
    }

    func update(environment reading: EnvironmentReading) {
        queue.async { self.environmentReading = reading }
    }

    func update(
        pass: ScanPass,
        state: PassState,
        frameStats: FrameStats,
        scanHasMinimumCoverage: Bool
    ) {
        queue.async {
            self.pass = pass
            self.passState = state
            self.frameStats = frameStats
            self.scanHasMinimumCoverage = scanHasMinimumCoverage
        }
    }

    func update(providerGuidance: CaptureProviderGuidance?) {
        queue.async { self.providerGuidance = providerGuidance }
    }

    func notifyTrackingRecovered() {
        queue.async { self.recoveryNotificationPending = true }
    }

    private func evaluate() {
        let candidate = makeCandidate()
        guard let candidate else { return }

        // Identical conditions do not repeatedly announce the same instruction.
        // Distance signatures are quantized to 5 cm, so material movement still
        // produces an updated instruction without frame-to-frame flicker.
        guard candidate.signature != lastEmittedSignature else { return }

        lastEmittedSignature = candidate.signature
        lastEmittedWasWarning = candidate.isWarning
        delegate?.guidanceEngine(self, didEmit: candidate.event)
    }

    private func stopOnQueue() {
        timer?.setEventHandler {}
        timer?.cancel()
        timer = nil
    }

    private func makeCandidate() -> Candidate? {
        trackingRecoveryEngine.tick()
        switch trackingRecoveryEngine.state {
        case .failed:
            recoveryWasActive = false
            return Candidate(
                event: .trackingRecoveryFailed,
                signature: .trackingRecoveryFailed,
                isWarning: true
            )
        case .recovering(let durationSeconds):
            recoveryWasActive = true
            if durationSeconds < 3 {
                return Candidate(
                    event: .trackingRecoveryAttempting(durationSeconds: durationSeconds),
                    signature: .trackingRecoveryAttempting,
                    isWarning: true
                )
            }
            return Candidate(
                event: .returnToScanStart,
                signature: .returnToScanStart,
                isWarning: true
            )
        case .stable where recoveryWasActive || recoveryNotificationPending:
            recoveryWasActive = false
            recoveryNotificationPending = false
            return Candidate(
                event: .trackingRecovered,
                signature: .trackingRecovered,
                isWarning: false
            )
        case .stable:
            break
        }

        if motionReading?.isExcessiveMotion == true || providerGuidance == .slowDown {
            return Candidate(event: .slowDown, signature: .slowDown, isWarning: true)
        }

        if providerGuidance == .holdSteady {
            return Candidate(event: .holdSteady, signature: .holdSteady, isWarning: true)
        }

        if let distanceReading {
            switch distanceReading.classification {
            case .tooClose:
                return Candidate(
                    event: .moveBack(
                        currentMetres: distanceReading.estimatedMetres,
                        targetMetres: configuration.workingDistance.ideal
                    ),
                    signature: .moveBack(
                        distanceBucket: distanceBucket(distanceReading.estimatedMetres)
                    ),
                    isWarning: true
                )
            case .tooFar:
                return Candidate(
                    event: .moveCloser(
                        currentMetres: distanceReading.estimatedMetres,
                        targetMetres: configuration.workingDistance.ideal
                    ),
                    signature: .moveCloser(
                        distanceBucket: distanceBucket(distanceReading.estimatedMetres)
                    ),
                    isWarning: true
                )
            case .unknown:
                return Candidate(event: .holdSteady, signature: .holdSteady, isWarning: true)
            case .good:
                break
            }
        }

        if let environmentReading {
            if environmentReading.lighting != .acceptable {
                return Candidate(
                    event: .improveLighting,
                    signature: .improveLighting,
                    isWarning: true
                )
            }
            if environmentReading.backgroundComplexity != .clean {
                return Candidate(event: .holdSteady, signature: .holdSteady, isWarning: true)
            }
        }

        if case .complete(let framesAccepted) = passState {
            if pass == .pass3Proximal, scanHasMinimumCoverage {
                return Candidate(
                    event: .scanComplete(totalFrames: frameStats.accepted),
                    signature: .scanComplete,
                    isWarning: false
                )
            }
            return Candidate(
                event: .passComplete(pass: pass, framesAccepted: framesAccepted),
                signature: .passComplete(pass),
                isWarning: false
            )
        }

        if lastEmittedWasWarning {
            return Candidate(event: .holdSteady, signature: .holdSteady, isWarning: false)
        }
        return nil
    }

    private func distanceBucket(_ distance: Float) -> Int {
        Int((distance / 0.05).rounded())
    }
}
