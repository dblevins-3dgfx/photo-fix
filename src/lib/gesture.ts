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

type Step = { state: GestureState; actions: GestureAction[] };
type EventOf<T extends GestureEvent['type']> = Extract<GestureEvent, { type: T }>;

// The state with `pointers` and `press` changed (and `lastTap`, if given)
const withPress = (state: GestureState, pointers: Map<number, Point>, press: Press | null, lastTap = state.lastTap) =>
  ({ pointers, press, lastTap });

// A pointer comes down: the first starts a press (and the hold timer), the
// second starts a pinch, never a tap or a hold; a third changes nothing
function onDown(state: GestureState, e: EventOf<'down'>): Step {
  const pointers = new Map(state.pointers).set(e.id, { x: e.x, y: e.y });
  if (pointers.size === 1) {
    const p = { x: e.x, y: e.y };
    return {
      state: withPress(state, pointers, { mode: 'one', start: p, last: p, moved: false, held: false }),
      actions: [{ type: 'start-hold-timer' }],
    };
  }
  if (pointers.size > 2) return { state: withPress(state, pointers, state.press), actions: [] };
  const s = span(pointers);
  return {
    state: withPress(state, pointers, { mode: 'pinch', start: s.mid, last: s.mid, moved: true, held: false, pinch: s }),
    actions: [...endHold(state.press), { type: 'pinch-start' }],
  };
}

// One pointer moves: past SLOP it is a drag (stopping the hold timer); a
// hold already begun carries on without panning
function moveOne(press: Press, p: Point): { press: Press; actions: GestureAction[] } {
  const actions: GestureAction[] = [];
  const moved = press.moved || Math.hypot(p.x - press.start.x, p.y - press.start.y) > SLOP;
  if (moved && !press.moved && !press.held) actions.push({ type: 'cancel-hold-timer' });
  if (moved && !press.held) actions.push({ type: 'drag', dx: p.x - press.last.x, dy: p.y - press.last.y });
  return { press: { ...press, moved, last: p }, actions };
}

// Two pointers move: how far apart they are and how far their midpoint
// moved, both from the start of the pinch
function movePinch(pinch: NonNullable<Press['pinch']>, pointers: ReadonlyMap<number, Point>): GestureAction {
  const s = span(pointers);
  return {
    type: 'pinch', scale: s.distance / pinch.distance, x: pinch.mid.x, y: pinch.mid.y,
    dx: s.mid.x - pinch.mid.x, dy: s.mid.y - pinch.mid.y,
  };
}

function onMove(state: GestureState, e: EventOf<'move'>): Step {
  if (!state.pointers.has(e.id)) return { state, actions: [] };
  const pointers = new Map(state.pointers).set(e.id, { x: e.x, y: e.y });
  const { press } = state;
  if (press?.mode === 'one') {
    const r = moveOne(press, { x: e.x, y: e.y });
    return { state: withPress(state, pointers, r.press), actions: r.actions };
  }
  const pinching = press?.mode === 'pinch' && press.pinch && pointers.size === 2;
  return { state: withPress(state, pointers, press), actions: pinching ? [movePinch(press.pinch!, pointers)] : [] };
}

// A still press lifts: a tap, or, when taps count toward one, a double-tap
// if the last tap was within DOUBLE_TAP_MS (the first does nothing)
function liftStill(state: GestureState, pointers: Map<number, Point>, e: EventOf<'up'>): Step {
  const actions = endHold(state.press);
  const at = { x: e.x, y: e.y };
  if (!e.doubleTaps) return { state: withPress(state, pointers, null), actions: [...actions, { type: 'tap', ...at }] };
  if (e.time - state.lastTap < DOUBLE_TAP_MS) {
    return { state: withPress(state, pointers, null, 0), actions: [...actions, { type: 'double-tap', ...at }] };
  }
  return { state: withPress(state, pointers, null, e.time), actions };
}

function onUp(state: GestureState, e: EventOf<'up'>): Step {
  const pointers = new Map(state.pointers);
  pointers.delete(e.id);
  const { press } = state;
  if (!press) return { state: withPress(state, pointers, null), actions: [] };
  if (press.mode === 'one' && pointers.size === 0) {
    // The end of a hold or a drag is not a tap
    if (press.held || press.moved) return { state: withPress(state, pointers, null), actions: endHold(press) };
    return liftStill(state, pointers, e);
  }
  // After a pinch: done when the last pointer lifts; until then, the one
  // left does nothing
  return { state: withPress(state, pointers, pointers.size === 0 ? null : { ...press, mode: 'done' }), actions: [] };
}

function onCancel(state: GestureState, e: EventOf<'cancel'>): Step {
  const pointers = new Map(state.pointers);
  pointers.delete(e.id);
  const press = pointers.size === 0 ? null : state.press && { ...state.press, held: false };
  return { state: withPress(state, pointers, press), actions: endHold(state.press) };
}

// The hold timer ran out: a hold, if the press is still and one pointer
function onHold(state: GestureState): Step {
  const { press } = state;
  if (press?.mode !== 'one' || press.moved || press.held) return { state, actions: [] };
  return { state: { ...state, press: { ...press, held: true } }, actions: [{ type: 'hold-start' }] };
}

const STEPS: { [T in GestureEvent['type']]: (state: GestureState, e: EventOf<T>) => Step } = {
  down: onDown,
  move: onMove,
  up: onUp,
  cancel: onCancel,
  hold: onHold,
};

export function gestureStep(state: GestureState, event: GestureEvent): Step {
  return (STEPS[event.type] as (state: GestureState, e: GestureEvent) => Step)(state, event);
}
