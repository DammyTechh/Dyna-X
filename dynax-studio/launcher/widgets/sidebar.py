"""Compact left navigation for the launcher."""

from __future__ import annotations

from PySide6.QtCore import QSize, Qt, Signal
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QLabel, QPushButton, QVBoxLayout, QWidget

from ..resources import resource_path


class SidebarButton(QPushButton):
    def __init__(self, text: str, icon_name: str, parent=None) -> None:
        super().__init__(text, parent)
        self.setObjectName("SidebarButton")
        self.setIcon(QIcon(str(resource_path("assets", "icons", icon_name))))
        self.setIconSize(QSize(19, 19))
        self.setCursor(Qt.PointingHandCursor)
        self.setProperty("active", False)

    def set_active(self, active: bool) -> None:
        self.setProperty("active", active)
        self.style().unpolish(self)
        self.style().polish(self)


class Sidebar(QWidget):
    homeRequested = Signal()
    creatorRequested = Signal()
    paraforgeRequested = Signal()
    settingsRequested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("Sidebar")
        self.setFixedWidth(184)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 24, 14, 18)
        layout.setSpacing(5)

        brand = QLabel("DynaX")
        brand.setStyleSheet("color: #17345F; font-size: 18px; font-weight: 700; padding: 0 8px 15px;")
        layout.addWidget(brand)

        self.home_button = SidebarButton("Home", "home.svg")
        self.creator_button = SidebarButton("Creator", "creator.svg")
        self.paraforge_button = SidebarButton("ParaForge", "paraforge.svg")
        self.settings_button = SidebarButton("Settings", "settings.svg")
        self.home_button.clicked.connect(self.homeRequested)
        self.creator_button.clicked.connect(self.creatorRequested)
        self.paraforge_button.clicked.connect(self.paraforgeRequested)
        self.settings_button.clicked.connect(self.settingsRequested)
        for button in (self.home_button, self.creator_button, self.paraforge_button):
            layout.addWidget(button)
        layout.addStretch()
        layout.addWidget(self.settings_button)

    def set_active_page(self, page_key: str) -> None:
        self.home_button.set_active(page_key == "home")
        self.paraforge_button.set_active(page_key in {"paraforge", "parafly"})
        self.creator_button.set_active(False)
