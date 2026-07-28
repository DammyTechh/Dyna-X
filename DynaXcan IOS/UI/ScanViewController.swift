import UIKit

final class ScanViewController: UIViewController {
    private let coordinator: ScanCoordinator
    private let previewView = MetalCameraPreviewView()
    private let environmentView = EnvironmentCheckView()
    private let guidanceView = CaptureGuidanceView()
    private let progressView = PassProgressView()
    private let cancelButton = UIButton(type: .system)
    private let bottomCancelButton = UIButton.dynaXGhost(title: "Cancel")
    private let nextButton = UIButton.dynaXPrimary(title: "Next Pass →")
    private let countdownLabel = UILabel.dynaXMono("")
    private let countdownCaption = UILabel.dynaXBody("Get ready…")
    private let processingOverlay = UIView()
    private let processingHeading = UILabel.dynaXHeading("Building your 3D scan…")
    private let processingProgress = DynaXProgressBar()

    private var currentPass: ScanPass = .pass1Circumferential
    private var currentState: ScanSessionState = .requestingPermission

    init(coordinator: ScanCoordinator) {
        self.coordinator = coordinator
        super.init(nibName: nil, bundle: nil)
        coordinator.delegate = self
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DynaXBrand.background
        configureLayout()
        configureActions()
        coordinator.start()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    private func configureLayout() {
        let header = UIView()
        header.translatesAutoresizingMaskIntoConstraints = false
        header.backgroundColor = DynaXBrand.background.withAlphaComponent(0.88)
        let titleLabel = UILabel.dynaXBody(coordinator.configuration.bodySegment.displayName)
        titleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        titleLabel.textAlignment = .center
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.setTitle("✕  Cancel", for: .normal)
        cancelButton.setTitleColor(DynaXBrand.textPrimary, for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
        header.addSubview(cancelButton)
        header.addSubview(titleLabel)

        previewView.clipsToBounds = true
        view.addSubview(previewView)
        view.addSubview(header)
        view.addSubview(guidanceView)
        view.addSubview(progressView)
        let actionStack = UIStackView(arrangedSubviews: [bottomCancelButton, nextButton])
        actionStack.axis = .horizontal
        actionStack.spacing = 12
        actionStack.distribution = .fillEqually
        actionStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(actionStack)
        view.addSubview(environmentView)

        countdownLabel.font = .monospacedDigitSystemFont(ofSize: 104, weight: .bold)
        countdownLabel.textAlignment = .center
        countdownLabel.textColor = DynaXBrand.onAccent
        countdownCaption.textAlignment = .center
        countdownCaption.font = .systemFont(ofSize: 20, weight: .semibold)
        view.addSubview(countdownCaption)
        view.addSubview(countdownLabel)

        processingOverlay.translatesAutoresizingMaskIntoConstraints = false
        processingOverlay.backgroundColor = DynaXBrand.background
        processingOverlay.alpha = 0
        processingOverlay.isHidden = true
        processingHeading.textAlignment = .center
        let processingStack = UIStackView(arrangedSubviews: [processingHeading, processingProgress])
        processingStack.axis = .vertical
        processingStack.spacing = 28
        processingStack.translatesAutoresizingMaskIntoConstraints = false
        processingOverlay.addSubview(processingStack)
        view.addSubview(processingOverlay)

        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            header.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 50),
            cancelButton.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 16),
            cancelButton.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -12),
            titleLabel.centerXAnchor.constraint(equalTo: header.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor),

            previewView.topAnchor.constraint(equalTo: header.bottomAnchor),
            previewView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            previewView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            previewView.bottomAnchor.constraint(equalTo: progressView.topAnchor),

            guidanceView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            guidanceView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            guidanceView.bottomAnchor.constraint(equalTo: previewView.bottomAnchor, constant: -28),

            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.bottomAnchor.constraint(equalTo: actionStack.topAnchor, constant: -1),

            actionStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18),
            actionStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),
            actionStack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),

            environmentView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            environmentView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            environmentView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            countdownCaption.centerXAnchor.constraint(equalTo: previewView.centerXAnchor),
            countdownCaption.centerYAnchor.constraint(equalTo: previewView.centerYAnchor, constant: -80),
            countdownLabel.topAnchor.constraint(equalTo: countdownCaption.bottomAnchor, constant: 12),
            countdownLabel.centerXAnchor.constraint(equalTo: previewView.centerXAnchor),

            processingOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            processingOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            processingOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            processingOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            processingStack.leadingAnchor.constraint(equalTo: processingOverlay.leadingAnchor, constant: 32),
            processingStack.trailingAnchor.constraint(equalTo: processingOverlay.trailingAnchor, constant: -32),
            processingStack.centerYAnchor.constraint(equalTo: processingOverlay.centerYAnchor)
        ])

        guidanceView.isHidden = true
        progressView.isHidden = true
        nextButton.isHidden = true
        countdownLabel.isHidden = true
        countdownCaption.isHidden = true
    }

    private func configureActions() {
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        bottomCancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        nextButton.addTarget(self, action: #selector(nextTapped), for: .touchUpInside)
        environmentView.onStart = { [weak self] in self?.coordinator.beginScanning() }
        environmentView.onOverride = { [weak self] in self?.coordinator.overrideEnvironmentCheck() }
    }

    private func render(_ state: ScanSessionState) {
        currentState = state
        switch state {
        case .requestingPermission:
            environmentView.isHidden = true
            guidanceView.isHidden = false
            guidanceView.update(message: "Allow camera access to begin.", status: .warning, animated: false)

        case .environmentCheck:
            environmentView.isHidden = false
            guidanceView.isHidden = true
            progressView.isHidden = true
            nextButton.isHidden = true
            hideCountdown()

        case .countdownToPass(let pass, let secondsRemaining):
            currentPass = pass
            environmentView.isHidden = true
            guidanceView.isHidden = true
            progressView.isHidden = false
            nextButton.isHidden = true
            countdownCaption.isHidden = false
            countdownLabel.isHidden = false
            countdownLabel.text = "\(secondsRemaining)"
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()

        case .scanning(let pass):
            currentPass = pass
            hideCountdown()
            environmentView.isHidden = true
            guidanceView.isHidden = false
            progressView.isHidden = false
            progressView.currentPass = pass

        case .passComplete(let pass, _):
            currentPass = pass
            hideCountdown()
            progressView.currentPass = pass
            progressView.markPassComplete(pass)
            showPassComplete(pass)

        case .recovering:
            guidanceView.isHidden = false
            guidanceView.update(
                message: "Hold still, recovering…",
                status: .recovering,
                animated: true
            )

        case .finalizing:
            showProcessing(stage: "Preparing your scan…", progress: 0)

        case .processing(let stage, let progress):
            showProcessing(stage: stage, progress: progress)

        case .exportComplete:
            break

        case .failed(let error):
            presentFailure(error)

        case .cancelled:
            dismiss(animated: true)
        }
    }

    private func showPassComplete(_ pass: ScanPass) {
        let flash = UIView(frame: view.bounds)
        flash.backgroundColor = DynaXBrand.success
        flash.alpha = 0.45
        flash.isUserInteractionEnabled = false
        view.addSubview(flash)
        UIView.animate(withDuration: 0.2, animations: { flash.alpha = 0 }) { _ in flash.removeFromSuperview() }
        UINotificationFeedbackGenerator().notificationOccurred(.success)

        let segment = coordinator.configuration.bodySegment
        let message: String
        if pass == .pass1Circumferential {
            message = "Pass 1 complete. Now tilt the phone down toward \(segment.distalReference)."
            setNextTitle("Begin Pass 2 →")
        } else if pass == .pass2Distal {
            message = "Pass 2 complete. Now tilt the phone up toward \(segment.proximalReference)."
            setNextTitle("Begin Pass 3 →")
        } else {
            message = "All three passes are complete."
            setNextTitle("Submit Scan")
        }
        guidanceView.update(message: message, status: .good, animated: true)
        nextButton.isHidden = false
        pulseNextButton()
    }

    private func showProcessing(stage: String, progress: Float) {
        cancelButton.isHidden = true
        processingOverlay.isHidden = false
        processingProgress.label = clinicalStage(stage)
        processingProgress.progress = progress
        if processingOverlay.alpha == 0 {
            UIView.animate(withDuration: 0.3) {
                self.previewView.alpha = 0
                self.processingOverlay.alpha = 1
            }
        }
    }

    private func clinicalStage(_ stage: String) -> String {
        if stage.localizedCaseInsensitiveContains("raw") { return "Saving your scan…" }
        if stage.localizedCaseInsensitiveContains("mesh") { return "Building your 3D scan…" }
        if stage.localizedCaseInsensitiveContains("export") { return "Preparing your scan file…" }
        return stage
    }

    private func hideCountdown() {
        countdownLabel.isHidden = true
        countdownCaption.isHidden = true
    }

    private func setNextTitle(_ title: String) {
        nextButton.configuration?.title = title
        nextButton.setTitle(title, for: .normal)
    }

    private func pulseNextButton() {
        nextButton.layer.removeAllAnimations()
        UIView.animate(
            withDuration: 0.75,
            delay: 0,
            options: [.autoreverse, .repeat, .allowUserInteraction],
            animations: { self.nextButton.transform = CGAffineTransform(scaleX: 1.025, y: 1.025) }
        )
    }

    private func presentFailure(_ error: ScanError) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(
            title: "Scan stopped",
            message: clinicalMessage(for: error),
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Close", style: .default) { [weak self] _ in
            self?.dismiss(animated: true)
        })
        present(alert, animated: true)
    }

    private func clinicalMessage(for error: ScanError) -> String {
        switch error {
        case .meshingFailed:
            return "Your 3D scan could not be built. The original scan data was kept."
        case .exportFailed:
            return "Your scan file could not be prepared. The original scan data was kept."
        case .pointCloudPersistenceFailed:
            return "Your scan could not be saved. Please try again."
        case .cameraSessionFailed:
            return "The camera could not start. Close this scan and try again."
        default:
            return error.localizedDescription
        }
    }

    @objc private func nextTapped() {
        nextButton.layer.removeAllAnimations()
        nextButton.transform = .identity
        if currentPass == .pass3Proximal {
            coordinator.confirmScanComplete()
        } else {
            coordinator.confirmPassComplete()
        }
    }

    @objc private func cancelTapped() {
        let alert = UIAlertController(
            title: "Cancel this scan?",
            message: "The scan collected so far will not be saved.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Keep Scanning", style: .cancel))
        alert.addAction(UIAlertAction(title: "Cancel Scan", style: .destructive) {
            [weak self] _ in self?.coordinator.cancel()
        })
        present(alert, animated: true)
    }
}

