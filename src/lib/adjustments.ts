// The adjustments (SPEC.md section 4): one entry for each switch and
// slider a photo has. The defaults, what Apply to all copies and the
// controls on the screen are built from this table, so a new adjustment is
// an entry here and its math in correction.ts. The White point and the
// Rotation are not here: they are set by a tap and by buttons.

import type { Field } from './fields';
import type { Settings } from './settings';

export type Adjustment = Field<keyof Settings> & {
  // Where its control goes: with Auto, or with the sliders below the White point
  group: 'auto' | 'tone';
  // Shown only while Auto is on
  onlyWithAuto?: true;
  // Apply to all copies it to every open photo
  shared: boolean;
  // Explains it, on hover
  hint?: string;
};

export const ADJUSTMENTS = [
  // Auto's default comes from the Auto on for new photos preference
  // (defaultSettings in settings.ts); this is that preference's own default
  { key: 'auto', label: 'Auto', kind: 'switch', default: true, group: 'auto', shared: true },
  { key: 'strength', label: 'Strength', kind: 'slider', min: 0, max: 100, default: 100, unit: '%', group: 'auto', onlyWithAuto: true, shared: true },
  { key: 'midtones', label: 'Midtones', kind: 'switch', default: false, group: 'auto', onlyWithAuto: true, shared: true, hint: 'Also even out a color cast in the midtones' },
  { key: 'warmth', label: 'Warmth', kind: 'slider', min: -100, max: 100, default: 0, group: 'tone', shared: true },
  { key: 'tint', label: 'Tint', kind: 'slider', min: -100, max: 100, default: 0, group: 'tone', shared: true },
  { key: 'brightness', label: 'Brightness', kind: 'slider', min: -100, max: 100, default: 0, group: 'tone', shared: true },
  { key: 'contrast', label: 'Contrast', kind: 'slider', min: -100, max: 100, default: 0, group: 'tone', shared: true },
  { key: 'saturation', label: 'Saturation', kind: 'slider', min: -100, max: 100, default: 0, group: 'tone', shared: true },
] as const satisfies readonly Adjustment[];

// The settings the table covers: all but the White point and the Rotation
export type AdjustmentKey = (typeof ADJUSTMENTS)[number]['key'];
export type Adjustments = Pick<Settings, AdjustmentKey>;

// A setting left out of the table (or one in it that shouldn't be) fails
// the typecheck here
type Missing = Exclude<keyof Settings, AdjustmentKey | 'whitePoint' | 'rotation'>;
const covered: [Missing] extends [never] ? true : never = true;
void covered;

// The adjustments of one group, for the controls
export const adjustmentsIn = (group: Adjustment['group']): readonly Adjustment[] =>
  ADJUSTMENTS.filter((a) => a.group === group);
