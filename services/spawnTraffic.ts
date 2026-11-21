/**
 * Shared spawn rules for Expo arcade and classroom scenarios.
 *
 * Lesson aircraft used to spawn on the outer ring, heading inbound, with a
 * solvable path to their assigned gate — never mid-scope, never already
 * past the gate. That changed in Nov 2026 (lesson pacing): the outer-ring
 * spawn is ~75 NM from the gate, ~18–24 min wall at 1x, so a Trainee round
 * dragged on far longer than a class period. Lesson aircraft now spawn
 * near their gate fix, like Expo (see LESSON_SPAWN_DISTANCE_NM below).
 * placeInboundAircraft (outer ring) is kept for the tutorial scenario
 * helpers and any caller that explicitly wants an edge spawn.
 */
import { Aircraft, AlertLevel } from '../types';
import { CENTER, GATE_RADIUS, GATES, NM_TO_PX } from '../constants';

/** Just outside the airspace ring (37–39 NM from center), visible on the scope edge. */
export const SPAWN_EDGE_MIN = GATE_RADIUS + 20;
export const SPAWN_EDGE_MAX = GATE_RADIUS + 40;
/** Minimum separation between spawns (~6 NM). */
export const SPAWN_SEP_PX = 6 * NM_TO_PX;

/**
 * Expo (arcade) spawn budgets — Nov 2026 crossing-time bug.
 *
 * Lesson aircraft spawn on the outer ring opposite their gate and fly
 * ~75–80 NM to exit (~19–24 min wall at 1x): realistic for training, and
 * lesson sessions are untimed. Expo rounds are timed (5 min / 60 s at 6x),
 * so Expo aircraft spawn INSIDE the ring, near their destination gate fix.
 * Straight-line distance to the fix is the budget:
 *   16 NM at 250 kt, 6x = ~38 s wall (5-min shift, 90 s budget)
 *   16 NM at 140 kt, 6x = ~69 s wall (NORDO, 90 s budget)
 *   10 NM at 250 kt, 6x = ~24 s wall (60-Second Challenge, 45 s budget)
 */
export const MIN_GATE_SPAWN_DISTANCE_NM = 14;
export const EXPO_SPAWN_DISTANCE_NM = 24;
export const EXPO_SIXTY_SPAWN_DISTANCE_NM = 15;

/**
 * Lesson spawn budget — Nov 2026 lesson-pacing fix (Option C: closer spawn
 * + faster default speed, instead of either alone).
 *
 * Lesson aircraft spawn 24 NM from their destination gate fix, heading
 * 30–50° off the fix bearing (same near-gate placer as Expo, so a vector
 * is still required and separation conflicts are still possible), and
 * lesson modes now default to 2x (DEFAULT_TIME_SCALE).
 *   24 NM at 200 kt, 2x = 216 s wall straight-line (slowest lesson speed)
 *   24 NM at 250 kt, 2x = 173 s wall (fastest lesson speed)
 * Both are inside the ~5 min per-aircraft budget with turn margin; at 1x
 * the same crossing is 346–432 s, still finishable. All lesson aircraft
 * spawn at t=0, so a Trainee round (4) resolves in ~4–5 min of flying
 * plus thinking time (~6–8 min total), Controller (8) in ~10 min.
 * The old outer-ring spawn was ~75 NM: 1080–1350 s wall at 1x.
 */
export const LESSON_SPAWN_DISTANCE_NM = 28;
export const LESSON_BUDGET_WALL_SEC = 300;

/** Fix (gate exit point) for a destination gate id, or null. */
export function gateFixFor(destination: string): { x: number; y: number } | null {
  return GATES.find((g) => g.id === destination)?.fix ?? null;
}

/** Straight-line distance (NM) from an aircraft to its destination gate fix. */
export function distanceToGateNm(
  ac: Pick<Aircraft, 'x' | 'y' | 'destination'>,
): number | null {
  const fix = gateFixFor(ac.destination);
  if (!fix) return null;
  return Math.hypot(fix.x - ac.x, fix.y - ac.y) / NM_TO_PX;
}

