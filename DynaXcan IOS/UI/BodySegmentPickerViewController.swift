import UIKit

final class BodySegmentPickerViewController: UIViewController {
    private struct SegmentSection {
        let title: String
        let segments: [BodySegment]
    }

    private let sections = [
        SegmentSection(
            title: "Residual Limbs",
            segments: [.residualLimbTranstibial, .residualLimbTransfemoral]
        ),
        SegmentSection(title: "Lower Extremity", segments: [.foot, .lowerLeg]),
        SegmentSection(title: "Upper Extremity", segments: [.hand, .upperLimb]),
        SegmentSection(title: "Trunk", segments: [.torso, .spinalRegion]),
        SegmentSection(title: "Other", segments: [.generic])
    ]

    private let tableView = UITableView(frame: .zero, style: .insetGrouped)

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "DynaXcan"
        view.backgroundColor = DynaXBrand.background
        configureTable()
        configureHeader()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    private func configureTable() {
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = DynaXBrand.background
        tableView.separatorColor = DynaXBrand.border
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(SegmentCell.self, forCellReuseIdentifier: SegmentCell.reuseIdentifier)
        tableView.contentInsetAdjustmentBehavior = .always
        view.addSubview(tableView)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func configureHeader() {
        let header = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 250))
        let icon = UIImageView(image: UIImage(systemName: "viewfinder.circle.fill"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = DynaXBrand.blueBright
        icon.contentMode = .scaleAspectFit

        let brand = DynaXGradientLabel()
        brand.translatesAutoresizingMaskIntoConstraints = false
        brand.text = "DynaXcan"
        brand.textAlignment = .center
        brand.font = .systemFont(ofSize: 34, weight: .bold)

        let subtitle = UILabel.dynaXCaption("Clinical 3D Scanning")
        subtitle.textAlignment = .center
        subtitle.font = .systemFont(ofSize: 15, weight: .medium)

        let sectionTitle = UILabel.dynaXHeading("Select body segment")
        sectionTitle.font = .systemFont(ofSize: 21, weight: .bold)

        [icon, brand, subtitle, sectionTitle].forEach { header.addSubview($0) }
        NSLayoutConstraint.activate([
            icon.topAnchor.constraint(equalTo: header.topAnchor, constant: 18),
            icon.centerXAnchor.constraint(equalTo: header.centerXAnchor),
            icon.widthAnchor.constraint(equalToConstant: 96),
            icon.heightAnchor.constraint(equalToConstant: 96),
            brand.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 8),
            brand.centerXAnchor.constraint(equalTo: header.centerXAnchor),
            subtitle.topAnchor.constraint(equalTo: brand.bottomAnchor, constant: 4),
            subtitle.centerXAnchor.constraint(equalTo: header.centerXAnchor),
            sectionTitle.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 20),
            sectionTitle.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -20),
            sectionTitle.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -8)
        ])
        tableView.tableHeaderView = header
    }

    private func beginScan(for segment: BodySegment) {
        let capabilities = DeviceCapabilities.detect()
        guard capabilities.hardwareSupported else {
            presentAlert(
                title: "Scanning unavailable",
                message: "This device does not have the camera hardware required for clinical scanning."
            )
            return
        }

        let configuration = ScanConfiguration.defaultConfiguration(
            for: segment,
            scannerType: capabilities.scannerType
        )
        do {
            let coordinator = try ScanCoordinator(
                configuration: configuration,
                capabilities: capabilities
            )
            let scanViewController = ScanViewController(coordinator: coordinator)
            scanViewController.modalPresentationStyle = .fullScreen
            present(scanViewController, animated: true)
        } catch let error as ScanError {
            presentAlert(title: "Cannot start scan", message: error.localizedDescription)
        } catch {
            presentAlert(title: "Cannot start scan", message: error.localizedDescription)
        }
    }

    private func presentAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

extension BodySegmentPickerViewController: UITableViewDataSource, UITableViewDelegate {
    func numberOfSections(in tableView: UITableView) -> Int { sections.count }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        sections[section].segments.count
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        sections[section].title
    }

    func tableView(
        _ tableView: UITableView,
        cellForRowAt indexPath: IndexPath
    ) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(
            withIdentifier: SegmentCell.reuseIdentifier,
            for: indexPath
        ) as? SegmentCell else {
            return UITableViewCell(style: .subtitle, reuseIdentifier: nil)
        }
        cell.configure(with: sections[indexPath.section].segments[indexPath.row])
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        beginScan(for: sections[indexPath.section].segments[indexPath.row])
    }

    func tableView(_ tableView: UITableView, willDisplayHeaderView view: UIView, forSection section: Int) {
        (view as? UITableViewHeaderFooterView)?.textLabel?.textColor = DynaXBrand.textMuted
    }
}

private final class SegmentCell: UITableViewCell {
    static let reuseIdentifier = "SegmentCell"

    private let nameLabel = UILabel.dynaXBody("")
    private let descriptionLabel = UILabel.dynaXCaption("")

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = DynaXBrand.surface
        selectedBackgroundView = {
            let view = UIView()
            view.backgroundColor = DynaXBrand.surfaceRaised
            return view
        }()
        accessoryType = .disclosureIndicator
        tintColor = DynaXBrand.textMuted

        let stack = UIStackView(arrangedSubviews: [nameLabel, descriptionLabel])
        stack.axis = .vertical
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 13),
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -13)
        ])
    }

    required init?(coder: NSCoder) { nil }

    func configure(with segment: BodySegment) {
        nameLabel.text = segment.displayName
        descriptionLabel.text = segment.clinicalDescription
    }
}
