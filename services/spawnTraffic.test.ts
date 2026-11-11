import { describe, expect, it } from 'vitest';
import { GATE_RADIUS } from '../constants';
import { buildArcadeRound, planToInitialScenario, ARCADE_STAGGER_MS } from './arcade';
import { buildLocalScenario } from './localScenario';
import {
  distFromCenter,
  isEdgeSpawn,
  isHeadingInbound,
  SPAWN_EDGE_MIN,
  SPAWN_SEP_PX,
  turnToGateDeg,
} from './spawnTraffic';
import { createSeededRandom, seedFromLabel } from './seededRandom';

const SEEDS = [
  'expo-booth',
  'arcade-1',
  'arcade-test',
  'trainee-1',
  'controller-1',
  'veteran-1',
  '1234',
  '9999',
  'spawn-a',
  'spawn-b',
  'spawn-c',
  'spawn-d',
];

function assertFleetOk(aircraft: { x: number; y: number; heading: number; destination: string; callsign: string }[], label: string) {
  expect(aircraft.length, label).toBeGreaterThan(0);
  for (const ac of aircraft) {
    expect(isEdgeSpawn(ac), `${label} ${ac.callsign} edge`).toBe(true);
    expect(distFromCenter(ac.x, ac.y), `${label} ${ac.callsign} dist`).toBeGreaterThanOrEqual(GATE_RADIUS + 20);
    expect(distFromCenter(ac.x, ac.y), `${label} ${ac.callsign} not too far`).toBeLessThan(GATE_RADIUS + 200);
    expect(isHeadingInbound(ac), `${label} ${ac.callsign} inbound hdg=${ac.heading}`).toBe(true);
    expect(turnToGateDeg(ac), `${label} ${ac.callsign} turn to gate`).toBeLessThan(120);
  }
  for (let i = 0; i < aircraft.length; i++) {
    for (let j = i + 1; j < aircraft.length; j++) {
      const d = Math.hypot(aircraft[i].x - aircraft[j].x, aircraft[i].y - aircraft[j].y);
      expect(d, `${label} sep ${aircraft[i].callsign}-${aircraft[j].callsign}`).toBeGreaterThanOrEqual(SPAWN_SEP_PX - 1);
    }
  }
}

describe('spawn traffic — edge inbound', () => {
  it('arcade initial wave is a single edge inbound aircraft; stagger delay is ~12s', () => {
    const plan = buildArcadeRound('expo-booth');
    expect(plan.waveAtMs[1]).toBe(ARCADE_STAGGER_MS);
    expect(plan.waveAtMs[1]).toBeGreaterThanOrEqual(10_000);
    expect(plan.waveAtMs[1]).toBeLessThanOrEqual(15_000);
    const initial = planToInitialScenario(plan).aircraft;
    expect(initial).toHaveLength(1);
    assertFleetOk(initial, 'arcade-initial');
  });

  it('every arcade wave for many seeds is edge + inbound + separated', () => {
    for (const seed of SEEDS) {
      const plan = buildArcadeRound(seed);
      const all = plan.waves.flat();
      assertFleetOk(all, `arcade:${seed}`);
      // Nothing in the middle
      for (const ac of all) {
        expect(distFromCenter(ac.x, ac.y)).toBeGreaterThanOrEqual(SPAWN_EDGE_MIN - 5);
      }
    }
  });

  it('Trainee / Controller / Veteran / Expo local scenarios spawn at the edge inbound', () => {
    for (const seed of SEEDS) {
      for (const level of ['Easy', 'Medium', 'Hard', 'Expo'] as const) {
        const scenario = buildLocalScenario(level, seed);
        assertFleetOk(scenario.aircraft, `${level}:${seed}`);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = buildArcadeRound('expo-booth');
    const b = buildArcadeRound('expo-booth');
    expect(a.waves[0][0].x).toBe(b.waves[0][0].x);
    expect(a.waves[0][0].y).toBe(b.waves[0][0].y);
    expect(a.waves[0][0].heading).toBe(b.waves[0][0].heading);
    const r = createSeededRandom(seedFromLabel('x'));
    expect(r()).toBe(createSeededRandom(seedFromLabel('x'))());
  });
});
