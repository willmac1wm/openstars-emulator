/**
 * Shared spawn rules for Expo arcade and classroom scenarios.
 * Aircraft always enter from the outer ring, heading inbound, with a solvable
 * path to their assigned gate — never mid-scope, never already past the gate.
 */
import { Aircraft, AlertLevel } from '../types';
import { CENTER, GATE_RADIUS, GATES, NM_TO_PX } from '../constants';

/** Just outside the gate ring (scope edge / outer ring). */
export const SPAWN_EDGE_MIN = GATE_RADIUS + 45;
export const SPAWN_EDGE_MAX = GATE_RADIUS + 95;
/** Minimum separation between spawns (~6 NM). */
export const SPAWN_SEP_PX = 6 * NM_TO_PX;

const GATE_MID: Record<string, number> = Object.fromEntries(
  GATES.map((g) => [g.id, (g.startAngle + g.endAngle) / 2]),
);

export function polarPos(deg: number, dist: number): { x: number; y: number } {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: CENTER + dist * Math.cos(rad), y: CENTER + dist * Math.sin(rad) };
}

export function normalizeHeading(deg: number): number {
  let h = deg % 360;
  if (h < 0) h += 360;
  return h;
}

export function distFromCenter(x: number, y: number): number {
  return Math.hypot(x - CENTER, y - CENTER);
}

/** True when the aircraft is outside the gate ring (edge / inbound corridor). */
export function isEdgeSpawn(ac: Pick<Aircraft, 'x' | 'y'>): boolean {
  const d = distFromCenter(ac.x, ac.y);
  return d >= GATE_RADIUS + 20;
}

/** Heading from position toward the center, within ±maxOffsetDeg. */
export function inboundHeading(angleDeg: number, offsetDeg = 0): number {
  return normalizeHeading(angleDeg + 180 + offsetDeg);
}

/**
 * Spawn angle band opposite the destination gate so a normal turn reaches it
 * without needing a 180° at the boundary.
 */
export function spawnAngleBandForGate(destination: string): { min: number; max: number } {
  const mid = GATE_MID[destination] ?? 0;
  // Opposite side of the scope (±25°).
  const opposite = normalizeHeading(mid + 180);
  return { min: normalizeHeading(opposite - 25), max: normalizeHeading(opposite + 25) };
}

function angleInBand(random: () => number, min: number, max: number): number {
  if (min <= max) return min + random() * (max - min);
  // wraps across 360
  const span = (360 - min) + max;
  const t = random() * span;
  return normalizeHeading(min + t);
}

export interface SpawnSpec {
  callsign: string;
  type: string;
  destination: string;
  altitude: number;
  speed: number;
  special?: Aircraft['special'];
  idPrefix?: string;
}

/**
 * Place one aircraft on the outer ring, heading inbound, separated from others.
 */
export function placeInboundAircraft(
  spec: SpawnSpec,
  existing: Aircraft[],
  random: () => number,
): Aircraft {
  const band = spawnAngleBandForGate(spec.destination);
  let chosen = { x: CENTER, y: CENTER, heading: 0, angle: 0, dist: SPAWN_EDGE_MAX };
  let placed = false;

  for (let attempt = 0; attempt < 28 && !placed; attempt++) {
    const angle = angleInBand(random, band.min, band.max);
    const dist = SPAWN_EDGE_MIN + random() * (SPAWN_EDGE_MAX - SPAWN_EDGE_MIN);
    const p = polarPos(angle, dist);
    const crowded = existing.some((ac) => Math.hypot(ac.x - p.x, ac.y - p.y) < SPAWN_SEP_PX);
    if (crowded) continue;
    const offset = (random() - 0.5) * 24; // ±12° around pure inbound
    chosen = { ...p, heading: inboundHeading(angle, offset), angle, dist };
    placed = true;
  }

  if (!placed) {
    const angle = angleInBand(() => 0.5, band.min, band.max);
    const dist = SPAWN_EDGE_MAX + existing.length * 15;
    const p = polarPos(angle, dist);
    chosen = { ...p, heading: inboundHeading(angle, 0), angle, dist };
  }

  return {
    id: `${spec.idPrefix || 'spawn'}-${spec.callsign}-${Math.round(chosen.angle)}`,
    callsign: spec.callsign,
    type: spec.type,
    x: chosen.x,
    y: chosen.y,
    heading: chosen.heading,
    targetHeading: chosen.heading,
    altitude: spec.altitude,
    targetAltitude: spec.altitude,
    speed: spec.speed,
    targetSpeed: spec.speed,
    history: [],
    status: 'INBOUND',
    cleared: false,
    alertLevel: AlertLevel.NONE,
    messages: [],
    isSelected: false,
    destination: spec.destination,
    dataBlockDir: 45,
    special: spec.special,
  };
}

/** Assert helpers for tests — heading points roughly toward center. */
export function isHeadingInbound(ac: Pick<Aircraft, 'x' | 'y' | 'heading'>, maxDeg = 40): boolean {
  const radial = normalizeHeading((Math.atan2(ac.y - CENTER, ac.x - CENTER) * 180) / Math.PI + 90);
  const towardCenter = normalizeHeading(radial + 180);
  let diff = Math.abs(ac.heading - towardCenter);
  if (diff > 180) diff = 360 - diff;
  return diff <= maxDeg;
}

/** Gate mid bearing from aircraft; turn from current heading should be < 120°. */
export function turnToGateDeg(ac: Pick<Aircraft, 'x' | 'y' | 'heading' | 'destination'>): number {
  const gate = GATES.find((g) => g.id === ac.destination);
  if (!gate) return 0;
  const bearing = normalizeHeading((Math.atan2(gate.fix.y - ac.y, gate.fix.x - ac.x) * 180) / Math.PI + 90);
  let diff = Math.abs(bearing - ac.heading);
  if (diff > 180) diff = 360 - diff;
  return diff;
}
