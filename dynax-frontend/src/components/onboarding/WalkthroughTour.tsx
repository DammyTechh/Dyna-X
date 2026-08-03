'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TourRole = 'professional' | 'patient' | 'scanner';

interface TourStep {
  /** Matches a data-tour="…" attribute on an existing element. */
  target: string;
  title: string;
  description: string;
}

const TOURS: Record<TourRole, TourStep[]> = {
  professional: [
    { target: 'nav-patients', title: 'Your Patients', description: 'View and manage all your connected patients' },
    { target: 'nav-appointments', title: 'Appointments', description: 'Schedule and track patient sessions' },
    { target: 'nav-notes', title: 'Clinical Notes', description: 'Write and store SOAP notes with AI assistance' },
    { target: 'nav-scanner', title: '3D Scanner', description: 'Capture residual limb scans for device fabrication' },
    { target: 'nav-therapay', title: 'TheraPay', description: 'Manage session payments and billing' },
  ],
  patient: [
    { target: 'nav-appointments', title: 'Appointments', description: 'View your upcoming therapy sessions' },
    { target: 'nav-care-plans', title: 'Care Plans', description: 'See your personalised rehabilitation plan' },
    { target: 'nav-messages', title: 'Messages', description: 'Chat directly with your care team' },
    { target: 'nav-payments', title: 'Payments', description: 'View and manage your TheraPay balance' },
    { target: 'nav-professionals', title: 'Your Team', description: 'Connect with your prosthetist or therapist' },
  ],
  scanner: [
    { target: 'scan-new', title: 'New Scan', description: "Start capturing a patient's residual limb" },
    { target: 'scan-list', title: 'Scan History', description: 'View all previous scans and their status' },
    { target: 'scan-upload', title: 'Upload', description: 'Send scans directly to the DynaX platform' },
  ],
};

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // breathing room around the highlighted element
const CARD_W = 300;
const GAP = 14; // space between cutout and tooltip

function storageKey(role: TourRole) {
  return `dynax-tour-${role}-completed`;
}

function findTarget(name: string): HTMLElement | null {
  // The sidebar renders twice (desktop + mobile drawer), so take the first
  // match that is actually laid out — a display:none copy has a zero-size box
  // and highlighting it would point at nothing.
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of Array.from(all)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * First-run walkthrough. Highlights existing nav elements by their
 * data-tour attribute — it never renders or restructures nav itself, so a
 * step whose target isn't on the current page is simply skipped.
 *
 * Auto-runs once per role (localStorage), and can be replayed any time from the
 * floating "?" button.
 */
export default function WalkthroughTour({ role }: { role: TourRole }) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const start = useCallback(() => {
    // Resolve targets at start time: only steps present on this page take part.
    const live = TOURS[role].filter((s) => findTarget(s.target));
    if (live.length === 0) return;
    setSteps(live);
    setIndex(0);
    setRunning(true);
  }, [role]);

  const finish = useCallback(() => {
    setRunning(false);
    setRect(null);
    try {
      window.localStorage.setItem(storageKey(role), String(Date.now()));
    } catch {
      /* storage blocked — the tour will simply offer itself again */
    }
  }, [role]);

  // Auto-start on first visit, a beat after the dashboard has settled.
  useEffect(() => {
    let seen = true;
    try {
      seen = Boolean(window.localStorage.getItem(storageKey(role)));
    } catch {
      seen = true; // can't tell — don't ambush the user
    }
    if (seen) return;
    const t = window.setTimeout(start, 1000);
    return () => window.clearTimeout(t);
  }, [role, start]);

  // Track the current target's position (scroll, resize, sidebar collapse).
  useLayoutEffect(() => {
    if (!running) return;
    const step = steps[index];
    if (!step) return;

    const el = findTarget(step.target);
    if (!el) {
      setRect(null);
      return;
    }

    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const sync = () => setRect(measure(el));
    sync();

    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [running, steps, index]);

  // Escape skips out of the tour.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, finish]);

  const step = running ? steps[index] : undefined;
  const isLast = running && index === steps.length - 1;

  // Prefer the right of the target (sidebar case), fall back to below it.
  let cardTop = 0;
  let cardLeft = 0;
  let arrow: 'left' | 'top' = 'left';
  if (rect) {
    const roomRight = window.innerWidth - (rect.left + rect.width) > CARD_W + GAP + 16;
    if (roomRight) {
      arrow = 'left';
      cardLeft = rect.left + rect.width + GAP;
      cardTop = Math.max(12, rect.top - 8);
    } else {
      arrow = 'top';
      cardLeft = Math.min(
        Math.max(12, rect.left + rect.width / 2 - CARD_W / 2),
        Math.max(12, window.innerWidth - CARD_W - 12)
      );
      cardTop = rect.top + rect.height + GAP;
      // Not enough room below — flip above the target.
      if (cardTop + 190 > window.innerHeight) cardTop = Math.max(12, rect.top - 190 - GAP);
    }
  }

  return (
    <>
      {/* Always-available replay control. */}
      <button
        onClick={start}
        aria-label="Replay the guided tour"
        title="Guided tour"
        className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-teal-500 text-white shadow-lg transition hover:bg-teal-400"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {step && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Guided tour">
          {/* Backdrop. With a rect we use a huge outward shadow so the target
              itself stays lit; without one, a plain dim overlay. */}
          {rect ? (
            <div
              className="pointer-events-auto absolute rounded-xl ring-2 ring-teal-400 transition-all duration-200"
              style={{
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
                boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)',
              }}
              onClick={finish}
            />
          ) : (
            <div className="absolute inset-0 bg-slate-950/72" onClick={finish} />
          )}

          <div
            className={cn(
              'absolute w-[300px] rounded-xl bg-slate-800 p-4 shadow-xl ring-1 ring-slate-700',
              !rect && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
            )}
            style={rect ? { top: cardTop, left: cardLeft } : undefined}
          >
            {/* Pointer toward the highlighted element. */}
            {rect && (
              <span
                aria-hidden
                className={cn(
                  'absolute h-3 w-3 rotate-45 bg-slate-800',
                  arrow === 'left' ? '-left-1.5 top-6' : '-top-1.5 left-1/2 -ml-1.5'
                )}
              />
            )}

            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-teal-400">
                Step {index + 1} of {steps.length}
              </span>
              <button
                onClick={finish}
                aria-label="Skip tour"
                className="text-slate-500 transition hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="text-sm font-bold text-white">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.description}</p>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={finish}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
              >
                Skip
              </button>
              <div className="flex items-center gap-2">
                {index > 0 && (
                  <button
                    onClick={() => setIndex((i) => i - 1)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                  >
                    Previous
                  </button>
                )}
                <button
                  onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
                  className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-400"
                >
                  {isLast ? 'Got it! 🎉' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
