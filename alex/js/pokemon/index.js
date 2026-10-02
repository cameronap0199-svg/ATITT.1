// Pokémon, for real, inside the run: Professor Oakley's starters, a party of six and
// Bill's PC, the Bag, a persistent Pokédex, tall grass with wild encounters and the
// turn-based battle screen, trainers who spot you, the Pokémon Center and Poké Mart at
// the gas station, EXP from every fight (real-time kills count too), level-ups, moves,
// evolutions, and your lead Pokémon following you around and fighting alongside you.

import * as THREE from 'three';
import { G } from '../state.js';
import { SPECIES, HABITATS, LEVEL_RANGE, STARTERS } from './dex.js';
import { makeMon, monName, maxHp, gainExp, healMon, evolutionFor, calcStats, expAt, curveOf } from './mon.js';
import { Battle, BAG_ITEMS } from './battle.js';
import { PokeScene } from './scenes.js';
import { Buddy, monBillboard } from './companion.js';
import { mat, glow } from '../world/props.js';
import { hasCombat } from '../world/floorgen.js';
import { MOVES } from './moves.js';

export const PARTY_MAX = 6;
const CROSS_TO_SPECIES = { pikachew: 'pikachew', gastlee: 'gastlee', magikrap: 'magikrap', gyarados: 'gyarados', snorelax: 'snorelax' };

// ---------------------------------------------------------------------------- dex (persistent)
function dex() { const d = G.codex?.data; if (!d) return { seen: {}, caught: {} }; d.dex = d.dex || { seen: {}, caught: {} }; return d.dex; }
export function dexSee(id) { const d = dex(); if (!d.seen[id]) { d.seen[id] = 1; G.codex.dirty = true; } }
export function dexCatch(id) { const d = dex(); dexSee(id); if (!d.caught[id]) { d.caught[id] = 1; G.codex.dirty = true; } }
export const dexCaught = (id) => !!dex().caught[id];
export const dexSeen = (id) => !!dex().seen[id];

// ---------------------------------------------------------------------------- party
export function pokeInit(run) {
  run.party = [];
  run.pc = [];
  run.bag = { pokeBall: 0, potion: 0 };
  run.pokeQueue = [];
  run.buddy = null;
}
export const lead = () => G.run?.party.find((m) => m.hp > 0) || null;
export function addCaught(mon, { quiet = false } = {}) {
  const run = G.run;
  mon.ot = mon.ot || 'Alex';
  dexCatch(mon.species);
  run.stat('pkCaught', 1);
  if (run.party.length < PARTY_MAX) { run.party.push(mon); refreshBuddy(); return 'party'; }
  run.pc.push(mon);
  if (!quiet) G.hud.popup(`${monName(mon)} was sent to Bill's PC.`, '#93c5fd', 1.6, true);
  return 'pc';
}
export function giveBag(id, n = 1) { const b = G.run.bag; b[id] = (b[id] || 0) + n; }

// The follower: the lead Pokémon, rebuilt when it changes.
export function refreshBuddy() {
  const run = G.run;
  if (!run || !G.room) return;
  const m = lead();
  const key = m ? m.uid + m.species + m.shiny : '';
  if (run.buddy && run.buddy.key === key) return;
  if (run.buddy) run.buddy.dispose();
  run.buddy = m ? new Buddy(m) : null;
  if (run.buddy) run.buddy.key = key;
}
export function dropBuddy() { if (G.run?.buddy) { G.run.buddy.dispose(); G.run.buddy = null; } }

