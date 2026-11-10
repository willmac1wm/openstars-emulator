import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPilotVoiceForTests,
  getVoiceRuntime,
  speakPilot,
  useBasicVoiceNow,
  voiceStatusLabel,
} from './pilotVoice';
import { updateVoiceSettings } from './voiceSettings';

describe('pilot voice preload helpers', () => {
  beforeEach(() => {
    __resetPilotVoiceForTests();
    updateVoiceSettings({ enabled: true, volume: 1, rate: 1, radioEffect: false });
  });

  afterEach(() => {
    __resetPilotVoiceForTests();
    vi.restoreAllMocks();
  });

  it('labels loading / ready / basic states', () => {
    expect(voiceStatusLabel({ phase: 'loading', progress: 0.42, engine: 'none', fromCache: false, warmed: false, loadMs: 0 }))
      .toBe('Loading pilot voices… 42%');
    expect(voiceStatusLabel({ phase: 'ready', progress: 1, engine: 'kokoro', fromCache: false, warmed: true, loadMs: 12000 }))
      .toBe('Pilot voices ready ✓');
    expect(voiceStatusLabel({ phase: 'ready', progress: 1, engine: 'kokoro', fromCache: true, warmed: true, loadMs: 800 }))
      .toBe('Pilot voices ready ✓ (cached)');
    expect(voiceStatusLabel({ phase: 'fallback', progress: 1, engine: 'webspeech', fromCache: false, warmed: false, loadMs: 0 }))
      .toBe('Using basic voice');
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
      speechSynthesis: { getVoices: () => [], speak },
      AudioContext: undefined,
      requestIdleCallback: undefined,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      location: { origin: 'http://localhost' },
    });

    speakPilot('Turn left heading two seven zero, American four twenty-one', 'AAL421');
    expect(speak).toHaveBeenCalled();
    const utter = speak.mock.calls[0][0] as { text: string };
    expect(utter.text).toContain('Turn left');
  });
});
