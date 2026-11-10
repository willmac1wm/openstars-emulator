import { describe, expect, it } from 'vitest';
import { createSeededRandom, seedFromLabel } from './seededRandom';

describe('seededRandom', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('hashes labels stably', () => {
    expect(seedFromLabel('expo-booth')).toBe(seedFromLabel('expo-booth'));
    expect(seedFromLabel('expo-booth')).not.toBe(seedFromLabel('trainee-1'));
  });
});
