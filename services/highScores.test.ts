import { describe, expect, it } from 'vitest';
import { sanitizeInitials } from './highScores';

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
