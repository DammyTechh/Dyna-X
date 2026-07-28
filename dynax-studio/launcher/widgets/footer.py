"""Discreet Blender readiness and version footer."""

from __future__ import annotations

from PySide6.QtWidgets import QHBoxLayout, QLabel, QWidget


class StatusFooter(QWidget):
    def __init__(self, studio_version: str, parent=None) -> None:
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 4, 0, 0)
        self.indicator = QLabel("●")
        self.indicator.setObjectName("ReadyDot")
        self.status_label = QLabel("Checking Blender…")
        self.status_label.setObjectName("FooterText")
        self.status_label.setWordWrap(True)
        version = QLabel(f"DynaX Studio v{studio_version}")
        version.setObjectName("FooterText")
        layout.addWidget(self.indicator)
        layout.addWidget(self.status_label)
        layout.addStretch()
        layout.addWidget(version)

    def set_ready(self, ready: bool) -> None:
        self.indicator.setStyleSheet(
            "color: #2E9B62; font-size: 15px;" if ready
            else "color: #A7B1BC; font-size: 15px;"
        )
