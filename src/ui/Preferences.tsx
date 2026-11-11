import { useEffect } from 'react';
import { useModal } from '../hooks/useShortcut';
import { PREFERENCES, type Prefs } from '../lib/prefs';
import Slider from './Slider';

// The Preferences dialog (SPEC.md section 8). While it is open no key is a
// shortcut, so Escape only closes it.
export default function Preferences({ prefs, onChange, onClose }: {
  prefs: Prefs;
  onChange: (p: Prefs) => void;
  onClose: () => void;
}) {
  useModal();
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
        {PREFERENCES.map((p) => (p.kind === 'slider' ? (
          <Slider
            key={p.key} label={p.label} value={prefs[p.key]} min={p.min} max={p.max}
            onChange={(v) => onChange({ ...prefs, [p.key]: v })}
          />
        ) : (
          <label key={p.key} className="flex items-center justify-between gap-4">
            <span>{p.label}</span>
            <input
              type="checkbox"
              checked={prefs[p.key]}
              onChange={(e) => onChange({ ...prefs, [p.key]: e.target.checked })}
              className="h-5 w-5 accent-sky-600"
            />
          </label>
        )))}
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
