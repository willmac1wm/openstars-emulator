
import { Waypoint, Gate } from './types';

export const MAP_SIZE = 800; // Internal coordinate system size
export const CENTER = MAP_SIZE / 2;
export const NM_TO_PX = 10; // 10 pixels = 1 Nautical Mile (Radius 400px = 40NM)
export const NM_3_PX = 3 * NM_TO_PX; // 30px
export const NM_4_PX = 4 * NM_TO_PX; // 40px
export const UPDATE_INTERVAL = 1000; // Update logic every 1s (simulated radar sweep)
export const SWEEP_DURATION = 4000; // 4 seconds for a full 360 sweep
export const DEFAULT_TIME_SCALE = 2.0; // CHANGED: 2.0x speed for better pacing
export const GATE_RADIUS = 350; // Distance from center to gates

export const SIM_SPEED_OPTIONS = [1, 2, 4, 10];

// Scoring & Rules
export const SCORE_PERFECT_EXIT = 1000; // Clean exit through center of gate
export const SCORE_SLOPPY_EXIT = 500;   // Touching parallel lines
export const PENALTY_WRONG_ALT = 250;   // Correct gate, wrong altitude
export const PENALTY_WRONG_GATE = 500;  // Exited wrong gate
export const PENALTY_OFF_COURSE = 200;  // Left airspace not via a gate
export const PENALTY_SEPARATION = 50;   // Per tick per pair (Heavy penalty)

// Valid Exit Altitudes (in hundreds)
export const ALTS_NORTH_EAST = [70, 90]; // Odd: 7000, 9000
export const ALTS_SOUTH_WEST = [60, 80]; // Even: 6000, 8000

// Colors
export const COLOR_BG = '#000000';
export const COLOR_PRIMARY = '#14F195'; // Bright Green / Cyan mix common in modern displays
export const COLOR_SECONDARY = '#9ca3af'; // Grey for maps
export const COLOR_ALERT = '#ef4444'; // Red
export const COLOR_WARNING = '#f59e0b'; // Bright Yellow / Amber
export const COLOR_TEXT = '#e5e5e5';
export const COLOR_GATE = '#555555'; // Darker for static map lines

// Helper to calculate coordinates from angle/radius
const getCoord = (deg: number, r: number) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return {
        x: CENTER + r * Math.cos(rad),
        y: CENTER + r * Math.sin(rad)
    };
};

// Defined Gates (Exit Points)
export const GATES: Gate[] = [
    { 
        id: 'NOR', label: 'NORTH', 
        startAngle: 20, endAngle: 50, 
        fixName: 'NORTH', fix: getCoord(35, GATE_RADIUS) 
    },
    { 
        id: 'EAS', label: 'EAST', 
        startAngle: 90, endAngle: 120, 
        fixName: 'EST', fix: getCoord(105, GATE_RADIUS) 
    },
    { 
        id: 'SOU', label: 'SOUTH', 
        startAngle: 180, endAngle: 210, 
        fixName: 'SOUTH', fix: getCoord(195, GATE_RADIUS) 
    },
    { 
        id: 'WES', label: 'WEST', 
        startAngle: 270, endAngle: 300, 
        fixName: 'WST', fix: getCoord(285, GATE_RADIUS) 
    }
];

// Waypoints for the map display (The Gate Fixes)
export const WAYPOINTS: Waypoint[] = GATES.map(g => ({
    id: g.fixName,
    type: g.fixName.includes('ST') ? 'VOR' : 'FIX', // EST/WST are VORs, NORTH/SOUTH are Fixes
    x: g.fix.x,
    y: g.fix.y
}));

export const INITIAL_INSTRUCTION = `SYSTEM INSTRUCTION:
1. Guide aircraft to their EXIT GATE.
   (NOR, EAS, SOU, WES)
2. N/E GATES: FL070 or FL090 only.
3. S/W GATES: FL060 or FL080 only.
4. Don't touch the gate sides!`;
