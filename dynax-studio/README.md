# DynaX Studio — Frontend Source Bundle

This folder is a **self-contained copy of the DynaX Studio frontend codebase** (the PySide6
launcher), assembled for hand-off to a frontend developer. It is a *snapshot copy* of the live
source under `dynax_studio/` — the authoritative source still lives in the main tree; edit there,
not here, unless this bundle is being used as a standalone starting point.

For the full written explanation of this code (architecture, screens, workflows, theme, APIs), see
the companion document **`../dynax_studio_frontend.md`**.

- Launcher component version (`launcher/__init__.py` → `STUDIO_VERSION`): **0.1.0**
- Bundled add-on / distribution version referenced by the code: **1.20.12**

---

## What's in here

```
frontend_source/
├── launcher/                     # THE FRONTEND — PySide6 GUI + pure-stdlib services
│   ├── __init__.py               # STUDIO_VERSION = "0.1.0"
│   ├── main.py                   # Entry point + hidden --selftest / --guicheck / --launchtest modes
│   ├── main_window.py            # MainWindow + SettingsDialog + run()  (only real GUI file)
│   ├── theme.py                  # Color tokens + the whole Qt stylesheet (APP_STYLESHEET)
│   ├── workflows.py              # Canonical workflow table (key → mode/device). Source of truth.
│   ├── settings.py               # Persistent settings dataclass (AppData JSON). No patient data.
│   ├── blender_service.py        # Discover/validate/launch Blender; add-on install; build_command
│   ├── analytics_sync.py         # Non-blocking HTTPS sync of opt-in analytics files
│   ├── analytics_credentials.py  # DPAPI-encrypted ingestion-token store
│   ├── update_checker.py         # Non-blocking, read-only "is a newer release out?" check
│   ├── addon_installer.py        # Silent, non-downgrading add-on self-heal on every launch
│   ├── resources.py              # Resolve bundled paths in dev vs PyInstaller-frozen runs
│   ├── logging_setup.py          # get_logger / log_launch (paths redacted; filenames kept)
│   ├── pages/                    # Full-screen pages swapped in a QStackedWidget
│   │   ├── home_page.py          #   Home (Creator + ParaForge cards, Open, Settings)
│   │   ├── paraforge_page.py     #   ParaForge (ParaForm + ParaFly cards)
│   │   └── parafly_page.py       #   ParaFly (AFO + TT + TLSO cards)
│   └── widgets/                  # Reusable building blocks
│       ├── navigation.py         #   HeaderBar, BreadcrumbBar, NavigationBar
│       ├── sidebar.py            #   Sidebar + SidebarButton (left nav)
│       ├── footer.py             #   StatusFooter (Blender-ready dot + version)
│       ├── workflow_card.py      #   WorkflowCard (icon + description + one action button)
│       └── update_banner.py      #   UpdateBanner (amber "update available" strip)
├── scripts/
│   └── bootstrap.py              # Runs INSIDE Blender. Sets the workflow mode; UI-only markers.
├── assets/                       # logo.png, dynax.ico, icons/*.svg  (referenced by the UI)
│   ├── logo.png / dynax.ico
│   └── icons/ (home, creator, paraforge, paraform, parafly, afo, tt, tlso, back, forward, folder, settings)
└── packaging/
    └── dynax_studio.spec         # PyInstaller build spec
```

### Not included in this bundle (by design)

- `bundled/` — the large, git-ignored portable Blender + add-on payload. Not needed to *run* the
  launcher in dev; point Settings at a system Blender instead (see below). Regenerate per the main
  repo's `RELEASE_NOTES.md` only when building an installer.
- `templates/DynaX_Studio/` — the clinical workspace `.blend` template (installed at launch). It is
  a build/runtime data artifact, not frontend source; copy it from the main tree if you need to
  exercise a real new-project launch.
- `backend/`, `installer/`, `tests/` — separate components; see the main repo.

---

## Run it in development

```powershell
# from THIS folder's parent that contains `launcher/` on sys.path
python -m venv .venv
.venv\Scripts\python -m pip install PySide6==6.6.3 packaging

# launch the GUI
.venv\Scripts\python launcher\main.py
```

Without a bundled Blender present, open **Settings → Blender executable → Browse** and point at an
installed `blender.exe` (version 4.1 or newer). The footer dot turns green when Blender is ready.

Useful dev environment overrides:

| Env var | Effect |
|---|---|
| `DYNAX_STUDIO_CONFIG_DIR` | Redirect settings/analytics/token away from the real `%APPDATA%`. |
| `DYNAX_DEFAULT_BACKEND_URL` | Override the baked-in analytics/update backend URL. |
| `DYNAX_ANALYTICS_INGESTION_TOKEN` | Provide an analytics token without DPAPI. |

## Import layering (why the split matters)

`workflows`, `settings`, `blender_service`, `update_checker`, `analytics_sync`, `addon_installer`,
and `logging_setup` are **pure stdlib** (no PySide6) so they unit-test headlessly. Only
`main_window` and the `pages/` + `widgets/` it uses import PySide6.

## Hard constraints (keep these if you edit)

- Never run a launch as a shell string — every launch is a structured argv list with `shell=False`.
- Never hardcode usernames, drive letters, or dev-machine paths.
- Analytics stays optional, off-by-default, consent-gated, offline-safe, and unable to accept
  patient data. The ingestion token lives in DPAPI, never in `settings.json`.
- Do not add licensing, cloud storage, or auto-update without governance sign-off.
