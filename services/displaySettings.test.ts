import { describe, expect, it } from 'vitest';
import { parseDisplayCommand } from './displaySettings';

describe('parseDisplayCommand', () => {
  it('toggles J-rings from JRING / JRINGS / 3NM / RING', () => {
    expect(parseDisplayCommand('JRING')).toEqual({ kind: 'jrings' });
    expect(parseDisplayCommand('JRINGS')).toEqual({ kind: 'jrings' });
    expect(parseDisplayCommand('J-RING')).toEqual({ kind: 'jrings' });
    expect(parseDisplayCommand('3NM')).toEqual({ kind: 'jrings' });
    expect(parseDisplayCommand('3 NM RING')).toEqual({ kind: 'jrings' });
    expect(parseDisplayCommand('RING')).toEqual({ kind: 'jrings' });
  });

  it('accepts explicit ON / OFF', () => {
    expect(parseDisplayCommand('JRING ON')).toEqual({ kind: 'jrings', on: true });
    expect(parseDisplayCommand('JRINGS OFF')).toEqual({ kind: 'jrings', on: false });
    expect(parseDisplayCommand('3NM ON')).toEqual({ kind: 'jrings', on: true });
  });

  it('ignores aircraft clearances', () => {
    expect(parseDisplayCommand('UAL123 H270')).toBeNull();
    expect(parseDisplayCommand('AAL421 A070')).toBeNull();
    expect(parseDisplayCommand('')).toBeNull();
  });
});
