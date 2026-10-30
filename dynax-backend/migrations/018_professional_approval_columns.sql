-- 018: Add approval audit columns to the newer professional profile tables.
-- ProfessionalRepository.SetApprovalStatus writes approved_by/approved_at on
-- every role table, but only therapist_profiles and po_professional_profiles
-- had them, so approving an OT / speech / mental-health professional failed.

ALTER TABLE public.occupational_therapist_profiles
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.dynax_users(id);

ALTER TABLE public.speech_therapist_profiles
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.dynax_users(id);

ALTER TABLE public.mental_health_clinician_profiles
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.dynax_users(id);
