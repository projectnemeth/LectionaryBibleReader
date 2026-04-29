/* Daily Word — service worker
   Cache strategy:
   - App shell (HTML/CSS/JS): cache-first with background revalidate.
   - api.php?action=passage: network-first, fall back to cache so previously-
     viewed days remain available offline.
   - api.php?action=feed: network-only (today's date matters; feed is fresh).
*/

const VERSION = 'dailyword-v6';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isApi = url.origin === self.location.origin && /\/api\.php$/.test(url.pathname);

  if (isApi) {
    const action = url.searchParams.get('action');
    // Feed: always fresh
    if (action === 'feed') return;
    // Passages: network-first with cache fallback
    if (action === 'passage') {
      event.respondWith((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(VERSION);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          if (cached) return cached;
          throw err;
        }
      })());
      return;
    }
  }

  // App shell: cache-first with background revalidate
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
  }
});
