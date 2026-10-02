// World-space Minecraft blocks: 16×16 pixel textures on cubes (ores, logs, leaves,
// netherrack, obsidian, end stone, stations, End Portal frames), with per-size texture
// repeats for the big blocks in Nether / End / stronghold layouts. Registers the 'mc'
// prop model so layouts can place them like any other prop.

import * as THREE from 'three';
import { ORES } from './data.js';
import { faceTex } from './icons.js';
import { registerPropModel } from '../world/props.js';

const texCache = new Map();
function tex(kind, colors, seed = 1, rx = 1, ry = 1) {
  const key = `${kind}|${colors.join(',')}|${seed}|${rx}|${ry}`;
  if (texCache.has(key)) return texCache.get(key);
  let t;
  const baseKey = `${kind}|${colors.join(',')}|${seed}|1|1`;
  if ((rx !== 1 || ry !== 1) && texCache.has(baseKey)) t = texCache.get(baseKey).clone();
  else t = new THREE.CanvasTexture(faceTex(kind, colors, seed, 16));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  texCache.set(key, t);
  return t;
}
const mats = new Map();
function lam(t, glowK = 0) {
  return new THREE.MeshLambertMaterial({ map: t, emissive: glowK ? '#ffffff' : '#000000', emissiveMap: glowK ? t : null, emissiveIntensity: glowK });
}

// Face spec for a block key: [kind, colours] for side / top / bottom.
function faces(key) {
  const o = ORES[key];
  if (key === 'craftingTable') return { side: ['planks', ['#b8945f']], front: ['furnace', ['#b8945f']], top: ['tabletop', ['#b8945f', '#6b4f2a']], bottom: ['planks', ['#8f7040']] };
  if (key === 'furnace') return { side: ['noise', ['#7b7b7b', '#5a5a5a', '#9a9a9a']], front: ['furnace', ['#7b7b7b']], top: ['noise', ['#6a6a6a', '#5a5a5a']] };
  if (key === 'enchantingTable') return { side: ['enchant', ['#1b1029']], top: ['noise', ['#dc2626', '#991b1b']], bottom: ['obsidian', ['#1b1029', '#3b2468']] };
  if (key === 'endFrame') return { side: ['endframe', ['#d9d3a0']], top: ['noise', ['#2f6b5f', '#1f4f45', '#e8e4a8']] };
  if (key === 'endFrameEye') return { side: ['endframe', ['#d9d3a0']], top: ['ore', ['#2f6b5f', '#a3e635']] };
  if (key === 'bedrock') return { side: ['noise', ['#4a4a4a', '#222222', '#777777']] };
  if (key === 'chest') return { side: ['planks', ['#a0732f']], top: ['planks', ['#a0732f']] };
  if (key === 'lava') return { side: ['lava', ['#f97316']], glow: 1 };
  if (key === 'netherPortal') return { side: ['noise', ['#7c3aed', '#a855f7', '#c084fc']], glow: 1 };
  if (!o) return { side: ['noise', ['#888888']] };
  const c = o.c;
  switch (o.tex) {
    case 'log': return { side: ['log', c], top: ['logtop', [c[0], c[1]]] };
    case 'grass': return { side: ['grassside', c], top: ['noise', [c[0], '#4a9a40', '#6cc060']], bottom: ['noise', [c[1], '#6e4520']] };
    case 'leaves': return { side: ['leaves', c] };
    case 'glow': return { side: ['glow', c], glow: 0.9 };
    case 'ore': return { side: ['ore', c] };
    case 'obsidian': return { side: ['obsidian', c] };
    case 'brick': return { side: ['brick', c] };
    default: return { side: ['noise', [c[0], c[1] || c[0]]] };
  }
}

// [px, nx, py, ny, pz, nz] materials, cached per key and size.
export function blockMats(key, w = 1, h = 1, d = 1) {
  const mk = `${key}|${w}|${h}|${d}`;
  if (mats.has(mk)) return mats.get(mk);
  const f = faces(key);
  const seed = key.length * 7 + key.charCodeAt(0);
  const T = (spec, rx, ry, s = 0) => tex(spec[0], spec[1], seed + s, rx, ry);
  const g = f.glow || 0;
  const side = (rx, ry, s) => lam(T(f.side, rx, ry, s), g);
  const top = lam(T(f.top || f.side, w, d, 3), g);
  const bottom = lam(T(f.bottom || f.top || f.side, w, d, 5), g);
  const front = f.front ? lam(T(f.front, w, h, 7), g) : null;
  const list = [side(d, h, 0), side(d, h, 1), top, bottom, front || side(w, h, 2), side(w, h, 4)];
  if (key === 'leaves') for (const m of list) { m.transparent = false; m.alphaTest = 0.1; }
  mats.set(mk, list);
  return list;
}

const unit = new THREE.BoxGeometry(1, 1, 1);
export function blockMesh(key, w = 1, h = 1, d = 1) {
  const geo = w === 1 && h === 1 && d === 1 ? unit : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, blockMats(key, w, h, d));
  m.userData.noMerge = true;
  if (geo === unit) m.geometry.userData.shared = true;
  return m;
}
export const UNIT_BOX = unit;

// Layout prop: { model: 'mc', mc: 'netherrack', w, h, d }
registerPropModel('mc', (g, o) => {
  const m = blockMesh(o.mc, o.w, o.h, o.d);
  m.position.y = o.h / 2;
  g.add(m);
});

// Animated lava pool surface (emissive, scrolling).
export function lavaSurface(w, d) {
  const t = tex('lava', ['#f97316'], 11, Math.max(1, Math.round(w)), Math.max(1, Math.round(d))).clone();
  t.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2;
  m.userData.lavaTex = t;
  return m;
}
