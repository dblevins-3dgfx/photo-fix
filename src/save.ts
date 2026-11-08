// Saving (SPEC.md section 7): render each photo in the Web Worker, then put
// it where the browser can: the Save dialog, the share sheet or a download.
// The Save dialog is opened first, while the tap that asked for it still
// counts; the share sheet comes after rendering, and if Safari no longer
// counts the tap, the files are handed back for a Share button.

import type { RenderRequest, RenderResult } from './render-worker';
import { fixedName, freeName } from './lib/filename';
import type { SaveOutcome } from './lib/messages';
import { saveMethod, type SaveMethod } from './lib/save-method';
import { canvasPixelLimit } from './lib/sizes';
import type { Photo } from './photo';

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (r: RenderResult) => void>();

function render(photo: Photo, quality: number) {
  if (!worker) {
    worker = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<RenderResult>) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
  }
  const id = nextId++;
  const request: RenderRequest = {
    kind: 'save', id, file: photo.file, settings: photo.settings, stats: photo.stats, quality,
    limit: canvasPixelLimit(navigator.userAgent, navigator.maxTouchPoints),
  };
  return new Promise<Extract<RenderResult, { blob: Blob }>>((resolve, reject) => {
    waiting.set(id, (r) => ('blob' in r ? resolve(r) : reject(new Error('error' in r ? r.error : 'no file'))));
    worker!.postMessage(request);
  });
}

function abilities() {
  let shareFiles = false;
  try {
    shareFiles = !!navigator.canShare?.({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] });
  } catch {
    shareFiles = false;
  }
  return {
    saveFilePicker: typeof window.showSaveFilePicker === 'function',
    directoryPicker: typeof window.showDirectoryPicker === 'function',
    shareFiles,
  };
}

const named = (e: unknown, name: string) => e instanceof DOMException && e.name === name;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Opens the share sheet with `files`. 'needs a tap' when Safari no longer
// counts the tap that asked for it.
export async function share(files: File[]): Promise<'shared' | 'cancelled' | 'needs a tap'> {
  try {
    await navigator.share({ files });
    return 'shared';
  } catch (e) {
    if (named(e, 'NotAllowedError')) return 'needs a tap';
    if (named(e, 'AbortError')) return 'cancelled';
    throw e;
  }
}

export interface SaveResult {
  outcome: SaveOutcome;
  // Rendered files the share sheet refused without a fresh tap. `outcome`
  // holds the rest (failures, sizes) for after they are shared.
  pendingShare?: File[];
  cancelled?: boolean;
}

const emptyOutcome = (method: SaveMethod): SaveOutcome => ({ method, saved: [], failed: [], smaller: [] });

// Saves `photos` (one for Save, all for Save all), reporting progress
export async function savePhotos(
  photos: readonly Photo[], quality: number, progress: (n: number, total: number) => void,
): Promise<SaveResult> {
  const all = photos.length > 1;
  const method = saveMethod(abilities(), all);
  const outcome = emptyOutcome(method);

  // The Save dialog: ask where first
  let fileHandle: FileSystemFileHandle | null = null;
  let folder: FileSystemDirectoryHandle | null = null;
  const taken: string[] = [];
  if (method === 'dialog') {
    try {
      if (all) {
        folder = await window.showDirectoryPicker!({ id: 'photo-fix', mode: 'readwrite' });
        for await (const name of folder.keys()) taken.push(name);
      } else {
        fileHandle = await window.showSaveFilePicker!({
          suggestedName: fixedName(photos[0].name),
          id: 'photo-fix',
          types: [{ description: 'JPEG image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }],
        });
      }
    } catch (e) {
      if (named(e, 'AbortError')) return { outcome, cancelled: true };
      throw e;
    }
  }

  const toShare: File[] = [];
  for (const [i, photo] of photos.entries()) {
    progress(i + 1, photos.length);
    let name = fixedName(photo.name);
    try {
      const r = await render(photo, quality);
      if (folder) {
        name = freeName(name, taken);
        taken.push(name);
        const handle = await folder.getFileHandle(name, { create: true });
        await write(handle, r.blob);
      } else if (fileHandle) {
        name = fileHandle.name;
        await write(fileHandle, r.blob);
      } else if (method === 'share') {
        toShare.push(new File([r.blob], name, { type: 'image/jpeg' }));
      } else {
        download(r.blob, name);
      }
      if (method !== 'share') outcome.saved.push(name);
      if (r.scaled) outcome.smaller.push({ name, width: r.width, height: r.height, origWidth: r.origWidth, origHeight: r.origHeight });
    } catch {
      outcome.failed.push(name);
    }
  }

  if (toShare.length > 0) {
    const shared = await share(toShare);
    if (shared === 'needs a tap') return { outcome, pendingShare: toShare };
    if (shared === 'cancelled') return { outcome, cancelled: outcome.failed.length === 0 };
    outcome.saved.push(...toShare.map((f) => f.name));
  }
  return { outcome };
}

async function write(handle: FileSystemFileHandle, blob: Blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}
