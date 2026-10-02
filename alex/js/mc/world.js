// Minecraft in the 3D world: the inventory and XP, ore veins and trees that generate
// in rooms (and stay mined when you come back), mining with pickaxe tiers, drops from
// everything, XP orbs, crafting stations you place, torches, food and beds, Eyes of
// Ender, ruined portals, and building / lighting a Nether Portal.

import * as THREE from 'three';
import { G } from '../state.js';
import { MC, ORES, ORE_WEIGHTS, bestPick, rollDrops, dropTableFor, levelFromXp, xpForLevel, xpToNext, xpForKill, PORTAL_OBSIDIAN, mcInfo } from './data.js';
import { iconCanvas } from './icons.js';
import { blockMesh, blockMats } from './blocks.js';
import { hasCombat } from '../world/floorgen.js';

const cnt = (id) => G.run?.inv?.[id] || 0;
export { cnt as invCount };

// ---------------------------------------------------------------------------- inventory
export function mcInit(run) {
  run.inv = {};
  run.xp = 0;
  run.ench = {};
  run.mcHints = {};
}
export function addMat(id, n = 1, o = {}) {
  const run = G.run;
  if (!run || n <= 0 || !MC[id]) return;
  run.inv[id] = (run.inv[id] || 0) + n;
  run.stat('mcItems', n);
  if (/Ore$|^cobblestone$|^dirt$|^netherrack$|^obsidian$|^sand$|^gravel$/.test(id)) run.stat('blocksMined', n);
  if (!o.quiet) G.hud.mcPickup?.(id, n);
  if (id === 'dragonEgg') run.recomputeMods();
}
export function takeMat(id, n = 1) {
  const run = G.run;
  if (cnt(id) < n) return false;
  run.inv[id] -= n;
  if (run.inv[id] <= 0) delete run.inv[id];
  if (id === 'dragonEgg') run.recomputeMods();
  return true;
}
export function addXp(n) {
  const run = G.run;
  if (!run || n <= 0) return;
  const before = levelFromXp(run.xp).level;
  run.xp += n;
  const after = levelFromXp(run.xp).level;
  G.audio.sfx('orb', { gap: 0.04, p: 0.9 + Math.random() * 0.3 });
  if (after > before) {
    G.audio.sfx(after % 5 === 0 ? 'mcLevelBig' : 'mcLevel');
    G.hud.popup(`LEVEL ${after}`, '#80ff20', 0.9, true);
  }
}
export function spendLevels(n) {
  const run = G.run;
  const { level, into } = levelFromXp(run.xp);
  if (level < n) return false;
  const L = level - n;
  run.xp = xpForLevel(L) + Math.min(into, xpToNext(L) - 1);
  return true;
}

// ---------------------------------------------------------------------------- pickups
const spriteMats = new Map();
function spriteMat(id) {
  if (spriteMats.has(id)) return spriteMats.get(id);
  const t = new THREE.CanvasTexture(iconCanvas(id));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.2 });
  spriteMats.set(id, m);
  return m;
}
let orbMat = null;
function xpOrbMat() {
  if (orbMat) return orbMat;
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = ['......kkkk......', '....kkhhhhkk....', '...khhwwhhhhk...', '..khwwhhhhhhak..', '..khwhhhhhhhak..', '.khhhhhhhhhhaak.', '.khhhhhhhhhhaak.', '.khhhhhhhhhaaak.', '.khhhhhhhhaaaak.', '..khhhhhhaaaak..', '..khhhhaaaaaak..', '...kaaaaaaaak...', '....kkaaaakk....', '......kkkk......'];
  const pal = { k: '#2b5d00', h: '#d4ff4a', a: '#7ad100', w: '#ffffff' };
  px.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y + 1, 1, 1); } }));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  orbMat = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.2, depthWrite: false });
  return orbMat;
}
export function pickupMesh(kind, id) {
  if (kind === 'mat') { const s = new THREE.Sprite(spriteMat(id)); s.scale.setScalar(0.5); return s; }
  if (kind === 'xp') { const s = new THREE.Sprite(xpOrbMat()); s.scale.setScalar(0.3); return s; }
  return null;
}
export function dropMats(room, list, x, z) {
  for (const [id, n] of list) {
    // stacks drop as one item each (up to 3 sprites so piles look like piles)
    const parts = Math.min(3, n);
    let left = n;
    for (let i = 0; i < parts; i++) {
      const k = i === parts - 1 ? left : Math.ceil(n / parts);
      left -= k;
      room.addPickup('mat', x, z, k, false, id);
    }
  }
}
export function dropXp(room, total, x, z) {
  total = Math.round(total);
  // Minecraft orb sizes
  for (const s of [37, 17, 7, 3, 1]) while (total >= s && room.pickups.length < 260) { room.addPickup('xp', x, z, s); total -= s; }
}

