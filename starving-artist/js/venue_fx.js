// Vista Venue dressing and systems: atmosphere (dust, ash, light shafts, paint),
// sketchbook pages, scripted set pieces, per-room ambience, and the auto-map.
import * as THREE from 'three';
import * as P from './props.js';
import { Motes, lightShaft, decal } from './fx3d.js';
import { mat } from './renderer.js';
import { canvas, toTex, rng } from './tex.js';
import { audio } from './audio.js';
import { S, neglect } from './state.js';
import { PAGES } from './story.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ atmosphere
export function addAtmosphere(game, V, k) {
  const world = V.world, n = neglect(S.cur);
  const cam = game.camera;
  const dust = new Motes(world.scene, { count: k >= 4 ? 60 : 130, color: k >= 5 ? 0xffb0a0 : 0xfff0d8, size: 0.035, radius: 10, y0: 0.2, y1: 5 });
  world.onUpdate((dt, t) => dust.update(dt, t, cam));
  if (k >= 4) {
    const ash = new Motes(world.scene, { count: 90, color: 0x2a2226, size: 0.03, radius: 9, y0: 0, y1: 5, fall: 0.35, drift: 0.25, kind: 'ash', opacity: 1 });
    world.onUpdate((dt, t) => ash.update(dt, t, cam));
  }
  // light shafts: skylight in the atrium, sun in the sunroom, pool lamps, stage spots
  const warm = [0xfff0d8, 0xfff0d8, 0xffd8c0, 0xe8b0c0, 0x9080b0, 0xb04040, 0x902020][Math.min(k, 6)];
  const shafts = [];
  const shaft = (i, j, w, h, color, op, y = 0, tilt = 0) => {
    const s = lightShaft(w, h, color, op);
    world.prop(s, i, j, { y, bake: false });
    s.rotation.z = tilt;
    shafts.push(s);
    return s;
  };
  shaft(29, 29, 2.6, 10, warm, k >= 4 ? 0.07 : 0.14, 0, 0.12);
  shaft(33, 32, 2.2, 10, warm, k >= 4 ? 0.06 : 0.12, 0, -0.1);
  shaft(31, 31, 3.2, 11, warm, k >= 4 ? 0.05 : 0.1, 0, 0.04);
  shaft(30, 8, 2.8, 7, 0xfff4e0, 0.12, 0, 0.18);
  shaft(33, 6, 2.2, 7, 0xfff4e0, 0.1, 0, -0.15);
  for (const [i, j] of [[39, 21], [46, 21], [53, 28], [46, 35], [39, 35]]) shaft(i, j, 1.4, 4, 0xcff4ff, k >= 4 ? 0.04 : 0.08);
  for (const [i, dx] of [[56, 0], [53, 0.5], [59, -0.5]]) shaft(i, 41, 1.6, 7, 0xff5050, 0.1, 0.8, dx * 0.2);
  shaft(54, 14, 3, 7, 0xffffff, 0.16);
  world.onUpdate((dt, t) => { for (let i = 0; i < shafts.length; i++) { const s = shafts[i]; s.userData.mat.uniforms.uOpacity.value = s.userData.base * (0.8 + 0.2 * Math.sin(t * 0.6 + i * 1.7)); } });

  // paint: pastel spatters near the easels early; later, black drips under the paintings
  const r = rng(k * 31 + 7);
  const pastel = [0xf09ab8, 0x8fc2f5, 0xf3d98a, 0x9ad8b0, 0xc8a8f0];
  const splat = (x, z, size, color) => { const d = decal('splat' + (1 + Math.floor(r() * 4)), size, color); d.position.set(x, 0.011 + r() * 0.002, z); d.rotation.z = r() * 6.28; world.scene.add(d); world.level.bakeObject(d); return d; };
  for (const def of V.canvasDefs.slice(0, Math.min(7, k + 1))) {
    const c = world.at(def.i, def.j, def.dx || 0, def.dz || 0);
    for (let i = 0; i < 4 + k; i++) splat(c.x + (r() - 0.5) * 3, c.z + (r() - 0.5) * 3, 0.3 + r() * 0.5, k >= 4 && r() < 0.6 ? 0x140c10 : pastel[Math.floor(r() * pastel.length)]);
  }
  if (k >= 3) {
    for (const [i, j, side] of [[29, 22, 'w'], [33, 22, 'e'], [29, 18, 'w'], [33, 18, 'e'], [26, 28, 'w'], [36, 28, 'e']]) {
      const w = world.wall(i, j, side, 1.35, 0.05);
      const d = decal('drip', 1.2, 0x140a0e, { wall: true });
      d.position.copy(w.pos); d.rotation.y = w.ry; world.scene.add(d); world.level.bakeObject(d);
    }
  }
  if (n.duty >= 2) for (let i = 0; i < 6; i++) splat(58 + r() * 12, 58 + r() * 12, 0.4, 0x5a4a2a);
}

