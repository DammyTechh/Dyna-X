'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, PerspectiveCamera, useGLTF } from '@react-three/drei';
import {
  Share2, MessageCircle, ZoomIn, ZoomOut, RotateCcw, Download,
  Eye, Edit3, Layers, ChevronRight, X, Send, Copy, Check,
  Link as LinkIcon, Lock, Unlock, Loader2, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { tokenStore } from '@/lib/api';

type Permission = 'view' | 'comment' | 'annotate';

interface ShareLink {
  id: string;
  token: string;
  permission: Permission;
  url: string;
  expires_at?: string;
  created_at: string;
}

interface Comment {
  id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
  is_own: boolean;
}

// ── Placeholder 3D model (box/limb shape) ────────────────────────────────────
function LimbModel() {
  return (
    <group>
      {/* Upper limb segment */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 1.2, 32]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Knee joint */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <sphereGeometry args={[0.17, 32, 32]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.2} />
      </mesh>
      {/* Lower limb segment */}
      <mesh position={[0, -0.7, 0.05]} castShadow>
        <cylinderGeometry args={[0.1, 0.11, 1.1, 32]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Foot / socket */}
      <mesh position={[0, -1.35, 0.08]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.38]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

function Scene({ wireframe }: { wireframe: boolean }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.5, 3.5]} fov={45} />
      <OrbitControls enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 3, -2]} intensity={0.4} />
      <Environment preset="studio" />
      <group>
        <LimbModel />
      </group>
      <Grid position={[0, -1.5, 0]} args={[10, 10]} cellColor="#e2e8f0" sectionColor="#cbd5e1" />
    </>
  );
}

