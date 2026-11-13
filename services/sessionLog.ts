/**
 * Session log — every finished session on this device, for the instructor /
 * class-scores view. Local only (localStorage), newest first, capped at 50.
 * This is separate from the arcade top-10 board in highScores.ts, which
 * only keeps the best arcade scores.
 */
import { sanitizeInitials } from './highScores';

export interface SessionRecord {
  initials: string;
  mode: string;
  score: number;
  cleanExits: number;
  busts: number;
  at: number;
  daily?: boolean;
  seed?: string;
}

const STORAGE_KEY = 'openstars_session_log';
const MAX_RECORDS = 50;

export function loadSessionLog(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row.score === 'number' && typeof row.mode === 'string')
      .map((row) => ({
        initials: sanitizeInitials(row.initials || 'ATC'),
        mode: row.mode,
        score: Math.max(0, Math.floor(row.score)),
        cleanExits: Math.max(0, Math.floor(row.cleanExits || 0)),
        busts: Math.max(0, Math.floor(row.busts || 0)),
        at: row.at || 0,
        daily: Boolean(row.daily),
        seed: typeof row.seed === 'string' ? row.seed : undefined,
      }))
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export function saveSessionRecord(record: Omit<SessionRecord, 'at'> & { at?: number }): SessionRecord[] {
  const next = [
    {
      ...record,
      initials: sanitizeInitials(record.initials),
      score: Math.max(0, Math.floor(record.score)),
      at: record.at ?? Date.now(),
    },
    ...loadSessionLog(),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function clearSessionLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

/** Plain-text table for copy-to-clipboard (no server export). */
export function sessionLogToText(rows: SessionRecord[]): string {
  const header = 'Player\tMode\tScore\tClean exits\tBusts\tDate';
  const lines = rows.map((row) => [
    row.initials,
    row.mode + (row.daily ? ' (daily)' : ''),
    String(row.score),
    String(row.cleanExits),
    String(row.busts),
    new Date(row.at).toLocaleString(),
  ].join('\t'));
  return [header, ...lines].join('\n');
}
