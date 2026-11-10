// Keyboard shortcuts (SPEC.md section 5, Keyboard). A component registers
// what an action does with useShortcut; one listener on the window turns
// each key into its action (keyAction in lib/keyboard.ts) and calls
// whoever registered for it.

import { useEffect, useRef } from 'react';
import { keyAction, type KeyAction } from '../lib/keyboard';

// A handler answers false when the key wasn't for it just now (no photo
// open, say), so the browser keeps the key
type Handler = () => boolean | void;
interface Entry {
  press: Handler;
  release?: () => void;
}

const registered = new Map<KeyAction, Set<{ current: Entry }>>();
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    const inControl = !!t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable);
    const action = keyAction({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, inControl });
    if (!action) return;
    let handled = false;
    for (const entry of registered.get(action) ?? []) if (entry.current.press() !== false) handled = true;
    if (handled) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    // Whatever was held with it, and wherever the focus is now
    const action = keyAction({ key: e.key });
    if (action) for (const entry of registered.get(action) ?? []) entry.current.release?.();
  });
}

// While the component is mounted, `press` runs when the action's key goes
// down, and `release` when it comes back up
export function useShortcut(action: KeyAction, press: Handler, release?: () => void) {
  const entry = useRef<Entry>({ press, release });
  entry.current = { press, release };
  useEffect(() => {
    listen();
    const set = registered.get(action) ?? new Set();
    registered.set(action, set);
    set.add(entry);
    return () => {
      set.delete(entry);
    };
  }, [action]);
}
