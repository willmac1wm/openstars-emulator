import { describe, expect, it } from 'vitest';
import {
  composeTapClearance,
  normalizeHeadingDeg,
  nudgeHeading,
  shortestTurn,
  snapHeading5,
} from './tapClearance';

describe('snapHeading5 / normalizeHeadingDeg', () => {
  it('snaps to nearest 5° and maps 0 → 360', () => {
    expect(snapHeading5(0)).toBe(360);
    expect(snapHeading5(2)).toBe(360);
    expect(snapHeading5(3)).toBe(5);
    expect(snapHeading5(87)).toBe(85);
    expect(snapHeading5(88)).toBe(90);
    expect(snapHeading5(358)).toBe(360);
  });

  it('normalizes negative and >360', () => {
    expect(normalizeHeadingDeg(-10)).toBe(350);
    expect(normalizeHeadingDeg(370)).toBe(10);
  });
});

describe('shortestTurn', () => {
  it('picks the shorter arc', () => {
    expect(shortestTurn(360, 90)).toBe('RIGHT');
    expect(shortestTurn(360, 270)).toBe('LEFT');
    expect(shortestTurn(10, 350)).toBe('LEFT');
    expect(shortestTurn(350, 10)).toBe('RIGHT');
  });

  it('ties 180° the same way as the sim (RIGHT)', () => {
    expect(shortestTurn(90, 270)).toBe('RIGHT');
    expect(shortestTurn(0, 180)).toBe('RIGHT');
  });

  it('returns null when already on heading', () => {
    expect(shortestTurn(180, 180)).toBeNull();
    expect(shortestTurn(360, 0)).toBeNull();
  });
});

describe('composeTapClearance', () => {
  const base = {
    callsign: 'AAL123',
    currentHeading: 360,
    currentAltitudeHundreds: 70,
    currentSpeed: 250,
  };

  it('includes only chosen elements — empty when nothing selected', () => {
    const r = composeTapClearance({ ...base });
    expect(r.hasElements).toBe(false);
    expect(r.command).toBe('');
  });

  it('heading alone uses shortest turn (no forced LEFT/RIGHT)', () => {
    const r = composeTapClearance({ ...base, heading: 90 });
    expect(r.command).toBe('AAL123 TR090');
    expect(r.effectiveTurn).toBe('RIGHT');
    expect(r.phraseology).toMatch(/turn right heading/);
    expect(r.phraseology).not.toMatch(/altitude|speed/i);
  });

  it('forced LEFT overrides shortest RIGHT', () => {
    const r = composeTapClearance({
      ...base,
      heading: 90,
      turnForced: 'LEFT',
    });
    expect(r.command).toBe('AAL123 TL090');
    expect(r.effectiveTurn).toBe('LEFT');
  });

  it('changing heading without turnForced returns to shortest (simulates dial reset)', () => {
    // After dial change, caller clears turnForced → shortest again.
    const forced = composeTapClearance({
      ...base,
      heading: 90,
      turnForced: 'LEFT',
    });
    expect(forced.command).toBe('AAL123 TL090');

    const afterDial = composeTapClearance({
      ...base,
      heading: 270,
      turnForced: null,
    });
    expect(afterDial.command).toBe('AAL123 TL270');
    expect(afterDial.effectiveTurn).toBe('LEFT');
  });

  it('altitude-only and speed-only clearances', () => {
    const alt = composeTapClearance({ ...base, altitudeHundreds: 90 });
    expect(alt.command).toBe('AAL123 A090');
    expect(alt.phraseology).toMatch(/climb and maintain/);

    const descend = composeTapClearance({
      ...base,
      currentAltitudeHundreds: 110,
      altitudeHundreds: 70,
    });
    expect(descend.phraseology).toMatch(/descend and maintain/);

    const spd = composeTapClearance({ ...base, speed: 210 });
    expect(spd.command).toBe('AAL123 S210');
    expect(spd.phraseology).toMatch(/reduce speed to/);
  });

  it('combines heading + altitude + speed', () => {
    const r = composeTapClearance({
      ...base,
      heading: 180,
      altitudeHundreds: 50,
      speed: 180,
    });
    expect(r.command).toBe('AAL123 TR180 A050 S180');
    expect(r.hasElements).toBe(true);
  });
});

describe('nudgeHeading (LEFT/RIGHT dial buttons)', () => {
  it('nudges from the live heading when nothing is staged — and arms Issue', () => {
    // Regression: LEFT/RIGHT used to only set a forced turn, so with no
    // staged heading the pending clearance stayed empty and ISSUE disabled.
    const nudged = nudgeHeading(250, null, 'LEFT');
    expect(nudged.heading).toBe(240);
    expect(nudged.turnForced).toBe('LEFT');

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
  });

  it('two LEFT nudges from a staged 250 read 230 (the reported Expo case)', () => {
    const first = nudgeHeading(250, 250, 'LEFT');
    expect(first.heading).toBe(240);
    const second = nudgeHeading(250, first.heading, 'LEFT');
    expect(second.heading).toBe(230);
    expect(second.turnForced).toBe('LEFT');
  });

  it('RIGHT nudges forward and wraps through north', () => {
    expect(nudgeHeading(350, null, 'RIGHT').heading).toBe(360);
    expect(nudgeHeading(355, 355, 'RIGHT').heading).toBe(5);
    expect(nudgeHeading(5, null, 'LEFT').heading).toBe(355);
  });
});
