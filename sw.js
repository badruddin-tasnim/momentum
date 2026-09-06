/* Momentum service worker — app-shell caching for offline use. */
const VERSION = 'momentum-v7';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept sync traffic to GitHub.
  if (url.hostname.endsWith('github.com') || url.hostname.endsWith('githubusercontent.com')) return;

  // App shell: network-first so updates land quickly, cache fallback for offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Fonts & CDN scripts: cache-first (they're versioned / immutable).
  if (url.hostname.includes('fonts.g') || url.hostname.includes('jsdelivr.net')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
