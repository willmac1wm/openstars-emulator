/**
 * Terminal Consolidated Wake Turbulence (CWT) Categories A–I and on-approach
 * separation minima.
 *
 * Source: JO 7110.65BB Chg 3 ¶5-5-4 (TERMINAL wake tables) and Pilot/Controller
 * Glossary — AIRCRAFT WAKE CATEGORIES (same edition). Table values transcribed
 * from the official order text mirrored on pointsixtyfive/faa.gov HTML for
 * "TERMINAL. ON APPROACH" (ensuring minima exist when the leader is over the
 * landing threshold). Empty cells = no additional wake requirement beyond the
 * applicable radar separation (typically 3 NM terminal).
 *
 * NOTE: Exact ICAO-type → category assignments in the NAS are published in
 * FAA Order JO 7360.1 / CWT type lists. Representative training types below
 * follow common CWT/RECAT groupings and the P/CG weight bands; they are not a
 * substitute for the official type list at a CWT-authorized facility.
 */

import type { WakeCategory } from '../types';
import { CITATIONS } from '../citations';

/** @see CITATIONS.wakeMinima */
export const WAKE_CITATION = CITATIONS.wakeMinima;

/** On-approach minima (NM). Leader rows, follower columns. null = no wake add-on. */
const ON_APPROACH: Record<WakeCategory, Record<WakeCategory, number | null>> = {
  A: { A: null, B: 5, C: 6, D: 6, E: 7, F: 7, G: 7, H: 8, I: 8 },
  B: { A: null, B: 3, C: 4, D: 4, E: 5, F: 5, G: 5, H: 5, I: 6 },
  C: { A: null, B: null, C: null, D: null, E: 3.5, F: 3.5, G: 3.5, H: 5, I: 6 },
  D: { A: null, B: 3, C: 4, D: 4, E: 5, F: 5, G: 5, H: 6, I: 6 },
  E: { A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null, I: 4 },
  F: { A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null, I: 4 },
  G: { A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null, I: null },
  H: { A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null, I: null },
  I: { A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null, I: null },
};

export function wakeMinimaNm(leader: WakeCategory, follower: WakeCategory): number | null {
  return ON_APPROACH[leader][follower];
}

/**
 * Representative types for classroom demos.
 * P/CG: A = A388 super; B/C/D = ≥300,000 lb heavy band; E = all B757;
 * F/G = 41,000–<300,000; H/I = <41,000. Sub-splits B/C/D/F/G follow common
 * CWT practice (upper/lower heavy, upper/lower large).
 */
export const TYPE_WAKE: Record<string, WakeCategory> = {
  A388: 'A',
  B748: 'B',
  B744: 'B',
  B77W: 'B',
  A333: 'C',
  B763: 'C',
  MD11: 'C',
  B752: 'E',
  B738: 'F',
  A320: 'F',
  A321: 'F',
  E75L: 'G',
  CRJ9: 'G',
  C172: 'I',
  BE20: 'H',
};

export function wakeForType(type: string): WakeCategory {
  return TYPE_WAKE[type] || 'F';
}
