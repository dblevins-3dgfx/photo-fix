import { describe, expect, it } from 'vitest';
import { EYEDROPPER, TOO_DARK, readyToShare, saveFailed, saveResult, saved, savedSmaller, saving, unsupported } from './messages';

describe('Status line', () => {
  it('the eyedropper', () => {
    expect(EYEDROPPER).toBe('Tap something that should be white or gray');
    expect(TOO_DARK).toBe('Too dark to judge. Pick something lighter');
  });
  it('a file that could not be opened is named, with JPEG or PNG suggested', () => {
    expect(unsupported(['a.tif'])).toBe("a.tif couldn't be opened: its format isn't supported. Try JPEG or PNG instead.");
    expect(unsupported(['a.tif', 'b.heic'])).toMatch(/^2 files couldn't be opened \(a\.tif, b\.heic\)/);
  });
  it('progress', () => {
    expect(saving(2, 5)).toBe('Saving 2 of 5');
    expect(saving(1, 1)).toBe('Saving');
  });
  it('a photo saved smaller than the scan says so', () => {
    expect(savedSmaller(4000, 4194, 4800, 5033)).toBe(
      'Saved at 4000 x 4194, smaller than the 4800 x 5033 scan, the most this device can save');
  });
  it('saved and failed name the files', () => {
    expect(saved(['a-fixed.jpg'])).toBe('Saved a-fixed.jpg');
    expect(saved(['a', 'b'])).toBe('Saved 2 photos');
    expect(saveFailed(['a-fixed.jpg'])).toBe("Couldn't save a-fixed.jpg");
  });
});

describe('After a save', () => {
  const smaller = (name: string) => ({ name, width: 4000, height: 4194, origWidth: 4800, origHeight: 5033 });
  it('names what was saved', () => {
    expect(saveResult({ saved: ['a-fixed.jpg'], failed: [], smaller: [] })).toBe('Saved a-fixed.jpg');
  });
  it('says a photo was saved smaller than the scan', () => {
    expect(saveResult({ saved: ['a-fixed.jpg'], failed: [], smaller: [smaller('a-fixed.jpg')] })).toBe(
      'Saved at 4000 x 4194, smaller than the 4800 x 5033 scan, the most this device can save');
    expect(saveResult({ saved: ['a', 'b', 'c'], failed: [], smaller: [smaller('b'), smaller('c')] })).toBe(
      'Saved 3 photos. 2 were saved smaller than their scans, the most this device can save');
  });
  it('names a file that failed; the others still save', () => {
    expect(saveResult({ saved: ['a', 'b'], failed: ['c'], smaller: [] })).toBe("Couldn't save c. Saved 2 photos");
  });
  it('says nothing when nothing happened', () => {
    expect(saveResult({ saved: [], failed: [], smaller: [] })).toBeNull();
  });
});

describe('When Safari wants another tap', () => {
  it('asks for a tap on Share', () => {
    expect(readyToShare(1)).toBe('Ready to save. Tap Share');
    expect(readyToShare(3)).toBe('3 photos ready to save. Tap Share');
  });
});
