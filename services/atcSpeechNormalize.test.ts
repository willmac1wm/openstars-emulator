import { describe, expect, it } from 'vitest';
import { Aircraft, AlertLevel } from '../types';
import { repairAtcTranscript, scoreAtcTranscript } from './atcSpeechNormalize';
import {
  parseBestSpokenClearance,
  parseSpokenClearance,
  SPEECH_AUTO_ISSUE_CONFIDENCE,
} from './speechCommand';

function ac(callsign: string): Aircraft {
  return {
    id: callsign,
    callsign,
    type: 'B738',
    x: 0,
    y: 0,
    altitude: 100,
    targetAltitude: 100,
    speed: 250,
    targetSpeed: 250,
    heading: 90,
    targetHeading: 90,
    history: [],
    status: 'ACTIVE',
    alertLevel: AlertLevel.NONE,
    cleared: false,
    messages: [],
    isSelected: false,
    destination: 'SOU',
    dataBlockDir: 45,
  };
}

const scope = [
  ac('AAL421'),
  ac('UAL123'),
  ac('DAL456'),
  ac('SWA890'),
  ac('N123AB'),
];

/** Real booth phrasings + common Web Speech misrecognitions → expected typed commands. */
const CORPUS: Array<{ name: string; heard: string | string[]; expect: string | { ok: false; message?: string } }> = [
  // Exact Will production failure
  {
    name: 'unit/send/maintenance/$8000 → UAL123 A080',
    heard: 'unit 123 send and maintenance $8000',
    expect: 'UAL123 A080',
  },
  {
    name: 'united one twenty three descend and maintain eight thousand',
    heard: 'United one twenty three, descend and maintain eight thousand',
    expect: 'UAL123 A080',
  },
  {
    name: 'alternatives: pick repaired over garbage',
    heard: [
      'unit 123 send and maintenance $8000',
      'united one twenty three descend and maintain eight thousand',
      'unit 123 send and maintain 8000',
    ],
    expect: 'UAL123 A080',
  },
  {
    name: 'you knighted → united',
    heard: 'you knighted one two three descend and maintain six thousand',
    expect: 'UAL123 A060',
  },
  {
    name: 'merican → american',
    heard: 'merican four twenty one turn left heading two seven zero',
    expect: 'AAL421 TL270',
  },
  {
    name: 'maintenance → maintain',
    heard: 'Delta four fifty six climb and maintenance flight level one eight zero',
    expect: 'DAL456 A180',
  },
  {
    name: 'the send → descend',
    heard: 'Southwest eight ninety the send and maintain six thousand',
    expect: 'SWA890 A060',
  },
  {
    name: 'eight thou',
    heard: 'United 123 descend and maintain eight thou',
    expect: 'UAL123 A080',
  },
  {
    name: '8,000 feet',
    heard: 'United one twenty three descend and maintain 8,000 feet',
    expect: 'UAL123 A080',
  },
  {
    name: 'niner in heading',
    heard: 'American four twenty one turn right heading zero niner zero',
    expect: 'AAL421 TR090',
  },
  {
    name: 'fly heading',
    heard: 'United one two three fly heading two seven zero',
    expect: 'UAL123 H270',
  },
  {
    name: 'heading 270 digits',
    heard: 'Delta four five six heading 270',
    expect: 'DAL456 H270',
  },
  {
    name: 'heading to 70 → 270',
    heard: 'United one twenty three turn left heading to 70',
    expect: 'UAL123 TL270',
  },
  {
    name: 'reduce speed two one zero',
    heard: 'Southwest eight ninety reduce speed two one zero',
    expect: 'SWA890 S210',
  },
  {
    name: 'speed 210 knots',
    heard: 'American four twenty one speed 210 knots',
    expect: 'AAL421 S210',
  },
  {
    name: 'increase speed',
    heard: 'Delta four fifty six increase speed to two five zero',
    expect: 'DAL456 S250',
  },
  {
    name: 'multi-element clearance',
    heard: 'American four twenty one turn left heading two seven zero, descend and maintain six thousand, reduce speed two one zero',
    expect: 'AAL421 TL270 A060 S210',
  },
  {
    name: 'one zero thousand',
    heard: 'United one twenty three climb and maintain one zero thousand',
    expect: 'UAL123 A100',
  },
  {
    name: 'one-one thousand five hundred',
    heard: 'United one twenty three climb and maintain one-one thousand five hundred',
    expect: 'UAL123 A115',
  },
  {
    name: 'flight level',
    heard: 'American four twenty one climb and maintain flight level two three zero',
    expect: 'AAL421 A230',
  },
  {
    name: 'november N-number',
    heard: 'November one two three alpha bravo turn left heading zero niner zero',
    expect: 'N123AB TL090',
  },
  {
    name: 'left heading without turn word',
    heard: 'United one twenty three left heading two seven zero',
    expect: 'UAL123 TL270',
  },
  {
    name: 'single-airline fallback when only one UAL on scope',
    heard: 'United descend and maintain six thousand',
    expect: 'UAL123 A060',
  },
  {
    name: 'no callsign with instruction → station calling',
    heard: 'turn left heading two seven zero',
    expect: { ok: false, message: 'Station calling, say again' },
  },
  {
    name: 'callsign only → say again',
    heard: 'Delta four fifty six',
    expect: { ok: false, message: 'Say again' },
  },
  {
    name: 'garbage transcript → say again',
    heard: 'send and maintenance please',
    expect: { ok: false },
  },
];

