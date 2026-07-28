"""DynaX Studio → Blender bootstrap.

Passed to Blender by the launcher as `--python bootstrap.py`. Its ONLY job is to
put the DynaX add-on into the requested workflow by setting its two routing
properties and two UI-only Studio session markers, once the add-on has finished
its deferred (timer-based) startup registration. It:

  * reads a versioned payload (with DYNAX_STUDIO_WORKFLOW fallback),
  * waits until the production `Scene.dynax_props` property group exists,
  * sets `dynax_props.dynax_mode` (+ `Scene.parafly_device_type`),
  * optionally writes a small JSON marker (DYNAX_STUDIO_MARKER) for the launcher
    / automated tests to confirm success.

It NEVER edits the add-on, runs no destructive operators, and touches no
clinical code. It is intentionally self-contained (no import of the launcher
package) because it runs inside Blender's own Python interpreter.
"""

import json
import os
import time

import bpy

try:
    import blf
except ImportError:  # pragma: no cover - permits pure-Python contract tests
    blf = None

try:
    import addon_utils
except Exception:  # pragma: no cover - addon_utils always exists in Blender
    addon_utils = None


# INLINE copy of launcher/workflows.py's mapping (workflow -> (dynax_mode,
# device)). Kept in sync by tests/test_sprint0.py::test_workflow_maps_in_sync.
WORKFLOW_MODE_MAP = {
    "parafly_afo": ("PARAFORGE_ZONES", "AFO"),
    "paralink_tt": ("PARAFORGE_ZONES", "TT"),
    "parafly_tlso": ("PARAFORGE_ZONES", "TLSO"),
    "creator": ("CREATOR", None),
    "paraform": ("PARAFORGE", None),
    "open_project": (None, None),
}

LAUNCH_PAYLOAD_VERSION = 1

POLL_INTERVAL = 0.25     # seconds between attempts in GUI mode
POLL_TIMEOUT = 30.0      # give the add-on's startup timer plenty of time
_elapsed = 0.0

TAB_HINT_DURATION = 8.0
TAB_HINT_GRACE_PERIOD = 0.25
TAB_HINT_SCENE_KEY = "dynax_studio_tab_hint_shown"
_OperatorBase = getattr(getattr(bpy, "types", None), "Operator", object)


class DYNAXSTUDIO_OT_tab_hint(_OperatorBase):
    """Temporary viewport hint used when Blender cannot select an N-panel tab."""

    bl_idname = "dynax_studio.tab_hint"
    bl_label = "DynaX Studio Tab Hint"
    bl_options = {'INTERNAL'}

    _draw_handle = None
    _event_timer = None
    _started_at = 0.0

    @staticmethod
    def _draw():
        if blf is None:
            return
        region = getattr(bpy.context, "region", None)
        if region is None:
            return
        message = "Click the DynaX tab in the sidebar to begin \u2192"
        font_id = 0
        blf.size(font_id, 18)
        blf.color(font_id, 1.0, 1.0, 1.0, 1.0)
        blf.enable(font_id, blf.SHADOW)
        blf.shadow(font_id, 5, 0.0, 0.0, 0.0, 0.85)
        blf.shadow_offset(font_id, 2, -2)
        blf.position(font_id, max(24, region.width - 460), region.height * 0.5, 0)
        blf.draw(font_id, message)
        blf.disable(font_id, blf.SHADOW)

    def _finish(self, context):
        if self._draw_handle is not None:
            bpy.types.SpaceView3D.draw_handler_remove(self._draw_handle, 'WINDOW')
            self._draw_handle = None
        if self._event_timer is not None:
            context.window_manager.event_timer_remove(self._event_timer)
            self._event_timer = None
        scene = getattr(context, "scene", None)
        if scene is not None:
            scene[TAB_HINT_SCENE_KEY] = True
        for area in context.screen.areas if context.screen else ():
            if area.type == 'VIEW_3D':
                area.tag_redraw()

    def modal(self, context, event):
        elapsed = time.monotonic() - self._started_at
        if elapsed >= TAB_HINT_DURATION:
            self._finish(context)
            return {'FINISHED'}

        # Startup can emit synthetic mouse-motion events. Ignore those briefly,
        # then dismiss on any real navigation, pointer, or keyboard interaction.
        if event.type != 'TIMER' and (
            elapsed >= TAB_HINT_GRACE_PERIOD
            or event.type not in {'MOUSEMOVE', 'INBETWEEN_MOUSEMOVE'}
        ):
            self._finish(context)
            return {'FINISHED'}
        return {'PASS_THROUGH'}

    def invoke(self, context, _event):
        scene = getattr(context, "scene", None)
        if scene is None or scene.get(TAB_HINT_SCENE_KEY, False):
            return {'CANCELLED'}
        self._started_at = time.monotonic()
        self._draw_handle = bpy.types.SpaceView3D.draw_handler_add(
            self._draw, (), 'WINDOW', 'POST_PIXEL'
        )
        self._event_timer = context.window_manager.event_timer_add(
            0.1, window=context.window
        )
        context.window_manager.modal_handler_add(self)
        context.area.tag_redraw()
        return {'RUNNING_MODAL'}


