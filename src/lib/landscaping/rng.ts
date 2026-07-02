/** Deterministic PRNG (mulberry32) so a given site JSON always scatters the same layout. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple string/number hash used to derive a stable numeric seed from site dimensions. */
export function hashSeed(...parts: (string | number)[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

export function rngRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function rngPick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}
