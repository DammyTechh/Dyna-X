package scanner

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// Service owns the scan lifecycle and reconstruction orchestration.
type Service struct {
	repo       *Repository
	store      StoragePort
	provider   Provider
	normalizer *Normalizer
}

// NewService wires the repository, filesystem storage, and the configured
// reconstruction provider (mock unless DYNASCAN_PROVIDER=kiri).
func NewService(pool *db.Pool) *Service {
	var provider Provider = MockProvider{}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("DYNASCAN_PROVIDER")), "kiri") {
		provider = NewKiriProvider()
	}
	return &Service{repo: NewRepository(pool), store: NewFilesystemStore(), provider: provider, normalizer: NewNormalizer()}
}

var (
	errNotFound     = errors.New("scan not found")
	errNoInput      = errors.New("no input video has been uploaded for this scan")
	errBusy         = errors.New("a reconstruction is already in progress")
	errBadInputType = errors.New("a video capture file is required")

	errMeshRequired = errors.New("a reconstructed mesh file is required")
	errBadMetadata  = errors.New("invalid scan metadata")
	errBadSegment   = errors.New("unrecognized body segment")
	errBadScanner   = errors.New("unrecognized scanner type")
)

func (s *Service) CreateScan(ctx context.Context, ownerID string, in CreateScanInput) (*ScanSession, error) {
	mode := ModeStandard
	if in.ReconstructionMode == ModeFeatureless {
		mode = ModeFeatureless
	}
	method := "VIDEO_UPLOAD"
	if in.CaptureMethod == "VIDEO_CAPTURE" {
		method = "VIDEO_CAPTURE"
	}
	scan := &ScanSession{
		ID:                      uuidV4(),
		OwnerID:                 ownerID,
		PatientID:               in.PatientID,
		CaseRef:                 in.CaseRef,
		SubjectDisplayName:      strings.TrimSpace(in.SubjectDisplayName),
		AnatomicalRegion:        strings.TrimSpace(in.AnatomicalRegion),
		AlignmentTemplateID:     strings.TrimSpace(in.AlignmentTemplateID),
		CaptureMethod:           method,
		ReconstructionMode:      mode,
		AcquisitionState:        AcqDraft,
		ReconstructionState:     ReconNotStarted,
		ScaleState:              "UNKNOWN",
		GeometryQualityState:    "NOT_ASSESSED",
		ClinicalValidationState: "NOT_VALIDATED",
	}
	if err := s.repo.CreateScan(ctx, scan); err != nil {
		return nil, err
	}
	return s.repo.GetScan(ctx, ownerID, scan.ID)
}

func (s *Service) ListScans(ctx context.Context, ownerID string) ([]ScanSession, error) {
	return s.repo.ListScans(ctx, ownerID)
}

func (s *Service) GetScan(ctx context.Context, ownerID, id string) (*ScanSession, error) {
	scan, err := s.repo.GetScan(ctx, ownerID, id)
	if err != nil {
		return nil, errNotFound
	}
	return scan, nil
}

// SaveInput stores an uploaded video and marks the scan ready to reconstruct.
func (s *Service) SaveInput(ctx context.Context, ownerID, scanID string, data []byte, mediaType, fileName string) (*ScanAsset, error) {
	scan, err := s.repo.GetScan(ctx, ownerID, scanID)
	if err != nil {
		return nil, errNotFound
	}
	if !strings.HasPrefix(mediaType, "video/") {
		return nil, errBadInputType
	}
	assetID := uuidV4()
	key := scan.ID + "/" + assetID + "-" + safeFileName(fileName)
	if err := s.store.Put(key, data); err != nil {
		return nil, err
	}
	asset := &ScanAsset{
		ID: assetID, ScanSessionID: scan.ID, Kind: KindInputVideo,
		FileName: safeFileName(fileName), MediaType: mediaType, StorageKey: key, ByteSize: int64(len(data)),
	}
	if err := s.repo.InsertAsset(ctx, asset); err != nil {
		return nil, err
	}
	_ = s.repo.SetAcquisition(ctx, scan.ID, AcqReady)
	return asset, nil
}

// StartReconstruction submits the input video to the provider and imports the
// result in the background. The client polls GetScan for the state transition.
func (s *Service) StartReconstruction(ctx context.Context, ownerID, scanID string) (*ScanSession, error) {
	scan, err := s.repo.GetScan(ctx, ownerID, scanID)
	if err != nil {
		return nil, errNotFound
	}
	if scan.ReconstructionState == ReconQueued || scan.ReconstructionState == ReconProcessing {
		return nil, errBusy
	}
	input, err := s.repo.GetLatestAssetByKind(ctx, scan.ID, KindInputVideo)
	if err != nil {
		return nil, errNoInput
	}
	_ = s.repo.SetReconstruction(ctx, scan.ID, ReconQueued, nil, nil)

	// Transcode (if needed) + submit + poll run detached so the request returns
	// immediately; the client polls GetScan for the state transitions.
	go s.submitAndPoll(scan.ID, scan.ReconstructionMode, input.StorageKey, input.MediaType, input.FileName)

	return s.repo.GetScan(ctx, ownerID, scan.ID)
}

