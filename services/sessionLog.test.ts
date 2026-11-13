import { describe, expect, it, beforeEach, vi } from 'vitest';
import { clearSessionLog, loadSessionLog, saveSessionRecord, sessionLogToText } from './sessionLog';

function installFakeLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
  });
}

beforeEach(() => {
  installFakeLocalStorage();
  clearSessionLog();
  localStorage.clear();
});

describe('sessionLog', () => {
  it('records sessions newest-first and caps at 50', () => {
    saveSessionRecord({ initials: 'WIL', mode: 'Easy', score: 100, cleanExits: 1, busts: 0, at: 1000 });
    saveSessionRecord({ initials: 'WIL', mode: 'Medium', score: 200, cleanExits: 2, busts: 1, at: 2000 });
    const rows = loadSessionLog();
    expect(rows).toHaveLength(2);
    expect(rows[0].mode).toBe('Medium');
    expect(rows[0].initials).toBe('WIL');
  });

  it('marks daily entries and renders a copyable table', () => {
    saveSessionRecord({ initials: 'ABC', mode: 'Easy', score: 1500, cleanExits: 2, busts: 0, daily: true, at: 3000 });
    const rows = loadSessionLog();
    expect(rows[0].daily).toBe(true);
    const text = sessionLogToText(rows);
    expect(text).toContain('ABC');
    expect(text).toContain('Easy (daily)');
    expect(text).toContain('1500');
  });

  it('clears the log', () => {
    saveSessionRecord({ initials: 'ABC', mode: 'Easy', score: 10, cleanExits: 0, busts: 0 });
    clearSessionLog();
    expect(loadSessionLog()).toEqual([]);
  });
});
