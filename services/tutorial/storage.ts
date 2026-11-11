const KEY = 'openstars_tutorial_done';

export function hasCompletedTutorial(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialCompleted(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* private mode */
  }
}

export function clearTutorialCompletion(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
