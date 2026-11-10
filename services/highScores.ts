export interface HighScoreEntry {
  initials: string;
  score: number;
  at: number;
}

const STORAGE_KEY = 'openstars_arcade_scores';
const MAX_ENTRIES = 10;

/** Short blocklist for 3-letter arcade initials. Local only. */
const BLOCKED = new Set([
  'ASS', 'SEX', 'FUK', 'FUC', 'FCK', 'SHT', 'DIC', 'TIT', 'POO', 'PIS', 'CUM',
  'GAY', 'NIG', 'NGR', 'FAG', 'KKK', 'JEW', 'WTF', 'OMG', // keep mild booth-safe
]);

export function sanitizeInitials(raw: string): string {
  const letters = raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const padded = (letters + 'AAA').slice(0, 3);
  if (BLOCKED.has(padded)) return 'ATC';
  return padded;
}

export function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HighScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row.score === 'number' && typeof row.initials === 'string')
      .map((row) => ({
        initials: sanitizeInitials(row.initials),
        score: Math.max(0, Math.floor(row.score)),
        at: row.at || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveHighScore(initials: string, score: number): HighScoreEntry[] {
  const next = [
    ...loadHighScores(),
    { initials: sanitizeInitials(initials), score: Math.max(0, Math.floor(score)), at: Date.now() },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function qualifiesForBoard(score: number): boolean {
  const board = loadHighScores();
  if (board.length < MAX_ENTRIES) return score > 0;
  return score > board[board.length - 1].score;
}
