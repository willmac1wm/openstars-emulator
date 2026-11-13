import { describe, expect, it, beforeEach, vi } from 'vitest';
import { clearHighScores, loadHighScores, sanitizeInitials, saveHighScore } from './highScores';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
  });
});

describe('sanitizeInitials', () => {
  it('uppercases and pads to three letters', () => {
    expect(sanitizeInitials('ab')).toBe('ABA');
    expect(sanitizeInitials('wxyz')).toBe('WXY');
  });

  it('replaces blocked initials', () => {
    expect(sanitizeInitials('ASS')).toBe('ATC');
    expect(sanitizeInitials('fuk')).toBe('ATC');
  });
});

describe('saveHighScore with mode', () => {
  it('stores mode and daily flags without breaking old entries', () => {
    localStorage.clear();
    saveHighScore('WIL', 1200, { mode: '60-Second' });
    saveHighScore('ABC', 900, { mode: 'Expo', daily: true });
    const board = loadHighScores();
    expect(board).toHaveLength(2);
    expect(board[0]).toEqual(expect.objectContaining({ initials: 'WIL', mode: '60-Second' }));
    expect(board[1]).toEqual(expect.objectContaining({ daily: true }));
    clearHighScores();
    expect(loadHighScores()).toEqual([]);
  });
});