// ---------------------------------------------------------------------------- drops
export function enemyDrops(room, e) {
  if (e.noDrop) return;
  const bonus = G.run.mods.mcLoot || 0;
  const table = e.pokemon ? dropTableFor('pokemon', e.type, e.pokemon.types?.[0]) : dropTableFor('enemy', e.type);
  dropMats(room, rollDrops(table, Math.random, bonus), e.pos.x, e.pos.z);
  dropXp(room, xpForKill(e.threat, e.boss), e.pos.x, e.pos.z);
}
export function propDrops(room, b) {
  if (b.data.mc || b.kind === 'block' || b.data.noDrops || b.kind === 'station') return;
  const model = b.data.model || 'box';
  const list = rollDrops(dropTableFor('prop', model), Math.random, G.run.mods.mcLoot || 0);
  dropMats(room, list, b.x, b.z);
}

// ---------------------------------------------------------------------------- mining
const TOOL_NAMES = ['your hand', 'a Wooden Pickaxe', 'a Stone Pickaxe', 'an Iron Pickaxe', 'a Diamond Pickaxe'];
export function mineDamage(room, b, dmg, src = {}) {
  const o = ORES[b.data.mc];
  if (!o) return dmg;
  if (src.explosion) { b._ok = b.data.mc !== 'obsidian'; return b.data.mc === 'obsidian' ? 0 : dmg * 2; }
  if (src.vehicle) { b._ok = true; return dmg; }
  if (src.hostile) { b._ok = true; return dmg * 0.5; }
  const pick = bestPick(G.run.inv);
  const ok = pick.tier >= o.tier;
  b._ok = ok;
  let k = (src.melee ? pick.mine : 0.5) * (G.run.mods.mineMul || 1);
  if (!ok) {
    k *= o.tier >= 4 ? 0.04 : 0.35;
    const key = 'tier' + o.tier;
    if (!G.run.mcHints[key] || G.time - G.run.mcHints[key] > 6) {
      G.run.mcHints[key] = G.time;
      G.hud.bubble(G.alex, `${o.name} needs ${TOOL_NAMES[o.tier]}${o.tier >= 4 ? '' : ' (or it drops nothing)'}`, '#e5e7eb', 1.8);
    }
  }
  if (o.soft) k *= 3;
  // little crack particles in the block's colour
  G.fx.burst(b.x, (b.y0 + b.y1) / 2, b.z, { n: 5, kind: 'debris', color: [o.c[0], o.c[1] || o.c[0]], speed: 3, up: 1, life: 0.4, size: 0.12 });
  G.audio.sfx('mcDig', { v: 0.6, gap: 0.05, p: 0.8 + Math.random() * 0.4 });
  return dmg * k;
}

export function blockBroken(room, b, opts = {}) {
  const key = b.data.mc;
  const o = ORES[key];
  if (b.data.gen) b.data.gen.gone = true;
  if (b.data.portalFrame) portalFrameBroken(room);
  if (!o) return;
  const cx = b.x, cz = b.z;
  if (b._ok !== false || opts.vehicle) {
    const fortune = /Ore$/.test(key) ? G.run.mods.mcFortune || 0 : 0;
    dropMats(room, rollDrops(o.drop, Math.random, fortune), cx, cz);
    if (o.xp) dropXp(room, o.xp + Math.floor(Math.random() * (o.xp + 1)), cx, cz);
  }
  G.fx.burst(cx, (b.y0 + b.y1) / 2, cz, { n: 18, kind: 'debris', color: [o.c[0], o.c[1] || o.c[0], '#222'], speed: 5, up: 1.2, life: 0.8, size: 0.16 });
  G.audio.sfx('mcBreak', { v: 0.7, gap: 0.03 });
  // a tree with no logs left loses its leaves over the next few seconds
  if (key === 'log' && b.data.tree) {
    const tree = b.data.tree;
    const logsLeft = room.world.blocks.some((x) => x.alive && x.data.tree === tree && x.data.mc === 'log');
    if (!logsLeft) {
      room.mcDecay = room.mcDecay || [];
      for (const x of room.world.blocks) if (x.alive && x.data.tree === tree && x.data.mc === 'leaves') room.mcDecay.push({ b: x, t: 0.4 + Math.random() * 2.6 });
    }
  }
}

