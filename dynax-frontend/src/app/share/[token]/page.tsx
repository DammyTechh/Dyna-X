'use client';

import { useState, Suspense } from 'react';
import { use } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei';
import { MessageCircle, Send, Eye, Edit3, Lock, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Permission = 'view' | 'comment' | 'annotate';

// ── Infer the permission from the token (in production: fetch from API) ───────
function useShareData(token: string) {
  // TODO: apiGet(`/share/${token}`) — returns { permission, case_name, owner_name, comments }
  return {
    permission: 'comment' as Permission,
    caseName: 'Transtibial Prosthesis — Case #2024-089',
    ownerName: 'Dr. Emeka Obi (Prosthetist)',
    loading: false,
  };
}

// ── Placeholder 3D model ──────────────────────────────────────────────────────
function LimbModel() {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 1.2, 32]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.15, 0]} castShadow>
        <sphereGeometry args={[0.17, 32, 32]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.7, 0.05]} castShadow>
        <cylinderGeometry args={[0.1, 0.11, 1.1, 32]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, -1.35, 0.08]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.38]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.5, 3.5]} fov={45} />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 3, -2]} intensity={0.4} />
      <Environment preset="studio" />
      <LimbModel />
      <Grid position={[0, -1.5, 0]} args={[10, 10]} cellColor="#e2e8f0" sectionColor="#cbd5e1" />
    </>
  );
}

interface Comment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { permission, caseName, ownerName, loading } = useShareData(token);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([
    { id: '1', author_name: 'Dr. Emeka Obi', content: 'Initial review — please check distal end clearance.', created_at: new Date().toISOString() },
  ]);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const canComment = permission === 'comment' || permission === 'annotate';
  const canEdit = permission === 'annotate';

  const PERM_LABELS: Record<Permission, { label: string; icon: React.ElementType; color: string }> = {
    view: { label: 'View only', icon: Eye, color: 'bg-slate-700 text-slate-300' },
    comment: { label: 'Can comment', icon: MessageCircle, color: 'bg-purple-900/60 text-purple-300' },
    annotate: { label: 'Can edit & annotate', icon: Edit3, color: 'bg-blue-900/60 text-blue-300' },
  };

  const perm = PERM_LABELS[permission];
  const PermIcon = perm.icon;

  const handleSubmitComment = () => {
    if (!text.trim() || (!name.trim() && !submitted)) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author_name: name || 'Anonymous',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, newComment]);
    setText('');
    setSubmitted(true);
    // TODO: POST to /share/{token}/comments — comment routes back to owner
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading shared scan…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg dynax-gradient flex items-center justify-center">
            <span className="text-xs font-bold">DX</span>
          </div>
          <div>
            <p className="text-sm font-semibold truncate max-w-[200px] md:max-w-none">{caseName}</p>
            <p className="text-xs text-slate-400">Shared by {ownerName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Permission badge */}
          <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', perm.color)}>
            <PermIcon className="w-3.5 h-3.5" />
            {perm.label}
          </span>

          {canComment && (
            <button
              onClick={() => setShowComments(!showComments)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                showComments ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Comments ({comments.length})
            </button>
          )}
        </div>
      </div>

      {/* View-only banner */}
      {permission === 'view' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5" />
          You have view-only access to this scan. Comments and editing are disabled.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          }>
            <Canvas shadows className="editor-canvas">
              <Scene />
            </Canvas>
          </Suspense>

          {/* Help overlay */}
          <div className="absolute bottom-4 left-4 text-xs text-slate-500">
            🖱 Drag to rotate · Scroll to zoom · Right-click to pan
          </div>
        </div>

        {/* Comments sidebar */}
        {showComments && canComment && (
          <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="bg-slate-700 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-300 mb-1">{c.author_name}</p>
                  <p className="text-xs text-slate-200 leading-relaxed">{c.content}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{format(new Date(c.created_at), 'MMM d, h:mm a')}</p>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-700 space-y-2">
              {!submitted && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              )}
              <div className="flex items-end gap-2 bg-slate-900 rounded-xl border border-slate-700 px-3 py-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Leave a comment… (returns to the owner)"
                  rows={2}
                  className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none resize-none"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!text.trim() || (!name.trim() && !submitted)}
                  className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                Comments are sent back to the scan owner.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
