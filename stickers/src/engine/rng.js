// Small seeded RNG (mulberry32). Every run, pack and shuffle goes through one of
// these so a seed reproduces a whole run, and the balance sim is deterministic.
function hashSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function makeRng(seed = 1) {
  let a = hashSeed(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    // weights: array of [value, weight]
    weighted(weights) {
      const total = weights.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of weights) { if ((r -= w) < 0) return v; }
      return weights[weights.length - 1][0];
    },
  };
  return rng;
}
