import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeTapClearance, nudgeHeading } from './tapClearance';
import { createTapIssueGate } from './tapIssueGate';
import { issueControllerCommand } from './commandIssue';
import { Aircraft, AlertLevel } from '../types';

function ac(callsign: string, heading = 90): Aircraft {
  return {
    id: callsign,
    callsign,
    type: 'B738',
    x: 0,
    y: 0,
    altitude: 80,
    targetAltitude: 80,
    speed: 250,
    targetSpeed: 250,
    heading,
    targetHeading: heading,
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

describe('tapIssueGate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('one dial staging + one Issue = exactly one command', () => {
    const issued: string[] = [];
    const gate = createTapIssueGate((cmd) => issued.push(cmd), 450);

    // Dial stages only — composing does not issue.
    const staged = composeTapClearance({
      callsign: 'SWA890',
      currentHeading: 180,
      currentAltitudeHundreds: 80,
      currentSpeed: 250,
      heading: 20,
    });
    expect(staged.command).toMatch(/SWA890 T[LR]020/);
    expect(issued).toHaveLength(0);

    expect(gate.tryIssue(staged.command)).toBe(true);
    expect(issued).toEqual([staged.command]);

    // Enter + button double-fire (same tick) must not send twice.
    expect(gate.tryIssue(staged.command)).toBe(false);
    expect(issued).toHaveLength(1);
  });

  it('rejects H000 and never emits north-as-zero from compose', () => {
    const north = composeTapClearance({
      callsign: 'SWA890',
      currentHeading: 90,
      currentAltitudeHundreds: 80,
      currentSpeed: 250,
      heading: 360,
    });
    expect(north.command).not.toMatch(/H000|TL000|TR000/);
    expect(north.command).toMatch(/360/);

    const zero = composeTapClearance({
      callsign: 'SWA890',
      currentHeading: 90,
      currentAltitudeHundreds: 80,
      currentSpeed: 250,
      heading: 0,
    });
    expect(zero.command).toMatch(/360/);
    expect(zero.command).not.toMatch(/000/);

    const untouched = composeTapClearance({
      callsign: 'SWA890',
      currentHeading: 90,
      currentAltitudeHundreds: 80,
      currentSpeed: 250,
      heading: null,
    });
    expect(untouched.hasElements).toBe(false);
    expect(untouched.command).toBe('');

    const issued: string[] = [];
    const gate = createTapIssueGate((cmd) => issued.push(cmd));
    expect(gate.tryIssue('SWA890 H000')).toBe(false);
    expect(issued).toHaveLength(0);
  });

  it('one Issue yields one controller echo and one pilot readback', () => {
    const logs: Array<{ text: string; kind: string }> = [];
    const speaks: string[] = [];
    const craft = [ac('SWA890', 180)];

    const staged = composeTapClearance({
      callsign: 'SWA890',
      currentHeading: 180,
      currentAltitudeHundreds: 80,
      currentSpeed: 250,
      heading: 20,
    });

    const gate = createTapIssueGate((cmd) => {
      issueControllerCommand(craft, craft[0].id, cmd, {
        onLog: (text, kind) => logs.push({ text, kind }),
        onSpeak: (text) => speaks.push(text),
      });
    });

    gate.tryIssue(staged.command);
    gate.tryIssue(staged.command); // double-fire

    const controller = logs.filter((l) => l.kind === 'controller');
    const pilot = logs.filter((l) => l.kind === 'pilot');
    expect(controller).toHaveLength(1);
    expect(pilot).toHaveLength(1);
    expect(speaks).toHaveLength(1);
    expect(controller[0].text).toBe(staged.command);
    expect(controller[0].text).not.toMatch(/H000/);
  });

  it('unlocks after cooldown so a new clearance can issue', () => {
    vi.useFakeTimers();
    const issued: string[] = [];
    const gate = createTapIssueGate((cmd) => issued.push(cmd), 450);
    expect(gate.tryIssue('SWA890 TL020')).toBe(true);
    expect(gate.tryIssue('SWA890 TL030')).toBe(false);
    vi.advanceTimersByTime(450);
    expect(gate.tryIssue('SWA890 TL030')).toBe(true);
    expect(issued).toEqual(['SWA890 TL020', 'SWA890 TL030']);
  });

  it('a LEFT/RIGHT nudge stages a clearance that issues exactly once', () => {
    // Regression: nudging with nothing staged left ISSUE disabled because
    // the buttons only set a forced turn direction.
    const issued: string[] = [];
    const gate = createTapIssueGate((cmd) => issued.push(cmd), 450);

    const nudged = nudgeHeading(250, null, 'LEFT');
    const staged = composeTapClearance({
      callsign: 'AAL421',
      currentHeading: 250,
      currentAltitudeHundreds: 80,
      currentSpeed: 250,
      heading: nudged.heading,
      turnForced: nudged.turnForced,
    });
    expect(staged.hasElements).toBe(true);
    expect(staged.command).toBe('AAL421 TL240');

    expect(gate.tryIssue(staged.command)).toBe(true);
    expect(gate.tryIssue(staged.command)).toBe(false);
    expect(issued).toEqual(['AAL421 TL240']);
  });
});
