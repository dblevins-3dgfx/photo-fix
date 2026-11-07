import { describe, expect, it } from 'vitest';
import {
  applyCorrection, autoValue, brightnessValue, buildTables, contrastValue, saturate, tintGain, warmthGains,
} from './correction';
import type { AutoStats } from './levels';
import { defaultSettings, type Settings } from './settings';

const stats: AutoStats = { lo: [0.2, 0.1, 0.3], hi: [0.8, 0.9, 0.7] };
const flat: AutoStats = { lo: [0, 0, 0], hi: [1, 1, 1] };
const settings = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings(false), ...over });

// Every RGBA value 0 to 255 in each channel, alpha varying too
function allValues() {
  const px = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) px.set([i, 255 - i, (i * 7) % 256, i], i * 4);
  return px;
}

const correct = (px: Uint8ClampedArray, s: Settings, st: AutoStats = stats) => {
  const out = new Uint8ClampedArray(px.length);
  applyCorrection(px, out, buildTables(s, st), s.saturation);
  return out;
};

describe('Identity', () => {
  it('with Auto off and every setting at its default, the output is the input exactly', () => {
    const px = allValues();
    expect(correct(px, settings())).toEqual(px);
  });
  it('holds through the saturation path too (saturation 0 is no change)', () => {
    const px = allValues();
    const out = new Uint8ClampedArray(px.length);
    applyCorrection(px, out, buildTables(settings(), stats), 1e-12);
    expect(out).toEqual(px);
  });
  it('Auto at strength 0 changes nothing', () => {
    const px = allValues();
    expect(correct(px, settings({ auto: true, strength: 0 }))).toEqual(px);
  });
  it('copies alpha unchanged', () => {
    const px = allValues();
    const out = correct(px, settings({ auto: true, saturation: 50, contrast: 40 }));
    for (let i = 3; i < px.length; i += 4) expect(out[i]).toBe(px[i]);
  });
});

describe('Auto', () => {
  it('stretches lo to black and hi to white', () => {
    expect(autoValue(0.2, 0.2, 0.8, 1)).toBe(0);
    expect(autoValue(0.8, 0.2, 0.8, 1)).toBe(1);
    expect(autoValue(0.5, 0.2, 0.8, 1)).toBeCloseTo(0.5);
    expect(autoValue(0.35, 0.2, 0.8, 1)).toBeCloseTo(0.25);
  });
  it('clamps values beyond lo and hi', () => {
    expect(autoValue(0.1, 0.2, 0.8, 1)).toBe(0);
    expect(autoValue(0.95, 0.2, 0.8, 1)).toBe(1);
  });
  it('blends by strength', () => {
    expect(autoValue(0.35, 0.2, 0.8, 0.5)).toBeCloseTo(0.3);
  });
  it('leaves a flat channel (hi - lo below 0.1) alone', () => {
    expect(autoValue(0.5, 0.45, 0.54, 1)).toBe(0.5);
    expect(autoValue(0.5, 0.45, 0.55, 1)).not.toBe(0.5);
  });
  it('stretches each channel by its own points', () => {
    const t = buildTables(settings({ auto: true }), stats);
    expect(t[0][51]).toBeCloseTo(0); // 0.2 = red's lo
    expect(t[1][51]).toBeCloseTo((0.2 - 0.1) / 0.8);
    expect(t[2][Math.round(0.7 * 255)]).toBeCloseTo(1, 1);
  });
  it('is off when the switch is off, whatever the strength', () => {
    const t = buildTables(settings({ auto: false, strength: 100 }), stats);
    expect(t[0][51]).toBeCloseTo(0.2);
  });
});

describe('White point', () => {
  it('multiplies each channel by its gain, after Auto', () => {
    const t = buildTables(settings({ whitePoint: [2, 1, 0.5] }), flat);
    expect(t[0][100]).toBeCloseTo(200 / 255);
    expect(t[1][100]).toBeCloseTo(100 / 255);
    expect(t[2][100]).toBeCloseTo(50 / 255);
    expect(t[0][200]).toBe(1); // clamped
  });
  it('is left out of the Auto-only tables the eyedropper samples through', () => {
    const t = buildTables(settings({ auto: true, whitePoint: [2, 2, 2], warmth: 100 }), stats, 'auto');
    expect(t[0][51]).toBeCloseTo(0);
    expect(t[0][Math.round(0.5 * 255)]).toBeCloseTo((128 / 255 - 0.2) / 0.6, 5);
  });
});

