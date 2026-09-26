// Seeded RNG (mulberry32) so floors, hallucination draws and charts can be reproduced.

export function makeRng(seed = (Math.random() * 2 ** 31) | 0) {
  let s = seed | 0;
  const r = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.seed = seed;
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1)); // inclusive
  r.chance = (p) => r() < p;
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  r.weighted = (entries) => { // [[value, weight], ...]
    const total = entries.reduce((a, e) => a + e[1], 0);
    let x = r() * total;
    for (const [v, w] of entries) { if ((x -= w) < 0) return v; }
    return entries[entries.length - 1][0];
  };
  return r;
}
