"""Store the ingestion token encrypted for the current Windows user."""

from __future__ import annotations

import ctypes
import os
from ctypes import wintypes
from pathlib import Path

from .settings import config_dir


TOKEN_ENV = "DYNAX_ANALYTICS_INGESTION_TOKEN"
TOKEN_FILE = "analytics_token.bin"
_CRYPTPROTECT_UI_FORBIDDEN = 0x1


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def load_token() -> str:
    """Return the environment override or the current user's encrypted token."""
    override = os.environ.get(TOKEN_ENV, "").strip()
    if override:
        return override
    if os.name != "nt":
        return ""
    try:
        encrypted = _token_path().read_bytes()
        return _unprotect(encrypted).decode("utf-8")
    except (OSError, UnicodeError, ValueError):
        return ""


def save_token(token: str) -> bool:
    """Encrypt and atomically persist a token. Empty input deletes it."""
    token = token.strip()
    if not token:
        delete_token()
        return True
    if os.name != "nt" or len(token) > 2048 or any(c in token for c in "\r\n\t"):
        return False
    try:
        path = _token_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(_protect(token.encode("utf-8")))
        os.replace(tmp, path)
        return True
    except (OSError, ValueError):
        return False


def delete_token() -> None:
    try:
        _token_path().unlink(missing_ok=True)
    except OSError:
        return


def _token_path() -> Path:
    return config_dir() / TOKEN_FILE


def _blob(data: bytes):
    buffer = ctypes.create_string_buffer(data)
    blob = _DataBlob(
        len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))
    )
    return blob, buffer


def _protect(data: bytes) -> bytes:
    in_blob, in_buffer = _blob(data)
    out_blob = _DataBlob()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    ok = crypt32.CryptProtectData(
        ctypes.byref(in_blob), "DynaX Analytics", None, None, None,
        _CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out_blob),
    )
    del in_buffer
    if not ok:
        raise ValueError("DPAPI encryption failed")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)


def _unprotect(data: bytes) -> bytes:
    in_blob, in_buffer = _blob(data)
    out_blob = _DataBlob()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    ok = crypt32.CryptUnprotectData(
        ctypes.byref(in_blob), None, None, None, None,
        _CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out_blob),
    )
    del in_buffer
    if not ok:
        raise ValueError("DPAPI decryption failed")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)

