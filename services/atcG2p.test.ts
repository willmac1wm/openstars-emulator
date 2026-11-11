import { describe, expect, it } from 'vitest';
import { atcTextToPhonemes } from './atcG2p';

describe('atcG2p', () => {
  it('phonemizes common ATC readback vocabulary', () => {
    const phones = atcTextToPhonemes('United one two three turn left heading two seven zero');
    expect(phones).toContain('junˈaɪtəd');
    expect(phones).toContain('tˈɝn');
    expect(phones).toContain('hˈɛdɪŋ');
    expect(phones.split(' ').length).toBeGreaterThan(5);
  });

  it('expands digit strings', () => {
    const phones = atcTextToPhonemes('climb and maintain 5000');
    expect(phones).toContain('klˈaɪm');
    expect(phones).toContain('fˈaɪv');
  });
});
