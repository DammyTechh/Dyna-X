# DynaX API — Endpoint Reference

> **Base URL:** `https://api.dynalimb.com/api/v1`  
> **Swagger UI:** `GET /swagger/index.html`  
> **Auth scheme:** `Authorization: Bearer <JWT>`

---

## Auth (`/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | ❌ | Register new user (patient or professional) |
| `POST` | `/auth/login` | ❌ | Login — returns access + refresh tokens |
| `POST` | `/auth/refresh` | ❌ | Refresh access token |
| `POST` | `/auth/forgot-password` | ❌ | Request password reset email (Resend) |
| `POST` | `/auth/reset-password` | ❌ | Reset password via token |
| `GET` | `/auth/me` | ✅ | Get current authenticated user |
| `POST` | `/auth/logout` | ✅ | Invalidate session |
| `POST` | `/auth/change-password` | ✅ | Change password (requires current) |

### Register payload
```json
{
  "email": "patient@example.com",
  "password": "Str0ngP@ss!",
  "full_name": "Daniel Okeke",
  "role": "patient"  // patient | physiotherapist | prosthetist | orthotist | occupational_therapist | speech_therapist | mental_health_clinician
}
```

### Auth response
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 86400,
  "token_type": "Bearer",
  "user": { "id": "...", "email": "...", "role": "patient" }
}
```

---

## Patient (`/patient`) — Role: `patient`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/patient/profile` | Get own profile |
| `PATCH` | `/patient/profile` | Update own profile |
| `POST` | `/patient/connect` | Connect to professional via PIN |
| `DELETE` | `/patient/connect/:professional_id` | Disconnect from professional |
| `GET` | `/patient/professionals` | List connected professionals |
| `GET` | `/patient/appointments` | List appointments |
| `GET` | `/patient/sessions` | List session history |
| `GET` | `/patient/care-plans` | List care plans |
| `GET` | `/patient/rehab-history` | Rehabilitation progress history |

### Connect via PIN payload
```json
{
  "professional_code": "DX-AB12-CD34"
}
```

---

## Professional (`/professional`) — Roles: any professional

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/professional/profile` | Get own professional profile |
| `PATCH` | `/professional/profile` | Update own profile |
| `POST` | `/professional/generate-code` | Generate/refresh personal PIN |
| `GET` | `/professional/patients` | List connected patients |
| `GET` | `/professional/patients/:patient_id` | Get patient detail |
| `GET` | `/professional/appointments` | List appointments |
| `POST` | `/professional/appointments` | Create appointment |
| `PATCH` | `/professional/appointments/:appointment_id` | Update appointment |
| `POST` | `/professional/appointments/:appointment_id/cancel` | Cancel appointment |
| `GET` | `/professional/sessions` | List session logs |
| `POST` | `/professional/sessions` | Log a new session |
| `GET` | `/professional/sessions/:session_id` | Get session detail |

### Create appointment payload
```json
{
  "patient_id": "uuid",
  "title": "Initial Assessment",
  "description": "First physiotherapy assessment session",
  "scheduled_at": "2026-06-01T10:00:00Z",
  "duration_minutes": 60,
  "session_type": "virtual",
  "meeting_url": "https://meet.example.com/xyz"
}
```

### Create session (SOAP) payload
```json
{
  "patient_id": "uuid",
  "appointment_id": "uuid",
  "session_date": "2026-06-01T10:00:00Z",
  "duration_minutes": 55,
  "session_type": "virtual",
  "subjective_note": "Patient reports reduced pain in left knee.",
  "objective_note": "ROM improved by 15°. Gait pattern more stable.",
  "assessment_note": "Good progress. On track with rehabilitation goals.",
  "plan_note": "Continue current exercise program. Review in 2 weeks."
}
```

---

## Mini EMR (`/emr`) — Roles: professionals + admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/emr/notes` | Create clinical note |
| `GET` | `/emr/notes?patient_id=uuid` | List notes for patient |
| `GET` | `/emr/notes/:note_id` | Get single note |
| `PATCH` | `/emr/notes/:note_id` | Update note content |
| `DELETE` | `/emr/notes/:note_id` | Delete note |
| `POST` | `/emr/care-plans` | Create care plan |
| `GET` | `/emr/care-plans?patient_id=uuid` | List care plans for patient |
| `PATCH` | `/emr/care-plans/:plan_id` | Update care plan status/notes |
| `POST` | `/emr/devices` | Record device measurement (P&O) |
| `GET` | `/emr/devices?patient_id=uuid` | List device records |
| `PATCH` | `/emr/devices/:device_id/status` | Update device status |

### Note types: `soap | progress | assessment | referral | discharge`
### Device statuses: `draft | submitted | approved | fabricating | ready | delivered | revision_needed`

### Create note payload
```json
{
  "patient_id": "uuid",
  "session_id": "uuid",
  "note_type": "soap",
  "title": "Session 3 SOAP Note",
  "content": "S: Patient reports...\nO: Observations...\nA: Assessment...\nP: Plan...",
  "diagnosis_codes": ["M79.3"],
  "is_confidential": false
}
```

