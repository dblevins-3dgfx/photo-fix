import { describe, expect, it } from 'vitest';
import { precacheUrls, precacheVersion, serviceWorkerSource } from './precache';

describe('What the service worker caches', () => {
  it('the page and every published file, but not itself or source maps', () => {
    expect(precacheUrls(['index.html', 'assets/b.js', 'sw.js', 'assets/b.js.map', 'icon-192.png', 'assets/a.css']))
      .toEqual(['./', './assets/a.css', './assets/b.js', './icon-192.png']);
  });
  it('a new build with different files gets a new version', () => {
    expect(precacheVersion(['./', './a-1.js'])).not.toBe(precacheVersion(['./', './a-2.js']));
    expect(precacheVersion(['./', './a-1.js'])).toBe(precacheVersion(['./', './a-1.js']));
  });
  it('writes the list and version ahead of the template', () => {
    const src = serviceWorkerSource('/* sw */', ['./']);
    expect(src).toMatch(/^const PRECACHE = \["\.\/"\];\nconst VERSION = "[0-9a-z]+";\n\/\* sw \*\/$/);
  });
});