def _marker_path():
    return os.environ.get("DYNAX_STUDIO_MARKER") or None


def _read_launch_request():
    """Return ``(workflow, error)`` from the versioned or legacy contract."""
    raw_payload = os.environ.get("DYNAX_STUDIO_PAYLOAD")
    legacy_workflow = os.environ.get("DYNAX_STUDIO_WORKFLOW")
    if not raw_payload:
        return legacy_workflow, None
    try:
        payload = json.loads(raw_payload)
    except (TypeError, ValueError):
        return None, "invalid_payload"
    if not isinstance(payload, dict):
        return None, "invalid_payload"
    if payload.get("version") != LAUNCH_PAYLOAD_VERSION:
        return None, "unsupported_payload_version"
    workflow = payload.get("workflow")
    if not isinstance(workflow, str):
        return None, "invalid_payload"
    if legacy_workflow and legacy_workflow != workflow:
        return None, "workflow_mismatch"
    expected = WORKFLOW_MODE_MAP.get(workflow)
    if expected is not None:
        if (payload.get("mode"), payload.get("device")) != expected:
            return None, "workflow_metadata_mismatch"
    return workflow, None


def _write_marker(ok, **extra):
    path = _marker_path()
    if not path:
        return
    payload = {"ok": bool(ok)}
    payload.update(extra)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
    except OSError as exc:
        print(f"[DynaX Studio] Could not write marker {path}: {exc}")


def _ensure_addon_enabled():
    """Enable the installed DynaX add-on for this session (no prefs saved).

    Idempotent and non-destructive: if it is already enabled this is a no-op.
    Needed for the bundled Blender, whose fresh per-user profile has no saved
    preference enabling the add-on — without this, an existing-project launch
    (which uses no application template) would never see `dynax_props`. Enabling
    runs the add-on's own registration only; it touches no scene geometry."""
    if addon_utils is None:
        return
    if "dynax_addon" in bpy.context.preferences.addons:
        return
    try:
        addon_utils.enable("dynax_addon", default_set=False, persistent=False)
    except Exception as exc:  # noqa: BLE001 - never let enabling abort the launch
        print(f"[DynaX Studio] Could not enable DynaX add-on: {exc}")


def _not_ready_reason(workflow):
    """Return the specific production-registration dependency still missing."""
    scene = getattr(bpy.context, "scene", None)
    if scene is None:
        return "scene_unavailable"
    props = getattr(scene, "dynax_props", None)
    if props is None or not hasattr(props, "dynax_mode"):
        return "dynax_props_unavailable"
    _mode, device = WORKFLOW_MODE_MAP.get(workflow, (None, None))
    if device is not None and not hasattr(scene, "parafly_device_type"):
        return "parafly_device_property_unavailable"
    return None


def _view3d_contexts():
    """Yield usable window/screen/area/space/UI-region tuples."""
    window_manager = getattr(bpy.context, "window_manager", None)
    for window in getattr(window_manager, "windows", ()):
        screen = window.screen
        for area in screen.areas:
            if area.type != 'VIEW_3D':
                continue
            space = area.spaces.active
            region = next((item for item in area.regions if item.type == 'UI'), None)
            window_region = next(
                (item for item in area.regions if item.type == 'WINDOW'), None
            )
            if space and region and window_region:
                yield window, screen, area, space, region, window_region


def _try_activate_dynax_sidebar():
    """Try Blender's context operator and verify that it really selected DynaX."""
    attempted = False
    for window, screen, area, space, region, _window_region in _view3d_contexts():
        space.show_region_ui = True
        attempted = True
        try:
            with bpy.context.temp_override(
                window=window, screen=screen, area=area,
                region=region, space_data=space,
            ):
                result = bpy.ops.wm.context_set_string(
                    data_path="space_data.context", value="DynaX"
                )
        except (AttributeError, RuntimeError, TypeError) as exc:
            print(f"[DynaX Studio] Sidebar category API unavailable: {exc}")
            continue

        # SpaceView3D does not currently publish its active N-panel category as
        # RNA. Never report success solely because an operator returned FINISHED.
        if 'FINISHED' in result and getattr(space, "context", None) == "DynaX":
            return True
    if not attempted:
        print("[DynaX Studio] No interactive 3D viewport available for sidebar setup.")
    return False


