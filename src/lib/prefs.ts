// The preferences (SPEC.md section 8), kept as one JSON object under
// `photo-fix.prefs` (or a preview's own key, section 10). Reading falls back
// to the default field by field, and ignores unknown fields.

import { fieldDefaults, readFields, type Field } from './fields';

export interface Prefs {
  autoOnNewPhotos: boolean;
  jpegQuality: number;
}

// One entry for each preference. The defaults, the checks when reading and
// the Preferences dialog's controls are built from this table.
export const PREFERENCES = [
  { key: 'autoOnNewPhotos', label: 'Auto on for new photos', kind: 'switch', default: true },
  { key: 'jpegQuality', label: 'JPEG quality', kind: 'slider', min: 60, max: 100, default: 92 },
] as const satisfies readonly Field<keyof Prefs>[];

// A preference left out of the table fails the typecheck here
type Missing = Exclude<keyof Prefs, (typeof PREFERENCES)[number]['key']>;
const covered: [Missing] extends [never] ? true : never = true;
void covered;

export const DEFAULT_PREFS = fieldDefaults(PREFERENCES) as unknown as Prefs;

export function parsePrefs(raw: string | null): Prefs {
  let obj: unknown = null;
  try {
    obj = raw === null ? null : JSON.parse(raw);
  } catch {
    obj = null;
  }
  return readFields(PREFERENCES, obj) as unknown as Prefs;
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
