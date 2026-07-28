"""Local logging for the launcher.

Everything technical (paths, args, exit codes, stack traces) goes to a rotating
log file under the user's AppData. The UI only ever shows short, friendly
messages — a stack trace is never put in front of a clinician.

No sensitive/patient data is logged: we record the workflow key, the Blender
path and the (non-content) CLI args only.
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .settings import config_dir


_LOGGER_NAME = "dynax_studio"
_configured = False


def logs_dir() -> Path:
    return config_dir() / "logs"


def get_logger() -> logging.Logger:
    global _configured
    logger = logging.getLogger(_LOGGER_NAME)
    if _configured:
        return logger

    logger.setLevel(logging.DEBUG)
    try:
        d = logs_dir()
        d.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(
            d / "dynax_studio.log", maxBytes=512_000, backupCount=3,
            encoding="utf-8")
        handler.setLevel(logging.DEBUG)
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)-7s %(message)s"))
        logger.addHandler(handler)
    except OSError:
        # If the log file can't be opened we still return a usable logger
        # (console-only) rather than crashing the launcher over logging.
        logger.addHandler(logging.StreamHandler())

    _configured = True
    return logger


def redact_project(path: str | None) -> str:
    """Reduce a project path to just its filename for logging.

    Clinical project paths (and the folders holding them) can embed patient
    identifiers, so the full path is never written to the persistent log — only
    the bare filename is kept, which is enough for support to correlate a
    session without recording a scan location. See the known-limitations note:
    a filename a clinic chooses may itself contain an identifier."""
    if not path:
        return "-"
    return Path(path).name


def _redact_args(args: list[str], project: str | None) -> list[str]:
    """Return a copy of the launch argv with any full project path reduced to
    its filename, so the args logged alongside a launch carry no scan path."""
    if not project:
        return list(args)
    project_str = str(project)
    filename = Path(project_str).name
    return [filename if arg == project_str else arg for arg in args]


def log_launch(logger: logging.Logger, *, workflow: str, blender_path: str,
               args: list[str], project: str | None) -> None:
    """Record a launch attempt. No patient/scan data is written: the project is
    reduced to its filename in both the ``project`` field and the args list."""
    logger.info(
        "LAUNCH workflow=%s blender=%s project=%s args=%s",
        workflow, blender_path, redact_project(project),
        _redact_args(args, project))
