# DynaX Backend API

> Rehabilitation & Prosthetic Care Platform — Go REST API  
> Built with **Gin** · **Supabase** · **pgx** · **Resend** · **Swagger**

---

## Architecture

```
dynax-backend/
├── cmd/
│   └── server/
│       └── main.go                 # entrypoint + Swagger annotations
│
├── internal/
│   ├── auth/
│   │   └── jwt.go                  # JWT token manager
│   ├── config/
│   │   └── config.go               # env-based configuration
│   ├── handlers/
│   │   ├── auth/handler.go         # /auth/** endpoints
│   │   ├── professional/handler.go # /professional/** endpoints
│   │   ├── patient/handler.go      # /patient/** endpoints
│   │   ├── emr/handler.go          # /emr/** (notes, care plans, devices)
│   │   ├── sessions/messaging.go   # /messages/** endpoints
│   │   ├── therapay/handler.go     # /therapay/** endpoints
│   │   ├── notifications/handler.go# /notifications/** endpoints
│   │   ├── ai/handler.go           # /ai/** endpoints
│   │   └── admin/handler.go        # /admin/** endpoints
│   ├── middleware/
│   │   └── middleware.go           # CORS, JWT, RBAC, rate-limit, logger
│   ├── models/
│   │   └── models.go               # all domain models + DTOs
│   ├── repository/
│   │   ├── db.go                   # pgx pool + helpers
│   │   ├── user_repository.go      # user CRUD
│   │   ├── professional_repository.go
│   │   └── appointment_repository.go
│   ├── server/
│   │   └── router.go               # route registration
│   └── services/
│       ├── services.go             # concrete service implementations (stubs)
│       └── email/email.go          # Resend email templates
│
├── docs/
│   └── swagger/
│       ├── doc.go                  # swagger package
│       └── ENDPOINTS.md            # full human-readable endpoint reference
│
├── migrations/
│   └── 001_dynax_complete_schema.sql  # SINGLE complete Supabase migration
│
├── pkg/
│   ├── logger/logger.go            # zerolog global logger
│   ├── response/response.go        # standard JSON response helpers
│   └── validator/validator.go      # go-playground/validator wrapper
│
├── .env.example                    # all required env vars
├── .air.toml                       # hot-reload (air)
├── docker-compose.yml              # postgres + redis + api
├── Dockerfile                      # scratch-based production image
├── Makefile                        # dev commands
└── go.mod
```

---

## Quick Start

### 1 — Clone & configure
```bash
cp .env.example .env
# Edit .env with your Supabase, Resend, and JWT values
```

### 2 — Run with Docker (recommended)
```bash
    # starts postgres + redis
make run           # starts API with hot-reload (requires air)
# OR
docker-compose up  # starts all services including the API
```

### 3 — Apply migration to Supabase
```bash
# Option A: Supabase SQL Editor — paste migrations/001_dynax_complete_schema.sql
# Option B: psql
make migrate
```

### 4 — Generate Swagger docs
```bash
make swagger
# Open: http://localhost:8080/swagger/index.html
```

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS enforced in production, HSTS headers |
| Authentication | JWT (HS256), access + refresh token pair |
| Authorization | Role-Based Access Control (RBAC) middleware |
| Data isolation | Supabase Row-Level Security (RLS) per table |
| Rate limiting | Per-IP token bucket (configurable RPS + burst) |
| Password storage | bcrypt (cost configurable, default: 12) |
| Token revocation | Redis blacklist (JWT TTL = remaining expiry) |
| Security headers | X-Frame-Options, X-XSS-Protection, CSP, HSTS |
| CORS | Allowlist-based, configurable per environment |

---

## Roles & Permissions

| Role | Access |
|------|--------|
| `admin` | Full platform access + user management + analytics |
| `physiotherapist` | Own patients, sessions, EMR, TheraPay |
| `prosthetist` | Own patients, P&O devices, sessions, TheraPay |
| `orthotist` | Own patients, P&O devices, sessions, TheraPay |
| `occupational_therapist` | Own patients, sessions, care plans, TheraPay |
| `speech_therapist` | Own patients, sessions, care plans, TheraPay |
| `mental_health_clinician` | Own patients, sessions, notes (confidential flag), TheraPay |
| `patient` | Own profile, connect via PIN, view appointments & plans |

---

## API Overview

| Group | Prefix | Auth |
|-------|--------|------|
| Authentication | `/api/v1/auth` | Mixed |
| Patient | `/api/v1/patient` | Patient only |
| Professional | `/api/v1/professional` | Professionals only |
| Mini EMR | `/api/v1/emr` | Professionals + Admin |
| TheraPay | `/api/v1/therapay` | Mixed |
| Messaging | `/api/v1/messages` | All |
| Notifications | `/api/v1/notifications` | All |
| AI Assistant | `/api/v1/ai` | All |
| Admin | `/api/v1/admin` | Admin only |

→ See `docs/swagger/ENDPOINTS.md` for the full endpoint reference.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `DATABASE_URL` | ✅ | Direct Postgres URL (pgx) |
| `JWT_SECRET` | ✅ | Min 32-char secret |
| `RESEND_API_KEY` | ✅ | Resend API key for emails |
| `REDIS_URL` | ✅ | Redis URL for rate-limiting |
| `OPENAI_API_KEY` | ⚠️ | Required for AI assistant |
| `APP_ENV` | ✅ | `development` or `production` |

---

## Database Migration

The **entire schema** lives in a single file:

```
migrations/001_dynax_complete_schema.sql
```

It contains (in order):
1. PostgreSQL extensions (`uuid-ossp`, `pgcrypto`, `pg_trgm`, `vector`)
2. Custom ENUM types (roles, statuses)
3. All 25+ tables
4. Indexes (B-tree + GIN for full-text)
5. Row-Level Security policies
6. Helper DB functions (`generate_personal_code`, `find_professional_by_code`, `get_platform_stats`)
7. `updated_at` triggers on all tables
8. Seed data (default admin user)

**Apply via Supabase SQL Editor** or `psql $DATABASE_URL -f migrations/001_dynax_complete_schema.sql`

---

## Implementing Services (Next Steps)

The `internal/services/services.go` file contains stub implementations with `// TODO:` comments.  
Replace each stub with real pgx queries using the repository layer:

```go
// Example: real Login implementation
func (s *AuthService) Login(req *models.LoginRequest) (*models.AuthResponse, error) {
    user, err := s.userRepo.FindByEmail(ctx, req.Email)
    if err != nil || user == nil {
        return nil, errors.New("invalid_credentials")
    }
    if !user.IsActive {
        return nil, errors.New("account_disabled")
    }
    if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
        return nil, errors.New("invalid_credentials")
    }
    tokens, _ := s.jwtMgr.Generate(user.ID, user.Email, user.Role)
    _ = s.userRepo.UpdateLastLogin(ctx, user.ID)
    return buildAuthResponse(tokens, *user), nil
}
```

---

## Available Make Commands

```bash
make run          # start with hot-reload
make build        # compile binary
make test         # run tests
make swagger      # regenerate Swagger docs
make lint         # run golangci-lint
make migrate      # apply DB migration
make docker-up    # start postgres + redis
make docker-build # build Docker image
make clean        # remove build artifacts
```

---

## Frontend (Next.js) — Coming Next

The Next.js frontend will consume this API.  
All routes, request shapes, and response formats are documented in:
- **Swagger UI:** `/swagger/index.html` (running backend)
- **Markdown reference:** `docs/swagger/ENDPOINTS.md`