### Create care plan payload
```json
{
  "patient_id": "uuid",
  "title": "Lower Limb Rehabilitation Plan",
  "description": "12-week post-amputation rehabilitation",
  "goals": ["Restore gait pattern", "Build strength", "Reduce pain"],
  "start_date": "2026-06-01",
  "end_date": "2026-08-24"
}
```

---

## TheraPay (`/therapay`) — Flexible payment system

| Method | Endpoint | Auth roles | Description |
|--------|----------|-----------|-------------|
| `POST` | `/therapay/plans` | Professional | Create payment plan |
| `GET` | `/therapay/plans` | All | List own plans |
| `GET` | `/therapay/plans/:plan_id` | All | Get plan detail |
| `POST` | `/therapay/plans/:plan_id/payments` | Professional | Record payment |
| `POST` | `/therapay/plans/:plan_id/cancel` | Professional | Cancel plan |
| `GET` | `/therapay/balance/:patient_id` | All | Get patient balance |
| `POST` | `/therapay/apply` | Patient | Submit application |
| `GET` | `/therapay/applications` | Professional/Admin | List applications |

### Plan types: `session | bundle | subscription | installment`

### Create plan payload
```json
{
  "patient_id": "uuid",
  "plan_type": "installment",
  "total_amount": 120000,
  "sessions_total": 12,
  "installment_amount": 30000,
  "installment_interval": "monthly"
}
```

---

## Messaging (`/messages`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/messages/conversations` | List all conversations |
| `POST` | `/messages/conversations/:target_id` | Get or create conversation |
| `GET` | `/messages/conversations/:conversation_id/messages` | Get messages in conversation |
| `POST` | `/messages/conversations/:conversation_id/messages` | Send a message |
| `POST` | `/messages/conversations/:conversation_id/read` | Mark conversation as read |

---

## Notifications (`/notifications`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications` | List notifications |
| `GET` | `/notifications/unread-count` | Get unread count |
| `POST` | `/notifications/read-all` | Mark all as read |
| `POST` | `/notifications/:notification_id/read` | Mark single as read |
| `GET` | `/notifications/preferences` | Get preferences |
| `PATCH` | `/notifications/preferences` | Update preferences |

---

## AI Assistant (`/ai`)

| Method | Endpoint | Auth roles | Description |
|--------|----------|-----------|-------------|
| `POST` | `/ai/query` | All | Send message to DynaX AI |
| `GET` | `/ai/history` | All | Get conversation history |
| `GET` | `/ai/conversations/:conversation_id` | All | Get full thread |
| `DELETE` | `/ai/conversations/:conversation_id` | All | Delete thread |
| `POST` | `/ai/generate/soap-note` | Professional | AI-generate SOAP note |
| `POST` | `/ai/generate/care-plan/:patient_id` | Professional | AI care plan suggestion |

### Query payload
```json
{
  "input": "What exercises help with lower limb rehabilitation?",
  "conversation_id": "uuid (optional, for threading)",
  "context": "patient_id:uuid (optional)"
}
```

---

## Admin (`/admin`) — Role: `admin` only

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/stats` | Platform statistics |
| `GET` | `/admin/analytics?period=month` | Analytics by period |
| `GET` | `/admin/audit-logs` | Audit trail |
| `GET` | `/admin/users` | List all users |
| `POST` | `/admin/users/:user_id/deactivate` | Deactivate account |
| `POST` | `/admin/users/:user_id/reactivate` | Reactivate account |
| `GET` | `/admin/professionals?status=pending` | List professionals |
| `POST` | `/admin/professionals/:professional_id/approve` | Approve/reject professional |
| `GET` | `/admin/patients` | List all patients |
| `POST` | `/admin/assign` | Assign professional to patient |

### Approve professional payload
```json
{
  "is_approved": true,
  "notes": "Credentials verified. License number confirmed."
}
```

### Assign professional payload
```json
{
  "patient_id": "uuid",
  "professional_id": "uuid",
  "role": "physiotherapist"
}
```

---

## Standard Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": "must be a valid email address",
      "password": "must be at least 8 characters"
    }
  }
}
```

## Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `INVALID_PAYLOAD` | Malformed JSON |
| 400 | `VALIDATION_ERROR` | Validation failed |
| 400 | `MISSING_PARAM` | Required query param missing |
| 401 | `UNAUTHORIZED` | No/invalid token |
| 403 | `FORBIDDEN` | Insufficient role |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate resource |
| 422 | `UNPROCESSABLE` | Business rule violation |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

## Pagination Query Parameters

All list endpoints support:
- `page` (default: 1)
- `page_size` (default: 20, max: 100)
- `search` — full-text search where supported
- `sort_by` — field name
- `sort_dir` — `asc` or `desc` (default: `desc`)
