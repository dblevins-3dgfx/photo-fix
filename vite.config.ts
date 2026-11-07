import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { addCsp } from './src/lib/csp.ts';
import { precacheUrls, serviceWorkerSource } from './src/lib/precache.ts';

// The built page gets the Content Security Policy (SPEC.md section 2,
// Security), and the build fails on an inline script it would block. The
// dev server goes without, since Vite's hot reload uses inline scripts.
const contentSecurityPolicy = (): Plugin => ({
  name: 'photo-fix:csp',
  apply: 'build',
  transformIndexHtml: { order: 'post', handler: (html) => addCsp(html) },
});

// sw.js: the service worker, with the list of every published file
const serviceWorker = (): Plugin => ({
  name: 'photo-fix:service-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    const publicFiles = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon.svg'];
    const urls = precacheUrls([...Object.keys(bundle), ...publicFiles]);
    const template = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8');
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(template, urls) });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), serviceWorker()],
  // Where the site is served from. The GitHub Pages deploy sets BASE_PATH
  // to /photo-fix/ (or a preview's folder); everywhere else it is the root.
  base: process.env.BASE_PATH || '/',
  // Listen on the network, so a phone on the same network can open it
  server: { host: true },
  worker: { format: 'es' },
});
