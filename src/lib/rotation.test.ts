import { describe, expect, it } from 'vitest';
import { pixelAt, rotatedSize, rotationTransform, unrotatePoint } from './rotation';
import type { Rotation } from './settings';

// Where the transform sends (x, y)
function apply(t: { x: number; y: number; angle: number }, x: number, y: number) {
  const c = Math.round(Math.cos(t.angle)), s = Math.round(Math.sin(t.angle));
  return [t.x + c * x - s * y, t.y + s * x + c * y];
}

describe('Rotation', () => {
  it('swaps width and height for a quarter turn', () => {
    expect(rotatedSize(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, 180)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 270)).toEqual({ width: 300, height: 400 });
  });
  it('draws the top-left corner where a clockwise turn puts it', () => {
    const w = 400, h = 300;
    expect(apply(rotationTransform(w, h, 0), 0, 0)).toEqual([0, 0]);
    expect(apply(rotationTransform(w, h, 90), 0, 0)).toEqual([h, 0]); // top right
    expect(apply(rotationTransform(w, h, 180), 0, 0)).toEqual([w, h]); // bottom right
    expect(apply(rotationTransform(w, h, 270), 0, 0)).toEqual([0, w]); // bottom left
  });
  it('maps a tap on the turned photo back to the same spot on the photo as opened', () => {
    const w = 400, h = 300;
    for (const r of [0, 90, 180, 270] as Rotation[]) {
      const size = rotatedSize(w, h, r);
      const t = rotationTransform(w, h, r);
      // The photo's pixel (100, 50) is drawn at `at` on the turned canvas
      const at = apply(t, 100.5, 50.5);
      const [x, y] = unrotatePoint(at[0] / size.width, at[1] / size.height, r);
      expect(pixelAt(x, y, w, h)).toEqual([100, 50]);
    }
  });
  it('keeps a mapped point inside the photo', () => {
    expect(pixelAt(1, 1, 10, 10)).toEqual([9, 9]);
    expect(pixelAt(-0.1, 0, 10, 10)).toEqual([0, 0]);
  });
});
