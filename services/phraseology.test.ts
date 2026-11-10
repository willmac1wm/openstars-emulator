import { describe, expect, it } from 'vitest';
import {
  speakAltitudeHundreds,
  speakCallsign,
  speakFlightNumber,
  speakHeading,
  speakKnots,
  voiceForCallsign,
} from './phraseology';

describe('phraseology', () => {
  it('speaks headings as three digits with niner', () => {
    expect(speakHeading(270)).toBe('two seven zero');
    expect(speakHeading(90)).toBe('zero niner zero');
    expect(speakHeading(0)).toBe('three six zero');
    expect(speakHeading(360)).toBe('three six zero');
  });

  it('speaks altitudes in thousands and hundreds', () => {
    expect(speakAltitudeHundreds(70)).toBe('seven thousand');
    expect(speakAltitudeHundreds(90)).toBe('niner thousand');
    expect(speakAltitudeHundreds(65)).toBe('six thousand five hundred');
    expect(speakAltitudeHundreds(100)).toBe('one zero thousand');
    expect(speakAltitudeHundreds(105)).toBe('one zero thousand five hundred');
    expect(speakAltitudeHundreds(110)).toBe('one one thousand');
    expect(speakAltitudeHundreds(180)).toBe('flight level one eight zero');
  });

  it('speaks speeds as individual digits', () => {
    expect(speakKnots(210)).toBe('two one zero');
    expect(speakKnots(190)).toBe('one niner zero');
  });

  it('uses airline telephony and group-form flight numbers', () => {
    expect(speakCallsign('AAL421')).toBe('American four twenty-one');
    expect(speakCallsign('UAL123')).toBe('United one twenty-three');
    expect(speakCallsign('DAL100')).toBe('Delta one hundred');
    expect(speakCallsign('DAL456')).toBe('Delta four fifty-six');
    expect(speakCallsign('AAL404')).toBe('American four zero four');
    expect(speakCallsign('SWA890')).toBe('Southwest eight ninety');
    expect(speakCallsign('ASH310')).toBe('Air Shuttle three ten');
    expect(speakCallsign('AAL11')).toBe('American eleven');
    expect(speakFlightNumber('1234')).toBe('twelve thirty-four');
    expect(speakCallsign('N123AB')).toBe('November one two three Alpha Bravo');
  });

  it('keeps the same voice for a callsign', () => {
    expect(voiceForCallsign('AAL421')).toBe(voiceForCallsign('AAL421'));
    const voices = new Set(['AAL421', 'UAL123', 'DAL456', 'SWA890', 'SKW221', 'ASH310', 'JBU512', 'ASA188'].map(voiceForCallsign));
    expect(voices.size).toBeGreaterThan(1);
  });
});
