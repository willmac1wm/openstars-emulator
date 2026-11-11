import { Aircraft, AlertLevel, GameScenario } from '../../types';
import { CENTER, GATE_RADIUS, NM_TO_PX } from '../../constants';
import { inboundHeading, polarPos } from '../spawnTraffic';

/** Deterministic 3-plane tutorial traffic — nothing surprising. */
export const TUTORIAL_SEED = 'tutorial-1';

export const TUTORIAL_TARGET_CALLSIGN = 'AAL421';
export const TUTORIAL_BUDDY_CALLSIGN = 'UAL123';
export const TUTORIAL_FAR_CALLSIGN = 'DAL456';

/** Edge ring — same corridor family as Expo/classroom spawns. */
const EDGE_DIST = GATE_RADIUS + 70; // ~42 NM from center

function plane(partial: Partial<Aircraft> & Pick<Aircraft, 'id' | 'callsign' | 'destination'>): Aircraft {
  return {
    type: 'B738',
    x: CENTER,
    y: CENTER,
    altitude: 80,
    targetAltitude: 80,
    speed: 250,
    targetSpeed: 250,
    heading: 90,
    targetHeading: 90,
    history: [],
    status: 'ACTIVE',
    alertLevel: AlertLevel.NONE,
    cleared: false,
    messages: [],
    isSelected: false,
    dataBlockDir: 40,
    ...partial,
  };
}

/**
 * Three aircraft on the outer ring, well separated (>> 3 NM / 1000 ft).
 * No opening conflict — CA beep is only discussed later in the tutorial narration.
 *
 * Layout (compass degrees from north, clockwise):
 * - AAL421 (SOU target): north edge, heading south inbound
 * - UAL123: west edge, heading east inbound
 * - DAL456: southeast edge, heading northwest inbound
 */
export function buildTutorialScenario(): GameScenario {
  const aalPos = polarPos(5, EDGE_DIST);
  const ualPos = polarPos(265, EDGE_DIST + 15);
  const dalPos = polarPos(145, EDGE_DIST + 30);

  return {
    name: 'Tutorial',
    difficulty: 'Expo',
    description: 'Guided how-to-play with three calm aircraft.',
    seedLabel: TUTORIAL_SEED,
    mode: 'expo',
    aircraft: [
      plane({
        id: 'tut-aal421',
        callsign: TUTORIAL_TARGET_CALLSIGN,
        destination: 'SOU',
        x: aalPos.x,
        y: aalPos.y,
        heading: inboundHeading(5, 0),
        targetHeading: inboundHeading(5, 0),
        altitude: 80,
        targetAltitude: 80,
        speed: 240,
        targetSpeed: 240,
        isSelected: true,
        dataBlockDir: 50,
      }),
      plane({
        id: 'tut-ual123',
        callsign: TUTORIAL_BUDDY_CALLSIGN,
        destination: 'EAS',
        type: 'A320',
        x: ualPos.x,
        y: ualPos.y,
        heading: inboundHeading(265, 0),
        targetHeading: inboundHeading(265, 0),
        altitude: 90,
        targetAltitude: 90,
        speed: 250,
        targetSpeed: 250,
        dataBlockDir: 120,
      }),
      plane({
        id: 'tut-dal456',
        callsign: TUTORIAL_FAR_CALLSIGN,
        destination: 'NOR',
        type: 'B752',
        x: dalPos.x,
        y: dalPos.y,
        heading: inboundHeading(145, -10),
        targetHeading: inboundHeading(145, -10),
        altitude: 70,
        targetAltitude: 70,
        speed: 260,
        targetSpeed: 260,
        dataBlockDir: 200,
      }),
    ],
  };
}

/** Minimum pairwise distance in the opening tutorial (for tests / sanity). */
export function tutorialMinPairDistanceNm(scenario = buildTutorialScenario()): number {
  const list = scenario.aircraft;
  let min = Infinity;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const d = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y) / NM_TO_PX;
      if (d < min) min = d;
    }
  }
  return min;
}
