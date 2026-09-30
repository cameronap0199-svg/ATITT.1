// Procedural prop meshes. Each factory builds in local space where the collision box
// spans x∈[-w/2,w/2], y∈[0,h], z∈[-d/2,d/2]; the caller positions / rotates the group.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared materials & textures
// ---------------------------------------------------------------------------
let gradient = null;
export function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 220, 220, 220, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
    matCache.set(key, m);
  }
  return m;
}
export function glow(color, opacity = 1) {
  const key = 'glow' + color + opacity;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    matCache.set(key, m);
  }
  return m;
}
const texCache = new Map();
export function textTexture(text, { bg = '#111', fg = '#fff', w = 512, h = 128, font = 'bold 64px "Bungee", "Arial Black", sans-serif', border = null } = {}) {
  const key = [text, bg, fg, w, h, font, border].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = parseInt(/(\d+)px/.exec(font)[1], 10);
  g.font = font;
  while (g.measureText(text).width > w * 0.9 && size > 12) { size -= 4; g.font = font.replace(/\d+px/, size + 'px'); }
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  sph: new THREE.SphereGeometry(0.5, 12, 8),
  cone4: new THREE.ConeGeometry(0.72, 1, 4),
};
export const GEO = G;

// Helpers: add a box / cylinder in local space (y = bottom).
function bx(g, w, h, d, color, x = 0, y = 0, z = 0, m) {
  const mesh = new THREE.Mesh(G.box, m || mat(color));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}
function cy(g, r, h, color, x = 0, y = 0, z = 0, m, geo = G.cyl) {
  const mesh = new THREE.Mesh(geo, m || mat(color));
  mesh.scale.set(r * 2, h, r * 2);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}
