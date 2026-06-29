-- ============================================================================
-- DynaX — Migration 007: care-plan tasks + share-with-patient
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

-- Per-task checklist the patient can tick off. Shape (JSON array):
--   [{ "id": "t1", "label": "Walk 10 min daily", "done": false }, ...]
ALTER TABLE public.care_plans
  ADD COLUMN IF NOT EXISTS tasks JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Whether the plan is visible to the patient. Defaults TRUE so existing plans
-- keep showing; professionals can keep a plan as a private draft by unsetting it.
ALTER TABLE public.care_plans
  ADD COLUMN IF NOT EXISTS shared_with_patient BOOLEAN NOT NULL DEFAULT true;
