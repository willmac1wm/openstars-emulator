/**
 * Training approach plates for Vector-to-Final (not a real airport).
 * ILS final course = runway centerline; VOR final is offset a few degrees so
 * students practice a different intercept angle (still within TBL 5-9-1).
 */

import { CENTER } from '../constants';
import type { ApproachKind, ApproachProcedure } from './types';

/** Single runway 28 — threshold near west side of scope, landing westbound. */
export function buildApproach(kind: ApproachKind): ApproachProcedure {
  const runwayHeading = 280;
  const threshold = { x: CENTER - 180, y: CENTER + 20 };
  if (kind === 'ILS') {
    return {
      kind: 'ILS',
      runway: '28',
      finalCourseDeg: runwayHeading,
      runwayHeadingDeg: runwayHeading,
      threshold,
      fafNm: 6,
      gsInterceptAltFt: 2000,
      fafName: 'FINAL APPROACH FIX',
      localizerName: 'localizer',
    };
  }
  // VOR: FAC offset +5° from runway centerline (training offset).
  return {
    kind: 'VOR',
    runway: '28',
    finalCourseDeg: normalize(runwayHeading + 5),
    runwayHeadingDeg: runwayHeading,
    threshold,
    fafNm: 6,
    gsInterceptAltFt: 2200,
    fafName: 'VOR FAF',
    localizerName: 'VOR final approach course',
  };
}

function normalize(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}
