import { describe, expect, it } from 'vitest';
import { Aircraft, AlertLevel } from '../types';
import { extractApproachClearance, parseSpokenClearance } from './speechCommand';

function ac(callsign: string): Aircraft {
  return {
    id: callsign,
    callsign,
    type: 'B738',
    x: 0,
    y: 0,
    altitude: 20,
    targetAltitude: 20,
    speed: 190,
    targetSpeed: 190,
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

describe('spoken approach clearances', () => {
  it('extracts miles-from, turn, maintain-until-established, cleared ILS', () => {
    const parts = extractApproachClearance(
      'four miles from the final approach fix turn left heading three one zero maintain two thousand until established on the localizer cleared ils runway two eight approach'
        .split(/\s+/),
    );
    expect(parts.some((p) => /MILES FROM/i.test(p))).toBe(true);
    expect(parts.some((p) => p.startsWith('TL'))).toBe(true);
    expect(parts.some((p) => /UNTIL ESTABLISHED/i.test(p))).toBe(true);
    expect(parts.some((p) => /CLEARED ILS RWY/i.test(p))).toBe(true);
  });

  it('parseSpokenClearance builds a typed approach command', () => {
    const parsed = parseSpokenClearance(
      'American four twenty-one, four miles from the final approach fix, turn left heading three one zero, maintain two thousand until established on the localizer, cleared ILS runway two eight approach',
      [ac('AAL421')],
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toMatch(/AAL421/);
    expect(parsed.command).toMatch(/CLEARED ILS RWY/);
    expect(parsed.command).toMatch(/UNTIL ESTABLISHED/);
  });
});
