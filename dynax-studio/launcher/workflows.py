"""Canonical launcher-workflow definitions.

This is the single source of truth for how each launcher button maps onto the
DynaX add-on's two scene properties:

    scene.dynax_props.dynax_mode
                               NONE | NEW_CASE | PARAFORGE_MENU | CREATOR
                               | PARAFORGE (=ParaForm) | PARAFORGE_ZONES (=ParaFly)
    scene.parafly_device_type  TT | TLSO | AFO

`scripts/bootstrap.py` runs inside Blender's own Python (a different
interpreter) and keeps an INLINE copy of this same mapping so it never has to
import this package. `tests/test_sprint0.py::test_workflow_maps_in_sync` asserts
the two copies never drift apart.
"""

from __future__ import annotations

from dataclasses import dataclass


LAUNCH_PAYLOAD_VERSION = 1


@dataclass(frozen=True)
class Workflow:
    key: str                 # stable id passed around + written to logs/env
    label: str               # button text
    dynax_mode: str | None   # scene.dynax_props.dynax_mode target
    device: str | None       # scene.parafly_device_type target (None = n/a)
    requires_project: bool    # must a .blend be chosen before launching?


WORKFLOWS: dict[str, Workflow] = {
    "parafly_afo": Workflow(
        "parafly_afo", "New AFO Project", "PARAFORGE_ZONES", "AFO", False),
    "paralink_tt": Workflow(
        "paralink_tt", "New TT Project", "PARAFORGE_ZONES", "TT", False),
    "parafly_tlso": Workflow(
        "parafly_tlso", "New TLSO Project", "PARAFORGE_ZONES", "TLSO", False),
    "creator": Workflow(
        "creator", "New Creator Project", "CREATOR", None, False),
    "paraform": Workflow(
        "paraform", "New ParaForm Project", "PARAFORGE", None, False),
    "open_project": Workflow(
        "open_project", "Open Existing Project", None, None, True),
}


# Product-facing metadata for new clinical projects. The stable workflow keys
# and their existing mode/device behavior remain authoritative in WORKFLOWS.
WORKFLOW_METADATA = {
    "creator":      {"display": "Creator",   "mode": "CREATOR",         "device": None},
    "paraform":     {"display": "ParaForm",  "mode": "PARAFORGE",       "device": None},
    "parafly_afo":  {"display": "AFO",       "mode": "PARAFORGE_ZONES", "device": "AFO"},
    "paralink_tt":  {"display": "TT Socket", "mode": "PARAFORGE_ZONES", "device": "TT"},
    "parafly_tlso": {"display": "TLSO",      "mode": "PARAFORGE_ZONES", "device": "TLSO"},
}


def build_launch_payload(key: str) -> dict[str, object]:
    """Build the versioned Studio-to-Blender handoff payload."""
    workflow = get_workflow(key)
    metadata = WORKFLOW_METADATA.get(key)
    return {
        "version": LAUNCH_PAYLOAD_VERSION,
        "workflow": workflow.key,
        "display": metadata["display"] if metadata else workflow.label,
        "mode": workflow.dynax_mode,
        "device": workflow.device,
    }


# Plain-dict projection (mode, device) used by the sync test to compare against
# bootstrap.py's inline copy without importing the dataclass there.
def workflow_mode_map() -> dict[str, tuple[str | None, str | None]]:
    return {k: (w.dynax_mode, w.device) for k, w in WORKFLOWS.items()}


def get_workflow(key: str) -> Workflow:
    try:
        return WORKFLOWS[key]
    except KeyError:
        raise ValueError(f"Unknown workflow: {key!r}") from None
