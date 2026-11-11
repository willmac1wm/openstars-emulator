import { Aircraft, GameScenario, ScenarioDifficulty } from '../types';
import { createSeededRandom } from './seededRandom';
import { DEFAULT_SCENARIO_SEEDS, resolveSeedInput } from './scenarioSeed';
import { placeInboundAircraft } from './spawnTraffic';

export { DEFAULT_SCENARIO_SEEDS };

const FLEET: { callsign: string; type: string; destination: string }[] = [
  { callsign: 'AAL421', type: 'A321', destination: 'SOU' },
  { callsign: 'UAL123', type: 'B738', destination: 'WES' },
  { callsign: 'DAL456', type: 'B737', destination: 'EAS' },
  { callsign: 'SWA890', type: 'B738', destination: 'NOR' },
  { callsign: 'SKW221', type: 'E175', destination: 'SOU' },
  { callsign: 'ASH310', type: 'CRJ9', destination: 'WES' },
  { callsign: 'JBU512', type: 'A320', destination: 'EAS' },
  { callsign: 'ASA188', type: 'B739', destination: 'NOR' },
  { callsign: 'FFT640', type: 'A320', destination: 'SOU' },
  { callsign: 'NKS77', type: 'A320', destination: 'WES' },
  { callsign: 'ENY334', type: 'E175', destination: 'EAS' },
  { callsign: 'RPA902', type: 'E170', destination: 'NOR' },
  { callsign: 'EDV615', type: 'CRJ9', destination: 'SOU' },
  { callsign: 'QXE248', type: 'E175', destination: 'WES' },
  { callsign: 'JIA147', type: 'CRJ9', destination: 'EAS' },
];

function aircraftCount(difficulty: ScenarioDifficulty): number {
  if (difficulty === 'Expo') return 3;
  if (difficulty === 'Easy') return 4;
  if (difficulty === 'Hard') return 12;
  return 8;
}

function normalizeDifficulty(difficulty: string): ScenarioDifficulty {
  if (difficulty === 'Expo' || difficulty === 'Easy' || difficulty === 'Hard' || difficulty === 'Medium') {
    return difficulty;
  }
  return 'Medium';
}

/**
 * Built-in traffic for the free web demo. No API key and no network.
 * All aircraft spawn on the outer ring, heading inbound, with solvable gates.
 */
export function buildLocalScenario(difficulty: string, seedLabel?: string | number): GameScenario {
  const level = normalizeDifficulty(difficulty);
  const seed = resolveSeedInput(seedLabel, level);
  const random = createSeededRandom(seed.numeric);
  const count = aircraftCount(level);
  const aircraft: Aircraft[] = [];

  for (let index = 0; index < count; index++) {
    const fleet = FLEET[index % FLEET.length];
    const altitude = 60 + ((index * 17) % 40);
    const speed = 200 + ((index * 13) % 50);
    aircraft.push(
      placeInboundAircraft(
        {
          callsign: fleet.callsign,
          type: fleet.type,
          destination: fleet.destination,
          altitude,
          speed,
          idPrefix: `local-${level}`,
        },
        aircraft,
        random,
      ),
    );
  }

  const name =
    level === 'Expo'
      ? 'Expo Hot Seat'
      : level === 'Easy'
        ? 'Trainee Sector'
        : level === 'Hard'
          ? 'Veteran Sector'
          : 'Controller Sector';

  return {
    name,
    difficulty: level,
    description:
      level === 'Expo'
        ? 'Three aircraft from the edge. Clear them through their glowing gates.'
        : `Seeded offline scenario (${seed.display}).`,
    aircraft,
    seedLabel: seed.display,
    mode: level === 'Expo' ? 'expo' : 'standard',
  };
}
