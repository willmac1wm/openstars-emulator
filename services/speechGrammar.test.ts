import { describe, expect, it } from 'vitest';
import { buildAtcJsgf, callsignGrammarPhrases } from './speechGrammar';

describe('callsignGrammarPhrases', () => {
  it('expands airline callsigns into spoken forms', () => {
    const phrases = callsignGrammarPhrases('UAL123');
    expect(phrases).toContain('ual123');
    expect(phrases.some((p) => p.includes('united'))).toBe(true);
    expect(phrases.some((p) => /one.*two.*three/.test(p))).toBe(true);
  });

  it('handles November tail numbers', () => {
    const phrases = callsignGrammarPhrases('N123AB');
    expect(phrases.some((p) => p.startsWith('november'))).toBe(true);
  });
});

describe('buildAtcJsgf', () => {
  it('emits JSGF with callsigns and ATC actions', () => {
    const jsgf = buildAtcJsgf(['AAL421', 'UAL123']);
    expect(jsgf).toContain('#JSGF V1.0;');
    expect(jsgf).toContain('grammar openstars_atc');
    expect(jsgf).toMatch(/american|united/i);
    expect(jsgf).toContain('descend and maintain');
  });
});
