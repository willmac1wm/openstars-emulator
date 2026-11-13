import { describe, expect, it } from 'vitest';
import {
  dailySeedForDate,
  isModeUnlocked,
  nextRank,
  nextUnlock,
  rankFor,
  recordSession,
  EMPTY_PROGRESS,
} from './progression';

describe('dailySeedForDate', () => {
  it('is the same seed for everyone on the same date and changes daily', () => {
    expect(dailySeedForDate(new Date(2026, 10, 12))).toBe('daily-2026-11-12');
    expect(dailySeedForDate(new Date(2026, 10, 12, 23, 59))).toBe('daily-2026-11-12');
    expect(dailySeedForDate(new Date(2026, 10, 13))).toBe('daily-2026-11-13');
  });
});

describe('isModeUnlocked', () => {
  it('Expo and Trainee are always open', () => {
    expect(isModeUnlocked(EMPTY_PROGRESS, 'Expo')).toBe(true);
    expect(isModeUnlocked(EMPTY_PROGRESS, 'Easy')).toBe(true);
    expect(isModeUnlocked(EMPTY_PROGRESS, 'Expo60')).toBe(true);
  });

  it('Controller unlocks after 2 clean exits in a Trainee session', () => {
    expect(isModeUnlocked(EMPTY_PROGRESS, 'Medium')).toBe(false);
    const afterOne = recordSession(EMPTY_PROGRESS, 'Easy', 500, 1);
    expect(isModeUnlocked(afterOne, 'Medium')).toBe(false);
    const afterTwo = recordSession(EMPTY_PROGRESS, 'Easy', 1500, 2);
    expect(isModeUnlocked(afterTwo, 'Medium')).toBe(true);
    // Two 1-exit sessions do not unlock — it is per-session, not cumulative.
    const twoSingles = recordSession(afterOne, 'Easy', 500, 1);
    expect(isModeUnlocked(twoSingles, 'Medium')).toBe(false);
  });

  it('Veteran unlocks after 2 clean exits in a Controller session', () => {
    const unlocked = recordSession(recordSession(EMPTY_PROGRESS, 'Easy', 1500, 2), 'Medium', 2000, 2);
    expect(isModeUnlocked(unlocked, 'Hard')).toBe(true);
    expect(isModeUnlocked(recordSession(EMPTY_PROGRESS, 'Easy', 1500, 2), 'Hard')).toBe(false);
  });
});

describe('nextUnlock', () => {
  it('points at Controller first, then Veteran, then null', () => {
    expect(nextUnlock(EMPTY_PROGRESS)?.mode).toBe('Medium');
    const mid = recordSession(EMPTY_PROGRESS, 'Easy', 1500, 2);
    expect(nextUnlock(mid)?.mode).toBe('Hard');
    expect(nextUnlock(mid)?.have).toBe(0);
    const done = recordSession(mid, 'Medium', 2000, 2);
    expect(nextUnlock(done)).toBeNull();
  });
});

describe('rankFor / nextRank', () => {
  it('ranks climb with cumulative clean exits', () => {
    expect(rankFor(EMPTY_PROGRESS).name).toBe('TRAINEE');
    expect(rankFor(recordSession(EMPTY_PROGRESS, 'Easy', 100, 2)).name).toBe('JUNIOR CONTROLLER');
    expect(rankFor(recordSession(EMPTY_PROGRESS, 'Easy', 100, 6)).name).toBe('CONTROLLER');
    expect(rankFor(recordSession(EMPTY_PROGRESS, 'Easy', 100, 20)).name).toBe('VETERAN');
    expect(nextRank(recordSession(EMPTY_PROGRESS, 'Easy', 100, 20))).toBeNull();
    expect(nextRank(EMPTY_PROGRESS)).toEqual(
      expect.objectContaining({ have: 0, need: 2 }),
    );
  });
});

describe('recordSession', () => {
  it('accumulates totals and tracks best per mode', () => {
    const next = recordSession(recordSession(EMPTY_PROGRESS, 'Easy', 800, 1), 'Easy', 1500, 3);
    expect(next.totalCleanExits).toBe(4);
    expect(next.totalSessions).toBe(2);
    expect(next.bestScore).toBe(1500);
    expect(next.bestCleanExitsByMode.Easy).toBe(3);
  });
});