// ---------------------------------------------------------------------------- EXP from the 3D fights
// Every demon, mob or boss defeated gives the lead Pokémon EXP (the Exp. Share splits it).
export function realtimeKill(e) {
  const run = G.run;
  if (!run.party.length) return;
  const floorK = 1 + (Math.min(3, run.floor) - 1) * 0.8 + (run.loop || 0) * 1.2 + (run.realm === 'nether' ? 1 : run.realm === 'end' ? 2 : 0);
  const amt = Math.max(1, Math.round((e.threat || 1) * 18 * floorK * (e.boss ? 6 : 1)));
  const share = run.items.includes('expShare');
  const l = lead();
  for (const m of run.party) {
    if (m.hp <= 0) continue;
    if (m !== l && !share) continue;
    exp(m, m === l ? amt : Math.ceil(amt * 0.5));
  }
}
function exp(mon, amt) {
  const evs = gainExp(mon, amt);
  for (const e of evs) {
    if (e.type === 'level') {
      G.hud.popup(`${monName(mon).toUpperCase()} grew to Lv. ${e.level}!`, '#fde047', 1.4, true);
      G.audio.sfx('pkLevel', { v: 0.7 });
      G.run.stat('pkLevels', 1);
    } else if (e.type === 'learned') G.hud.popup(`${monName(mon).toUpperCase()} learned ${MOVES[e.move].name.toUpperCase()}!`, '#fde68a', 1.4, true);
    else if (e.type === 'learnPrompt') G.run.pokeQueue.push({ type: 'learn', mon, move: e.move });
    else if (e.type === 'canEvolve' && !G.run.pokeQueue.some((q) => q.type === 'evolve' && q.mon === mon)) G.run.pokeQueue.push({ type: 'evolve', mon, to: e.to });
  }
}

// ---------------------------------------------------------------------------- scenes
let busy = false;
function enterMini(make) {
  const run = G.run;
  G.mode = 'minigame';
  G.input.releaseLock();
  document.getElementById('mini').classList.add('on');
  busy = true;
  G.minigame = make();
}
function exitMini() {
  G.minigame = null;
  busy = false;
  document.getElementById('mini').classList.remove('on');
  G.mode = 'run';
  const room = G.room;
  const song = room?.def.realm || (room?.def.kind === 'gas' ? 'shop' : 'floor' + G.run.floor);
  G.audio.playMusic(room?.bossInfo && !room.cleared ? (room.def.realm === 'end' ? 'dragon' : 'boss' + G.run.floor) : song, { restart: true });
  G.alex.spawnSafe(1.2);
  G.input.clearBuffers();
  if (!G.touch) G.input.requestLock();
  refreshBuddy();
}
export function playScenes(items, then) {
  if (!items.length) { then?.(); return; }
  enterMini(() => new PokeScene(items, () => { exitMini(); G.codex?.save(); then?.(); }));
}
// Evolutions and move prompts wait for a quiet moment (not mid-fight).
function flushQueue() {
  const run = G.run;
  if (!run.pokeQueue.length || busy || G.mode !== 'run' || run.transition || G.room?.combatLive() || G.phone?.busy()) return;
  const items = run.pokeQueue.splice(0);
  playScenes(items.filter((q) => q.type !== 'evolve' || evolutionFor(q.mon, {}) === q.to));
}

