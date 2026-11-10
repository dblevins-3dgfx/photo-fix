import { describe, expect, it } from 'vitest';
import { SHORTCUTS, keyAction, type KeyAction } from './keyboard';

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
  it('+ (or =), - and 0 zoom in, out and to Fit', () => {
    expect(keyAction({ key: '+' })).toBe('zoom-in');
    expect(keyAction({ key: '=' })).toBe('zoom-in');
    expect(keyAction({ key: '-' })).toBe('zoom-out');
    expect(keyAction({ key: '0' })).toBe('zoom-fit');
    expect(keyAction({ key: '0', inControl: true })).toBeNull();
    expect(keyAction({ key: '+', ctrlKey: true })).toBeNull();
  });
  it('keys typed into a control are not shortcuts, but Escape still disarms', () => {
    expect(keyAction({ key: 'ArrowLeft', inControl: true })).toBeNull();
    expect(keyAction({ key: 'w', inControl: true })).toBeNull();
    expect(keyAction({ key: 'Escape', inControl: true })).toBe('disarm');
  });
});

describe('The shortcut tables', () => {
  it('reach every action', () => {
    const all: KeyAction[] = [
      'open', 'save', 'previous', 'next', 'rotate-left', 'rotate-right', 'eyedropper', 'disarm', 'compare',
      'zoom-in', 'zoom-out', 'zoom-fit',
    ];
    const reached = new Set([...Object.values(SHORTCUTS.withCtrl), ...Object.values(SHORTCUTS.alone)]);
    expect([...reached].sort()).toEqual([...all].sort());
  });
  it('a name the browser gives that is not a key in the tables does nothing', () => {
    expect(keyAction({ key: 'toString' })).toBeNull();
    expect(keyAction({ key: 'constructor', ctrlKey: true })).toBeNull();
    expect(keyAction({ key: 'Shift' })).toBeNull();
  });
});
