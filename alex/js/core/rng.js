// Seeded RNG (mulberry32) with the helpers the generators need. Pure: runs in node too.

export function makeRng(seed) {
  let s = seed | 0;
  const r = () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => (b === undefined ? Math.floor(r() * a) : a + Math.floor(r() * (b - a + 1)));
  r.chance = (p) => r() < p;
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  r.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  // entries: [[value, weight], ...] or objects with .w
  r.weighted = (entries) => {
    let tot = 0;
    for (const e of entries) tot += Array.isArray(e) ? e[1] : e.w;
    let x = r() * tot;
    for (const e of entries) {
      x -= Array.isArray(e) ? e[1] : e.w;
      if (x <= 0) return Array.isArray(e) ? e[0] : e;
    }
    const last = entries[entries.length - 1];
    return Array.isArray(last) ? last[0] : last;
  };
  r.fork = () => makeRng(Math.floor(r() * 2 ** 31));
  return r;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
