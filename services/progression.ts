/**
 * Player progression — local only, no accounts, no server.
 *
 * One profile per browser/device (localStorage). Levels are derived from
 * cumulative clean exits stored locally, and lesson modes unlock by
 * finishing the previous mode with at least 2 clean exits in one session.
 * Expo Arcade (and the 60-Second Challenge) are always open — a walk-up
 * player at a booth is never locked out.
 */
import { sanitizeInitials } from './highScores';

export interface PlayerProfile {
  initials: string;
}

const PROFILE_KEY = 'openstars_profile';
const PROGRESS_KEY = 'openstars_progress';

/** Clean exits in a single session of the previous mode needed to unlock the next. */
export const UNLOCK_CLEAN_EXITS = 2;

export interface Progress {
  totalCleanExits: number;
  totalSessions: number;
  bestScore: number;
  /** Best clean-exit count in a single session, per mode key (Easy/Medium/Hard/Expo/60-Second). */
  bestCleanExitsByMode: Record<string, number>;
}

export const EMPTY_PROGRESS: Progress = {
  totalCleanExits: 0,
  totalSessions: 0,
  bestScore: 0,
  bestCleanExitsByMode: {},
};

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { initials: 'ATC' };
    const parsed = JSON.parse(raw) as PlayerProfile;
    if (!parsed || typeof parsed.initials !== 'string') return { initials: 'ATC' };
    return { initials: sanitizeInitials(parsed.initials) };
  } catch {
    return { initials: 'ATC' };
  }
}

export function saveProfile(profile: PlayerProfile): PlayerProfile {
  const next = { initials: sanitizeInitials(profile.initials) };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { ...EMPTY_PROGRESS, bestCleanExitsByMode: {} };
    const parsed = JSON.parse(raw) as Progress;
    if (!parsed || typeof parsed.totalCleanExits !== 'number') return { ...EMPTY_PROGRESS, bestCleanExitsByMode: {} };
    return {
      totalCleanExits: Math.max(0, Math.floor(parsed.totalCleanExits)),
      totalSessions: Math.max(0, Math.floor(parsed.totalSessions || 0)),
      bestScore: Math.max(0, Math.floor(parsed.bestScore || 0)),
      bestCleanExitsByMode: parsed.bestCleanExitsByMode || {},
    };
  } catch {
    return { ...EMPTY_PROGRESS, bestCleanExitsByMode: {} };
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

export function recordSession(progress: Progress, mode: string, score: number, cleanExits: number): Progress {
  const clean = Math.max(0, Math.floor(cleanExits));
  return {
    totalCleanExits: progress.totalCleanExits + clean,
    totalSessions: progress.totalSessions + 1,
    bestScore: Math.max(progress.bestScore, Math.max(0, Math.floor(score))),
    bestCleanExitsByMode: {
      ...progress.bestCleanExitsByMode,
      [mode]: Math.max(progress.bestCleanExitsByMode[mode] || 0, clean),
    },
  };
}

/** Expo and Trainee are always open; Controller needs 2 clean exits in Trainee, Veteran needs 2 in Controller. */
export function isModeUnlocked(progress: Progress, difficulty: string): boolean {
  if (difficulty === 'Expo' || difficulty === 'Easy' || difficulty === 'Expo60' || difficulty === '60-Second') return true;
  if (difficulty === 'Medium') return (progress.bestCleanExitsByMode.Easy || 0) >= UNLOCK_CLEAN_EXITS;
  if (difficulty === 'Hard') return (progress.bestCleanExitsByMode.Medium || 0) >= UNLOCK_CLEAN_EXITS;
  return true;
}

export function unlockRequirement(difficulty: string): string | null {
  if (difficulty === 'Medium') return `Finish TRAINEE with ${UNLOCK_CLEAN_EXITS}+ clean exits to unlock`;
  if (difficulty === 'Hard') return `Finish CONTROLLER with ${UNLOCK_CLEAN_EXITS}+ clean exits to unlock`;
  return null;
}

/** The next locked lesson mode, with how many clean exits the player already has toward it. */
export function nextUnlock(progress: Progress): { mode: string; label: string; have: number; need: number } | null {
  if (!isModeUnlocked(progress, 'Medium')) {
    return { mode: 'Medium', label: 'CONTROLLER', have: progress.bestCleanExitsByMode.Easy || 0, need: UNLOCK_CLEAN_EXITS };
  }
  if (!isModeUnlocked(progress, 'Hard')) {
    return { mode: 'Hard', label: 'VETERAN', have: progress.bestCleanExitsByMode.Medium || 0, need: UNLOCK_CLEAN_EXITS };
  }
  return null;
}

export interface Rank {
  name: string;
  minCleanExits: number;
}

export const RANKS: Rank[] = [
  { name: 'TRAINEE', minCleanExits: 0 },
  { name: 'JUNIOR CONTROLLER', minCleanExits: 2 },
  { name: 'CONTROLLER', minCleanExits: 6 },
  { name: 'SENIOR CONTROLLER', minCleanExits: 12 },
  { name: 'VETERAN', minCleanExits: 20 },
];

export function rankFor(progress: Progress): Rank {
  let rank = RANKS[0];
  for (const candidate of RANKS) {
    if (progress.totalCleanExits >= candidate.minCleanExits) rank = candidate;
  }
  return rank;
}

export function nextRank(progress: Progress): { rank: Rank; have: number; need: number } | null {
  const current = rankFor(progress);
  const idx = RANKS.indexOf(current);
  if (idx < 0 || idx >= RANKS.length - 1) return null;
  const next = RANKS[idx + 1];
  return { rank: next, have: progress.totalCleanExits, need: next.minCleanExits };
}

/** Daily challenge seed — same seed for everyone on the same calendar date (local time). */
export function dailySeedForDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `daily-${y}-${m}-${d}`;
}

export function dailySeedToday(): string {
  return dailySeedForDate(new Date());
}

export function dailyLabelForDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
