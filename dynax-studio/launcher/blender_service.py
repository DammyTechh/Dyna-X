"""Locate, validate, and launch Blender — the launcher's engine room.

Design rules (from the Sprint 0 constraints):
- **No shell string execution, ever.** Every launch is a structured argument
  list handed to subprocess with shell=False.
- The add-on is never modified. Workflow selection happens through
  `scripts/bootstrap.py`, passed to Blender via `--python`, which only sets two
  scene properties once the add-on is ready.
- Nothing here requires admin rights or downloads anything.
"""

from __future__ import annotations

import ast
import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .workflows import Workflow, build_launch_payload, get_workflow
from .resources import resource_path, install_dir, bundled_path


# Add-on's minimum supported Blender (from dynax_addon bl_info["blender"]).
MIN_BLENDER_VERSION = (4, 1, 0)
# Preferred version, in priority order, when scanning known install locations.
PREFERRED_VERSIONS = ("5.1", "5.0", "4.1")

# Resolved via resource_path so it points at the bundled copy when frozen.
BOOTSTRAP_PATH = resource_path("scripts", "bootstrap.py")
APPLICATION_TEMPLATE_NAME = "DynaX_Studio"
APPLICATION_TEMPLATE_SOURCE = resource_path(
    "templates", APPLICATION_TEMPLATE_NAME)
CUSTOM_SPLASH_PATH = resource_path("assets", "logo.png")

# ── bundled distribution (Distribution Sprint) ─────────────────────────────
# The installer ships a portable Blender and the add-on beside the exe under
# `bundled/`. These are large payloads laid down by Inno Setup, NOT packed into
# the PyInstaller archive, so they resolve from install_dir(), not resource_path.
BUNDLED_BLENDER = bundled_path("blender", "blender.exe")
BUNDLED_ADDON_SOURCE = bundled_path("dynax_addon")
BUNDLED_ADDON_VERSION = (1, 20, 12)
# The bundled Blender is portable; to stay admin-free we never write into
# Program Files. All per-user Blender resources (add-on, app template, config)
# live under this writable location, pointed at via BLENDER_USER_RESOURCES.
_USER_RESOURCES_APP_DIR = "DynaX Studio"


def user_resources_dir() -> Path:
    """Writable Blender user-resources root for the bundled Blender.

    Everything the bundled Blender needs to *write* (add-on install, app
    template, config) goes here — under the user's LOCALAPPDATA — so a normal,
    non-admin user account can run DynaX Studio installed in Program Files."""
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
    root = Path(base) if base else Path.home()
    return root / _USER_RESOURCES_APP_DIR / "blender"


def is_bundled_blender(blender_path: Path | str) -> bool:
    """True when the given Blender is the one shipped inside DynaX Studio."""
    try:
        return Path(blender_path).resolve() == BUNDLED_BLENDER.resolve()
    except OSError:
        return False


def _read_addon_version(init_path: Path) -> tuple[int, ...] | None:
    """Read bl_info['version'] from an add-on __init__.py WITHOUT importing it
    (the add-on imports bpy, which isn't available in the launcher)."""
    try:
        tree = ast.parse(Path(init_path).read_text(encoding="utf-8"))
    except (OSError, SyntaxError):
        return None
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        if not any(isinstance(t, ast.Name) and t.id == "bl_info" for t in node.targets):
            continue
        if not isinstance(node.value, ast.Dict):
            continue
        for key, val in zip(node.value.keys, node.value.values):
            if isinstance(key, ast.Constant) and key.value == "version":
                try:
                    version = ast.literal_eval(val)
                    return tuple(int(n) for n in version)
                except (ValueError, TypeError):
                    return None
    return None


def ensure_bundled_addon(logger=None) -> Path | None:
    """First-run / repair install of the bundled add-on into the writable
    user-resources add-ons folder.

    Copies ``bundled/dynax_addon`` into
    ``<user_resources>/scripts/addons/dynax_addon`` when it is missing or older
    than the bundled copy. **Never overwrites a newer installed version** (so a
    field hotfix is not clobbered), never touches user projects, never needs
    admin rights, and runs no code from the add-on. Returns the installed
    add-on directory, or None if there is no bundled add-on (dev without a
    bundle)."""
    source = BUNDLED_ADDON_SOURCE
    if not (source / "__init__.py").is_file():
        return None
    target = user_resources_dir() / "scripts" / "addons" / "dynax_addon"
    src_ver = _read_addon_version(source / "__init__.py") or BUNDLED_ADDON_VERSION
    if target.is_dir():
        cur_ver = _read_addon_version(target / "__init__.py")
        if cur_ver is not None and cur_ver >= src_ver:
            return target  # keep newer/equal — never downgrade
        # Replace an older copy cleanly so stale modules can't linger.
        try:
            shutil.rmtree(target)
        except OSError as exc:
            if logger:
                logger.warning("Could not remove old bundled add-on: %s", exc)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target, dirs_exist_ok=True)
    except OSError as exc:
        raise LaunchError(
            f"Could not install the DynaX add-on into your profile:\n{exc}") from exc
    if logger:
        logger.info("Installed bundled DynaX add-on %s to %s",
                    ".".join(str(n) for n in src_ver), target)
    return target


