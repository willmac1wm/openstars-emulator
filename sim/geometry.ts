import { NM_TO_PX } from '../constants';
import type { ApproachProcedure, WindState } from './types';
import { approachGateNmFromThreshold } from './rules/intercept';

export function toRad(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

export function normalizeHeading(deg: number): number {
  let h = deg % 360;
  if (h < 0) h += 360;
  return h;
}

export function nmToPx(nm: number): number {
  return nm * NM_TO_PX;
}

export function pxToNm(px: number): number {
  return px / NM_TO_PX;
}

export function distNm(ax: number, ay: number, bx: number, by: number): number {
  return pxToNm(Math.hypot(ax - bx, ay - by));
}

/** Ground track and GS from IAS heading + wind (meteorological from-direction). */
export function applyWind(
  headingDeg: number,
  iasKt: number,
  wind: WindState,
): { trackDeg: number; gsKt: number } {
  if (wind.calm || wind.speedKt <= 0) {
    return { trackDeg: headingDeg, gsKt: iasKt };
  }
  const h = toRad(headingDeg);
  const windTo = normalizeHeading(wind.fromDeg + 180);
  const w = toRad(windTo);
  const vx = Math.cos(h) * iasKt + Math.cos(w) * wind.speedKt;
  const vy = Math.sin(h) * iasKt + Math.sin(w) * wind.speedKt;
  const gs = Math.hypot(vx, vy);
  let track = (Math.atan2(vy, vx) * 180) / Math.PI + 90;
  track = normalizeHeading(track);
  return { trackDeg: track, gsKt: gs };
}

export function pointAlongFinal(proc: ApproachProcedure, nmFromThreshold: number): { x: number; y: number } {
  // Along reciprocal of final course (outbound from threshold along approach).
  const outbound = normalizeHeading(proc.finalCourseDeg + 180);
  const rad = toRad(outbound);
  const d = nmToPx(nmFromThreshold);
  return {
    x: proc.threshold.x + Math.cos(rad) * d,
    y: proc.threshold.y + Math.sin(rad) * d,
  };
}

export function distanceAlongFinalNm(proc: ApproachProcedure, x: number, y: number): number {
  // Project onto final course axis; positive = from threshold toward FAF (outbound).
  const outbound = normalizeHeading(proc.finalCourseDeg + 180);
  const rad = toRad(outbound);
  const dx = x - proc.threshold.x;
  const dy = y - proc.threshold.y;
  const along = dx * Math.cos(rad) + dy * Math.sin(rad);
  return pxToNm(along);
}

export function crossTrackNm(proc: ApproachProcedure, x: number, y: number): number {
  const outbound = normalizeHeading(proc.finalCourseDeg + 180);
  const rad = toRad(outbound);
  const dx = x - proc.threshold.x;
  const dy = y - proc.threshold.y;
  // Perpendicular
  const cross = -dx * Math.sin(rad) + dy * Math.cos(rad);
  return pxToNm(cross);
}

export function fafPoint(proc: ApproachProcedure): { x: number; y: number } {
  return pointAlongFinal(proc, proc.fafNm);
}

export function gatePoint(proc: ApproachProcedure): { x: number; y: number } {
  return pointAlongFinal(proc, approachGateNmFromThreshold(proc));
}
