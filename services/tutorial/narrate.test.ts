import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../pilotVoice', () => {
  let ready = false;
  let neuralFastEnough = false;
  const listeners = new Set<() => void>();
  return {
    isInstructorNaturalReady: () => ready,
    getVoiceRuntime: () => ({ neuralFastEnough }),
    speakInstructorLine: vi.fn(),
    stopInstructorAudio: vi.fn(),
    prewarmInstructorLine: vi.fn(),
    subscribeVoiceRuntime: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    __setReady: (v: boolean, fast = true) => {
      ready = v;
      neuralFastEnough = v && fast;
      listeners.forEach((l) => l());
    },
  };
});

import { getInstructorEngine, onNaturalVoiceReady, speakInstructor } from './narrate';
import * as pilotVoice from '../pilotVoice';

describe('tutorial narrate', () => {
  beforeEach(() => {
    vi.mocked(pilotVoice.speakInstructorLine).mockClear();
    (pilotVoice as unknown as { __setReady: (v: boolean) => void }).__setReady(false);
  });

  it('uses webspeech path until natural is ready', () => {
    speakInstructor('Hello controller');
    expect(pilotVoice.speakInstructorLine).toHaveBeenCalled();
    expect(getInstructorEngine()).toBe('webspeech');
  });

  it('reports kokoro once natural is ready', () => {
    (pilotVoice as unknown as { __setReady: (v: boolean) => void }).__setReady(true);
    speakInstructor('Hello again');
    expect(getInstructorEngine()).toBe('kokoro');
  });

  it('onNaturalVoiceReady fires once on transition', () => {
    const cb = vi.fn();
    onNaturalVoiceReady(cb);
    expect(cb).not.toHaveBeenCalled();
    (pilotVoice as unknown as { __setReady: (v: boolean) => void }).__setReady(true);
    expect(cb).toHaveBeenCalledTimes(1);
    (pilotVoice as unknown as { __setReady: (v: boolean) => void }).__setReady(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
