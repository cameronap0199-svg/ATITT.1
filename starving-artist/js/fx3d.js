// Atmosphere: drifting dust / ash particles, additive light shafts, paint decals and
// dripping paint. All camera-facing quads are rebuilt on the CPU (a few hundred at most).
import * as THREE from 'three';
import { mat } from './renderer.js';
import { canvas, toTex, rng } from './tex.js';

const texCache = {};
function fxTex(kind) {
  if (texCache[kind]) return texCache[kind];
  let c, g;
  if (kind === 'mote') {
    [c, g] = canvas(8, 8);
    const gr = g.createRadialGradient(4, 4, 0, 4, 4, 4);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 8);
  } else if (kind === 'flake') {
    [c, g] = canvas(8, 8);
    g.fillStyle = '#fff'; g.fillRect(2, 3, 4, 2); g.fillRect(3, 2, 2, 4); g.fillRect(1, 4, 1, 1); g.fillRect(6, 3, 1, 1);
  } else if (kind === 'shaft') {
    [c, g] = canvas(16, 64);
    for (let y = 0; y < 64; y++) {
      const v = y / 63;
      const a = Math.pow(Math.sin(v * Math.PI), 0.8) * (1 - v * 0.55);
      for (let x = 0; x < 16; x++) {
        const u = x / 15;
        const s = Math.pow(Math.sin(u * Math.PI), 1.6) * (0.8 + 0.2 * Math.sin(u * 23 + v * 3));
        g.fillStyle = `rgba(255,255,255,${a * s})`; g.fillRect(x, y, 1, 1);
      }
    }
  } else if (kind.startsWith('splat')) {
    [c, g] = canvas(32, 32);
    const r = rng(kind.length * 97 + (+kind.slice(5) || 1) * 31);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(16, 16, 7 + r() * 3, 0, 7); g.fill();
    for (let i = 0; i < 11; i++) {
      const a = r() * 6.28, d = 7 + r() * 8, s = 1 + r() * 3;
      g.beginPath(); g.arc(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, s, 0, 7); g.fill();
      g.fillRect(16 + Math.cos(a) * d * 0.6 - 0.5, 16 + Math.sin(a) * d * 0.6 - 0.5, 2, 2);
    }
  } else if (kind === 'foot') {
    [c, g] = canvas(16, 32);
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(8, 10, 5, 8, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(8, 25, 4, 5, 0, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) g.fillRect(3 + i * 3, 0, 2, 3);
  } else if (kind === 'drip') {
    [c, g] = canvas(16, 64);
    const r = rng(5);
    g.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) { const x = 1 + r() * 13, len = 10 + r() * 50; g.fillRect(x, 0, 2, len); g.beginPath(); g.arc(x + 1, len, 1.6, 0, 7); g.fill(); }
    g.fillRect(0, 0, 16, 6);
  }
  texCache[kind] = toTex(c, { repeat: false });
  return texCache[kind];
}

