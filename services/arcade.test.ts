import { describe, expect, it } from 'vitest';
import { ARCADE_DURATION_MS, buildArcadeRound, planToInitialScenario, spawnCurveballAircraft } from './arcade';

describe('arcade round plan', () => {
  it('builds a deterministic 3-minute round with three waves and a curveball', () => {
    const a = buildArcadeRound('arcade-test');
    const b = buildArcadeRound('arcade-test');
    expect(a.durationMs).toBe(ARCADE_DURATION_MS);
    expect(a.waves).toHaveLength(3);
    expect(a.curveball.kind).toBe(b.curveball.kind);
    expect(a.waves[0][0].callsign).toBe(b.waves[0][0].callsign);
    expect(['medevac', 'nordo', 'goaround']).toContain(a.curveball.kind);
  });

  it('spawns medevac or nordo aircraft for those curveballs', () => {
    const plan = buildArcadeRound('spawn-check');
    // Force kind by scanning seeds until we hit each type is overkill; just assert API.
    const medevacPlan = { ...plan, curveball: { ...plan.curveball, kind: 'medevac' as const, callsign: 'MEDEVAC1' } };
    const nordoPlan = { ...plan, curveball: { ...plan.curveball, kind: 'nordo' as const, callsign: 'N123NR' } };
    expect(spawnCurveballAircraft(medevacPlan)?.special).toBe('medevac');
    expect(spawnCurveballAircraft(nordoPlan)?.special).toBe('nordo');
    expect(planToInitialScenario(plan).aircraft.length).toBe(plan.waves[0].length);
  });
});
