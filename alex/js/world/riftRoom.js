// A rift in a live room: the swirling portal, franchise theming (Overworld blocks,
// plagues of hail and darkness, drop-pod flashes), the banner, and the reward when
// the rift closes.

import * as THREE from 'three';
import { G } from '../state.js';
import { RIFTS } from './rifts.js';
import { mat, glow } from './props.js';
import { placeBlock } from '../mc/world.js';

const ringGeo = new THREE.TorusGeometry(1.6, 0.16, 10, 48);
const discGeo = new THREE.CircleGeometry(1.55, 40);

function swirlTexture(c1, c2) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, c1); gr.addColorStop(0.75, c2); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.12 + i * 0.03})`; g.lineWidth = 6;
    g.beginPath();
    for (let a = 0; a < Math.PI * 3; a += 0.1) { const r = 6 + a * 13; const x = 128 + Math.cos(a + i * 0.9) * r, y = 128 + Math.sin(a + i * 0.9) * r; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function openRift(room) {
  const r = room.def.rift;
  const R = RIFTS[r.id];
  const a = G.alex;
  const spot = room.world.openPoint(room.rng, [{ x: a.pos.x, z: a.pos.z, r: 9 }], 9, 0.6, 3.5) || { x: 0, z: 0 };
  const g = new THREE.Group();
  g.position.set(spot.x, 0, spot.z);
  const tex = swirlTexture(R.color, R.color2);
  const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }));
  const ring = new THREE.Mesh(ringGeo, glow(R.color));
  const ring2 = new THREE.Mesh(ringGeo, glow(R.color2));
  ring2.scale.setScalar(1.12);
  const pivot = new THREE.Group();
  pivot.position.y = 1.9;
  pivot.rotation.y = Math.atan2(-spot.x, -spot.z);
  pivot.add(disc, ring, ring2);
  g.add(pivot);
  const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.MeshBasicMaterial({ color: R.color, transparent: true, opacity: 0.35, depthWrite: false }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = 0.03;
  g.add(floorGlow);
  const light = new THREE.PointLight(R.color, 2.2, 16, 1.6);
  light.position.y = 2;
  g.add(light);
  g.scale.setScalar(0.01);
  room.group.add(g);
  room.rift = { ...r, def: R, x: spot.x, z: spot.z, group: g, disc, ring, ring2, pivot, floorGlow, tex, t: 0, hailT: 2, closing: 0 };
  // franchise theming
  if (r.id === 'minecraft') placeBlocks(room, spot);
  if (r.plague === 'darkness') document.body.classList.add('plague-dark');
  G.hud.riftBanner(room.rift);
  G.audio.sfx('static', { v: 0.35 });
  G.audio.sfx('roar', { v: 0.35 });
  G.cam.shake(0.3);
  G.run.stat('riftsOpened', 1);
}

// Real Overworld blocks scattered around: grass, dirt, stone, sand, ores and the odd
// tree. Vaultable cover; mine them for materials.
function placeBlocks(room, spot) {
  const kinds = ['grass', 'grass', 'dirt', 'stone', 'stone', 'sand', 'coalOre', 'ironOre', 'gravel', room.floor >= 2 ? 'goldOre' : 'coalOre', room.floor >= 3 ? 'diamondOre' : 'ironOre'];
  const n = 7 + Math.floor(room.rng() * 7);
  const avoid = [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 3 }, { x: spot.x, z: spot.z, r: 3 }];
  for (const d of room.doors) avoid.push({ x: d.x, z: d.z, r: 3 });
  for (let i = 0; i < n; i++) {
    const p = room.world.openPoint(room.rng, avoid, 2, 0.4, 3);
    if (!p) continue;
    avoid.push({ x: p.x, z: p.z, r: 1.6 });
    const x = Math.round(p.x), z = Math.round(p.z);
    const key = room.rng.pick(kinds);
    const stack = room.rng() < 0.3 ? 2 : 1;
    for (let k = 0; k < stack; k++) placeBlock(room, k === 1 && key === 'grass' ? 'grass' : key === 'grass' && stack === 2 && k === 0 ? 'dirt' : key, x, z, k);
  }
  room.world.buildNav();
}

export function updateRift(room, dt) {
  const r = room.rift;
  if (!r) return;
  r.t += dt;
  const live = !room.cleared;
  const target = r.closing ? Math.max(0, 1 - r.closing) : Math.min(1, r.t / 0.6);
  if (r.closing) r.closing += dt * 1.4;
  const s = target * (1 + Math.sin(r.t * 3) * 0.03);
  r.group.scale.setScalar(Math.max(0.01, s));
  r.disc.rotation.z -= dt * 2.4;
  r.ring.rotation.z += dt * 1.2;
  r.ring2.rotation.x = Math.sin(r.t * 1.3) * 0.3;
  r.floorGlow.material.opacity = 0.25 + 0.15 * Math.sin(r.t * 4);
  if (Math.random() < dt * 14) G.fx.burst(r.x + (Math.random() - 0.5) * 2, 1.9 + (Math.random() - 0.5) * 2.4, r.z + (Math.random() - 0.5) * 2, { n: 1, color: [r.def.color, r.def.color2, '#ffffff'], speed: 1.2, up: 0.6, life: 0.8, size: 0.14, grav: -0.6 });
  // plague of hail: random telegraphed strikes around Alex while the fight lasts
  if (live && r.plague === 'hail' && room.combatLive()) {
    r.hailT -= dt;
    if (r.hailT <= 0) {
      r.hailT = 1.1 + Math.random() * 0.8;
      const a = G.alex, ang = Math.random() * Math.PI * 2, d = Math.random() * 7;
      G.areas.circle({ x: a.pos.x + Math.sin(ang) * d, z: a.pos.z + Math.cos(ang) * d, r: 1.3, delay: 1.1, dmg: 8, ff: true, enemyDmg: 10, owner: 'hazard', color: '#bae6fd', fxColor: '#e0f2fe', style: 'flash', sound: 'crack', shake: 0.1, propDmg: 5 });
    }
  }
  if (r.closing >= 1 && r.group.parent) { r.group.parent.remove(r.group); r.tex.dispose(); }
}

export function closeRift(room) {
  const r = room.rift;
  if (!r || r.closing) return;
  r.closing = 0.001;
  document.body.classList.remove('plague-dark');
  G.hud.popup(`RIFT CLOSED — ${r.def.name} LOOT`, r.def.color, 1.6);
  G.audio.sfx('clear');
  G.fx.burst(r.x, 1.9, r.z, { n: 50, color: [r.def.color, r.def.color2, '#ffffff'], speed: 9, life: 0.9 });
  room.riftReward?.(r);
}

export function disposeRift(room) {
  document.body.classList.remove('plague-dark');
  if (room.rift?.tex) room.rift.tex.dispose();
}