// ------------------------------------------------------------------ sketchbook pages
function pageTex(seed) {
  const [c, g] = canvas(16, 20);
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 16, 20);
  g.fillStyle = 'rgba(90,120,170,.5)'; for (let y = 4; y < 20; y += 3) g.fillRect(0, y, 16, 1);
  const r = rng(seed);
  g.strokeStyle = '#2a2230'; g.beginPath(); g.moveTo(3, 6); for (let i = 0; i < 6; i++) g.lineTo(3 + r() * 10, 5 + r() * 12); g.stroke();
  g.fillStyle = '#efe6d2'; g.fillRect(14, 0, 2, 3); g.fillRect(0, 17, 3, 3);
  return toTex(c, { repeat: false });
}
export function addPages(game, V, k) {
  const world = V.world;
  PAGES.forEach((pg, idx) => {
    if (pg.k > k || S.cur.pages.includes(pg.id)) return;
    const [i, j, side] = pg.at;
    const paper = P.uniquePlane(0.3, 0.38, pageTex(idx + 3), { emissive: 0.55, side: THREE.DoubleSide });
    let pos;
    if (side) {
      const w = world.wall(i, j, side, 1.5, 0.03);
      paper.position.copy(w.pos); paper.rotation.y = w.ry; paper.rotation.z = (idx % 3 - 1) * 0.12;
      pos = w.pos.clone();
    } else {
      pos = world.at(i, j, (idx % 3 - 1) * 0.4, ((idx * 7) % 3 - 1) * 0.4);
      paper.position.set(pos.x, 0.02, pos.z); paper.rotation.x = -Math.PI / 2; paper.rotation.z = idx * 1.3;
      pos.y = 0.1;
    }
    world.scene.add(paper);
    // a faint glint so they can be found without a map
    const glint = P.billboard(makeGlint(), 0.22, 0.22, { emissive: 1 });
    glint.material.blending = THREE.AdditiveBlending; glint.material.transparent = true; glint.material.depthWrite = false;
    world.billboard(glint, pos.clone().setY(pos.y + 0.25));
    world.onUpdate((dt, t) => { glint.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(t * 2.2 + idx))); });
    const it = world.interact({ pos: pos.clone(), r: 0.55, reach: 2.2, prompt: 'Read the torn page', use: async () => {
      world.removeInteract(it); world.scene.remove(paper); world.scene.remove(glint);
      await game.takePage(pg.id);
    } });
  });
}
let glintTex = null;
function makeGlint() {
  if (glintTex) return glintTex;
  const [c, g] = canvas(8, 8);
  g.fillStyle = '#fff'; g.fillRect(3, 0, 2, 8); g.fillRect(0, 3, 8, 2); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(2, 2, 4, 4);
  glintTex = toTex(c, { repeat: false });
  return glintTex;
}

