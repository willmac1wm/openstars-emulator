/**
 * Short Web Audio UI chimes — no external assets, no copyrighted samples.
 * Mixed at modest gain so they never drown out pilot readbacks.
 */
import { getVoiceSettings } from './voiceSettings';

let ctx: AudioContext | null = null;

/** STARS-like Conflict Alert (CA) loop state */
let caTimer: ReturnType<typeof setInterval> | null = null;
let caActive = false;
/** 0–1; lowered while a pilot readback is speaking. */
let caDuck = 1;
let speechDuckTimer: ReturnType<typeof setTimeout> | null = null;

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

function conflictAlertOn(): boolean {
  try {
    const s = getVoiceSettings();
    // Master SFX off mutes everything including CA.
    if (s.soundEffects === false) return false;
    return s.conflictAlertSound !== false;
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
 * Softer descending tone for penalties, wrong gate, separation (one-shot).
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

/**
 * One short STARS-like Conflict Alert beep (~80 ms square-ish pulse near 1 kHz).
 * Real STARS CA is a repeating aural; we approximate with Web Audio only.
 */
function playConflictAlertBeep() {
  if (!conflictAlertOn()) return;
  unlockSoundEffects();
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;
  const master = audio.createGain();
  // Modest gain; duck further while pilot speech is active.
  master.gain.value = 0.045 * caDuck;
  master.connect(audio.destination);

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'square';
  osc.frequency.value = 980;
  // Brief pulse with a slight frequency chirp (STARS-ish urgency).
  osc.frequency.setValueAtTime(980, now);
  osc.frequency.linearRampToValueAtTime(780, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(1, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.1);
}

function stopCaTimer() {
  if (caTimer != null) {
    clearInterval(caTimer);
    caTimer = null;
  }
}

/**
 * Start/stop the repeating CA aural while any CRITICAL conflict is active.
 * Idempotent — safe to call every physics tick.
 */
export function setConflictAlertActive(active: boolean) {
  if (active === caActive) {
    // Settings may have flipped while looping — stop if muted.
    if (active && !conflictAlertOn()) {
      stopCaTimer();
      caActive = false;
    }
    return;
  }
  caActive = active;
  stopCaTimer();
  if (!active) return;
  if (!conflictAlertOn()) {
    caActive = false;
    return;
  }
  playConflictAlertBeep();
  caTimer = setInterval(() => {
    if (!caActive || !conflictAlertOn()) {
      stopCaTimer();
      caActive = false;
      return;
    }
    playConflictAlertBeep();
  }, 1000);
}

/** True while the CA loop thinks a conflict is active (tests / debug). */
export function isConflictAlertActive(): boolean {
  return caActive;
}

/**
 * Duck CA gain while a pilot readback plays so the beep never covers phraseology.
 * Auto-clears after maxMs in case an utterance end is missed.
 */
export function notifyPilotSpeechActive(active: boolean, maxMs = 12_000) {
  if (speechDuckTimer != null) {
    clearTimeout(speechDuckTimer);
    speechDuckTimer = null;
  }
  caDuck = active ? 0.28 : 1;
  if (active) {
    speechDuckTimer = setTimeout(() => {
      caDuck = 1;
      speechDuckTimer = null;
    }, maxMs);
  }
}

/** Test helper */
export function __resetSoundEffectsForTests() {
  stopCaTimer();
  caActive = false;
  caDuck = 1;
  if (speechDuckTimer != null) {
    clearTimeout(speechDuckTimer);
    speechDuckTimer = null;
  }
  ctx = null;
}
