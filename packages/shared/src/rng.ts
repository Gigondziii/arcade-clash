// Deterministic PRNG for gameplay/cosmetic randomness. mulberry32 is a
// small, fast, well-tested 32-bit generator — not cryptographic, but that's
// not the goal here; the goal is the same seed always produces the same
// sequence, on any machine, forever.
export type RandomFn = () => number;

export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// xmur3 string hash, used to turn (rootSeed, label) into an independent
// child seed. This is what lets createSeededRandom(seed).stream("gameplay")
// and .stream("cosmetic") produce non-overlapping sequences from one root
// seed — advancing one stream can never perturb the other, because they're
// backed by two separate mulberry32 generators with unrelated internal
// state, not two slices of one shared stream.
function deriveStreamSeed(rootSeed: number, label: string): number {
  let h = 1779033703 ^ rootSeed;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return h >>> 0;
}

export type SeededRandom = {
  stream(label: string): RandomFn;
};

export function createSeededRandom(seed: number): SeededRandom {
  return {
    stream(label: string): RandomFn {
      return mulberry32(deriveStreamSeed(seed, label));
    },
  };
}
