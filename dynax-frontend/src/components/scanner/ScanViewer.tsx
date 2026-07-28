'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Box, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { scannerApi } from '@/hooks/useScanner';
import { type ViewerHandle } from '@/components/3d/ModelViewer';

const ModelViewer = dynamic(() => import('@/components/3d/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

// Loads an owned asset (with JWT) as an object URL and renders it. The reconstructed
// OBJ has no material file, so the viewer shades it with a neutral clay colour.
export function ScanViewer({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    setUrl(null);
    setError(null);
    scannerApi
      .assetObjectUrl(assetId)
      .then((u) => {
        if (!active) { URL.revokeObjectURL(u); return; }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => active && setError('Could not load the 3D model.'));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-slate-900">
      {error ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
          <Box className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      ) : !url ? (
        <div className="flex h-full items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <ModelViewer
            apiRef={viewerRef}
            modelUrl={url}
            readOnly
            params={{ modelColor: '#cbd5e1', background: '#0f172a', autoRotate: true, showGrid: true }}
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            <ViewerButton onClick={() => viewerRef.current?.zoomIn()} label="Zoom in"><ZoomIn className="h-4 w-4" /></ViewerButton>
            <ViewerButton onClick={() => viewerRef.current?.zoomOut()} label="Zoom out"><ZoomOut className="h-4 w-4" /></ViewerButton>
            <ViewerButton onClick={() => viewerRef.current?.resetView()} label="Reset view"><RotateCcw className="h-4 w-4" /></ViewerButton>
          </div>
        </>
      )}
    </div>
  );
}

function ViewerButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-xl border border-white/10 bg-white/10 p-2 text-white backdrop-blur-md transition hover:bg-white/20"
    >
      {children}
    </button>
  );
}
