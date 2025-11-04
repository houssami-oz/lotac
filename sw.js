const VERSION = 'v1.0.3';
const STATIC = `static-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;

const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(STATIC).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>(k!==STATIC && k!==RUNTIME)?caches.delete(k):null)))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(e.request.method!=='GET') return;
  if(url.origin===location.origin && (url.pathname==='/' || url.pathname==='/index.html' || url.pathname.startsWith('/icons') || url.pathname==='/manifest.json')){
    e.respondWith(caches.match(e.request).then(c=>c || fetch(e.request).then(r=>{ const cp=r.clone(); caches.open(STATIC).then(cc=>cc.put(e.request,cp)); return r; })));
    return;
  }
  if(url.pathname.startsWith('/api/')){
    e.respondWith(fetch(e.request).then(r=>{ const cp=r.clone(); caches.open(RUNTIME).then(cc=>cc.put(e.request,cp)); return r; }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(c=>c || fetch(e.request)));
});
