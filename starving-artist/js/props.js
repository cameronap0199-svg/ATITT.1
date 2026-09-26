// Low-poly prop library. Albedo lives in vertex colours so static props can share one
// material per texture and have lighting baked into them by the level.
import * as THREE from 'three';
import { mat, ensureColor } from './renderer.js';
import { tex, faceTex } from './tex.js';

const matCache = new Map();
export function sharedMat(texKey = null, extra = {}) {
  const k = (texKey || '-') + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, mat({ map: texKey ? (typeof texKey === 'string' ? tex(texKey) : texKey) : null, ...extra }));
  return matCache.get(k);
}
export function clearMatCache() { matCache.clear(); }

function paint(geo, color) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export function mesh(geo, color = 0xffffff, texKey = null, extra = {}) {
  const m = new THREE.Mesh(paint(geo, color), sharedMat(texKey, extra));
  return m;
}
export function box(w, h, d, color, texKey = null, extra) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), color, texKey, extra);
  return m;
}
export function cyl(rt, rb, h, seg, color, texKey = null, extra) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, texKey, extra); }
export function sphere(r, color, seg = 6, texKey = null, extra) { return mesh(new THREE.SphereGeometry(r, seg, Math.max(3, seg - 2)), color, texKey, extra); }
export function cone(r, h, seg, color, extra) { return mesh(new THREE.ConeGeometry(r, h, seg), color, null, extra); }
export function plane(w, h, color, texKey = null, extra) { return mesh(new THREE.PlaneGeometry(w, h), color, texKey, extra); }
export function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }
function grp(...kids) { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; }
function emissive(m) { m.userData.noBake = true; return m; }

// Unique material for textures that change at runtime (paintings, screens).
export function uniquePlane(w, h, texture, { emissive: em = 0.55, color = 0xffffff, transparent = false, side } = {}) {
  // Baked with the room's light like any prop; emissive decides how much it glows on its own.
  const m = new THREE.Mesh(paint(new THREE.PlaneGeometry(w, h), color), mat({ map: texture, emissive: em, transparent, side, dyn: 0.6 }));
  if (em >= 1) m.userData.noBake = true;
  return m;
}

// ---------------------------------------------------------------- furniture
export function easel(canvasTexture, { w = 1.0, h = 0.75 } = {}) {
  const g = new THREE.Group();
  const wood = 0x8a5a36;
  const l1 = box(0.06, 1.9, 0.06, wood); l1.position.set(-0.4, 0.92, 0); l1.rotation.z = -0.12;
  const l2 = box(0.06, 1.9, 0.06, wood); l2.position.set(0.4, 0.92, 0); l2.rotation.z = 0.12;
  const l3 = box(0.06, 1.8, 0.06, wood); l3.position.set(0, 0.85, -0.45); l3.rotation.x = 0.28;
  const ledge = box(1.0, 0.05, 0.2, wood); ledge.position.set(0, 0.9, 0.1);
  const top = box(0.1, 0.06, 0.08, wood); top.position.set(0, 1.78, 0.02);
  g.add(l1, l2, l3, ledge, top);
  const back = box(w + 0.04, h + 0.04, 0.04, 0xe8e0d0); back.position.set(0, 0.92 + h / 2 + 0.03, 0.1); back.rotation.x = -0.08;
  g.add(back);
  const pic = uniquePlane(w, h, canvasTexture, { emissive: 0.42 });
  pic.position.set(0, 0.92 + h / 2 + 0.03, 0.126); pic.rotation.x = -0.08;
  g.add(pic);
  g.userData.canvas = pic;
  return g;
}

export function frame(w, h, texture, { frameColor = 0xc9a24a, depth = 0.08, emissiveAmt = 0.38 } = {}) {
  const g = new THREE.Group();
  const t = 0.09;
  g.add(at(box(w + t * 2, t, depth, frameColor), 0, h / 2 + t / 2, 0));
  g.add(at(box(w + t * 2, t, depth, frameColor), 0, -h / 2 - t / 2, 0));
  g.add(at(box(t, h, depth, frameColor), -w / 2 - t / 2, 0, 0));
  g.add(at(box(t, h, depth, frameColor), w / 2 + t / 2, 0, 0));
  const pic = uniquePlane(w, h, texture, { emissive: emissiveAmt });
  pic.position.z = 0.01;
  g.add(pic);
  g.userData.pic = pic;
  return g;
}

