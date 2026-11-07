// The sizes a photo is kept at (SPEC.md section 3, Sizes) and the most a
// device can save (section 7, Too large for the device).

// The analysis image's longer side, at most
export const ANALYSIS_MAX = 1024;
// The preview's longer side, at most
export const PREVIEW_MAX = 2048;

// width x height scaled so its longer side is at most `max`, never scaled up
export function fitLongSide(width: number, height: number, max: number) {
  const s = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}

// The preview's longer side: the screen's longer side at its pixel density,
// at most PREVIEW_MAX
export const previewLongSide = (screenWidth: number, screenHeight: number, pixelRatio: number) =>
  Math.min(PREVIEW_MAX, Math.ceil(Math.max(screenWidth, screenHeight) * pixelRatio));

// The most pixels one canvas can hold: 16,777,216 (4096 x 4096) in Safari
// and every browser on an iPhone or iPad, 268,435,456 in Chrome
export const SAFARI_LIMIT = 16_777_216;
export const CHROME_LIMIT = 268_435_456;

export function canvasPixelLimit(userAgent: string, maxTouchPoints = 0) {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const safari = /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(userAgent);
  return ios || safari ? SAFARI_LIMIT : CHROME_LIMIT;
}

// width x height, or the largest whole size under `limit` pixels with the
// same proportions
export function fitUnderLimit(width: number, height: number, limit: number) {
  if (width * height <= limit) return { width, height, scaled: false };
  const s = Math.sqrt(limit / (width * height));
  let w = Math.floor(width * s);
  let h = Math.floor(height * s);
  while (w * h > limit) {
    if (w / width > h / height) w--;
    else h--;
  }
  return { width: Math.max(1, w), height: Math.max(1, h), scaled: true };
}
