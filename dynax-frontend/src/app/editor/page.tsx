'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Share2, MessageCircle, ZoomIn, ZoomOut, RotateCcw, Download,
  Eye, Edit3, Layers, X, Send, Copy, Check, SlidersHorizontal,
  Link as LinkIcon, Loader2, ArrowLeft, Upload, Camera, Grid3x3, RotateCw, ScanLine,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { tokenStore } from '@/lib/api';
import { Logo } from '@/components/brand/Logo';
import { useDeviceComments, useAddDeviceComment, useCreateDeviceShareById, useCreateDeviceMeasurement } from '@/hooks/useApi';
import { uploadScan, storageConfigured } from '@/lib/storage';
import dynamic from 'next/dynamic';
import { type ViewerHandle, type ViewerParams } from '@/components/3d/ModelViewer';

// Three.js viewer is heavy and browser-only — load it client-side to avoid
// any SSR/hydration issues affecting the rest of the editor UI.
const ModelViewer = dynamic(() => import('@/components/3d/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
    </div>
  ),
});

const ACCEPTED_3D = '.glb,.gltf,.stl,.obj';

const DEFAULT_PARAMS: ViewerParams = {
  wireframe: false,
  modelColor: '#94a3b8',
  opacity: 1,
  scale: 1,
  rotationY: 0,
  autoRotate: false,
  background: '#0f172a',
  showGrid: false,
  lightIntensity: 1,
};

const SWATCHES = ['#94a3b8', '#2563eb', '#0d9488', '#f59e0b', '#ef4444', '#a855f7', '#e2e8f0', '#1e293b'];

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

