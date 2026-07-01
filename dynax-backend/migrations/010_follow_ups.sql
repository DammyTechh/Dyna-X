-- ============================================================================
-- DynaX — Migration 010: follow-up system
-- Lets a professional schedule follow-ups at discharge, patients respond with
-- an outcome, and flags patients who may need re-evaluation.
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  professional_id UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  cadence         TEXT        NOT NULL DEFAULT 'custom',   -- two_week | monthly | quarterly | custom
  due_date        DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'scheduled', -- scheduled | completed | flagged
  note            TEXT,                                     -- professional's instruction / reason
  patient_response TEXT,                                    -- patient-reported outcome
  needs_reevaluation BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_patient      ON public.follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_professional ON public.follow_ups(professional_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due          ON public.follow_ups(due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status       ON public.follow_ups(status);

-- RLS is disabled project-wide (see 005_disable_rls); no policies needed here.
