import { describe, expect, it } from 'vitest';
import { saveResult } from './messages';
import { finishPending, savePhotos, type Destination, type Finish, type Rendered } from './save-photos';

const photo = (name: string) => ({ name });
const rendered = (blob: string, over: Partial<Rendered<string>> = {}): Rendered<string> => ({
  blob, width: 100, height: 80, scaled: false, origWidth: 100, origHeight: 80, ...over,
});
const render = async (p: { name: string }) => rendered(`pixels of ${p.name}`);

// A destination that records what it is given
function fake(over: Partial<Destination<string>> & { finishes?: Finish[]; taken?: string[] } = {}) {
  const files: Record<string, string> = {};
  const asked: string[][] = [];
  const finishes = [...(over.finishes ?? ['done' as const])];
  let finishCalls = 0;
  const destination: Destination<string> = {
    method: 'dialog',
    prepare: async (names) => {
      asked.push([...names]);
      return { taken: over.taken };
    },
    deliver: async (blob, name) => {
      files[name] = blob;
      return name;
    },
    finish: async () => {
      finishCalls++;
      return finishes.shift() ?? 'done';
    },
    ...over,
  };
  return { destination, files, asked, finishCalls: () => finishCalls };
}

const noProgress = () => {};

describe('Saving', () => {
  it('renders each photo and delivers it under its -fixed name', async () => {
    const d = fake();
    const r = await savePhotos([photo('a.png'), photo('b.jpg')], render, d.destination, noProgress);
    expect(d.files).toEqual({ 'a-fixed.jpg': 'pixels of a.png', 'b-fixed.jpg': 'pixels of b.jpg' });
    expect(r).toEqual({ outcome: { method: 'dialog', saved: ['a-fixed.jpg', 'b-fixed.jpg'], failed: [], smaller: [] } });
  });
  it('asks where first, with the names the files would get', async () => {
    const order: string[] = [];
    const d = fake({ prepare: async (names) => { order.push(`ask ${names.join(',')}`); return {}; } });
    await savePhotos([photo('a.png')], async (p) => { order.push('render'); return render(p); }, d.destination, noProgress);
    expect(order).toEqual(['ask a-fixed.jpg', 'render']);
  });
  it('reports progress before each photo', async () => {
    const seen: string[] = [];
    await savePhotos([photo('a'), photo('b'), photo('c')], render, fake().destination, (n, total) => seen.push(`${n}/${total}`));
    expect(seen).toEqual(['1/3', '2/3', '3/3']);
  });
  it('carries the method of its destination', async () => {
    const r = await savePhotos([photo('a')], render, fake({ method: 'download' }).destination, noProgress);
    expect(saveResult(r.outcome)).toBe('Downloaded a-fixed.jpg. Look in your Downloads folder');
  });
  it('uses the name the destination saved under (the Save dialog lets it be changed)', async () => {
    const d = fake({ deliver: async () => 'Renamed.jpg' });
    const r = await savePhotos([photo('a.png')], render, d.destination, noProgress);
    expect(r.outcome.saved).toEqual(['Renamed.jpg']);
  });
});

describe('Cancelling', () => {
  it('the dialog: nothing is rendered or saved, and nothing is reported', async () => {
    let renders = 0;
    const d = fake({ prepare: async () => null });
    const r = await savePhotos([photo('a')], async (p) => { renders++; return render(p); }, d.destination, noProgress);
    expect(renders).toBe(0);
    expect(d.files).toEqual({});
    expect(r.cancelled).toBe(true);
  });
  it('the share sheet: nothing is reported, unless a photo failed', async () => {
    const shared = await savePhotos([photo('a')], render, fake({ method: 'share', finishes: ['cancelled'] }).destination, noProgress);
    expect(shared.cancelled).toBe(true);
    expect(shared.outcome.saved).toEqual([]);
    const failing = async (p: { name: string }) => { if (p.name === 'b') throw new Error('bad'); return render(p); };
    const r = await savePhotos([photo('a'), photo('b')], failing, fake({ method: 'share', finishes: ['cancelled'] }).destination, noProgress);
    expect(r.cancelled).toBe(false);
    expect(saveResult(r.outcome)).toBe("Couldn't save b-fixed.jpg");
  });
});

