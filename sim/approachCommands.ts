/**
 * Parse typed / speech-derived approach clearances into patches.
 * Phraseology targets JO 7110.65BB 5-9-4 / 4-8-1 patterns.
 */

import { parseCommand } from '../services/commandParser';
import type { Aircraft } from '../types';
import type { ApproachKind, ApproachProcedure, SimAircraft } from './types';
import { formatApproachClearance } from './approachPhraseology';
import { distNm } from './geometry';
import { speedAssignmentBlockedReason } from './rules/speed';
import { checkInterceptLegality } from './rules/intercept';
import { applyWind } from './geometry';
import type { WindState } from './types';
import { approachGateNmFromThreshold } from './rules/intercept';
import { distanceAlongFinalNm } from './geometry';

export interface ApproachCommandResult {
  ok: boolean;
  callsign?: string;
  aircraftId?: string;
  controllerEcho?: string;
  readback?: string;
  unableReason?: string;
  patch?: Partial<SimAircraft>;
  scoreHint?: { kind: string; points: number; detail: string };
}

function toLegacyAc(ac: SimAircraft): Aircraft {
  return {
    id: ac.id,
    callsign: ac.callsign,
    type: ac.type,
    x: ac.x,
    y: ac.y,
    altitude: ac.altitude,
    targetAltitude: ac.targetAltitude,
    speed: ac.ias,
    targetSpeed: ac.targetIas,
    heading: ac.heading,
    targetHeading: ac.targetHeading,
    history: ac.history,
    status: 'ACTIVE',
    alertLevel: ac.alertLevel,
    cleared: ac.approachCleared,
    messages: [],
    isSelected: ac.isSelected,
    destination: ac.destinationGate || 'SOU',
    dataBlockDir: 45,
    turnDirection: ac.turnDirection,
    special: ac.special,
  };
}

const APCH_RE =
  /\b(?:CLEARED\s+)?(ILS|VOR)\s+RWY?\s*(\d{1,2}[LCR]?)\s*(?:APPROACH|APCH)?\b/i;
const MILES_FROM_RE = /(\d{1,2})\s*MILES?\s+FROM\s+([A-Z0-9 ]+?)(?=\s+(?:TURN|HDG|H|TL|TR|MAINTAIN|CLEARED)|$)/i;
const UNTIL_EST_RE = /MAINTAIN\s+(?:A)?(\d{2,3})\s+UNTIL\s+ESTABLISHED/i;
const TURN_HDG_RE = /\b(?:TURN\s+)?(LEFT|RIGHT)\s+(?:HDG|HEADING|H)?\s*(\d{3})\b/i;
const HDG_RE = /\b(?:HDG|HEADING|H|T)(\d{3})\b/i;
const TL_RE = /\bTL(\d{3})\b/i;
const TR_RE = /\bTR(\d{3})\b/i;

