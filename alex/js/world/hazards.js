// Room hazards: the environment participates in combat. Periodic ones reuse the
// telegraphed area-attack primitives; moving ones are dynamic collision blocks.
// Hazards only attack while the room's fight is live (never during spawn safety).

import * as THREE from 'three';
import { G } from '../state.js';
import { mat, glow, addBox, addCyl, GEO } from './props.js';

export function makeHazard(room, h) {
  const C = HAZARDS[h.type];
  return C ? new C(room, h) : null;
}

class Periodic {
  constructor(room, h) { this.room = room; this.h = h; this.t = -(h.offset || 0); }
  update(dt, active) {
    if (!active) return;
    this.t += dt;
    const period = this.h.period || 4;
    if (this.t >= period) { this.t -= period; this.fire(); }
  }
  dispose() {}
}

class Grill extends Periodic {
  constructor(room, h) {
    super(room, h);
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 8), glow('#ff7b00', 0.8));
    this.flame.position.set(h.x, 1.3, h.z);
    this.flame.scale.set(0.8, 0.3, 0.8);
    room.group.add(this.flame);
  }
  update(dt, active) {
    super.update(dt, active);
    const p = this.t / (this.h.period || 4);
    this.flame.scale.y = 0.3 + (p > 0.75 ? (p - 0.75) * 6 : 0) + Math.sin(G.time * 20) * 0.05;
  }
  fire() {
    G.areas.circle({ x: this.h.x, z: this.h.z, r: 2.0, delay: 0.85, dmg: 10, ff: true, enemyDmg: 14, style: 'fire', sound: 'flame', owner: 'grill', propDmg: 0, shake: 0.05 });
  }
}

class ZapGate extends Periodic {
  fire() {
    const { x, z } = this.h;
    G.areas.lane({ x1: x, z1: z - 1.2, x2: x, z2: z + 1.2, width: 1.6, delay: 0.75, dmg: 8, ff: true, color: '#4cc9f0', strikeColor: '#caf0f8', sound: 'shot', duration: 0.3, pillar: 2.4 });
  }
}

class Lasers {
  constructor(room, h) { this.room = room; this.h = h; this.t = 0; this.phase = 0; }
  update(dt, active) {
    if (!active) return;
    this.t += dt;
    const period = this.h.period || 3.4;
    if (this.t >= period / 2) {
      this.t -= period / 2;
      this.phase ^= 1;
      const L = this.room.L;
      this.h.lines.forEach((v, i) => {
        if (i % 2 !== this.phase) return;
        const lane = this.h.axis === 'x'
          ? { x1: v, z1: -L.d / 2, x2: v, z2: L.d / 2 }
          : { x1: -L.w / 2, z1: v, x2: L.w / 2, z2: v };
        G.areas.lane({ ...lane, width: this.h.width || 1.3, delay: 1.0, dmg: 10, duration: 0.45, ff: true, color: this.h.type === 'arcs' ? '#4cc9f0' : '#ff2e7e', strikeColor: this.h.type === 'arcs' ? '#e0fbff' : '#ffd6f0', sound: 'shot', pillar: 3 });
      });
    }
  }
  dispose() {}
}

class Spotlight {
  constructor(room, h) {
    this.room = room; this.list = [];
    for (let i = 0; i < (h.n || 2); i++) {
      const g = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 12, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      cone.position.y = 6;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.25, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05;
      g.add(cone, disc);
      const a = (i / (h.n || 2)) * Math.PI * 2;
      g.position.set(Math.sin(a) * 10, 0, Math.cos(a) * 10);
      room.group.add(g);
      this.list.push({ g, disc, cone, dwell: 0, cd: 1 + i });
    }
  }
  update(dt, active) {
    const a = G.alex;
    for (const s of this.list) {
      const p = s.g.position;
      if (!active) { s.dwell = 0; continue; }
      s.cd -= dt;
      const dx = a.pos.x - p.x, dz = a.pos.z - p.z, d = Math.hypot(dx, dz);
      const sp = 3.1;
      if (d > 0.05) { p.x += (dx / d) * Math.min(d, sp * dt); p.z += (dz / d) * Math.min(d, sp * dt); }
      const inside = d < 1.9;
      s.dwell = inside ? s.dwell + dt : Math.max(0, s.dwell - dt * 2);
      s.disc.material.opacity = 0.2 + s.dwell * 0.4;
      if (s.dwell > 1.1 && s.cd <= 0) {
        s.cd = 2.6; s.dwell = 0;
        G.areas.circle({ x: p.x, z: p.z, r: 2.1, delay: 0.5, dmg: 12, ff: true, color: '#ffd60a', style: 'flash', sound: 'flash' });
      }
    }
  }
  dispose() {}
}

