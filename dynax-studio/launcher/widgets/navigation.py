"""Header, breadcrumb, and browser-style page navigation widgets."""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QIcon, QPixmap
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from ..resources import resource_path


class HeaderBar(QWidget):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(14)
        logo = QLabel()
        logo_path = resource_path("assets", "logo.png")
        if logo_path.is_file():
            logo.setPixmap(QPixmap(str(logo_path)).scaledToHeight(52, Qt.SmoothTransformation))
        layout.addWidget(logo)
        text = QVBoxLayout()
        text.setSpacing(1)
        title = QLabel("DynaX Studio")
        title.setObjectName("HeaderTitle")
        subtitle = QLabel("Digital design tools for prosthetics and orthotics")
        subtitle.setObjectName("HeaderSubtitle")
        text.addWidget(title)
        text.addWidget(subtitle)
        layout.addLayout(text)
        layout.addStretch()


class BreadcrumbBar(QLabel):
    def __init__(self, parent=None) -> None:
        super().__init__("Home", parent)
        self.setObjectName("Breadcrumb")


class NavigationBar(QWidget):
    backRequested = Signal()
    forwardRequested = Signal()
    homeRequested = Signal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)
        self.back_button = self._button("Back", "back.svg")
        self.forward_button = self._button("Forward", "forward.svg")
        self.home_button = self._button("Home", "home.svg")
        self.back_button.clicked.connect(self.backRequested)
        self.forward_button.clicked.connect(self.forwardRequested)
        self.home_button.clicked.connect(self.homeRequested)
        layout.addWidget(self.back_button)
        layout.addWidget(self.forward_button)
        layout.addWidget(self.home_button)
        layout.addStretch()

    @staticmethod
    def _button(text: str, icon_name: str) -> QPushButton:
        button = QPushButton(text)
        button.setObjectName("NavigationButton")
        button.setIcon(QIcon(str(resource_path("assets", "icons", icon_name))))
        button.setCursor(Qt.PointingHandCursor)
        return button

    def set_history_state(self, can_back: bool, can_forward: bool) -> None:
        self.back_button.setEnabled(can_back)
        self.forward_button.setEnabled(can_forward)
