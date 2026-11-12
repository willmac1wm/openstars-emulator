import { turnDirection } from './commandParser';
import { speakAltitudeHundreds, speakCallsign, speakHeading, speakKnots } from './phraseology';

export function normalizeHeadingDeg(deg: number): number {
  let h = ((Math.round(deg) % 360) + 360) % 360;
  if (h === 0) h = 360;
  return h;
}

/** Snap to nearest 5° (1–360, where 360 represents north). */
export function snapHeading5(deg: number): number {
  const raw = ((deg % 360) + 360) % 360;
  const snapped = Math.round(raw / 5) * 5;
  return normalizeHeadingDeg(snapped === 0 ? 360 : snapped);
}

/**
 * Shortest-turn direction including the 180° tie (same as sim / commandParser).
 * Returns null when already on heading.
 */
export function shortestTurn(from: number, to: number): 'LEFT' | 'RIGHT' | null {
  return turnDirection(normalizeHeadingDeg(from), normalizeHeadingDeg(to));
}

/**
 * Nudge the staged heading by one step (default 10°) and arm the clearance.
 * LEFT/RIGHT used to only set a forced turn direction, so with nothing
 * staged they changed no pending clearance and ISSUE stayed disabled — the
 * dial appeared to move (the needle follows the live heading) while the
 * staged clearance stayed empty. A nudge now stages a heading exactly like
 * dragging the dial does, starting from the live heading when nothing is
 * staged yet, and forces the turn in the nudged direction.
 */
export const DIAL_NUDGE_DEG = 10;

export function nudgeHeading(
  currentHeading: number,
  stagedHeading: number | null | undefined,
  direction: 'LEFT' | 'RIGHT',
  stepDeg: number = DIAL_NUDGE_DEG,
): { heading: number; turnForced: 'LEFT' | 'RIGHT' } {
  const base = stagedHeading ?? normalizeHeadingDeg(currentHeading);
  const next = direction === 'LEFT' ? base - stepDeg : base + stepDeg;
  return { heading: snapHeading5(next), turnForced: direction };
}

export interface TapClearanceInput {
  callsign: string;
  currentHeading: number;
  currentAltitudeHundreds: number;
  currentSpeed: number;
  /** Target heading only if the dial was touched. */
  heading?: number | null;
  /** Explicit LEFT/RIGHT override; null/undefined = use shortest. */
  turnForced?: 'LEFT' | 'RIGHT' | null;
  altitudeHundreds?: number | null;
  speed?: number | null;
}

export interface TapClearanceResult {
  command: string;
  phraseology: string;
  hasElements: boolean;
  effectiveTurn: 'LEFT' | 'RIGHT' | null;
}

/**
 * Compose a typed clearance from only the elements the controller chose.
 * Heading uses shortest turn unless turnForced is set.
 */
export function composeTapClearance(input: TapClearanceInput): TapClearanceResult {
  const parts: string[] = [];
  const spoken: string[] = [];
  let effectiveTurn: 'LEFT' | 'RIGHT' | null = null;

  // Untouched dial (null/undefined) must not contribute a heading — never default to 000/360.
  if (input.heading != null && Number.isFinite(input.heading)) {
    const shown = normalizeHeadingDeg(input.heading);
    // North is always 360 in the typed grammar — never emit H000 (parser synonym, confuses logs).
    const code = shown === 360 || shown === 0 ? '360' : String(shown).padStart(3, '0');
    const auto = shortestTurn(input.currentHeading, shown);
    effectiveTurn = input.turnForced ?? auto;
    if (effectiveTurn === 'LEFT') {
      parts.push(`TL${code}`);
      spoken.push(`turn left heading ${speakHeading(shown)}`);
    } else if (effectiveTurn === 'RIGHT') {
      parts.push(`TR${code}`);
      spoken.push(`turn right heading ${speakHeading(shown)}`);
    } else {
      parts.push(`H${code}`);
      spoken.push(`fly heading ${speakHeading(shown)}`);
    }
  }

  if (input.altitudeHundreds != null) {
    const alt = String(input.altitudeHundreds).padStart(3, '0');
    parts.push(`A${alt}`);
    const cur = input.currentAltitudeHundreds;
    const next = input.altitudeHundreds;
    const verb = next > cur ? 'climb and maintain' : next < cur ? 'descend and maintain' : 'maintain';
    spoken.push(`${verb} ${speakAltitudeHundreds(next)}`);
  }

  if (input.speed != null) {
    parts.push(`S${input.speed}`);
    const cur = input.currentSpeed;
    const next = input.speed;
    const verb = next > cur ? 'increase speed to' : next < cur ? 'reduce speed to' : 'maintain speed';
    spoken.push(`${verb} ${speakKnots(next)} knots`);
  }

  const telephony = speakCallsign(input.callsign);
  const hasElements = parts.length > 0;
  return {
    command: hasElements ? `${input.callsign} ${parts.join(' ')}` : '',
    phraseology: hasElements ? `${telephony}, ${spoken.join(', ')}` : 'Choose heading, altitude, and/or speed',
    hasElements,
    effectiveTurn,
  };
}
