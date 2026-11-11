import { describe, expect, it } from 'vitest';
import { readVtfModeFromLocation } from './scenarioSeed';

describe('readVtfModeFromLocation', () => {
  it('detects ?mode=vtf (case-insensitive)', () => {
    expect(readVtfModeFromLocation('?mode=vtf')).toBe(true);
    expect(readVtfModeFromLocation('?seed=1&mode=VTF')).toBe(true);
    expect(readVtfModeFromLocation('?mode=expo')).toBe(false);
    expect(readVtfModeFromLocation('')).toBe(false);
  });
});
