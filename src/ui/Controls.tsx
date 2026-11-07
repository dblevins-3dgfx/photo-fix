import { Copy, Pipette, RotateCcw, RotateCw, Save, SaveAll, SplitSquareHorizontal, Undo2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Settings, Slider as SliderName } from '../lib/settings';
import Slider from './Slider';

const SLIDER_LABELS: [SliderName, string][] = [
  ['warmth', 'Warmth'], ['tint', 'Tint'], ['brightness', 'Brightness'], ['contrast', 'Contrast'], ['saturation', 'Saturation'],
];

function Button({ onClick, children, active = false, disabled = false, title }: {
  onClick?: () => void; children: ReactNode; active?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 ${
        active ? 'bg-sky-600 text-white' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'}`}
    >
      {children}
    </button>
  );
}

// The controls (SPEC.md section 5, Controls)
export default function Controls({
  settings, armed, several, saving, onChange, onArm, onClearWhitePoint, onRotate, onReset, onApplyToAll,
  onCompare, onSave, onSaveAll, className = '',
}: {
  settings: Settings;
  armed: boolean;
  several: boolean;
  saving: boolean;
  onChange: (s: Partial<Settings>) => void;
  onArm: () => void;
  onClearWhitePoint: () => void;
  onRotate: (dir: 1 | -1) => void;
  onReset: () => void;
  onApplyToAll: () => void;
  onCompare: (on: boolean) => void;
  onSave: () => void;
  onSaveAll: () => void;
  className?: string;
}) {
  return (
    <div className={`space-y-4 p-4 ${className}`}>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onSave} disabled={saving}><Save size={16} />Save</Button>
        {several && <Button onClick={onSaveAll} disabled={saving}><SaveAll size={16} />Save all</Button>}
      </div>

      <section className="space-y-2">
        <label className="flex items-center justify-between">
          <span className="font-medium">Auto</span>
          <input
            type="checkbox" role="switch" checked={settings.auto}
            onChange={(e) => onChange({ auto: e.target.checked })}
            className="h-5 w-5 accent-sky-600"
          />
        </label>
        {settings.auto && (
          <Slider label="Strength" value={settings.strength} min={0} max={100} reset={100} unit="%"
            onChange={(v) => onChange({ strength: v })} />
        )}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Button onClick={onArm} active={armed} title="Tap something that should be white or gray (W)">
          <Pipette size={16} />White point
        </Button>
        {settings.whitePoint && <Button onClick={onClearWhitePoint}><X size={16} />Clear</Button>}
      </section>

      <section className="space-y-3">
        {SLIDER_LABELS.map(([key, label]) => (
          <Slider key={key} label={label} value={settings[key]} min={-100} max={100} reset={0}
            onChange={(v) => onChange({ [key]: v })} />
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        <Button onClick={() => onRotate(-1)} title="Rotate left ([)"><RotateCcw size={16} />Left</Button>
        <Button onClick={() => onRotate(1)} title="Rotate right (])"><RotateCw size={16} />Right</Button>
        <button
          type="button"
          title="Hold to see the photo without corrections (\)"
          onPointerDown={() => onCompare(true)}
          onPointerUp={() => onCompare(false)}
          onPointerLeave={() => onCompare(false)}
          onPointerCancel={() => onCompare(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium dark:bg-slate-700"
        >
          <SplitSquareHorizontal size={16} />Compare
        </button>
      </section>

      <section className="flex flex-wrap gap-2">
        <Button onClick={onReset}><Undo2 size={16} />Reset</Button>
        {several && <Button onClick={onApplyToAll}><Copy size={16} />Apply to all</Button>}
      </section>
    </div>
  );
}
