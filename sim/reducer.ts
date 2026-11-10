import type { SectorId, SimAction, SimState, WindState } from './types';
import { tickPhysics } from './physics';
import { createVtfState, emptySimState } from './scenarios/vectorToFinal';
import { parseApproachCommand } from './approachCommands';
import { crossesSectorLine } from './sectors';
import { altitudeMatchesDirection, directionAltitudeHint } from './rules/altitudeDirection';
import { FIXED_DT } from './types';

function appendEvent(state: SimState, kind: string, points: number, detail: string, callsign?: string): SimState {
  return {
    ...state,
    score: Math.max(0, state.score + points),
    events: [...state.events, { atSimTime: state.simTime, kind, points, detail, callsign }],
  };
}

function applyHandoffInitiate(state: SimState, sectorId: SectorId, callsign: string): SimState {
  const ac = state.aircraft.find((a) => a.callsign === callsign);
  if (!ac) return state;
  return {
    ...state,
    aircraft: state.aircraft.map((a) =>
      a.id === ac.id
        ? {
            ...a,
            handoff: { phase: 'pending', toSector: sectorId, fromSector: a.ownedBy === 'LOCAL' ? undefined : a.ownedBy },
          }
        : a,
    ),
  };
}

function applyHandoffAccept(state: SimState, callsign: string): SimState {
  const ac = state.aircraft.find((a) => a.callsign === callsign);
  if (!ac || ac.handoff.phase !== 'pending' || !ac.handoff.toSector) return state;
  return {
    ...state,
    aircraft: state.aircraft.map((a) =>
      a.id === ac.id
        ? {
            ...a,
            ownedBy: a.handoff.toSector!,
            handoff: { ...a.handoff, phase: 'accepted' },
            phase: 'handoff',
          }
        : a,
    ),
  };
}

function afterMoveHandoffPenalties(prev: SimState, next: SimState): SimState {
  let state = next;
  for (let i = 0; i < next.aircraft.length; i++) {
    const before = prev.aircraft.find((a) => a.id === next.aircraft[i].id);
    const after = next.aircraft[i];
    if (!before || after.ownedBy === 'LOCAL') continue;
    if (crossesSectorLine(state.airspace, before, after)) {
      const phase = before.handoff.phase;
      if (phase !== 'accepted' && phase !== 'complete') {
        state = appendEvent(state, 'handoff_bust', -300, `${after.callsign} crossed sector line without accepted handoff`, after.callsign);
      } else if (phase === 'accepted') {
        // Direction-of-flight altitude check at handoff crossing
        const course = after.heading;
        if (!altitudeMatchesDirection(after.altitude, course, state.airspace.directionAltitude)) {
          state = appendEvent(
            state,
            'altitude_direction',
            -150,
            `${after.callsign} altitude vs direction — ${directionAltitudeHint(course, state.airspace.directionAltitude)}`,
            after.callsign,
          );
        }
        state = {
          ...state,
          aircraft: state.aircraft.map((a) =>
            a.id === after.id ? { ...a, handoff: { ...a.handoff, phase: 'complete' } } : a,
          ),
        };
      }
    }
  }
  return state;
}

function scoreVtfProgress(prev: SimState, next: SimState): SimState {
  let state = next;
  for (const ac of next.aircraft) {
    const before = prev.aircraft.find((a) => a.id === ac.id);
    if (!before) continue;
    if (!before.established && ac.established && !ac.illegalIntercept && !ac.overshotLocalizer) {
      state = appendEvent(state, 'established', 500, `${ac.callsign} established on final`, ac.callsign);
    }
    if (ac.overshotLocalizer && !before.overshotLocalizer) {
      state = appendEvent(state, 'overshoot', -400, `${ac.callsign} overshot final approach course`, ac.callsign);
    }
    if (ac.phase === 'landed' && before.phase !== 'landed') {
      const wakeOk = ac.alertLevel === 0;
      state = appendEvent(
        state,
        'landing',
        wakeOk ? 800 : 200,
        wakeOk ? `${ac.callsign} landing — wake OK` : `${ac.callsign} landing with wake alert`,
        ac.callsign,
      );
    }
  }
  // Wake violations while on final
  for (const ac of next.aircraft) {
    if (ac.alertLevel >= 2) {
      const already = state.events.some((e) => e.kind === 'wake' && e.callsign === ac.callsign && state.simTime - e.atSimTime < 5);
      if (!already) {
        state = appendEvent(state, 'wake', -250, `${ac.callsign} wake turbulence separation`, ac.callsign);
      }
    }
  }
  return state;
}

