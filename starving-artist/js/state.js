// Game state: the permanent record of what Nate chose, painted and neglected.
const SAVE_KEY = 'starving-artist.save.v1';
const META_KEY = 'starving-artist.meta.v1';
const SETTINGS_KEY = 'starving-artist.settings.v1';

export const PRIORITIES = ['create', 'bond', 'duty'];

export function newState() {
  return {
    chapter: 0,          // memories completed (0..6)
    records: [],         // per memory: { picked:[a,b], neglected, comp, notes:[], mementos:[] }
    rel: { mom: 0, dad: 0, teo: 0, priya: 0 },
    health: 0,
    breakers: [],        // venue puzzle progress
    invites: [],
    deaths: 0,
    playTime: 0,
    finalComp: null,
    flags: {},
  };
}

export const S = { cur: newState() };

export function counts(st = S.cur) {
  const c = { create: 0, bond: 0, duty: 0 };
  for (const r of st.records) for (const p of r.picked) c[p]++;
  return c;
}
export function neglect(st = S.cur) {
  const n = { create: 0, bond: 0, duty: 0 };
  for (const r of st.records) n[r.neglected]++;
  return n;
}
export function inspiration(st = S.cur) {
  let offered = 0, followed = 0, following = 0;
  const all = [...st.records.map((r) => r.comp).filter((c) => c && !c.blank), st.finalComp].filter(Boolean);
  all.forEach((c) => {
    const w = c === st.finalComp ? 2 : 1;
    for (const i of c.insp || []) { offered += w; if (i.followed) { followed += w; if (i.following) following += w; } }
  });
  return { offered, followed, following, ratio: offered ? followed / offered : 0 };
}

// Alienate's manifestation stage in the Vista Venue, by chapter and neglect.
export function alienStage(st = S.cur) {
  const k = st.chapter;
  const n = neglect(st);
  const selfNeglect = n.bond + n.duty;
  let s = [0, 0, 1, 2, 3, 4, 5, 5][k] ?? 5;
  if (k >= 1 && k <= 3 && selfNeglect >= k) s += 1;
  return Math.min(5, s);
}
// 0..1 — how hard Alienate hunts (speed/perception)
export function alienIntensity(st = S.cur) {
  const n = neglect(st);
  const ins = inspiration(st);
  return Math.min(1, 0.25 + n.bond * 0.1 + n.duty * 0.1 + ins.ratio * 0.3 - n.create * 0.05);
}

export function ending(st = S.cur) {
  const c = counts(st);
  const ins = inspiration(st);
  if (c.create <= 1) return 'boring';
  if (c.bond <= 2) return 'bad';
  if (ins.ratio > 0.55) return 'gone';
  return 'good';
}

export function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.cur)); } catch { /* storage unavailable */ }
}
export function hasSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return !!(s && s.records); } catch { return false; }
}
export function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.records) { S.cur = { ...newState(), ...s }; return true; } } catch { /* ignore */ }
  return false;
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export function meta() {
  try { return { endings: [], runs: 0, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') }; } catch { return { endings: [], runs: 0 }; }
}
export function recordEnding(id) {
  const m = meta();
  if (!m.endings.includes(id)) m.endings.push(id);
  m.runs++;
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.7, sfx: 0.9, sens: 1, invertY: false, fov: 70, res: 240,
  dither: true, crt: true, snap: true, affine: true, grain: true, headBob: true,
  reduceFlash: false, hints: true, textSpeed: 1, textSize: 1, blips: true,
};
export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
