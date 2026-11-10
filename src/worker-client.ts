// Runs jobs in a Web Worker (src/worker.ts) and matches each reply to its
// request. Each client has a worker of its own, started on its first job,
// so a save under way doesn't hold up the screen's requests.

import type { JobMessage, JobName, JobReply, JobRequest, JobResult } from './jobs';

export function workerClient() {
  let worker: Worker | null = null;
  let nextId = 1;
  const waiting = new Map<number, (reply: JobReply) => void>();

  return function run<K extends JobName>(job: K, request: JobRequest<K>): Promise<JobResult<K>> {
    if (!worker) {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<JobReply>) => {
        waiting.get(e.data.id)?.(e.data);
        waiting.delete(e.data.id);
      };
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, (reply) => (reply.ok ? resolve(reply.result as JobResult<K>) : reject(new Error(reply.error))));
      worker!.postMessage({ id, job, request } satisfies JobMessage);
    });
  };
}
