/**
 * Pre-render studio-quality Kokoro-82M neural voice MP3 clips for every
 * How-to-Play tutorial step into public/audio/tutorial/<id>.mp3.
 *
 * Usage: node scripts/generate-tutorial-audio.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { KokoroTTS } from 'kokoro-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.join(ROOT, 'public/audio/tutorial');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Keep in sync with services/tutorial/steps.ts (spoken with natural pronunciation).
const LINES = [
  { id: 'welcome', text: 'Hi! I am your instructor. OpenSTARS is a radar game — you are the air traffic controller. Tap Next when you are ready.' },
  { id: 'scope', text: 'This black screen is your radar. Planes are the blue targets with speed lines. Range rings show how far they are from the middle.' },
  { id: 'compass', text: 'The numbers around the edge are the compass. Three six zero is north, zero niner zero is east. Headings always use three digits.' },
  { id: 'datablock', text: 'Each plane has a data block. Look at American four twenty-one: callsign on top, then altitude, then speed.' },
  { id: 'select-demo', text: 'First, tap a plane on the radar to select it. Watch me pick American four twenty-one.' },
  { id: 'select-you', text: 'Your turn — tap the plane labeled American four twenty-one on the radar.' },
  { id: 'dial-intro', text: 'Use the heading dial to pick a direction — it snaps every five degrees. Dial and chips only stage a clearance. Tap Issue Clearance, or press Enter, to send it once.' },
  { id: 'heading-demo', text: 'Watch me turn American four twenty-one left to heading zero niner zero. I dial, then tap Issue Clearance. The pilot reads it back.' },
  { id: 'heading-you', text: 'Your turn. Two steps — dial first, then Issue.' },
  { id: 'altitude-demo', text: 'Altitude chips are six thousand, seven thousand, eight thousand, and nine thousand. Watch me: American four twenty-one, descend and maintain six thousand — then Issue.' },
  { id: 'altitude-you', text: 'Your turn — set altitude eight thousand, then Issue.' },
  { id: 'speed-demo', text: 'Speed chips use S for knots. Watch me assign two one zero knots, then Issue.' },
  { id: 'speed-you', text: 'Your turn — set speed two one zero, then Issue.' },
  { id: 'ptt', text: 'You can also hold Hold To Talk, or Spacebar, and speak a clearance. Typing and the on-screen keyboard always work too.' },
  { id: 'gate', text: 'Guide each plane to its glowing exit gate at a legal altitude — north and east gates need seven or nine thousand feet, south and west gates need six or eight thousand. The gate label on the radar shows its altitudes. Clean exits score points — and you hear a happy chime.' },
  { id: 'separation', text: 'Keep planes three miles apart, or one thousand feet vertically. Too close? Data blocks flash red with a conflict alert and you hear a warning beep until they are safe.' },
  { id: 'done', text: 'You are ready! You can also type a whole clearance at once, or speak it on Push To Talk. Try the Expo arcade next — clear the gates, listen for readbacks, and beat the clock. Have fun, controller!' },
];

console.log('[tutorial-audio] Loading Kokoro-82M (am_michael)...');
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
});

let totalBytes = 0;
for (const line of LINES) {
  const wavPath = path.join(OUT_DIR, `${line.id}.wav`);
  const mp3Path = path.join(OUT_DIR, `${line.id}.mp3`);
  const audio = await tts.generate(line.text, { voice: 'am_michael', speed: 1.02 });
  await audio.save(wavPath);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', wavPath,
    '-ac', '1', '-ar', '24000', '-b:a', '64k',
    mp3Path,
  ]);
  fs.unlinkSync(wavPath);
  const size = fs.statSync(mp3Path).size;
  totalBytes += size;
  console.log(`[tutorial-audio] ${line.id}.mp3 (${Math.round(size / 1024)} KB)`);
}
console.log(`[tutorial-audio] Done — ${LINES.length} clips, total ${Math.round(totalBytes / 1024)} KB`);
