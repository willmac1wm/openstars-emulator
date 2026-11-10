import { describe, expect, it } from 'vitest';
import { buildLocalScenario } from './localScenario';

describe('buildLocalScenario', () => {
  it('builds a full offline scenario for each menu difficulty', () => {
    expect(buildLocalScenario('Expo').aircraft).toHaveLength(3);
    expect(buildLocalScenario('Easy').aircraft).toHaveLength(4);
    expect(buildLocalScenario('Medium').aircraft).toHaveLength(8);
    expect(buildLocalScenario('Hard').aircraft).toHaveLength(12);
    for (const level of ['Expo', 'Easy', 'Medium', 'Hard'] as const) {
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

  it('replays the same seed for classroom and booth demos', () => {
    const a = buildLocalScenario('Easy', 'trainee-1');
    const b = buildLocalScenario('Easy', 'trainee-1');
    expect(a.aircraft.map((ac) => ({ callsign: ac.callsign, x: ac.x, y: ac.y, heading: ac.heading })))
      .toEqual(b.aircraft.map((ac) => ({ callsign: ac.callsign, x: ac.x, y: ac.y, heading: ac.heading })));

    const other = buildLocalScenario('Easy', 'trainee-2');
    expect(other.aircraft[0].x).not.toBe(a.aircraft[0].x);

    const expo = buildLocalScenario('Expo');
    expect(expo.mode).toBe('expo');
    expect(expo.aircraft.map((ac) => ac.destination).sort()).toEqual(['EAS', 'SOU', 'WES']);
  });
});