class LaunchError(Exception):
    """Raised for any user-correctable launch problem (missing Blender, missing
    project, bad workflow). The message is safe to show in the UI."""


@dataclass
class BlenderInfo:
    path: Path
    version: tuple[int, int, int] | None
    version_str: str
    compatible: bool
    message: str

    @property
    def ok(self) -> bool:
        return self.compatible


# ── discovery ────────────────────────────────────────────────────────────

def _bundled_candidate() -> Path | None:
    """The portable Blender shipped inside DynaX Studio at
    ``<install>/bundled/blender/blender.exe``. Present in a bundled/installed
    build; absent in a dev checkout without a downloaded bundle."""
    if BUNDLED_BLENDER.is_file():
        return BUNDLED_BLENDER
    return None


def _known_install_candidates() -> list[Path]:
    """Standard Windows Blender install paths, newest-preferred first, resolved
    from environment variables (never hard-coded to one user)."""
    roots = []
    for var in ("PROGRAMFILES", "ProgramW6432", "PROGRAMFILES(X86)"):
        val = os.environ.get(var)
        if val:
            roots.append(Path(val))
    # De-dup while keeping order.
    seen, uniq_roots = set(), []
    for r in roots:
        if r not in seen:
            seen.add(r)
            uniq_roots.append(r)

    candidates: list[Path] = []
    for root in uniq_roots:
        for ver in PREFERRED_VERSIONS:
            candidates.append(root / "Blender Foundation" / f"Blender {ver}" / "blender.exe")
    return candidates


def discover_blender(settings) -> Path | None:
    """Find Blender in priority order:
      1. bundled inside DynaX Studio
      2. explicit path saved in settings
      3. known Windows install locations (5.1 preferred)
    Returns None if nothing valid is found (caller then offers a file picker).
    """
    bundled = _bundled_candidate()
    if bundled and looks_like_blender(bundled):
        return bundled

    configured = getattr(settings, "blender_path", "") or ""
    if configured:
        p = Path(configured)
        if looks_like_blender(p):
            return p

    for cand in _known_install_candidates():
        if looks_like_blender(cand):
            return cand
    return None


# ── validation ───────────────────────────────────────────────────────────

def looks_like_blender(path: Path | str) -> bool:
    """Cheap structural check (no process spawn): exists, is a file, and its
    name is a blender executable."""
    p = Path(path)
    if not p.is_file():
        return False
    name = p.name.lower()
    return name == "blender.exe" or name == "blender"


_VERSION_RE = re.compile(r"Blender\s+(\d+)\.(\d+)\.(\d+)")


def get_blender_version(path: Path) -> tuple[int, int, int] | None:
    """Run `blender --version` and parse it. Returns None if it can't be read."""
    try:
        proc = subprocess.run(
            [str(path), "--version"],
            capture_output=True, text=True, timeout=30, shell=False)
    except (OSError, subprocess.SubprocessError):
        return None
    match = _VERSION_RE.search(proc.stdout or "")
    if not match:
        return None
    return tuple(int(g) for g in match.groups())  # type: ignore[return-value]


def validate_blender(path: Path | str) -> BlenderInfo:
    """Full validation: exists, is Blender, version readable and compatible."""
    p = Path(path)
    if not p.exists():
        return BlenderInfo(p, None, "", False, "Blender was not found at that path.")
    if not looks_like_blender(p):
        return BlenderInfo(p, None, "", False,
                           "That file doesn't look like the Blender executable.")
    version = get_blender_version(p)
    if version is None:
        return BlenderInfo(p, None, "", False,
                           "Couldn't read the Blender version from that file.")
    version_str = ".".join(str(n) for n in version)
    if version < MIN_BLENDER_VERSION:
        need = ".".join(str(n) for n in MIN_BLENDER_VERSION)
        return BlenderInfo(p, version, version_str, False,
                           f"Blender {version_str} is too old — DynaX needs {need} or newer.")
    return BlenderInfo(p, version, version_str, True, f"Blender {version_str} ready.")


def find_addon(blender_path: Path, version: tuple[int, int, int] | None = None) -> Path | None:
    """Locate the installed dynax_addon for this Blender. For the bundled
    Blender that is the writable user-resources add-ons folder; for a
    user-selected system Blender it is the roaming Blender config. Returns the
    add-on dir if present, else None."""
    if is_bundled_blender(blender_path):
        bundled = user_resources_dir() / "scripts" / "addons" / "dynax_addon"
        return bundled if bundled.is_dir() else None
    if version is None:
        version = get_blender_version(blender_path)
    if version is None:
        return None
    ver_dir = f"{version[0]}.{version[1]}"
    appdata = os.environ.get("APPDATA")
    if not appdata:
        return None
    addon = (Path(appdata) / "Blender Foundation" / "Blender" / ver_dir
             / "scripts" / "addons" / "dynax_addon")
    return addon if addon.is_dir() else None


