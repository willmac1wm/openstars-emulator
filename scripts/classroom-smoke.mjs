/**
 * Headless classroom pass: offline scenario, commands, on-screen readbacks,
 * scoring, and pilot audio (neural Kokoro or the browser fallback).
 *
 * Usage: start `npm run preview -- --host 127.0.0.1 --port 4173`, then
 * `node scripts/classroom-smoke.mjs`
 */
import { chromium } from 'playwright';

const base = process.env.OPENSTARS_URL || 'http://127.0.0.1:4173';

function gateFix(deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: 400 + 350 * Math.cos(rad), y: 400 + 350 * Math.sin(rad) };
}

const GATES = {
  NOR: gateFix(35),
  EAS: gateFix(105),
  SOU: gateFix(195),
  WES: gateFix(285),
};
const ALT = { NOR: '070', EAS: '090', SOU: '060', WES: '080' };

function headingTo(x, y, tx, ty) {
  let h = Math.atan2(tx - x, -(ty - y)) * 180 / Math.PI;
  if (h < 0) h += 360;
  return Math.round(h) % 360;
}

function pad(n) {
  return String(((n % 360) + 360) % 360).padStart(3, '0');
}

const consoleErrors = [];
const pageErrors = [];
const requests = [];
const downloads = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
await page.addInitScript(() => {
  window.__audioStarts = 0;
  window.__spoken = [];
  const orig = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    window.__audioStarts += 1;
    return orig.apply(this, args);
  };
  const synth = window.speechSynthesis;
  const speak = synth.speak.bind(synth);
  synth.speak = (utterance) => {
    window.__spoken.push(utterance.text || '');
    return speak(utterance);
  };
});

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('response', (res) => {
  const url = res.url();
  if (/posthog|generativelanguage|googleapis/i.test(url)) {
    requests.push(`${res.status()} ${url}`);
  }
  if (/huggingface|hf\.co|xethub|\.wasm|onnx|kokoro/i.test(url)) {
    const len = Number(res.headers()['content-length'] || 0);
    downloads.push({ status: res.status(), len, url: url.slice(0, 160) });
  }
});

const t0 = Date.now();
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /play as guest/i }).click();
await page.getByRole('button', { name: /trainee/i }).click();
await page.getByRole('button', { name: /initialize radar/i }).click();
await page.locator('[data-testid="flight-strip"]').first().waitFor({ timeout: 15000 });

const strips = await page.locator('[data-testid="flight-strip"]').evaluateAll((nodes) =>
  nodes.map((node) => ({
    callsign: node.getAttribute('data-callsign'),
    destination: node.getAttribute('data-destination'),
  })),
);
if (strips.length < 4) throw new Error(`Expected offline traffic, saw ${strips.length}`);
console.log('aircraft', strips.map((s) => `${s.callsign}->${s.destination}`).join(' '));

await page.getByRole('button', { name: '10x' }).click();

const input = page.locator('[data-testid="command-input"]');
async function send(command) {
  await input.fill(command);
  await input.press('Enter');
}

await send('AAL421 TL270 A070 S210');
await page.locator('[data-source="pilot"]').filter({ hasText: 'American four twenty-one' }).first().waitFor({ timeout: 5000 });
const readback = await page.locator('[data-source="pilot"]').first().innerText();
const expected = 'Turn left heading two seven zero, climb and maintain seven thousand, increase speed to two one zero knots, American four twenty-one';
if (!readback.includes(expected)) {
  throw new Error(`Readback mismatch:\n${readback}\nexpected\n${expected}`);
}
console.log('readback ok');

await send('UAL123 FOOBAR');
await page.locator('[data-source="pilot"]').filter({ hasText: 'Say again, United one twenty-three' }).waitFor({ timeout: 5000 });
await send('DAL456 H999');
await page.locator('[data-source="pilot"]').filter({ hasText: 'Unable, Delta four fifty-six' }).waitFor({ timeout: 5000 });
await send('ZZZ999 H090');
await page.locator('[data-testid="comm-log"]').filter({ hasText: 'TARGET ZZZ999 NOT FOUND' }).waitFor({ timeout: 5000 });
console.log('say again / unable / unknown ok');

const target = strips[0];
const gate = GATES[target.destination];
const alt = ALT[target.destination];
if (!gate || !alt) throw new Error(`Bad destination ${target.destination}`);