export function plaque(texture, w = 0.5, h = 0.14) {
  const g = new THREE.Group();
  g.add(box(w + 0.04, h + 0.04, 0.02, 0x2a2622));
  const p = uniquePlane(w, h, texture, { emissive: 0.5, transparent: false });
  p.position.z = 0.012; g.add(p);
  return g;
}

export function bench(color = 0xd8d0c8) {
  return grp(at(box(2.0, 0.1, 0.5, color, 'marble'), 0, 0.45, 0), at(box(0.3, 0.42, 0.4, color, 'marble'), -0.75, 0.21, 0), at(box(0.3, 0.42, 0.4, color, 'marble'), 0.75, 0.21, 0));
}

export function fountain(waterColor = 0x9fe0f5) {
  const g = new THREE.Group();
  g.add(at(cyl(2.3, 2.4, 0.6, 8, 0xf0ecf4, 'marble'), 0, 0.3, 0));
  const water = emissive(mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.05, 8), waterColor, 'water', { scroll: [0.02, 0.03], emissive: 0.45 }));
  water.position.y = 0.55; g.add(water);
  g.add(at(cyl(0.3, 0.4, 1.8, 6, 0xf0ecf4, 'marble'), 0, 1.2, 0));
  g.add(at(cyl(0.9, 0.5, 0.3, 8, 0xf0ecf4, 'marble'), 0, 2.1, 0));
  g.userData.water = water;
  return g;
}

export function plant(wilted = 0, potColor = 0xd07a52) {
  const g = new THREE.Group();
  g.add(at(cyl(0.28, 0.2, 0.45, 6, potColor), 0, 0.225, 0));
  const leaf = new THREE.Color(0x4f9a4a).lerp(new THREE.Color(0x6b5a3a), wilted);
  for (let i = 0; i < 6; i++) {
    const l = cone(0.12, 0.8 - wilted * 0.3, 4, leaf.getHex());
    const a = i / 6 * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.12, 0.75 - wilted * 0.2, Math.sin(a) * 0.12);
    l.rotation.set(Math.sin(a) * (0.4 + wilted * 1.1), 0, -Math.cos(a) * (0.4 + wilted * 1.1));
    g.add(l);
  }
  return g;
}

export function chair(color = 0xa0643c) {
  return grp(
    at(box(0.5, 0.06, 0.5, color), 0, 0.46, 0),
    at(box(0.5, 0.6, 0.06, color), 0, 0.78, -0.22),
    ...[[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]].map(([x, z]) => at(box(0.05, 0.46, 0.05, color), x, 0.23, z)),
  );
}

export function table(w = 1.4, d = 0.8, color = 0xb07a4a, h = 0.76) {
  return grp(
    at(box(w, 0.06, d, color, 'wood'), 0, h, 0),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => at(box(0.06, h, 0.06, color), x * (w / 2 - 0.08), h / 2, z * (d / 2 - 0.08))),
  );
}

export function bed(sheet = 0xe7a8c0, { w = 1.3, l = 2.0 } = {}) {
  return grp(
    at(box(w, 0.35, l, 0x8a6a4a, 'wood'), 0, 0.2, 0),
    at(box(w - 0.06, 0.18, l - 0.1, sheet, 'fabricPink'), 0, 0.46, 0.02),
    at(box(w - 0.3, 0.12, 0.35, 0xffffff, 'sheet'), 0, 0.6, -l / 2 + 0.3),
    at(box(w + 0.06, 0.8, 0.08, 0x8a6a4a, 'wood'), 0, 0.5, -l / 2),
  );
}

export function couch(color = 0x6b7fb5) {
  return grp(
    at(box(2.0, 0.4, 0.85, color, 'fabricBlue'), 0, 0.25, 0),
    at(box(2.0, 0.55, 0.22, color, 'fabricBlue'), 0, 0.6, -0.33),
    at(box(0.2, 0.3, 0.85, color, 'fabricBlue'), -0.95, 0.55, 0),
    at(box(0.2, 0.3, 0.85, color, 'fabricBlue'), 0.95, 0.55, 0),
  );
}

export function lamp(on = true, shade = 0xffe2b0) {
  const g = grp(at(cyl(0.18, 0.2, 0.05, 6, 0x333333), 0, 0.03, 0), at(cyl(0.03, 0.03, 1.5, 4, 0x333333), 0, 0.78, 0));
  const s = cyl(0.18, 0.3, 0.35, 6, on ? shade : 0x8a8070, null, on ? { emissive: 0.9 } : {});
  s.position.y = 1.6; if (on) s.userData.noBake = true;
  g.add(s);
  return g;
}

