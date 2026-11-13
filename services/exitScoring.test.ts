import { describe, expect, it } from 'vitest';
import { evaluateExit, gateAltLabel, gateForExitBearing, gateForHeading, requiredAltsForGate } from './exitScoring';

const dal = { callsign: 'DAL456', destination: 'EAS', heading: 90, altitude: 90 };
const swa = { callsign: 'SWA890', destination: 'NOR', heading: 35, altitude: 71 };

describe('gate resolution', () => {
  it('resolves a gate from exit bearing', () => {
    expect(gateForExitBearing(105)?.id).toBe('EAS');
    expect(gateForExitBearing(72)).toBeNull();
    expect(gateForExitBearing(200)?.id).toBe('SOU');
  });

  it('resolves a gate from heading (H090 → EAS)', () => {
    expect(gateForHeading(90)?.id).toBe('EAS');
    expect(gateForHeading(250)).toBeNull();
  });
});

describe('evaluateExit — the Nov 12 browser-test cases', () => {
  it('DAL456 H090/A090/S210 exiting at bearing 072° is a sloppy EAS exit, not OFF COURSE', () => {
    // Heading due east names the east gate even though the crossing bearing
    // (072°) sits outside the EAS wedge (090–120°).
    const r = evaluateExit(dal, 72);
    expect(r.kind).toBe('sloppy');
    expect(r.gateId).toBe('EAS');
    expect(r.viaHeading).toBe(true);
    expect(r.points).toBe(500);
    expect(r.reason).toMatch(/72°/);
    expect(r.reason).toMatch(/EAS|EAST/);
  });

  it('centred exit at a legal altitude is clean', () => {
    const r = evaluateExit(dal, 105);
    expect(r.kind).toBe('clean');
    expect(r.points).toBe(1000);
    expect(r.handoffResult).toBe('CLEAN EXIT');
  });

  it('SWA890 clean-looking exit at alt 71 is WRONG ALT only — never clean + penalty', () => {
    // NOR needs 070 or 090; 071 is in transit, not legal.
    const r = evaluateExit(swa, 35);
    expect(r.kind).toBe('wrong-alt');
    expect(r.points).toBe(-250);
    expect(r.handoffResult).toBe('WRONG ALT');
    expect(r.reason).toMatch(/7100/);
    expect(r.reason).toMatch(/7000 or 9000/);
    expect(r.reason).toMatch(/No clean-exit points/);
  });

  it('wrong gate is penalised and named', () => {
    const r = evaluateExit({ ...dal, heading: 195 }, 195);
    expect(r.kind).toBe('wrong-gate');
    expect(r.points).toBe(-500);
    expect(r.reason).toMatch(/SOUTH/);
    expect(r.reason).toMatch(/EAS/);
  });

  it('exit outside every gate and heading is OFF COURSE with the bearing in the reason', () => {
    const r = evaluateExit({ ...dal, heading: 250 }, 72);
    expect(r.kind).toBe('off-course');
    expect(r.points).toBe(-200);
    expect(r.reason).toMatch(/72°/);
    expect(r.reason).toMatch(/outside every gate/);
  });

  it('off-centre exit at a legal altitude is sloppy, not clean', () => {
    const r = evaluateExit(dal, 118);
    expect(r.kind).toBe('sloppy');
    expect(r.points).toBe(500);
    expect(r.reason).toMatch(/off centre/);
  });
});

describe('gateAltLabel — scope labels (menu altitudes moved to the scope)', () => {
  it('N/E gates take A070 / A090', () => {
    expect(requiredAltsForGate('NOR')).toEqual([70, 90]);
    expect(requiredAltsForGate('EAS')).toEqual([70, 90]);
    expect(gateAltLabel('NOR')).toBe('A070 / A090');
    expect(gateAltLabel('EAS')).toBe('A070 / A090');
  });

  it('S/W gates take A060 / A080', () => {
    expect(requiredAltsForGate('SOU')).toEqual([60, 80]);
    expect(requiredAltsForGate('WES')).toEqual([60, 80]);
    expect(gateAltLabel('SOU')).toBe('A060 / A080');
    expect(gateAltLabel('WES')).toBe('A060 / A080');
  });

  it('matches the altitudes evaluateExit enforces', () => {
    // NOR at 7000 is legal; at 8000 it is a wrong-alt exit.
    expect(evaluateExit({ callsign: 'SWA890', destination: 'NOR', heading: 35, altitude: 70 }, 35).kind).toBe('clean');
    expect(evaluateExit({ callsign: 'SWA890', destination: 'NOR', heading: 35, altitude: 80 }, 35).kind).toBe('wrong-alt');
  });
});
