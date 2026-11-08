const PRECACHE = ["./","./apple-touch-icon.png","./assets/index-CDs54VtR.js","./assets/index-FswRyncL.css","./assets/render-worker-DavWgkBV.js","./icon-192.png","./icon-512.png","./icon.svg","./manifest.webmanifest"];
const VERSION = "1x6jm6i";
// The service worker (SPEC.md section 2, Offline). The build puts PRECACHE
// (every published file) and VERSION ahead of this. On install it caches
// them all; the page is fetched from the network first, so a new version
// is picked up on the next visit, and from the cache when offline. Every
// other file comes from the cache. Old versions' caches are deleted.
/* global PRECACHE, VERSION */

const CACHE = `photo-fix-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('photo-fix-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
});
