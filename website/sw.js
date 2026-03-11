const CACHE = 'ronaut-v3';
const STATIC_ASSETS = [
  '/assets/favicon.png',
  '/assets/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept: HLS stream, API, WebSocket, external CDNs
  if (
    url.includes('stream.ronautradio.la') ||
    url.includes('.m3u8') ||
    url.includes('.ts') ||
    url.includes('googleapis') ||
    url.includes('googletagmanager') ||
    url.includes('socket.io') ||
    url.includes('cdn.') ||
    url.includes('vjs.zencdn') ||
    url.includes('jsdelivr') ||
    url.includes('unpkg')
  ) return;

  // Network-first for HTML — always get fresh index.html on deploy
  if (e.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (favicon, icons)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
