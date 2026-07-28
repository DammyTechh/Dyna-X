import QuartzCore
import UIKit

struct DynaXBrand {
    static let background = UIColor(red: 0.06, green: 0.06, blue: 0.08, alpha: 1)
    static let surface = UIColor(red: 0.09, green: 0.09, blue: 0.12, alpha: 1)
    static let surfaceRaised = UIColor(red: 0.12, green: 0.12, blue: 0.16, alpha: 1)
    static let border = UIColor(red: 0.16, green: 0.16, blue: 0.23, alpha: 1)
    static let blueDeep = UIColor(red: 0.12, green: 0.37, blue: 0.87, alpha: 1)
    static let blueMid = UIColor(red: 0.24, green: 0.46, blue: 0.88, alpha: 1)
    static let blueBright = UIColor(red: 0.27, green: 0.50, blue: 1.00, alpha: 1)
    static let blueLight = UIColor(red: 0.40, green: 0.63, blue: 1.00, alpha: 1)
    static let textPrimary = UIColor(red: 0.94, green: 0.95, blue: 0.97, alpha: 1)
    static let textMuted = UIColor(red: 0.53, green: 0.54, blue: 0.67, alpha: 1)
    static let textDim = UIColor(red: 0.29, green: 0.32, blue: 0.44, alpha: 1)
    static let success = UIColor(red: 0.21, green: 0.91, blue: 0.60, alpha: 1)
    static let warning = UIColor(red: 0.94, green: 0.63, blue: 0.25, alpha: 1)
    static let error = UIColor(red: 1.00, green: 0.33, blue: 0.40, alpha: 1)
    static let onAccent = UIColor.white

    static func gradientLayer(frame: CGRect) -> CAGradientLayer {
        let layer = CAGradientLayer()
        layer.colors = [blueDeep.cgColor, blueBright.cgColor, blueLight.cgColor]
        layer.startPoint = CGPoint(x: 0, y: 0)
        layer.endPoint = CGPoint(x: 1, y: 1)
        layer.frame = frame
        return layer
    }

    // MARK: - Typography factories

    static func heading(_ text: String) -> UILabel {
        let label = UILabel.dynaXHeading(text)
        label.font = .systemFont(ofSize: 22, weight: .bold)
        return label
    }

    static func body(_ text: String) -> UILabel {
        let label = UILabel.dynaXBody(text)
        label.font = .systemFont(ofSize: 15, weight: .regular)
        return label
    }

    static func caption(_ text: String) -> UILabel {
        let label = UILabel.dynaXCaption(text)
        label.font = .systemFont(ofSize: 12, weight: .regular)
        return label
    }

    static func mono(_ text: String) -> UILabel {
        let label = UILabel.dynaXMono(text)
        label.font = .monospacedDigitSystemFont(ofSize: 13, weight: .medium)
        return label
    }

    // MARK: - Button factories

    static func primaryButton(title: String) -> UIButton {
        UIButton.dynaXPrimary(title: title)
    }

    static func ghostButton(title: String) -> UIButton {
        UIButton.dynaXGhost(title: title)
    }

    static func destructiveButton(title: String) -> UIButton {
        UIButton.dynaXDestructive(title: title)
    }
}

final class DynaXGradientLabel: UILabel {
    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 0, bounds.height > 0 else { return }
        let renderer = UIGraphicsImageRenderer(bounds: bounds)
        let image = renderer.image { context in
            let gradient = DynaXBrand.gradientLayer(frame: bounds)
            gradient.render(in: context.cgContext)
        }
        textColor = UIColor(patternImage: image)
    }
}

extension UILabel {
    static func dynaXHeading(_ text: String) -> UILabel {
        makeDynaXLabel(text, font: .systemFont(ofSize: 22, weight: .bold), color: DynaXBrand.textPrimary)
    }

    static func dynaXBody(_ text: String) -> UILabel {
        makeDynaXLabel(text, font: .systemFont(ofSize: 15, weight: .regular), color: DynaXBrand.textPrimary)
    }

    static func dynaXCaption(_ text: String) -> UILabel {
        makeDynaXLabel(text, font: .systemFont(ofSize: 12, weight: .regular), color: DynaXBrand.textMuted)
    }

    static func dynaXMono(_ text: String) -> UILabel {
        makeDynaXLabel(
            text,
            font: .monospacedDigitSystemFont(ofSize: 13, weight: .medium),
            color: DynaXBrand.textPrimary
        )
    }

    private static func makeDynaXLabel(
        _ text: String,
        font: UIFont,
        color: UIColor
    ) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = font
        label.textColor = color
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }
}

extension UIButton {
    static func dynaXPrimary(title: String) -> UIButton {
        DynaXButton(title: title, style: .primary)
    }

    static func dynaXGhost(title: String) -> UIButton {
        DynaXButton(title: title, style: .ghost)
    }

    static func dynaXDestructive(title: String) -> UIButton {
        DynaXButton(title: title, style: .destructive)
    }
}

private final class DynaXButton: UIButton {
    enum Style { case primary, ghost, destructive }