export function deskLamp(on = true) {
  const g = grp(at(cyl(0.08, 0.1, 0.03, 6, 0x2a2a2a), 0, 0.02, 0), at(box(0.03, 0.35, 0.03, 0x2a2a2a), 0, 0.2, 0));
  const s = cone(0.1, 0.14, 6, on ? 0xfff0c0 : 0x555555, on ? { emissive: 1 } : {});
  s.position.set(0, 0.38, 0.05); s.rotation.x = 0.6; if (on) s.userData.noBake = true;
  g.add(s);
  return g;
}

export function cardboardBox(s = 0.55, open = false) {
  const g = grp(at(box(s, s * 0.8, s, 0xc19a6b), 0, s * 0.4, 0), at(box(s * 1.01, 0.04, 0.12, 0xe8d8a8), 0, s * 0.8, 0));
  if (open) g.add(at(box(s, 0.02, s * 0.5, 0xb38c5e), 0, s * 0.8, -s * 0.5));
  return g;
}

export function fridge() {
  return grp(at(box(0.75, 1.8, 0.7, 0xeeeeea), 0, 0.9, 0), at(box(0.04, 0.4, 0.05, 0x888888), 0.3, 1.3, 0.37), at(box(0.72, 0.02, 0.02, 0xbbbbbb), 0, 1.1, 0.36));
}
export function counter(w = 2, withSink = false) {
  const g = grp(at(box(w, 0.9, 0.65, 0xd9d3c7), 0, 0.45, 0), at(box(w + 0.04, 0.05, 0.7, 0x7a7a80), 0, 0.92, 0));
  if (withSink) g.add(at(box(0.5, 0.02, 0.4, 0x445566), 0, 0.95, 0.02), at(box(0.04, 0.3, 0.04, 0xcccccc), 0, 1.1, -0.22));
  return g;
}
export function stove() {
  const g = grp(at(box(0.75, 0.9, 0.65, 0xf2f2ee), 0, 0.45, 0));
  for (const [x, z] of [[-0.18, -0.15], [0.18, -0.15], [-0.18, 0.15], [0.18, 0.15]]) g.add(at(cyl(0.11, 0.11, 0.02, 6, 0x222222), x, 0.91, z));
  return g;
}

export function tv(screenTex = null) {
  const g = grp(at(box(0.9, 0.65, 0.55, 0x3a3a3e), 0, 0.33, 0));
  const scr = screenTex ? uniquePlane(0.72, 0.5, screenTex, { emissive: 1 }) : emissive(plane(0.72, 0.5, 0x223344, 'static', { emissive: 0.7 }));
  scr.position.set(0, 0.35, 0.28); g.add(scr);
  g.userData.screen = scr;
  return g;
}

