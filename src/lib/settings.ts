// A photo's settings (SPEC.md section 4, Settings): what the user chose for
// one open photo. Kept in memory only, never stored.

export type Rotation = 0 | 90 | 180 | 270;

// Per-channel gains from the White point eyedropper: red, green, blue
export type Gains = readonly [number, number, number];

export interface Settings {
  auto: boolean;
  // Auto's strength, 0 to 100 (percent)
  strength: number;
  whitePoint: Gains | null;
  // The five sliders, each -100 to 100
  warmth: number;
  tint: number;
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: Rotation;
}

export const SLIDERS = ['warmth', 'tint', 'brightness', 'contrast', 'saturation'] as const;
export type Slider = (typeof SLIDERS)[number];

export const defaultSettings = (autoOn: boolean): Settings => ({
  auto: autoOn,
  strength: 100,
  whitePoint: null,
  warmth: 0,
  tint: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  rotation: 0,
});

// What Apply to all copies: everything but the White point and the Rotation,
// which belong to one photo
export const sharedSettings = (s: Settings) => ({
  auto: s.auto,
  strength: s.strength,
  warmth: s.warmth,
  tint: s.tint,
  brightness: s.brightness,
  contrast: s.contrast,
  saturation: s.saturation,
});

// Rotate left (-1) or right (+1) by 90 degrees; four turns come back round
export const rotate = (r: Rotation, dir: 1 | -1): Rotation => (((r + dir * 90) % 360) + 360) % 360 as Rotation;
