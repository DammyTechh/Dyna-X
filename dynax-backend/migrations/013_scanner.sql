-- ============================================================================
-- DynaX — Migration 013: DynaX Scanner (DynaScan) video→3D reconstruction
-- Ports the standalone TypeScript scanner's persistence into the single Go
-- backend. Tables are prefixed `scanner_` to avoid any clash. Idempotent.
-- Owner is a DynaX account (Sign in with DynaX); a scan may link to a patient
-- and, later, a 3D case in the P&O workspace.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scanner_scans (
    id                        UUID        PRIMARY KEY,
    owner_id                  UUID        NOT NULL,
    patient_id                UUID,
    case_ref                  TEXT,
    subject_display_name      TEXT        NOT NULL DEFAULT '',
    anatomical_region         TEXT        NOT NULL DEFAULT '',
    alignment_template_id     TEXT        NOT NULL DEFAULT '',
    capture_method            TEXT        NOT NULL DEFAULT 'VIDEO_UPLOAD',
    reconstruction_mode       TEXT        NOT NULL DEFAULT 'STANDARD',
    acquisition_state         TEXT        NOT NULL DEFAULT 'DRAFT',
    reconstruction_state      TEXT        NOT NULL DEFAULT 'NOT_STARTED',
    scale_state               TEXT        NOT NULL DEFAULT 'UNKNOWN',
    geometry_quality_state    TEXT        NOT NULL DEFAULT 'NOT_ASSESSED',
    clinical_validation_state TEXT        NOT NULL DEFAULT 'NOT_VALIDATED',
    active_asset_id           UUID,
    error_code                TEXT,
    error_message             TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT scanner_scans_capture_method_valid
        CHECK (capture_method IN ('VIDEO_UPLOAD', 'VIDEO_CAPTURE')),
    CONSTRAINT scanner_scans_mode_valid
        CHECK (reconstruction_mode IN ('STANDARD', 'FEATURELESS_EXPERIMENTAL')),
    CONSTRAINT scanner_scans_acq_state_valid
        CHECK (acquisition_state IN ('DRAFT', 'UPLOADING', 'NORMALIZING', 'READY', 'FAILED')),
    CONSTRAINT scanner_scans_recon_state_valid
        CHECK (reconstruction_state IN ('NOT_STARTED', 'QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS public.scanner_assets (
    id              UUID        PRIMARY KEY,
    scan_id         UUID        NOT NULL REFERENCES public.scanner_scans(id) ON DELETE CASCADE,
    kind            TEXT        NOT NULL,
    file_name       TEXT        NOT NULL,
    media_type      TEXT        NOT NULL,
    storage_key     TEXT        NOT NULL,
    byte_size       BIGINT      NOT NULL DEFAULT 0,
    source_asset_id UUID,
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT scanner_assets_kind_valid CHECK (kind IN (
        'INPUT_VIDEO', 'RAW_RECONSTRUCTION', 'SUBJECT_ISOLATED', 'ORIENTED_SUBJECT',
        'CALIBRATED_MODEL', 'PROCESSED_MODEL', 'FINAL_EXPORT'))
);

CREATE TABLE IF NOT EXISTS public.scanner_jobs (
    id                       UUID        PRIMARY KEY,
    scan_id                  UUID        NOT NULL REFERENCES public.scanner_scans(id) ON DELETE CASCADE,
    provider_key             TEXT        NOT NULL,
    private_provider_job_id  TEXT        NOT NULL,
    state                    TEXT        NOT NULL DEFAULT 'QUEUED',
    submitted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result_imported          BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_scanner_scans_owner    ON public.scanner_scans(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_scans_patient  ON public.scanner_scans(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scanner_assets_scan    ON public.scanner_assets(scan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_jobs_scan      ON public.scanner_jobs(scan_id, submitted_at DESC);