/**
 * Wall-clock seconds to fly distanceNm at speedKt with the sim running at
 * timeScale x. Straight-line, no turns — the minimum possible crossing time.
 */
export function crossingTimeWallSeconds(
  distanceNm: number,
  speedKt: number,
  timeScale: number,
): number {
  if (speedKt <= 0 || timeScale <= 0) return Infinity;
  return (distanceNm / speedKt) * 3600 / timeScale;
}

/** Bearing (deg, 0 = north, clockwise) of the vector from `from` to `to`. */
export function bearingTo(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return normalizeHeading((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI);
}

/** Point `distPx` from `from` along bearing `bearingDeg`. */
export function pointAlongBearing(
  from: { x: number; y: number },
  bearingDeg: number,
  distPx: number,
): { x: number; y: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: from.x + distPx * Math.sin(rad), y: from.y - distPx * Math.cos(rad) };
}

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
 * Protected dead-zone bands BETWEEN the 4 exit gates (NOR 20-50, EAS 90-120,
 * SOU 180-210, WES 270-300). Every inbound aircraft spawns outside the ring
 * inside one of these protected areas so inbound traffic never enters through
 * an exit gate corridor.
 */
export const PROTECTED_SPAWN_BANDS: Record<'NW' | 'NE' | 'SE' | 'SW', { min: number; max: number }> = {
  NW: { min: 315, max: 5 },
  NE: { min: 62, max: 78 },
  SE: { min: 135, max: 165 },
  SW: { min: 225, max: 255 },
};

const OPPOSITE_PROTECTED_BANDS: Record<string, Array<{ min: number; max: number }>> = {
  NOR: [PROTECTED_SPAWN_BANDS.SW, PROTECTED_SPAWN_BANDS.SE],
  EAS: [PROTECTED_SPAWN_BANDS.NW, PROTECTED_SPAWN_BANDS.SW],
  SOU: [PROTECTED_SPAWN_BANDS.NW, PROTECTED_SPAWN_BANDS.NE],
  WES: [PROTECTED_SPAWN_BANDS.SE, PROTECTED_SPAWN_BANDS.NE],
};

/** True when bearingDeg (0-360) falls inside any exit gate corridor (±bufferDeg). */
export function isInGateCorridor(bearingDeg: number, bufferDeg = 8): boolean {
  const b = normalizeHeading(bearingDeg);
  return GATES.some((g) => {
    const start = normalizeHeading(g.startAngle - bufferDeg);
    const end = normalizeHeading(g.endAngle + bufferDeg);
    if (start <= end) return b >= start && b <= end;
    return b >= start || b <= end;
  });
}

/**
 * Primary protected dead-zone spawn band opposite the destination gate
 * (strictly outside every exit gate corridor).
 */
