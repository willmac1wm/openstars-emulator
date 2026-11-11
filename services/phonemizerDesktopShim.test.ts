import { describe, expect, it } from 'vitest';
import { phonemize } from './phonemizerDesktopShim';

describe('phonemizerDesktopShim', () => {
  it('returns joinable phoneme strings for kokoro-js', async () => {
    const parts = await phonemize('American four two one unable');
    expect(parts.length).toBe(1);
    expect(parts[0]).toContain('əmˈɛɹɪkən');
    expect(parts.join(' ')).toContain('ʌnˈeɪbəl');
  });
});
