import { TUTORIAL_IDLE_HINT_MS, TUTORIAL_STEPS, TutorialStep } from './steps';

export type TutorialPhase = 'narrating' | 'demo' | 'waiting' | 'hint' | 'done';

export interface TutorialState {
  index: number;
  phase: TutorialPhase;
  hintVisible: boolean;
  completed: boolean;
  skipped: boolean;
}

export type TutorialEvent =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'REPLAY' }
  | { type: 'SKIP' }
  | { type: 'NARRATION_DONE' }
  | { type: 'DEMO_DONE' }
  | { type: 'IDLE_TIMEOUT' }
  | { type: 'SELECT'; callsign: string }
  | { type: 'COMMAND'; raw: string };

export function initialTutorialState(): TutorialState {
  return {
    index: 0,
    phase: 'narrating',
    hintVisible: false,
    completed: false,
    skipped: false,
  };
}

export function currentStep(state: TutorialState): TutorialStep | null {
  if (state.completed || state.skipped) return null;
  return TUTORIAL_STEPS[state.index] ?? null;
}

function enterStep(index: number): TutorialState {
  const step = TUTORIAL_STEPS[index];
  if (!step) {
    return { index, phase: 'done', hintVisible: false, completed: true, skipped: false };
  }
  if (step.demo && step.demo.length > 0) {
    return { index, phase: 'demo', hintVisible: false, completed: false, skipped: false };
  }
  if (step.expect && step.expect.kind !== 'none') {
    return { index, phase: 'waiting', hintVisible: false, completed: false, skipped: false };
  }
  return { index, phase: 'narrating', hintVisible: false, completed: false, skipped: false };
}

function advance(state: TutorialState): TutorialState {
  const next = state.index + 1;
  if (next >= TUTORIAL_STEPS.length) {
    return { ...state, index: next, phase: 'done', completed: true, hintVisible: false };
  }
  return enterStep(next);
}

function matchesExpect(step: TutorialStep, event: TutorialEvent): boolean {
  const expect = step.expect;
  if (!expect || expect.kind === 'none') return false;
  if (expect.kind === 'select' && event.type === 'SELECT') {
    return event.callsign.toUpperCase() === expect.callsign.toUpperCase();
  }
  if (expect.kind === 'command' && event.type === 'COMMAND') {
    const compact = event.raw.replace(/\s+/g, '').toUpperCase();
    const spaced = event.raw.toUpperCase();
    return expect.match.test(spaced) || expect.match.test(compact) || expect.match.test(event.raw);
  }
  return false;
}

/**
 * Pure tutorial state machine — advance, wait for student actions, idle hints, skip.
 */
export function reduceTutorial(state: TutorialState, event: TutorialEvent): TutorialState {
  if (state.completed && event.type !== 'START') return state;

  switch (event.type) {
    case 'START':
      return enterStep(0);

    case 'SKIP':
      return { ...state, phase: 'done', completed: true, skipped: true, hintVisible: false };

    case 'REPLAY':
      return { ...state, phase: state.phase === 'waiting' || state.phase === 'hint' ? state.phase : 'narrating', hintVisible: false };

    case 'NEXT': {
      const step = currentStep(state);
      if (!step) return state;
      // Next is only free on narrating (no expect) or after demo finished into narrating.
      if (step.expect && step.expect.kind !== 'none' && (state.phase === 'waiting' || state.phase === 'hint')) {
        return { ...state, hintVisible: true, phase: 'hint' };
      }
      return advance(state);
    }

    case 'NARRATION_DONE': {
      const step = currentStep(state);
      if (!step) return state;
      if (state.phase !== 'narrating') return state;
      if (step.expect && step.expect.kind !== 'none') {
        return { ...state, phase: 'waiting', hintVisible: false };
      }
      if (step.dwellMs === 0) {
        // Wait for explicit Next (welcome / done).
        return state;
      }
      return advance(state);
    }

    case 'DEMO_DONE': {
      const step = currentStep(state);
      if (!step || state.phase !== 'demo') return state;
      if (step.expect && step.expect.kind !== 'none') {
        return { ...state, phase: 'waiting', hintVisible: false };
      }
      return advance(state);
    }

    case 'IDLE_TIMEOUT': {
      const step = currentStep(state);
      if (!step) return state;
      if (state.phase === 'waiting' || state.phase === 'hint') {
        return { ...state, phase: 'hint', hintVisible: true };
      }
      return state;
    }

    case 'SELECT':
    case 'COMMAND': {
      const step = currentStep(state);
      if (!step) return state;
      if (state.phase !== 'waiting' && state.phase !== 'hint') return state;
      if (matchesExpect(step, event)) return advance(state);
      return { ...state, phase: 'hint', hintVisible: true };
    }

    default:
      return state;
  }
}

export function idleHintMs(): number {
  return TUTORIAL_IDLE_HINT_MS;
}

export function stepCount(): number {
  return TUTORIAL_STEPS.length;
}
