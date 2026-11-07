// The White point eyedropper (SPEC.md section 4, White point): sample a
// 5 x 5 block of the analysis image, after Auto, and work out the gains that
// make it gray without changing its brightness.

import type { Tables } from './correction';
import type { Gains } from './settings';

// A sample with any channel below this is too dark to judge
export const TOO_DARK = 0.04;
export const MIN_GAIN = 0.5;
export const MAX_GAIN = 2;

// The average of each channel over the 5 x 5 block centered on (x, y),
// clipped at the photo's edges, through the Auto-only tables
export function sampleBlock(
  data: Uint8ClampedArray, width: number, height: number, x: number, y: number, autoTables: Tables,
): [number, number, number] {
  const sum = [0, 0, 0];
  let n = 0;
  for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy++) {
    for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++) {
      const i = (yy * width + xx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += autoTables[c][data[i + c]];
      n++;
    }
  }
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

const clampGain = (g: number) => Math.min(MAX_GAIN, Math.max(MIN_GAIN, g));

// The gains for a sample, or 'too dark' when a channel is below TOO_DARK
export function whitePointGains(sample: readonly [number, number, number]): Gains | 'too dark' {
  if (sample.some((v) => v < TOO_DARK)) return 'too dark';
  const m = (sample[0] + sample[1] + sample[2]) / 3;
  return [clampGain(m / sample[0]), clampGain(m / sample[1]), clampGain(m / sample[2])];
}
