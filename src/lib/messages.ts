// The status line's words (SPEC.md sections 3, 4, 5 and 7)

export const EYEDROPPER = 'Tap something that should be white or gray';
export const TOO_DARK = 'Too dark to judge. Pick something lighter';

export function unsupported(names: readonly string[]) {
  const list = names.join(', ');
  return names.length === 1
    ? `${list} couldn't be opened: its format isn't supported. Try JPEG or PNG instead.`
    : `${names.length} files couldn't be opened (${list}): their format isn't supported. Try JPEG or PNG instead.`;
}

export const saving = (n: number, total: number) => (total > 1 ? `Saving ${n} of ${total}` : 'Saving');

export function savedSmaller(width: number, height: number, origWidth: number, origHeight: number) {
  return `Saved at ${width} x ${height}, smaller than the ${origWidth} x ${origHeight} scan, the most this device can save`;
}

export function saved(names: readonly string[]) {
  return names.length === 1 ? `Saved ${names[0]}` : `Saved ${names.length} photos`;
}

export function saveFailed(names: readonly string[]) {
  return names.length === 1 ? `Couldn't save ${names[0]}` : `Couldn't save ${names.join(', ')}`;
}

export const readyToShare = (n: number) => (n === 1 ? 'Ready to save. Tap Share' : `${n} photos ready to save. Tap Share`);

// What a save did
export interface SaveOutcome {
  saved: string[];
  failed: string[];
  // Photos saved smaller than the scan (Too large for the device)
  smaller: { name: string; width: number; height: number; origWidth: number; origHeight: number }[];
}

// The status line after a save: failures first, then what was saved and
// whether any of it is smaller than the scan
export function saveResult(o: SaveOutcome): string | null {
  const parts: string[] = [];
  if (o.failed.length > 0) parts.push(saveFailed(o.failed));
  if (o.saved.length === 1 && o.smaller.length === 1) {
    const s = o.smaller[0];
    parts.push(savedSmaller(s.width, s.height, s.origWidth, s.origHeight));
  } else if (o.saved.length > 0) {
    let line = saved(o.saved);
    if (o.smaller.length > 0) {
      line += o.smaller.length === 1
        ? `. ${o.smaller[0].name} was saved smaller than its scan, the most this device can save`
        : `. ${o.smaller.length} were saved smaller than their scans, the most this device can save`;
    }
    parts.push(line);
  }
  return parts.length > 0 ? parts.join('. ') : null;
}
