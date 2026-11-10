import { describe, expect, it } from 'vitest';
import { readSeedFromLocation, resolveSeedInput } from './scenarioSeed';
import { buildLocalScenario } from './localScenario';

describe('scenarioSeed', () => {
  it('parses numeric URL seeds as exact PRNG seeds', () => {
    expect(resolveSeedInput('1234')).toEqual({ display: '1234', numeric: 1234 });
    expect(resolveSeedInput(42)).toEqual({ display: '42', numeric: 42 });
  });

  it('keeps labeled seeds stable for named lessons', () => {
    const a = resolveSeedInput('trainee-1', 'Easy');
    const b = resolveSeedInput('trainee-1', 'Easy');
    expect(a).toEqual(b);
    expect(a.display).toBe('trainee-1');
  });

  it('falls back to the difficulty default when empty', () => {
    expect(resolveSeedInput(null, 'Expo').display).toBe('expo-booth');
    expect(resolveSeedInput('  ', 'Hard').display).toBe('veteran-1');
  });

  it('reads ?seed= from a query string', () => {
    expect(readSeedFromLocation('?seed=1234&x=1')).toBe('1234');
    expect(readSeedFromLocation('?difficulty=Easy')).toBeNull();
  });

  it('builds identical offline traffic for the same numeric seed', () => {
    const a = buildLocalScenario('Easy', '1234');
    const b = buildLocalScenario('Easy', 1234);
    expect(a.seedLabel).toBe('1234');
    expect(a.aircraft.map((ac) => ({
      callsign: ac.callsign,
      x: ac.x,
      y: ac.y,
      heading: ac.heading,
      destination: ac.destination,
    }))).toEqual(b.aircraft.map((ac) => ({
      callsign: ac.callsign,
      x: ac.x,
      y: ac.y,
      heading: ac.heading,
      destination: ac.destination,
    })));

    const other = buildLocalScenario('Easy', '9999');
    expect(other.aircraft[0].x).not.toBe(a.aircraft[0].x);
  });
});
