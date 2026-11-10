/**
 * Short Web Audio UI chimes — no external assets, no copyrighted samples.
 * Mixed at modest gain so they never duck/block pilot readbacks.
 */
import { getVoiceSettings } from './voiceSettings';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  return ctx;
}

/** Unlock / resume AudioContext on first user gesture. */
export function unlockSoundEffects() {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();
}

function effectsOn(): boolean {
  try {
    return getVoiceSettings().soundEffects !== false;
  } catch {
    return true;
  }
}

function playSequence(
  notes: Array<{ freq: number; start: number; dur: number; type?: OscillatorType; gain?: number }>,
  masterGain = 0.08,
) {
  if (!effectsOn()) return;
  unlockSoundEffects();
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.value = masterGain;
  master.connect(audio.destination);

  for (const note of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = note.type || 'sine';
    osc.frequency.value = note.freq;
    const peak = note.gain ?? 1;
    const t0 = now + note.start;
    const t1 = t0 + note.dur;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

/**
 * Pleasant rising three-note chime (~400 ms) for successful gate / handoff / landing.
 */
export function playSuccessChime() {
  playSequence(
    [
      { freq: 523.25, start: 0, dur: 0.14, type: 'sine', gain: 1 }, // C5
      { freq: 659.25, start: 0.11, dur: 0.14, type: 'sine', gain: 0.95 }, // E5
      { freq: 783.99, start: 0.22, dur: 0.2, type: 'triangle', gain: 0.85 }, // G5
    ],
    0.09,
  );
}

/**
 * Softer descending tone for penalties, wrong gate, separation.
 */
export function playFailTone() {
  playSequence(
    [
      { freq: 320, start: 0, dur: 0.16, type: 'triangle', gain: 0.7 },
      { freq: 240, start: 0.12, dur: 0.22, type: 'sine', gain: 0.55 },
    ],
    0.06,
  );
}

/** Test helper */
export function __resetSoundEffectsForTests() {
  ctx = null;
}
