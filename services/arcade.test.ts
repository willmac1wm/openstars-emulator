import { describe, expect, it } from 'vitest';
import {
  ARCADE_DURATION_MS,
  ARCADE_STAGGER_MS,
  buildArcadeRound,
  buildSixtySecondRound,
  planToInitialScenario,
  spawnCurveballAircraft,
} from './arcade';
import { isEdgeSpawn, isHeadingInbound } from './spawnTraffic';

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
    expect(['nordo', 'goaround']).toContain(a.curveball.kind);
  });

  it('starts with one edge-inbound aircraft so the second can stagger in', () => {
    const plan = buildArcadeRound('spawn-check');
    const initial = planToInitialScenario(plan).aircraft;
    expect(initial).toHaveLength(1);
    expect(isEdgeSpawn(initial[0])).toBe(true);
    expect(isHeadingInbound(initial[0])).toBe(true);
  });

  it('spawns nordo aircraft for nordo curveball on the outer ring', () => {
    const plan = buildArcadeRound('spawn-check');
    const nordoPlan = { ...plan, curveball: { ...plan.curveball, kind: 'nordo' as const, callsign: 'N123NR' } };
    const goaroundPlan = { ...plan, curveball: { ...plan.curveball, kind: 'goaround' as const, callsign: 'AAL421' } };
    const nordo = spawnCurveballAircraft(nordoPlan);
    expect(nordo?.special).toBe('nordo');
    expect(nordo && isEdgeSpawn(nordo)).toBe(true);
    expect(spawnCurveballAircraft(goaroundPlan)).toBeNull();
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
  });
});
