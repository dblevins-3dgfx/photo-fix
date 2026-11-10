// Asks the Web Worker for the part of the original in view (SPEC.md
// section 5, Zoom and pan, Sharpness). A worker of its own, so a save
// under way doesn't hold up the screen, and the other way round.

import { workerClient } from './worker-client';

const run = workerClient();

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const regionOf = (photoId: number, file: Blob, region: Region, outWidth: number, outHeight: number) =>
  run('region', { photoId, file, ...region, outWidth, outHeight });
