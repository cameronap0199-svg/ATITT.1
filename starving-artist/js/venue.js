// The Vista Venue: a dreamlike museum that is rebuilt every time Nate returns from a
// memory, reshaped by what she chose, painted and neglected.
import * as THREE from 'three';
import { GridBuilder, VOID } from './level.js';
import { World } from './world.js';
import * as P from './props.js';
import { tex, textTex, toTex } from './tex.js';
import { mat } from './renderer.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { renderComposition, newPaintCanvas } from './painting.js';
import { S, neglect, inspiration, alienStage, alienIntensity, counts } from './state.js';
import { CHAPTERS, FINAL_PAINT } from './story.js';
import { Alienate } from './alienate.js';
import { addAtmosphere, addPages, addSetPieces, roomAudio, trackVisited } from './venue_fx.js';
import { lightShaft } from './fx3d.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ layout
function layout() {
  const B = new GridBuilder(68, 60);
  // Atrium
  B.room(26, 26, 11, 11, 'a');
  // Long Hall + Sunroom (north)
  B.gateAt(30, 25, 3, 1, 'g1', 'h');
  B.room(29, 12, 5, 13, 'h');
  B.room(27, 4, 9, 8, 's');
  B.voidc(27, 3, 9, 1); B.voidc(26, 4, 1, 3); B.voidc(36, 4, 1, 3);
  // Pool rooms (east)
  B.gateAt(37, 30, 1, 3, 'g2', 'p');
  B.room(38, 20, 17, 17, 'p');
  B.water(40, 22, 13, 13, 'p');
  B.room(40, 31, 3, 1, 'p'); B.room(42, 24, 1, 8, 'p'); B.room(42, 24, 9, 1, 'p'); B.room(50, 24, 1, 6, 'p'); B.room(46, 29, 5, 1, 'p'); B.room(45, 28, 3, 3, 'p');
  for (const [x, z] of [[41, 26], [47, 33], [51, 32], [48, 26], [44, 22], [52, 22]]) B.wall(x, z, 1, 1, 'poolTile');
  // Bedroom wing (west)
  B.gateAt(25, 31, 1, 1, 'g3', 'c');
  B.room(13, 31, 12, 1, 'c');
  for (let n = 1; n <= 3; n++) { const x = 14 + (n - 1) * 4; B.gateAt(x + 1, 30, 1, 1, 'd' + n, 'b'); B.room(x, 27, 3, 3, 'b'); B.gateAt(x + 1, 26, 1, 1, 'k' + n, 'c'); }
  B.room(12, 25, 13, 1, 'c');
  // Elevator (top), elevator (bottom) — the ride teleports between them
  B.gateAt(11, 25, 1, 1, 'g4', 'e'); B.room(9, 24, 2, 2, 'e');
  B.room(21, 45, 2, 2, 'e'); B.gateAt(23, 46, 1, 1, 'g5', 'x');
  // Archive
  B.room(24, 42, 20, 15, 'x');
  const shelf = (x, z, w, h) => B.wall(x, z, w, h, 'shelf');
  shelf(26, 45, 6, 1); shelf(34, 45, 7, 1); shelf(27, 49, 7, 1); shelf(36, 49, 6, 1); shelf(25, 52, 6, 1); shelf(33, 52, 6, 1);
  shelf(28, 54, 8, 1); shelf(38, 54, 5, 1); shelf(37, 42, 1, 2); shelf(41, 46, 1, 2); shelf(31, 50, 1, 2);
  // Canvas room behind the archive
  B.gateAt(44, 48, 1, 1, 'g6', 'r'); B.room(45, 47, 4, 4, 'r');
  // Following Hall + stage
  B.gateAt(49, 48, 1, 1, 'g7', 'f');
  B.room(50, 40, 13, 17, 'f');
  B.room(52, 40, 9, 3, 'g');
  B.wall(50, 40, 2, 3); B.wall(61, 40, 2, 3);
  B.gateAt(56, 39, 1, 1, 'g8', 'g'); B.room(55, 37, 3, 2, 'k');
  // The void corridor and the white room
  for (let z = 1; z < 20; z++) for (let x = 38; x < 67; x++) if (B.type[B.idx(x, z)] !== 1) B.type[B.idx(x, z)] = VOID;
  B.room(41, 15, 3, 3, 'v'); B.room(42, 6, 1, 9, 'v'); B.room(42, 5, 13, 1, 'v'); B.room(54, 5, 1, 7, 'v');
  B.wall(50, 12, 10, 7); B.room(51, 13, 8, 5, 'w'); B.room(54, 12, 1, 1, 'w');
  return B;
}

const MOODS = [
  { sky: 'skyDay', fog: [0xf6e6ee, 14, 80], amb: 1.0, light: 1.0, desat: 0, tint: [1.03, 1, 1.04], corrupt: 0, bloom: 0.8 },
  { sky: 'skyDay', fog: [0xf2e2ea, 12, 70], amb: 0.95, light: 1.0, desat: 0, tint: [1.02, 1, 1.03], corrupt: 0.05, bloom: 0.8 },
  { sky: 'skyDusk', fog: [0xe0b8c4, 10, 60], amb: 0.8, light: 0.95, desat: 0.02, tint: [1.05, 0.98, 0.98], corrupt: 0.15, bloom: 0.7 },
  { sky: 'skyDusk', fog: [0x8a6a80, 8, 46], amb: 0.62, light: 0.85, desat: 0.1, tint: [1.04, 0.95, 1], corrupt: 0.3, bloom: 0.6 },
  { sky: 'skyNight', fog: [0x241c2c, 5, 34], amb: 0.42, light: 0.7, desat: 0.18, tint: [0.95, 0.95, 1.05], corrupt: 0.5, bloom: 0.5 },
  { sky: 'skyBlood', fog: [0x1a0808, 4, 28], amb: 0.32, light: 0.6, desat: 0.25, tint: [1.1, 0.9, 0.9], corrupt: 0.7, bloom: 0.5 },
  { sky: 'skyBlood', fog: [0x100406, 3, 24], amb: 0.26, light: 0.5, desat: 0.3, tint: [1.15, 0.85, 0.85], corrupt: 0.85, bloom: 0.5 },
];

function regions(k) {
  const m = MOODS[Math.min(k, 6)];
  const A = (r, g, b) => [r * m.amb, g * m.amb, b * m.amb];
  return {
    default: { floor: 'checkerPink', wall: 'marble', ceil: null, h: 9, ambient: A(0.55, 0.52, 0.6) },
    a: { floor: 'checkerPink', wall: 'marble', ceil: null, h: 9, ambient: A(0.46, 0.43, 0.5), surface: 'tile', floorScale: 4 },
    h: { floor: 'wood', wall: 'wallpaperCream', ceil: 'plaster', h: 5, ambient: A(0.32, 0.3, 0.32), surface: 'wood' },
    s: { floor: 'grass', wall: 'wallpaperBlue', ceil: null, h: 5, ambient: A(0.7, 0.72, 0.76), surface: 'grass', edge: 'plaster' },
    p: { floor: 'poolTile', wall: 'poolTile', ceil: 'whiteTile', h: 4, poolFloor: 'poolTileDark', ambient: A(0.6, 0.72, 0.76), surface: 'tile', waterColor: [0.85, 1, 1] },
    c: { floor: 'carpetKids', wall: 'wallpaperKids', ceil: 'plaster', h: 3, ambient: A(0.2, 0.18, 0.24), surface: 'carpet' },
    b: { floor: 'carpetKids', wall: 'wallpaperKids', ceil: 'plaster', h: 3, ambient: A(0.22, 0.2, 0.26), surface: 'carpet' },
    e: { floor: 'metal', wall: 'elevator', ceil: 'metal', h: 3, ambient: [0.3, 0.27, 0.2], surface: 'hard' },
    x: { floor: 'concrete', wall: 'concrete', ceil: 'concrete', h: 3.5, ambient: [0.09, 0.085, 0.1], surface: 'hard' },
    r: { floor: 'concrete', wall: 'plasterDark', ceil: 'plasterDark', h: 3.5, ambient: [0.08, 0.07, 0.09], surface: 'hard' },
    f: { floor: 'carpetRed', wall: 'woodDark', ceil: 'plasterDark', h: 7, ambient: [0.16, 0.08, 0.09], surface: 'carpet' },
    g: { floor: 'woodDark', wall: 'curtain', ceil: 'plasterDark', h: 7, floorY: 0.8, ambient: [0.12, 0.08, 0.07], surface: 'wood' },
    k: { floor: 'void', wall: 'void', ceil: 'void', h: 3, ambient: [0, 0, 0], surface: 'hard' },
    v: { floor: 'checkerBW', wall: 'void', ceil: null, h: 6, ambient: [0.34, 0.32, 0.38], surface: 'tile', edge: 'void' },
    w: { floor: 'whiteTile', wall: 'plaster', ceil: null, h: 6, ambient: [0.95, 0.93, 0.9], surface: 'tile' },
  };
}

