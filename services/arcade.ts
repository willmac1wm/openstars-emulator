import { Aircraft, GameScenario } from '../types';
import { createSeededRandom, seedFromLabel } from './seededRandom';
import {
  EXPO_SIXTY_SPAWN_DISTANCE_NM,
  EXPO_SPAWN_DISTANCE_NM,
  placeNearGateAircraft,
} from './spawnTraffic';

export const ARCADE_DURATION_MS = 5 * 60 * 1000;
/** 60-Second Challenge: one minute, escalating waves, no tutorial needed. */
export const SIXTY_SECOND_DURATION_MS = 60 * 1000;
export const ATTRACT_IDLE_MS = 60 * 1000;
/** Second plane of the opening pair arrives after this delay. */
export const ARCADE_STAGGER_MS = 12_000;

/**
 * The only curveball: NORDO (no radio). There is no runway in this game —
 * aircraft are vectored to exit gates, they do not land — so a go-around
 * makes no sense (removed Nov 2026 on William's call: "What are they going
 * around? There's no runway."). The NORDO flies itself out on a straight
 * heading; the player vectors everyone else around the silent target.
 */
export type CurveballKind = 'nordo';

export interface ArcadeCurveball {
  kind: CurveballKind;
  atMs: number;
  callsign?: string;
  banner: string;
  pilotLine?: string;
}

export interface ArcadeRoundPlan {
  name: string;
  seedLabel: string;
  durationMs: number;
  /** Parallel to waves — when each wave is added (wave 0 is t=0 initial). */
  waveAtMs: number[];
  waves: Aircraft[][];
  /** Curveballs disabled (no NORDO, no go-around). */
  curveball: ArcadeCurveball | null;
}

export function buildArcadeRound(seedLabel = 'arcade-1'): ArcadeRoundPlan {
  return buildArcadeRoundPlan(seedLabel, {
    name: 'Expo Arcade Shift',
    durationMs: ARCADE_DURATION_MS,
    distanceNm: EXPO_SPAWN_DISTANCE_NM,
    waveAtMs: [0, ARCADE_STAGGER_MS, 55_000, 105_000],
    waveCount: 4,
  });
}

/** Shared builder for the 5-min and 60-second variants of the same traffic. */
function buildArcadeRoundPlan(
  seedLabel: string,
  opts: {
    name: string;
    durationMs: number;
    distanceNm: number;
    waveAtMs: number[];
    waveCount: number;
    curveballAtMs?: number;
  },
): ArcadeRoundPlan {
  const random = createSeededRandom(seedFromLabel(seedLabel));

  const placed: Aircraft[] = [];
  const mk = (
    callsign: string,
    type: string,
    destination: string,
    altitude: number,
    speed: number,
    special?: Aircraft['special'],
  ) => {
    const ac = placeNearGateAircraft(
      { callsign, type, destination, altitude, speed, special, idPrefix: 'arcade' },
      placed,
      random,
      { distanceNm: opts.distanceNm },
    );
    placed.push(ac);
    return ac;
  };

  // Stagger opening pair: first at t=0, second ~12s later. Later waves escalate.
  const wave0 = [mk('AAL421', 'A321', 'SOU', 80, 250)];
  const wave1 = [mk('UAL123', 'B738', 'WES', 90, 255)];
  const wave2 = [
    mk('DAL456', 'B737', 'EAS', 80, 260),
    mk('SWA890', 'B738', 'NOR', 70, 250),
  ];
  const wave3 = [
    mk('JBU512', 'A320', 'SOU', 90, 265),
    mk('ASA188', 'B739', 'EAS', 85, 255),
  ];
  const waves = [wave0, wave1, wave2, wave3].slice(0, opts.waveCount);

  return {
    name: opts.name,
    seedLabel,
    durationMs: opts.durationMs,
    waveAtMs: opts.waveAtMs,
    waves,
    curveball: null,
  };
}

export function arcadeWaveAircraft(plan: ArcadeRoundPlan, waveIndex: number): Aircraft[] {
  return (plan.waves[waveIndex] || []).map((ac) => ({ ...ac }));
}

/**
 * 60-Second Challenge: 15 NM from the fix (~34–36 s wall at 250 kt, 6x)
 * and earlier waves (0 / 12 / 18 s) so aircraft aren't spawned right next
 * to their exit gate while still fitting inside the 60 s timer.
 */
export function buildSixtySecondRound(seedLabel = 'sixty-1'): ArcadeRoundPlan {
  return buildArcadeRoundPlan(seedLabel, {
    name: '60-Second Challenge',
    durationMs: SIXTY_SECOND_DURATION_MS,
    distanceNm: EXPO_SIXTY_SPAWN_DISTANCE_NM,
    waveAtMs: [0, ARCADE_STAGGER_MS, 18_000],
    waveCount: 3,
  });
}

export function spawnCurveballAircraft(_plan: ArcadeRoundPlan): Aircraft | null {
  // NORDO curveballs removed per user feedback.
  return null;
}

export function planToInitialScenario(plan: ArcadeRoundPlan): GameScenario {
  return {
    name: plan.name,
    difficulty: 'Expo',
    description: 'Five-minute arcade shift',
    aircraft: arcadeWaveAircraft(plan, 0),
    seedLabel: plan.seedLabel,
    mode: 'expo',
  };
}

export function perfectHandoffPilotLine(callsign: string): string {
  return `Good day, ${callsign}`;
}
