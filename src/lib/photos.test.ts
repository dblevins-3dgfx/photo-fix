import { describe, expect, it } from 'vitest';
import { emptyPhotos, photosReducer, type OpenPhoto, type PhotosState } from './photos';
import { defaultSettings } from './settings';

const photo = (id: number): OpenPhoto => ({ id, name: `p${id}.jpg`, settings: defaultSettings(true) });
const withPhotos = (n: number, current = 0): PhotosState<OpenPhoto> => ({
  photos: Array.from({ length: n }, (_, i) => photo(i + 1)),
  current,
});

describe('Opening', () => {
  it('adds photos after the ones open; the first becomes current when none was', () => {
    let s = photosReducer(emptyPhotos(), { type: 'add', photos: [photo(1), photo(2)] });
    expect(s.current).toBe(0);
    s = photosReducer({ ...s, current: 1 }, { type: 'add', photos: [photo(3)] });
    expect(s.photos.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(s.current).toBe(1);
  });
});

describe('Several photos', () => {
  it('select and step move the current photo, within the list', () => {
    const s = withPhotos(3);
    expect(photosReducer(s, { type: 'select', index: 2 }).current).toBe(2);
    expect(photosReducer(s, { type: 'select', index: 3 }).current).toBe(0);
    expect(photosReducer(s, { type: 'step', by: 1 }).current).toBe(1);
    expect(photosReducer(s, { type: 'step', by: -1 }).current).toBe(0);
  });
  it('closing the current photo makes the next current, or the one before if it was last', () => {
    expect(photosReducer(withPhotos(3, 1), { type: 'close', id: 2 })).toMatchObject({ current: 1 });
    expect(photosReducer(withPhotos(3, 2), { type: 'close', id: 3 }).current).toBe(1);
    expect(photosReducer(withPhotos(1, 0), { type: 'close', id: 1 })).toEqual({ photos: [], current: -1 });
  });
  it('closing another photo keeps the current one current', () => {
    const s = photosReducer(withPhotos(3, 2), { type: 'close', id: 1 });
    expect(s.photos[s.current].id).toBe(3);
  });
});

describe('Changing settings', () => {
  it('changes only the current photo', () => {
    const s = photosReducer(withPhotos(2, 1), { type: 'change', settings: { warmth: 30 } });
    expect(s.photos[1].settings.warmth).toBe(30);
    expect(s.photos[0].settings.warmth).toBe(0);
  });
  it('turning Auto off keeps its strength', () => {
    let s = photosReducer(withPhotos(1), { type: 'change', settings: { strength: 40 } });
    s = photosReducer(s, { type: 'change', settings: { auto: false } });
    s = photosReducer(s, { type: 'change', settings: { auto: true } });
    expect(s.photos[0].settings.strength).toBe(40);
  });
  it('the White point is kept when other settings change, and Clear removes it', () => {
    let s = photosReducer(withPhotos(1), { type: 'white-point', gains: [1.2, 1, 0.8] });
    s = photosReducer(s, { type: 'change', settings: { auto: false, contrast: 20 } });
    expect(s.photos[0].settings.whitePoint).toEqual([1.2, 1, 0.8]);
    s = photosReducer(s, { type: 'white-point', gains: null });
    expect(s.photos[0].settings.whitePoint).toBeNull();
  });
  it('Reset puts every setting back, rotation included', () => {
    let s = photosReducer(withPhotos(1), { type: 'change', settings: { saturation: 30, auto: true } });
    s = photosReducer(s, { type: 'rotate', dir: 1 });
    s = photosReducer(s, { type: 'white-point', gains: [1, 1, 1] });
    s = photosReducer(s, { type: 'reset', autoOn: false });
    expect(s.photos[0].settings).toEqual(defaultSettings(false));
  });
  it('rotates the current photo', () => {
    const s = photosReducer(withPhotos(1), { type: 'rotate', dir: -1 });
    expect(s.photos[0].settings.rotation).toBe(270);
  });
});

describe('Apply to all', () => {
  it('copies Auto, its strength, Midtones and the five sliders, but not the White point or the Rotation', () => {
    let s = withPhotos(3, 0);
    s = photosReducer(s, { type: 'select', index: 2 });
    s = photosReducer(s, { type: 'white-point', gains: [0.9, 1, 1.1] });
    s = photosReducer(s, { type: 'rotate', dir: 1 });
    s = photosReducer(s, { type: 'select', index: 0 });
    s = photosReducer(s, {
      type: 'change',
      settings: { auto: false, strength: 70, midtones: true, warmth: 10, tint: -5, brightness: 20, contrast: 15, saturation: 25 },
    });
    s = photosReducer(s, { type: 'apply-to-all' });
    for (const p of s.photos) {
      expect(p.settings).toMatchObject({ auto: false, strength: 70, midtones: true, warmth: 10, tint: -5, brightness: 20, contrast: 15, saturation: 25 });
    }
    expect(s.photos[2].settings.whitePoint).toEqual([0.9, 1, 1.1]);
    expect(s.photos[2].settings.rotation).toBe(90);
  });
});
