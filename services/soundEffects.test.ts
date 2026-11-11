import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSoundEffectsForTests,
  isConflictAlertActive,
  playFailTone,
  playSuccessChime,
  setConflictAlertActive,
} from './soundEffects';
import { updateVoiceSettings } from './voiceSettings';

function stubAudio() {
  const start = vi.fn();
  const stop = vi.fn();
  const connect = vi.fn();
  const setValueAtTime = vi.fn();
  const exponentialRampToValueAtTime = vi.fn();
  const linearRampToValueAtTime = vi.fn();
  const createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: { value: 0, setValueAtTime, linearRampToValueAtTime },
    connect,
    start,
    stop,
  }));
  const createGain = vi.fn(() => ({
    gain: { value: 0, setValueAtTime, exponentialRampToValueAtTime },
    connect,
  }));
  class FakeCtx {
    currentTime = 0;
    state = 'running';
    destination = {};
    createOscillator = createOscillator;
    createGain = createGain;
    resume = vi.fn();
  }
  vi.stubGlobal('AudioContext', FakeCtx);
  vi.stubGlobal('window', { AudioContext: FakeCtx });
  return { createOscillator, start };
}

describe('soundEffects', () => {
  beforeEach(() => {
    __resetSoundEffectsForTests();
    updateVoiceSettings({
      soundEffects: true,
      conflictAlertSound: true,
      enabled: true,
    });
  });

  afterEach(() => {
    setConflictAlertActive(false);
    __resetSoundEffectsForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('plays success chime through AudioContext when SFX enabled', () => {
    const { createOscillator, start } = stubAudio();
    playSuccessChime();
    expect(createOscillator).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
  });

  it('does not play when soundEffects is off', () => {
    updateVoiceSettings({ soundEffects: false });
    const { createOscillator } = stubAudio();
    playSuccessChime();
    playFailTone();
    setConflictAlertActive(true);
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it('repeats CA beep while conflict is active and stops when cleared', () => {
    vi.useFakeTimers();
    const { createOscillator } = stubAudio();
    setConflictAlertActive(true);
    expect(isConflictAlertActive()).toBe(true);
    expect(createOscillator).toHaveBeenCalled();
    const afterFirst = createOscillator.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(createOscillator.mock.calls.length).toBeGreaterThan(afterFirst);
    setConflictAlertActive(false);
    expect(isConflictAlertActive()).toBe(false);
    const afterStop = createOscillator.mock.calls.length;
    vi.advanceTimersByTime(2000);
    expect(createOscillator.mock.calls.length).toBe(afterStop);
  });

  it('respects conflictAlertSound toggle independently of one-shot chimes', () => {
    updateVoiceSettings({ conflictAlertSound: false, soundEffects: true });
    const { createOscillator } = stubAudio();
    setConflictAlertActive(true);
    expect(createOscillator).not.toHaveBeenCalled();
    playSuccessChime();
    expect(createOscillator).toHaveBeenCalled();
  });
});
