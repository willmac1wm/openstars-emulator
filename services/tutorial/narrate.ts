/**
 * Instructor narration — natural Kokoro when loaded+warmed; Web Speech until then.
 * Captions always show in the overlay; audio must never block step advance.
 */
import {
  isInstructorNaturalReady,
  prewarmInstructorLine,
  speakInstructorLine,
  stopInstructorAudio,
  subscribeVoiceRuntime,
} from '../pilotVoice';

export type InstructorEngine = 'kokoro' | 'webspeech';

let lastEngine: InstructorEngine = 'webspeech';
const engineListeners = new Set<(engine: InstructorEngine) => void>();

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

/** Prefer natural voice once ready; fall back to Web Speech within ~2s on stall. */
export function speakInstructor(
  text: string,
  opts?: { rate?: number; onend?: () => void; prewarmNext?: string },
): void {
  if (!text) {
    opts?.onend?.();
    return;
  }
  narrationLog.push(text);
  if (typeof window !== 'undefined') {
    (window as Window & { __tutorialNarrations?: string[] }).__tutorialNarrations = [...narrationLog];
  }
  const natural = isInstructorNaturalReady();
  setEngine(natural ? 'kokoro' : 'webspeech');
  speakInstructorLine(text, {
    rate: opts?.rate ?? 1.05,
    onend: opts?.onend,
    prewarmNext: opts?.prewarmNext,
    /** Stall budget before falling back to Web Speech for this line. */
    kokoroBudgetMs: 2_000,
  });
}

export function stopInstructorSpeech(): void {
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