// ---------------------------------------------------------------------------- battles
function transition(then) {
  const n = document.createElement('div');
  n.className = 'pk-trans';
  document.body.appendChild(n);
  G.audio.sfx('pkEncounter');
  G.run.inputLocked = true;
  setTimeout(() => { n.remove(); G.run.inputLocked = false; then(); }, 1100);
}
function terrain() {
  const r = G.run, room = G.room;
  if (r.realm === 'nether') return 'nether';
  if (r.realm === 'end') return 'end';
  if (room?.def.special === 'stronghold') return 'cave';
  return r.floor === 1 ? 'grass' : r.floor === 2 ? 'night' : 'cave';
}
export function startBattle({ foes, trainer = null, onWin }) {
  if (busy || G.mode !== 'run') return;
  if (!lead()) return;
  busy = true;
  dropBuddy();
  transition(() => {
    enterMini(() => new Battle({
      foes, trainer, terrain: terrain(),
      onDone: (result, evolutions) => {
        G.run.stat(trainer ? 'pkTrainerBattles' : 'pkWildBattles', 1);
        if (result === 'win' && onWin) onWin();
        const evo = evolutions.filter((e) => evolutionFor(e.mon, {}) === e.to).map((e) => ({ type: 'evolve', mon: e.mon, to: e.to }));
        busy = false;
        if (evo.length) { G.minigame = null; playScenes(evo); } else exitMini();
        G.codex?.save();
      },
    }));
  });
}
function wildLevel() {
  const run = G.run;
  const key = run.realm !== 'overworld' ? run.realm : Math.min(3, run.floor);
  const [a, b] = LEVEL_RANGE[key] || LEVEL_RANGE[3];
  const k = (run.loop || 0) * 15;
  return Math.min(100, a + k + Math.floor(Math.random() * (b - a + 1)));
}
export function rollWild() {
  const run = G.run;
  const key = run.realm === 'nether' ? 'nether' : run.realm === 'end' ? 3 : Math.min(3, run.floor);
  const pool = HABITATS[key];
  let tot = 0;
  for (const id of pool) tot += SPECIES[id].rarity;
  let r = Math.random() * tot, pick = pool[0];
  for (const id of pool) { r -= SPECIES[id].rarity; if (r <= 0) { pick = id; break; } }
  let lv = wildLevel();
  // evolved forms show up a little higher
  if (SPECIES[pick].legendary) lv = Math.max(lv, 40 + (run.loop || 0) * 10);
  return makeMon(pick, lv);
}

// ---------------------------------------------------------------------------- tall grass
const bladeGeo = new THREE.ConeGeometry(0.09, 0.75, 4);
bladeGeo.translate(0, 0.37, 0);
bladeGeo.userData.shared = true;
const bladeMats = ['#3f9e3a', '#57b84a', '#2f7d2c'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
function grassPatches(room) {
  const def = room.def, run = G.run;
  if (def.grass === undefined) {
    let chance = 0.42;
    if (def.rift?.id === 'pokemon') chance = 1;
    if (run.realm === 'nether') chance = def.biome === 'crimson' || def.biome === 'warped' ? 0.6 : 0.2;
    if (run.realm === 'end' || def.kind === 'gas' || def.kind === 'boss' || def.kind === 'secret' || def.special) chance = 0;
    if (def.kind === 'start' && run.floor === 1 && run.realm === 'overworld') chance = 1;
    def.grass = [];
    if (Math.random() < chance) {
      const n = 1 + Math.floor(Math.random() * (def.rift?.id === 'pokemon' ? 3 : 2));
      const avoid = [...room.doors.map((d) => ({ x: d.x, z: d.z, r: 6 })), { x: G.alex.pos.x, z: G.alex.pos.z, r: 4 }];
      for (let i = 0; i < n; i++) {
        const p = room.world.openPoint(room.rng, avoid, 6, 0.3, 4);
        if (!p) continue;
        const r = 2.4 + Math.random() * 2.2;
        def.grass.push({ x: p.x, z: p.z, r });
        avoid.push({ x: p.x, z: p.z, r: r + 3 });
      }
    }
  }
  if (!def.grass.length) return;
  room.grass = def.grass;
  const root = new THREE.Group();
  for (const p of def.grass) {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), new THREE.MeshLambertMaterial({ color: run.realm === 'nether' ? '#7a1f2b' : '#2f6d2a' }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(p.x, 0.025, p.z);
    root.add(floor);
    const count = Math.floor(p.r * p.r * 7);
    for (const [mi, m] of bladeMats.entries()) {
      const inst = new THREE.InstancedMesh(bladeGeo, run.realm === 'nether' ? new THREE.MeshLambertMaterial({ color: ['#a12a3c', '#c2364b', '#7a1f2b'][mi] }) : m, Math.ceil(count / 3));
      const d = new THREE.Object3D();
      for (let i = 0; i < inst.count; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * p.r;
        d.position.set(p.x + Math.cos(a) * rr, 0, p.z + Math.sin(a) * rr);
        d.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
        d.scale.setScalar(0.8 + Math.random() * 0.6);
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      }
      root.add(inst);
    }
  }
  room.group.add(root);
  room.grassMesh = root;
  room.animators.push((t) => { root.rotation.z = Math.sin(t * 1.3) * 0.004; root.position.x = Math.sin(t * 1.7) * 0.02; });
}
function inGrass(room, x, z) { return room.grass?.some((p) => Math.hypot(p.x - x, p.z - z) < p.r); }

// ---------------------------------------------------------------------------- NPCs
function npcModel(colors) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.8, 4, 10), mat(colors.body));
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), mat('#f3cfae'));
  head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(colors.hair));
  hair.position.y = 1.66;
  g.add(body, head, hair);
  if (colors.cap) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14), mat(colors.cap)); c.position.y = 1.85; const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.3), mat(colors.cap)); brim.position.set(0, 1.8, 0.28); g.add(c, brim); }
  if (colors.coat) { const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 1.0, 12, 1, true), new THREE.MeshToonMaterial({ color: colors.coat, side: THREE.DoubleSide })); coat.position.y = 0.75; g.add(coat); }
  return g;
}
const lookAtAlex = (g, x, z) => { g.rotation.y = Math.atan2(G.alex.pos.x - x, G.alex.pos.z - z); };

