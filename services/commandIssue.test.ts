import { describe, expect, it, vi } from 'vitest';
import { Aircraft, AlertLevel } from '../types';
import { issueControllerCommand } from './commandIssue';

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

describe('issueControllerCommand', () => {
  it('applies heading patch even when speak never finishes (not gated on audio)', () => {
    const fleet = [aircraft({ callsign: 'AAL421', heading: 90 })];
    let speakStarted = false;
    let speakResolved = false;

    const result = issueControllerCommand(fleet, null, 'AAL421 H270', {
      onLog: () => undefined,
      onSpeak: () => {
        speakStarted = true;
        void new Promise<void>(() => {
          /* never resolves — hung TTS */
        }).then(() => {
          speakResolved = true;
        });
      },
    });

    expect(speakStarted).toBe(true);
    expect(speakResolved).toBe(false);
    expect(result.aircraft[0].targetHeading).toBe(270);
    expect(result.aircraft[0].heading).toBe(90); // current heading unchanged until physics
    expect(result.spoke).toBe(true);
  });

  it('does not await onSpeak (fire-and-forget)', () => {
    const fleet = [aircraft({ callsign: 'AAL421', altitude: 100 })];
    const onSpeak = vi.fn();
    const result = issueControllerCommand(fleet, null, 'AAL421 A050', {
      onLog: () => undefined,
      onSpeak,
    });
    expect(onSpeak).toHaveBeenCalledTimes(1);
    expect(result.aircraft[0].targetAltitude).toBe(50);
  });
});