def _show_tab_hint_once():
    """Start the bounded viewport hint, returning whether it was scheduled."""
    scene = getattr(bpy.context, "scene", None)
    if scene is None or scene.get(TAB_HINT_SCENE_KEY, False):
        return False
    if not hasattr(bpy.types, DYNAXSTUDIO_OT_tab_hint.__name__):
        bpy.utils.register_class(DYNAXSTUDIO_OT_tab_hint)
    for window, screen, area, space, _ui_region, window_region in _view3d_contexts():
        try:
            with bpy.context.temp_override(
                window=window, screen=screen, area=area,
                region=window_region, space_data=space,
            ):
                result = bpy.ops.dynax_studio.tab_hint('INVOKE_DEFAULT')
            return 'RUNNING_MODAL' in result
        except (AttributeError, RuntimeError, TypeError) as exc:
            print(f"[DynaX Studio] Could not show sidebar hint: {exc}")
    return False


def _prepare_sidebar_ui(scene):
    """Open the sidebar and either select DynaX or show the first-use hint."""
    if bpy.app.background:
        return "background"
    if scene.get(TAB_HINT_SCENE_KEY, False):
        return "already_dismissed"
    if _try_activate_dynax_sidebar():
        scene[TAB_HINT_SCENE_KEY] = True
        print("[DynaX Studio] DynaX sidebar category activated.")
        return "activated"
    if _show_tab_hint_once():
        print("[DynaX Studio] Showing one-time DynaX sidebar hint.")
        return "hint"
    print("[DynaX Studio] DynaX sidebar is open; tab selection remains manual.")
    return "manual"


def _apply_once(workflow):
    """Try to apply the workflow. Returns True on success, False if the add-on
    isn't ready yet (scene / property missing)."""
    if _not_ready_reason(workflow) is not None:
        return False

    scene = bpy.context.scene
    props = scene.dynax_props
    mode, device = WORKFLOW_MODE_MAP.get(workflow, (None, None))
    if mode is not None:
        props.dynax_mode = mode
    if device is not None:
        scene.parafly_device_type = device

    # Session identity is UI-only. It lets the add-on defer workflow selection
    # to Studio while leaving normal standalone Blender sessions unchanged.
    scene["dynax_studio_session"] = True
    scene["dynax_studio_workflow"] = workflow
    sidebar_ui = _prepare_sidebar_ui(scene)

    actual_mode = props.dynax_mode
    actual_device = getattr(scene, "parafly_device_type", None)
    print(
        f"[DynaX Studio] Workflow '{workflow}' -> "
        f"dynax_props.dynax_mode={actual_mode} device={actual_device}"
    )
    _write_marker(
        True, workflow=workflow, dynax_mode=actual_mode,
        device=actual_device if device is not None else None,
        studio_session=bool(scene.get("dynax_studio_session", False)),
        studio_workflow=scene.get("dynax_studio_workflow"),
        sidebar_ui=sidebar_ui,
    )
    return True


def _poll(workflow):
    """bpy.app.timers callback for GUI mode: retry until the add-on is ready or
    we time out. Returning None unregisters the timer; a float re-schedules it."""
    global _elapsed
    if _apply_once(workflow):
        return None
    _elapsed += POLL_INTERVAL
    if _elapsed >= POLL_TIMEOUT:
        print("[DynaX Studio] Timed out waiting for the DynaX add-on to load.")
        _write_marker(False, workflow=workflow, reason=_not_ready_reason(workflow))
        return None
    return POLL_INTERVAL


def main():
    workflow, request_error = _read_launch_request()
    if request_error:
        print(f"[DynaX Studio] Invalid launch request: {request_error}.")
        _write_marker(False, workflow=workflow, reason=request_error)
        return
    if not workflow:
        print("[DynaX Studio] No launch workflow set; nothing to do.")
        return
    if workflow not in WORKFLOW_MODE_MAP:
        print(f"[DynaX Studio] Unknown workflow '{workflow}'.")
        _write_marker(False, workflow=workflow, reason="unknown_workflow")
        return

    # Make sure the add-on is enabled (bundled Blender's fresh profile has no
    # saved preference for it). Harmless when it is already enabled.
    _ensure_addon_enabled()

    # Background mode (tests / headless) has no interactive event loop, so timers
    # don't fire — apply synchronously instead. The add-on (or a test's stand-in)
    # must already have registered the scene properties in this case.
    if bpy.app.background:
        if not _apply_once(workflow):
            _write_marker(
                False, workflow=workflow,
                reason=_not_ready_reason(workflow),
            )
        return

    # GUI mode: the add-on registers behind a startup timer, so poll until ready.
    bpy.app.timers.register(lambda: _poll(workflow), first_interval=POLL_INTERVAL)


main()
