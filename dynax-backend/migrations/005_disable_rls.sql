-- =============================================================================
-- 005_disable_rls.sql
-- DynaX uses a TRUSTED Go backend (connects as postgres, enforces authz in app
-- code). The 001 RLS policies target Supabase-Auth clients (auth.uid()), which
-- this backend doesn't use, so RLS blocks its reads/writes. Disable RLS on the
-- app tables. Idempotent & safe to re-run.
-- =============================================================================

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'dynax_users','user_profiles','patient_profiles','therapist_profiles',
    'po_professional_profiles','occupational_therapist_profiles',
    'speech_therapist_profiles','mental_health_clinician_profiles',
    'professional_patient_connections','appointments','therapy_sessions',
    'clinical_notes','care_plans','exercise_plans','device_measurements',
    'device_shares','device_comments','dx_connection_pins',
    'conversations','messages','therapay_plans','payment_transactions',
    'therapay_applications','notifications','notification_preferences',
    'ai_conversations','patient_rehab_logs','audit_logs','auth_otps'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END $$;
