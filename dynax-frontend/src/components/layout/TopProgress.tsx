'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Lightweight top loading bar that gives instant feedback on every internal
 * navigation — link clicks and programmatic router pushes alike. No external
 * dependency. Uses only usePathname (no Suspense boundary required).
 */
export default function TopProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (timer.current) clearInterval(timer.current);
    setVisible(true);
    setProgress(8);
    timer.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(0.5, (90 - p) / 12) : p));
    }, 180);
  };

  const finish = () => {
    if (timer.current) clearInterval(timer.current);
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);
    return () => clearTimeout(t);
  };

  // Trigger the bar on link clicks and on history pushState (router.push).
  useEffect(() => {
    const sameOrigin = (href: string) =>
      href.startsWith('/') || href.includes(window.location.host);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      const target = anchor.getAttribute('target');
      if (!href || href.startsWith('#') || target === '_blank') return;
      if (href.startsWith('http') && !sameOrigin(href)) return;
      const dest = href.split('?')[0].split('#')[0];
      if (dest && dest !== window.location.pathname) start();
    };

    document.addEventListener('click', onClick, true);

    const origPush = history.pushState;
    history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      const url = args[2];
      if (url && String(url).split('?')[0] !== window.location.pathname) start();
      return origPush.apply(this, args);
    };

    return () => {
      document.removeEventListener('click', onClick, true);
      history.pushState = origPush;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // Route actually changed → complete the bar.
  useEffect(() => {
    if (visible) return finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999, pointerEvents: 'none' }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #2563EB 0%, #0D9488 100%)',
          boxShadow: '0 0 10px rgba(37,99,235,0.7), 0 0 5px rgba(13,148,136,0.6)',
          transition: 'width 0.2s ease',
        }}
      />
    </div>
  );
}
