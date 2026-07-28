-- ============================================================================
-- DynaX — Migration 014: native device-scan support (DynaXcan iOS)
-- The iOS app reconstructs on-device (LiDAR / TrueDepth via StandardCyborg) and
-- uploads a finished mesh + raw point cloud + capture metadata. This extends the
-- scanner schema (013) to accept that path. Idempotent; run after 013.
-- ============================================================================

-- Allow device capture methods alongside the video ones.
ALTER TABLE public.scanner_scans DROP CONSTRAINT IF EXISTS scanner_scans_capture_method_valid;
ALTER TABLE public.scanner_scans
    ADD CONSTRAINT scanner_scans_capture_method_valid
    CHECK (capture_method IN ('VIDEO_UPLOAD', 'VIDEO_CAPTURE', 'DEVICE_LIDAR', 'DEVICE_TRUEDEPTH'));

-- Store the immutable on-device capture provenance (frame stats, device model,
-- scanner type, durations, clinician note, …) exactly as the app produced it.
ALTER TABLE public.scanner_scans ADD COLUMN IF NOT EXISTS device_metadata JSONB;

-- Allow storing the raw point cloud alongside the reconstructed mesh.
ALTER TABLE public.scanner_assets DROP CONSTRAINT IF EXISTS scanner_assets_kind_valid;
ALTER TABLE public.scanner_assets
    ADD CONSTRAINT scanner_assets_kind_valid CHECK (kind IN (
        'INPUT_VIDEO', 'RAW_RECONSTRUCTION', 'RAW_POINT_CLOUD', 'SUBJECT_ISOLATED',
        'ORIENTED_SUBJECT', 'CALIBRATED_MODEL', 'PROCESSED_MODEL', 'FINAL_EXPORT'));