function staticLights(k) {
  const m = MOODS[Math.min(k, 6)];
  const L = [];
  const add = (x, z, y, color, intensity, range) => L.push({ x: x * 2 + 1, z: z * 2 + 1, y, color, intensity: intensity * m.light, range });
  add(31, 31, 10, 0xfff0e0, 0.5, 24);
  add(28, 28, 4, 0xffd8e8, 0.35, 9); add(34, 28, 4, 0xd8e8ff, 0.35, 9); add(28, 34, 4, 0xd8e8ff, 0.35, 9); add(34, 34, 4, 0xffd8e8, 0.35, 9);
  for (const z of [23, 19, 15]) add(31, z, 4.3, 0xffe6c0, 0.95, 8);
  add(31, 8, 5, 0xffffff, 0.6, 16);
  for (const [x, z] of [[39, 21], [39, 35], [46, 21], [53, 21], [53, 35], [46, 35], [46, 29], [42, 28], [50, 26], [39, 28], [53, 28]]) add(x, z, 3.6, 0xcff4ff, 1.0, 9);
  for (const x of [15, 19, 23]) add(x, 28, 2.4, x === 19 ? 0xffb0d0 : 0xa0c0ff, 0.6, 6);
  add(18, 31, 2.6, 0xffe0b0, 0.35, 7); add(16, 25, 2.6, 0xffe0b0, 0.3, 7);
  add(9.5, 24.5, 2.8, 0xfff0c0, 0.8, 6); add(21.5, 45.5, 2.8, 0xfff0c0, 0.8, 6);
  add(46.5, 48.5, 3, 0xfff0e0, 0.45, 7);
  add(56, 41, 6, 0xff5050, 0.9, 14); add(53, 41, 5, 0xffc080, 0.5, 9); add(59, 41, 5, 0xffc080, 0.5, 9);
  add(56, 50, 6, 0x802020, 0.5, 14);
  add(42, 16, 5, 0xffffff, 0.3, 10); add(54.5, 15, 5, 0xffffff, 0.8, 16);
  return L;
}

// ------------------------------------------------------------------ helpers
function paintingSurface(comp) {
  const c = newPaintCanvas();
  renderComposition(c, comp || { blank: true, seed: 3 });
  const t = toTex(c, { repeat: false });
  return { c, t };
}

function decoyComp(seed) {
  const pool = ['tree', 'house', 'flower', 'sun', 'cloud', 'hill', 'dog', 'cat', 'lamp', 'bird', 'star', 'moon'];
  const r = (n) => { seed = (seed * 16807) % 2147483647; return (seed % 1000) / 1000 * n; };
  const items = [];
  for (let i = 0; i < 5; i++) items.push({ id: pool[Math.floor(r(pool.length))], x: 20 + r(150), y: 60 + r(80), s: 0.7 + r(0.8), flip: r(1) > 0.5 });
  return { bg: ['dawn', 'dusk', 'sea', 'home'][Math.floor(r(4))], items, strokes: [], seed, insp: [] };
}

function familyComp(bondNeglect) {
  const order = ['priya', 'dad', 'mom', 'teo'];
  const gone = order.slice(0, Math.max(0, bondNeglect - 1));
  const items = [['priya', 34], ['dad', 66], ['self', 96], ['mom', 126], ['teo', 156]].filter(([id]) => !gone.includes(id)).map(([id, x]) => ({ id, x, y: 128, s: id === 'teo' ? 1.3 : 1.5, flip: false }));
  return { bg: 'home', items, strokes: [], seed: 42, insp: [] };
}
function selfComp(k, dutyNeglect) {
  return { bg: 'mirror', items: [{ id: 'self', x: 96, y: 150, s: 3.1 - dutyNeglect * 0.12 }], strokes: [], seed: 77, insp: [], alien: { x: 124, y: 150, s: 1.9, behind: 0 } };
}

function gateMesh(world, id, color = 0xe8e0d6, texKey = 'wood') {
  const b = world.level.gateBounds(id);
  if (!b) return null;
  const reg = world.cfg.regions[b.region] || {};
  const h = reg.h || 3;
  const g = new THREE.Group();
  const w = Math.max(b.w, b.d);
  const panel = P.box(w - 0.04, h, 0.25, color, texKey);
  panel.position.y = h / 2;
  g.add(panel);
  const knob = P.sphere(0.07, 0xc9a24a, 5); knob.position.set(w / 2 - 0.3, 1.05, 0.15); g.add(knob);
  g.position.set(b.cx, 0, b.cz);
  if (b.d > b.w) g.rotation.y = Math.PI / 2;
  world.scene.add(g);
  world.level.bakeObject(g);
  g.userData.h = h;
  return g;
}

function openGateAnim(world, id, mesh, instant = false) {
  world.level.openGate(id);
  if (!mesh) return;
  if (instant) { mesh.visible = false; return; }
  audio.play('gate', { pos: mesh.position });
  const t0 = world.t;
  const f = world.onUpdate(() => {
    const k = Math.min(1, (world.t - t0) / 2.4);
    mesh.position.y = k * (mesh.userData.h + 0.2);
    if (k >= 1) { mesh.visible = false; world.updaters.splice(world.updaters.indexOf(f), 1); }
  });
}
function closeGateAnim(world, id, mesh) {
  world.level.closeGate(id);
  if (!mesh) return;
  mesh.visible = true; mesh.position.y = mesh.userData.h;
  audio.play('gate', { pos: mesh.position });
  const t0 = world.t;
  const f = world.onUpdate(() => {
    const k = Math.min(1, (world.t - t0) / 1.2);
    mesh.position.y = (1 - k) * mesh.userData.h;
    if (k >= 1) world.updaters.splice(world.updaters.indexOf(f), 1);
  });
}

function addHideSpot(world, game, i, j, side) {
  const w = world.wall(i, j, side, 0, 0.36);
  const ward = P.wardrobe();
  world.prop(ward, i, j, { pos: w.pos, y: 0, ry: w.ry, collide: 0.02 });
  const dir = new THREE.Vector3(Math.sin(w.ry), 0, Math.cos(w.ry));
  const front = w.pos.clone().addScaledVector(dir, 1.0); front.y = 0;
  const eye = w.pos.clone().addScaledVector(dir, 0.18); eye.y = 1.55;
  world.interact({
    pos: new THREE.Vector3(w.pos.x, 1.2, w.pos.z).addScaledVector(dir, 0.35), r: 0.8, prompt: 'Hide',
    use: () => {
      const p = game.player;
      p.hidden = { eye, yaw: w.ry + Math.PI, front };
      p.yaw = w.ry + Math.PI; p.pitch = 0;
      audio.play('door', { pos: eye });
      game.ui.setHiding(true);
    },
  });
  return front;
}