export function laptop(screenTex = null) {
  const g = grp(at(box(0.42, 0.02, 0.3, 0x9a9aa2), 0, 0.01, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.15); lid.rotation.x = -0.25;
  lid.add(at(box(0.42, 0.3, 0.02, 0x9a9aa2), 0, 0.15, 0));
  const scr = screenTex ? uniquePlane(0.38, 0.26, screenTex, { emissive: 1 }) : emissive(plane(0.38, 0.26, 0xaad0ff, null, { emissive: 1 }));
  scr.position.set(0, 0.15, 0.012); lid.add(scr);
  g.add(lid); g.userData.screen = scr;
  return g;
}

export function phone(wall = false, color = 0xe8e2d6) {
  if (wall) return grp(at(box(0.22, 0.34, 0.08, color), 0, 1.45, 0), at(box(0.07, 0.3, 0.07, color), -0.14, 1.45, 0.05));
  return grp(at(box(0.25, 0.08, 0.2, color), 0, 0.04, 0), at(box(0.26, 0.05, 0.07, color), 0, 0.1, 0));
}
export function cellphone() {
  const g = grp(at(box(0.08, 0.01, 0.15, 0x1a1a1e), 0, 0.005, 0));
  g.add(emissive(at(plane(0.07, 0.13, 0x9ad6ff, null, { emissive: 1 }), 0, 0.012, 0)));
  g.children[1].rotation.x = -Math.PI / 2;
  return g;
}

export function wardrobe(color = 0x6a4a34) {
  const g = grp(at(box(1.2, 2.1, 0.65, color, 'woodDark'), 0, 1.05, 0), at(box(0.02, 1.9, 0.02, 0x2a1a10), 0, 1.05, 0.33),
    at(box(0.04, 0.12, 0.04, 0xc9a24a), -0.08, 1.1, 0.34), at(box(0.04, 0.12, 0.04, 0xc9a24a), 0.08, 1.1, 0.34));
  return g;
}

export function crate(s = 0.8) { return at(box(s, s, s, 0x9a7a52, 'wood'), 0, s / 2, 0); }

export function coveredPainting(w = 1.2, h = 1.5) {
  const g = new THREE.Group();
  const s = box(w, h, 0.15, 0xd8d2c6, 'sheet'); s.position.y = h / 2 + 0.05; s.rotation.x = -0.1;
  const drape = box(w + 0.1, 0.1, 0.4, 0xd0cabe, 'sheet'); drape.position.set(0, 0.05, 0.1);
  g.add(s, drape);
  return g;
}

export function pedestal(color = 0xf0ecf4) { return grp(at(box(0.6, 1.0, 0.6, color, 'marble'), 0, 0.5, 0), at(box(0.7, 0.06, 0.7, color, 'marble'), 0, 1.03, 0)); }

export function shelfUnit(w = 1.6) { return grp(at(box(w, 2.0, 0.4, 0x5c4a38, 'shelf'), 0, 1.0, 0)); }

export function doorMesh(w = 1.0, h = 2.1, color = 0xe8e0d6) {
  const g = grp(at(box(w, h, 0.08, color, 'wood'), 0, h / 2, 0), at(sphere(0.05, 0xc9a24a, 5), w / 2 - 0.12, h * 0.48, 0.07));
  return g;
}

export function windowQuad(w, h, skyKey = 'skyDay', { frameColor = 0xf6f2ea } = {}) {
  const g = new THREE.Group();
  const s = emissive(plane(w, h, 0xffffff, skyKey, { emissive: 1 }));
  g.add(s);
  const t = 0.08;
  g.add(at(box(w + t * 2, t, 0.1, frameColor), 0, h / 2, 0), at(box(w + t * 2, t, 0.1, frameColor), 0, -h / 2, 0));
  g.add(at(box(t, h, 0.1, frameColor), -w / 2, 0, 0), at(box(t, h, 0.1, frameColor), w / 2, 0, 0));
  g.add(at(box(t * 0.6, h, 0.08, frameColor), 0, 0, 0), at(box(w, t * 0.6, 0.08, frameColor), 0, 0, 0));
  g.userData.sky = s;
  return g;
}

export function teddy(eyes = true) {
  const b = 0xb07a4a;
  const g = grp(at(sphere(0.18, b, 6), 0, 0.2, 0), at(sphere(0.13, b, 6), 0, 0.46, 0), at(sphere(0.05, b, 4), -0.1, 0.57, 0), at(sphere(0.05, b, 4), 0.1, 0.57, 0),
    at(sphere(0.06, b, 4), -0.17, 0.08, 0.08), at(sphere(0.06, b, 4), 0.17, 0.08, 0.08), at(sphere(0.045, 0xe0c0a0, 4), 0, 0.44, 0.11));
  if (eyes) g.add(at(sphere(0.018, 0x111111, 4), -0.045, 0.49, 0.11), at(sphere(0.018, 0x111111, 4), 0.045, 0.49, 0.11));
  return g;
}

export function balloon(color = 0xe8637a) {
  const g = grp(at(sphere(0.25, color, 6, null, { emissive: 0.3 }), 0, 2.1, 0), at(box(0.01, 1.8, 0.01, 0xffffff), 0, 1.0, 0));
  return g;
}

export function breaker(on = false) {
  const g = grp(at(box(0.5, 0.7, 0.15, 0x6a6e74, 'metal'), 0, 1.4, 0));
  const lever = box(0.08, 0.25, 0.08, on ? 0x55cc66 : 0xcc3333, null, { emissive: 0.6 });
  lever.position.set(0, 1.4, 0.1); lever.rotation.x = on ? -0.5 : 0.5; lever.userData.noBake = true;
  g.add(lever); g.userData.lever = lever;
  const bulb = sphere(0.04, on ? 0x55ff77 : 0x551111, 4, null, { emissive: 1 }); bulb.position.set(0.17, 1.68, 0.08); bulb.userData.noBake = true;
  g.add(bulb); g.userData.bulb = bulb;
  return g;
}

export function curtain(w = 2, h = 3) {
  const g = new THREE.Group();
  const n = Math.round(w / 0.25);
  for (let i = 0; i < n; i++) g.add(at(box(0.26, h, 0.1, 0xffffff, 'curtain'), -w / 2 + (i + 0.5) * (w / n), h / 2, (i % 2) * 0.08));
  return g;
}

export function stairsToNowhere(steps = 6) {
  const g = new THREE.Group();
  for (let i = 0; i < steps; i++) g.add(at(box(1.2, 0.25 * (i + 1), 0.35, 0xf2e8ee, 'marble'), 0, 0.125 * (i + 1), -i * 0.35));
  return g;
}

export function streetLamp() {
  const g = grp(at(cyl(0.06, 0.08, 3.2, 5, 0x2a2a30), 0, 1.6, 0));
  const b = sphere(0.22, 0xfff0c0, 6, null, { emissive: 1 }); b.position.y = 3.3; b.userData.noBake = true;
  g.add(b);
  return g;
}

export function cup(color = 0xffffff) { return grp(at(cyl(0.05, 0.04, 0.1, 6, color), 0, 0.05, 0)); }
export function plate(food = true) {
  const g = grp(at(cyl(0.14, 0.12, 0.02, 8, 0xffffff), 0, 0.01, 0));
  if (food) g.add(at(sphere(0.07, 0xd89a4a, 5), 0, 0.04, 0));
  return g;
}
export function cake() {
  const g = grp(at(cyl(0.2, 0.2, 0.18, 8, 0xf6c7d8), 0, 0.09, 0), at(cyl(0.21, 0.21, 0.03, 8, 0xffffff), 0, 0.18, 0));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.28;
    g.add(at(box(0.015, 0.08, 0.015, 0x9ad0f5), Math.cos(a) * 0.12, 0.23, Math.sin(a) * 0.12));
    const f = sphere(0.015, 0xffcc55, 3, null, { emissive: 1 }); f.position.set(Math.cos(a) * 0.12, 0.28, Math.sin(a) * 0.12); f.userData.noBake = true; g.add(f);
  }
  return g;
}
export function espresso() {
  const g = grp(at(box(0.7, 0.5, 0.5, 0xb8bcc2, 'metal'), 0, 0.25, 0), at(box(0.12, 0.08, 0.12, 0x222222), -0.15, 0.2, 0.28), at(box(0.12, 0.08, 0.12, 0x222222), 0.15, 0.2, 0.28));
  const l = sphere(0.03, 0xff5544, 4, null, { emissive: 1 }); l.position.set(0.28, 0.42, 0.26); l.userData.noBake = true; g.add(l);
  return g;
}
export function trashBag() { return grp(at(sphere(0.3, 0x1e1e22, 5), 0, 0.26, 0), at(cone(0.08, 0.15, 4, 0x1e1e22), 0, 0.58, 0)); }
export function toolbox() { return grp(at(box(0.5, 0.22, 0.24, 0xc03a2e), 0, 0.11, 0), at(box(0.3, 0.04, 0.04, 0x333333), 0, 0.26, 0)); }
export function sketchbook(color = 0x4a6ab0) { return grp(at(box(0.3, 0.03, 0.22, color), 0, 0.015, 0), at(box(0.28, 0.005, 0.2, 0xf6f2ea), 0.005, 0.032, 0)); }
export function mirror(w = 0.7, h = 1.3) {
  const g = grp(at(box(w + 0.1, h + 0.1, 0.05, 0x8a6a4a), 0, 0, 0));
  const glass = emissive(plane(w, h, 0xbcd0dc, 'marble', { emissive: 0.5 })); glass.position.z = 0.03; g.add(glass);
  g.userData.glass = glass;
  return g;
}
export function arch(w = 3, h = 4, color = 0xf6f0f4) {
  return grp(at(box(0.4, h, 0.4, color, 'marble'), -w / 2, h / 2, 0), at(box(0.4, h, 0.4, color, 'marble'), w / 2, h / 2, 0), at(box(w + 0.4, 0.4, 0.4, color, 'marble'), 0, h, 0));
}
export function stage(w = 8, d = 4, h = 0.8) { return grp(at(box(w, h, d, 0x3a2418, 'woodDark'), 0, h / 2, 0)); }
export function tulip(color = 0xe8637a) { return grp(at(box(0.02, 0.35, 0.02, 0x3a8a3a), 0, 0.175, 0), at(cone(0.05, 0.1, 5, color), 0, 0.38, 0)); }
export function vase(color = 0x9ad0f5) {
  const g = grp(at(cyl(0.08, 0.1, 0.25, 6, color), 0, 0.125, 0));
  for (let i = 0; i < 3; i++) { const t = tulip([0xe8637a, 0xf6d36b, 0xffffff][i]); t.position.set((i - 1) * 0.04, 0.2, 0); t.rotation.z = (i - 1) * 0.3; g.add(t); }
  return g;
}

