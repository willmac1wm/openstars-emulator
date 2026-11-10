/**
 * Speed adjustment limits on final.
 *
 * JO 7110.65BB 5-7-1:
 * Do not assign speed adjustment to aircraft:
 *   "Inside the final approach fix on final or a point 5 miles from the runway,
 *    whichever is closer to the runway."
 *
 * Approach clearance cancels previously assigned speeds unless restated
 * (same paragraph). After FAF, aircraft decelerate to final approach speed
 * (Vref-ish) for compression training.
 */

import { CITATIONS } from '../citations';

export const SPEED_CITATION = CITATIONS.speedLimits;

export function speedAssignmentAllowed(distanceToThresholdNm: number, fafNm: number): boolean {
  // Whichever is closer to the runway: FAF or 5 NM point.
  const limitNm = Math.min(fafNm, 5);
  return distanceToThresholdNm > limitNm + 0.05;
}

export function speedAssignmentBlockedReason(distanceToThresholdNm: number, fafNm: number): string | null {
  if (speedAssignmentAllowed(distanceToThresholdNm, fafNm)) return null;
  return `No ATC speed assignment inside FAF on final or within 5 NM of runway (closer limit applies) — ${CITATIONS.speedLimits}`;
}
