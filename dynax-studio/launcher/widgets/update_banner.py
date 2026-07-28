"""Non-blocking "update available" banner shown at the top of the launcher.

The banner is purely informational. It never downloads or installs anything on
its own — "Download Update" only opens the release download page in the user's
system browser. It starts hidden and is revealed by the main window once a
background release check reports a strictly newer version.
"""

from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtWidgets import (
    QFrame, QHBoxLayout, QLabel, QPushButton, QVBoxLayout,
)


class UpdateBanner(QFrame):
    downloadRequested = Signal()      # user clicked "Download Update"
    remindLaterRequested = Signal()   # dismiss for this session only
    neverRequested = Signal()         # never show this specific version again

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("UpdateBanner")
        self._download_enabled = True

        outer = QHBoxLayout(self)
        outer.setContentsMargins(16, 12, 16, 12)
        outer.setSpacing(16)

        text_column = QVBoxLayout()
        text_column.setSpacing(2)
        self._title = QLabel()
        self._title.setObjectName("UpdateBannerTitle")
        self._body = QLabel()
        self._body.setObjectName("UpdateBannerBody")
        text_column.addWidget(self._title)
        text_column.addWidget(self._body)
        outer.addLayout(text_column, 1)

        self._download_button = QPushButton("Download Update")
        self._download_button.setObjectName("UpdateBannerPrimary")
        self._download_button.clicked.connect(self.downloadRequested)
        remind_button = QPushButton("Remind Me Later")
        remind_button.setObjectName("UpdateBannerSecondary")
        remind_button.clicked.connect(self.remindLaterRequested)
        never_button = QPushButton("Never")
        never_button.setObjectName("UpdateBannerSecondary")
        never_button.clicked.connect(self.neverRequested)
        outer.addWidget(self._download_button)
        outer.addWidget(remind_button)
        outer.addWidget(never_button)

        self.hide()

    def show_update(self, latest_version: str, installed_version: str,
                    *, download_available: bool) -> None:
        self._title.setText(f"\U0001F514  DynaX Studio {latest_version} is available")
        self._body.setText(f"You are running {installed_version}")
        # If the backend advertised no usable download link, keep the button but
        # disable it rather than opening nothing.
        self._download_enabled = download_available
        self._download_button.setEnabled(download_available)
        self._download_button.setToolTip(
            "" if download_available else "No download link was provided by the server.")
        self.show()
