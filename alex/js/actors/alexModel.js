// Alex's procedural model: a jointed anime figure with ink outlines, spiky hair with
// spring motion, a verlet scarf and an x-ray silhouette that shows through anything
// that overlaps him ("That's me.").

import * as THREE from 'three';
import { mat, glow, toonGradient, textTexture, collapseRig } from '../world/props.js';

const C = {
  skin: '#f3cfae', hair: '#17121f', streak: '#ff4fa3', jacket: '#1d1a33', trim: '#ff4fa3', shirt: '#f4f1ff',
  pants: '#2b2d52', shoe: '#ffffff', scarf: '#e5383b', blade: '#ff7ce6', bladeCore: '#ffffff', eye: '#20132e',
};

const outlineMat = new THREE.MeshBasicMaterial({ color: '#0b0714', side: THREE.BackSide });
// X-ray silhouette: drawn only where Alex is hidden behind *other* geometry. Alex's own
// meshes write stencil = 1, so self-occlusion (an arm in front of the torso) never shows.
const xrayMat = new THREE.MeshBasicMaterial({
  color: '#67f3ff', transparent: true, opacity: 0.4, depthFunc: THREE.GreaterDepth, depthWrite: false,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
  stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
});
const stencilCache = new Map();
function stencilMat(m) {
  let s = stencilCache.get(m);
  if (!s) {
    s = m.clone();
    s.stencilWrite = true;
    s.stencilRef = 1;
    s.stencilFunc = THREE.AlwaysStencilFunc;
    s.stencilZPass = THREE.ReplaceStencilOp;
    stencilCache.set(m, s);
  }
  return s;
}

function part(parent, geo, color, pos, opts = {}) {
  const m = new THREE.Mesh(geo, opts.material || mat(color));
  if (pos) m.position.set(...pos);
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.rot) m.rotation.set(...opts.rot);
  parent.add(m);
  if (opts.outline !== false) {
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.setScalar(opts.outlineScale || 1.08);
    o.userData.outline = true;
    m.add(o);
  }
  if (opts.xray !== false) {
    const x = new THREE.Mesh(geo, xrayMat);
    x.userData.outline = true;
    x.userData.xray = true;
    x.renderOrder = 20;
    m.add(x);
  }
  return m;
}

const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

