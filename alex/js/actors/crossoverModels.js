// Procedural models for the crossover rift enemies. Original low-poly takes on each
// franchise's look (blocky Overworld mobs, Covenant-style aliens, Grand Line marines,
// pocket critters, plague creatures). Same toon materials + outlines as the venue demons.

import * as THREE from 'three';
import { mat, glow } from '../world/props.js';
import { part as m, grp, cap, box, sph, cyl, cone, eyes, legs, walk } from './enemyModels.js';

const now = () => performance.now() * 0.001;

// Pixel-art texture from rows of palette keys (Minecraft faces).
const texCache = new Map();
function pixTex(key, rows, pal) {
  if (texCache.has(key)) return texCache.get(key);
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = rows[y][x]; g.fillStyle = typeof pal[k] === 'function' ? pal[k](x, y) : pal[k]; g.fillRect(x, y, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}
const noisy = (base, seed) => (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453; const f = (n - Math.floor(n)) * 0.35 - 0.17; const c = new THREE.Color(base); c.offsetHSL(0, 0, f); return '#' + c.getHexString(); };
function texMat(t) { return new THREE.MeshToonMaterial({ map: t, color: '#ffffff', emissive: '#000000' }); }
function faceBox(parent, size, faceTex, sideColor, pos) {
  const side = mat(sideColor);
  const face = texMat(faceTex);
  const mesh = new THREE.Mesh(box(size[0], size[1], size[2]), [side, side, side, side, face, side]);
  mesh.position.set(...pos);
  mesh.userData.noMerge = true;
  parent.add(mesh);
  const ol = new THREE.Mesh(box(size[0], size[1], size[2]), new THREE.MeshBasicMaterial({ color: '#0b0714', side: THREE.BackSide }));
  ol.scale.setScalar(1.07); ol.userData.outline = true; ol.userData.noMerge = true;
  mesh.add(ol);
  return mesh;
}

export const CROSS_MODELS = {
  // ======================================================================= HALO
  grunt() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.55, 0);
    m(body, sph(0.42), '#d9822b', [0, 0.1, 0], { scale: [1, 0.85, 0.95] });
    m(body, cyl(0.16, 0.2, 0.55), '#4a7c8c', [0, 0.35, -0.38], { rot: [0.25, 0, 0] });
    m(body, cone(0.14, 0.3, 8), '#6fb7c9', [0, 0.72, -0.48], { rot: [0.3, 0, 0] });
    m(body, sph(0.12, 8, 6), '#6fb7c9', [0.18, 0.5, -0.42]);
    const head = grp(body, 0, 0.42, 0.22);
    m(head, sph(0.22), '#8b8c99', [0, 0, 0]);
    m(head, box(0.28, 0.12, 0.16), '#3d6e7a', [0, -0.07, 0.15]);
    eyes(head, 0.06, 0.19, 0.08, '#ffb703', 0.04);
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.38, 0.15, 0.05); m(a, cap(0.07, 0.3), '#8b8c99', [0, -0.2, 0]); return a; });
    const gun = grp(arms[0], 0, -0.4, 0.1);
    m(gun, box(0.1, 0.12, 0.3), '#5b8c3a', [0, 0, 0.1]);
    m(gun, sph(0.06, 8, 6), '#9eff6b', [0, 0.05, 0.25], { material: glow('#9eff6b') });
    const nades = [-1, 1].map((s) => { const n = m(arms[s < 0 ? 0 : 1], sph(0.1, 10, 8), '#6ee7ff', [0, -0.45, 0.05], { material: glow('#6ee7ff') }); n.userData.noMerge = true; return n; });
    const L = legs(g, 0.55, 0.16, 0.5, '#8b8c99', 0.08);
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L, 1);
        const p = e.pose;
        const panic = p === 'panic' || p === 'kamikaze';
        arms[0].rotation.x = p === 'shoot' ? -1.5 : panic ? -2.8 + Math.sin(now() * 25) * 0.4 : -s * 0.8;
        arms[1].rotation.x = panic ? -2.8 - Math.sin(now() * 25) * 0.4 : s * 0.8;
        for (const n of nades) n.visible = p === 'kamikaze';
        gun.visible = p !== 'kamikaze';
        body.rotation.z = panic ? Math.sin(now() * 20) * 0.12 : 0;
      },
    };
  },

  jackal() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.0, 0);
    m(body, cap(0.18, 0.5), '#8a6d3b', [0, 0.25, 0], { rot: [0.25, 0, 0] });
    m(body, box(0.42, 0.3, 0.3), '#5e4b8b', [0, 0.35, 0.02]);
    const head = grp(body, 0, 0.78, 0.2);
    m(head, sph(0.15), '#a08a5a', [0, 0, 0], { scale: [0.8, 1, 1.2] });
    m(head, cone(0.07, 0.3, 6), '#e0c070', [0, -0.03, 0.26], { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 3; i++) m(head, cone(0.03, 0.28, 5), i === 1 ? '#ff7b00' : '#b5179e', [0 + (i - 1) * 0.06, 0.18, -0.08], { rot: [-0.7, 0, (i - 1) * 0.3] });
    eyes(head, 0.05, 0.12, 0.08, '#ffd60a', 0.035);
    const armL = grp(body, 0.26, 0.45, 0.05), armR = grp(body, -0.26, 0.45, 0.05);
    m(armL, cap(0.05, 0.4), '#a08a5a', [0, -0.25, 0]);
    m(armR, cap(0.05, 0.4), '#a08a5a', [0, -0.25, 0]);
    const shield = grp(armL, 0.05, -0.45, 0.3);
    const disc = m(shield, cyl(0.55, 0.55, 0.04, 6), '#4cc9f0', [0, 0, 0], { rot: [Math.PI / 2, 0, 0], material: new THREE.MeshBasicMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }) });
    disc.userData.noMerge = true;
    const gun = grp(armR, 0, -0.5, 0.15);
    m(gun, box(0.08, 0.1, 0.55), '#3a2e5c', [0, 0, 0.15]);
    m(gun, sph(0.05, 8, 6), '#ff9f1c', [0, 0.04, 0.42], { material: glow('#ff9f1c') });
    const L = legs(g, 1.0, 0.13, 1.0, '#8a6d3b', 0.06);
    return {
      group: g, parts: { shield },
      anim(e) {
        const s = walk(e, L, 0.9);
        shield.visible = !e.shieldBroken;
        disc.material.opacity = 0.35 + 0.25 * Math.sin(now() * 6) + (e.shieldFlash > 0 ? 0.4 : 0);
        armL.rotation.x = -1.2;
        armL.rotation.y = -0.4;
        armR.rotation.x = e.pose === 'aim' ? -1.5 : -0.9 + s * 0.3;
      },
    };
  },

  elite() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.3, 0);
    m(body, box(0.7, 0.75, 0.45), '#2f4fb5', [0, 0.35, 0], { rot: [0.2, 0, 0] });
    m(body, box(0.95, 0.22, 0.5), '#2a3f8f', [0, 0.7, -0.02]);
    m(body, cap(0.22, 0.4), '#5a5f6b', [0, -0.1, 0]);
    const head = grp(body, 0, 0.95, 0.25);
    m(head, sph(0.22), '#4a4e5a', [0, 0, 0], { scale: [0.8, 0.9, 1.25] });
    m(head, box(0.28, 0.22, 0.4), '#3b5bdb', [0, 0.12, -0.04]);
    for (const [x, y] of [[-0.09, -0.12], [0.09, -0.12], [-0.08, -0.2], [0.08, -0.2]]) m(head, cone(0.035, 0.22, 5), '#3d3f48', [x, y, 0.22], { rot: [Math.PI / 2 + 0.3, 0, 0] });
    eyes(head, 0.02, 0.2, 0.1, '#ffd60a', 0.04);
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.5, 0.55, 0); m(a, cap(0.11, 0.55), '#2f4fb5', [0, -0.35, 0]); return a; });
    const rifle = grp(arms[0], 0, -0.75, 0.15);
    m(rifle, box(0.16, 0.22, 0.6), '#7a3db8', [0, 0, 0.15]);
    m(rifle, sph(0.08, 8, 6), '#d38cff', [0, 0, 0.45], { material: glow('#d38cff') });
    const sword = grp(arms[1], 0, -0.75, 0.1);
    m(sword, box(0.12, 0.1, 0.18), '#5a5f6b', [0, 0, 0]);
    for (const s of [-1, 1]) m(sword, box(0.05, 0.06, 0.95), '#9ef6ff', [s * 0.07, 0, 0.55], { rot: [0, s * 0.08, 0], material: glow('#9ef6ff') });
    const bubble = new THREE.Mesh(sph(1.15, 18, 12), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    bubble.position.y = 1.3; bubble.scale.set(0.8, 1.15, 0.8); bubble.userData.noMerge = true;
    g.add(bubble);
    const L = legs(g, 1.3, 0.2, 1.3, '#2a3f8f', 0.11);
    return {
      group: g, parts: {},
      anim(e, dt) {
        const s = walk(e, L, 0.8);
        sword.visible = e.pose === 'sword' || e.pose === 'lunge';
        rifle.visible = !sword.visible;
        arms[0].rotation.x = e.pose === 'shoot' ? -1.5 : -s * 0.7;
        arms[1].rotation.x = e.pose === 'sword' ? -2.6 : e.pose === 'lunge' ? -1.3 : s * 0.7;
        body.rotation.x = e.pose === 'roar' ? -0.4 : 0;
        bubble.material.opacity = Math.max(0, (e.shieldFlash || 0)) * 0.5;
        bubble.material.color.set(e.shield > 0 ? '#ffd166' : '#ffffff');
      },
    };
  },

  hunter() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.6, 0);
    m(body, box(1.3, 1.4, 0.9), '#1f3b57', [0, 0.4, 0], { rot: [0.35, 0, 0] });
    m(body, box(0.8, 0.5, 0.6), '#ff7b00', [0, 0.1, -0.4], { material: glow('#ff7b00') });
    for (let i = 0; i < 5; i++) m(body, cone(0.12, 0.7, 6), '#11263a', [-0.45 + i * 0.22, 1.2, -0.25], { rot: [-0.6, 0, (i - 2) * 0.18] });
    const head = grp(body, 0, 1.05, 0.55);
    m(head, box(0.4, 0.3, 0.4), '#11263a', [0, 0, 0]);
    m(head, box(0.3, 0.06, 0.06), '#ffd60a', [0, 0, 0.21], { material: glow('#ffd60a'), outline: false });
    const shieldArm = grp(body, 0.75, 0.6, 0.2);
    m(shieldArm, box(0.2, 1.8, 1.3), '#2b4c6f', [0.1, -0.5, 0.35], { rot: [0.1, 0, 0] });
    const gunArm = grp(body, -0.75, 0.6, 0.2);
    m(gunArm, cyl(0.25, 0.3, 1.3, 10), '#1f3b57', [0, -0.55, 0.2], { rot: [0.5, 0, 0] });
    const tip = m(gunArm, sph(0.24, 10, 8), '#7dff4f', [0, -1.05, 0.55], { material: glow('#7dff4f') });
    tip.userData.noMerge = true;
    const L = legs(g, 1.6, 0.4, 1.6, '#11263a', 0.18);
    return {
      group: g, parts: {},
      anim(e) {
        walk(e, L, 0.5);
        const p = e.pose;
        gunArm.rotation.x = p === 'aim' ? -1.1 : -0.4;
        shieldArm.rotation.y = p === 'bash' ? -0.8 : 0;
        body.rotation.x = p === 'bash' ? 0.35 : 0;
        tip.scale.setScalar(p === 'aim' ? 1.2 + Math.sin(now() * 30) * 0.2 : 1);
      },
    };
  },

  // ================================================================= MINECRAFT
  creeper() {
    const g = new THREE.Group();
    const skin = pixTex('creeperSkin', Array.from({ length: 8 }, () => 'gggggggg'), { g: noisy('#4caf50', 3) });
    const face = pixTex('creeperFace', ['gggggggg', 'gggggggg', 'gbbggbbg', 'gbbggbbg', 'gggbbggg', 'ggbbbbgg', 'ggbbbbgg', 'ggbggbgg'], { g: noisy('#4caf50', 7), b: '#111' });
    const body = grp(g, 0, 0.45, 0);
    const torso = new THREE.Mesh(box(0.5, 0.85, 0.3), texMat(skin)); torso.position.y = 0.45; torso.userData.noMerge = true; body.add(torso);
    const head = faceBox(body, [0.56, 0.56, 0.56], face, '#4caf50', [0, 1.15, 0]);
    head.material[0] = head.material[1] = head.material[2] = head.material[3] = head.material[5] = texMat(skin);
    const feet = [];
    for (const [x, z] of [[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.14], [0.14, -0.14]]) { const f = grp(g, x, 0.45, z); m(f, box(0.2, 0.42, 0.2), '#3e8e41', [0, -0.22, 0]); feet.push(f); }
    return {
      group: g, parts: {},
      anim(e) {
        const sp = Math.hypot(e.vel.x, e.vel.z);
        e._ph = (e._ph || 0) + sp * (e._dt || 0.016) * 3;
        const s = Math.sin(e._ph) * Math.min(1, sp / 2) * 0.6;
        feet[0].rotation.x = feet[3].rotation.x = s; feet[1].rotation.x = feet[2].rotation.x = -s;
        const fuse = e.fuseK || 0;
        const k = 1 + fuse * 0.35 + (fuse > 0 ? Math.sin(now() * (10 + fuse * 30)) * 0.05 : 0);
        body.scale.set(k, 1 + fuse * 0.15, k);
      },
    };
  },

  zombie() {
    const g = new THREE.Group();
    const face = pixTex('zombieFace', ['gggggggg', 'gggggggg', 'gggggggg', 'gkkggkkg', 'gggddggg', 'ggddddgg', 'gggggggg', 'gggggggg'], { g: noisy('#5a9e4b', 11), k: '#1b3d14', d: '#2f5e27' });
    const body = grp(g, 0, 0.75, 0);
    m(body, box(0.5, 0.75, 0.26), '#00a6a6', [0, 0.375, 0]);
    faceBox(body, [0.5, 0.5, 0.5], face, '#5a9e4b', [0, 1.0, 0]);
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.37, 0.68, 0); m(a, box(0.22, 0.72, 0.22), '#5a9e4b', [0, -0.3, 0]); return a; });
    const L = [-1, 1].map((s) => { const l = grp(g, s * 0.12, 0.75, 0); m(l, box(0.24, 0.75, 0.24), '#3a3fa8', [0, -0.375, 0]); return l; });
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L, 0.7);
        const swipe = e.pose === 'swipe' ? Math.sin(now() * 30) * 0.4 : 0;
        arms[0].rotation.x = -1.55 + s * 0.15 + swipe; arms[1].rotation.x = -1.55 - s * 0.15 - swipe;
        body.rotation.z = Math.sin(now() * 2 + e.pos.x) * 0.05;
      },
    };
  },

  skeleton() {
    const g = new THREE.Group();
    const face = pixTex('skelFace', ['wwwwwwww', 'wwwwwwww', 'wwwwwwww', 'wkkwwkkw', 'wwwkkwww', 'wwwwwwww', 'wkkkkkkw', 'wwwwwwww'], { w: noisy('#d6d6d6', 5), k: '#2b2b2b' });
    const body = grp(g, 0, 0.75, 0);
    m(body, box(0.42, 0.72, 0.18), '#cfcfcf', [0, 0.36, 0]);
    for (let i = 0; i < 3; i++) m(body, box(0.44, 0.04, 0.2), '#7a7a7a', [0, 0.18 + i * 0.16, 0.01], { outline: false });
    faceBox(body, [0.48, 0.48, 0.48], face, '#d6d6d6', [0, 0.98, 0]);
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.28, 0.66, 0); m(a, box(0.1, 0.7, 0.1), '#d6d6d6', [0, -0.3, 0]); return a; });
    const bow = grp(arms[0], 0, -0.62, 0.1);
    m(bow, new THREE.TorusGeometry(0.32, 0.03, 6, 14, Math.PI), '#8b5a2b', [0, 0, 0], { rot: [0, Math.PI / 2, Math.PI / 2] });
    const L = [-1, 1].map((s) => { const l = grp(g, s * 0.1, 0.75, 0); m(l, box(0.1, 0.75, 0.1), '#d6d6d6', [0, -0.375, 0]); return l; });
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L, 0.8);
        const draw = e.pose === 'draw';
        arms[0].rotation.set(draw ? -1.55 : -s * 0.6, draw ? 0.2 : 0, 0);
        arms[1].rotation.set(draw ? -1.4 : s * 0.6, draw ? -0.5 : 0, 0);
      },
    };
  },

  enderman() {
    const g = new THREE.Group();
    const face = pixTex('enderFace', ['kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'pPPkkPPp', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk'], { k: noisy('#141414', 9), p: '#c77dff', P: '#f0c4ff' });
    const body = grp(g, 0, 1.7, 0);
    m(body, box(0.42, 0.75, 0.22), '#141414', [0, 0.37, 0]);
    const head = faceBox(body, [0.48, 0.48, 0.48], face, '#141414', [0, 1.0, 0]);
    head.material[4].emissive = new THREE.Color('#5a189a'); head.material[4].emissiveIntensity = 0.6;
    const jaw = grp(body, 0, 0.82, 0); m(jaw, box(0.46, 0.12, 0.46), '#141414', [0, -0.04, 0]);
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.28, 0.7, 0); m(a, box(0.1, 1.55, 0.1), '#141414', [0, -0.75, 0]); return a; });
    const L = [-1, 1].map((s) => { const l = grp(g, s * 0.1, 1.7, 0); m(l, box(0.11, 1.7, 0.11), '#141414', [0, -0.85, 0]); return l; });
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L, 0.5);
        const angry = e.provoked;
        jaw.position.y = angry ? -0.18 : 0;
        arms[0].rotation.x = e.pose === 'punch' ? -1.6 : -s * 0.5 + (angry ? -0.3 : 0);
        arms[1].rotation.x = e.pose === 'punch' ? -0.4 : s * 0.5 + (angry ? -0.3 : 0);
        body.position.x = angry ? Math.sin(now() * 40) * 0.03 : 0;
      },
    };
  },

  // ================================================================= ONE PIECE
  marine() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.95, 0);
    m(body, box(0.48, 0.62, 0.3), '#f1f5f9', [0, 0.3, 0]);
    m(body, box(0.5, 0.12, 0.32), '#1e3a8a', [0, 0.52, 0.0]);
    m(body, box(0.2, 0.18, 0.02), '#1e3a8a', [0, 0.45, 0.16], { outline: false });
    const head = grp(body, 0, 0.82, 0);
    m(head, sph(0.19), '#f3cfae', [0, 0, 0]);
    m(head, cyl(0.2, 0.2, 0.12, 14), '#f8fafc', [0, 0.14, 0]);
    m(head, cyl(0.21, 0.21, 0.05, 14), '#1e3a8a', [0, 0.1, 0]);
    m(head, box(0.22, 0.03, 0.12), '#f8fafc', [0, 0.11, 0.18]);
    eyes(head, 0.0, 0.17, 0.07, '#111', 0.03);
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.31, 0.55, 0); m(a, cap(0.07, 0.42), '#f1f5f9', [0, -0.28, 0]); return a; });
    const rifle = grp(arms[0], 0, -0.55, 0.05);
    m(rifle, box(0.07, 0.1, 0.95), '#5b3a1e', [0, 0, 0.3]);
    m(rifle, box(0.05, 0.05, 0.4), '#333', [0, 0.05, 0.75]);
    const L = legs(g, 0.95, 0.12, 0.95, '#1e293b', 0.075);
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L);
        const aim = e.pose === 'aim' || e.pose === 'fire';
        arms[0].rotation.x = aim ? -1.5 : -s * 0.7; arms[0].rotation.y = aim ? 0.3 : 0;
        arms[1].rotation.x = aim ? -1.4 : s * 0.7; arms[1].rotation.y = aim ? -0.6 : 0;
        body.rotation.x = e.pose === 'fire' ? -0.12 : 0;
      },
    };
  },

  fishman() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.1, 0);
    m(body, box(0.75, 0.75, 0.42), '#f8fafc', [0, 0.38, 0]);
    m(body, box(0.78, 0.1, 0.44), '#111', [0, 0.04, 0]);
    m(body, sph(0.32), '#3b82f6', [0, 0.65, 0.05], { scale: [1.3, 0.6, 0.8] });
    m(body, cone(0.12, 0.6, 4), '#1d4ed8', [0, 0.95, -0.18], { rot: [-0.6, 0, 0] });
    const head = grp(body, 0, 1.02, 0.08);
    m(head, sph(0.24), '#3b82f6', [0, 0, 0], { scale: [1, 0.95, 1.1] });
    m(head, box(0.3, 0.06, 0.06), '#111', [0, -0.1, 0.22], { outline: false });
    eyes(head, 0.06, 0.2, 0.1, '#fef08a', 0.045);
    m(head, cone(0.06, 0.25, 4), '#1d4ed8', [0.22, 0.05, -0.05], { rot: [0, 0, -1.2] });
    m(head, cone(0.06, 0.25, 4), '#1d4ed8', [-0.22, 0.05, -0.05], { rot: [0, 0, 1.2] });
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.48, 0.62, 0); m(a, cap(0.11, 0.42), '#3b82f6', [0, -0.3, 0]); m(a, sph(0.15), '#2563eb', [0, -0.6, 0]); return a; });
    const L = legs(g, 1.1, 0.18, 1.1, '#f8fafc', 0.11);
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L);
        const p = e.pose;
        arms[0].rotation.x = p === 'palm' ? -1.6 : p === 'flick' ? -1.2 + Math.sin(now() * 30) * 0.5 : -s * 0.6;
        arms[1].rotation.x = p === 'palm' ? 0.4 : s * 0.6;
        body.rotation.y = p === 'palm' ? 0.4 : 0;
      },
    };
  },

  pacifista() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.6, 0);
    m(body, box(1.2, 1.3, 0.75), '#2b2d42', [0, 0.55, 0]);
    m(body, box(0.5, 1.1, 0.05), '#8d99ae', [0, 0.5, 0.39], { outline: false });
    const head = grp(body, 0, 1.45, 0.05);
    m(head, sph(0.32), '#e9c9a7', [0, 0, 0], { scale: [1, 1.05, 0.95] });
    m(head, sph(0.33), '#111', [0, 0.1, -0.02], { scale: [1.02, 0.8, 1] });
    for (const s of [-1, 1]) m(head, sph(0.12), '#111', [s * 0.25, 0.32, 0]);
    m(head, box(0.42, 0.08, 0.05), '#111', [0, 0.04, 0.3], { outline: false });
    const mouth = m(head, box(0.18, 0.06, 0.05), '#ffd60a', [0, -0.16, 0.3], { material: glow('#ffd60a'), outline: false });
    mouth.userData.noMerge = true;
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.75, 1.0, 0); m(a, cap(0.17, 0.8), '#2b2d42', [0, -0.55, 0]); m(a, sph(0.2), '#e9c9a7', [0, -1.1, 0]); return a; });
    const book = grp(arms[1], 0, -1.1, 0.22);
    m(book, box(0.3, 0.4, 0.08), '#5c2a18', [0, 0, 0]);
    m(book, box(0.06, 0.2, 0.01), '#ffd60a', [0, 0, 0.045], { outline: false });
    const L = legs(g, 1.6, 0.3, 1.6, '#2b2d42', 0.16);
    return {
      group: g, parts: {},
      anim(e) {
        walk(e, L, 0.5);
        const p = e.pose;
        mouth.scale.set(p === 'laser' ? 1.6 : 1, p === 'laser' ? 2.5 + Math.sin(now() * 40) : 1, 1);
        arms[0].rotation.x = p === 'palm' ? -1.6 : 0;
        head.rotation.x = p === 'laser' ? -0.15 : 0;
      },
    };
  },

  seaKing() {
    const g = new THREE.Group();
    const neck = grp(g, 0, 0, 0);
    const segs = [];
    for (let i = 0; i < 6; i++) { const s = grp(neck, 0, i * 0.7, 0); m(s, sph(0.75 - i * 0.04, 14, 10), i % 2 ? '#7c3aed' : '#6d28d9', [0, 0, 0], { scale: [1, 0.9, 1] }); m(s, cone(0.18, 0.6, 5), '#22d3ee', [0, 0.1, -0.55], { rot: [-1.2, 0, 0] }); segs.push(s); }
    const head = grp(neck, 0, 4.4, 0.2);
    m(head, box(1.1, 0.75, 1.5), '#7c3aed', [0, 0, 0.3]);
    m(head, box(1.0, 0.18, 1.3), '#fef3c7', [0, -0.42, 0.35]);
    eyes(head, 0.25, 0.9, 0.38, '#fde047', 0.12);
    for (const s of [-1, 1]) m(head, cone(0.12, 0.8, 5), '#22d3ee', [s * 0.5, 0.45, -0.2], { rot: [-0.9, 0, s * 0.3] });
    const jaw = grp(head, 0, -0.38, 0);
    m(jaw, box(1.0, 0.25, 1.35), '#5b21b6', [0, -0.12, 0.35]);
    for (let i = 0; i < 4; i++) m(jaw, cone(0.06, 0.18, 4), '#fff', [-0.36 + i * 0.24, 0.08, 0.95], { outline: false });
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.6, 28), new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.05; ripple.userData.noMerge = true;
    g.add(ripple);
    return {
      group: g, parts: {},
      anim(e) {
        const k = e.surfaceK ?? 1;
        neck.position.y = -5.2 * (1 - k);
        neck.visible = k > 0.02;
        for (let i = 0; i < segs.length; i++) segs[i].position.x = Math.sin(now() * 2 + i * 0.7) * 0.18 * k;
        jaw.rotation.x = e.pose === 'bite' ? 0.6 : 0.1 + Math.sin(now() * 3) * 0.05;
        ripple.material.opacity = 0.25 + 0.25 * Math.sin(now() * 5);
        ripple.scale.setScalar(1 + (1 - k) * 0.4);
      },
    };
  },

  // ================================================================= POKÉMON
  pikachew() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.3, 0);
    m(body, sph(0.32), '#facc15', [0, 0.1, 0], { scale: [1, 1.1, 0.9] });
    const head = grp(body, 0, 0.55, 0.05);
    m(head, sph(0.3), '#facc15', [0, 0, 0], { scale: [1.15, 1, 1] });
    for (const s of [-1, 1]) { const ear = grp(head, s * 0.18, 0.22, 0); m(ear, cone(0.08, 0.5, 6), '#facc15', [0, 0.22, 0], { rot: [0, 0, -s * 0.35] }); m(ear, cone(0.05, 0.16, 6), '#111', [-s * 0.07, 0.44, 0], { rot: [0, 0, -s * 0.35], outline: false }); }
    for (const s of [-1, 1]) m(head, sph(0.07, 10, 8), '#ef4444', [s * 0.22, -0.08, 0.2], { material: glow('#ef4444') });
    eyes(head, 0.05, 0.26, 0.11, '#111', 0.05);
    const tail = grp(body, 0, 0.2, -0.3);
    m(tail, box(0.08, 0.3, 0.06), '#a16207', [0, 0.1, 0], { rot: [0, 0, 0.6] });
    m(tail, box(0.1, 0.35, 0.06), '#facc15', [0.12, 0.35, 0], { rot: [0, 0, -0.6] });
    m(tail, box(0.2, 0.3, 0.06), '#facc15', [0.02, 0.6, 0], { rot: [0, 0, 0.5] });
    const L = legs(g, 0.3, 0.12, 0.3, '#facc15', 0.07);
    return {
      group: g, parts: {},
      anim(e) {
        walk(e, L, 1);
        body.position.y = 0.3 + Math.abs(Math.sin(now() * 8)) * (Math.hypot(e.vel.x, e.vel.z) > 1 ? 0.08 : 0.02);
        tail.rotation.z = Math.sin(now() * 6) * 0.25;
        head.rotation.z = e.pose === 'zap' ? Math.sin(now() * 40) * 0.1 : 0;
      },
    };
  },

  gastlee() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.2, 0);
    m(body, sph(0.45, 16, 12), '#2e1065', [0, 0, 0]);
    const aura = new THREE.Mesh(sph(0.78, 16, 12), new THREE.MeshBasicMaterial({ color: '#a855f7', transparent: true, opacity: 0.28, depthWrite: false }));
    aura.userData.noMerge = true;
    body.add(aura);
    eyes(body, 0.12, 0.38, 0.17, '#fef9c3', 0.09);
    m(body, box(0.42, 0.12, 0.05), '#fff', [0, -0.15, 0.42], { outline: false, rot: [0.2, 0, 0] });
    m(body, box(0.2, 0.08, 0.04), '#ec4899', [0, -0.24, 0.42], { outline: false });
    return {
      group: g, parts: {},
      anim(e) {
        body.position.y = 1.2 + Math.sin(now() * 2.5 + e.pos.x) * 0.15;
        aura.scale.setScalar(1 + Math.sin(now() * 6) * 0.08);
        const fade = e.intangible ? 0.12 : 0.28;
        aura.material.opacity = fade;
        body.visible = !(e.intangible && Math.floor(now() * 12) % 3 === 0);
      },
    };
  },

  magikrap() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.45, 0);
    m(body, sph(0.4, 14, 10), '#f97316', [0, 0, 0], { scale: [0.7, 1, 1.15] });
    m(body, sph(0.3, 12, 8), '#fde68a', [0, -0.12, 0.08], { scale: [0.6, 0.6, 1] });
    m(body, cone(0.22, 0.4, 5), '#fde047', [0, 0.42, 0], { rot: [0, Math.PI / 2, 0] });
    m(body, cone(0.25, 0.4, 5), '#fde047', [0, 0, -0.55], { rot: [-Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) m(body, cone(0.03, 0.4, 4), '#fde047', [s * 0.12, -0.1, 0.42], { rot: [1.4, 0, s * 0.6] });
    for (const s of [-1, 1]) { m(body, sph(0.1, 10, 8), '#fff', [s * 0.24, 0.1, 0.24]); m(body, sph(0.03, 6, 4), '#111', [s * 0.32, 0.1, 0.28], { outline: false }); }
    return {
      group: g, parts: {},
      anim(e) {
        const hop = e.hopK || 0;
        body.position.y = 0.45 + hop;
        body.rotation.z = Math.PI / 2 * 0.9 + Math.sin(now() * 12) * 0.25;
        body.rotation.y = Math.sin(now() * 7) * 0.5;
      },
    };
  },

  gyarados() {
    const g = new THREE.Group();
    const segs = [];
    for (let i = 0; i < 7; i++) { const s = grp(g, 0, 1.2 + i * 0.4, -1.6 + i * 0.4); m(s, sph(0.7 - i * 0.04, 14, 10), '#1d4ed8', [0, 0, 0]); m(s, sph(0.55 - i * 0.03, 12, 8), '#fde68a', [0, -0.15, 0.25]); m(s, cone(0.1, 0.5, 4), '#f8fafc', [0, 0.65, 0], {}); segs.push(s); }
    const head = grp(g, 0, 4.3, 1.4);
    m(head, box(1.0, 0.8, 1.3), '#1d4ed8', [0, 0, 0]);
    m(head, box(0.9, 0.25, 1.1), '#f8fafc', [0, -0.45, 0.1]);
    eyes(head, 0.2, 0.62, 0.3, '#ef4444', 0.1);
    for (const s of [-1, 1]) m(head, cone(0.08, 1.2, 5), '#f8fafc', [s * 0.45, -0.1, 0.5], { rot: [1.7, s * 0.6, 0] });
    m(head, cone(0.25, 0.9, 5), '#2563eb', [0, 0.6, -0.4], { rot: [-0.8, 0, 0] });
    const beam = m(head, sph(0.3, 10, 8), '#fbbf24', [0, -0.35, 0.75], { material: glow('#fbbf24') });
    beam.userData.noMerge = true;
    return {
      group: g, parts: {},
      anim(e) {
        for (let i = 0; i < segs.length; i++) segs[i].position.x = Math.sin(now() * 2 + i * 0.8) * 0.35;
        head.position.x = Math.sin(now() * 2 + 6) * 0.35;
        beam.visible = e.pose === 'charge' || e.pose === 'beam';
        beam.scale.setScalar(e.pose === 'beam' ? 1.6 : 0.8 + Math.sin(now() * 30) * 0.2);
        head.rotation.x = e.pose === 'recharge' ? 0.5 : 0;
      },
    };
  },

  snorelax() {
    const g = new THREE.Group();
    const body = grp(g, 0, 1.2, 0);
    m(body, sph(1.2, 18, 14), '#155e75', [0, 0, 0], { scale: [1, 0.95, 0.9] });
    m(body, sph(1.0, 16, 12), '#fef3c7', [0, -0.08, 0.32], { scale: [0.9, 0.9, 0.7] });
    const head = grp(body, 0, 1.15, 0.1);
    m(head, sph(0.6, 16, 12), '#155e75', [0, 0, 0], { scale: [1.15, 0.9, 1] });
    m(head, sph(0.5, 14, 10), '#fef3c7', [0, -0.1, 0.2], { scale: [1, 0.7, 0.8] });
    for (const s of [-1, 1]) m(head, cone(0.16, 0.3, 5), '#155e75', [s * 0.45, 0.45, 0], { rot: [0, 0, -s * 0.4] });
    const lids = grp(head, 0, 0.05, 0.5);
    for (const s of [-1, 1]) m(lids, box(0.22, 0.04, 0.04), '#111', [s * 0.2, 0, 0], { outline: false });
    const open = grp(head, 0, 0.05, 0.5);
    for (const s of [-1, 1]) m(open, sph(0.08, 8, 6), '#111', [s * 0.2, 0, 0], { outline: false });
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 1.05, 0.35, 0.1); m(a, sph(0.32, 10, 8), '#155e75', [0, -0.15, 0.1]); return a; });
    const L = [-1, 1].map((s) => { const l = grp(g, s * 0.6, 0.4, 0.3); m(l, sph(0.4, 12, 8), '#fef3c7', [0, -0.15, 0.05], { scale: [1, 0.6, 1.2] }); return l; });
    return {
      group: g, parts: {},
      anim(e) {
        const asleep = e.asleep;
        lids.visible = asleep; open.visible = !asleep;
        body.scale.y = asleep ? 1 + Math.sin(now() * 1.6) * 0.04 : 1;
        body.rotation.z = asleep ? 0.12 : 0;
        arms[0].rotation.z = e.pose === 'slam' ? -2.4 : 0; arms[1].rotation.z = e.pose === 'slam' ? 2.4 : 0;
        walk(e, L, 0.4);
      },
    };
  },

  // ================================================================= THE BIBLE
  frog() {
    const g = new THREE.Group();
    const body = grp(g, 0, 0.18, 0);
    m(body, sph(0.24, 12, 8), '#65a30d', [0, 0.05, 0], { scale: [1, 0.7, 1.2] });
    m(body, sph(0.18, 10, 8), '#d9f99d', [0, -0.02, 0.1], { scale: [1, 0.5, 1] });
    for (const s of [-1, 1]) { m(body, sph(0.09, 10, 8), '#65a30d', [s * 0.12, 0.2, 0.15]); m(body, sph(0.05, 8, 6), '#111', [s * 0.13, 0.24, 0.2], { outline: false }); }
    const tongue = grp(body, 0, 0.02, 0.25);
    const tg = m(tongue, box(0.05, 0.03, 1), '#f43f5e', [0, 0, 0.5], { outline: false });
    tg.userData.noMerge = true;
    const L = [-1, 1].map((s) => { const l = grp(g, s * 0.18, 0.12, -0.1); m(l, sph(0.1, 8, 6), '#4d7c0f', [0, -0.05, 0], { scale: [1, 0.6, 1.8] }); return l; });
    return {
      group: g, parts: {},
      anim(e) {
        body.position.y = 0.18 + (e.hopK || 0);
        tongue.visible = e.pose === 'tongue';
        tongue.scale.z = e.tongueK || 1;
        for (const l of L) l.rotation.x = e.hopK > 0.05 ? -0.8 : 0;
      },
    };
  },

  locust() {
    const g = new THREE.Group();
    const N = 26;
    const geo = new THREE.CapsuleGeometry(0.04, 0.16, 2, 5).rotateX(Math.PI / 2);
    const inst = new THREE.InstancedMesh(geo, mat('#78350f', { emissive: '#000000' }), N);
    inst.frustumCulled = false;
    g.add(inst);
    const wings = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.08), new THREE.MeshBasicMaterial({ color: '#d9f99d', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), N);
    wings.frustumCulled = false;
    g.add(wings);
    const seeds = Array.from({ length: N }, (_, i) => [Math.random() * 6.28, Math.random() * 6.28, 0.4 + Math.random() * 0.7, 2 + Math.random() * 3, i]);
    const d = new THREE.Object3D();
    return {
      group: g, parts: {},
      anim(e) {
        const t = now();
        const spread = e.pose === 'dive' ? 0.6 : 1;
        for (const [a, b, r, sp, i] of seeds) {
          const x = Math.sin(t * sp + a) * r * spread, y = 1.0 + Math.sin(t * sp * 1.3 + b) * 0.5, z = Math.cos(t * sp * 0.9 + a) * r * spread;
          d.position.set(x, y, z);
          d.rotation.set(0, Math.atan2(Math.cos(t * sp + a), -Math.sin(t * sp * 0.9 + a)), 0);
          d.scale.setScalar(1);
          d.updateMatrix();
          inst.setMatrixAt(i, d.matrix);
          d.position.y += 0.05; d.rotation.z = Math.sin(t * 60 + i) * 0.8;
          d.updateMatrix();
          wings.setMatrixAt(i, d.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        wings.instanceMatrix.needsUpdate = true;
      },
    };
  },

  charioteer() {
    const g = new THREE.Group();
    const cart = grp(g, 0, 0.7, -0.4);
    m(cart, box(1.3, 0.6, 0.9), '#b45309', [0, 0.1, 0]);
    m(cart, box(1.35, 0.1, 0.95), '#fbbf24', [0, 0.42, 0]);
    const wheels = [-1, 1].map((s) => { const w = grp(cart, s * 0.75, -0.1, -0.05); m(w, cyl(0.55, 0.55, 0.08, 12), '#78350f', [0, 0, 0], { rot: [0, 0, Math.PI / 2] }); m(w, box(0.1, 1.0, 0.06), '#fbbf24', [0, 0, 0], { rot: [0, 0, 0] }); return w; });
    const driver = grp(cart, 0, 0.45, 0);
    m(driver, box(0.4, 0.7, 0.28), '#f5f5f4', [0, 0.35, 0]);
    m(driver, sph(0.17), '#a16207', [0, 0.85, 0]);
    m(driver, box(0.42, 0.28, 0.3), '#1d4ed8', [0, 0.95, -0.05]);
    for (let i = 0; i < 4; i++) m(driver, box(0.43, 0.04, 0.31), '#fbbf24', [0, 0.85 + i * 0.06, -0.05], { outline: false });
    const bowArm = grp(driver, -0.25, 0.6, 0.05);
    m(bowArm, new THREE.TorusGeometry(0.3, 0.025, 6, 12, Math.PI), '#78350f', [0, -0.2, 0.25], { rot: [0, Math.PI / 2, Math.PI / 2] });
    const horses = [-1, 1].map((s) => {
      const h = grp(g, s * 0.38, 0.95, 1.0);
      m(h, box(0.32, 0.4, 1.0), s < 0 ? '#f5f5f4' : '#1c1917', [0, 0, 0]);
      const head = grp(h, 0, 0.35, 0.55); m(head, box(0.2, 0.45, 0.25), s < 0 ? '#f5f5f4' : '#1c1917', [0, 0.1, 0.1], { rot: [0.5, 0, 0] });
      const hl = [[-0.1, 0.35], [0.1, 0.35], [-0.1, -0.35], [0.1, -0.35]].map(([x, z]) => { const l = grp(h, x, -0.2, z); m(l, box(0.08, 0.6, 0.08), s < 0 ? '#e7e5e4' : '#292524', [0, -0.3, 0]); return l; });
      return { h, hl };
    });
    return {
      group: g, parts: {},
      anim(e, dt) {
        const sp = Math.hypot(e.vel.x, e.vel.z);
        for (const w of wheels) w.rotation.x += sp * (dt || 0.016) * 1.8;
        e._ph = (e._ph || 0) + sp * (dt || 0.016) * 2;
        for (const { hl } of horses) hl.forEach((l, i) => { l.rotation.x = Math.sin(e._ph + i * 1.6) * Math.min(0.9, sp * 0.15); });
        bowArm.rotation.x = e.pose === 'shoot' ? -1.4 : -0.3;
      },
    };
  },

  goldenCalf() {
    const g = new THREE.Group();
    m(g, cyl(0.85, 0.95, 0.5, 8), '#a8a29e', [0, 0.25, 0]);
    const gold = mat('#fbbf24', { emissive: '#b45309', emissiveIntensity: 0.35 });
    const body = grp(g, 0, 1.15, 0);
    m(body, box(0.5, 0.45, 1.0), '#fbbf24', [0, 0, 0], { material: gold });
    const head = grp(body, 0, 0.3, 0.55);
    m(head, box(0.32, 0.32, 0.38), '#fbbf24', [0, 0, 0.05], { material: gold });
    for (const s of [-1, 1]) m(head, cone(0.05, 0.25, 6), '#fde68a', [s * 0.14, 0.24, -0.02], { rot: [0, 0, -s * 0.5] });
    eyes(head, 0.05, 0.2, 0.09, '#ef4444', 0.035);
    for (const [x, z] of [[-0.17, 0.35], [0.17, 0.35], [-0.17, -0.35], [0.17, -0.35]]) m(body, box(0.12, 0.55, 0.12), '#fbbf24', [x, -0.45, z], { material: gold });
    return {
      group: g, parts: {},
      anim(e) {
        body.position.y = 1.15 + Math.sin(now() * 2) * 0.04;
        body.rotation.y = e.pose === 'spin' ? now() * 8 : Math.sin(now() * 0.7) * 0.3;
      },
    };
  },

  goliath() {
    const g = new THREE.Group();
    const body = grp(g, 0, 2.1, 0);
    m(body, box(1.3, 1.5, 0.8), '#a16207', [0, 0.6, 0]);
    for (let i = 0; i < 4; i++) m(body, box(1.32, 0.08, 0.82), '#713f12', [0, 0.1 + i * 0.32, 0], { outline: false });
    m(body, box(1.4, 0.4, 0.85), '#78716c', [0, 1.15, 0]);
    const head = grp(body, 0, 1.75, 0.05);
    m(head, sph(0.38), '#c68642', [0, 0, 0]);
    m(head, cone(0.42, 0.55, 10), '#b45309', [0, 0.38, 0]);
    m(head, box(0.1, 0.3, 0.12), '#b45309', [0, -0.02, 0.35]);
    m(head, sph(0.32), '#3f2a14', [0, -0.25, 0.12], { scale: [1, 0.9, 0.8] });
    eyes(head, 0.05, 0.33, 0.13, '#111', 0.05);
    const brow = m(head, sph(0.1, 8, 6), '#ffe08a', [0, 0.16, 0.34], { material: glow('#ffe08a'), outline: false });
    brow.userData.noMerge = true;
    const spearArm = grp(body, -0.8, 1.2, 0.1);
    m(spearArm, cap(0.17, 1.0), '#c68642', [0, -0.6, 0]);
    const spear = grp(spearArm, 0, -1.2, 0.1);
    m(spear, cyl(0.05, 0.05, 4.2, 6), '#78350f', [0, 0, 1.0], { rot: [Math.PI / 2, 0, 0] });
    m(spear, cone(0.12, 0.6, 6), '#d6d3d1', [0, 0, 3.3], { rot: [Math.PI / 2, 0, 0] });
    const shieldArm = grp(body, 0.8, 1.2, 0.1);
    m(shieldArm, cap(0.17, 1.0), '#c68642', [0, -0.6, 0]);
    m(shieldArm, cyl(0.7, 0.7, 0.12, 14), '#b45309', [0.1, -0.9, 0.35], { rot: [Math.PI / 2, 0, 0] });
    const L = legs(g, 2.1, 0.35, 2.1, '#c68642', 0.2);
    return {
      group: g, parts: {},
      anim(e) {
        walk(e, L, 0.5);
        const p = e.pose;
        spearArm.rotation.x = p === 'thrust' ? -1.5 : p === 'wind' ? -0.4 : -1.0;
        spear.position.z = p === 'thrust' ? 0.8 : 0;
        shieldArm.rotation.y = p === 'bash' ? -0.9 : 0;
        brow.visible = !!e.showWeakSpot;
        body.rotation.x = p === 'taunt' ? -0.2 : 0;
      },
    };
  },
};
