import { describe, expect, it } from 'vitest';
import { applySelectionToCommandInput } from './commandInput';

describe('applySelectionToCommandInput', () => {
  it('fills an empty input with the selected callsign', () => {
    expect(applySelectionToCommandInput('', 'AAL421')).toBe('AAL421 ');
    expect(applySelectionToCommandInput('   ', 'UAL123')).toBe('UAL123 ');
  });

  it('never retargets a typed command for another aircraft (Nov 12 bug)', () => {
    // The selection effect re-runs every sim tick; rewriting here turned
    // "DAL456 H090" into "AAL421 H090" — a clearance to the wrong aircraft.
    expect(applySelectionToCommandInput('DAL456 H090', 'AAL421')).toBeNull();
    expect(applySelectionToCommandInput('DAL456 TL270 A060 S210', 'AAL421')).toBeNull();
  });

  it('switches a bare callsign (no command yet) to the selected aircraft', () => {
    expect(applySelectionToCommandInput('DAL456', 'AAL421')).toBe('AAL421');
    expect(applySelectionToCommandInput('DAL456 ', 'AAL421')).toBe('AAL421 ');
  });

  it('leaves the selected aircraft’s own command alone', () => {
    expect(applySelectionToCommandInput('AAL421 H090', 'AAL421')).toBeNull();
  });

  it('completes a bare letter prefix to the selected callsign', () => {
    expect(applySelectionToCommandInput('AA', 'AAL421')).toBe('AAL421 ');
    expect(applySelectionToCommandInput('DA', 'AAL421')).toBeNull();
  });
});
