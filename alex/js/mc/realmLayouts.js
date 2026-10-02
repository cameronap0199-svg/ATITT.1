// Room layouts for the Minecraft realms: the Nether (wastes, soul sand valley, crimson
// and warped forests, basalt deltas, a fortress, the blaze spawner, a bastion and a
// piglin trading post), the Overworld stronghold with its End Portal room, and the
// End island. Pure data like world/layouts.js (built by world/builder.js).

const lay = (key, name, w, d, build, extra = {}) => ({ key, name, w, d, build, ...extra });

// A few helpers on top of the layout builder.
const mc = (b, key, x, z, w, d, h, extra = {}) => b.box({ model: 'mc', mc: key, x, z, w, d, h, color: '#555', vault: h <= 1.9 ? undefined : false, ...extra });
const quadrant = (b, fn) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) fn(sx, sz); };
function lava(b, x, z, w, d) { b.zone({ type: 'lava', shape: 'rect', x, z, w, d }); }
function fungus(b, x, z, kind) {
  const stem = kind === 'warped' ? 'warpedStem' : 'crimsonStem', wart = kind === 'warped' ? 'warpedWart' : 'netherWart';
  const h = 4 + Math.floor(b.rng() * 2);
  mc(b, stem, x, z, 1, 1, h, { hp: 60, mcKey: stem });
  mc(b, wart, x, z, 3, 3, 1.4, { y0: h, hp: 20 });
  mc(b, wart, x, z, 2, 2, 1, { y0: h + 1.4, hp: 20 });
  if (b.rng() < 0.6) mc(b, 'shroomlight', x + 1, z, 1, 1, 1, { y0: h - 0.6, hp: 8 });
  b.light(x, h, z, kind === 'warped' ? '#2dd4bf' : '#fb7185', 0.7, 10);
}

