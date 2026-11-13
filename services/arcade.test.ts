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
  it('builds a deterministic 5-minute round with staggered opening traffic and a curveball (no medevac)', () => {
    const a = buildArcadeRound('arcade-test');
    const b = buildArcadeRound('arcade-test');
    expect(a.durationMs).toBe(ARCADE_DURATION_MS);
    expect(a.durationMs).toBe(5 * 60 * 1000);
    expect(a.waves.length).toBeGreaterThanOrEqual(3);
    expect(a.waveAtMs[0]).toBe(0);
    expect(a.waveAtMs[1]).toBe(ARCADE_STAGGER_MS);
    expect(a.curveball.kind).toBe(b.curveball.kind);
    expect(a.waves[0][0].callsign).toBe(b.waves[0][0].callsign);
    // The only curveball is NORDO — there is no runway, so no go-around.
    expect(a.curveball.kind).toBe('nordo');
  });

  it('starts with one near-gate aircraft inside the ring so the second can stagger in', () => {
    const plan = buildArcadeRound('spawn-check');
    const initial = planToInitialScenario(plan).aircraft;
    expect(initial).toHaveLength(1);
    expect(distFromCenter(initial[0].x, initial[0].y)).toBeLessThan(GATE_RADIUS);
    expect(distanceToGateNm(initial[0]) ?? Infinity).toBeLessThanOrEqual(20);
    expect(turnToGateDeg(initial[0])).toBeLessThanOrEqual(90);
  });

  it('spawns the nordo aircraft near its gate, heading straight at it', () => {
    const plan = buildArcadeRound('spawn-check');
    const nordo = spawnCurveballAircraft(plan);
    expect(nordo?.special).toBe('nordo');
    expect(nordo && distFromCenter(nordo.x, nordo.y)).toBeLessThan(GATE_RADIUS);
    expect(nordo && turnToGateDeg(nordo)).toBeLessThanOrEqual(15);
    // Legal altitude for NOR, so its automatic exit is not a penalty.
    expect(nordo?.altitude).toBe(70);
  });

  it('the curveball is always NORDO, for every seed', () => {
    for (const seed of ['a', 'b', 'c', 'arcade-1', 'expo-booth', 'sixty-1', 'zzz']) {
      expect(buildArcadeRound(seed).curveball.kind).toBe('nordo');
      expect(buildSixtySecondRound(seed).curveball.kind).toBe('nordo');
    }
  });
});

describe('buildSixtySecondRound', () => {
  it('lasts 60 seconds with every wave and the curveball inside the minute', () => {
    const plan = buildSixtySecondRound('sixty-test');
    expect(plan.durationMs).toBe(60_000);
    expect(plan.name).toBe('60-Second Challenge');
    plan.waveAtMs.forEach((at) => expect(at).toBeLessThan(plan.durationMs));
    expect(plan.curveball.atMs).toBeLessThan(plan.durationMs);
    expect(plan.waves.length).toBe(3);
    // Same seeded traffic as the full round for the waves it shares.
    expect(plan.waves[0][0].callsign).toBe('AAL421');
    // Wave 2 moved 30s -> 24s (Nov 2026 crossing fix): at 30s it had only
    // 30s left, so even a perfect crossing plus reaction could not score.
    expect(plan.waveAtMs[2]).toBe(24_000);
  });
});
