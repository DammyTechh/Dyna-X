"""Reusable workflow card with icon, description, and one clear action."""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import (
    QFrame, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget,
)

from ..resources import resource_path


class WorkflowCard(QFrame):
    activated = Signal()

    def __init__(
        self,
        title: str,
        description: str,
        icon_name: str,
        action_text: str,
        *,
        enabled: bool = True,
        badge: str = "",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("WorkflowCard")
        self.setProperty("disabledCard", not enabled)
        self.setMinimumHeight(206)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(22, 20, 22, 20)
        layout.setSpacing(10)

        top = QHBoxLayout()
        icon = QLabel()
        icon.setFixedSize(54, 54)
        icon.setAlignment(Qt.AlignCenter)
        icon.setStyleSheet("background: #EAF2FC; border-radius: 9px;")
        icon.setPixmap(QIcon(str(resource_path("assets", "icons", icon_name))).pixmap(34, 34))
        top.addWidget(icon)
        top.addStretch()
        if badge:
            badge_label = QLabel(badge)
            badge_label.setObjectName("ComingSoon")
            top.addWidget(badge_label, 0, Qt.AlignTop)
        layout.addLayout(top)

        title_label = QLabel(title)
        title_label.setObjectName("CardTitle")
        layout.addWidget(title_label)

        description_label = QLabel(description)
        description_label.setObjectName("CardDescription")
        description_label.setWordWrap(True)
        description_label.setAlignment(Qt.AlignTop)
        layout.addWidget(description_label, 1)

        action_row = QHBoxLayout()
        action_row.addStretch()
        self.action_button = QPushButton(action_text)
        self.action_button.setObjectName("CardAction")
        self.action_button.setCursor(Qt.PointingHandCursor)
        self.action_button.setEnabled(enabled)
        self.action_button.clicked.connect(self.activated)
        action_row.addWidget(self.action_button)
        layout.addLayout(action_row)

    def set_action_enabled(self, enabled: bool, reason: str = "") -> None:
        self.action_button.setEnabled(enabled)
        self.action_button.setToolTip(reason if not enabled else "")