extension ScanViewController: ScanCoordinatorDelegate {
    func coordinator(_ coordinator: ScanCoordinator, didEnterState state: ScanSessionState) {
        render(state)
    }

    func coordinator(_ coordinator: ScanCoordinator, didUpdatePreview frame: CapturePreviewFrame) {
        previewView.display(frame)
    }

    func coordinator(
        _ coordinator: ScanCoordinator,
        didUpdateEnvironment environment: EnvironmentReading
    ) {
        environmentView.update(with: environment)
    }

    func coordinator(_ coordinator: ScanCoordinator, didUpdateGuidance guidance: GuidanceEvent) {
        if case .passComplete = currentState {
            switch guidance {
            case .passComplete, .scanComplete:
                return
            default:
                break
            }
        }
        guidanceView.update(with: guidance, animated: true)
    }

    func coordinator(_ coordinator: ScanCoordinator, didUpdateProgress stats: FrameStats) {
        let activePass = coordinator.passController.currentPass
        let passFrames: Int
        switch activePass {
        case .pass1Circumferential: passFrames = stats.pass1Accepted
        case .pass2Distal: passFrames = stats.pass2Accepted
        case .pass3Proximal: passFrames = stats.pass3Accepted
        }
        progressView.currentPass = activePass
        progressView.framesAccepted = passFrames
        progressView.passProgress = min(
            1,
            Float(passFrames) / Float(coordinator.configuration.minimumFramesPerPass)
        )
        let minimum = coordinator.configuration.minimumFramesPerPass
        let completedPasses = [
            stats.pass1Accepted,
            stats.pass2Accepted,
            stats.pass3Accepted
        ].filter { $0 >= minimum }.count
        progressView.totalProgress = Float(completedPasses) / 3
    }

    func coordinator(
        _ coordinator: ScanCoordinator,
        didUpdateRecovery state: TrackingRecoveryEngine.RecoveryState
    ) {}

    func coordinator(
        _ coordinator: ScanCoordinator,
        didCompleteExport result: ExportCoordinator.ExportResult
    ) {
        let resultViewController = ScanResultViewController(
            result: result,
            configuration: coordinator.configuration
        )
        resultViewController.onRequestFormat = { [weak coordinator] format, progress, completion in
            coordinator?.export(
                format: format,
                progressHandler: progress,
                completion: completion
            )
        }
        resultViewController.onScanAgain = { [weak self] in
            self?.dismiss(animated: true)
        }
        resultViewController.modalPresentationStyle = .fullScreen
        present(resultViewController, animated: true)
    }

    func coordinator(_ coordinator: ScanCoordinator, didFail error: ScanError) {
        presentFailure(error)
    }
}
