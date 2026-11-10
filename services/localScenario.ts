import { Aircraft, AlertLevel, GameScenario, ScenarioDifficulty } from '../types';
import { CENTER, GATE_RADIUS } from '../constants';
import { createSeededRandom, seedFromLabel } from './seededRandom';

const FLEET: { callsign: string; type: string }[] = [
  { callsign: 'AAL421', type: 'A321' },
  { callsign: 'UAL123', type: 'B738' },
  { callsign: 'DAL456', type: 'B737' },
  { callsign: 'SWA890', type: 'B738' },
  { callsign: 'SKW221', type: 'E175' },
  { callsign: 'ASH310', type: 'CRJ9' },
  { callsign: 'JBU512', type: 'A320' },
  { callsign: 'ASA188', type: 'B739' },
  { callsign: 'FFT640', type: 'A320' },
  { callsign: 'NKS77', type: 'A320' },
  { callsign: 'ENY334', type: 'E175' },
  { callsign: 'RPA902', type: 'E170' },
  { callsign: 'EDV615', type: 'CRJ9' },
  { callsign: 'QXE248', type: 'E175' },
  { callsign: 'JIA147', type: 'CRJ9' },
];

const SPAWN_ZONES = [
  { min: 60, max: 80, exitOptions: ['SOU', 'WES'] as const },
  { min: 130, max: 170, exitOptions: ['NOR', 'WES'] as const },
  { min: 220, max: 260, exitOptions: ['NOR', 'EAS'] as const },
  { min: 310, max: 350, exitOptions: ['SOU', 'EAS'] as const },
];

/** Fixed booth demo: three planes already close, each aimed at a different gate. */
const EXPO_SCRIPT: Array<{
  callsign: string;
  type: string;
  angle: number;
  dist: number;
  heading: number;
  altitude: number;
  speed: number;
  destination: string;
}> = [
  { callsign: 'AAL421', type: 'A321', angle: 55, dist: GATE_RADIUS + 55, heading: 215, altitude: 100, speed: 220, destination: 'SOU' },
  { callsign: 'UAL123', type: 'B738', angle: 145, dist: GATE_RADIUS + 70, heading: 310, altitude: 85, speed: 230, destination: 'WES' },
  { callsign: 'DAL456', type: 'B737', angle: 300, dist: GATE_RADIUS + 60, heading: 120, altitude: 75, speed: 210, destination: 'EAS' },
];

export const DEFAULT_SCENARIO_SEEDS: Record<ScenarioDifficulty, string> = {
  Expo: 'expo-booth',
  Easy: 'trainee-1',
  Medium: 'controller-1',
  Hard: 'veteran-1',
};

function aircraftCount(difficulty: ScenarioDifficulty): number {
  if (difficulty === 'Expo') return 3;
  if (difficulty === 'Easy') return 4;
  if (difficulty === 'Hard') return 12;
  return 8;
}

function startPos(deg: number, dist: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return {
    x: CENTER + dist * Math.cos(rad),
    y: CENTER + dist * Math.sin(rad),
  };
}

function normalizeDifficulty(difficulty: string): ScenarioDifficulty {
  if (difficulty === 'Expo' || difficulty === 'Easy' || difficulty === 'Hard' || difficulty === 'Medium') {
    return difficulty;
  }
  return 'Medium';
}

function buildExpoAircraft(): Aircraft[] {
  return EXPO_SCRIPT.map((script, index) => {
    const pos = startPos(script.angle, script.dist);
    return {
      id: `ac-expo-${index}-${script.callsign}`,
      callsign: script.callsign,
      type: script.type,
      x: pos.x,
      y: pos.y,
      heading: script.heading,
      targetHeading: script.heading,
      altitude: script.altitude,
      targetAltitude: script.altitude,
      speed: script.speed,
      targetSpeed: script.speed,
      history: [],
      status: 'INBOUND',
      cleared: false,
      alertLevel: AlertLevel.NONE,
      messages: [],
      isSelected: false,
      destination: script.destination,
      dataBlockDir: 45,
    };
  });
}

/**
 * Built-in traffic for the free web demo. No API key and no network.
 * Pass the same seedLabel to replay the same spawn pattern.
 */
export function buildLocalScenario(difficulty: string, seedLabel?: string): GameScenario {
  const level = normalizeDifficulty(difficulty);
  const label = seedLabel || DEFAULT_SCENARIO_SEEDS[level];
  const random = createSeededRandom(seedFromLabel(label));

  if (level === 'Expo') {
    return {
      name: 'Expo Hot Seat',
      difficulty: 'Expo',
      description: 'Three aircraft. Clear them through their glowing gates. About ninety seconds.',
      aircraft: buildExpoAircraft(),
      seedLabel: label,
      mode: 'expo',
    };
  }

  const count = aircraftCount(level);
  const aircraft: Aircraft[] = [];

  for (let index = 0; index < count; index++) {
    const fleet = FLEET[index % FLEET.length];
    const zone = SPAWN_ZONES[index % SPAWN_ZONES.length];

    let minDist = GATE_RADIUS + 10;
    let maxDist = GATE_RADIUS + 40;
    if (index >= 5 && index < 10) {
      minDist = GATE_RADIUS + 100;
      maxDist = GATE_RADIUS + 200;
    } else if (index >= 10) {
      minDist = GATE_RADIUS + 300;
      maxDist = GATE_RADIUS + 500;
    }

    let pos = { x: CENTER, y: CENTER };
    let heading = 0;
    let placed = false;
    for (let attempt = 0; attempt < 20 && !placed; attempt++) {
      const angle = Math.floor(random() * (zone.max - zone.min + 1)) + zone.min;
      const dist = Math.floor(random() * (maxDist - minDist + 1)) + minDist;
      const candidate = startPos(angle, dist);
      const crowded = aircraft.some((existing) => {
        const d = Math.hypot(existing.x - candidate.x, existing.y - candidate.y);
        return d < 60;
      });
      if (!crowded) {
        pos = candidate;
        heading = (angle + 180 + (random() * 30 - 15) + 360) % 360;
        placed = true;
      }
    }
    if (!placed) {
      const angle = Math.floor((zone.min + zone.max) / 2);
      pos = startPos(angle, maxDist + index * 20);
      heading = (angle + 180) % 360;
    }

    const destination = zone.exitOptions[index % zone.exitOptions.length];
    const altitude = 60 + ((index * 17) % 70);
    const speed = 190 + ((index * 13) % 50);

    aircraft.push({
      id: `ac-local-${index}-${fleet.callsign}`,
      callsign: fleet.callsign,
      type: fleet.type,
      x: pos.x,
      y: pos.y,
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
    });
  }

  return {
    name: level === 'Easy' ? 'Trainee Sector' : level === 'Hard' ? 'Veteran Sector' : 'Controller Sector',
    difficulty: level,
    description: `Seeded offline scenario (${label}).`,
    aircraft,
    seedLabel: label,
    mode: 'standard',
  };
}
