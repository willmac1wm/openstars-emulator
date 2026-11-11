import { describe, expect, it } from 'vitest';
import { createVtfState, makeTraffic } from './vectorToFinal';
import { buildApproach } from '../approaches';
import { approachGateNmFromThreshold } from '../rules/intercept';
import { crossTrackNm, distanceAlongFinalNm } from '../geometry';
import { seedFromLabel } from '../rng';

describe('VTF spawn polish', () => {
  it('spawns every aircraft outside the approach gate and off the FAC', () => {
    const seeds = ['vtf-1', 'vtf-2', 'polish', 'expo', '1234'];
    for (const label of seeds) {
      for (const kind of ['ILS', 'VOR'] as const) {
        const proc = buildApproach(kind);
        const gateNm = approachGateNmFromThreshold(proc);
        const { aircraft } = makeTraffic(seedFromLabel(label), 5, kind);
        expect(aircraft.length).toBe(5);
        for (const ac of aircraft) {
          const along = distanceAlongFinalNm(proc, ac.x, ac.y);
          const xtk = Math.abs(crossTrackNm(proc, ac.x, ac.y));
          expect(along).toBeGreaterThan(gateNm);
          expect(along).toBeGreaterThan(proc.fafNm);
          expect(xtk).toBeGreaterThanOrEqual(7.5);
          expect(ac.established).toBe(false);
          expect(ac.approachCleared).toBe(false);
          expect(ac.phase).toBe('vector');
        }
      }
    }
  });

  it('createVtfState wires approach + selected traffic', () => {
    const state = createVtfState({ seedLabel: 'vtf-polish', approachKind: 'ILS' });
    expect(state.mode).toBe('vector_to_final');
    expect(state.approach?.kind).toBe('ILS');
    expect(state.aircraft.length).toBe(5);
    expect(state.selectedId).toBe(state.aircraft[0].id);
  });
});
