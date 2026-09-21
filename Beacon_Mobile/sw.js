/* Beacon service worker
   v6 — network-first for the app shell so updates land without reinstalling,
   and the new worker WAITS so the app can prompt you to reload. */

const VERSION = 1;
const CACHE = `site-cache-v${VERSION}`;
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;600;700;800;900&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  // NOTE: deliberately no skipWaiting() here. The new worker stays in the
  // "waiting" state so the page can show an update prompt, then tell it to
  // take over via the SKIP_WAITING message below.
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page asks the waiting worker to activate immediately.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const isDocument =
    e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    e.request.destination === 'script';

  if (isDocument) {
    // Network-first: always try for the latest build, fall back to cache offline.
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, fonts) — these rarely change.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
      }
      return resp;
    }).catch(() => undefined))
  );
});
