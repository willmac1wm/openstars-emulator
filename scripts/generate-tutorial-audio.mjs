/**
 * Pre-render natural broadcast-quality neural voice MP3 clips for every
 * How-to-Play tutorial step into public/audio/tutorial/<id>.mp3.
 *
 * Uses Microsoft's en-US-AndrewMultilingualNeural voice via `uvx edge-tts`
 * for smooth, natural human inflections and pacing.
 *
 * Usage: node scripts/generate-tutorial-audio.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.join(ROOT, 'public/audio/tutorial');
fs.mkdirSync(OUT_DIR, { recursive: true });

const VOICE = process.env.TUTORIAL_VOICE || 'en-US-AndrewMultilingualNeural';

// Natural conversational punctuation (periods and commas, no em-dashes) for smooth inflections.
const LINES = [
  { id: 'welcome', text: 'Hi, I am your instructor. OpenSTARS is a radar game where you are the air traffic controller. Tap Next when you are ready.' },
  { id: 'scope', text: 'This black screen is your radar. Planes are the blue targets with speed lines, and the range rings show how far they are from the center.' },
  { id: 'compass', text: 'The numbers around the edge are the compass. Three six zero is north, and zero niner zero is east. Headings always use three digits.' },
  { id: 'datablock', text: 'Each plane has a data block. Look at American four twenty-one: callsign on top, then altitude and speed.' },
  { id: 'select-demo', text: 'First, tap a plane on the radar to select it. Watch me pick American four twenty-one.' },
  { id: 'select-you', text: 'Your turn. Tap the plane labeled American four twenty-one on the radar.' },
  { id: 'dial-intro', text: 'Use the heading dial to pick a direction. It snaps every five degrees. The dial and chips only stage a clearance. Tap Issue Clearance, or press Enter, to send it.' },
  { id: 'heading-demo', text: 'Watch me turn American four twenty-one left to heading zero niner zero. I dial, then tap Issue Clearance, and the pilot reads it back.' },
  { id: 'heading-you', text: 'Your turn. Two steps: dial first, then press Issue.' },
  { id: 'altitude-demo', text: 'Altitude chips are six thousand, seven thousand, eight thousand, and nine thousand. Watch me: American four twenty-one, descend and maintain six thousand, then Issue.' },
  { id: 'altitude-you', text: 'Your turn. Set altitude eight thousand, then press Issue.' },
  { id: 'speed-demo', text: 'Speed chips use S for knots. Watch me assign two one zero knots, then Issue.' },
  { id: 'speed-you', text: 'Your turn. Set speed two one zero, then press Issue.' },
  { id: 'ptt', text: 'You can also hold Hold To Talk, or the Spacebar, and speak a clearance out loud. Typing and the on-screen keyboard always work too.' },
  { id: 'gate', text: 'Guide each plane to its glowing exit gate at a legal altitude. North and east gates need seven or nine thousand feet. South and west gates need six or eight thousand. The gate label on the radar shows its altitudes. Clean exits score points, and you will hear a chime.' },
  { id: 'separation', text: 'Keep planes three miles apart, or one thousand feet vertically. If two planes get too close, their data blocks flash red with a conflict alert, and you will hear a warning beep until they are safe.' },
  { id: 'done', text: 'You are ready. You can also type a whole clearance at once, or speak it on Push To Talk. Try the Expo arcade next: clear the gates, listen for readbacks, and beat the clock. Have fun, controller.' },
];

console.log(`[tutorial-audio] Rendering ${LINES.length} clips with ${VOICE}...`);
let totalBytes = 0;
for (const line of LINES) {
  const mp3Path = path.join(OUT_DIR, `${line.id}.mp3`);
  execFileSync('uvx', [
    'edge-tts',
    '--voice', VOICE,
    '--rate=+0%',
    '--text', line.text,
    '--write-media', mp3Path,
  ], { stdio: 'pipe' });
  const size = fs.statSync(mp3Path).size;
  totalBytes += size;
  console.log(`[tutorial-audio] ${line.id}.mp3 (${Math.round(size / 1024)} KB)`);
}
console.log(`[tutorial-audio] Done — ${LINES.length} clips, total ${Math.round(totalBytes / 1024)} KB`);
