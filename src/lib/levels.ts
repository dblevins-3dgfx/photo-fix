// Auto's statistics (SPEC.md section 4, Auto): the black and white point of
// each channel, measured once on the analysis image when a photo is opened.

// lo and hi per channel (red, green, blue), each 0 to 1
export interface AutoStats {
  lo: readonly [number, number, number];
  hi: readonly [number, number, number];
}

// The margin left out at each edge: 2% of the width (left and right) and of
// the height (top and bottom), rounded down
export const MARGIN = 0.02;
// The share of measured pixels at or below lo, and at or above hi
export const CLIP = 0.005;

// Histograms of red, green and blue over the photo inside the margin.
// `data` is RGBA, as in ImageData.data. A photo too small to have anything
// inside the margin is measured whole.
export function histograms(data: Uint8ClampedArray, width: number, height: number) {
  let mx = Math.floor(width * MARGIN);
  let my = Math.floor(height * MARGIN);
  if (width - 2 * mx <= 0 || height - 2 * my <= 0) mx = my = 0;
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let y = my; y < height - my; y++) {
    let i = (y * width + mx) * 4;
    for (let x = mx; x < width - mx; x++, i += 4) {
      hist[0][data[i]]++;
      hist[1][data[i + 1]]++;
      hist[2][data[i + 2]]++;
    }
  }
  return { hist, count: (width - 2 * mx) * (height - 2 * my) };
}

// The lowest value with at least CLIP of `count` at or below it, and the
// highest with at least CLIP at or above it, on the 0 to 255 scale
export function clipPoints(hist: Uint32Array, count: number): [number, number] {
  if (count <= 0) return [0, 255];
  const need = CLIP * count;
  let lo = 0;
  for (let sum = 0; lo < 255; lo++) {
    sum += hist[lo];
    if (sum >= need) break;
  }
  let hi = 255;
  for (let sum = 0; hi > 0; hi--) {
    sum += hist[hi];
    if (sum >= need) break;
  }
  return [lo, hi];
}

export function measureAuto(data: Uint8ClampedArray, width: number, height: number): AutoStats {
  const { hist, count } = histograms(data, width, height);
  const points = hist.map((h) => clipPoints(h, count));
  return {
    lo: [points[0][0] / 255, points[1][0] / 255, points[2][0] / 255],
    hi: [points[0][1] / 255, points[1][1] / 255, points[2][1] / 255],
  };
}
