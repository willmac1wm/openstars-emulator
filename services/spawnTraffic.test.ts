import { describe, expect, it } from 'vitest';
import { CENTER, GATE_RADIUS } from '../constants';
import { buildArcadeRound, buildSixtySecondRound, planToInitialScenario, ARCADE_STAGGER_MS } from './arcade';
import { buildLocalScenario } from './localScenario';
import {
  bearingTo,
  distFromCenter,
  isEdgeSpawn,
  isHeadingInbound,
  isInGateCorridor,
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

function assertProtectedEdgeFleetOk(
  aircraft: { x: number; y: number; heading: number; destination: string; callsign: string }[],
  label: string,
) {
  expect(aircraft.length, label).toBeGreaterThan(0);
  for (const ac of aircraft) {
    // Must spawn OUTSIDE the airspace ring, heading inbound.
    expect(isEdgeSpawn(ac), `${label} ${ac.callsign} outside ring`).toBe(true);
    expect(distFromCenter(ac.x, ac.y), `${label} ${ac.callsign} dist`).toBeGreaterThanOrEqual(GATE_RADIUS + 20);
    expect(isHeadingInbound(ac), `${label} ${ac.callsign} inbound hdg=${ac.heading}`).toBe(true);
    // Must spawn strictly in a protected dead zone BETWEEN the gates — never in a gate corridor.
    const radial = bearingTo({ x: CENTER, y: CENTER }, { x: ac.x, y: ac.y });
    expect(isInGateCorridor(radial, 8), `${label} ${ac.callsign} radial=${radial.toFixed(0)}° must not be in a gate`).toBe(false);
    expect(turnToGateDeg(ac), `${label} ${ac.callsign} turn to gate`).toBeLessThan(120);
  }
  for (let i = 0; i < aircraft.length; i++) {
    for (let j = i + 1; j < aircraft.length; j++) {
      const d = Math.hypot(aircraft[i].x - aircraft[j].x, aircraft[i].y - aircraft[j].y);
      expect(d, `${label} sep ${aircraft[i].callsign}-${aircraft[j].callsign}`).toBeGreaterThanOrEqual(SPAWN_SEP_PX - 1);
    }
  }
}

describe('spawn traffic — protected dead-zone outer-ring inbound', () => {
  it('arcade initial wave spawns outside the airspace in a protected area; stagger delay is ~12s', () => {
    const plan = buildArcadeRound('expo-booth');
    expect(plan.waveAtMs[1]).toBe(ARCADE_STAGGER_MS);
    const initial = planToInitialScenario(plan).aircraft;
    expect(initial).toHaveLength(1);
    assertProtectedEdgeFleetOk(initial, 'arcade-initial');
  });

  it('every arcade & 60-second wave spawns outside the ring in protected areas between gates', () => {
    for (const seed of SEEDS) {
      assertProtectedEdgeFleetOk(buildArcadeRound(seed).waves.flat(), `arcade:${seed}`);
      assertProtectedEdgeFleetOk(buildSixtySecondRound(seed).waves.flat(), `sixty:${seed}`);
    }
  });

  it('Trainee / Controller / Veteran / Expo local scenarios spawn outside the ring in protected areas', () => {
    for (const seed of SEEDS) {
      for (const level of ['Easy', 'Medium', 'Hard', 'Expo'] as const) {
        const scenario = buildLocalScenario(level, seed);
        assertProtectedEdgeFleetOk(scenario.aircraft, `${level}:${seed}`);
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
