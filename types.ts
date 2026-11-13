
export interface Coordinate {
  x: number;
  y: number;
}

export interface Waypoint extends Coordinate {
  id: string;
  type: 'VOR' | 'FIX' | 'AIRPORT';
}

export interface Gate {
  id: string; // NOR, SOU, EAS, WES
  label: string; // NORTH, SOUTH, EST, WST
  startAngle: number; // Degrees
  endAngle: number;   // Degrees
  fixName: string;
  fix: Coordinate;
}

export enum AlertLevel {
  NONE = 0,
  WARNING = 1, // Yellow (4NM or Diverging < 3NM)
  CRITICAL = 2 // Red (< 3NM and Converging)
}

export interface Aircraft {
  id: string;
  callsign: string;
  type: string; // e.g., B738
  x: number;
  y: number;
  altitude: number; // Current altitude in hundreds of feet (e.g. 030 = 3000)
  targetAltitude: number;
  speed: number; // Knots
  targetSpeed: number;
  heading: number; // Degrees 0-360
  targetHeading: number;
  history: Coordinate[]; // Previous positions for trail dots
  status: 'INBOUND' | 'ACTIVE' | 'LANDED' | 'HANDOFF' | 'CRASH' | 'SEPARATION_LOSS';
  alertLevel: AlertLevel;
  cleared: boolean;
  messages: string[]; // Log of pilot responses
  isSelected: boolean;
  destination: string; // 'NOR', 'SOU', 'EAS', 'WES'
  turnDirection?: 'LEFT' | 'RIGHT'; // Explicit turn direction instruction
  dataBlockDir: number; // Angle in degrees for the leader line (0-360)
  handoffResult?: string; // Text to display after handoff (e.g. "CLEAN", "WRONG ALT")
  /** Arcade curveball flags */
  special?: 'medevac' | 'nordo';
}

export type ScenarioDifficulty = 'Expo' | 'Easy' | 'Medium' | 'Hard';

export interface GameScenario {
  name: string;
  difficulty: ScenarioDifficulty;
  description: string;
  aircraft: Aircraft[];
  seedLabel?: string;
  mode?: 'expo' | 'standard';
}

export interface StartOptions {
  difficulty: ScenarioDifficulty | string;
  seedLabel?: string | number;
  /** Today's daily challenge (seed `daily-YYYY-MM-DD`) — recorded as a daily entry. */
  daily?: boolean;
}

export enum SimulationState {
  MENU,
  LOADING,
  RUNNING,
  PAUSED,
  SUMMARY
}

export interface Incident {
  time: string;
  description: string;
  involved: string[]; // Callsigns
  /** Plain-language reason (exit bearing vs gate, actual vs required alt, …). */
  detail?: string;
}

export interface GameStats {
  perfectExits: number;
  sloppyExits: number;
  wrongGate: number;
  wrongAlt: number;
  separationBusts: number; // Count of individual events
  incidents: Incident[]; // Log for replay/debrief
  startTime: number;
}

export type CommSource = 'system' | 'controller' | 'pilot';

export interface CommMessage {
  id: number;
  text: string;
  source: CommSource;
}

export interface RadarConfig {
  scale: number; // Pixels per nm
  range: number; // NM radius
  refreshRate: number; // ms
}
