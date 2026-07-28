import UIKit

final class EnvironmentCheckView: UIView {
    var onStart: (() -> Void)?
    var onOverride: (() -> Void)?
    var onStartTapped: (() -> Void)? {
        get { onStart }
        set { onStart = newValue }
    }
    var onOverrideTapped: (() -> Void)? {
        get { onOverride }
        set { onOverride = newValue }
    }

    private let lightingRow = CheckRow(icon: "sun.max.fill", title: "Lighting")
    private let distanceRow = CheckRow(icon: "arrow.left.and.right", title: "Distance")
    private let backgroundRow = CheckRow(icon: "rectangle.dashed", title: "Background")
    private let summaryLabel = UILabel.dynaXBody("Checking the room…")
    private let startButton = UIButton.dynaXPrimary(title: "Start Scanning")
    private let overrideButton = UIButton(type: .system)
    private var overrideRecorded = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = DynaXBrand.surface.withAlphaComponent(0.96)
        layer.cornerRadius = 20
        layer.cornerCurve = .continuous
        layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        layer.borderWidth = 1
        layer.borderColor = DynaXBrand.border.cgColor

        let heading = UILabel.dynaXHeading("Before you scan")
        heading.font = .systemFont(ofSize: 22, weight: .bold)
        let caption = UILabel.dynaXCaption("Check these conditions")
        summaryLabel.textColor = DynaXBrand.textMuted
        summaryLabel.font = .systemFont(ofSize: 15)

        startButton.isEnabled = false
        startButton.addTarget(self, action: #selector(startTapped), for: .touchUpInside)
        overrideButton.translatesAutoresizingMaskIntoConstraints = false
        overrideButton.setTitle("Override and scan anyway", for: .normal)
        overrideButton.setTitleColor(DynaXBrand.textMuted, for: .normal)
        overrideButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
        overrideButton.addTarget(self, action: #selector(overrideTapped), for: .touchUpInside)

        let rows = UIStackView(arrangedSubviews: [lightingRow, distanceRow, backgroundRow])
        rows.axis = .vertical
        rows.spacing = 1
        rows.layer.cornerRadius = 14
        rows.layer.masksToBounds = true

        let stack = UIStackView(arrangedSubviews: [heading, caption, rows, summaryLabel, startButton, overrideButton])
        stack.axis = .vertical
        stack.spacing = 12
        stack.setCustomSpacing(18, after: caption)
        stack.setCustomSpacing(18, after: rows)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16)
        ])
    }

    required init?(coder: NSCoder) { nil }

    func update(with reading: EnvironmentReading) {
        lightingRow.update(
            status: reading.lighting == .acceptable ? .good : .error,
            value: lightingText(reading.lighting)
        )
        distanceRow.update(
            status: reading.distance == .good ? .good : (reading.distance == .unknown ? .warning : .error),
            value: distanceText(reading.distance)
        )
        backgroundRow.update(
            status: reading.backgroundComplexity == .clean
                ? .good
                : (reading.backgroundComplexity == .unknown ? .warning : .error),
            value: backgroundText(reading.backgroundComplexity)
        )
        summaryLabel.text = summary(for: reading)
        startButton.isEnabled = reading.isReadyToScan || overrideRecorded
    }

    @objc private func startTapped() { onStart?() }

    @objc private func overrideTapped() {
        overrideRecorded = true
        startButton.isEnabled = true
        summaryLabel.text = "The room check was overridden. Keep the patient still and continue carefully."
        onOverride?()
    }

    private func lightingText(_ value: LightingClassification) -> String {
        switch value {
        case .acceptable: "Good"
        case .tooDark: "Too dark"
        case .tooBright: "Too bright"
        }
    }

    private func distanceText(_ value: DistanceClassification) -> String {
        switch value {
        case .good: "Good"
        case .tooClose: "Too close"
        case .tooFar: "Too far"
        case .unknown: "Checking"
        }
    }

    private func backgroundText(_ value: BackgroundClassification) -> String {
        switch value {
        case .clean: "Clear"
        case .cluttered: "Cluttered"
        case .unknown: "Checking"
        }
    }

    private func summary(for reading: EnvironmentReading) -> String {
        if reading.lighting == .tooDark { return "Add more light before you begin." }
        if reading.lighting == .tooBright { return "Reduce glare or move away from the bright light." }
        if reading.distance == .tooClose { return "Move back slightly from the patient." }
        if reading.distance == .tooFar { return "Move closer to the patient." }
        if reading.backgroundComplexity == .cluttered { return "Use a plainer background if possible." }
        if reading.distance == .unknown || reading.backgroundComplexity == .unknown {
            return "Hold the phone steady while the room is checked."
        }
        return "Everything looks ready."
    }
}

private final class CheckRow: UIView {
    private let valueBadge = DynaXStatusBadge()

    init(icon: String, title: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = DynaXBrand.surfaceRaised
        let image = UIImageView(image: UIImage(systemName: icon))
        image.translatesAutoresizingMaskIntoConstraints = false
        image.tintColor = DynaXBrand.textMuted
        valueBadge.status = .recovering
        valueBadge.text = "Checking"
        let titleLabel = UILabel.dynaXBody(title)
        titleLabel.font = .systemFont(ofSize: 15, weight: .medium)
        addSubview(image)
        addSubview(titleLabel)
        addSubview(valueBadge)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 58),
            image.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            image.centerYAnchor.constraint(equalTo: centerYAnchor),
            image.widthAnchor.constraint(equalToConstant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: image.trailingAnchor, constant: 10),
            titleLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            valueBadge.leadingAnchor.constraint(greaterThanOrEqualTo: titleLabel.trailingAnchor, constant: 8),
            valueBadge.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            valueBadge.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    required init?(coder: NSCoder) { nil }

    func update(status: DynaXStatusBadge.Status, value: String) {
        valueBadge.status = status
        valueBadge.text = value
    }
}
