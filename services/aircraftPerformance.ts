/**
 * Type-based aircraft performance envelopes (turn, climb/descent, speed change).
 * Keeps standard narrowbodies at the baseline (3.0 deg/s, 1500 fpm, 2.5 kt/s)
 * while giving heavies, regional jets, and light aircraft realistic feel.
 */
export interface AircraftPerformance {
  turnRateDegPerSec: number;
  /** Hundreds of feet per second (0.25 = 1,500 fpm). */
  climbRateHundredsPerSec: number;
  accelKtPerSec: number;
}

const HEAVY_TYPES = new Set(['B763', 'B752', 'A306', 'B744', 'B772', 'B788', 'A333', 'MD11', 'DC10']);
const REGIONAL_TYPES = new Set(['CRJ9', 'CRJ7', 'CRJ2', 'E175', 'E170', 'E145', 'DH8D']);
const LIGHT_TYPES = new Set(['C172', 'C182', 'PA28', 'SR22', 'BE36']);

export function performanceForType(type: string): AircraftPerformance {
  const t = type.trim().toUpperCase();
  if (HEAVY_TYPES.has(t)) {
    return { turnRateDegPerSec: 2.3, climbRateHundredsPerSec: 0.2, accelKtPerSec: 1.8 };
  }
  if (REGIONAL_TYPES.has(t)) {
    return { turnRateDegPerSec: 3.3, climbRateHundredsPerSec: 0.3, accelKtPerSec: 3.0 };
  }
  if (LIGHT_TYPES.has(t)) {
    return { turnRateDegPerSec: 3.5, climbRateHundredsPerSec: 0.14, accelKtPerSec: 2.2 };
  }
  return { turnRateDegPerSec: 3.0, climbRateHundredsPerSec: 0.25, accelKtPerSec: 2.5 };
}