export function reduce(state: SimState, action: SimAction): SimState {
  const logged: SimState = {
    ...state,
    actionLog: [...state.actionLog, action],
  };

  switch (action.type) {
    case 'START': {
      if (action.mode === 'vector_to_final') {
        const wind: WindState = action.wind || { fromDeg: 0, speedKt: 0, calm: true };
        const next = createVtfState({
          seedLabel: action.seedLabel,
          approachKind: action.approachKind || 'ILS',
          wind,
        });
        return { ...next, actionLog: [{ type: 'START', mode: action.mode, seedLabel: action.seedLabel, wind, approachKind: action.approachKind }] };
      }
      return { ...emptySimState(), actionLog: logged.actionLog, running: false };
    }
    case 'TICK': {
      if (!logged.running) return logged;
      const steps = action.steps ?? 1;
      let cur = logged;
      for (let i = 0; i < steps; i++) {
        const prev = cur;
        cur = tickPhysics(cur, FIXED_DT);
        cur = afterMoveHandoffPenalties(prev, cur);
        cur = scoreVtfProgress(prev, cur);
      }
      return { ...cur, actionLog: logged.actionLog };
    }
    case 'SET_TIMESCALE':
      return { ...logged, timeScale: action.timeScale };
    case 'SELECT':
      return {
        ...logged,
        selectedId: action.aircraftId,
        aircraft: logged.aircraft.map((a) => ({ ...a, isSelected: a.id === action.aircraftId })),
      };
    case 'SET_WIND':
      return { ...logged, wind: action.wind };
    case 'PAUSE':
      return { ...logged, running: false };
    case 'RESUME':
      return { ...logged, running: true };
    case 'HANDOFF_INITIATE':
      return applyHandoffInitiate(logged, action.sectorId, action.callsign.toUpperCase());
    case 'HANDOFF_ACCEPT':
      return applyHandoffAccept(logged, action.callsign.toUpperCase());
    case 'COMMAND': {
      const raw = action.raw.trim().toUpperCase();
      const handoffInit = raw.match(/^([NSEW]1)\s+([A-Z0-9]+)$/);
      if (handoffInit) {
        return applyHandoffInitiate(logged, handoffInit[1] as SectorId, handoffInit[2]);
      }
      // Accept handoff: bare callsign while a pending handoff exists for that aircraft
      const bare = raw.match(/^([A-Z]{2,3}\d{1,4})$/);
      if (bare) {
        const pending = logged.aircraft.find((a) => a.callsign === bare[1] && a.handoff.phase === 'pending');
        if (pending) return applyHandoffAccept(logged, bare[1]);
      }

      const parsed = parseApproachCommand(raw, logged.aircraft, logged.selectedId, logged.approach, logged.wind);
      if (parsed.unableReason === 'HANDOFF_TOKEN') return logged;

      let next = logged;
      if (parsed.ok && parsed.aircraftId && parsed.patch) {
        next = {
          ...logged,
          aircraft: logged.aircraft.map((a) => (a.id === parsed.aircraftId ? { ...a, ...parsed.patch } : a)),
        };
        if (parsed.scoreHint) {
          next = appendEvent(next, parsed.scoreHint.kind, parsed.scoreHint.points, parsed.scoreHint.detail, parsed.callsign);
        }
      }
      // Attach last phraseology on a side channel via events for the UI
      if (parsed.controllerEcho) {
        next = appendEvent(next, 'controller', 0, parsed.controllerEcho, parsed.callsign);
      }
      if (parsed.readback) {
        next = appendEvent(next, 'pilot', 0, parsed.readback, parsed.callsign);
      }
      if (!parsed.ok && parsed.unableReason && parsed.unableReason !== 'NORDO') {
        next = appendEvent(next, 'unable', -50, parsed.unableReason, parsed.callsign);
      }
      return next;
    }
    default:
      return logged;
  }
}

/** Replay an action log from empty — determinism helper. */
export function replay(actions: SimAction[]): SimState {
  return actions.reduce((s, a) => reduce(s, a), emptySimState());
}