function EditorInner() {
  const role = tokenStore.getRole() || 'professional';
  const searchParams = useSearchParams();
  const [deviceId, setDeviceId] = useState<string | undefined>(searchParams.get('device') || undefined);

  // Server-backed collaboration when a device is in context.
  const { data: serverComments } = useDeviceComments(deviceId);
  const addCommentMut = useAddDeviceComment(deviceId);
  const createShareMut = useCreateDeviceShareById();
  const createDeviceMut = useCreateDeviceMeasurement();
  const viewerRef = useRef<ViewerHandle>(null);
  const [params, setParams] = useState<ViewerParams>(DEFAULT_PARAMS);
  const [showProps, setShowProps] = useState(false);
  const [modelStats, setModelStats] = useState<{ vertices: number; triangles: number } | null>(null);
  const setParam = <K extends keyof ViewerParams>(k: K, v: ViewerParams[K]) =>
    setParams((prev) => ({ ...prev, [k]: v }));
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [permission, setPermission] = useState<Permission>('comment');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  // When a device is in context, mirror server comments into the panel.
  useEffect(() => {
    if (deviceId && Array.isArray(serverComments)) {
      setComments(
        serverComments.map((c) => ({
          id: c.id,
          author_name: c.author_name,
          author_role: c.author_role,
          content: c.content,
          created_at: c.created_at,
          is_own: c.author_role === role,
        })),
      );
    }
  }, [deviceId, serverComments, role]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = /\.(glb|gltf|stl|obj)$/i.test(file.name);
    if (!ok) {
      toast.error('Unsupported file. Use GLB, GLTF, STL or OBJ.');
      return;
    }
    setUploadedFile(file);
    toast.success(`Loaded ${file.name}`);
  };

  const generateShareLink = async () => {
    setGeneratingLink(true);
    try {
      let targetDeviceId = deviceId;

      // Standalone editor: publish the imported scan so others can open it.
      if (!targetDeviceId) {
        if (!uploadedFile) {
          toast.error('Import a scan first, then share it.');
          return;
        }
        if (!storageConfigured()) {
          toast.error('Storage isn’t configured yet — run the storage migration and set Supabase env vars.');
          return;
        }
        const ownerId = tokenStore.getUserId();
        if (!ownerId) {
          toast.error('Could not identify your account — please sign in again.');
          return;
        }
        toast.message('Uploading scan…');
        const modelUrl = await uploadScan(uploadedFile);
        const device = await createDeviceMut.mutateAsync({
          patient_id: ownerId, // scan is owned by you; no patient needed to share
          device_type: '3d_scan',
          body_region: 'general',
          measurements: {},
          notes: uploadedFile.name,
          model_3d_url: modelUrl,
        });
        targetDeviceId = device.id;
        setDeviceId(device.id); // adopt it so comments persist too
      }

      const share = await createShareMut.mutateAsync({ deviceId: targetDeviceId!, permission });
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const newLink: ShareLink = {
        id: share.id,
        token: share.token,
        permission: (share.permission as Permission) || permission,
        url: `${base}/share/${share.token}`,
        created_at: share.created_at,
      };
      setShareLinks((prev) => [newLink, ...prev]);
      toast.success('Share link created — any professional with the link can open this scan.');
    } catch (e) {
      toast.error((e as Error).message || 'Could not create share link');
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
    if (deviceId) {
      addCommentMut.mutate(commentText.trim(), {
        onError: () => toast.error('Could not post comment'),
      });
      setCommentText('');
      return;
    }
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
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 bg-slate-900 border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/professional" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Logo size={28} asLink={false} light />
          <div className="min-w-0">
            <p className="text-sm font-semibold">3D Scan Editor</p>
            <p className="hidden sm:block text-xs text-slate-400 truncate max-w-[220px]">
              {uploadedFile ? uploadedFile.name : 'Import a scan to begin'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Take a scan (opens the DynaX Scanner) */}
          <Link
            href="/dashboard/professional/scanner"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-500 transition-colors"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Take a Scan</span>
          </Link>

          {/* Import scan */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_3D}
            onChange={onPickFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Wireframe toggle */}
          <button
            onClick={() => setParam('wireframe', !params.wireframe)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              params.wireframe ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Wireframe</span>
          </button>

          {/* Properties / editing parameters */}
          <button
            onClick={() => { setShowProps((v) => !v); setShowShare(false); setShowComments(false); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showProps ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Properties</span>
          </button>

          {/* Comments */}
          <button
            onClick={() => { setShowComments(!showComments); setShowShare(false); setShowProps(false); }}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showComments ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Comments</span>
            {comments.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                {comments.length}
              </span>
            )}
          </button>

          {/* Share */}
          <button
            onClick={() => { setShowShare(!showShare); setShowComments(false); setShowProps(false); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showShare ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Download / Export */}
          <button
            onClick={() => viewerRef.current?.exportGLB(
              uploadedFile ? uploadedFile.name.replace(/\.[^.]+$/, '') + '.glb' : 'dynax-model.glb'
            )}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* 3D Canvas (always full-size; panels overlay it) */}
        <div className="absolute inset-0">
          <ModelViewer
            apiRef={viewerRef}
            uploadedFile={uploadedFile}
            readOnly={false}
            params={params}
            onLoaded={setModelStats}
          />

          {/* Empty-state hint when nothing imported */}
          {!uploadedFile && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 backdrop-blur border border-slate-700 hover:bg-slate-700"
              >
                <Upload className="h-4 w-4" /> Import a scan (GLB, GLTF, STL, OBJ)
              </button>
              <p className="mt-2 text-xs text-slate-500">A sample limb is shown for reference</p>
            </div>
          )}

          {/* Canvas controls overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800/80 backdrop-blur rounded-xl px-3 py-2 border border-slate-700">
            <button onClick={() => viewerRef.current?.zoomIn()} className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors" title="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => viewerRef.current?.zoomOut()} className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors" title="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-600" />
            <button onClick={() => viewerRef.current?.resetView()} className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors" title="Reset camera">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setParam('autoRotate', !params.autoRotate)}
              className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', params.autoRotate ? 'bg-blue-600 text-white' : 'hover:bg-slate-700')}
              title="Auto-rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-600" />
            <button onClick={() => viewerRef.current?.snapshot()} className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors" title="Save snapshot (PNG)">
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Model info badge */}
          <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur rounded-xl px-4 py-2 border border-slate-700 text-xs">
            <p className="font-medium text-slate-200">{uploadedFile ? uploadedFile.name : 'Sample geometry'}</p>
            <p className="text-slate-400">
              {uploadedFile ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Import a scan to replace'}
            </p>
            {modelStats && (
              <p className="text-slate-500 mt-0.5">
                {modelStats.triangles.toLocaleString()} tris · {modelStats.vertices.toLocaleString()} verts
              </p>
            )}
          </div>
        </div>

        {/* Properties / editing parameters panel */}
        {showProps && (
          <div className="absolute inset-y-0 right-0 z-40 w-full max-w-sm sm:max-w-md bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Model Properties
              </h3>
              <button onClick={() => setShowProps(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
              {/* Surface color */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Surface colour</p>
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setParam('modelColor', c)}
                      style={{ background: c }}
                      className={cn('w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110',
                        params.modelColor === c ? 'border-white' : 'border-transparent')}
                      title={c}
                    />
                  ))}
                  <label className="w-7 h-7 rounded-lg border-2 border-slate-600 overflow-hidden cursor-pointer relative" title="Custom colour">
                    <input type="color" value={params.modelColor}
                      onChange={(e) => setParam('modelColor', e.target.value)}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-slate-300">＋</span>
                  </label>
                </div>
              </div>

              {/* Opacity */}
              <Slider label="Opacity" value={params.opacity} min={0.1} max={1} step={0.05}
                display={`${Math.round(params.opacity * 100)}%`}
                onChange={(v) => setParam('opacity', v)} />

              {/* Scale */}
              <Slider label="Scale" value={params.scale} min={0.2} max={3} step={0.05}
                display={`${params.scale.toFixed(2)}×`}
                onChange={(v) => setParam('scale', v)} />

              {/* Rotation */}
              <Slider label="Rotation (Y)" value={params.rotationY} min={0} max={Math.PI * 2} step={0.05}
                display={`${Math.round((params.rotationY * 180) / Math.PI)}°`}
                onChange={(v) => setParam('rotationY', v)} />

              {/* Lighting */}
              <Slider label="Lighting" value={params.lightIntensity} min={0} max={2} step={0.05}
                display={`${Math.round(params.lightIntensity * 100)}%`}
                onChange={(v) => setParam('lightIntensity', v)} />

              {/* Toggles */}
              <div className="space-y-2 pt-1">
                <Toggle label="Wireframe" icon={Layers} on={params.wireframe} onClick={() => setParam('wireframe', !params.wireframe)} />
                <Toggle label="Auto-rotate" icon={RotateCw} on={params.autoRotate} onClick={() => setParam('autoRotate', !params.autoRotate)} />
                <Toggle label="Show grid" icon={Grid3x3} on={params.showGrid} onClick={() => setParam('showGrid', !params.showGrid)} />
              </div>

              {/* Background */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Background</p>
                <div className="flex gap-2">
                  {['#0f172a', '#1e293b', '#000000', '#334155', '#f8fafc'].map((c) => (
                    <button key={c} onClick={() => setParam('background', c)} style={{ background: c }}
                      className={cn('flex-1 h-8 rounded-lg border-2', params.background === c ? 'border-indigo-400' : 'border-slate-700')} />
                  ))}
                </div>
              </div>

              {/* Reset all */}
              <button
                onClick={() => { setParams(DEFAULT_PARAMS); viewerRef.current?.resetView(); }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors text-xs font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset all
              </button>
            </div>
          </div>
        )}

        {/* Share panel */}
        {showShare && (
          <div className="absolute inset-y-0 right-0 z-40 w-full max-w-sm sm:max-w-md bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Share 3D Scan</h3>
              <button onClick={() => setShowShare(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {!deviceId && (
                <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 rounded-xl p-3 border border-slate-700">
                  Sharing uploads this scan and creates a link. Any professional with the link can open it
                  with the permission you choose below — no need to pick a patient.
                </p>
              )}

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
          <div className="absolute inset-y-0 right-0 z-40 w-full max-w-sm sm:max-w-md bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-sm">Comments ({comments.length})</h3>
              <button onClick={() => setShowComments(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center py-10">
                  <MessageCircle className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No comments yet</p>
                  <p className="text-xs text-slate-500 mt-1">Share this scan to collaborate.</p>
                </div>
              )}
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

function Slider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <span className="text-xs font-mono text-slate-300">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500 cursor-pointer"
      />
    </div>
  );
}

function Toggle({ label, icon: Icon, on, onClick }: {
  label: string; icon: React.ElementType; on: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
    >
      <span className="flex items-center gap-2 text-xs text-slate-200">
        <Icon className="w-3.5 h-3.5 text-slate-400" /> {label}
      </span>
      <span className={cn('relative w-9 h-5 rounded-full transition-colors', on ? 'bg-indigo-500' : 'bg-slate-600')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      }
    >
      <EditorInner />
    </Suspense>
  );
}