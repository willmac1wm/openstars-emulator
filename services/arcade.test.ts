import { describe, expect, it } from 'vitest';
import {
  ARCADE_DURATION_MS,
  ARCADE_STAGGER_MS,
  buildArcadeRound,
  buildSixtySecondRound,
  planToInitialScenario,
  spawnCurveballAircraft,
} from './arcade';
import { GATE_RADIUS } from '../constants';
import {
  distFromCenter,
  distanceToGateNm,
  turnToGateDeg,
} from './spawnTraffic';

describe('arcade round plan', () => {
  it('builds a deterministic 5-minute round with staggered opening traffic and no NORDO curveball', () => {
    const a = buildArcadeRound('arcade-test');
    const b = buildArcadeRound('arcade-test');
    expect(a.durationMs).toBe(ARCADE_DURATION_MS);
    expect(a.durationMs).toBe(5 * 60 * 1000);
    expect(a.waves.length).toBeGreaterThanOrEqual(3);
    expect(a.waveAtMs[0]).toBe(0);
    expect(a.waveAtMs[1]).toBe(ARCADE_STAGGER_MS);
    expect(a.curveball).toBeNull();
    expect(a.waves[0][0].callsign).toBe(b.waves[0][0].callsign);
  });

  it('starts with one aircraft outside the airspace ring heading inbound from a protected area', () => {
    const plan = buildArcadeRound('spawn-check');
    const initial = planToInitialScenario(plan).aircraft;
    expect(initial).toHaveLength(1);
    expect(distFromCenter(initial[0].x, initial[0].y)).toBeGreaterThan(GATE_RADIUS);
    expect(distanceToGateNm(initial[0]) ?? 0).toBeGreaterThan(45);
    expect(turnToGateDeg(initial[0])).toBeLessThan(120);
  });

  it('never spawns NORDO curveballs for any seed', () => {
    for (const seed of ['a', 'b', 'c', 'arcade-1', 'expo-booth', 'sixty-1', 'zzz']) {
      const arcade = buildArcadeRound(seed);
      const sixty = buildSixtySecondRound(seed);
      expect(arcade.curveball).toBeNull();
      expect(sixty.curveball).toBeNull();
      expect(spawnCurveballAircraft(arcade)).toBeNull();
      expect(spawnCurveballAircraft(sixty)).toBeNull();
    }
  });
});

describe('buildSixtySecondRound (3-Minute Sprint)', () => {
  it('lasts 3 minutes with every wave inside the sprint and no curveball', () => {
    const plan = buildSixtySecondRound('sprint-test');
    expect(plan.durationMs).toBe(180_000);
    expect(plan.name).toBe('3-Minute Sprint');
    plan.waveAtMs.forEach((at) => expect(at).toBeLessThan(plan.durationMs));
    expect(plan.curveball).toBeNull();
    expect(plan.waves.length).toBe(3);
    // Same seeded traffic as the full round for the waves it shares.
    expect(plan.waves[0][0].callsign).toBe('AAL421');
    expect(plan.waveAtMs[2]).toBe(30_000);
  });
});
