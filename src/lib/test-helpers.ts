// For the unit tests: whole settings and statistics from the few fields a
// test cares about, so a new field changes only this file

import type { AutoStats } from './levels';
import { defaultSettings, type Settings } from './settings';

// The defaults with Auto off, and `over` on top
export const settings = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings(false), ...over });

// Statistics that change nothing (the full range, medians in the middle),
// and `over` on top
export const stats = (over: Partial<AutoStats> = {}): AutoStats => ({
  lo: [0, 0, 0],
  hi: [1, 1, 1],
  median: [0.5, 0.5, 0.5],
  ...over,
});
