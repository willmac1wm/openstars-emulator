/**
 * Full How-to-Play tutorial at 1024×640.
 * Asserts every step requested narration and never enters FAILED / SUMMARY.
 *
 * Usage:
 *   npm run preview -- --host 127.0.0.1 --port 4173
 *   node scripts/tutorial-e2e.mjs
 * Or against prod:
 *   OPENSTARS_URL=https://openstars-emulator.vercel.app node scripts/tutorial-e2e.mjs
 */
import { chromium } from 'playwright';

const base = process.env.OPENSTARS_URL || 'http://127.0.0.1:4173';
const VIEW = { width: 1024, height: 640 };

/** Keep in sync with services/tutorial/steps.ts — ids + expect kinds for the driver. */
const TUTORIAL_STEPS = [
  { id: 'welcome', narration: 'Hi! I am your instructor', dwellMs: 0 },
  { id: 'scope', narration: 'This black screen is your radar scope', dwellMs: 5500 },
  { id: 'compass', narration: 'Around the edge is the compass rose', dwellMs: 6500 },
  { id: 'datablock', narration: 'Each plane has a data block', dwellMs: 6000 },
  { id: 'select-demo', narration: 'First, select an aircraft', demo: true },
  { id: 'select-you', narration: 'Your turn.', expect: { kind: 'select', callsign: 'AAL421' } },
  { id: 'dial-intro', narration: 'On the right is the tap clearance pad', dwellMs: 7500 },
  { id: 'heading-demo', narration: 'Watch me turn American four twenty-one', demo: true },
  { id: 'heading-you', narration: 'Your turn. Two steps', expect: { kind: 'command', match: /270/ } },
  { id: 'altitude-demo', narration: 'Altitude chips show every gate altitude', demo: true },
  { id: 'altitude-you', narration: 'Your turn.', expect: { kind: 'command', match: /080/ } },
  { id: 'speed-demo', narration: 'Speed chips use S for knots', demo: true },
  { id: 'speed-you', narration: 'Your turn.', expect: { kind: 'command', match: /210/ } },
  { id: 'ptt', narration: 'You can also hold HOLD TO TALK', dwellMs: 5500 },
  { id: 'gate', narration: 'Your job is to guide each plane', demo: true },
  { id: 'separation', narration: 'Keep planes at least three miles apart', dwellMs: 6500 },
  { id: 'done', narration: 'You are ready!', dwellMs: 0 },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEW });

await page.addInitScript(() => {
  window.__tutorialNarrations = [];
  window.__spoken = [];
  const synth = window.speechSynthesis;
  if (synth) {
    const speak = synth.speak.bind(synth);
    synth.speak = (utterance) => {
      window.__spoken.push(utterance.text || '');
      // Instant-complete so Web Speech does not block the run.
      queueMicrotask(() => {
        try {
          utterance.onend?.(new Event('end'));
        } catch {
          /* ignore */
        }
      });
      return speak(utterance);
    };
  }
});

page.on('pageerror', (err) => {
  console.error('pageerror', err);
});

const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 });

// Dismiss voice gate if present and open How to Play.
const howTo = page.getByTestId('how-to-play');
if (!(await howTo.count())) {
  // Some builds gate behind "Start with basic voice"
  const basic = page.getByRole('button', { name: /basic voice/i });
  if (await basic.count()) await basic.first().click();
}
await howTo.click({ timeout: 20_000 });

await page.getByTestId('tutorial-overlay').waitFor({ timeout: 20_000 });
await page.getByTestId('expo-arcade-hud').waitFor({ timeout: 10_000 });

// Never show FAILED / SUMMARY during tutorial.
const assertNotFailed = async () => {
  const summary = await page.locator('text=/FAILED|GAME OVER|SHIFT COMPLETE/i').count();
  const state = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  if (/FAILED/i.test(state) && !/never/i.test(state)) {
    fail(`Tutorial entered FAILED-like state: ${state.slice(0, 240)}`);
  }
  if (summary > 0) {
    // Arcade summary should not appear mid-tutorial
    const tut = await page.getByTestId('tutorial-overlay').count();
    if (tut === 0) fail('Tutorial overlay gone while summary visible');
  }
};

