import { describe, expect, it } from 'vitest';
import { IDLE, isBusy, savingReducer, savingText, showsShare, type SavingEvent, type SavingState } from './saving';

type S = SavingState<string>;
type E = SavingEvent<string>;
const run = (events: E[], from: S = IDLE) => events.reduce(savingReducer<string>, from);

const start: E = { type: 'start' };
const progress = (n: number, total: number): E => ({ type: 'progress', n, total });
const needsTap = (count: number): E => ({ type: 'needs-tap', count, pending: 'files' });
const tap: E = { type: 'tap-share' };
const done: E = { type: 'done' };

describe('Saving', () => {
  it('is idle and not busy to start', () => {
    expect(isBusy(IDLE)).toBe(false);
    expect(savingText(IDLE)).toBeNull();
    expect(showsShare(IDLE)).toBe(false);
  });

  it('a save goes asking, rendering each photo, then idle', () => {
    const asking = run([start]);
    expect(asking).toEqual({ kind: 'asking' });
    expect(run([start, progress(1, 3), progress(2, 3)])).toEqual({ kind: 'rendering', n: 2, total: 3 });
    expect(run([start, progress(1, 3), progress(2, 3), progress(3, 3), done])).toEqual(IDLE);
  });

  it('is busy while the Save dialog or folder picker is open, before anything renders', () => {
    expect(isBusy(run([start]))).toBe(true);
  });

  it('cancelling the dialog goes back to idle', () => {
    expect(run([start, done])).toEqual(IDLE);
  });

  it('says the progress while rendering, and nothing of its own while asking or sharing', () => {
    expect(savingText(run([start, progress(2, 5)]))).toBe('Saving 2 of 5');
    expect(savingText(run([start, progress(1, 1)]))).toBe('Saving');
    expect(savingText(run([start]))).toBeNull();
    expect(savingText(run([start, progress(1, 1), needsTap(1), tap]))).toBeNull();
  });

  it('files waiting for a tap show the Share button and its message, and a new save can start', () => {
    const waiting = run([start, progress(1, 2), progress(2, 2), needsTap(2)]);
    expect(waiting).toEqual({ kind: 'needs-tap', count: 2, pending: 'files' });
    expect(showsShare(waiting)).toBe(true);
    expect(savingText(waiting)).toBe('2 photos ready to save. Tap Share');
    expect(isBusy(waiting)).toBe(false);
    expect(run([start], waiting)).toEqual({ kind: 'asking' });
  });

  it('is busy while the share sheet is open after a tap on Share, and hides the button', () => {
    const sharing = run([start, progress(1, 1), needsTap(1), tap]);
    expect(sharing).toEqual({ kind: 'sharing' });
    expect(isBusy(sharing)).toBe(true);
    expect(showsShare(sharing)).toBe(false);
    expect(run([start], sharing)).toEqual(sharing);
  });

  it('after sharing: done, or wanting another tap', () => {
    const sharing = run([start, progress(1, 1), needsTap(1), tap]);
    expect(run([done], sharing)).toEqual(IDLE);
    expect(run([needsTap(1)], sharing)).toEqual({ kind: 'needs-tap', count: 1, pending: 'files' });
  });

  it('a save already under way ignores another start', () => {
    const rendering = run([start, progress(1, 3)]);
    expect(run([start], rendering)).toBe(rendering);
  });

  it('ignores events that don\'t belong to the state', () => {
    expect(run([progress(1, 2)])).toEqual(IDLE);
    expect(run([needsTap(1)])).toEqual(IDLE);
    expect(run([tap])).toEqual(IDLE);
    expect(run([start, tap])).toEqual({ kind: 'asking' });
    expect(run([start, needsTap(1)])).toEqual({ kind: 'asking' });
  });
});
