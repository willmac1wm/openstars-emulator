/** Deterministic mulberry32 RNG stored as a single uint32 in SimState.rngState. */

export function seedFromLabel(label: string): number {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nextRng(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
}

export function randRange(state: number, min: number, max: number): { value: number; state: number } {
  const n = nextRng(state);
  return { value: min + n.value * (max - min), state: n.state };
}
