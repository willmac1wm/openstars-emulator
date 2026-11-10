import { Aircraft } from '../types';
import { applyCommandPatch, parseCommand, ParsedCommand } from './commandParser';

export type LogKind = 'controller' | 'pilot' | 'system';

export interface CommandIssueHooks {
  /** Must be synchronous / fire-and-forget — never await TTS here. */
  onSpeak: (text: string, callsign: string) => void;
  onLog: (message: string, kind: LogKind) => void;
  onTrack?: (callsign: string, echo: string) => void;
}

export interface CommandIssueResult {
  parsed: ParsedCommand;
  aircraft: Aircraft[];
  /** True when a speak hook was invoked (not awaited). */
  spoke: boolean;
}

/**
 * Apply a controller clearance to aircraft state, then fire readback audio.
 * State updates complete before `onSpeak` is called; `onSpeak` is never awaited,
 * so slow TTS cannot delay heading/altitude/speed changes.
 */
export function issueControllerCommand(
  aircraft: Aircraft[],
  selectedId: string | null,
  cmdRaw: string,
  hooks: CommandIssueHooks,
): CommandIssueResult {
  const parsed = parseCommand(cmdRaw, aircraft, selectedId);
  if (parsed.kind === 'not_found') {
    hooks.onLog(`TARGET ${parsed.callsign} NOT FOUND`, 'system');
    return { parsed, aircraft, spoke: false };
  }

  const target = aircraft.find((ac) => ac.id === parsed.aircraftId);
  hooks.onLog(parsed.controllerEcho, 'controller');

  if (target?.special === 'nordo') {
    hooks.onLog('No reply (NORDO)', 'system');
    return { parsed, aircraft, spoke: false };
  }

  let next = aircraft;
  if (parsed.patch && parsed.aircraftId) {
    const aircraftId = parsed.aircraftId;
    const patch = parsed.patch;
    next = aircraft.map((ac) => (ac.id === aircraftId ? applyCommandPatch(ac, patch) : ac));
  }

  let spoke = false;
  if (parsed.readback) {
    hooks.onLog(parsed.readback, 'pilot');
    // Fire-and-forget: callers must not await TTS before applying `next`.
    hooks.onSpeak(parsed.readback, parsed.callsign);
    spoke = true;
    hooks.onTrack?.(parsed.callsign, parsed.controllerEcho);
  }

  return { parsed, aircraft: next, spoke };
}