// Professor Oakley and the three Poké Balls (floor 1 arrival, until you pick one).
function addOakley(room) {
  const run = G.run;
  if (run.flags.starter || run.party.length) return;
  const ox = -5, oz = -5;
  const prof = npcModel({ body: '#6b4f2a', hair: '#9ca3af', coat: '#f8fafc' });
  prof.position.set(ox, 0, oz);
  room.group.add(prof);
  room.animators.push(() => lookAtAlex(prof, ox, oz));
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1), mat('#a0732f'));
  table.position.set(ox + 3, 0.45, oz - 0.5);
  room.group.add(table);
  room.world.add({ kind: 'box', x: ox + 3, z: oz - 0.5, w: 3.2, d: 1, h: 0.9, noSmash: true });
  G.hud.bubble({ pos: new THREE.Vector3(ox, 0, oz), height: 2, alive: true }, 'Alex! Over here! Choose a Pokémon!', '#fde68a', 3);
  const balls = [];
  STARTERS.forEach((id, i) => {
    const bx = ox + 2 + i, bz = oz - 0.5;
    const ball = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glow('#ef4444', 1));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#f8fafc'));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 14), mat('#111827'));
    ball.add(top, bot, band);
    ball.position.set(bx, 1.12, bz);
    room.group.add(ball);
    const sp = SPECIES[id];
    const it = room.addInteractable({
      x: bx, z: bz + 0.8, r: 0.9,
      prompt: () => ({ title: `◓ ${sp.name}`, text: `The ${sp.types.map((t) => t[0].toUpperCase() + t.slice(1)).join('/')}-type Pokémon. ${['It has a strange seed on its back.', 'The flame on its tail shows its life force.', 'It shelters itself in its shell.'][i]} Choose it?`, action: `Choose ${sp.name}` }),
      use: () => {
        run.flags.starter = id;
        const mon = makeMon(id, 5, Math.random, { shiny: Math.random() < 1 / 64 });
        addCaught(mon, { quiet: true });
        giveBag('pokeBall', 5); giveBag('potion', 3);
        G.audio.sfx('pkCatch');
        G.hud.popup(`ALEX RECEIVED ${sp.name.toUpperCase()}!`, '#fde047', 2.2);
        G.hud.bubble({ pos: new THREE.Vector3(ox, 0, oz), height: 2, alive: true }, `${sp.name}! Fine choice. Here are 5 Poké Balls. Tall grass is where the wild ones live. Press ${G.input.glyph('pack')} for your party.`, '#fde68a', 5);
        for (const b of balls) { room.group.remove(b.ball); room.removeInteractable(b.it); }
        G.run.stat('starters', 1);
      },
    });
    balls.push({ ball, it });
  });
  room.animators.push((t) => balls.forEach((b, i) => { b.ball.rotation.y = t + i; b.ball.position.y = 1.12 + Math.abs(Math.sin(t * 2 + i)) * 0.04; }));
}

