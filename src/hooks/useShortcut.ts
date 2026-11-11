// Keyboard shortcuts (SPEC.md section 5, Keyboard). A component registers
// what an action does with useShortcut; one listener on the window turns
// each key into its action (keyAction in lib/keyboard.ts) and calls
// whoever registered for it. While a dialog is open (useModal), no key is
// a shortcut.

import { useEffect, useRef } from 'react';
import { keyAction, swallowed, type KeyAction } from '../lib/keyboard';

// A handler answers false when the key wasn't for it just now (no photo
// open, say), so the browser keeps the key
type Handler = () => boolean | void;
interface Entry {
  press: Handler;
  release?: () => void;
}

const registered = new Map<KeyAction, Set<{ current: Entry }>>();
let listening = false;
// How many dialogs are open
let dialogs = 0;

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    const inControl = !!t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable);
    const press = { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, inControl, modal: dialogs > 0 };
    if (swallowed(press)) e.preventDefault();
    const action = keyAction(press);
    if (!action) return;
    let handled = false;
    for (const entry of registered.get(action) ?? []) if (entry.current.press() !== false) handled = true;
    if (handled) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    // Whatever was held with it, wherever the focus is now and whether or
    // not a dialog has opened since it went down
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

// While the component (a dialog) is mounted, no key is a shortcut
export function useModal() {
  useEffect(() => {
    dialogs++;
    return () => {
      dialogs--;
    };
  }, []);
}
