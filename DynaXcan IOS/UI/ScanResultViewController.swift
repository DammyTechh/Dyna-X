import UIKit

final class ScanResultViewController: UIViewController {
    var onScanAgain: (() -> Void)?
    var onRequestFormat: ((
        ExportCoordinator.ExportFormat,
        @escaping (Float, String) -> Void,
        @escaping (Result<ExportCoordinator.ExportResult, ScanError>) -> Void
    ) -> Void)?

    private var result: ExportCoordinator.ExportResult
    private let configuration: ScanConfiguration
    private let formatSelector = UISegmentedControl(items: ["PLY", "OBJ"])
    private let formatProgress = DynaXProgressBar()
    private var formatRow: SummaryRow?

    init(result: ExportCoordinator.ExportResult, configuration: ScanConfiguration) {
        self.result = result
        self.configuration = configuration
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DynaXBrand.background
        configureLayout()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    private func configureLayout() {
        let checkmark = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
        checkmark.translatesAutoresizingMaskIntoConstraints = false
        checkmark.tintColor = DynaXBrand.success
        checkmark.contentMode = .scaleAspectFit
        let heading = UILabel.dynaXHeading("Scan Complete")
        heading.textAlignment = .center

        let summaryCard = UIView()
        summaryCard.translatesAutoresizingMaskIntoConstraints = false
        summaryCard.backgroundColor = DynaXBrand.surface
        summaryCard.layer.cornerRadius = 18
        summaryCard.layer.cornerCurve = .continuous
        summaryCard.layer.borderWidth = 1
        summaryCard.layer.borderColor = DynaXBrand.border.cgColor

        let metadata = result.metadata
        let formatRow = SummaryRow(title: "Export format", value: result.format.rawValue.uppercased())
        self.formatRow = formatRow
        let rows = [
            SummaryRow(title: "Body segment", value: configuration.bodySegment.displayName),
            SummaryRow(title: "Frames accepted", value: "\(metadata.framesAccepted)"),
            SummaryRow(title: "Scan duration", value: String(format: "%.1f seconds", metadata.scanDurationSeconds)),
            formatRow,
            SummaryRow(title: "Scanner", value: scannerName(metadata.scannerType))
        ]
        let summaryStack = UIStackView(arrangedSubviews: rows)
        summaryStack.axis = .vertical
        summaryStack.spacing = 14
        summaryStack.translatesAutoresizingMaskIntoConstraints = false
        summaryCard.addSubview(summaryStack)

        formatSelector.selectedSegmentIndex = result.format == .ply ? 0 : 1
        formatSelector.translatesAutoresizingMaskIntoConstraints = false
        formatSelector.selectedSegmentTintColor = DynaXBrand.blueBright
        formatSelector.setTitleTextAttributes([.foregroundColor: DynaXBrand.textPrimary], for: .normal)
        formatSelector.setTitleTextAttributes(
            [.foregroundColor: DynaXBrand.onAccent],
            for: .selected
        )
        formatSelector.addTarget(self, action: #selector(formatChanged), for: .valueChanged)
        formatProgress.isHidden = true

        let exportButton = UIButton.dynaXPrimary(title: "Export Scan")
        let scanAgainButton = UIButton.dynaXGhost(title: "Scan Again")
        let filesButton = UIButton.dynaXGhost(title: "View in Files")
        exportButton.addTarget(self, action: #selector(exportTapped), for: .touchUpInside)
        scanAgainButton.addTarget(self, action: #selector(scanAgainTapped), for: .touchUpInside)
        filesButton.addTarget(self, action: #selector(filesTapped), for: .touchUpInside)

        let stack = UIStackView(
            arrangedSubviews: [
                checkmark,
                heading,
                summaryCard,
                formatSelector,
                formatProgress,
                exportButton,
                scanAgainButton,
                filesButton
            ]
        )
        stack.axis = .vertical
        stack.spacing = 14
        stack.setCustomSpacing(28, after: heading)
        stack.setCustomSpacing(24, after: summaryCard)
        stack.translatesAutoresizingMaskIntoConstraints = false
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
            stack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -48),
            checkmark.heightAnchor.constraint(equalToConstant: 70),
            summaryStack.topAnchor.constraint(equalTo: summaryCard.topAnchor, constant: 18),
            summaryStack.leadingAnchor.constraint(equalTo: summaryCard.leadingAnchor, constant: 18),
            summaryStack.trailingAnchor.constraint(equalTo: summaryCard.trailingAnchor, constant: -18),
            summaryStack.bottomAnchor.constraint(equalTo: summaryCard.bottomAnchor, constant: -18),
            formatSelector.heightAnchor.constraint(equalToConstant: 42)
        ])
    }

    private func scannerName(_ rawValue: String) -> String {
        rawValue == DeviceCapabilities.ScannerType.lidar.rawValue ? "LiDAR" : "TrueDepth"
    }

    @objc private func formatChanged() {
        let requested: ExportCoordinator.ExportFormat = formatSelector.selectedSegmentIndex == 0
            ? .ply
            : .obj
        guard requested != result.format, let onRequestFormat else { return }
        formatSelector.isEnabled = false
        formatProgress.isHidden = false
        formatProgress.progress = 0
        formatProgress.label = "Preparing this format…"
        onRequestFormat(
            requested,
            { [weak self] progress, label in
                self?.formatProgress.progress = progress
                self?.formatProgress.label = self?.clinicalStage(label) ?? label
            },
            { [weak self] exportResult in
                guard let self else { return }
                self.formatSelector.isEnabled = true
                self.formatProgress.isHidden = true
                switch exportResult {
                case .success(let result):
                    self.result = result
                    self.formatRow?.setValue(result.format.rawValue.uppercased())
                case .failure(let error):
                    self.formatSelector.selectedSegmentIndex = self.result.format == .ply ? 0 : 1
                    self.presentExportFailure(error)
                }
            }
        )
    }

    @objc private func exportTapped() {
        let activity = UIActivityViewController(
            activityItems: [result.outputURL],
            applicationActivities: nil
        )
        activity.popoverPresentationController?.sourceView = view
        activity.popoverPresentationController?.sourceRect = CGRect(
            x: view.bounds.midX,
            y: view.bounds.maxY - 80,
            width: 1,
            height: 1
        )
        present(activity, animated: true)
    }

    @objc private func scanAgainTapped() {
        dismiss(animated: true) { [weak self] in self?.onScanAgain?() }
    }

    @objc private func filesTapped() {
        if UIApplication.shared.canOpenURL(ExportsDirectory.url) {
            UIApplication.shared.open(ExportsDirectory.url)
        } else if let filesURL = URL(string: "shareddocuments://") {
            UIApplication.shared.open(filesURL)
        }
    }

    private func clinicalStage(_ stage: String) -> String {
        if stage.localizedCaseInsensitiveContains("mesh") { return "Building your 3D scan…" }
        if stage.localizedCaseInsensitiveContains("export") { return "Preparing your scan file…" }
        return stage
    }

    private func presentExportFailure(_ error: ScanError) {
        let alert = UIAlertController(
            title: "Could not prepare this format",
            message: "The additional scan file could not be prepared. Your completed scan is still safe.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

private final class SummaryRow: UIStackView {
    private let valueLabel = UILabel.dynaXBody("")

    init(title: String, value: String) {
        super.init(frame: .zero)
        axis = .horizontal
        spacing = 12
        distribution = .fill
        let titleLabel = UILabel.dynaXCaption(title)
        valueLabel.text = value
        valueLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        valueLabel.textAlignment = .right
        addArrangedSubview(titleLabel)
        addArrangedSubview(valueLabel)
    }

    required init(coder: NSCoder) {
        preconditionFailure("SummaryRow must be created in code.")
    }

    func setValue(_ value: String) {
        valueLabel.text = value
    }
}
