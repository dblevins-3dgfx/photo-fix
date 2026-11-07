import { describe, expect, it } from 'vitest';
import { defaultSettings, rotate, sharedSettings } from './settings';

describe('Settings', () => {
  it('defaults: Auto from the preference, strength 100%, no white point, sliders 0, rotation 0', () => {
    expect(defaultSettings(true)).toEqual({
      auto: true, strength: 100, whitePoint: null, warmth: 0, tint: 0, brightness: 0, contrast: 0, saturation: 0, rotation: 0,
    });
    expect(defaultSettings(false).auto).toBe(false);
  });
  it('Apply to all shares everything but the White point and the Rotation', () => {
    const s = { ...defaultSettings(true), whitePoint: [1, 1, 1] as const, rotation: 90 as const, warmth: 5 };
    const shared = sharedSettings(s);
    expect(shared).not.toHaveProperty('whitePoint');
    expect(shared).not.toHaveProperty('rotation');
    expect(shared.warmth).toBe(5);
  });
});

describe('Rotation', () => {
  it('turns 90 degrees each way, and four turns come back', () => {
    expect(rotate(0, 1)).toBe(90);
    expect(rotate(0, -1)).toBe(270);
    expect(rotate(270, 1)).toBe(0);
    let r = rotate(0, 1);
    for (let i = 0; i < 3; i++) r = rotate(r, 1);
    expect(r).toBe(0);
  });
});
