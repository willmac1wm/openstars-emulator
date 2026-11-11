import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPilotVoiceForTests,
  getVoiceRuntime,
  prewarmCallsigns,
  prewarmReadback,
  speakPilot,
  splitReadbackChunks,
  useBasicVoiceNow,
  voiceStatusLabel,
} from './pilotVoice';
import { updateVoiceSettings } from './voiceSettings';

describe('pilot voice preload helpers', () => {
  beforeEach(() => {
    __resetPilotVoiceForTests();
    updateVoiceSettings({
      enabled: true, volume: 1, rate: 1, radioEffect: false, naturalVoices: false, soundEffects: true,
    });
  });

  afterEach(() => {
    __resetPilotVoiceForTests();
    vi.restoreAllMocks();
  });

  it('labels loading / fast / natural / basic states', () => {
    expect(voiceStatusLabel({
      phase: 'loading', progress: 0.42, engine: 'none', fromCache: false, warmed: false,
      loadMs: 0, device: 'none', neuralFastEnough: false, lastGenerateMs: 0,
    })).toBe('Loading pilot voices… 42%');

    expect(voiceStatusLabel({
      phase: 'ready', progress: 1, engine: 'kokoro', fromCache: false, warmed: true,
      loadMs: 12000, device: 'wasm', neuralFastEnough: false, lastGenerateMs: 2400,
    })).toBe('Fast voice ✓');

    updateVoiceSettings({ naturalVoices: true });
    expect(voiceStatusLabel({
      phase: 'ready', progress: 1, engine: 'kokoro', fromCache: true, warmed: true,
      loadMs: 800, device: 'webgpu', neuralFastEnough: true, lastGenerateMs: 180,
    })).toBe('Natural voices ready ✓ (cached)');

    expect(voiceStatusLabel({
      phase: 'fallback', progress: 1, engine: 'webspeech', fromCache: false, warmed: false,
      loadMs: 0, device: 'none', neuralFastEnough: false, lastGenerateMs: 0,
    })).toBe('Using basic voice');
  });

  it('useBasicVoiceNow flips runtime to webspeech fallback', () => {
    useBasicVoiceNow();
    const rt = getVoiceRuntime();
    expect(rt.phase).toBe('fallback');
    expect(rt.engine).toBe('webspeech');
    expect(voiceStatusLabel(rt)).toBe('Using basic voice');
  });

  it('speakPilot while not ready uses speechSynthesis immediately (no silent wait)', () => {
    const speak = vi.fn();
    class FakeUtterance {
      text: string;
      voice: unknown = null;
      rate = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('window', {
      speechSynthesis: { getVoices: () => [], speak, cancel: vi.fn() },
      AudioContext: undefined,
      requestIdleCallback: undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
    });
    vi.stubGlobal('speechSynthesis', { getVoices: () => [], speak, cancel: vi.fn() });

    const ret = speakPilot('Turn left heading two seven zero, American four twenty-one', 'AAL421');
    expect(ret).toBeUndefined();
    expect(speak).toHaveBeenCalled();
    const utter = speak.mock.calls[0][0] as { text: string };
    expect(utter.text).toContain('Turn left');
  });

  it('default fast path uses Web Speech even conceptually when naturalVoices is off', () => {
    updateVoiceSettings({ naturalVoices: false });
    const speak = vi.fn();
    class FakeUtterance {
      text: string;
      voice: unknown = null;
      rate = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('window', {
      speechSynthesis: { getVoices: () => [], speak, cancel: vi.fn() },
      AudioContext: undefined,
      requestIdleCallback: undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
    });
    vi.stubGlobal('speechSynthesis', { getVoices: () => [], speak, cancel: vi.fn() });

    speakPilot('Climb and maintain five thousand, Delta four fifty six', 'DAL456');
    expect(speak).toHaveBeenCalled();
  });

  it('splits readbacks into short chunks for streamed natural playback', () => {
    expect(splitReadbackChunks('Turn left heading two seven zero, American four twenty-one')).toEqual([
      'Turn left heading two seven zero,',
      'American four twenty-one',
    ]);
  });

  it('filters out novelty voices and prefers enhanced/natural English voices in Fast mode', () => {
    const speak = vi.fn();
    class FakeUtterance {
      text: string;
      voice: { name: string; lang: string } | null = null;
      rate = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const voices = [
      { name: 'Zarvox', lang: 'en-US' },
      { name: 'Bells', lang: 'en-US' },
      { name: 'Samantha (Enhanced)', lang: 'en-US' },
    ];
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('window', {
      speechSynthesis: { getVoices: () => voices, speak, cancel: vi.fn() },
      AudioContext: undefined,
      requestIdleCallback: undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
    });
    vi.stubGlobal('speechSynthesis', { getVoices: () => voices, speak, cancel: vi.fn() });

    speakPilot('Turn right heading zero niner zero, United one twenty', 'UAL120');
    expect(speak).toHaveBeenCalledTimes(1);
    const utter = speak.mock.calls[0][0] as FakeUtterance;
    expect(utter.voice?.name).toBe('Samantha (Enhanced)');
  });

  it('prewarmReadback and prewarmCallsigns are safe no-ops before engine ready', () => {
    expect(() => prewarmReadback('Turn left heading two seven zero, American four twenty-one', 'AAL421')).not.toThrow();
    expect(() => prewarmCallsigns(['AAL421', 'DAL88'])).not.toThrow();
  });
});
