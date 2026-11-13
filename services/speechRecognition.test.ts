import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fake Web Speech recognizer: captures the handlers the service assigns so
 * we can fire onerror/onresult/onend and prove errors reach the caller.
 * (Test env is node — window is stubbed like pilotVoice.test.ts does.)
 */
type FakeInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  grammars: unknown;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

let instances: FakeInstance[] = [];

function stubWindowWithSpeech() {
  class FakeRecognition {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    grammars: unknown = null;
    onresult: ((ev: unknown) => void) | null = null;
    onerror: ((ev: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      instances.push(this as unknown as FakeInstance);
    }
  }
  vi.stubGlobal('window', { SpeechRecognition: FakeRecognition });
}

describe('speechRecognition error surfacing', () => {
  beforeEach(() => {
    instances = [];
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('surfaces no-speech instead of swallowing it', async () => {
    stubWindowWithSpeech();
    const { createSpeechRecognition } = await import('./speechRecognition');
    const onError = vi.fn();
    const handle = createSpeechRecognition({ onError });
    expect(handle.supported).toBe(true);
    handle.start();
    instances[0].onerror?.({ error: 'no-speech' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain("Didn't hear anything");
  });

  it('stays silent for aborted (normal PTT release)', async () => {
    stubWindowWithSpeech();
    const { createSpeechRecognition } = await import('./speechRecognition');
    const onError = vi.fn();
    const handle = createSpeechRecognition({ onError });
    handle.start();
    instances[0].onerror?.({ error: 'aborted' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('delivers final results to onFinal', async () => {
    stubWindowWithSpeech();
    const { createSpeechRecognition } = await import('./speechRecognition');
    const onFinal = vi.fn();
    const handle = createSpeechRecognition({ onFinal });
    handle.start();
    const result = { length: 1, isFinal: true, 0: { transcript: 'Delta four fifty six turn left heading two seven zero', confidence: 0.9 } };
    instances[0].onresult?.({ resultIndex: 0, results: [result] });
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal.mock.calls[0][0].transcript).toContain('Delta four fifty six');
    expect(onFinal.mock.calls[0][0].isFinal).toBe(true);
  });

  it('reports unsupported browsers when start() is pressed', async () => {
    vi.stubGlobal('window', {});
    const { createSpeechRecognition, isSpeechRecognitionSupported } = await import('./speechRecognition');
    expect(isSpeechRecognitionSupported()).toBe(false);
    const onError = vi.fn();
    const handle = createSpeechRecognition({ onError });
    expect(handle.supported).toBe(false);
    handle.start();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain('not available in this browser');
  });
});
