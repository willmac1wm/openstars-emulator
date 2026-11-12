import { describe, expect, it } from 'vitest';
import { NM_TO_PX } from '../constants';
import { nmToPx, pxToNm, separationRingRadiusPx } from './geometry';

describe('nmToPx / separationRingRadiusPx', () => {
  it('uses the same NM→pixel scale as scope range rings (10 px = 1 NM)', () => {
    expect(NM_TO_PX).toBe(10);
    // Scope draws rings at r=100/200/300 → 10 / 20 / 30 NM
    expect(nmToPx(10)).toBe(100);
    expect(nmToPx(20)).toBe(200);
    expect(nmToPx(30)).toBe(300);
  });

  it('maps 3 NM J-ring radius to 30 px', () => {
    expect(separationRingRadiusPx(3)).toBe(30);
    expect(separationRingRadiusPx()).toBe(nmToPx(3));
    expect(pxToNm(separationRingRadiusPx(3))).toBe(3);
  });

  it('scales linearly with range (zoom-invariant map units)', () => {
    expect(separationRingRadiusPx(1.5)).toBe(15);
    expect(separationRingRadiusPx(6)).toBe(nmToPx(6));
  });
});