describe('Warmth and Tint', () => {
  it('Warmth raises red and lowers blue by up to 20%', () => {
    expect(warmthGains(100)).toEqual({ red: 1.2, blue: 0.8 });
    expect(warmthGains(-100)).toEqual({ red: 0.8, blue: 1.2 });
    const t = buildTables(settings({ warmth: 50 }), flat);
    expect(t[0][100]).toBeCloseTo((100 / 255) * 1.1);
    expect(t[1][100]).toBeCloseTo(100 / 255);
    expect(t[2][100]).toBeCloseTo((100 / 255) * 0.9);
  });
  it('Tint lowers green for magenta, raises it for green', () => {
    expect(tintGain(100)).toBeCloseTo(0.8);
    expect(tintGain(-100)).toBeCloseTo(1.2);
    const t = buildTables(settings({ tint: -50 }), flat);
    expect(t[1][100]).toBeCloseTo((100 / 255) * 1.1);
    expect(t[0][100]).toBeCloseTo(100 / 255);
  });
});

describe('Brightness', () => {
  it('is v ^ (2 ^ (-b / 100))', () => {
    expect(brightnessValue(0.25, 100)).toBeCloseTo(0.5);
    expect(brightnessValue(0.5, -100)).toBeCloseTo(0.25);
    expect(brightnessValue(0.5, 0)).toBe(0.5);
  });
  it('keeps black black and white white', () => {
    for (const b of [-100, -30, 30, 100]) {
      expect(brightnessValue(0, b)).toBe(0);
      expect(brightnessValue(1, b)).toBe(1);
    }
  });
});

describe('Contrast', () => {
  it('keeps 0.5 where it is', () => {
    for (const c of [-100, -50, 50, 100]) expect(contrastValue(0.5, c)).toBeCloseTo(0.5);
  });
  it('positive is the S-curve: shadows deeper, highlights lifted', () => {
    expect(contrastValue(0.25, 100)).toBeCloseTo(0.25 * 0.25 * 2.5);
    expect(contrastValue(0.25, 100)).toBeLessThan(0.25);
    expect(contrastValue(0.75, 100)).toBeGreaterThan(0.75);
  });
  it('at -100 halves the contrast', () => {
    expect(contrastValue(0, -100)).toBeCloseTo(0.25);
    expect(contrastValue(1, -100)).toBeCloseTo(0.75);
  });
  it('never reverses the order of two values', () => {
    for (const c of [-100, -40, 40, 100]) {
      let last = -1;
      for (let i = 0; i <= 255; i++) {
        const v = contrastValue(i / 255, c);
        expect(v).toBeGreaterThanOrEqual(last);
        last = v;
      }
    }
  });
});

describe('Saturation', () => {
  it('at -100 makes the pixel gray (its luma)', () => {
    const [r, g, b] = saturate(0.8, 0.4, 0.2, -100);
    const l = 0.2126 * 0.8 + 0.7152 * 0.4 + 0.0722 * 0.2;
    expect(r).toBeCloseTo(l);
    expect(g).toBeCloseTo(l);
    expect(b).toBeCloseTo(l);
  });
  it('at 100 doubles the distance from gray (clamped)', () => {
    const l = 0.2126 * 0.6 + 0.7152 * 0.5 + 0.0722 * 0.4;
    const [r, , b] = saturate(0.6, 0.5, 0.4, 100);
    expect(r).toBeCloseTo(l + 2 * (0.6 - l));
    expect(b).toBeCloseTo(l + 2 * (0.4 - l));
    expect(saturate(1, 0, 0, 100)[0]).toBe(1);
  });
  it('leaves a gray pixel gray', () => {
    const out = correct(new Uint8ClampedArray([90, 90, 90, 255]), settings({ saturation: 80 }));
    expect([...out]).toEqual([90, 90, 90, 255]);
  });
  it('applies after the tables (to the corrected values)', () => {
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    const s = settings({ warmth: 40, saturation: -100 });
    const t = buildTables(s, flat);
    const [r] = saturate(t[0][200], t[1][100], t[2][50], -100);
    expect(correct(px, s, flat)[0]).toBe(Math.round(r * 255));
  });
});

describe('Order', () => {
  it('applies Auto, White point, Warmth and Tint, Brightness, then Contrast', () => {
    const s = settings({ auto: true, whitePoint: [1.1, 1, 0.9], warmth: 20, tint: 10, brightness: 30, contrast: 40 });
    const t = buildTables(s, stats);
    for (const [c, i] of [[0, 120], [1, 60], [2, 200]] as const) {
      let v = autoValue(i / 255, stats.lo[c], stats.hi[c], 1);
      v = Math.min(1, v * s.whitePoint![c]);
      v = Math.min(1, v * [warmthGains(20).red, tintGain(10), warmthGains(20).blue][c]);
      v = brightnessValue(v, 30);
      v = contrastValue(v, 40);
      expect(t[c][i]).toBeCloseTo(v, 12);
    }
  });
  it('rounds the final value to the nearest whole number', () => {
    const s = settings({ brightness: 37 });
    const t = buildTables(s, flat);
    const out = correct(new Uint8ClampedArray([77, 77, 77, 255]), s, flat);
    expect(out[0]).toBe(Math.round(t[0][77] * 255));
  });
});
