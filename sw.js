/* Service worker: caches the app shell only. API calls (other origin) are never cached. */
const CACHE = 'vnf-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'vip.js', 'app.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // let API/network pass through
  // network-first so updates show quickly, cache fallback for offline
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
