// The status line's words (SPEC.md sections 3, 4, 5 and 7)

import type { SaveMethod } from './save-method';

export const EYEDROPPER = 'Tap something that should be white or gray';
export const TOO_DARK = 'Too dark to judge. Pick something lighter';

export function unsupported(names: readonly string[]) {
  const list = names.join(', ');
  return names.length === 1
    ? `${list} couldn't be opened: its format isn't supported. Try JPEG or PNG instead.`
    : `${names.length} files couldn't be opened (${list}): their format isn't supported. Try JPEG or PNG instead.`;
}

// While photos open (section 3): which one of how many
export const opening = (n: number, total: number) => (total > 1 ? `Opening ${n} of ${total}` : 'Opening');

export const saving = (n: number, total: number) => (total > 1 ? `Saving ${n} of ${total}` : 'Saving');

// What a save did, by where it went (section 7, Where it goes): the Save
// dialog saved it, the share sheet shared it (Photo Fix can't tell whether
// it went to Photos, Files or a message), and a download was only started.
// The method is always named: nothing is called saved by default.
const VERB: Record<SaveMethod, string> = { dialog: 'Saved', share: 'Shared', download: 'Downloaded' };
export const LOOK_IN_DOWNLOADS = 'Look in your Downloads folder';

export function savedSmaller(width: number, height: number, origWidth: number, origHeight: number, method: SaveMethod) {
  return `${VERB[method]} at ${width} x ${height}, smaller than the ${origWidth} x ${origHeight} scan, the most this device can save`;
}

export function saved(names: readonly string[], method: SaveMethod) {
  return names.length === 1 ? `${VERB[method]} ${names[0]}` : `${VERB[method]} ${names.length} photos`;
}

export function saveFailed(names: readonly string[]) {
  return names.length === 1 ? `Couldn't save ${names[0]}` : `Couldn't save ${names.join(', ')}`;
}

export const readyToShare = (n: number) => (n === 1 ? 'Ready to save. Tap Share' : `${n} photos ready to save. Tap Share`);

// What a save did
export interface SaveOutcome {
  method: SaveMethod;
  // Saved, shared or downloaded, by method
  saved: string[];
  failed: string[];
  // Photos saved smaller than the scan (Too large for the device)
  smaller: { name: string; width: number; height: number; origWidth: number; origHeight: number }[];
}

// The status line after a save: failures first, then what was saved (or
// shared, or downloaded) and whether any of it is smaller than the scan; a
// download adds where to look
export function saveResult(o: SaveOutcome): string | null {
  const parts: string[] = [];
  if (o.failed.length > 0) parts.push(saveFailed(o.failed));
  if (o.saved.length === 1 && o.smaller.length === 1) {
    const s = o.smaller[0];
    parts.push(savedSmaller(s.width, s.height, s.origWidth, s.origHeight, o.method));
  } else if (o.saved.length > 0) {
    let line = saved(o.saved, o.method);
    if (o.smaller.length > 0) {
      line += o.smaller.length === 1
        ? `. ${o.smaller[0].name} is smaller than its scan, the most this device can save`
        : `. ${o.smaller.length} are smaller than their scans, the most this device can save`;
    }
    parts.push(line);
  }
  if (o.saved.length > 0 && o.method === 'download') parts.push(LOOK_IN_DOWNLOADS);
  return parts.length > 0 ? parts.join('. ') : null;
}
