-- ============================================================================
-- DynaX — Migration 002: 3D scan collaboration (share links + comments + storage)
-- Run this once in the Supabase SQL editor (or via psql) on your project.
-- It is idempotent: safe to run more than once.
-- ============================================================================

-- ── 1. Share links for device scans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_shares (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID        NOT NULL REFERENCES public.device_measurements(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  permission  TEXT        NOT NULL DEFAULT 'view' CHECK (permission IN ('view','comment','annotate')),
  created_by  UUID        REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_shares_token  ON public.device_shares(token);
CREATE INDEX IF NOT EXISTS idx_device_shares_device ON public.device_shares(device_id);

-- ── 2. Comments on device scans ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_comments (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id    UUID        NOT NULL REFERENCES public.device_measurements(id) ON DELETE CASCADE,
  author_id    UUID        REFERENCES public.dynax_users(id) ON DELETE SET NULL,
  author_name  TEXT        NOT NULL DEFAULT 'Guest',
  author_role  TEXT        NOT NULL DEFAULT 'professional',
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_comments_device ON public.device_comments(device_id, created_at);

-- ── 3. Make sure device_measurements can hold an uploaded model URL ──────────
-- (these columns already exist in the base schema; the guard makes 002 safe
--  to run on older databases that pre-date them.)
ALTER TABLE public.device_measurements ADD COLUMN IF NOT EXISTS model_3d_url TEXT;
ALTER TABLE public.device_measurements ADD COLUMN IF NOT EXISTS stl_file_url TEXT;

-- ── 4. Storage bucket for uploaded 3D scans ─────────────────────────────────
-- Public-read so a share link can load the model in the viewer.
INSERT INTO storage.buckets (id, name, public)
VALUES ('scans', 'scans', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage RLS policies (Supabase enables RLS on storage.objects by default).
DROP POLICY IF EXISTS "scans public read"   ON storage.objects;
DROP POLICY IF EXISTS "scans public upload" ON storage.objects;

CREATE POLICY "scans public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scans');

-- NOTE: this allows uploads to the 'scans' bucket with the public anon key.
-- It's the simplest working setup. To lock it down later, route uploads
-- through the Go backend with the service-role key and drop this policy.
CREATE POLICY "scans public upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'scans');
