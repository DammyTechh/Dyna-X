// Types for the DynaX Scanner (video → 3D + on-device scans).
// Mirrors the Go backend `internal/scanner` JSON shapes.

export type AcquisitionState = 'DRAFT' | 'UPLOADING' | 'NORMALIZING' | 'READY' | 'FAILED';
export type ReconstructionState =
  | 'NOT_STARTED' | 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
export type ReconstructionMode = 'STANDARD' | 'FEATURELESS_EXPERIMENTAL';

export interface ScanSession {
  id: string;
  ownerId: string;
  patientId?: string;
  caseRef?: string;
  subjectDisplayName: string;
  anatomicalRegion: string;
  alignmentTemplateId: string;
  captureMethod: string;
  reconstructionMode: ReconstructionMode;
  acquisitionState: AcquisitionState;
  reconstructionState: ReconstructionState;
  scaleState: string;
  geometryQualityState: string;
  clinicalValidationState: string;
  activeAssetId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanAsset {
  id: string;
  scanSessionId: string;
  kind: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  sourceAssetId?: string;
  createdAt: string;
}

export interface CaptureConfig {
  captureMinDurationMs: number;
  captureMaxDurationMs: number;
  maxUploadBytes: number;
  acceptedMediaTypes: string[];
  reconstructionModes: ReconstructionMode[];
}

export interface CreateScanInput {
  subjectDisplayName: string;
  anatomicalRegion: string;
  reconstructionMode: ReconstructionMode;
  captureMethod?: string;
  patientId?: string;
  caseRef?: string;
}

// Anatomical regions offered in the web capture form. Values are free-form on the
// backend; these keep the web + native apps aligned on labels.
export const ANATOMICAL_REGIONS: { value: string; label: string }[] = [
  { value: 'residual_limb_tt', label: 'Residual Limb (Below Knee)' },
  { value: 'residual_limb_tf', label: 'Residual Limb (Above Knee)' },
  { value: 'foot', label: 'Foot & Ankle' },
  { value: 'hand', label: 'Hand & Wrist' },
  { value: 'lower_leg', label: 'Lower Leg' },
  { value: 'upper_limb', label: 'Upper Limb' },
  { value: 'torso', label: 'Torso' },
  { value: 'spinal_region', label: 'Spinal Region' },
  { value: 'generic', label: 'Other / Generic' },
];