async function position(callsign) {
  const transform = await page.locator(`g[data-callsign="${callsign}"]`).getAttribute('transform');
  const match = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(transform || '');
  if (!match) throw new Error(`No position for ${callsign}: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

let pos = await position(target.callsign);
const inbound = headingTo(pos.x, pos.y, gate.x, gate.y);
await send(`${target.callsign} H${pad(inbound)} A${alt}`);
console.log(`vector ${target.callsign} H${pad(inbound)} A${alt} toward ${target.destination}`);

let voiceReadyAt = null;
let voiceEngine = 'idle';
async function noteVoice() {
  if (voiceReadyAt) return;
  const engine = await page.locator('[data-testid="voice-status"]').getAttribute('data-engine');
  const audioStarts = await page.evaluate(() => window.__audioStarts);
  const spoken = await page.evaluate(() => window.__spoken.length);
  if ((engine === 'kokoro' && audioStarts > 0) || (engine === 'webspeech' && spoken > 0)) {
    voiceReadyAt = Date.now();
    voiceEngine = engine;
    console.log(`voice ${engine} speaking ${(voiceReadyAt - t0) / 1000}s after load`);
  }
}

const vectorStart = Date.now();
let active = false;
while (Date.now() - vectorStart < 180000) {
  await noteVoice();
  const status = await page.locator(`g[data-callsign="${target.callsign}"]`).getAttribute('data-status');
  pos = await position(target.callsign);
  const dist = Math.hypot(pos.x - 400, pos.y - 400);
  if (status === 'ACTIVE' && dist < 340) {
    active = true;
    break;
  }
  await page.waitForTimeout(400);
}
if (!active) throw new Error('Aircraft never got inside the sector near the gate');

pos = await position(target.callsign);
const leave = headingTo(pos.x, pos.y, gate.x, gate.y);
await send(`${target.callsign} H${pad(leave)} A${alt}`);
console.log(`leave heading ${pad(leave)}`);

const scoreStart = Date.now();
let score = 0;
while (Date.now() - scoreStart < 180000) {
  await noteVoice();
  const text = await page.locator('[data-testid="score"]').innerText();
  score = Number((text.match(/\d+/) || ['0'])[0]);
  const log = await page.locator('[data-testid="comm-log"]').innerText();
  if (score > 0 || new RegExp(`${target.callsign} .*(CLEAN EXIT|SLOPPY EXIT|WRONG GATE|OFF COURSE|WRONG ALT)`).test(log)) {
    console.log('score result', text);
    console.log(log.split('\n').filter((line) => /EXIT|OFF COURSE|WRONG|CLEAN/.test(line)).join(' | '));
    break;
  }
  await page.waitForTimeout(500);
}
if (score <= 0) {
  const log = await page.locator('[data-testid="comm-log"]').innerText();
  throw new Error(`Score did not change.\n${log}`);
}

if (!voiceReadyAt) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && !voiceReadyAt) {
    await noteVoice();
    await page.waitForTimeout(500);
  }
}
if (!voiceReadyAt) throw new Error(`Voice engine did not speak (last ${voiceEngine})`);

const bytes = await page.evaluate(async () => {
  const entries = performance.getEntriesByType('resource');
  const interesting = entries.filter((entry) => /onnx|kokoro|huggingface|hf\.co|wasm|voice/i.test(entry.name));
  const total = interesting.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
  return {
    total,
    files: interesting.map((entry) => ({
      name: entry.name.split('/').slice(-2).join('/'),
      transfer: entry.transferSize,
      duration: Math.round(entry.duration),
    })),
  };
});
console.log('voice transfer bytes', bytes.total);
console.log(JSON.stringify(bytes.files, null, 2));
const byteSum = downloads.reduce((sum, file) => sum + file.len, 0);
console.log('content-length sum', byteSum);
downloads.forEach((file) => console.log(file.status, file.len, file.url));

const blocked = requests.filter((url) => /posthog|generativelanguage/i.test(url));
if (blocked.length) throw new Error(`Unexpected network calls:\n${blocked.join('\n')}`);
const cdn = downloads.filter((file) => /jsdelivr|unpkg/i.test(file.url));
if (cdn.length) throw new Error(`Voice runtime left the site:\n${cdn.map((file) => file.url).join('\n')}`);
if (pageErrors.length) throw new Error(`Page errors:\n${pageErrors.join('\n')}`);
const realConsole = consoleErrors.filter((line) => !/favicon/i.test(line));
if (realConsole.length) {
  console.log('CONSOLE ERRORS');
  realConsole.forEach((line) => console.log(line));
  throw new Error(`${realConsole.length} console errors`);
}

const fallback = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await fallback.addInitScript(() => {
  window.__spoken = [];
  const synth = window.speechSynthesis;
  const speak = synth.speak.bind(synth);
  synth.speak = (utterance) => {
    window.__spoken.push(utterance.text || '');
    return speak(utterance);
  };
});
await fallback.route(/huggingface|hf\.co|xethub|kokoro/i, (route) => route.abort());
const fallbackErrors = [];
fallback.on('pageerror', (err) => fallbackErrors.push(String(err)));
await fallback.goto(base, { waitUntil: 'domcontentloaded' });
await fallback.getByRole('button', { name: /play as guest/i }).click();
await fallback.getByRole('button', { name: /initialize radar/i }).click();
await fallback.locator('[data-testid="command-input"]').waitFor();
await fallback.locator('[data-testid="command-input"]').fill('AAL421 TL180');
await fallback.locator('[data-testid="command-input"]').press('Enter');
await fallback.locator('[data-source="pilot"]').filter({ hasText: 'Turn left heading one eight zero, American four twenty-one' }).waitFor({ timeout: 8000 });
const fallbackDeadline = Date.now() + 30000;
let fallbackEngine = '';
while (Date.now() < fallbackDeadline) {
  fallbackEngine = await fallback.locator('[data-testid="voice-status"]').getAttribute('data-engine');
  const spoken = await fallback.evaluate(() => window.__spoken.length);
  if (fallbackEngine === 'webspeech' && spoken > 0) break;
  await fallback.waitForTimeout(300);
}
if (fallbackEngine !== 'webspeech') {
  throw new Error(`Expected browser voice fallback, got ${fallbackEngine}. errors ${fallbackErrors.join(' | ')}`);
}
console.log('fallback ok', await fallback.evaluate(() => window.__spoken[0]));
await fallback.close();

await browser.close();
console.log('smoke ok');
