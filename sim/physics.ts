import { AlertLevel } from '../types';
import { FIXED_DT, type ApproachProcedure, type SimAircraft, type SimState, type WindState } from './types';
import { applyWind, crossTrackNm, distanceAlongFinalNm, distNm, normalizeHeading, toRad } from './geometry';
import { wakeMinimaNm } from './rules/wake';
import { approachGateNmFromThreshold } from './rules/intercept';
import { NM_TO_PX } from '../constants';

function stepAircraft(ac: SimAircraft, wind: WindState, proc: ApproachProcedure | null, dt: number): SimAircraft {
  let heading = ac.heading;
  let ias = ac.ias;
  let alt = ac.altitude;
  let turnDirection = ac.turnDirection;
  let phase = ac.phase;
  let established = ac.established;
  let overshotLocalizer = ac.overshotLocalizer;
  let targetIas = ac.targetIas;

  // Turn toward target heading
  if (heading !== ac.targetHeading) {
    let diff = ac.targetHeading - heading;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    const turnAmount = ac.perf.turnRateDegPerSec * dt;
    let dir = turnDirection === 'LEFT' ? -1 : turnDirection === 'RIGHT' ? 1 : diff > 0 ? 1 : -1;
    if (Math.abs(diff) < turnAmount) {
      heading = ac.targetHeading;
      turnDirection = undefined;
    } else {
      heading = normalizeHeading(heading + dir * turnAmount);
    }
  }

  // Speed
  if (Math.abs(ias - targetIas) > 0.1) {
    const rate = ac.perf.decelKtPerSec;
    if (ias > targetIas) ias = Math.max(targetIas, ias - rate * dt);
    else ias = Math.min(targetIas, ias + rate * dt);
  }

  // Altitude (hundreds of feet); ~1500 fpm ≈ 0.25 hundreds/sec
  if (Math.abs(alt - ac.targetAltitude) > 0.05) {
    const rate = 0.25;
    if (alt < ac.targetAltitude) alt = Math.min(ac.targetAltitude, alt + rate * dt);
    else alt = Math.max(ac.targetAltitude, alt - rate * dt);
  }

  const { trackDeg, gsKt } = applyWind(heading, ias, wind);
  const pxPerSec = (gsKt * NM_TO_PX) / 3600;
  const move = pxPerSec * dt;
  const x = ac.x + Math.cos(toRad(trackDeg)) * move;
  const y = ac.y + Math.sin(toRad(trackDeg)) * move;

  let history = ac.history;
  if (Math.random() < 0) {
    /* deterministic: no Math.random — use sim-time gated below */
  }

  if (proc) {
    const along = distanceAlongFinalNm(proc, x, y);
    const xtk = Math.abs(crossTrackNm(proc, x, y));
    const gateNm = approachGateNmFromThreshold(proc);

    // Capture localizer / FAC: within 0.3 NM of course and converging.
    if (!established && xtk < 0.35 && angleClose(trackDeg, proc.finalCourseDeg, 25)) {
      established = true;
      phase = along <= proc.fafNm ? 'inside_faf' : 'established';
      if (ac.maintainUntilEstablished !== undefined) {
        // Once established, pilot may descend with GS — keep target for now.
      }
    }

    // Overshoot: crossed through the course with large intercept and went to other side.
    if (!established && ac.phase === 'intercepting') {
      const prevXtk = crossTrackNm(proc, ac.x, ac.y);
      const newXtk = crossTrackNm(proc, x, y);
      if (Math.sign(prevXtk) !== 0 && Math.sign(newXtk) !== 0 && Math.sign(prevXtk) !== Math.sign(newXtk) && Math.abs(newXtk) > 0.4) {
        overshotLocalizer = true;
      }
    }

    if (established && along <= proc.fafNm) {
      phase = 'inside_faf';
      // After FAF, slow to final approach speed (compression) — 5-7 note / training model.
      targetIas = Math.min(targetIas, ac.perf.vrefKt);
    }

    if (along < 0.3 && xtk < 0.4 && established) {
      phase = 'landed';
      ias = 0;
      targetIas = 0;
    }

    // Still outside gate on vector
    if (!established && along > gateNm) {
      phase = ac.approachCleared ? 'intercepting' : 'vector';
    }
  }

  return {
    ...ac,
    x,
    y,
    heading,
    ias,
    targetIas,
    altitude: alt,
    turnDirection,
    phase,
    established,
    overshotLocalizer,
    history,
  };
}

function angleClose(a: number, b: number, tol: number): boolean {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d <= tol;
}

export function tickPhysics(state: SimState, dt: number = FIXED_DT): SimState {
  const scaled = dt * state.timeScale;
  let aircraft = state.aircraft.map((ac) => {
    if (ac.phase === 'landed' || ac.ias <= 0) return ac;
    const next = stepAircraft(ac, state.wind, state.approach, scaled);
    // Deterministic trail sample every ~0.5s sim
    if (Math.floor(state.simTime * 2) !== Math.floor((state.simTime + scaled) * 2)) {
      next.history = [{ x: ac.x, y: ac.y }, ...ac.history].slice(0, 6);
    }
    return next;
  });

  aircraft = applyWakeAlerts(aircraft, state.approach);
  return { ...state, aircraft, simTime: state.simTime + scaled };
}

function applyWakeAlerts(list: SimAircraft[], proc: ApproachProcedure | null): SimAircraft[] {
  if (!proc) return list.map((a) => ({ ...a, alertLevel: AlertLevel.NONE }));
  const next = list.map((a) => ({ ...a, alertLevel: AlertLevel.NONE }));
  const onFinal = next
    .filter((a) => a.established || a.phase === 'inside_faf' || a.phase === 'established')
    .sort((a, b) => distanceAlongFinalNm(proc, a.x, a.y) - distanceAlongFinalNm(proc, b.x, b.y));

  for (let i = 0; i < onFinal.length; i++) {
    for (let j = i + 1; j < onFinal.length; j++) {
      const lead = onFinal[i];
      const trail = onFinal[j];
      // lead is closer to threshold (smaller along)
      const gap = distNm(lead.x, lead.y, trail.x, trail.y);
      const need = wakeMinimaNm(lead.wake, trail.wake);
      if (need !== null && gap + 0.05 < need) {
        const li = next.findIndex((a) => a.id === lead.id);
        const ti = next.findIndex((a) => a.id === trail.id);
        if (li >= 0) next[li].alertLevel = Math.max(next[li].alertLevel, AlertLevel.CRITICAL);
        if (ti >= 0) next[ti].alertLevel = Math.max(next[ti].alertLevel, AlertLevel.CRITICAL);
      }
    }
  }
  return next;
}
