package scanner

import (
	"context"
	"encoding/json"

	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// Repository is the scanner module's data access over the shared pool.
type Repository struct{ db *db.Pool }

// NewRepository builds a scanner Repository.
func NewRepository(pool *db.Pool) *Repository { return &Repository{db: pool} }

const scanColumns = `id, owner_id, patient_id, case_ref, subject_display_name, anatomical_region,
	alignment_template_id, capture_method, reconstruction_mode, acquisition_state, reconstruction_state,
	scale_state, geometry_quality_state, clinical_validation_state, active_asset_id, error_code, error_message,
	created_at, updated_at`

type scanRow interface {
	Scan(dest ...interface{}) error
}

func scanSession(row scanRow) (*ScanSession, error) {
	var s ScanSession
	if err := row.Scan(&s.ID, &s.OwnerID, &s.PatientID, &s.CaseRef, &s.SubjectDisplayName, &s.AnatomicalRegion,
		&s.AlignmentTemplateID, &s.CaptureMethod, &s.ReconstructionMode, &s.AcquisitionState, &s.ReconstructionState,
		&s.ScaleState, &s.GeometryQualityState, &s.ClinicalValidationState, &s.ActiveAssetID, &s.ErrorCode, &s.ErrorMessage,
		&s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) CreateScan(ctx context.Context, s *ScanSession) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.scanner_scans
		 (id, owner_id, patient_id, case_ref, subject_display_name, anatomical_region, alignment_template_id,
		  capture_method, reconstruction_mode, acquisition_state, reconstruction_state, scale_state,
		  geometry_quality_state, clinical_validation_state, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())`,
		s.ID, s.OwnerID, s.PatientID, s.CaseRef, s.SubjectDisplayName, s.AnatomicalRegion, s.AlignmentTemplateID,
		s.CaptureMethod, s.ReconstructionMode, s.AcquisitionState, s.ReconstructionState, s.ScaleState,
		s.GeometryQualityState, s.ClinicalValidationState)
	return err
}

// CreateDeviceScan inserts an already-reconstructed on-device scan (LiDAR /
// TrueDepth) with its verbatim capture metadata.
func (r *Repository) CreateDeviceScan(ctx context.Context, s *ScanSession, deviceMetadata []byte) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.scanner_scans
		 (id, owner_id, patient_id, case_ref, subject_display_name, anatomical_region, alignment_template_id,
		  capture_method, reconstruction_mode, acquisition_state, reconstruction_state, scale_state,
		  geometry_quality_state, clinical_validation_state, device_metadata, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
		s.ID, s.OwnerID, s.PatientID, s.CaseRef, s.SubjectDisplayName, s.AnatomicalRegion, s.AlignmentTemplateID,
		s.CaptureMethod, s.ReconstructionMode, s.AcquisitionState, s.ReconstructionState, s.ScaleState,
		s.GeometryQualityState, s.ClinicalValidationState, deviceMetadata)
	return err
}

func (r *Repository) ListScans(ctx context.Context, ownerID string) ([]ScanSession, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+scanColumns+` FROM public.scanner_scans WHERE owner_id=$1 ORDER BY created_at DESC`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ScanSession{}
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func (r *Repository) GetScan(ctx context.Context, ownerID, id string) (*ScanSession, error) {
	return scanSession(r.db.QueryRow(ctx,
		`SELECT `+scanColumns+` FROM public.scanner_scans WHERE owner_id=$1 AND id=$2`, ownerID, id))
}

func (r *Repository) SetAcquisition(ctx context.Context, id, acqState string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE public.scanner_scans SET acquisition_state=$2, updated_at=NOW() WHERE id=$1`, id, acqState)
	return err
}

func (r *Repository) SetReconstruction(ctx context.Context, id, reconState string, errCode, errMsg *string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE public.scanner_scans SET reconstruction_state=$2, error_code=$3, error_message=$4, updated_at=NOW() WHERE id=$1`,
		id, reconState, errCode, errMsg)
	return err
}

func (r *Repository) SetActiveAsset(ctx context.Context, id, assetID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE public.scanner_scans SET active_asset_id=$2, updated_at=NOW() WHERE id=$1`, id, assetID)
	return err
}

func (r *Repository) InsertAsset(ctx context.Context, a *ScanAsset) error {
	meta, _ := json.Marshal(map[string]any{})
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.scanner_assets
		 (id, scan_id, kind, file_name, media_type, storage_key, byte_size, source_asset_id, metadata, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
		a.ID, a.ScanSessionID, a.Kind, a.FileName, a.MediaType, a.StorageKey, a.ByteSize, a.SourceAssetID, meta)
	return err
}

// GetOwnedAsset returns an asset only if it belongs to a scan owned by ownerID.
func (r *Repository) GetOwnedAsset(ctx context.Context, ownerID, assetID string) (*ScanAsset, error) {
	var a ScanAsset
	err := r.db.QueryRow(ctx,
		`SELECT a.id, a.scan_id, a.kind, a.file_name, a.media_type, a.storage_key, a.byte_size, a.source_asset_id, a.created_at
		 FROM public.scanner_assets a
		 JOIN public.scanner_scans s ON s.id = a.scan_id
		 WHERE a.id=$1 AND s.owner_id=$2`, assetID, ownerID).
		Scan(&a.ID, &a.ScanSessionID, &a.Kind, &a.FileName, &a.MediaType, &a.StorageKey, &a.ByteSize, &a.SourceAssetID, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// GetLatestAssetByKind returns the most recent asset of a kind for a scan.
func (r *Repository) GetLatestAssetByKind(ctx context.Context, scanID, kind string) (*ScanAsset, error) {
	var a ScanAsset
	err := r.db.QueryRow(ctx,
		`SELECT id, scan_id, kind, file_name, media_type, storage_key, byte_size, source_asset_id, created_at
		 FROM public.scanner_assets WHERE scan_id=$1 AND kind=$2 ORDER BY created_at DESC LIMIT 1`, scanID, kind).
		Scan(&a.ID, &a.ScanSessionID, &a.Kind, &a.FileName, &a.MediaType, &a.StorageKey, &a.ByteSize, &a.SourceAssetID, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) InsertJob(ctx context.Context, j *ReconstructionJob) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO public.scanner_jobs (id, scan_id, provider_key, private_provider_job_id, state, submitted_at, updated_at, result_imported)
		 VALUES ($1,$2,$3,$4,$5,NOW(),NOW(),FALSE)`,
		j.ID, j.ScanSessionID, j.ProviderKey, j.PrivateProviderJobID, j.State)
	return err
}

func (r *Repository) SetJobState(ctx context.Context, id, state string, resultImported bool) error {
	_, err := r.db.Exec(ctx,
		`UPDATE public.scanner_jobs SET state=$2, result_imported=$3, updated_at=NOW() WHERE id=$1`, id, state, resultImported)
	return err
}
