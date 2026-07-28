'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, Download, Loader2, RefreshCw, AlertTriangle, Sparkles, Box } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useScan, useStartReconstruction, scannerApi } from '@/hooks/useScanner';
import { ScanStatusBadge, isProcessing } from '@/components/scanner/ScanStatus';
import { ScanViewer } from '@/components/scanner/ScanViewer';
import { ANATOMICAL_REGIONS } from '@/types/scanner';

function regionLabel(value: string): string {
  return ANATOMICAL_REGIONS.find((r) => r.value === value)?.label ?? value ?? 'Scan';
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: scan, isLoading } = useScan(id);
  const retry = useStartReconstruction();
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!scan?.activeAssetId) return;
    try {
      setDownloading(true);
      const url = await scannerApi.assetObjectUrl(scan.activeAssetId);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scan.subjectDisplayName || 'scan'}.obj`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard/professional/scanner"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to scans
        </Link>

        {isLoading || !scan ? (
          <div className="flex justify-center py-24 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{scan.subjectDisplayName || 'Untitled scan'}</h1>
                  <ScanStatusBadge state={scan.reconstructionState} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {regionLabel(scan.anatomicalRegion)} · {format(new Date(scan.createdAt), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
              {scan.reconstructionState === 'COMPLETE' && scan.activeAssetId && (
                <button
                  onClick={download}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download model
                </button>
              )}
            </div>

            {/* Body */}
            {scan.reconstructionState === 'COMPLETE' && scan.activeAssetId ? (
              <div className="h-[60vh] min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
                <ScanViewer assetId={scan.activeAssetId} />
              </div>
            ) : isProcessing(scan.reconstructionState) ? (
              <ProcessingCard />
            ) : scan.reconstructionState === 'FAILED' ? (
              <FailedCard
                message={scan.errorMessage}
                retrying={retry.isPending}
                onRetry={() => retry.mutate(scan.id, {
                  onSuccess: () => toast.success('Reconstruction restarted'),
                  onError: (e) => toast.error(e instanceof Error ? e.message : 'Retry failed'),
                })}
              />
            ) : (
              <NotStartedCard />
            )}

            {/* Safety note */}
            <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-inset ring-amber-100">
              Reconstructed models are not automatically scale-verified or clinically validated. Confirm dimensions before clinical use.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ProcessingCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-teal-50/40 py-20 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-teal-400/30" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-slate-700 text-white">
          <Sparkles className="h-8 w-8" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Reconstructing your model…</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        This can take a few minutes. The page updates automatically when your 3D model is ready.
      </p>
    </div>
  );
}

function FailedCard({ message, retrying, onRetry }: { message?: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50/50 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Reconstruction failed</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message || 'The reconstruction service could not generate a model from this capture.'}</p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try again
      </button>
    </div>
  );
}

function NotStartedCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center text-slate-500">
      <Box className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm">This scan has no reconstruction yet.</p>
    </div>
  );
}
