import UIKit

final class PassProgressView: UIView {
    var currentPass: ScanPass = .pass1Circumferential { didSet { updatePassLabel() } }
    var passProgress: Float = 0 { didSet { updateBar() } }
    var framesAccepted: Int = 0 { didSet { pendingFrames = framesAccepted } }
    var totalProgress: Float = 0 { didSet { updateTotalIndicator() } }

    private let passLabel = UILabel.dynaXBody("")
    private let frameLabel = UILabel.dynaXMono("0 frames")
    private let progressBar = DynaXProgressBar()
    private let dots = UIStackView()
    private var pendingFrames = 0
    private var frameTimer: Timer?
    private var completedPasses: Set<ScanPass> = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = DynaXBrand.surface.withAlphaComponent(0.96)
        passLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        frameLabel.textAlignment = .right

        dots.axis = .horizontal
        dots.spacing = 7
        dots.alignment = .center
        for _ in ScanPass.allCases {
            let dot = UIView()
            dot.translatesAutoresizingMaskIntoConstraints = false
            dot.layer.cornerRadius = 4
            dot.backgroundColor = DynaXBrand.textDim
            NSLayoutConstraint.activate([
                dot.widthAnchor.constraint(equalToConstant: 8),
                dot.heightAnchor.constraint(equalToConstant: 8)
            ])
            dots.addArrangedSubview(dot)
        }

        let topRow = UIStackView(arrangedSubviews: [passLabel, frameLabel])
        topRow.axis = .horizontal
        topRow.distribution = .fill
        let stack = UIStackView(arrangedSubviews: [topRow, progressBar, dots])
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 14),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 18),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -18),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
        ])
        frameTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) {
            [weak self] _ in self?.updateFrameCount()
        }
        updatePassLabel()
        updateTotalIndicator()
    }

    required init?(coder: NSCoder) { nil }
    deinit { frameTimer?.invalidate() }

    func markPassComplete(_ pass: ScanPass) {
        let index = pass.rawValue - 1
        guard dots.arrangedSubviews.indices.contains(index) else { return }
        completedPasses.insert(pass)
        UIView.animate(withDuration: 0.3) {
            self.dots.arrangedSubviews[index].backgroundColor = DynaXBrand.success
        }
    }

    private func updatePassLabel() {
        let name: String
        switch currentPass {
        case .pass1Circumferential: name = "Circumferential"
        case .pass2Distal: name = "Lower angle"
        case .pass3Proximal: name = "Upper angle"
        }
        passLabel.text = "Pass \(currentPass.rawValue) of 3 — \(name)"
    }

    private func updateBar() {
        progressBar.progress = max(0, min(1, passProgress))
    }

    private func updateFrameCount() {
        frameLabel.text = "\(pendingFrames) frames"
    }

    private func updateTotalIndicator() {
        let completed = min(3, Int((max(0, min(1, totalProgress)) * 3).rounded(.down)))
        for (index, view) in dots.arrangedSubviews.enumerated() {
            let pass = ScanPass(rawValue: index + 1)
            UIView.animate(withDuration: 0.2) {
                if let pass, self.completedPasses.contains(pass) {
                    view.backgroundColor = DynaXBrand.success
                } else {
                    view.backgroundColor = index < completed
                        ? DynaXBrand.blueBright
                        : DynaXBrand.textDim
                }
            }
        }
    }
}