def application_template_target(
    blender_path: Path | str,
    version: tuple[int, int, int] | None = None,
) -> Path:
    """Return Blender's per-user application-template directory for DynaX.

    For the bundled Blender this is the writable user-resources tree (so no
    admin / Program Files write is needed); for a system Blender it is the
    roaming per-version config."""
    blender = Path(blender_path)
    if is_bundled_blender(blender):
        return (
            user_resources_dir() / "scripts" / "startup"
            / "bl_app_templates_user" / APPLICATION_TEMPLATE_NAME
        )
    version = version or get_blender_version(blender)
    if version is None:
        raise LaunchError("Couldn't determine Blender's template directory.")
    appdata = os.environ.get("APPDATA")
    if not appdata:
        raise LaunchError("Windows application-data directory is unavailable.")
    version_dir = f"{version[0]}.{version[1]}"
    return (
        Path(appdata) / "Blender Foundation" / "Blender" / version_dir
        / "scripts" / "startup" / "bl_app_templates_user"
        / APPLICATION_TEMPLATE_NAME
    )


def install_application_template(
    blender_path: Path | str,
    version: tuple[int, int, int] | None = None,
) -> Path:
    """Idempotently install the bundled, patient-data-free application template."""
    source = Path(APPLICATION_TEMPLATE_SOURCE)
    required = (source / "__init__.py", source / "startup.blend")
    if not source.is_dir() or not all(path.is_file() for path in required):
        raise LaunchError("The bundled DynaX Studio workspace template is incomplete.")
    target = application_template_target(blender_path, version)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target, dirs_exist_ok=True)
    except OSError as exc:
        raise LaunchError(
            f"Could not install the DynaX Studio workspace template:\n{exc}") from exc
    return target


# ── launch ───────────────────────────────────────────────────────────────

def build_command(
    blender_path: Path | str,
    workflow_key: str,
    *,
    project_path: str | None = None,
    marker_path: str | None = None,
    bootstrap_path: Path | None = None,
) -> tuple[list[str], dict[str, str]]:
    """Build the structured argv list + environment for a launch.

    Never returns a shell string. Blender opens the project (if any) and runs
    the bootstrap, which reads the workflow from the environment and sets the
    scene properties once the add-on is ready.
    """
    wf: Workflow = get_workflow(workflow_key)
    bp = Path(bootstrap_path or BOOTSTRAP_PATH)

    if wf.requires_project and not project_path:
        raise LaunchError("Please choose a project file to open.")
    if project_path:
        proj = Path(project_path)
        if not proj.is_file():
            raise LaunchError(f"Project file not found:\n{project_path}")

    args: list[str] = [str(blender_path)]
    if project_path:
        args.append(str(project_path))          # positional .blend to open
    else:
        args += ["--app-template", APPLICATION_TEMPLATE_NAME]
    args += ["--python", str(bp)]

    env = dict(os.environ)
    env["DYNAX_STUDIO_PAYLOAD"] = json.dumps(
        build_launch_payload(wf.key), separators=(",", ":"))
    # Retained as a compatibility contract for older bootstrap copies.
    env["DYNAX_STUDIO_WORKFLOW"] = wf.key
    # The bundled Blender is portable; redirect its user resources to a writable
    # per-user location so the add-on/template/config never touch Program Files.
    if is_bundled_blender(blender_path):
        env["BLENDER_USER_RESOURCES"] = str(user_resources_dir())
    if not project_path:
        env["DYNAX_STUDIO_NEW_PROJECT"] = "1"
        if CUSTOM_SPLASH_PATH.is_file():
            env["BLENDER_CUSTOM_SPLASH"] = str(CUSTOM_SPLASH_PATH)
    if marker_path:
        env["DYNAX_STUDIO_MARKER"] = str(marker_path)
    return args, env


def launch(
    blender_path: Path | str,
    workflow_key: str,
    *,
    project_path: str | None = None,
    marker_path: str | None = None,
    logger=None,
) -> subprocess.Popen:
    """Spawn Blender NON-BLOCKING (returns immediately with a Popen). Raises
    LaunchError for user-correctable problems."""
    info = validate_blender(blender_path)
    if not info.ok:
        raise LaunchError(info.message)

    # Bundled Blender: first-run/repair install of the add-on into the writable
    # user profile before launch (system Blender relies on the user's own copy).
    if is_bundled_blender(info.path):
        ensure_bundled_addon(logger)
    if not project_path:
        install_application_template(info.path, info.version)
    args, env = build_command(
        blender_path, workflow_key,
        project_path=project_path, marker_path=marker_path)

    if logger is not None:
        from .logging_setup import log_launch
        log_launch(logger, workflow=workflow_key, blender_path=str(blender_path),
                   args=args, project=project_path)

    try:
        return subprocess.Popen(args, env=env, shell=False)
    except OSError as exc:
        raise LaunchError(f"Could not start Blender:\n{exc}") from exc
