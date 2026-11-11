// The open photos and what the controls do to them (SPEC.md sections 3, 4
// and 6): opening adds after the ones open, selecting, closing, changing a
// setting, Reset, Apply to all, rotating and the White point. Each photo's
// pixels ride along in `T`; this only touches the list and the settings.

import type { Adjustments } from './adjustments';
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
  // The White point and the Rotation have actions of their own below
  | { type: 'change'; settings: Partial<Adjustments> }
  | { type: 'reset'; autoOn: boolean }
  | { type: 'apply-to-all' }
  | { type: 'rotate'; dir: 1 | -1 }
  | { type: 'white-point'; gains: Gains | null };

export const emptyPhotos = <T extends OpenPhoto>(): PhotosState<T> => ({ photos: [], current: -1 });

type ActionOf<T extends OpenPhoto, K extends PhotosAction<T>['type']> = Extract<PhotosAction<T>, { type: K }>;
type Handler<K extends PhotosAction<OpenPhoto>['type']> =
  <T extends OpenPhoto>(state: PhotosState<T>, action: ActionOf<T, K>) => PhotosState<T>;

// The state with the current photo's settings changed by `f` (no change
// with none open)
function onCurrent<T extends OpenPhoto>(state: PhotosState<T>, f: (s: Settings) => Settings): PhotosState<T> {
  const { photos, current } = state;
  if (current < 0) return state;
  return { photos: photos.map((p, i) => (i === current ? { ...p, settings: f(p.settings) } : p)), current };
}

// The state with `index` current, if it is a photo
const selectIndex = <T extends OpenPhoto>(state: PhotosState<T>, index: number): PhotosState<T> =>
  index >= 0 && index < state.photos.length ? { photos: state.photos, current: index } : state;

// Opening adds after the ones open; the first added becomes current when
// none was open
const add: Handler<'add'> = (state, action) => {
  if (action.photos.length === 0) return state;
  const { photos, current } = state;
  return { photos: [...photos, ...action.photos], current: current < 0 ? photos.length : current };
};

// The current photo stays current; closing it makes the next one current
// (or the one before, if it was last)
const close: Handler<'close'> = (state, action) => {
  const { photos, current } = state;
  const index = photos.findIndex((p) => p.id === action.id);
  if (index < 0) return state;
  const rest = photos.filter((p) => p.id !== action.id);
  return { photos: rest, current: index < current ? current - 1 : Math.min(current, rest.length - 1) };
};

// Apply to all: the current photo's shared settings (adjustments.ts) on
// every open photo
const applyToAll: Handler<'apply-to-all'> = (state) => {
  const { photos, current } = state;
  if (current < 0) return state;
  const shared = sharedSettings(photos[current].settings);
  return { photos: photos.map((p) => ({ ...p, settings: { ...p.settings, ...shared } })), current };
};

// One handler for each action. A new action is a new entry; TypeScript
// requires one for every action type.
const HANDLERS: { [K in PhotosAction<OpenPhoto>['type']]: Handler<K> } = {
  add,
  select: (state, action) => selectIndex(state, action.index),
  step: (state, action) => selectIndex(state, state.current + action.by),
  close,
  change: (state, action) => onCurrent(state, (s) => ({ ...s, ...action.settings })),
  reset: (state, action) => onCurrent(state, () => defaultSettings(action.autoOn)),
  'apply-to-all': applyToAll,
  rotate: (state, action) => onCurrent(state, (s) => ({ ...s, rotation: rotate(s.rotation, action.dir) })),
  'white-point': (state, action) => onCurrent(state, (s) => ({ ...s, whitePoint: action.gains })),
};

export function photosReducer<T extends OpenPhoto>(state: PhotosState<T>, action: PhotosAction<T>): PhotosState<T> {
  const handle = HANDLERS[action.type] as <U extends OpenPhoto>(s: PhotosState<U>, a: PhotosAction<U>) => PhotosState<U>;
  return handle(state, action);
}