// ------------------------------------------------------------------ build
export function buildVenue(game, k, { title = false } = {}) {
  const st = S.cur;
  const n = neglect(st);
  const ins = inspiration(st);
  const stage = title ? 0 : alienStage(st);
  const mood = MOODS[Math.min(k, 6)];
  const regs = regions(k);
  const B = layout();
  const world = new World(game, { builder: B, regions: regs, lights: staticLights(k), sky: mood.sky, seed: 11 });
  const L = world.level;
  const V = { world, k, stage, paintings: [], gates: {}, canvases: {} };

  // ---------------- gates
  for (const id of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'd1', 'd2', 'd3', 'k1', 'k2', 'k3']) {
    const col = id.startsWith('d') ? 0xf6d6e6 : id.startsWith('k') ? 0xdcd0c0 : id === 'g4' || id === 'g5' ? 0xb8b0a0 : id === 'g8' ? 0xffffff : 0xf0e8ee;
    V.gates[id] = gateMesh(world, id, id === 'g1' || id === 'g2' || id === 'g3' ? 0xb08a9a : col, id === 'g4' || id === 'g5' ? 'elevator' : id === 'g8' ? null : 'wood');
  }
  const bed = st.flags.bedDoor || 2;
  const openNow = (id) => openGateAnim(world, id, V.gates[id], true);
  if (k >= 1) openNow('g1');
  if (k >= 2) openNow('g2');
  if (k >= 3) openNow('g3');
  if (k >= 4) { openNow('d' + bed); openNow('k' + bed); }
  if (k >= 5) { openNow('g6'); openNow('g5'); }
  if (k >= 6) openNow('g7');

  // ---------------- atrium
  const fnt = P.fountain(n.duty >= 3 ? 0x6a7a4a : n.duty >= 2 ? 0x8ab0a0 : n.duty >= 1 ? 0xa8d8e0 : 0x9fe0f5);
  world.prop(fnt, 31, 31, { dx: 1, dz: 1, collide: 0.1 });
  world.interact({ pos: new THREE.Vector3(64, 0.8, 64), r: 2.4, reach: 2.2, prompt: 'Look into the water', use: async () => {
    const lines = n.duty >= 3 ? ['The water is thick and green. Something at the bottom is wearing your old shoes.'] : n.duty >= 1 ? ['The water is cloudy. It used to be so clear.'] : ['Coins at the bottom. Every one of them a wish she made at nine years old.'];
    await game.think(lines[0]);
  } });
  for (const [i, j] of [[27, 27], [35, 27], [27, 35], [35, 35]]) world.prop(P.plant(Math.min(1, n.duty * 0.3)), i, j, { collide: 0.05 });
  world.prop(P.bench(), 28, 33, { ry: Math.PI / 2, collide: 0.02 });
  world.prop(P.bench(), 34, 33, { ry: -Math.PI / 2, collide: 0.02 });
  for (let i = 0; i < n.duty * 2; i++) world.prop(P.trashBag(), 27 + (i * 3) % 9, 29 + (i * 5) % 7, { dx: 0.4, collide: 0.02 });
  // EXIT door (painted on)
  const exit = P.doorMesh(1.6, 2.6, 0xf0e8ee); world.onWall(exit, 31, 36, 's', 0, { inset: 0.05 });
  world.onWall(P.uniquePlane(1.6, 0.4, textTex('EXIT', { w: 64, h: 16, color: '#c83040', bg: '#101010', size: 16 }), { emissive: 1 }), 31, 36, 's', 3.0, { inset: 0.05 });
  world.interact({ pos: world.wall(31, 36, 's', 1.2).pos, r: 1, prompt: 'Open the exit', use: async () => {
    audio.play('locked');
    await game.think(k < 3 ? 'The door is painted on. Beautifully, actually.' : k < 5 ? 'Painted on. Someone has scratched at it from this side. With fingernails.' : 'There was never a way out. Only through.');
  } });
  const say = (text, i, j, side, y, opts = {}) => world.onWall(P.uniquePlane(opts.w || 3.6, opts.h || 0.72, textTex(text, { w: 128, h: 26, color: opts.color || '#3a2a48', size: 18, italic: true }), { emissive: 1, transparent: true }), i, j, side, y, { inset: 0.04 });
  say('welcome back.', 28, 26, 'n', 4.6, { w: 7, h: 1.4 });
  if (n.duty >= 2) say('eat something.', 27, 31, 'w', 3.4, { color: '#8a2030' });
  if (n.bond >= 2) say('call your mother.', 35, 31, 'e', 3.4, { color: '#304888' });
  if (n.create >= 2) say('later. later. later.', 31, 36, 's', 5.5, { color: '#606060' });

  // Family portrait & self-portrait
  const fam = paintingSurface(null);
  renderComposition(fam.c, familyComp(n.bond), { faceless: n.bond >= 1, desat: n.bond * 0.12 }); fam.t.needsUpdate = true;
  const famF = P.frame(2.4, 1.8, fam.t, { frameColor: 0xc9a24a }); world.onWall(famF, 26, 28, 'w', 2.6);
  world.onWall(P.plaque(textTex('THE FAMILY', { w: 64, h: 16, color: '#e8d8a8', size: 14 })), 26, 28, 'w', 1.35);
  world.interact({ pos: world.wall(26, 28, 'w', 2.2).pos, r: 1.3, reach: 3.5, prompt: 'Look at the family portrait', use: async () => {
    const t = ['Mom, Dad, Teo, Priya. Everyone who ever loved her, in one frame.', 'Their faces have been rubbed out. Carefully. With a thumb.', 'Someone is missing from the portrait. There is a clean space where they stood.', 'There are fewer of them every time she looks.', 'It is just her now. And Teo, holding her hand. Teo is still holding on.'];
    await game.think(t[Math.min(4, n.bond)]);
  } });
  const selfP = paintingSurface(null);
  renderComposition(selfP.c, selfComp(k, n.duty), { alien: { stage: Math.max(0, stage - 1), creep: 0 }, desat: n.duty * 0.15, drips: n.duty >= 2 ? n.duty * 0.3 : 0 }); selfP.t.needsUpdate = true;
  world.onWall(P.frame(1.5, 1.9, selfP.t, { frameColor: 0x8a6a4a }), 36, 28, 'e', 2.6);
  world.onWall(P.plaque(textTex('NATALEE', { w: 64, h: 16, color: '#e8d8a8', size: 14 })), 36, 28, 'e', 1.35);
  world.interact({ pos: world.wall(36, 28, 'e', 2.2).pos, r: 1.2, reach: 3.5, prompt: 'Look at the self-portrait', use: async () => {
    const lines = [];
    lines.push(n.duty >= 2 ? 'She is thinner in this one. Her collarbones are painted very precisely.' : 'Her, at nineteen. Paint on her cheek. Grinning at something off-canvas.');
    if (stage >= 2) lines.push('There is someone behind her in the mirror. She does not remember painting them.');
    for (const l of lines) await game.think(l);
  } });

  // Ringing phone (bond neglect)
  if (n.bond >= 1) {
    const tbl = P.table(0.6, 0.6, 0xd8d0c8); world.prop(tbl, 34, 30, { collide: 0.02 });
    const ph = P.phone(false, 0xe86a7a); world.prop(ph, 34, 30, { y: 0.8 });
    const chair = P.chair(0xa0643c); world.prop(chair, 33, 30, { ry: Math.PI / 2, collide: 0.02 });
    let ringT = 3;
    world.onUpdate((dt) => { ringT -= dt; if (ringT <= 0) { ringT = 5 + Math.random() * 4; if (game.player.pos.distanceTo(ph.position) < 22) audio.play('phone', { pos: ph.position }); } });
    const vm = ['Voicemail: "Hi mija. Just calling. Call me back when you can. Love you."', 'Voicemail: "Natalee, it\'s Mom. Teo asked about you again. ...Call me."', 'Voicemail: "...It\'s Dad. Your mother\'s worried. I\'m— we\'re worried, kiddo."', 'Voicemail: (No one speaks. A TV in the background. Someone breathing. They hang up.)'];
    world.interact({ obj: ph, offsetY: 0.1, r: 0.6, prompt: 'Answer the phone', use: async () => { audio.play('click'); await game.think('Dial tone. Then:'); await game.think(vm[Math.min(3, n.bond - 1)]); } });
  }
  // Empty frames (create neglect)
  for (let i = 0; i < n.create * 2; i++) {
    const side = i % 2 ? 'n' : 's';
    world.onWall(P.frame(1.2, 1.5, tex('canvasBlank'), { frameColor: 0x888078, emissiveAmt: 0.2 }), 28 + i * 2, side === 'n' ? 26 : 36, side, 3.2 + (i % 3) * 1.2);
  }
  // The Following: mannequins who watch (inspiration)
  const watchers = [];
  const nMan = title ? 0 : Math.min(8, ins.following);
  for (let i = 0; i < nMan; i++) {
    const a = i / Math.max(1, nMan) * Math.PI * 1.6 + 0.8;
    const m = P.mannequin(0xe8e0d8);
    const pos = new THREE.Vector3(64 + Math.cos(a) * 7.5, 0, 64 + Math.sin(a) * 7.5);
    world.prop(m, 0, 0, { pos, ry: a + Math.PI, dynamic: true, collide: 0.05 });
    watchers.push(m);
  }
  // Eyes on the walls (inspiration)
  for (let i = 0; i < Math.min(14, ins.following * 2); i++) {
    const e = P.billboard('eye', 1.2, 0.6);
    const a = i * 2.39;
    world.billboard(e, new THREE.Vector3(64 + Math.cos(a) * 10.6, 3.5 + (i % 4) * 1.3, 64 + Math.sin(a) * 10.6));
  }
  // Clouds
  for (let i = 0; i < 7; i++) {
    const c = P.billboard('cloud', 5 + (i % 3) * 2, 2.6 + (i % 2));
    const base = new THREE.Vector3(56 + (i * 7) % 20, 11 + (i % 3) * 2.5, 54 + (i * 11) % 22);
    world.billboard(c, base.clone());
    world.onUpdate((dt, t) => { c.position.x = base.x + Math.sin(t * 0.05 + i) * 6; });
  }

  // ---------------- canvases (1..7)
  const CANVAS = [
    { i: 31, j: 33, dz: 0.8, ry: 0 },         // 1 atrium, facing south
    { i: 31, j: 6, ry: 0 },                    // 2 sunroom
    { i: 46, j: 29, ry: -Math.PI / 2 },        // 3 pool island (faces west)
    { i: 14 + (bed - 1) * 4 + 1, j: 28, ry: 0 }, // 4 bedroom
    { i: 46, j: 48, dx: 1, dz: 1, ry: -Math.PI / 2 }, // 5 canvas room
    { i: 56, j: 41, ry: 0, y: 0.8 },           // 6 stage
    { i: 54, j: 14, ry: 0 },                   // 7 white room
  ];
  V.canvasDefs = CANVAS;
  const records = st.records;
  for (let idx = 0; idx < 7; idx++) {
    const d = CANVAS[idx];
    if (idx < k) {
      const rec = records[idx];
      const surf = paintingSurface(rec?.comp);
      const easel = P.easel(surf.t, { w: 1.3, h: 0.98 });
      world.prop(easel, d.i, d.j, { dx: d.dx || 0, dz: d.dz || 0, ry: d.ry, y: d.y || 0, collide: 0.05 });
      const pnt = { idx, comp: rec?.comp || { blank: true, seed: idx + 3 }, ...surf, meshes: [easel.userData.canvas], creep: 0, hidden: idx === k - 1 && stage > 0, seen: false, away: 0, awayArmed: false };
      V.paintings.push(pnt);
      world.interact({ obj: easel.userData.canvas, r: 0.8, reach: 2.8, prompt: `Look at “${rec?.comp && !rec.comp.blank ? rec.comp.title : 'unfinished'}”`, use: () => lookAtPainting(game, V, pnt, rec) });
    } else if (idx === k && !title) {
      const easel = P.easel(tex('canvasBlank'), { w: 1.3, h: 0.98 });
      world.prop(easel, d.i, d.j, { dx: d.dx || 0, dz: d.dz || 0, ry: d.ry, y: d.y || 0, collide: 0.05 });
      easel.userData.canvas.material.uniforms.uEmissive.value = 0.74;
      V.blank = easel;
      const lp = easel.userData.canvas.getWorldPosition(new THREE.Vector3());
      const glow = world.addLight({ pos: lp.clone().add(new THREE.Vector3(0, 0.4, 0)), color: new THREE.Color(1, 0.95, 0.85), intensity: 0.9, range: 6 });
      const beam = lightShaft(1.3, 7, 0xfff4e0, 0.12);
      beam.position.set(lp.x, d.y || 0, lp.z); world.scene.add(beam);
      world.onUpdate((dt, t) => { glow.intensity = 0.7 + Math.sin(t * 2) * 0.25; easel.userData.canvas.material.uniforms.uAdd.value.setRGB(0.05 + Math.sin(t * 2) * 0.04, 0.045 + Math.sin(t * 2) * 0.035, 0.03 + Math.sin(t * 2) * 0.02); beam.userData.mat.uniforms.uOpacity.value = 0.09 + Math.sin(t * 2) * 0.03; });
    }
  }
  // The Long Hall collection: frames for all six memories
  const HALL = [[29, 22, 'w'], [33, 22, 'e'], [29, 18, 'w'], [33, 18, 'e'], [29, 14, 'w'], [33, 14, 'e']];
  HALL.forEach(([i, j, side], idx) => {
    const rec = records[idx];
    if (idx < k && rec) {
      const pnt = V.paintings.find((p) => p.idx === idx);
      const f = P.frame(2.0, 1.5, pnt.t, { frameColor: 0xc9a24a });
      world.onWall(f, i, j, side, 2.4);
      pnt.meshes.push(f.userData.pic);
      const title2 = rec.comp && !rec.comp.blank ? rec.comp.title : 'Untitled (unfinished)';
      world.onWall(P.plaque(textTex(`${idx + 1}. ${title2}`, { w: 128, h: 16, color: '#e8d8a8', size: 13 }), 1.0, 0.13), i, j, side, 1.35);
      world.interact({ obj: f.userData.pic, r: 1.0, reach: 3.2, prompt: `Look at “${title2}”`, use: () => lookAtPainting(game, V, pnt, rec) });
    } else {
      world.onWall(P.frame(2.0, 1.5, tex('canvasBlank'), { frameColor: 0x9a8a6a, emissiveAmt: 0.15 }), i, j, side, 2.4);
    }
  });
  say('you were happy here.', 31, 12, 'n', 3.2);
  // Sunroom decor
  world.prop(P.stairsToNowhere(7), 28, 9, { ry: Math.PI / 2, collide: 0.02 });
  world.prop(P.balloon(0xf6a6c1), 34, 9, {});
  world.prop(P.balloon(0x9ad0f5), 34, 8, { dx: 0.6 });
  world.prop(P.chair(0xf6d6e6), 29, 5, { ry: 0.4, collide: 0.02 });
  // Pools decor
  say('is this how you remember it?', 46, 20, 'n', 2.6, { color: '#305868' });
  world.prop(P.chair(0xffffff), 39, 21, { ry: Math.PI / 4 });
  const ball = P.sphere(0.35, 0xe8637a, 6, null, { emissive: 0.2 }); world.prop(ball, 44, 30, { y: -0.25 });
  world.onUpdate((dt, t) => { ball.position.y = -0.25 + Math.sin(t * 1.3) * 0.04; ball.position.x = 44 * 2 + 1 + Math.sin(t * 0.2) * 1.5; });
  // Bedrooms: doors with paintings above them
  for (let dn = 1; dn <= 3; dn++) {
    const x = 14 + (dn - 1) * 4;
    const mine = dn === bed;
    let t;
    if (mine) t = V.paintings.find((p) => p.idx === 2)?.t || tex('canvasBlank');
    else { const s = paintingSurface(decoyComp(dn * 977 + 13)); t = s.t; }
    const f = P.frame(0.9, 0.68, t, { frameColor: 0xf0d0e0, emissiveAmt: 0.6 });
    world.prop(f, x + 1, 31, { pos: new THREE.Vector3((x + 1.5) * 2, 2.55, 31 * 2 + 0.12), bake: false });
    world.prop(P.bed(dn === 2 ? 0x9ad0f5 : 0xe7a8c0), x, 27, { dx: 0.3, ry: Math.PI, collide: 0.02 });
    world.prop(P.teddy(!(n.bond >= 2 && mine)), x + 2, 27, { dx: -0.2, dz: -0.3, ry: 0.5 });
    world.prop(P.deskLamp(true), x + 2, 29, { dz: 0.5 });
    if (!mine && k === 3) {
      world.interact({ pos: new THREE.Vector3((x + 1.5) * 2, 1.2, 30 * 2 + 1.6), r: 0.9, prompt: 'Open the door', use: async () => {
        audio.play('locked');
        await wait(300); audio.play('knock', { pos: new THREE.Vector3((x + 1.5) * 2, 1.4, 28 * 2) });
        await game.think(['Not my room. I didn\'t paint that.', 'Something knocks back. From inside.', 'That isn\'t mine. Whoever lives there is waiting up.'][dn % 3]);
      } });
    }
    if (mine && k === 3) {
      V.bedInteract = world.interact({ pos: new THREE.Vector3((x + 1.5) * 2, 1.2, 30 * 2 + 1.6), r: 0.9, prompt: 'Open the door', use: async () => {
        openGateAnim(world, 'd' + dn, V.gates['d' + dn]);
        world.removeInteract(V.bedInteract);
        await game.think('This one is mine. I remember painting it.');
      } });
    }
  }
  say('go to sleep, natalee.', 18, 31, 's', 2.2, { color: '#6a4a8a' });
  // Elevator interiors
  for (const [i, j] of [[9, 24], [21, 45]]) world.prop(P.box(0.3, 0.5, 0.1, 0x333333, null, { emissive: 0.2 }), i, j, { pos: new THREE.Vector3((i + 1) * 2 + 1.9, 1.3, (j + 1) * 2 + 0.6) });
  // Archive
  say('who are you painting for?', 34, 42, 'n', 2.2, { color: '#9a8a7a' });
  for (const [i, j] of [[29, 43], [38, 47], [26, 50], [40, 51], [34, 55], [30, 47]]) world.prop(P.coveredPainting(), i, j, { ry: (i * j) % 3 - 1, collide: 0.05 });
  for (const [i, j] of [[25, 47], [42, 44], [35, 50], [28, 55]]) world.prop(P.crate(0.9), i, j, { collide: 0.02 });
  // Following Hall
  say('WE LOVE YOU NATE', 56, 56, 's', 4.2, { w: 5, h: 1, color: '#e8d0d0' });
  const curtain = P.curtain(18, 7);
  world.prop(curtain, 56, 43, { pos: new THREE.Vector3(57 * 2, 0, 43 * 2 + 0.1), bake: true });
  V.curtain = curtain;
  V.curtainCol = L.addCollider(52 * 2, 43 * 2 - 0.3, 61 * 2, 43 * 2 + 0.4);
  if (k >= 6) { curtain.position.y = 7.5; V.curtainCol.on = false; }
  const audience = [];
  for (const z of [46, 48, 50, 52, 54]) for (const x of [52, 54, 58, 60]) {
    const m = P.mannequin(0xd8d0c8);
    world.prop(m, x, z, { ry: Math.PI, dynamic: true, collide: 0.1 });
    m.userData.baseRy = Math.PI;
    audience.push(m);
  }
  V.audience = audience;
  V.watchers = watchers;
  // Void corridor paintings
  const VOIDF = [[40, 12, 1.2], [40, 8, 1.2], [45, 3, 0], [49, 3, 0], [56, 7, -1.2], [56, 10, -1.2]];
  V.voidFrames = [];
  VOIDF.forEach(([i, j, ry], idx) => {
    const pnt = V.paintings.find((p) => p.idx === idx);
    const f = P.frame(2.2, 1.65, pnt ? pnt.t : tex('canvasBlank'), { frameColor: 0xc9a24a, emissiveAmt: 0.8 });
    const pos = world.at(i, j); pos.y = 2.2;
    world.prop(f, i, j, { pos, y: 2.2, ry: ry || 0, bake: false });
    if (idx >= 2 && idx <= 3) f.rotation.y = 0;
    f.lookAt(new THREE.Vector3(i < 42 ? 85 : i > 54 ? 108 : pos.x, 2.2, j < 5 ? 11 : pos.z));
    V.voidFrames.push(f);
    world.onUpdate((dt, t) => { f.position.y = 2.2 + Math.sin(t * 0.7 + idx) * 0.15; });
  });
  // white room
  say('who are you when nobody is watching?', 54, 13, 'n', 3.5, { w: 5, h: 0.8, color: '#9a9aa8' });

  return V;
}

