// Opening photos (SPEC.md section 3): the file picker, a drop, a paste and
// Ctrl+O. Each file is decoded (src/photo.ts) and handed to `add`; the ones
// the browser can't decode are named on the status line.

import { useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import * as words from '../lib/messages';
import { previewLongSide } from '../lib/sizes';
import { openPhoto, type Photo } from '../photo';
import type { Status } from './useStatus';
import { useShortcut } from './useShortcut';

let nextId = 1;

export function useOpenPhotos(photos: readonly Photo[], add: (photos: Photo[]) => void, autoOn: boolean, status: Status) {
  const input = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => input.current?.click(), []);

  const openFiles = useCallback(async (files: Iterable<File>) => {
    const previewMax = previewLongSide(screen.width, screen.height, window.devicePixelRatio || 1);
    const opened: Photo[] = [];
    const failed: string[] = [];
    for (const file of files) {
      try {
        opened.push(await openPhoto(file, nextId++, autoOn, previewMax));
      } catch {
        failed.push(file.name || 'A pasted file');
      }
    }
    add(opened);
    // Shown on the photo that will be current
    if (failed.length > 0) status.show(words.unsupported(failed), status.photoId() ?? opened[0]?.id);
  }, [add, autoOn, status.show, status.photoId]);

  // Thumbnails' blob URLs go when their photo closes
  const thumbs = useRef(new Set<string>());
  useEffect(() => {
    const open = new Set(photos.map((p) => p.thumbUrl));
    for (const url of thumbs.current) if (!open.has(url)) URL.revokeObjectURL(url);
    thumbs.current = open;
  }, [photos]);

  // Paste and drop
  const latest = useRef(openFiles);
  latest.current = openFiles;
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length > 0) void latest.current(files);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length > 0) void latest.current(files);
    };
    window.addEventListener('paste', paste);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('paste', paste);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  useShortcut('open', pick);

  // For the hidden <input type="file">
  const inputProps = {
    ref: input,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])];
      e.target.value = '';
      void openFiles(files);
    },
  };
  return { pick, inputProps };
}
