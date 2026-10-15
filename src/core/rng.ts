/**
 * Deterministic PRNG (mulberry32). Deterministic noise matters here: ambient
 * detail, particle seeds and procedural textures must look identical between
 * runs so a save never loads into a visually different world.
 */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  int(lo: number, hiExclusive: number): number {
    return lo + Math.floor(this.next() * (hiExclusive - lo));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Signed value in [-1, 1]. */
  signed(): number {
    return this.next() * 2 - 1;
  }
}

/** Stable string -> 32-bit seed, so scene ids can seed their own detail. */
export const hashSeed = (text: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Cheap 1D value noise, used for wind, flicker and lamp instability. */
export const valueNoise1 = (x: number, seed = 0): number => {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number): number => {
    let t = (n + seed * 374761393) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  const a = h(i);
  const b = h(i + 1);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
};

/** Sum of octaves of valueNoise1, in [0,1]. */
export const fbm1 = (x: number, octaves = 3, seed = 0): number => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise1(x * freq, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};