function label(g, text, w, h, x, y, z, ry = 0, opts = {}) {
  const t = textTexture(text, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: !opts.bg }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  g.add(m);
  return m;
}
const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
};

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
const M = {
  box(g, o) { bx(g, o.w, o.h, o.d, o.color); },
  block(g, o) { bx(g, o.w, o.h, o.d, o.color); bx(g, o.w + 0.05, 0.25, o.d + 0.05, shade(o.color, 0.6)); if (o.label) label(g, o.label, 3, 0.8, 0, o.h * 0.7, o.d / 2 + 0.03, 0, { bg: '#fff', fg: '#222' }); },
  core(g, o) { bx(g, o.w, o.h, o.d, o.color); for (const s of [-1, 1]) { label(g, 'SECTION 1' + (s > 0 ? '04' : '12'), 5, 1, 0, 2.5, s * (o.d / 2 + 0.03), s > 0 ? 0 : Math.PI, { bg: '#1d3557', fg: '#f1faee' }); } },
  restroom(g, o) { M.block(g, o); },
  wall(g, o) { bx(g, o.w, o.h, o.d, o.color); bx(g, o.w + 0.04, 0.12, o.d, shade(o.color, 1.3), 0, o.h - 0.12); },
  curtain(g, o) { bx(g, o.w, o.h, o.d, o.color); for (let z = -o.d / 2 + 0.3; z < o.d / 2; z += 0.6) bx(g, o.w + 0.1, o.h, 0.18, shade(o.color, 1.25), 0, 0, z); },
  shirtwall(g, o) {
    const cols = ['#ff8fab', '#a0c4ff', '#caffbf', '#ffd6a5', '#bdb2ff', '#fdffb6'];
    const nx = Math.max(1, Math.round(o.w / 0.9)), nz = Math.max(1, Math.round(o.d / 0.9)), ny = Math.round(o.h / 0.45);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      if (i > 0 && i < nx - 1 && k > 0 && k < nz - 1) continue;
      bx(g, o.w / nx * 0.96, 0.43, o.d / nz * 0.96, cols[(i + j * 2 + k) % cols.length], -o.w / 2 + (i + 0.5) * o.w / nx, j * 0.45, -o.d / 2 + (k + 0.5) * o.d / nz);
    }
  },
  platform(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    bx(g, o.w + 0.02, 0.08, o.d + 0.02, '#ffd166', 0, o.h - 0.04);
  },
  step(g, o) { bx(g, o.w, o.h, o.d, o.color); bx(g, o.w, 0.04, 0.1, '#ffd166', 0, o.h - 0.02, o.d / 2 - 0.05); },
  tier(g, o) { bx(g, o.w, o.h, o.d, o.color); bx(g, o.w, 0.05, 0.08, '#e9c46a', 0, o.h - 0.03, -o.d / 2 + 0.04); },
  seatrow(g, o) {
    bx(g, o.w, 0.28, 0.45, o.color, 0, 0.18, 0.02);
    bx(g, o.w, 0.45, 0.08, shade(o.color, 0.8), 0, 0.18, 0.24);
    bx(g, o.w - 0.1, 0.18, 0.08, '#333', 0, 0, 0);
  },
  car(g, o) {
    const w = o.w, d = o.d;
    bx(g, w, 0.62, d, o.color, 0, 0.25);
    bx(g, w * 0.88, 0.52, d * 0.5, o.color, 0, 0.87, -d * 0.05);
    bx(g, w * 0.9, 0.42, d * 0.44, '#1e2a3a', 0, 0.92, -d * 0.05, mat('#243b55', { emissive: '#0b1320' }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wheel = cy(g, 0.33, 0.24, '#111', sx * (w / 2 - 0.05), 0.0, sz * d * 0.32);
      wheel.rotation.z = Math.PI / 2; wheel.position.y = 0.33;
    }
    for (const sx of [-1, 1]) {
      bx(g, 0.35, 0.14, 0.05, '#fff', sx * (w / 2 - 0.3), 0.6, d / 2, glow('#fff8d6'));
      bx(g, 0.35, 0.12, 0.05, '#f00', sx * (w / 2 - 0.3), 0.6, -d / 2, glow('#ff2244'));
    }
  },
  bus(g, o) {
    bx(g, o.w, o.h - 0.4, o.d, o.color, 0, 0.4);
    bx(g, o.w + 0.02, 0.9, o.d - 1.4, '#1b263b', 0, 1.8, -0.2, mat('#1b263b', { emissive: '#3a0ca3' }));
    for (const s of [-1, 1]) label(g, 'PARTY BUS ♥', 7, 1.1, s * (o.w / 2 + 0.02), 1.05, 0, s * Math.PI / 2, { bg: null, fg: '#fff' });
    for (const z of [-o.d * 0.35, o.d * 0.35]) for (const s of [-1, 1]) { const w = cy(g, 0.5, 0.35, '#111', s * o.w / 2, 0, z); w.rotation.z = Math.PI / 2; w.position.y = 0.5; }
  },
  truck(g, o) {
    bx(g, o.w, o.h - 0.5, o.d * 0.72, o.color, 0, 0.5, -o.d * 0.14);
    bx(g, o.w, 1.6, o.d * 0.26, shade(o.color, 0.85), 0, 0.5, o.d * 0.36);
    bx(g, 0.05, 1.0, o.d * 0.4, '#333', o.w / 2, 1.5, -o.d * 0.14, glow('#ffe8a3'));
    bx(g, 0.8, 0.06, o.d * 0.45, '#e63946', o.w / 2 + 0.4, 2.55, -o.d * 0.14);
    for (const z of [-o.d * 0.35, o.d * 0.3]) for (const s of [-1, 1]) { const w = cy(g, 0.45, 0.3, '#111', s * o.w / 2, 0, z); w.rotation.z = Math.PI / 2; w.position.y = 0.45; }
  },
  barrier(g, o) {
    bx(g, o.w, 0.35, o.d, o.color);
    bx(g, o.w * 0.45, o.h - 0.35, o.d, o.color, 0, 0.35);
    for (let z = -o.d / 2 + 0.3; z < o.d / 2; z += 0.9) bx(g, o.w * 0.47, 0.16, 0.45, '#e63946', 0, o.h - 0.3, z);
  },
  rail(g, o) {
    bx(g, 0.08, 0.08, o.d, o.color, 0, o.h - 0.08);
    bx(g, 0.05, 0.05, o.d, o.color, 0, o.h * 0.5);
    for (let z = -o.d / 2; z <= o.d / 2 + 0.01; z += 1.5) cy(g, 0.04, o.h, o.color, 0, 0, z);
  },
  corral(g, o) { M.rail(g, { ...o, d: o.d }); bx(g, o.w, 0.05, o.d, o.color, 0, o.h - 0.05); },
  tent(g, o) {
    const c = o.color;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(g, 0.05, o.h - 0.4, '#ddd', sx * (o.w / 2 - 0.05), 0, sz * (o.d / 2 - 0.05));
    const roof = new THREE.Mesh(G.cone4, mat(c));
    roof.scale.set(o.w * 0.98, 0.9, o.d * 0.98);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = o.h - 0.4 + 0.45;
    g.add(roof);
    bx(g, o.w, 0.25, o.d, shade(c, 0.85), 0, o.h - 0.55);
    // fabric walls on three sides (the fourth side is open and dark)
    bx(g, o.w - 0.1, o.h - 0.7, 0.05, shade(c, 1.15), 0, 0.1, -o.d / 2 + 0.05);
    bx(g, 0.05, o.h - 0.7, o.d - 0.1, shade(c, 1.1), -o.w / 2 + 0.05, 0.1, 0);
    bx(g, 0.05, o.h - 0.7, o.d - 0.1, shade(c, 1.1), o.w / 2 - 0.05, 0.1, 0);
    bx(g, o.w - 0.1, o.h - 0.7, 0.05, '#1a1a2e', 0, 0.1, o.d / 2 - 0.05);
  },
  table(g, o) {
    bx(g, o.w, 0.07, o.d, o.color, 0, o.h - 0.07);
    for (const sz of [-1, 1]) bx(g, o.w * 0.8, o.h - 0.07, 0.06, '#666', 0, 0, sz * (o.d / 2 - 0.2));
  },
  chair(g, o) {
    bx(g, o.w, 0.06, o.d, o.color, 0, 0.42);
    bx(g, o.w, 0.45, 0.05, o.color, 0, 0.45, -o.d / 2 + 0.03);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.04, 0.42, 0.04, '#444', sx * (o.w / 2 - 0.05), 0, sz * (o.d / 2 - 0.05));
  },
  cooler(g, o) { bx(g, o.w, o.h * 0.8, o.d, o.color); bx(g, o.w + 0.02, o.h * 0.2, o.d + 0.02, '#f1faee', 0, o.h * 0.8); },
  speaker(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    const n = Math.max(1, Math.round(o.h / 0.8));
    for (let i = 0; i < n; i++) {
      const cone = cy(g, 0.32, 0.06, '#333', 0, 0, o.d / 2 + 0.01);
      cone.rotation.x = Math.PI / 2; cone.position.y = (i + 0.5) * (o.h / n);
      const c2 = cy(g, 0.12, 0.08, '#555', 0, 0, o.d / 2 + 0.03);
      c2.rotation.x = Math.PI / 2; c2.position.y = (i + 0.5) * (o.h / n);
    }
  },
  pillar(g, o) { bx(g, o.w, o.h, o.d, o.color); bx(g, o.w + 0.2, 0.3, o.d + 0.2, shade(o.color, 0.7)); bx(g, o.w + 0.2, 0.3, o.d + 0.2, shade(o.color, 0.7), 0, o.h - 0.3); },
  rack(g, o) {
    bx(g, 0.06, 0.06, o.d, '#aaa', 0, o.h - 0.06);
    for (const sz of [-1, 1]) cy(g, 0.03, o.h, '#aaa', 0, 0, sz * (o.d / 2 - 0.05));
    const cols = ['#ff5d8f', '#fff', '#111', '#4cc9f0', '#ffd166', '#b5179e'];
    for (let z = -o.d / 2 + 0.25; z < o.d / 2 - 0.1; z += 0.22) bx(g, 0.55, 0.85, 0.08, cols[Math.floor((z + 9) * 7) % cols.length], 0, o.h - 1.0, z);
  },
  shelf(g, o) {
    bx(g, o.w, o.h, 0.08, o.color, 0, 0, 0);
    const levels = Math.max(2, Math.round(o.h / 0.55));
    const cols = ['#ff006e', '#fb5607', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0'];
    for (let i = 0; i < levels; i++) {
      bx(g, o.w, 0.05, o.d, shade(o.color, 1.2), 0, (i / levels) * o.h + 0.05);
      for (let z = -o.d / 2 + 0.3; z < o.d / 2 - 0.2; z += 0.45) bx(g, o.w * 0.35, 0.3, 0.3, cols[(i * 5 + Math.floor(z * 3 + 30)) % cols.length], (i % 2 ? 0.25 : -0.25), (i / levels) * o.h + 0.1, z);
    }
  },
  counter(g, o) { bx(g, o.w, o.h - 0.06, o.d, o.color); bx(g, o.w + 0.12, 0.06, o.d + 0.1, shade(o.color, 0.75), 0, o.h - 0.06); },
  stall(g, o) {
    bx(g, o.w, 1.05, o.d * 0.6, '#f1faee', 0, 0, o.d * 0.2);
    bx(g, o.w, o.h - 0.4, 0.1, shade(o.color, 0.8), 0, 0, -o.d / 2 + 0.05);
    for (const sx of [-1, 1]) cy(g, 0.05, o.h - 0.3, '#ddd', sx * (o.w / 2 - 0.05), 0, o.d / 2 - 0.05);
    for (let i = 0; i < 6; i++) bx(g, o.w / 6, 0.12, o.d + 0.4, i % 2 ? '#fff' : o.color, -o.w / 2 + (i + 0.5) * (o.w / 6), o.h - 0.35, 0.2);
    if (o.label) label(g, o.label, o.w * 0.95, 0.55, 0, o.h - 0.55, o.d / 2 + 0.43, 0, { bg: o.color, fg: '#fff' });
  },
  toilet(g, o) {
    bx(g, o.w, o.h - 0.2, o.d, o.color);
    bx(g, o.w + 0.1, 0.2, o.d + 0.1, '#f1faee', 0, o.h - 0.2);
    bx(g, o.w * 0.7, o.h - 0.5, 0.04, shade(o.color, 0.8), 0, 0.15, o.d / 2 + 0.01);
    bx(g, 0.25, 0.1, 0.02, '#e63946', 0.1, 1.3, o.d / 2 + 0.04);
  },
  turnstile(g, o) {
    bx(g, o.w, o.h, o.d * 0.6, '#adb5bd');
    for (let i = 0; i < 3; i++) { const a = bx(g, 0.05, 0.05, 0.75, '#dee2e6', 0, o.h - 0.15, o.d * 0.3 + 0.35); a.rotation.x = (i * Math.PI * 2) / 3 * 0.35; }
    bx(g, o.w * 0.6, 0.08, 0.2, '#0f0', 0, o.h, 0, glow('#3cff8f'));
  },
  detpost(g, o) { bx(g, o.w, o.h, o.d, o.color); bx(g, o.w + 0.02, 0.3, o.d * 0.6, '#222', 0, o.h - 0.5, 0, glow('#ff4d6d')); },
  planter(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    const s = new THREE.Mesh(G.sph, mat('#2d6a4f')); s.scale.set(o.w * 0.9, o.w * 0.6, o.d * 0.9); s.position.y = o.h + o.w * 0.2; g.add(s);
  },
  crate(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    for (const s of [-1, 1]) bx(g, o.w + 0.02, 0.1, 0.1, shade(o.color, 0.7), 0, o.h * 0.5, s * (o.d / 2 - 0.05));
    bx(g, o.w + 0.02, 0.08, o.d + 0.02, shade(o.color, 0.7), 0, o.h - 0.08);
  },
  roadcase(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    for (const y of [0, o.h - 0.06]) bx(g, o.w + 0.03, 0.06, o.d + 0.03, '#ced4da', 0, y);
    label(g, 'FRAGILE ♥', o.d * 0.8, 0.3, o.w / 2 + 0.02, o.h * 0.55, 0, Math.PI / 2, { bg: null, fg: '#ffd166' });
  },
  couch(g, o) {
    bx(g, o.w, 0.45, o.d, o.color);
    bx(g, 0.25, 0.85, o.d, shade(o.color, 0.85), -o.w / 2 + 0.12);
    for (const s of [-1, 1]) bx(g, o.w, 0.65, 0.2, shade(o.color, 0.9), 0, 0, s * (o.d / 2 - 0.1));
  },
  mannequin(g, o) {
    const body = cy(g, 0.14, 0.4, o.color, 0, 0.15, 0); body.rotation.z = 1.3; body.position.y = 0.2;
    const h = new THREE.Mesh(G.sph, mat(o.color)); h.scale.setScalar(0.2); h.position.set(0.3, 0.22, 0); g.add(h);
    bx(g, 0.3, 0.12, 0.3, '#555');
  },
  cable(g, o) { for (let i = 0; i < 3; i++) { const c = cy(g, 0.06, o.d, '#111', (i - 1) * 0.1, 0.03, 0); c.rotation.x = Math.PI / 2; c.position.y = 0.07; } },
  truss(g, o) {
    for (const sx of [-1, 1]) for (const sy of [0, 1]) bx(g, 0.06, 0.06, o.d, o.color, sx * (o.w / 2 - 0.03), sy * (o.h - 0.06));
    for (let z = -o.d / 2; z < o.d / 2; z += 0.6) { const r = bx(g, 0.04, o.h, 0.04, o.color, 0, 0, z); r.rotation.z = 0.7; }
  },
  desk(g, o) { M.table(g, o); bx(g, 0.1, 0.4, 0.6, '#222', 0, o.h, 0); bx(g, 0.02, 0.32, 0.52, '#000', 0.06, o.h + 0.04, 0, glow('#4cc9f0')); },
  cabinet(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    for (let i = 0; i < 6; i++) bx(g, 0.02, 0.06, 0.06, '#0f0', o.w / 2 + 0.01, 0.6 + i * 0.22, -0.4 + (i % 3) * 0.3, glow(i % 2 ? '#3cff8f' : '#ff4d6d'));
  },
  console(g, o) {
    bx(g, o.w, o.h - 0.2, o.d, o.color);
    const top = bx(g, o.w, 0.2, o.d, '#212529', 0, o.h - 0.2); top.rotation.z = 0.2;
    for (let i = 0; i < 10; i++) bx(g, 0.08, 0.05, 0.08, '#fff', -0.2 + (i % 2) * 0.3, o.h, -o.d / 2 + 0.3 + i * (o.d - 0.6) / 10, glow(['#f72585', '#4cc9f0', '#ffd166'][i % 3]));
  },
  vanity(g, o) {
    M.table(g, o);
    bx(g, 0.05, 0.9, o.d * 0.8, '#fff', -o.w / 2 + 0.05, o.h, 0, mat('#caf0f8', { emissive: '#1d3557' }));
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(G.sph, glow('#fff3b0')); s.scale.setScalar(0.12); s.position.set(-o.w / 2 + 0.08, o.h + 0.95, -o.d * 0.4 + i * o.d * 0.2); g.add(s); }
  },
  fountain(g, o) { bx(g, o.w, o.h, o.d, o.color); bx(g, o.w * 0.8, 0.1, o.d * 0.8, '#4cc9f0', 0, o.h, 0, glow('#90e0ef')); },
  grill(g, o) {
    bx(g, o.w, 0.2, o.d, o.color, 0, o.h - 0.25);
    for (const sx of [-1, 1]) bx(g, 0.05, o.h - 0.25, 0.05, '#555', sx * (o.w / 2 - 0.1), 0, 0);
    bx(g, o.w * 0.9, 0.04, o.d * 0.85, '#f00', 0, o.h - 0.05, 0, glow('#ff7b00'));
  },
  stanchion(g, o) { cy(g, 0.03, o.h, o.color); cy(g, 0.15, 0.05, o.color); const s = new THREE.Mesh(G.sph, mat(o.color)); s.scale.setScalar(0.1); s.position.y = o.h; g.add(s); },
  kiosk(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    bx(g, o.w * 0.8, 0.6, 0.03, '#000', 0, o.h * 0.5, o.d / 2 + 0.01, glow('#4cc9f0'));
    if (o.label) label(g, o.label, o.w * 0.9, 0.3, 0, o.h - 0.25, o.d / 2 + 0.03, 0, { bg: o.color, fg: '#fff' });
  },
  bigheart(g, o) { extruded(g, heartShape(), o.w, o.h, o.d, o.color); },
  bigstar(g, o) { extruded(g, starShape(), o.w, o.h, o.d, o.color); },
  lift(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    for (let i = 0; i < 8; i++) bx(g, o.w / 16, 0.02, o.d, '#111', -o.w / 2 + (i * 2 + 0.5) * o.w / 16, o.h);
  },
  bin(g, o) { bx(g, o.w, o.h, o.d, o.color); },
  scalper(g, o) { figure(g, '#1b1b1b', '#e0ac69', 'TIX?'); },
  cashier(g, o) { figure(g, '#e76f51', '#c68642', null); },
  tripod(g, o) {
    for (let i = 0; i < 3; i++) { const l = bx(g, 0.04, 1.8, 0.04, '#222', Math.sin(i * 2.1) * 0.3, 0, Math.cos(i * 2.1) * 0.3); l.rotation.set(Math.cos(i * 2.1) * 0.18, 0, -Math.sin(i * 2.1) * 0.18); }
    bx(g, 0.5, 0.35, 0.7, '#111', 0, 1.75);
    const lens = cy(g, 0.15, 0.3, '#333', 0, 1.8, 0.45); lens.rotation.x = Math.PI / 2; lens.position.y = 1.92;
    bx(g, 0.08, 0.08, 0.02, '#f00', 0.18, 2.05, 0.36, glow('#ff0033'));
  },
  lightcube(g, o) { bx(g, o.w, o.h, o.d, o.color, 0, 0, 0, mat(o.color, { emissive: '#f7b267', emissiveIntensity: 0.6 })); },
  giantmic(g, o) {
    cy(g, 0.12, o.h - 0.9, '#6c757d', 0, 0, 0);
    const head = new THREE.Mesh(G.sph, mat('#ced4da')); head.scale.set(1.0, 1.2, 1.0); head.position.y = o.h - 0.5; g.add(head);
    cy(g, 0.6, 0.1, '#343a40', 0, 0, 0);
  },
  fridge(g, o) {
    bx(g, o.w, o.h, o.d, '#dee2e6');
    const n = Math.round(o.d / 1.25);
    for (let i = 0; i < n; i++) {
      bx(g, 0.04, o.h - 0.4, o.d / n - 0.1, '#caf0f8', -o.w / 2 - 0.01, 0.2, -o.d / 2 + (i + 0.5) * o.d / n, mat('#caf0f8', { emissive: '#48cae4', emissiveIntensity: 0.5 }));
      for (let j = 0; j < 4; j++) bx(g, 0.2, 0.25, 0.8, ['#e63946', '#2a9d8f', '#ffb703', '#8338ec'][(i + j) % 4], -o.w / 2 + 0.2, 0.35 + j * 0.5, -o.d / 2 + (i + 0.5) * o.d / n);
    }
  },
  lockedcase(g, o) {
    bx(g, o.w, 0.9, o.d, '#495057');
    bx(g, o.w * 0.9, o.h - 0.9, o.d * 0.95, '#caf0f8', 0, 0.9, 0, new THREE.MeshToonMaterial({ color: '#caf0f8', transparent: true, opacity: 0.35, gradientMap: toonGradient() }));
    label(g, 'LOCKED — ASK CASHIER', o.d * 0.9, 0.3, o.w / 2 + 0.02, 0.6, 0, Math.PI / 2, { bg: '#000', fg: '#ffd60a' });
  },
  lottery(g, o) {
    bx(g, o.w, o.h, o.d, o.color);
    label(g, 'K-POP MEGA MILLIONS', o.w * 0.95, 0.35, 0, o.h - 0.3, o.d / 2 + 0.02, 0, { bg: '#d00000', fg: '#fff' });
    bx(g, o.w * 0.7, 0.5, 0.03, '#000', 0, o.h * 0.45, o.d / 2 + 0.01, glow('#ffd60a'));
  },
  backwall(g, o) {
    bx(g, o.w, o.h, o.d, '#6d597a');
    label(g, 'PREMIUM SELECTION', o.w * 0.8, 0.5, 0, o.h - 0.35, -o.d / 2 - 0.02, Math.PI, { bg: '#ffb703', fg: '#240046' });
  },
  register(g, o) { bx(g, 0.5, 0.25, 0.4, '#222'); bx(g, 0.35, 0.2, 0.03, '#000', 0, 0.25, 0.1, glow('#3cff8f')); },
};

