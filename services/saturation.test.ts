import { describe, expect, it } from 'vitest';
import {
  buildSaturationScenario,
  SATURATION_INITIAL_COUNT,
  SATURATION_MIN_INTERVAL_MS,
  SATURATION_START_INTERVAL_MS,
  saturationNextIntervalMs,
  spawnSaturationAircraft,
} from './saturation';
import { distFromCenter, distanceToGateNm, SPAWN_SEP_PX } from './spawnTraffic';
import { GATE_RADIUS } from '../constants';

describe('Sector Saturation mode', () => {
  it('starts calm with 2 inbound aircraft on the outer ring, far from their exit gates', () => {
    const scenario = buildSaturationScenario('sat-test');
    expect(scenario.name).toBe('Sector Saturation');
    expect(scenario.aircraft).toHaveLength(SATURATION_INITIAL_COUNT);
    for (const ac of scenario.aircraft) {
      expect(distFromCenter(ac.x, ac.y)).toBeGreaterThan(GATE_RADIUS);
      // Opposite side of the scope — never right next to its own gate.
      expect(distanceToGateNm(ac) ?? 0).toBeGreaterThan(50);
    }
  });

  it('ramps up traffic volume by tightening spawn intervals down to the floor', () => {
    const first = saturationNextIntervalMs(SATURATION_INITIAL_COUNT);
    const later = saturationNextIntervalMs(SATURATION_INITIAL_COUNT + 5);
    const extreme = saturationNextIntervalMs(SATURATION_INITIAL_COUNT + 100);
    expect(first).toBe(SATURATION_START_INTERVAL_MS);
    expect(later).toBeLessThan(first);
    expect(extreme).toBe(SATURATION_MIN_INTERVAL_MS);
  });

  it('spawns unique callsigns separated from existing aircraft', () => {
    const scenario = buildSaturationScenario('sat-unique');
    const list = [...scenario.aircraft];
    for (let i = SATURATION_INITIAL_COUNT; i < 10; i++) {
      const next = spawnSaturationAircraft('sat-unique', i, list);
      expect(list.some((a) => a.callsign === next.callsign)).toBe(false);
      for (const existing of list) {
        const sep = Math.hypot(existing.x - next.x, existing.y - next.y);
        expect(sep).toBeGreaterThanOrEqual(SPAWN_SEP_PX - 1);
      }
      list.push(next);
    }
  });
});
