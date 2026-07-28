"""ParaFly device workflow page."""

from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtWidgets import QGridLayout, QLabel, QVBoxLayout, QWidget

from ..widgets import WorkflowCard


class ParaFlyPage(QWidget):
    afoRequested = Signal()
    ttRequested = Signal()
    tlsoRequested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("ParaFlyPage")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 6, 0, 0)
        layout.setSpacing(16)
        title = QLabel("ParaFly")
        title.setObjectName("PageTitle")
        intro = QLabel("Select a specialised guided device workflow.")
        intro.setObjectName("PageIntro")
        layout.addWidget(title)
        layout.addWidget(intro)

        cards = QGridLayout()
        cards.setHorizontalSpacing(14)
        cards.setVerticalSpacing(14)
        self.afo_card = WorkflowCard(
            "AFO",
            "Design ankle-foot orthoses through a guided clinical workflow.",
            "afo.svg", "Start AFO",
        )
        self.tt_card = WorkflowCard(
            "TT",
            "Design and prepare transtibial prosthetic socket workflows.",
            "tt.svg", "Start TT",
        )
        self.tlso_card = WorkflowCard(
            "TLSO",
            "Design thoracolumbosacral orthoses using guided landmark and correction tools.",
            "tlso.svg", "Start TLSO Project",
        )
        self.afo_card.activated.connect(self.afoRequested)
        self.tt_card.activated.connect(self.ttRequested)
        self.tlso_card.activated.connect(self.tlsoRequested)
        cards.addWidget(self.afo_card, 0, 0)
        cards.addWidget(self.tt_card, 0, 1)
        cards.addWidget(self.tlso_card, 0, 2)
        for col in range(3):
            cards.setColumnStretch(col, 1)
        layout.addLayout(cards)
        layout.addStretch()

    def launch_controls(self) -> list:
        return [self.afo_card.action_button, self.tt_card.action_button,
                self.tlso_card.action_button]
