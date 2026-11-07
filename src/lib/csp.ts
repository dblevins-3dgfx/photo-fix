// The Content Security Policy (SPEC.md section 2, Security). GitHub Pages
// can't send headers, so the build puts it in a <meta> tag in index.html.
// It lets the page load and contact nothing but its own site.

export function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // React writes style attributes (a slider's position)
    "style-src 'self' 'unsafe-inline'",
    // Previews and thumbnails are drawn from blobs
    "img-src 'self' blob: data:",
    // The Web Worker and the service worker
    "worker-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

// The inline scripts in a page (a <script> with content and no src), which
// the policy would block
export function inlineScripts(html: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc\s*=/i.test(m[1]) && m[2].trim() !== '') found.push(m[2]);
  }
  return found;
}

// The page with the policy's <meta> tag first in <head>. Fails if the page
// has an inline script or no <head>.
export function addCsp(html: string) {
  if (inlineScripts(html).length > 0) throw new Error('index.html has an inline script, which the Content-Security-Policy would block');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}" />`;
  const out = html.replace(/<head>/i, `<head>\n    ${meta}`);
  if (out === html) throw new Error('No <head> to add the Content-Security-Policy to');
  return out;
}