export default function EditorPage() {
  const role = tokenStore.getRole() || 'professional';
  const [wireframe, setWireframe] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [permission, setPermission] = useState<Permission>('comment');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([
    { id: '1', author_name: 'Dr. Emeka Obi', author_role: 'Prosthetist', content: 'Socket fit looks good. Recommend checking the distal end clearance.', created_at: new Date(Date.now() - 3600000).toISOString(), is_own: false },
    { id: '2', author_name: 'You', author_role: role, content: 'Agreed. Will adjust the trim line on the medial side.', created_at: new Date(Date.now() - 1800000).toISOString(), is_own: true },
  ]);
  const [commentText, setCommentText] = useState('');

  const generateShareLink = async () => {
    setGeneratingLink(true);
    try {
      // TODO: call /emr/devices/{id}/share
      await new Promise((r) => setTimeout(r, 800));
      const token = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newLink: ShareLink = {
        id: Date.now().toString(),
        token,
        permission,
        url: `${window.location.origin}/share/${token}`,
        created_at: new Date().toISOString(),
      };
      setShareLinks((prev) => [newLink, ...prev]);
      toast.success('Share link generated!');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = (link: ShareLink) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Link copied!');
  };

  const addComment = () => {
    if (!commentText.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author_name: 'You',
      author_role: role,
      content: commentText.trim(),
      created_at: new Date().toISOString(),
      is_own: true,
    };
    setComments((prev) => [...prev, newComment]);
    setCommentText('');
  };

  const PERM_OPTIONS: { value: Permission; label: string; desc: string; icon: React.ElementType }[] = [
    { value: 'view', label: 'View only', desc: 'Can see the model, no editing', icon: Eye },
    { value: 'comment', label: 'Comment', desc: 'Can view and add comments', icon: MessageCircle },
    { value: 'annotate', label: 'Annotate & Edit', desc: 'Full editing and annotation access', icon: Edit3 },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/professional" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-7 h-7 rounded-lg dynax-gradient flex items-center justify-center">
            <span className="text-xs font-bold">DX</span>
          </div>
          <div>
            <p className="text-sm font-semibold">3D Scan Editor</p>
            <p className="text-xs text-slate-400">Transtibial Prosthesis · Case #2024-089</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Wireframe toggle */}
          <button
            onClick={() => setWireframe(!wireframe)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              wireframe ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Wireframe
          </button>

          {/* Comments */}
          <button
            onClick={() => { setShowComments(!showComments); setShowShare(false); }}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showComments ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Comments
            {comments.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                {comments.length}
              </span>
            )}
          </button>

          {/* Share */}
          <button
            onClick={() => { setShowShare(!showShare); setShowComments(false); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showShare ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>

          {/* Download */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Loading 3D model…</p>
              </div>
            </div>
          }>
            <Canvas shadows className="editor-canvas">
              <Scene wireframe={wireframe} />
            </Canvas>
          </Suspense>

          {/* Canvas controls overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800/80 backdrop-blur rounded-xl px-3 py-2 border border-slate-700">
            <button className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors" title="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors" title="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-600" />
            <button className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors" title="Reset camera">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Model info badge */}
          <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur rounded-xl px-4 py-2 border border-slate-700 text-xs">
            <p className="font-medium text-slate-200">Transtibial Socket</p>
            <p className="text-slate-400">Left · Carbon Fiber · Size M</p>
          </div>
        </div>

        {/* Share panel */}
        {showShare && (
          <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Share 3D Scan</h3>
              <button onClick={() => setShowShare(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Permission selector */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Link Permission
                </p>
                <div className="space-y-2">
                  {PERM_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setPermission(opt.value)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                          permission === opt.value
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        )}
                      >
                        <Icon className={cn('w-4 h-4 flex-shrink-0', permission === opt.value ? 'text-blue-400' : 'text-slate-400')} />
                        <div>
                          <p className="text-xs font-semibold text-white">{opt.label}</p>
                          <p className="text-xs text-slate-400">{opt.desc}</p>
                        </div>
                        {permission === opt.value && (
                          <Check className="w-4 h-4 text-blue-400 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={generateShareLink}
                disabled={generatingLink}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl text-sm font-semibold transition-colors"
              >
                {generatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                Generate Share Link
              </button>

              {/* Generated links */}
              {shareLinks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Generated Links
                  </p>
                  <div className="space-y-2">
                    {shareLinks.map((link) => {
                      const PermIcon = PERM_OPTIONS.find((o) => o.value === link.permission)?.icon || Eye;
                      return (
                        <div key={link.id} className="bg-slate-900 rounded-xl p-3 border border-slate-700">
                          <div className="flex items-center gap-2 mb-2">
                            <PermIcon className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-xs font-medium text-blue-400 capitalize">{link.permission}</span>
                            <span className="text-xs text-slate-500 ml-auto">
                              {format(new Date(link.created_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              readOnly
                              value={link.url}
                              className="flex-1 bg-slate-800 text-xs text-slate-300 px-2 py-1.5 rounded-lg border border-slate-700 font-mono truncate"
                            />
                            <button
                              onClick={() => copyLink(link)}
                              className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                              {copiedId === link.id
                                ? <Check className="w-3.5 h-3.5 text-green-400" />
                                : <Copy className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">About permissions:</strong>{' '}
                  Recipients with <em>View</em> can only see the model. <em>Comment</em> allows them to leave feedback that returns to you. <em>Annotate</em> gives full editing access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comments panel */}
        {showComments && (
          <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Comments ({comments.length})</h3>
              <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className={cn('flex gap-2', comment.is_own && 'flex-row-reverse')}>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {comment.author_name.charAt(0)}
                  </div>
                  <div className={cn(
                    'flex-1 rounded-xl px-3 py-2.5 text-xs max-w-[85%]',
                    comment.is_own
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-200'
                  )}>
                    <p className={cn('font-semibold mb-1 text-[11px]', comment.is_own ? 'text-blue-200' : 'text-slate-400')}>
                      {comment.author_name} · {comment.author_role}
                    </p>
                    <p className="leading-relaxed">{comment.content}</p>
                    <p className={cn('text-[10px] mt-1', comment.is_own ? 'text-blue-200' : 'text-slate-500')}>
                      {format(new Date(comment.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-700">
              <div className="flex items-end gap-2 bg-slate-900 rounded-xl border border-slate-700 px-3 py-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                  placeholder="Add a comment…"
                  rows={2}
                  className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none resize-none leading-relaxed"
                />
                <button
                  onClick={addComment}
                  disabled={!commentText.trim()}
                  className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
