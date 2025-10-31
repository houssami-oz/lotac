/* sw.js */
const VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const STATIC_ASSETS = [
  '/',              // index.html
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/fr.js',
  'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== STATIC_CACHE && k !== RUNTIME_CACHE) ? caches.delete(k) : null))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // on ne gère que GET
  if (e.request.method !== 'GET') return;

  // 1) assets statiques : cache-first
  if (
    url.origin === location.origin &&
    (url.pathname === '/' ||
     url.pathname.startsWith('/icons') ||
     url.pathname === '/manifest.json')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(STATIC_CACHE).then(c => c.put(e.request, copy));
        return r;
      }))
    );
    return;
  }

  // 2) APIs / runtime : network-first, fallback cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 3) le reste : cache-first pour soulager le réseau
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(RUNTIME_CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => cached))
  );
});
