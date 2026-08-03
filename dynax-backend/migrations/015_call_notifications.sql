-- ============================================================================
-- DynaX — Migration 015: call notifications
-- Adds the 'call_incoming' value to notification_type so POST /calls/notify can
-- insert a notification for an incoming video/voice call. Idempotent.
-- ============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'call_incoming';
