const PRECACHE = ["./","./apple-touch-icon.png","./assets/index-8XJUhZ6N.css","./assets/index-DbhNCLzS.js","./assets/worker-Dhgu95go.js","./icon-192.png","./icon-512.png","./icon.svg","./manifest.webmanifest"];
const VERSION = "1ycx8an";
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
// the files, and every file, the page included, comes from that cache, so
// a page and the files it loads later (the background worker's script) are
// always one version. A new version installs beside the old one and waits
// until no page of the old one is open, then takes over and deletes its
// own folder's older caches; other folders' (the live app's, a preview's)
// are left alone.
/* global PRECACHE, VERSION, cacheName, staleCaches, isOwnPage */

// The folder this service worker covers, as a path
const SCOPE = new URL(self.registration.scope).pathname;
const CACHE = cacheName(SCOPE, VERSION);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(staleCaches(keys, SCOPE, VERSION).map((k) => caches.delete(k))))
      // On the first visit, take the page that installed it; after that no
      // page is left open by the time a new version gets here
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
      caches.open(CACHE).then((cache) => cache.match('./', { ignoreSearch: true })).then((hit) => hit || fetch(request)),
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(request, { ignoreSearch: true })).then((hit) => hit || fetch(request)),
  );
});
