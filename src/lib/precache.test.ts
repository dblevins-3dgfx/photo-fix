import { describe, expect, it } from 'vitest';
import { cacheName, isOwnPage, precacheUrls, precacheVersion, serviceWorkerSource, staleCaches } from './precache';

describe('What the service worker caches', () => {
  it('the page and every published file, but not itself or source maps', () => {
    expect(precacheUrls(['index.html', 'assets/b.js', 'sw.js', 'assets/b.js.map', 'icon-192.png', 'assets/a.css']))
      .toEqual(['./', './assets/a.css', './assets/b.js', './icon-192.png']);
  });
  it('a new build with different files gets a new version', () => {
    expect(precacheVersion(['./', './a-1.js'])).not.toBe(precacheVersion(['./', './a-2.js']));
    expect(precacheVersion(['./', './a-1.js'])).toBe(precacheVersion(['./', './a-1.js']));
  });
  it('writes the list, the version and the cache functions ahead of the template', () => {
    const src = serviceWorkerSource('/* sw */', ['./']);
    expect(src).toMatch(/^const PRECACHE = \["\.\/"\];\nconst VERSION = "[0-9a-z]+";\n/);
    expect(src.endsWith('\n/* sw */')).toBe(true);
    // The functions written into the service worker are the ones tested here, and stand alone there
    const built = new Function(`${src}\nreturn { cacheName, staleCaches, isOwnPage, VERSION };`)();
    expect(built.cacheName('/photo-fix/', built.VERSION)).toBe(cacheName('/photo-fix/', precacheVersion(['./'])));
    expect(built.staleCaches(['photo-fix:/a/:1', 'photo-fix:/a/:2'], '/a/', '2')).toEqual(['photo-fix:/a/:1']);
    expect(built.isOwnPage('/a/', '/a/')).toBe(true);
  });
});

describe('Caches on a site shared by the live app and previews', () => {
  const live = '/photo-fix/';
  const preview = '/photo-fix/pr-preview/pr-7/';
  const all = [
    cacheName(live, 'old'), cacheName(live, 'new'),
    cacheName(preview, 'p1'), cacheName(preview, 'p2'),
    cacheName('/photo-fix/pr-preview/pr-70/', 'q1'),
    'photo-fix-legacy1', 'someone-elses-cache',
  ];
  it('a cache is named after its folder and its version', () => {
    expect(cacheName(live, 'abc')).toBe('photo-fix:/photo-fix/:abc');
    expect(cacheName(preview, 'abc')).not.toBe(cacheName(live, 'abc'));
  });
  it('the live app deletes its own older versions and never a preview\'s', () => {
    const gone = staleCaches(all, live, 'new');
    expect(gone).toContain(cacheName(live, 'old'));
    expect(gone).not.toContain(cacheName(live, 'new'));
    expect(gone.filter((n) => n.includes('pr-preview'))).toEqual([]);
  });
  it('a preview deletes only its own older versions, never the live app\'s or another preview\'s', () => {
    expect(staleCaches(all, preview, 'p2')).toEqual([cacheName(preview, 'p1')]);
  });
  it('caches named the old way are cleared by the live app, not by a preview', () => {
    expect(staleCaches(all, live, 'new')).toContain('photo-fix-legacy1');
    expect(staleCaches(all, preview, 'p2')).not.toContain('photo-fix-legacy1');
  });
  it('another app\'s caches on the site are left alone', () => {
    expect(staleCaches(all, live, 'new')).not.toContain('someone-elses-cache');
  });
  it('only a build\'s own page is its to cache: not a preview\'s first visit, seen by the live app', () => {
    expect(isOwnPage('/photo-fix/', live)).toBe(true);
    expect(isOwnPage('/photo-fix/index.html', live)).toBe(true);
    expect(isOwnPage('/photo-fix/pr-preview/pr-7/', live)).toBe(false);
    expect(isOwnPage('/photo-fix/pr-preview/pr-7/', preview)).toBe(true);
  });
});
