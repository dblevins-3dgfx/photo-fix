// The Web Worker that makes a save (SPEC.md section 7, While saving):
// decodes the original, scales it down if the device can't hold it in one
// canvas, turns it, applies the corrections with the same functions as the
// preview, and encodes the JPEG.

import { applyCorrection, buildTables } from './lib/correction';
import type { AutoStats } from './lib/levels';
import { rotatedSize, rotationTransform } from './lib/rotation';
import type { Settings } from './lib/settings';
import { fitUnderLimit } from './lib/sizes';

export interface RenderRequest {
  id: number;
  file: Blob;
  settings: Settings;
  stats: AutoStats;
  quality: number;
  limit: number;
}

export type RenderResult =
  | { id: number; blob: Blob; width: number; height: number; scaled: boolean; origWidth: number; origHeight: number }
  | { id: number; error: string };

self.onmessage = async (event: MessageEvent<RenderRequest>) => {
  const { id, file, settings, stats, quality, limit } = event.data;
  try {
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
    const result: RenderResult = {
      id, blob, width: out.width, height: out.height, scaled: size.scaled, origWidth: orig.width, origHeight: orig.height,
    };
    self.postMessage(result);
  } catch (err) {
    self.postMessage({ id, error: String(err) } satisfies RenderResult);
  }
};
