// Floor map generation (Isaac-style): start → 6–9 combat rooms → pre-boss → boss,
// with branches for special rooms (Gas Station / Lost & Found), optional vendor or
// side rooms and a hidden bathroom. Pure data; deterministic for a given RNG.

import { LAYOUTS, SPECIAL } from './layouts.js';
import { FLOOR_BUDGET, ECONOMY } from '../config.js';

export const DIRS = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
export const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
const SIZE = 11;

export function generateFloor(floor, rng, opts = {}) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const f = tryGenerate(floor, rng, opts);
    if (f) return f;
  }
  throw new Error('floor generation failed');
}

function tryGenerate(floor, rng, opts) {
  const cells = new Map();
  const key = (x, y) => x + ',' + y;
  const rooms = [];
  const occupiedNeighbors = (x, y) => Object.values(DIRS).filter(([dx, dy]) => cells.has(key(x + dx, y + dy))).length;
  const add = (x, y, kind, parent, dir) => {
    const r = { id: rooms.length, gx: x, gy: y, kind, doors: {}, depth: parent ? parent.depth + 1 : 0, visited: false, seen: false, cleared: false };
    rooms.push(r);
    cells.set(key(x, y), r);
    if (parent) { parent.doors[dir] = r.id; r.doors[OPP[dir]] = parent.id; }
    return r;
  };
  const freeDirs = (r, strict = true) => rng.shuffle(Object.keys(DIRS)).filter((d) => {
    const [dx, dy] = DIRS[d];
    const x = r.gx + dx, y = r.gy + dy;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || cells.has(key(x, y))) return false;
    return !strict || occupiedNeighbors(x, y) === 1;
  });

  const start = add(5, 5, 'start', null);
  const mainLen = opts.mainLen ?? rng.int(6, 9);
  const path = [start];
  for (let i = 0; i < mainLen + 2; i++) {
    const cur = path[path.length - 1];
    const ds = freeDirs(cur);
    if (!ds.length) return null;
    const d = ds[0];
    const kind = i < mainLen ? 'combat' : i === mainLen ? 'preboss' : 'boss';
    path.push(add(cur.gx + DIRS[d][0], cur.gy + DIRS[d][1], kind, cur, d));
  }
  const boss = path[path.length - 1];
  const combat = path.filter((r) => r.kind === 'combat');

  const branch = (kind, anchors) => {
    for (const a of rng.shuffle(anchors.slice())) {
      const ds = freeDirs(a);
      if (ds.length) return add(a.gx + DIRS[ds[0]][0], a.gy + DIRS[ds[0]][1], kind, a, ds[0]);
    }
    return null;
  };
  // special slot A: Gas Station (≈60 %) else Lost & Found; slot B: Lost & Found
  const gasChance = opts.gasChance ?? ECONOMY.gasStationChance;
  const slotA = rng.chance(gasChance) ? 'gas' : 'treasure';
  const anchorsEarly = [start, ...combat.slice(0, Math.ceil(combat.length * 0.7))];
  if (!branch(slotA, anchorsEarly)) return null;
  if (!branch('treasure', combat)) return null;
  // optional side rooms (floor 1 uses vendor rooms here; others get extra fights)
  const sides = rng.int(1, 2);
  for (let i = 0; i < sides; i++) {
    const s = branch('side', combat);
    if (s && rng.chance(0.35)) branch('side', [s]);
  }
  // hidden bathroom: a free cell next to any ordinary room
  const cand = [];
  for (const r of rooms) {
    if (r.kind === 'boss' || r.kind === 'preboss' || r.kind === 'secret') continue;
    for (const d of Object.keys(DIRS)) {
      const x = r.gx + DIRS[d][0], y = r.gy + DIRS[d][1];
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || cells.has(key(x, y))) continue;
      if (Object.values(DIRS).some(([dx, dy]) => cells.get(key(x + dx, y + dy))?.kind === 'boss')) continue;
      cand.push([r, d]);
    }
  }
  if (!cand.length) return null;
  const [sr, sd] = rng.pick(cand);
  const secret = add(sr.gx + DIRS[sd][0], sr.gy + DIRS[sd][1], 'secret', sr, sd);
  secret.hidden = true;

  // Layouts + budgets
  const pool = LAYOUTS[floor];
  const used = new Set();
  const [bmin, bmax] = FLOOR_BUDGET[floor - 1];
  const pickLayout = (types) => {
    const opts2 = [];
    for (const t of types) for (const l of pool[t]) if (!used.has(l.key)) opts2.push([t, l]);
    const [t, l] = opts2.length ? rng.pick(opts2) : [types[0], rng.pick(pool[types[0]])];
    used.add(l.key);
    return [t, l];
  };
  combat.forEach((r, i) => {
    const t = combat.length > 1 ? i / (combat.length - 1) : 0;
    const types = t < 0.3 ? ['A', 'B'] : t < 0.7 ? ['A', 'B', 'C', 'D'] : ['C', 'D', 'E'];
    const [ty, l] = pickLayout(floor === 1 ? types.filter((x) => x !== 'D') : types);
    r.type = ty; r.layout = l.key;
    r.budget = Math.round((bmin + (bmax - bmin) * t + rng.range(-0.6, 0.6)) * 2) / 2;
  });
  for (const r of rooms) {
    if (r.kind === 'side') {
      const [ty, l] = pickLayout(floor === 1 ? ['D'] : ['D', 'B', 'C']);
      r.type = ty; r.layout = l.key; r.budget = bmin + 1;
    } else if (r.kind === 'preboss') {
      const [ty, l] = pickLayout(['E']);
      r.type = ty; r.layout = l.key; r.budget = bmax + 1;
    } else if (r.kind === 'start') r.layout = 'start';
    else if (r.kind === 'gas') r.layout = 'gas';
    else if (r.kind === 'treasure') r.layout = 'treasure';
    else if (r.kind === 'secret') r.layout = 'secret';
    else if (r.kind === 'boss') r.layout = 'boss' + floor;
  }
  for (const r of rooms) r.budget = Math.min(r.budget ?? 0, bmax + 2);
  return { floor, rooms, startId: start.id, bossId: boss.id, size: SIZE };
}

export function layoutByKey(floor, key) {
  if (SPECIAL[key]) return SPECIAL[key];
  for (const t of 'ABCDE') for (const l of LAYOUTS[floor][t]) if (l.key === key) return l;
  return null;
}

export function hasCombat(room) { return room.kind === 'combat' || room.kind === 'side' || room.kind === 'preboss'; }
