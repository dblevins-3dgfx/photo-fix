import { describe, expect, it } from 'vitest';
import { keyAction } from './keyboard';

describe('Keyboard', () => {
  it('Ctrl+O opens, Ctrl+S saves', () => {
    expect(keyAction({ key: 'o', ctrlKey: true })).toBe('open');
    expect(keyAction({ key: 'S', ctrlKey: true })).toBe('save');
    expect(keyAction({ key: 's', metaKey: true, inControl: true })).toBe('save');
    expect(keyAction({ key: 'p', ctrlKey: true })).toBeNull();
  });
  it('arrows move between photos, brackets rotate, W arms, Escape disarms, backslash compares', () => {
    expect(keyAction({ key: 'ArrowLeft' })).toBe('previous');
    expect(keyAction({ key: 'ArrowRight' })).toBe('next');
    expect(keyAction({ key: '[' })).toBe('rotate-left');
    expect(keyAction({ key: ']' })).toBe('rotate-right');
    expect(keyAction({ key: 'w' })).toBe('eyedropper');
    expect(keyAction({ key: 'W' })).toBe('eyedropper');
    expect(keyAction({ key: 'Escape' })).toBe('disarm');
    expect(keyAction({ key: '\\' })).toBe('compare');
  });
  it('keys typed into a control are not shortcuts, but Escape still disarms', () => {
    expect(keyAction({ key: 'ArrowLeft', inControl: true })).toBeNull();
    expect(keyAction({ key: 'w', inControl: true })).toBeNull();
    expect(keyAction({ key: 'Escape', inControl: true })).toBe('disarm');
  });
});
