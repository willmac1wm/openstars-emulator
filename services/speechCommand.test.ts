import { describe, expect, it } from 'vitest';
import { Aircraft, AlertLevel } from '../types';
import {
  parseSpokenClearance,
  spokenAltitudeToHundreds,
  spokenDigitsSequence,
  spokenGroupNumber,
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

const scope = [ac('AAL421'), ac('UAL123'), ac('DAL456'), ac('SWA890')];

describe('spoken number helpers', () => {
  it('parses digit sequences with niner', () => {
    expect(spokenDigitsSequence(['two', 'seven', 'zero'])).toBe('270');
    expect(spokenDigitsSequence(['zero', 'niner', 'zero'])).toBe('090');
    expect(spokenDigitsSequence(['two', 'one', 'zero'])).toBe('210');
  });

  it('parses group-form flight numbers', () => {
    expect(spokenGroupNumber(['four', 'twenty', 'one'])).toBe('421');
    expect(spokenGroupNumber(['one', 'twenty', 'three'])).toBe('123');
    expect(spokenGroupNumber(['four', 'zero', 'four'])).toBe('404');
    expect(spokenGroupNumber(['eight', 'ninety'])).toBe('890');
  });

  it('parses altitudes to hundreds of feet', () => {
    expect(spokenAltitudeToHundreds(['six', 'thousand'])).toBe('60');
    expect(spokenAltitudeToHundreds(['seven', 'thousand'])).toBe('70');
    expect(spokenAltitudeToHundreds(['one', 'zero', 'thousand'])).toBe('100');
    expect(spokenAltitudeToHundreds(['niner', 'thousand', 'five', 'hundred'])).toBe('95');
    expect(spokenAltitudeToHundreds(['flight', 'level', 'one', 'eight', 'zero'])).toBe('180');
  });
});

describe('parseSpokenClearance', () => {
  it('parses a left turn clearance', () => {
    const parsed = parseSpokenClearance(
      'American four twenty-one, turn left heading two seven zero',
      scope,
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('AAL421 TL270');
  });

  it('parses descend and maintain with thousand', () => {
    const parsed = parseSpokenClearance(
      'United one twenty three descend and maintain six thousand',
      scope,
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('UAL123 A060');
  });

  it('parses reduce speed with niner-free digits', () => {
    const parsed = parseSpokenClearance(
      'Southwest eight ninety reduce speed to two one zero knots',
      scope,
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('SWA890 S210');
  });

  it('parses multi-instruction clearances', () => {
    const parsed = parseSpokenClearance(
      'American four twenty one turn left heading two seven zero descend and maintain six thousand reduce speed to two one zero',
      scope,
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('AAL421 TL270 A060 S210');
  });

  it('asks station calling when instructions have no callsign match', () => {
    const parsed = parseSpokenClearance('turn left heading two seven zero', scope);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('station_calling');
    expect(parsed.message).toBe('Station calling, say again');
  });

  it('says again when callsign is known but instruction is missing', () => {
    const parsed = parseSpokenClearance('Delta four fifty six', scope);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('say_again');
  });

  it('handles niner in heading zero niner zero', () => {
    const parsed = parseSpokenClearance(
      'United one two three turn right heading zero niner zero',
      scope,
    );
    expect(parsed.command).toBe('UAL123 TR090');
  });
});
