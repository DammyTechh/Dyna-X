"""ParaForge workflow selection page."""

from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtWidgets import QGridLayout, QLabel, QVBoxLayout, QWidget

from ..widgets import WorkflowCard


class ParaForgePage(QWidget):
    paraformRequested = Signal()
    paraflyRequested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("ParaForgePage")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 6, 0, 0)
        layout.setSpacing(16)
        title = QLabel("ParaForge")
        title.setObjectName("PageTitle")
        intro = QLabel("Guided prosthetic and orthotic design workflows.")
        intro.setObjectName("PageIntro")
        layout.addWidget(title)
        layout.addWidget(intro)

        cards = QGridLayout()
        cards.setHorizontalSpacing(18)
        self.paraform_card = WorkflowCard(
            "ParaForm",
            "Form and shape prosthetic and orthotic designs from clinical scans and measurements.",
            "paraform.svg", "Start ParaForm",
        )
        self.parafly_card = WorkflowCard(
            "ParaFly",
            "Open specialised guided design workflows for prosthetic and orthotic devices.",
            "parafly.svg", "Explore ParaFly",
        )
        self.paraform_card.activated.connect(self.paraformRequested)
        self.parafly_card.activated.connect(self.paraflyRequested)
        cards.addWidget(self.paraform_card, 0, 0)
        cards.addWidget(self.parafly_card, 0, 1)
        cards.setColumnStretch(0, 1)
        cards.setColumnStretch(1, 1)
        layout.addLayout(cards)
        layout.addStretch()

    def launch_controls(self) -> list:
        return [self.paraform_card.action_button]
