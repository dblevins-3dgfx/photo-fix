import { describe, expect, it } from 'vitest';
import { saveMethod } from './save-method';

describe('Where a save goes', () => {
  const chromebook = { saveFilePicker: true, directoryPicker: true, shareFiles: false };
  const iphone = { saveFilePicker: false, directoryPicker: false, shareFiles: true };
  const other = { saveFilePicker: false, directoryPicker: false, shareFiles: false };
  it('the Save dialog first, where the browser has it', () => {
    expect(saveMethod(chromebook, false)).toBe('dialog');
    expect(saveMethod(chromebook, true)).toBe('dialog');
    expect(saveMethod({ ...chromebook, shareFiles: true }, false)).toBe('dialog');
  });
  it('then the share sheet', () => {
    expect(saveMethod(iphone, false)).toBe('share');
    expect(saveMethod(iphone, true)).toBe('share');
  });
  it('then a download', () => {
    expect(saveMethod(other, false)).toBe('download');
    expect(saveMethod(other, true)).toBe('download');
  });
  it('Save all needs the folder picker for the dialog', () => {
    expect(saveMethod({ ...other, saveFilePicker: true }, true)).toBe('download');
  });
});
