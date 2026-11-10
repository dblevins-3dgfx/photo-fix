import { describe, expect, it } from 'vitest';
import { ADJUSTMENTS, adjustmentsIn } from './adjustments';
import { defaultSettings, sharedSettings } from './settings';

const entry = (key: string) => ADJUSTMENTS.find((a) => a.key === key)!;

describe('The table of adjustments', () => {
  it('covers every setting but the White point and the Rotation', () => {
    const keys = Object.keys(defaultSettings(true)).filter((k) => k !== 'whitePoint' && k !== 'rotation');
    expect(ADJUSTMENTS.map((a) => a.key).sort()).toEqual(keys.sort());
  });
  it('gives the defaults: strength 100%, Midtones off, the five sliders 0', () => {
    const d = defaultSettings(false);
    for (const a of ADJUSTMENTS) if (a.key !== 'auto') expect(d[a.key]).toBe(a.default);
    expect(entry('strength').default).toBe(100);
    expect(entry('midtones').default).toBe(false);
    for (const key of ['warmth', 'tint', 'brightness', 'contrast', 'saturation']) expect(entry(key).default).toBe(0);
  });
  it("Auto's default is the preference's, not the table's", () => {
    expect(defaultSettings(false).auto).toBe(false);
    expect(defaultSettings(true).auto).toBe(true);
  });
  it('the five sliders run from -100 to 100, and Strength from 0% to 100%', () => {
    for (const key of ['warmth', 'tint', 'brightness', 'contrast', 'saturation']) {
      expect(entry(key)).toMatchObject({ kind: 'slider', min: -100, max: 100 });
    }
    expect(entry('strength')).toMatchObject({ kind: 'slider', min: 0, max: 100, unit: '%' });
  });
  it('Strength and Midtones are shown only while Auto is on', () => {
    expect(ADJUSTMENTS.filter((a) => 'onlyWithAuto' in a).map((a) => a.key)).toEqual(['strength', 'midtones']);
  });
  it('Auto, Strength and Midtones sit together; the five sliders follow in order', () => {
    expect(adjustmentsIn('auto').map((a) => a.label)).toEqual(['Auto', 'Strength', 'Midtones']);
    expect(adjustmentsIn('tone').map((a) => a.label)).toEqual(['Warmth', 'Tint', 'Brightness', 'Contrast', 'Saturation']);
  });
  it('Apply to all copies exactly the adjustments marked shared', () => {
    const s = { ...defaultSettings(true), whitePoint: [1, 1, 1] as const, rotation: 90 as const, warmth: 7, midtones: true };
    const shared = sharedSettings(s);
    expect(Object.keys(shared).sort()).toEqual(ADJUSTMENTS.filter((a) => a.shared).map((a) => a.key).sort());
    expect(shared).toMatchObject({ warmth: 7, midtones: true, auto: true });
  });
});
