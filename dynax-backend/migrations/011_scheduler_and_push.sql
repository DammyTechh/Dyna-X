-- ============================================================================
-- DynaX — Migration 011: scheduler (email reminders) + web push
-- Adds idempotency columns so the scheduler never double-sends, and a table to
-- store browser push subscriptions. Idempotent.
-- ============================================================================

-- Reminder idempotency flags -------------------------------------------------
ALTER TABLE public.appointments   ADD COLUMN IF NOT EXISTS reminder_sent_at   TIMESTAMPTZ;
ALTER TABLE public.follow_ups      ADD COLUMN IF NOT EXISTS reminded_at        TIMESTAMPTZ;
ALTER TABLE public.therapay_plans  ADD COLUMN IF NOT EXISTS reminder_sent_at   TIMESTAMPTZ;
ALTER TABLE public.messages        ADD COLUMN IF NOT EXISTS email_notified_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder  ON public.appointments(scheduled_at) WHERE reminder_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_followups_reminder     ON public.follow_ups(due_date)      WHERE reminded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unnotified    ON public.messages(created_at)      WHERE email_notified_at IS NULL AND is_read = FALSE;

-- Web push subscriptions -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.dynax_users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
