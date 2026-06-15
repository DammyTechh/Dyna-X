'use client';

import { useState } from 'react';
import { MessageCircle, Send, Eye, Edit3, Lock, Loader2, X, SlidersHorizontal, RotateCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { tokenStore } from '@/lib/api';
import {
  useSharedDevice, useDeviceComments, useAddDeviceCommentById,
} from '@/hooks/useApi';
import dynamic from 'next/dynamic';
import { type ViewerParams } from '@/components/3d/ModelViewer';
const ModelViewer = dynamic(() => import('@/components/3d/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
    </div>
  ),
});

type Permission = 'view' | 'comment' | 'annotate';

const DEFAULT_PARAMS: ViewerParams = {
  wireframe: false, modelColor: '#94a3b8', opacity: 1, scale: 1, rotationY: 0,
  autoRotate: false, background: '#0f172a', showGrid: false, lightIntensity: 1,
};

export default function SharePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const { data, isLoading, error } = useSharedDevice(token);

  const device = (data?.device || {}) as Record<string, unknown>;
  const deviceId = typeof device.id === 'string' ? device.id : undefined;
  const modelUrl = typeof device.model_3d_url === 'string' ? device.model_3d_url : undefined;
  const deviceType = typeof device.device_type === 'string' ? device.device_type : '';
  const bodyRegion = typeof device.body_region === 'string' ? device.body_region : '';
  const caseName = (typeof device.notes === 'string' && device.notes) ||
    (deviceType ? `${deviceType}${bodyRegion ? ' — ' + bodyRegion : ''}` : 'Shared 3D scan');
  const permission = ((data?.permission as Permission) || 'view') as Permission;

  const isLoggedIn = !!tokenStore.getAccess?.();
  const canComment = (permission === 'comment' || permission === 'annotate');
  const canAnnotate = permission === 'annotate';

  const [showComments, setShowComments] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [text, setText] = useState('');
  const [viewParams, setViewParams] = useState<ViewerParams>(DEFAULT_PARAMS);
  const setParam = <K extends keyof ViewerParams>(k: K, v: ViewerParams[K]) =>
    setViewParams((prev) => ({ ...prev, [k]: v }));

  // Server-backed comments (only fetch when allowed + signed in).
  const { data: serverComments } = useDeviceComments(
    canComment && isLoggedIn ? deviceId : undefined,
  );
  const addComment = useAddDeviceCommentById();

  const PERM_LABELS: Record<Permission, { label: string; icon: React.ElementType; color: string }> = {
    view: { label: 'View only', icon: Eye, color: 'bg-slate-700 text-slate-300' },
    comment: { label: 'Can comment', icon: MessageCircle, color: 'bg-purple-900/60 text-purple-300' },
    annotate: { label: 'Can edit & annotate', icon: Edit3, color: 'bg-blue-900/60 text-blue-300' },
  };
  const perm = PERM_LABELS[permission];
  const PermIcon = perm.icon;

  const submitComment = async () => {
    if (!text.trim() || !deviceId) return;
    try {
      await addComment.mutateAsync({ deviceId, content: text.trim() });
      setText('');
    } catch {
      /* surfaced below */
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading shared scan…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <Lock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h1 className="text-white font-semibold mb-1">Link unavailable</h1>
          <p className="text-slate-400 text-sm">This share link is invalid or has expired. Ask the owner to send a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <Logo asLink={false} size={26} light />
          <div>
            <p className="text-sm font-semibold truncate max-w-[200px] md:max-w-none">{caseName}</p>
            <p className="text-xs text-slate-400">Shared on DynaX</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', perm.color)}>
            <PermIcon className="w-3.5 h-3.5" />
            {perm.label}
          </span>
          {canAnnotate && (
            <button
              onClick={() => { setShowProps((v) => !v); setShowComments(false); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                showProps ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {canComment && (
            <button
              onClick={() => { setShowComments(!showComments); setShowProps(false); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                showComments ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Comments{serverComments ? ` (${serverComments.length})` : ''}
            </button>
          )}
        </div>
      </div>

      {permission === 'view' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5" />
          You have view-only access to this scan.
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {/* 3D viewer (always full-size; panels overlay it) */}
        <div className="absolute inset-0">
          {modelUrl ? (
            <ModelViewer modelUrl={modelUrl} readOnly={!canAnnotate} params={viewParams} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6">
              <p className="text-slate-400 text-sm max-w-xs">
                This shared record has no 3D model attached.
              </p>
            </div>
          )}
        </div>

        {/* Properties / editing panel (annotate permission) */}
        {showProps && canAnnotate && (
          <div className="absolute inset-y-0 right-0 z-40 w-full max-w-sm bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Edit &amp; Annotate</h3>
              <button onClick={() => setShowProps(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <SToggle label="Wireframe" value={viewParams.wireframe} onChange={(v) => setParam('wireframe', v)} />
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Surface colour</label>
                <input type="color" value={viewParams.modelColor}
                  onChange={(e) => setParam('modelColor', e.target.value)}
                  className="w-full h-9 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer" />
              </div>
              <SSlider label="Opacity" value={viewParams.opacity} min={0.1} max={1} step={0.05}
                display={`${Math.round(viewParams.opacity * 100)}%`} onChange={(v) => setParam('opacity', v)} />
              <SSlider label="Scale" value={viewParams.scale} min={0.2} max={3} step={0.1}
                display={`${viewParams.scale.toFixed(1)}×`} onChange={(v) => setParam('scale', v)} />
              <SSlider label="Rotation" value={viewParams.rotationY} min={0} max={Math.PI * 2} step={0.05}
                display={`${Math.round((viewParams.rotationY * 180) / Math.PI)}°`} onChange={(v) => setParam('rotationY', v)} />
              <SSlider label="Light" value={viewParams.lightIntensity} min={0.2} max={2.5} step={0.1}
                display={viewParams.lightIntensity.toFixed(1)} onChange={(v) => setParam('lightIntensity', v)} />
              <SToggle label="Auto-rotate" value={viewParams.autoRotate} onChange={(v) => setParam('autoRotate', v)} />
              <button
                onClick={() => setViewParams(DEFAULT_PARAMS)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" /> Reset view
              </button>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Adjust the model to highlight areas. Leave a comment to send your notes back to the owner.
              </p>
            </div>
          </div>
        )}

        {/* Comments sidebar */}
        {showComments && canComment && (
          <div className="absolute inset-y-0 right-0 z-40 w-full max-w-sm bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!isLoggedIn ? (
                <div className="text-center py-10">
                  <Lock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sign in to your DynaX account to read and leave comments.</p>
                </div>
              ) : serverComments && serverComments.length > 0 ? (
                serverComments.map((c) => (
                  <div key={c.id} className="bg-slate-700 rounded-xl px-3 py-2.5">
                    <p className="text-xs font-semibold text-slate-300 mb-1">{c.author_name} · {c.author_role}</p>
                    <p className="text-xs text-slate-200 leading-relaxed">{c.content}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{format(new Date(c.created_at), 'MMM d, h:mm a')}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-10">No comments yet.</p>
              )}
            </div>

            {isLoggedIn && (
              <div className="p-3 border-t border-slate-700">
                <div className="flex items-end gap-2 bg-slate-900 rounded-xl border border-slate-700 px-3 py-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                    placeholder="Leave a comment…"
                    rows={2}
                    className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none resize-none"
                  />
                  <button
                    onClick={submitComment}
                    disabled={!text.trim() || addComment.isPending}
                    className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 flex items-center justify-center flex-shrink-0 transition-colors"
                  >
                    {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SSlider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs text-slate-300 font-medium">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500 cursor-pointer"
      />
    </div>
  );
}

function SToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors"
    >
      <span className="text-xs text-slate-300">{label}</span>
      <span className={cn('w-9 h-5 rounded-full transition-colors relative', value ? 'bg-indigo-500' : 'bg-slate-600')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', value ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}