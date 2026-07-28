"""Branded DynaX Studio launcher window (PySide6/Qt).

The UI is deliberately separate from Blender discovery and process launching.
All launch behavior remains in the pure-stdlib service modules.
"""

from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QProcess, QProcessEnvironment, Qt, QTimer, QUrl
from PySide6.QtGui import QDesktopServices, QGuiApplication, QIcon
from PySide6.QtWidgets import (
    QApplication, QCheckBox, QDialog, QDialogButtonBox, QFileDialog, QFormLayout,
    QFrame, QGroupBox, QHBoxLayout, QLabel, QLineEdit, QMainWindow, QMessageBox,
    QPushButton, QScrollArea, QStackedWidget, QVBoxLayout, QWidget,
)

from . import STUDIO_VERSION
from . import blender_service as bs
from . import analytics_sync
from . import addon_installer
from . import update_checker
from .analytics_credentials import delete_token, load_token, save_token
from .logging_setup import get_logger, log_launch
from .pages import HomePage, ParaFlyPage, ParaForgePage
from .resources import resource_path
from .settings import Settings
from .theme import APP_STYLESHEET
from .widgets import (
    BreadcrumbBar, HeaderBar, NavigationBar, Sidebar, StatusFooter, UpdateBanner,
)
from .workflows import WORKFLOWS


def _window_icon() -> QIcon:
    for name in ("dynax.ico", "logo.png"):
        path = resource_path("assets", name)
        if path.is_file():
            return QIcon(str(path))
    return QIcon()


