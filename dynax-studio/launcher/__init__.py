"""DynaX Studio launcher package.

The launcher is a branded front door that opens Blender straight into the
correct DynaX workflow. Blender remains the 3D engine; this package never
modifies the add-on or any clinical code.

Import layering (deliberate):
- `workflows`, `settings`, `blender_service`, `logging_setup` are pure stdlib
  and have NO PySide6 dependency, so they can be unit-tested headlessly.
- Only `main_window` / `main` import PySide6 (the actual GUI).
"""

STUDIO_VERSION = "0.1.0"
