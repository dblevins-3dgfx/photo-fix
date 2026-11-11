// Compare (SPEC.md section 5): the photo shown without corrections while
// any of three things is held, the photo itself, the Compare button and
// the backslash key. Each is let go of on its own, so releasing one
// leaves the photo uncompared only when nothing else is still held.

export type CompareSource = 'photo' | 'button' | 'key';
export type Comparing = ReadonlySet<CompareSource>;

export const NOT_COMPARING: Comparing = new Set();

// `source` held (on) or let go of (off); the same set when nothing changes,
// so React doesn't redraw for a repeated key
export function compareWith(c: Comparing, source: CompareSource, on: boolean): Comparing {
  if (c.has(source) === on) return c;
  const next = new Set(c);
  if (on) next.add(source);
  else next.delete(source);
  return next;
}

export const isComparing = (c: Comparing) => c.size > 0;
