// Asks the Web Worker for the part of the original in view (SPEC.md
// section 5, Zoom and pan, Sharpness). A worker of its own, so a save
// under way doesn't hold up the screen, and the other way round.

import { workerClient } from './worker-client';

const run = workerClient();
// Whether a region was ever asked for: until then the worker holds nothing
let asked = false;

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const regionOf = (photoId: number, file: Blob, region: Region, outWidth: number, outHeight: number) => {
  asked = true;
  return run('region', { photoId, file, ...region, outWidth, outHeight });
};

// Lets the worker go of the original it keeps for zooming, unless its photo
// is among `open` (none, before a save). Nothing to wait for: a failure
// leaves it kept, as before.
export const releaseOriginal = (open: readonly number[]) => {
  if (!asked) return;
  run('release', { open: [...open] }).catch(() => {});
};
