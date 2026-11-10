import { describe, expect, it } from 'vitest';
import { fieldDefaults, fieldValue, readFields, type Field } from './fields';

const on: Field = { key: 'on', label: 'On', kind: 'switch', default: true };
const level: Field = { key: 'level', label: 'Level', kind: 'slider', min: -10, max: 10, default: 3 };

describe('A field', () => {
  it('a switch holds a boolean and nothing else', () => {
    expect(fieldValue(on, false)).toBe(false);
    expect(fieldValue(on, 1)).toBeUndefined();
    expect(fieldValue(on, 'true')).toBeUndefined();
  });
  it('a slider holds a whole number within its range', () => {
    expect(fieldValue(level, -10)).toBe(-10);
    expect(fieldValue(level, 10)).toBe(10);
    expect(fieldValue(level, 11)).toBeUndefined();
    expect(fieldValue(level, 2.5)).toBeUndefined();
    expect(fieldValue(level, '2')).toBeUndefined();
    expect(fieldValue(level, NaN)).toBeUndefined();
  });
  it('defaults come from the table', () => {
    expect(fieldDefaults([on, level])).toEqual({ on: true, level: 3 });
  });
  it('reading falls back field by field and ignores anything else', () => {
    expect(readFields([on, level], { on: false, level: 99, other: 1 })).toEqual({ on: false, level: 3 });
    expect(readFields([on, level], null)).toEqual({ on: true, level: 3 });
    expect(readFields([on, level], 'text')).toEqual({ on: true, level: 3 });
  });
});
