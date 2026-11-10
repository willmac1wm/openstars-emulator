import { describe, expect, it } from 'vitest';
import { buildApproach } from '../approaches';
import {
  approachGateNmFromThreshold,
  checkInterceptLegality,
  maxInterceptAngleDeg,
} from './intercept';

describe('intercept legality (7110.65BB 5-9-1 / 5-9-2)', () => {
  const ils = buildApproach('ILS');

  it('uses P/CG approach gate = max(FAF+1, 5) NM from threshold', () => {
    expect(approachGateNmFromThreshold(ils)).toBe(Math.max(ils.fafNm + 1, 5));
  });

  it('TBL 5-9-1 angles', () => {
    expect(maxInterceptAngleDeg(1.5)).toBe(20);
    expect(maxInterceptAngleDeg(2)).toBe(30);
    expect(maxInterceptAngleDeg(5, true)).toBe(45);
  });

  it('rejects intercept inside gate+2 NM', () => {
    const gate = approachGateNmFromThreshold(ils);
    const result = checkInterceptLegality({
      trackDeg: ils.finalCourseDeg + 25,
      distanceToGateNm: 3,
      distanceToThresholdNm: gate + 1,
      altitudeFt: ils.gsInterceptAltFt,
      proc: ils,
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /gate\+2/i.test(r))).toBe(true);
  });

  it('rejects excess intercept angle', () => {
    const gate = approachGateNmFromThreshold(ils);
    const result = checkInterceptLegality({
      trackDeg: ils.finalCourseDeg + 40,
      distanceToGateNm: 5,
      distanceToThresholdNm: gate + 5,
      altitudeFt: ils.gsInterceptAltFt,
      proc: ils,
    });
    expect(result.ok).toBe(false);
    expect(result.actualAngle).toBeGreaterThan(30);
  });

  it('accepts a legal 30° intercept outside gate+2 at GS altitude', () => {
    const gate = approachGateNmFromThreshold(ils);
    const result = checkInterceptLegality({
      trackDeg: ils.finalCourseDeg + 25,
      distanceToGateNm: 4,
      distanceToThresholdNm: gate + 4,
      altitudeFt: ils.gsInterceptAltFt,
      proc: ils,
    });
    expect(result.ok).toBe(true);
  });
});
