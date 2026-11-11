// The save job (SPEC.md section 7, While saving), in three steps: render
// the original with its corrections, encode it, and add metadata.

import { applyCorrection, buildTables } from '../lib/correction';
import type { AutoStats } from '../lib/levels';
import { rotatedSize, rotationTransform } from '../lib/rotation';
import type { Rendered } from '../lib/save-photos';
import type { Settings } from '../lib/settings';
import { fitUnderLimit } from '../lib/sizes';

export interface SaveRequest {
  file: Blob;
  settings: Settings;
  stats: AutoStats;
  // The JPEG quality, 60 to 100
  quality: number;
  // The most pixels one canvas can hold on this device
  limit: number;
}

type Size = Omit<Rendered<Blob>, 'blob'>;

// Decodes the original, scales it down if the device can't hold it in one
// canvas, turns it, and applies the corrections with the same functions as
// the preview
async function render(r: SaveRequest): Promise<{ canvas: OffscreenCanvas; size: Size }> {
  const { file, settings, stats, limit } = r;
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
  return {
    canvas,
    size: { width: out.width, height: out.height, scaled: size.scaled, origWidth: orig.width, origHeight: orig.height },
  };
}

// A JPEG at the quality
const encode = (canvas: OffscreenCanvas, quality: number) =>
  canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 });

// The saved file has no metadata (section 7, Metadata)
const addMetadata = async (blob: Blob) => blob;

export async function saveJob(r: SaveRequest): Promise<{ result: Rendered<Blob> }> {
  const { canvas, size } = await render(r);
  const jpeg = await encode(canvas, r.quality);
  // Its pixels go now, not when the worker next tidies up, so the next
  // photo of a Save all has the memory
  canvas.width = 0;
  canvas.height = 0;
  const blob = await addMetadata(jpeg);
  return { result: { blob, ...size } };
}