// ---------------------------------------------------------------------------- placing blocks
export function placeBlock(room, key, x, z, y0 = 0, extra = {}) {
  const mesh = blockMesh(key);
  mesh.position.set(x, y0 + 0.5, z);
  room.group.add(mesh);
  const o = ORES[key];
  const b = room.world.add({ kind: 'mcblock', mc: key, x, z, w: 1, d: 1, h: 1, y0, hp: o ? o.hp : null, color: o?.c[0], vault: true, noSmash: key === 'obsidian' || extra.noSmash, ...extra });
  b.meshes = mesh;
  mesh.userData.block = b;
  return b;
}

function pickWeighted(rng, weights) {
  const entries = Object.entries(weights);
  let sum = 0;
  for (const [, w] of entries) sum += w;
  let r = rng() * sum;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

// World gen for a room, done once per room (def.mcGen) and replayed on revisits.
export function decorateRoom(room) {
  const def = room.def;
  const realm = def.realm || 'overworld';
  if (realm === 'end') return;
  const fight = hasCombat(def) || def.kind === 'start' || def.kind === 'treasure';
  if (!fight || def.special === 'stronghold') { restoreStations(room); return; }
  if (!def.mcGen) {
    const rng = room.rng.fork ? room.rng.fork() : room.rng;
    const gen = [];
    const avoid = [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 4 }];
    for (const d of room.doors) avoid.push({ x: d.x, z: d.z, r: 4.5 });
    const floor = Math.min(3, room.floor);
    const spot = () => {
      const p = room.world.openPoint(rng, avoid, 3, 0.3, 3.5);
      if (p) { p.x = Math.round(p.x); p.z = Math.round(p.z); avoid.push({ x: p.x, z: p.z, r: 3.2 }); }
      return p;
    };
    // trees: plenty on the surface, a few potted ones indoors
    const trees = realm === 'nether' ? 0 : def.kind === 'start' && floor === 1 ? 2 : floor === 1 ? rng.int(1, 3) : rng() < (floor === 2 ? 0.45 : 0.3) ? 1 : 0;
    for (let t = 0; t < trees; t++) {
      const p = spot();
      if (!p) continue;
      const id = 't' + t + '_' + def.id;
      const hgt = rng.int(3, 4);
      for (let k = 0; k < hgt; k++) gen.push({ o: 'log', x: p.x, z: p.z, y: k, tree: id });
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (dx || dz) gen.push({ o: 'leaves', x: p.x + dx, z: p.z + dz, y: hgt - 1, tree: id });
        if ((!dx || !dz) && rng() < 0.85) gen.push({ o: 'leaves', x: p.x + dx, z: p.z + dz, y: hgt, tree: id });
      }
    }
    // ore veins: a stone outcrop with one ore type running through it
    const veins = def.kind === 'start' ? (floor === 1 ? 1 : 0) : realm === 'nether' ? rng.int(2, 4) : floor === 1 ? rng.int(1, 2) : rng.int(1, 3);
    const W = ORE_WEIGHTS[realm === 'nether' ? 'nether' : floor];
    for (let v = 0; v < veins; v++) {
      const p = spot();
      if (!p) continue;
      const base = realm === 'nether' ? 'netherrack' : 'stone';
      let ore = pickWeighted(rng, W);
      if (ore === base) ore = pickWeighted(rng, W);
      const pile = ore === 'gravel' || ore === 'sand' || ore === 'soulSand' || ore === 'glowstone';
      const n = rng.int(4, 7);
      const cells = [[0, 0]];
      while (cells.length < n) { const [cx, cz] = rng.pick(cells); const q = [cx + rng.int(-1, 1), cz + rng.int(-1, 1)]; if (!cells.some((c) => c[0] === q[0] && c[1] === q[1])) cells.push(q); }
      cells.forEach(([dx, dz], i) => {
        const key = pile ? ore : (i === 0 || rng() < 0.45 ? ore : base);
        gen.push({ o: key, x: p.x + dx, z: p.z + dz, y: 0 });
        if (!pile && rng() < 0.3) gen.push({ o: rng() < 0.3 ? ore : base, x: p.x + dx, z: p.z + dz, y: 1 });
      });
    }
    def.mcGen = gen;
    // ruined portals: rarer on the surface, common deeper down
    if (realm === 'overworld' && def.kind !== 'start' && def.ruinedPortal === undefined) def.ruinedPortal = rng() < [0.07, 0.1, 0.14][floor - 1];
  }
  for (const g of def.mcGen) {
    if (g.gone) continue;
    const b = placeBlock(room, g.o, g.x, g.z, g.y, { tree: g.tree });
    b.data.gen = g;
  }
  if (def.ruinedPortal) addRuinedPortal(room);
  restoreStations(room);
  if (def.portal) buildPortalFrame(room, def.portal);
  room.world.buildNav();
}

