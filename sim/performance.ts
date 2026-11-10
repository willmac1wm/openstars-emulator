/**
 * Representative aircraft performance for Vector-to-Final.
 * Speeds are training approximations (Vref-ish / typical approach IAS), not AFM data.
 */

import type { AircraftPerf } from './types';
import { wakeForType } from './rules/wake';

const TABLE: Record<string, Omit<AircraftPerf, 'wake'>> = {
  A388: { type: 'A388', vrefKt: 145, downwindKt: 210, decelKtPerSec: 0.8, turnRateDegPerSec: 2.2 },
  B744: { type: 'B744', vrefKt: 145, downwindKt: 210, decelKtPerSec: 0.85, turnRateDegPerSec: 2.3 },
  B77W: { type: 'B77W', vrefKt: 140, downwindKt: 210, decelKtPerSec: 0.9, turnRateDegPerSec: 2.4 },
  A333: { type: 'A333', vrefKt: 135, downwindKt: 200, decelKtPerSec: 0.95, turnRateDegPerSec: 2.5 },
  B763: { type: 'B763', vrefKt: 135, downwindKt: 200, decelKtPerSec: 1.0, turnRateDegPerSec: 2.5 },
  B752: { type: 'B752', vrefKt: 130, downwindKt: 200, decelKtPerSec: 1.1, turnRateDegPerSec: 2.6 },
  B738: { type: 'B738', vrefKt: 130, downwindKt: 190, decelKtPerSec: 1.2, turnRateDegPerSec: 2.8 },
  A320: { type: 'A320', vrefKt: 128, downwindKt: 190, decelKtPerSec: 1.2, turnRateDegPerSec: 2.8 },
  A321: { type: 'A321', vrefKt: 132, downwindKt: 195, decelKtPerSec: 1.15, turnRateDegPerSec: 2.7 },
  E75L: { type: 'E75L', vrefKt: 125, downwindKt: 180, decelKtPerSec: 1.3, turnRateDegPerSec: 3.0 },
  CRJ9: { type: 'CRJ9', vrefKt: 125, downwindKt: 180, decelKtPerSec: 1.3, turnRateDegPerSec: 3.0 },
  BE20: { type: 'BE20', vrefKt: 105, downwindKt: 150, decelKtPerSec: 1.5, turnRateDegPerSec: 3.2 },
  C172: { type: 'C172', vrefKt: 65, downwindKt: 90, decelKtPerSec: 1.8, turnRateDegPerSec: 3.5 },
};

export function perfForType(type: string): AircraftPerf {
  const base = TABLE[type] || TABLE.B738;
  return { ...base, type: base.type, wake: wakeForType(base.type) };
}

export const VTF_FLEET_TYPES = Object.keys(TABLE);
