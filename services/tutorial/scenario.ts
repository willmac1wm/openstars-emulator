import { Aircraft, AlertLevel, GameScenario } from '../../types';
import { CENTER, GATE_RADIUS } from '../../constants';

/** Deterministic 3-plane tutorial traffic — nothing surprising. */
export const TUTORIAL_SEED = 'tutorial-1';

export const TUTORIAL_TARGET_CALLSIGN = 'AAL421';
export const TUTORIAL_BUDDY_CALLSIGN = 'UAL123';
export const TUTORIAL_FAR_CALLSIGN = 'DAL456';

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
 * Three aircraft well inside the scope, clearly separated.
 * AAL421 is the student target (southbound toward SOUTH gate).
 */
export function buildTutorialScenario(): GameScenario {
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
        x: CENTER + 40,
        y: CENTER - 40,
        heading: 180,
        targetHeading: 180,
        altitude: 70,
        targetAltitude: 70,
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
        x: CENTER - 160,
        y: CENTER + 80,
        heading: 90,
        targetHeading: 90,
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
        x: CENTER + 180,
        y: CENTER + 160,
        heading: 360,
        targetHeading: 360,
        altitude: 80,
        targetAltitude: 80,
        speed: 260,
        targetSpeed: 260,
        dataBlockDir: 200,
      }),
    ],
  };
}
