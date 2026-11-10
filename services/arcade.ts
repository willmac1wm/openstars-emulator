import { Aircraft, AlertLevel, GameScenario } from '../types';
import { CENTER, GATE_RADIUS } from '../constants';
import { createSeededRandom, seedFromLabel } from './seededRandom';

export const ARCADE_DURATION_MS = 3 * 60 * 1000;
export const ATTRACT_IDLE_MS = 60 * 1000;

export type CurveballKind = 'medevac' | 'nordo' | 'goaround';

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
  waves: Aircraft[][];
  curveball: ArcadeCurveball;
}

function pos(deg: number, dist: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: CENTER + dist * Math.cos(rad), y: CENTER + dist * Math.sin(rad) };
}

function makeAc(
  callsign: string,
  type: string,
  angle: number,
  dist: number,
  heading: number,
  altitude: number,
  speed: number,
  destination: string,
  special?: Aircraft['special'],
): Aircraft {
  const p = pos(angle, dist);
  return {
    id: `arcade-${callsign}-${angle}`,
    callsign,
    type,
    x: p.x,
    y: p.y,
    heading,
    targetHeading: heading,
    altitude,
    targetAltitude: altitude,
    speed,
    targetSpeed: speed,
    history: [],
    status: 'INBOUND',
    cleared: false,
    alertLevel: AlertLevel.NONE,
    messages: [],
    isSelected: false,
    destination,
    dataBlockDir: 45,
    special,
  };
}

export function buildArcadeRound(seedLabel = 'arcade-1'): ArcadeRoundPlan {
  const random = createSeededRandom(seedFromLabel(seedLabel));
  const curveballKinds: CurveballKind[] = ['medevac', 'nordo', 'goaround'];
  const kind = curveballKinds[Math.floor(random() * curveballKinds.length)];

  const wave1 = [
    makeAc('AAL421', 'A321', 50, GATE_RADIUS + 40, 220, 100, 220, 'SOU'),
    makeAc('UAL123', 'B738', 140, GATE_RADIUS + 55, 300, 90, 230, 'WES'),
  ];
  const wave2 = [
    makeAc('DAL456', 'B737', 300, GATE_RADIUS + 80, 120, 80, 210, 'EAS'),
    makeAc('SWA890', 'B738', 210, GATE_RADIUS + 90, 30, 70, 225, 'NOR'),
  ];
  const wave3 = [
    makeAc('JBU512', 'A320', 20, GATE_RADIUS + 120, 200, 110, 240, 'SOU'),
    makeAc('ASA188', 'B739', 250, GATE_RADIUS + 130, 70, 95, 215, 'EAS'),
  ];

  let curveball: ArcadeCurveball;
  if (kind === 'medevac') {
    curveball = {
      kind,
      atMs: 55_000,
      callsign: 'MEDEVAC1',
      banner: 'CURVEBALL: MEDEVAC PRIORITY — clear Lifeguard first',
      pilotLine: 'Lifeguard one, priority traffic',
    };
  } else if (kind === 'nordo') {
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
    waves: [wave1, wave2, wave3],
    curveball,
  };
}

export function arcadeWaveAircraft(plan: ArcadeRoundPlan, waveIndex: number): Aircraft[] {
  return (plan.waves[waveIndex] || []).map((ac) => ({ ...ac }));
}

export function spawnCurveballAircraft(plan: ArcadeRoundPlan): Aircraft | null {
  const { curveball } = plan;
  if (curveball.kind === 'medevac') {
    return makeAc('MEDEVAC1', 'EC35', 100, GATE_RADIUS + 35, 280, 60, 160, 'WES', 'medevac');
  }
  if (curveball.kind === 'nordo') {
    return makeAc('N123NR', 'C172', 180, GATE_RADIUS + 50, 0, 50, 120, 'NOR', 'nordo');
  }
  return null; // goaround mutates an existing aircraft
}

export function applyGoAround(aircraft: Aircraft[]): Aircraft[] {
  return aircraft.map((ac) => {
    if (ac.callsign !== 'AAL421' || ac.status === 'HANDOFF') return ac;
    const p = pos(40, GATE_RADIUS - 40);
    return {
      ...ac,
      x: p.x,
      y: p.y,
      heading: 90,
      targetHeading: 90,
      status: 'ACTIVE',
      destination: 'EAS',
      special: 'goaround',
      handoffResult: undefined,
    };
  });
}

export function planToInitialScenario(plan: ArcadeRoundPlan): GameScenario {
  return {
    name: plan.name,
    difficulty: 'Expo',
    description: 'Three-minute arcade shift',
    aircraft: arcadeWaveAircraft(plan, 0),
    seedLabel: plan.seedLabel,
    mode: 'expo',
  };
}

/** JO 7110.65-style short lines for arcade events (template, not LLM). */
export function curveballPilotPhrase(kind: CurveballKind): string {
  if (kind === 'medevac') return 'Lifeguard one, checking in, priority';
  if (kind === 'nordo') return ''; // NORDO cannot reply
  return 'Going around, American four twenty-one';
}

export function perfectHandoffPilotLine(callsign: string): string {
  return `Good day, ${callsign}`;
}
