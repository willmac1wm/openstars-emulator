import { Aircraft } from '../types';
import {
  finishReadback,
  readbackAltitude,
  readbackHeading,
  readbackSpeed,
  sayAgain,
  unable,
} from './phraseology';

/** Same limits the scope will accept. Outside these, the pilot says "unable". */
export const COMMAND_LIMITS = {
  maxHeading: 360,
  minAltitude: 10,
  maxAltitude: 170,
  minSpeed: 100,
  maxSpeed: 350,
};

export interface CommandPatch {
  targetHeading?: number;
  turnDirection?: 'LEFT' | 'RIGHT';
  clearTurnDirection?: boolean;
  targetAltitude?: number;
  targetSpeed?: number;
}

export interface ParsedCommand {
  kind: 'not_found' | 'readback';
  callsign: string;
  aircraftId?: string;
  /** Uppercase line the controller typed. */
  controllerEcho: string;
  /** Spoken and on-screen pilot readback. Absent when the callsign is unknown. */
  readback?: string;
  /** Null when the aircraft should not change (say again / unable). */
  patch: CommandPatch | null;
}

export function applyCommandPatch(ac: Aircraft, patch: CommandPatch): Aircraft {
  const next: Aircraft = { ...ac };
  if (patch.targetHeading !== undefined) next.targetHeading = patch.targetHeading;
  if (patch.clearTurnDirection) next.turnDirection = undefined;
  if (patch.turnDirection) next.turnDirection = patch.turnDirection;
  if (patch.targetAltitude !== undefined) next.targetAltitude = patch.targetAltitude;
  if (patch.targetSpeed !== undefined) next.targetSpeed = patch.targetSpeed;
  return next;
}

/** Matches the simulator's shortest-turn choice, including the 180-degree tie. */
export function turnDirection(from: number, to: number): 'LEFT' | 'RIGHT' | null {
  let diff = to - from;
  while (diff <= -180) diff += 360;
  while (diff > 180) diff -= 360;
  if (Math.abs(diff) < 0.01) return null;
  return diff > 0 ? 'RIGHT' : 'LEFT';
}

function resolveTarget(aircraft: Aircraft[], callsign: string, selectedId: string | null): Aircraft | null {
  const matches = aircraft.filter((ac) => ac.callsign === callsign);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return matches.find((ac) => ac.id === selectedId) || matches[0];
}

type Token =
  | { ok: true; clause: string; apply: (patch: CommandPatch) => void }
  | { ok: false };

/**
 * Parse a controller line with the scope's command grammar:
 * H/HDG/T, TL/TLH, TR/TRH, A/ALT/C, S/SPD. Keywords are not matched inside
 * another word, so ALT is an altitude and not also a turn.
 */
export function parseCommand(cmdRaw: string, aircraft: Aircraft[], selectedId: string | null): ParsedCommand {
  const raw = cmdRaw.trim().toUpperCase();
  const callsign = raw.split(/\s+/)[0] ?? '';
  const controllerEcho = raw;

  if (!callsign) {
    return { kind: 'readback', callsign: '', controllerEcho, readback: 'Say again', patch: null };
  }

  const target = resolveTarget(aircraft, callsign, selectedId);
  if (!target) {
    return { kind: 'not_found', callsign, controllerEcho, patch: null };
  }

  const cmdBody = raw.substring(callsign.length).trim();
  const hdgRegex = /(?:^|[^A-Z])(HDG|TLH|TRH|TL|TR|H|T)\s*(\d{3})/gi;
  const altRegex = /(?:^|[^A-Z])(ALT|A|C)\s*(\d{1,3})/gi;
  const spdRegex = /(?:^|[^A-Z])(SPD|S)\s*(\d{2,3})/gi;

  const tokens: Token[] = [];
  let match: RegExpExecArray | null;

  while ((match = hdgRegex.exec(cmdBody)) !== null) {
    const type = match[1].toUpperCase();
    const val = parseInt(match[2], 10);
    if (val > COMMAND_LIMITS.maxHeading) {
      tokens.push({ ok: false });
      continue;
    }
    const targetHeading = val % 360;
    const spokenHeading = val === 0 ? 360 : val;
    const explicit = type === 'TL' || type === 'TLH' ? 'LEFT' : type === 'TR' || type === 'TRH' ? 'RIGHT' : null;
    const direction = explicit ?? turnDirection(target.heading, targetHeading);
    tokens.push({
      ok: true,
      clause: readbackHeading(spokenHeading, direction),
      apply: (patch) => {
        patch.targetHeading = targetHeading;
        if (explicit) {
          patch.turnDirection = explicit;
          patch.clearTurnDirection = false;
        } else {
          patch.turnDirection = undefined;
          patch.clearTurnDirection = true;
        }
      },
    });
  }

  while ((match = altRegex.exec(cmdBody)) !== null) {
    const val = parseInt(match[2], 10);
    if (val < COMMAND_LIMITS.minAltitude || val > COMMAND_LIMITS.maxAltitude) {
      tokens.push({ ok: false });
      continue;
    }
    const relation = val > target.altitude ? 'climb' : val < target.altitude ? 'descend' : 'maintain';
    tokens.push({
      ok: true,
      clause: readbackAltitude(val, relation),
      apply: (patch) => {
        patch.targetAltitude = val;
      },
    });
  }

  while ((match = spdRegex.exec(cmdBody)) !== null) {
    const val = parseInt(match[2], 10);
    if (val < COMMAND_LIMITS.minSpeed || val > COMMAND_LIMITS.maxSpeed) {
      tokens.push({ ok: false });
      continue;
    }
    const relation = val > target.speed ? 'increase' : val < target.speed ? 'reduce' : 'maintain';
    tokens.push({
      ok: true,
      clause: readbackSpeed(val, relation),
      apply: (patch) => {
        patch.targetSpeed = val;
      },
    });
  }

  const accepted = tokens.filter((token): token is Extract<Token, { ok: true }> => token.ok);
  if (tokens.length === 0) {
    return {
      kind: 'readback',
      callsign,
      aircraftId: target.id,
      controllerEcho,
      readback: sayAgain(callsign),
      patch: null,
    };
  }
  if (accepted.length === 0) {
    return {
      kind: 'readback',
      callsign,
      aircraftId: target.id,
      controllerEcho,
      readback: unable(callsign),
      patch: null,
    };
  }

  const patch: CommandPatch = {};
  for (const token of accepted) token.apply(patch);
  const clauses = accepted.map((token) => token.clause);
  if (accepted.length !== tokens.length) clauses.push('unable');

  return {
    kind: 'readback',
    callsign,
    aircraftId: target.id,
    controllerEcho,
    readback: finishReadback(clauses, callsign),
    patch,
  };
}