export const REALM_LAYOUTS = {
  // ------------------------------------------------------------------ the Nether
  n_portal: lay('n_portal', 'Nether Arrival', 26, 24, (b) => {
    quadrant(b, (sx, sz) => { if (b.rng() < 0.7) mc(b, 'netherrack', sx * 8, sz * 6.5, 2, 2, 1 + Math.floor(b.rng() * 3)); });
    mc(b, 'glowstone', -10, -8, 1, 1, 1, { y0: 5, hp: 10 }); mc(b, 'glowstone', 10, 7, 1, 1, 1, { y0: 5, hp: 10 });
    lava(b, 8.5, -7.5, 4, 3);
  }, { floor: 'netherrack', walls: 'netherrack', small: true }),

  n_wastes: lay('n_wastes', 'Nether Wastes', 36, 32, (b) => {
    for (let i = 0; i < 9; i++) {
      const x = b.rng.range(-14, 14), z = b.rng.range(-12, 12);
      if (Math.hypot(x, z) < 4) continue;
      mc(b, 'netherrack', Math.round(x), Math.round(z), 2, 2, 1 + Math.floor(b.rng() * 4));
    }
    lava(b, -10, 8, 6, 4); lava(b, 11, -7, 5, 5);
    for (let i = 0; i < 4; i++) mc(b, 'glowstone', b.rng.range(-14, 14), b.rng.range(-12, 12), 1.5, 1.5, 1.2, { y0: 6, hp: 10 });
    b.L.budgetAdd = 0.5;
  }, { floor: 'netherrack', walls: 'netherrack' }),

  n_soul: lay('n_soul', 'Soul Sand Valley', 36, 34, (b) => {
    quadrant(b, (sx, sz) => b.zone({ type: 'soul', shape: 'circle', x: sx * 9, z: sz * 8, r: 3.2 }));
    for (let i = 0; i < 7; i++) {
      const x = Math.round(b.rng.range(-15, 15)), z = Math.round(b.rng.range(-13, 13));
      if (Math.hypot(x, z) < 4) continue;
      // fossils: bone-white pillars
      mc(b, 'boneBlock', x, z, 1, 1, 3 + Math.floor(b.rng() * 3), { hp: 50 });
    }
    for (const [x, z] of [[-6, -10], [7, 10], [13, 0]]) b.light(x, 1, z, '#38bdf8', 1.2, 9);
  }, { floor: 'soulsand', walls: 'netherrack' }),

  n_crimson: lay('n_crimson', 'Crimson Forest', 34, 34, (b) => {
    const pts = [[-9, -9], [9, -8], [-10, 8], [8, 9], [0, -12], [-13, 0], [13, 1]];
    for (const [x, z] of pts) if (b.rng() < 0.85) fungus(b, x + Math.round(b.rng.range(-1, 1)), z, 'crimson');
    lava(b, 0, 11, 4, 3);
  }, { floor: 'crimson', walls: 'netherrack' }),

  n_warped: lay('n_warped', 'Warped Forest', 34, 34, (b) => {
    const pts = [[-9, -9], [9, -8], [-10, 8], [8, 9], [0, 12], [-13, 0], [13, 1]];
    for (const [x, z] of pts) if (b.rng() < 0.85) fungus(b, x + Math.round(b.rng.range(-1, 1)), z, 'warped');
  }, { floor: 'warped', walls: 'netherrack' }),

  n_basalt: lay('n_basalt', 'Basalt Deltas', 36, 32, (b) => {
    for (let i = 0; i < 10; i++) {
      const x = Math.round(b.rng.range(-15, 15)), z = Math.round(b.rng.range(-13, 13));
      if (Math.hypot(x, z) < 4 || Math.abs(x) < 2.5 || Math.abs(z) < 2.5) continue;
      mc(b, 'basalt', x, z, 1 + Math.floor(b.rng() * 2), 1 + Math.floor(b.rng() * 2), 2 + Math.floor(b.rng() * 4), { hp: 70 });
    }
    lava(b, -9, -8, 5, 4); lava(b, 10, 8, 6, 4); lava(b, -11, 9, 3, 3); lava(b, 9, -9, 3, 3);
    b.L.budgetAdd = 0.5;
  }, { floor: 'basalt', walls: 'netherrack' }),

  n_fortress: lay('n_fortress', 'Nether Fortress Hall', 30, 40, (b) => {
    for (const sx of [-1, 1]) for (let z = -15; z <= 15; z += 6) mc(b, 'netherBrick', sx * 9, z, 1.5, 1.5, 5, { vault: false });
    for (const sx of [-1, 1]) b.zone({ type: 'soul', shape: 'rect', x: sx * 12, z: 0, w: 3, d: 10 });
    mc(b, 'netherBrick', 0, 0, 4, 1, 1.1);
    for (const z of [-14, 0, 14]) b.light(0, 3, z, '#fb923c', 1, 14);
  }, { floor: 'netherbrick', walls: 'netherbrick' }),

  n_spawner: lay('n_spawner', 'Blaze Spawner', 30, 30, (b) => {
    // raised platform around the spawner, stairs on each side
    mc(b, 'netherBrick', 0, 0, 8, 8, 1, { keep: true, vault: false });
    for (const [x, z] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) mc(b, 'netherBrick', x, z, 1, 1, 3.5, { y0: 1, vault: false });
    quadrant(b, (sx, sz) => lava(b, sx * 10.5, sz * 10.5, 3, 3));
    b.light(0, 3, 0, '#f97316', 1.6, 18);
  }, { floor: 'netherbrick', walls: 'netherbrick' }),

  n_bastion: lay('n_bastion', 'Bastion Remnant', 34, 34, (b) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mc(b, 'blackstone', sx * 8, sz * 8, 3, 1, 3, { hp: 90 });
      mc(b, 'blackstone', sx * 9.5, sz * 6.5, 1, 3, 3, { hp: 90 });
      if (b.rng() < 0.7) mc(b, 'goldBlock', sx * 9.5, sz * 9.5, 1, 1, 1, { hp: 40 });
    }
    lava(b, 0, -13, 6, 3);
    b.light(0, 4, 0, '#facc15', 1, 16);
  }, { floor: 'basalt', walls: 'netherbrick' }),

  n_trade: lay('n_trade', 'Piglin Trading Post', 24, 22, (b) => {
    mc(b, 'blackstone', 0, -7, 6, 1, 1.1, { hp: null });
    mc(b, 'goldBlock', -3.5, -8.5, 1, 1, 1, { hp: 40 }); mc(b, 'goldBlock', 3.5, -8.5, 1, 1, 1, { hp: 40 });
    b.light(0, 3, -6, '#facc15', 1.3, 12);
  }, { floor: 'netherrack', walls: 'netherbrick', small: true }),

  // ------------------------------------------------------------------ the stronghold
  stronghold: lay('stronghold', 'Stronghold', 30, 36, (b) => {
    for (const sx of [-1, 1]) for (const z of [-6, 2, 10]) mc(b, 'stoneBrick', sx * 8, z, 1.5, 1.5, 5, { vault: false });
    // library shelves
    for (const sx of [-1, 1]) b.box({ model: 'shelf', x: sx * 12.5, z: 6, w: 1, d: 8, h: 3, color: '#6b4f2a', vault: false, hp: 40 });
    // the End Portal room floor: a raised dais (frames and lava are placed by realms.js)
    mc(b, 'stoneBrick', 0, -12, 9, 7, 0.5, { keep: true, vault: false });
    mc(b, 'stoneBrick', 0, -7.9, 4, 1.2, 0.25, { keep: true });
    b.light(0, 3, -12, '#a3e635', 0.8, 14);
    b.light(0, 3, 6, '#fbbf24', 0.9, 16);
  }, { floor: 'stonebrick', walls: 'stonebrick' }),

  // ------------------------------------------------------------------ the End
  end_island: lay('end_island', 'The End', 64, 64, (b) => {
    // obsidian pillars ring (End Crystals are placed on top by realms.js)
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const h = 8 + (i * 5) % 9;
      mc(b, 'obsidian', Math.round(Math.sin(a) * 21), Math.round(Math.cos(a) * 21), 3, 3, h, { vault: false, keep: true, noSmash: true, pillar: i });
    }
    // the exit portal fountain (bedrock)
    mc(b, 'bedrock', 0, 0, 1, 1, 4, { keep: true, noSmash: true, vault: false });
    for (const [x, z] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5]]) mc(b, 'bedrock', x, z, 1, 1, 0.5, { keep: true, noSmash: true });
  }, { floor: 'endstone', walls: 'endvoid' }),
};

