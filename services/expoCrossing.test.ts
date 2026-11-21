import { describe, expect, it } from 'vitest';
import { CENTER, GATE_RADIUS, NM_TO_PX } from '../constants';
import {
  ARCADE_DURATION_MS,
  buildArcadeRound,
  buildSixtySecondRound,
  spawnCurveballAircraft,
} from './arcade';
import {
  bearingTo,
  crossingTimeWallSeconds,
  distFromCenter,
  distanceToGateNm,
  isHeadingInbound,
  isInGateCorridor,
  turnToGateDeg,
} from './spawnTraffic';
import type { Aircraft } from '../types';

function distToGateNm(ac: Pick<Aircraft, 'x' | 'y' | 'destination'>): number {
  return distanceToGateNm(ac) ?? Infinity;
}

const SEEDS = ['arcade-1', 'expo-booth', 'spawn-a', 'spawn-b', 'sixty-1', 'test-7'];

describe('expo protected-area outer-ring spawns', () => {
  it('5-minute Expo: every wave aircraft can cross the airspace within the 5-min shift (6x)', () => {
    for (const seed of SEEDS) {
      const plan = buildArcadeRound(seed);
      plan.waves.forEach((wave, i) => {
        for (const ac of wave) {
          const d = distToGateNm(ac);
          const tSec = crossingTimeWallSeconds(d, ac.speed, 6);
          expect(
            plan.waveAtMs[i] + tSec * 1000,
            `${seed} wave ${i} ${ac.callsign} -> ${ac.destination}: ${d.toFixed(1)} NM`,
          ).toBeLessThanOrEqual(ARCADE_DURATION_MS);
        }
      });
    }
  });

  it('NORDO curveball is disabled for every seed and both variants', () => {
    for (const seed of SEEDS) {
      const arcade = buildArcadeRound(seed);
      const sixty = buildSixtySecondRound(seed);
      expect(arcade.curveball).toBeNull();
      expect(sixty.curveball).toBeNull();
      expect(spawnCurveballAircraft(arcade)).toBeNull();
      expect(spawnCurveballAircraft(sixty)).toBeNull();
    }
  });

  it('Expo & 60-Second spawns are outside the ring, in protected areas between gates, heading inbound, and separated', () => {
    for (const seed of SEEDS) {
      for (const plan of [buildArcadeRound(seed), buildSixtySecondRound(seed)]) {
        const all = plan.waves.flat();
        for (const ac of all) {
          expect(distFromCenter(ac.x, ac.y), `${seed} ${ac.callsign} outside ring`).toBeGreaterThan(GATE_RADIUS);
          const radial = bearingTo({ x: CENTER, y: CENTER }, { x: ac.x, y: ac.y });
          expect(isInGateCorridor(radial, 8), `${seed} ${ac.callsign} not in gate`).toBe(false);
          expect(isHeadingInbound(ac), `${seed} ${ac.callsign} heading inbound`).toBe(true);
          expect(turnToGateDeg(ac), `${seed} ${ac.callsign} solvable turn`).toBeLessThan(120);
        }
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) / NM_TO_PX;
            expect(d, `${seed} sep ${all[i].callsign}-${all[j].callsign}`).toBeGreaterThanOrEqual(6 - 0.5);
          }
        }
      }
    }
  });
});
