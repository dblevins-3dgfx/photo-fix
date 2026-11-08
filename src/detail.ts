// Asks the Web Worker for the part of the original in view (SPEC.md
// section 5, Zoom and pan, Sharpness). A worker of its own, so a save
// under way doesn't hold up the screen, and the other way round.

import type { RegionRequest, RenderResult } from './render-worker';

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (r: RenderResult) => void>();

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function regionOf(photoId: number, file: Blob, region: Region, outWidth: number, outHeight: number) {
  if (!worker) {
    worker = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<RenderResult>) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
  }
  const id = nextId++;
  const request: RegionRequest = { kind: 'region', id, photoId, file, ...region, outWidth, outHeight };
  return new Promise<ImageData>((resolve, reject) => {
    waiting.set(id, (r) => ('image' in r ? resolve(r.image) : reject(new Error('error' in r ? r.error : 'no image'))));
    worker!.postMessage(request);
  });
}
