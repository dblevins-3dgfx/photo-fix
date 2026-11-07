import { describe, expect, it } from 'vitest';
import { fixedName, freeName } from './filename';

describe('File name', () => {
  it('replaces the extension with -fixed.jpg', () => {
    expect(fixedName('Grandma 1962.png')).toBe('Grandma 1962-fixed.jpg');
    expect(fixedName('scan.final.jpeg')).toBe('scan.final-fixed.jpg');
  });
  it('a name with no extension just gets -fixed.jpg', () => {
    expect(fixedName('Grandma')).toBe('Grandma-fixed.jpg');
    expect(fixedName('.scan')).toBe('.scan-fixed.jpg');
  });
  it('a photo fixed before gets -fixed (2), then (3), never -fixed twice', () => {
    expect(fixedName('Grandma 1962-fixed.jpg')).toBe('Grandma 1962-fixed (2).jpg');
    expect(fixedName('Grandma 1962-fixed (2).jpg')).toBe('Grandma 1962-fixed (3).jpg');
    expect(fixedName('Grandma 1962-fixed (9).png')).toBe('Grandma 1962-fixed (10).jpg');
  });
  it('matches the ending ignoring case and keeps the rest as it was', () => {
    expect(fixedName('Dad-FIXED.JPG')).toBe('Dad-FIXED (2).jpg');
    expect(fixedName('fixed-up.jpg')).toBe('fixed-up-fixed.jpg');
    expect(fixedName('prefixed.jpg')).toBe('prefixed-fixed.jpg');
  });
});

describe('A name already in the folder', () => {
  it('raises the number until the name is free, ignoring case', () => {
    expect(freeName('a-fixed.jpg', [])).toBe('a-fixed.jpg');
    expect(freeName('a-fixed.jpg', ['A-Fixed.jpg'])).toBe('a-fixed (2).jpg');
    expect(freeName('a-fixed.jpg', ['a-fixed.jpg', 'a-fixed (2).jpg'])).toBe('a-fixed (3).jpg');
  });
});
