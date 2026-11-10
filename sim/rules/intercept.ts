/**
 * Final approach course interception legality.
 *
 * JO 7110.65BB 5-9-1: vector to intercept at least 2 NM outside the approach
 * gate (this training mode scores the standard case; weather/pilot-request
 * exceptions in 5-9-1 a1/a2 are not auto-applied).
 *
 * JO 7110.65BB 5-9-2 / TBL 5-9-1:
 *   interception point < 2 NM from approach gate → max 20°
 *   interception point ≥ 2 NM from approach gate → max 30° (45° helicopters)
 *
 * P/CG APPROACH GATE: 1 NM from the FAF on the side away from the airport,
 * and no closer than 5 NM from the landing threshold.
 *
 * Precision altitude (5-9-1): not above the glideslope/glidepath and not below
 * the minimum glideslope intercept altitude on the approach chart.
 */

import type { ApproachProcedure } from '../types';
import { CITATIONS } from '../citations';

export const INTERCEPT_CITATIONS = {
  vectors: CITATIONS.vectorsToFinal,
  angle: CITATIONS.interceptAngle,
  gate: CITATIONS.approachGate,
} as const;

export function approachGateNmFromThreshold(proc: ApproachProcedure): number {
  // P/CG: gate = 1 NM outside FAF, and ≥ 5 NM from threshold.
  return Math.max(proc.fafNm + 1, 5);
}

export function maxInterceptAngleDeg(distanceToGateNm: number, helicopter = false): number {
  // JO 7110.65BB TBL 5-9-1
  if (distanceToGateNm < 2) return 20;
  return helicopter ? 45 : 30;
}

export function angleDiffDeg(a: number, b: number): number {
  const d = ((a - b + 540) % 360) - 180;
  return Math.abs(d);
}

export interface InterceptCheckInput {
  /** Aircraft ground track (deg) at intercept. */
  trackDeg: number;
  /** Distance from interception point to approach gate (NM). */
  distanceToGateNm: number;
  /** Distance from interception point to threshold (NM). */
  distanceToThresholdNm: number;
  altitudeFt: number;
  proc: ApproachProcedure;
  helicopter?: boolean;
}

export interface InterceptCheckResult {
  ok: boolean;
  reasons: string[];
  maxAngle: number;
  actualAngle: number;
}

/** Precision approach altitude band per 5-9-1. */
export function checkPrecisionAltitude(
  altitudeFt: number,
  minGsInterceptFt: number,
  onGlideslopeMaxFt: number,
): string | null {
  if (altitudeFt > onGlideslopeMaxFt + 50) {
    return `Above glideslope intercept altitude (${onGlideslopeMaxFt} ft) — ${CITATIONS.vectorsToFinal}`;
  }
  if (altitudeFt < minGsInterceptFt - 50) {
    return `Below minimum glideslope intercept altitude (${minGsInterceptFt} ft) — ${CITATIONS.vectorsToFinal}`;
  }
  return null;
}

export function checkInterceptLegality(input: InterceptCheckInput): InterceptCheckResult {
  const reasons: string[] = [];
  const gateNm = approachGateNmFromThreshold(input.proc);
  const maxAngle = maxInterceptAngleDeg(input.distanceToGateNm, input.helicopter);
  const actualAngle = angleDiffDeg(input.trackDeg, input.proc.finalCourseDeg);

  // 5-9-1 a: at least 2 miles outside the approach gate (standard case).
  if (input.distanceToThresholdNm < gateNm + 2) {
    reasons.push(
      `Intercept inside gate+2 NM (gate≈${gateNm.toFixed(1)} NM from threshold) — ${CITATIONS.vectorsToFinal}`,
    );
  }

  if (actualAngle > maxAngle + 0.5) {
    reasons.push(
      `Intercept angle ${actualAngle.toFixed(0)}° exceeds ${maxAngle}° max at ${input.distanceToGateNm.toFixed(1)} NM from gate — ${CITATIONS.interceptAngle}`,
    );
  }

  if (input.proc.kind === 'ILS') {
    const altIssue = checkPrecisionAltitude(
      input.altitudeFt,
      input.proc.gsInterceptAltFt,
      input.proc.gsInterceptAltFt,
    );
    if (altIssue) reasons.push(altIssue);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    maxAngle,
    actualAngle,
  };
}
