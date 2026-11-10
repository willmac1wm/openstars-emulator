import { describe, expect, it } from 'vitest';
import { buildLocalScenario } from './localScenario';

describe('buildLocalScenario', () => {
  it('builds a full offline scenario for each menu difficulty', () => {
    expect(buildLocalScenario('Easy').aircraft).toHaveLength(4);
    expect(buildLocalScenario('Medium').aircraft).toHaveLength(8);
    expect(buildLocalScenario('Hard').aircraft).toHaveLength(12);
    for (const level of ['Easy', 'Medium', 'Hard']) {
      const scenario = buildLocalScenario(level);
      const signs = scenario.aircraft.map((ac) => ac.callsign);
      expect(new Set(signs).size).toBe(signs.length);
      for (const ac of scenario.aircraft) {
        expect(ac.destination).toMatch(/NOR|SOU|EAS|WES/);
        expect(ac.speed).toBeGreaterThan(100);
        expect(ac.altitude).toBeGreaterThan(40);
      }
    }
  });
});