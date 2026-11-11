import { ImagePlus, Settings as Gear } from 'lucide-react';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { useEyedropper } from './hooks/useEyedropper';
import { releaseOriginal } from './detail';
import { useOpenPhotos } from './hooks/useOpenPhotos';
import { useSaving } from './hooks/useSaving';
import { useShortcut } from './hooks/useShortcut';
import { useStatus } from './hooks/useStatus';
import { emptyPhotos, photosReducer, type PhotosAction, type PhotosState } from './lib/photos';
import { NOT_COMPARING, compareWith, isComparing, type CompareSource, type Comparing } from './lib/compare';
import type { Prefs } from './lib/prefs';
import type { Adjustments } from './lib/adjustments';
import type { Photo } from './photo';
import { PREVIEW, loadPrefs, savePrefs } from './storage';
import Controls from './ui/Controls';
import PhotoView from './ui/PhotoView';
import Preferences from './ui/Preferences';
import Strip from './ui/Strip';

type State = PhotosState<Photo>;
const reducer = (s: State, a: PhotosAction<Photo>) => photosReducer<Photo>(s, a);

const coarsePointer = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

// The screen (SPEC.md section 5): the open photos and their settings, and
// the layout. Opening, saving, the status line and the eyedropper are the
// hooks in src/hooks.
export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyPhotos<Photo>);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [held, setHeld] = useState<Comparing>(NOT_COMPARING);
  const comparing = isComparing(held);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const photo = state.current >= 0 ? state.photos[state.current] : null;

  const status = useStatus(photo?.id);
  const add = useCallback((photos: Photo[]) => dispatch({ type: 'add', photos }), []);
  const { pick, inputProps, text: openingLine } = useOpenPhotos(state.photos, add, prefs.autoOnNewPhotos, status);
  const { busy, text: savingLine, save, canShareNow, shareNow } = useSaving(prefs.jpegQuality, status);
  const eyedropper = useEyedropper(photo, (gains) => dispatch({ type: 'white-point', gains }), status);
  const { message } = status;

  const changePrefs = (p: Prefs) => {
    setPrefs(p);
    savePrefs(p);
  };

  // With a photo open: does `act` when the key is pressed
  const withPhoto = (act: () => void) => () => {
    if (!photo) return false;
    act();
  };
  useShortcut('save', () => {
    if (photo) void save([photo]);
  });
  useShortcut('previous', withPhoto(() => dispatch({ type: 'step', by: -1 })));
  useShortcut('next', withPhoto(() => dispatch({ type: 'step', by: 1 })));
  useShortcut('rotate-left', withPhoto(() => dispatch({ type: 'rotate', dir: -1 })));
  useShortcut('rotate-right', withPhoto(() => dispatch({ type: 'rotate', dir: 1 })));
  // Compare, while any of its three is held (lib/compare.ts)
  const compare = (source: CompareSource) => (on: boolean) => setHeld((c) => compareWith(c, source, on));
  useShortcut('compare', withPhoto(() => compare('key')(true)), () => compare('key')(false));
  // A key let go of in another window never comes back up here
  useEffect(() => {
    const letGo = () => setHeld(NOT_COMPARING);
    const hidden = () => document.hidden && letGo();
    window.addEventListener('blur', letGo);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', letGo);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  // A closed photo's decoded original, kept for zooming, goes with it
  const openIds = state.photos.map((p) => p.id).join(',');
  useEffect(() => releaseOriginal(openIds ? openIds.split(',').map(Number) : []), [openIds]);

  const change = (s: Partial<Adjustments>) => dispatch({ type: 'change', settings: s });

  const openButton = (big = false) => (
    <button
      type="button"
      onClick={pick}
      className={`inline-flex items-center gap-2 rounded-lg bg-sky-600 font-medium text-white hover:bg-sky-700 ${
        big ? 'px-6 py-3 text-lg' : 'px-3 py-1.5 text-sm'}`}
    >
      <ImagePlus size={big ? 22 : 16} />Open photos
    </button>
  );

  return (
    <div className="safe-area flex h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h1 className="font-semibold">Photo Fix</h1>
        {PREVIEW && (
          <a href={import.meta.env.VITE_PREVIEW_URL} className="rounded bg-amber-200 px-1.5 text-xs text-amber-900">
            Preview #{PREVIEW}
          </a>
        )}
        <div className="ml-auto flex items-center gap-2">
          {photo && openButton()}
          <button type="button" onClick={() => setPrefsOpen(true)} aria-label="Preferences"
            className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-slate-700">
            <Gear size={18} />
          </button>
        </div>
      </header>
      <input type="file" accept="image/*" multiple hidden {...inputProps} />

      {!photo ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-3xl font-semibold">Photo Fix</h2>
          <p className="max-w-md text-slate-600 dark:text-slate-300">
            Takes the fading and the color cast out of scanned photos. Your photos stay on this device.
          </p>
          {openButton(true)}
          {!coarsePointer() && <p className="text-sm text-slate-500 dark:text-slate-400">Or drop photos here, or paste one.</p>}
          {openingLine && <p className="text-sm text-slate-600 dark:text-slate-300">{openingLine}</p>}
          {message && <p className="max-w-md text-sm text-red-700 dark:text-red-300">{message}</p>}
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col min-[900px]:grid min-[900px]:grid-cols-[1fr_20rem] min-[900px]:grid-rows-[1fr_auto]">
          <section className="flex shrink-0 flex-col min-[900px]:min-h-0">
            {/* On a narrow screen the photo keeps its height, and a long
                message pushes the strip and controls down */}
            <div className="photo-area h-[42dvh] shrink-0 overflow-hidden min-[900px]:h-auto min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:shrink">
              <PhotoView photo={photo} comparing={comparing} armed={eyedropper.armed} onTap={eyedropper.sample} onHold={compare('photo')} />
            </div>
            {/* The status line wraps, so a long message is never cut off */}
            <div className="flex min-h-8 items-center gap-3 px-3 py-1 text-sm" aria-live="polite">
              <span className="min-w-0 flex-1 break-words">{savingLine ?? openingLine ?? message ?? ''}</span>
              {canShareNow && (
                <button type="button" onClick={shareNow} className="shrink-0 rounded-lg bg-sky-600 px-3 py-1 text-white">Share</button>
              )}
            </div>
          </section>
          <Strip
            photos={state.photos} current={state.current}
            onSelect={(index) => dispatch({ type: 'select', index })}
            onClose={(id) => dispatch({ type: 'close', id })}
            className="border-y border-slate-200 dark:border-slate-700 min-[900px]:col-start-1 min-[900px]:row-start-2 min-[900px]:border-b-0"
          />
          <Controls
            settings={photo.settings}
            armed={eyedropper.armed}
            several={state.photos.length > 1}
            saving={busy}
            onChange={change}
            onArm={eyedropper.toggle}
            onClearWhitePoint={() => dispatch({ type: 'white-point', gains: null })}
            onRotate={(dir) => dispatch({ type: 'rotate', dir })}
            onReset={() => dispatch({ type: 'reset', autoOn: prefs.autoOnNewPhotos })}
            onApplyToAll={() => dispatch({ type: 'apply-to-all' })}
            onCompare={compare('button')}
            onSave={() => void save([photo])}
            onSaveAll={() => void save(state.photos)}
            className="min-h-0 flex-1 overflow-y-auto min-[900px]:col-start-2 min-[900px]:row-span-2 min-[900px]:row-start-1 min-[900px]:border-l min-[900px]:border-slate-200 dark:min-[900px]:border-slate-700"
          />
        </main>
      )}

      {prefsOpen && <Preferences prefs={prefs} onChange={changePrefs} onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}
