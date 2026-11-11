// Opening photos (SPEC.md section 3): one file at a time, in the order they
// were opened, with progress across every open still waiting. A second open
// (a drop, then a paste) waits behind the first, so its photos come after
// the first's.

import * as words from './messages';

// How far opening has got: `done` files of `total`, counting every open
// queued since the last time nothing was opening
export interface OpeningProgress {
  done: number;
  total: number;
}

export const NOT_OPENING: OpeningProgress = { done: 0, total: 0 };

// `count` more files queued
export const queued = (p: OpeningProgress, count: number): OpeningProgress => ({ ...p, total: p.total + count });

// One more file decoded, or skipped; when it was the last, nothing is opening
export function stepped(p: OpeningProgress): OpeningProgress {
  const done = p.done + 1;
  return done >= p.total ? NOT_OPENING : { done, total: p.total };
}

export const isOpening = (p: OpeningProgress) => p.total > 0;

// Runs tasks one after another, in the order they were given, whatever
// each one comes to. Each call answers with its own task's result.
export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}

// What the status line says while photos open: the one being decoded now
export const openingText = (p: OpeningProgress) => (isOpening(p) ? words.opening(p.done + 1, p.total) : null);
