import { useEffect } from 'react';
import { MAX_QUALITY, MIN_QUALITY, type Prefs } from '../lib/prefs';
import Slider from './Slider';

// The Preferences dialog (SPEC.md section 8)
export default function Preferences({ prefs, onChange, onClose }: {
  prefs: Prefs;
  onChange: (p: Prefs) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Preferences"
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Preferences</h2>
        <label className="flex items-center justify-between gap-4">
          <span>Auto on for new photos</span>
          <input
            type="checkbox"
            checked={prefs.autoOnNewPhotos}
            onChange={(e) => onChange({ ...prefs, autoOnNewPhotos: e.target.checked })}
            className="h-5 w-5 accent-sky-600"
          />
        </label>
        <Slider
          label="JPEG quality" value={prefs.jpegQuality} min={MIN_QUALITY} max={MAX_QUALITY}
          onChange={(q) => onChange({ ...prefs, jpegQuality: q })}
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Photos never leave this device. Only these two preferences are kept.
        </p>
        <div className="text-right">
          <button type="button" onClick={onClose} className="rounded-lg bg-sky-600 px-4 py-2 text-white">Done</button>
        </div>
      </div>
    </div>
  );
}
