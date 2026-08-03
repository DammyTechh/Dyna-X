'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// The event isn't in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Macintosh, so check for touch as well.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Prompts the visitor to install whichever PWA the current page declares.
 *
 * Placed on a product's own page rather than site-wide on purpose: the browser
 * installs the manifest linked by the page you install from, so prompting here
 * is what gets people "DynaX Pro" instead of plain "DynaX".
 *
 * `expectedHost` pins the button to that product's own subdomain. These
 * manifests use start_url "/", which only resolves correctly on the subdomain —
 * installing the same page from dynax.app would produce an app named
 * "DynaX Pro" that opens the marketing homepage.
 */
export default function InstallButton({
  className,
  expectedHost,
}: {
  className?: string;
  expectedHost?: string;
}) {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed — nothing to offer
    if (expectedHost && window.location.hostname !== expectedHost) return;

    // iOS fires no beforeinstallprompt; offer manual instructions instead.
    if (isIOS()) {
      setIos(true);
      setCanInstall(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the mini-infobar from firing on its own
      promptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      promptRef.current = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [expectedHost]);

  const handleClick = useCallback(async () => {
    if (ios) {
      setShowIOSHelp((v) => !v);
      return;
    }
    const evt = promptRef.current;
    if (!evt) return;

    await evt.prompt();
    const { outcome } = await evt.userChoice;
    // A prompt can only be used once; drop it either way.
    promptRef.current = null;
    if (outcome === 'accepted') setCanInstall(false);
  }, [ios]);

  if (!canInstall) return null;

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400"
      >
        <Download className="h-4 w-4" />
        Install App
      </button>

      {showIOSHelp && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs leading-relaxed text-slate-600">
              Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" /> <strong>Share</strong>, then{' '}
              <strong>Add to Home Screen</strong>.
            </p>
            <button
              onClick={() => setShowIOSHelp(false)}
              aria-label="Close"
              className="text-slate-400 transition hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