export function parseApproachCommand(
  raw: string,
  aircraft: SimAircraft[],
  selectedId: string | null,
  proc: ApproachProcedure | null,
  wind: WindState,
): ApproachCommandResult {
  const cmd = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!cmd) return { ok: false, unableReason: 'Say again' };

  // Sector handoff stubs: N1 AAL421 / S1 / E1 / W1 — handled by reducer separately.
  if (/^[NSEW]1\b/.test(cmd)) {
    return { ok: false, unableReason: 'HANDOFF_TOKEN' };
  }

  const apch = cmd.match(APCH_RE);
  if (apch && proc) {
    const kind = apch[1].toUpperCase() as ApproachKind;
    const runway = apch[2].replace(/[LCR]/g, '');
    const callsignMatch = cmd.match(/^([A-Z]{2,3}\d{1,4}|[A-Z]+)/);
    let callsign = callsignMatch?.[1];
    const target =
      aircraft.find((a) => a.callsign === callsign) ||
      aircraft.find((a) => a.id === selectedId) ||
      null;
    if (!target) return { ok: false, unableReason: 'TARGET NOT FOUND' };
    callsign = target.callsign;

    if (kind !== proc.kind || runway !== proc.runway.replace(/[LCR]/g, '')) {
      return {
        ok: false,
        callsign,
        aircraftId: target.id,
        controllerEcho: cmd,
        readback: `Unable, ${callsign}`,
        unableReason: 'Approach/runway mismatch',
      };
    }

    const miles = cmd.match(MILES_FROM_RE);
    const until = cmd.match(UNTIL_EST_RE);
    let turn: 'LEFT' | 'RIGHT' | undefined;
    let heading: number | undefined;
    const tl = cmd.match(TL_RE);
    const tr = cmd.match(TR_RE);
    const turnH = cmd.match(TURN_HDG_RE);
    if (tl) {
      turn = 'LEFT';
      heading = Number(tl[1]);
    } else if (tr) {
      turn = 'RIGHT';
      heading = Number(tr[1]);
    } else if (turnH) {
      turn = turnH[1].toUpperCase() as 'LEFT' | 'RIGHT';
      heading = Number(turnH[2]);
    } else {
      const h = cmd.match(HDG_RE);
      if (h) heading = Number(h[1]);
    }

    const maintain = until ? Number(until[1]) : undefined;
    // Incomplete clearance per 5-9-4: need position, vector (if required), altitude until established, clearance.
    if (heading === undefined || maintain === undefined || !miles) {
      return {
        ok: false,
        callsign,
        aircraftId: target.id,
        controllerEcho: cmd,
        readback: `Say again, ${callsign}`,
        unableReason: 'Incomplete approach clearance (need miles-from, heading, maintain-until-established, cleared approach) — JO 7110.65BB 5-9-4',
      };
    }

    const distThr = distNm(target.x, target.y, proc.threshold.x, proc.threshold.y);
    const gateNm = approachGateNmFromThreshold(proc);
    const distGate = Math.max(0, distThr - gateNm);
    const { trackDeg } = applyWind(heading, target.ias, wind);
    const legality = checkInterceptLegality({
      trackDeg,
      distanceToGateNm: distGate,
      distanceToThresholdNm: distThr,
      altitudeFt: maintain * 100,
      proc,
    });

    const phrase = formatApproachClearance({
      callsign,
      milesFrom: Number(miles[1]),
      fixName: miles[2].trim() || proc.fafName,
      turn,
      heading,
      maintainUntilEstablished: maintain,
      approachKind: kind,
      runway: proc.runway,
    });

    if (!legality.ok) {
      return {
        ok: false,
        callsign,
        aircraftId: target.id,
        controllerEcho: phrase.controller,
        readback: `Unable, ${callsign}`,
        unableReason: legality.reasons.join('; '),
      };
    }

    return {
      ok: true,
      callsign,
      aircraftId: target.id,
      controllerEcho: phrase.controller,
      readback: phrase.pilot,
      patch: {
        targetHeading: heading,
        turnDirection: turn,
        targetAltitude: maintain,
        maintainUntilEstablished: maintain,
        approachCleared: true,
        approachKind: kind,
        clearedRunway: proc.runway,
        phase: 'intercepting',
      },
      scoreHint: { kind: 'legal_clearance', points: 200, detail: 'Legal approach clearance' },
    };
  }

  // Speed with optional "UNTIL <fix>" — still blocked inside FAF/5NM per 5-7-1.
  const speedMatch = cmd.match(/\b(?:S|SPD|SPEED)\s*(\d{2,3})\b/);
  if (speedMatch && proc) {
    const legacy = parseCommand(cmd, aircraft.map(toLegacyAc), selectedId);
    if (legacy.kind === 'not_found') return { ok: false, unableReason: `TARGET ${legacy.callsign} NOT FOUND` };
    const target = aircraft.find((a) => a.id === legacy.aircraftId)!;
    const distThr = distanceAlongFinalNm(proc, target.x, target.y);
    // Use distance to threshold along track approx
    const d = distNm(target.x, target.y, proc.threshold.x, proc.threshold.y);
    const blocked = speedAssignmentBlockedReason(d, proc.fafNm);
    if (blocked) {
      return {
        ok: false,
        callsign: target.callsign,
        aircraftId: target.id,
        controllerEcho: legacy.controllerEcho,
        readback: `Unable, ${target.callsign}`,
        unableReason: blocked,
      };
    }
    const spd = Number(speedMatch[1]);
    return {
      ok: true,
      callsign: target.callsign,
      aircraftId: target.id,
      controllerEcho: legacy.controllerEcho,
      readback: legacy.readback || undefined,
      patch: { targetIas: spd },
    };
  }

  // Fall back to existing heading/alt/speed grammar.
  const legacy = parseCommand(cmd, aircraft.map(toLegacyAc), selectedId);
  if (legacy.kind === 'not_found') return { ok: false, unableReason: `TARGET ${legacy.callsign} NOT FOUND` };
  const target = aircraft.find((a) => a.id === legacy.aircraftId);
  if (!target) return { ok: false, unableReason: 'TARGET NOT FOUND' };

  if (target.special === 'nordo') {
    return {
      ok: true,
      callsign: target.callsign,
      aircraftId: target.id,
      controllerEcho: legacy.controllerEcho,
      readback: undefined,
      unableReason: 'NORDO',
    };
  }

  const patch: Partial<SimAircraft> = {};
  if (legacy.patch?.targetHeading !== undefined) patch.targetHeading = legacy.patch.targetHeading;
  if (legacy.patch?.turnDirection !== undefined) patch.turnDirection = legacy.patch.turnDirection;
  if (legacy.patch?.targetAltitude !== undefined) patch.targetAltitude = legacy.patch.targetAltitude;
  if (legacy.patch?.targetSpeed !== undefined) {
    if (proc) {
      const d = distNm(target.x, target.y, proc.threshold.x, proc.threshold.y);
      const blocked = speedAssignmentBlockedReason(d, proc.fafNm);
      if (blocked) {
        return {
          ok: false,
          callsign: target.callsign,
          aircraftId: target.id,
          controllerEcho: legacy.controllerEcho,
          readback: `Unable, ${target.callsign}`,
          unableReason: blocked,
        };
      }
    }
    patch.targetIas = legacy.patch.targetSpeed;
  }

  return {
    ok: true,
    callsign: target.callsign,
    aircraftId: target.id,
    controllerEcho: legacy.controllerEcho,
    readback: legacy.readback || undefined,
    patch,
  };
}
