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
import { mapSpeechRecognitionError } from './voiceErrors';

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
  onSpeechStart?: () => void;
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
  let recognition: SpeechRecognition | null = null;
  let lastInterim: SpeechResultPayload | null = null;
  let emittedFinal = false;

  const detach = (inst: SpeechRecognition | null) => {
    if (!inst) return;
    inst.onresult = null;
    inst.onerror = null;
    inst.onend = null;
    inst.onspeechstart = null;
    try {
      inst.abort();
    } catch {
      /* ignore */
    }
  };

  const attachAndStart = () => {
    // Always use a fresh SpeechRecognition instance per PTT press so Chrome
    // never throws "Failed to execute 'start': recognition has already started".
    detach(recognition);
    const inst = new Ctor();
    inst.lang = 'en-US';
    // Single-utterance mode (continuous = false) is Chrome's fast PTT path:
    // streams interim words immediately and finalizes cleanly on release.
    inst.continuous = false;
    inst.interimResults = true;
    inst.maxAlternatives = 5;

    lastInterim = null;
    emittedFinal = false;

    inst.onspeechstart = () => {
      if (inst !== recognition) return;
      handlers.onSpeechStart?.();
    };

    inst.onresult = (event: SpeechRecognitionEvent) => {
      if (inst !== recognition) return;
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
        const payload: SpeechResultPayload = {
          transcript: interim.trim(),
          alternatives: interimAlts.length ? interimAlts : [{ transcript: interim.trim(), confidence: 0 }],
          isFinal: false,
        };
        lastInterim = payload;
        handlers.onPartial?.(payload);
      }
      if (finalText.trim()) {
        emittedFinal = true;
        lastInterim = null;
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

    inst.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (inst !== recognition) return;
      const message = mapSpeechRecognitionError(event.error);
      if (message) handlers.onError?.(message);
    };

    inst.onend = () => {
      if (inst !== recognition) return;
      // Chrome frequently stops recognition on PTT release without flipping the
      // last interim result to isFinal=true. Promote it so the command isn't dropped.
      if (!emittedFinal && lastInterim && lastInterim.transcript.trim()) {
        const promoted: SpeechResultPayload = { ...lastInterim, isFinal: true };
        lastInterim = null;
        emittedFinal = true;
        handlers.onFinal?.(promoted);
      }
      recognition = null;
      handlers.onEnd?.();
    };

    recognition = inst;
    try {
      inst.start();
    } catch (err) {
      recognition = null;
      handlers.onError?.(err instanceof Error ? `Mic failed to start: ${err.message}` : 'Mic failed to start.');
    }
  };

  return {
    engine: 'webspeech',
    supported: true,
    setCallsigns: (next) => {
      callsigns = [...next];
    },
    start: () => {
      attachAndStart();
    },
    stop: () => {
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      detach(recognition);
      recognition = null;
    },
  };
}
