import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, NO_GESTURE, SLOP, gestureStep, type GestureAction, type GestureEvent, type GestureState } from './gesture';

// Feeds events in turn, collecting what comes back
function play(events: GestureEvent[], from: GestureState = NO_GESTURE) {
  let state = from;
  const actions: GestureAction[] = [];
  for (const e of events) {
    const r = gestureStep(state, e);
    state = r.state;
    actions.push(...r.actions);
  }
  return { state, actions, types: actions.map((a) => a.type) };
}

const down = (id: number, x: number, y: number): GestureEvent => ({ type: 'down', id, x, y });
const move = (id: number, x: number, y: number): GestureEvent => ({ type: 'move', id, x, y });
const up = (id: number, x: number, y: number, time = 1000, doubleTaps = true): GestureEvent =>
  ({ type: 'up', id, x, y, time, doubleTaps });
const hold: GestureEvent = { type: 'hold' };
// Without the timer housekeeping
const meaning = (types: string[]) => types.filter((t) => !t.endsWith('-hold-timer'));

describe('A tap', () => {
  it('is a press and a lift without moving, when taps have a job (the eyedropper)', () => {
    const r = play([down(1, 50, 60), up(1, 50, 60, 1000, false)]);
    expect(meaning(r.types)).toEqual(['tap']);
    expect(r.actions.at(-1)).toEqual({ type: 'tap', x: 50, y: 60 });
  });
  it('may wobble up to 8 px', () => {
    expect(meaning(play([down(1, 50, 50), move(1, 50 + SLOP, 50), up(1, 50 + SLOP, 50, 1000, false)]).types)).toEqual(['tap']);
  });
  it('starts the hold timer on the press and stops it on the lift', () => {
    expect(play([down(1, 0, 0), up(1, 0, 0, 1000, false)]).types).toEqual(['start-hold-timer', 'cancel-hold-timer', 'tap']);
  });
  it('one that has a job does not count toward a double-tap', () => {
    const r = play([down(1, 5, 5), up(1, 5, 5, 1000, false), down(1, 5, 5), up(1, 5, 5, 1100, true)]);
    expect(meaning(r.types)).toEqual(['tap']);
  });
});

describe('A double-tap', () => {
  it('is a second tap within 300 ms; the first does nothing', () => {
    const first = play([down(1, 10, 10), up(1, 10, 10, 1000)]);
    expect(meaning(first.types)).toEqual([]);
    const second = play([down(1, 12, 11), up(1, 12, 11, 1000 + DOUBLE_TAP_MS - 1)], first.state);
    expect(second.actions.at(-1)).toEqual({ type: 'double-tap', x: 12, y: 11 });
  });
  it('a second tap later than that starts over', () => {
    const r = play([down(1, 0, 0), up(1, 0, 0, 1000), down(1, 0, 0), up(1, 0, 0, 1000 + DOUBLE_TAP_MS)]);
    expect(meaning(r.types)).toEqual([]);
    expect(meaning(play([down(1, 0, 0), up(1, 0, 0, 1400)], r.state).types)).toEqual(['double-tap']);
  });
  it('a third tap is not a second double-tap', () => {
    const r = play([down(1, 0, 0), up(1, 0, 0, 1000), down(1, 0, 0), up(1, 0, 0, 1100), down(1, 0, 0), up(1, 0, 0, 1200)]);
    expect(meaning(r.types)).toEqual(['double-tap']);
  });
});

describe('A hold', () => {
  it('begins when the timer runs out on a still press, and ends on the lift, which is not a tap', () => {
    const r = play([down(1, 5, 5), hold, up(1, 5, 5, 2000, false)]);
    expect(meaning(r.types)).toEqual(['hold-start', 'hold-end']);
  });
  it('carries on, without panning, if the finger then moves', () => {
    const r = play([down(1, 5, 5), hold, move(1, 60, 60), move(1, 90, 90), up(1, 90, 90)]);
    expect(meaning(r.types)).toEqual(['hold-start', 'hold-end']);
  });
  it('does not begin once the finger has moved more than 8 px: the timer is stopped', () => {
    const r = play([down(1, 0, 0), move(1, SLOP + 1, 0)]);
    expect(r.types).toContain('cancel-hold-timer');
    expect(meaning(play([hold], r.state).types)).toEqual([]);
  });
  it('a stray timer with no press does nothing', () => {
    expect(play([hold]).actions).toEqual([]);
  });
});

