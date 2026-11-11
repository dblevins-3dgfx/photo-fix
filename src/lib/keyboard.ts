// The keyboard (SPEC.md section 5, Keyboard)

export type KeyAction =
  | 'open' | 'save' | 'previous' | 'next' | 'rotate-left' | 'rotate-right' | 'eyedropper' | 'disarm' | 'compare'
  | 'zoom-in' | 'zoom-out' | 'zoom-fit';

export interface KeyPress {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  // A key typed into a text field, a slider or another control isn't a shortcut
  inControl?: boolean;
  // A dialog is open: no key is a shortcut, Escape only closes the dialog
  modal?: boolean;
}

// The keys pressed with Ctrl (or ⌘ on a Mac keyboard), lowercased
const WITH_CTRL: Readonly<Record<string, KeyAction>> = {
  o: 'open',
  s: 'save',
};

// The keys pressed alone, as the browser names them
const ALONE: Readonly<Record<string, KeyAction>> = {
  Escape: 'disarm',
  ArrowLeft: 'previous',
  ArrowRight: 'next',
  '[': 'rotate-left',
  ']': 'rotate-right',
  w: 'eyedropper',
  W: 'eyedropper',
  '\\': 'compare',
  // Zoom (section 5, Zoom and pan): + (or = unshifted), - and 0
  '+': 'zoom-in',
  '=': 'zoom-in',
  '-': 'zoom-out',
  '0': 'zoom-fit',
};

// Every key and the action it does, for the tests
export const SHORTCUTS = { withCtrl: WITH_CTRL, alone: ALONE };

const lookUp = (table: Readonly<Record<string, KeyAction>>, key: string) =>
  Object.hasOwn(table, key) ? table[key] : null;

const withCtrl = (k: KeyPress) => !!(k.ctrlKey || k.metaKey) && !k.altKey;

export function keyAction(k: KeyPress): KeyAction | null {
  if (k.modal) return null;
  if (withCtrl(k)) return lookUp(WITH_CTRL, k.key.toLowerCase());
  // Escape disarms even from a control; nothing else is a shortcut there
  if (k.key === 'Escape') return 'disarm';
  if (k.inControl || k.altKey) return null;
  return lookUp(ALONE, k.key);
}

// A key the browser mustn't have while a dialog is open: Ctrl+S and Ctrl+O
// do nothing then, rather than saving the page or opening a file in place
// of it
export const swallowed = (k: KeyPress) =>
  !!k.modal && withCtrl(k) && lookUp(WITH_CTRL, k.key.toLowerCase()) !== null;
