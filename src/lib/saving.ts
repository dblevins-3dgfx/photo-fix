// Where a save is (SPEC.md section 7): one state at a time, so Save and
// Save all are greyed out for the whole of a save, the Save dialog and the
// share sheet included, and the Share button shows exactly while files wait
// for a tap. `T` is what waits with them (the destination and the result
// so far); this only moves between the states.

import * as words from './messages';

export type SavingState<T> =
  | { kind: 'idle' }
  // The Save dialog or the folder picker is open
  | { kind: 'asking' }
  | { kind: 'rendering'; n: number; total: number }
  // Rendered and delivered; the share sheet wants a fresh tap on Share
  | { kind: 'needs-tap'; count: number; pending: T }
  // Share was tapped: the share sheet is open
  | { kind: 'sharing' };

export type SavingEvent<T> =
  | { type: 'start' }
  | { type: 'progress'; n: number; total: number }
  | { type: 'needs-tap'; count: number; pending: T }
  | { type: 'tap-share' }
  // Saved, cancelled, refused or failed: what it came to goes on the status line
  | { type: 'done' };

export const IDLE: SavingState<never> = { kind: 'idle' };

// A save under way: Save, Save all and Ctrl+S do nothing. Files waiting for
// a tap don't count, so a new save can still start (and replaces them).
export const isBusy = (s: SavingState<unknown>) => s.kind !== 'idle' && s.kind !== 'needs-tap';

type Handler<T> = (s: SavingState<T>, e: SavingEvent<T>) => SavingState<T>;

// Each event, from the states it can come in; from any other, it is ignored
const HANDLERS: { [K in SavingEvent<unknown>['type']]: Handler<unknown> } = {
  start: (s) => (isBusy(s) ? s : { kind: 'asking' }),
  progress: (s, e) =>
    (s.kind === 'asking' || s.kind === 'rendering') && e.type === 'progress'
      ? { kind: 'rendering', n: e.n, total: e.total }
      : s,
  'needs-tap': (s, e) =>
    (s.kind === 'rendering' || s.kind === 'sharing') && e.type === 'needs-tap'
      ? { kind: 'needs-tap', count: e.count, pending: e.pending }
      : s,
  'tap-share': (s) => (s.kind === 'needs-tap' ? { kind: 'sharing' } : s),
  done: () => IDLE,
};

export function savingReducer<T>(s: SavingState<T>, e: SavingEvent<T>): SavingState<T> {
  return (HANDLERS[e.type] as Handler<T>)(s, e);
}

// What the status line says for the state, ahead of any other message: the
// progress, and while files wait for a tap, that they do, whichever photo
// is current. Null leaves the line to the other messages.
export function savingText(s: SavingState<unknown>): string | null {
  if (s.kind === 'rendering') return words.saving(s.n, s.total);
  if (s.kind === 'needs-tap') return words.readyToShare(s.count);
  return null;
}

// The Share button shows while files wait for a tap
export const showsShare = (s: SavingState<unknown>) => s.kind === 'needs-tap';