// ------------------------------------------------------------------ painting inspection & creep
async function lookAtPainting(game, V, pnt, rec) {
  const comp = pnt.comp;
  const lines = [];
  if (!rec || !comp || comp.blank) lines.push('Unfinished. Pencil lines, and the word "later."');
  else {
    const ids = comp.items.map((i) => i.id);
    lines.push(`“${comp.title}.” ${ids.length} ideas. She remembers placing every one.`);
  }
  if (V.stage >= 1 && !pnt.hidden) {
    const why = comp?.alien?.reason;
    if (V.k >= 4) lines.push('There is a hole in the canvas, shaped like someone tall. Whatever was in the painting has gotten out.');
    else if (why === 'empty') lines.push('It is standing in the space she left empty. She left it room.');
    else if (why === 'behind') lines.push('It is hiding behind something she placed. Right where the voice told her to put it.');
    else if (comp?.blank) lines.push('In all that white, a figure. The blank canvas was never empty.');
    else lines.push('A figure stands in the negative space. She didn\'t paint it. She is almost sure.');
  }
  if (rec?.neglected) lines.push(CHAPTERS[pnt.idx].journal.neglect[rec.neglected]);
  for (const l of lines) await game.think(l);
}

function renderPainting(V, pnt) {
  const n = neglect(S.cur);
  const torn = V.k >= 4 && V.stage >= 3;
  renderComposition(pnt.c, pnt.comp, {
    alien: { stage: pnt.hidden ? 0 : Math.min(3, V.stage), creep: pnt.creep },
    faceless: n.bond >= 2, desat: Math.min(0.6, n.create * 0.1 + n.duty * 0.06), drips: n.duty >= 3 ? 0.6 : 0, torn,
  });
  pnt.t.needsUpdate = true;
}

