import { ImagePlus, Settings as Gear } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { buildTables } from './lib/correction';
import { keyAction } from './lib/keyboard';
import * as words from './lib/messages';
import { emptyPhotos, photosReducer, type PhotosAction, type PhotosState } from './lib/photos';
import type { Prefs } from './lib/prefs';
import { pixelAt, unrotatePoint } from './lib/rotation';
import type { Settings } from './lib/settings';
import { previewLongSide } from './lib/sizes';
import { sampleBlock, whitePointGains } from './lib/white-point';
import { openPhoto, type Photo } from './photo';
import { savePhotos, share } from './save';
import { PREVIEW, loadPrefs, savePrefs } from './storage';
import Controls from './ui/Controls';
import PhotoView from './ui/PhotoView';
import Preferences from './ui/Preferences';
import Strip from './ui/Strip';

type State = PhotosState<Photo>;
const reducer = (s: State, a: PhotosAction<Photo>) => photosReducer<Photo>(s, a);
let nextId = 1;

const coarsePointer = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyPhotos<Photo>);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  // A message belongs to the photo current when it was shown, and stays
  // until the next one or until the photo changes
  const [note, setNote] = useState<{ text: string; photoId: number | undefined } | null>(null);
  const [armed, setArmed] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [pendingShare, setPendingShare] = useState<File[] | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const photo = state.current >= 0 ? state.photos[state.current] : null;

  // Thumbnails' blob URLs go when their photo closes
  const thumbs = useRef(new Set<string>());
  useEffect(() => {
    const open = new Set(state.photos.map((p) => p.thumbUrl));
    for (const url of thumbs.current) if (!open.has(url)) URL.revokeObjectURL(url);
    thumbs.current = open;
  }, [state.photos]);

  const currentId = photo?.id;
  const message = note && note.photoId === currentId ? note.text : null;
  const setMessage = (text: string | null, photoId = currentId) => setNote(text === null ? null : { text, photoId });
  useEffect(() => setArmed(false), [currentId]);

  const changePrefs = (p: Prefs) => {
    setPrefs(p);
    savePrefs(p);
  };

  const openFiles = useCallback(async (files: Iterable<File>) => {
    const previewMax = previewLongSide(screen.width, screen.height, window.devicePixelRatio || 1);
    const opened: Photo[] = [];
    const failed: string[] = [];
    for (const file of files) {
      try {
        opened.push(await openPhoto(file, nextId++, prefs.autoOnNewPhotos, previewMax));
      } catch {
        failed.push(file.name || 'A pasted file');
      }
    }
    dispatch({ type: 'add', photos: opened });
    // Shown on the photo that will be current
    if (failed.length > 0) setNote({ text: words.unsupported(failed), photoId: latest.current.photo?.id ?? opened[0]?.id });
  }, [prefs.autoOnNewPhotos]);

  const arm = (on: boolean) => {
    setArmed(on);
    if (on) setMessage(words.EYEDROPPER);
    else if (message === words.EYEDROPPER || message === words.TOO_DARK) setMessage(null);
  };

  const sample = (u: number, v: number) => {
    if (!photo) return;
    const { analysis, settings, stats } = photo;
    const [x, y] = unrotatePoint(u, v, settings.rotation);
    const [px, py] = pixelAt(x, y, analysis.width, analysis.height);
    const gains = whitePointGains(
      sampleBlock(analysis.data, analysis.width, analysis.height, px, py, buildTables(settings, stats, 'auto')));
    if (gains === 'too dark') {
      setMessage(words.TOO_DARK);
      return;
    }
    dispatch({ type: 'white-point', gains });
    arm(false);
  };

  const save = async (photos: Photo[]) => {
    if (photos.length === 0 || progress) return;
    setPendingShare(null);
    try {
      const result = await savePhotos(photos, prefs.jpegQuality, (n, total) => setProgress(words.saving(n, total)));
      if (result.pendingShare) {
        setPendingShare(result.pendingShare);
        setMessage(words.readyToShare(result.pendingShare.length));
      } else if (!result.cancelled) {
        setMessage(words.saveResult(result.outcome));
      }
    } catch {
      setMessage(words.saveFailed(photos.map((p) => p.name)));
    } finally {
      setProgress(null);
    }
  };

  const shareNow = async () => {
    if (!pendingShare) return;
    const files = pendingShare;
    setPendingShare(null);
    try {
      const r = await share(files);
      setMessage(r === 'shared' ? words.saved(files.map((f) => f.name)) : null);
    } catch {
      setMessage(words.saveFailed(files.map((f) => f.name)));
    }
  };

  // Keyboard, paste and drop (SPEC.md sections 3 and 5)
  const latest = useRef({ photo, armed, arm, save, openFiles });
  latest.current = { photo, armed, arm, save, openFiles };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inControl = !!t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable);
      const action = keyAction({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, inControl });
      const { photo: p, armed: a, arm: setArm } = latest.current;
      if (!action) return;
      if (action === 'open') fileInput.current?.click();
      else if (action === 'save') { if (p) void latest.current.save([p]); }
      else if (action === 'disarm') { if (a) setArm(false); else return; }
      else if (!p) return;
      else if (action === 'previous') dispatch({ type: 'step', by: -1 });
      else if (action === 'next') dispatch({ type: 'step', by: 1 });
      else if (action === 'rotate-left') dispatch({ type: 'rotate', dir: -1 });
      else if (action === 'rotate-right') dispatch({ type: 'rotate', dir: 1 });
      else if (action === 'eyedropper') setArm(!a);
      else if (action === 'compare') setComparing(true);
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { if (e.key === '\\') setComparing(false); };
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length > 0) void latest.current.openFiles(files);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length > 0) void latest.current.openFiles(files);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('paste', paste);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('paste', paste);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const change = (s: Partial<Settings>) => dispatch({ type: 'change', settings: s });

  const openButton = (big = false) => (
    <button
      type="button"
      onClick={() => fileInput.current?.click()}
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
      <input
        ref={fileInput} type="file" accept="image/*" multiple hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void openFiles(files);
        }}
      />

      {!photo ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-3xl font-semibold">Photo Fix</h2>
          <p className="max-w-md text-slate-600 dark:text-slate-300">
            Takes the fading and the color cast out of scanned photos. Your photos stay on this device.
          </p>
          {openButton(true)}
          {!coarsePointer() && <p className="text-sm text-slate-500 dark:text-slate-400">Or drop photos here, or paste one.</p>}
          {message && <p className="max-w-md text-sm text-red-700 dark:text-red-300">{message}</p>}
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col min-[900px]:grid min-[900px]:grid-cols-[1fr_20rem] min-[900px]:grid-rows-[1fr_auto]">
          <section className="flex h-[45dvh] shrink-0 flex-col min-[900px]:h-auto min-[900px]:min-h-0">
            <div className="photo-area flex min-h-0 flex-1 items-center justify-center p-2">
              <PhotoView photo={photo} comparing={comparing} armed={armed} onTap={sample} onHold={setComparing} />
            </div>
            <div className="flex min-h-8 items-center gap-3 px-3 py-1 text-sm" aria-live="polite">
              <span className="truncate">{progress ?? message ?? ''}</span>
              {pendingShare && !progress && (
                <button type="button" onClick={shareNow} className="rounded-lg bg-sky-600 px-3 py-1 text-white">Share</button>
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
            armed={armed}
            several={state.photos.length > 1}
            saving={progress !== null}
            onChange={change}
            onArm={() => arm(!armed)}
            onClearWhitePoint={() => dispatch({ type: 'white-point', gains: null })}
            onRotate={(dir) => dispatch({ type: 'rotate', dir })}
            onReset={() => dispatch({ type: 'reset', autoOn: prefs.autoOnNewPhotos })}
            onApplyToAll={() => dispatch({ type: 'apply-to-all' })}
            onCompare={setComparing}
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