// ---------------------------------------------------------------------------- stations
const STATION = {
  craftingTable: { name: 'Crafting Table', icon: '⚒', text: 'Craft with the full 3×3 grid.', tab: 'craft' },
  furnace: { name: 'Furnace', icon: '🔥', text: 'Smelt ores, sand and logs.', tab: 'furnace' },
  enchantingTable: { name: 'Enchanting Table', icon: '✨', text: 'Spend XP levels and lapis on enchantments.', tab: 'enchant' },
};
export function placeStation(room, type, x, z, save = true) {
  const S = STATION[type];
  const mesh = blockMesh(type);
  mesh.position.set(x, 0.5, z);
  room.group.add(mesh);
  const b = room.world.add({ kind: 'station', x, z, w: 1, d: 1, h: 1, vault: true, noSmash: true, model: type });
  b.meshes = mesh;
  let book = null;
  if (type === 'enchantingTable') {
    book = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.3), new THREE.MeshLambertMaterial({ color: '#8b4513', emissive: '#3b0764' }));
    book.position.set(x, 1.35, z);
    room.group.add(book);
    room.animators.push((t) => { book.position.y = 1.35 + Math.sin(t * 2) * 0.08; book.rotation.y = t * 0.7; });
  }
  if (type === 'furnace') {
    const l = new THREE.PointLight('#f97316', 0.8, 5, 2); l.position.set(x, 0.6, z); room.group.add(l);
  }
  room.addInteractable({
    x, z, r: 1.6, station: type,
    prompt: () => ({ title: `${S.icon} ${S.name}`, text: S.text, action: 'Use' }),
    use: () => G.pack?.open({ tab: S.tab, station: type }),
  });
  if (save) (room.def.stations = room.def.stations || []).push({ type, x, z });
  return b;
}
function restoreStations(room) {
  if (room._stationsRestored) return;
  room._stationsRestored = true;
  for (const s of room.def.stations || []) placeStation(room, s.type, s.x, s.z, false);
}
export function nearStation(type) {
  const room = G.room;
  if (!room) return false;
  return room.interactables.some((o) => o.station === type && Math.hypot(o.x - G.alex.pos.x, o.z - G.alex.pos.z) < 3.2);
}
// A free grid cell in front of Alex.
export function spotInFront(room, dist = 1.8, size = 1) {
  const a = G.alex;
  const tries = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI];
  for (const off of tries) {
    for (const dd of [dist, dist + 1, dist + 2]) {
      const yaw = a.yaw + off;
      const x = Math.round(a.pos.x + Math.sin(yaw) * dd), z = Math.round(a.pos.z + Math.cos(yaw) * dd);
      if (Math.abs(x) > room.L.w / 2 - 2 || Math.abs(z) > room.L.d / 2 - 2) continue;
      const blocked = room.world.near(x, z, size + 1, []).some((b) => b.alive && b.solid && !b.wall && b.y0 < 1.5 && b.containsXZ(x, z, size * 0.5 + 0.2)) || room.world.blocks.some((b) => b.wall && b.containsXZ(x, z, size * 0.5 + 0.3));
      if (!blocked) return { x, z };
    }
  }
  return null;
}
export function placeFromInventory(id) {
  const room = G.room;
  const it = MC[id];
  if (!room || !it?.place || cnt(id) < 1) return false;
  if (room.def.kind === 'gas' || room.def.kind === 'boss') { G.hud.popup('NOT HERE', '#ff4d6d', 1); return false; }
  const p = spotInFront(room);
  if (!p) { G.hud.popup('NO ROOM TO PLACE IT', '#ff4d6d', 1); return false; }
  takeMat(id, 1);
  placeStation(room, it.place, p.x, p.z);
  room.world.buildNav();
  G.audio.sfx('mcPlace');
  G.fx.burst(p.x, 0.6, p.z, { n: 12, kind: 'debris', color: ['#b8945f', '#6b4f2a'], speed: 3, life: 0.5, size: 0.12 });
  G.run.stat('stationsPlaced', 1);
  return true;
}

