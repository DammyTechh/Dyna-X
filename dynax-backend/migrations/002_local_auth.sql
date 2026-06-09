-- =============================================================================
-- 002_local_auth.sql
-- Self-contained (local) auth: password hash on dynax_users + an OTP table for
-- email-verification & password-reset codes. Idempotent; safe on top of 001.
-- (Also included in the combined supabase_full_schema.sql file.)
-- =============================================================================

ALTER TABLE public.dynax_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- One-time passcodes for transactional auth emails. We store only the SHA-256
-- hash of the 6-digit code, never the code itself. Codes are short-lived and
-- attempt-limited to make brute force impractical.
CREATE TABLE IF NOT EXISTS public.auth_otps (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  code_hash   TEXT        NOT NULL,
  purpose     TEXT        NOT NULL CHECK (purpose IN ('verify', 'reset')),
  attempts    INT         NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_user    ON public.auth_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_otps_purpose ON public.auth_otps(user_id, purpose);
