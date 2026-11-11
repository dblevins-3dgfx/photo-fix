import { describe, expect, it } from 'vitest';
import {
  FIT, MARGIN, clampView, detailSize, detailToKeep, fitScale, keepsOriginal, maxZoom, needsDetail, panBy, presetZoom, toPhoto, visibleFractions,
  visibleRegion, zoom100, zoomAt,
} from './view';

const area = { width: 400 + 2 * MARGIN, height: 300 + 2 * MARGIN };
const photo = { width: 4000, height: 3000 }; // Fit: 0.1 CSS px per photo pixel

describe('Fit', () => {
  it('shows the whole photo inside the margin', () => {
    expect(fitScale(area, photo)).toBeCloseTo(0.1);
    expect(fitScale(area, { width: 3000, height: 4000 })).toBeCloseTo(0.075);
  });
  it('centers the photo', () => {
    expect(toPhoto(FIT, area.width / 2, area.height / 2, area, photo)).toEqual([0.5, 0.5]);
  });
});

describe('Presets', () => {
  it('Fit, 100% (one photo pixel per screen pixel), 2x and 4x', () => {
    expect(presetZoom('Fit', area, photo, 2)).toBe(1);
    expect(presetZoom('100%', area, photo, 2)).toBeCloseTo(5); // 0.1 CSS px x 2 device px; 1 / 0.2
    expect(presetZoom('2x', area, photo, 2)).toBe(2);
    expect(presetZoom('4x', area, photo, 2)).toBe(4);
  });
  it('100% is never below Fit, for a photo smaller than the area', () => {
    expect(zoom100(area, { width: 100, height: 75 }, 1)).toBe(1);
  });
  it('zooming goes as far as 4x or twice 100%, whichever is more', () => {
    expect(maxZoom(area, photo, 2)).toBeCloseTo(10);
    expect(maxZoom(area, { width: 400, height: 300 }, 1)).toBe(4);
  });
});

describe('Keeping the photo in view', () => {
  it('never zooms out past Fit or in past the most', () => {
    expect(clampView({ zoom: 0.5, cx: 0.5, cy: 0.5 }, area, photo, 1).zoom).toBe(1);
    expect(clampView({ zoom: 100, cx: 0.5, cy: 0.5 }, area, photo, 1).zoom).toBe(maxZoom(area, photo, 1));
  });
  it('at Fit the photo stays centered', () => {
    expect(clampView({ zoom: 1, cx: 0.9, cy: 0.1 }, area, photo, 1)).toEqual(FIT);
  });
  it('zoomed in, the photo covers the area: no panning past its edge', () => {
    // At 2x, half the photo shows each way: the middle can go from 0.25 to 0.75
    const v = clampView({ zoom: 2, cx: 0.95, cy: 0 }, area, photo, 1);
    // 0.2 CSS px per photo pixel: the area spans 416 / 800 of the width and 316 / 600 of the height
    expect(v.cx).toBeCloseTo(1 - area.width / (2 * 0.2 * 4000));
    expect(v.cy).toBeCloseTo(area.height / (2 * 0.2 * 3000));
  });
});

describe('Zooming toward a point', () => {
  it('keeps the point of the photo under the pointer where it is', () => {
    const before = toPhoto(FIT, 100, 80, area, photo);
    const v = zoomAt(FIT, 3, 100, 80, area, photo, 1);
    const after = toPhoto(v, 100, 80, area, photo);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
    expect(v.zoom).toBe(3);
  });
  it('zooming back to Fit centers again', () => {
    const v = zoomAt(zoomAt(FIT, 3, 50, 50, area, photo, 1), 1, 300, 200, area, photo, 1);
    expect(v).toEqual(FIT);
  });
});

describe('Panning', () => {
  it('a drag moves the photo with the finger', () => {
    const v = { zoom: 4, cx: 0.5, cy: 0.5 };
    const moved = panBy(v, 40, 0, area, photo, 1);
    // 40 CSS px at 0.4 px per photo pixel is 100 photo pixels to the left
    expect(moved.cx).toBeCloseTo(0.5 - 100 / 4000);
  });
  it('does nothing at Fit', () => {
    expect(panBy(FIT, 50, 50, area, photo, 1)).toEqual(FIT);
  });
});

describe('What is in view', () => {
  it('the part of the turned photo in view, for the overview', () => {
    const f = visibleFractions({ zoom: 2, cx: 0.5, cy: 0.5 }, area, photo);
    expect(f.u0).toBeCloseTo(0.25 - MARGIN / 800, 3);
    expect(f.u1).toBeCloseTo(0.75 + MARGIN / 800, 3);
  });
  it('the region of the original in view, through the rotation', () => {
    const original = { width: 3000, height: 4000 }; // opened tall, turned 90 degrees clockwise to wide
    const turned = { width: 4000, height: 3000 };
    // At 2x, against the left edge of the turned photo: u from 0 to 0.52, v from 0.237 to 0.763
    const v = clampView({ zoom: 2, cx: 0, cy: 0.5 }, area, turned, 1);
    const r = visibleRegion(v, area, original, 90, turned);
    // Turning clockwise brought the original's bottom edge to the left: y from (1 - 0.52) to 1,
    // and its left edge to the top: x from 0.237 to 0.763
    expect(r).toEqual({ x: 710, y: 1920, width: 1580, height: 2080 });
  });
  it('is kept within the original', () => {
    const r = visibleRegion(FIT, area, photo, 0, photo);
    expect(r).toEqual({ x: 0, y: 0, width: 4000, height: 3000 });
  });
});

describe('Sharpness', () => {
  it('redraws from the original once the preview is shown larger than the screen pixels', () => {
    // Preview 2048 of a 4000 px original: 0.512 preview px per original px
    expect(needsDetail(FIT, area, photo, 2, 0.512)).toBe(false); // 0.2 device px per original px
    expect(needsDetail({ zoom: 2.6, cx: 0.5, cy: 0.5 }, area, photo, 2, 0.512)).toBe(false); // 0.52: within 5%
    expect(needsDetail({ zoom: 3, cx: 0.5, cy: 0.5 }, area, photo, 2, 0.512)).toBe(true); // 0.6
  });
  it('at the screen pixels the region covers, never more than the original has', () => {
    expect(detailSize({ width: 1000, height: 800 }, 0.4, 2)).toEqual({ width: 800, height: 640 });
    expect(detailSize({ width: 100, height: 80 }, 4, 2)).toEqual({ width: 100, height: 80 });
  });
});

describe('Which sharper part to keep', () => {
  const patch = { photoId: 7, pixels: 'a screenful' };
  it('keeps it while it is for the current photo and the view needs it', () => {
    expect(detailToKeep(patch, 7, true)).toBe(patch);
  });
  it('drops it when zoomed back out to where the preview is sharp enough', () => {
    expect(detailToKeep(patch, 7, false)).toBeNull();
  });
  it('drops it on another photo, the one it was for closed or not', () => {
    expect(detailToKeep(patch, 8, true)).toBeNull();
  });
  it('has nothing to keep when there is none', () => {
    expect(detailToKeep(null, 7, true)).toBeNull();
  });
});

describe('Which decoded original the worker keeps for zooming', () => {
  it('keeps it while its photo is open', () => {
    expect(keepsOriginal(3, [1, 3, 5])).toBe(true);
  });
  it('lets it go once its photo is closed', () => {
    expect(keepsOriginal(3, [1, 5])).toBe(false);
  });
  it('lets it go before a save, which passes no photos', () => {
    expect(keepsOriginal(3, [])).toBe(false);
  });
});