// ---------------------------------------------------------------------------- using items
export function useItem(id) {
  const it = MC[id];
  const run = G.run;
  if (!it || cnt(id) < 1) return false;
  if (it.food) {
    const a = G.alex;
    takeMat(id, 1);
    a.heal(it.food.heal);
    G.audio.sfx('mcEat');
    G.hud.bubble(a, '*munch munch*', '#fde68a', 0.8);
    if (it.food.hunger && Math.random() < it.food.hunger) {
      run.buffs.push({ id: 'hunger', roomsLeft: 1, mods: { moveMul: 0.9 } });
      run.recomputeMods();
      G.hud.popup('HUNGER (that was rotten flesh)', '#84cc16', 1.4);
    }
    return true;
  }
  if (it.place) return placeFromInventory(id);
  if (it.use === 'bed') {
    if (run.realm === 'nether' || run.realm === 'end') {
      takeMat(id, 1);
      G.hud.popup('INTENTIONAL GAME DESIGN', '#ff4d6d', 2.2);
      const a = G.alex;
      G.areas.circle({ x: a.pos.x, z: a.pos.z, r: 4.5, delay: 0.25, dmg: 30, ff: true, enemyDmg: 60, owner: 'hazard', style: 'fire', sound: 'boom', shake: 0.6, propDmg: 40 });
      return true;
    }
    if (G.room?.combatLive()) { G.hud.popup('YOU MAY NOT REST NOW; THERE ARE MONSTERS NEARBY', '#ff4d6d', 1.8); return false; }
    takeMat(id, 1);
    G.alex.heal(60);
    G.fx.flash(0.6, '#0b1020');
    G.hud.popup('YOU SLEPT. IT IS NOW MORNING (+60 HP)', '#fde68a', 1.8);
    run.stat('naps', 1);
    return true;
  }
  if (it.use === 'eye') return throwEye();
  return false;
}

// ---------------------------------------------------------------------------- Eye of Ender
export function throwEye() {
  const room = G.room, a = G.alex;
  if (!room || cnt('eyeOfEnder') < 1) return false;
  takeMat('eyeOfEnder', 1);
  const hint = G.realms?.strongholdHint?.() || { none: true };
  const sprite = new THREE.Sprite(spriteMat('eyeOfEnder'));
  sprite.scale.setScalar(0.5);
  sprite.position.set(a.pos.x, a.pos.y + 1.6, a.pos.z);
  room.group.add(sprite);
  let tx = a.pos.x + Math.sin(a.yaw) * 4, tz = a.pos.z + Math.cos(a.yaw) * 4;
  if (!hint.none) { const dx = hint.x - a.pos.x, dz = hint.z - a.pos.z, l = Math.hypot(dx, dz) || 1, d = Math.min(9, l); tx = a.pos.x + dx / l * d; tz = a.pos.z + dz / l * d; }
  (room.mcEyes = room.mcEyes || []).push({ sprite, t: 0, sx: a.pos.x, sz: a.pos.z, sy: a.pos.y + 1.6, tx, tz, hint });
  G.audio.sfx('teleport', { v: 0.4, p: 1.4 });
  G.run.stat('eyesThrown', 1);
  return true;
}
function updateEyes(room, dt) {
  if (!room.mcEyes?.length) return;
  room.mcEyes = room.mcEyes.filter((e) => {
    e.t += dt;
    const k = Math.min(1, e.t / 1.5);
    const ease = 1 - (1 - k) ** 2;
    const x = e.sx + (e.tx - e.sx) * ease, z = e.sz + (e.tz - e.sz) * ease;
    let y = e.sy + Math.sin(k * Math.PI * 0.5) * 2.4;
    if (e.t > 1.5) y = e.sy + 2.4 + Math.sin((e.t - 1.5) * 6) * 0.1;
    if (e.t > 2.1 && e.hint.dive) y -= (e.t - 2.1) * 9;
    e.sprite.position.set(x, y, z);
    if (Math.random() < 0.7) G.fx.burst(x, y, z, { n: 1, color: ['#a855f7', '#7ee0c8'], speed: 0.4, life: 0.6, size: 0.1, grav: 0 });
    if (e.t < 2.4) return true;
    room.group.remove(e.sprite);
    if (e.hint.none) { G.hud.bubble(G.alex, 'The eye drifts around. Wrong dimension.', '#a3e635', 1.8); room.addPickup('mat', x, z, 1, false, 'eyeOfEnder'); return false; }
    if (e.hint.dive) { G.realms.revealStronghold(); return false; }
    if (Math.random() < 0.2) {
      G.fx.burst(x, y, z, { n: 20, color: ['#a855f7', '#22c55e', '#ffffff'], speed: 4, life: 0.6 });
      G.audio.sfx('crack', { v: 0.6 });
      G.hud.bubble(G.alex, 'The eye shattered.', '#a3e635', 1.2);
    } else room.addPickup('mat', x, z, 1, false, 'eyeOfEnder');
    G.hud.bubble(G.alex, e.hint.text || 'It went that way.', '#a3e635', 1.8);
    return false;
  });
}

