import { Copy, Pipette, RotateCcw, RotateCw, Save, SaveAll, SplitSquareHorizontal, Undo2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { adjustmentsIn, type Adjustment, type Adjustments } from '../lib/adjustments';
import type { Settings } from '../lib/settings';
import Slider from './Slider';

// The control for one adjustment: a switch or a slider, from its entry in
// the table. Double-tapping a slider's label puts it back to its default.
function AdjustmentControl({ adjustment: a, settings, onChange }: {
  adjustment: Adjustment; settings: Settings; onChange: (s: Partial<Adjustments>) => void;
}) {
  if (a.onlyWithAuto && !settings.auto) return null;
  if (a.kind === 'slider') {
    return (
      <Slider label={a.label} value={settings[a.key] as number} min={a.min} max={a.max} reset={a.default} unit={a.unit}
        onChange={(v) => onChange({ [a.key]: v })} />
    );
  }
  return (
    <label className={`flex items-center justify-between ${a.onlyWithAuto ? 'text-sm' : ''}`}>
      <span className={a.onlyWithAuto ? undefined : 'font-medium'} title={a.hint}>{a.label}</span>
      <input
        type="checkbox" role="switch" checked={settings[a.key] as boolean}
        onChange={(e) => onChange({ [a.key]: e.target.checked })}
        className="h-5 w-5 accent-sky-600"
      />
    </label>
  );
}

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
  // The switches and sliders only: the White point and the Rotation have their own
  onChange: (s: Partial<Adjustments>) => void;
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
        {adjustmentsIn('auto').map((a) => (
          <AdjustmentControl key={a.key} adjustment={a} settings={settings} onChange={onChange} />
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Button onClick={onArm} active={armed} title="Tap something that should be white or gray (W)">
          <Pipette size={16} />White point
        </Button>
        {settings.whitePoint && <Button onClick={onClearWhitePoint}><X size={16} />Clear</Button>}
      </section>

      <section className="space-y-3">
        {adjustmentsIn('tone').map((a) => (
          <AdjustmentControl key={a.key} adjustment={a} settings={settings} onChange={onChange} />
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
