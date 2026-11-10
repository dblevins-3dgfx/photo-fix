// The save loop (SPEC.md section 7): render each photo and hand it to the
// destination, whatever that is. The browser's part (the Web Worker, the
// Save dialog, the share sheet, downloads) is passed in, in src/save.ts.
// `B` is what a rendered file is: a Blob in the browser.

import { fixedName, freeName } from './filename';
import type { SaveOutcome } from './messages';
import type { SaveMethod } from './save-method';

// A photo rendered for saving, and the size it came out at
export interface Rendered<B> {
  blob: B;
  width: number;
  height: number;
  // Scaled down to what the device can save (Too large for the device)
  scaled: boolean;
  origWidth: number;
  origHeight: number;
}

// How a destination ends: 'needs a tap' when it wants a fresh tap first
// (the share sheet, after a long render)
export type Finish = 'done' | 'cancelled' | 'needs a tap';

// Where saved files go: one file from the Save dialog, a folder, the share
// sheet, or downloads
export interface Destination<B> {
  method: SaveMethod;
  // Asks where to put the files, before anything is rendered, given the
  // names they would get. Null when the user cancels. A folder answers
  // with the names already in it (`taken`), which new files must not
  // replace; the others leave it out.
  prepare(names: readonly string[]): Promise<{ taken?: readonly string[] } | null>;
  // Takes one rendered file; answers with the name it went under
  deliver(blob: B, name: string): Promise<string>;
  // After the last file. May be called again after 'needs a tap'.
  finish(): Promise<Finish>;
}

export interface SaveResult {
  outcome: SaveOutcome;
  // Nothing to report: the user cancelled
  cancelled?: boolean;
  // The names delivered but not yet out, while the destination needs a tap.
  // `outcome` holds the rest (failures, sizes) for when they are.
  pending?: string[];
}

// What `finish` came to, for a save with `delivered` waiting on it
function finished(outcome: SaveOutcome, delivered: string[], how: Finish): SaveResult {
  if (how === 'needs a tap') return { outcome, pending: delivered };
  if (how === 'cancelled') return { outcome, cancelled: outcome.failed.length === 0 };
  return { outcome: { ...outcome, saved: [...outcome.saved, ...delivered] } };
}

// Saves `photos` (one for Save, all for Save all) to `destination`,
// reporting progress before each. A photo that fails is named in the
// outcome, and the others still save.
export async function savePhotos<P extends { name: string }, B>(
  photos: readonly P[],
  render: (photo: P) => Promise<Rendered<B>>,
  destination: Destination<B>,
  progress: (n: number, total: number) => void,
): Promise<SaveResult> {
  const outcome: SaveOutcome = { method: destination.method, saved: [], failed: [], smaller: [] };
  const prepared = await destination.prepare(photos.map((p) => fixedName(p.name)));
  if (!prepared) return { outcome, cancelled: true };

  const taken = prepared.taken ? [...prepared.taken] : null;
  const delivered: string[] = [];
  for (const [i, photo] of photos.entries()) {
    progress(i + 1, photos.length);
    let name = fixedName(photo.name);
    try {
      const r = await render(photo);
      if (taken) {
        // A name already in the folder is not replaced: the number goes up
        // until it is free, counting the names saved before it
        name = freeName(name, taken);
        taken.push(name);
      }
      name = await destination.deliver(r.blob, name);
      delivered.push(name);
      if (r.scaled) outcome.smaller.push({ name, width: r.width, height: r.height, origWidth: r.origWidth, origHeight: r.origHeight });
    } catch {
      outcome.failed.push(name);
    }
  }
  if (delivered.length === 0) return { outcome };
  return finished(outcome, delivered, await destination.finish());
}

// After 'needs a tap' and a fresh tap: finishes the save `result` left pending
export async function finishPending<B>(destination: Destination<B>, result: SaveResult): Promise<SaveResult> {
  const delivered = result.pending ?? [];
  const how = await destination.finish();
  // Cancelling now says nothing, whatever failed before
  if (how === 'cancelled') return { outcome: result.outcome, cancelled: true };
  return finished(result.outcome, delivered, how);
}
