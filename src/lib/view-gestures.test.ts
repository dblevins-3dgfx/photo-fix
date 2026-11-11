import { describe, expect, it } from 'vitest';
import { FIT, MARGIN, scaleOf, toPhoto, type View } from './view';
import { tapOnPhoto, viewAfter, type ViewContext } from './view-gestures';

// A 400 x 300 photo area (inside the margin) for a 4000 x 3000 photo: Fit is
// 0.1 CSS px per photo pixel
const c: ViewContext = { area: { width: 400 + 2 * MARGIN, height: 300 + 2 * MARGIN }, photo: { width: 4000, height: 3000 }, pixelRatio: 1 };
const zoomed: View = { zoom: 4, cx: 0.5, cy: 0.5 };

describe('A drag', () => {
  it('pans by exactly its distance', () => {
    const v = viewAfter({ type: 'drag', dx: 40, dy: -20 }, zoomed, FIT, c);
    // 0.4 CSS px per photo pixel: 40 px is 100 photo pixels, 20 px is 50
    expect(v.cx).toBeCloseTo(0.5 - 100 / 4000);
    expect(v.cy).toBeCloseTo(0.5 + 50 / 3000);
    expect(v.zoom).toBe(4);
  });
  it('the point under the finger stays under it', () => {
    const before = toPhoto(zoomed, 200, 150, c.area, c.photo);
    const v = viewAfter({ type: 'drag', dx: 30, dy: 10 }, zoomed, FIT, c);
    const after = toPhoto(v, 230, 160, c.area, c.photo);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });
  it('does nothing at Fit', () => {
    expect(viewAfter({ type: 'drag', dx: 50, dy: 50 }, FIT, FIT, c)).toEqual(FIT);
  });
});

describe('A pinch', () => {
  it('zooms by how far apart the fingers are, around the point between them', () => {
    const v = viewAfter({ type: 'pinch', scale: 2, x: 100, y: 80, dx: 0, dy: 0 }, FIT, FIT, c);
    expect(v.zoom).toBe(2);
    const under = toPhoto(v, 100, 80, c.area, c.photo);
    const before = toPhoto(FIT, 100, 80, c.area, c.photo);
    expect(under[0]).toBeCloseTo(before[0]);
    expect(under[1]).toBeCloseTo(before[1]);
  });
  it('is measured from where it began, not compounded step by step', () => {
    const start: View = { zoom: 2, cx: 0.5, cy: 0.5 };
    const step1 = viewAfter({ type: 'pinch', scale: 1.5, x: 208, y: 158, dx: 0, dy: 0 }, start, start, c);
    // The second step reports the scale from the start again, whatever the view is now
    const step2 = viewAfter({ type: 'pinch', scale: 1.5, x: 208, y: 158, dx: 0, dy: 0 }, step1, start, c);
    expect(step2).toEqual(step1);
    expect(step2.zoom).toBeCloseTo(3);
  });
  it('pans by how far the point between the fingers moved', () => {
    const start: View = { zoom: 2, cx: 0.5, cy: 0.5 };
    const still = viewAfter({ type: 'pinch', scale: 2, x: 208, y: 158, dx: 0, dy: 0 }, start, start, c);
    const moved = viewAfter({ type: 'pinch', scale: 2, x: 208, y: 158, dx: 40, dy: 0 }, start, start, c);
    const s = scaleOf(moved, c.area, c.photo);
    expect(moved.cx).toBeCloseTo(still.cx - 40 / (s * 4000));
  });
});

describe('A double-tap', () => {
  it('at Fit zooms to 2x, keeping the tapped point where it is', () => {
    const v = viewAfter({ type: 'double-tap', x: 120, y: 90 }, FIT, FIT, c);
    expect(v.zoom).toBe(2);
    const under = toPhoto(v, 120, 90, c.area, c.photo);
    const before = toPhoto(FIT, 120, 90, c.area, c.photo);
    expect(under[0]).toBeCloseTo(before[0]);
    expect(under[1]).toBeCloseTo(before[1]);
  });
  it('zoomed in goes back to Fit', () => {
    expect(viewAfter({ type: 'double-tap', x: 120, y: 90 }, zoomed, FIT, c)).toEqual(FIT);
  });
});

describe('Other gesture actions', () => {
  it('leave the view as it is', () => {
    for (const type of ['start-hold-timer', 'cancel-hold-timer', 'hold-start', 'hold-end', 'pinch-start'] as const) {
      expect(viewAfter({ type }, zoomed, FIT, c)).toBe(zoomed);
    }
    expect(viewAfter({ type: 'tap', x: 10, y: 10 }, zoomed, FIT, c)).toBe(zoomed);
  });
});

describe('A tap', () => {
  it('lands on the photo, as fractions of the turned photo', () => {
    expect(tapOnPhoto(c.area.width / 2, c.area.height / 2, FIT, c)).toEqual([0.5, 0.5]);
    const [u, v] = tapOnPhoto(MARGIN + 100, MARGIN + 30, FIT, c)!;
    expect(u).toBeCloseTo(0.25);
    expect(v).toBeCloseTo(0.1);
  });
  it('in the margin samples nothing', () => {
    expect(tapOnPhoto(MARGIN / 2, c.area.height / 2, FIT, c)).toBeNull();
    expect(tapOnPhoto(c.area.width / 2, c.area.height - 1, FIT, c)).toBeNull();
  });
  it('follows the zoom and pan', () => {
    const v: View = { zoom: 2, cx: 0.25, cy: 0.5 };
    const [u] = tapOnPhoto(c.area.width / 2, c.area.height / 2, v, c)!;
    expect(u).toBeCloseTo(0.25);
  });
});
