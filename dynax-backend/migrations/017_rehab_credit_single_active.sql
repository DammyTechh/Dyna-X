-- ============================================================================
-- DynaX — Migration 017: one active Rehab Credit plan per patient/physio pair
--
-- Sessions are linked to a plan by looking up (patient_id, physio_id) — there is
-- no plan_id on the session request. This index guarantees that lookup can
-- never match more than one row. Historical plans (completed, rejected,
-- suspended) and pending applications are unconstrained, so a patient can hold
-- several plans with the same physio over time — just never two active at once.
-- Idempotent.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_rehab_credit_plans_one_active_per_pair
  ON public.rehab_credit_plans (patient_id, physio_id)
  WHERE status = 'active';