class Speaker extends Periodic {
  fire() {
    G.areas.ring({ x: this.h.x, z: this.h.z, r0: 1.2, r1: 15, speed: 8.5, width: 0.7, height: 0.8, dmg: 9, delay: 0.7, ff: true, color: '#b388ff' });
    G.audio.sfx('hitHeavy', { v: 0.35, pan: G.cam?.panOf(this.h.x, this.h.z) });
  }
}

class CameraHazard {
  constructor(room, h) {
    this.room = room; this.h = h; this.t = -1.5 - Math.random() * 2;
    this.line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), glow('#ff0033', 0.5));
    this.line.visible = false;
    room.group.add(this.line);
  }
  update(dt, active) {
    if (!active) { this.line.visible = false; return; }
    this.t += dt;
    if (this.t > 5.2) {
      this.t = 0;
      this.strike = G.areas.rect({ x: G.alex.pos.x, z: G.alex.pos.z, w0: 6, d0: 6, w: 2.6, d: 2.6, delay: 1.25, dmg: 12, ff: true, enemyDmg: 20, color: '#ff0033', follow: () => G.alex.pos, lockAt: 0.35, onFire: (r) => { G.fx.flash(0.35); G.audio.sfx('flash', { v: 0.6 }); G.fx.burst(r.o.x, 0.6, r.o.z, { n: 18, color: '#ffffff', speed: 6, life: 0.3 }); } });
    }
    const s = this.strike;
    if (s && !s.fired && s.t < 1.3) {
      this.line.visible = true;
      const a = new THREE.Vector3(this.h.x, 2.1, this.h.z), b = new THREE.Vector3(s.o.x, 0.1, s.o.z);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      this.line.position.copy(mid);
      this.line.scale.y = a.distanceTo(b);
      this.line.lookAt(b); this.line.rotateX(Math.PI / 2);
    } else this.line.visible = false;
  }
  dispose() {}
}

class RigSweep {
  constructor(room, h) { this.room = room; this.h = h; this.t = 3; this.dir = h.speed >= 0 ? 1 : -1; }
  update(dt, active) {
    if (!active) return;
    this.t += dt;
    if (this.t > 8) {
      this.t = 0;
      const yaw = Math.random() * Math.PI;
      const len = this.h.len / 2;
      for (const off of [0, Math.PI]) {
        G.areas.beam({ x: this.h.x, z: this.h.z, yaw: yaw + off, yawSpeed: this.h.speed, length: len, width: 0.7, height: 0.75, dmg: 10, delay: 1.2, duration: 5, tick: 0.8, color: '#ffd60a' });
      }
    }
  }
  dispose() {}
}

class Pyro {
  constructor(room, h) { this.room = room; this.h = h; this.t = 1; }
  update(dt, active) {
    if (!active) return;
    this.t += dt;
    if (this.t > (this.h.period || 3)) {
      this.t = 0;
      const L = this.room.L, n = this.h.grid || 4;
      const cw = (L.w - 6) / n, cd = (L.d - 6) / n;
      const cells = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push([-L.w / 2 + 3 + (i + 0.5) * cw, -L.d / 2 + 3 + (j + 0.5) * cd]);
      G.run.rng.shuffle(cells);
      const k = Math.ceil(cells.length * 0.38);
      for (let i = 0; i < k; i++) G.areas.circle({ x: cells[i][0], z: cells[i][1], r: Math.min(cw, cd) * 0.42, delay: 1.1, dmg: 12, ff: true, enemyDmg: 16, style: 'fire', color: '#ff7b00', sound: i === 0 ? 'boom' : null, shake: i === 0 ? 0.15 : 0, propDmg: 0 });
    }
  }
  dispose() {}
}

