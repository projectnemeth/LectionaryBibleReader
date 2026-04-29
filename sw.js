/* Daily Word — service worker
   Cache strategy:
   - App shell (HTML/CSS/JS): cache-first with background revalidate.
   - API.Bible passage requests: network-first, fall back to cache so today's
     reading remains available offline once you've opened it.
   - RSS feed: network-only (always fresh; today's date matters).
*/

const VERSION = 'dailyword-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
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

  // RSS / proxy: network only (today's content)
  if (url.pathname.includes('lectionary') || url.hostname.includes('allorigins') || url.hostname.includes('corsproxy')) {
    return; // default: hit network
  }

  // API.Bible passages: network-first, then cache fallback
  if (url.hostname === 'api.scripture.api.bible') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // App shell: cache-first with revalidate
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
  }
});