// Trainers: they stand around in cleared rooms, spot you, walk up and challenge you.
const TRAINERS = [
  { title: 'Youngster', names: ['Joey', 'Ben', 'Calvin'], pool: ['rattatat', 'pidgee', 'caterpeel', 'ekanz', 'bidoofus'], money: 16, colors: { body: '#2563eb', hair: '#3f2a1e', cap: '#f8fafc' }, hi: 'My Rattatat is in the top percentage of Rattatats!', lose: 'Wait, my Rattatat...' },
  { title: 'Bug Catcher', names: ['Rick', 'Doug', 'Sammy'], pool: ['caterpeel', 'metapud', 'weedlr', 'kakoona', 'butterfreak', 'beedrll', 'scythr'], money: 12, colors: { body: '#65a30d', hair: '#3f2a1e', cap: '#facc15' }, hi: 'I caught these at the concert merch stand!', lose: 'My bugs!' },
  { title: 'Lass', names: ['Haley', 'Robin', 'Dana'], pool: ['jigglypuffed', 'cleffairy', 'pikachew', 'togepie', 'meowf', 'raltz', 'eevie'], money: 20, colors: { body: '#db2777', hair: '#f59e0b' }, hi: 'You looked at me! That means we battle!', lose: 'Ugh, you\'re so mean.' },
  { title: 'Hiker', names: ['Russell', 'Lenny', 'Kenny'], pool: ['geodud', 'gravelord', 'onyx', 'machomp', 'sandschrew', 'cubonk', 'digglett'], money: 30, colors: { body: '#92400e', hair: '#111827', cap: '#a16207' }, hi: 'Hahahah! I hiked all the way through the parking lot!', lose: 'Hahahah! You got me!' },
  { title: 'Fisherman', names: ['Ralph', 'Wade', 'Andrew'], pool: ['magikrap', 'magikrap', 'magikrap', 'psyduct', 'polywag', 'tentakool', 'woopr'], money: 24, colors: { body: '#0e7490', hair: '#78350f', cap: '#facc15' }, hi: 'I\'ve been fishing in the venue fountain all day!', lose: 'Six Magikraps. Not one evolved.' },
  { title: 'Psychic', names: ['Mark', 'Sabrina-ish', 'Cameron'], pool: ['abrah', 'kadabruh', 'slowpok', 'raltz', 'kirlea', 'psyduct'], money: 28, colors: { body: '#7c3aed', hair: '#111827' }, hi: 'I knew you would come. I saw it in a fancam.', lose: 'I did not see that coming.' },
  { title: 'Super Nerd', names: ['Jovan', 'Glenn', 'Leslie'], pool: ['voltorbe', 'magnamite', 'coughing', 'electroad', 'magnetonne', 'dittoh', 'mareap'], money: 26, colors: { body: '#f8fafc', hair: '#1f2937' }, hi: 'Did you know K-pop lightsticks run on AAA batteries?', lose: 'My calculations...' },
  { title: 'Team Pocket Grunt', names: ['Grunt', 'Grunt', 'Grunt'], pool: ['ekanz', 'coughing', 'zoobat', 'meowf', 'golbatt', 'arbokz', 'wheezin', 'rattatat'], money: 34, colors: { body: '#111827', hair: '#111827', cap: '#111827' }, hi: 'Hand over your Pokémon! And your lightstick!', lose: 'Team Pocket is blasting off agaaain!' },
  { title: 'K-Pop Stan', names: ['Mina', 'Jae', 'Soo'], pool: ['jigglypuffed', 'mimikyou', 'cleffairy', 'togepie', 'wigglytough', 'gardevwar', 'ponytaH'], money: 32, colors: { body: '#ff4fa3', hair: '#7c3aed' }, hi: 'My bias would want me to battle you.', lose: 'This is so not slay.' },
  { title: 'Ace Trainer', names: ['Ayla', 'Jake', 'Kris'], pool: ['charmelon', 'wartortel', 'ivysore', 'growlith', 'dragonaire', 'gabight', 'lucarioh', 'arcanein', 'gyarados', 'scythr'], money: 48, colors: { body: '#0f766e', hair: '#78350f', cap: '#e11d48' }, hi: 'I trained all the way here. Show me what you\'ve got!', lose: 'You\'re the real deal.' },
];
function makeTrainer(room) {
  const run = G.run;
  const pool = run.floor >= 3 || run.realm !== 'overworld' ? TRAINERS : TRAINERS.filter((t) => t.title !== 'Ace Trainer');
  const T = room.rng.pick(pool);
  const n = run.floor === 1 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
  const foes = [];
  for (let i = 0; i < n; i++) {
    const id = room.rng.pick(T.pool);
    let lv = wildLevel() + (i === n - 1 ? 2 : 0);
    let sp = id;
    // trainers raise their Pokémon properly: evolve them if they're high enough
    for (let k = 0; k < 2; k++) { const e = SPECIES[sp].evo; const next = e && !Array.isArray(e) && e.lvl && lv >= e.lvl ? e.to : null; if (next) sp = next; }
    foes.push(makeMon(sp, Math.min(100, lv)));
  }
  return { title: T.title, name: room.rng.pick(T.names), foes, money: T.money * foes[foes.length - 1].level, hi: T.hi, lose: T.lose, colors: T.colors };
}
function addTrainer(room, force = false) {
  const def = room.def;
  if (def.trainer === undefined || force) {
    const ok = force || (hasCombat(def) && def.kind !== 'boss' && !def.special && Math.random() < (G.run.realm === 'overworld' ? 0.2 : 0.12));
    def.trainer = ok ? makeTrainer(room) : null;
    if (def.trainer) {
      const p = room.world.openPoint(room.rng, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 10 }, ...room.doors.map((d) => ({ x: d.x, z: d.z, r: 5 }))], 9, 0.3, 4);
      if (!p) def.trainer = null; else { def.trainer.x = p.x; def.trainer.z = p.z; }
    }
  }
  const T = def.trainer;
  if (!T || T.beaten) return;
  const npc = npcModel(T.colors);
  npc.position.set(T.x, 0, T.z);
  room.group.add(npc);
  const mon = monBillboard(T.foes[0].species, T.foes[0].shiny);
  mon.group.position.set(T.x + 1.1, 0, T.z + 0.4);
  room.group.add(mon.group);
  room.trainerNpc = { T, npc, mon, state: 'wait', t: 0 };
  room.animators.push((t, dt) => updateTrainer(room, dt));
}
function updateTrainer(room, dt) {
  const tr = room.trainerNpc;
  if (!tr || tr.T.beaten) return;
  const a = G.alex, T = tr.T;
  tr.npc.rotation.y = tr.state === 'wait' ? Math.sin(G.time * 0.5) * 1.2 : Math.atan2(a.pos.x - tr.npc.position.x, a.pos.z - tr.npc.position.z);
  if (G.mode !== 'run' || room.combatLive() || busy) return;
  const d = Math.hypot(a.pos.x - tr.npc.position.x, a.pos.z - tr.npc.position.z);
  if (tr.state === 'wait' && d < 8.5 && lead() && room.world.losClear(tr.npc.position.x, 1.5, tr.npc.position.z, a.pos.x, 1.2, a.pos.z)) {
    tr.state = 'spot'; tr.t = 0;
    G.hud.bubble({ pos: tr.npc.position.clone(), height: 2.2, alive: true }, '!', '#ef4444', 1);
    G.audio.sfx('offscreen', { v: 1 });
  }
  if (tr.state === 'spot') {
    tr.t += dt;
    if (tr.t > 0.7 && d > 2.2) { const dx = a.pos.x - tr.npc.position.x, dz = a.pos.z - tr.npc.position.z; tr.npc.position.x += dx / d * 6 * dt; tr.npc.position.z += dz / d * 6 * dt; tr.mon.group.position.set(tr.npc.position.x + 1, 0, tr.npc.position.z + 0.4); }
    if (tr.t > 0.7 && d <= 2.2) {
      tr.state = 'battle';
      G.hud.bubble({ pos: tr.npc.position.clone(), height: 2.2, alive: true }, T.hi, '#ffffff', 2.4);
      setTimeout(() => {
        if (G.room !== room) { tr.state = 'wait'; return; }
        for (const m of T.foes) { m.hp = maxHp(m); m.status = null; }
        startBattle({ foes: T.foes, trainer: T, onWin: () => { T.beaten = true; room.group.remove(tr.npc); room.group.remove(tr.mon.group); } });
        if (!lead()) tr.state = 'wait';
        setTimeout(() => { if (!T.beaten) tr.state = 'cool'; }, 2000);
      }, 1300);
    }
  }
  if (tr.state === 'cool' && d > 10) tr.state = 'wait';
}

