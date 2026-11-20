import { describe, expect, it } from 'vitest';
import { performanceForType } from './aircraftPerformance';

describe('aircraft performance envelopes', () => {
  it('distinguishes heavy, narrowbody, regional, and light aircraft', () => {
    const heavy = performanceForType('B763');
    const narrow = performanceForType('B738');
    const regional = performanceForType('E175');
    const light = performanceForType('C172');

    expect(heavy.turnRateDegPerSec).toBeLessThan(narrow.turnRateDegPerSec);
    expect(heavy.accelKtPerSec).toBeLessThan(narrow.accelKtPerSec);
    expect(regional.climbRateHundredsPerSec).toBeGreaterThan(narrow.climbRateHundredsPerSec);
    expect(light.climbRateHundredsPerSec).toBeLessThan(heavy.climbRateHundredsPerSec);
  });
});
