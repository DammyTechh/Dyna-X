"""Non-blocking, resumable synchronization of append-only analytics files."""

from __future__ import annotations

import json
import logging
import os
import ssl
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .settings import config_dir, settings_path


log = logging.getLogger("dynax.analytics.sync")
BATCH_SIZE = 200
MAX_RESPONSE_BYTES = 64 * 1024
CLIENT_VERSION = "1.20.8"
_thread_guard = threading.Lock()
_state_guard = threading.Lock()
_sync_thread: threading.Thread | None = None
_cancel_sync = threading.Event()


def start_background_sync(backend_url: str, ingestion_token: str) -> bool:
    """Start at most one daemon sync thread. Return whether one was started."""
    global _sync_thread
    if not analytics_enabled() or not valid_backend_url(backend_url) or not ingestion_token:
        return False
    with _thread_guard:
        if _sync_thread is not None and _sync_thread.is_alive():
            return False
        _cancel_sync.clear()
        _sync_thread = threading.Thread(
            target=_sync_loop,
            args=(backend_url, ingestion_token),
            daemon=True,
            name="dynax-analytics-sync",
        )
        _sync_thread.start()
    return True


def valid_backend_url(url: str) -> bool:
    if not url:
        return False
    parsed = urlparse(url.strip())
    if parsed.scheme == "https" and parsed.netloc:
        return True
    return parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}


def analytics_enabled() -> bool:
    try:
        data = json.loads(settings_path().read_text(encoding="utf-8"))
        return isinstance(data, dict) and data.get("analytics_enabled") is True
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return False


def get_sync_status() -> dict:
    state = _load_state()
    pending = list(_pending_dir().glob("events_*.jsonl"))
    return {
        "pending_files": len(pending),
        "pending_events": sum(_count_lines(path) for path in pending),
        "sent_files": len(list(_sent_dir().glob("events_*.jsonl"))),
        "last_sync_utc": state.get("last_sync_utc"),
        "last_error": state.get("last_error"),
    }


def purge_pending() -> None:
    """Delete only unsent analytics and their offsets after explicit opt-out."""
    _cancel_sync.set()
    for path in _pending_dir().glob("events_*.jsonl"):
        try:
            path.unlink()
        except OSError:
            continue
    with _state_guard:
        state = _load_state()
        state = {key: value for key, value in state.items() if not key.startswith("offset:")}
        _write_state(state)


def _sync_loop(backend_url: str, token: str) -> None:
    try:
        if not analytics_enabled():
            return
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        failures = []
        for path in sorted(_pending_dir().glob("events_*.jsonl")):
            if _cancel_sync.is_set() or not analytics_enabled():
                return
            try:
                _sync_file(path, backend_url, token, complete=today not in path.name)
            except (OSError, ValueError, HTTPError, URLError) as exc:
                failures.append(f"{path.name}: {type(exc).__name__}")
        _cleanup_sent()
        updates = {"last_sync_utc": datetime.now(timezone.utc).isoformat()}
        updates["last_error"] = "; ".join(failures)[:200] if failures else None
        _save_state(updates)
    except Exception as exc:  # background work must never affect the launcher
        _save_state({"last_error": type(exc).__name__})
        log.debug("[DynaX Sync] sync failed: %s", exc)


def _sync_file(path: Path, backend_url: str, token: str, *, complete: bool) -> None:
    state = _load_state()
    offset_key = f"offset:{path.name}"
    offset = int(state.get(offset_key, 0) or 0)
    size = path.stat().st_size
    if offset < 0 or offset > size:
        offset = 0

    batch: list[dict] = []
    acknowledged_offset = offset
    candidate_offset = offset
    with path.open("rb") as handle:
        handle.seek(offset)
        while True:
            line = handle.readline()
            if not line:
                break
            if not line.endswith(b"\n"):
                break  # writer has not completed this record yet
            candidate_offset = handle.tell()
            try:
                event = json.loads(line.decode("utf-8"))
            except (UnicodeError, json.JSONDecodeError):
                if not batch:
                    acknowledged_offset = candidate_offset
                    _save_state({offset_key: acknowledged_offset})
                continue
            if not isinstance(event, dict):
                if not batch:
                    acknowledged_offset = candidate_offset
                    _save_state({offset_key: acknowledged_offset})
                continue
            batch.append(event)
            if len(batch) >= BATCH_SIZE:
                _post_batch(batch, backend_url, token)
                acknowledged_offset = candidate_offset
                _save_state({offset_key: acknowledged_offset})
                batch = []
        if batch:
            _post_batch(batch, backend_url, token)
            acknowledged_offset = candidate_offset
            _save_state({offset_key: acknowledged_offset})

    if complete and acknowledged_offset == path.stat().st_size:
        sent = _sent_dir() / path.name
        sent.parent.mkdir(parents=True, exist_ok=True)
        os.replace(path, sent)
        _remove_state_key(offset_key)


def _post_batch(events: list[dict], backend_url: str, token: str) -> None:
    if _cancel_sync.is_set() or not analytics_enabled():
        raise ValueError("analytics disabled")
    payload = json.dumps(events, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    request = Request(
        backend_url.rstrip("/") + "/api/v1/events",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-DynaX-Version": CLIENT_VERSION,
        },
    )
    with urlopen(request, timeout=15, context=ssl.create_default_context()) as response:
        body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("analytics response too large")
        result = json.loads(body.decode("utf-8"))
    processed = int(result.get("accepted", 0)) + int(result.get("rejected", 0))
    if processed != len(events):
        raise ValueError("backend acknowledgement count mismatch")


def _cleanup_sent() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    for path in _sent_dir().glob("events_*.jsonl"):
        try:
            date = datetime.strptime(path.stem.removeprefix("events_"), "%Y-%m-%d")
            if date.replace(tzinfo=timezone.utc) < cutoff:
                path.unlink()
        except (OSError, ValueError):
            continue


def _analytics_dir() -> Path:
    return config_dir() / "analytics"


def _pending_dir() -> Path:
    return _analytics_dir() / "pending"


def _sent_dir() -> Path:
    return _analytics_dir() / "sent"


def _state_path() -> Path:
    return _analytics_dir() / "sync_state.json"


def _load_state() -> dict:
    try:
        data = json.loads(_state_path().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return {}


def _save_state(updates: dict) -> None:
    with _state_guard:
        state = _load_state()
        state.update(updates)
        _write_state(state)


def _remove_state_key(key: str) -> None:
    with _state_guard:
        state = _load_state()
        state.pop(key, None)
        _write_state(state)


def _write_state(state: dict) -> None:
    path = _state_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
        os.replace(tmp, path)
    except OSError as exc:
        log.debug("[DynaX Sync] could not save state: %s", exc)


def _count_lines(path: Path) -> int:
    try:
        with path.open("rb") as handle:
            return sum(1 for line in handle if line.endswith(b"\n"))
    except OSError:
        return 0