// Pokémon Center + Poké Mart counter in the Gas Station.
function addCenter(room) {
  const x = -8.5, z = 7.5;
  const nurse = npcModel({ body: '#f9a8d4', hair: '#ec4899', coat: '#f8fafc' });
  nurse.position.set(x - 1.4, 0, z);
  room.group.add(nurse);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2.6), mat('#f8fafc'));
  desk.position.set(x - 0.4, 0.5, z);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.18, 2.62), glow('#ef4444', 1));
  stripe.position.set(x - 0.4, 0.82, z);
  room.group.add(desk, stripe);
  room.world.add({ kind: 'box', x: x - 0.4, z, w: 1, d: 2.6, h: 1, noSmash: true });
  room.animators.push(() => lookAtAlex(nurse, x - 1.4, z));
  room.addInteractable({
    x: x + 0.8, z: z - 0.6, r: 1.4,
    prompt: () => ({ title: '♥ Pokémon Center', text: G.run.party.length ? 'We heal your Pokémon to perfect health. Free, apparently.' : 'Welcome to our Pokémon Center! You don\'t have any Pokémon.', action: 'Heal Pokémon' }),
    use: () => {
      if (!G.run.party.length) { G.audio.sfx('deny'); return; }
      for (const m of [...G.run.party]) healMon(m);
      G.audio.sfx('pkHeal');
      G.hud.bubble({ pos: new THREE.Vector3(x - 1.4, 0, z), height: 2, alive: true }, 'We\'ve restored your Pokémon to full health. We hope to see you again!', '#f9a8d4', 3);
      G.run.stat('pkHeals', 1);
    },
  });
  room.addInteractable({
    x: x + 0.8, z: z + 0.9, r: 1.3,
    prompt: () => ({ title: '🛒 Poké Mart', text: 'Poké Balls, potions and evolution stones.', action: 'Shop' }),
    use: () => G.pack?.open({ tab: 'mart' }),
  });
}

