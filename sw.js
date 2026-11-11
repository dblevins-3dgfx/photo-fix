const PRECACHE = ["./","./apple-touch-icon.png","./assets/index-BPt9yv34.css","./assets/index-N71gxFCu.js","./assets/worker-Dhgu95go.js","./icon-192.png","./icon-512.png","./icon.svg","./manifest.webmanifest"];
const VERSION = "1w89mjq";
function cacheName(scopePath, version) {
	return `photo-fix:${scopePath}:${version}`;
}
function staleCaches(names, scopePath, version) {
	const folder = `photo-fix:${scopePath}:`;
	const preview = scopePath.includes("/pr-preview/");
	return names.filter((n) => n.startsWith(folder) && n !== folder + version || !preview && n.startsWith("photo-fix-"));
}
function isOwnPage(pathname, scopePath) {
	return pathname === scopePath || pathname === `${scopePath}index.html`;
}
// The service worker (SPEC.md section 2, Offline). The build puts PRECACHE
// (every published file), VERSION and the functions cacheName, staleCaches
// and isOwnPage (src/lib/precache.ts) ahead of this. On install it caches
// the files; its own page is fetched from the network first, so a new
// version is picked up on the next visit, and from the cache when offline.
// Every other file comes from the cache. Its own folder's older caches are
// deleted; other folders' (the live app's, a preview's) are left alone.
/* global PRECACHE, VERSION, cacheName, staleCaches, isOwnPage */

// The folder this service worker covers, as a path
const SCOPE = new URL(self.registration.scope).pathname;
const CACHE = cacheName(SCOPE, VERSION);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(staleCaches(keys, SCOPE, VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // A visit to a folder inside this one (a preview's first) is not this
    // build's page: the browser fetches it as usual
    if (!isOwnPage(url.pathname, SCOPE)) return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.open(CACHE).then((cache) => cache.match('./', { ignoreSearch: true }))),
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(request, { ignoreSearch: true })).then((hit) => hit || fetch(request)),
  );
});