describe('A drag', () => {
  it('starts past 8 px and reports each move since the last', () => {
    const r = play([down(1, 0, 0), move(1, 5, 0), move(1, 20, 0), move(1, 26, 4)]);
    expect(r.actions.filter((a) => a.type === 'drag')).toEqual([
      { type: 'drag', dx: 15, dy: 0 },
      { type: 'drag', dx: 6, dy: 4 },
    ]);
  });
  it('ends without a tap, and does not count toward a double-tap', () => {
    const r = play([down(1, 0, 0), move(1, 30, 0), up(1, 30, 0, 1000), down(1, 30, 0), up(1, 30, 0, 1100)]);
    expect(meaning(r.types)).toEqual(['drag']);
  });
  it('a move from a pointer that is not down is ignored', () => {
    expect(play([move(7, 100, 100)]).actions).toEqual([]);
  });
});

describe('A pinch', () => {
  it('starts when a second finger comes down, stopping the hold timer', () => {
    expect(play([down(1, 0, 0), down(2, 100, 0)]).types).toEqual(['start-hold-timer', 'cancel-hold-timer', 'pinch-start']);
  });
  it('ends a hold already begun', () => {
    expect(meaning(play([down(1, 0, 0), hold, down(2, 100, 0)]).types)).toEqual(['hold-start', 'hold-end', 'pinch-start']);
  });
  it('reports how far apart the fingers are and how the point between them moved, from its start', () => {
    const r = play([down(1, 0, 0), down(2, 100, 0), move(2, 200, 0), move(1, 20, 40)]);
    const pinches = r.actions.filter((a) => a.type === 'pinch');
    expect(pinches[0]).toEqual({ type: 'pinch', scale: 2, x: 50, y: 0, dx: 50, dy: 0 });
    expect(pinches[1]).toMatchObject({ x: 50, y: 0, dx: 60, dy: 20 });
    expect(pinches[1].type === 'pinch' && pinches[1].scale).toBeCloseTo(Math.hypot(180, 40) / 100);
  });
  it('is never a tap, a double-tap or a drag, whichever finger lifts first', () => {
    const r = play([
      down(1, 0, 0), down(2, 100, 0), up(2, 100, 0, 1000), move(1, 50, 50), up(1, 50, 50, 1050),
      down(1, 0, 0), down(2, 100, 0), up(1, 0, 0, 1100), up(2, 100, 0, 1150),
    ]);
    expect(meaning(r.types)).toEqual(['pinch-start', 'pinch-start']);
  });
  it('the finger left after a pinch does nothing until it lifts; then a new press starts fresh', () => {
    const after = play([down(1, 0, 0), down(2, 100, 0), up(2, 100, 0), move(1, 80, 80), hold, up(1, 80, 80)]);
    expect(meaning(after.types)).toEqual(['pinch-start']);
    expect(meaning(play([down(1, 0, 0), up(1, 0, 0, 5000, false)], after.state).types)).toEqual(['tap']);
  });
  it('a second finger coming back starts a new pinch', () => {
    const r = play([down(1, 0, 0), down(2, 100, 0), up(2, 100, 0), down(2, 0, 50), move(2, 0, 100)]);
    expect(meaning(r.types)).toEqual(['pinch-start', 'pinch-start', 'pinch']);
    expect(r.actions.at(-1)).toMatchObject({ scale: 2, x: 0, y: 25 });
  });
  it('a third finger changes nothing', () => {
    const r = play([down(1, 0, 0), down(2, 100, 0), down(3, 50, 50), move(3, 60, 60)]);
    expect(meaning(r.types)).toEqual(['pinch-start']);
  });
});

describe('A cancelled touch', () => {
  it('ends a hold and is not a tap', () => {
    const r = play([down(1, 0, 0), hold, { type: 'cancel', id: 1 }]);
    expect(meaning(r.types)).toEqual(['hold-start', 'hold-end']);
    expect(r.state.press).toBeNull();
  });
  it('stops the hold timer of a press', () => {
    expect(play([down(1, 0, 0), { type: 'cancel', id: 1 }]).types).toEqual(['start-hold-timer', 'cancel-hold-timer']);
  });
});