// submitAndPoll normalizes the input to MP4, submits it to the provider, and then
// polls until the model is ready. Detached; failures are recorded on the scan.
func (s *Service) submitAndPoll(scanID, mode, storageKey, mediaType, fileName string) {
	defer func() { _ = recover() }()
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Minute)
	defer cancel()

	fail := func(code, msg string) {
		_ = s.repo.SetReconstruction(ctx, scanID, ReconFailed, &code, &msg)
	}

	data, err := s.store.Get(storageKey)
	if err != nil {
		fail("INPUT_UNREADABLE", "the input video could not be read")
		return
	}
	mp4, mp4Name, err := s.normalizer.EnsureMP4(ctx, data, mediaType, fileName)
	if err != nil {
		fail("VIDEO_CONVERSION_FAILED", err.Error())
		return
	}
	privateID, err := s.provider.CreateJob(ctx, mp4, "video/mp4", mp4Name, mode)
	if err != nil {
		fail("PROVIDER_SUBMISSION_FAILED", err.Error())
		return
	}
	job := &ReconstructionJob{ID: uuidV4(), ScanSessionID: scanID, ProviderKey: s.provider.Key(), PrivateProviderJobID: privateID, State: ReconQueued}
	_ = s.repo.InsertJob(ctx, job)

	s.pollAndImport(ctx, job, scanID)
}

// pollAndImport polls provider status until the result is ready (or fails /
// times out) and imports the reconstructed model. Uses the caller's context.
func (s *Service) pollAndImport(ctx context.Context, job *ReconstructionJob, scanID string) {
	for {
		select {
		case <-ctx.Done():
			msg := "reconstruction timed out"
			code := "PROVIDER_TIMEOUT"
			_ = s.repo.SetReconstruction(ctx, scanID, ReconFailed, &code, &msg)
			_ = s.repo.SetJobState(ctx, job.ID, ReconFailed, false)
			return
		case <-time.After(4 * time.Second):
		}

		status, err := s.provider.GetStatus(ctx, job.PrivateProviderJobID)
		if err != nil {
			continue // transient; keep polling until timeout
		}
		switch status {
		case "PROCESSING", "QUEUED":
			_ = s.repo.SetReconstruction(ctx, scanID, ReconProcessing, nil, nil)
		case "FAILED":
			msg := "the reconstruction service could not generate a model"
			code := "PROVIDER_RECONSTRUCTION_FAILED"
			_ = s.repo.SetReconstruction(ctx, scanID, ReconFailed, &code, &msg)
			_ = s.repo.SetJobState(ctx, job.ID, ReconFailed, false)
			return
		case "COMPLETE":
			result, err := s.provider.GetResult(ctx, job.PrivateProviderJobID)
			if err != nil {
				msg := err.Error()
				code := "PROVIDER_RESULT_FAILED"
				_ = s.repo.SetReconstruction(ctx, scanID, ReconFailed, &code, &msg)
				_ = s.repo.SetJobState(ctx, job.ID, ReconFailed, false)
				return
			}
			assetID := uuidV4()
			key := scanID + "/" + assetID + "-" + result.FileName
			if err := s.store.Put(key, result.Bytes); err != nil {
				msg := "failed to store reconstructed model"
				code := "STORAGE_FAILED"
				_ = s.repo.SetReconstruction(ctx, scanID, ReconFailed, &code, &msg)
				return
			}
			asset := &ScanAsset{ID: assetID, ScanSessionID: scanID, Kind: KindRawReconstruction,
				FileName: result.FileName, MediaType: result.MediaType, StorageKey: key, ByteSize: int64(len(result.Bytes))}
			_ = s.repo.InsertAsset(ctx, asset)
			_ = s.repo.SetActiveAsset(ctx, scanID, assetID)
			_ = s.repo.SetReconstruction(ctx, scanID, ReconComplete, nil, nil)
			_ = s.repo.SetJobState(ctx, job.ID, ReconComplete, true)
			return
		}
	}
}

var (
	deviceBodySegments = map[string]bool{
		"residual_limb_tt": true, "residual_limb_tf": true, "foot": true, "hand": true,
		"lower_leg": true, "upper_limb": true, "torso": true, "spinal_region": true, "generic": true,
	}
	deviceScannerTypes = map[string]bool{"lidar": true, "trueDepth": true, "none": true}
)

