// The keyboard (SPEC.md section 5, Keyboard)

export type KeyAction =
  | 'open' | 'save' | 'previous' | 'next' | 'rotate-left' | 'rotate-right' | 'eyedropper' | 'disarm' | 'compare';

export interface KeyPress {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  // A key typed into a text field, a slider or another control isn't a shortcut
  inControl?: boolean;
}

export function keyAction(k: KeyPress): KeyAction | null {
  const ctrl = k.ctrlKey || k.metaKey;
  if (ctrl && !k.altKey) {
    const key = k.key.toLowerCase();
    if (key === 'o') return 'open';
    if (key === 's') return 'save';
    return null;
  }
  if (k.key === 'Escape') return 'disarm';
  if (k.inControl || k.altKey) return null;
  switch (k.key) {
    case 'ArrowLeft': return 'previous';
    case 'ArrowRight': return 'next';
    case '[': return 'rotate-left';
    case ']': return 'rotate-right';
    case 'w': case 'W': return 'eyedropper';
    case '\\': return 'compare';
    default: return null;
  }
}
