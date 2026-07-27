# DynaX Studio → single Go backend: what shipped + the ecosystem plan

This covers (1) the Studio analytics/telemetry backend now ported into your one Go
backend, (2) exactly how to deploy it on the existing Supabase + Render setup, and
(3) an honest feasibility plan for the "one DynaX ecosystem" vision.

The web frontend was **not touched**. Everything here is additive and isolated in a
new `internal/studio` package. I compiled the whole backend to a binary here — it
builds clean (`go build ./cmd/server` → exit 0), `go vet` clean, `gofmt` clean, and
`go.mod`/`go.sum` are byte-identical to your last release.

---

## 1. What the Python backend was, and what I ported

The uploaded Python service was the **DynaX Studio telemetry + release service** —
separate from the clinical platform. It has three surfaces. I ported the two the
desktop app actually calls, plus admin token provisioning:

| Surface | Endpoint | Auth | Status |
|---|---|---|---|
| Event ingestion | `POST /api/v1/events` | Studio bearer token `<uuid>.<secret>` | **Ported** |
| Release manifest | `GET /api/v1/releases/current` | public | **Ported** |
| Issue/list/revoke tokens | `POST/GET /api/v1/studio/tokens`, `POST …/{id}/revoke` | DynaX **admin JWT** | **Ported** |
| Analytics dashboard queries | overview / installations / versions / errors | DynaX admin JWT | **Next slice** (see §6) |

I matched the desktop contract exactly (confirmed against your uploaded
`analytics_sync.py` and `update_checker.py`):

- `/events` takes a **JSON array**, `Authorization: Bearer <token>`, and returns a
  **top-level** `{"accepted": N, "rejected": M}` where `accepted + rejected` equals
  the number of events sent (the launcher rejects any other shape).
- `/releases/current` returns a **top-level** object with `product: "dynax-studio"`,
  `version`, `download_url`, `release_notes_url` (the launcher validates `product`
  and reads `version`/`download_url` directly).

All the strict rules carried over: token binds to one install on first use and is
locked after; environment (production/development/test) is decided by the token,
never the client; batches ≤ 500, single install per batch; closed vocabulary of
event types/workflows/platforms/values; identifier regex; duration/age/skew bounds;
idempotent insert (`ON CONFLICT (event_id) DO NOTHING`).

---

## 2. Deploy on the existing Supabase + Render

**Step 1 — run the migration** (Supabase SQL editor or your migration runner):

```
migrations/012_studio_analytics.sql
```

It creates `studio_ingestion_tokens` and `studio_events` (prefixed `studio_` so they
never collide with clinical tables) plus the indexes. It is idempotent and safe to
run on the live database.

**Step 2 — set env vars** on Render (release manifest + reference signing):

| Variable | Example | Notes |
|---|---|---|
| `DYNAX_CURRENT_RELEASE_VERSION` | `1.20.12` | The version the update-check advertises. |
| `DYNAX_MINIMUM_SUPPORTED_VERSION` | `1.20.0` | Optional. |
| `DYNAX_RELEASE_DOWNLOAD_URL` | `https://github.com/<org>/dynax-studio/releases/latest` | Must be HTTPS. |
| `DYNAX_RELEASE_NOTES_URL` | `https://github.com/<org>/dynax-studio/releases` | Optional, HTTPS. |
| `DYNAX_RELEASE_PUBLISHED_AT` | `2026-07-01T00:00:00Z` | Optional. |
| `STUDIO_REFERENCE_SECRET` | (48+ random chars) | Optional; used to sign installation references for the analytics slice. Falls back to `JWT_SECRET` if unset. |

**Step 3 — regenerate Swagger** so the new endpoints show in `/swagger`:

```
make swagger    # runs: swag init -g cmd/server/main.go --output docs/swagger --parseDependency --parseInternal
```

The handlers already carry `@Summary` annotations; your build environment has proxy
access, so this folds them into the existing spec. (I couldn't run `swag init` in my
sandbox — the module proxy is blocked here — but the annotations are in the code.)

**Step 4 — issue a token** for a clinic (as a DynaX admin):

```
POST /api/v1/studio/tokens   { "environment": "production", "label": "Clinic Name" }
→ { "token": "<uuid>.<secret>", ... }   # shown once, store it now
```

The clinic pastes that token into **DynaX Studio → Settings → Analytics → Ingestion
token**, and sets **Backend URL** to `https://dynax.app` (or your API host). That's
it — the desktop app now reports to the single backend and checks it for updates.

---

## 3. GitHub-driven versioning + "new version available"

The update flow you want already works through the release manifest — no separate
update server:

1. You build the Studio installer with a **GitHub Actions** workflow on a tag
   (e.g. `v1.20.13`) and attach the installer to a **GitHub Release**.
