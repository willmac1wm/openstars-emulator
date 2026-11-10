import { describe, expect, it } from 'vitest';
import { reduce, replay } from './reducer';
import { emptySimState } from './scenarios/vectorToFinal';
import type { SimAction } from './types';

describe('sim engine determinism', () => {
  it('same seed + same action log → identical state', () => {
    const actions: SimAction[] = [
      { type: 'START', mode: 'vector_to_final', seedLabel: 'det-1', approachKind: 'ILS' },
      { type: 'TICK', steps: 40 },
      {
        type: 'COMMAND',
        raw: 'AAL421 8 MILES FROM FINAL APPROACH FIX TL250 MAINTAIN A020 UNTIL ESTABLISHED CLEARED ILS RWY 28 APPROACH',
      },
      { type: 'TICK', steps: 80 },
    ];
    const a = replay(actions);
    const b = replay(actions);
    expect(a.simTime).toBe(b.simTime);
    expect(a.score).toBe(b.score);
    expect(a.aircraft.map((ac) => ({ id: ac.id, x: ac.x, y: ac.y, hdg: ac.heading, ias: ac.ias }))).toEqual(
      b.aircraft.map((ac) => ({ id: ac.id, x: ac.x, y: ac.y, hdg: ac.heading, ias: ac.ias })),
    );
    expect(a.rngState).toBe(b.rngState);
  });

  it('starts empty until START', () => {
    const s = reduce(emptySimState(), { type: 'TICK', steps: 5 });
    expect(s.aircraft).toHaveLength(0);
  });
});
