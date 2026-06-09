-- =============================================================================
-- 004_dx_pins.sql
-- One-time DX connection PINs: a professional generates a PIN for a patient's
-- email; the patient enters (professional email + PIN) to auto-match.
-- Idempotent. (Also folded into dynax_supabase_full.sql.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dx_connection_pins (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id   UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_type TEXT        NOT NULL,
  patient_email     TEXT        NOT NULL,
  pin               TEXT        NOT NULL,
  used              BOOLEAN     NOT NULL DEFAULT FALSE,
  used_by           UUID        REFERENCES public.dynax_users(id),
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dx_pins_lookup ON public.dx_connection_pins(professional_id, pin);
CREATE INDEX IF NOT EXISTS idx_dx_pins_email  ON public.dx_connection_pins(patient_email);
