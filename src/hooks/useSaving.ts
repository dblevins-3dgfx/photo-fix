// Save and Save all (SPEC.md section 7): runs the save loop
// (lib/save-photos.ts) with the browser's renderer and destination
// (src/save.ts), and puts progress and the result on the status line. When
// the share sheet wants a fresh tap, `shareNow` is for the Share button.

import { useState } from 'react';
import * as words from '../lib/messages';
import { finishPending, savePhotos, type Destination, type SaveResult } from '../lib/save-photos';
import type { Photo } from '../photo';
import { destinationFor, renderPhoto } from '../save';
import type { Status } from './useStatus';

export function useSaving(quality: number, status: Status) {
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, setPending] = useState<{ destination: Destination<Blob>; result: SaveResult } | null>(null);

  // What a save, or the tap after it, came to
  const report = (destination: Destination<Blob>, result: SaveResult, photoId: number | undefined) => {
    if (result.pending) {
      setPending({ destination, result });
      status.show(words.readyToShare(result.pending.length), photoId);
    } else if (!result.cancelled) {
      status.show(words.saveResult(result.outcome), photoId);
    }
  };

  const save = async (photos: readonly Photo[]) => {
    if (photos.length === 0 || progress) return;
    // The result goes on the photo that was current when the save began
    const photoId = status.photoId();
    setPending(null);
    try {
      const destination = destinationFor(photos.length > 1);
      const result = await savePhotos(
        photos, (p) => renderPhoto(p, quality), destination, (n, total) => setProgress(words.saving(n, total)));
      report(destination, result, photoId);
    } catch {
      status.show(words.saveFailed(photos.map((p) => p.name)), photoId);
    } finally {
      setProgress(null);
    }
  };

  const shareNow = async () => {
    if (!pending) return;
    const { destination, result } = pending;
    const photoId = status.photoId();
    setPending(null);
    try {
      const after = await finishPending(destination, result);
      if (after.cancelled) status.show(null, photoId);
      else report(destination, after, photoId);
    } catch {
      status.show(words.saveFailed(result.pending ?? []), photoId);
    }
  };

  return { progress, save, canShareNow: pending !== null && !progress, shareNow };
}
