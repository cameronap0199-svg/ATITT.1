// Turns a layout (pure data) into a playable room: floor, perimeter walls with doors,
// collision world, prop meshes, decor, lights and backdrop.

import * as THREE from 'three';
import { World } from './collision.js';
import { buildProp, mat, glow, textTexture, GEO, addBox, addCyl, heartShape } from './props.js';
import { blockMesh, lavaSurface } from '../mc/blocks.js';

const DOOR_W = 3.4;
export const WALL_H = 8;

export const FLOOR_PALETTE = {
  1: { bg: '#2b1d4a', fog: '#3a2856', sky: ['#1b1040', '#6a2c70', '#f08a5d', '#f9ed69'], hemi: ['#ffc6d9', '#3a2f55', 1.35], dir: ['#ffd6a5', 1.5, [-30, 25, -20]], amb: 0.25 },
  2: { bg: '#110d24', fog: '#150f2e', sky: null, hemi: ['#c9d1ff', '#26213f', 1.25], dir: ['#ffffff', 1.1, [10, 30, 12]], amb: 0.3 },
  3: { bg: '#0a0216', fog: '#0f0322', sky: null, hemi: ['#d7a1ff', '#12002b', 1.05], dir: ['#ff9ecf', 1.0, [-12, 30, 8]], amb: 0.28 },
  nether: { bg: '#3a0a06', fog: '#5a1408', sky: null, hemi: ['#ffb38a', '#3a0a06', 1.25], dir: ['#ff9a5a', 0.9, [10, 30, -8]], amb: 0.32 },
  stronghold: { bg: '#07060a', fog: '#0c0a10', sky: null, hemi: ['#d6d3c4', '#1c1a22', 1.1], dir: ['#fde68a', 0.7, [8, 30, 10]], amb: 0.3 },
  end: { bg: '#0b0712', fog: '#140c22', sky: null, hemi: ['#e8e4ff', '#1a1030', 1.2], dir: ['#f5f0ff', 1.0, [-14, 32, 10]], amb: 0.3 },
};

const FLOORS = {
  asphalt: { base: '#3b3f4a', noise: 22, accent: '#f1f1f1' },
  grass: { base: '#4f7a3a', noise: 26, stripes: '#5b8a43' },
  plaza: { base: '#8d8a93', tiles: 2.2, line: '#76727d' },
  lobby: { base: '#d9d4e4', tiles: 3, line: '#bdb5cf', gloss: true },
  concrete: { base: '#5d6173', noise: 16, tiles: 4, line: '#51556a' },
  tile: { base: '#e8e8f0', tiles: 1.2, line: '#c9c9d9', checker: '#d4d4e2' },
  carpet: { base: '#5a1c5f', pattern: 'carpet' },
  wood: { base: '#8b5e3c', planks: true },
  grid: { base: '#23252f', tiles: 1, line: '#353846' },
  stage: { base: '#0d0d14', neon: true },
  arena: { base: '#b07d4f', planks: true, court: true },
  gasTile: { base: '#f5f5f5', tiles: 1.2, line: '#dcdcdc', checker: '#d8f3dc' },
  // Minecraft realms
  netherrack: { base: '#6e2b2b', noise: 34, specks: ['#4f1c1c', '#8a3a3a'] },
  soulsand: { base: '#54402f', noise: 26, specks: ['#3f2f22', '#6a523d'] },
  crimson: { base: '#7a1f2b', noise: 30, specks: ['#b0273c', '#4f1c1c'] },
  warped: { base: '#16585a', noise: 28, specks: ['#1f8a7f', '#3f1c33'] },
  basalt: { base: '#4a4a52', noise: 26, specks: ['#2f2f36', '#6a6a72'] },
  netherbrick: { base: '#2c1418', tiles: 1, line: '#1a0b0e', noise: 16 },
  stonebrick: { base: '#7a7a7a', tiles: 1, line: '#5a5a5a', noise: 18 },
  endstone: { base: '#dcd79c', noise: 22, specks: ['#c8c286', '#ece8b8'] },
};

