# DynaX Frontend

> **Next.js 14 · TypeScript · Tailwind CSS · React Query · Three.js**  
> Rehabilitation & Prosthetic Care Platform — Web Interface

---

## Architecture Overview

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing / home
│   ├── layout.tsx                # Root layout (providers, fonts)
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx     # Role selector + registration
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── dashboard/
│   │   ├── admin/                # Admin: stats, users, professionals, analytics, audit
│   │   ├── patient/              # Patient: profile, appointments, sessions, care plans, payments
│   │   ├── professional/         # Professional: patients, appointments, sessions, notes, therapay
│   │   ├── messages/             # Real-time chat
│   │   ├── notifications/        # Notification centre
│   │   ├── ai/                   # AI assistant + SOAP generator
│   │   └── settings/             # Profile, security, notifications, privacy
│   ├── editor/                   # 3D model editor (Three.js, STL/OBJ/GLB)
│   └── share/[token]/            # Shared 3D model view with permission-based commenting
│
├── components/
│   ├── 3d/ModelViewer.tsx        # Three.js viewer (STLLoader, OBJLoader, GLTFLoader)
│   └── layout/
│       ├── DashboardLayout.tsx   # Collapsible sidebar, RBAC-aware nav
│       └── Providers.tsx         # React Query, Theme, Sonner
│
├── hooks/useApi.ts               # All React Query hooks for Go backend
├── lib/
│   ├── api.ts                    # Axios client + JWT interceptor + auto-refresh
│   ├── auth.ts                   # Auth service (login, logout, token management)
│   ├── routing.ts                # Role → dashboard route mapping
│   └── utils.ts                  # cn(), formatCurrency(), initials()
├── store/auth.ts                 # Zustand: user state + notification count
├── styles/globals.css            # Tailwind + CSS variables (DynaX design system)
└── types/index.ts                # All TypeScript types matching Go backend models
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to your Go backend (default: http://localhost:8080/api/v1)

# 3. Start development server
npm run dev
# → http://localhost:3000

# 4. Build for production
npm run build
npm start
```

---

## Key Features

### Authentication & Role-Based Access
- **8 roles** handled: admin, physiotherapist, prosthetist, orthotist, occupational_therapist, speech_therapist, mental_health_clinician, patient
- JWT tokens stored in localStorage + cookies (for SSR)
- Auto-refresh on 401 via Axios interceptor
- Role-to-dashboard routing via `getDashboardRoute(role)`

### Professional ↔ Patient PIN Connection System
1. Professional generates a DX-PIN from their dashboard
2. Professional can **email the PIN directly** to the patient via the backend (Resend)
3. Patient enters the PIN in their dashboard or during onboarding
4. Both parties are connected — professional appears in patient's care team

### 3D Model Editor (`/editor`)
- Loads **STL, OBJ, GLB/GLTF** files from local disk
- Three.js renderer with OrbitControls (rotate, zoom, pan)
- **Share system**: generates permission-scoped links (`view`, `comment`, `annotate`)
- Share page (`/share/[token]`) shows 3D viewer + comment thread
- Comments are sent back to the original sharer (professional)

### AI Assistant (`/dashboard/ai`)
- Chat interface with conversation threading
- Context-aware prompting by role (professional vs patient)
- **AI SOAP Note Generator** (professional only) — pre-fills SOAP fields from session observations

### TheraPay
- **4 plan types**: session, bundle, subscription, installment
- Progress bars showing payment completion
- Professionals create plans; patients view balances

---

## Design System

The frontend uses the **existing DynaX design system** colors extracted from the original codebase:

| Token | Value |
|-------|-------|
| `--primary` | `hsl(221, 83%, 53%)` — DynaX blue (#2563EB) |
| `--dynax-teal` | `#0D9488` |
| `--dynax-slate` | `#1E293B` |
| `dynax-gradient` | `linear-gradient(135deg, #1D4ED8, #0D9488)` |
| Font | Inter (body), Syne (display/headings) |
| Border radius | `--radius: 0.75rem` |

---

## API Integration

All API calls go through `src/lib/api.ts` which:
1. Attaches JWT `Authorization: Bearer <token>` header automatically
2. On 401 → silently refreshes token via `/auth/refresh`
3. On refresh failure → clears tokens and redirects to `/auth/login`

React Query hooks in `src/hooks/useApi.ts` cover every backend endpoint:

```ts
// Examples
useProfessionalProfile()       // GET /professional/profile
useMyPatients({ page: 1 })     // GET /professional/patients
useCreateSession()             // POST /professional/sessions
useConnectToProfessional()     // POST /patient/connect
useAIQuery()                   // POST /ai/query
useAdminStats()                // GET /admin/stats
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Go backend base URL |
| `NEXT_PUBLIC_APP_URL` | ✅ | Frontend URL (for share links) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | For direct storage uploads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key |

---

## Backend Sync Notes

These are the fixes already applied to the backend (from troubleshooting):

1. `db.go` → `internal/repository/db/db.go` (package path fix)
2. Router: wildcard renamed `:target_id` → `:conversation_id`
3. `AdminService.ListSessions` stub added to `services.go`
4. `docker-compose.yml` → postgres removed, only redis + api
5. Swagger generated via `swag init -g cmd/server/main.go -o docs/swagger`

---

## Deployment

### Vercel (Recommended)
```bash
# Set NEXT_PUBLIC_API_URL to your production Go backend
vercel deploy
```

### Docker
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```
