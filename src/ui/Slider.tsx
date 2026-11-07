import { useRef } from 'react';

// A labelled slider. Double-tapping (or double-clicking) the label puts it
// back to `reset` (SPEC.md section 4, Sliders).
export default function Slider({ label, value, min, max, reset, unit = '', onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  reset?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const lastTap = useRef(0);
  const tapLabel = () => {
    const now = Date.now();
    if (reset !== undefined && now - lastTap.current < 400) onChange(reset);
    lastTap.current = now;
  };
  return (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span onPointerUp={tapLabel} className="cursor-default" title={reset !== undefined ? 'Double-tap to reset' : undefined}>
          {label}
        </span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">{value}{unit}</span>
      </span>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-600"
      />
    </label>
  );
}
