import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Lightweight stubs for speechSynthesis — verifies Safari-safe priming helpers.
 */
describe('ensureSpeechVoices / speakInstructor fallback preferences', () => {
  const voicesChanged: Array<() => void> = [];
  const fakeVoices = [
    { lang: 'en-US', name: 'Samantha', default: true, localService: true, voiceURI: 'sam' },
  ] as unknown as SpeechSynthesisVoice[];

  beforeEach(() => {
    voicesChanged.length = 0;
    let populated = false;
    vi.stubGlobal('window', {
      speechSynthesis: {
        getVoices: () => (populated ? fakeVoices : []),
        addEventListener: (type: string, cb: () => void) => {
          if (type === 'voiceschanged') voicesChanged.push(cb);
        },
        removeEventListener: (type: string, cb: () => void) => {
          if (type !== 'voiceschanged') return;
          const i = voicesChanged.indexOf(cb);
          if (i >= 0) voicesChanged.splice(i, 1);
        },
        cancel: vi.fn(),
        speak: vi.fn(),
        speaking: false,
        pending: false,
        resume: vi.fn(),
        // Test helper
        __populate: () => {
          populated = true;
          voicesChanged.slice().forEach((cb) => cb());
        },
      },
      setTimeout: (cb: () => void, ms?: number) => globalThis.setTimeout(cb, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
      AudioContext: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('waits for voiceschanged before resolving ensureSpeechVoices', async () => {
    const { ensureSpeechVoices } = await import('./pilotVoice');
    const pending = ensureSpeechVoices(500);
    // Still empty until event
    expect(window.speechSynthesis.getVoices()).toHaveLength(0);
    (window.speechSynthesis as unknown as { __populate: () => void }).__populate();
    const voices = await pending;
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0].name).toBe('Samantha');
  });
});
