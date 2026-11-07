// The saved file's name (SPEC.md section 7, File name): `-fixed.jpg`, or
// `-fixed (n).jpg` for a photo fixed before, so `-fixed` is never added
// twice; and the next free name in a folder for Save all.

const FIXED = /^(.*)(-fixed)(?: \((\d+)\))?$/i;

// The name without its extension (a name with no extension, or only a
// leading dot, is used whole)
export function stem(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export function fixedName(name: string) {
  const base = stem(name);
  const m = FIXED.exec(base);
  if (!m) return `${base}-fixed.jpg`;
  const n = m[3] ? Number(m[3]) : 1;
  return `${m[1]}${m[2]} (${n + 1}).jpg`;
}

// `name`, or with its number raised until no name in `taken` matches it
// (ignoring case)
export function freeName(name: string, taken: Iterable<string>) {
  const used = new Set([...taken].map((t) => t.toLowerCase()));
  let candidate = name;
  while (used.has(candidate.toLowerCase())) candidate = fixedName(candidate);
  return candidate;
}