// ---------------------------------------------------------------------------- ruined portal
export function addRuinedPortal(room) {
  const def = room.def;
  if (!def.ruined) {
    const p = room.world.openPoint(room.rng, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 7 }, ...room.doors.map((d) => ({ x: d.x, z: d.z, r: 6 }))], 7, 0.3, 5);
    if (!p) { def.ruinedPortal = false; return; }
    const x0 = Math.round(p.x) - 2, z0 = Math.round(p.z);
    const cells = [];
    for (let i = 0; i < 6; i++) cells.push([x0 + i, 0]);
    for (let y = 1; y <= 3; y++) cells.push([x0, y]);
    cells.push([x0 + 5, 1]);
    const blocks = cells.filter(() => room.rng() > 0.25).map(([x, y]) => ({ o: 'obsidian', x, z: z0, y }));
    for (let i = 0; i < 6; i++) if (room.rng() < 0.6) blocks.push({ o: 'netherrack', x: x0 - 1 + room.rng.int(0, 7), z: z0 + room.rng.pick([-1, 1]), y: 0 });
    def.ruined = { blocks, chest: { x: x0 + 2.5, z: z0 + 2 }, looted: false };
  }
  for (const g of def.ruined.blocks) if (!g.gone) { const b = placeBlock(room, g.o, g.x, g.z, g.y); b.data.gen = g; }
  const c = def.ruined.chest;
  if (!def.ruined.looted) {
    const mesh = blockMesh('chest', 0.9, 0.8, 0.9);
    mesh.position.set(c.x, 0.4, c.z);
    room.group.add(mesh);
    const it = room.addInteractable({
      x: c.x, z: c.z, r: 1.6,
      prompt: () => ({ title: '📦 Ruined Portal Chest', text: 'Something from the Nether left this here.', action: 'Open' }),
      use: () => {
        def.ruined.looted = true;
        room.removeInteractable(it);
        room.group.remove(mesh);
        const r = Math.random;
        const loot = [['obsidian', 1 + Math.floor(r() * 3)], ['goldNugget', 3 + Math.floor(r() * 6)], ['goldIngot', 1 + Math.floor(r() * 3)]];
        if (r() < 0.5) loot.push(['flintAndSteel', 1]);
        if (r() < 0.4) loot.push(['flint', 1 + Math.floor(r() * 2)]);
        if (r() < 0.25) loot.push(['obsidian', 1]);
        dropMats(room, loot, c.x, c.z);
        if (r() < 0.15) G.run.grant('goldenApple');
        G.audio.sfx('mcChest');
        G.hud.popup('RUINED PORTAL LOOT', '#a855f7', 1.4);
      },
    });
  }
  if (!room._ruinedTitle) { room._ruinedTitle = true; G.hud.popup('A RUINED PORTAL IS HERE', '#a855f7', 1.6, true); }
}

