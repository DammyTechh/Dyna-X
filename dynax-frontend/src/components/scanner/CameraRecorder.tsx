'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, Circle, Square, X, Loader2,
  Crosshair, Sun, RotateCw, Smartphone, ArrowRight,
} from 'lucide-react';

// Live capture is available wherever the browser can record video. MP4 is used
// when supported (iOS Safari); elsewhere WebM is recorded and the backend
// transcodes it to MP4 for reconstruction.
export function cameraRecordingSupported(): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return false;
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function bestRecordingMime(): { mimeType: string; ext: string } {
  const candidates = [
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    } catch {
      /* ignore */
    }
  }
  return { mimeType: '', ext: 'webm' };
}

// Steps the operator acknowledges before the camera opens. Capture quality is
// what makes or breaks reconstruction, so the guidance comes first.
const SCAN_STEPS = [
  {
    icon: Crosshair,
    label: 'Position',
    body: 'Hold the limb upright and centred in frame. Keep 30–50cm distance from the subject.',
  },
  {
    icon: Sun,
    label: 'Lighting',
    body: 'Ensure even, bright lighting with no harsh shadows. Avoid direct sunlight or dark rooms.',
  },
  {
    icon: RotateCw,
    label: 'Movement',
    body: 'Move slowly in a complete orbit around the limb. One full circle in 30–60 seconds.',
  },
  {
    icon: Smartphone,
    label: 'Stability',
    body: 'Keep your phone steady and upright throughout. Do not tilt or shake the device.',
  },
] as const;

// Phase copy driven by how far through maxSeconds the recording is.
function scanPhase(pct: number): string {
  if (pct < 25) return 'Start at the base';
  if (pct < 50) return 'Move to the side';
  if (pct < 75) return 'Continue around';
  return 'Complete the orbit';
}

export function CameraRecorder({
  maxSeconds,
  onRecorded,
  onClose,
}: {
  maxSeconds: number;
  onRecorded: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // The guide is shown first; the camera is only requested once it's dismissed,
  // so the permission prompt doesn't appear behind the overlay.
  const [guideAck, setGuideAck] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (!guideAck) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError('Camera access was denied. You can upload a video instead.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [guideAck]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // Speed reminder surfaces for a few seconds every 10s while recording.
  useEffect(() => {
    if (!recording) {
      setShowTip(false);
      return;
    }
    let hide: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setShowTip(true);
      hide = setTimeout(() => setShowTip(false), 3500);
    }, 10000);
    return () => {
      clearInterval(id);
      clearTimeout(hide);
    };
  }, [recording]);

  const stop = useCallback(() => {
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    setRecording(false);
  }, []);

  useEffect(() => {
    if (recording && seconds >= maxSeconds) stop();
  }, [recording, seconds, maxSeconds, stop]);

  const start = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const { mimeType, ext } = bestRecordingMime();
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
    const outType = mimeType || 'video/webm';
    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: outType });
      const file = new File([blob], `capture-${Date.now()}.${ext}`, { type: outType });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onRecorded(file);
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setRecording(true);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const pct = maxSeconds > 0 ? Math.min(100, (seconds / maxSeconds) * 100) : 0;

  if (!guideAck) {
    return <ScanGuide onStart={() => setGuideAck(true)} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative aspect-[3/4] bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
              <Camera className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {/* Centre guide — where the limb should sit in frame. */}
          {ready && !error && (
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-3/5 w-1/2 rounded-[50%] border border-white/20">
                <span className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-white/20" />
                <span className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-white/20" />
              </div>
            </div>
          )}

          {/* Orbit guide — rotates clockwise to show the direction to walk. */}
          {recording && (
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 h-full w-full animate-[spin_9s_linear_infinite] text-teal-400/50"
            >
              <path
                d="M 50 6 A 44 44 0 0 1 94 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <polygon points="89,49 99,49 94,59" fill="currentColor" />
            </svg>
          )}

          {/* Progress bar — recording position against maxSeconds. */}
          {recording && (
            <div className="absolute inset-x-0 top-0 h-1 bg-white/15">
              <div
                className="h-full bg-teal-500 transition-[width] duration-500 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {recording && (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {mm}:{ss}
            </div>
          )}

          {/* Speed reminder — fades gently in and out every 10s. */}
          {recording && (
            <p
              role="status"
              className={`pointer-events-none absolute inset-x-0 top-16 text-center text-sm font-medium text-white/90 transition-opacity duration-1000 ${
                showTip ? 'animate-pulse opacity-100' : 'opacity-0'
              }`}
            >
              Keep it slow and steady
            </p>
          )}

          {/* Phase indicator. */}
          {recording && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-200 ring-1 ring-teal-400/40 backdrop-blur-md">
                {scanPhase(pct)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 p-6">
          {!recording ? (
            <button
              onClick={start}
              disabled={!ready}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 disabled:opacity-40"
              aria-label="Start recording"
            >
              <Circle className="h-7 w-7 fill-current" />
            </button>
          ) : (
            <button
              onClick={stop}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-red-500 shadow-lg transition hover:bg-slate-100"
              aria-label="Stop recording"
            >
              <Square className="h-6 w-6 fill-current" />
            </button>
          )}
        </div>
        <p className="pb-6 text-center text-xs text-slate-400">
          Slowly orbit the anatomy — keep it centred and evenly lit.
        </p>
      </div>
    </div>
  );
}

// Pre-scan checklist. Shown fullscreen before the camera is requested so the
// operator knows what a usable capture looks like.
function ScanGuide({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/95 backdrop-blur-sm">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Before you scan</h2>
          <p className="mt-1 text-sm text-slate-400">
            Four things that decide whether the 3D reconstruction succeeds.
          </p>
        </div>

        <ol className="space-y-3">
          {SCAN_STEPS.map((step, i) => (
            <li
              key={step.label}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
                <step.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
                  Step {i + 1} — {step.label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-400"
        >
          Got it — Start Camera
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