// Sprite-like camera-facing quad (clouds, eyes).
export function billboard(texKey, w, h, opts = {}) {
  const m = new THREE.Mesh(paint(new THREE.PlaneGeometry(w, h), opts.color ?? 0xffffff), mat({ map: typeof texKey === 'string' ? tex(texKey) : texKey, emissive: opts.emissive ?? 1, alphaTest: 0.5, fog: opts.fog, side: THREE.DoubleSide }));
  m.userData.noBake = true;
  m.userData.billboard = true;
  return m;
}

// ---------------------------------------------------------------- people
// A low-poly person. opts: skin, hair, shirt, pants, height, mood, hairLong, faceTexture
export function person(opts = {}) {
  const o = { skin: '#e8b89a', hair: '#3a2a22', shirt: 0x6a8ac8, pants: 0x3a3a4a, height: 1.7, mood: 'neutral', hairLong: false, ...opts };
  const s = o.height / 1.7;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const legL = box(0.14, 0.8, 0.16, o.pants); legL.position.set(-0.09, 0.4, 0);
  const legR = box(0.14, 0.8, 0.16, o.pants); legR.position.set(0.09, 0.4, 0);
  const torso = box(0.42, 0.62, 0.24, o.shirt); torso.position.set(0, 1.1, 0);
  const armL = box(0.11, 0.6, 0.12, o.shirt); armL.position.set(-0.28, 1.1, 0);
  const armR = box(0.11, 0.6, 0.12, o.shirt); armR.position.set(0.28, 1.1, 0);
  const handL = box(0.1, 0.1, 0.1, o.skin); handL.position.set(-0.28, 0.76, 0);
  const handR = box(0.1, 0.1, 0.1, o.skin); handR.position.set(0.28, 0.76, 0);
  body.add(legL, legR, torso, armL, armR, handL, handR);
  const head = new THREE.Group(); head.position.set(0, 1.58, 0);
  const skull = box(0.3, 0.34, 0.3, o.skin);
  head.add(skull);
  const faceMat = mat({ map: o.faceTexture || faceTex(o.skin, o.hair, o.mood), probe: true });
  const face = new THREE.Mesh(ensureColor(new THREE.PlaneGeometry(0.3, 0.34)), faceMat);
  face.position.z = 0.151; head.add(face);
  const hairTop = box(0.33, 0.1, 0.33, new THREE.Color(o.hair).getHex()); hairTop.position.y = 0.18; head.add(hairTop);
  const hairBack = box(0.33, o.hairLong ? 0.55 : 0.28, 0.08, new THREE.Color(o.hair).getHex()); hairBack.position.set(0, o.hairLong ? -0.08 : 0.04, -0.14); head.add(hairBack);
  if (o.hairLong) { head.add(at(box(0.06, 0.45, 0.2, new THREE.Color(o.hair).getHex()), -0.17, -0.05, -0.02)); head.add(at(box(0.06, 0.45, 0.2, new THREE.Color(o.hair).getHex()), 0.17, -0.05, -0.02)); }
  body.add(head);
  g.scale.setScalar(s);
  g.userData = { head, face, faceMat, armL, armR, legL, legR, body, opts: o };
  return g;
}

export function mannequin(color = 0xe8e0d8) {
  const p = person({ skin: '#e8e0d8', hair: '#e8e0d8', shirt: color, pants: color, mood: 'blank' });
  return p;
}

// Convert a prop to use a per-object dynamic material (lit by probe + dynamic lights).
export function makeDynamic(obj) {
  const mats = new Map();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    if (m.material.uniforms?.uUseProbe?.value === 1) { mats.set(m.material, m.material); return; }
    if (m.userData.noBake) return;
    const key = m.material;
    if (!mats.has(key)) {
      const u = key.uniforms;
      const nm = mat({ map: u.map.value, probe: true, emissive: u.uEmissive.value, scroll: [u.uScroll.value.x, u.uScroll.value.y] });
      mats.set(key, nm);
    }
    m.material = mats.get(key);
  });
  const list = [...new Set(mats.values())];
  obj.userData.dynMats = list;
  return list;
}
export function setProbe(obj, color) {
  for (const m of obj.userData.dynMats || []) m.uniforms.uProbe.value.set(color.r, color.g, color.b);
}
