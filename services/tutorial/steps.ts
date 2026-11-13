import {
  TUTORIAL_TARGET_CALLSIGN,
} from './scenario';

export type TutorialHighlight =
  | { kind: 'aircraft'; callsign: string }
  | { kind: 'region'; id: 'scope' | 'compass' | 'datablock' | 'gate' | 'ptt' | 'sfx' | 'conflict' | 'dial' }
  | { kind: 'control'; id: string };

export type TutorialExpect =
  | { kind: 'select'; callsign: string }
  | { kind: 'command'; match: RegExp; hint: string }
  | { kind: 'none' };

export type TutorialDemo =
  | { kind: 'point'; target: TutorialHighlight; ms?: number }
  | { kind: 'select'; callsign: string }
  | { kind: 'command'; text: string }
  | { kind: 'chime' }
  | { kind: 'wait'; ms: number };

export interface TutorialStep {
  id: string;
  /** Instructor narration (also shown as caption / transcript). */
  narration: string;
  /**
   * One explicit instruction for the trainee on your-turn steps
   * (e.g. "Tap AAL421 on the radar.").
   */
  actionPrompt?: string;
  highlight?: TutorialHighlight;
  demo?: TutorialDemo[];
  expect?: TutorialExpect;
  /** Auto-advance after narration when there is no student action (ms). */
  dwellMs?: number;
  /** When true, unfreeze sim motion for this step (default: frozen). */
  allowMotion?: boolean;
}