function paintingTick(game, V, dt) {
  const eye = game.player.eyePos(), look = game.player.lookDir();
  const L = V.world.level;
  const v = new THREE.Vector3();
  for (const p of V.paintings) {
    const vis = p.meshes.some((m) => {
      m.getWorldPosition(v);
      const to = v.clone().sub(eye); const d = to.length();
      return d < 14 && to.normalize().dot(look) > 0.8 && L.los(eye, v);
    });
    if (vis) {
      if (p.hidden && p.awayArmed) {
        p.hidden = false; renderPainting(V, p);
        audio.play('whisper', { vol: 0.6 }); audio.play('scrape');
        game.pulse('aberr', 1.5);
        game.ui.subtitle(['...', 'That wasn\'t there before.', 'It\'s standing where she left room.'][Math.min(2, V.stage)], 2600);
      }
      p.seen = true; p.away = 0;
    } else {
      p.away += dt;
      if (p.seen && p.away > 1.2) p.awayArmed = true;
      if (!p.hidden && V.stage >= 2 && V.k < 4 && p.seen && p.away > 2.5 && p.creep < 3) { p.creep++; p.seen = false; renderPainting(V, p); }
    }
  }
}

function watchersTick(game, V, dt, list) {
  const eye = game.player.eyePos(), look = game.player.lookDir();
  for (const m of list) {
    const to = m.position.clone().setY(1.5).sub(eye).normalize();
    const seen = to.dot(look) > 0.55;
    if (!seen) {
      const target = Math.atan2(game.player.pos.x - m.position.x, game.player.pos.z - m.position.z);
      let d = target - m.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      m.rotation.y += d * Math.min(1, dt * 1.5);
      if (Math.abs(d) > 0.4 && Math.random() < 0.004) audio.play('scrape', { pos: m.position });
    }
  }
}

