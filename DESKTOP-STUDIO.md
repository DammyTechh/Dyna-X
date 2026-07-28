# DynaX Studio desktop — DPI scaling + GitHub version control

Two things landed here: (1) the launcher now scales crisply and stays responsive
on any desktop, and (2) a GitHub-driven build/release pipeline so pushing a version
tag produces a downloadable build and installed apps prompt users to update.

Everything was verified against real PySide6 6.11 using the launcher's own offscreen
`--guicheck` — the modified window builds identically to the original (same
navigation, icons, pages), with the scaling changes added on top.

---

## 1. Scaling & responsiveness

The launcher looked oversized/blurry on fractional-DPI displays because Qt was
rounding the OS scale factor. Fixes, all in `launcher/main_window.py` (+ one style
rule in `theme.py`):

- **Per-monitor DPI, pass-through rounding.** `run()` now sets
  `HighDpiScaleFactorRoundingPolicy.PassThrough` before the `QApplication` is
  created, so 125% / 150% / 175% displays render at the true scale — sharp text,
  correct proportions. (High-DPI scaling itself is always on in Qt 6.)
- **Adaptive first size.** Instead of a hard-coded 1200×760, the window opens at a
  comfortable fraction of the *available* screen (clamped to sensible min/max), so
  it fits a 1366×768 laptop and doesn't sprawl on a 4K panel. Minimum size lowered
  to 900×600.
- **Content scrolls instead of clipping.** The page area is wrapped in a resizable
  scroll area: when the window is large the pages fill it; when it's small the
  content scrolls rather than getting cut off. Background stays seamless.
- `setApplicationName` / `setApplicationVersion` are set for correct Windows
  taskbar grouping and version reporting.

Nothing about the workflow logic, Blender launching, or clinical code was touched.

---

## 2. Version control via GitHub

Two workflows were added under `.github/workflows/`.

### `release.yml` — build + publish on a tag

Trigger: push a tag like `v1.20.13`.

1. It reads `BUNDLED_ADDON_VERSION` from `launcher/blender_service.py` and **fails
   the build if the tag doesn't match** — so a forgotten version bump can never
   ship a mislabeled release.
2. Builds the launcher with PyInstaller (`packaging/dynax_studio.spec`) on a Windows
   runner.
3. Zips the output and creates a **GitHub Release** with the zip attached and
   auto-generated notes.

The release body prints the exact backend values to set (below).

### `ci.yml` — regression check on every push/PR

Runs the launcher's own headless `--selftest` and offscreen `--guicheck`, asserting
the window builds and navigation/icons still work. This is the same check I used to
verify the scaling changes; it catches UI regressions before they reach a release.

### Cutting a release, end to end

1. Bump the version in `launcher/blender_service.py`
   (`BUNDLED_ADDON_VERSION = (1, 20, 13)`) — this is the number update checks track.
2. `git commit`, then `git tag v1.20.13 && git push origin v1.20.13`.
3. The Actions build publishes the GitHub Release with the installable zip.
4. On the backend, set the release env vars so installed apps see the update:
   - `DYNAX_CURRENT_RELEASE_VERSION = 1.20.13`
   - `DYNAX_RELEASE_DOWNLOAD_URL = <release asset URL>`
   - `DYNAX_RELEASE_NOTES_URL = https://github.com/<org>/<repo>/releases/tag/v1.20.13`
5. Next time a user opens Studio, `update_checker` calls `/api/v1/releases/current`,
   sees the newer version, and shows the amber "update available" banner with a
   download button. It never auto-installs — the user clicks through.

### How the desktop side already works (no change needed)

The launcher was already wired for this: on launch it does one background HTTPS GET
to `/api/v1/releases/current`, compares the advertised version to the installed
`BUNDLED_ADDON_VERSION` using proper semantic-version ordering, and reveals the
banner only when a strictly newer version exists. "Never" dismisses a specific
version; "Remind me later" is per-session. The Backend URL / Update-service URL live
in **Settings** and should point at your API host (e.g. `https://dynax.app`).

### Repo choice

You don't need a new GitHub account — a **new repository in your existing org** for
DynaX Studio is the clean option so its release tags/versions stay independent of the
web platform. Put these two workflow files in that repo. (A monorepo also works; then
tag Studio releases with a distinct prefix.)

---

## 3. Building locally (optional)

```bash
pip install PySide6 packaging pyinstaller
pyinstaller --noconfirm --distpath builds --workpath build_work packaging/dynax_studio.spec
# → builds/DynaX_Studio/DynaX Studio.exe   (portable Blender goes beside it under bundled/)
```

---

## Notes

- I used **only the existing DynaX logo/icon** (`assets/dynax.ico`) 
- The zip here is the launcher subtree you provided (`launcher/`, `assets/`,
  `packaging/`, `scripts/`) plus the new `.github/workflows/`. Drop the workflows and
  the two edited files (`launcher/main_window.py`, `launcher/theme.py`) into your full
  repo, which also has `templates/` and the add-on the PyInstaller spec expects.
- The release workflow builds the launcher package. If your installable download is a
  larger bundle (launcher + portable Blender + add-on), add that assembly step before
  the "Package the build" step, or attach the finished installer to the same Release.
