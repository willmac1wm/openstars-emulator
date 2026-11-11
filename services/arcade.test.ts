import { describe, expect, it } from 'vitest';
import { ARCADE_DURATION_MS, buildArcadeRound, planToInitialScenario, spawnCurveballAircraft } from './arcade';

describe('arcade round plan', () => {
  it('builds a deterministic 5-minute round with three fast waves and a curveball (no medevac)', () => {
    const a = buildArcadeRound('arcade-test');
    const b = buildArcadeRound('arcade-test');
    expect(a.durationMs).toBe(ARCADE_DURATION_MS);
    expect(a.durationMs).toBe(5 * 60 * 1000);
    expect(a.waves).toHaveLength(3);
    expect(a.curveball.kind).toBe(b.curveball.kind);
    expect(a.waves[0][0].callsign).toBe(b.waves[0][0].callsign);
    expect(['nordo', 'goaround']).toContain(a.curveball.kind);
  });

  it('spawns nordo aircraft for nordo curveball', () => {
    const plan = buildArcadeRound('spawn-check');
    const nordoPlan = { ...plan, curveball: { ...plan.curveball, kind: 'nordo' as const, callsign: 'N123NR' } };
    const goaroundPlan = { ...plan, curveball: { ...plan.curveball, kind: 'goaround' as const, callsign: 'AAL421' } };
    expect(spawnCurveballAircraft(nordoPlan)?.special).toBe('nordo');
    expect(spawnCurveballAircraft(goaroundPlan)).toBeNull();
    expect(planToInitialScenario(plan).aircraft.length).toBe(plan.waves[0].length);
  });
});
