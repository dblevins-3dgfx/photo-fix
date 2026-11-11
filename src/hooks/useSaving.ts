// Save and Save all (SPEC.md section 7): runs the save loop
// (lib/save-photos.ts) with the browser's renderer and destination
// (src/save.ts). Where the save is, and so what the status line says, is
// savingReducer's (lib/saving.ts); what it came to goes on the status line
// as a message. When the share sheet wants a fresh tap, `shareNow` is for
// the Share button.

import { useReducer, useRef } from 'react';
import * as words from '../lib/messages';
import { finishPending, savePhotos, type Destination, type SaveResult } from '../lib/save-photos';
import { IDLE, isBusy, savingReducer, savingText, showsShare, type SavingEvent, type SavingState } from '../lib/saving';
import { releaseOriginal } from '../detail';
import type { Photo } from '../photo';
import { destinationFor, renderPhoto } from '../save';
import type { Status } from './useStatus';

interface Pending {
  destination: Destination<Blob>;
  result: SaveResult;
}

export function useSaving(quality: number, status: Status) {
  const [state, dispatch] = useReducer(savingReducer<Pending>, IDLE as SavingState<Pending>);
  // The state now, for a second tap before the next render
  const now = useRef<SavingState<Pending>>(state);
  now.current = state;
  const send = (e: SavingEvent<Pending>) => {
    now.current = savingReducer(now.current, e);
    dispatch(e);
  };

  // What a save, or the tap after it, came to
  const report = (destination: Destination<Blob>, result: SaveResult, photoId: number | undefined) => {
    if (result.pending) {
      send({ type: 'needs-tap', count: result.pending.length, pending: { destination, result } });
      return;
    }
    send({ type: 'done' });
    if (!result.cancelled) status.show(words.saveResult(result.outcome), photoId);
  };

  const save = async (photos: readonly Photo[]) => {
    if (photos.length === 0 || isBusy(now.current)) return;
    // The result goes on the photo that was current when the save began
    const photoId = status.photoId();
    send({ type: 'start' });
    // The zoom's decoded original goes first: a large scan's save needs the memory
    releaseOriginal([]);
    try {
      const destination = destinationFor(photos.length > 1);
      const result = await savePhotos(
        photos, (p) => renderPhoto(p, quality), destination, (n, total) => send({ type: 'progress', n, total }));
      report(destination, result, photoId);
    } catch {
      send({ type: 'done' });
      status.show(words.saveFailed(photos.map((p) => p.name)), photoId);
    }
  };

  const shareNow = async () => {
    const s = now.current;
    if (s.kind !== 'needs-tap') return;
    const { destination, result } = s.pending;
    const photoId = status.photoId();
    send({ type: 'tap-share' });
    try {
      const after = await finishPending(destination, result);
      if (after.cancelled) {
        send({ type: 'done' });
        status.show(null, photoId);
      } else {
        report(destination, after, photoId);
      }
    } catch {
      send({ type: 'done' });
      status.show(words.saveFailed(result.pending ?? []), photoId);
    }
  };

  return { busy: isBusy(state), text: savingText(state), save, canShareNow: showsShare(state), shareNow };
}
