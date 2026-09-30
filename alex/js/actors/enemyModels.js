// Procedural demon models. Each factory returns { group, parts, anim(enemy, dt) }.
// Silhouettes are deliberately distinct so every enemy reads at a glance.

import * as THREE from 'three';
import { mat, glow, textTexture, GEO } from '../world/props.js';

const outline = new THREE.MeshBasicMaterial({ color: '#0b0714', side: THREE.BackSide });
function m(parent, geo, color, pos, o = {}) {
  const mesh = new THREE.Mesh(geo, o.material || mat(color, o.mat || {}));
  if (pos) mesh.position.set(...pos);
  if (o.scale) mesh.scale.set(...o.scale);
  if (o.rot) mesh.rotation.set(...o.rot);
  parent.add(mesh);
  if (o.outline !== false && !o.material) {
    const ol = new THREE.Mesh(geo, outline);
    ol.scale.setScalar(o.ol || 1.07);
    ol.userData.outline = true;
    mesh.add(ol);
  }
  return mesh;
}
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s);
const cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);

function eyes(parent, y, z, sep, color = '#ff2e7e', size = 0.06) {
  for (const s of [-1, 1]) m(parent, sph(size, 8, 6), color, [s * sep, y, z], { material: glow(color) });
}
function legs(root, hipY, sep, len, color, r = 0.08) {
  const L = [];
  for (const s of [-1, 1]) {
    const h = grp(root, s * sep, hipY, 0);
    m(h, cap(r, len - r * 2), color, [0, -len / 2, 0]);
    L.push(h);
  }
  return L;
}
function walk(e, L, k = 0.8) {
  const sp = Math.hypot(e.vel.x, e.vel.z);
  e._ph = (e._ph || 0) + sp * (e._dt || 1 / 60) * 2.6;
  const s = Math.sin(e._ph) * Math.min(1, sp / 3) * k;
  if (L) { L[0].rotation.x = s; L[1].rotation.x = -s; }
  return s;
}
function idolFace(scream) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ff4fa3'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('MY BIAS ♥', 64, 20);
  g.fillStyle = '#f3cfae'; g.beginPath(); g.arc(64, 70, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(64, 52, 36, Math.PI, 0); g.fill();
  g.fillStyle = '#111';
  g.beginPath(); g.arc(52, 70, 4, 0, Math.PI * 2); g.arc(76, 70, 4, 0, Math.PI * 2); g.fill();
  if (scream) { g.fillStyle = '#6a040f'; g.beginPath(); g.ellipse(64, 90, 10, 13, 0, 0, Math.PI * 2); g.fill(); } else { g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.arc(64, 84, 9, 0.2, Math.PI - 0.2); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const MODELS = {
  lurker() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.95, 0);
    m(body, cap(0.3, 0.45), '#5a189a', [0, 0.1, 0], { rot: [0.5, 0, 0] });
    const head = grp(body, 0, 0.55, 0.28);
    m(head, sph(0.22), '#3c096c', [0, 0, 0]);
    eyes(head, 0.02, 0.18, 0.08);
    m(head, cone(0.07, 0.22, 6), '#240046', [0.12, 0.2, 0], { rot: [0, 0, -0.4] });
    m(head, cone(0.07, 0.22, 6), '#240046', [-0.12, 0.2, 0], { rot: [0, 0, 0.4] });
    const armR = grp(body, -0.32, 0.3, 0.1);
    m(armR, cap(0.07, 0.45), '#5a189a', [0, -0.3, 0]);
    const stick = grp(armR, 0, -0.6, 0);
    m(stick, cyl(0.04, 0.04, 0.35), '#222', [0, 0, 0.1], { rot: [Math.PI / 2, 0, 0] });
    m(stick, sph(0.12), '#4cc9f0', [0, 0, 0.35], { material: glow('#4cc9f0') });
    const armL = grp(body, 0.32, 0.3, 0.1);
    m(armL, cap(0.07, 0.45), '#5a189a', [0, -0.3, 0]);
    const L = legs(g, 0.95, 0.15, 0.9, '#3c096c');
    return {
      group: g, parts: { armR, stick },
      anim(e) {
        const s = walk(e, L);
        armL.rotation.x = -s * 0.8;
        armR.rotation.x = e.pose === 'wind' ? 2.2 : e.pose === 'swing' ? -1.4 : e.pose === 'big' ? 2.8 : s * 0.8;
        body.rotation.x = e.pose === 'swing' ? 0.35 : 0;
      },
    };
  },

  photocard() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.3, 0);
    m(body, cone(0.42, 1.4, 12), '#c8b6ff', [0, 0.7, 0], { rot: [Math.PI, 0, 0] });
    const head = grp(body, 0, 1.45, 0);
    m(head, sph(0.24), '#e7c6ff', [0, 0, 0]);
    eyes(head, 0.02, 0.2, 0.09, '#7b2cbf');
    const binder = grp(body, 0, 1.0, 0.36);
    const cover = m(binder, box(0.5, 0.6, 0.12), '#d00000', [0, 0, 0]);
    const mouth = m(binder, box(0.4, 0.06, 0.05), '#111', [0, -0.05, 0.08], { outline: false });
    const cards = grp(g, 0, 1.4, 0);
    for (let i = 0; i < 3; i++) {
      const c = m(cards, box(0.18, 0.26, 0.02), '#ffffff', [Math.sin(i * 2.09) * 0.7, 0, Math.cos(i * 2.09) * 0.7], { mat: { emissive: '#ff9ccf', emissiveIntensity: 0.3 } });
      c.userData.i = i;
    }
    return {
      group: g, parts: { binder, cover },
      anim(e, dt) {
        body.position.y = 0.3 + Math.sin(performance.now() * 0.003) * 0.1;
        cards.rotation.y += dt * (e.pose === 'reload' ? 1 : 3);
        cards.visible = !e.binderBroken;
        binder.visible = !e.binderBroken;
        mouth.scale.y = e.pose === 'reload' ? 6 + Math.sin(performance.now() * 0.05) * 3 : 1;
        cover.rotation.y = e.pose === 'reload' ? -1.2 : 0;
      },
    };
  },

  biasBeast() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.0, 0);
    m(body, sph(0.62), '#6f4518', [0, 0.25, 0], { scale: [1.1, 1.05, 0.9] });
    const shirtT = [idolFace(false), idolFace(true)];
    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: shirtT[0] }));
    shirt.position.set(0, 0.2, 0.58);
    body.add(shirt);
    m(body, sph(0.28), '#5c3d2e', [0, 0.95, 0.15]);
    eyes(body, 1.0, 0.4, 0.1, '#ffd60a', 0.05);
    const arms = [];
    for (const s of [-1, 1]) {
      const a = grp(body, s * 0.62, 0.45, 0);
      m(a, cap(0.16, 0.55), '#6f4518', [0, -0.45, 0]);
      m(a, sph(0.2), '#5c3d2e', [0, -0.9, 0]);
      arms.push(a);
    }
    const L = legs(g, 0.75, 0.3, 0.75, '#3a2618', 0.14);
    return {
      group: g, parts: { shirt },
      anim(e) {
        const s = walk(e, L, e.pose === 'charge' ? 1.3 : 0.7);
        shirt.material.map = shirtT[e.pose === 'scream' || e.pose === 'charge' ? 1 : 0];
        arms[0].rotation.x = e.pose === 'charge' ? 1.2 : s; arms[1].rotation.x = e.pose === 'charge' ? 1.2 : -s;
        body.rotation.x = e.pose === 'charge' ? 0.5 : e.pose === 'dazed' ? -0.3 : 0;
        body.position.y = 1.0 + (e.pose === 'scream' ? Math.sin(performance.now() * 0.06) * 0.05 : 0);
      },
    };
  },

  queue() {
    const g = new THREE.Group();
    m(g, cone(0.55, 1.6, 12), '#3d0e61', [0, 0.8, 0]);
    const head = grp(g, 0, 1.75, 0);
    m(head, cone(0.3, 0.55, 10), '#240046', [0, 0.1, -0.05]);
    m(head, sph(0.17), '#111', [0, -0.02, 0.05], { outline: false });
    eyes(head, 0, 0.18, 0.06, '#ffd60a', 0.04);
    const staff = grp(g, 0.45, 0, 0.2);
    m(staff, cyl(0.035, 0.035, 1.6), '#d4af37', [0, 0.8, 0]);
    m(staff, sph(0.1), '#d4af37', [0, 1.62, 0]);
    const rope = m(staff, cyl(0.03, 0.03, 0.6), '#9d0208', [0.25, 1.5, 0], { rot: [0, 0, 1.2], outline: false });
    return {
      group: g, parts: { staff },
      anim(e) {
        staff.rotation.z = e.pose === 'summon' ? -0.6 + Math.sin(performance.now() * 0.02) * 0.2 : 0;
        head.rotation.x = e.pose === 'summon' ? -0.3 : 0;
        rope.visible = e.pose !== 'summon';
      },
    };
  },

  mimic() {
    const g = new THREE.Group();
    // disguise: merch booth
    const booth = grp(g, 0, 0, 0);
    m(booth, box(2.0, 0.9, 1.0), '#e9e3d5', [0, 0.45, 0]);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: textTexture('OFFICIAL MERCH', { bg: '#ff4fa3', fg: '#fff' }) }));
    sign.position.set(0, 1.55, 0.3); booth.add(sign);
    for (const s of [-1, 1]) m(booth, cyl(0.04, 0.04, 1.8), '#aaa', [s * 0.9, 0.9, 0.3]);
    for (let i = 0; i < 5; i++) m(booth, box(0.3, 0.05, 0.3), ['#ff4fa3', '#fff', '#4cc9f0', '#111', '#ffd60a'][i], [-0.8 + i * 0.4, 0.93, 0.1]);
    // true form
    const beast = grp(g, 0, 0, 0);
    const blob = grp(beast, 0, 0.9, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      m(blob, box(0.5, 0.5, 0.5), ['#ff4fa3', '#f1faee', '#4cc9f0', '#ffd60a', '#1d1a33'][i % 5], [Math.cos(a) * 0.55, Math.sin(i * 1.7) * 0.4, Math.sin(a) * 0.55], { rot: [i, i * 0.5, i * 0.3] });
    }
    m(blob, sph(0.75), '#3c096c', [0, 0, 0]);
    const jaw = grp(blob, 0, -0.1, 0.55);
    for (let i = 0; i < 7; i++) m(jaw, cone(0.06, 0.18, 5), '#fff', [-0.3 + i * 0.1, 0.1, 0.05], { rot: [Math.PI, 0, 0], outline: false });
    m(jaw, box(0.8, 0.1, 0.2), '#6a040f', [0, 0, 0], { outline: false });
    eyes(blob, 0.35, 0.62, 0.22, '#ffd60a', 0.09);
    const L = legs(beast, 0.5, 0.35, 0.5, '#240046', 0.12);
    beast.visible = false;
    return {
      group: g, parts: { booth, beast, blob, jaw },
      anim(e) {
        booth.visible = e.disguised;
        beast.visible = !e.disguised;
        if (e.disguised) { booth.position.y = e.twitch ? Math.sin(performance.now() * 0.05) * 0.03 : 0; return; }
        walk(e, L, 0.6);
        blob.position.y = e.pose === 'rise' ? 0.9 + e.poseK * 2.2 : 0.9 + Math.sin(performance.now() * 0.006) * 0.05;
        jaw.rotation.x = e.pose === 'bite' ? 0.6 : Math.sin(performance.now() * 0.01) * 0.1;
        blob.rotation.y += 0.01;
      },
    };
  },

  fancam() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.9, 0);
    m(body, cap(0.25, 0.5), '#212529', [0, 0.2, 0]);
    const head = grp(body, 0, 0.8, 0);
    m(head, box(0.55, 0.4, 0.45), '#343a40', [0, 0, 0]);
    m(head, cyl(0.16, 0.2, 0.3), '#111', [0, 0, 0.35], { rot: [Math.PI / 2, 0, 0] });
    const lens = m(head, cyl(0.12, 0.12, 0.02), '#4cc9f0', [0, 0, 0.51], { rot: [Math.PI / 2, 0, 0], material: glow('#4cc9f0') });
    const rec = m(head, sph(0.05), '#ff0033', [0.2, 0.15, 0.23], { material: glow('#ff0033') });
    const L = legs(g, 0.9, 0.14, 0.9, '#495057');
    return {
      group: g, parts: { head, lens, rec },
      anim(e) {
        walk(e, L);
        rec.visible = Math.floor(performance.now() / 300) % 2 === 0 || e.pose === 'aim';
        lens.material = glow(e.pose === 'aim' ? '#ff0033' : '#4cc9f0');
      },
    };
  },

  stalker() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.3, 0);
    m(body, cap(0.18, 0.8), '#10002b', [0, 0.1, 0]);
    const head = grp(body, 0, 0.75, 0);
    m(head, sph(0.19), '#0b0014', [0, 0, 0]);
    m(head, cone(0.24, 0.4, 8), '#10002b', [0, 0.08, -0.04]);
    eyes(head, 0.01, 0.16, 0.06, '#ffffff', 0.035);
    const armR = grp(body, -0.22, 0.4, 0);
    m(armR, cap(0.05, 0.75), '#10002b', [0, -0.45, 0]);
    const phone = grp(armR, 0, -0.9, 0.05);
    m(phone, box(0.12, 0.22, 0.02), '#111', [0, 0, 0]);
    m(phone, box(0.1, 0.18, 0.01), '#fff', [0, 0, 0.012], { material: glow('#e0fbfc'), outline: false });
    const armL = grp(body, 0.22, 0.4, 0);
    m(armL, cap(0.05, 0.75), '#10002b', [0, -0.45, 0]);
    const L = legs(g, 1.3, 0.1, 1.3, '#10002b', 0.06);
    return {
      group: g, parts: { phone },
      anim(e) {
        const s = walk(e, L, 1.1);
        armR.rotation.x = e.pose === 'lunge' ? -1.6 : e.pose === 'screech' ? -2.6 : -1.3;
        armL.rotation.x = e.pose === 'lunge' ? -1.6 : -s;
        body.rotation.x = e.pose === 'lunge' ? 0.9 : e.pose === 'innocent' ? -0.05 : 0.3;
        head.rotation.y = e.pose === 'innocent' ? Math.sin(performance.now() * 0.002) * 0.6 : 0;
      },
    };
  },

  hoarder() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.1, 0);
    m(body, sph(0.85), '#588157', [0, 0, 0], { scale: [1, 0.95, 1] });
    m(body, sph(0.3), '#3a5a40', [0, 0.95, 0]);
    eyes(body, 1.0, 0.25, 0.1, '#ff2e7e', 0.05);
    const plates = [];
    const cols = ['#ff006e', '#8338ec', '#3a86ff'];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const p = grp(body, Math.sin(a) * 0.8, 0.05, Math.cos(a) * 0.8);
      p.rotation.y = a;
      m(p, box(0.95, 0.95, 0.12), cols[i], [0, 0, 0]);
      m(p, cyl(0.28, 0.28, 0.02, 20), '#e0e0e0', [0, 0, 0.07], { rot: [Math.PI / 2, 0, 0], outline: false, mat: { emissive: '#ffffff', emissiveIntensity: 0.2 } });
      plates.push(p);
    }
    const L = legs(g, 0.6, 0.35, 0.6, '#3a5a40', 0.15);
    return {
      group: g, parts: { plates, body },
      anim(e) {
        walk(e, L, 0.5);
        plates.forEach((p, i) => { p.visible = e.plates ? e.plates[i] > 0 : true; });
        body.position.y = e.pose === 'slam' ? 1.1 + e.poseK * 1.2 : 1.1;
      },
    };
  },

  chanter() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.9, 0);
    m(body, cap(0.24, 0.5), '#ff9f1c', [0, 0.2, 0]);
    const head = grp(body, 0, 0.8, 0);
    m(head, sph(0.2), '#ffbf69', [0, 0, 0]);
    eyes(head, 0.02, 0.17, 0.07, '#240046', 0.035);
    m(head, box(0.44, 0.08, 0.1), '#e63946', [0, 0.14, 0], { outline: false });
    const armR = grp(body, -0.28, 0.45, 0);
    m(armR, cap(0.06, 0.35), '#ff9f1c', [0, -0.2, 0]);
    const mega = grp(armR, 0, -0.45, 0.1);
    m(mega, cone(0.18, 0.4, 12), '#f1faee', [0, 0, 0.2], { rot: [-Math.PI / 2, 0, 0] });
    const armL = grp(body, 0.28, 0.45, 0);
    m(armL, cap(0.06, 0.35), '#ff9f1c', [0, -0.2, 0]);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: textTexture('FIGHTING!!', { bg: '#ffd60a', fg: '#e63946' }), side: THREE.DoubleSide }));
    banner.position.set(0.1, 0.25, 0);
    armL.add(banner);
    const ring = m(g, new THREE.TorusGeometry(1, 0.03, 6, 48), '#ffd60a', [0, 0.1, 0], { rot: [Math.PI / 2, 0, 0], material: glow('#ffd60a', 0.6) });
    const L = legs(g, 0.9, 0.13, 0.9, '#2b2d42');
    return {
      group: g, parts: { mega },
      anim(e) {
        walk(e, L);
        const ch = e.pose === 'chant';
        armR.rotation.x = ch ? -2.2 : -0.6;
        armL.rotation.x = ch ? -2.6 + Math.sin(performance.now() * 0.02) * 0.3 : -0.3;
        ring.visible = ch;
        ring.scale.setScalar(ch ? 2 + (e.beat || 0) * 2.5 : 1);
      },
    };
  },

  ultBias() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.0, 0);
    m(body, cap(0.22, 0.55), '#f8f9fa', [0, 0.25, 0]);
    m(body, box(0.5, 0.08, 0.3), '#d4af37', [0, 0.5, 0], { outline: false });
    const head = grp(body, 0, 0.88, 0);
    m(head, sph(0.19), '#f3cfae', [0, 0, 0]);
    m(head, sph(0.21), '#e0aaff', [0, 0.06, -0.03], { scale: [1.05, 0.9, 1.05] });
    eyes(head, 0.02, 0.17, 0.065, '#7b2cbf', 0.035);
    m(head, box(0.02, 0.02, 0.2), '#111', [0.16, -0.05, 0.08], { outline: false });
    const arms = [];
    for (const s of [-1, 1]) {
      const a = grp(body, s * 0.28, 0.5, 0);
      m(a, cap(0.055, 0.4), '#f8f9fa', [0, -0.25, 0]);
      arms.push(a);
    }
    const mic = m(arms[0], cyl(0.03, 0.02, 0.2), '#adb5bd', [0, -0.55, 0.05]);
    const sparkle = grp(g, 0, 1.6, 0);
    for (let i = 0; i < 6; i++) m(sparkle, new THREE.OctahedronGeometry(0.06), '#ffd60a', [Math.sin(i) * 0.6, Math.cos(i * 2) * 0.4, Math.cos(i) * 0.6], { material: glow('#ffd60a') });
    const L = legs(g, 1.0, 0.12, 1.0, '#212529', 0.07);
    return {
      group: g, parts: { mic },
      anim(e, dt) {
        const s = walk(e, L);
        sparkle.rotation.y += dt * 2;
        const p = e.pose;
        arms[0].rotation.set(p === 'heart' ? -1.5 : p === 'pose' ? -2.8 : -s, 0, p === 'spin' ? -1.5 : 0);
        arms[1].rotation.set(p === 'heart' ? -1.5 : p === 'pose' ? -0.4 : s, 0, p === 'spin' ? 1.5 : p === 'pose' ? 1.2 : 0);
        body.rotation.y = p === 'spin' ? performance.now() * 0.03 : 0;
      },
    };
  },

  akgae() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.85, 0);
    m(body, cap(0.3, 0.4), '#9d0208', [0, 0.1, 0.1], { rot: [0.7, 0, 0] });
    for (let i = 0; i < 6; i++) m(body, cone(0.08, 0.35, 5), '#6a040f', [Math.sin(i) * 0.15, 0.35 + i * 0.02, -0.2 + i * 0.05], { rot: [-0.8, 0, (i - 2.5) * 0.3] });
    const head = grp(body, 0, 0.35, 0.45);
    m(head, sph(0.22), '#6a040f', [0, 0, 0]);
    eyes(head, 0.03, 0.18, 0.08, '#ffea00', 0.05);
    m(head, box(0.2, 0.05, 0.05), '#fff', [0, -0.1, 0.19], { outline: false });
    const arms = [];
    for (const s of [-1, 1]) {
      const a = grp(body, s * 0.35, 0.2, 0.25);
      m(a, cap(0.08, 0.4), '#9d0208', [0, -0.3, 0]);
      for (let k = 0; k < 3; k++) m(a, cone(0.03, 0.25, 4), '#f1faee', [(k - 1) * 0.06, -0.62, 0.05], { rot: [Math.PI, 0, 0], outline: false });
      arms.push(a);
    }
    const L = legs(g, 0.85, 0.18, 0.85, '#6a040f', 0.09);
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L, 1.1);
        const p = e.pose;
        arms[0].rotation.x = p === 'clawR' ? -1.8 : p === 'charge' ? 0.8 : s;
        arms[1].rotation.x = p === 'clawL' ? -1.8 : p === 'charge' ? 0.8 : -s;
        body.rotation.x = p === 'charge' ? 0.6 : 0;
        head.position.y = 0.35 + Math.sin(performance.now() * 0.03) * 0.02;
      },
    };
  },

  parasocial() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.9, 0);
    m(body, sph(0.8), '#ff8fab', [0, 0.1, 0], { scale: [1, 1.1, 0.9] });
    eyes(body, 0.35, 0.7, 0.22, '#370617', 0.1);
    m(body, new THREE.TorusGeometry(0.18, 0.05, 6, 16, Math.PI), '#370617', [0, 0.02, 0.72], { rot: [0, 0, Math.PI], outline: false });
    m(body, sph(0.1), '#ff4d6d', [-0.35, 0.15, 0.7], { outline: false });
    m(body, sph(0.1), '#ff4d6d', [0.35, 0.15, 0.7], { outline: false });
    // arms: shoulder groups with a stretchable segment and a big hand
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = grp(body, s * 0.75, 0.1, 0.2);
      const seg = m(sh, cyl(0.1, 0.1, 1, 8), '#ff8fab', [0, 0, 0.5], { rot: [Math.PI / 2, 0, 0] });
      const hand = grp(sh, 0, 0, 1.0);
      m(hand, sph(0.3), '#ffb3c6', [0, 0, 0], { scale: [1.2, 0.5, 1] });
      for (let k = 0; k < 4; k++) m(hand, cap(0.05, 0.2), '#ffb3c6', [(k - 1.5) * 0.14, 0, 0.3], { rot: [Math.PI / 2, 0, 0] });
      arms.push({ sh, seg, hand });
    }
    const L = legs(g, 0.35, 0.3, 0.35, '#c9184a', 0.1);
    return {
      group: g, parts: { arms },
      anim(e) {
        walk(e, L, 0.5);
        body.scale.y = 1 + Math.sin(performance.now() * 0.004) * 0.04;
      },
    };
  },

  queen() {
    const g = new THREE.Group();
    m(g, cone(0.6, 1.3, 14), '#7209b7', [0, 0.65, 0]);
    const torso = grp(g, 0, 1.35, 0);
    m(torso, cap(0.2, 0.3), '#b5179e', [0, 0.1, 0]);
    m(torso, new THREE.TorusGeometry(0.3, 0.09, 8, 20), '#ffafcc', [0, 0.35, 0], { rot: [Math.PI / 2, 0, 0] });
    const head = grp(torso, 0, 0.6, 0);
    m(head, sph(0.18), '#e0aaff', [0, 0, 0]);
    eyes(head, 0.02, 0.16, 0.065, '#ffd60a', 0.035);
    const crown = grp(head, 0, 0.17, 0);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; m(crown, cone(0.05, 0.2, 4), '#ffd60a', [Math.sin(a) * 0.13, 0.08, Math.cos(a) * 0.13], { material: glow('#ffd60a') }); }
    const arm = grp(torso, -0.25, 0.3, 0);
    m(arm, cap(0.05, 0.35), '#b5179e', [0, -0.22, 0]);
    const scepter = grp(arm, 0, -0.45, 0.1);
    m(scepter, cyl(0.03, 0.03, 0.8), '#ffd60a', [0, 0.3, 0]);
    m(scepter, new THREE.OctahedronGeometry(0.14), '#ff4fa3', [0, 0.75, 0], { material: glow('#ff4fa3') });
    return {
      group: g, parts: { scepter },
      anim(e) {
        arm.rotation.x = e.pose === 'revive' ? -2.8 : e.pose === 'shoot' ? -1.5 : -0.4;
        crown.rotation.y += 0.02;
      },
    };
  },

  fanwar() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.0, 0);
    m(body, sph(0.75), '#495057', [0, 0.2, 0], { scale: [1.35, 1, 0.9] });
    const heads = [];
    for (const [s, col] of [[1, '#e63946'], [-1, '#3a86ff']]) {
      const h = grp(body, s * 0.45, 0.95, 0.05);
      m(h, sph(0.28), col, [0, 0, 0]);
      eyes(h, 0.04, 0.24, 0.09, '#ffffff', 0.05);
      m(h, box(0.2, 0.06, 0.05), '#111', [0, -0.12, 0.25], { outline: false });
      heads.push(h);
    }
    const fist = grp(body, 0.95, 0.2, 0.2);
    m(fist, cap(0.13, 0.45), '#e63946', [0, -0.3, 0]);
    m(fist, sph(0.25), '#e63946', [0, -0.65, 0]);
    const phoneArm = grp(body, -0.95, 0.3, 0.2);
    m(phoneArm, cap(0.09, 0.35), '#3a86ff', [0, -0.25, 0]);
    m(phoneArm, box(0.16, 0.28, 0.03), '#111', [0, -0.55, 0.1]);
    m(phoneArm, box(0.13, 0.23, 0.01), '#fff', [0, -0.55, 0.12], { material: glow('#caf0f8'), outline: false });
    const L = legs(g, 0.7, 0.35, 0.7, '#343a40', 0.14);
    return {
      group: g, parts: { heads },
      anim(e) {
        walk(e, L, 0.6);
        const argue = e.pose === 'argue';
        heads[0].rotation.y = argue ? -1.1 + Math.sin(performance.now() * 0.03) * 0.2 : 0;
        heads[1].rotation.y = argue ? 1.1 - Math.sin(performance.now() * 0.03) * 0.2 : 0;
        fist.rotation.x = e.pose === 'punch' ? -1.6 : e.pose === 'slam' ? -2.6 : 0;
        phoneArm.rotation.x = e.pose === 'shoot' ? -1.5 : -0.4;
      },
    };
  },

  soloA() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.8, 0);
    m(body, sph(0.4), '#e63946', [0, 0.2, 0]);
    eyes(body, 0.3, 0.35, 0.1, '#fff', 0.05);
    const fist = grp(body, 0.45, 0.2, 0.1);
    m(fist, sph(0.2), '#e63946', [0, -0.3, 0]);
    const L = legs(g, 0.6, 0.15, 0.6, '#343a40');
    return { group: g, parts: {}, anim(e) { walk(e, L); fist.rotation.x = e.pose === 'punch' ? -1.6 : 0; } };
  },
  soloB() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.8, 0);
    m(body, sph(0.4), '#3a86ff', [0, 0.2, 0]);
    eyes(body, 0.3, 0.35, 0.1, '#fff', 0.05);
    m(body, box(0.14, 0.24, 0.03), '#111', [-0.4, 0.1, 0.25]);
    const L = legs(g, 0.6, 0.15, 0.6, '#343a40');
    return { group: g, parts: {}, anim(e) { walk(e, L); } };
  },

  delulu() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.0, 0);
    m(body, cone(0.42, 0.55, 14), '#ff4fa3', [0, -0.05, 0]);
    m(body, cap(0.2, 0.45), '#ffafcc', [0, 0.35, 0]);
    const head = grp(body, 0, 0.9, 0);
    m(head, sph(0.2), '#f3cfae', [0, 0, 0]);
    m(head, sph(0.23), '#ffd60a', [0, 0.06, -0.04], { scale: [1.1, 0.9, 1.1] });
    for (const s of [-1, 1]) m(head, sph(0.1), '#ffd60a', [s * 0.2, -0.05, -0.05]);
    eyes(head, 0.02, 0.18, 0.07, '#ff006e', 0.045);
    m(head, box(0.02, 0.02, 0.2), '#111', [0.17, -0.05, 0.08], { outline: false });
    const arms = [];
    for (const s of [-1, 1]) {
      const a = grp(body, s * 0.27, 0.55, 0);
      m(a, cap(0.05, 0.4), '#ffafcc', [0, -0.25, 0]);
      arms.push(a);
    }
    const wand = grp(arms[0], 0, -0.5, 0.05);
    m(wand, cyl(0.02, 0.02, 0.4), '#fff', [0, 0.15, 0]);
    m(wand, new THREE.OctahedronGeometry(0.1), '#ffd60a', [0, 0.38, 0], { material: glow('#ffd60a') });
    const spot = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    spot.position.y = 4;
    g.add(spot);
    const L = legs(g, 1.0, 0.1, 1.0, '#f8f9fa', 0.06);
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L);
        const p = e.pose;
        spot.visible = p === 'pose' || p === 'chorus';
        arms[0].rotation.set(p === 'pose' ? -2.9 : p === 'verse' ? -1.2 + Math.sin(performance.now() * 0.02) : -s, 0, p === 'pose' ? -0.3 : 0);
        arms[1].rotation.set(p === 'pose' ? -0.5 : s, 0, p === 'pose' ? 1.4 : 0);
        body.rotation.y = p === 'verse' ? Math.sin(performance.now() * 0.015) * 0.6 : 0;
      },
    };
  },

  dancer() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.0, 0);
    m(body, cap(0.2, 0.55), '#10002b', [0, 0.25, 0], { mat: { emissive: '#3a0ca3', emissiveIntensity: 0.4 } });
    m(body, sph(0.18), '#10002b', [0, 0.85, 0]);
    m(body, box(0.3, 0.06, 0.1), '#4cc9f0', [0, 0.87, 0.14], { material: glow('#4cc9f0'), outline: false });
    const L = legs(g, 1.0, 0.1, 1.0, '#10002b', 0.07);
    return { group: g, parts: {}, anim(e) { walk(e, L); body.rotation.y = Math.sin(performance.now() * 0.01 + e.pos.x) * 0.5; } };
  },
};
