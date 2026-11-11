import { Aircraft, GameScenario } from '../types';
import { GATE_RADIUS } from '../constants';
import { createSeededRandom, seedFromLabel } from './seededRandom';
import { placeInboundAircraft, polarPos } from './spawnTraffic';

export const ARCADE_DURATION_MS = 5 * 60 * 1000;
export const ATTRACT_IDLE_MS = 60 * 1000;
/** Second plane of the opening pair arrives after this delay. */
export const ARCADE_STAGGER_MS = 12_000;

export type CurveballKind = 'nordo' | 'goaround';

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
  curveball: ArcadeCurveball;
}

export function buildArcadeRound(seedLabel = 'arcade-1'): ArcadeRoundPlan {
  const random = createSeededRandom(seedFromLabel(seedLabel));
  const curveballKinds: CurveballKind[] = ['nordo', 'goaround'];
  const kind = curveballKinds[Math.floor(random() * curveballKinds.length)];

  const placed: Aircraft[] = [];
  const mk = (
    callsign: string,
    type: string,
    destination: string,
    altitude: number,
    speed: number,
    special?: Aircraft['special'],
  ) => {
    const ac = placeInboundAircraft(
      { callsign, type, destination, altitude, speed, special, idPrefix: 'arcade' },
      placed,
      random,
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

  let curveball: ArcadeCurveball;
  if (kind === 'nordo') {
    curveball = {
      kind,
      atMs: 70_000,
      callsign: 'N123NR',
      banner: 'CURVEBALL: NORDO — no radio. Vector others around the silent target',
    };
  } else {
    curveball = {
      kind,
      atMs: 80_000,
      callsign: 'AAL421',
      banner: 'CURVEBALL: GO AROUND — American four twenty-one, break off the gate',
      pilotLine: 'Going around, American four twenty-one',
    };
  }

  return {
    name: 'Expo Arcade Shift',
    seedLabel,
    durationMs: ARCADE_DURATION_MS,
    waveAtMs: [0, ARCADE_STAGGER_MS, 55_000, 105_000],
    waves: [wave0, wave1, wave2, wave3],
    curveball,
  };
}

export function arcadeWaveAircraft(plan: ArcadeRoundPlan, waveIndex: number): Aircraft[] {
  return (plan.waves[waveIndex] || []).map((ac) => ({ ...ac }));
}

export function spawnCurveballAircraft(plan: ArcadeRoundPlan): Aircraft | null {
  const { curveball } = plan;
  if (curveball.kind === 'nordo') {
    const random = createSeededRandom(seedFromLabel(`${plan.seedLabel}-nordo`));
    return placeInboundAircraft(
      {
        callsign: 'N123NR',
        type: 'C172',
        destination: 'NOR',
        altitude: 60,
        speed: 140,
        special: 'nordo',
        idPrefix: 'arcade',
      },
      [],
      random,
    );
  }
  return null;
}

export function applyGoAround(aircraft: Aircraft[]): Aircraft[] {
  return aircraft.map((ac) => {
    if (ac.callsign !== 'AAL421' || ac.status === 'HANDOFF') return ac;
    // Re-enter from the east outer ring, heading westbound inbound — still solvable.
    const p = polarPos(90, GATE_RADIUS + 60);
    return {
      ...ac,
      x: p.x,
      y: p.y,
      heading: 270,
      targetHeading: 270,
      status: 'INBOUND',
      destination: 'WES',
      special: 'goaround',
      handoffResult: undefined,
    };
  });
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

/** JO 7110.65-style short lines for arcade events (template, not LLM). */
export function curveballPilotPhrase(kind: CurveballKind): string {
  if (kind === 'nordo') return '';
  return 'Going around, American four twenty-one';
}

export function perfectHandoffPilotLine(callsign: string): string {
  return `Good day, ${callsign}`;
}
