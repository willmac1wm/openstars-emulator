import { seedFromLabel } from './seededRandom';
import { ScenarioDifficulty } from '../types';

export const DEFAULT_SCENARIO_SEEDS: Record<ScenarioDifficulty, string> = {
  Expo: 'expo-booth',
  Easy: 'trainee-1',
  Medium: 'controller-1',
  Hard: 'veteran-1',
};

export interface ResolvedSeed {
  /** What teachers see and can copy into ?seed= */
  display: string;
  /** Numeric value fed to the PRNG */
  numeric: number;
}

/** Accepts URL values like 1234, expo-booth, or trainee-1. */
export function resolveSeedInput(raw: string | number | null | undefined, difficulty?: ScenarioDifficulty | string): ResolvedSeed {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const numeric = raw >>> 0;
    return { display: String(numeric), numeric };
  }

  const trimmed = String(raw ?? '').trim();
  if (trimmed) {
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number.parseInt(trimmed, 10) >>> 0;
      return { display: String(numeric), numeric };
    }
    return { display: trimmed, numeric: seedFromLabel(trimmed) };
  }

  const level = (difficulty === 'Expo' || difficulty === 'Easy' || difficulty === 'Hard' || difficulty === 'Medium')
    ? difficulty
    : 'Medium';
  const fallback = DEFAULT_SCENARIO_SEEDS[level];
  return { display: fallback, numeric: seedFromLabel(fallback) };
}

export function readSeedFromLocation(search = typeof window !== 'undefined' ? window.location.search : ''): string | null {
  try {
    const params = new URLSearchParams(search);
    const seed = params.get('seed');
    return seed && seed.trim() ? seed.trim() : null;
  } catch {
    return null;
  }
}

export function writeSeedToUrl(seedDisplay: string) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seedDisplay);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}
