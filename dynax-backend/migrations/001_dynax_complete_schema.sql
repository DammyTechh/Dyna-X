-- =============================================================================
-- DynaX Platform — Complete Database Migration
-- Version  : 1.0.0
-- Date     : 2026-05-17
-- Platform : Supabase (PostgreSQL 15)
-- =============================================================================
-- Run order: Extensions → Types → Core tables → Domain tables → Indexes → RLS → Functions
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- for full-text search on names/emails
CREATE EXTENSION IF NOT EXISTS "vector";     -- for AI embeddings (pgvector)

-- ─── Custom Types ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin',
    'prosthetist',
    'orthotist',
    'physiotherapist',
    'occupational_therapist',
    'speech_therapist',
    'mental_health_clinician',
    'patient'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_type AS ENUM ('virtual', 'in_person');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE note_type AS ENUM ('soap', 'progress', 'assessment', 'referral', 'discharge');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE device_status AS ENUM ('draft', 'submitted', 'approved', 'fabricating', 'ready', 'delivered', 'revision_needed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_plan_type AS ENUM ('session', 'bundle', 'subscription', 'installment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('active', 'completed', 'overdue', 'cancelled', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE care_plan_status AS ENUM ('active', 'completed', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'appointment_reminder', 'appointment_cancelled', 'appointment_rescheduled',
    'session_logged', 'care_plan_updated', 'message_received',
    'payment_due', 'payment_received', 'professional_approved',
    'professional_rejected', 'patient_connected', 'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Mirrors Supabase auth.users; extended profile data is in user_profiles.
CREATE TABLE IF NOT EXISTS public.dynax_users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID        UNIQUE,                          -- links to auth.users.id
  email         TEXT        NOT NULL UNIQUE,
  role          user_role   NOT NULL DEFAULT 'patient',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  is_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User Profiles (common fields across all roles) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  full_name      TEXT        NOT NULL,
  phone_number   TEXT,
  avatar_url     TEXT,
  date_of_birth  DATE,
  gender         TEXT,
  address        TEXT,
  city           TEXT,
  country        TEXT        DEFAULT 'Nigeria',
  personal_code  TEXT        UNIQUE,                         -- BBM-style universal PIN
  language       TEXT        DEFAULT 'en',
  timezone       TEXT        DEFAULT 'Africa/Lagos',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit Logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  user_email  TEXT,
  user_role   TEXT,
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROFESSIONAL PROFILES
-- =============================================================================

-- ─── Physiotherapist Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.therapist_profiles (
  id                      UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID           NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  full_name               TEXT           NOT NULL,
  email                   TEXT,
  phone_number            TEXT,
  license_number          TEXT,
  license_type            TEXT,
  credentials             TEXT,
  specializations         TEXT[]         DEFAULT '{}',
  experience_years        INT,
  bio                     TEXT,
  clinic_name             TEXT,
  clinic_code             TEXT           UNIQUE,
  personal_code           TEXT           UNIQUE,
  session_rate            NUMERIC(10,2),
  virtual_sessions_enabled BOOLEAN       DEFAULT TRUE,
  in_person_sessions_enabled BOOLEAN     DEFAULT TRUE,
  availability_schedule   JSONB,
  languages_spoken        TEXT[]         DEFAULT '{}',
  insurance_accepted      TEXT[]         DEFAULT '{}',
  approval_status         approval_status DEFAULT 'pending',
  is_approved             BOOLEAN        DEFAULT FALSE,
  approved_at             TIMESTAMPTZ,
  approved_by             UUID           REFERENCES public.dynax_users(id),
  avatar_url              TEXT,
  has_completed_mobile_walkthrough BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── Prosthetist & Orthotist Profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.po_professional_profiles (
  id                      UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID           NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  full_name               TEXT           NOT NULL,
  email                   TEXT,
  phone_number            TEXT,
  professional_type       TEXT           NOT NULL CHECK (professional_type IN ('prosthetist', 'orthotist', 'both')),
  license_number          TEXT,
  license_type            TEXT,
  credentials             TEXT,
  specializations         TEXT[]         DEFAULT '{}',
  experience_years        INT,
  bio                     TEXT,
  clinic_name             TEXT,
  clinic_code             TEXT           UNIQUE,
  personal_code           TEXT           UNIQUE,
  session_rate            NUMERIC(10,2),
  virtual_sessions_enabled BOOLEAN       DEFAULT TRUE,
  in_person_sessions_enabled BOOLEAN     DEFAULT TRUE,
  availability_schedule   JSONB,
  approval_status         approval_status DEFAULT 'pending',
  is_approved             BOOLEAN        DEFAULT FALSE,
  approved_at             TIMESTAMPTZ,
  approved_by             UUID           REFERENCES public.dynax_users(id),
  avatar_url              TEXT,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── Occupational Therapist Profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.occupational_therapist_profiles (
  id                      UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID           NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  full_name               TEXT           NOT NULL,
  email                   TEXT,
  phone_number            TEXT,
  license_number          TEXT,
  specializations         TEXT[]         DEFAULT '{}',
  experience_years        INT,
  bio                     TEXT,
  clinic_name             TEXT,
  clinic_code             TEXT           UNIQUE,
  personal_code           TEXT           UNIQUE,
  session_rate            NUMERIC(10,2),
  virtual_sessions_enabled BOOLEAN       DEFAULT TRUE,
  in_person_sessions_enabled BOOLEAN     DEFAULT TRUE,
  approval_status         approval_status DEFAULT 'pending',
  is_approved             BOOLEAN        DEFAULT FALSE,
  avatar_url              TEXT,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── Speech Therapist Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.speech_therapist_profiles (
  id                      UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID           NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  full_name               TEXT           NOT NULL,
  email                   TEXT,
  phone_number            TEXT,
  license_number          TEXT,
  specializations         TEXT[]         DEFAULT '{}',
  experience_years        INT,
  bio                     TEXT,
  clinic_name             TEXT,
  clinic_code             TEXT           UNIQUE,
  personal_code           TEXT           UNIQUE,
  session_rate            NUMERIC(10,2),
  virtual_sessions_enabled BOOLEAN       DEFAULT TRUE,
  in_person_sessions_enabled BOOLEAN     DEFAULT TRUE,
  approval_status         approval_status DEFAULT 'pending',
  is_approved             BOOLEAN        DEFAULT FALSE,
  avatar_url              TEXT,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── Mental Health Clinician Profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mental_health_clinician_profiles (
  id                      UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID           NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  full_name               TEXT           NOT NULL,
  email                   TEXT,
  phone_number            TEXT,
  license_number          TEXT,
  license_type            TEXT,
  credentials             TEXT,
  specializations         TEXT[]         DEFAULT '{}',
  therapy_approaches      TEXT[]         DEFAULT '{}',
  experience_years        INT,
  bio                     TEXT,
  clinic_name             TEXT,
  clinic_code             TEXT           UNIQUE,
  personal_code           TEXT           UNIQUE,
  session_rate            NUMERIC(10,2),
  virtual_sessions_enabled BOOLEAN       DEFAULT TRUE,
  in_person_sessions_enabled BOOLEAN     DEFAULT TRUE,
  approval_status         approval_status DEFAULT 'pending',
  is_approved             BOOLEAN        DEFAULT FALSE,
  avatar_url              TEXT,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PATIENT PROFILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  full_name             TEXT        NOT NULL,
  email                 TEXT,
  phone_number          TEXT,
  date_of_birth         DATE,
  gender                TEXT,
  blood_type            TEXT,
  weight_kg             NUMERIC(5,2),
  height_cm             NUMERIC(5,2),
  primary_condition     TEXT,
  diagnosis_notes       TEXT,
  emergency_contact     TEXT,
  emergency_phone       TEXT,
  address               TEXT,
  city                  TEXT,
  country               TEXT        DEFAULT 'Nigeria',
  personal_code         TEXT        UNIQUE,
  insurance_info        JSONB,
  onboarding_completed  BOOLEAN     DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROFESSIONAL ↔ PATIENT CONNECTIONS  (PIN system)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.professional_patient_connections (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_type TEXT      NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID        REFERENCES public.dynax_users(id),
  UNIQUE (patient_id, professional_id)
);

-- =============================================================================
-- APPOINTMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID           NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id  UUID           NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_type TEXT          NOT NULL,
  title            TEXT           NOT NULL,
  description      TEXT,
  scheduled_at     TIMESTAMPTZ    NOT NULL,
  duration_minutes INT            NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  session_type     session_type   NOT NULL DEFAULT 'virtual',
  status           session_status NOT NULL DEFAULT 'scheduled',
  meeting_url      TEXT,
  location         TEXT,
  notes            TEXT,
  reminder_sent    BOOLEAN        DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── Appointment Reminders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id    UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  professional_id   UUID        NOT NULL REFERENCES public.dynax_users(id),
  patient_contact   TEXT        NOT NULL,
  reminder_type     TEXT        NOT NULL DEFAULT 'email',
  reminder_sent     BOOLEAN     DEFAULT FALSE,
  reminder_sent_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- THERAPY SESSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.therapy_sessions (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID           NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id  UUID           NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  appointment_id   UUID           REFERENCES public.appointments(id),
  professional_type TEXT          NOT NULL,
  session_date     TIMESTAMPTZ    NOT NULL,
  duration_minutes INT            NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  session_type     session_type   NOT NULL DEFAULT 'virtual',
  status           session_status NOT NULL DEFAULT 'completed',
  -- SOAP Notes
  subjective_note  TEXT,
  objective_note   TEXT,
  assessment_note  TEXT,
  plan_note        TEXT,
  -- Progress
  goals_set        TEXT[],
  goals_achieved   BOOLEAN,
  progress_score   INT            CHECK (progress_score BETWEEN 1 AND 10),
  -- Patient feedback
  patient_rating   INT            CHECK (patient_rating BETWEEN 1 AND 5),
  patient_feedback TEXT,
  -- Media / files
  attachments      JSONB,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MINI EMR — CLINICAL NOTES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id  UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  session_id       UUID        REFERENCES public.therapy_sessions(id),
  note_type        note_type   NOT NULL DEFAULT 'progress',
  title            TEXT        NOT NULL,
  content          TEXT        NOT NULL,
  diagnosis_codes  TEXT[]      DEFAULT '{}',
  is_confidential  BOOLEAN     DEFAULT FALSE,
  is_deleted       BOOLEAN     DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CARE PLANS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.care_plans (
  id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID             NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id  UUID             NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  title            TEXT             NOT NULL,
  description      TEXT,
  goals            TEXT[]           DEFAULT '{}',
  interventions    JSONB,
  start_date       DATE             NOT NULL,
  end_date         DATE,
  status           care_plan_status NOT NULL DEFAULT 'active',
  progress_notes   TEXT,
  progress_score   INT              CHECK (progress_score BETWEEN 0 AND 100),
  review_date      DATE,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- EXERCISE / THERAPY PLANS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.exercise_plans (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id   UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  care_plan_id      UUID        REFERENCES public.care_plans(id),
  title             TEXT        NOT NULL,
  description       TEXT,
  exercises         JSONB       NOT NULL DEFAULT '[]',
  frequency_per_week INT        NOT NULL DEFAULT 3 CHECK (frequency_per_week BETWEEN 1 AND 7),
  duration_weeks    INT         NOT NULL DEFAULT 4 CHECK (duration_weeks > 0),
  status            TEXT        NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Patient Exercise Completion Logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercise_completion_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id       UUID        NOT NULL REFERENCES public.exercise_plans(id) ON DELETE CASCADE,
  patient_id    UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT,
  difficulty    INT         CHECK (difficulty BETWEEN 1 AND 5),
  pain_level    INT         CHECK (pain_level BETWEEN 0 AND 10),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROSTHETIC / ORTHOTIC DEVICE RECORDS  (P&O Module)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.device_measurements (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID          NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id   UUID          NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  device_type       TEXT          NOT NULL,
  body_region       TEXT          NOT NULL,
  laterality        TEXT          CHECK (laterality IN ('left', 'right', 'bilateral')),
  measurements      JSONB         NOT NULL DEFAULT '{}',
  material_specs    JSONB,
  notes             TEXT,
  status            device_status NOT NULL DEFAULT 'draft',
  stl_file_url      TEXT,
  model_3d_url      TEXT,
  submitted_at      TIMESTAMPTZ,
  approved_at       TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  revision_notes    TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Device Revision History ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_revision_history (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     UUID        NOT NULL REFERENCES public.device_measurements(id) ON DELETE CASCADE,
  revised_by    UUID        NOT NULL REFERENCES public.dynax_users(id),
  revision_type TEXT        NOT NULL,
  old_data      JSONB,
  new_data      JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MESSAGING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID        REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id  UUID        REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  admin_id         UUID        REFERENCES public.dynax_users(id),
  conversation_type TEXT       NOT NULL DEFAULT 'patient_professional',
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ,
  unread_patient_count   INT   DEFAULT 0,
  unread_professional_count INT DEFAULT 0,
  unread_admin_count INT       DEFAULT 0,
  is_archived      BOOLEAN     DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES public.dynax_users(id),
  sender_type      TEXT        NOT NULL CHECK (sender_type IN ('patient', 'professional', 'admin')),
  content          TEXT        NOT NULL,
  file_url         TEXT,
  file_name        TEXT,
  file_type        TEXT,
  is_read          BOOLEAN     DEFAULT FALSE,
  read_at          TIMESTAMPTZ,
  is_deleted       BOOLEAN     DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- THERAPAY — FLEXIBLE PAYMENT SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.therapay_plans (
  id                   UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID              NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id      UUID              NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  plan_type            payment_plan_type NOT NULL,
  total_amount         NUMERIC(12,2)     NOT NULL CHECK (total_amount > 0),
  amount_paid          NUMERIC(12,2)     NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  sessions_total       INT,
  sessions_used        INT               DEFAULT 0,
  installment_amount   NUMERIC(12,2),
  installment_interval TEXT,             -- 'weekly' | 'biweekly' | 'monthly'
  next_payment_date    DATE,
  status               payment_status    NOT NULL DEFAULT 'active',
  currency             TEXT              DEFAULT 'NGN',
  notes                TEXT,
  created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ─── Payment Transactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id        UUID        NOT NULL REFERENCES public.therapay_plans(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES public.dynax_users(id),
  professional_id UUID       NOT NULL REFERENCES public.dynax_users(id),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency       TEXT        DEFAULT 'NGN',
  payment_method TEXT,
  reference      TEXT        UNIQUE,
  status         TEXT        NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  notes          TEXT,
  recorded_by    UUID        REFERENCES public.dynax_users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TheraPay Applications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.therapay_applications (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id     UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id UUID       REFERENCES public.dynax_users(id),
  plan_type      TEXT        NOT NULL,
  requested_amount NUMERIC(12,2),
  sessions_requested INT,
  reason         TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by    UUID        REFERENCES public.dynax_users(id),
  reviewed_at    TIMESTAMPTZ,
  review_notes   TEXT,
  application_data JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID              NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  type         notification_type NOT NULL DEFAULT 'general',
  title        TEXT              NOT NULL,
  body         TEXT              NOT NULL,
  data         JSONB,
  is_read      BOOLEAN           DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  email_enabled       BOOLEAN     DEFAULT TRUE,
  push_enabled        BOOLEAN     DEFAULT TRUE,
  sms_enabled         BOOLEAN     DEFAULT FALSE,
  appointment_reminders BOOLEAN   DEFAULT TRUE,
  session_alerts      BOOLEAN     DEFAULT TRUE,
  payment_alerts      BOOLEAN     DEFAULT TRUE,
  message_alerts      BOOLEAN     DEFAULT TRUE,
  quiet_hours_start   TIME,
  quiet_hours_end     TIME,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    TEXT        NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- =============================================================================
-- AI ASSISTANT
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  user_role       TEXT        NOT NULL,
  conversation_id UUID,       -- groups messages in same thread
  input           TEXT        NOT NULL,
  response        TEXT        NOT NULL,
  model_used      TEXT,
  tokens_used     INT,
  context_data    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Embeddings (for semantic search / RAG) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.therapy_embeddings (
  id         UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  content    TEXT      NOT NULL,
  embedding  vector(1536),
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- EMAIL LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        REFERENCES public.dynax_users(id),
  recipient    TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  template     TEXT,
  status       TEXT        NOT NULL DEFAULT 'sent',
  resend_id    TEXT,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PATIENT REHABILITATION LOGS  (progress tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.patient_rehab_logs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id UUID        REFERENCES public.dynax_users(id),
  session_id      UUID        REFERENCES public.therapy_sessions(id),
  log_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  pain_level      INT         CHECK (pain_level BETWEEN 0 AND 10),
  energy_level    INT         CHECK (energy_level BETWEEN 1 AND 10),
  mood_rating     INT         CHECK (mood_rating BETWEEN 1 AND 10),
  notes           TEXT,
  milestones      TEXT[],
  attachments     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- REFERRALS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  referring_professional_id UUID  NOT NULL REFERENCES public.dynax_users(id),
  referred_to_id      UUID        REFERENCES public.dynax_users(id),
  patient_id          UUID        NOT NULL REFERENCES public.dynax_users(id),
  referral_type       TEXT        NOT NULL,
  urgency             TEXT        DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  reason              TEXT        NOT NULL,
  clinical_notes      TEXT,
  status              TEXT        DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  accepted_at         TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PLATFORM ANALYTICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  session_id   TEXT,
  event_type   TEXT        NOT NULL,
  event_data   JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_dynax_users_email      ON public.dynax_users(email);
CREATE INDEX IF NOT EXISTS idx_dynax_users_role       ON public.dynax_users(role);
CREATE INDEX IF NOT EXISTS idx_dynax_users_auth_id    ON public.dynax_users(auth_id);
CREATE INDEX IF NOT EXISTS idx_dynax_users_is_active  ON public.dynax_users(is_active);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id      ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_personal_code ON public.user_profiles(personal_code);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id    ON public.patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_code       ON public.patient_profiles(personal_code);

-- Professional profiles — personal codes (all role tables)
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_code    ON public.therapist_profiles(personal_code);
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_clinic  ON public.therapist_profiles(clinic_code);
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_approved ON public.therapist_profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_po_profiles_code           ON public.po_professional_profiles(personal_code);
CREATE INDEX IF NOT EXISTS idx_po_profiles_clinic         ON public.po_professional_profiles(clinic_code);
CREATE INDEX IF NOT EXISTS idx_ot_profiles_code           ON public.occupational_therapist_profiles(personal_code);
CREATE INDEX IF NOT EXISTS idx_st_profiles_code           ON public.speech_therapist_profiles(personal_code);
CREATE INDEX IF NOT EXISTS idx_mh_profiles_code           ON public.mental_health_clinician_profiles(personal_code);

-- Connections
CREATE INDEX IF NOT EXISTS idx_connections_patient        ON public.professional_patient_connections(patient_id);
CREATE INDEX IF NOT EXISTS idx_connections_professional   ON public.professional_patient_connections(professional_id);
CREATE INDEX IF NOT EXISTS idx_connections_status         ON public.professional_patient_connections(status);

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_patient       ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_professional  ON public.appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at  ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status        ON public.appointments(status);

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_patient           ON public.therapy_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_professional      ON public.therapy_sessions(professional_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date              ON public.therapy_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_appointment       ON public.therapy_sessions(appointment_id);

-- Clinical notes
CREATE INDEX IF NOT EXISTS idx_notes_patient              ON public.clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_notes_professional         ON public.clinical_notes(professional_id);
CREATE INDEX IF NOT EXISTS idx_notes_type                 ON public.clinical_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_deleted              ON public.clinical_notes(is_deleted);

-- Care plans
CREATE INDEX IF NOT EXISTS idx_care_plans_patient         ON public.care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_professional    ON public.care_plans(professional_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status          ON public.care_plans(status);

-- Devices
CREATE INDEX IF NOT EXISTS idx_devices_patient            ON public.device_measurements(patient_id);
CREATE INDEX IF NOT EXISTS idx_devices_professional       ON public.device_measurements(professional_id);
CREATE INDEX IF NOT EXISTS idx_devices_status             ON public.device_measurements(status);

-- Messages / conversations
CREATE INDEX IF NOT EXISTS idx_conversations_patient      ON public.conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_professional ON public.conversations(professional_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation      ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender            ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created           ON public.messages(created_at DESC);

-- TheraPay
CREATE INDEX IF NOT EXISTS idx_therapay_plans_patient     ON public.therapay_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_therapay_plans_professional ON public.therapay_plans(professional_id);
CREATE INDEX IF NOT EXISTS idx_therapay_plans_status      ON public.therapay_plans(status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_plan            ON public.payment_transactions(plan_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user         ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read      ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created      ON public.notifications(created_at DESC);

-- AI
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user      ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_thread    ON public.ai_conversations(conversation_id);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user            ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action          ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created         ON public.audit_logs(created_at DESC);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_user             ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type       ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created          ON public.analytics_events(created_at DESC);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_patient_profiles_name_trgm ON public.patient_profiles USING gin(full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_therapist_profiles_name_trgm ON public.therapist_profiles USING gin(full_name gin_trgm_ops);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all sensitive tables
ALTER TABLE public.dynax_users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_professional_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupational_therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_therapist_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mental_health_clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_patient_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plans                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_plans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_measurements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapay_plans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapay_applications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_rehab_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                      ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's DynaX user id from JWT sub
CREATE OR REPLACE FUNCTION public.get_dynax_user_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT id FROM public.dynax_users
  WHERE auth_id = auth.uid()
  LIMIT 1
$$;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.get_dynax_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT role::TEXT FROM public.dynax_users
  WHERE auth_id = auth.uid()
  LIMIT 1
$$;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dynax_users
    WHERE auth_id = auth.uid() AND role = 'admin'
  )
$$;

-- ── dynax_users ───────────────────────────────────────────────────────────────
CREATE POLICY "users_select_own" ON public.dynax_users
  FOR SELECT USING (auth_id = auth.uid() OR public.is_admin());

CREATE POLICY "users_update_own" ON public.dynax_users
  FOR UPDATE USING (auth_id = auth.uid());

CREATE POLICY "admin_all_users" ON public.dynax_users
  FOR ALL USING (public.is_admin());

-- ── user_profiles ─────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_own" ON public.user_profiles
  FOR SELECT USING (user_id = public.get_dynax_user_id() OR public.is_admin());

CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (user_id = public.get_dynax_user_id());

-- ── patient_profiles ──────────────────────────────────────────────────────────
CREATE POLICY "patient_profiles_own" ON public.patient_profiles
  FOR ALL USING (user_id = public.get_dynax_user_id() OR public.is_admin());

CREATE POLICY "patient_profiles_professionals_read" ON public.patient_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.professional_patient_connections c
      WHERE c.patient_id = patient_profiles.user_id
        AND c.professional_id = public.get_dynax_user_id()
        AND c.status = 'active'
    )
  );

-- ── therapist_profiles ────────────────────────────────────────────────────────
CREATE POLICY "therapist_profiles_public_read" ON public.therapist_profiles
  FOR SELECT USING (is_approved = TRUE OR user_id = public.get_dynax_user_id() OR public.is_admin());

CREATE POLICY "therapist_profiles_own_write" ON public.therapist_profiles
  FOR ALL USING (user_id = public.get_dynax_user_id() OR public.is_admin());

-- ── appointments ─────────────────────────────────────────────────────────────
CREATE POLICY "appointments_participant" ON public.appointments
  FOR ALL USING (
    patient_id = public.get_dynax_user_id()
    OR professional_id = public.get_dynax_user_id()
    OR public.is_admin()
  );

-- ── therapy_sessions ─────────────────────────────────────────────────────────
CREATE POLICY "sessions_participant" ON public.therapy_sessions
  FOR ALL USING (
    patient_id = public.get_dynax_user_id()
    OR professional_id = public.get_dynax_user_id()
    OR public.is_admin()
  );

-- ── clinical_notes ────────────────────────────────────────────────────────────
CREATE POLICY "notes_professional_write" ON public.clinical_notes
  FOR ALL USING (
    professional_id = public.get_dynax_user_id()
    OR public.is_admin()
  );

CREATE POLICY "notes_patient_read" ON public.clinical_notes
  FOR SELECT USING (
    patient_id = public.get_dynax_user_id()
    AND is_confidential = FALSE
  );

-- ── care_plans ────────────────────────────────────────────────────────────────
CREATE POLICY "care_plans_participant" ON public.care_plans
  FOR ALL USING (
    patient_id = public.get_dynax_user_id()
    OR professional_id = public.get_dynax_user_id()
    OR public.is_admin()
  );

-- ── conversations ─────────────────────────────────────────────────────────────
CREATE POLICY "conversations_participant" ON public.conversations
  FOR ALL USING (
    patient_id = public.get_dynax_user_id()
    OR professional_id = public.get_dynax_user_id()
    OR admin_id = public.get_dynax_user_id()
    OR public.is_admin()
  );

-- ── messages ─────────────────────────────────────────────────────────────────
CREATE POLICY "messages_via_conversation" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations cv
      WHERE cv.id = messages.conversation_id
        AND (
          cv.patient_id = public.get_dynax_user_id()
          OR cv.professional_id = public.get_dynax_user_id()
          OR cv.admin_id = public.get_dynax_user_id()
          OR public.is_admin()
        )
    )
  );

-- ── therapay_plans ────────────────────────────────────────────────────────────
CREATE POLICY "therapay_participant" ON public.therapay_plans
  FOR ALL USING (
    patient_id = public.get_dynax_user_id()
    OR professional_id = public.get_dynax_user_id()
    OR public.is_admin()
  );

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = public.get_dynax_user_id() OR public.is_admin());

-- ── audit_logs ───────────────────────────────────────────────────────────────
CREATE POLICY "audit_logs_admin_only" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);  -- backend service role inserts

-- ── ai_conversations ─────────────────────────────────────────────────────────
CREATE POLICY "ai_conversations_own" ON public.ai_conversations
  FOR ALL USING (user_id = public.get_dynax_user_id() OR public.is_admin());

-- =============================================================================
-- DATABASE FUNCTIONS
-- =============================================================================

-- ─── Auto-update updated_at timestamp ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END
$$;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'dynax_users', 'user_profiles', 'patient_profiles',
    'therapist_profiles', 'po_professional_profiles',
    'occupational_therapist_profiles', 'speech_therapist_profiles',
    'mental_health_clinician_profiles', 'appointments',
    'therapy_sessions', 'clinical_notes', 'care_plans',
    'exercise_plans', 'device_measurements', 'conversations',
    'therapay_plans', 'therapay_applications', 'referrals'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
       CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- ─── Generate unique personal code (PIN) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_personal_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Format: DX-XXXX-XXXX  (alphanumeric, uppercase)
    code := 'DX-' || upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 4))
              || '-' || upper(substring(md5(random()::text) FROM 1 FOR 4));
    -- Check uniqueness across all profile tables
    SELECT EXISTS (
      SELECT 1 FROM public.therapist_profiles WHERE personal_code = code
      UNION ALL
      SELECT 1 FROM public.po_professional_profiles WHERE personal_code = code
      UNION ALL
      SELECT 1 FROM public.occupational_therapist_profiles WHERE personal_code = code
      UNION ALL
      SELECT 1 FROM public.speech_therapist_profiles WHERE personal_code = code
      UNION ALL
      SELECT 1 FROM public.mental_health_clinician_profiles WHERE personal_code = code
      UNION ALL
      SELECT 1 FROM public.patient_profiles WHERE personal_code = code
    ) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END
$$;

-- ─── Find professional by personal code ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.find_professional_by_code(p_code TEXT)
RETURNS TABLE (
  user_id         UUID,
  professional_type TEXT,
  full_name       TEXT,
  clinic_name     TEXT,
  avatar_url      TEXT,
  is_approved     BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT tp.user_id, 'physiotherapist'::TEXT, tp.full_name, tp.clinic_name, tp.avatar_url, tp.is_approved
    FROM public.therapist_profiles tp WHERE tp.personal_code = p_code AND tp.is_approved
    UNION ALL
    SELECT po.user_id, po.professional_type, po.full_name, po.clinic_name, po.avatar_url, po.is_approved
    FROM public.po_professional_profiles po WHERE po.personal_code = p_code AND po.is_approved
    UNION ALL
    SELECT ot.user_id, 'occupational_therapist'::TEXT, ot.full_name, ot.clinic_name, ot.avatar_url, ot.is_approved
    FROM public.occupational_therapist_profiles ot WHERE ot.personal_code = p_code AND ot.is_approved
    UNION ALL
    SELECT st.user_id, 'speech_therapist'::TEXT, st.full_name, st.clinic_name, st.avatar_url, st.is_approved
    FROM public.speech_therapist_profiles st WHERE st.personal_code = p_code AND st.is_approved
    UNION ALL
    SELECT mh.user_id, 'mental_health_clinician'::TEXT, mh.full_name, mh.clinic_name, mh.avatar_url, mh.is_approved
    FROM public.mental_health_clinician_profiles mh WHERE mh.personal_code = p_code AND mh.is_approved
  LIMIT 1;
END
$$;

-- ─── Platform stats (admin) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE (
  total_users         BIGINT,
  total_patients      BIGINT,
  total_professionals BIGINT,
  pending_approvals   BIGINT,
  total_sessions      BIGINT,
  active_care_plans   BIGINT,
  sessions_this_month BIGINT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    (SELECT COUNT(*) FROM public.dynax_users WHERE is_active)::BIGINT,
    (SELECT COUNT(*) FROM public.dynax_users WHERE role = 'patient' AND is_active)::BIGINT,
    (SELECT COUNT(*) FROM public.dynax_users WHERE role <> 'patient' AND role <> 'admin' AND is_active)::BIGINT,
    (SELECT COUNT(*) FROM public.therapist_profiles WHERE approval_status = 'pending')::BIGINT
    + (SELECT COUNT(*) FROM public.po_professional_profiles WHERE approval_status = 'pending')::BIGINT,
    (SELECT COUNT(*) FROM public.therapy_sessions)::BIGINT,
    (SELECT COUNT(*) FROM public.care_plans WHERE status = 'active')::BIGINT,
    (SELECT COUNT(*) FROM public.therapy_sessions
     WHERE session_date >= date_trunc('month', NOW()))::BIGINT
$$;

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Default admin user (update the auth_id after creating in Supabase Auth)
INSERT INTO public.dynax_users (email, role, is_active, is_verified)
VALUES ('admin@dynalimb.com', 'admin', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
