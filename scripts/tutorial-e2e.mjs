/**
 * Full How-to-Play tutorial at 1024×640.
 * Asserts every step requested narration and never enters FAILED / SUMMARY.
 *
 * Usage:
 *   npm run preview -- --host 127.0.0.1 --port 4173
 *   node scripts/tutorial-e2e.mjs
 */
import { chromium } from 'playwright';

const base = process.env.OPENSTARS_URL || 'http://127.0.0.1:4173';
const VIEW = { width: 1024, height: 640 };

/** Keep in sync with services/tutorial/steps.ts */
const TUTORIAL_STEPS = [
  { id: 'welcome', narration: 'Hi! I am your instructor', dwellMs: 0 },
  { id: 'scope', narration: 'This black screen is your radar', dwellMs: 5000 },
  { id: 'compass', narration: 'The numbers around the edge are the compass', dwellMs: 5500 },
  { id: 'datablock', narration: 'Each plane has a data block', dwellMs: 5500 },
  { id: 'select-demo', narration: 'First, tap a plane on the radar', demo: true },
  { id: 'select-you', narration: 'Your turn — tap the plane labeled AAL421', expect: { kind: 'select', callsign: 'AAL421' } },
  { id: 'dial-intro', narration: 'Use the heading dial to pick a direction', dwellMs: 6500 },
  { id: 'heading-demo', narration: 'Watch me turn American four twenty-one', demo: true },
  { id: 'heading-you', narration: 'Your turn. Two steps', expect: { kind: 'command', match: /270/ } },
  { id: 'altitude-demo', narration: 'Altitude chips are A060', demo: true },
  { id: 'altitude-you', narration: 'Your turn — set altitude eight thousand', expect: { kind: 'command', match: /080/ } },
  { id: 'speed-demo', narration: 'Speed chips use S for knots', demo: true },
  { id: 'speed-you', narration: 'Your turn — set speed two one zero', expect: { kind: 'command', match: /210/ } },
  { id: 'ptt', narration: 'You can also hold HOLD TO TALK', dwellMs: 5000 },
  { id: 'gate', narration: 'Guide each plane to its glowing exit gate', demo: true },
  { id: 'separation', narration: 'Keep planes three miles apart', dwellMs: 6000 },
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

const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};

const stepId = async () =>
  page.evaluate(() => document.querySelector('[data-testid="tutorial-overlay"]')?.getAttribute('data-tutorial-step') || '');

const captionText = async () =>
  page.evaluate(() => document.querySelector('[data-testid="tutorial-caption"]')?.textContent || '');

const assertNotFailed = async () => {
  const body = await page.evaluate(() => document.body.innerText);
  if (/\bFAILED\b/.test(body)) fail(`Tutorial showed FAILED: ${body.slice(0, 280)}`);
  const summaryVisible = await page.getByText(/SHIFT COMPLETE|GAME OVER/i).count();
  const tut = await page.getByTestId('tutorial-overlay').count();
  if (summaryVisible && !tut) fail('Summary appeared while tutorial overlay gone');
};

const clickNext = async () => {
  const next = page.getByTestId('tutorial-next');
  if (await next.count()) await next.click();
};

/** SVG <g> force-clicks are unreliable; dispatch a DOM click on the live node. */
const clickAircraft = async (callsign) => {
  const ok = await page.evaluate((cs) => {
    const el = document.querySelector(`[data-testid="aircraft-${cs}"]`);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, callsign);
  if (!ok) fail(`Aircraft ${callsign} not in DOM`);
};

const waitForStep = async (id, timeoutMs = 20_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await page.getByTestId('tutorial-finish').count()) return 'finished';
    if ((await stepId()) === id) return 'ok';
    await page.waitForTimeout(120);
  }
  fail(`Timed out waiting for step ${id} (at ${await stepId()}, caption=${await captionText()})`);
  return 'fail';
};

await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 });

const howTo = page.getByTestId('how-to-play');
if (!(await howTo.count())) {
  const basic = page.getByRole('button', { name: /basic voice/i });
  if (await basic.count()) await basic.first().click();
}
await howTo.click({ timeout: 20_000 });
await page.getByTestId('tutorial-overlay').waitFor({ timeout: 20_000 });

for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
  await assertNotFailed();
  if (process.exitCode) break;
  if (await page.getByTestId('tutorial-finish').count()) break;

  const step = TUTORIAL_STEPS[i];
  console.log(`step ${i} ${step.id} at=${await stepId()}`);

  const arrived = await waitForStep(step.id);
  if (arrived !== 'ok' || process.exitCode) break;

  if (step.expect?.kind === 'select') {
    await page.getByTestId('tutorial-action-prompt').waitFor({ timeout: 8_000 });
    await clickAircraft(step.expect.callsign);
    if (i + 1 < TUTORIAL_STEPS.length) await waitForStep(TUTORIAL_STEPS[i + 1].id);
  } else if (step.expect?.kind === 'command') {
    await page.getByTestId('tutorial-action-prompt').waitFor({ timeout: 8_000 });
    const input = page.getByTestId('command-input');
    await input.click();
    let cmd = 'AAL421 ';
    if (/270/.test(String(step.expect.match))) cmd += 'TL270';
    else if (/080/.test(String(step.expect.match))) cmd += 'A080';
    else if (/210/.test(String(step.expect.match))) cmd += 'S210';
    else cmd += 'TL270';
    await input.fill(cmd);
    await page.getByTestId('command-send').click();
    if (i + 1 < TUTORIAL_STEPS.length) await waitForStep(TUTORIAL_STEPS[i + 1].id);
  } else if (step.demo) {
    // Wait for demo to auto-advance; Next only if stuck.
    const nextId = TUTORIAL_STEPS[i + 1]?.id;
    const start = Date.now();
    let advanced = false;
    while (Date.now() - start < 8_000) {
      if (await page.getByTestId('tutorial-finish').count()) {
        advanced = true;
        break;
      }
      if (nextId && (await stepId()) === nextId) {
        advanced = true;
        break;
      }
      await page.waitForTimeout(200);
    }
    if (!advanced) {
      await clickNext();
      if (nextId) await waitForStep(nextId);
    }
  } else {
    await clickNext();
    if (i + 1 < TUTORIAL_STEPS.length) await waitForStep(TUTORIAL_STEPS[i + 1].id);
  }
}

if (!process.exitCode) {
  await page.getByTestId('tutorial-finish').waitFor({ timeout: 20_000 });
  await assertNotFailed();

  const narrations = await page.evaluate(() => window.__tutorialNarrations || []);
  console.log('narration requests', narrations.length);

  const missing = [];
  for (const step of TUTORIAL_STEPS) {
    if (step.id === 'done') continue;
    const hit = narrations.some((n) => typeof n === 'string' && n.includes(step.narration.slice(0, 18)));
    if (!hit) missing.push(step.id);
  }
  if (missing.length) fail(`Narration not requested for steps: ${missing.join(', ')}`);
  else console.log('OK: narration requested for every instructional step');

  if (await page.getByTestId('soft-keyboard-toggle').count()) console.log('OK: soft-keyboard toggle present');
  else fail('Missing soft-keyboard toggle');

  for (const alt of [60, 70, 80, 90]) {
    if (!(await page.getByTestId(`alt-${alt}`).count())) fail(`Missing altitude chip alt-${alt}`);
  }
  console.log('OK: altitude chips A060–A090 present');
}

await browser.close();
if (!process.exitCode) console.log('PASS tutorial-e2e');