// ---------------------------------------------------------------------------- per room
export function setupRoom(room) {
  const def = room.def, run = G.run;
  room.grass = null;
  if (def.kind === 'start' && run.floor === 1 && run.realm === 'overworld' && run.loop === 0) addOakley(room);
  if (def.kind === 'gas') addCenter(room);
  grassPatches(room);
  addTrainer(room);
  refreshBuddy();
}
export function updateRoom(room, dt) {
  const run = G.run;
  run.buddy?.alive && run.buddy.update(dt);
  flushQueue();
  // wild encounters in tall grass (not mid-fight)
  if (!room.grass || G.mode !== 'run' || busy || run.transition) return;
  const a = G.alex;
  if (!inGrass(room, a.pos.x, a.pos.z) || !a.grounded || a.vehicle || room.combatLive()) { room.grassStep = 0; return; }
  const sp = Math.hypot(a.vel.x, a.vel.z);
  if (sp < 1) return;
  if (Math.random() < dt * 10) G.fx.burst(a.pos.x, 0.4, a.pos.z, { n: 3, color: ['#4ade80', '#166534'], speed: 2, up: 1.5, life: 0.4, size: 0.12 });
  room.grassStep = (room.grassStep || 0) + sp * dt;
  if (room.grassStep < 1.1) return;
  room.grassStep = 0;
  if (Math.random() > 0.11) return;
  if (!lead()) {
    if (!room.oakWarned) { room.oakWarned = true; G.hud.bubble(a, 'PROF. OAKLEY (on the phone): Wait! It\'s unsafe! Wild Pokémon live in tall grass! You need your own Pokémon!', '#fde68a', 3.4); }
    return;
  }
  const wild = rollWild();
  dexSee(wild.species);
  startBattle({ foes: [wild] });
}
export function leaveRoom() { dropBuddy(); }