describe('repairAtcTranscript', () => {
  it('repairs the Will booth example', () => {
    expect(repairAtcTranscript('unit 123 send and maintenance $8000')).toBe(
      'united 123 descend and maintain 8000',
    );
  });

  it('scores ATC-like text higher than noise', () => {
    expect(scoreAtcTranscript('united one twenty three descend and maintain eight thousand'))
      .toBeGreaterThan(scoreAtcTranscript('unit send maintenance'));
  });
});

describe('ATC speech corpus', () => {
  for (const row of CORPUS) {
    it(row.name, () => {
      const alts = Array.isArray(row.heard)
        ? row.heard.map((t, i) => ({ transcript: t, confidence: i === 0 ? 0.4 : 0.7 }))
        : [{ transcript: row.heard, confidence: 0.8 }];
      const parsed = Array.isArray(row.heard)
        ? parseBestSpokenClearance(alts, scope)
        : parseSpokenClearance(row.heard, scope);

      if (typeof row.expect === 'string') {
        expect(parsed.ok).toBe(true);
        expect(parsed.command).toBe(row.expect);
        expect(parsed.confidence ?? 0).toBeGreaterThan(0.3);
      } else {
        expect(parsed.ok).toBe(false);
        if (row.expect.message) expect(parsed.message).toBe(row.expect.message);
        // Failures must never look like a successful clearance.
        expect(parsed.command).toBeUndefined();
      }
    });
  }

  it('auto-issue threshold separates high vs low confidence', () => {
    expect(SPEECH_AUTO_ISSUE_CONFIDENCE).toBeGreaterThan(0.5);
    expect(SPEECH_AUTO_ISSUE_CONFIDENCE).toBeLessThan(0.95);
  });

  it('parseBest prefers a clean alternative over a misheard primary', () => {
    const parsed = parseBestSpokenClearance(
      [
        { transcript: 'unit 123 send and maintenance $8000', confidence: 0.92 },
        { transcript: 'united one twenty three descend and maintain eight thousand', confidence: 0.55 },
      ],
      scope,
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('UAL123 A080');
  });

  it('ambiguous callsign when two same-airline aircraft are on the scope', () => {
    const crowded = [...scope, ac('UAL999')];
    const parsed = parseSpokenClearance('United descend and maintain six thousand', crowded);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('ambiguous_callsign');
    expect(parsed.message).toBe('Say again callsign');
  });
});
