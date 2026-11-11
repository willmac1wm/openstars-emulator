import { describe, expect, it } from 'vitest';
import {
  currentStep,
  initialTutorialState,
  reduceTutorial,
  stepCount,
} from './machine';
import { TUTORIAL_STEPS } from './steps';

describe('tutorial state machine', () => {
  it('starts on the welcome step in narrating phase', () => {
    const state = reduceTutorial(initialTutorialState(), { type: 'START' });
    expect(state.index).toBe(0);
    expect(state.phase).toBe('narrating');
    expect(currentStep(state)?.id).toBe('welcome');
  });

  it('advances with NEXT on narration-only steps', () => {
    let state = reduceTutorial(initialTutorialState(), { type: 'START' });
    state = reduceTutorial(state, { type: 'NEXT' });
    expect(currentStep(state)?.id).toBe('scope');
  });

  it('enters demo phase for select-demo then waiting for select-you', () => {
    let state = reduceTutorial(initialTutorialState(), { type: 'START' });
    // Jump by replaying START and advancing until select-demo
    const demoIdx = TUTORIAL_STEPS.findIndex((s) => s.id === 'select-demo');
    state = { ...state, index: demoIdx, phase: 'demo', hintVisible: false, completed: false, skipped: false };
    state = reduceTutorial(state, { type: 'DEMO_DONE' });
    // select-demo has no expect → advances to select-you waiting
    expect(currentStep(state)?.id).toBe('select-you');
    expect(state.phase).toBe('waiting');
  });

  it('advances on correct select and shows hint on wrong select', () => {
    const idx = TUTORIAL_STEPS.findIndex((s) => s.id === 'select-you');
    let state = reduceTutorial(initialTutorialState(), { type: 'START' });
    state = { ...state, index: idx, phase: 'waiting', hintVisible: false, completed: false, skipped: false };
    state = reduceTutorial(state, { type: 'SELECT', callsign: 'UAL123' });
    expect(state.phase).toBe('hint');
    expect(state.hintVisible).toBe(true);
    state = reduceTutorial(state, { type: 'SELECT', callsign: 'AAL421' });
    expect(currentStep(state)?.id).toBe('dial-intro');
  });

  it('accepts dial-issued heading (shortest TR270)', () => {
    const idx = TUTORIAL_STEPS.findIndex((s) => s.id === 'heading-you');
    let state = reduceTutorial(initialTutorialState(), { type: 'START' });
    state = { ...state, index: idx, phase: 'waiting', hintVisible: false, completed: false, skipped: false };
    state = reduceTutorial(state, { type: 'COMMAND', raw: 'AAL421 TR270' });
    expect(currentStep(state)?.id).toBe('altitude-demo');
  });

  it('accepts altitude chip A080 after demo', () => {
    const idx = TUTORIAL_STEPS.findIndex((s) => s.id === 'altitude-you');
    let state = reduceTutorial(initialTutorialState(), { type: 'START' });
    state = { ...state, index: idx, phase: 'waiting', hintVisible: false, completed: false, skipped: false };
    state = reduceTutorial(state, { type: 'COMMAND', raw: 'AAL421 A080' });
    expect(currentStep(state)?.id).toBe('speed-demo');
  });

  it('shows idle hint after timeout while waiting', () => {
    const idx = TUTORIAL_STEPS.findIndex((s) => s.id === 'altitude-you');
    let state = reduceTutorial(initialTutorialState(), { type: 'START' });
    state = { ...state, index: idx, phase: 'waiting', hintVisible: false, completed: false, skipped: false };
    state = reduceTutorial(state, { type: 'IDLE_TIMEOUT' });
    expect(state.phase).toBe('hint');
    expect(state.hintVisible).toBe(true);
  });

  it('includes dial-intro before heading practice', () => {
    const dial = TUTORIAL_STEPS.findIndex((s) => s.id === 'dial-intro');
    const heading = TUTORIAL_STEPS.findIndex((s) => s.id === 'heading-you');
    expect(dial).toBeGreaterThan(-1);
    expect(dial).toBeLessThan(heading);
    expect(TUTORIAL_STEPS[heading].expect?.kind === 'command' && TUTORIAL_STEPS[heading].expect.hint).toMatch(/dial|ISSUE/i);
  });

  it('SKIP marks completed skipped', () => {
    let state = reduceTutorial(initialTutorialState(), { type: 'START' });
    state = reduceTutorial(state, { type: 'SKIP' });
    expect(state.completed).toBe(true);
    expect(state.skipped).toBe(true);
    expect(state.phase).toBe('done');
  });

  it('has a reasonable step count for a 2–3 minute script', () => {
    expect(stepCount()).toBeGreaterThanOrEqual(12);
    expect(stepCount()).toBeLessThanOrEqual(20);
  });
});