function figure(g, coat, skin, sign) {
  cy(g, 0.28, 1.05, coat, 0, 0.1, 0);
  const head = new THREE.Mesh(G.sph, mat(skin)); head.scale.setScalar(0.42); head.position.y = 1.4; g.add(head);
  bx(g, 0.36, 0.08, 0.1, '#000', 0, 1.42, 0.17);
  for (const s of [-1, 1]) bx(g, 0.1, 0.5, 0.1, coat, s * 0.2, 0, 0);
  if (sign) label(g, sign, 0.6, 0.3, 0, 1.0, 0.32, 0, { bg: '#fff', fg: '#111' });
}

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.1, -0.35, -0.5, -0.1, -0.5, 0.15);
  s.bezierCurveTo(-0.5, 0.4, -0.25, 0.5, 0, 0.3);
  s.bezierCurveTo(0.25, 0.5, 0.5, 0.4, 0.5, 0.15);
  s.bezierCurveTo(0.5, -0.1, 0.1, -0.35, 0, -0.5);
  return s;
}
function starShape() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.22 : 0.5, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}
export { heartShape, starShape };
function extruded(g, shape, w, h, d, color) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geo.translate(0, 0.5, -0.5);
  const m = new THREE.Mesh(geo, mat(color, { emissive: color, emissiveIntensity: 0.25 }));
  m.scale.set(w, h, d);
  g.add(m);
}