// ------------------------------------------------------------------ run
export async function runVenue(game, k) {
  const st = S.cur;
  await game.beginLoad(k > 0 && k < 7);
  const V = buildVenue(game, k);
  addAtmosphere(game, V, k);
  addPages(game, V, k);
  addSetPieces(game, V, k);
  const world = V.world;
  game.venue = V;
  const mood = MOODS[Math.min(k, 6)];
  const n = neglect(st);
  const D = V.canvasDefs;
  const toCanvas = (idx) => world.at(D[idx].i, D[idx].j, D[idx].dx || 0, D[idx].dz || 0);
  // Spawn: in front of the painting you just made
  let spawn;
  if (k === 0) spawn = { pos: world.at(31, 35), yaw: 0 };
  else {
    const d = D[k - 1];
    const c = toCanvas(k - 1);
    const dir = new THREE.Vector3(Math.sin(d.ry), 0, Math.cos(d.ry));
    spawn = { pos: c.clone().addScaledVector(dir, 2.3), yaw: d.ry };
  }
  game.setWorld(world, spawn);
  game.player.floorY = undefined;
  roomAudio(game, V);
  trackVisited(game, V);
  game.setFlashlight(k >= 4, k >= 4);
  game.alert = 0;
  game.setMood({
    fog: mood.fog, desat: Math.min(0.6, mood.desat + n.create * 0.06), tint: mood.tint, vignette: 1.1 + k * 0.1, grain: 0.035 + k * 0.006, bloom: mood.bloom, warp: k >= 5 ? 0.2 : 0,
    music: k >= 4 ? 'horror' : 'venue', corrupt: mood.corrupt, ambient: k >= 4 ? ['room', 'hum'] : ['room'], playerLight: k >= 4 ? 1.6 : 0,
  });
  game.ui.setTasks(null);
  let resolveVenue;
  const done = new Promise((r) => { resolveVenue = r; });

  world.onUpdate((dt) => { paintingTick(game, V, dt); watchersTick(game, V, dt, V.watchers); if (k >= 5) watchersTick(game, V, dt, V.audience); });

  // Blank canvas interaction
  if (V.blank && k < 6) {
    world.interact({ obj: V.blank.userData.canvas, r: 0.9, reach: 2.8, prompt: 'Touch the blank canvas', use: async () => {
      game.mode = 'cutscene';
      game.hint(null);
      audio.play('chime'); audio.play('whisper', { vol: 0.4 }); audio.play('whoosh');
      game.player.lookTarget = V.blank.userData.canvas.getWorldPosition(new THREE.Vector3());
      const fov0 = game.player.settings.fov;
      game.player.settings.fov = 28;
      game.fx.track = 0.4;
      await game.fade(1, 1.6, 0xfff8f0);
      game.player.settings.fov = fov0; game.fx.track = 0;
      game.player.lookTarget = null;
      if (V.alien) V.alien.mode = 'off';
      game.proximity = 0;
      resolveVenue();
    } });
  }

  // Alienate
  const stage = V.stage;
  let alien = null;
  if (k >= 3) {
    alien = V.alien = new Alienate(world, { stage: Math.min(3, stage), intensity: alienIntensity(st) });
    setupAlienFx(game, V, alien);
  }

  await game.endLoad();
  game.mode = 'cutscene';
  await game.fade(0, 1.8);

  // ---------------------------------------------------------------- per-chapter scripting
  const intro = async (lines) => { for (const l of lines) { const d = game.ui.subtitle(l); await wait(d + 300); } };
  const recPrev = st.records[k - 1];
  if (k === 0) {
    game.mode = 'play';
    await intro(['The Vista Venue.', 'A museum of everything she almost was.']);
    game.hint('Find the blank canvas.');
    await wait(1500);
    game.ui.toast(input.touch ? 'Left stick to walk · Drag to look · Tap to interact' : input.usingPad ? 'Left stick to walk · Right stick to look · A to interact' : 'WASD to walk · Mouse to look · E to interact · Shift to run', 6000);
  } else if (k < 6) {
    game.mode = 'play';
    const made = recPrev?.comp && !recPrev.comp.blank;
    await intro([made ? `The canvas remembered. “${recPrev.comp.title}.”` : 'The canvas stayed empty. The Venue remembered that, too.']);
  }

  if (k === 1) {
    await wait(600);
    openGateAnim(world, 'g1', V.gates.g1);
    game.ui.subtitle('Somewhere north, a door opened.');
    game.hint('Follow the Long Hall north. Find the next canvas.');
  } else if (k === 2) {
    openGateAnim(world, 'g2', V.gates.g2);
    game.ui.subtitle(stage >= 1 ? 'Something in her paintings is standing very still.' : 'The east doors sighed open. It smelled like chlorine.');
    game.hint('The pools are open. The canvas waits on the island.');
  } else if (k === 3) {
    openGateAnim(world, 'g3', V.gates.g3);
    game.ui.subtitle('The west wing. Her childhood bedroom, three times over.');
    game.hint('Find your room. You would recognise your own painting.');
    // a glimpse in the pools, and one in the bedroom corridor
    world.trigger({ pos: world.at(24, 31), r: 3, fn: () => alien.startGlimpse(world.at(13, 31), game.player, { vanishDist: 8, life: 14 }) });
    world.trigger({ pos: world.at(39, 31), r: 3, fn: () => alien.startGlimpse(world.at(53, 21), game.player, { vanishDist: 9, life: 18 }) });
  } else if (k === 4) {
    openGateAnim(world, 'g4', V.gates.g4);
    game.ui.itemCard({ icon: 'phone', kick: 'NATE\'S PHONE', name: 'The flashlight still works', desc: (input.touch ? 'Tap ☀' : input.usingPad ? 'Press Y' : 'Press F') + ' to toggle it. The dark is getting closer.' });
    game.ui.subtitle('The bedroom has a back door now. Behind it, a lift going down.');
    game.hint('Take the lift down.');
    world.trigger({ pos: world.at(16, 25), r: 2.5, fn: () => alien.startGlimpse(world.at(24, 25), game.player, { vanishDist: 6, life: 10 }) });
    // Elevator ride
    world.trigger({ pos: world.at(9, 24, 1, 1), r: 1.65, fn: async () => {
      game.mode = 'cutscene';
      closeGateAnim(world, 'g4', V.gates.g4);
      await wait(1400);
      audio.play('elevator', { dur: 6 });
      game.pulse('shake', 0.05);
      const shakeT = world.onUpdate(() => { game.player.shake = Math.max(game.player.shake, 0.02); });
      game.ui.subtitle('Going down.');
      await wait(2500);
      game.ui.subtitle(n.duty >= 2 ? 'The lift smells like old takeout. Like the inside of her apartment.' : 'Floor numbers she doesn\'t recognise: 5, 4, 3, 22, 3...');
      await wait(3000);
      world.updaters.splice(world.updaters.indexOf(shakeT), 1);
      // teleport to the lower lift
      game.player.pos.x += 24; game.player.pos.z += 42;
      audio.play('ding');
      await wait(700);
      openGateAnim(world, 'g5', V.gates.g5);
      game.ui.subtitle('The doors behind you open onto a different floor.', 3000);
      game.setMood({ music: 'horror' });
      game.mode = 'play';
      game.hint('Restore power to the archive (0/3). Something else got off on this floor.');
      await wait(2200);
      alien.show(true);
      alien.startHunt(patrolPoints(world, 'x'));
      alien.place(world.at(40, 55));
    } });
    // Breakers
    let flipped = 0;
    for (const [i, j, side] of [[25, 42, 'n'], [43, 55, 'e'], [30, 56, 's']]) {
      const br = P.breaker(false);
      world.onWall(br, i, j, side, 0, { inset: 0.12 });
      const it = world.interact({ obj: br, offsetY: 1.4, r: 0.6, prompt: 'Throw the breaker', use: async () => {
        world.removeInteract(it);
        br.userData.lever.rotation.x = -0.5;
        br.userData.lever.material = mat({ color: 0x55cc66, emissive: 1 });
        br.userData.bulb.material = mat({ color: 0x55ff77, emissive: 1 });
        audio.play('breaker', { pos: br.position });
        flipped++;
        alien.lastSeen = game.player.pos.clone();
        if (alien.mode === 'patrol') { alien.mode = 'search'; alien.searchT = 4; alien.searchTarget = game.player.pos.clone(); }
        if (flipped < 3) game.hint(`Restore power to the archive (${flipped}/3). The noise carries.`);
        else {
          game.hint('The canvas room is open.');
          openGateAnim(world, 'g6', V.gates.g6);
          world.addLight({ pos: world.at(46, 48, 1, 1).setY(3), color: new THREE.Color(1, 0.9, 0.8), intensity: 1, range: 8 });
          game.ui.subtitle('Somewhere, a heavy door grinds open.');
        }
      } });
    }
    addHideSpot(world, game, 24, 50, 'w'); addHideSpot(world, game, 36, 56, 's'); addHideSpot(world, game, 43, 44, 'e'); addHideSpot(world, game, 33, 42, 'n');
    const lamps = [[28, 47], [38, 47], [30, 51], [40, 53], [34, 43], [26, 55]];
    for (const [i, j] of lamps) world.addLight({ pos: world.at(i, j).setY(3), color: new THREE.Color(1, 0.8, 0.55), intensity: 1.2, range: 8, flicker: 0.6 });
    alien.onCatch = () => game.caught(alien, () => { game.player.place(world.at(22, 46)); game.player.yaw = -Math.PI / 2; alien.reset(game.player, patrolPoints(world, 'x')); });
  } else if (k === 5) {
    openGateAnim(world, 'g7', V.gates.g7);
    game.ui.subtitle('Applause, from the east. Hundreds of hands. None of them moving.');
    game.hint('Find the three invitations (0/3). The curtain will only rise for a full house.');
    alien.setStage(Math.min(3, stage));
    alien.intensity = Math.min(1, alienIntensity(st) + 0.15);
    alien.show(true);
    alien.place(world.at(61, 55));
    alien.startHunt(patrolPoints(world, 'f').concat(patrolPoints(world, 'x').slice(0, 6)));
    alien.grace = 6;
    let got = 0;
    for (const [i, j] of [[51, 55], [61, 53], [51, 44]]) {
      const ped = P.pedestal(0x3a2418); world.prop(ped, i, j, { collide: 0.02 });
      const env = P.box(0.3, 0.02, 0.2, 0xfff4e0, null, { emissive: 0.8 }); env.userData.noBake = true;
      env.position.set((i + 0.5) * 2, 1.12, (j + 0.5) * 2); world.scene.add(env);
      const lt = world.addLight({ pos: env.position.clone().setY(1.8), color: new THREE.Color(1, 0.9, 0.7), intensity: 0.8, range: 4 });
      world.onUpdate((dt, t) => { env.rotation.y = t; env.position.y = 1.12 + Math.sin(t * 2) * 0.03; });
      const it = world.interact({ obj: env, r: 0.6, prompt: 'Take the invitation', use: async () => {
        world.removeInteract(it); world.scene.remove(env); game.lights.remove(lt);
        got++; audio.play('pickup');
        const lines = ['"You are cordially invited to watch Nate disappear."', '"Admit one. No plus-ones. No family."', '"Dress code: whoever they want you to be."'];
        game.ui.subtitle(lines[got - 1], 3200);
        if (got === 2 && V.onSecondInvite) V.onSecondInvite();
        if (got < 3) game.hint(`Find the three invitations (${got}/3).`);
        else {
          game.hint('The curtain is rising. Get to the stage.');
          audio.play('clap');
          const t0 = world.t;
          const f = world.onUpdate(() => { const q = Math.min(1, (world.t - t0) / 4); V.curtain.position.y = q * 7.5; if (q >= 1) { V.curtainCol.on = false; world.updaters.splice(world.updaters.indexOf(f), 1); } });
          alien.intensity = Math.min(1, alien.intensity + 0.15);
        }
      } });
    }
    addHideSpot(world, game, 62, 48, 'e'); addHideSpot(world, game, 50, 52, 'w'); addHideSpot(world, game, 62, 56, 'e'); addHideSpot(world, game, 50, 45, 'w');
    addHideSpot(world, game, 24, 50, 'w'); addHideSpot(world, game, 36, 56, 's');
    for (const [i, j] of [[28, 47], [38, 47], [34, 43]]) world.addLight({ pos: world.at(i, j).setY(3), color: new THREE.Color(1, 0.8, 0.55), intensity: 0.6, range: 6, flicker: 0.7 });
    alien.onCatch = () => game.caught(alien, () => { game.player.place(world.at(47, 49), -Math.PI / 2); alien.reset(game.player, patrolPoints(world, 'f')); });
  } else if (k === 6) {
    await finale(game, V, resolveVenue);
  }

  const res = await done;
  if (alien) alien.dispose();
  game.proximity = 0;
  return res;
}

