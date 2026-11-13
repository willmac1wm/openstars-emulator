import { describe, expect, it } from 'vitest';
import { GATES, GATE_RADIUS, NM_TO_PX } from '../constants';
import {
  ARCADE_DURATION_MS,
  buildArcadeRound,
  buildSixtySecondRound,
  SIXTY_SECOND_DURATION_MS,
  spawnCurveballAircraft,
} from './arcade';
import {
  bearingTo,
  crossingTimeWallSeconds,
  distFromCenter,
  distanceToGateNm,
  turnToGateDeg,
} from './spawnTraffic';
import type { Aircraft } from '../types';
import { simulateExitWallSec } from './exitSimulation';

/**
 * Expo crossing-time budgets (Nov 2026 bug: Expo planes could not cross the
 * scope in a round). Wall-clock at Expo timeScale 6.
 *
 * Old spawn: opposite side of the scope, 39.5–44.5 NM from centre, so the
 * straight-line distance to the destination gate fix was ~75–80 NM.
 * At 250 kt that is ~180 s wall — a 5-min shift's later waves could never
 * exit, and the 60-second challenge was unwinnable (60 s wall = 25 NM).
 *
 * Budgets a correctly vectored aircraft must meet:
 * - 5-minute Expo: every wave aircraft exits within 90 s of spawning.
 * - 60-Second Challenge: every wave aircraft exits within 45 s of spawning,
 *   and still inside the 60 s round after a 5 s reaction delay.
 * - NORDO curveball (140 kt, cannot be vectored): exits within 90 s of
 *   spawning in the 5-min round, flying straight at its gate.
 * - Go-around re-entry: reaches its new gate within the remaining round time.
 */

function distToGateNm(ac: Pick<Aircraft, 'x' | 'y' | 'destination'>): number {
  return distanceToGateNm(ac) ?? Infinity;
}

/** Straight-line wall-clock seconds to cover distNm at speedKt, timeScale x. */
function crossingWallSec(distNm: number, speedKt: number, timeScale = 6): number {
  return crossingTimeWallSeconds(distNm, speedKt, timeScale);
}

const SEEDS = ['arcade-1', 'expo-booth', 'spawn-a', 'spawn-b', 'sixty-1', 'test-7'];

