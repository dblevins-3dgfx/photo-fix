import { describe, expect, it } from 'vitest';
import { NOT_COMPARING, compareWith, isComparing, type Comparing, type CompareSource } from './compare';

// The sources held after each step, in order
const after = (steps: [CompareSource, boolean][]) =>
  steps.reduce<Comparing>((c, [source, on]) => compareWith(c, source, on), NOT_COMPARING);

describe('Compare', () => {
  it('is off to start', () => {
    expect(isComparing(NOT_COMPARING)).toBe(false);
  });

  it('is on while one source is held, and off when it is let go of', () => {
    expect(isComparing(after([['key', true]]))).toBe(true);
    expect(isComparing(after([['key', true], ['key', false]]))).toBe(false);
  });

  it('stays on while another source is still held', () => {
    expect(isComparing(after([['key', true], ['button', true], ['button', false]]))).toBe(true);
    expect(isComparing(after([['photo', true], ['key', true], ['photo', false], ['key', false]]))).toBe(false);
  });

  it('letting go of a source not held changes nothing', () => {
    expect(isComparing(after([['key', true], ['button', false]]))).toBe(true);
    expect(after([['button', false]])).toBe(NOT_COMPARING);
  });

  it('gives back the same set when nothing changes, as for a repeated key', () => {
    const held = after([['key', true]]);
    expect(compareWith(held, 'key', true)).toBe(held);
  });
});
