'use client';

import { useEffect } from 'react';

// Registers the service worker so the scanner is installable as a PWA. Push
// notifications register it too (see lib/push.ts), but that only happens once a
// user opts in — installability needs a worker with a fetch handler present on
// first visit, so the scanner registers it unconditionally.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures are non-fatal — the scanner still works online.
    });
  }, []);

  return null;
}