2. You bump `DYNAX_CURRENT_RELEASE_VERSION` to `1.20.13` and point
   `DYNAX_RELEASE_DOWNLOAD_URL` at the release asset.
3. On next launch the desktop app calls `/releases/current`, sees a newer version,
   and shows its amber "update available" banner with a download link. It never
   auto-installs — the user clicks through (matches the app's current behaviour).

If you'd rather not touch an env var per release, the **next slice** can make
`/releases/current` read GitHub's "latest release" API directly, so cutting a GitHub
Release is the *only* step. Tell me the repo and I'll wire that.

**"Can I use an existing GitHub repo or must I create a new one?"** — Either works. A
**separate repo for DynaX Studio** (desktop app + installer) is cleaner: its release
tags and version numbers are independent of the web platform, and the Actions
workflow that builds the `.exe` lives next to the code it builds. You can keep it in
your existing org/account — no new account needed, just a new repo. Use the web
platform's repo only if you want a single monorepo; then tag Studio releases with a
prefix like `studio-v1.20.13` to keep them distinct.

---

## 4. Desktop app packaging / scaling note

The launcher is PySide6 packaged with the `dynax_studio.spec` (PyInstaller). "Scaling
properly" on high-DPI Windows is a Qt setting, not a backend concern — set
`QT_ENABLE_HIGHDPI_SCALING=1` / `AA_EnableHighDpiScaling` and ship the icon at
multiple sizes. I did **not** use any logo from `docs.zip`; keep using the existing
DynaX logo you already ship on the web. When we do the Studio download page
(`studio.dynax.app`), I'll reuse that same asset.

---

## 5. The one-ecosystem vision — what's possible

Your instinct is right and it's very achievable. Here's the shape:

**dynax.app as the single identity.** You already have accounts + JWT in the Go
backend. "Sign in with DynaX" for Scanner and Studio means adding a small **OAuth-style
authorization flow** to the existing backend:

- Scanner (`scanner.dynax.app`, a web app) is the easy case: a standard
  authorization-code flow against dynax.app. The P&O signs in once; Scanner gets a
  scoped token; no second account.
- Studio (desktop) uses the same flow via the system browser + a **loopback redirect**
  (the OAuth "native app" pattern): Studio opens `dynax.app/authorize`, the user logs
  in, the browser redirects to `http://127.0.0.1:<port>` which Studio is listening on,
  and Studio stores the token (in DPAPI, where the ingestion token already lives).
  This *replaces* the manual ingestion-token paste with a real sign-in — a genuinely
  new capability the current app doesn't have yet, but a well-trodden pattern.

**3D Workspace as the control centre.** The P&O dashboard's 3D Workspace becomes the
hub. Backend-wise this is a new resource — **3D cases** — linking user + patient +
scans + design versions + exports. Then:

- **Take a Scan** → open `scanner.dynax.app/scan?case=<id>` with the case pre-linked;
  Scanner uploads the finished scan back to that case (a new
  `POST /api/v1/cases/{id}/scans` on this same backend).
- **Open in DynaX Studio** → a **deep link** like `dynax-studio://open?case=<id>`.
  If Studio is installed, the OS launches it and it pulls the case + scan from the
  backend; if not, the link falls back to `studio.dynax.app` to download. On publish,
  Studio uploads the design/export back to the case, which appears in the Workspace.

**Subdomains** — all three are straightforward with your DNS + hosting:
`dynax.app` (Virtual Clinic), `scanner.dynax.app` (Scanner), `studio.dynax.app`
(Studio download/landing). One backend serves the API for all of them; CORS already
exists in the Go backend and just needs the new origins added.

**Suggested build order** (each is a self-contained slice I can do without disturbing
what's live):

1. ✅ Studio telemetry + releases in the single backend — **done, this delivery.**
2. Analytics dashboard JSON endpoints (§6) + a small admin analytics view.
3. GitHub-native releases endpoint (cut a Release = done).
4. "Sign in with DynaX" (authorization-code + loopback for desktop).
5. 3D cases resource + Scanner ↔ case ↔ Studio sync + deep-linking.

None of steps 2–5 require reworking step 1, and none touch the clinical web frontend
except additive UI.

---

## 6. Deferred: analytics dashboard queries

I deliberately held the five analytics query endpoints (overview, installations,
installation detail, version adoption, error trends) for the next slice, because:

- their consumer is an **analytics dashboard UI you haven't sent yet**, so the exact
  response shapes should match that UI rather than be guessed; and
- they're the heaviest SQL (CTEs, `DISTINCT ON`, `FILTER`, `ARRAY_AGG`) and deserve
  their own careful, verified pass rather than being rushed alongside ingestion.

The logic is fully understood and the helper functions it needs (version state,
signed installation reference, short id, semver) are **already ported** in
`internal/studio/token.go`, ready to reuse. Say the word (and send the dashboard UI
if you have one) and I'll add them the same way — compiled and verified.