describe('expo crossing-time budgets', () => {
  it('5-minute Expo: every wave aircraft can exit within 90s of spawning (6x)', () => {
    for (const seed of SEEDS) {
      const plan = buildArcadeRound(seed);
      for (const wave of plan.waves) {
        for (const ac of wave) {
          const d = distToGateNm(ac);
          const t = crossingWallSec(d, ac.speed);
          expect(
            t,
            `${seed} ${ac.callsign} -> ${ac.destination}: ${d.toFixed(1)} NM at ${ac.speed} kt = ${t.toFixed(0)}s wall`,
          ).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('60-Second Challenge: every wave aircraft can exit within 45s of spawning (6x)', () => {
    for (const seed of SEEDS) {
      const plan = buildSixtySecondRound(seed);
      for (const wave of plan.waves) {
        for (const ac of wave) {
          const t = crossingWallSec(distToGateNm(ac), ac.speed);
          expect(
            t,
            `${seed} ${ac.callsign} -> ${ac.destination}: ${distToGateNm(ac).toFixed(1)} NM at ${ac.speed} kt = ${t.toFixed(0)}s wall`,
          ).toBeLessThanOrEqual(45);
        }
      }
    }
  });

  it('60-Second Challenge: every wave aircraft can still score before the 60s timer ends (5s reaction)', () => {
    for (const seed of SEEDS) {
      const plan = buildSixtySecondRound(seed);
      plan.waves.forEach((wave, i) => {
        for (const ac of wave) {
          const totalMs =
            plan.waveAtMs[i] + crossingWallSec(distToGateNm(ac), ac.speed) * 1000 + 5_000;
          expect(
            totalMs,
            `${seed} wave ${i} ${ac.callsign} spawns at ${plan.waveAtMs[i]}ms, needs ${totalMs.toFixed(0)}ms total`,
          ).toBeLessThanOrEqual(SIXTY_SECOND_DURATION_MS);
        }
      });
    }
  });

  it('NORDO curveball: flies straight to its gate and exits within 90s in the 5-min round', () => {
    for (const seed of SEEDS) {
      const plan = buildArcadeRound(seed);
      const nordoPlan = {
        ...plan,
        curveball: { ...plan.curveball, kind: 'nordo' as const, callsign: 'N123NR' },
      };
      const nordo = spawnCurveballAircraft(nordoPlan);
      expect(nordo).not.toBeNull();
      if (!nordo) continue;
      // Unvectorable: its initial heading must already point at the gate.
      expect(
        turnToGateDeg(nordo),
        `${seed} NORDO turn to gate (heading ${nordo.heading})`,
      ).toBeLessThanOrEqual(15);
      const t = crossingWallSec(distToGateNm(nordo), nordo.speed);
      expect(t, `${seed} NORDO ${distToGateNm(nordo).toFixed(1)} NM at ${nordo.speed} kt = ${t.toFixed(0)}s wall`).toBeLessThanOrEqual(90);
      // And it must be able to exit inside the round even spawning at 70s.
      expect(70_000 + t * 1000).toBeLessThanOrEqual(ARCADE_DURATION_MS);
    }
  });

  it('the curveball is always NORDO, for every seed and both variants', () => {
    for (const seed of SEEDS) {
      expect(buildArcadeRound(seed).curveball.kind).toBe('nordo');
      expect(buildSixtySecondRound(seed).curveball.kind).toBe('nordo');
    }
  });

  it('flight simulation: a correctly vectored aircraft really exits in time, turns included (5s reaction)', () => {
    for (const seed of SEEDS) {
      const plan = buildArcadeRound(seed);
      for (const ac of plan.waves.flat()) {
        const t = simulateExitWallSec(ac, { reactionWallSec: 5 });
        expect(t, `${seed} ${ac.callsign} simulated exit ${t.toFixed(1)}s wall`).toBeLessThanOrEqual(90);
      }
      const sixty = buildSixtySecondRound(seed);
      sixty.waves.forEach((wave, i) => {
        for (const ac of wave) {
          const t = simulateExitWallSec(ac, { reactionWallSec: 5 });
          expect(t, `${seed} sixty wave ${i} ${ac.callsign} simulated exit ${t.toFixed(1)}s wall`).toBeLessThanOrEqual(45);
          expect(
            sixty.waveAtMs[i] + t * 1000,
            `${seed} sixty wave ${i} ${ac.callsign} exits before the 60s timer`,
          ).toBeLessThanOrEqual(SIXTY_SECOND_DURATION_MS);
        }
      });
    }
  });

  it('flight simulation: the NORDO flies itself out with no commands at all', () => {
    for (const seed of SEEDS) {
      const plan = buildArcadeRound(seed);
      const nordo = spawnCurveballAircraft({
        ...plan,
        curveball: { ...plan.curveball, kind: 'nordo' as const, callsign: 'N123NR' },
      });
      expect(nordo).not.toBeNull();
      if (!nordo) continue;
      // No reaction, no turn: heading stays exactly as spawned.
      const t = simulateExitWallSec(nordo, { reactionWallSec: 1_000_000 });
      expect(t, `${seed} NORDO uncommanded exit ${t.toFixed(1)}s wall`).toBeLessThanOrEqual(90);
    }
  });

  it('Expo spawns are inside the ring, clear of the gate, and need a vector (not pre-solved)', () => {
    for (const seed of SEEDS) {
      for (const plan of [buildArcadeRound(seed), buildSixtySecondRound(seed)]) {
        const all = plan.waves.flat();
        for (const ac of all) {
          // Inside the gate ring, so it becomes ACTIVE on the first tick and
          // can hand off (HANDOFF only fires from ACTIVE).
          expect(distFromCenter(ac.x, ac.y), `${seed} ${ac.callsign} inside ring`).toBeLessThan(
            GATE_RADIUS,
          );
          // Not already on top of the gate: the player must still fly it there.
          expect(distToGateNm(ac), `${seed} ${ac.callsign} clear of gate`).toBeGreaterThanOrEqual(6);
          // A turn is still required, but it is solvable (< 90 deg).
          const turn = turnToGateDeg(ac);
          expect(turn, `${seed} ${ac.callsign} turn to gate ${turn} deg`).toBeGreaterThanOrEqual(10);
          expect(turn, `${seed} ${ac.callsign} turn to gate ${turn} deg`).toBeLessThanOrEqual(90);
        }
        // Spawns stay separated (~6 NM) within the plan.
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
