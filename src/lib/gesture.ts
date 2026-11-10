// What a touch or a mouse press on the photo means (SPEC.md section 5,
// Compare and Zoom and pan): a tap, a double-tap, a hold, a drag or a
// pinch. A plain function: the photo area feeds it each pointer event and
// acts on what comes back. It keeps no clock and no timer of its own: the
// caller passes the time with a lift, and runs the hold timer when asked.

// Pressing and holding still this long is a hold
export const HOLD_MS = 350;
// A second tap within this long is a double-tap
export const DOUBLE_TAP_MS = 300;
// A press that moves no further than this is a tap or a hold, not a drag
export const SLOP = 8;

export interface Point {
  x: number;
  y: number;
}

export type GestureEvent =
  | { type: 'down'; id: number; x: number; y: number }
  | { type: 'move'; id: number; x: number; y: number }
  // `doubleTaps`: whether taps count toward a double-tap just now (not
  // while a tap has a job of its own, as with the eyedropper armed)
  | { type: 'up'; id: number; x: number; y: number; time: number; doubleTaps: boolean }
  | { type: 'cancel'; id: number }
  // The hold timer ran out
  | { type: 'hold' };

export type GestureAction =
  // Start the hold timer (HOLD_MS, then a 'hold' event), or stop it
  | { type: 'start-hold-timer' }
  | { type: 'cancel-hold-timer' }
  | { type: 'hold-start' }
  | { type: 'hold-end' }
  // One pointer moved by (dx, dy) since its last move
  | { type: 'drag'; dx: number; dy: number }
  // A second pointer came down. Each 'pinch' after it is measured from here:
  // the pointers are `scale` times as far apart, and the point between
  // them, first at (x, y), has moved by (dx, dy).
  | { type: 'pinch-start' }
  | { type: 'pinch'; scale: number; x: number; y: number; dx: number; dy: number }
  | { type: 'tap'; x: number; y: number }
  | { type: 'double-tap'; x: number; y: number };

interface Press {
  // 'one' pointer down; two in a 'pinch'; 'done' when a pinch has ended
  // and a pointer is still down, which does nothing until it lifts too
  mode: 'one' | 'pinch' | 'done';
  start: Point;
  last: Point;
  moved: boolean;
  held: boolean;
  // The pinch's first distance and midpoint
  pinch?: { distance: number; mid: Point };
}

export interface GestureState {
  pointers: ReadonlyMap<number, Point>;
  press: Press | null;
  // When the last tap that could start a double-tap was, or 0
  lastTap: number;
}

export const NO_GESTURE: GestureState = { pointers: new Map(), press: null, lastTap: 0 };

function span(pointers: ReadonlyMap<number, Point>) {
  const [a, b] = [...pointers.values()];
  return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}

// Stops the hold timer, and ends the hold if there was one
const endHold = (press: Press | null): GestureAction[] =>
  press ? [{ type: 'cancel-hold-timer' }, ...(press.held ? [{ type: 'hold-end' } as const] : [])] : [];

export function gestureStep(state: GestureState, event: GestureEvent): { state: GestureState; actions: GestureAction[] } {
  const { press, lastTap } = state;
  const pointers = new Map(state.pointers);
  const next = (p: Press | null, tap = lastTap) => ({ pointers, press: p, lastTap: tap });

  switch (event.type) {
    case 'down': {
      const p = { x: event.x, y: event.y };
      pointers.set(event.id, p);
      if (pointers.size === 1) {
        return {
          state: next({ mode: 'one', start: p, last: p, moved: false, held: false }),
          actions: [{ type: 'start-hold-timer' }],
        };
      }
      if (pointers.size === 2) {
        // A second pointer: a pinch, never a tap or a hold
        const s = span(pointers);
        return {
          state: next({ mode: 'pinch', start: s.mid, last: s.mid, moved: true, held: false, pinch: s }),
          actions: [...endHold(press), { type: 'pinch-start' }],
        };
      }
      return { state: next(press), actions: [] };
    }

    case 'move': {
      if (!pointers.has(event.id)) return { state, actions: [] };
      const p = { x: event.x, y: event.y };
      pointers.set(event.id, p);
      if (!press) return { state: next(null), actions: [] };
      if (press.mode === 'one') {
        const actions: GestureAction[] = [];
        let moved = press.moved;
        if (!moved && Math.hypot(p.x - press.start.x, p.y - press.start.y) > SLOP) {
          moved = true;
          // Too far to become a hold; one already begun carries on
          if (!press.held) actions.push({ type: 'cancel-hold-timer' });
        }
        if (moved && !press.held) actions.push({ type: 'drag', dx: p.x - press.last.x, dy: p.y - press.last.y });
        return { state: next({ ...press, moved, last: p }), actions };
      }
      if (press.mode === 'pinch' && press.pinch && pointers.size === 2) {
        const s = span(pointers);
        const from = press.pinch;
        return {
          state: next(press),
          actions: [{
            type: 'pinch', scale: s.distance / from.distance, x: from.mid.x, y: from.mid.y,
            dx: s.mid.x - from.mid.x, dy: s.mid.y - from.mid.y,
          }],
        };
      }
      return { state: next(press), actions: [] };
    }

    case 'up': {
      pointers.delete(event.id);
      if (!press) return { state: next(null), actions: [] };
      if (press.mode === 'one' && pointers.size === 0) {
        const actions = endHold(press);
        // The end of a hold or a drag is not a tap
        if (press.held || press.moved) return { state: next(null), actions };
        const at = { x: event.x, y: event.y };
        if (!event.doubleTaps) return { state: next(null), actions: [...actions, { type: 'tap', ...at }] };
        if (event.time - lastTap < DOUBLE_TAP_MS) {
          return { state: next(null, 0), actions: [...actions, { type: 'double-tap', ...at }] };
        }
        return { state: next(null, event.time), actions };
      }
      if (pointers.size === 0) return { state: next(null), actions: [] };
      return { state: next({ ...press, mode: 'done' }), actions: [] };
    }

    case 'cancel': {
      pointers.delete(event.id);
      const actions = endHold(press);
      if (pointers.size === 0) return { state: next(null), actions };
      return { state: next(press && { ...press, held: false }), actions };
    }

    case 'hold': {
      if (press?.mode !== 'one' || press.moved || press.held) return { state, actions: [] };
      return { state: next({ ...press, held: true }), actions: [{ type: 'hold-start' }] };
    }
  }
}
