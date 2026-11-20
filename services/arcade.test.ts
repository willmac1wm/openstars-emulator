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

  it('starts with one aircraft inside the ring and well clear of its exit gate', () => {
    const plan = buildArcadeRound('spawn-check');
    const initial = planToInitialScenario(plan).aircraft;
    expect(initial).toHaveLength(1);
    expect(distFromCenter(initial[0].x, initial[0].y)).toBeLessThan(GATE_RADIUS);
    expect(distanceToGateNm(initial[0]) ?? 0).toBeGreaterThanOrEqual(14);
    expect(distanceToGateNm(initial[0]) ?? Infinity).toBeLessThanOrEqual(30);
    expect(turnToGateDeg(initial[0])).toBeLessThanOrEqual(90);
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

describe('buildSixtySecondRound', () => {
  it('lasts 60 seconds with every wave inside the minute and no curveball', () => {
    const plan = buildSixtySecondRound('sixty-test');
    expect(plan.durationMs).toBe(60_000);
    expect(plan.name).toBe('60-Second Challenge');
    plan.waveAtMs.forEach((at) => expect(at).toBeLessThan(plan.durationMs));
    expect(plan.curveball).toBeNull();
    expect(plan.waves.length).toBe(3);
    // Same seeded traffic as the full round for the waves it shares.
    expect(plan.waves[0][0].callsign).toBe('AAL421');
    expect(plan.waveAtMs[2]).toBe(18_000);
  });
});
