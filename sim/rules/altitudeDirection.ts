/**
 * Direction-of-flight (hemispheric) altitude rule — configurable for handoff/exit checks.
 *
 * Legal basis for the default policy (not an ATC assignment rule in controlled
 * airspace, but the familiar odd/even training heuristic):
 *   14 CFR §91.179(b)(1) and AIM TBL 3-3-3 (Class G IFR altitudes):
 *     magnetic course 0°–179° → odd thousands MSL
 *     magnetic course 180°–359° → even thousands MSL
 *
 * In controlled airspace ATC assigns altitudes (91.179(a)); this sim exposes the
 * rule as a configurable check at handoff/exit for multiplayer sector training.
 */

import { CITATIONS } from '../citations';

export const DIRECTION_ALT_CITATION = CITATIONS.directionAltitude;

export interface DirectionAltitudePolicy {
  enabled: boolean;
  /** When true: 0–179 odd thousands (default §91.179). */
  northEastOdd: boolean;
}

export function altitudeMatchesDirection(
  altitudeHundreds: number,
  magneticCourseDeg: number,
  policy: DirectionAltitudePolicy,
): boolean {
  if (!policy.enabled) return true;
  const thousands = Math.round(altitudeHundreds / 10); // 70 → 7 (7000 ft)
  const course = ((magneticCourseDeg % 360) + 360) % 360;
  const northEast = course >= 0 && course < 180;
  const wantOdd = policy.northEastOdd ? northEast : !northEast;
  const isOdd = thousands % 2 === 1;
  return wantOdd ? isOdd : !isOdd;
}

export function directionAltitudeHint(magneticCourseDeg: number, policy: DirectionAltitudePolicy): string {
  const course = ((magneticCourseDeg % 360) + 360) % 360;
  const northEast = course >= 0 && course < 180;
  const odd = policy.northEastOdd ? northEast : !northEast;
  return odd
    ? `Odd thousands for course ${course.toFixed(0)}° — ${CITATIONS.directionAltitude}`
    : `Even thousands for course ${course.toFixed(0)}° — ${CITATIONS.directionAltitude}`;
}
