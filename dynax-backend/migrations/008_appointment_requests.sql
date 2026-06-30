-- ============================================================================
-- DynaX — Migration 008: patient-driven appointment workflow
-- Adds two statuses so patients can REQUEST appointments and professionals can
-- approve (-> scheduled) or reject (-> rejected).
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block on some
-- Postgres versions. If your SQL runner wraps everything in a transaction and
-- this errors, run each ALTER TYPE line on its own.
-- ============================================================================

ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'requested';
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'rejected';
