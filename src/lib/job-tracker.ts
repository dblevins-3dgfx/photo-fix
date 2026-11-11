// The jobs waiting on one Web Worker (SPEC.md section 7, Errors), apart
// from the worker itself so the rules can be tested without one.
// A job is answered by its reply. If the worker stops, every job waiting
// on it fails. If a job runs past its time limit, it fails, and so do the
// others, because the worker is replaced to free the one that is stuck.

// How long a job may take before it counts as stuck, in milliseconds. A
// save renders the whole scan: far longer than a large scan takes on a
// Chromebook or an iPhone. A region is a part of it, for the screen.
export const TIME_LIMIT_MS = { save: 3 * 60_000, region: 60_000 } as const;

export const STOPPED = 'The background worker stopped';
export const TIMED_OUT = 'The background worker took too long';

export type Outcome<R> = { ok: true; result: R } | { ok: false; error: string };

type Settle<R> = (outcome: Outcome<R>) => void;

export function jobTracker<R>() {
  const waiting = new Map<number, Settle<R>>();

  // Every job waiting fails with `error`, and none is left
  const failAll = (error: string) => {
    const all = [...waiting.values()];
    waiting.clear();
    for (const settle of all) settle({ ok: false, error });
  };

  return {
    add(id: number, settle: Settle<R>) {
      waiting.set(id, settle);
    },
    // A reply settles its job; a reply for a job no longer waiting is ignored
    reply(id: number, outcome: Outcome<R>) {
      const settle = waiting.get(id);
      waiting.delete(id);
      settle?.(outcome);
    },
    // The worker stopped
    stopped: () => failAll(STOPPED),
    // Job `id`'s time limit has passed. True when it was still waiting:
    // then every job has failed, and the worker must be replaced.
    timedOut(id: number): boolean {
      if (!waiting.has(id)) return false;
      failAll(TIMED_OUT);
      return true;
    },
    size: () => waiting.size,
  };
}
