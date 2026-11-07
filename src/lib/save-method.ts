// Where a save goes (SPEC.md section 7, Where it goes): the first of the
// Save dialog, the share sheet and a download that the browser can do.

export type SaveMethod = 'dialog' | 'share' | 'download';

export interface SaveAbilities {
  // window.showSaveFilePicker (Save) and window.showDirectoryPicker (Save all)
  saveFilePicker: boolean;
  directoryPicker: boolean;
  // navigator.canShare({ files }) for a JPEG
  shareFiles: boolean;
}

export function saveMethod(can: SaveAbilities, all: boolean): SaveMethod {
  if (all ? can.directoryPicker : can.saveFilePicker) return 'dialog';
  if (can.shareFiles) return 'share';
  return 'download';
}