export function buildProp(o) {
  const g = new THREE.Group();
  (M[o.model] || M.box)(g, o);
  collapse(g);
  g.position.set(o.x, o.y0 || 0, o.z);
  g.rotation.y = o.rot || 0;
  return g;
}
export { bx as addBox, cy as addCyl, label as addLabel, shade };

// ---------------------------------------------------------------------------
// Draw-call reduction: merge meshes that share a material inside one rigid group.
// Only meshes that are direct children of `group` (and their mesh children, e.g. ink
// outlines) are merged; nested Groups (animation pivots) are left alone. Singletons are
// kept as the original objects so references held by animation code stay valid.
function mergeGeometries(list) {
  let count = 0;
  const parts = list.map(({ geo, matrix }) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    count += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  const hasUv = parts.every((g) => g.attributes.uv);
  const uv = hasUv ? new Float32Array(count * 2) : null;
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    if (uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

export function collapse(group) {
  const items = [];
  const inv = new THREE.Matrix4();
  group.updateMatrixWorld(true);
  inv.copy(group.matrixWorld).invert();
  const visit = (mesh) => {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSprite || mesh.userData.noMerge) return;
    items.push(mesh);
    for (const c of mesh.children) visit(c);
  };
  for (const c of group.children) visit(c);
  const byMat = new Map();
  for (const m of items) {
    const k = m.material.uuid;
    if (!byMat.has(k)) byMat.set(k, []);
    byMat.get(k).push(m);
  }
  for (const list of byMat.values()) {
    if (list.length < 2) continue;
    const entries = list.map((m) => ({ geo: m.geometry, matrix: new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld) }));
    const merged = new THREE.Mesh(mergeGeometries(entries), list[0].material);
    merged.userData = { ...list[0].userData, merged: true };
    merged.renderOrder = list[0].renderOrder;
    for (const m of list) {
      // keep children that are not being merged (re-parent with their world transform)
      for (const ch of m.children.slice()) if (!list.includes(ch)) group.attach(ch);
      m.parent?.remove(m);
    }
    group.add(merged);
  }
}
// Collapse every rigid group in a hierarchy (pivots keep animating independently).
export function collapseRig(root) {
  const groups = [];
  root.traverse((o) => { if (!o.isMesh && o.children.length) groups.push(o); });
  for (const g of groups) collapse(g);
}