/**
 * ~2–3 minute kid-friendly script. Demo steps drive the virtual cursor;
 * your-turn steps wait for one explicit action.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    narration:
      'Hi! I am your instructor. OpenSTARS is a radar game — you are the air traffic controller. Tap Next when you are ready.',
    dwellMs: 0,
  },
  {
    id: 'scope',
    narration:
      'This black screen is your radar. Planes are the little chevrons. Green rings show how far they are from the middle.',
    highlight: { kind: 'region', id: 'scope' },
    dwellMs: 5000,
  },
  {
    id: 'compass',
    narration:
      'The numbers around the edge are the compass. Three-six-zero is north, zero-nine-zero is east. Headings always use three digits.',
    highlight: { kind: 'region', id: 'compass' },
    dwellMs: 5500,
  },
  {
    id: 'datablock',
    narration: `Each plane has a data block. Look at ${TUTORIAL_TARGET_CALLSIGN}: callsign on top, then altitude, then speed.`,
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    dwellMs: 5500,
  },
  {
    id: 'select-demo',
    narration: 'First, tap a plane on the radar to select it. Watch me pick American four twenty-one.',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    demo: [
      { kind: 'point', target: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN }, ms: 900 },
      { kind: 'select', callsign: TUTORIAL_TARGET_CALLSIGN },
      { kind: 'wait', ms: 700 },
    ],
  },
  {
    id: 'select-you',
    narration: 'Your turn — tap the plane labeled AAL421 on the radar.',
    actionPrompt: 'Tap AAL421 on the radar.',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    expect: { kind: 'select', callsign: TUTORIAL_TARGET_CALLSIGN },
  },
  {
    id: 'dial-intro',
    narration:
      'Use the heading dial to pick a direction — it snaps every five degrees. Dial and chips only stage a clearance. Tap ISSUE CLEARANCE (or Enter) to send it once.',
    highlight: { kind: 'control', id: 'heading-dial' },
    dwellMs: 6500,
  },
  {
    id: 'heading-demo',
    narration:
      'Watch me turn American four twenty-one left to heading zero niner zero. I dial, then tap ISSUE CLEARANCE. The pilot reads it back.',
    highlight: { kind: 'control', id: 'heading-dial' },
    demo: [
      { kind: 'point', target: { kind: 'control', id: 'heading-dial' }, ms: 900 },
      { kind: 'point', target: { kind: 'control', id: 'tap-issue' }, ms: 500 },
      { kind: 'command', text: 'AAL421 TL090' },
      { kind: 'wait', ms: 1600 },
    ],
  },
  {
    id: 'heading-you',
    narration: 'Your turn. Two steps — dial first, then Issue.',
    actionPrompt: 'Turn the dial to 270, then press ISSUE CLEARANCE.',
    highlight: { kind: 'control', id: 'heading-dial' },
    expect: {
      kind: 'command',
      match: /AAL421.*(H\s*270|TH\s*270|TL\s*270|TR\s*270|HEADING\s*270)/i,
      hint: 'Drag the dial until it shows H270, then press ISSUE CLEARANCE.',
    },
  },
  {
    id: 'altitude-demo',
    narration:
      'Altitude chips are A060, A070, A080, and A090. Watch me: American four twenty-one, descend and maintain six thousand — then Issue.',
    highlight: { kind: 'control', id: 'alt-60' },
    demo: [
      { kind: 'point', target: { kind: 'control', id: 'alt-60' }, ms: 600 },
      { kind: 'point', target: { kind: 'control', id: 'tap-issue' }, ms: 400 },
      { kind: 'command', text: 'AAL421 A060' },
      { kind: 'wait', ms: 1600 },
    ],
  },
  {
    id: 'altitude-you',
    narration: 'Your turn — set altitude eight thousand, then Issue.',
    actionPrompt: 'Tap 8000 (A080), then press ISSUE CLEARANCE.',
    highlight: { kind: 'control', id: 'alt-80' },
    expect: {
      kind: 'command',
      match: /AAL421.*(A\s*080|ALT\s*080)/i,
      hint: 'Tap A080 in the Altitude box, then press ISSUE CLEARANCE.',
    },
  },
  {
    id: 'speed-demo',
    narration: 'Speed chips use S for knots. Watch me assign two one zero knots, then Issue.',
    highlight: { kind: 'control', id: 'spd-210' },
    demo: [
      { kind: 'point', target: { kind: 'control', id: 'spd-210' }, ms: 600 },
      { kind: 'point', target: { kind: 'control', id: 'tap-issue' }, ms: 400 },
      { kind: 'command', text: 'AAL421 S210' },
      { kind: 'wait', ms: 1600 },
    ],
  },
  {
    id: 'speed-you',
    narration: 'Your turn — set speed two one zero, then Issue.',
    actionPrompt: 'Tap S210, then press ISSUE CLEARANCE.',
    highlight: { kind: 'control', id: 'spd-210' },
    expect: {
      kind: 'command',
      match: /AAL421.*S\s*210/i,
      hint: 'Tap S210, then press ISSUE CLEARANCE.',
    },
  },
  {
    id: 'ptt',
    narration:
      'You can also hold HOLD TO TALK (or Spacebar) and speak a clearance. Typing and the on-screen keyboard always work too.',
    highlight: { kind: 'control', id: 'ptt-button' },
    dwellMs: 5000,
  },
  {
    id: 'gate',
    narration:
      'Guide each plane to its glowing exit gate at a legal altitude — north and east gates need seven or nine thousand feet, south and west gates need six or eight thousand. The gate label on the radar shows its altitudes. Clean exits score points — and you hear a happy chime.',
    highlight: { kind: 'region', id: 'gate' },
    demo: [{ kind: 'chime' }, { kind: 'wait', ms: 900 }],
  },
  {
    id: 'separation',
    narration:
      'Keep planes three miles apart, or one thousand feet up-and-down. Too close? Blocks flash red and you hear a conflict beep until they are safe.',
    highlight: { kind: 'region', id: 'conflict' },
    dwellMs: 6000,
  },
  {
    id: 'done',
    narration:
      'You are ready! You can also type a whole clearance at once — try AAL421 TL270 A060 S210 for a turn, an altitude, and a speed in one go. Try the Expo arcade next — clear the gates, listen for readbacks, and beat the clock. Have fun, controller!',
    dwellMs: 0,
  },
];

export const TUTORIAL_IDLE_HINT_MS = 8_000;
