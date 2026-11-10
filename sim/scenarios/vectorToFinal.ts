import { buildApproach } from '../approaches';
import { perfForType } from '../performance';
import { nextRng, seedFromLabel } from '../rng';
import { DEFAULT_AIRSPACE_NS } from '../sectors';
import type { ApproachKind, SimAircraft, SimState, WindState } from '../types';
import { pointAlongFinal } from '../geometry';
import { AlertLevel } from '../../types';

const FLEET = ['A388', 'B744', 'B77W', 'A333', 'B752', 'B738', 'A320', 'E75L', 'CRJ9', 'BE20'] as const;

function makeTraffic(
  seed: number,
  count: number,
  approachKind: ApproachKind,
): { aircraft: SimAircraft[]; rng: number } {
  let rng = seed;
  const proc = buildApproach(approachKind);
  const aircraft: SimAircraft[] = [];
  const callsigns = ['AAL421', 'UAL123', 'DAL456', 'SWA890', 'JBU512', 'ASA188', 'FFT610', 'NKS204'];

  for (let i = 0; i < count; i++) {
    const t = nextRng(rng); rng = t.state;
    const type = FLEET[Math.floor(t.value * FLEET.length)];
    const perf = perfForType(type);
    const side = nextRng(rng); rng = side.state;
    const nmOut = 14 + i * 3 + side.value * 2;
    const base = pointAlongFinal(proc, nmOut);
    const lateral = (side.value - 0.5) * 80; // px offset left/right of final
    const outbound = ((proc.finalCourseDeg + 180) % 360);
    const perp = ((outbound + 90) % 360);
    const pr = ((perp - 90) * Math.PI) / 180;
    const x = base.x + Math.cos(pr) * lateral;
    const y = base.y + Math.sin(pr) * lateral;
    // Heading toward intercept — roughly base-leg toward final
    const towardFinal = lateral > 0
      ? (proc.finalCourseDeg + 60) % 360
      : (proc.finalCourseDeg + 300) % 360;

    aircraft.push({
      id: `vtf-${callsigns[i % callsigns.length]}-${i}`,
      callsign: callsigns[i % callsigns.length],
      type: perf.type,
      wake: perf.wake,
      perf,
      x,
      y,
      heading: towardFinal,
      targetHeading: towardFinal,
      ias: perf.downwindKt,
      targetIas: perf.downwindKt,
      altitude: proc.gsInterceptAltFt / 100 + (i % 2) * 10,
      targetAltitude: proc.gsInterceptAltFt / 100,
      history: [],
      alertLevel: AlertLevel.NONE,
      isSelected: i === 0,
      ownedBy: 'LOCAL',
      handoff: { phase: 'none' },
      phase: 'vector',
      approachCleared: false,
      established: false,
      overshotLocalizer: false,
      illegalIntercept: false,
    });
  }
  return { aircraft, rng };
}

export function createVtfState(opts: {
  seedLabel: string;
  approachKind: ApproachKind;
  wind?: WindState;
}): SimState {
  const seed = seedFromLabel(opts.seedLabel);
  const { aircraft, rng } = makeTraffic(seed, 5, opts.approachKind);
  return {
    mode: 'vector_to_final',
    seedLabel: opts.seedLabel,
    simTime: 0,
    timeScale: 4,
    wind: opts.wind || { fromDeg: 0, speedKt: 0, calm: true },
    airspace: DEFAULT_AIRSPACE_NS,
    approach: buildApproach(opts.approachKind),
    aircraft,
    selectedId: aircraft[0]?.id ?? null,
    score: 0,
    events: [],
    localSector: 'LOCAL',
    running: true,
    actionLog: [],
    rngState: rng,
  };
}

/** Empty paused shell used before START. */
export function emptySimState(): SimState {
  return {
    mode: 'gate',
    seedLabel: 'idle',
    simTime: 0,
    timeScale: 1,
    wind: { fromDeg: 0, speedKt: 0, calm: true },
    airspace: DEFAULT_AIRSPACE_NS,
    approach: null,
    aircraft: [],
    selectedId: null,
    score: 0,
    events: [],
    localSector: 'LOCAL',
    running: false,
    actionLog: [],
    rngState: 1,
  };
}
