// A photo's settings (SPEC.md section 4, Settings): what the user chose for
// one open photo. Kept in memory only, never stored. The switches and
// sliders among them are listed in adjustments.ts.

import { ADJUSTMENTS, type Adjustments } from './adjustments';
import { fieldDefaults } from './fields';

export type Rotation = 0 | 90 | 180 | 270;

// Per-channel gains from the White point eyedropper: red, green, blue
export type Gains = readonly [number, number, number];

export interface Settings {
  auto: boolean;
  // Auto's strength, 0 to 100 (percent)
  strength: number;
  // Auto also evens out the midtones (Q1, resolved)
  midtones: boolean;
  whitePoint: Gains | null;
  // The five sliders, each -100 to 100
  warmth: number;
  tint: number;
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: Rotation;
}

// The defaults: each adjustment's from the table, with Auto on or off by
// the Auto on for new photos preference, no White point and no Rotation
export const defaultSettings = (autoOn: boolean): Settings => ({
  ...(fieldDefaults(ADJUSTMENTS) as unknown as Adjustments),
  auto: autoOn,
  whitePoint: null,
  rotation: 0,
});

// What Apply to all copies: the adjustments the table marks as shared.
// The White point and the Rotation belong to one photo.
export const sharedSettings = (s: Settings): Partial<Adjustments> =>
  Object.fromEntries(ADJUSTMENTS.filter((a) => a.shared).map((a) => [a.key, s[a.key]]));

// Rotate left (-1) or right (+1) by 90 degrees; four turns come back round
export const rotate = (r: Rotation, dir: 1 | -1): Rotation => (((r + dir * 90) % 360) + 360) % 360 as Rotation;