class MainWindow(QMainWindow):
    PAGE_BREADCRUMBS = {
        "home": "Home",
        "paraforge": "Home > ParaForge",
        "parafly": "Home > ParaForge > ParaFly",
    }

    def __init__(self) -> None:
        super().__init__()
        self.logger = get_logger()
        self.settings = Settings.load(self.logger)
        self._procs: list[QProcess] = []
        # Guards against launching a second Blender while one is still starting
        # (rapid double-clicks / clicking another workflow during startup).
        # Cleared once the child actually starts, errors, or exits.
        self._launching = False
        self.blender_info: bs.BlenderInfo | None = None
        self._history = ["home"]
        self._history_index = 0

        self.setWindowTitle("DynaX Studio")
        self.setWindowIcon(_window_icon())
        self.setMinimumSize(900, 600)
        self._apply_initial_size()
        self.setStyleSheet(APP_STYLESHEET)

        self._update_result: update_checker.UpdateResult | None = None
        self._build_ui()
        # Silent add-on self-heal: if a newer add-on shipped in this installer,
        # push it into the writable user profile before anything else. Never
        # blocks launch — check_and_update_addon logs and swallows any failure.
        addon_installer.check_and_update_addon(
            bs.BUNDLED_ADDON_SOURCE, bs.user_resources_dir(), self.logger)
        self._navigate("home", record=False)
        self._refresh_blender()
        self._start_analytics_sync()
        self._center_window()
        self._update_timer = QTimer(self)
        self._update_timer.setInterval(250)
        self._update_timer.timeout.connect(self._consume_update_result)
        self._start_update_check()

    def _build_ui(self) -> None:
        root = QWidget()
        root.setObjectName("StudioRoot")
        self.setCentralWidget(root)
        shell = QHBoxLayout(root)
        shell.setContentsMargins(0, 0, 0, 0)
        shell.setSpacing(0)

        self.sidebar = Sidebar()
        shell.addWidget(self.sidebar)

        content = QWidget()
        content.setObjectName("ContentArea")
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(34, 24, 34, 18)
        content_layout.setSpacing(14)
        shell.addWidget(content, 1)

        content_layout.addWidget(HeaderBar())

        # Update-available banner: hidden until a background release check finds a
        # strictly newer version. It sits above the workflow area and never
        # disables it, so it can't block clinical work.
        self.update_banner = UpdateBanner()
        self.update_banner.downloadRequested.connect(self._banner_download)
        self.update_banner.remindLaterRequested.connect(self._banner_remind_later)
        self.update_banner.neverRequested.connect(self._banner_never)
        content_layout.addWidget(self.update_banner)

        navigation_row = QHBoxLayout()
        self.navigation = NavigationBar()
        self.breadcrumb = BreadcrumbBar()
        navigation_row.addWidget(self.navigation)
        navigation_row.addStretch()
        navigation_row.addWidget(self.breadcrumb)
        content_layout.addLayout(navigation_row)

        self.stack = QStackedWidget()
        self.home_page = HomePage()
        self.paraforge_page = ParaForgePage()
        self.parafly_page = ParaFlyPage()
        self.pages = {
            "home": self.home_page,
            "paraforge": self.paraforge_page,
            "parafly": self.parafly_page,
        }
        for page in self.pages.values():
            self.stack.addWidget(page)
        # A resizable scroll area keeps every page usable when the window is made
        # small (content scrolls instead of clipping) and lets it fill the space
        # when the window is large.
        content_scroll = QScrollArea()
        content_scroll.setObjectName("ContentScroll")
        content_scroll.setWidgetResizable(True)
        content_scroll.setFrameShape(QFrame.Shape.NoFrame)
        content_scroll.viewport().setAutoFillBackground(False)
        content_scroll.setWidget(self.stack)
        content_layout.addWidget(content_scroll, 1)

        self.footer = StatusFooter(STUDIO_VERSION)
        self.status = self.footer.status_label
        content_layout.addWidget(self.footer)

        self.home_page.creatorRequested.connect(
            lambda: self._launch_workflow("creator"))
        self.home_page.paraforgeRequested.connect(
            lambda: self._navigate("paraforge"))
        self.home_page.openProjectRequested.connect(self._open_existing)
        self.home_page.settingsRequested.connect(self._open_settings)
        self.paraforge_page.paraformRequested.connect(
            lambda: self._launch_workflow("paraform"))
        self.paraforge_page.paraflyRequested.connect(
            lambda: self._navigate("parafly"))
        self.parafly_page.afoRequested.connect(
            lambda: self._launch_workflow("parafly_afo"))
        self.parafly_page.ttRequested.connect(
            lambda: self._launch_workflow("paralink_tt"))
        self.parafly_page.tlsoRequested.connect(
            lambda: self._launch_workflow("parafly_tlso"))

        self.sidebar.homeRequested.connect(lambda: self._navigate("home"))
        self.sidebar.creatorRequested.connect(
            lambda: self._launch_workflow("creator"))
        self.sidebar.paraforgeRequested.connect(
            lambda: self._navigate("paraforge"))
        self.sidebar.settingsRequested.connect(self._open_settings)
        self.navigation.backRequested.connect(self._go_back)
        self.navigation.forwardRequested.connect(self._go_forward)
        self.navigation.homeRequested.connect(lambda: self._navigate("home"))

        self.buttons: dict[str, QPushButton] = {
            "creator": self.home_page.creator_card.action_button,
            "paraform": self.paraforge_page.paraform_card.action_button,
            "parafly_afo": self.parafly_page.afo_card.action_button,
            "paralink_tt": self.parafly_page.tt_card.action_button,
            "parafly_tlso": self.parafly_page.tlso_card.action_button,
            "open_project": self.home_page.open_button,
        }
        self._launch_controls = list(self.buttons.values()) + [self.sidebar.creator_button]

    def _navigate(self, page_key: str, *, record: bool = True) -> None:
        page = self.pages[page_key]
        if record:
            current = self._history[self._history_index]
            if page_key != current:
                del self._history[self._history_index + 1:]
                self._history.append(page_key)
                self._history_index += 1
        self.stack.setCurrentWidget(page)
        self.breadcrumb.setText(self.PAGE_BREADCRUMBS[page_key])
        self.sidebar.set_active_page(page_key)
        self._update_navigation_state()

    def _go_back(self) -> None:
        if self._history_index == 0:
            return
        self._history_index -= 1
        self._navigate(self._history[self._history_index], record=False)

    def _go_forward(self) -> None:
        if self._history_index >= len(self._history) - 1:
            return
        self._history_index += 1
        self._navigate(self._history[self._history_index], record=False)

    def _update_navigation_state(self) -> None:
        self.navigation.set_history_state(
            self._history_index > 0,
            self._history_index < len(self._history) - 1,
        )

    def _apply_initial_size(self) -> None:
        """Open at a comfortable fraction of the available screen, clamped to
        sane bounds, so the launcher looks right on small laptops and large
        monitors alike (paired with per-monitor DPI scaling set up in run())."""
        screen = QApplication.primaryScreen()
        if screen is None:
            self.resize(1200, 760)
            return
        avail = screen.availableGeometry()
        width = max(900, min(1200, int(avail.width() * 0.72)))
        height = max(600, min(820, int(avail.height() * 0.82)))
        self.resize(width, height)

    def _center_window(self) -> None:
        screen = QApplication.primaryScreen()
        if screen is None:
            return
        frame = self.frameGeometry()
        frame.moveCenter(screen.availableGeometry().center())
        self.move(frame.topLeft())

    # Blender readiness
    def _refresh_blender(self) -> None:
        path = bs.discover_blender(self.settings)
        if path is None:
            self.blender_info = None
            self.footer.set_ready(False)
            self._set_workflows_enabled(
                False, "Blender not found - set it in Settings.")
            self.status.setText("Blender not found. Open Settings to choose it.")
            return
        info = bs.validate_blender(path)
        self.blender_info = info
        if not info.ok:
            self.footer.set_ready(False)
            self._set_workflows_enabled(False, info.message)
            self.status.setText(info.message)
            return

        self.settings.blender_path = str(info.path)
        self.settings.blender_version = info.version_str
        # Bundled Blender: make sure the add-on is present in the writable user
        # profile (first run installs it) so readiness detection succeeds and no
        # admin rights are ever required.
        if bs.is_bundled_blender(info.path):
            try:
                bs.ensure_bundled_addon(self.logger)
            except bs.LaunchError as exc:
                self.logger.warning("Bundled add-on install failed: %s", exc)
        addon = bs.find_addon(info.path, info.version)
        self.settings.addon_path = str(addon) if addon else ""
        self.settings.save(self.logger)

        self._set_workflows_enabled(True, "")
        version = info.version_str or "ready"
        self.footer.set_ready(True)
        self.status.setText(f"Blender {version} ready")
        if not addon:
            self.footer.set_ready(False)
            self.status.setText(
                f"Blender {version} found; DynaX add-on is not installed")
            self._set_workflows_enabled(
                False, "DynaX add-on not found in this Blender. Install it first.")

    def _set_workflows_enabled(self, enabled: bool, reason: str) -> None:
        # TLSO is now a real workflow (parafly_tlso -> PARAFORGE_ZONES/TLSO), so
        # its card is enabled/disabled with every other launch control by virtue
        # of being in self.buttons / self._launch_controls.
        for control in self._launch_controls:
            control.setEnabled(enabled)
            control.setToolTip("" if enabled else reason)

    # Existing launch and settings behavior
    def _launch_workflow(self, key: str, project_path: str | None = None) -> None:
        if self.blender_info is None or not self.blender_info.ok:
            self._error("Blender isn't ready. Open Settings to fix the path.")
            return
        if self._launching:
            # A Blender is already starting; ignore the extra click rather than
            # spawning a duplicate instance.
            self.status.setText("Blender is already starting - please wait...")
            return
        try:
            if bs.is_bundled_blender(self.blender_info.path):
                bs.ensure_bundled_addon(self.logger)
            if project_path is None:
                bs.install_application_template(
                    self.blender_info.path, self.blender_info.version)
            args, env = bs.build_command(
                self.blender_info.path, key, project_path=project_path)
        except bs.LaunchError as exc:
            self._error(str(exc))
            return

        log_launch(
            self.logger, workflow=key, blender_path=str(self.blender_info.path),
            args=args, project=project_path,
        )
        self._launching = True
        self._spawn(args, env, key)
        self.status.setText(f"Launching {WORKFLOWS[key].label}...")

    def _spawn(self, args: list[str], env: dict[str, str], key: str) -> None:
        proc = QProcess(self)
        qenv = QProcessEnvironment.systemEnvironment()
        for env_key, value in env.items():
            qenv.insert(env_key, value)
        proc.setProcessEnvironment(qenv)
        # Once Blender has actually started its window, the guard is released so
        # the user can open another workflow in a second instance if they want.
        proc.started.connect(self._settle_launch)
        proc.finished.connect(
            lambda code, _status, workflow=key, process=proc:
            self._on_finished(workflow, code, process))
        proc.errorOccurred.connect(
            lambda _error, workflow=key, process=proc:
            self._on_proc_error(workflow, process))
        self._procs.append(proc)
        proc.start(args[0], args[1:])

    def _settle_launch(self) -> None:
        """Release the single-launch guard (child has started/exited/errored)."""
        self._launching = False

    def _on_finished(self, key: str, code: int, proc: QProcess | None = None) -> None:
        self._settle_launch()
        self.logger.info("EXIT workflow=%s code=%s", key, code)
        self.status.setText(f"{WORKFLOWS[key].label} closed (exit {code}).")
        # Drop the finished process so the retained list doesn't grow across a
        # long working session (avoids leaking QProcess handles).
        if proc is not None and proc in self._procs:
            self._procs.remove(proc)
            proc.deleteLater()

    def _on_proc_error(self, key: str, proc: QProcess) -> None:
        self._settle_launch()
        message = proc.errorString()
        self.logger.error("PROC-ERROR workflow=%s: %s", key, message)
        self._error(f"Could not start Blender:\n{message}")

    def _open_existing(self) -> None:
        if self.blender_info is None or not self.blender_info.ok:
            self._error("Blender isn't ready. Open Settings to fix the path.")
            return
        start_dir = self.settings.default_project_folder
        if not Path(start_dir).exists():
            start_dir = str(Path.home())
        path, _ = QFileDialog.getOpenFileName(
            self, "Open DynaX Project", start_dir, "Blender files (*.blend)")
        if not path:
            return
        self.settings.remember_project(path)
        self.settings.save(self.logger)
        self._launch_workflow("open_project", project_path=path)

    def _open_settings(self) -> None:
        dialog = SettingsDialog(self.settings, self)
        if dialog.exec() == QDialog.Accepted:
            self.settings = dialog.result_settings
            self.settings.save(self.logger)
            self._refresh_blender()
            self._start_analytics_sync()

    def _start_analytics_sync(self) -> None:
        if not self.settings.analytics_enabled:
            return
        analytics_sync.start_background_sync(
            self.settings.analytics_backend_url, load_token())

    def _start_update_check(self) -> None:
        url = self.settings.update_service_url or self.settings.analytics_backend_url
        installed = ".".join(map(str, bs.BUNDLED_ADDON_VERSION))
        if url and update_checker.start_background_check(url, installed):
            self._update_timer.start()

    def _consume_update_result(self) -> None:
        result = update_checker.consume_result()
        if result is None:
            return
        self._update_timer.stop()
        self._update_result = result
        self.settings.update_last_checked = result.checked_at or ""
        self.settings.update_last_status = result.status
        self.settings.update_latest_version = result.latest_version or ""
        self.settings.save(self.logger)
        # Silent when the backend is unreachable or we're current/ahead: the
        # banner only appears for a strictly newer release.
        if result.status != "Update available" or not result.latest_version:
            return
        # "Never" for this version means don't show it again.
        if result.latest_version == self.settings.update_dismissed_version:
            self.logger.debug("Update %s previously dismissed; banner suppressed",
                              result.latest_version)
            return
        self.update_banner.show_update(
            result.latest_version, result.installed_version,
            download_available=bool(result.download_url or result.view_url))

    def _banner_download(self) -> None:
        result = self._update_result
        if result is None:
            return
        target = result.download_url or result.view_url
        if target:
            self.logger.info("Opening update download URL for %s", result.latest_version)
            QDesktopServices.openUrl(QUrl(target))

    def _banner_remind_later(self) -> None:
        # Dismiss for this session only — no persistence, so it returns next launch.
        self.update_banner.hide()

    def _banner_never(self) -> None:
        # Persist the dismissal for this specific version so it never returns.
        result = self._update_result
        if result is not None and result.latest_version:
            self.settings.update_dismissed_version = result.latest_version
            self.settings.save(self.logger)
            self.logger.info("Update %s dismissed permanently", result.latest_version)
        self.update_banner.hide()

    def _error(self, message: str) -> None:
        self.logger.warning("UI-ERROR: %s", message)
        QMessageBox.warning(self, "DynaX Studio", message)