// ---------------------------------------------------------------------------- items outside battle
export function useBagItem(id, mon) {
  const run = G.run, it = BAG_ITEMS[id];
  if (!it || !(run.bag[id] > 0)) return { ok: false, msg: 'You don\'t have any.' };
  if (it.heal) {
    if (mon.hp <= 0) return { ok: false, msg: 'It won\'t have any effect. (Fainted — use a Revive.)' };
    if (mon.hp >= maxHp(mon)) return { ok: false, msg: 'It won\'t have any effect.' };
    run.bag[id]--; const from = mon.hp; mon.hp = Math.min(maxHp(mon), mon.hp + it.heal);
    G.audio.sfx('pkHeal');
    return { ok: true, msg: `${monName(mon)}'s HP was restored by ${mon.hp - from} point(s).` };
  }
  if (it.revive) {
    if (mon.hp > 0) return { ok: false, msg: 'It won\'t have any effect.' };
    run.bag[id]--; mon.hp = Math.floor(maxHp(mon) / 2); mon.status = null; G.audio.sfx('pkHeal'); refreshBuddy();
    return { ok: true, msg: `${monName(mon)} was revived!` };
  }
  if (it.candy) {
    if (mon.level >= 100) return { ok: false, msg: 'It won\'t have any effect.' };
    run.bag[id]--;
    const need = Math.max(1, expAt(mon.level + 1, curveOf(SPECIES[mon.species])) - mon.exp);
    exp(mon, need);
    return { ok: true, msg: `${monName(mon)} grew to Lv. ${mon.level}!`, scenes: true };
  }
  if (it.stone) {
    const to = evolutionFor(mon, { item: id });
    if (!to) return { ok: false, msg: 'It won\'t have any effect.' };
    run.bag[id]--;
    run.pokeQueue.push({ type: 'evolve', mon, to });
    return { ok: true, msg: `${monName(mon)} reacts to the ${it.name}!`, scenes: true };
  }
  return { ok: false, msg: 'Can\'t use that here.' };
}
// After using items from the Pack, play queued evolutions / move prompts right away.
export function runQueuedNow() {
  const run = G.run;
  if (!run.pokeQueue.length) return;
  const items = run.pokeQueue.splice(0);
  playScenes(items.filter((q) => q.type !== 'evolve' || q.to));
}

// Catching with the real-time Capture Ball: Pokémon rift critters become real party members.
export function catchRealtime(e) {
  const id = CROSS_TO_SPECIES[e.type];
  if (!id) return false;
  const lv = Math.max(2, wildLevel() + (e.elite ? 4 : 0));
  const mon = makeMon(id, lv, Math.random, { shiny: e.affix === 'shiny' });
  const where = addCaught(mon);
  G.hud.popup(`Gotcha! ${SPECIES[id].name.toUpperCase()} (Lv. ${lv}) was caught!${where === 'pc' ? ' (sent to the PC)' : ''}`, '#fde047', 2.2);
  return true;
}

export function initPokemon() {
  G.poke = { dexSee, dexCatch, dexCaught, dexSeen, addCaught, giveBag, lead, realtimeKill, setupRoom, updateRoom, leaveRoom, startBattle, rollWild, useBagItem, runQueuedNow, catchRealtime, refreshBuddy, playScenes, busy: () => busy, forceTrainer: () => addTrainer(G.room, true) };
  return G.poke;
}
export { calcStats };