function patrolPoints(world, region) {
  const L = world.level, pts = [];
  for (let j = 0; j < L.h; j += 2) for (let i = 0; i < L.w; i += 2) if (L.region[L.idx(i, j)] === region && L.isWalkable(i, j)) pts.push(world.at(i, j));
  return pts;
}

function setupAlienFx(game, V, alien) {
  const world = V.world;
  let beatT = 0, lastMode = null;
  alien.onSpot = () => { game.pulse('glitch', 0.6); game.pulse('aberr', 2); };
  world.onUpdate((dt, t) => {
    const p = game.player;
    alien.update(dt, t, p);
    game.alert = alien.mode === 'chase' || alien.mode === 'spotted' ? 1 : alien.mode === 'search' ? 0.55 : alien.group.visible && alien.mode !== 'off' ? Math.max(0.12, Math.min(0.4, 1 - (alien.dist || 99) / 30)) : 0;
    if (alien.mode === 'off' || !alien.group.visible) { game.proximity = Math.max(0, game.proximity - dt); return; }
    const d = alien.pos.distanceTo(p.pos);
    const los = world.level.los(alien.pos, p.pos);
    const target = Math.max(0, 1 - d / 11) * (los ? 1 : 0.35) * (alien.mode === 'glimpse' ? 0.6 : 1);
    game.proximity += (target - game.proximity) * Math.min(1, dt * 3);
    beatT -= dt;
    if (d < 18 && alien.mode !== 'glimpse' && beatT <= 0) { audio.play('heartbeat', { vol: 0.12 + (1 - d / 18) * 0.5 }); beatT = 0.35 + (d / 18) * 1.1; }
    if (alien.mode !== lastMode) {
      if (alien.mode === 'chase') game.setMood({ music: 'chase' });
      else if (lastMode === 'chase') game.setMood({ music: 'horror' });
      lastMode = alien.mode;
    }
    if (Math.random() < dt * 0.15 && d < 20) audio.play('whisper', { pos: alien.pos, vol: 0.5 });
  });
}

