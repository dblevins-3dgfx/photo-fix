// The open photos and what the controls do to them (SPEC.md sections 3, 4
// and 6): opening adds after the ones open, selecting, closing, changing a
// setting, Reset, Apply to all, rotating and the White point. Each photo's
// pixels ride along in `T`; this only touches the list and the settings.

import { defaultSettings, rotate, sharedSettings, type Gains, type Settings } from './settings';

export interface OpenPhoto {
  id: number;
  name: string;
  settings: Settings;
}

export interface PhotosState<T extends OpenPhoto> {
  photos: T[];
  // The index of the current photo, or -1 with none open
  current: number;
}

export type PhotosAction<T extends OpenPhoto> =
  | { type: 'add'; photos: T[] }
  | { type: 'select'; index: number }
  | { type: 'step'; by: 1 | -1 }
  | { type: 'close'; id: number }
  | { type: 'change'; settings: Partial<Omit<Settings, 'rotation' | 'whitePoint'>> }
  | { type: 'reset'; autoOn: boolean }
  | { type: 'apply-to-all' }
  | { type: 'rotate'; dir: 1 | -1 }
  | { type: 'white-point'; gains: Gains | null };

export const emptyPhotos = <T extends OpenPhoto>(): PhotosState<T> => ({ photos: [], current: -1 });

export function photosReducer<T extends OpenPhoto>(state: PhotosState<T>, action: PhotosAction<T>): PhotosState<T> {
  const { photos, current } = state;
  const setCurrent = (f: (s: Settings) => Settings): PhotosState<T> =>
    current < 0 ? state : { photos: photos.map((p, i) => (i === current ? { ...p, settings: f(p.settings) } : p)), current };
  switch (action.type) {
    case 'add':
      if (action.photos.length === 0) return state;
      // The first photo added becomes current when none was open
      return { photos: [...photos, ...action.photos], current: current < 0 ? photos.length : current };
    case 'select':
      return action.index >= 0 && action.index < photos.length ? { photos, current: action.index } : state;
    case 'step': {
      const index = current + action.by;
      return index >= 0 && index < photos.length ? { photos, current: index } : state;
    }
    case 'close': {
      const index = photos.findIndex((p) => p.id === action.id);
      if (index < 0) return state;
      const rest = photos.filter((p) => p.id !== action.id);
      // The current photo stays current; closing it makes the next one
      // current (or the one before, if it was last)
      const next = index < current ? current - 1 : Math.min(current, rest.length - 1);
      return { photos: rest, current: next };
    }
    case 'change':
      return setCurrent((s) => ({ ...s, ...action.settings }));
    case 'reset':
      return setCurrent(() => defaultSettings(action.autoOn));
    case 'apply-to-all': {
      if (current < 0) return state;
      const shared = sharedSettings(photos[current].settings);
      return { photos: photos.map((p) => ({ ...p, settings: { ...p.settings, ...shared } })), current };
    }
    case 'rotate':
      return setCurrent((s) => ({ ...s, rotation: rotate(s.rotation, action.dir) }));
    case 'white-point':
      return setCurrent((s) => ({ ...s, whitePoint: action.gains }));
  }
}
