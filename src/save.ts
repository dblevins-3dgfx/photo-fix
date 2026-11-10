// Saving, the browser's part (SPEC.md section 7): rendering in the Web
// Worker, and the places a file can go: the Save dialog (one file, or a
// folder for Save all), the share sheet, or a download. The loop that uses
// them is savePhotos in lib/save-photos.ts.

import { saveMethod } from './lib/save-method';
import type { Destination, Finish, Rendered } from './lib/save-photos';
import { canvasPixelLimit } from './lib/sizes';
import type { Photo } from './photo';
import { workerClient } from './worker-client';

const run = workerClient();

// Renders `photo` at full size, with its corrections, as a JPEG
export const renderPhoto = (photo: Photo, quality: number): Promise<Rendered<Blob>> =>
  run('save', {
    file: photo.file, settings: photo.settings, stats: photo.stats, quality,
    limit: canvasPixelLimit(navigator.userAgent, navigator.maxTouchPoints),
  });

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

async function write(handle: FileSystemFileHandle, blob: Blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

// Runs a picker; null when the user cancels it
async function picked<T>(pick: () => Promise<T>): Promise<T | null> {
  try {
    return await pick();
  } catch (e) {
    if (named(e, 'AbortError')) return null;
    throw e;
  }
}

// The Save dialog for one file. It is opened before rendering, while the
// tap that asked for it still counts.
function fileDialog(): Destination<Blob> {
  let handle: FileSystemFileHandle | null = null;
  return {
    method: 'dialog',
    async prepare(names) {
      handle = await picked(() => window.showSaveFilePicker!({
        suggestedName: names[0],
        id: 'photo-fix',
        types: [{ description: 'JPEG image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }],
      }));
      return handle && {};
    },
    async deliver(blob) {
      await write(handle!, blob);
      return handle!.name;
    },
    finish: async () => 'done',
  };
}

// A folder, asked for once, for Save all
function folderDialog(): Destination<Blob> {
  let folder: FileSystemDirectoryHandle | null = null;
  return {
    method: 'dialog',
    async prepare() {
      folder = await picked(() => window.showDirectoryPicker!({ id: 'photo-fix', mode: 'readwrite' }));
      if (!folder) return null;
      const taken: string[] = [];
      for await (const name of folder.keys()) taken.push(name);
      return { taken };
    },
    async deliver(blob, name) {
      await write(await folder!.getFileHandle(name, { create: true }), blob);
      return name;
    },
    finish: async () => 'done',
  };
}

// The share sheet, with every file at once, after rendering. When Safari
// no longer counts the tap that asked, it answers 'needs a tap', and
// `finish` is called again from a Share button.
function shareSheet(): Destination<Blob> {
  const files: File[] = [];
  return {
    method: 'share',
    prepare: async () => ({}),
    async deliver(blob, name) {
      files.push(new File([blob], name, { type: 'image/jpeg' }));
      return name;
    },
    async finish(): Promise<Finish> {
      try {
        await navigator.share({ files });
        return 'done';
      } catch (e) {
        if (named(e, 'NotAllowedError')) return 'needs a tap';
        if (named(e, 'AbortError')) return 'cancelled';
        throw e;
      }
    },
  };
}

// A download for each file
function downloads(): Destination<Blob> {
  return {
    method: 'download',
    prepare: async () => ({}),
    async deliver(blob, name) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return name;
    },
    finish: async () => 'done',
  };
}

// The first destination this browser can do: for one photo (Save) or
// several (Save all)
export function destinationFor(all: boolean): Destination<Blob> {
  switch (saveMethod(abilities(), all)) {
    case 'dialog': return all ? folderDialog() : fileDialog();
    case 'share': return shareSheet();
    case 'download': return downloads();
  }
}
