// Offline support for the website: after one visit the page opens with no network.
// - the page itself: network first (so updates show up at once), cached copy when offline
// - icons, manifest and Google Fonts: cached the first time they are used
// - pronunciation audio is not touched (media range requests behave differently
//   across browsers); offline, the page falls back to the browser's own voice
const CACHE = 'ogden-850-v1';
const CORE = ['/', '/manifest.json', '/favicon.png', '/icons/ogden-icon-192.png', '/icons/ogden-apple-touch-icon.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ogden-850-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function pageNetworkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000); // slow network: show the cached copy instead
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) await cache.put('/', res.clone());
    return res;
  } catch (err) {
    return (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (req.mode === 'navigate' || (sameOrigin && (url.pathname === '/' || url.pathname === '/index.html'))) {
    e.respondWith(pageNetworkFirst(req));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req));
  } else if (sameOrigin && (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json' || url.pathname === '/favicon.png')) {
    e.respondWith(cacheFirst(req));
  }
  // everything else (/api/tts, Google TTS) goes straight to the network
});