export class AlexModel {
  constructor() {
    const root = new THREE.Group();
    this.root = root;
    const body = pivot(root, 0, 0, 0);
    this.body = body;              // extra spin/tilt layer (flips, spins)
    const hips = pivot(body, 0, 0.93, 0);
    this.hips = hips;
    const torso = pivot(hips, 0, 0.02, 0);
    this.torso = torso;

    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
    // torso: jacket with trim + shirt front
    part(torso, cap(0.2, 0.32), C.jacket, [0, 0.28, 0], { scale: [1.05, 1, 0.72] });
    part(torso, new THREE.BoxGeometry(0.2, 0.36, 0.05), C.shirt, [0, 0.3, 0.14], { outline: false });
    this.shirtPrint = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ map: textTexture('♥', { bg: null, fg: '#ff4fa3', w: 64, h: 64, font: 'bold 56px sans-serif' }), transparent: true }));
    this.shirtPrint.position.set(0, 0.3, 0.168);
    this.shirtPrint.visible = false;
    torso.add(this.shirtPrint);
    part(torso, new THREE.BoxGeometry(0.44, 0.05, 0.3), C.trim, [0, 0.05, 0], { outline: false });
    part(torso, new THREE.TorusGeometry(0.13, 0.035, 6, 12), C.trim, [0, 0.52, 0], { rot: [Math.PI / 2, 0, 0], outline: false });

    // head
    const neck = pivot(torso, 0, 0.56, 0);
    this.neck = neck;
    const head = pivot(neck, 0, 0.12, 0);
    this.head = head;
    part(head, new THREE.SphereGeometry(0.16, 16, 12), C.skin, [0, 0.03, 0], { scale: [1, 1.08, 1] });
    for (const s of [-1, 1]) {
      part(head, new THREE.BoxGeometry(0.045, 0.07, 0.02), C.eye, [s * 0.058, 0.04, 0.15], { outline: false, xray: false });
      part(head, new THREE.BoxGeometry(0.02, 0.02, 0.02), '#ffffff', [s * 0.05, 0.06, 0.162], { outline: false, xray: false, material: glow('#ffffff') });
    }
    // spiky hair: cluster of cones on a hair group that springs
    const hair = pivot(head, 0, 0.08, 0);
    this.hair = hair;
    part(hair, new THREE.SphereGeometry(0.175, 14, 10), C.hair, [0, 0.02, -0.02], { scale: [1.05, 0.95, 1.08] });
    const spikes = [
      [0, 0.16, -0.05, -0.5, 0, 0], [0.1, 0.12, -0.08, -0.6, 0, -0.6], [-0.1, 0.12, -0.08, -0.6, 0, 0.6], [0, 0.06, -0.16, -1.5, 0, 0],
      [0.13, 0.02, -0.12, -1.2, 0, -1.0], [-0.13, 0.02, -0.12, -1.2, 0, 1.0], [0.06, 0.1, 0.12, 0.9, 0, -0.3], [-0.07, 0.1, 0.12, 0.9, 0, 0.4],
      [0.16, -0.02, 0.02, 0, 0, -1.4], [-0.16, -0.02, 0.02, 0, 0, 1.4],
    ];
    spikes.forEach(([x, y, z, rx, ry, rz], i) => {
      part(hair, new THREE.ConeGeometry(0.065, 0.24, 6), i === 3 ? C.streak : C.hair, [x, y, z], { rot: [rx, ry, rz] });
    });

    // arms
    const arm = (side) => {
      const sh = pivot(torso, side * 0.24, 0.47, 0);
      part(sh, cap(0.06, 0.2), C.jacket, [0, -0.14, 0]);
      const el = pivot(sh, 0, -0.29, 0);
      part(el, cap(0.052, 0.18), C.jacket, [0, -0.12, 0]);
      part(el, new THREE.SphereGeometry(0.058, 10, 8), C.skin, [0, -0.27, 0]);
      const hand = pivot(el, 0, -0.28, 0);
      return { sh, el, hand };
    };
    this.armL = arm(1); this.armR = arm(-1);
    // legs
    const leg = (side) => {
      const hp = pivot(hips, side * 0.11, 0, 0);
      part(hp, cap(0.078, 0.3), C.pants, [0, -0.22, 0]);
      const kn = pivot(hp, 0, -0.44, 0);
      part(kn, cap(0.066, 0.3), C.pants, [0, -0.2, 0]);
      const ft = pivot(kn, 0, -0.44, 0);
      part(ft, new THREE.BoxGeometry(0.12, 0.08, 0.26), C.shoe, [0, 0.02, 0.05]);
      part(ft, new THREE.BoxGeometry(0.125, 0.03, 0.27), C.trim, [0, -0.02, 0.05], { outline: false });
      return { hp, kn, ft };
    };
    this.legL = leg(1); this.legR = leg(-1);

    // weapon (right hand): a lightstick katana
    const blade = new THREE.Group();
    part(blade, new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), '#222', [0, -0.02, 0]);
    part(blade, new THREE.BoxGeometry(0.1, 0.02, 0.05), C.trim, [0, 0.1, 0], { outline: false });
    this.bladeMesh = part(blade, new THREE.BoxGeometry(0.035, 0.85, 0.012), C.blade, [0, 0.54, 0], { material: glow(C.blade) });
    part(blade, new THREE.BoxGeometry(0.012, 0.8, 0.014), C.bladeCore, [0, 0.54, 0], { outline: false, material: glow('#ffffff') });
    blade.rotation.x = Math.PI / 2;
    this.armR.hand.add(blade);
    this.blade = blade;
    // ranged: compact blaster in the left hand, shown while shooting
    const gun = new THREE.Group();
    part(gun, new THREE.BoxGeometry(0.06, 0.1, 0.24), '#2b2d42', [0, 0, 0.06]);
    part(gun, new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), '#67f3ff', [0, 0.02, 0.2], { rot: [Math.PI / 2, 0, 0], material: glow('#67f3ff') });
    gun.visible = false;
    this.armL.hand.add(gun);
    this.gun = gun;

    // scarf: verlet chain rendered as segments
    this.scarfPts = Array.from({ length: 8 }, () => ({ p: new THREE.Vector3(), o: new THREE.Vector3() }));
    this.scarfSegs = [];
    this.scarfGroup = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.1 - i * 0.008, 0.02, 1), mat(C.scarf));
      const o = new THREE.Mesh(seg.geometry, outlineMat);
      o.scale.setScalar(1.15); seg.add(o);
      this.scarfGroup.add(seg);
      this.scarfSegs.push(seg);
    }
    part(torso, new THREE.TorusGeometry(0.11, 0.05, 6, 12), C.scarf, [0, 0.55, 0], { rot: [Math.PI / 2, 0, 0] });
    collapseRig(root);
    root.traverse((c) => { if (c.isMesh && !c.userData.xray) c.material = stencilMat(c.material); });
    this.scarfInit = false;
    this.hairVel = new THREE.Vector2();
    this.hairOff = new THREE.Vector2();
    this.lastPos = new THREE.Vector3();
    this.xrayOn = true;
    this.cur = {};
  }

  addTo(scene) { scene.add(this.root); scene.add(this.scarfGroup); }

  setXray(on) {
    if (on === this.xrayOn) return;
    this.xrayOn = on;
    this.root.traverse((c) => { if (c.userData.xray) c.visible = on; });
  }
  setBladeColor(col) { this.bladeMesh.material = stencilMat(glow(col)); }
  setShirt(on) { this.shirtPrint.visible = on; }
  setVisible(v) { this.root.visible = v; this.scarfGroup.visible = v; }
  setFlash(on) {
    // mercy-invulnerability blink
    this.root.visible = on;
  }

  // Apply a pose (targets) with smoothing. P holds joint angles; see alex.js for producers.
  apply(P, dt, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-(P.rate || 22) * dt);
    const cur = this.cur;
    for (const key in P) {
      if (key === 'rate') continue;
      const v = P[key];
      cur[key] = cur[key] === undefined || snap ? v : cur[key] + (v - cur[key]) * k;
    }
    const g = (key, d = 0) => cur[key] ?? d;
    this.hips.position.y = 0.93 + g('hipY');
    this.hips.rotation.set(g('hipX'), g('hipYaw'), g('hipZ'));
    this.torso.rotation.set(g('torsoX'), g('torsoY'), g('torsoZ'));
    this.neck.rotation.set(g('headX'), g('headY'), 0);
    this.armL.sh.rotation.set(g('shLX'), g('shLY'), g('shLZ', 0.15));
    this.armL.el.rotation.set(g('elL', -0.3), 0, 0);
    this.armR.sh.rotation.set(g('shRX'), g('shRY'), g('shRZ', -0.15));
    this.armR.el.rotation.set(g('elR', -0.3), 0, 0);
    this.legL.hp.rotation.set(g('legLX'), 0, g('legLZ'));
    this.legL.kn.rotation.set(g('knL'), 0, 0);
    this.legL.ft.rotation.set(g('ftL'), 0, 0);
    this.legR.hp.rotation.set(g('legRX'), 0, g('legRZ'));
    this.legR.kn.rotation.set(g('knR'), 0, 0);
    this.legR.ft.rotation.set(g('ftR'), 0, 0);
    this.blade.rotation.set(Math.PI / 2 + g('bladeX'), g('bladeY'), g('bladeZ'));
  }

  // Secondary motion: hair spring + scarf verlet. Call after positioning root.
  secondary(dt, worldVel) {
    dt = Math.min(dt, 1 / 30);
    // hair: spring toward rest, pushed by acceleration
    const ax = -worldVel.x, az = -worldVel.z;
    const yaw = this.root.rotation.y;
    const lx = ax * Math.cos(yaw) - az * Math.sin(yaw), lz = ax * Math.sin(yaw) + az * Math.cos(yaw);
    this.hairVel.x += (-this.hairOff.x * 120 - this.hairVel.x * 9 + lz * 2.2) * dt;
    this.hairVel.y += (-this.hairOff.y * 120 - this.hairVel.y * 9 + lx * 2.2) * dt;
    this.hairOff.x += this.hairVel.x * dt; this.hairOff.y += this.hairVel.y * dt;
    this.hair.rotation.x = Math.max(-0.5, Math.min(0.5, this.hairOff.x * 0.05));
    this.hair.rotation.z = Math.max(-0.5, Math.min(0.5, -this.hairOff.y * 0.05));

    // scarf anchor: behind the neck
    this.root.updateMatrixWorld(true);
    const anchor = new THREE.Vector3(0, 0.52, -0.12);
    this.torso.localToWorld(anchor);
    const pts = this.scarfPts;
    if (!this.scarfInit) {
      pts.forEach((pt, i) => { pt.p.copy(anchor).add(new THREE.Vector3(0, -i * 0.1, 0)); pt.o.copy(pt.p); });
      this.scarfInit = true;
    }
    pts[0].p.copy(anchor); pts[0].o.copy(anchor);
    const segLen = 0.13;
    for (let i = 1; i < pts.length; i++) {
      const pt = pts[i];
      const vx = (pt.p.x - pt.o.x) * 0.9, vy = (pt.p.y - pt.o.y) * 0.9, vz = (pt.p.z - pt.o.z) * 0.9;
      pt.o.copy(pt.p);
      pt.p.x += vx; pt.p.y += vy - 9 * dt * dt; pt.p.z += vz;
      // flutter
      pt.p.x += Math.sin(performance.now() * 0.012 + i) * 0.0025;
      if (pt.p.y < 0.03) pt.p.y = 0.03;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1].p, b = pts[i].p;
        const d = b.clone().sub(a), l = d.length() || 1e-6;
        const diff = (l - segLen) / l;
        if (i === 1) b.sub(d.multiplyScalar(diff));
        else { a.add(d.clone().multiplyScalar(diff * 0.5)); b.sub(d.multiplyScalar(diff * 0.5)); }
      }
      pts[0].p.copy(anchor);
    }
    for (let i = 0; i < this.scarfSegs.length; i++) {
      const a = pts[i].p, b = pts[i + 1].p, s = this.scarfSegs[i];
      s.position.copy(a).add(b).multiplyScalar(0.5);
      s.lookAt(b);
      s.scale.z = a.distanceTo(b) + 0.02;
    }
  }
}
