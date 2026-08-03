'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// The event isn't in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'dynax-install-dismissed';
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // re-ask after a week

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

/** True while a dismissal is still inside its 7-day window. */
function isDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    // A non-numeric value is a legacy/hand-set flag — treat it as "dismissed
    // forever" rather than showing the banner on every load.
    if (!Number.isFinite(at)) return true;
    return Date.now() - at < DISMISS_WINDOW_MS;
  } catch {
    return false; // private mode / storage blocked — just show it
  }
}

export interface InstallBannerProps {
  /** Heading, e.g. "Install DynaX Pro". */
  title: string;
  /** One-line pitch shown under the title. */
  body: string;
  /** Only render on this hostname — see the note in InstallButton. */
  expectedHost?: string;
  /** Used for the aria-label on the install action. */
  productName: string;
  className?: string;
}

/**
 * Instructional banner that sits at the top of a product dashboard until the
 * user installs the PWA or dismisses it.
 *
 * Complements InstallButton: the button is a quiet, persistent affordance; this
 * is the explanatory first-run CTA. Both are pinned to the product's own
 * subdomain because these manifests use start_url "/" — installing from
 * dynax.app would create an app named "DynaX Pro" that opens the marketing site.
 */
export default function InstallBanner({
  title,
  body,
  expectedHost,
  productName,
  className,
}: InstallBannerProps) {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    if (expectedHost && window.location.hostname !== expectedHost) return;
    if (isDismissed()) return;

    // iOS fires no beforeinstallprompt; offer manual instructions instead.
    if (isIOS()) {
      setIos(true);
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the mini-infobar from firing on its own
      promptRef.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };
    const onInstalled = () => {
      promptRef.current = null;
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [expectedHost]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked — dismissal just won't persist */
    }
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
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
    if (outcome === 'accepted') setVisible(false);
  }, [ios]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'relative border-l-4 border-teal-500 bg-slate-800/50 px-4 py-3 sm:px-5',
        className
      )}
    >
      <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:gap-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
          <Download className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{body}</p>
        </div>

        <button
          onClick={install}
          aria-label={ios ? `How to install ${productName}` : `Install ${productName}`}
          className="flex-shrink-0 self-start rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400 sm:self-auto"
        >
          {ios ? 'How to Install' : 'Install App'}
        </button>
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 text-slate-500 transition hover:text-slate-300"
      >
        <X className="h-4 w-4" />
      </button>

      {showIOSHelp && (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-3 sm:ml-14">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Share className="h-3.5 w-3.5" /> Add to Home Screen
          </p>
          <ol className="space-y-1 text-xs leading-relaxed text-slate-400">
            <li>1. Tap the Share button (□↑) at the bottom of Safari</li>
            <li>2. Scroll down and tap &lsquo;Add to Home Screen&rsquo;</li>
            <li>3. Tap &lsquo;Add&rsquo; to confirm</li>
          </ol>
        </div>
      )}
    </div>
  );
}
