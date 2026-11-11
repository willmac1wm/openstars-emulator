/**
 * Instant instructor narration via Web Speech (same Fast voice path as readbacks).
 * Never blocks the UI; cancels prior utterance so Next/Replay feel snappy.
 */

export function speakInstructor(text: string, opts?: { rate?: number; onend?: () => void }): void {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
    opts?.onend?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = opts?.rate ?? 1.05;
  utter.volume = 1;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  // Prefer a clear English voice; fall back silently.
  const preferred =
    voices.find((v) => /google|samantha|daniel|microsoft|enhanced/i.test(v.name)) || voices[0];
  if (preferred) utter.voice = preferred;
  utter.onend = () => opts?.onend?.();
  utter.onerror = () => opts?.onend?.();
  window.speechSynthesis.speak(utter);
}

export function stopInstructorSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
