"""Persistent launcher settings — stored in the user's AppData, never in
Program Files, and never containing patient data.

Recovers gracefully from a missing or corrupt settings file: a corrupt file is
backed up (never silently destroyed) and defaults are returned, so a bad write
can never brick the launcher.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, asdict, field, fields
from pathlib import Path

from . import STUDIO_VERSION


APP_DIR_NAME = "DynaX Studio"
SETTINGS_FILENAME = "settings.json"
RECENT_PROJECTS_MAX = 10

# Production analytics/update backend baked in at build time. Overridable with
# DYNAX_DEFAULT_BACKEND_URL so the URL can change without a code edit (the build
# server exports it before freezing the exe). Every fresh installation points
# here automatically, so a coordinator never has to type a URL — they only hand
# the clinic its per-installation ingestion token.
DEFAULT_BACKEND_URL = os.environ.get(
    "DYNAX_DEFAULT_BACKEND_URL",
    "https://analytics.dynalimb.com",  # replace with the real URL after VPS setup
)


def config_dir() -> Path:
    """Per-user config directory. Overridable via DYNAX_STUDIO_CONFIG_DIR (used
    by tests) so the real user config is never touched during testing."""
    override = os.environ.get("DYNAX_STUDIO_CONFIG_DIR")
    if override:
        return Path(override)
    base = os.environ.get("APPDATA")  # Windows roaming profile
    if base:
        return Path(base) / APP_DIR_NAME
    return Path.home() / f".{APP_DIR_NAME.lower().replace(' ', '_')}"


def settings_path() -> Path:
    return config_dir() / SETTINGS_FILENAME


def _default_projects_folder() -> str:
    docs = Path.home() / "Documents"
    return str((docs if docs.exists() else Path.home()) / "DynaX Projects")


@dataclass
class Settings:
    blender_path: str = ""            # explicit Blender exe, if the user set one
    addon_path: str = ""              # detected dynax_addon dir (informational)
    default_project_folder: str = field(default_factory=_default_projects_folder)
    last_project: str = ""
    recent_projects: list[str] = field(default_factory=list)
    blender_version: str = ""         # last-detected "X.Y.Z"
    studio_version: str = STUDIO_VERSION
    # Analytics stays OFF by default: consent-gating is a hard product constraint
    # (see dynax_studio/CLAUDE.md) and enabling collection without opt-in would
    # break the privacy/legal gate. The backend URL is still baked in so that the
    # moment a user opts in, no server configuration is required.
    analytics_enabled: bool = False
    analytics_backend_url: str = field(default_factory=lambda: DEFAULT_BACKEND_URL)
    update_service_url: str = ""
    update_last_checked: str = ""
    update_last_status: str = "Never checked"
    update_latest_version: str = ""
    # Version the user chose to permanently dismiss from the update banner ("Never").
    update_dismissed_version: str = ""

    # ── persistence ──────────────────────────────────────────────────────
    @classmethod
    def load(cls, logger=None) -> "Settings":
        path = settings_path()
        if not path.exists():
            return cls()
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raise ValueError("settings root is not an object")
        except (json.JSONDecodeError, ValueError, OSError) as exc:
            _quarantine_corrupt(path, logger, exc)
            return cls()
        # Keep only known fields; ignore anything unexpected. Missing keys fall
        # back to defaults, so an older/newer file still loads.
        known = {f.name for f in fields(cls)}
        clean = {k: v for k, v in raw.items() if k in known}
        try:
            return cls(**clean)
        except TypeError as exc:
            _quarantine_corrupt(path, logger, exc)
            return cls()

    def save(self, logger=None) -> None:
        path = settings_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        # Atomic write: temp then replace, so an interrupted write can't corrupt
        # the live file.
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
        os.replace(tmp, path)
        if logger:
            logger.debug("Saved settings to %s", path)

    # ── helpers ──────────────────────────────────────────────────────────
    def remember_project(self, project_path: str) -> None:
        project_path = str(project_path)
        self.last_project = project_path
        self.recent_projects = [p for p in self.recent_projects if p != project_path]
        self.recent_projects.insert(0, project_path)
        del self.recent_projects[RECENT_PROJECTS_MAX:]


def _quarantine_corrupt(path: Path, logger, exc: Exception) -> None:
    """Move a corrupt settings file aside so the next save starts clean, keeping
    the bad copy for inspection rather than deleting it."""
    try:
        backup = path.with_name(f"settings.corrupt-{int(time.time())}.json")
        os.replace(path, backup)
        msg = f"Corrupt settings quarantined to {backup}: {exc}"
    except OSError as move_exc:
        msg = f"Corrupt settings could not be quarantined ({move_exc}); using defaults"
    if logger:
        logger.warning(msg)
    else:
        print(f"[DynaX Studio] {msg}")
