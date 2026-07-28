"""Silent, non-downgrading add-on updater run on every launcher start.

The installer lays down the clinical add-on source under ``bundled/dynax_addon``
and it is copied into the writable per-user Blender resources on first run. This
module extends that to a *self-heal on every launch*: if a newer add-on ships in
a later installer, an existing user picks it up automatically the next time they
open DynaX Studio — no reinstall, no dialog, no admin rights.

Contract (see dynax_studio/CLAUDE.md, "Silent add-on update"):
  * Never downgrade. Never reinstall when versions already match.
  * Only ever writes the add-on inside Blender's *user resources* — Blender
    itself is never touched.
  * Silent: no dialog is shown to the user. Failure is logged and swallowed so
    the launcher continues starting normally.
  * A missing bundled add-on (dev checkout without a downloaded bundle) logs a
    warning and is a no-op.

The version is read from the add-on's ``bl_info["version"]`` tuple by parsing
``__init__.py`` with ``ast`` — the module is never imported (it imports ``bpy``,
which the launcher process does not have).
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

# Reuse the single AST-based version reader so the launcher never diverges on how
# an add-on version is parsed.
from .blender_service import _read_addon_version

log = logging.getLogger("dynax.addon")

ADDON_DIR_NAME = "dynax_addon"


def _addon_target_dir(blender_user_resources) -> Path:
    return Path(blender_user_resources) / "scripts" / "addons" / ADDON_DIR_NAME


def _read_installed_addon_version(blender_user_resources) -> tuple[int, ...] | None:
    """Version currently installed in Blender's user resources, or None."""
    init = _addon_target_dir(blender_user_resources) / "__init__.py"
    if not init.is_file():
        return None
    return _read_addon_version(init)


def _read_bundled_addon_version(bundled_addon_path) -> tuple[int, ...] | None:
    """Version of the add-on shipped beside the exe, or None."""
    init = Path(bundled_addon_path) / "__init__.py"
    if not init.is_file():
        return None
    return _read_addon_version(init)


def _install_addon(bundled_addon_path, blender_user_resources) -> Path:
    """Replace the installed add-on with the bundled copy. Removing the old tree
    first prevents stale modules from lingering after a rename/split."""
    target = _addon_target_dir(blender_user_resources)
    if target.is_dir():
        shutil.rmtree(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(bundled_addon_path, target)
    return target


def check_and_update_addon(bundled_addon_path, blender_user_resources,
                           logger=None) -> bool:
    """Compare bundled add-on version against the installed version.

    If bundled is newer, install it silently. Never downgrade, never reinstall
    on an exact match. Logs the result either way and never raises — a failure
    is logged and swallowed so it can never block the launcher.

    Returns True only when an update was actually installed.
    """
    logger = logger or log
    if not (Path(bundled_addon_path) / "__init__.py").is_file():
        logger.warning("[DynaX] No bundled add-on at %s; skipping update check",
                       bundled_addon_path)
        return False

    bundled_version = _read_bundled_addon_version(bundled_addon_path)
    installed_version = _read_installed_addon_version(blender_user_resources)
    if bundled_version is None:
        logger.warning("[DynaX] Could not read bundled add-on version; skipping")
        return False

    if installed_version is not None and installed_version >= bundled_version:
        logger.debug("[DynaX] Add-on up to date: %s", _fmt(installed_version))
        return False

    try:
        _install_addon(bundled_addon_path, blender_user_resources)
    except OSError as exc:
        logger.error("[DynaX] Add-on update failed (%s → %s): %s",
                     _fmt(installed_version), _fmt(bundled_version), exc)
        return False

    logger.info("[DynaX] Add-on updated: %s → %s",
                _fmt(installed_version), _fmt(bundled_version))
    return True


def _fmt(version: tuple[int, ...] | None) -> str:
    return ".".join(str(part) for part in version) if version else "not installed"