// IngestDeviceScan stores a finished on-device (LiDAR/TrueDepth) reconstruction:
// the mesh, the optional raw point cloud, and the verbatim capture metadata.
func (s *Service) IngestDeviceScan(ctx context.Context, ownerID string, metaRaw, meshBytes []byte, meshName, meshType string, pcBytes []byte, pcName string) (*ScanSession, error) {
	if len(meshBytes) == 0 {
		return nil, errMeshRequired
	}
	var meta DeviceScanMetadata
	if len(metaRaw) > 0 {
		if err := json.Unmarshal(metaRaw, &meta); err != nil {
			return nil, errBadMetadata
		}
	}
	if meta.BodySegment != "" && !deviceBodySegments[meta.BodySegment] {
		return nil, errBadSegment
	}
	if meta.ScannerType != "" && !deviceScannerTypes[meta.ScannerType] {
		return nil, errBadScanner
	}

	capture := CaptureDeviceLiDAR
	if meta.ScannerType == "trueDepth" {
		capture = CaptureDeviceTrueDepth
	}
	format := strings.ToLower(strings.TrimSpace(meta.ExportFormat))
	if format != "ply" {
		format = "obj"
	}

	scan := &ScanSession{
		ID:                      uuidV4(),
		OwnerID:                 ownerID,
		PatientID:               meta.PatientID,
		CaseRef:                 meta.CaseRef,
		SubjectDisplayName:      strings.TrimSpace(meta.SubjectDisplayName),
		AnatomicalRegion:        strings.TrimSpace(meta.AnatomicalRegion),
		CaptureMethod:           capture,
		ReconstructionMode:      ModeStandard,
		AcquisitionState:        AcqReady,
		ReconstructionState:     ReconComplete,
		ScaleState:              "UNKNOWN",
		GeometryQualityState:    "NOT_ASSESSED",
		ClinicalValidationState: "NOT_VALIDATED",
	}
	if len(metaRaw) == 0 {
		metaRaw = []byte("{}")
	}
	if err := s.repo.CreateDeviceScan(ctx, scan, metaRaw); err != nil {
		return nil, err
	}

	meshAssetID := uuidV4()
	meshFile := deviceFileName(meshName, "mesh."+format)
	meshKey := scan.ID + "/" + meshAssetID + "-" + meshFile
	if err := s.store.Put(meshKey, meshBytes); err != nil {
		return nil, err
	}
	if err := s.repo.InsertAsset(ctx, &ScanAsset{
		ID: meshAssetID, ScanSessionID: scan.ID, Kind: KindRawReconstruction,
		FileName: meshFile, MediaType: meshMediaType(format, meshType), StorageKey: meshKey, ByteSize: int64(len(meshBytes)),
	}); err != nil {
		return nil, err
	}
	_ = s.repo.SetActiveAsset(ctx, scan.ID, meshAssetID)

	if len(pcBytes) > 0 {
		pcAssetID := uuidV4()
		pcFile := deviceFileName(pcName, "point-cloud.ply")
		pcKey := scan.ID + "/" + pcAssetID + "-" + pcFile
		if err := s.store.Put(pcKey, pcBytes); err == nil {
			_ = s.repo.InsertAsset(ctx, &ScanAsset{
				ID: pcAssetID, ScanSessionID: scan.ID, Kind: KindRawPointCloud,
				FileName: pcFile, MediaType: "application/octet-stream", StorageKey: pcKey, ByteSize: int64(len(pcBytes)),
			})
		}
	}

	return s.repo.GetScan(ctx, ownerID, scan.ID)
}

func meshMediaType(format, provided string) string {
	if strings.TrimSpace(provided) != "" && provided != "application/octet-stream" {
		return provided
	}
	if format == "ply" {
		return "application/octet-stream"
	}
	return "model/obj"
}

func deviceFileName(name, fallback string) string {
	name = safeFileName(name)
	if name == "" || name == "input.mp4" {
		return fallback
	}
	return name
}

// AssetBytes returns a downloadable owned asset's bytes + metadata.
func (s *Service) AssetBytes(ctx context.Context, ownerID, assetID string) (*ScanAsset, []byte, error) {
	asset, err := s.repo.GetOwnedAsset(ctx, ownerID, assetID)
	if err != nil {
		return nil, nil, errNotFound
	}
	data, err := s.store.Get(asset.StorageKey)
	if err != nil {
		return nil, nil, errNotFound
	}
	return asset, data, nil
}

func safeFileName(name string) string {
	name = strings.ReplaceAll(strings.ReplaceAll(name, "\\", "_"), "/", "_")
	name = strings.NewReplacer("\r", "_", "\n", "_", " ", "_").Replace(strings.TrimSpace(name))
	if name == "" {
		return "input.mp4"
	}
	if len(name) > 120 {
		name = name[len(name)-120:]
	}
	return name
}