// ------------------------------------------------------------------ finale (chapter 7)
async function finale(game, V, resolveVenue) {
  const world = V.world;
  const st = S.cur;
  const c = counts(st);
  const n = neglect(st);
  const alien = V.alien;
  alien.setStage(3);
  game.mode = 'play';
  await wait(400);
  game.ui.subtitle('The last canvas is not in the Venue. It never was.', 3200);
  await wait(3400);
  // The audience has turned around; Alienate stands among them.
  for (const m of V.audience) m.rotation.y = 0;
  alien.show(true); alien.mode = 'scripted'; alien.script = (dt, t) => alien.idleAnim(t, dt);
  alien.place(world.at(56, 50), game.player.pos);
  audio.play('stinger', { vol: 0.6 });
  openGateAnim(world, 'g8', V.gates.g8);
  world.addLight({ pos: world.at(56, 38).setY(1.5), color: new THREE.Color(1, 1, 1), intensity: 1.5, range: 6 });
  game.hint('Go through the door behind the stage.');
  game.ui.subtitle('It doesn\'t chase you. It knows where you\'re going.', 3500);

  const voidStart = world.at(42, 16);
  world.trigger({ pos: world.at(56, 38), r: 1.6, fn: async () => {
    game.mode = 'cutscene';
    await game.fade(1, 1, 0x000000);
    game.player.place(voidStart, 0);
    game.player.floorY = undefined;
    game.setMood({ fog: [0x000000, 6, 34], desat: 0.2, tint: [1, 1, 1], music: 'void', corrupt: 0.8, ambient: ['wind'], playerLight: 1.2, warp: 0.35 });
    world.setSky('skyVoid');
    alien.place(world.at(42, 18), game.player.pos);
    alien.mode = 'scripted';
    await game.fade(0, 1.5);
    game.mode = 'play';
    game.hint('Walk. Don\'t look away from it for long.');
    game.ui.subtitle('Every painting she ever made, floating in the dark.', 3000);
    startWeepingChase(game, V, voidStart);
  } });

  // Journal lines as you pass each floating painting
  V.voidFrames.forEach((f, idx) => {
    const rec = st.records[idx];
    world.trigger({ pos: f.position.clone().setY(0), r: 3.2, fn: () => {
      if (!rec) return;
      game.ui.subtitle(CHAPTERS[idx].journal.neglect[rec.neglected], 4200);
    } });
  });

  // The white room
  world.trigger({ pos: world.at(54, 13), r: 1.5, fn: async () => {
    game.mode = 'cutscene';
    alien.mode = 'scripted';
    alien.script = (dt, t) => alien.idleAnim(t, dt);
    game.setMood({ fog: [0xfff8f0, 8, 40], desat: 0, warp: 0, music: 'none', ambient: ['room'], playerLight: 0 });
    world.setSky('skyWhite');
    game.proximity = 0;
    await game.fade(1, 0.2, 0xffffff);
    const cpos = world.at(54, 15);
    const easel = P.easel(tex('canvasBlank'), { w: 1.3, h: 0.98 });
    world.prop(easel, 54, 15, { ry: 0, bake: false });
    alien.place(world.at(55, 15, 0.6, 0), game.player.pos);
    game.player.place(world.at(54, 13, 0, 0.8), Math.PI);
    game.player.lookTarget = alien.head.getWorldPosition(new THREE.Vector3());
    await game.fade(0, 2);
    const A = async (t) => game.say('Alienate', t, { pitch: 140 });
    await A('You kept leaving me places to stand.');
    await A('Every empty chair. Every doorway. Every space you left for someone else to fill.');
    await A('I\'m what you left behind, Natalee. Every time you chose.');
    if (n.bond >= 3) await A('There\'s no one left to call you home. I made sure of it. You helped.');
    else if (n.duty >= 3) await A('You forgot to feed us. So I ate what was left.');
    else if (n.create >= 3) await A('You never even let me be anything. Do you know how boring it is in here?');
    else await A('You almost kept us together. Almost.');
    game.player.lookTarget = cpos.clone().setY(1.4);
    if (c.create <= 1) {
      await A('...You never painted anything. I have nothing to wear.');
      await game.think('She looked at the last blank canvas for a long time.');
      await game.think('She didn\'t feel anything at all.');
      st.finalComp = null;
      game.player.lookTarget = null;
      resolveVenue('boring');
      return;
    }
    await A('One more canvas. Paint us. Then we\'ll both know who you are.');
    const pick = await game.choose(['Paint.', 'Ask who it is.']);
    if (pick === 1) {
      await A('I\'m you, if you let them have you. I\'m you, if you don\'t. That\'s the trick.');
      await A('Inspiration will be very loud now. It has always wanted this one.');
    }
    game.player.lookTarget = null;
    const comp = await game.paint({ ...FINAL_PAINT, chapterName: 'THE LAST CANVAS' });
    st.finalComp = comp;
    const surf = paintingSurface(comp);
    easel.userData.canvas.material.uniforms.map.value = surf.t;
    audio.play('chime');
    const followedFinal = comp.insp.filter((x) => x.followed).length;
    game.mode = 'cutscene';
    game.player.lookTarget = alien.head.getWorldPosition(new THREE.Vector3());
    if (followedFinal >= 3) {
      await A('Oh. Oh, they\'re going to love this.');
      await A('Come on, then. They\'re waiting for us.');
    } else {
      await A('...That\'s not what they asked for.');
      await A('That\'s just you.');
      audio.play('tear');
      alien.show(false);
      await game.think('Where it stood, a shape of clean white canvas. Room to become anything.');
    }
    game.player.lookTarget = null;
    resolveVenue('done');
  } });
}

function startWeepingChase(game, V, start) {
  const world = V.world;
  const alien = V.alien;
  alien.show(true);
  let stepT = 0;
  alien.onCatch = null;
  alien.script = (dt, t) => {
    const p = game.player;
    const eye = p.eyePos();
    const to = alien.pos.clone().setY(1.8).sub(eye);
    const d = to.length();
    const seen = to.normalize().dot(p.lookDir()) > 0.6 && world.level.los(p.pos, alien.pos);
    game.proximity = Math.max(0, 1 - d / 9) * 0.8;
    if (!seen && d > 1.0 && game.mode === 'play') {
      alien.goTo(p.pos.clone(), 2.5, dt);
      stepT -= dt;
    } else alien.idleAnim(t);
    if (d < 1.1 && game.mode === 'play') {
      game.caught(alien, () => { p.place(start, 0); alien.place(world.at(42, 18), p.pos); });
    }
  };
}

// ------------------------------------------------------------------ title screen world
export function buildTitleWorld(game) {
  const V = buildVenue(game, 0, { title: true });
  addAtmosphere(game, V, 0);
  const world = V.world;
  const center = new THREE.Vector3(64, 3, 64);
  const cam = (dt, t) => {
    const a = t * 0.06;
    game.camera.position.set(64 + Math.cos(a) * 8.5, 2.2 + Math.sin(t * 0.2) * 0.3, 64 + Math.sin(a) * 8.5);
    game.camera.lookAt(center.x + Math.cos(a + 1.2) * 3, 4.5, center.z + Math.sin(a + 1.2) * 3);
    game.camera.fov = 70;
  };
  return {
    world, cam, spawn: { pos: world.at(31, 35), yaw: 0 },
    mood: { fog: MOODS[0].fog, desat: 0, tint: MOODS[0].tint, vignette: 1.3, grain: 0.04, bloom: 0.9, warp: 0.15, ambient: ['room'] },
  };
}
