/**
 * Exit / gate scoring for the legacy (non-VTF) game — pure functions so the
 * After Action Report can explain every point change.
 *
 * Root-cause note (Nov 2026 browser test): exit gate was chosen from the
 * aircraft's *position bearing* alone. A trainee flying DAL456 due east
 * (H090) toward EAS from the north-west side of the scope crosses the gate
 * ring at bearing ~072° — outside the EAS wedge (090–120°) — and was scored
 * OFF COURSE even though the heading was right for the east gate. The gate
 * is now also resolved from the aircraft's *heading* when the position
 * bearing falls outside every gate, and the exit is graded sloppy (not
 * off-course) in that case, with the bearing gap spelled out in the reason.
 *
 * A "clean" exit must meet ALL criteria (right gate, centred, legal
 * altitude). A wrong-altitude exit earns no clean/sloppy points — only the
 * penalty — so an exit can never be both CLEAN EXIT +1000 and WRONG ALT −250.
 */
import { Aircraft, Gate } from '../types';
import {
  ALTS_NORTH_EAST,
  ALTS_SOUTH_WEST,
  GATES,
  PENALTY_OFF_COURSE,
  PENALTY_WRONG_ALT,
  PENALTY_WRONG_GATE,
  SCORE_PERFECT_EXIT,
  SCORE_SLOPPY_EXIT,
} from '../constants';

export type ExitKind = 'clean' | 'sloppy' | 'wrong-alt' | 'wrong-gate' | 'off-course';

export interface ExitEvaluation {
  kind: ExitKind;
  /** Points to add to the score (negative for penalties). */
  points: number;
  /** Short label shown on the datablock (e.g. "CLEAN EXIT"). */
  handoffResult: string;
  /** Plain-language reason, shown in the comm log and the AAR incident log. */
  reason: string;
  /** Gate the exit was judged against, if any. */
  gateId: string | null;
  /** Position bearing (deg, 0 = north) where the aircraft crossed the gate ring. */
  exitBearing: number;
  /** True when the gate was resolved from heading, not position bearing. */
  viaHeading: boolean;
  /** Altitude (hundreds of ft) at exit, and the legal altitudes for the gate. */
  actualAlt: number;
  requiredAlts: number[];
}

export function normalizeBearing(deg: number): number {
  let b = ((Math.round(deg) % 360) + 360) % 360;
  if (b === 0) b = 360;
  return b;
}

export function gateForExitBearing(angleDeg: number): Gate | null {
  const b = normalizeBearing(angleDeg);
  return GATES.find((g) => b >= g.startAngle && b <= g.endAngle) ?? null;
}

/** Gate whose angular span contains the aircraft's heading (e.g. H090 → EAS 090–120). */
export function gateForHeading(heading: number): Gate | null {
  const h = normalizeBearing(heading);
  return GATES.find((g) => h >= g.startAngle && h <= g.endAngle) ?? null;
}

export function gateBearingRange(gate: Gate): string {
  return `${gate.startAngle}°–${gate.endAngle}°`;
}

export function evaluateExit(
  ac: Pick<Aircraft, 'callsign' | 'destination' | 'heading' | 'altitude'>,
  exitBearingDeg: number,
  perfectPoints: number = SCORE_PERFECT_EXIT,
): ExitEvaluation {
  const exitBearing = normalizeBearing(exitBearingDeg);
  const actualAlt = Math.round(ac.altitude);
  const gate = gateForExitBearing(exitBearing);
  const viaHeading = !gate;
  const judgedGate = gate ?? gateForHeading(ac.heading);
  const gateRanges = GATES.map((g) => `${g.id} ${gateBearingRange(g)}`).join(', ');

  if (!judgedGate) {
    return {
      kind: 'off-course',
      points: -PENALTY_OFF_COURSE,
      handoffResult: 'OFF COURSE',
      reason:
        `${ac.callsign} exited at bearing ${exitBearing}° (heading ${normalizeBearing(ac.heading)}°) — ` +
        `outside every gate (${gateRanges}). ` +
        `Assigned gate ${ac.destination}: fly the aircraft into the gate funnel, not just onto its heading.`,
      gateId: null,
      exitBearing,
      viaHeading: false,
      actualAlt,
      requiredAlts: [],
    };
  }

  if (judgedGate.id !== ac.destination) {
    return {
      kind: 'wrong-gate',
      points: -PENALTY_WRONG_GATE,
      handoffResult: 'WRONG GATE',
      reason:
        `${ac.callsign} exited the ${judgedGate.label} gate at bearing ${exitBearing}° ` +
        `but was assigned ${ac.destination} (gate ${gateBearingRange(judgedGate)} vs assigned ` +
        `${GATES.find((g) => g.id === ac.destination)?.label ?? ac.destination}).`,
      gateId: judgedGate.id,
      exitBearing,
      viaHeading,
      actualAlt,
      requiredAlts: [],
    };
  }

  const requiredAlts =
    judgedGate.id === 'NOR' || judgedGate.id === 'EAS' ? ALTS_NORTH_EAST : ALTS_SOUTH_WEST;
  const hasValidAlt = requiredAlts.includes(actualAlt);
  const gateMid = (judgedGate.startAngle + judgedGate.endAngle) / 2;
  const semiWidth = (judgedGate.endAngle - judgedGate.startAngle) / 2;
  const offCentre = Math.abs(exitBearing - gateMid);
  const isClean = offCentre < semiWidth * 0.8;
  const bearingNote =
    `exit bearing ${exitBearing}° vs ${judgedGate.label} gate centre ${gateMid}° ` +
    `(${gateBearingRange(judgedGate)})` +
    (viaHeading
      ? ` — gate judged from heading ${normalizeBearing(ac.heading)}° because the exit bearing fell outside the gate wedge`
      : '');

  if (!hasValidAlt) {
    return {
      kind: 'wrong-alt',
      points: -PENALTY_WRONG_ALT,
      handoffResult: 'WRONG ALT',
      reason:
        `${ac.callsign} exited ${judgedGate.label} at ${actualAlt}00 ft, but ${judgedGate.label} ` +
        `requires ${requiredAlts.map((a) => `${a}00`).join(' or ')} ft. ` +
        `No clean-exit points: a clean exit needs the right gate, centred, at a legal altitude. ` +
        `(${bearingNote}; ${isClean ? 'centred' : `${offCentre}° off centre`}.)`,
      gateId: judgedGate.id,
      exitBearing,
      viaHeading,
      actualAlt,
      requiredAlts,
    };
  }

  if (isClean) {
    return {
      kind: 'clean',
      points: perfectPoints,
      handoffResult: 'CLEAN EXIT',
      reason: `${ac.callsign} clean exit ${judgedGate.label} — ${bearingNote}, alt ${actualAlt}00 ft.`,
      gateId: judgedGate.id,
      exitBearing,
      viaHeading,
      actualAlt,
      requiredAlts,
    };
  }

  return {
    kind: 'sloppy',
    points: SCORE_SLOPPY_EXIT,
    handoffResult: 'SLOPPY EXIT',
    reason:
      `${ac.callsign} exited ${judgedGate.label} ${offCentre}° off centre ` +
      `(${bearingNote}) — touched the gate sides, alt ${actualAlt}00 ft.`,
    gateId: judgedGate.id,
    exitBearing,
    viaHeading,
    actualAlt,
    requiredAlts,
  };
}
