// Visual effects: pooled particles (sparks, confetti, debris, hearts), shockwave rings,
// slash arcs, ghost trails, screen flashes and speed lines.

import * as THREE from 'three';
import { G } from './state.js';
import { flashLevel } from './core/settings.js';
import { heartShape } from './world/props.js';

const MAX = 1400;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    this.add = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), MAX);
    this.solid = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), MAX);
    const hg = new THREE.ShapeGeometry(heartShape());
    this.heartMesh = new THREE.InstancedMesh(hg, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }), 200);
    for (const m of [this.add, this.solid, this.heartMesh]) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color());
      scene.add(m);
    }
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
    this.rings = [];
    this.arcs = [];
    this.ghosts = [];
    this.flashEl = document.getElementById('flash');
    this.flashV = 0;
    this.vignette = document.getElementById('vignette');
    this.vigV = 0;
    this.speedEl = document.getElementById('speedlines');
    this.speedV = 0;
  }

  clear() {
    this.parts.length = 0;
    for (const r of this.rings) this.scene.remove(r.mesh);
    for (const a of this.arcs) this.scene.remove(a.mesh);
    for (const g of this.ghosts) this.scene.remove(g.mesh);
    this.rings.length = 0; this.arcs.length = 0; this.ghosts.length = 0;
  }

  // kind: 'spark' (additive), 'debris' (solid), 'confetti' (solid, flutter), 'smoke', 'heart'
  burst(x, y, z, o = {}) {
    const n = o.n ?? 12;
    for (let i = 0; i < n && this.parts.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = o.up ?? 0.6;
      const sp = (o.speed ?? 6) * (0.4 + Math.random() * 0.8);
      const dirx = o.dir ? o.dir[0] + (Math.random() - 0.5) * (o.spread ?? 1) : Math.cos(a);
      const dirz = o.dir ? o.dir[1] + (Math.random() - 0.5) * (o.spread ?? 1) : Math.sin(a);
      const l = Math.hypot(dirx, dirz) || 1;
      this.parts.push({
        x, y, z,
        vx: (dirx / l) * sp * (1 - up * 0.5), vy: sp * up * (0.3 + Math.random()), vz: (dirz / l) * sp * (1 - up * 0.5),
        life: (o.life ?? 0.5) * (0.6 + Math.random() * 0.8), t: 0,
        size: (o.size ?? 0.18) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : (o.color ?? '#ffffff'),
        grav: o.grav ?? (o.kind === 'spark' ? 6 : 14), drag: o.drag ?? 1.5,
        kind: o.kind ?? 'spark', spin: (Math.random() - 0.5) * 12, rot: Math.random() * 6,
      });
    }
  }
  confetti(x, y, z, n = 40) {
    this.burst(x, y, z, { n, kind: 'confetti', color: ['#ff4fa3', '#4cc9f0', '#ffd60a', '#b5179e', '#3cff8f', '#ffffff'], speed: 8, up: 1.2, life: 1.8, size: 0.16, grav: 5, drag: 2.2 });
  }
  hearts(x, y, z, n = 6, color = '#ff4fa3') {
    this.burst(x, y, z, { n, kind: 'heart', color, speed: 3, up: 1.5, life: 1.0, size: 0.26, grav: -1, drag: 2 });
  }

  ring(x, y, z, o = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: o.color || '#ffffff', transparent: true, opacity: o.opacity ?? 0.8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.05, z);
    this.scene.add(m);
    this.rings.push({ mesh: m, t: 0, life: o.life ?? 0.4, r0: o.r0 ?? 0.3, r1: o.r1 ?? 3, o0: o.opacity ?? 0.8 });
  }

  // Slash arc: a fading crescent around (x,y,z) facing yaw.
  slash(x, y, z, yaw, o = {}) {
    const r = o.r ?? 2.2, arc = o.arc ?? Math.PI * 0.8;
    const geo = new THREE.RingGeometry(r * 0.55, r, 32, 1, -arc / 2, arc);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: o.color || '#ff9ef0', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    m.rotation.x = -Math.PI / 2 + (o.tilt ?? 0);
    m.rotation.z = Math.PI / 2 + (o.roll ?? 0);
    g.add(m);
    this.scene.add(g);
    this.arcs.push({ mesh: g, mat: m.material, t: 0, life: o.life ?? 0.16 });
  }

  // Ghost afterimage of an Object3D hierarchy (dash smear).
  ghost(obj, color = '#ff4fa3', life = 0.25, opacity = 0.45) {
    if (G.settings.motionBlur === 'off' && opacity < 0.5) return;
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const clone = obj.clone(true);
    clone.traverse((c) => { if (c.isMesh) { c.material = m; if (c.userData.outline) c.visible = false; } });
    obj.updateWorldMatrix(true, true);
    clone.matrixAutoUpdate = false;
    clone.matrix.copy(obj.matrixWorld);
    this.scene.add(clone);
    this.ghosts.push({ mesh: clone, mat: m, t: 0, life, o0: opacity });
  }

  flash(strength = 0.5, color = '#ffffff') {
    const k = flashLevel(G.settings);
    if (k <= 0 || !this.flashEl) return;
    this.flashEl.style.background = color;
    this.flashV = Math.max(this.flashV, strength * k);
  }
  hurtVignette(v = 0.6) { this.vigV = Math.max(this.vigV, v); }
  speed(v) { this.speedV = Math.max(this.speedV, v); }

  update(dt, realDt) {
    const d = this.dummy, cam = G.camera;
    let na = 0, ns = 0, nh = 0;
    const keep = [];
    for (const p of this.parts) {
      p.t += dt;
      if (p.t >= p.life) continue;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag; p.vz *= drag; p.vy = p.vy * drag - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.kind !== 'smoke') { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.spin * dt;
      keep.push(p);
      const k = 1 - p.t / p.life;
      d.position.set(p.x, p.y, p.z);
      if (p.kind === 'spark' || p.kind === 'smoke') {
        d.quaternion.copy(cam.quaternion);
        d.rotateZ(p.rot);
        const s = p.size * (p.kind === 'smoke' ? 1 + (1 - k) * 3 : k * 1.2 + 0.2);
        d.scale.set(s, s * (p.kind === 'spark' ? 2.2 : 1), s);
        d.updateMatrix();
        if (na < MAX) { this.add.setMatrixAt(na, d.matrix); this.col.set(p.color).multiplyScalar(p.kind === 'smoke' ? 0.25 * k : k); this.add.setColorAt(na, this.col); na++; }
      } else if (p.kind === 'heart') {
        d.quaternion.copy(cam.quaternion);
        d.scale.setScalar(p.size * (0.5 + k * 0.5));
        d.updateMatrix();
        if (nh < 200) { this.heartMesh.setMatrixAt(nh, d.matrix); this.col.set(p.color); this.heartMesh.setColorAt(nh, this.col); nh++; }
      } else {
        d.rotation.set(p.rot, p.rot * 0.7, p.rot * 1.3);
        const s = p.size * Math.min(1, k * 3);
        d.scale.set(s, s * (p.kind === 'confetti' ? 0.6 : 1), s);
        d.updateMatrix();
        if (ns < MAX) { this.solid.setMatrixAt(ns, d.matrix); this.col.set(p.color); this.solid.setColorAt(ns, this.col); ns++; }
      }
    }
    this.parts = keep;
    this.add.count = na; this.solid.count = ns; this.heartMesh.count = nh;
    for (const m of [this.add, this.solid, this.heartMesh]) {
      m.visible = m.count > 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); return false; }
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 2);
      r.mesh.scale.setScalar(rad);
      r.mesh.material.opacity = r.o0 * (1 - k);
      return true;
    });
    this.arcs = this.arcs.filter((a) => {
      a.t += dt;
      const k = a.t / a.life;
      if (k >= 1) { this.scene.remove(a.mesh); a.mat.dispose(); a.mesh.children[0].geometry.dispose(); return false; }
      a.mat.opacity = 0.85 * (1 - k);
      a.mesh.scale.setScalar(1 + k * 0.15);
      return true;
    });
    this.ghosts = this.ghosts.filter((g) => {
      g.t += dt;
      const k = g.t / g.life;
      if (k >= 1) { this.scene.remove(g.mesh); g.mat.dispose(); return false; }
      g.mat.opacity = g.o0 * (1 - k);
      return true;
    });
    // screen overlays run on real time so slow-mo doesn't stretch them
    this.flashV = Math.max(0, this.flashV - realDt * 3.5);
    if (this.flashEl) this.flashEl.style.opacity = this.flashV.toFixed(3);
    this.vigV = Math.max(0, this.vigV - realDt * 1.6);
    if (this.vignette) this.vignette.style.opacity = this.vigV.toFixed(3);
    const mb = G.settings.motionBlur === 'off' ? 0 : G.settings.motionBlur === 'low' ? 0.5 : 1;
    this.speedV = Math.max(0, this.speedV - realDt * 3);
    if (this.speedEl) this.speedEl.style.opacity = (this.speedV * mb).toFixed(3);
  }
}
