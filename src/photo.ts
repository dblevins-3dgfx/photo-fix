// An open photo as the screen holds it, and opening one (SPEC.md section 3):
// the file is kept as it is and decoded again when saving; the analysis
// image and the preview are decoded once, here.

import { measureAuto, type AutoStats } from './lib/levels';
import type { OpenPhoto } from './lib/photos';
import { defaultSettings } from './lib/settings';
import { ANALYSIS_MAX, fitLongSide } from './lib/sizes';

export interface Photo extends OpenPhoto {
  file: Blob;
  // The size as opened (EXIF orientation applied)
  width: number;
  height: number;
  analysis: ImageData;
  preview: ImageData;
  thumbUrl: string;
  stats: AutoStats;
}

const THUMB_MAX = 160;

function draw(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, data: ctx.getImageData(0, 0, width, height) };
}

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no thumbnail'))), 'image/jpeg', 0.8));

// Decodes `file`, or throws if the browser can't
export async function openPhoto(file: File, id: number, autoOn: boolean, previewMax: number): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = bitmap;
    const a = fitLongSide(width, height, ANALYSIS_MAX);
    const p = fitLongSide(width, height, previewMax);
    const t = fitLongSide(width, height, THUMB_MAX);
    const analysis = draw(bitmap, a.width, a.height).data;
    const preview = draw(bitmap, p.width, p.height).data;
    const thumbUrl = URL.createObjectURL(await toBlob(draw(bitmap, t.width, t.height).canvas));
    return {
      id, name: file.name || 'Pasted photo.png', file, width, height, analysis, preview, thumbUrl,
      stats: measureAuto(analysis.data, a.width, a.height),
      settings: defaultSettings(autoOn),
    };
  } finally {
    bitmap.close();
  }
}
