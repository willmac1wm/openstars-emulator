import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_SCALE, GATE_RADIUS, NM_TO_PX, SIM_SPEED_OPTIONS } from '../constants';
import { buildLocalScenario } from './localScenario';
import { simulateExitWallSec } from './exitSimulation';
import {
  crossingTimeWallSeconds,
  distFromCenter,
  distanceToGateNm,
  LESSON_BUDGET_WALL_SEC,
  LESSON_SPAWN_DISTANCE_NM,
  turnToGateDeg,
} from './spawnTraffic';
import type { Aircraft } from '../types';

/**
 * Lesson pacing budgets (Nov 2026: lesson planes took ~18 min wall at 1x).
 *
 * Old spawn: outer ring, 39.5–44.5 NM from centre on the opposite side of
 * the gate, so the straight-line distance to the destination gate fix was
 * ~75 NM. At 200–250 kt that is 1080–1500 s wall at 1x (18–25 min) — a
 * Trainee round dragged on far longer than a class period.
 *
 * New rule (Option C): lesson aircraft spawn 24 NM from their gate fix
 * (near-gate placer, heading 30–50° off the fix bearing) AND lesson modes
 * default to 2x. Budgets a correctly vectored aircraft must meet:
 * - Straight-line crossing at the 2x default: <= 300 s wall (5 min).
 * - Flight simulation with turns + a 10 s wall reaction delay at 2x:
 *   <= 300 s wall.
 * - Even if the player slows to 1x: straight-line <= 450 s wall
 *   (7.5 min), still finishable.
 * All lesson aircraft spawn at t=0, so a Trainee round (4) resolves in
 * ~4–5 min of flying plus thinking time (~6–8 min total) and Controller
 * (8) in ~10 min.
 */

const SEEDS = ['trainee-1', 'controller-1', 'veteran-1', 'lesson-a', 'lesson-b', 'test-7'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const; // Trainee / Controller / Veteran
const LESSON_TIME_SCALE = DEFAULT_TIME_SCALE; // 2x — the lesson default

function distToGateNm(ac: Pick<Aircraft, 'x' | 'y' | 'destination'>): number {
  return distanceToGateNm(ac) ?? Infinity;
}

describe('lesson pacing budgets', () => {
  it('lesson default speed is 2x and 1x is still selectable', () => {
    expect(LESSON_TIME_SCALE).toBe(2);
    expect(SIM_SPEED_OPTIONS).toContain(1);
    expect(SIM_SPEED_OPTIONS).toContain(2);
  });

  it('the old outer-ring spawn fails the budget (75 NM at 1x = 18+ min)', () => {
    // Numeric proof against the old distances — the old spawn no longer
    // exists in code, so assert the budget directly.
    for (const speed of [200, 250]) {
      const old = crossingTimeWallSeconds(75, speed, 1);
      expect(old, `old 75 NM at ${speed} kt, 1x`).toBeGreaterThan(LESSON_BUDGET_WALL_SEC);
      expect(old).toBeGreaterThanOrEqual(1080);
    }
  });

  it('every lesson aircraft spawns 24 NM from its gate and can exit within 5 min at 2x', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const scenario = buildLocalScenario(difficulty, seed);
        for (const ac of scenario.aircraft) {
          const d = distToGateNm(ac);
          expect(
            d,
            `${difficulty}/${seed} ${ac.callsign} spawn distance ${d.toFixed(1)} NM`,
          ).toBeCloseTo(LESSON_SPAWN_DISTANCE_NM, 0);
          const t = crossingTimeWallSeconds(d, ac.speed, LESSON_TIME_SCALE);
          expect(
            t,
            `${difficulty}/${seed} ${ac.callsign}: ${d.toFixed(1)} NM at ${ac.speed} kt, 2x = ${t.toFixed(0)}s wall`,
          ).toBeLessThanOrEqual(LESSON_BUDGET_WALL_SEC);
        }
      }
    }
  });

  it('flight simulation: a correctly vectored lesson aircraft really exits within 5 min, turns included (10s reaction, 2x)', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const scenario = buildLocalScenario(difficulty, seed);
        for (const ac of scenario.aircraft) {
          const t = simulateExitWallSec(ac, { reactionWallSec: 10, timeScale: LESSON_TIME_SCALE });
          expect(
            t,
            `${difficulty}/${seed} ${ac.callsign} simulated exit ${t.toFixed(1)}s wall`,
          ).toBeLessThanOrEqual(LESSON_BUDGET_WALL_SEC);
        }
      }
    }
  });

  it('even at 1x a lesson aircraft can still finish in a reasonable time (<= 7.5 min straight-line)', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const scenario = buildLocalScenario(difficulty, seed);
        for (const ac of scenario.aircraft) {
          const t = crossingTimeWallSeconds(distToGateNm(ac), ac.speed, 1);
          expect(
            t,
            `${difficulty}/${seed} ${ac.callsign} at 1x = ${t.toFixed(0)}s wall`,
          ).toBeLessThanOrEqual(450);
        }
      }
    }
  });

  it('lesson spawns are inside the ring, clear of the gate, need a vector, and stay separated', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const scenario = buildLocalScenario(difficulty, seed);
        const all = scenario.aircraft;
        for (const ac of all) {
          expect(distFromCenter(ac.x, ac.y), `${difficulty}/${seed} ${ac.callsign} inside ring`).toBeLessThan(
            GATE_RADIUS,
          );
          expect(distToGateNm(ac), `${difficulty}/${seed} ${ac.callsign} clear of gate`).toBeGreaterThanOrEqual(6);
          const turn = turnToGateDeg(ac);
          expect(turn, `${difficulty}/${seed} ${ac.callsign} turn to gate ${turn} deg`).toBeGreaterThanOrEqual(10);
          expect(turn, `${difficulty}/${seed} ${ac.callsign} turn to gate ${turn} deg`).toBeLessThanOrEqual(90);
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

  it('lesson scenarios still carry the right aircraft counts (Trainee 4, Controller 8, Veteran 12)', () => {
    expect(buildLocalScenario('Easy', 'trainee-1').aircraft).toHaveLength(4);
    expect(buildLocalScenario('Medium', 'controller-1').aircraft).toHaveLength(8);
    expect(buildLocalScenario('Hard', 'veteran-1').aircraft).toHaveLength(12);
  });
});
