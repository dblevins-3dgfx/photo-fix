import { describe, expect, it } from 'vitest';
import { addCsp, contentSecurityPolicy, inlineScripts } from './csp';

describe('Content Security Policy', () => {
  const policy = contentSecurityPolicy();
  const directive = (name: string) => policy.split('; ').find((d) => d.startsWith(`${name} `));

  it('lets the page contact nothing but its own site', () => {
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('connect-src')).toBe("connect-src 'self'");
    expect(policy).not.toMatch(/https?:/);
  });
  it('allows no inline scripts and no eval', () => {
    expect(directive('script-src')).toBe("script-src 'self'");
    expect(policy).not.toContain('unsafe-eval');
  });
  it('allows blob and data images, own workers and manifest, and nothing else', () => {
    expect(directive('img-src')).toBe("img-src 'self' blob: data:");
    expect(directive('worker-src')).toBe("worker-src 'self'");
    expect(directive('manifest-src')).toBe("manifest-src 'self'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
    expect(directive('form-action')).toBe("form-action 'none'");
  });
  it('goes first in <head>', () => {
    const html = addCsp('<html><head><title>x</title></head><body><script type="module" src="/a.js"></script></body></html>');
    expect(html).toMatch(/^<html><head>\s*<meta http-equiv="Content-Security-Policy" content="default-src 'self';/);
  });
  it('fails the build on an inline script', () => {
    expect(inlineScripts('<script src="/a.js"></script><script>  </script>')).toEqual([]);
    expect(inlineScripts('<script type="module">go()</script>')).toEqual(['go()']);
    expect(() => addCsp('<head></head><script>go()</script>')).toThrow(/inline script/);
  });
  it('fails without a <head>', () => {
    expect(() => addCsp('<body></body>')).toThrow(/<head>/);
  });
});
