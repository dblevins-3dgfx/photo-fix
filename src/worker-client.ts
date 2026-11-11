// Runs jobs in a Web Worker (src/worker.ts) and matches each reply to its
// request. Each client has a worker of its own, started on its first job,
// so a save under way doesn't hold up the screen's requests. A worker that
// stops, or a job past its time limit, fails the jobs waiting
// (lib/job-tracker.ts), and the next job starts a fresh worker.

import type { JobMessage, JobName, JobReply, JobRequest, JobResult } from './jobs';
import { TIME_LIMIT_MS, jobTracker } from './lib/job-tracker';

export function workerClient() {
  let worker: Worker | null = null;
  let nextId = 1;
  const tracker = jobTracker<unknown>();

  const drop = () => {
    worker?.terminate();
    worker = null;
  };

  const start = () => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<JobReply>) => tracker.reply(e.data.id, e.data);
    // It failed to load, threw outside a job, or sent what can't be read
    const stopped = () => {
      if (worker !== w) return;
      drop();
      tracker.stopped();
    };
    w.onerror = stopped;
    w.onmessageerror = stopped;
    return w;
  };

  return function run<K extends JobName>(job: K, request: JobRequest<K>): Promise<JobResult<K>> {
    worker ??= start();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // The jobs are failed first, so none of them is answered by the next worker
        if (tracker.timedOut(id)) drop();
      }, TIME_LIMIT_MS[job]);
      tracker.add(id, (reply) => {
        clearTimeout(timer);
        if (reply.ok) resolve(reply.result as JobResult<K>);
        else reject(new Error(reply.error));
      });
      try {
        worker!.postMessage({ id, job, request } satisfies JobMessage);
      } catch (err) {
        // The request couldn't be sent: this job fails, the worker is fine
        tracker.reply(id, { ok: false, error: String(err) });
      }
    });
  };
}
