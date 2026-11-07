// The preferences in localStorage (SPEC.md section 8). Making sense of what
// was read is parsePrefs in lib/prefs.ts. A preview build keeps its own key
// (section 10), copied from the live app's the first time it opens.

import { parsePrefs, prefsKey, previewNumber, seedPreview, serializePrefs, type Prefs } from './lib/prefs';

export const PREVIEW = previewNumber(import.meta.env.VITE_PREVIEW);
const KEY = prefsKey(PREVIEW);

export function loadPrefs(): Prefs {
  try {
    if (PREVIEW) seedPreview(localStorage, PREVIEW);
    return parsePrefs(localStorage.getItem(KEY));
  } catch {
    return parsePrefs(null);
  }
}

export function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(KEY, serializePrefs(prefs));
  } catch {
    // Storage blocked or full: the preference holds until the page closes
  }
}
