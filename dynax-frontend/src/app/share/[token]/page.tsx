'use client';

import { useState } from 'react';
import { MessageCircle, Send, Eye, Edit3, Lock, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { tokenStore } from '@/lib/api';
import {
  useSharedDevice, useDeviceComments, useAddDeviceCommentById,
} from '@/hooks/useApi';
import dynamic from 'next/dynamic';
const ModelViewer = dynamic(() => import('@/components/3d/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
    </div>
  ),
});

type Permission = 'view' | 'comment' | 'annotate';

const VIEW_PARAMS = {
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

  const [showComments, setShowComments] = useState(false);
  const [text, setText] = useState('');

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
          <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', perm.color)}>
            <PermIcon className="w-3.5 h-3.5" />
            {perm.label}
          </span>
          {canComment && (
            <button
              onClick={() => setShowComments(!showComments)}
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

      <div className="flex flex-1 overflow-hidden">
        {/* 3D viewer */}
        <div className="flex-1 relative">
          {modelUrl ? (
            <ModelViewer modelUrl={modelUrl} readOnly params={VIEW_PARAMS} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6">
              <p className="text-slate-400 text-sm max-w-xs">
                This shared record has no 3D model attached.
              </p>
            </div>
          )}
        </div>

        {/* Comments sidebar */}
        {showComments && canComment && (
          <div className="fixed sm:relative inset-y-0 right-0 z-40 sm:z-auto w-full max-w-sm sm:max-w-none sm:inset-auto sm:w-72 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shadow-2xl sm:shadow-none">
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
