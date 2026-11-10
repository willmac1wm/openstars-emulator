import { Aircraft, AlertLevel, GameScenario } from '../types';
import { CENTER, GATE_RADIUS } from '../constants';

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
  { min: 60, max: 80, exitOptions: ['SOU', 'WES'] },
  { min: 130, max: 170, exitOptions: ['NOR', 'WES'] },
  { min: 220, max: 260, exitOptions: ['NOR', 'EAS'] },
  { min: 310, max: 350, exitOptions: ['SOU', 'EAS'] },
];

function aircraftCount(difficulty: string): number {
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

/**
 * Built-in traffic for the free web demo. No API key and no network.
 * Counts follow the menu: trainee 4, controller 8, veteran 12.
 */
export function buildLocalScenario(difficulty: string): GameScenario {
  const count = aircraftCount(difficulty);
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
      const angle = Math.floor(Math.random() * (zone.max - zone.min + 1)) + zone.min;
      const dist = Math.floor(Math.random() * (maxDist - minDist + 1)) + minDist;
      const candidate = startPos(angle, dist);
      const crowded = aircraft.some((existing) => {
        const d = Math.hypot(existing.x - candidate.x, existing.y - candidate.y);
        return d < 60;
      });
      if (!crowded) {
        pos = candidate;
        heading = (angle + 180 + (Math.random() * 30 - 15) + 360) % 360;
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

  const level = difficulty === 'Easy' || difficulty === 'Hard' ? difficulty : 'Medium';
  return {
    name: 'Classroom Demo',
    difficulty: level,
    description: 'Built-in scenario. No network connection required.',
    aircraft,
  };
}
