import UIKit

final class CaptureGuidanceView: UIView {
    private let badge = DynaXStatusBadge()
    private var pendingUpdate: DispatchWorkItem?

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        addSubview(badge)
        NSLayoutConstraint.activate([
            badge.topAnchor.constraint(equalTo: topAnchor),
            badge.leadingAnchor.constraint(equalTo: leadingAnchor),
            badge.trailingAnchor.constraint(equalTo: trailingAnchor),
            badge.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { nil }

    func update(with event: GuidanceEvent, animated: Bool) {
        update(message: event.clinicalInstruction, status: Self.status(for: event), animated: animated)
    }

    func update(
        message: String,
        status: DynaXStatusBadge.Status,
        animated: Bool
    ) {
        pendingUpdate?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            let changes = {
                self.badge.status = status
                self.badge.text = message
            }
            if animated {
                UIView.transition(
                    with: self.badge,
                    duration: 0.2,
                    options: [.transitionCrossDissolve, .beginFromCurrentState],
                    animations: changes
                )
            } else {
                changes()
            }
        }
        pendingUpdate = work
        DispatchQueue.main.async(execute: work)
    }

    private static func status(for event: GuidanceEvent) -> DynaXStatusBadge.Status {
        switch event {
        case .trackingRecoveryAttempting, .returnToScanStart:
            .recovering
        case .trackingRecoveryFailed:
            .error
        case .moveCloser, .moveBack, .slowDown, .improveLighting:
            .warning
        case .holdSteady, .trackingRecovered, .passComplete, .scanComplete:
            .good
        }
    }
}
