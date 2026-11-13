/**
 * Serializable sim model — multiplayer-ready foundation.
 * Actions are plain JSON objects so a future network layer can send/replay them.
 */

import type { AlertLevel } from '../types';

/** Fixed sim step (seconds). Deterministic; wall clock only drives how many steps. */
export const FIXED_DT = 1 / 20;

/** 2-char sector ids — never collide with single-letter speed `S` commands. */
export type SectorId = 'N1' | 'S1' | 'E1' | 'W1';

export type WakeCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export type ApproachKind = 'ILS' | 'VOR';

export type GameModeKind = 'gate' | 'expo' | 'vector_to_final';

export type HandoffPhase =
  | 'none'
  | 'initiated' // transferring controller typed sector+callsign
  | 'pending' // waiting for receiving controller to accept
  | 'accepted' // receiver typed callsign; pilot will check in
  | 'complete';

export interface WindState {
  /** From-direction degrees true (meteorological). 0 = calm. */
  fromDeg: number;
  speedKt: number;
  calm: boolean;
}

export interface SectorDef {
  id: SectorId;
  label: string;
  /** Half-plane ownership: 'north' means y < splitY for N1, etc. */
  half: 'north' | 'south' | 'east' | 'west';
  frequency: string;
}

export interface AirspaceDef {
  id: string;
  name: string;
  /** Split line through map center for N/S or E/W handoff mode. */
  split: 'NS' | 'EW';
  sectors: SectorDef[];
  /**
   * Direction-of-flight altitude rule (configurable).
   * Default mirrors 14 CFR §91.179 / AIM TBL 3-3-3: magnetic course 0–179 odd
   * thousands, 180–359 even thousands (below FL180).
   */
  directionAltitude: {
    enabled: boolean;
    /** Magnetic course 0–179 → odd thousands when true. */
    northEastOdd: boolean;
  };
}

export interface ApproachProcedure {
  kind: ApproachKind;
  runway: string; // e.g. "28"
  /** Final approach course (degrees). ILS = runway heading; VOR may be offset. */
  finalCourseDeg: number;
  runwayHeadingDeg: number;
  /** Threshold position in map px. */
  threshold: { x: number; y: number };
  /** FAF distance from threshold (NM). */
  fafNm: number;
  /** Glideslope intercept / intermediate altitude (feet MSL). */
  gsInterceptAltFt: number;
  /** Published FAF name for phraseology. */
  fafName: string;
  localizerName: string; // "localizer" | "VOR final approach course"
}

export interface AircraftPerf {
  type: string;
  wake: WakeCategory;
  /** Typical approach/Vref-ish IAS (kt). */
  vrefKt: number;
  /** Clean IAS used before configuring (kt). */
  downwindKt: number;
  /** Max deceleration kt/s (indicated). */
  decelKtPerSec: number;
  turnRateDegPerSec: number;
}

export type TrackPhase =
  | 'vector'
  | 'intercepting'
  | 'established'
  | 'inside_faf'
  | 'landed'
  | 'goaround'
  | 'handoff';

export interface SimAircraft {
  id: string;
  callsign: string;
  type: string;
  wake: WakeCategory;
  perf: AircraftPerf;
  x: number;
  y: number;
  /** Heading (degrees) — where the nose points. */
  heading: number;
  targetHeading: number;
  turnDirection?: 'LEFT' | 'RIGHT';
  /** Indicated airspeed (kt). */
  ias: number;
  targetIas: number;
  /** Altitude in hundreds of feet (same convention as gate mode). */
  altitude: number;
  targetAltitude: number;
  maintainUntilEstablished?: number; // hundreds of feet
  history: { x: number; y: number }[];
  alertLevel: AlertLevel;
  isSelected: boolean;
  /** Owning sector (multiplayer foundation). */
  ownedBy: SectorId | 'LOCAL';
  handoff: {
    phase: HandoffPhase;
    toSector?: SectorId;
    fromSector?: SectorId;
  };
  /** VTF fields */
  phase: TrackPhase;
  approachCleared: boolean;
  approachKind?: ApproachKind;
  clearedRunway?: string;
  established: boolean;
  overshotLocalizer: boolean;
  illegalIntercept: boolean;
  destinationGate?: string;
  special?: 'medevac' | 'nordo';
}

export interface ScoreEvent {
  atSimTime: number;
  kind: string;
  points: number;
  detail: string;
  callsign?: string;
}

export interface SimState {
  mode: GameModeKind;
  seedLabel: string;
  /** Monotonic sim time (seconds). */
  simTime: number;
  timeScale: number;
  wind: WindState;
  airspace: AirspaceDef;
  approach: ApproachProcedure | null;
  aircraft: SimAircraft[];
  selectedId: string | null;
  score: number;
  events: ScoreEvent[];
  /** Local controller sector for single-player VTF (always LOCAL ownership). */
  localSector: SectorId | 'LOCAL';
  running: boolean;
  /** Action log for determinism tests / future debrief replay. */
  actionLog: SimAction[];
  rngState: number;
}

/** Serializable actions — wire-ready for future multiplayer. */
export type SimAction =
  | { type: 'START'; mode: GameModeKind; seedLabel: string; wind?: WindState; approachKind?: ApproachKind }
  | { type: 'TICK'; steps?: number }
  | { type: 'SET_TIMESCALE'; timeScale: number }
  | { type: 'SELECT'; aircraftId: string | null }
  | { type: 'COMMAND'; raw: string; controllerId?: string }
  | { type: 'HANDOFF_INITIATE'; sectorId: SectorId; callsign: string; fromController?: string }
  | { type: 'HANDOFF_ACCEPT'; callsign: string; controllerId?: string }
  | { type: 'SET_WIND'; wind: WindState }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };
