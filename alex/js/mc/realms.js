// Travelling between worlds: Overworld ⇄ Nether through the portal you built, the
// stronghold an Eye of Ender finds on each floor, its End Portal (fill the frame with
// eyes), the End and the dragon, and back. Also the Nether's set pieces: a piglin who
// barters for gold, bastion treasure, and the blaze spawner in the fortress.

import * as THREE from 'three';
import { G } from '../state.js';
import { generateNether, generateEnd, addStronghold, pathTo, composeRealm, realmThreat } from './realmLayouts.js';
import { takeMat, invCount, dropMats } from './world.js';
import { blockMesh } from './blocks.js';
import { glow } from '../world/props.js';
import { MC_MODELS } from './mobs.js';
import { spawnDragon } from './dragon.js';
import { END_FRAME_SLOTS, prefilledEyes } from './data.js';
import { FLOOR_BUDGET } from '../config.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------- travel
function netherBudget(run) {
  const [a, b] = FLOOR_BUDGET[Math.min(2, run.floor - 1)];
  const k = (run.scale?.budget || 0);
  return [a + 3 + k, b + 3 + k];
}
export function travelThroughPortal(room) {
  const run = G.run;
  if (run.transition || G.mode !== 'run') return;
  if (run.realm === 'overworld') enterNether(room);
  else if (run.realm === 'nether') returnToOverworld();
}
function enterNether(room) {
  const run = G.run, P = room.def.portal;
  // come back out in front of the portal, on whichever side has more room
  const sgn = P ? (P.axis === 'x' ? (P.z > 0 ? -1 : 1) : (P.x > 0 ? -1 : 1)) : 1;
  run.overworld = { map: run.map, roomId: run.roomId, spawn: P ? { x: P.x + (P.axis === 'x' ? 0 : sgn * 4.5), z: P.z + (P.axis === 'x' ? sgn * 4.5 : 0), yaw: P.axis === 'x' ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? Math.PI / 2 : -Math.PI / 2) } : null };
  if (!run.netherMap) {
    run.netherMap = generateNether(run.rng.fork(), netherBudget(run));
    run.netherMap.rooms[run.netherMap.startId].portal = { x: 0, z: -8, axis: 'x', lit: true };
  }
  G.audio.sfx('mcPortal', { v: 0.8 });
  G.fx.flash(0.7, '#7c3aed');
  run.fade(() => {
    run.realm = 'nether';
    run.realmSalt = 7771;
    run.map = run.netherMap;
    run.spawnAt = { x: 0, z: -2, yaw: 0 };
    run.enterRoom(run.map.startId, null);
    G.audio.playMusic('nether', { restart: true });
    G.hud.roomTitle('THE NETHER', 'Find the fortress. Blazes drop blaze rods. Piglins trade for gold.');
    if (!run.stats.netherVisits) G.hud.popup('ADVANCEMENT: WE NEED TO GO DEEPER', '#a855f7', 2.4);
    run.stat('netherVisits', 1);
  });
}
export function returnToOverworld(opts = {}) {
  const run = G.run;
  const ow = run.overworld;
  if (!ow) return;
  G.audio.sfx(opts.fromEnd ? 'endPortal' : 'mcPortal', { v: 0.8 });
  G.fx.flash(0.7, opts.fromEnd ? '#ffffff' : '#7c3aed');
  run.fade(() => {
    run.realm = 'overworld';
    run.realmSalt = 0;
    run.map = ow.map;
    run.spawnAt = ow.spawn;
    run.overworld = null;
    run.enterRoom(ow.roomId, null);
    G.audio.playMusic('floor' + run.floor, { restart: true });
    G.hud.roomTitle('THE OVERWORLD', opts.fromEnd ? 'The End… for now.' : `Floor ${run.floor}`);
  });
}
function enterEnd(room) {
  const run = G.run;
  run.overworld = { map: run.map, roomId: run.roomId, spawn: { x: 0, z: -7, yaw: Math.PI } };
  G.audio.sfx('endPortal', { v: 0.9 });
  G.fx.flash(0.9, '#000000');
  run.fade(() => {
    run.realm = 'end';
    run.realmSalt = 9931;
    run.map = generateEnd();
    run.spawnAt = { x: 0, z: 27, yaw: Math.PI };
    run.enterRoom(0, null);
    if (!run.stats.endVisits) G.hud.popup('ADVANCEMENT: THE END?', '#e9d5ff', 2.4);
    run.stat('endVisits', 1);
  });
}

// ---------------------------------------------------------------------------- Eye of Ender
const sideXZ = (L, side) => side === 'N' ? [0, -L.d / 2 + 1] : side === 'S' ? [0, L.d / 2 - 1] : side === 'W' ? [-L.w / 2 + 1, 0] : [L.w / 2 - 1, 0];
export function strongholdHint() {
  const run = G.run, room = G.room;
  if (run.realm !== 'overworld' || !run.map) return { none: true };
  const s = run.map.rooms.find((r) => r.special === 'stronghold');
  if (!s) return { none: true };
  if (run.roomId === s.id) return { none: true, here: true };
  const path = pathTo(run.map, run.roomId, s.id);
  if (!path || path.length < 2) return { none: true };
  const cur = run.map.rooms[run.roomId];
  const side = Object.keys(cur.doors).find((d) => cur.doors[d] === path[1]);
  const [x, z] = sideXZ(room.L, side);
  if (path[1] === s.id && !s.revealed) return { x, z, dive: true };
  return { x, z, text: s.revealed && path[1] === s.id ? 'The stronghold is right through there.' : `It flew ${{ N: 'north', S: 'south', W: 'west', E: 'east' }[side]}. ${path.length - 1} room${path.length > 2 ? 's' : ''} away.` };
}
export function revealStronghold() {
  const run = G.run;
  const s = run.map.rooms.find((r) => r.special === 'stronghold');
  if (!s) return;
  s.revealed = true; s.seen = true;
  G.audio.sfx('endPortal', { v: 0.4 });
  G.cam.shake(0.4);
  G.hud.popup('THE EYE DIVES INTO THE GROUND — A STRONGHOLD IS BELOW', '#a3e635', 2.4);
  const a = G.alex;
  run.spawnAt = { x: a.pos.x, z: a.pos.z, yaw: a.yaw };
  setTimeout(() => run.fade(() => run.enterRoom(run.roomId, null)), 900);
}

// ---------------------------------------------------------------------------- room set pieces
export function setupRealmRoom(room) {
  const def = room.def;
  if (def.biome === 'trade') addBarterer(room);
  if (def.biome === 'bastion') addBastionChest(room);
  if (def.biome === 'spawner') addSpawner(room);
  if (def.special === 'stronghold') addEndPortalFrame(room);
}

// Piglin barterer: give gold, get a random thing (ender pearls included, like the real one).
const BARTER = [
  [['enderPearl', 2, 4], 18], [['obsidian', 1, 1], 9], [['string', 3, 9], 10], [['quartz', 5, 12], 10], [['leather', 2, 4], 8],
  [['soulSand', 2, 8], 6], [['gravel', 4, 12], 6], [['blazePowder', 1, 2], 5], [['flint', 1, 3], 6], [['ironIngot', 1, 3], 6],
  [['magmaCream', 1, 2], 4], [['glowstoneDust', 2, 5], 5], [['bread', 1, 2], 4], [['flintAndSteel', 1, 1], 3],
];
function addBarterer(room) {
  const x = 0, z = -5;
  const npc = MC_MODELS.piglin(false);
  npc.group.position.set(x, 0, z);
  npc.group.rotation.y = 0;
  room.group.add(npc.group);
  const fake = { pos: new THREE.Vector3(x, 0, z), vel: new THREE.Vector3(), pose: null, _dt: 0.016 };
  room.animators.push((t) => { npc.anim(fake); npc.group.rotation.y = Math.atan2(G.alex.pos.x - x, G.alex.pos.z - z); });
  G.hud.bubble({ pos: new THREE.Vector3(x, 0, z), height: 2.2, alive: true }, '*interested oink* (gold?)', '#fde047', 2.4);
  room.addInteractable({
    x, z, r: 2.2,
    prompt: () => ({ title: '🐷 Piglin Barterer', text: invCount('goldIngot') ? `Hand over a Gold Ingot for something random. (You have ${invCount('goldIngot')}.) Ender pearls are common.` : 'Piglins love gold ingots. Smelt raw gold or craft 9 nuggets into an ingot.', action: invCount('goldIngot') ? 'Barter 1 Gold Ingot' : '—' }),
    use: () => {
      if (!takeMat('goldIngot', 1)) { G.audio.sfx('deny'); G.hud.bubble({ pos: new THREE.Vector3(x, 0, z), height: 2.2, alive: true }, '*disappointed oink*', '#fde047', 1.2); return; }
      G.audio.sfx('mcPop');
      fake.pose = 'inspect';
      setTimeout(() => {
        if (G.room !== room) return;
        let tot = 0; for (const [, w] of BARTER) tot += w;
        let r = Math.random() * tot, pick = BARTER[0][0];
        for (const [o, w] of BARTER) { r -= w; if (r <= 0) { pick = o; break; } }
        const [id, a, b] = pick;
        const n = a + Math.floor(Math.random() * (b - a + 1));
        dropMats(room, [[id, n]], x, z + 1.5);
        G.hud.bubble({ pos: new THREE.Vector3(x, 0, z), height: 2.2, alive: true }, '*satisfied oink*', '#fde047', 1);
        G.run.stat('barters', 1);
      }, 900);
    },
  });
}

function addBastionChest(room) {
  const def = room.def;
  if (def.bastionLooted) return;
  const x = 0, z = 9;
  const mesh = blockMesh('chest', 0.9, 0.8, 0.9);
  mesh.position.set(x, 0.4, z);
  room.group.add(mesh);
  const it = room.addInteractable({
    x, z, r: 1.7,
    prompt: () => ({ title: '📦 Bastion Treasure', text: room.combatLive() ? 'Guarded. Deal with the brutes first.' : 'Piglin hoard.', action: room.combatLive() ? '—' : 'Open' }),
    use: () => {
      if (room.combatLive()) { G.audio.sfx('deny'); return; }
      def.bastionLooted = true;
      room.removeInteractable(it); room.group.remove(mesh);
      dropMats(room, [['goldIngot', 3 + Math.floor(Math.random() * 5)], ['enderPearl', 2 + Math.floor(Math.random() * 3)], ['obsidian', 1 + Math.floor(Math.random() * 3)], ['diamond', Math.random() < 0.5 ? 1 : 0], ['string', 4]].filter(([, n]) => n > 0), x, z);
      if (Math.random() < 0.4) G.run.grant('goldenApple');
      G.audio.sfx('mcChest');
      G.hud.popup('BASTION TREASURE', '#facc15', 1.4);
    },
  });
}

// Blaze spawner: a burning cage that keeps making blazes until you break it.
function addSpawner(room) {
  const def = room.def;
  if (def.spawnerBroken) return;
  const g = new THREE.Group();
  g.position.set(0, 1, 0);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshBasicMaterial({ color: '#3f3f46', wireframe: true }));
  cage.position.y = 0.6;
  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), glow('#f97316', 0.9));
  fire.position.y = 0.6;
  const light = new THREE.PointLight('#f97316', 2, 10, 1.6); light.position.y = 0.8;
  g.add(cage, fire, light);
  room.group.add(g);
  const b = room.world.add({ kind: 'spawner', x: 0, z: 0, w: 1.2, d: 1.2, h: 1.2, y0: 1, hp: 140, noSmash: true, model: 'spawner', noDrops: true });
  b.meshes = g;
  room.spawner = { b, g, fire, t: 4 };
  room.animators.push((t, dt) => {
    if (!room.spawner) return;
    cage.rotation.y = t * 0.6; fire.rotation.set(t * 2, t * 3, 0);
    if (!b.alive) {
      def.spawnerBroken = true; room.spawner = null;
      G.hud.popup('SPAWNER BROKEN', '#f97316', 1.4); G.run.stat('spawnersBroken', 1);
      G.fx.burst(0, 1.6, 0, { n: 40, color: ['#f97316', '#3f3f46', '#fde047'], speed: 8, life: 0.8 });
      return;
    }
    if (!room.combatLive() || G.mode !== 'run') return;
    room.spawner.t -= dt;
    const blazes = room.enemies.filter((e) => e.alive && e.type === 'blaze').length;
    if (room.spawner.t <= 0 && blazes < 4) {
      room.spawner.t = 7 + Math.random() * 3;
      const p = room.world.openPointNear(room.rng, 0, 0, 5, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 3 }]);
      if (p) { const e = room.spawnEnemy('blaze', p.x, p.z, { readyDelay: 0.8 }); if (e) { room.waveMembers?.push(e); G.fx.burst(p.x, 1.5, p.z, { n: 20, kind: 'smoke', color: '#3f3f46', speed: 3, life: 0.6, size: 0.4 }); } }
    }
  });
}

// The End Portal: twelve frames around a lava pit. Fill the empty ones with Eyes of Ender.
function addEndPortalFrame(room) {
  const def = room.def;
  if (!def.endFrame) {
    const n = prefilledEyes(room.rng);
    const filled = Array(END_FRAME_SLOTS).fill(false);
    for (const i of room.rng.shuffle([...Array(END_FRAME_SLOTS).keys()]).slice(0, n)) filled[i] = true;
    def.endFrame = { filled, active: false };
  }
  const F = def.endFrame;
  const cz = -12, y0 = 0.5;
  const slots = [];
  for (let i = -1; i <= 1; i++) slots.push([i, cz - 2], [i, cz + 2]);
  for (let j = -1; j <= 1; j++) slots.push([-2, cz + j], [2, cz + j]);
  const blocks = slots.map(([x, z], i) => {
    const mesh = blockMesh(F.filled[i] ? 'endFrameEye' : 'endFrame', 1, 0.8, 1);
    mesh.position.set(x, y0 + 0.4, z);
    room.group.add(mesh);
    const b = room.world.add({ kind: 'endframe', x, z, w: 1, d: 1, h: 0.8, y0, noSmash: true, keep: true });
    b.meshes = mesh;
    return { mesh, x, z, i };
  });
  // lava pit (or the activated starfield)
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: '#f97316' }));
  pit.rotation.x = -Math.PI / 2; pit.position.set(0, y0 + 0.02, cz);
  room.group.add(pit);
  const starCanvas = document.createElement('canvas'); starCanvas.width = starCanvas.height = 64;
  const sg = starCanvas.getContext('2d');
  const drawStars = (t) => {
    sg.fillStyle = '#05030a'; sg.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 70; i++) { const h = (i * 97 + Math.floor(t * 6) * (i % 3)) % 64; sg.fillStyle = ['#2dd4bf', '#a78bfa', '#e9d5ff', '#22d3ee'][i % 4]; sg.fillRect((i * 37) % 64, h, 1 + (i % 2), 1); }
  };
  drawStars(0);
  const starTex = new THREE.CanvasTexture(starCanvas); starTex.magFilter = THREE.NearestFilter;
  const setActive = () => { pit.material = new THREE.MeshBasicMaterial({ map: starTex }); };
  if (F.active) setActive();
  room.animators.push((t, dt) => { if (F.active && Math.floor(t * 8) !== Math.floor((t - dt) * 8)) { drawStars(t); starTex.needsUpdate = true; } });
  const count = () => F.filled.filter(Boolean).length;
  room.addInteractable({
    x: 0, z: cz + 2.6, r: 2.6,
    prompt: () => {
      if (F.active) return { title: '🌌 End Portal', text: 'Jump in. The dragon is waiting. (Bring food. And arrows. And friends.)', action: 'Jump in' };
      const n = count();
      return { title: `👁 End Portal Frame (${n}/${END_FRAME_SLOTS})`, text: invCount('eyeOfEnder') ? `Insert Eyes of Ender. You have ${invCount('eyeOfEnder')}, ${END_FRAME_SLOTS - n} needed.` : `${END_FRAME_SLOTS - n} more Eyes of Ender needed (ender pearl + blaze powder).`, action: invCount('eyeOfEnder') ? 'Insert eyes' : '—' };
    },
    use: () => {
      if (F.active) { if (room.combatLive()) { G.hud.popup('CLEAR THE STRONGHOLD FIRST', '#ff4d6d', 1.2); return; } enterEnd(room); return; }
      let put = 0;
      for (let i = 0; i < END_FRAME_SLOTS && invCount('eyeOfEnder') > 0; i++) {
        if (F.filled[i]) continue;
        takeMat('eyeOfEnder', 1);
        F.filled[i] = true; put++;
        const bk = blocks[i];
        bk.mesh.material = blockMesh('endFrameEye', 1, 0.8, 1).material;
        G.fx.burst(bk.x, y0 + 1, bk.z, { n: 10, color: ['#a3e635', '#2dd4bf'], speed: 3, life: 0.5 });
      }
      if (!put) { G.audio.sfx('deny'); return; }
      G.audio.sfx('eyeIn');
      G.run.stat('eyesPlaced', put);
      if (count() >= END_FRAME_SLOTS) {
        F.active = true;
        setActive();
        G.audio.sfx('endPortal');
        G.cam.shake(0.5);
        G.hud.popup('THE END PORTAL OPENS', '#2dd4bf', 2.4);
      } else G.hud.popup(`${END_FRAME_SLOTS - count()} MORE EYES NEEDED`, '#a3e635', 1.2, true);
    },
  });
}

// ---------------------------------------------------------------------------- the End
export function startDragonFight(room) { return spawnDragon(room); }
export function dragonDefeated(room) {
  const run = G.run;
  run.stat('dragonsSlain', 1);
  G.hud.hideBoss?.();
  G.audio.playMusic('end', { restart: true });
  G.hud.popup('THE ENDER DRAGON IS DEAD', '#e9d5ff', 3);
  setTimeout(() => G.hud.popup('ADVANCEMENT: FREE THE END', '#a855f7', 2.4), 3200);
  // the egg, and the exit portal lights up around the fountain
  setTimeout(() => {
    if (G.room !== room) return;
    room.addPickup('mat', 0, 2.2, 1, true, 'dragonEgg');
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 2.6, 32), new THREE.MeshBasicMaterial({ color: '#05030a', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.55;
    room.group.add(ring);
    const l = new THREE.PointLight('#e9d5ff', 2, 12, 1.5); l.position.y = 2; room.group.add(l);
    room.addInteractable({
      x: 0, z: 0, r: 3.2,
      prompt: () => ({ title: '🌌 Exit Portal', text: 'Back to the Overworld (and the concert).', action: 'Leave the End' }),
      use: () => endPoem(() => returnToOverworld({ fromEnd: true })),
    });
  }, 6500);
}

// The End Poem, short version.
function endPoem(done) {
  const prev = G.mode;
  G.mode = 'cutscene';
  G.input.releaseLock();
  const n = document.createElement('div');
  n.className = 'endpoem';
  const a = esc(G.alex?.name || 'Alex');
  n.innerHTML = `<div class="ep-crawl">
    <p class="g">I see the player you mean.</p>
    <p class="b">${a}?</p>
    <p class="g">Yes. Take care. It has reached a higher level now. It can read our thoughts.</p>
    <p class="b">It killed the dragon. It was supposed to be at a K-pop concert.</p>
    <p class="g">It is still at the K-pop concert. It always was. The concert is very large.</p>
    <p class="b">Its phone is ringing.</p>
    <p class="g">It will answer. Or it will not. Either way, someone will lose a heart.</p>
    <p class="b">And the universe said: you are not alone. You have a Pokémon, a crafting table, and a girlfriend who wants $40.</p>
    <p class="g">And the player woke, and went back to the show.</p>
  </div><button class="btn primary">Wake up</button>`;
  document.body.appendChild(n);
  G.audio.playMusic('end', { restart: true });
  const finish = () => { n.remove(); G.mode = prev === 'cutscene' ? 'run' : prev; G.input.clearBuffers(); if (!G.touch) G.input.requestLock(); done(); };
  n.querySelector('button').addEventListener('click', finish);
}

// ---------------------------------------------------------------------------- encounters
export function realmWaves(def, budget, rng) {
  const list = composeRealm(def.biome, budget, rng);
  // fortresses always have blazes (you need the rods)
  const want = def.biome === 'spawner' ? 2 : def.biome === 'fortress' ? 1 : 0;
  for (let n = list.filter((k) => k === 'blaze').length; n < want; n++) list.unshift('blaze');
  const half = Math.ceil(list.length * 0.55);
  const waves = [list.slice(0, half)];
  if (list.length > half) waves.push(list.slice(half));
  return waves;
}
export { realmThreat };

export function initRealms() {
  G.realms = { strongholdHint, revealStronghold, travelThroughPortal, returnToOverworld, setupRealmRoom, startDragonFight, dragonDefeated, realmWaves, addStronghold };
  return G.realms;
}
