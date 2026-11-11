/**
 * Free in-browser speech recognition for Expo Mode.
 *
 * Primary: Web Speech API (SpeechRecognition / webkitSpeechRecognition) with
 * ATC SpeechGrammarList hints when supported.
 *
 * Opt-in Accurate speech (beta): local Whisper via transformers.js — see webWhisper.ts.
 * Typed input and tap-to-command remain the always-available fallback.
 */

import { buildAtcSpeechGrammarList } from './speechGrammar';

export type SpeechEngine = 'webspeech' | 'unavailable';

export interface SpeechRecognitionHandle {
  engine: SpeechEngine;
  supported: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  /** Refresh grammar bias for the current scope (callsigns change). */
  setCallsigns?: (callsigns: string[]) => void;
}

export interface SpeechResultPayload {
  transcript: string;
  alternatives: Array<{ transcript: string; confidence: number }>;
  isFinal: boolean;
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

function collectAlternatives(result: SpeechRecognitionResult): Array<{ transcript: string; confidence: number }> {
  const out: Array<{ transcript: string; confidence: number }> = [];
  const n = Math.min(result.length, 5);
  for (let i = 0; i < n; i++) {
    const alt = result[i];
    if (!alt?.transcript) continue;
    out.push({
      transcript: alt.transcript,
      confidence: typeof alt.confidence === 'number' ? alt.confidence : 0,
    });
  }
  return out;
}

function applyGrammars(recognition: SpeechRecognition, callsigns: string[]) {
  const list = buildAtcSpeechGrammarList(callsigns);
  if (!list) return;
  try {
    recognition.grammars = list;
  } catch {
    /* some engines reject grammars */
  }
}

export function createSpeechRecognition(handlers: {
  onPartial?: (payload: SpeechResultPayload) => void;
  onFinal?: (payload: SpeechResultPayload) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  /** Initial scope callsigns for SpeechGrammarList bias. */
  callsigns?: string[];
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

  let callsigns = handlers.callsigns ? [...handlers.callsigns] : [];
  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;
  applyGrammars(recognition, callsigns);

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let interimAlts: Array<{ transcript: string; confidence: number }> = [];
    let finalText = '';
    let finalAlts: Array<{ transcript: string; confidence: number }> = [];

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alts = collectAlternatives(result);
      const text = alts[0]?.transcript ?? '';
      if (result.isFinal) {
        finalText += `${text} `;
        finalAlts = alts.length ? alts : finalAlts;
      } else {
        interim += text;
        interimAlts = alts.length ? alts : interimAlts;
      }
    }

    if (interim.trim()) {
      handlers.onPartial?.({
        transcript: interim.trim(),
        alternatives: interimAlts.length ? interimAlts : [{ transcript: interim.trim(), confidence: 0 }],
        isFinal: false,
      });
    }
    if (finalText.trim()) {
      const primary = finalText.trim();
      const alts = finalAlts.length
        ? finalAlts
        : [{ transcript: primary, confidence: 0 }];
      if (alts[0]?.transcript !== primary) {
        alts.unshift({ transcript: primary, confidence: alts[0]?.confidence ?? 0 });
      }
      handlers.onFinal?.({
        transcript: primary,
        alternatives: alts.slice(0, 5),
        isFinal: true,
      });
    }
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
    setCallsigns: (next) => {
      callsigns = [...next];
      applyGrammars(recognition, callsigns);
    },
    start: () => {
      applyGrammars(recognition, callsigns);
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
