// The status line's message (SPEC.md section 5, Status line). A message
// belongs to the photo current when it was shown, and stays until the next
// one or until the photo changes.

import { useCallback, useRef, useState } from 'react';

export interface Status {
  message: string | null;
  // Shows `text` (null clears) on the photo `photoId`: the current one,
  // unless given
  show: (text: string | null, photoId?: number) => void;
  // The current photo's id now, for work that finishes later
  photoId: () => number | undefined;
}

export function useStatus(currentId: number | undefined): Status {
  const [note, setNote] = useState<{ text: string; photoId: number | undefined } | null>(null);
  const id = useRef(currentId);
  id.current = currentId;
  const show = useCallback(
    (text: string | null, photoId = id.current) => setNote(text === null ? null : { text, photoId }), []);
  const photoId = useCallback(() => id.current, []);
  return { message: note && note.photoId === currentId ? note.text : null, show, photoId };
}
