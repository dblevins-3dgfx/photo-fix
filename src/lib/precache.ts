// What the service worker caches (SPEC.md section 2, Offline): every file
// the build publishes, so the app opens without the network after the first
// visit. The build writes the list and its version into sw.js.

// The files to cache, relative to the service worker's folder: the page
// ('./', which is index.html) and every other published file, except the
// service worker itself and source maps
export function precacheUrls(files: readonly string[]) {
  const urls = files
    .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && f !== 'index.html')
    .map((f) => `./${f}`);
  return ['./', ...[...new Set(urls)].sort()];
}

// A short version that changes whenever the list does (hashed file names
// change with their contents), so a new build replaces the old cache
export function precacheVersion(urls: readonly string[]) {
  let h = 2166136261;
  for (const ch of urls.join('\n')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
}

// The live app and every pull request preview are on one site, and a
// site's caches are shared by all its service workers, whatever folder
// each one covers. So a build names its cache after its folder, and only
// ever clears its own folder's. The three functions below run inside the
// service worker too (serviceWorkerSource writes them into it), so each
// must stand alone: no imports, and nothing from this file but each other.

// The name of a build's cache: its folder (the service worker's scope, as
// a path) and its version
export function cacheName(scopePath: string, version: string) {
  return `photo-fix:${scopePath}:${version}`;
}

// The caches a newly active build deletes, out of all the site's caches:
// its own folder's older versions. The live app (any folder that isn't a
// preview's) also deletes the caches named the old way, `photo-fix-<version>`,
// from before caches were named by folder.
export function staleCaches(names: readonly string[], scopePath: string, version: string) {
  const folder = `photo-fix:${scopePath}:`;
  const preview = scopePath.includes('/pr-preview/');
  return names.filter((n) => (n.startsWith(folder) && n !== folder + version) || (!preview && n.startsWith('photo-fix-')));
}

// Whether a page address is this build's own page. A service worker also
// sees visits to folders inside its own (the live app's sees a preview's
// first visit), which are not its page to cache or to answer offline.
export function isOwnPage(pathname: string, scopePath: string) {
  return pathname === scopePath || pathname === `${scopePath}index.html`;
}

// The service worker's source: the list, the version and the functions
// above, then the template
export const serviceWorkerSource = (template: string, urls: readonly string[]) =>
  [
    `const PRECACHE = ${JSON.stringify(urls)};`,
    `const VERSION = ${JSON.stringify(precacheVersion(urls))};`,
    cacheName.toString(),
    staleCaches.toString(),
    isOwnPage.toString(),
    template,
  ].join('\n');
