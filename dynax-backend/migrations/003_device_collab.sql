-- =============================================================================
-- 003_device_collab.sql
-- 3D editor collaboration: shareable links + threaded comments on device scans.
-- Idempotent; safe on top of 001/002. (Also in dynax_supabase_full.sql.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.device_shares (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID        NOT NULL REFERENCES public.device_measurements(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  permission  TEXT        NOT NULL DEFAULT 'view' CHECK (permission IN ('view','comment','annotate')),
  created_by  UUID        REFERENCES public.dynax_users(id),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_shares_token ON public.device_shares(token);

CREATE TABLE IF NOT EXISTS public.device_comments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID        NOT NULL REFERENCES public.device_measurements(id) ON DELETE CASCADE,
  author_id   UUID        REFERENCES public.dynax_users(id),
  author_name TEXT        NOT NULL,
  author_role TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_comments_device ON public.device_comments(device_id);
