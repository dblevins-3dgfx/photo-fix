// A field: one switch or slider, as an entry in a table. The per-photo
// adjustments (adjustments.ts) and the preferences (prefs.ts) are each a
// table of fields, from which their defaults, their checks and their
// controls on the screen are built.

export interface SwitchField<K extends string = string> {
  key: K;
  label: string;
  kind: 'switch';
  default: boolean;
}

export interface SliderField<K extends string = string> {
  key: K;
  label: string;
  kind: 'slider';
  // Whole numbers from min to max
  min: number;
  max: number;
  default: number;
  // Shown after the value ("%")
  unit?: string;
}

export type Field<K extends string = string> = SwitchField<K> | SliderField<K>;

// `raw` if it is a value the field can hold: a boolean for a switch, a
// whole number within its range for a slider. Otherwise undefined.
export function fieldValue(field: Field, raw: unknown): boolean | number | undefined {
  if (field.kind === 'switch') return typeof raw === 'boolean' ? raw : undefined;
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= field.min && raw <= field.max ? raw : undefined;
}

// Each field's default, by key
export function fieldDefaults(fields: readonly Field[]): Record<string, boolean | number> {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]));
}

// The fields of an object read from outside (storage, a file), each checked
// with fieldValue and falling back to its default on its own; anything
// else in `raw` is ignored
export function readFields(fields: readonly Field[], raw: unknown): Record<string, boolean | number> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(fields.map((f) => [f.key, fieldValue(f, o[f.key]) ?? f.default]));
}
