const CACHE = 'ronaut-v1';
const STATIC = [
  '/',
  '/index.html',
  '/assets/favicon.png',
  '/assets/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
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
  // Never cache: HLS stream, API calls, WebSocket, external CDNs
  if (
    url.includes('stream.ronautradio.la') ||
    url.includes('.m3u8') ||
    url.includes('.ts') ||
    url.includes('googleapis') ||
    url.includes('googletagmanager') ||
    url.includes('socket.io')
  ) return;

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