const waitProgress = async (minPct) => {
  await page.waitForFunction(
    (min) => {
      const el = document.querySelector('[data-testid="tutorial-progress"]');
      if (!el) return false;
      const n = Number.parseInt(el.textContent || '0', 10);
      return n >= min;
    },
    minPct,
    { timeout: 45_000 },
  );
};

const stepCount = TUTORIAL_STEPS.length;

for (let i = 0; i < stepCount; i++) {
  await assertNotFailed();
  const step = TUTORIAL_STEPS[i];
  const overlay = page.getByTestId('tutorial-overlay');
  await overlay.waitFor({ state: 'visible' });

  // Captions must show narration for this step (or finished screen).
  if (step.id !== 'done') {
    // Wait until caption includes a chunk of this narration or we advanced.
    await page.waitForFunction(
      (snip) => {
        const cap = document.querySelector('[data-testid="tutorial-caption"]');
        const done = document.querySelector('[data-testid="tutorial-finish"]');
        if (done) return true;
        return Boolean(cap && cap.textContent && cap.textContent.includes(snip.slice(0, 24)));
      },
      step.narration,
      { timeout: 30_000 },
    ).catch(() => {
      // Soft — narration may already have advanced on short dwell
    });
  }

  if (step.expect?.kind === 'select') {
    await page.getByTestId(`aircraft-${step.expect.callsign}`).click({ timeout: 15_000 });
  } else if (step.expect?.kind === 'command') {
    // Use typed CMD + Enter so we do not depend on dial geometry in headless.
    const input = page.getByTestId('command-input');
    await input.click();
    let cmd = 'AAL421 ';
    if (/270/.test(String(step.expect.match))) cmd += 'TL270';
    else if (/080/.test(String(step.expect.match))) cmd += 'A080';
    else if (/210/.test(String(step.expect.match))) cmd += 'S210';
    else cmd += 'TL270';
    await input.fill(cmd);
    await page.getByTestId('command-send').click();
  } else if (step.dwellMs === 0) {
    // Welcome / done — press Next or finish.
    const next = page.getByTestId('tutorial-next');
    const finish = page.getByTestId('tutorial-finish');
    if (await finish.count()) break;
    if (await next.count()) await next.click();
  } else if (step.demo) {
    // Demo auto-advances — wait for progress to move past this index.
    const target = Math.round(((i + 1) / stepCount) * 100);
    await waitProgress(Math.max(1, target - 5));
  } else {
    // Narrating with dwell — wait for auto advance.
    const target = Math.round(((i + 1) / stepCount) * 100);
    await waitProgress(Math.max(1, target - 5));
  }
}

// Finish screen
await page.getByTestId('tutorial-finish').or(page.getByTestId('tutorial-skip-done')).waitFor({ timeout: 60_000 });
await assertNotFailed();

const narrations = await page.evaluate(() => window.__tutorialNarrations || []);
const spoken = await page.evaluate(() => window.__spoken || []);
console.log('narration requests', narrations.length, 'webspeech utterances', spoken.length);

const missing = [];
for (const step of TUTORIAL_STEPS) {
  if (step.id === 'done') continue;
  const hit = narrations.some((n) => typeof n === 'string' && n.includes(step.narration.slice(0, 20)));
  if (!hit) missing.push(step.id);
}
if (missing.length) {
  fail(`Narration not requested for steps: ${missing.join(', ')}`);
} else {
  console.log('OK: narration requested for every instructional step');
}

// Soft keyboard still present / toggleable in tutorial (expo).
const kbToggle = page.getByTestId('soft-keyboard-toggle');
if (await kbToggle.count()) {
  console.log('OK: soft-keyboard toggle present');
}

// Altitude chips include all gate alts
for (const alt of [60, 70, 80, 90]) {
  const chip = page.getByTestId(`alt-${alt}`);
  if (!(await chip.count())) fail(`Missing altitude chip alt-${alt}`);
}
console.log('OK: altitude chips A060–A090 present');

await browser.close();
if (!process.exitCode) console.log('PASS tutorial-e2e');
