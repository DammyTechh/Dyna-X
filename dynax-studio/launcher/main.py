"""DynaX Studio entry point.

Normal run (GUI):
    python -m dynax_studio.launcher.main
    python dynax_studio/launcher/main.py

Hidden validation modes (used to test the PACKAGED .exe, which — being a
windowed PyInstaller build — has no stdout, so results are written to a file):
    "DynaX Studio.exe" --selftest  <out.json>        core logic, no Qt
    "DynaX Studio.exe" --guicheck  <out.json>        builds the real window (offscreen)
    "DynaX Studio.exe" --launchtest <workflow> <marker.json> [project.blend]
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow running as a plain script (python launcher/main.py) as well as a module.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _write_json(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


def _selftest(out_path: str) -> int:
    """Exercise discovery / validation / command-building inside the frozen
    environment, no Qt required."""
    from launcher import blender_service as bs
    from launcher.settings import Settings
    from launcher.workflows import WORKFLOWS

    result: dict = {"frozen": bool(getattr(sys, "frozen", False))}
    settings = Settings.load()
    blender = bs.discover_blender(settings)
    result["blender_found"] = str(blender) if blender else None

    if blender:
        info = bs.validate_blender(blender)
        result["blender_version"] = info.version_str
        result["blender_ok"] = info.ok
        addon = bs.find_addon(info.path, info.version)
        result["addon_found"] = str(addon) if addon else None

    # Command construction for every workflow (mapping + bundled bootstrap path).
    result["bootstrap_path"] = str(bs.BOOTSTRAP_PATH)
    result["bootstrap_exists"] = Path(bs.BOOTSTRAP_PATH).is_file()
    template = Path(bs.APPLICATION_TEMPLATE_SOURCE)
    result["application_template_path"] = str(template)
    result["application_template_exists"] = template.is_dir()
    result["application_template_files"] = {
        name: (template / name).is_file()
        for name in ("__init__.py", "startup.blend", "README.txt")
    }
    wf_cmds = {}
    blender_arg = str(blender) if blender else "blender.exe"
    for key in WORKFLOWS:
        try:
            proj = None
            if WORKFLOWS[key].requires_project:
                # supply a real temp .blend so open_project builds cleanly
                import tempfile
                tf = tempfile.NamedTemporaryFile(suffix=".blend", delete=False)
                tf.write(b"x"); tf.close(); proj = tf.name
            args, env = bs.build_command(blender_arg, key, project_path=proj,
                                         marker_path="M")
            wf_cmds[key] = {
                "workflow_env": env.get("DYNAX_STUDIO_WORKFLOW"),
                "has_bootstrap": "--python" in args,
                "argv_is_list": isinstance(args, list),
                "uses_template": (
                    "--app-template" in args
                    if not WORKFLOWS[key].requires_project else False
                ),
            }
        except Exception as exc:  # noqa: BLE001
            wf_cmds[key] = {"error": str(exc)}
    result["workflows"] = wf_cmds

    # Error paths: invalid Blender + missing project must be clean (no crash).
    result["invalid_blender_clean"] = not bs.validate_blender("Z:/nope/blender.exe").ok
    try:
        bs.build_command(blender_arg, "open_project", project_path="Z:/no.blend")
        result["missing_project_clean"] = False
    except bs.LaunchError:
        result["missing_project_clean"] = True

    _write_json(out_path, result)
    return 0


def _guicheck(out_path: str) -> int:
    """Build the real launcher window offscreen (no visible window) and exercise
    the three-page navigation, breadcrumbs, sidebar highlighting, TLSO state and
    icon rendering — proving PySide6 + the refactored UI work in the frozen build."""
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtWidgets import QApplication
    from PySide6.QtGui import QIcon
    from launcher.main_window import MainWindow, SettingsDialog
    from launcher.resources import resource_path

    app = QApplication.instance() or QApplication([])
    win = MainWindow()
    bi = win.blender_info
    r: dict = {
        "pyside_loaded": True,
        "title": win.windowTitle(),
        "blender": None if bi is None else bi.version_str,
        "blender_ok": None if bi is None else bi.ok,
        "addon": win.settings.addon_path or None,
        "buttons_enabled": {k: b.isEnabled() for k, b in win.buttons.items()},
        "status": win.status.text(),
        "pages": sorted(win.pages.keys()),
    }

    # Navigation + breadcrumbs + sidebar highlighting.
    nav: dict = {}
    win._navigate("home")
    nav["home_breadcrumb"] = win.breadcrumb.text()
    nav["home_renders"] = win.stack.currentWidget() is win.home_page
    nav["sidebar_home_active"] = bool(win.sidebar.home_button.property("active"))
    win._navigate("paraforge")
    nav["paraforge_breadcrumb"] = win.breadcrumb.text()
    nav["paraforge_renders"] = win.stack.currentWidget() is win.paraforge_page
    nav["sidebar_paraforge_active"] = bool(win.sidebar.paraforge_button.property("active"))
    win._navigate("parafly")
    nav["parafly_breadcrumb"] = win.breadcrumb.text()
    nav["parafly_renders"] = win.stack.currentWidget() is win.parafly_page
    nav["back_enabled_at_tip"] = win.navigation.back_button.isEnabled()
    nav["forward_disabled_at_tip"] = not win.navigation.forward_button.isEnabled()
    win._go_back()
    nav["back_works"] = win.stack.currentWidget() is win.paraforge_page
    nav["forward_enabled_after_back"] = win.navigation.forward_button.isEnabled()
    win._go_forward()
    nav["forward_works"] = win.stack.currentWidget() is win.parafly_page
    win._navigate("home")
    nav["home_from_parafly_works"] = win.stack.currentWidget() is win.home_page
    r["navigation"] = nav

    # TLSO is now a real workflow: its card must be enabled and read
    # "Start TLSO Project" (no longer "Coming soon").
    tlso_btn = win.parafly_page.tlso_card.action_button
    r["tlso_enabled"] = tlso_btn.isEnabled()
    r["tlso_action_text"] = tlso_btn.text()

    # Icons must actually render (svg plugin present + files bundled): a rendered
    # pixmap is non-null only if both hold.
    icons: dict = {}
    for name in ("home.svg", "creator.svg", "paraforge.svg", "paraform.svg",
                 "afo.svg", "tt.svg", "tlso.svg", "back.svg", "forward.svg",
                 "settings.svg"):
        path = resource_path("assets", "icons", name)
        pix = QIcon(str(path)).pixmap(24, 24)
        icons[name] = bool(path.is_file() and not pix.isNull())
    r["icons_resolve"] = icons
    r["all_icons_ok"] = all(icons.values())
    r["logo_ok"] = resource_path("assets", "logo.png").is_file()

    dlg = SettingsDialog(win.settings, win)
    r["settings_dialog_prefilled"] = bool(dlg.blender_edit.text())
    _write_json(out_path, r)
    return 0


def _launchtest(workflow: str, marker: str, project: str | None = None) -> int:
    """Run the frozen launcher's real structured command through Blender.

    This acceptance-only mode uses the installed DynaX add-on. New projects
    exercise the bundled application template; existing projects bypass it.
    """
    import subprocess
    from launcher import blender_service as bs
    from launcher.settings import Settings

    blender = bs.discover_blender(Settings())
    if blender is None:
        _write_json(marker, {"ok": False, "reason": "no_blender"})
        return 1
    info = bs.validate_blender(blender)
    # Bundled Blender: first-run/repair install of the add-on into the writable
    # user profile (mirrors the GUI readiness path) before checking for it.
    if bs.is_bundled_blender(info.path):
        try:
            bs.ensure_bundled_addon()
        except bs.LaunchError:
            pass
    if not info.ok or bs.find_addon(info.path, info.version) is None:
        _write_json(marker, {"ok": False, "reason": "addon_unavailable"})
        return 1
    if project is None:
        bs.install_application_template(info.path, info.version)
    args, env = bs.build_command(
        blender, workflow, project_path=project, marker_path=marker)
    args.insert(1, "-b")
    proc = subprocess.run(args, env=env, timeout=120, shell=False)
    return proc.returncode


def main() -> int:
    argv = sys.argv[1:]
    if argv and argv[0] == "--selftest" and len(argv) >= 2:
        return _selftest(argv[1])
    if argv and argv[0] == "--guicheck" and len(argv) >= 2:
        return _guicheck(argv[1])
    if argv and argv[0] == "--launchtest" and len(argv) >= 3:
        project = argv[3] if len(argv) >= 4 else None
        return _launchtest(argv[1], argv[2], project)

    # Default: launch the GUI.
    from launcher.main_window import run
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