// ------------------------------------------------------------------ set pieces
export function addSetPieces(game, V, k) {
  const world = V.world;
  const blackout = async (ms = 900) => {
    audio.play('lightsOut');
    const prev = game.fx.fade;
    game.fadeColor.set(0x000000);
    game.fx.fade = 0.93;
    await wait(ms);
    game.fx.fade = 0.5; await wait(80); game.fx.fade = 0.93; await wait(140);
    game.fx.fade = prev;
  };
  if (k === 1) {
    world.trigger({ pos: world.at(31, 20), r: 2, fn: async () => {
      await blackout(1100);
      audio.play('whisper', { vol: 1.2 });
      game.ui.subtitle('…natalee…', 2000);
    } });
  }
  if (k === 2) {
    // something long and dark glides under the water behind you
    const shape = P.box(0.7, 0.2, 3.2, 0x06080a);
    shape.visible = false; world.scene.add(shape);
    world.trigger({ pos: world.at(42, 27), r: 1.6, fn: () => {
      shape.visible = true; shape.position.set(96, -0.95, 50);
      audio.play('splash', { pos: shape.position });
      const t0 = world.t;
      const f = world.onUpdate(() => {
        const q = (world.t - t0) / 5;
        shape.position.set(96 - q * 14, -0.95 - q * 0.3, 50 + Math.sin(q * 4) * 1.5);
        shape.rotation.y = 0.3 + Math.sin(q * 4) * 0.2;
        if (q > 1) { shape.visible = false; world.updaters.splice(world.updaters.indexOf(f), 1); }
      });
      game.ui.subtitle('Something moved under the water.', 2600);
    } });
  }
  if (k === 3) {
    world.trigger({ pos: world.at(19, 31), r: 1.6, fn: async () => {
      audio.play('knock', { pos: world.at(13, 31).setY(1.5) });
      await wait(700);
      await blackout(600);
      audio.play('knock', { pos: world.at(13, 31).setY(1.5) });
      game.ui.subtitle('Someone at the end of the hall wants to be let in.', 2800);
    } });
  }
  if (k === 4) {
    // a covered painting slides off its easel: her own face, with the face scraped away
    const at = world.at(38, 47);
    world.trigger({ pos: world.at(35, 47), r: 2, fn: async () => {
      audio.play('crash', { pos: at.clone().setY(1) });
      game.pulse('shake', 0.08);
      const c = document.createElement('canvas'); c.width = 64; c.height = 80;
      const g = c.getContext('2d');
      g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, 64, 80);
      g.fillStyle = '#1a1418'; g.fillRect(12, 8, 40, 64); g.fillStyle = '#e8c0a0'; g.fillRect(20, 16, 24, 28);
      g.fillStyle = '#d8d0c4'; for (let i = 0; i < 40; i++) g.fillRect(20 + Math.random() * 24, 16 + Math.random() * 28, 3, 1);
      g.fillStyle = '#6a1018'; g.fillRect(20, 44, 24, 2);
      const f = P.frame(1.0, 1.25, toTex(c, { repeat: false }), { frameColor: 0x5a4a3a, emissiveAmt: 0.3 });
      f.position.set(at.x, 0.55, at.z); f.rotation.x = -1.2; f.rotation.y = 0.4;
      world.scene.add(f);
      const a = V.alien;
      if (a && a.mode === 'patrol') { a.mode = 'search'; a.searchT = 5; a.searchTarget = at.clone(); }
      game.ui.subtitle('It heard that too.', 2400);
    } });
  }
  if (k === 5) {
    V.onSecondInvite = () => {
      audio.play('clack');
      for (const m of V.audience) m.rotation.y = Math.atan2(game.player.pos.x - m.position.x, game.player.pos.z - m.position.z);
      game.pulse('glitch', 0.5);
      setTimeout(() => audio.play('clap'), 600);
      game.ui.subtitle('Every head in the room turns at once.', 2600);
    };
  }
}

// ------------------------------------------------------------------ per-room ambience
const ROOM = {
  a: { amb: ['wind'], rev: 1.1 }, h: { amb: ['room'], rev: 0.8 }, s: { amb: ['wind'], rev: 0.5 }, p: { amb: ['water', 'hum'], rev: 1.5 },
  c: { amb: ['room'], rev: 0.45 }, b: { amb: ['room'], rev: 0.4 }, e: { amb: ['hum'], rev: 0.3 }, x: { amb: ['hum', 'room'], rev: 0.9 },
  r: { amb: ['hum'], rev: 0.6 }, f: { amb: ['murmur', 'room'], rev: 1.3 }, g: { amb: ['murmur'], rev: 1.3 }, k: { amb: [], rev: 0.2 },
  v: { amb: ['wind'], rev: 1.8 }, w: { amb: ['room'], rev: 0.7 },
};
export function roomAudio(game, V) {
  const world = V.world;
  let cur = null, acc = 0;
  world.onUpdate((dt) => {
    acc += dt; if (acc < 0.4) return; acc = 0;
    const [i, j] = world.level.cellOf(game.player.pos.x, game.player.pos.z);
    if (!world.level.inside(i, j)) return;
    const reg = world.level.region[world.level.idx(i, j)];
    if (!reg || reg === cur) return;
    cur = reg;
    const R = ROOM[reg] || ROOM.a;
    audio.setAmbient(V.k >= 4 ? [...new Set([...R.amb, 'hum'])] : R.amb);
    audio.setReverb(R.rev);
  });
}

// ------------------------------------------------------------------ auto-map
export function trackVisited(game, V) {
  const world = V.world, L = world.level;
  const seen = new Set(S.cur.visited || []);
  V.seen = seen;
  let acc = 0;
  world.onUpdate((dt) => {
    acc += dt; if (acc < 0.25) return; acc = 0;
    const [ci, cj] = L.cellOf(game.player.pos.x, game.player.pos.z);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const i = ci + di, j = cj + dj;
      if (!L.inside(i, j) || Math.abs(di) + Math.abs(dj) > 3) continue;
      const id = L.idx(i, j);
      if (!seen.has(id) && L.trace((ci + 0.5) * L.cell, (cj + 0.5) * L.cell, (i + 0.5) * L.cell, (j + 0.5) * L.cell, (a, b) => L.blocksLight(a, b) && !(a === i && b === j))) { seen.add(id); S.cur.visited.push(id); }
    }
  });
}

