import {
  TUTORIAL_TARGET_CALLSIGN,
} from './scenario';

export type TutorialHighlight =
  | { kind: 'aircraft'; callsign: string }
  | { kind: 'region'; id: 'scope' | 'compass' | 'datablock' | 'gate' | 'ptt' | 'sfx' | 'conflict' }
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
  /** Instructor narration (also shown as caption). */
  narration: string;
  /** Your-turn prompt shown under the caption when waiting for the student. */
  actionPrompt?: string;
  highlight?: TutorialHighlight;
  demo?: TutorialDemo[];
  expect?: TutorialExpect;
  /** Auto-advance after narration when there is no student action (ms). */
  dwellMs?: number;
}

/**
 * ~2–3 minute kid-friendly script with correct JO 7110.65-style phraseology.
 * Demo steps run the virtual cursor; action steps wait for the student.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    narration:
      'Hi! I am your instructor. This is OpenSTARS — a radar game where you are the air traffic controller. We will learn the scope together. Tap Next when you are ready.',
    dwellMs: 0,
  },
  {
    id: 'scope',
    narration:
      'This black screen is your radar scope. Aircraft show as little chevrons. The green rings are range rings — distance from the center of your airspace.',
    highlight: { kind: 'region', id: 'scope' },
    dwellMs: 5500,
  },
  {
    id: 'compass',
    narration:
      'Around the edge is the compass rose. Three-six-zero is north, zero-nine-zero is east, one-eight-zero is south, two-seven-zero is west. Controllers always say headings in three digits.',
    highlight: { kind: 'region', id: 'compass' },
    dwellMs: 6500,
  },
  {
    id: 'datablock',
    narration: `Each plane has a data block. Look at ${TUTORIAL_TARGET_CALLSIGN}: the top line is the callsign, then altitude in hundreds of feet, then speed in knots.`,
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    dwellMs: 6000,
  },
  {
    id: 'select-demo',
    narration: 'First, select an aircraft by tapping its target on the scope. Watch me select American four twenty-one.',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    demo: [
      { kind: 'point', target: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN }, ms: 900 },
      { kind: 'select', callsign: TUTORIAL_TARGET_CALLSIGN },
      { kind: 'wait', ms: 700 },
    ],
  },
  {
    id: 'select-you',
    narration: 'Your turn! Tap American four twenty-one on the scope so it is selected.',
    actionPrompt: 'Tap AAL421 on the scope',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    expect: { kind: 'select', callsign: TUTORIAL_TARGET_CALLSIGN },
  },
  {
    id: 'heading-demo',
    narration:
      'To turn a plane, give a heading. Watch me: American four twenty-one, turn left heading one eight zero. The pilot will read it back.',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    demo: [
      { kind: 'point', target: { kind: 'control', id: 'command-input' }, ms: 600 },
      { kind: 'command', text: 'AAL421 TL180' },
      { kind: 'wait', ms: 1600 },
    ],
  },
  {
    id: 'heading-you',
    narration:
      'Your turn. Give American four twenty-one a turn to heading two seven zero. You can type AAL421 H270 or use the heading buttons, then issue the clearance.',
    actionPrompt: 'Issue a heading of 270 for AAL421',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    expect: {
      kind: 'command',
      match: /AAL421.*(H\s*270|TH\s*270|TL\s*270|TR\s*270|HEADING\s*270)/i,
      hint: 'Try: AAL421 H270  — then press Issue / Enter',
    },
  },
  {
    id: 'altitude-demo',
    narration:
      'Altitude is said in hundreds of feet. A060 means six thousand. Watch me: American four twenty-one, descend and maintain six thousand.',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    demo: [
      { kind: 'command', text: 'AAL421 A060' },
      { kind: 'wait', ms: 1600 },
    ],
  },
  {
    id: 'altitude-you',
    narration: 'Your turn. Clear American four twenty-one to altitude A070 — seven thousand feet.',
    actionPrompt: 'Issue A070 for AAL421',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    expect: {
      kind: 'command',
      match: /AAL421.*(A\s*070|ALT\s*070|070)/i,
      hint: 'Try: AAL421 A070',
    },
  },
  {
    id: 'speed-demo',
    narration: 'Speed uses S for knots. Watch me: American four twenty-one, reduce speed to two one zero knots.',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    demo: [
      { kind: 'command', text: 'AAL421 S210' },
      { kind: 'wait', ms: 1600 },
    ],
  },
  {
    id: 'speed-you',
    narration: 'Your turn. Assign American four twenty-one speed S210.',
    actionPrompt: 'Issue S210 for AAL421',
    highlight: { kind: 'aircraft', callsign: TUTORIAL_TARGET_CALLSIGN },
    expect: {
      kind: 'command',
      match: /AAL421.*S\s*210/i,
      hint: 'Try: AAL421 S210',
    },
  },
  {
    id: 'ptt',
    narration:
      'In Expo mode you can also hold the big HOLD TO TALK button or the Spacebar and speak a clearance. Typing and tap buttons always work if the mic is busy.',
    highlight: { kind: 'region', id: 'ptt' },
    dwellMs: 5500,
  },
  {
    id: 'gate',
    narration:
      'Your job is to guide each plane to its glowing exit gate at a legal altitude. When they exit cleanly, you score — and you will hear a happy chime.',
    highlight: { kind: 'region', id: 'gate' },
    demo: [{ kind: 'chime' }, { kind: 'wait', ms: 900 }],
  },
  {
    id: 'separation',
    narration:
      'Keep planes at least three miles apart horizontally, or one thousand feet vertically. If they get too close, the scope turns red and you hear a warning tone. Safety first!',
    highlight: { kind: 'region', id: 'conflict' },
    dwellMs: 6000,
  },
  {
    id: 'done',
    narration:
      'You are ready! Try the Expo arcade next — clear the gates, listen for readbacks, and beat the clock. Have fun, controller!',
    dwellMs: 0,
  },
];

export const TUTORIAL_IDLE_HINT_MS = 8_000;