// ---------------------------------------------------------------------------- Nether Portal
// The minimum frame: 4 wide × 5 tall without corners = 10 obsidian.
function frameCells() {
  const c = [[1, 0], [2, 0], [1, 4], [2, 4]];
  for (let y = 1; y <= 3; y++) c.push([0, y], [3, y]);
  return c;
}
let portalTexCanvas = null;
function portalTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 32;
  portalTexCanvas = c;
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  drawPortalTex(t, 0);
  return t;
}
function drawPortalTex(t, time) {
  const g = t.image.getContext('2d');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
    const v = Math.sin(x * 0.7 + time * 3 + Math.sin(y * 0.4 + time * 2) * 2) + Math.cos(y * 0.5 - time * 2.5);
    const k = (v + 2) / 4;
    g.fillStyle = `rgba(${120 + k * 80 | 0},${30 + k * 50 | 0},${200 + k * 55 | 0},${0.65 + k * 0.3})`;
    g.fillRect(x, y, 1, 1);
  }
  t.needsUpdate = true;
}
export function canBuildPortal() {
  const run = G.run, room = G.room;
  if (!room || run.realm !== 'overworld') return { ok: false, why: 'Portals can only be built in the Overworld.' };
  if (cnt('obsidian') < PORTAL_OBSIDIAN) return { ok: false, why: `Needs ${PORTAL_OBSIDIAN} obsidian (you have ${cnt('obsidian')}).` };
  if (room.combatLive()) return { ok: false, why: 'Clear the room first.' };
  if (['gas', 'boss', 'secret'].includes(room.def.kind) || room.def.special === 'stronghold') return { ok: false, why: 'Not in this room.' };
  if (room.def.portal) return { ok: false, why: 'This room already has a portal.' };
  return { ok: true };
}
export function buildNetherPortal() {
  const room = G.room, a = G.alex;
  const can = canBuildPortal();
  if (!can.ok) { G.hud.popup(can.why, '#ff4d6d', 1.4); return false; }
  // the frame stands across Alex's line of sight
  const axis = Math.abs(Math.sin(a.yaw)) > Math.abs(Math.cos(a.yaw)) ? 'z' : 'x';
  let best = null;
  for (const d of [4, 5, 6, 3]) {
    const cx = Math.round(a.pos.x + Math.sin(a.yaw) * d), cz = Math.round(a.pos.z + Math.cos(a.yaw) * d);
    if (Math.abs(cx) > room.L.w / 2 - 4 || Math.abs(cz) > room.L.d / 2 - 4) continue;
    const ok = !room.world.near(cx, cz, 4, []).some((b) => b.alive && b.solid && !b.wall && b.y0 < 4 && (axis === 'x' ? Math.abs(b.z - cz) < 1.2 && Math.abs(b.x - cx) < 3 : Math.abs(b.x - cx) < 1.2 && Math.abs(b.z - cz) < 3));
    if (ok) { best = { x: cx, z: cz }; break; }
  }
  if (!best) { G.hud.popup('NO ROOM FOR A PORTAL HERE — TRY THE MIDDLE OF THE ROOM', '#ff4d6d', 1.6); return false; }
  takeMat('obsidian', PORTAL_OBSIDIAN);
  room.def.portal = { x: best.x, z: best.z, axis, lit: false };
  buildPortalFrame(room, room.def.portal);
  room.world.buildNav();
  G.audio.sfx('mcPlace');
  G.hud.popup('NETHER PORTAL FRAME BUILT — light it with Flint and Steel', '#a855f7', 2);
  G.run.stat('portalsBuilt', 1);
  return true;
}
export function buildPortalFrame(room, P) {
  const ax = P.axis === 'x' ? [1, 0] : [0, 1];
  const cells = frameCells();
  room.portalBlocks = [];
  for (const [i, y] of cells) {
    const off = i - 1.5;
    const b = placeBlock(room, 'obsidian', P.x + ax[0] * off, P.z + ax[1] * off, y, { portalFrame: true, noSmash: true });
    room.portalBlocks.push(b);
  }
  const t = portalTexture();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  plane.position.set(P.x, 2.5, P.z);
  plane.rotation.y = P.axis === 'x' ? 0 : Math.PI / 2;
  plane.visible = !!P.lit;
  room.group.add(plane);
  const light = new THREE.PointLight('#a855f7', P.lit ? 2 : 0, 10, 1.6);
  light.position.set(P.x, 2.4, P.z);
  room.group.add(light);
  room.portal = { P, plane, light, tex: t, stand: 0 };
  const inter = room.addInteractable({
    x: P.x, z: P.z, r: 2.4,
    prompt: () => {
      if (!P.lit) return { title: '🟪 Nether Portal (unlit)', text: cnt('flintAndSteel') ? 'Strike the frame with Flint and Steel.' : 'You need Flint and Steel (iron ingot + flint).', action: cnt('flintAndSteel') ? 'Light it' : '—' };
      return { title: '🟪 Nether Portal', text: G.run.realm === 'nether' ? 'Back to the Overworld.' : 'Into the Nether. Stand in it, or step through.', action: 'Enter' };
    },
    use: () => {
      if (!P.lit) {
        if (!cnt('flintAndSteel')) { G.audio.sfx('deny'); return; }
        lightPortal(room);
        return;
      }
      G.realms?.travelThroughPortal(room);
    },
  });
  room.portal.inter = inter;
  room.animators.push((time, dt) => {
    if (!room.portal || !room.portal.P.lit) return;
    if (Math.floor(time * 10) !== Math.floor((time - dt) * 10)) drawPortalTex(t, time);
    if (Math.random() < dt * 20) G.fx.burst(P.x + (Math.random() - 0.5) * 2 * ax[0], 1 + Math.random() * 3, P.z + (Math.random() - 0.5) * 2 * ax[1], { n: 1, color: ['#a855f7', '#e9d5ff'], speed: 0.8, life: 0.8, size: 0.1, grav: -0.5 });
  });
}
export function lightPortal(room) {
  const p = room.portal;
  if (!p || p.P.lit) return;
  p.P.lit = true;
  p.plane.visible = true;
  p.light.intensity = 2;
  G.audio.sfx('mcIgnite');
  G.audio.sfx('mcPortal', { v: 0.7 });
  G.fx.burst(p.P.x, 2.5, p.P.z, { n: 40, color: ['#a855f7', '#f97316', '#ffffff'], speed: 5, life: 0.8 });
  G.hud.popup('THE PORTAL IS LIT', '#a855f7', 1.6);
  G.run.stat('portalsLit', 1);
}
function portalFrameBroken(room) {
  const p = room.portal;
  if (!p) return;
  room.group.remove(p.plane);
  p.light.intensity = 0;
  room.removeInteractable(p.inter);
  for (const b of room.portalBlocks || []) if (b.alive) { b.data.portalFrame = false; }
  room.def.portal = null;
  room.portal = null;
  G.hud.popup('THE PORTAL BROKE', '#a855f7', 1.2);
}
// Standing in a lit portal for a moment takes you through (with the purple wobble).
function updatePortal(room, dt) {
  const p = room.portal;
  if (!p || !p.P.lit) return;
  const a = G.alex;
  const along = p.P.axis === 'x' ? Math.abs(a.pos.x - p.P.x) : Math.abs(a.pos.z - p.P.z);
  const across = p.P.axis === 'x' ? Math.abs(a.pos.z - p.P.z) : Math.abs(a.pos.x - p.P.x);
  const inside = along < 1.05 && across < 0.7 && a.pos.y < 1.5;
  p.stand = inside ? p.stand + dt : Math.max(0, p.stand - dt * 2);
  document.body.classList.toggle('portal-wobble', p.stand > 0.1);
  if (p.stand > 1.4 && !G.run.transition) { p.stand = 0; document.body.classList.remove('portal-wobble'); G.realms?.travelThroughPortal(room); }
}

// ---------------------------------------------------------------------------- per-frame
let torchLight = null;
export function mcUpdate(room, dt) {
  if (room.mcDecay?.length) {
    room.mcDecay = room.mcDecay.filter((d) => {
      d.t -= dt;
      if (d.t > 0) return true;
      if (d.b.alive) { d.b._ok = true; room.destroyBlock(d.b, { decay: true }); }
      return false;
    });
  }
  updateEyes(room, dt);
  updatePortal(room, dt);
  // torches light the way
  const want = cnt('torch') > 0;
  if (want && !torchLight) { torchLight = new THREE.PointLight('#ffb35c', 0, 11, 1.7); G.scene.add(torchLight); }
  if (torchLight) {
    torchLight.intensity = want ? 1.6 + Math.sin(G.time * 13) * 0.08 + Math.sin(G.time * 7.3) * 0.06 : 0;
    torchLight.position.set(G.alex.pos.x, G.alex.pos.y + 2.3, G.alex.pos.z);
  }
}
export function mcLeaveRoom() { document.body.classList.remove('portal-wobble'); }
