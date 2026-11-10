// The Web Worker: runs the job a message names (src/jobs) and posts back
// its result, or the error

import { jobs, type JobMessage, type JobReply } from './jobs';

type AnyJob = (request: unknown) => Promise<{ result: unknown; transfer?: Transferable[] }>;

self.onmessage = async (event: MessageEvent<JobMessage>) => {
  const { id, job, request } = event.data;
  try {
    const { result, transfer } = await (jobs[job] as AnyJob)(request);
    self.postMessage({ id, ok: true, result } satisfies JobReply, { transfer: transfer ?? [] });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) } satisfies JobReply);
  }
};
