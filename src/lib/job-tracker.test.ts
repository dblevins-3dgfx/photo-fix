import { describe, expect, it } from 'vitest';
import { STOPPED, TIMED_OUT, TIME_LIMIT_MS, jobTracker, type Outcome } from './job-tracker';

// A tracker and what each job was settled with, in order
function setup(ids: number[]) {
  const tracker = jobTracker<string>();
  const settled: [number, Outcome<string>][] = [];
  for (const id of ids) tracker.add(id, (o) => settled.push([id, o]));
  return { tracker, settled };
}

describe('jobTracker', () => {
  it('settles a job with its reply, once', () => {
    const { tracker, settled } = setup([1, 2]);
    tracker.reply(2, { ok: true, result: 'b' });
    tracker.reply(2, { ok: true, result: 'again' });
    expect(settled).toEqual([[2, { ok: true, result: 'b' }]]);
    expect(tracker.size()).toBe(1);
  });

  it('passes on a job that failed in the worker', () => {
    const { tracker, settled } = setup([1]);
    tracker.reply(1, { ok: false, error: 'bad file' });
    expect(settled).toEqual([[1, { ok: false, error: 'bad file' }]]);
  });

  it('ignores a reply for a job it never had', () => {
    const { tracker, settled } = setup([1]);
    tracker.reply(9, { ok: true, result: 'x' });
    expect(settled).toEqual([]);
  });

  it('fails every job waiting when the worker stops', () => {
    const { tracker, settled } = setup([1, 2]);
    tracker.stopped();
    expect(settled).toEqual([[1, { ok: false, error: STOPPED }], [2, { ok: false, error: STOPPED }]]);
    expect(tracker.size()).toBe(0);
  });

  it('fails every job, and asks for a new worker, when a job runs past its limit', () => {
    const { tracker, settled } = setup([1, 2]);
    expect(tracker.timedOut(1)).toBe(true);
    expect(settled.map(([id, o]) => [id, o.ok ? '' : o.error])).toEqual([[1, TIMED_OUT], [2, TIMED_OUT]]);
    expect(tracker.size()).toBe(0);
  });

  it('does nothing when the limit passes for a job already answered', () => {
    const { tracker, settled } = setup([1, 2]);
    tracker.reply(1, { ok: true, result: 'a' });
    expect(tracker.timedOut(1)).toBe(false);
    expect(settled).toHaveLength(1);
    expect(tracker.size()).toBe(1);
  });

  it('a reply after the job failed changes nothing', () => {
    const { tracker, settled } = setup([1]);
    tracker.stopped();
    tracker.reply(1, { ok: true, result: 'late' });
    expect(settled).toEqual([[1, { ok: false, error: STOPPED }]]);
  });

  it('gives a save three minutes, and a region or a release one', () => {
    expect(TIME_LIMIT_MS).toEqual({ save: 180_000, region: 60_000, release: 60_000 });
  });
});
