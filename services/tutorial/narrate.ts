/**
 * Instructor narration — natural Kokoro when loaded+warmed; Web Speech until then.
 * Captions always show in the overlay; audio must never block step advance.
 */
import {
  getVoiceRuntime,
  isInstructorNaturalReady,
  prewarmInstructorLine,
  speakInstructorLine,
  stopInstructorAudio,
  subscribeVoiceRuntime,
} from '../pilotVoice';
import { getVoiceSettings } from '../voiceSettings';

export type InstructorEngine = 'kokoro' | 'webspeech';

let lastEngine: InstructorEngine = 'kokoro';
const engineListeners = new Set<(engine: InstructorEngine) => void>();
let activeClip: HTMLAudioElement | null = null;

/** Track narrations requested (for E2E assertions). */
const narrationLog: string[] = [];

function setEngine(engine: InstructorEngine) {
  if (engine === lastEngine) return;
  lastEngine = engine;
  engineListeners.forEach((l) => l(engine));
}

export function getInstructorEngine(): InstructorEngine {
  return lastEngine;
}

export function subscribeInstructorEngine(listener: (engine: InstructorEngine) => void): () => void {
  engineListeners.add(listener);
  return () => engineListeners.delete(listener);
}

export function getNarrationLog(): readonly string[] {
  return narrationLog;
}

export function clearNarrationLog(): void {
  narrationLog.length = 0;
}

/** Play pre-rendered studio MP3 clip when stepId is provided; fall back to TTS otherwise. */
export function speakInstructor(
  text: string,
  opts?: { stepId?: string; rate?: number; onend?: () => void; prewarmNext?: string },
): void {
  if (!text) {
    opts?.onend?.();
    return;
  }
  narrationLog.push(text);
  if (typeof window !== 'undefined') {
    (window as Window & { __tutorialNarrations?: string[] }).__tutorialNarrations = [...narrationLog];
  }

  // Always stop any prior clip AND any prior TTS before starting a new line.
  if (activeClip) {
    try {
      activeClip.pause();
      activeClip.src = '';
    } catch {
      /* ignore */
    }
    activeClip = null;
  }
  stopInstructorAudio();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  const fallbackTts = () => {
    const natural = isInstructorNaturalReady() && getVoiceRuntime().neuralFastEnough;
    setEngine(natural ? 'kokoro' : 'webspeech');
    speakInstructorLine(text, {
      rate: opts?.rate ?? 1.05,
      onend: opts?.onend,
      prewarmNext: opts?.prewarmNext,
      kokoroBudgetMs: 3_500,
    });
  };

  if (opts?.stepId && typeof Audio !== 'undefined') {
    const settings = getVoiceSettings();
    if (!settings.enabled) {
      opts.onend?.();
      return;
    }
    stopInstructorAudio();
    const clip = new Audio(`/audio/tutorial/${opts.stepId}.mp3`);
    clip.volume = settings.volume;
    clip.onended = () => {
      if (activeClip === clip) activeClip = null;
      opts.onend?.();
    };
    clip.onerror = () => {
      if (activeClip === clip) activeClip = null;
      fallbackTts();
    };
    activeClip = clip;
    setEngine('kokoro');
    void clip.play().catch(() => {
      if (activeClip === clip) activeClip = null;
      fallbackTts();
    });
    return;
  }

  fallbackTts();
}

export function stopInstructorSpeech(): void {
  if (activeClip) {
    try {
      activeClip.pause();
      activeClip.src = '';
    } catch {
      /* ignore */
    }
    activeClip = null;
  }
  stopInstructorAudio();
}

export function prewarmInstructor(text: string): void {
  if (!text) return;
  prewarmInstructorLine(text, 1.05);
}

/**
 * Fire once when neural becomes ready mid-session (for switching tutorial narration).
 * If already ready, does nothing — the normal speak path already uses Kokoro.
 */
export function onNaturalVoiceReady(callback: () => void): () => void {
  if (isInstructorNaturalReady()) return () => undefined;
  let done = false;
  return subscribeVoiceRuntime(() => {
    if (done) return;
    if (isInstructorNaturalReady()) {
      done = true;
      callback();
    }
  });
}
