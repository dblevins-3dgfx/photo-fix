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

// The service worker's source: the template with the list and version
export const serviceWorkerSource = (template: string, urls: readonly string[]) =>
  `const PRECACHE = ${JSON.stringify(urls)};\nconst VERSION = ${JSON.stringify(precacheVersion(urls))};\n${template}`;
