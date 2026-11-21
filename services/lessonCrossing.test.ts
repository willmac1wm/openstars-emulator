import { describe, expect, it } from 'vitest';
import { CENTER, DEFAULT_TIME_SCALE, GATE_RADIUS, NM_TO_PX, SIM_SPEED_OPTIONS } from '../constants';
import { buildLocalScenario } from './localScenario';
import {
  bearingTo,
  distFromCenter,
  distanceToGateNm,
  isHeadingInbound,
  isInGateCorridor,
  turnToGateDeg,
} from './spawnTraffic';

const SEEDS = ['trainee-1', 'controller-1', 'veteran-1', 'lesson-a', 'lesson-b', 'test-7'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

describe('lesson protected-area outer-ring spawns', () => {
  it('lesson default speed is 2x and 1x is still selectable', () => {
    expect(DEFAULT_TIME_SCALE).toBe(2);
    expect(SIM_SPEED_OPTIONS).toContain(1);
    expect(SIM_SPEED_OPTIONS).toContain(2);
  });

  it('every lesson aircraft spawns outside the airspace ring in a protected area between gates, heading inbound, and separated', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const scenario = buildLocalScenario(difficulty, seed);
        const all = scenario.aircraft;
        for (const ac of all) {
          expect(distFromCenter(ac.x, ac.y), `${difficulty}/${seed} ${ac.callsign} outside ring`).toBeGreaterThan(
            GATE_RADIUS,
          );
          const radial = bearingTo({ x: CENTER, y: CENTER }, { x: ac.x, y: ac.y });
          expect(
            isInGateCorridor(radial, 8),
            `${difficulty}/${seed} ${ac.callsign} radial ${radial.toFixed(0)}° not inside gate`,
          ).toBe(false);
          expect(isHeadingInbound(ac), `${difficulty}/${seed} ${ac.callsign} inbound`).toBe(true);
          expect(distanceToGateNm(ac) ?? 0, `${difficulty}/${seed} ${ac.callsign} real transit`).toBeGreaterThan(45);
          expect(turnToGateDeg(ac), `${difficulty}/${seed} ${ac.callsign} solvable turn`).toBeLessThan(120);
        }
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) / NM_TO_PX;
            expect(d, `${difficulty}/${seed} sep ${all[i].callsign}-${all[j].callsign}`).toBeGreaterThanOrEqual(6 - 0.5);
          }
        }
      }
    }
  });
});
