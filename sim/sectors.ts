/**
 * Airspace / sector definitions as data (multiplayer foundation).
 * Sector ids are 2 characters (N1/S1/E1/W1) so typed handoffs never collide
 * with the single-letter speed command `S`.
 */

import type { AirspaceDef, SectorId, SimAircraft } from './types';
import { CENTER } from '../constants';

export const DEFAULT_AIRSPACE_NS: AirspaceDef = {
  id: 'demo-ns',
  name: 'Demo N/S Split',
  split: 'NS',
  sectors: [
    { id: 'N1', label: 'North', half: 'north', frequency: '124.350' },
    { id: 'S1', label: 'South', half: 'south', frequency: '119.200' },
  ],
  directionAltitude: { enabled: true, northEastOdd: true },
};

export const DEFAULT_AIRSPACE_EW: AirspaceDef = {
  id: 'demo-ew',
  name: 'Demo E/W Split',
  split: 'EW',
  sectors: [
    { id: 'E1', label: 'East', half: 'east', frequency: '125.100' },
    { id: 'W1', label: 'West', half: 'west', frequency: '118.750' },
  ],
  directionAltitude: { enabled: true, northEastOdd: true },
};

export function sectorAtPosition(airspace: AirspaceDef, x: number, y: number): SectorId {
  if (airspace.split === 'NS') {
    return y < CENTER ? 'N1' : 'S1';
  }
  return x >= CENTER ? 'E1' : 'W1';
}

export function crossesSectorLine(
  airspace: AirspaceDef,
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  return sectorAtPosition(airspace, from.x, from.y) !== sectorAtPosition(airspace, to.x, to.y);
}

/** True if aircraft crossed the split without an accepted/complete handoff. */
export function illegalSectorCross(ac: SimAircraft, airspace: AirspaceDef, prev: { x: number; y: number }): boolean {
  if (ac.ownedBy === 'LOCAL') return false;
  if (!crossesSectorLine(airspace, prev, ac)) return false;
  const phase = ac.handoff.phase;
  return phase !== 'accepted' && phase !== 'complete';
}
