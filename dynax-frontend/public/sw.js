/* DynaX service worker — install/offline support for the DynaX PWAs
   (DynaX, Pro, Care, Physio, DynaXcan) + web push notifications. */

const CACHE = 'dynax-v2';

// Shell routes/assets kept available offline. Cached individually so one bad
// entry can't fail the whole install (cache.addAll rejects wholesale).
// Every manifest is precached so each installed PWA can still resolve its own
// identity and icons when launched offline.
const PRECACHE = [
  '/scanner',
  '/scanner/login',
  '/manifest.json',
  '/pro-manifest.json',
  '/care-manifest.json',
  '/physio-manifest.json',
  '/scanner-manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  // Per-product tiles, so an installed Pro/Care/Physio/DynaXcan resolves its own
  // icon offline rather than falling back to the shared DynaX mark.
  '/icons/pro-icon-192.png',
  '/icons/pro-icon-512.png',
  '/icons/care-icon-192.png',
  '/icons/care-icon-512.png',
  '/icons/physio-icon-192.png',
  '/icons/physio-icon-512.png',
  '/icons/scanner-icon-192.png',
  '/icons/scanner-icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.allSettled(PRECACHE.map(function (url) { return cache.add(url); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) { return key === CACHE ? undefined : caches.delete(key); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations inside the scanner PWA: network first, falling back to the
  // cached shell when offline. Navigations elsewhere on the origin are left to
  // the browser — this worker only owns the scanner experience.
  if (request.mode === 'navigate' && url.pathname.startsWith('/scanner')) {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('/scanner');
          });
        })
    );
    return;
  }

  // Static assets and the PWA manifests: serve from cache, refreshing in the
  // background. Without the manifest case the precached copies would never be
  // reachable, since nothing else in this handler returns them.
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('manifest.json');

  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then(function (cached) {
      const network = fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});

// Focus an existing window and navigate it, or open a new one.
function openAppAt(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
    for (const client of clientList) {
      if ('focus' in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  });
}

self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'DynaX', body: event.data ? event.data.text() : '' };
  }

  // The backend nests routing info under `data`; older pushes put it top level.
  const data = payload.data || {};
  const title = payload.title || 'DynaX';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    data: Object.assign({}, data, { url: data.call_url || data.url || payload.url || '/dashboard' }),
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
  };

  // Incoming calls get answer/decline buttons and stay up until the user acts.
  if (data.type === 'call_incoming') {
    options.actions = [
      { action: 'answer', title: '📞 Answer' },
      { action: 'decline', title: '❌ Decline' },
    ];
    options.requireInteraction = true;
    options.tag = 'incoming-call';
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data || {};

  // Decline just dismisses; the caller is not signalled yet.
  if (event.action === 'decline') return;

  const url = data.url || '/dashboard';
  event.waitUntil(openAppAt(url));
});