const REGION_NAME = { a: 'ATRIUM', h: 'LONG HALL', s: 'SUNROOM', p: 'POOLS', c: 'WEST WING', b: '', x: 'ARCHIVE', r: '', f: 'THEATRE', g: 'STAGE', v: '', w: '' };
const REGION_INK = { a: '#e8c8d4', h: '#dcc8a8', s: '#c8e0b8', p: '#b8dce8', c: '#e0c8e0', b: '#e8d0e0', e: '#c8c0a8', x: '#bdb6aa', r: '#b8b0b4', f: '#d8b0b0', g: '#c8a090', k: '#999', v: '#aaa', w: '#f0f0f0' };
export function drawVenueMap(cv, V, player) {
  const g = cv.getContext('2d');
  const L = V.world.level, seen = V.seen || new Set();
  const x0 = 6, z0 = 1, x1 = 64, z1 = 58;
  const s = Math.min(cv.width / (x1 - x0), cv.height / (z1 - z0));
  const ox = (cv.width - (x1 - x0) * s) / 2, oz = (cv.height - (z1 - z0) * s) / 2;
  const X = (i) => ox + (i - x0) * s, Z = (j) => oz + (j - z0) * s;
  g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, cv.width, cv.height);
  const r = rng(3);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,90,60,${r() * 0.08})`; g.fillRect(r() * cv.width, r() * cv.height, 2, 2); }
  const open = (i, j) => L.inside(i, j) && (L.type[L.idx(i, j)] === 1 || L.type[L.idx(i, j)] === 3);
  const labels = {};
  for (const id of seen) {
    const i = id % L.w, j = Math.floor(id / L.w);
    if (!open(i, j)) continue;
    const reg = L.region[id];
    g.fillStyle = L.type[id] === 3 ? '#9cc8d8' : (REGION_INK[reg] || '#ddd');
    g.fillRect(X(i), Z(j), s + 0.5, s + 0.5);
    if (L.gate[id] && !L.openGates.has(L.gate[id])) { g.fillStyle = '#6a4a3a'; g.fillRect(X(i) + s * 0.2, Z(j) + s * 0.2, s * 0.6, s * 0.6); }
    (labels[reg] ||= []).push([i, j]);
  }
  g.strokeStyle = '#3a2a22'; g.lineWidth = 1.5;
  g.beginPath();
  for (const id of seen) {
    const i = id % L.w, j = Math.floor(id / L.w);
    if (!open(i, j)) continue;
    if (!open(i, j - 1)) { g.moveTo(X(i), Z(j)); g.lineTo(X(i + 1), Z(j)); }
    if (!open(i, j + 1)) { g.moveTo(X(i), Z(j + 1)); g.lineTo(X(i + 1), Z(j + 1)); }
    if (!open(i - 1, j)) { g.moveTo(X(i), Z(j)); g.lineTo(X(i), Z(j + 1)); }
    if (!open(i + 1, j)) { g.moveTo(X(i + 1), Z(j)); g.lineTo(X(i + 1), Z(j + 1)); }
  }
  g.stroke();
  g.font = 'italic 13px Georgia, serif'; g.fillStyle = '#4a3a30'; g.textAlign = 'center';
  for (const [reg, cells] of Object.entries(labels)) {
    if (cells.length < 5 || !REGION_NAME[reg]) continue;
    const cx = cells.reduce((a, c) => a + c[0], 0) / cells.length, cz = cells.reduce((a, c) => a + c[1], 0) / cells.length;
    g.fillText(REGION_NAME[reg], X(cx + 0.5), Z(cz + 0.5));
  }
  for (const pg of PAGES) if (S.cur.pages.includes(pg.id)) { g.fillStyle = '#3a6ab0'; g.font = 'bold 12px monospace'; g.fillText('✎', X(pg.at[0] + 0.5), Z(pg.at[1] + 0.9)); }
  const def = V.canvasDefs[V.k];
  if (def && V.blank) { g.fillStyle = '#c9a24a'; g.strokeStyle = '#3a2a22'; g.fillRect(X(def.i) + s * 0.1, Z(def.j) + s * 0.1, s * 0.8, s * 0.8); g.strokeRect(X(def.i) + s * 0.1, Z(def.j) + s * 0.1, s * 0.8, s * 0.8); }
  const px = X(player.pos.x / L.cell), pz = Z(player.pos.z / L.cell);
  g.save(); g.translate(px, pz); g.rotate(-player.yaw + Math.PI);
  g.fillStyle = '#b0405a'; g.beginPath(); g.moveTo(0, 7); g.lineTo(-4.5, -4); g.lineTo(4.5, -4); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#4a3a30'; g.font = 'italic 16px Georgia, serif'; g.textAlign = 'left'; g.fillText('The Vista Venue', 10, 20);
}
