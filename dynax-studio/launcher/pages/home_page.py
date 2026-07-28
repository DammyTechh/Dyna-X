"""Top-level launcher page."""

from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QGridLayout, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from ..resources import resource_path
from ..widgets import WorkflowCard


class HomePage(QWidget):
    creatorRequested = Signal()
    paraforgeRequested = Signal()
    openProjectRequested = Signal()
    settingsRequested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("HomePage")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 6, 0, 0)
        layout.setSpacing(16)

        title = QLabel("Start a project")
        title.setObjectName("PageTitle")
        intro = QLabel("Choose a DynaX workflow or continue an existing clinical design.")
        intro.setObjectName("PageIntro")
        layout.addWidget(title)
        layout.addWidget(intro)

        cards = QGridLayout()
        cards.setHorizontalSpacing(18)
        cards.setVerticalSpacing(18)
        self.creator_card = WorkflowCard(
            "New Creator Project",
            "Import, clean, modify and prepare clinical 3D scans for design and fabrication.",
            "creator.svg", "Start Creator",
        )
        self.paraforge_card = WorkflowCard(
            "New ParaForge Project",
            "Access guided prosthetic and orthotic design workflows.",
            "paraforge.svg", "Explore ParaForge",
        )
        self.creator_card.activated.connect(self.creatorRequested)
        self.paraforge_card.activated.connect(self.paraforgeRequested)
        cards.addWidget(self.creator_card, 0, 0)
        cards.addWidget(self.paraforge_card, 0, 1)
        cards.setColumnStretch(0, 1)
        cards.setColumnStretch(1, 1)
        layout.addLayout(cards)

        actions = QHBoxLayout()
        self.open_button = QPushButton("Open Existing Project")
        self.open_button.setObjectName("SecondaryAction")
        self.open_button.setIcon(QIcon(str(resource_path("assets", "icons", "folder.svg"))))
        self.open_button.clicked.connect(self.openProjectRequested)
        settings_button = QPushButton("Settings")
        settings_button.setObjectName("SecondaryAction")
        settings_button.clicked.connect(self.settingsRequested)
        actions.addWidget(self.open_button)
        actions.addWidget(settings_button)
        actions.addStretch()
        layout.addLayout(actions)
        layout.addStretch()

    def launch_controls(self) -> list:
        return [self.creator_card.action_button, self.open_button]
