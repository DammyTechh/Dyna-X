'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, UploadCloud, Video, FileVideo, X, Loader2, Sparkles } from 'lucide-react';
import { useCaptureConfig, useCreateScan, useStartReconstruction, scannerApi } from '@/hooks/useScanner';
import { CameraRecorder, cameraRecordingSupported } from '@/components/scanner/CameraRecorder';
import { ANATOMICAL_REGIONS, type ReconstructionMode } from '@/types/scanner';
import { cn } from '@/lib/utils';


export default function NewScanPage() {
  const router = useRouter();
  const { data: config } = useCaptureConfig();
  const createScan = useCreateScan();
  const startReconstruction = useStartReconstruction();

  const [subject, setSubject] = useState('');
  const [region, setRegion] = useState(ANATOMICAL_REGIONS[0].value);
  const [mode, setMode] = useState<ReconstructionMode>('STANDARD');
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<'idle' | 'creating' | 'uploading' | 'starting'>('idle');
  const [percent, setPercent] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const busy = step !== 'idle';
  const maxSeconds = Math.round((config?.captureMaxDurationMs ?? 180000) / 1000);
  const canRecord = cameraRecordingSupported();

  function pick(f: File | null) {
    if (!f) return;
    if (f.type && !f.type.startsWith('video/')) {
      toast.error('Please choose a video file.');
      return;
    }
    if (config && f.size > config.maxUploadBytes) {
      toast.error('That video is larger than the allowed size.');
      return;
    }
    setFile(f);
  }

  async function submit() {
    if (!file) { toast.error('Add a capture video first.'); return; }
    if (!subject.trim()) { toast.error('Give the scan a subject name.'); return; }
    try {
      setStep('creating');
      const scan = await createScan.mutateAsync({
        subjectDisplayName: subject.trim(),
        anatomicalRegion: region,
        reconstructionMode: mode,
        captureMethod: 'VIDEO_UPLOAD',
      });
      setStep('uploading');
      setPercent(0);
      await scannerApi.uploadInput(scan.id, file, setPercent);
      setStep('starting');
      await startReconstruction.mutateAsync(scan.id);
      toast.success('Reconstruction started');
      router.push(`/scanner/${scan.id}`);
    } catch (e) {
      setStep('idle');
      toast.error(e instanceof Error ? e.message : 'Could not start the scan.');
    }
  }

  return (
    <>
      <div className="p-4 sm:p-6 mx-auto max-w-3xl">
        <Link
          href="/scanner"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to scans
        </Link>

        <h1 className="mb-1 text-2xl font-bold text-slate-900">New 3D scan</h1>
        <p className="mb-8 text-sm text-slate-500">
          Capture or upload a short, slow orbit video of the anatomy. DynaX reconstructs a 3D model you can review and export.
        </p>

        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Subject */}
          <Field label="Subject name">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. John D. — left residual limb"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </Field>

          {/* Region + mode */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Anatomical region">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              >
                {ANATOMICAL_REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Reconstruction mode">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ReconstructionMode)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              >
                <option value="STANDARD">Standard (photo)</option>
                <option value="FEATURELESS_EXPERIMENTAL">Featureless (experimental)</option>
              </select>
            </Field>
          </div>

          {/* Capture video */}
          <Field label="Capture video">
            {file ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileVideo className="h-5 w-5 shrink-0 text-teal-600" />
                  <span className="truncate text-sm text-slate-700">{file.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{(file.size / 1_048_576).toFixed(1)} MB</span>
                </div>
                <button onClick={() => setFile(null)} disabled={busy} className="rounded-lg p-1 text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0] ?? null); }}
                className={cn(
                  'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
                  dragOver ? 'border-teal-400 bg-teal-50' : 'border-slate-300 bg-slate-50',
                )}
              >
                <UploadCloud className="mb-3 h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600">
                  Drag a video here, or{' '}
                  <button onClick={() => inputRef.current?.click()} className="font-semibold text-teal-600 hover:underline">browse</button>
                </p>
                <p className="mt-1 text-xs text-slate-400">Any capture video{config ? `, up to ${Math.round(config.maxUploadBytes / 1_048_576)} MB` : ''}</p>
                {canRecord && (
                  <button
                    onClick={() => setRecording(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Video className="h-4 w-4" /> Record now
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
          </Field>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={busy || !file}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {step === 'creating' && 'Creating scan…'}
                {step === 'uploading' && `Uploading… ${percent}%`}
                {step === 'starting' && 'Starting reconstruction…'}
              </>
            ) : (
              <><Sparkles className="h-4 w-4" /> Create & reconstruct</>
            )}
          </button>
          {step === 'uploading' && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      </div>

      {recording && (
        <CameraRecorder
          maxSeconds={maxSeconds}
          onClose={() => setRecording(false)}
          onRecorded={(f) => { setRecording(false); pick(f); }}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
