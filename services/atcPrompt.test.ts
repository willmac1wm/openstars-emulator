import { describe, expect, it } from 'vitest';
import { buildAtcInitialPrompt } from './atcPrompt';

describe('buildAtcInitialPrompt', () => {
  it('includes ATC phraseology and active callsigns', () => {
    const prompt = buildAtcInitialPrompt(['AAL421', 'UAL123']);
    expect(prompt).toMatch(/climb and maintain/i);
    expect(prompt).toContain('AAL421');
    expect(prompt).toContain('UAL123');
  });

  it('works with an empty scope', () => {
    expect(buildAtcInitialPrompt([])).toMatch(/Air traffic control/i);
  });
});
