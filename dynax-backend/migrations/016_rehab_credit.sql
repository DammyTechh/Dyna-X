-- ============================================================================
-- DynaX — Migration 016: Rehab Credit (Mediloan-backed financing)
--
-- Mediloan is a THIRD-PARTY lender. DynaX is not the lender and does not move
-- money. These tables only track (a) which sessions both sides confirmed
-- happened, (b) what an admin recorded after reading Mediloan's report, and
-- (c) the resulting escalation state. Every financial status change is
-- admin-mediated — nothing here settles automatically. Idempotent.
-- ============================================================================

-- Notification type used by every Rehab Credit notification ------------------
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'rehab_credit_update';

-- ─── Plans ───────────────────────────────────────────────────────────────────
-- A plan starts at 'pending_admin' holding only the patient's request. The
-- physio, session rate, session count, term and Mediloan reference are all
-- filled in by an admin at approval time.
CREATE TABLE IF NOT EXISTS public.rehab_credit_plans (
  id                           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                   UUID          NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  physio_id                    UUID          REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  total_credit_amount          NUMERIC(12,2) NOT NULL,
  session_rate                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  sessions_total               INT           NOT NULL DEFAULT 0,
  sessions_released            INT           NOT NULL DEFAULT 0,
  duration_months              INT           NOT NULL DEFAULT 0,
  mediloan_ref                 TEXT,
  status                       TEXT          NOT NULL DEFAULT 'pending_admin'
                                 CHECK (status IN ('pending_admin','active','suspended','completed','rejected')),
  consecutive_missed_payments  INT           NOT NULL DEFAULT 0,
  -- Highest miss count an escalation notification has already gone out for, so
  -- the same miss is never escalated twice. Reset to 0 when the patient catches up.
  escalation_notified_at_count INT           NOT NULL DEFAULT 0,
  review_notes                 TEXT,
  reviewed_by                  UUID          REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  reviewed_at                  TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rehab_credit_plans_patient ON public.rehab_credit_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_rehab_credit_plans_physio  ON public.rehab_credit_plans(physio_id);
CREATE INDEX IF NOT EXISTS idx_rehab_credit_plans_status  ON public.rehab_credit_plans(status);

-- ─── Session releases ────────────────────────────────────────────────────────
-- One row per session that should trigger a payout to the physio. Both the
-- patient and the physio must confirm the session happened before an admin can
-- mark it paid.
CREATE TABLE IF NOT EXISTS public.rehab_session_releases (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id              UUID          NOT NULL REFERENCES public.rehab_credit_plans(id) ON DELETE CASCADE,
  appointment_id       UUID          REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount               NUMERIC(12,2) NOT NULL,
  patient_confirmed_at TIMESTAMPTZ,
  physio_confirmed_at  TIMESTAMPTZ,
  status               TEXT          NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','both_confirmed','payout_pending','paid','disputed')),
  admin_marked_paid_at TIMESTAMPTZ,
  admin_marked_paid_by UUID          REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rehab_session_releases_plan   ON public.rehab_session_releases(plan_id);
CREATE INDEX IF NOT EXISTS idx_rehab_session_releases_status ON public.rehab_session_releases(status);

-- One release per appointment, so a session can never be double-paid.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rehab_session_releases_appointment
  ON public.rehab_session_releases(appointment_id) WHERE appointment_id IS NOT NULL;

-- ─── Repayment checks ────────────────────────────────────────────────────────
-- The expected Mediloan installment schedule. DynaX never marks these itself —
-- an admin sets on_time/missed based on what Mediloan reports.
CREATE TABLE IF NOT EXISTS public.rehab_repayment_checks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID        NOT NULL REFERENCES public.rehab_credit_plans(id) ON DELETE CASCADE,
  period_label TEXT        NOT NULL,
  due_date     DATE        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'upcoming'
                 CHECK (status IN ('upcoming','on_time','missed')),
  marked_by    UUID        REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  marked_at    TIMESTAMPTZ,
  -- Set when the scheduler has already nudged admin that this check is overdue,
  -- so the informational job stays idempotent.
  overdue_notified_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rehab_repayment_checks_plan ON public.rehab_repayment_checks(plan_id);
CREATE INDEX IF NOT EXISTS idx_rehab_repayment_checks_due
  ON public.rehab_repayment_checks(due_date) WHERE status = 'upcoming';
