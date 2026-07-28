// Package scanner ports the DynaX Scanner (DynaScan) backend — mobile video →
// 3D reconstruction via the KIRI Engine photogrammetry provider — into the
// single Go backend. It owns the scan lifecycle, reconstruction orchestration,
// asset storage, and DynaX identity/patient linking. Interactive mesh editing
// (crop/align/calibrate) stays client-side in the web viewer and is persisted
// here as derived assets in a later slice.
package scanner

import "time"

// Acquisition / reconstruction lifecycle states (mirror the TypeScript domain).
const (
	AcqDraft     = "DRAFT"
	AcqUploading = "UPLOADING"
	AcqReady     = "READY"
	AcqFailed    = "FAILED"

	ReconNotStarted = "NOT_STARTED"
	ReconQueued     = "QUEUED"
	ReconProcessing = "PROCESSING"
	ReconComplete   = "COMPLETE"
	ReconFailed     = "FAILED"

	ModeStandard    = "STANDARD"
	ModeFeatureless = "FEATURELESS_EXPERIMENTAL"

	KindInputVideo        = "INPUT_VIDEO"
	KindRawReconstruction = "RAW_RECONSTRUCTION"
	KindRawPointCloud     = "RAW_POINT_CLOUD"
	KindFinalExport       = "FINAL_EXPORT"

	CaptureVideoUpload     = "VIDEO_UPLOAD"
	CaptureDeviceLiDAR     = "DEVICE_LIDAR"
	CaptureDeviceTrueDepth = "DEVICE_TRUEDEPTH"
)

// ScanSession is one scan and its state across the pipeline.
type ScanSession struct {
	ID                      string    `json:"id"`
	OwnerID                 string    `json:"ownerId"`
	PatientID               *string   `json:"patientId,omitempty"`
	CaseRef                 *string   `json:"caseRef,omitempty"`
	SubjectDisplayName      string    `json:"subjectDisplayName"`
	AnatomicalRegion        string    `json:"anatomicalRegion"`
	AlignmentTemplateID     string    `json:"alignmentTemplateId"`
	CaptureMethod           string    `json:"captureMethod"`
	ReconstructionMode      string    `json:"reconstructionMode"`
	AcquisitionState        string    `json:"acquisitionState"`
	ReconstructionState     string    `json:"reconstructionState"`
	ScaleState              string    `json:"scaleState"`
	GeometryQualityState    string    `json:"geometryQualityState"`
	ClinicalValidationState string    `json:"clinicalValidationState"`
	ActiveAssetID           *string   `json:"activeAssetId,omitempty"`
	ErrorCode               *string   `json:"errorCode,omitempty"`
	ErrorMessage            *string   `json:"errorMessage,omitempty"`
	CreatedAt               time.Time `json:"createdAt"`
	UpdatedAt               time.Time `json:"updatedAt"`
}

// ScanAsset is a stored file (input video, reconstructed model, export).
type ScanAsset struct {
	ID            string    `json:"id"`
	ScanSessionID string    `json:"scanSessionId"`
	Kind          string    `json:"kind"`
	FileName      string    `json:"fileName"`
	MediaType     string    `json:"mediaType"`
	StorageKey    string    `json:"-"` // never exposed to clients
	ByteSize      int64     `json:"byteSize"`
	SourceAssetID *string   `json:"sourceAssetId,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

// ReconstructionJob tracks a provider-side reconstruction task.
type ReconstructionJob struct {
	ID                   string    `json:"id"`
	ScanSessionID        string    `json:"scanSessionId"`
	ProviderKey          string    `json:"providerKey"`
	PrivateProviderJobID string    `json:"-"`
	State                string    `json:"state"`
	SubmittedAt          time.Time `json:"submittedAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
	ResultImported       bool      `json:"resultImported"`
}

// CreateScanInput is the body accepted when creating a scan.
type CreateScanInput struct {
	SubjectDisplayName  string  `json:"subjectDisplayName"`
	AnatomicalRegion    string  `json:"anatomicalRegion"`
	AlignmentTemplateID string  `json:"alignmentTemplateId"`
	CaptureMethod       string  `json:"captureMethod"`
	ReconstructionMode  string  `json:"reconstructionMode"`
	PatientID           *string `json:"patientId,omitempty"`
	CaseRef             *string `json:"caseRef,omitempty"`
}

// DeviceScanMetadata is the known subset of the iOS ScanMetadata used to shape
// the scan record. The full metadata blob is stored verbatim in device_metadata.
type DeviceScanMetadata struct {
	ScanID             string  `json:"scanId"`
	BodySegment        string  `json:"bodySegment"`
	ScannerType        string  `json:"scannerType"`
	ClinicianNote      *string `json:"clinicianNote,omitempty"`
	ExportFormat       string  `json:"exportFormat"`
	SubjectDisplayName string  `json:"subjectDisplayName"`
	AnatomicalRegion   string  `json:"anatomicalRegion"`
	PatientID          *string `json:"patientId,omitempty"`
	CaseRef            *string `json:"caseRef,omitempty"`
}
