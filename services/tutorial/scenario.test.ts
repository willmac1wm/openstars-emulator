import { describe, expect, it } from 'vitest';
import { GATE_RADIUS, NM_3_PX, NM_TO_PX } from '../../constants';
import { distFromCenter, isEdgeSpawn } from '../spawnTraffic';
import {
  buildTutorialScenario,
  TUTORIAL_TARGET_CALLSIGN,
  tutorialMinPairDistanceNm,
} from './scenario';

describe('buildTutorialScenario', () => {
  it('places 2–3 aircraft on the edge, well separated, no opening conflict', () => {
    const scenario = buildTutorialScenario();
    expect(scenario.aircraft.length).toBeGreaterThanOrEqual(2);
    expect(scenario.aircraft.length).toBeLessThanOrEqual(3);

    for (const ac of scenario.aircraft) {
      expect(isEdgeSpawn(ac)).toBe(true);
      expect(distFromCenter(ac.x, ac.y)).toBeGreaterThanOrEqual(GATE_RADIUS + 20);
      expect(ac.alertLevel).toBe(0);
    }

    // >> 3 NM horizontally between every pair
    expect(tutorialMinPairDistanceNm(scenario)).toBeGreaterThan(8);

    // Pairs that share altitude bands within 1000 ft must still be far horizontally
    const list = scenario.aircraft;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const altDiff = Math.abs(list[i].altitude - list[j].altitude);
        const distPx = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
        if (altDiff < 10) {
          expect(distPx).toBeGreaterThan(NM_3_PX * 4);
        }
      }
    }

    const target = scenario.aircraft.find((ac) => ac.callsign === TUTORIAL_TARGET_CALLSIGN);
    expect(target?.isSelected).toBe(true);
    expect(target?.destination).toBe('SOU');
  });

  it('keeps aircraft outside the mid-scope conflict zone', () => {
    const scenario = buildTutorialScenario();
    for (const ac of scenario.aircraft) {
      // Not clustered near CENTER (the bug Will screenshot'd)
      const d = Math.hypot(ac.x - 400, ac.y - 400) / NM_TO_PX;
      expect(d).toBeGreaterThan(30);
    }
  });
});
