import { describe, expect, it } from 'vitest';
import { Aircraft, AlertLevel } from '../types';
import { applyCommandPatch, parseCommand } from './commandParser';

function aircraft(partial: Partial<Aircraft> & Pick<Aircraft, 'callsign'>): Aircraft {
  return {
    id: partial.id ?? partial.callsign,
    callsign: partial.callsign,
    type: 'B738',
    x: 0,
    y: 0,
    altitude: partial.altitude ?? 100,
    targetAltitude: partial.altitude ?? 100,
    speed: partial.speed ?? 250,
    targetSpeed: partial.speed ?? 250,
    heading: partial.heading ?? 90,
    targetHeading: partial.heading ?? 90,
    history: [],
    status: 'ACTIVE',
    alertLevel: AlertLevel.NONE,
    cleared: false,
    messages: [],
    isSelected: false,
    destination: 'NOR',
    dataBlockDir: 45,
    ...partial,
  };
}

describe('parseCommand', () => {
  const aal = aircraft({ callsign: 'AAL421', heading: 90, altitude: 120, speed: 250 });
  const ual = aircraft({ callsign: 'UAL123', heading: 180, altitude: 70, speed: 210 });

  it('reads back a shortest-turn heading', () => {
    const parsed = parseCommand('AAL421 H270', [aal], null);
    expect(parsed.readback).toBe('Turn right heading two seven zero, American four twenty-one');
    expect(parsed.patch?.targetHeading).toBe(270);
    expect(parsed.patch?.clearTurnDirection).toBe(true);
  });

  it('reads back forced turns and the zero-niner-zero heading', () => {
    const left = parseCommand('AAL421 TL270', [aal], null);
    expect(left.readback).toBe('Turn left heading two seven zero, American four twenty-one');
    expect(left.patch?.turnDirection).toBe('LEFT');

    const right = parseCommand('UAL123 TR090', [ual], null);
    expect(right.readback).toBe('Turn right heading zero niner zero, United one twenty-three');
    expect(right.patch?.targetHeading).toBe(90);
  });

  it('accepts HDG and T as heading aliases', () => {
    expect(parseCommand('UAL123 HDG180', [ual], null).readback).toBe('Heading one eight zero, United one twenty-three');
    const turned = parseCommand('UAL123 T090', [ual], null);
    expect(turned.readback).toBe('Turn left heading zero niner zero, United one twenty-three');
  });

  it('reads back climb, descend, and maintain altitude', () => {
    expect(parseCommand('UAL123 A100', [ual], null).readback)
      .toBe('Climb and maintain one zero thousand, United one twenty-three');
    expect(parseCommand('AAL421 A060', [aal], null).readback)
      .toBe('Descend and maintain six thousand, American four twenty-one');
    expect(parseCommand('UAL123 A070', [ual], null).readback)
      .toBe('Maintain seven thousand, United one twenty-three');
    expect(parseCommand('UAL123 C110', [ual], null).readback)
      .toBe('Climb and maintain one one thousand, United one twenty-three');
    expect(parseCommand('UAL123 ALT105', [ual], null).readback)
      .toBe('Climb and maintain one zero thousand five hundred, United one twenty-three');
  });

  it('does not treat ALT as a heading', () => {
    const parsed = parseCommand('UAL123 ALT070', [ual], null);
    expect(parsed.patch?.targetHeading).toBeUndefined();
    expect(parsed.patch?.targetAltitude).toBe(70);
  });

  it('reads back speed changes', () => {
    expect(parseCommand('SWA890 S250', [aircraft({ callsign: 'SWA890', speed: 210 })], null).readback)
      .toBe('Increase speed to two five zero knots, Southwest eight ninety');
    expect(parseCommand('SKW221 S180', [aircraft({ callsign: 'SKW221', speed: 240 })], null).readback)
      .toBe('Reduce speed to one eight zero knots, SkyWest two twenty-one');
    expect(parseCommand('ASH310 SPD210', [aircraft({ callsign: 'ASH310', speed: 210 })], null).readback)
      .toBe('Maintain two one zero knots, Air Shuttle three ten');
  });

  it('reads back a combined clearance in heading, altitude, speed order', () => {
    const parsed = parseCommand('AAL404 TL270 S210 A060', [aircraft({
      callsign: 'AAL404', heading: 90, altitude: 100, speed: 250,
    })], null);
    expect(parsed.readback).toBe(
      'Turn left heading two seven zero, descend and maintain six thousand, reduce speed to two one zero knots, American four zero four',
    );
    const updated = applyCommandPatch(aircraft({ callsign: 'AAL404', heading: 90, altitude: 100, speed: 250 }), parsed.patch!);
    expect(updated.targetHeading).toBe(270);
    expect(updated.turnDirection).toBe('LEFT');
    expect(updated.targetAltitude).toBe(60);
    expect(updated.targetSpeed).toBe(210);
  });

  it('says again when the line cannot be parsed', () => {
    const parsed = parseCommand('UAL123 CLIMB NOW', [ual], null);
    expect(parsed.readback).toBe('Say again, United one twenty-three');
    expect(parsed.patch).toBeNull();
  });

  it('says unable for out-of-limits values and does not move the aircraft', () => {
    expect(parseCommand('UAL123 H999', [ual], null).readback).toBe('Unable, United one twenty-three');
    expect(parseCommand('UAL123 S050', [ual], null).patch).toBeNull();
    expect(parseCommand('UAL123 A000', [ual], null).readback).toBe('Unable, United one twenty-three');
    const mixed = parseCommand('UAL123 H090 S050', [ual], null);
    expect(mixed.readback).toBe('Turn left heading zero niner zero, unable, United one twenty-three');
    expect(mixed.patch?.targetSpeed).toBeUndefined();
    expect(mixed.patch?.targetHeading).toBe(90);
  });

  it('reports an unknown callsign without a pilot readback', () => {
    const parsed = parseCommand('ZZZ999 H090', [ual], null);
    expect(parsed.kind).toBe('not_found');
    expect(parsed.readback).toBeUndefined();
  });

  it('speaks heading three six zero for 360', () => {
    const parsed = parseCommand('AAL421 H360', [aal], null);
    expect(parsed.readback).toBe('Turn left heading three six zero, American four twenty-one');
    expect(parsed.patch?.targetHeading).toBe(0);
  });
});
