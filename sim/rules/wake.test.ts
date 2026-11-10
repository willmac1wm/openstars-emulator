import { describe, expect, it } from 'vitest';
import { wakeForType, wakeMinimaNm } from './wake';

describe('wake CWT minima (7110.65BB 5-5-4 on approach)', () => {
  it('maps representative types to categories', () => {
    expect(wakeForType('A388')).toBe('A');
    expect(wakeForType('B744')).toBe('B');
    expect(wakeForType('A333')).toBe('C');
    expect(wakeForType('B752')).toBe('E');
    expect(wakeForType('B738')).toBe('F');
    expect(wakeForType('E75L')).toBe('G');
    expect(wakeForType('C172')).toBe('I');
  });

  it('applies on-approach matrix leader A / follower I = 8 NM', () => {
    expect(wakeMinimaNm('A', 'I')).toBe(8);
    expect(wakeMinimaNm('B', 'F')).toBe(5);
    expect(wakeMinimaNm('E', 'I')).toBe(4);
    expect(wakeMinimaNm('F', 'F')).toBeNull();
  });
});
