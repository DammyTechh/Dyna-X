# PyInstaller spec — DynaX Studio launcher (one-directory build).
#
# Bundles the PySide6 launcher plus the data files it needs at runtime:
#   scripts/               (bootstrap + workspace validation utilities)
#   templates/             (DynaX Studio Blender application template)
#   assets/logo.png        (window logo)
#   assets/dynax.ico       (window/exe icon)
#
# Output: builds/DynaX_Studio/DynaX Studio.exe  (windowed, no console).
# Portable Blender is distributed beside this PyInstaller output under
# `bundled/`; it is intentionally not embedded inside the launcher archive.

import os

ROOT = os.path.abspath(os.path.join(SPECPATH, os.pardir))   # dynax_studio/

datas = [
    (os.path.join(ROOT, "scripts"), "scripts"),
    (os.path.join(ROOT, "assets"), "assets"),
]

# The Blender application template ships in the full Studio project. It is bundled
# automatically when present; a launcher-only build (to test the UI, update banner
# and analytics) succeeds without it, but launching the Blender workspace requires
# it to be added under dynax-studio/templates/.
_templates = os.path.join(ROOT, "templates")
if os.path.isdir(_templates):
    datas.append((_templates, "templates"))

# Trim clearly-unused heavy Qt modules to keep the build lean (we only use
# QtCore/QtGui/QtWidgets). Excluding the Python submodules stops the PySide6
# hook from dragging their large native libraries in.
excludes = [
    "PySide6.QtWebEngineCore", "PySide6.QtWebEngineWidgets", "PySide6.QtWebEngineQuick",
    "PySide6.QtQuick", "PySide6.QtQml", "PySide6.QtQuick3D",
    "PySide6.Qt3DCore", "PySide6.Qt3DRender", "PySide6.Qt3DExtras",
    "PySide6.QtMultimedia", "PySide6.QtMultimediaWidgets",
    "PySide6.QtCharts", "PySide6.QtDataVisualization",
    "PySide6.QtPdf", "PySide6.QtPdfWidgets", "PySide6.QtWebSockets",
    "PySide6.QtWebChannel", "PySide6.QtSql", "PySide6.QtTest",
    "PySide6.QtBluetooth", "PySide6.QtNfc", "PySide6.QtPositioning",
    "PySide6.QtSensors", "PySide6.QtSerialPort", "PySide6.QtDesigner",
    "tkinter", "numpy", "PIL",
]

a = Analysis(
    [os.path.join(ROOT, "launcher", "main.py")],
    pathex=[ROOT],
    binaries=[],
    datas=datas,
    # `packaging` is a pure-Python dep used for semantic version comparison in the
    # update banner; pin it explicitly so PyInstaller always embeds it.
    hiddenimports=["packaging.version"],
    hookspath=[],
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="DynaX Studio",
    debug=False,
    strip=False,
    upx=False,
    console=False,                      # windowed — no console window
    icon=os.path.join(ROOT, "assets", "dynax.ico"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="DynaX_Studio",               # output folder: builds/DynaX_Studio/
)
