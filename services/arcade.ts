import { Aircraft, AlertLevel, GameScenario } from '../types';
import { CENTER, GATE_RADIUS } from '../constants';
import { createSeededRandom, seedFromLabel } from './seededRandom';

export const ARCADE_DURATION_MS = 5 * 60 * 1000;
export const ATTRACT_IDLE_MS = 60 * 1000;

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
    status: dist <= GATE_RADIUS ? 'ACTIVE' : 'INBOUND',
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
  const curveballKinds: CurveballKind[] = ['nordo', 'goaround'];
  const kind = curveballKinds[Math.floor(random() * curveballKinds.length)];

  // Spawn inside the scope ring at brisk speeds (270–295 kts) aimed near their target gates
  // so players can vector and clear Wave 1 within ~45–60 seconds.
  const wave1 = [
    makeAc('AAL421', 'A321', 140, GATE_RADIUS - 110, 185, 80, 280, 'SOU'),
    makeAc('UAL123', 'B738', 235, GATE_RADIUS - 100, 275, 90, 285, 'WES'),
  ];
  const wave2 = [
    makeAc('DAL456', 'B737', 55, GATE_RADIUS - 95, 110, 80, 275, 'EAS'),
    makeAc('SWA890', 'B738', 330, GATE_RADIUS - 90, 40, 70, 280, 'NOR'),
  ];
  const wave3 = [
    makeAc('JBU512', 'A320', 150, GATE_RADIUS - 85, 200, 90, 290, 'SOU'),
    makeAc('ASA188', 'B739', 60, GATE_RADIUS - 80, 115, 85, 280, 'EAS'),
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
    waves: [wave1, wave2, wave3],
    curveball,
  };
}

export function arcadeWaveAircraft(plan: ArcadeRoundPlan, waveIndex: number): Aircraft[] {
  return (plan.waves[waveIndex] || []).map((ac) => ({ ...ac }));
}

export function spawnCurveballAircraft(plan: ArcadeRoundPlan): Aircraft | null {
  const { curveball } = plan;
  if (curveball.kind === 'nordo') {
    return makeAc('N123NR', 'C172', 180, GATE_RADIUS - 60, 0, 60, 220, 'NOR', 'nordo');
  }
  return null; // goaround mutates an existing aircraft
}

export function applyGoAround(aircraft: Aircraft[]): Aircraft[] {
  return aircraft.map((ac) => {
    if (ac.callsign !== 'AAL421' || ac.status === 'HANDOFF') return ac;
    const p = pos(80, GATE_RADIUS - 110);
    return {
      ...ac,
      x: p.x,
      y: p.y,
      heading: 100,
      targetHeading: 100,
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
    description: 'Five-minute arcade shift',
    aircraft: arcadeWaveAircraft(plan, 0),
    seedLabel: plan.seedLabel,
    mode: 'expo',
  };
}

/** JO 7110.65-style short lines for arcade events (template, not LLM). */
export function curveballPilotPhrase(kind: CurveballKind): string {
  if (kind === 'nordo') return ''; // NORDO cannot reply
  return 'Going around, American four twenty-one';
}

export function perfectHandoffPilotLine(callsign: string): string {
  return `Good day, ${callsign}`;
}
