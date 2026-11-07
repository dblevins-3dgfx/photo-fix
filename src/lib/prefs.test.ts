import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs, prefsKey, previewNumber, seedPreview, serializePrefs } from './prefs';

describe('Preferences', () => {
  it('default to Auto on and JPEG quality 92', () => {
    expect(DEFAULT_PREFS).toEqual({ autoOnNewPhotos: true, jpegQuality: 92 });
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
  });
  it('read back what was saved', () => {
    const p = { autoOnNewPhotos: false, jpegQuality: 75 };
    expect(parsePrefs(serializePrefs(p))).toEqual(p);
  });
  it('fall back field by field', () => {
    expect(parsePrefs('{"autoOnNewPhotos":false,"jpegQuality":"high"}')).toEqual({ autoOnNewPhotos: false, jpegQuality: 92 });
    expect(parsePrefs('{"autoOnNewPhotos":1,"jpegQuality":80}')).toEqual({ autoOnNewPhotos: true, jpegQuality: 80 });
  });
  it('JPEG quality is a whole number from 60 to 100', () => {
    expect(parsePrefs('{"jpegQuality":60}').jpegQuality).toBe(60);
    expect(parsePrefs('{"jpegQuality":100}').jpegQuality).toBe(100);
    expect(parsePrefs('{"jpegQuality":59}').jpegQuality).toBe(92);
    expect(parsePrefs('{"jpegQuality":101}').jpegQuality).toBe(92);
    expect(parsePrefs('{"jpegQuality":80.5}').jpegQuality).toBe(92);
  });
  it('ignore unreadable data and unknown fields', () => {
    expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('[1,2]')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"theme":"dark","jpegQuality":70}')).toEqual({ autoOnNewPhotos: true, jpegQuality: 70 });
  });
});

describe('Preview builds', () => {
  const store = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  it('keep their own key', () => {
    expect(prefsKey(null)).toBe('photo-fix.prefs');
    expect(prefsKey('12')).toBe('photo-fix.preview.12.prefs');
    expect(previewNumber('12')).toBe('12');
    expect(previewNumber('12; x')).toBeNull();
    expect(previewNumber(undefined)).toBeNull();
  });
  it('copy the live preferences once, the first time', () => {
    const s = store({ 'photo-fix.prefs': '{"jpegQuality":70}' });
    seedPreview(s, '3');
    expect(s.getItem('photo-fix.preview.3.prefs')).toBe('{"jpegQuality":70}');
    s.setItem('photo-fix.preview.3.prefs', '{"jpegQuality":99}');
    s.setItem('photo-fix.prefs', '{"jpegQuality":61}');
    seedPreview(s, '3');
    expect(s.getItem('photo-fix.preview.3.prefs')).toBe('{"jpegQuality":99}');
    expect(s.getItem('photo-fix.prefs')).toBe('{"jpegQuality":61}');
  });
  it('copy nothing when the live app has nothing saved', () => {
    const s = store();
    seedPreview(s, '4');
    expect(s.getItem('photo-fix.preview.4.prefs')).toBeNull();
  });
});