// ------------------------------------------------------------------ particles
// kind: 'dust' (warm additive motes), 'ash' (dark falling flakes), 'snow', 'spark'
export class Motes {
  constructor(scene, { count = 110, color = 0xfff0d8, size = 0.05, radius = 9, y0 = 0.2, y1 = 4.5, fall = 0, drift = 0.12, kind = 'dust', opacity = 0.75 } = {}) {
    this.n = count; this.size = size; this.radius = radius; this.y0 = y0; this.y1 = y1; this.fall = fall; this.drift = drift;
    this.p = new Float32Array(count * 3); this.v = new Float32Array(count * 3); this.ph = new Float32Array(count);
    this.center = new THREE.Vector3();
    this.seeded = false;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 18), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 18).fill(0), 3));
    const uv = new Float32Array(count * 12);
    const col = new Float32Array(count * 18);
    const cc = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      uv.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], i * 12);
      const k = 0.6 + Math.random() * 0.4;
      for (let j = 0; j < 6; j++) col.set([cc.r * k, cc.g * k, cc.b * k], i * 18 + j * 3);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const additive = kind === 'dust' || kind === 'spark';
    this.mat = mat({ map: fxTex(additive ? 'mote' : 'flake'), emissive: 1, additive, transparent: !additive, opacity, alphaTest: additive ? 0.01 : 0.4, dyn: 0 });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  spawn(i, around, anywhere) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.radius;
    this.p[i * 3] = around.x + Math.cos(a) * r;
    this.p[i * 3 + 1] = anywhere ? this.y0 + Math.random() * (this.y1 - this.y0) : this.y1;
    this.p[i * 3 + 2] = around.z + Math.sin(a) * r;
    this.v[i * 3] = (Math.random() - 0.5) * this.drift; this.v[i * 3 + 1] = -this.fall * (0.6 + Math.random() * 0.8); this.v[i * 3 + 2] = (Math.random() - 0.5) * this.drift;
    this.ph[i] = Math.random() * 6.28;
  }
  update(dt, t, cam) {
    const c = cam.position;
    if (!this.seeded) { for (let i = 0; i < this.n; i++) this.spawn(i, c, true); this.seeded = true; }
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const pos = this.mesh.geometry.attributes.position.array;
    const s = this.size;
    const R2 = this.radius * this.radius;
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      this.p[o] += (this.v[o] + Math.sin(t * 0.7 + this.ph[i]) * this.drift * 0.4) * dt;
      this.p[o + 1] += (this.v[o + 1] + Math.sin(t * 0.5 + this.ph[i] * 2) * 0.03) * dt;
      this.p[o + 2] += (this.v[o + 2] + Math.cos(t * 0.6 + this.ph[i]) * this.drift * 0.4) * dt;
      const dx = this.p[o] - c.x, dz = this.p[o + 2] - c.z;
      if (dx * dx + dz * dz > R2 || this.p[o + 1] < this.y0 || this.p[o + 1] > this.y1 + 0.5) this.spawn(i, c, this.fall === 0);
      const x = this.p[o], y = this.p[o + 1], z = this.p[o + 2];
      const tw = s * (0.7 + 0.3 * Math.sin(t * 3 + this.ph[i]));
      const rx = right.x * tw, ry = right.y * tw, rz = right.z * tw, ux = up.x * tw, uy = up.y * tw, uz = up.z * tw;
      const q = i * 18;
      pos[q] = x - rx - ux; pos[q + 1] = y - ry - uy; pos[q + 2] = z - rz - uz;
      pos[q + 3] = x + rx - ux; pos[q + 4] = y + ry - uy; pos[q + 5] = z + rz - uz;
      pos[q + 6] = x + rx + ux; pos[q + 7] = y + ry + uy; pos[q + 8] = z + rz + uz;
      pos[q + 9] = pos[q]; pos[q + 10] = pos[q + 1]; pos[q + 11] = pos[q + 2];
      pos[q + 12] = pos[q + 6]; pos[q + 13] = pos[q + 7]; pos[q + 14] = pos[q + 8];
      pos[q + 15] = x - rx + ux; pos[q + 16] = y - ry + uy; pos[q + 17] = z - rz + uz;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ light shafts
export function lightShaft(w, h, color = 0xfff0d8, opacity = 0.18) {
  const g = new THREE.Group();
  const m = mat({ map: fxTex('shaft'), color, emissive: 1, additive: true, opacity, side: THREE.DoubleSide, dyn: 0 });
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(w, h);
    const n = geo.getAttribute('position').count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    const p = new THREE.Mesh(geo, m);
    p.rotation.y = i * Math.PI / 3;
    p.position.y = h / 2;
    p.userData.noBake = true;
    g.add(p);
  }
  g.userData.mat = m;
  g.userData.base = opacity;
  return g;
}

// ------------------------------------------------------------------ decals
const decalMats = new Map();
function decalMat(kind, color) {
  const k = kind + color;
  if (!decalMats.has(k)) decalMats.set(k, mat({ map: fxTex(kind), color, alphaTest: 0.5, dyn: 0.35 }));
  return decalMats.get(k);
}
export function clearDecalCache() { decalMats.clear(); }

// A flat decal lying on the floor (or a wall when ry/normal given). kind: splat1..4, foot, drip
export function decal(kind, size, color, { wall = false } = {}) {
  const geo = new THREE.PlaneGeometry(size * (kind === 'foot' ? 0.5 : kind === 'drip' ? 0.5 : 1), size * (kind === 'drip' ? 2 : 1));
  const n = geo.getAttribute('position').count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  const m = new THREE.Mesh(geo, decalMat(kind, color));
  if (!wall) m.rotation.x = -Math.PI / 2;
  m.userData.noBake = true;
  m.renderOrder = 1;
  return m;
}

// Paint footprints that fade after a while (Alienate leaves these).
export class Trail {
  constructor(scene, max = 40, color = 0x0a0608, level = null) {
    this.scene = scene; this.max = max; this.color = color; this.list = []; this.side = 0; this.level = level;
  }
  step(pos, yaw) {
    const d = decal('foot', 0.55, this.color);
    const off = this.side ? 0.13 : -0.13; this.side ^= 1;
    d.position.set(pos.x + Math.cos(yaw) * off, 0.012 + this.list.length * 0.00002, pos.z - Math.sin(yaw) * off);
    d.rotation.z = yaw + Math.PI;
    this.scene.add(d);
    if (this.level) this.level.bakeObject(d);
    this.list.push(d);
    if (this.list.length > this.max) this.scene.remove(this.list.shift());
  }
  clear() { for (const d of this.list) this.scene.remove(d); this.list = []; }
}
