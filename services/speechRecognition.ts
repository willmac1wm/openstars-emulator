/**
 * Free in-browser speech recognition for Expo Mode.
 *
 * Primary: Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Available in Chromium-based browsers (Chrome, Edge). Safari support is
 * limited; Firefox generally lacks it. Latency is low and there is no model
 * download, which matters on a booth laptop already loading Kokoro TTS (~92MB).
 *
 * Whisper (transformers.js whisper-tiny/base.en) was evaluated and deferred:
 * another 40–150MB download plus WASM warm-up on top of Kokoro is too heavy
 * for a walk-up expo session, and recognition latency is higher. Typed input
 * and tap-to-command remain the offline fallback when SpeechRecognition is
 * missing or the mic is denied.
 */

export type SpeechEngine = 'webspeech' | 'unavailable';

export interface SpeechRecognitionHandle {
  engine: SpeechEngine;
  supported: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechCtor = new () => SpeechRecognition;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechCtor());
}

export function createSpeechRecognition(handlers: {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}): SpeechRecognitionHandle {
  const Ctor = getSpeechCtor();
  if (!Ctor) {
    return {
      engine: 'unavailable',
      supported: false,
      start: () => handlers.onError?.('Speech recognition is not available in this browser. Use tap or type.'),
      stop: () => undefined,
      abort: () => undefined,
    };
  }

  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += `${text} `;
      else interim += text;
    }
    if (interim) handlers.onPartial?.(interim.trim());
    if (finalText.trim()) handlers.onFinal?.(finalText.trim());
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      handlers.onError?.('Microphone permission denied. Use tap commands or type.');
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      handlers.onError?.(`Mic error: ${event.error}`);
    }
  };

  recognition.onend = () => handlers.onEnd?.();

  return {
    engine: 'webspeech',
    supported: true,
    start: () => {
      try {
        recognition.start();
      } catch {
        /* already started */
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