describe('Errors', () => {
  it('a photo that fails to render is named, and the others still save', async () => {
    const d = fake();
    const failing = async (p: { name: string }) => { if (p.name === 'b.jpg') throw new Error('bad'); return render(p); };
    const r = await savePhotos([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')], failing, d.destination, noProgress);
    expect(r.outcome.failed).toEqual(['b-fixed.jpg']);
    expect(r.outcome.saved).toEqual(['a-fixed.jpg', 'c-fixed.jpg']);
    expect(saveResult(r.outcome)).toBe("Couldn't save b-fixed.jpg. Saved 2 photos");
  });
  it('a photo that fails to be written is named too', async () => {
    const d = fake({ deliver: async (_blob, name) => { if (name === 'a-fixed.jpg') throw new Error('disk'); return name; } });
    const r = await savePhotos([photo('a'), photo('b')], render, d.destination, noProgress);
    expect(r.outcome.failed).toEqual(['a-fixed.jpg']);
    expect(r.outcome.saved).toEqual(['b-fixed.jpg']);
  });
  it('when every photo fails, the destination is not finished', async () => {
    const d = fake();
    const r = await savePhotos([photo('a')], async () => { throw new Error('bad'); }, d.destination, noProgress);
    expect(d.finishCalls()).toBe(0);
    expect(r).toEqual({ outcome: { method: 'dialog', saved: [], failed: ['a-fixed.jpg'], smaller: [] } });
  });
});

describe('A name already in the folder', () => {
  it('is not replaced: the number goes up until the name is free', async () => {
    const d = fake({ taken: ['a-fixed.jpg', 'a-fixed (2).jpg'] });
    await savePhotos([photo('a.png')], render, d.destination, noProgress);
    expect(Object.keys(d.files)).toEqual(['a-fixed (3).jpg']);
  });
  it('counts names saved earlier in the same Save all', async () => {
    const d = fake({ taken: [] });
    const r = await savePhotos([photo('a.png'), photo('a.jpg'), photo('A.webp')], render, d.destination, noProgress);
    expect(r.outcome.saved).toEqual(['a-fixed.jpg', 'a-fixed (2).jpg', 'A-fixed (3).jpg']);
  });
  it('a destination that is not a folder gets the names as they are', async () => {
    const seen: string[] = [];
    const d = fake({ method: 'share', deliver: async (_blob, name) => { seen.push(name); return name; } });
    await savePhotos([photo('a.png'), photo('a.jpg')], render, d.destination, noProgress);
    expect(seen).toEqual(['a-fixed.jpg', 'a-fixed.jpg']);
  });
});

describe('Too large for the device', () => {
  it('records each photo saved smaller than its scan', async () => {
    const small = async (p: { name: string }) =>
      rendered('x', p.name === 'big' ? { width: 4000, height: 4194, scaled: true, origWidth: 4800, origHeight: 5033 } : {});
    const r = await savePhotos([photo('big'), photo('ok')], small, fake().destination, noProgress);
    expect(r.outcome.smaller).toEqual([{ name: 'big-fixed.jpg', width: 4000, height: 4194, origWidth: 4800, origHeight: 5033 }]);
  });
});

describe('When the share sheet wants another tap', () => {
  it('hands the files back as pending, with nothing reported as shared yet', async () => {
    const d = fake({ method: 'share', finishes: ['needs a tap', 'done'] });
    const r = await savePhotos([photo('a'), photo('b')], render, d.destination, noProgress);
    expect(r.pending).toEqual(['a-fixed.jpg', 'b-fixed.jpg']);
    expect(r.outcome.saved).toEqual([]);
    const after = await finishPending(d.destination, r);
    expect(saveResult(after.outcome)).toBe('Shared 2 photos');
    expect(after.pending).toBeUndefined();
  });
  it('keeps what failed and what was saved smaller for after the tap', async () => {
    const d = fake({ method: 'share', finishes: ['needs a tap', 'done'] });
    const mixed = async (p: { name: string }) => {
      if (p.name === 'bad') throw new Error('bad');
      return rendered('x', { width: 4000, height: 4194, scaled: true, origWidth: 4800, origHeight: 5033 });
    };
    const after = await finishPending(d.destination, await savePhotos([photo('bad'), photo('big')], mixed, d.destination, noProgress));
    expect(saveResult(after.outcome)).toBe(
      "Couldn't save bad-fixed.jpg. Shared at 4000 x 4194, smaller than the 4800 x 5033 scan, the most this device can save");
  });
  it('closing the sheet after the tap says nothing; a refusal stays pending', async () => {
    const d = fake({ method: 'share', finishes: ['needs a tap', 'needs a tap', 'cancelled'] });
    const r = await savePhotos([photo('a')], render, d.destination, noProgress);
    const again = await finishPending(d.destination, r);
    expect(again.pending).toEqual(['a-fixed.jpg']);
    expect((await finishPending(d.destination, again)).cancelled).toBe(true);
  });
});
