import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import api from '@/lib/api';
import type {
  ScanSession, ScanAsset, CaptureConfig, CreateScanInput,
} from '@/types/scanner';

// ─── Query keys ───────────────────────────────────────────────────────────────
export const scannerKeys = {
  captureConfig: ['scanner', 'capture-config'] as const,
  scans: ['scanner', 'scans'] as const,
  scan: (id: string) => ['scanner', 'scan', id] as const,
};

// ─── API functions ────────────────────────────────────────────────────────────
export const scannerApi = {
  captureConfig: () => apiGet<CaptureConfig>('/scanner/capture/config'),
  listScans: () => apiGet<{ scans: ScanSession[] }>('/scanner/scans').then((d) => d.scans),
  getScan: (id: string) => apiGet<ScanSession>(`/scanner/scans/${id}`),
  createScan: (body: CreateScanInput) => apiPost<ScanSession>('/scanner/scans', body),
  startReconstruction: (id: string) => apiPost<ScanSession>(`/scanner/scans/${id}/reconstruction`, {}),

  uploadInput: async (
    id: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<ScanAsset> => {
    const { data } = await api.put(`/scanner/scans/${id}/input`, file, {
      params: { fileName: file.name },
      headers: { 'Content-Type': file.type || 'video/mp4' },
      timeout: 0,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    if (!data?.success) throw new Error(data?.error?.message || 'Upload failed');
    return data.data as ScanAsset;
  },

  // Download an owned asset as a blob (JWT is attached by the axios interceptor)
  // and return an object URL suitable for the 3D viewer. Caller revokes it.
  assetObjectUrl: async (assetId: string): Promise<string> => {
    const res = await api.get(`/scanner/assets/${assetId}/download`, { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
export const useCaptureConfig = () =>
  useQuery({ queryKey: scannerKeys.captureConfig, queryFn: scannerApi.captureConfig, staleTime: 5 * 60 * 1000 });

export const useScans = () =>
  useQuery({ queryKey: scannerKeys.scans, queryFn: scannerApi.listScans });

// Poll a scan while it is being reconstructed so the UI advances automatically.
export const useScan = (id: string) =>
  useQuery({
    queryKey: scannerKeys.scan(id),
    queryFn: () => scannerApi.getScan(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const s = query.state.data as ScanSession | undefined;
      if (!s) return 4000;
      return s.reconstructionState === 'QUEUED' || s.reconstructionState === 'PROCESSING' ? 4000 : false;
    },
  });

export const useCreateScan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: scannerApi.createScan,
    onSuccess: () => qc.invalidateQueries({ queryKey: scannerKeys.scans }),
  });
};

export const useStartReconstruction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => scannerApi.startReconstruction(id),
    onSuccess: (scan) => {
      qc.invalidateQueries({ queryKey: scannerKeys.scan(scan.id) });
      qc.invalidateQueries({ queryKey: scannerKeys.scans });
    },
  });
};
