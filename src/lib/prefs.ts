// The preferences (SPEC.md section 8), kept as one JSON object under
// `photo-fix.prefs` (or a preview's own key, section 10). Reading falls back
// to the default field by field, and ignores unknown fields.

export interface Prefs {
  autoOnNewPhotos: boolean;
  jpegQuality: number;
}

export const DEFAULT_PREFS: Prefs = { autoOnNewPhotos: true, jpegQuality: 92 };
export const MIN_QUALITY = 60;
export const MAX_QUALITY = 100;

export function parsePrefs(raw: string | null): Prefs {
  let obj: unknown = null;
  try {
    obj = raw === null ? null : JSON.parse(raw);
  } catch {
    obj = null;
  }
  const o = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
  const q = o.jpegQuality;
  return {
    autoOnNewPhotos: typeof o.autoOnNewPhotos === 'boolean' ? o.autoOnNewPhotos : DEFAULT_PREFS.autoOnNewPhotos,
    jpegQuality:
      typeof q === 'number' && Number.isInteger(q) && q >= MIN_QUALITY && q <= MAX_QUALITY ? q : DEFAULT_PREFS.jpegQuality,
  };
}

export const serializePrefs = (p: Prefs) => JSON.stringify(p);

// Pull-request previews (section 10) share the live app's storage (one
// site), so each keeps its preferences under a key of its own, copied once
// from the live app's the first time it opens.

// The preview a build is for, or null for the live app. Only digits count.
export const previewNumber = (raw: string | undefined | null): string | null =>
  raw && /^\d+$/.test(raw) ? raw : null;

export const LIVE_KEY = 'photo-fix.prefs';
export const prefsKey = (pr: string | null) => (pr ? `photo-fix.preview.${pr}.prefs` : LIVE_KEY);

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Copies the live preferences to preview `pr`, once (a marker records that
// it was done); a preview that already has its own is left alone
export function seedPreview(store: KeyValueStore, pr: string) {
  const marker = `photo-fix.preview.${pr}.seeded`;
  if (store.getItem(marker) !== null) return;
  const live = store.getItem(LIVE_KEY);
  if (live !== null && store.getItem(prefsKey(pr)) === null) store.setItem(prefsKey(pr), live);
  store.setItem(marker, '1');
}
