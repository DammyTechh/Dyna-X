"""Resolve bundled resource paths in both dev and PyInstaller-frozen runs.

In a normal `python launcher/main.py` run, resources live under the
`dynax_studio/` source tree. In a PyInstaller one-dir build, data files are
extracted next to the exe (PyInstaller sets `sys._MEIPASS`). This helper hides
that difference so `scripts/bootstrap.py`, `assets/logo.png`, etc. are found
either way.
"""

from __future__ import annotations

import sys
from pathlib import Path


def base_dir() -> Path:
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        return Path(meipass) if meipass else Path(sys.executable).resolve().parent
    # dev: launcher/ -> dynax_studio/
    return Path(__file__).resolve().parent.parent


def resource_path(*parts: str) -> Path:
    return base_dir().joinpath(*parts)


def install_dir() -> Path:
    """Directory that holds the *installed application* alongside the exe.

    Unlike ``base_dir()`` (which points at PyInstaller's extracted ``_internal``
    when frozen), this is the exe's own folder — where the installer lays down
    the large bundled payload (``bundled/blender/``, ``bundled/dynax_addon/``)
    as siblings of the exe rather than inside the PyInstaller archive. In dev it
    is the ``dynax_studio/`` source root, so ``dynax_studio/bundled/`` resolves
    the same way in both modes.
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def bundled_path(*parts: str) -> Path:
    return install_dir().joinpath("bundled", *parts)