class Carts {
  constructor(room, h) {
    this.room = room; this.list = [];
    const L = room.L;
    for (let i = 0; i < (h.n || 5); i++) {
      const p = room.world.openPoint(G.run.rng, [{ x: 0, z: 0, r: 4 }], 0, 0.3) || { x: 0, z: 0 };
      const b = room.world.add({ kind: 'cart', x: p.x, z: p.z, w: 0.8, d: 1.2, h: 1.05, dyn: true, clutter: false, vault: true, shoot: false, camBlock: false });
      const g = new THREE.Group();
      addBox(g, 0.8, 0.6, 1.2, '#c0c7cf', 0, 0.4, 0, mat('#c0c7cf', { wireframe: false }));
      addBox(g, 0.84, 0.05, 1.25, '#e63946', 0, 1.0, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) addCyl(g, 0.08, 0.08, '#111', sx * 0.3, 0, sz * 0.5);
      g.position.set(p.x, 0, p.z);
      room.group.add(g);
      const a = Math.random() * Math.PI * 2, sp = 5 + Math.random() * 2;
      this.list.push({ b, g, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, cd: 0 });
    }
    this.L = L;
  }
  update(dt, active) {
    const w = this.room.world, a = G.alex;
    for (const c of this.list) {
      const slow = active ? 1 : Math.exp(-2 * dt);
      c.vx *= slow; c.vz *= slow;
      const p = { x: c.b.x + c.vx * dt, y: 0, z: c.b.z + c.vz * dt };
      const contacts = w.collide(p, 0.6, 1, { ignore: (o) => o === c.b, stepUp: 0.3 });
      for (const ct of contacts) {
        const dot = c.vx * ct.nx + c.vz * ct.nz;
        if (dot < 0) { c.vx -= 2 * dot * ct.nx; c.vz -= 2 * dot * ct.nz; }
      }
      c.b.x = p.x; c.b.z = p.z;
      c.b.setRot(Math.atan2(c.vx, c.vz));
      c.g.position.set(p.x, 0, p.z);
      c.g.rotation.y = c.b.rot;
      c.cd -= dt;
      const sp = Math.hypot(c.vx, c.vz);
      if (active && sp > 2 && c.cd <= 0 && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 1.0 && a.pos.y < 1.1) {
        c.cd = 1;
        a.hurt(8, { source: 'cart', kind: 'area', dir: [c.vx, c.vz], knock: 7 });
      }
      if (active && sp > 2) for (const e of this.room.enemies) {
        if (e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < e.radius + 0.6 && (!e._cartCd || G.time > e._cartCd)) {
          e._cartCd = G.time + 1;
          e.hurt(10, { source: 'hazard', dir: [c.vx, c.vz], knock: 6, friendly: true });
        }
      }
    }
  }
  dispose() {}
}

class Lift {
  constructor(room, h) { this.room = room; this.h = h; this.b = null; this.t = 0; }
  update(dt) {
    if (!this.b) this.b = this.room.world.blocks.find((b) => b.data === this.h.ref);
    if (!this.b) return;
    this.t += dt;
    const k = (1 - Math.cos((this.t / this.h.period) * Math.PI * 2)) / 2;
    this.b.y1 = this.h.lo + (this.h.hi - this.h.lo) * k;
    if (this.b.meshes) this.b.meshes.position.y = this.b.y1 - 0.3;
  }
  dispose() {}
}