// Biome per Nether room type, for titles and spawns.
export const NETHER_BIOMES = {
  wastes: { layout: 'n_wastes', title: 'NETHER WASTES' },
  soul: { layout: 'n_soul', title: 'SOUL SAND VALLEY' },
  crimson: { layout: 'n_crimson', title: 'CRIMSON FOREST' },
  warped: { layout: 'n_warped', title: 'WARPED FOREST' },
  basalt: { layout: 'n_basalt', title: 'BASALT DELTAS' },
  fortress: { layout: 'n_fortress', title: 'NETHER FORTRESS' },
  spawner: { layout: 'n_spawner', title: 'BLAZE SPAWNER' },
  bastion: { layout: 'n_bastion', title: 'BASTION REMNANT' },
  trade: { layout: 'n_trade', title: 'PIGLIN TRADING POST' },
};

// Spawn weights per biome (types from mc/mobs.js and the crossover Minecraft mobs).
export const REALM_SPAWNS = {
  wastes: { w: { piglin: 8, ghast: 3, magmaCube: 2, enderman: 1.2 }, caps: { ghast: 2, enderman: 1 } },
  soul: { w: { skeleton: 8, ghast: 4, enderman: 1 }, caps: { ghast: 2, enderman: 1 } },
  crimson: { w: { piglin: 6, piglinBrute: 2, magmaCube: 1.5 }, caps: { piglinBrute: 2 } },
  warped: { w: { enderman: 8, piglin: 1 }, caps: { enderman: 4 } },
  basalt: { w: { magmaCube: 8, ghast: 2 }, caps: { ghast: 1 } },
  fortress: { w: { blaze: 6, witherSkeleton: 5, magmaCube: 1.5, skeleton: 2 }, caps: { blaze: 4, witherSkeleton: 3 } },
  spawner: { w: { blaze: 7, witherSkeleton: 3 }, caps: { blaze: 4, witherSkeleton: 2 } },
  bastion: { w: { piglinBrute: 5, piglin: 3, magmaCube: 1 }, caps: { piglinBrute: 3 } },
  stronghold: { w: { silverfish: 8, zombie: 4, skeleton: 4, spider: 3, creeper: 2, enderman: 1.5 }, caps: { enderman: 1, creeper: 2 } },
};
const THREAT = { piglin: 1.5, piglinBrute: 3, ghast: 3, blaze: 2.5, magmaCube: 2, witherSkeleton: 3, silverfish: 0.5, spider: 1.5, enderman: 2.5, zombie: 1, skeleton: 1.5, creeper: 1.5 };

// Mobs for a realm room's threat budget (silverfish come in threes).
export function composeRealm(biome, budget, rng) {
  const S = REALM_SPAWNS[biome] || REALM_SPAWNS.wastes;
  const count = {}, list = [];
  let left = budget;
  for (let guard = 0; guard < 50; guard++) {
    const cost = (k) => THREAT[k] * (k === 'silverfish' ? 3 : 1);
    const opts = Object.entries(S.w).filter(([k]) => cost(k) <= left + 1e-6 && (S.caps[k] === undefined || (count[k] || 0) < S.caps[k]));
    if (!opts.length) break;
    const k = rng.weighted(opts);
    const n = k === 'silverfish' ? 3 : 1;
    for (let i = 0; i < n; i++) list.push(k);
    count[k] = (count[k] || 0) + n;
    left -= cost(k);
  }
  if (!list.length) list.push(Object.keys(S.w)[0]);
  return list;
}
export const realmThreat = (k) => THREAT[k] || 1;

// ------------------------------------------------------------------ realm maps
const DIRS = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };

// The Nether: arrival portal → wastes and biomes → fortress → blaze spawner, with a
// bastion and a piglin trading post off to the sides. Same room-def shape as floorgen.
export function generateNether(rng, budget = [8, 12]) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const cells = new Map(), rooms = [];
    const key = (x, y) => x + ',' + y;
    const add = (x, y, kind, biome, parent, dir) => {
      const B = NETHER_BIOMES[biome];
      const r = { id: rooms.length, gx: x, gy: y, kind, doors: {}, depth: parent ? parent.depth + 1 : 0, visited: false, seen: false, cleared: false, realm: 'nether', biome, layout: B ? B.layout : 'n_portal', title: B ? B.title : 'THE NETHER' };
      rooms.push(r); cells.set(key(x, y), r);
      if (parent) { parent.doors[dir] = r.id; r.doors[OPP[dir]] = parent.id; }
      return r;
    };
    const free = (r) => rng.shuffle(Object.keys(DIRS)).filter((d) => {
      const x = r.gx + DIRS[d][0], y = r.gy + DIRS[d][1];
      if (x < 0 || y < 0 || x > 10 || y > 10 || cells.has(key(x, y))) return false;
      return Object.values(DIRS).filter(([dx, dy]) => cells.has(key(x + dx, y + dy))).length === 1;
    });
    const start = add(5, 5, 'start', null, null);
    const mids = rng.shuffle(['soul', 'crimson', 'warped', 'basalt']).slice(0, 3);
    const chain = ['wastes', ...mids, 'fortress', 'spawner'];
    let cur = start, ok = true;
    const path = [];
    for (const biome of chain) {
      const ds = free(cur);
      if (!ds.length) { ok = false; break; }
      cur = add(cur.gx + DIRS[ds[0]][0], cur.gy + DIRS[ds[0]][1], 'combat', biome, cur, ds[0]);
      path.push(cur);
    }
    if (!ok) continue;
    const branch = (kind, biome, anchors) => {
      for (const a of rng.shuffle(anchors.slice())) { const ds = free(a); if (ds.length) return add(a.gx + DIRS[ds[0]][0], a.gy + DIRS[ds[0]][1], kind, biome, a, ds[0]); }
      return null;
    };
    if (!branch('combat', 'bastion', path.slice(1, 4))) continue;
    if (!branch('trade', 'trade', [start, ...path.slice(0, 3)])) continue;
    path.forEach((r, i) => { r.budget = Math.round((budget[0] + (budget[1] - budget[0]) * (i / (path.length - 1))) * 2) / 2; });
    for (const r of rooms) if (r.biome === 'bastion') r.budget = budget[1];
    return { realm: 'nether', rooms, startId: start.id, size: 11 };
  }
  throw new Error('nether generation failed');
}

export function generateEnd() {
  return { realm: 'end', rooms: [{ id: 0, gx: 5, gy: 5, kind: 'boss', doors: {}, depth: 0, visited: false, seen: true, cleared: false, realm: 'end', layout: 'end_island', title: 'THE END' }], startId: 0, size: 11 };
}

// A hidden stronghold off an ordinary fight on an Overworld floor. Eyes of Ender find it.
export function addStronghold(map, rng) {
  const cells = new Set(map.rooms.map((r) => r.gx + ',' + r.gy));
  const cands = [];
  for (const r of map.rooms) {
    if (r.kind !== 'combat' && r.kind !== 'side') continue;
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const x = r.gx + dx, y = r.gy + dy;
      if (x < 0 || y < 0 || x >= map.size || y >= map.size || cells.has(x + ',' + y)) continue;
      if (map.rooms.some((o) => (o.kind === 'boss' || o.kind === 'preboss') && Math.abs(o.gx - x) + Math.abs(o.gy - y) <= 1)) continue;
      cands.push([r, d, x, y]);
    }
  }
  if (!cands.length) return null;
  const [p, d, x, y] = rng.pick(cands);
  const s = { id: map.rooms.length, gx: x, gy: y, kind: 'combat', special: 'stronghold', biome: 'stronghold', doors: {}, depth: p.depth + 1, visited: false, seen: false, cleared: false, hidden: true, layout: 'stronghold', title: 'STRONGHOLD', budget: (p.budget || 6) + 2 };
  map.rooms.push(s);
  p.doors[d] = s.id; s.doors[OPP[d]] = p.id;
  return s;
}

// BFS through a floor map (hidden doors included) — the Eye of Ender's sense of direction.
export function pathTo(map, from, to) {
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const id = q.shift();
    if (id === to) break;
    for (const n of Object.values(map.rooms[id].doors)) if (!prev.has(n)) { prev.set(n, id); q.push(n); }
  }
  if (!prev.has(to)) return null;
  const path = [];
  for (let c = to; c != null; c = prev.get(c)) path.unshift(c);
  return path;
}
