// The Web Worker's jobs, by name: work on the original at full size, off
// the screen's thread. A new job is a file of its own and a line here.

import { regionJob } from './region-job';
import { saveJob } from './save-job';

export const jobs = {
  save: saveJob,
  region: regionJob,
};

export type Jobs = typeof jobs;
export type JobName = keyof Jobs;
export type JobRequest<K extends JobName> = Parameters<Jobs[K]>[0];
export type JobResult<K extends JobName> = Awaited<ReturnType<Jobs[K]>>['result'];

// What goes to the worker and what comes back (src/worker.ts, src/worker-client.ts)
export interface JobMessage {
  id: number;
  job: JobName;
  request: unknown;
}
export type JobReply = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };
