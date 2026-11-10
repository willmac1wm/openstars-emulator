/**
 * Approach clearance phraseology for controller echo + pilot readback.
 * Patterned on JO 7110.65BB 5-9-4 examples and 4-8-1 approach naming.
 */

import { speakAltitudeHundreds, speakCallsign, speakDigits, speakHeading } from '../services/phraseology';
import type { ApproachKind } from './types';
import { CITATIONS } from './citations';

export interface ApproachClearanceParts {
  callsign: string;
  milesFrom?: number;
  fixName?: string;
  turn?: 'LEFT' | 'RIGHT';
  heading?: number;
  maintainUntilEstablished?: number; // hundreds of feet
  approachKind: ApproachKind;
  runway: string;
}

/** @see CITATIONS.arrivalInstructions */
export function formatApproachClearance(parts: ApproachClearanceParts): { controller: string; pilot: string } {
  const bits: string[] = [];
  if (parts.milesFrom !== undefined) {
    bits.push(`${speakDigits(String(Math.round(parts.milesFrom)))} miles from ${parts.fixName || 'the final approach fix'}`);
  }
  if (parts.turn && parts.heading !== undefined) {
    bits.push(`turn ${parts.turn.toLowerCase()} heading ${speakHeading(parts.heading)}`);
  } else if (parts.heading !== undefined) {
    bits.push(`heading ${speakHeading(parts.heading)}`);
  }
  if (parts.maintainUntilEstablished !== undefined) {
    const courseWord = parts.approachKind === 'ILS' ? 'localizer' : 'final approach course';
    bits.push(`maintain ${speakAltitudeHundreds(parts.maintainUntilEstablished)} until established on the ${courseWord}`);
  }
  const apch =
    parts.approachKind === 'ILS'
      ? `cleared ILS runway ${speakDigits(parts.runway)} approach`
      : `cleared VOR runway ${speakDigits(parts.runway)} approach`;
  bits.push(apch);

  const body = bits.join(', ');
  const telephony = speakCallsign(parts.callsign);
  // 5-9-4 examples omit the callsign at the end of the controller transmission in
  // some figures; pilots read back the clearance with callsign (AIM radiotelephony).
  return {
    controller: `${parts.callsign}, ${body}`,
    pilot: `${body}, ${telephony}`,
  };
}

export const APPROACH_PHRASEOLOGY_CITATION = CITATIONS.arrivalInstructions;
