import { apiClient } from './client';
import type { ReconstructionState } from '@/theme';

export interface ScanSession {
  id: string;
  ownerId: string;
  subjectDisplayName: string;
  anatomicalRegion: string;
  reconstructionMode: string;
  acquisitionState: string;
  reconstructionState: ReconstructionState;
  activeAssetId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureConfig {
  captureMinDurationMs: number;
  captureMaxDurationMs: number;
  maxUploadBytes: number;
  acceptedMediaTypes: string[];
  reconstructionModes: string[];
}

export interface CreateScanInput {
  subjectDisplayName: string;
  anatomicalRegion: string;
  reconstructionMode: string;
  captureMethod?: string;
}

export const scannerApi = {
  captureConfig: () => apiClient.get<CaptureConfig>('/scanner/capture/config'),
  listScans: () => apiClient.get<{ scans: ScanSession[] }>('/scanner/scans').then((d) => d.scans),
  getScan: (id: string) => apiClient.get<ScanSession>(`/scanner/scans/${id}`),
  createScan: (body: CreateScanInput) => apiClient.post<ScanSession>('/scanner/scans', body),
  startReconstruction: (id: string) => apiClient.post<ScanSession>(`/scanner/scans/${id}/reconstruction`),
  uploadInput: (id: string, fileUri: string, mimeType: string) =>
    apiClient.putVideo<{ id: string }>(`/scanner/scans/${id}/input?fileName=capture.${ext(mimeType)}`, fileUri, mimeType),
};

function ext(mimeType: string): string {
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('webm')) return 'webm';
  return 'mp4';
}
