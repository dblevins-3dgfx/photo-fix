// The parts of the File System Access API (Chrome) that saving uses, which
// TypeScript's DOM types don't include yet
interface SaveFilePickerOptions {
  suggestedName?: string;
  id?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
}
interface FileSystemDirectoryHandle {
  keys(): AsyncIterableIterator<string>;
}
interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}
