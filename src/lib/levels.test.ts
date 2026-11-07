import { describe, expect, it } from 'vitest';
import { clipPoints, histograms, measureAuto } from './levels';

// A width x height RGBA image filled by f(x, y) -> [r, g, b]
function image(width: number, height: number, f: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set([...f(x, y), 255], (y * width + x) * 4);
  return data;
}

describe('Where Auto measures', () => {
  it('leaves out 2% of the width and height at each edge, rounded down', () => {
    // 100 x 50: margin 2 px left and right, 1 px top and bottom
    const data = image(100, 50, (x, y) => (x < 2 || x >= 98 || y < 1 || y >= 49 ? [0, 0, 0] : [128, 128, 128]));
    const { hist, count } = histograms(data, 100, 50);
    expect(count).toBe(96 * 48);
    expect(hist[0][0]).toBe(0);
    expect(hist[0][128]).toBe(96 * 48);
  });
  it('ignores a black scanner lid around the print', () => {
    const data = image(200, 200, (x, y) =>
      x < 3 || x > 196 || y < 3 || y > 196 ? [0, 0, 0] : [50 + (x % 100), 60 + (y % 100), 70]);
    const s = measureAuto(data, 200, 200);
    expect(s.lo[0]).toBeGreaterThan(0.15);
  });
  it('measures a photo too small for the margin whole', () => {
    const { count } = histograms(image(1, 1, () => [9, 9, 9]), 1, 1);
    expect(count).toBe(1);
  });
});

describe('Black and white points', () => {
  it('lo has at least 0.5% of the pixels at or below it, hi at least 0.5% at or above it', () => {
    const hist = new Uint32Array(256);
    hist[10] = 4; // 0.4%: not enough
    hist[11] = 2; // 0.6% at or below 11
    hist[100] = 988;
    hist[240] = 2;
    hist[250] = 4;
    expect(clipPoints(hist, 1000)).toEqual([11, 240]);
  });
  it('a value holding the share alone is the point', () => {
    const hist = new Uint32Array(256);
    hist[30] = 500;
    hist[200] = 500;
    expect(clipPoints(hist, 1000)).toEqual([30, 200]);
  });
  it('are measured per channel and divided by 255', () => {
    const data = image(100, 100, (x) => [x * 2, 51 + x, 102]);
    const s = measureAuto(data, 100, 100);
    expect(s.lo[0]).toBeCloseTo(4 / 255);
    expect(s.hi[0]).toBeCloseTo(194 / 255);
    expect(s.lo[1]).toBeCloseTo(53 / 255);
    expect(s.lo[2]).toBeCloseTo(102 / 255);
    expect(s.hi[2]).toBeCloseTo(102 / 255);
  });
  it('an empty histogram gives the full range', () => {
    expect(clipPoints(new Uint32Array(256), 0)).toEqual([0, 255]);
  });
});
