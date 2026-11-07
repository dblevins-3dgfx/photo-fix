import { describe, expect, it } from 'vitest';
import { buildTables } from './correction';
import { defaultSettings } from './settings';
import { sampleBlock, whitePointGains } from './white-point';

const identity = buildTables(defaultSettings(false), { lo: [0, 0, 0], hi: [1, 1, 1] });

function image(width: number, height: number, f: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set([...f(x, y), 255], (y * width + x) * 4);
  return data;
}

describe('Sample', () => {
  it('averages the 5 x 5 block centered on the point', () => {
    const data = image(10, 10, (x, y) => (Math.abs(x - 5) <= 2 && Math.abs(y - 5) <= 2 ? [255, 0, 51] : [0, 0, 0]));
    const s = sampleBlock(data, 10, 10, 5, 5, identity);
    expect(s[0]).toBeCloseTo(1);
    expect(s[2]).toBeCloseTo(0.2);
  });
  it('is clipped at the photo edges', () => {
    // Corner (0, 0): a 3 x 3 block, one pixel of which is white
    const data = image(10, 10, (x, y) => (x === 0 && y === 0 ? [255, 255, 255] : [0, 0, 0]));
    expect(sampleBlock(data, 10, 10, 0, 0, identity)[0]).toBeCloseTo(1 / 9);
  });
  it('is taken after Auto', () => {
    const stats = { lo: [0.2, 0.2, 0.2] as const, hi: [0.6, 0.6, 0.6] as const };
    const auto = buildTables({ ...defaultSettings(true) }, stats, 'auto');
    const data = image(5, 5, () => [102, 102, 102]); // 0.4, halfway between lo and hi
    expect(sampleBlock(data, 5, 5, 2, 2, auto)[0]).toBeCloseTo(0.5);
  });
});

describe('Gains', () => {
  it('make the sample gray at its own brightness', () => {
    const sample = [0.6, 0.5, 0.4] as const;
    const g = whitePointGains(sample);
    if (g === 'too dark') throw new Error('refused');
    const out = sample.map((v, c) => v * g[c]);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(0.5);
    expect(out[2]).toBeCloseTo(0.5);
  });
  it('are clamped to 0.5 to 2', () => {
    const g = whitePointGains([0.9, 0.3, 0.05]);
    expect(g).toEqual([0.5, expect.closeTo(1.3889, 3), 2]);
  });
  it('a sample with any channel below 0.04 is too dark', () => {
    expect(whitePointGains([0.5, 0.5, 0.039])).toBe('too dark');
    expect(whitePointGains([0.04, 0.5, 0.5])).not.toBe('too dark');
  });
});