    private let gradient = DynaXBrand.gradientLayer(frame: .zero)

    init(title: String, style: Style) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        configuration = .plain()
        configuration?.title = title
        configuration?.contentInsets = NSDirectionalEdgeInsets(
            top: 14,
            leading: 20,
            bottom: 14,
            trailing: 20
        )
        layer.cornerRadius = 12
        layer.cornerCurve = .continuous
        layer.masksToBounds = true

        switch style {
        case .primary:
            titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
            heightAnchor.constraint(equalToConstant: 52).isActive = true
            layer.insertSublayer(gradient, at: 0)
            configuration?.baseForegroundColor = DynaXBrand.onAccent
            setTitleColor(DynaXBrand.onAccent, for: .normal)
        case .ghost:
            titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
            heightAnchor.constraint(equalToConstant: 48).isActive = true
            layer.borderWidth = 1
            layer.borderColor = DynaXBrand.blueMid.cgColor
            configuration?.baseForegroundColor = DynaXBrand.blueLight
            setTitleColor(DynaXBrand.blueLight, for: .normal)
        case .destructive:
            titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
            heightAnchor.constraint(equalToConstant: 48).isActive = true
            layer.borderWidth = 1
            layer.borderColor = DynaXBrand.error.cgColor
            configuration?.baseForegroundColor = DynaXBrand.error
            setTitleColor(DynaXBrand.error, for: .normal)
        }
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
    }

    override var isEnabled: Bool {
        didSet { alpha = isEnabled ? 1 : 0.4 }
    }
}

final class DynaXProgressBar: UIView {
    var progress: Float = 0 { didSet { updateFill() } }
    var label: String = "" { didSet { labelView.text = label } }

    private let trackView = UIView()
    private let fillView = UIView()
    private let fillGradient = DynaXBrand.gradientLayer(frame: .zero)
    private(set) var labelView = UILabel.dynaXCaption("")
    private var fillWidthConstraint: NSLayoutConstraint!

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        trackView.translatesAutoresizingMaskIntoConstraints = false
        fillView.translatesAutoresizingMaskIntoConstraints = false
        trackView.backgroundColor = DynaXBrand.border
        trackView.layer.cornerRadius = 3
        fillView.layer.cornerRadius = 3
        fillView.layer.masksToBounds = true
        fillView.layer.addSublayer(fillGradient)

        addSubview(trackView)
        trackView.addSubview(fillView)
        addSubview(labelView)
        fillWidthConstraint = fillView.widthAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            trackView.topAnchor.constraint(equalTo: topAnchor),
            trackView.leadingAnchor.constraint(equalTo: leadingAnchor),
            trackView.trailingAnchor.constraint(equalTo: trailingAnchor),
            trackView.heightAnchor.constraint(equalToConstant: 6),
            fillView.leadingAnchor.constraint(equalTo: trackView.leadingAnchor),
            fillView.topAnchor.constraint(equalTo: trackView.topAnchor),
            fillView.bottomAnchor.constraint(equalTo: trackView.bottomAnchor),
            fillWidthConstraint,
            labelView.topAnchor.constraint(equalTo: trackView.bottomAnchor, constant: 8),
            labelView.leadingAnchor.constraint(equalTo: leadingAnchor),
            labelView.trailingAnchor.constraint(equalTo: trailingAnchor),
            labelView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        fillGradient.frame = fillView.bounds
        updateFill()
    }

    private func updateFill() {
        let clamped = CGFloat(max(0, min(1, progress)))
        fillWidthConstraint.constant = trackView.bounds.width * clamped
        UIView.animate(withDuration: 0.2) { self.layoutIfNeeded() }
    }
}

final class DynaXStatusBadge: UIView {
    enum Status {
        case good, warning, error, recovering

        var color: UIColor {
            switch self {
            case .good: DynaXBrand.success
            case .warning, .recovering: DynaXBrand.warning
            case .error: DynaXBrand.error
            }
        }

        var label: String {
            switch self {
            case .good: "Good"
            case .warning: "Check"
            case .error: "Poor"
            case .recovering: "Recovering"
            }
        }
    }

    var status: Status = .good { didSet { updateAppearance() } }
    var text: String = "" { didSet { label.text = text } }

    private let dot = UIView()
    private let label = UILabel.dynaXCaption("")

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = DynaXBrand.surfaceRaised.withAlphaComponent(0.94)
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        dot.translatesAutoresizingMaskIntoConstraints = false
        dot.layer.cornerRadius = 4
        addSubview(dot)
        addSubview(label)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 32),
            dot.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            dot.centerYAnchor.constraint(equalTo: centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8),
            label.leadingAnchor.constraint(equalTo: dot.trailingAnchor, constant: 8),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 7),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -7)
        ])
        updateAppearance()
    }

    required init?(coder: NSCoder) { nil }

    private func updateAppearance() {
        let color = status.color
        UIView.animate(withDuration: 0.3) {
            self.dot.backgroundColor = color
            self.layer.borderColor = color.withAlphaComponent(0.3).cgColor
            self.layer.borderWidth = 1
        }
    }
}
