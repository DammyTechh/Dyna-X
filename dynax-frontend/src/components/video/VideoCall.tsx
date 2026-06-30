'use client';

import { useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

interface VideoCallProps {
  /** Stable id (e.g. conversation or appointment id) — both parties must use the same one. */
  roomId: string;
  /** Display name shown to the other participant. */
  displayName?: string;
  /** Subject shown in the call header. */
  subject?: string;
  /** Start as an audio-only call (camera off, video controls hidden). */
  audioOnly?: boolean;
  onClose: () => void;
}

/**
 * Lightweight video-calling overlay.
 *
 * Uses Jitsi Meet (meet.jit.si) embedded via its External API. This needs no
 * signalling server of our own — both participants simply join the same room,
 * which we derive deterministically from the conversation/appointment id, so a
 * professional and patient who open the call from the same thread land together.
 *
 * To self-host later, point JITSI_DOMAIN at your own Jitsi instance.
 */
const JITSI_DOMAIN = 'meet.jit.si';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => {
      dispose: () => void;
      addEventListener: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

export function VideoCall({ roomId, displayName, subject, audioOnly = false, onClose }: VideoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ dispose: () => void } | null>(null);

  // Namespace the room so it never collides with unrelated public rooms.
  const room = `DynaX-${roomId}`.replace(/[^a-zA-Z0-9-]/g, '');

  useEffect(() => {
    let cancelled = false;

    const init = () => {
      if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: room,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName: displayName || 'DynaX user' },
        configOverwrite: {
          prejoinPageEnabled: true,
          disableDeepLinking: true,
          startWithAudioMuted: false,
          startWithVideoMuted: audioOnly,
          startAudioOnly: audioOnly,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          DEFAULT_BACKGROUND: '#0f172a',
          TOOLBAR_BUTTONS: audioOnly
            ? ['microphone', 'fullscreen', 'fodeviceselection', 'hangup', 'chat', 'settings', 'raisehand']
            : ['microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection',
               'hangup', 'chat', 'settings', 'raisehand', 'videoquality', 'tileview'],
        },
      });
      api.addEventListener('readyToClose', onClose);
      apiRef.current = api;
    };

    // Load the External API script once.
    const existing = document.getElementById('jitsi-external-api');
    if (window.JitsiMeetExternalAPI) {
      init();
    } else if (existing) {
      existing.addEventListener('load', init);
    } else {
      const s = document.createElement('script');
      s.id = 'jitsi-external-api';
      s.src = `https://${JITSI_DOMAIN}/external_api.js`;
      s.async = true;
      s.onload = init;
      document.body.appendChild(s);
    }

    return () => {
      cancelled = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <p className="text-sm font-semibold text-white truncate">
            {subject || (audioOnly ? 'Audio call' : 'Video call')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Leave
        </button>
      </div>
      <div ref={containerRef} className="flex-1 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      </div>
    </div>
  );
}

export default VideoCall;