export function spawnAngleBandForGate(destination: string): { min: number; max: number } {
  const bands = OPPOSITE_PROTECTED_BANDS[destination];
  return bands ? bands[0] : PROTECTED_SPAWN_BANDS.NW;
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
 * Place one aircraft outside the airspace ring in a protected dead zone
 * between the gates, heading inbound and separated from existing traffic.
 */
export function placeInboundAircraft(
  spec: SpawnSpec,
  existing: Aircraft[],
  random: () => number,
): Aircraft {
  const bands = OPPOSITE_PROTECTED_BANDS[spec.destination] ?? [PROTECTED_SPAWN_BANDS.NW, PROTECTED_SPAWN_BANDS.SE];
  let chosen = { x: CENTER, y: CENTER, heading: 0, angle: 0, dist: SPAWN_EDGE_MAX };
  let placed = false;

  for (let attempt = 0; attempt < 40 && !placed; attempt++) {
    const band = bands[Math.floor(random() * bands.length)];
    const angle = angleInBand(random, band.min, band.max);
    const dist = SPAWN_EDGE_MIN + random() * (SPAWN_EDGE_MAX - SPAWN_EDGE_MIN);
    const p = polarPos(angle, dist);
    const crowded = existing.some((ac) => Math.hypot(ac.x - p.x, ac.y - p.y) < SPAWN_SEP_PX);
    if (crowded) continue;
    // Slight ±8° offset around pure inbound so it enters cleanly through the protected area
    // without clipping an adjacent gate corridor.
    const offset = (random() - 0.5) * 16;
    chosen = { ...p, heading: inboundHeading(angle, offset), angle, dist };
    placed = true;
  }

  if (!placed) {
    // Systematic fallback across all protected dead zones (never inside a gate).
    const allBands = [...bands, ...Object.values(PROTECTED_SPAWN_BANDS)];
    for (const band of allBands) {
      for (let dist = SPAWN_EDGE_MIN; dist <= SPAWN_EDGE_MAX + 30 && !placed; dist += 12) {
        for (const t of [0.5, 0.25, 0.75, 0.1, 0.9]) {
          const angle = angleInBand(() => t, band.min, band.max);
          const p = polarPos(angle, dist);
          const crowded = existing.some((ac) => Math.hypot(ac.x - p.x, ac.y - p.y) < SPAWN_SEP_PX);
          if (!crowded) {
            chosen = { ...p, heading: inboundHeading(angle, 0), angle, dist };
            placed = true;
            break;
          }
        }
      }
      if (placed) break;
    }
  }

  if (!placed) {
    const band = bands[0];
    const angle = angleInBand(() => 0.5, band.min, band.max);
    const dist = SPAWN_EDGE_MAX + existing.length * 10;
    const p = polarPos(angle, dist);
    chosen = { ...p, heading: inboundHeading(angle, 0), angle, dist };
  }

  return makeAircraft(spec, chosen.x, chosen.y, chosen.heading, chosen.angle);
}

function makeAircraft(spec: SpawnSpec, x: number, y: number, heading: number, angle: number): Aircraft {
  return {
    id: `${spec.idPrefix || 'spawn'}-${spec.callsign}-${Math.round(angle)}`,
    callsign: spec.callsign,
    type: spec.type,
    x,
    y,
    heading,
    targetHeading: heading,
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

/**
 * One Expo re-entry candidate near the destination gate fix: `distanceNm`
 * from the fix, on the centre side of it (offset angle off the fix→centre
 * line), heading toward the fix but rotated toward the centre so a vector
 * is still required. Returns the point, its heading, and the bearing from
 * the point to the fix.
 */
export function expoSpawnCandidate(
  destination: string,
  distanceNm: number,
  offsetDeg: number,
  directHeading: boolean,
): { x: number; y: number; heading: number; bearingToFix: number } | null {
  const gate = GATES.find((g) => g.id === destination);
  if (!gate) return null;
  const mid = (gate.startAngle + gate.endAngle) / 2;
  const distPx = distanceNm * NM_TO_PX;
  // Spawn on a circle around the fix, on the centre side of it.
  const spawnBearing = normalizeHeading(mid + 180 + offsetDeg);
  const p = pointAlongBearing(gate.fix, spawnBearing, distPx);
  const bearingToFix = bearingTo(p, gate.fix);
  const centreBearing = bearingTo(p, { x: CENTER, y: CENTER });
  let heading = bearingToFix;
  if (!directHeading) {
    // Rotate the fix bearing toward the centre bearing by 30–50°: the
    // aircraft still needs a vector, but it drifts inward, not out the gate.
    let diff = centreBearing - bearingToFix;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    const turn = Math.max(30, Math.min(50, Math.abs(diff))) * Math.sign(diff || 1);
    heading = normalizeHeading(bearingToFix + turn);
  }
  return { ...p, heading, bearingToFix };
}

export interface ExpoSpawnOptions {
  /** Straight-line distance (NM) from the destination gate fix. */
  distanceNm: number;
  /** True for unvectorable aircraft (NORDO): heading points straight at the fix. */
  directHeading?: boolean;
}

/**
 * Place one aircraft INSIDE the ring, near its destination gate fix — the
 * near-gate counterpart to placeInboundAircraft (outer ring). Used by Expo
 * (16 / 10 NM) and, since Nov 2026, by lesson modes (24 NM). The player
 * must still vector it: the initial heading is 30–50° off the fix bearing,
 * and the spawn is 6+ NM clear of the fix.
 * Spawning inside the ring matters mechanically: HANDOFF only fires from
 * ACTIVE, and an aircraft becomes ACTIVE the first tick it is inside the
 * ring — an outside-ring spawn heading straight out would never activate.
 */
export function placeNearGateAircraft(
  spec: SpawnSpec,
  existing: Aircraft[],
  random: () => number,
  options: ExpoSpawnOptions,
): Aircraft {
  const gate = GATES.find((g) => g.id === spec.destination);
  const mid = gate ? (gate.startAngle + gate.endAngle) / 2 : 0;
  const targetDistanceNm = Math.max(MIN_GATE_SPAWN_DISTANCE_NM, options.distanceNm);
  let chosen: { x: number; y: number; heading: number } | null = null;

  for (let attempt = 0; attempt < 28 && !chosen; attempt++) {
    const offset = options.directHeading ? 0 : (random() - 0.5) * 60; // ±30° off the fix→centre line
    const cand = expoSpawnCandidate(spec.destination, targetDistanceNm, offset, !!options.directHeading);
    if (!cand) break;
    const distC = distFromCenter(cand.x, cand.y);
    if (distC >= GATE_RADIUS - 5 || distC < 40) continue;
    const crowded = existing.some((ac) => Math.hypot(ac.x - cand.x, ac.y - cand.y) < SPAWN_SEP_PX);
    if (crowded) continue;
    chosen = cand;
  }

  if (!chosen) {
    const tryCandidate = (
      offsetDeg: number,
      distNm: number,
    ): { x: number; y: number; heading: number } | null => {
      const cand = expoSpawnCandidate(spec.destination, distNm, offsetDeg, !!options.directHeading);
      if (!cand) return null;
      const distC = distFromCenter(cand.x, cand.y);
      if (distC >= GATE_RADIUS - 5 || distC < 40) return null;
      const crowded = existing.some((ac) => Math.hypot(ac.x - cand.x, ac.y - cand.y) < SPAWN_SEP_PX);
      return crowded ? null : cand;
    };
    for (let offset = -180; offset <= 180 && !chosen; offset += 5) {
      chosen = tryCandidate(offset, targetDistanceNm);
    }
    // Only expand outward away from the gate — never pull spawns closer to the gate.
    for (const delta of [4, 8, 12] as const) {
      for (let offset = -180; offset <= 180 && !chosen; offset += 5) {
        chosen = tryCandidate(offset, targetDistanceNm + delta);
      }
    }
    if (!chosen) {
      let best: { x: number; y: number; heading: number } | null = null;
      let bestMin = -1;
      for (let offset = -180; offset < 180; offset += 5) {
        const cand = expoSpawnCandidate(spec.destination, targetDistanceNm, offset, !!options.directHeading);
        if (!cand) continue;
        const distC = distFromCenter(cand.x, cand.y);
        if (distC >= GATE_RADIUS - 5 || distC < 40) continue;
        const minSep = existing.length
          ? Math.min(...existing.map((ac) => Math.hypot(ac.x - cand.x, ac.y - cand.y)))
          : Infinity;
        if (minSep > bestMin) {
          bestMin = minSep;
          best = cand;
        }
      }
      chosen = best ?? expoSpawnCandidate(spec.destination, targetDistanceNm, 0, !!options.directHeading) ?? { x: CENTER, y: CENTER - 200, heading: mid };
    }
  }

  const angle = bearingTo({ x: CENTER, y: CENTER }, { x: chosen.x, y: chosen.y });
  return makeAircraft(spec, chosen.x, chosen.y, chosen.heading, angle);
}

/** Backwards-compatible alias — the function was named for Expo before lessons used it too. */
export const placeExpoAircraft = placeNearGateAircraft;

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