class EqBars {
  constructor(room, h) {
    this.room = room; this.bars = [];
    const n = h.n || 10;
    for (let i = 0; i < n; i++) {
      const row = i % 2 ? 6 : -6;
      const x = -16 + Math.floor(i / 2) * 8 + (i % 2) * 4;
      const b = room.world.add({ kind: 'eq', x, z: row, w: 2.2, d: 2.2, h: 0.3, dyn: true, vault: false, clutter: false });
      const m = new THREE.Mesh(GEO.box, mat('#ff4fa3', { emissive: '#ff4fa3', emissiveIntensity: 0.35 }));
      m.position.set(x, 0, row);
      room.group.add(m);
      this.bars.push({ b, m, ph: i * 0.7 });
    }
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    for (const s of this.bars) {
      const k = Math.abs(Math.sin(this.t * 0.9 + s.ph)) * (0.6 + 0.4 * Math.sin(this.t * 0.37 + s.ph * 2));
      const h = 0.3 + Math.max(0, k) * 2.9;
      s.b.y1 = h;
      s.m.scale.set(2.2, h, 2.2);
      s.m.position.y = h / 2;
      s.m.material.color.setHSL((0.9 + k * 0.2) % 1, 0.9, 0.6);
    }
  }
  dispose() {}
}

class Dancers {
  constructor(room, h) {
    this.room = room; this.list = [];
    const n = h.n || 6;
    for (let i = 0; i < n; i++) {
      const b = room.world.add({ kind: 'dancer', x: 0, z: 0, w: 0.8, d: 0.8, h: 1.9, dyn: true, vault: false, clutter: false, shoot: true });
      const g = new THREE.Group();
      const body = new THREE.Mesh(GEO.cyl6, mat('#1a1a2e', { emissive: '#3a0ca3', emissiveIntensity: 0.4 }));
      body.scale.set(0.6, 1.3, 0.6); body.position.y = 0.9;
      const head = new THREE.Mesh(GEO.sph, mat('#1a1a2e'));
      head.scale.setScalar(0.4); head.position.y = 1.75;
      const visor = new THREE.Mesh(GEO.box, glow('#4cc9f0'));
      visor.scale.set(0.35, 0.08, 0.1); visor.position.set(0, 1.78, 0.18);
      g.add(body, head, visor);
      room.group.add(g);
      this.list.push({ b, g, ph: (i / n) * Math.PI * 2 });
    }
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    for (const d of this.list) {
      const a = d.ph + this.t * 0.35;
      const r = 9 + Math.sin(this.t * 0.8 + d.ph * 2) * 4;
      d.b.x = Math.sin(a) * r; d.b.z = Math.cos(a) * r * 0.8;
      d.g.position.set(d.b.x, Math.abs(Math.sin(this.t * 6 + d.ph)) * 0.2, d.b.z);
      d.g.rotation.y = this.t * 3 + d.ph;
    }
  }
  dispose() {}
}

class Cans {
  constructor(room, h) {
    this.room = room; this.list = [];
    for (let i = 0; i < (h.n || 6); i++) {
      const m = new THREE.Mesh(GEO.cyl, mat(['#e63946', '#2a9d8f', '#ffb703'][i % 3]));
      m.scale.set(0.14, 0.26, 0.14);
      m.rotation.z = Math.PI / 2;
      m.position.set((Math.random() - 0.5) * room.L.w * 0.8, 0.07, (Math.random() - 0.5) * room.L.d * 0.5);
      room.group.add(m);
      this.list.push({ m, v: (Math.random() - 0.5) * 3 });
    }
  }
  update(dt) {
    for (const c of this.list) {
      c.m.position.x += c.v * dt;
      c.m.rotation.x += c.v * dt * 7;
      if (Math.abs(c.m.position.x) > this.room.L.w / 2 - 1) c.v *= -1;
    }
  }
  dispose() {}
}

const HAZARDS = {
  grill: Grill, zapGate: ZapGate, lasers: Lasers, arcs: Lasers, spotlight: Spotlight, speaker: Speaker,
  camera: CameraHazard, rigSweep: RigSweep, pyro: Pyro, carts: Carts, lift: Lift, eqBars: EqBars, dancers: Dancers, cans: Cans,
};