function floorTexture(L, style) {
  const S = FLOORS[style] || FLOORS.concrete;
  const ppm = Math.min(24, 1600 / Math.max(L.w, L.d));
  const cw = Math.ceil(L.w * ppm), ch = Math.ceil(L.d * ppm);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const X = (x) => (x + L.w / 2) * ppm, Z = (z) => (z + L.d / 2) * ppm;
  g.fillStyle = S.base; g.fillRect(0, 0, cw, ch);
  if (S.noise) {
    const img = g.getImageData(0, 0, cw, ch);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * S.noise;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }
  if (S.specks) {
    const n = Math.floor(L.w * L.d * 2);
    for (let i = 0; i < n; i++) { g.fillStyle = S.specks[i % S.specks.length]; g.fillRect(Math.random() * cw, Math.random() * ch, ppm * 0.25, ppm * 0.25); }
  }
  if (S.stripes) { g.fillStyle = S.stripes; for (let x = 0; x < L.w; x += 4) g.fillRect(X(x - L.w / 2), 0, 2 * ppm, ch); }
  if (S.tiles) {
    const t = S.tiles;
    for (let i = 0; i * t < L.w + t; i++) for (let j = 0; j * t < L.d + t; j++) {
      if (S.checker && (i + j) % 2) { g.fillStyle = S.checker; g.fillRect(i * t * ppm, j * t * ppm, t * ppm, t * ppm); }
    }
    g.strokeStyle = S.line; g.lineWidth = Math.max(1, ppm * 0.05);
    for (let x = 0; x <= L.w; x += t) { g.beginPath(); g.moveTo(x * ppm, 0); g.lineTo(x * ppm, ch); g.stroke(); }
    for (let z = 0; z <= L.d; z += t) { g.beginPath(); g.moveTo(0, z * ppm); g.lineTo(cw, z * ppm); g.stroke(); }
  }
  if (S.planks) {
    for (let z = 0; z < L.d; z += 0.3) {
      g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
      g.fillRect(0, z * ppm, cw, 0.3 * ppm - 1);
    }
    if (S.court) {
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = ppm * 0.1;
      g.strokeRect(X(-L.w / 2 + 3), Z(-L.d / 2 + 3), (L.w - 6) * ppm, (L.d - 6) * ppm);
      g.beginPath(); g.arc(X(0), Z(0), 4 * ppm, 0, Math.PI * 2); g.stroke();
    }
  }
  if (S.pattern === 'carpet') {
    for (let i = 0; i < L.w; i += 1.5) for (let j = 0; j < L.d; j += 1.5) {
      g.fillStyle = (i + j) % 3 < 1.5 ? '#7b2d80' : '#3f1244';
      g.beginPath(); g.arc(i * ppm, j * ppm, 0.35 * ppm, 0, Math.PI * 2); g.fill();
    }
  }
  if (S.neon) {
    g.strokeStyle = 'rgba(255,79,163,.55)'; g.lineWidth = ppm * 0.08;
    for (let r = 3; r < Math.max(L.w, L.d); r += 3) { g.beginPath(); g.arc(X(0), Z(0), r * ppm, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = 'rgba(76,201,240,.35)';
    for (let a = 0; a < 16; a++) { g.beginPath(); g.moveTo(X(0), Z(0)); g.lineTo(X(Math.cos(a / 16 * Math.PI * 2) * 40), Z(Math.sin(a / 16 * Math.PI * 2) * 40)); g.stroke(); }
  }
  if (S.gloss) {
    const grd = g.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) / 1.5);
    grd.addColorStop(0, 'rgba(255,255,255,.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
  }
  // painted markings
  for (const p of L.paint) {
    g.save();
    if (p.kind === 'stall') {
      g.strokeStyle = 'rgba(240,240,240,.8)'; g.lineWidth = ppm * 0.12;
      g.beginPath();
      g.moveTo(X(p.x - p.w / 2), Z(p.z - p.d / 2)); g.lineTo(X(p.x - p.w / 2), Z(p.z + p.d / 2));
      g.moveTo(X(p.x + p.w / 2), Z(p.z - p.d / 2)); g.lineTo(X(p.x + p.w / 2), Z(p.z + p.d / 2));
      g.stroke();
    } else if (p.kind === 'arrow') {
      g.translate(X(p.x), Z(p.z)); g.rotate(p.rot || 0);
      g.fillStyle = 'rgba(240,240,240,.75)';
      g.beginPath(); g.moveTo(1.8 * ppm, 0); g.lineTo(0.4 * ppm, -0.9 * ppm); g.lineTo(0.4 * ppm, -0.35 * ppm); g.lineTo(-1.8 * ppm, -0.35 * ppm);
      g.lineTo(-1.8 * ppm, 0.35 * ppm); g.lineTo(0.4 * ppm, 0.35 * ppm); g.lineTo(0.4 * ppm, 0.9 * ppm); g.closePath(); g.fill();
    } else if (p.kind === 'cross') {
      g.fillStyle = 'rgba(240,240,240,.7)';
      for (let i = -3; i <= 3; i++) {
        g.fillRect(X(p.x + i * 0.9 - 0.3), Z(p.z - 4.5), 0.6 * ppm, 1.6 * ppm);
        g.fillRect(X(p.x + i * 0.9 - 0.3), Z(p.z + 2.9), 0.6 * ppm, 1.6 * ppm);
      }
    }
    g.restore();
  }
  // zones
  for (const zn of L.zones) {
    const col = zn.type === 'grease' ? 'rgba(160,120,20,.55)' : zn.type === 'sticky' ? 'rgba(255,70,140,.45)' : zn.type === 'lava' ? '#f97316' : zn.type === 'soul' ? 'rgba(60,40,28,.9)' : 'rgba(255,120,0,.55)';
    g.fillStyle = col;
    if (zn.shape === 'circle') { g.beginPath(); g.arc(X(zn.x), Z(zn.z), zn.r * ppm, 0, Math.PI * 2); g.fill(); } else g.fillRect(X(zn.x - zn.w / 2), Z(zn.z - zn.d / 2), zn.w * ppm, zn.d * ppm);
    if (zn.type === 'hot') {
      g.strokeStyle = 'rgba(255,220,120,.8)'; g.lineWidth = ppm * 0.08;
      for (let k = 0; k < zn.w; k += 0.5) { g.beginPath(); g.moveTo(X(zn.x - zn.w / 2 + k), Z(zn.z - zn.d / 2)); g.lineTo(X(zn.x - zn.w / 2 + k), Z(zn.z + zn.d / 2)); g.stroke(); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function skyDome(colors) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  colors.forEach((col, i) => grd.addColorStop(i / (colors.length - 1), col));
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
  return m;
}

// ---------------------------------------------------------------------------
export function buildRoom(L, floor, doors) {
  const group = new THREE.Group();
  const world = new World(L.w, L.d);
  const pal = FLOOR_PALETTE[floor];
  const animators = [];
  const room = { group, world, doors: [], animators, L, blocksByMesh: new Map(), lights: [], sides: { N: [], S: [], W: [], E: [] }, sideFade: { N: 1, S: 1, W: 1, E: 1 } };

  // Floor
  const ft = floorTexture(L, L.floorStyle);
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.d), new THREE.MeshLambertMaterial({ map: ft }));
  fm.rotation.x = -Math.PI / 2;
  group.add(fm);
  // outer ground so the void around the room is not empty
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floor === 'nether' ? new THREE.MeshBasicMaterial({ color: '#c2410c' }) : new THREE.MeshLambertMaterial({ color: floor === 1 ? '#23202e' : floor === 2 ? '#141225' : floor === 'end' ? '#05030a' : '#07020f' }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = floor === 'nether' ? -6 : floor === 'end' ? -40 : -0.02;
  group.add(outer);
  // lava pools: glowing animated surfaces over the painted zones
  for (const zn of L.zones) {
    if (zn.type !== 'lava') continue;
    const lv = lavaSurface(zn.shape === 'circle' ? zn.r * 2 : zn.w, zn.shape === 'circle' ? zn.r * 2 : zn.d);
    if (zn.shape === 'circle') { lv.geometry.dispose(); lv.geometry = new THREE.CircleGeometry(zn.r, 24); }
    lv.position.set(zn.x, 0.03, zn.z);
    group.add(lv);
    const pl = new THREE.PointLight('#f97316', 1.6, 9, 1.8); pl.position.set(zn.x, 1.2, zn.z); group.add(pl);
    animators.push((t) => { lv.material.map.offset.set(t * 0.05, Math.sin(t * 0.4) * 0.05); });
  }

  // Perimeter walls with door gaps
  const sides = {
    N: { x: 0, z: -L.d / 2, len: L.w, rot: Math.PI / 2 },
    S: { x: 0, z: L.d / 2, len: L.w, rot: Math.PI / 2 },
    W: { x: -L.w / 2, z: 0, len: L.d, rot: 0 },
    E: { x: L.w / 2, z: 0, len: L.d, rot: 0 },
  };
  const doorSides = new Map(doors.map((d) => [d.side, d]));
  for (const [s, sd] of Object.entries(sides)) {
    const door = doorSides.get(s);
    const segs = door ? [[-sd.len / 2, -DOOR_W / 2], [DOOR_W / 2, sd.len / 2]] : [[-sd.len / 2, sd.len / 2]];
    for (const [a, b] of segs) {
      const mid = (a + b) / 2, len = b - a;
      const horiz = s === 'N' || s === 'S';
      const x = horiz ? mid : sd.x, z = horiz ? sd.z : mid;
      const out = s === 'N' ? [0, -0.5] : s === 'S' ? [0, 0.5] : s === 'W' ? [-0.5, 0] : [0.5, 0];
      world.add({ kind: 'wall', wall: true, x: x + out[0], z: z + out[1], w: horiz ? len + 1 : 1, d: horiz ? 1 : len + 1, h: WALL_H, camBlock: false, vault: false });
      room.sides[s].push(wallVisual(group, L.walls, x, z, horiz, len, floor));
    }
  }
  for (const d of doors) {
    const sd = sides[d.side];
    const horiz = d.side === 'N' || d.side === 'S';
    const dx = horiz ? 0 : sd.x, dz = horiz ? sd.z : 0;
    const frame = doorFrame(d, horiz);
    frame.position.set(dx, 0, dz);
    group.add(frame);
    room.sides[d.side].push(frame);
    const blocker = { kind: 'door', wall: true, x: dx, z: dz, w: horiz ? DOOR_W + 0.2 : 1, d: horiz ? 1 : DOOR_W + 0.2, h: WALL_H, camBlock: false, vault: false };
    const inward = d.side === 'N' ? [0, 1] : d.side === 'S' ? [0, -1] : d.side === 'W' ? [1, 0] : [-1, 0];
    room.doors.push({ ...d, x: dx, z: dz, inward, horiz, frame, blockerDesc: blocker, blocker: null, locked: false });
  }

  // Walls and door frames on the camera's side fade out, so they get their own materials.
  for (const list of Object.values(room.sides)) for (const g of list) g.traverse((c) => {
    if (!c.isMesh) return;
    c.material = Array.isArray(c.material) ? c.material.map((m) => m.clone()) : c.material.clone();
    const m0 = Array.isArray(c.material) ? c.material[0] : c.material;
    c.userData.baseOpacity = m0.opacity;
    c.userData.baseTransparent = m0.transparent;
  });
  room.fadeSide = (side, k) => {
    if (Math.abs(room.sideFade[side] - k) < 0.01) return;
    room.sideFade[side] = k;
    for (const g of room.sides[side]) g.traverse((c) => {
      if (!c.isMesh) return;
      c.visible = k > 0.04;
      for (const m of Array.isArray(c.material) ? c.material : [c.material]) {
        m.transparent = k < 0.99 || c.userData.baseTransparent;
        m.opacity = c.userData.baseOpacity * k;
        m.depthWrite = k >= 0.99 && !c.userData.baseTransparent;
        m.needsUpdate = true;
      }
    });
  };

  // Blocks
  for (const o of L.blocks) {
    const b = world.add(o);
    const mesh = buildProp(o);
    group.add(mesh);
    b.meshes = mesh;
    mesh.userData.block = b;
  }
  world.zones = L.zones.map((z) => ({ ...z }));

  // Decor
  for (const d of L.decor) {
    const m = decor(d, L, floor, animators);
    if (m) group.add(m);
  }

  // Lights
  const hemi = new THREE.HemisphereLight(pal.hemi[0], pal.hemi[1], pal.hemi[2] * (L.dark ? 0.75 : 1));
  group.add(hemi);
  const dir = new THREE.DirectionalLight(pal.dir[0], pal.dir[1] * (L.dark ? 0.6 : 1));
  dir.position.set(...pal.dir[2]);
  group.add(dir);
  group.add(new THREE.AmbientLight('#ffffff', pal.amb));
  const pls = L.lights.length ? L.lights : autoLights(L, floor);
  for (const l of pls.slice(0, 4)) {
    const p = new THREE.PointLight(l.color, l.intensity * 12, l.dist, 1.6);
    p.position.set(l.x, l.y, l.z);
    group.add(p);
    room.lights.push(p);
  }
  if (floor === 1 && !['building'].includes(L.walls)) group.add(skyDome(pal.sky));
  backdrop(group, L, floor, animators);
  return room;
}

function autoLights(L, floor) {
  const cols = floor === 'nether' ? ['#ff7b39', '#ff3d1f'] : floor === 'end' ? ['#c4b5fd', '#a78bfa'] : L.walls === 'stonebrick' ? ['#fbbf24', '#f59e0b'] : floor === 1 ? ['#ff9ecf', '#8ecae6'] : floor === 2 ? ['#b388ff', '#4cc9f0'] : ['#ff4fa3', '#7b2cbf'];
  const k = L.dark ? 1.6 : 0.9;
  return [
    { x: -L.w / 3, y: 5, z: -L.d / 3, color: cols[0], intensity: k, dist: 26 },
    { x: L.w / 3, y: 5, z: L.d / 3, color: cols[1], intensity: k, dist: 26 },
  ];
}

// ---------------------------------------------------------------------------
function wallVisual(group, style, x, z, horiz, len, floor) {
  return wallGroup(group, style, x, z, horiz, len, floor);
}
const MC_WALLS = { netherrack: 'netherrack', netherbrick: 'netherBrick', stonebrick: 'stoneBrick', basalt: 'stone', endstone: 'endStone' };
function wallGroup(group, style, x, z, horiz, len, floor) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  if (!horiz) g.rotation.y = Math.PI / 2;
  if (MC_WALLS[style]) {
    const h = style === 'netherbrick' || style === 'stonebrick' ? 5 : 6;
    const w = blockMesh(MC_WALLS[style], Math.max(1, Math.round(len)), h, 1);
    w.position.y = h / 2;
    w.scale.x = len / Math.max(1, Math.round(len));
    g.add(w);
  } else if (style === 'endvoid') {
    addBox(g, len, 0.4, 0.3, '#2b1d3a', 0, 0, 0, glow('#7c3aed', 0.5));
  } else if (style === 'fence') {
    const tex = chainTexture();
    tex.repeat.set(len / 1.2, 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.8 }));
    m.position.y = 1.2;
    g.add(m);
    for (let p = -len / 2; p <= len / 2 + 0.01; p += 3) addCyl(g, 0.05, 2.5, '#9aa5b1', p, 0, 0);
    addBox(g, len, 0.06, 0.06, '#9aa5b1', 0, 2.42, 0);
  } else if (style === 'building') {
    addBox(g, len, 4.2, 0.6, '#524a6e', 0, 0, 0);
    addBox(g, len, 0.3, 0.7, '#ff4fa3', 0, 4.2, 0, glow('#ff4fa3'));
    for (let p = -len / 2 + 2; p < len / 2 - 1; p += 4) addBox(g, 2, 1.8, 0.62, '#9bf6ff', p, 1.4, 0, mat('#8ecae6', { emissive: '#1d3557' }));
  } else if (style === 'arena') {
    addBox(g, len, 1.2, 0.5, '#2b2d42', 0, 0, 0);
    addBox(g, len, 0.12, 0.55, '#ff4fa3', 0, 1.2, 0, glow('#ff4fa3'));
  } else if (style === 'void') {
    addBox(g, len, 0.06, 0.2, '#ff4fa3', 0, 0.02, 0, glow('#ff4fa3'));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 3), new THREE.MeshBasicMaterial({ color: '#ff4fa3', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.y = 1.5;
    g.add(m);
  } else if (style === 'store') {
    addBox(g, len, 3.2, 0.4, '#e9f5db', 0, 0, 0);
    addBox(g, len, 0.4, 0.45, '#2a9d8f', 0, 2.8, 0);
  } else {
    const col = floor === 2 ? '#4a4e69' : '#3c1f5c';
    addBox(g, len, 3.0, 0.5, col, 0, 0, 0);
    addBox(g, len, 0.15, 0.55, floor === 2 ? '#9a8c98' : '#ff4fa3', 0, 3.0, 0, floor === 3 ? glow('#c77dff') : undefined);
  }
  group.add(g);
  return g;
}

let chainTex = null;
function chainTexture() {
  if (chainTex) return chainTex.clone();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(200,210,220,.9)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
  chainTex = new THREE.CanvasTexture(c);
  chainTex.wrapS = chainTex.wrapT = THREE.RepeatWrapping;
  return chainTex.clone();
}

const DOOR_COLORS = { combat: '#4cc9f0', side: '#4cc9f0', start: '#4cc9f0', preboss: '#ff9f1c', boss: '#ff0054', gas: '#3cff8f', treasure: '#ffd60a', secret: '#b5838d', exit: '#ffffff', stronghold: '#a3e635', fortress: '#f97316', spawner: '#f97316', bastion: '#facc15', trade: '#facc15', wastes: '#ef4444', soul: '#38bdf8', crimson: '#fb7185', warped: '#2dd4bf', basalt: '#a1a1aa' };
function doorFrame(d, horiz) {
  const g = new THREE.Group();
  if (!horiz) g.rotation.y = Math.PI / 2;
  const col = DOOR_COLORS[d.kind] || '#4cc9f0';
  const big = d.kind === 'boss' || d.kind === 'preboss';
  const h = big ? 4.2 : 3.4;
  for (const s of [-1, 1]) addBox(g, 0.4, h, 0.9, '#222', s * (DOOR_W / 2 + 0.2), 0, 0);
  addBox(g, DOOR_W + 0.8, 0.45, 0.9, '#222', 0, h, 0);
  addBox(g, DOOR_W + 0.3, 0.12, 0.95, col, 0, h + 0.1, 0, glow(col));
  for (const s of [-1, 1]) addBox(g, 0.1, h, 0.95, col, s * (DOOR_W / 2 + 0.05), 0, 0, glow(col));
  if (d.kind === 'boss') for (const s of [-1, 1]) {
    const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(), { depth: 0.2, bevelEnabled: false }), glow('#ff0054'));
    hm.scale.setScalar(1.1); hm.position.set(s * 2.4, h + 0.4, 0.2); g.add(hm);
  }
  const labelTxt = { gas: 'GAS & GO', treasure: 'LOST & FOUND', boss: '♥ STAGE ♥', preboss: '', secret: 'WC', exit: 'NEXT FLOOR', stronghold: 'STRONGHOLD', fortress: 'FORTRESS', spawner: 'SPAWNER', bastion: 'BASTION', trade: 'PIGLIN TRADER' }[d.kind];
  if (labelTxt) {
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: textTexture(labelTxt, { bg: '#111', fg: col }), side: THREE.DoubleSide }));
    lm.position.set(0, h + 0.75, 0);
    g.add(lm);
  }
  // locked barrier: glowing tape strips
  const tape = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, 0.18), new THREE.MeshBasicMaterial({ map: textTexture('DO NOT CROSS ✖ DEMONS ✖ DO NOT CROSS', { bg: '#ffd60a', fg: '#111', w: 1024, h: 64, font: 'bold 44px sans-serif' }), side: THREE.DoubleSide }));
    t.position.y = 0.6 + i * 0.7;
    t.rotation.z = (i - 1) * 0.12;
    tape.add(t);
  }
  const field = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, h), new THREE.MeshBasicMaterial({ color: '#ff0054', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  field.position.y = h / 2;
  tape.add(field);
  tape.visible = false;
  g.add(tape);
  g.userData.tape = tape;
  return g;
}

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------
function decor(d, L, floor, animators) {
  const g = new THREE.Group();
  g.position.set(d.x || 0, 0, d.z || 0);
  if (d.rot) g.rotation.y = d.rot;
  switch (d.kind) {
    case 'lamp': {
      addCyl(g, 0.08, 6, '#555', 0, 0, 0);
      addBox(g, 1.2, 0.2, 0.4, '#333', 0.5, 6, 0);
      addBox(g, 0.9, 0.06, 0.3, '#fff', 0.5, 5.95, 0, glow('#fff1c1'));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff1c1', transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }));
      cone.position.set(0.5, 3, 0);
      g.add(cone);
      break;
    }
    case 'sign': {
      for (const s of [-1, 1]) addCyl(g, 0.06, 2.6, '#666', s * 2.2, 0, 0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.9), new THREE.MeshBasicMaterial({ map: textTexture(d.text, { bg: '#1d3557', fg: '#f1faee', border: '#f1faee' }), side: THREE.DoubleSide }));
      m.position.y = 2.6;
      g.add(m);
      break;
    }
    case 'arch': {
      for (const s of [-1, 1]) addBox(g, 1, 6, 1, '#240046', s * 8, 0, 0);
      addBox(g, 17, 1.4, 1, '#240046', 0, 6, 0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.1), new THREE.MeshBasicMaterial({ map: textTexture(d.text, { bg: '#240046', fg: '#ff4fa3', w: 1024 }) }));
      m.position.set(0, 6.7, 0.51);
      g.add(m);
      break;
    }
    case 'banner': {
      addCyl(g, 0.06, 7, '#aaa', 0, 0, 0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), new THREE.MeshBasicMaterial({ map: posterTexture(Math.random()), side: THREE.DoubleSide }));
      m.position.set(0.85, 4.6, 0);
      g.add(m);
      animators.push((t) => { m.rotation.y = Math.sin(t * 0.8 + d.x) * 0.2; });
      break;
    }
    case 'bonfire': {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 8), glow('#ff7b00', 0.85));
      f.position.y = 0.7;
      g.add(f);
      addBox(g, 1.2, 0.2, 1.2, '#5c4033');
      animators.push((t) => { f.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 17) * 0.2, 1); });
      break;
    }
    case 'smoke': {
      const ms = [];
      for (let i = 0; i < 10; i++) {
        const s = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: '#bbb', transparent: true, opacity: 0.12, depthWrite: false }));
        s.scale.setScalar(3 + Math.random() * 3);
        s.position.set((Math.random() - 0.5) * 30, 3 + Math.random() * 3, (Math.random() - 0.5) * 16);
        g.add(s); ms.push(s);
      }
      animators.push((t, dt) => { for (const s of ms) { s.position.x += dt * 0.6; if (s.position.x > 18) s.position.x = -18; } });
      break;
    }
    case 'balloons': {
      const cols = ['#ff4fa3', '#4cc9f0', '#ffd60a', '#b5179e'];
      const bs = [];
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(GEO.sph, mat(cols[i], { emissive: cols[i], emissiveIntensity: 0.2 }));
        b.scale.set(0.6, 0.75, 0.6);
        b.position.set((i - 1.5) * 0.5, 3.4 + (i % 2) * 0.4, 0);
        g.add(b); bs.push(b);
      }
      animators.push((t) => bs.forEach((b, i) => { b.position.y = 3.4 + (i % 2) * 0.4 + Math.sin(t * 1.5 + i) * 0.15; }));
      break;
    }
    case 'lightsticks': {
      const n = 60, spread = d.spread || 8;
      const im = new THREE.InstancedMesh(GEO.cyl, glow('#ffffff'), n);
      const o = new THREE.Object3D(), col = new THREE.Color();
      for (let i = 0; i < n; i++) {
        o.position.set((Math.random() - 0.5) * spread * 2, 0.05, (Math.random() - 0.5) * spread * 2);
        o.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
        o.scale.set(0.06, 0.45, 0.06);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        im.setColorAt(i, col.setHSL(Math.random(), 1, 0.6));
      }
      g.add(im);
      break;
    }
    case 'velvet': {
      const r = addCyl(g, 0.04, d.len, '#9d0208', 0, 0.8, 0);
      r.rotation.z = Math.PI / 2; r.position.y = 0.85;
      break;
    }
    case 'detbar': { addBox(g, 2.1, 0.25, 0.6, '#8d99ae', 0, 2.3, 0); g.rotation.y = d.rot || 0; break; }
    case 'crowd': {
      const w = d.w || 30, n = Math.floor(w * 3.2);
      const body = new THREE.InstancedMesh(GEO.cyl6, new THREE.MeshLambertMaterial({ color: '#ffffff' }), n);
      const sticks = new THREE.InstancedMesh(GEO.sph, glow('#ffffff'), n);
      const o = new THREE.Object3D(), col = new THREE.Color();
      const base = [];
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * w, z = Math.random() * 4.5 + 1.2, y = z * 0.35;
        base.push([x, y, z, Math.random() * 6]);
        body.setColorAt(i, col.setHSL(0.72 + Math.random() * 0.2, 0.4, 0.18 + Math.random() * 0.1));
        sticks.setColorAt(i, col.setHSL(Math.random(), 1, 0.65));
      }
      g.add(body); g.add(sticks);
      const upd = (t) => {
        for (let i = 0; i < n; i++) {
          const [x, y, z, ph] = base[i];
          const bob = Math.abs(Math.sin(t * 4 + ph)) * 0.25;
          o.position.set(x, y + 0.8 + bob, z); o.rotation.set(0, 0, 0); o.scale.set(0.5, 1.6, 0.5); o.updateMatrix(); body.setMatrixAt(i, o.matrix);
          o.position.set(x + Math.sin(t * 3 + ph) * 0.3, y + 2.1 + bob, z); o.scale.setScalar(0.18); o.updateMatrix(); sticks.setMatrixAt(i, o.matrix);
        }
        body.instanceMatrix.needsUpdate = true; sticks.instanceMatrix.needsUpdate = true;
      };
      upd(0);
      animators.push(upd);
      break;
    }
    case 'mirror': case 'mirrorRow': {
      const len = d.kind === 'mirrorRow' ? 28 : 2.4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.4), new THREE.MeshBasicMaterial({ color: '#cde7f0', transparent: true, opacity: 0.55 }));
      m.position.y = 1.9;
      g.add(m);
      break;
    }
    case 'posters': {
      for (let i = -4; i <= 4; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), new THREE.MeshBasicMaterial({ map: posterTexture(i * 0.37 + 0.5) }));
        m.position.set(i * 4.6, 1.9, 0.3);
        g.add(m);
      }
      break;
    }
    case 'curtains': {
      for (let i = 0; i < 24; i++) addBox(g, 1.5, 6, 0.3, i % 2 ? '#6a040f' : '#9d0208', -L.w / 2 + i * 1.6 + 0.8, 0, (i % 2) * 0.2);
      break;
    }
    case 'screen': {
      const w = d.w || 10;
      addBox(g, w + 0.4, w * 0.5 + 0.4, 0.4, '#111', 0, 1.8, 0);
      const t = textTexture(d.text || '', { bg: '#240046', fg: '#ff4fa3', w: 1024, h: 512, font: 'bold 150px "Bungee", sans-serif' });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), new THREE.MeshBasicMaterial({ map: t }));
      m.position.set(0, 2 + w * 0.25, 0.22);
      g.add(m);
      animators.push((tt) => { m.material.color.setHSL((tt * 0.05) % 1, 0.6, 0.75); });
      break;
    }
    case 'stageLights': {
      const cones = [];
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(2.5, 16, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 8, 1, 0.6), transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        c.geometry.translate(0, -8, 0);
        c.position.set(-21 + i * 6, 16, -16);
        g.add(c); cones.push(c);
      }
      animators.push((t) => cones.forEach((c, i) => { c.rotation.x = 0.5 + Math.sin(t * 0.7 + i) * 0.35; c.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.5; }));
      break;
    }
    case 'countdown': {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));
      m.position.y = 6;
      g.add(m);
      let lastN = -1;
      animators.push((t) => {
        const n = 10 - (Math.floor(t) % 11);
        if (n !== lastN) { lastN = n; m.material.map = textTexture(String(n), { bg: null, fg: '#ff4fa3', w: 256, h: 128, font: 'bold 110px "Bungee", sans-serif' }); m.material.needsUpdate = true; }
        m.rotation.y = Math.sin(t) * 0.3;
      });
      break;
    }
    default: return null;
  }
  return g;
}

function posterTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 192;
  const g = c.getContext('2d');
  const h = Math.floor((seed * 360) % 360);
  const grd = g.createLinearGradient(0, 0, 0, 192);
  grd.addColorStop(0, `hsl(${h},90%,65%)`); grd.addColorStop(1, `hsl(${(h + 60) % 360},80%,35%)`);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 192);
  g.fillStyle = 'rgba(0,0,0,.55)';
  g.beginPath(); g.arc(64, 70, 26, 0, Math.PI * 2); g.fill();
  g.fillRect(34, 96, 60, 70);
  g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center';
  const names = ['DEMONIQUE', 'LUV DAMNATION', 'EVIL BTSKI', 'NU HELLSTAR', 'BIAS WRECKER', 'DOOMCHICKA', 'MAKNAE X', 'HEX-O'];
  g.fillText(names[Math.floor(seed * 97) % names.length], 64, 184);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function backdrop(group, L, floor, animators) {
  if (floor === 'nether') {
    // a lava sea far below, netherrack cliffs around, falling ash
    for (let i = 0; i < 22; i++) {
      const h = 18 + Math.random() * 40, a = (i / 22) * Math.PI * 2, r = 70 + Math.random() * 40;
      const c = blockMesh('netherrack', 10, Math.round(h), 10);
      c.position.set(Math.sin(a) * r, h / 2 - 6, Math.cos(a) * r);
      group.add(c);
      if (i % 4 === 0) { const gs = blockMesh('glowstone', 3, 2, 3); gs.position.set(c.position.x, h - 7, c.position.z); group.add(gs); }
    }
    const ash = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 600 }, (_, i) => (i % 3 === 1 ? Math.random() * 20 : (Math.random() - 0.5) * 80)), 3)), new THREE.PointsMaterial({ color: '#d6a38a', size: 0.12, transparent: true, opacity: 0.6 }));
    group.add(ash);
    animators.push((t, dt) => { ash.position.y = -((t * 0.6) % 20); ash.rotation.y = t * 0.02; });
    return;
  }
  if (floor === 'end') {
    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1800 }, () => (Math.random() - 0.5) * 500), 3)), new THREE.PointsMaterial({ color: '#e9d5ff', size: 0.9, sizeAttenuation: true, fog: false }));
    group.add(stars);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(L.w, L.d) * 0.62, 6, 30, 16), new THREE.MeshLambertMaterial({ color: '#cfc98a' }));
    island.position.y = -15.05;
    group.add(island);
    return;
  }
  if (floor === 1) {
    // the venue on the horizon, glowing
    const venue = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#3c2a6e', { emissive: '#240046' }));
    dome.scale.y = 0.45;
    venue.add(dome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 0.8, 8, 64), glow('#ff4fa3'));
    ring.rotation.x = Math.PI / 2; ring.position.y = 2;
    venue.add(ring);
    venue.position.set(0, -2, -L.d / 2 - 90);
    group.add(venue);
    const beams = [];
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3, 120, 12, 1, true), new THREE.MeshBasicMaterial({ color: i % 2 ? '#4cc9f0' : '#ff4fa3', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      c.geometry.translate(0, 60, 0);
      c.position.set(-30 + i * 20, 0, -L.d / 2 - 90);
      group.add(c); beams.push(c);
    }
    animators.push((t) => beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.3 + i * 1.7) * 0.4; b.rotation.x = Math.cos(t * 0.25 + i) * 0.2; }));
    for (let i = 0; i < 30; i++) {
      const h = 10 + Math.random() * 40;
      const m = new THREE.Mesh(GEO.box, mat('#1b1433', { emissive: '#120d24' }));
      m.scale.set(8 + Math.random() * 10, h, 8);
      const a = (i / 30) * Math.PI * 2;
      m.position.set(Math.sin(a) * 160, h / 2 - 2, Math.cos(a) * 160);
      group.add(m);
    }
  }
  if (floor >= 2 && L.walls !== 'void') {
    // ceiling truss lights
    for (let i = -1; i <= 1; i++) {
      const l = addBox(group, L.w * 0.8, 0.12, 0.12, '#fff', 0, 9, i * L.d / 3, glow(floor === 2 ? '#e0aaff' : '#ff4fa3', 0.6));
      l.visible = true;
    }
  }
  if (L.surreal) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.max(L.w, L.d) * 0.9, 0.3, 8, 80), glow('#ff4fa3', 0.6));
    ring.rotation.x = Math.PI / 2; ring.position.y = 14;
    group.add(ring);
    const hearts = [];
    for (let i = 0; i < 14; i++) {
      const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(), { depth: 0.3, bevelEnabled: false }), glow(i % 2 ? '#ff4fa3' : '#c77dff', 0.8));
      hm.scale.setScalar(2 + Math.random() * 2);
      const a = (i / 14) * Math.PI * 2;
      hm.position.set(Math.sin(a) * (L.w * 0.75), 8 + Math.random() * 6, Math.cos(a) * (L.d * 0.75));
      group.add(hm); hearts.push(hm);
    }
    animators.push((t) => hearts.forEach((h, i) => { h.rotation.y = t * 0.5 + i; h.position.y += Math.sin(t + i) * 0.005; }));
  }
}

export { DOOR_W };
