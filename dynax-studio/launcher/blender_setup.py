"""Acquire a Blender for DynaX Studio when none is installed.

The launcher can use any Blender it discovers (bundled, a user-set path, or a
system install). When none is found, this module downloads the recommended
*portable* Blender into the per-user config directory — no admin rights, nothing
written to Program Files — and returns the ``blender.exe`` path so it can be saved
as ``settings.blender_path``. A manual download page is offered as a fallback.
"""
from __future__ import annotations

import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Callable, Optional

from .settings import config_dir

# Recommended Blender for DynaX Studio (matches PREFERRED_VERSIONS[0]).
RECOMMENDED_VERSION = "5.1.2"
DOWNLOAD_URL = (
    "https://download.blender.org/release/Blender5.1/blender-5.1.2-windows-x64.zip"
)
DOWNLOAD_PAGE = "https://www.blender.org/download/"


def target_root() -> Path:
    """Per-user, admin-free location for a downloaded portable Blender."""
    return config_dir() / "blender"


def find_local_blender() -> Optional[Path]:
    """Return blender.exe from a previously downloaded portable Blender, if any."""
    root = target_root()
    if not root.exists():
        return None
    for exe in sorted(root.glob("**/blender.exe")):
        if exe.is_file():
            return exe
    return None


def download_and_extract(
    progress_cb: Optional[Callable[[Optional[float]], None]] = None,
) -> Path:
    """Download the recommended portable Blender and extract it under
    :func:`target_root`. ``progress_cb`` receives a 0..1 fraction (or ``None``
    when the total size is unknown). Returns the path to ``blender.exe``.
    Raises on any failure.
    """
    existing = find_local_blender()
    if existing:
        return existing

    root = target_root()
    root.mkdir(parents=True, exist_ok=True)

    fd, tmp_name = tempfile.mkstemp(suffix=".zip")
    tmp_zip = Path(tmp_name)
    try:
        import os

        os.close(fd)
        req = urllib.request.Request(DOWNLOAD_URL, headers={"User-Agent": "DynaXStudio"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            total = int(resp.headers.get("Content-Length") or 0)
            done = 0
            with open(tmp_zip, "wb") as out:
                while True:
                    chunk = resp.read(1 << 20)
                    if not chunk:
                        break
                    out.write(chunk)
                    done += len(chunk)
                    if progress_cb:
                        progress_cb((done / total) if total else None)

        with zipfile.ZipFile(tmp_zip) as archive:
            archive.extractall(root)
    finally:
        try:
            tmp_zip.unlink()
        except OSError:
            pass

    exe = find_local_blender()
    if not exe:
        raise RuntimeError(
            "Blender was downloaded but blender.exe could not be found after extraction."
        )
    return exe
