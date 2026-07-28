'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Circle, Square, X, Loader2 } from 'lucide-react';

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

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
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
          {recording && (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {mm}:{ss}
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
