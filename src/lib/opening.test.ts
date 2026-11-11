import { describe, expect, it } from 'vitest';
import { NOT_OPENING, isOpening, openingText, queued, serialQueue, stepped } from './opening';

describe('Opening progress', () => {
  it('says nothing while nothing is opening', () => {
    expect(isOpening(NOT_OPENING)).toBe(false);
    expect(openingText(NOT_OPENING)).toBeNull();
  });

  it('counts the photo being decoded, of all queued', () => {
    let p = queued(NOT_OPENING, 3);
    expect(openingText(p)).toBe('Opening 1 of 3');
    p = stepped(p);
    expect(openingText(p)).toBe('Opening 2 of 3');
  });

  it('says just "Opening" for one photo', () => {
    expect(openingText(queued(NOT_OPENING, 1))).toBe('Opening');
  });

  it('a second open while the first runs adds to the count', () => {
    let p = stepped(queued(NOT_OPENING, 3));
    p = queued(p, 2);
    expect(openingText(p)).toBe('Opening 2 of 5');
  });

  it('ends after the last file, decoded or skipped, and starts counting afresh', () => {
    let p = queued(NOT_OPENING, 2);
    p = stepped(stepped(p));
    expect(p).toEqual(NOT_OPENING);
    expect(openingText(queued(p, 4))).toBe('Opening 1 of 4');
  });
});

describe('serialQueue', () => {
  // A task that finishes when told to, noting when it starts and ends
  const gate = () => {
    let open!: () => void;
    const shut = new Promise<void>((r) => { open = r; });
    return { shut, open };
  };

  it('a later open waits for the earlier one, so its photos come after', async () => {
    const inTurn = serialQueue();
    const log: string[] = [];
    const first = gate();
    const a = inTurn(async () => { log.push('a starts'); await first.shut; log.push('a adds 1, 2'); });
    const b = inTurn(async () => { log.push('b starts'); log.push('b adds 3'); });
    await Promise.resolve();
    expect(log).toEqual(['a starts']);
    first.open();
    await Promise.all([a, b]);
    expect(log).toEqual(['a starts', 'a adds 1, 2', 'b starts', 'b adds 3']);
  });

  it('one that fails doesn\'t stop the next, and each gets its own result', async () => {
    const inTurn = serialQueue();
    const bad = inTurn(async () => { throw new Error('no'); });
    const good = inTurn(async () => 7);
    await expect(bad).rejects.toThrow('no');
    await expect(good).resolves.toBe(7);
  });
});
