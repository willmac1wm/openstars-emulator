import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSoundEffectsForTests, playFailTone, playSuccessChime } from './soundEffects';
import { updateVoiceSettings } from './voiceSettings';

describe('soundEffects', () => {
  beforeEach(() => {
    __resetSoundEffectsForTests();
    updateVoiceSettings({ soundEffects: true, enabled: true });
  });

  afterEach(() => {
    __resetSoundEffectsForTests();
    vi.restoreAllMocks();
  });

  it('plays success chime through AudioContext when SFX enabled', () => {
    const start = vi.fn();
    const stop = vi.fn();
    const connect = vi.fn();
    const setValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { value: 0 },
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

    playSuccessChime();
    expect(createOscillator).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
  });

  it('does not play when soundEffects is off', () => {
    updateVoiceSettings({ soundEffects: false });
    const createOscillator = vi.fn();
    class FakeCtx {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator = createOscillator;
      createGain = vi.fn(() => ({
        gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }));
      resume = vi.fn();
    }
    vi.stubGlobal('AudioContext', FakeCtx);
    vi.stubGlobal('window', { AudioContext: FakeCtx });

    playSuccessChime();
    playFailTone();
    expect(createOscillator).not.toHaveBeenCalled();
  });
});