class SettingsDialog(QDialog):
    def __init__(self, settings: Settings, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("DynaX Studio - Settings")
        self.setMinimumWidth(460)
        self.result_settings = settings

        form = QFormLayout(self)
        self.blender_edit = QLineEdit(settings.blender_path)
        blender_row = QHBoxLayout()
        blender_row.addWidget(self.blender_edit)
        browse = QPushButton("Browse...")
        browse.clicked.connect(self._browse_blender)
        blender_row.addWidget(browse)
        form.addRow("Blender executable:", blender_row)

        self.folder_edit = QLineEdit(settings.default_project_folder)
        folder_row = QHBoxLayout()
        folder_row.addWidget(self.folder_edit)
        folder_browse = QPushButton("Browse...")
        folder_browse.clicked.connect(self._browse_folder)
        folder_row.addWidget(folder_browse)
        form.addRow("Default project folder:", folder_row)

        analytics_group = QGroupBox("Analytics")
        analytics_layout = QVBoxLayout(analytics_group)
        self.analytics_check = QCheckBox("Share anonymous usage data")
        self.analytics_check.setChecked(settings.analytics_enabled)
        analytics_layout.addWidget(self.analytics_check)
        analytics_note = QLabel(
            "Helps improve DynaX Studio. Analytics accepts workflow and tool "
            "identifiers only; patient files, names and scan data are not accepted."
        )
        analytics_note.setWordWrap(True)
        analytics_layout.addWidget(analytics_note)

        analytics_form = QFormLayout()
        self.backend_edit = QLineEdit(settings.analytics_backend_url)
        self.backend_edit.setPlaceholderText("https://analytics.example.org")
        analytics_form.addRow("Backend URL:", self.backend_edit)
        self.token_edit = QLineEdit()
        self.token_edit.setEchoMode(QLineEdit.Password)
        self._stored_token = load_token()
        if self._stored_token:
            self.token_edit.setPlaceholderText("Stored securely for this Windows user")
        analytics_form.addRow("Ingestion token:", self.token_edit)
        analytics_layout.addLayout(analytics_form)

        # When no per-installation token has been provisioned yet, make the next
        # step obvious instead of letting analytics silently fail to send.
        self.token_notice = QLabel(
            "⚠ Analytics token not configured.\n"
            "  Contact your DynaX coordinator to receive your token.")
        self.token_notice.setWordWrap(True)
        self.token_notice.setStyleSheet("color: #B7791F;")
        self.token_notice.setVisible(not self._stored_token)
        analytics_layout.addWidget(self.token_notice)
        self.token_edit.textChanged.connect(
            lambda text: self.token_notice.setVisible(
                not (text.strip() or self._stored_token)))

        status = analytics_sync.get_sync_status()
        self.analytics_status = QLabel(
            f"{status['pending_events']} events pending"
            + (f" | Last sync: {status['last_sync_utc']}" if status['last_sync_utc'] else "")
        )
        self.analytics_status.setWordWrap(True)
        analytics_layout.addWidget(self.analytics_status)
        analytics_buttons = QHBoxLayout()
        sync_button = QPushButton("Sync Now")
        sync_button.clicked.connect(self._sync_now)
        privacy_button = QPushButton("View Privacy Notice")
        privacy_button.clicked.connect(self._show_privacy)
        analytics_buttons.addWidget(sync_button)
        analytics_buttons.addWidget(privacy_button)
        analytics_layout.addLayout(analytics_buttons)
        form.addRow(analytics_group)

        update_group = QGroupBox("Software Updates")
        update_layout = QFormLayout(update_group)
        self.update_url_edit = QLineEdit(
            settings.update_service_url or settings.analytics_backend_url)
        self.update_url_edit.setPlaceholderText("https://updates.example.org")
        update_layout.addRow("Update service:", self.update_url_edit)
        installed = ".".join(map(str, bs.BUNDLED_ADDON_VERSION))
        self.update_status = QLabel(
            f"Installed DynaX add-on: {installed}\n"
            f"Latest: {settings.update_latest_version or 'Unknown'}\n"
            f"Status: {settings.update_last_status}\n"
            f"Last checked: {settings.update_last_checked or 'Never'}")
        self.update_status.setWordWrap(True)
        update_layout.addRow(self.update_status)
        check_button = QPushButton("Check for Updates")
        check_button.clicked.connect(self._check_updates)
        update_layout.addRow(check_button)
        self._update_poll = QTimer(self)
        self._update_poll.setInterval(250)
        self._update_poll.timeout.connect(self._poll_update_result)
        form.addRow(update_group)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self._accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

    def _browse_blender(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Select Blender executable", "",
            "Blender (blender.exe blender);;All files (*)")
        if path:
            self.blender_edit.setText(path)

    def _browse_folder(self) -> None:
        path = QFileDialog.getExistingDirectory(
            self, "Select default project folder", self.folder_edit.text())
        if path:
            self.folder_edit.setText(path)

    def _sync_now(self) -> None:
        if not self.analytics_check.isChecked():
            self.analytics_status.setText("Analytics is disabled.")
            return
        url = self.backend_edit.text().strip()
        token = self.token_edit.text().strip() or self._stored_token
        if not analytics_sync.valid_backend_url(url) or not token:
            self.analytics_status.setText("Enter a valid HTTPS backend and token first.")
            return
        self.analytics_status.setText(
            "Sync started." if analytics_sync.start_background_sync(url, token)
            else "Sync is already running or analytics consent is not saved yet."
        )

    def _show_privacy(self) -> None:
        QMessageBox.information(
            self,
            "DynaX Analytics Privacy",
            "Analytics is optional and disabled by default. It records internal "
            "workflow, stage and tool identifiers, software versions, durations, "
            "and a pseudonymous installation UUID. It does not accept patient "
            "names, project paths, filenames, scan data, or geometry. The UUID "
            "may still be personal data under applicable privacy law."
        )

    def _check_updates(self) -> None:
        url = self.update_url_edit.text().strip()
        installed = ".".join(map(str, bs.BUNDLED_ADDON_VERSION))
        if not update_checker.valid_service_url(url):
            self.update_status.setText("Status: Unable to check - enter a valid update URL.")
            return
        self.update_status.setText("Checking for updates...")
        if update_checker.start_background_check(url, installed, force=True):
            self._update_poll.start()

    def _poll_update_result(self) -> None:
        result = update_checker.consume_result()
        if result is None:
            return
        self._update_poll.stop()
        self.result_settings.update_last_checked = result.checked_at or ""
        self.result_settings.update_last_status = result.status
        self.result_settings.update_latest_version = result.latest_version or ""
        self.update_status.setText(
            f"Installed DynaX add-on: {result.installed_version}\n"
            f"Latest: {result.latest_version or 'Unknown'}\n"
            f"Status: {result.status}\nLast checked: {result.checked_at or 'Unknown'}")
        if result.view_url and result.status == "Update available":
            self.update_status.setTextInteractionFlags(Qt.TextSelectableByMouse)

    def _accept(self) -> None:
        chosen = self.blender_edit.text().strip()
        if chosen:
            info = bs.validate_blender(chosen)
            if not info.ok:
                QMessageBox.warning(self, "DynaX Studio", info.message)
                return
        self.result_settings.blender_path = chosen
        self.result_settings.default_project_folder = self.folder_edit.text().strip()
        enabled = self.analytics_check.isChecked()
        backend_url = self.backend_edit.text().strip()
        token = self.token_edit.text().strip()
        if enabled and backend_url and not analytics_sync.valid_backend_url(backend_url):
            QMessageBox.warning(
                self, "DynaX Studio",
                "Analytics backend must use HTTPS (HTTP is allowed only for localhost)."
            )
            return
        if enabled and backend_url and not (token or self._stored_token):
            QMessageBox.warning(
                self, "DynaX Studio", "Enter the ingestion token supplied by your administrator."
            )
            return
        if enabled and token and not save_token(token):
            QMessageBox.warning(self, "DynaX Studio", "Could not store the ingestion token securely.")
            return
        if not enabled:
            delete_token()
            analytics_sync.purge_pending()
        self.result_settings.analytics_enabled = enabled
        self.result_settings.analytics_backend_url = backend_url
        update_url = self.update_url_edit.text().strip()
        if update_url and not update_checker.valid_service_url(update_url):
            QMessageBox.warning(self, "DynaX Studio", "Enter a valid HTTPS update service URL.")
            return
        self.result_settings.update_service_url = update_url
        self.accept()


def run() -> int:
    import sys
    # Crisp, correctly-sized UI on fractional-DPI displays (125% / 150% / 175%).
    # PassThrough uses the OS scale factor directly instead of rounding it, which
    # is what otherwise leaves the window oversized or slightly blurry. Must be
    # set before the QApplication is constructed.
    QGuiApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
    app = QApplication.instance() or QApplication(sys.argv)
    app.setApplicationName("DynaX Studio")
    app.setApplicationVersion(".".join(map(str, bs.BUNDLED_ADDON_VERSION)))
    app.setWindowIcon(_window_icon())
    window = MainWindow()
    window.show()
    return app.exec()
