-- ============================================================================
-- DynaX — Migration 012: DynaX Studio telemetry + release analytics
-- Ports the standalone Python analytics backend into the single Go backend.
-- Tables are prefixed `studio_` so they never collide with clinical tables.
-- Idempotent. Safe to run on the existing Supabase database.
-- ============================================================================

-- Ingestion credentials for Studio installations. The raw token is
-- `<token_id>.<secret>`; only SHA-256(secret) is stored. A token binds to one
-- installation UUID on first successful use and is locked to it afterwards.
CREATE TABLE IF NOT EXISTS public.studio_ingestion_tokens (
    token_id     UUID        PRIMARY KEY,
    secret_hash  VARCHAR(64) NOT NULL,
    install_id   UUID        UNIQUE,
    enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
    label        TEXT,                                   -- clinic name, for admin records only
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    environment  VARCHAR(16) NOT NULL DEFAULT 'test'
);

ALTER TABLE public.studio_ingestion_tokens
    DROP CONSTRAINT IF EXISTS studio_tokens_environment_valid;
ALTER TABLE public.studio_ingestion_tokens
    ADD CONSTRAINT studio_tokens_environment_valid
    CHECK (environment IN ('production', 'development', 'test'));

-- Append-only pseudonymous usage events.
CREATE TABLE IF NOT EXISTS public.studio_events (
    id              BIGSERIAL   PRIMARY KEY,
    event_id        UUID        UNIQUE NOT NULL,
    install_id      UUID        NOT NULL,
    session_id      UUID        NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    workflow        VARCHAR(64),
    stage           VARCHAR(64),
    value           VARCHAR(64),
    duration_s      DOUBLE PRECISION,
    timestamp       TIMESTAMPTZ NOT NULL,
    addon_version   VARCHAR(64),
    blender_version VARCHAR(64),
    os_platform     VARCHAR(64) NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    environment     VARCHAR(16) NOT NULL DEFAULT 'test',
    CONSTRAINT studio_events_duration_valid CHECK (
        duration_s IS NULL OR (duration_s >= 0 AND duration_s <= 604800)
    )
);

ALTER TABLE public.studio_events
    DROP CONSTRAINT IF EXISTS studio_events_environment_valid;
ALTER TABLE public.studio_events
    ADD CONSTRAINT studio_events_environment_valid
    CHECK (environment IN ('production', 'development', 'test'));

-- Indexes mirror the Python migrations 001–003.
CREATE INDEX IF NOT EXISTS idx_studio_events_install_id        ON public.studio_events(install_id);
CREATE INDEX IF NOT EXISTS idx_studio_events_type_received     ON public.studio_events(event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_events_workflow_received ON public.studio_events(workflow, received_at DESC) WHERE workflow IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studio_events_received_at       ON public.studio_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_events_install_timestamp ON public.studio_events(install_id, timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_studio_events_install_session   ON public.studio_events(install_id, session_id);
CREATE INDEX IF NOT EXISTS idx_studio_events_install_type_recv ON public.studio_events(install_id, event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_events_env_received      ON public.studio_events(environment, received_at DESC);
