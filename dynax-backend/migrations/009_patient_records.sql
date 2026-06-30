-- ============================================================================
-- DynaX — Migration 009: simple Patient Records / Clinical Documentation
-- A lightweight record a professional keeps for patients who are NOT connected
-- via DX-PIN (no platform account needed). Owned by the documenting professional.
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patient_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id    uuid NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,

  -- Demographics
  full_name          text NOT NULL,
  date_of_birth      date,
  gender             text,
  phone              text,
  email              text,
  address            text,

  -- Clinical documentation
  clinical_history     text,
  case_notes           text,
  assessment_findings  text,
  progress_notes       text,
  outcome_measures     text,

  -- Role-specific measurements / clinical parameters (flexible).
  -- Prosthetist/Orthotist: residual limb measurements, device spec, alignment,
  --   follow-up observations. Physiotherapist: ROM, strength, functional scores,
  --   rehab notes. Stored as JSON so the form can vary by discipline.
  measurements       jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Uploaded files/images: [{ "name": "...", "url": "..." }, ...]
  attachments        jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_records_professional
  ON public.patient_records(professional_id);
