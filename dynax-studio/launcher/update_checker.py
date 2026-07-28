"""Non-blocking, read-only DynaX release availability checks."""

from __future__ import annotations

import json
import logging
import ssl
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


log = logging.getLogger("dynax.update")
MAX_RESPONSE_BYTES = 32 * 1024
TIMEOUT_SECONDS = 5
_guard = threading.Lock()
_thread: threading.Thread | None = None
_result: "UpdateResult | None" = None
_checked_this_session = False


@dataclass(frozen=True)
class UpdateResult:
    status: str
    installed_version: str
    latest_version: str | None = None
    view_url: str | None = None
    checked_at: str | None = None
    download_url: str | None = None


def _version(value: str | None):
    """Parse a semantic version with PEP 440 semantics (never string compare).

    Returns a ``packaging.version.Version`` (rich-comparable, prerelease-aware)
    or ``None`` when the value is missing or not a valid version. A leading
    ``v`` is tolerated (``v1.20.9``)."""
    from packaging.version import InvalidVersion, Version
    text = (value or "").strip()
    if text[:1] in ("v", "V"):
        text = text[1:]
    try:
        return Version(text)
    except InvalidVersion:
        return None


def update_is_available(installed: str, latest: str) -> bool:
    """True only when ``latest`` is a strictly newer release than ``installed``.

    Uses ``packaging.version.Version`` ordering so 1.20.8 < 1.20.9 < 1.21.0 <
    2.0.0 all resolve correctly, and an unparseable version never reports an
    update."""
    installed_parsed, latest_parsed = _version(installed), _version(latest)
    if installed_parsed is None or latest_parsed is None:
        return False
    return latest_parsed > installed_parsed


def compare_versions(installed: str, latest: str) -> str:
    installed_parsed, latest_parsed = _version(installed), _version(latest)
    if installed_parsed is None:
        return "Unknown installed version"
    if latest_parsed is None:
        return "Unable to check"
    if latest_parsed > installed_parsed:
        return "Update available"
    if latest_parsed < installed_parsed:
        return "Ahead of release"
    return "Up to date"


def _https_or_none(value) -> str | None:
    """Accept a URL only if it is a plain HTTPS link (defends against a
    compromised/misconfigured backend advertising file:// or javascript: URLs
    that would later be handed to the system browser)."""
    if isinstance(value, str) and urlparse(value).scheme == "https":
        return value
    return None


def valid_service_url(url: str) -> bool:
    parsed = urlparse(url.strip())
    return ((parsed.scheme == "https" and bool(parsed.netloc)) or
            (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}))


def check_now(service_url: str, installed_version: str) -> UpdateResult:
    checked_at = datetime.now(timezone.utc).isoformat()
    if not valid_service_url(service_url):
        return UpdateResult("Unable to check", installed_version, checked_at=checked_at)
    request = Request(service_url.rstrip("/") + "/api/v1/releases/current",
                      headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS,
                     context=ssl.create_default_context()) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("release response too large")
        payload = json.loads(body.decode("utf-8"))
        if not isinstance(payload, dict) or payload.get("product") != "dynax-studio":
            raise ValueError("invalid release response")
        latest = payload.get("version")
        if not isinstance(latest, str):
            raise ValueError("missing release version")
        status = compare_versions(installed_version, latest)
        download_url = _https_or_none(payload.get("download_url"))
        # "View" falls back to release notes when there is no direct download.
        view_url = _https_or_none(payload.get("release_notes_url")) or download_url
        return UpdateResult(status, installed_version, latest, view_url, checked_at,
                            download_url)
    except (OSError, ValueError, HTTPError, URLError, json.JSONDecodeError) as exc:
        log.debug("Update check unavailable: %s", type(exc).__name__)
        return UpdateResult("Unable to check", installed_version, checked_at=checked_at)


def start_background_check(service_url: str, installed_version: str,
                           *, force: bool = False) -> bool:
    global _thread, _checked_this_session
    with _guard:
        if _thread is not None and _thread.is_alive():
            return False
        if _checked_this_session and not force:
            return False
        _checked_this_session = True
        _thread = threading.Thread(
            target=_worker, args=(service_url, installed_version), daemon=True,
            name="dynax-update-check")
        _thread.start()
        return True


def _worker(service_url: str, installed_version: str) -> None:
    global _result
    result = check_now(service_url, installed_version)
    with _guard:
        _result = result


def consume_result() -> UpdateResult | None:
    global _result
    with _guard:
        result, _result = _result, None
        return result
