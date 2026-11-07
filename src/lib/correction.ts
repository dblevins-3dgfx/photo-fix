// The corrections (SPEC.md section 4), in order: Auto, White point, Warmth
// and Tint, Brightness, Contrast, then Saturation. Steps 1 to 5 act on each
// channel alone, so they are built into one 256-entry table per channel;
// Saturation mixes the channels and is applied per pixel after the tables.
// The preview, the full-size save and the white point's sample all use
// these same functions (rule: Same correction everywhere).

import type { AutoStats } from './levels';
import type { Settings } from './settings';

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// A channel whose hi - lo is below this is not stretched
export const FLAT = 0.1;

// Auto for one channel: the stretch, blended in by strength (0 to 1)
export function autoValue(v: number, lo: number, hi: number, strength: number) {
  if (hi - lo < FLAT) return v;
  const stretched = clamp01((v - lo) / (hi - lo));
  return clamp01(v + strength * (stretched - v));
}

export const warmthGains = (w: number) => ({ red: 1 + (0.2 * w) / 100, blue: 1 - (0.2 * w) / 100 });
export const tintGain = (t: number) => 1 - (0.2 * t) / 100;

export const brightnessValue = (v: number, b: number) => clamp01(Math.pow(v, Math.pow(2, -b / 100)));

export function contrastValue(v: number, c: number) {
  const k = c / 100;
  if (k > 0) return clamp01(v + k * (v * v * (3 - 2 * v) - v));
  if (k < 0) return clamp01(v + -k * (0.5 + (v - 0.5) / 2 - v));
  return v;
}

// The per-channel tables (steps 1 to 5), as values 0 to 1 for each input
// 0 to 255. `only` 'auto' builds Auto alone, which is what the White point
// samples through.
export type Tables = readonly [Float64Array, Float64Array, Float64Array];

export function buildTables(s: Settings, stats: AutoStats, only?: 'auto'): Tables {
  const warm = warmthGains(s.warmth);
  const channelGain = [warm.red, tintGain(s.tint), warm.blue];
  const tables = [new Float64Array(256), new Float64Array(256), new Float64Array(256)] as const;
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 256; i++) {
      let v = i / 255;
      if (s.auto) v = autoValue(v, stats.lo[c], stats.hi[c], s.strength / 100);
      if (only !== 'auto') {
        if (s.whitePoint) v = clamp01(v * s.whitePoint[c]);
        if (channelGain[c] !== 1) v = clamp01(v * channelGain[c]);
        if (s.brightness !== 0) v = brightnessValue(v, s.brightness);
        if (s.contrast !== 0) v = contrastValue(v, s.contrast);
      }
      tables[c][i] = v;
    }
  }
  return tables;
}

// Saturation for one pixel (values 0 to 1), with luma L = 0.2126 r +
// 0.7152 g + 0.0722 b
export function saturate(r: number, g: number, b: number, sat: number): [number, number, number] {
  const f = 1 + sat / 100;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [clamp01(l + f * (r - l)), clamp01(l + f * (g - l)), clamp01(l + f * (b - l))];
}

// Applies the tables and the saturation to RGBA pixels, from `src` into
// `dst` (which may be `src`). Alpha is copied. The result is rounded to the
// nearest whole value.
export function applyCorrection(src: Uint8ClampedArray, dst: Uint8ClampedArray, tables: Tables, saturation: number) {
  const [tr, tg, tb] = tables;
  if (saturation === 0) {
    const ir = toBytes(tr), ig = toBytes(tg), ib = toBytes(tb);
    for (let i = 0; i < src.length; i += 4) {
      dst[i] = ir[src[i]];
      dst[i + 1] = ig[src[i + 1]];
      dst[i + 2] = ib[src[i + 2]];
      dst[i + 3] = src[i + 3];
    }
    return;
  }
  const f = 1 + saturation / 100;
  for (let i = 0; i < src.length; i += 4) {
    const r = tr[src[i]], g = tg[src[i + 1]], b = tb[src[i + 2]];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    dst[i] = Math.round(clamp01(l + f * (r - l)) * 255);
    dst[i + 1] = Math.round(clamp01(l + f * (g - l)) * 255);
    dst[i + 2] = Math.round(clamp01(l + f * (b - l)) * 255);
    dst[i + 3] = src[i + 3];
  }
}

function toBytes(table: Float64Array) {
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = Math.round(table[i] * 255);
  return out;
}
