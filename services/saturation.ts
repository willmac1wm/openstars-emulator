/**
 * Sector Saturation mode — endless ATC workload ramp.
 *
 * In FAA / TMU terminology, a sector is "saturated" when traffic volume
 * exceeds what a single controller can safely separate. Traffic starts
 * calm (2 aircraft at normal sim speed) and ramps up in volume by
 * shortening the interval between inbound spawns until the controller
 * either hits the red "CALL FOR HELP" (Request Relief) button or suffers
 * a Loss of Separation.
 */
import { Aircraft, GameScenario } from '../types';
import { createSeededRandom, seedFromLabel } from './seededRandom';
import { placeInboundAircraft } from './spawnTraffic';

export const SATURATION_INITIAL_COUNT = 2;
export const SATURATION_START_INTERVAL_MS = 18_000;
export const SATURATION_MIN_INTERVAL_MS = 5_000;
export const SATURATION_STEP_MS = 900;

const AIRLINES = [
  { prefix: 'AAL', types: ['A321', 'B738', 'A319'] },
  { prefix: 'UAL', types: ['B738', 'B739', 'A320'] },
  { prefix: 'DAL', types: ['B737', 'A321', 'B752'] },
  { prefix: 'SWA', types: ['B738', 'B737'] },
  { prefix: 'JBU', types: ['A320', 'A321'] },
  { prefix: 'ASA', types: ['B739', 'E175'] },
  { prefix: 'SKW', types: ['E175', 'CRJ9'] },
  { prefix: 'FFT', types: ['A320', 'A321'] },
  { prefix: 'NKS', types: ['A320', 'A319'] },
  { prefix: 'RPA', types: ['E170', 'E175'] },
  { prefix: 'ENY', types: ['E175', 'E145'] },
  { prefix: 'FDX', types: ['B763', 'B752'] },
  { prefix: 'UPS', types: ['B763', 'A306'] },
];

const GATES_LIST = ['NOR', 'EAS', 'SOU', 'WES'] as const;

/**
 * Delay (ms) before the next inbound aircraft enters the sector.
 * Starts calm (18 s) and tightens with every wave until 5 s floor.
 */
export function saturationNextIntervalMs(spawnedSoFar: number): number {
  const step = Math.max(0, spawnedSoFar - SATURATION_INITIAL_COUNT);
  return Math.max(
    SATURATION_MIN_INTERVAL_MS,
    SATURATION_START_INTERVAL_MS - step * SATURATION_STEP_MS,
  );
}

/** Generate one new inbound aircraft for Sector Saturation, separated from existing traffic. */
export function spawnSaturationAircraft(
  seedLabel: string,
  index: number,
  existing: Aircraft[],
): Aircraft {
  const random = createSeededRandom(seedFromLabel(`${seedLabel}-sat-${index}`));
  const airline = AIRLINES[Math.floor(random() * AIRLINES.length)];
  const type = airline.types[Math.floor(random() * airline.types.length)];
  const usedCallsigns = new Set(existing.map((a) => a.callsign));

  let callsign = `${airline.prefix}${100 + Math.floor(random() * 899)}`;
  for (let tries = 0; tries < 20 && usedCallsigns.has(callsign); tries++) {
    callsign = `${airline.prefix}${100 + Math.floor(random() * 899)}`;
  }

  const destination = GATES_LIST[index % GATES_LIST.length];
  // Vary starting altitudes (6000–9500 ft) and speeds (210–260 kt).
  const altitude = 60 + Math.floor(random() * 8) * 5;
  const speed = 210 + Math.floor(random() * 6) * 10;

  return placeInboundAircraft(
    {
      callsign,
      type,
      destination,
      altitude,
      speed,
      idPrefix: `sat-${index}`,
    },
    existing,
    random,
  );
}

/** Initial scenario for Sector Saturation: 2 calm inbound aircraft. */
export function buildSaturationScenario(seedLabel = 'saturation-1'): GameScenario {
  const aircraft: Aircraft[] = [];
  for (let i = 0; i < SATURATION_INITIAL_COUNT; i++) {
    aircraft.push(spawnSaturationAircraft(seedLabel, i, aircraft));
  }
  return {
    name: 'Sector Saturation',
    difficulty: 'Expo',
    description: 'Traffic volume increases until you request relief or lose separation.',
    aircraft,
    seedLabel,
    mode: 'expo',
  };
}
