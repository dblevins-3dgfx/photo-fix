// The region job (SPEC.md section 5, Zoom and pan, Sharpness): the part of
// the original in view, at the size it covers on the screen, without
// corrections (the screen applies them, as it does to the preview). The
// decoded original of the last photo asked for is kept, so panning and
// zooming don't decode it again each time.

export interface RegionRequest {
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

let kept: { photoId: number; bitmap: ImageBitmap } | null = null;

async function originalOf(photoId: number, file: Blob) {
  if (kept?.photoId === photoId) return kept.bitmap;
  kept?.bitmap.close();
  kept = null;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  kept = { photoId, bitmap };
  return bitmap;
}

export async function regionJob(r: RegionRequest): Promise<{ result: ImageData; transfer: Transferable[] }> {
  const bitmap = await originalOf(r.photoId, r.file);
  const canvas = new OffscreenCanvas(r.outWidth, r.outHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, r.outWidth, r.outHeight);
  const image = ctx.getImageData(0, 0, r.outWidth, r.outHeight);
  return { result: image, transfer: [image.data.buffer] };
}
