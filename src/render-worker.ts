// The Web Worker for work on the original at full size:
// - a save (SPEC.md section 7, While saving): decode the original, scale it
//   down if the device can't hold it in one canvas, turn it, apply the
//   corrections with the same functions as the preview, encode the JPEG;
// - a region (section 5, Zoom and pan, Sharpness): the part of the original
//   in view, at the size it covers on the screen, without corrections (the
//   screen applies them, as it does to the preview). The decoded original
//   of the last photo asked for is kept, so panning and zooming don't decode
//   it again each time.

import { applyCorrection, buildTables } from './lib/correction';
import type { AutoStats } from './lib/levels';
import { rotatedSize, rotationTransform } from './lib/rotation';
import type { Settings } from './lib/settings';
import { fitUnderLimit } from './lib/sizes';

export interface SaveRequest {
  kind: 'save';
  id: number;
  file: Blob;
  settings: Settings;
  stats: AutoStats;
  quality: number;
  limit: number;
}

export interface RegionRequest {
  kind: 'region';
  id: number;
  photoId: number;
  file: Blob;
  // In pixels of the original as opened
  x: number;
  y: number;
  width: number;
  height: number;
  // The size to draw it at
  outWidth: number;
  outHeight: number;
}

export type RenderRequest = SaveRequest | RegionRequest;

export type RenderResult =
  | { id: number; blob: Blob; width: number; height: number; scaled: boolean; origWidth: number; origHeight: number }
  | { id: number; image: ImageData }
  | { id: number; error: string };

let kept: { photoId: number; bitmap: ImageBitmap } | null = null;

async function originalOf(photoId: number, file: Blob) {
  if (kept?.photoId === photoId) return kept.bitmap;
  kept?.bitmap.close();
  kept = null;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  kept = { photoId, bitmap };
  return bitmap;
}

async function region(r: RegionRequest): Promise<RenderResult> {
  const bitmap = await originalOf(r.photoId, r.file);
  const canvas = new OffscreenCanvas(r.outWidth, r.outHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, r.outWidth, r.outHeight);
  return { id: r.id, image: ctx.getImageData(0, 0, r.outWidth, r.outHeight) };
}

async function save(r: SaveRequest): Promise<RenderResult> {
  const { id, file, settings, stats, quality, limit } = r;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = fitUnderLimit(bitmap.width, bitmap.height, limit);
  const out = rotatedSize(size.width, size.height, settings.rotation);
  const orig = rotatedSize(bitmap.width, bitmap.height, settings.rotation);
  const canvas = new OffscreenCanvas(out.width, out.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const t = rotationTransform(size.width, size.height, settings.rotation);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const image = ctx.getImageData(0, 0, out.width, out.height);
  applyCorrection(image.data, image.data, buildTables(settings, stats), settings.saturation);
  ctx.putImageData(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 });
  return { id, blob, width: out.width, height: out.height, scaled: size.scaled, origWidth: orig.width, origHeight: orig.height };
}

self.onmessage = async (event: MessageEvent<RenderRequest>) => {
  const r = event.data;
  try {
    const result = r.kind === 'save' ? await save(r) : await region(r);
    if ('image' in result) self.postMessage(result, { transfer: [result.image.data.buffer] });
    else self.postMessage(result);
  } catch (err) {
    self.postMessage({ id: r.id, error: String(err) } satisfies RenderResult);
  }
};
