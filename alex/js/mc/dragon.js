// The Ender Dragon. Circles the island spitting dragon's-breath fireballs, dives at
// you, and perches by the exit portal to breathe — that's your chance to hit it up
// close. End Crystals on top of the obsidian pillars heal it through pink beams: shoot
// them first. Dying, it rises in beams of light and leaves the egg behind.

import * as THREE from 'three';
import { G } from '../state.js';
import { Enemy } from '../actors/enemy.js';
import { mat, glow } from '../world/props.js';
import { part as m, grp, box } from '../actors/enemyModels.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/math.js';
import { registerEnemy } from '../actors/enemies.js';
import { RIFTS } from '../world/rifts.js';
import { dropXp } from './world.js';

const now = () => performance.now() * 0.001;
const pan = (e) => G.cam.panOf(e.pos.x, e.pos.z);

// ---------------------------------------------------------------------------- model
export function dragonModel() {
  const g = new THREE.Group();
  const skin = '#15111c', plate = '#2a2433', eye = '#d946ef';
  const root = grp(g, 0, 1.4, 0);
  const body = grp(root, 0, 0, 0);
  m(body, box(2.2, 1.7, 4.6), skin, [0, 0, 0]);
  for (let i = 0; i < 6; i++) m(body, box(0.25, 0.55, 0.4), plate, [0, 1.05, 1.8 - i * 0.75], { outline: false });
  // neck + head
  const neck = [];
  let parent = body, z = 2.3;
  for (let i = 0; i < 4; i++) {
    const s = grp(parent, 0, i === 0 ? 0.3 : 0, z);
    m(s, box(1.0 - i * 0.05, 0.95 - i * 0.05, 1.1), skin, [0, 0, 0.55]);
    m(s, box(0.2, 0.35, 0.35), plate, [0, 0.6, 0.55], { outline: false });
    neck.push(s); parent = s; z = 1.1;
  }
  const head = grp(parent, 0, 0, 1.2);
  m(head, box(1.5, 1.0, 1.9), skin, [0, 0, 0.6]);
  m(head, box(1.1, 0.55, 1.2), skin, [0, -0.1, 1.9]);
  for (const s of [-1, 1]) {
    m(head, box(0.25, 0.12, 0.08), eye, [s * 0.62, 0.15, 0.95], { material: glow(eye, 1) });
    m(head, box(0.2, 0.6, 0.2), plate, [s * 0.45, 0.75, -0.1], { rot: [-0.5, 0, 0] });
    m(head, box(0.12, 0.08, 0.12), '#3a3045', [s * 0.3, 0.2, 2.45], { outline: false });
  }
  const jaw = grp(head, 0, -0.4, 0.4);
  m(jaw, box(1.0, 0.25, 1.9), plate, [0, -0.1, 1.1]);
  const mouthGlow = new THREE.PointLight(eye, 0, 10, 1.6); mouthGlow.position.set(0, -0.2, 2.6); head.add(mouthGlow);
  // tail
  const tail = [];
  parent = body; z = -2.3;
  for (let i = 0; i < 9; i++) {
    const s = grp(parent, 0, 0, z);
    const k = 1 - i * 0.08;
    m(s, box(0.9 * k, 0.8 * k, 1.1), skin, [0, 0, -0.55]);
    m(s, box(0.18, 0.35 * k, 0.3), plate, [0, 0.5 * k, -0.55], { outline: false });
    tail.push(s); parent = s; z = -1.1;
  }
  // wings: arm + membrane + folding tip
  const wings = [-1, 1].map((sd) => {
    const w = grp(body, sd * 1.1, 0.6, 0.9);
    m(w, box(4.4, 0.25, 0.25), plate, [sd * 2.2, 0, 0]);
    const memb = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), new THREE.MeshToonMaterial({ color: '#2b2238', side: THREE.DoubleSide }));
    memb.rotation.x = -Math.PI / 2; memb.position.set(sd * 2.2, -0.05, -1.7); memb.userData.noMerge = true;
    w.add(memb);
    const tip = grp(w, sd * 4.4, 0, 0);
    m(tip, box(3.6, 0.2, 0.2), plate, [sd * 1.8, 0, 0]);
    const memb2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.8), new THREE.MeshToonMaterial({ color: '#241c30', side: THREE.DoubleSide }));
    memb2.rotation.x = -Math.PI / 2; memb2.position.set(sd * 1.8, -0.05, -1.4); memb2.userData.noMerge = true;
    tip.add(memb2);
    return { w, tip, sd };
  });
  const legs = [];
  for (const [x, z2] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) { const l = grp(body, x, -0.8, z2); m(l, box(0.4, 1.0, 0.45), skin, [0, -0.45, 0]); legs.push(l); }
  return {
    group: g, parts: { head, jaw, mouthGlow },
    anim(e, dt) {
      const t = now();
      const flapK = e.perched ? 0.15 : e.phase === 'charge' ? 0.4 : 1;
      const flap = Math.sin(t * (e.perched ? 1.5 : 3.2)) * 0.75 * flapK;
      for (const { w, tip, sd } of wings) { w.rotation.z = sd * (flap + (e.perched ? 0.9 : 0.1)); tip.rotation.z = sd * (flap * 0.6 + (e.perched ? 1.2 : 0)); }
      neck.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.3 + i * 0.6) * 0.12 + (e.neckYaw || 0) * 0.25; s.rotation.x = (e.perched ? 0.22 : -0.06) + Math.sin(t * 2 + i) * 0.04; });
      tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.2 - i * 0.55) * 0.18; s.rotation.x = Math.sin(t * 1.8 - i * 0.4) * 0.05; });
      jaw.rotation.x = e.pose === 'breath' ? 0.55 : e.pose === 'roar' ? 0.4 + Math.sin(t * 20) * 0.1 : 0.05;
      mouthGlow.intensity = e.pose === 'breath' || e.pose === 'roar' ? 3 : 0;
      root.rotation.x = clamp(-(e.vel.y || 0) * 0.04, -0.5, 0.5);
      root.rotation.z = clamp(-(e.turnRate || 0) * 0.35, -0.6, 0.6);
      legs.forEach((l) => { l.rotation.x = e.perched ? 0 : 0.9; });
    },
  };
}

function crystalModel(caged) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1), mat('#3a3a3a'));
  base.position.y = 0.2; g.add(base);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), glow('#f0abfc', 1));
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.35, wireframe: true }));
  const outer = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshBasicMaterial({ color: '#e9d5ff', transparent: true, opacity: 0.25, wireframe: true }));
  for (const x of [inner, mid, outer]) { x.position.y = 1.3; x.userData.noMerge = true; g.add(x); }
  const light = new THREE.PointLight('#e879f9', 1.6, 9, 1.8); light.position.y = 1.3; g.add(light);
  if (caged) {
    const bars = new THREE.Group();
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), mat('#9ca3af')); b.position.set(i % 2 ? s * 0.8 : (i - 1.5) * 0.4, 1.1, i % 2 ? (i - 1.5) * 0.4 : s * 0.8); bars.add(b); }
    g.add(bars);
  }
  return {
    group: g, parts: {},
    anim(e) { const t = now(); inner.rotation.set(t * 2, t * 3, 0); mid.rotation.set(-t, t * 1.5, t * 0.7); outer.rotation.set(t * 0.8, -t, t * 1.2); [inner, mid, outer].forEach((x) => { x.position.y = 1.3 + Math.sin(t * 2 + e.pos.x) * 0.25; }); },
  };
}

// ---------------------------------------------------------------------------- crystals
class EndCrystal extends Enemy {
  constructor(o) {
    super({ hp: o.caged ? 30 : 1, radius: 0.7, height: 2, poise: 'boss', noSpawnAnim: true, readyDelay: 0, ...o });
    this.franchise = 'minecraft'; this.franchiseTag = RIFTS.minecraft.tag;
    this.passive = true; this.noDrop = true; this.noRevive = true; this.unstaggerable = true;
    this.caged = !!o.caged;
    this.setModel(crystalModel(this.caged));
    if (this.caged) this.name = 'Caged End Crystal';
  }
  routeDamage(dmg, info) { if (this.caged && info.melee) return { dmg: dmg * 0.3, result: 'armor' }; return { dmg, result: 'hit' }; }
  think(dt) { this.stop(dt); }
  aimPoint(out) { return out.set(this.pos.x, this.pos.y + 1.3, this.pos.z); }
  onDeath() {
    G.fx.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, { n: 40, color: ['#f0abfc', '#ffffff', '#f97316'], speed: 9, life: 0.7 });
    G.audio.sfx('boom', { v: 0.6, pan: pan(this) });
    G.cam.shake(0.2);
    if (this.beam) this.beam.parent?.remove(this.beam);
    G.hud.popup('END CRYSTAL DESTROYED', '#f0abfc', 1, true);
    G.run.stat('crystals', 1);
  }
}

// ---------------------------------------------------------------------------- the dragon
class EnderDragon extends Enemy {
  constructor(o) {
    super({ hp: 1500, radius: 2.8, height: 2.6, poise: 'boss', flying: true, noSpawnAnim: true, readyDelay: 2.5, ...o });
    this.franchise = 'minecraft'; this.franchiseTag = RIFTS.minecraft.tag;
    this.boss = true; this.heavy = true; this.elite = true; this.unstaggerable = true; this.noRevive = true;
    this.flying = true;
    this.name = 'Ender Dragon';
    this.setModel(dragonModel());
    this.phase = 'circle';
    this.phaseT = 0;
    this.ang = 0;
    this.fireCd = 3;
    this.pos.y = 14;
    this.crystals = [];
  }
  aimPoint(out) { return out.set(this.pos.x, this.pos.y + 1.4, this.pos.z); }
  hitTest(x, y, z, r) {
    if (!this.alive) return null;
    if (y < this.pos.y - r - 0.3 || y > this.pos.y + 3.2 + r) return null;
    // body + neck/head ahead of it
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    for (const k of [-1.5, 0, 1.6, 3.6, 5.6]) if (Math.hypot(x - (this.pos.x + fx * k), z - (this.pos.z + fz * k)) < (k > 3 ? 1.1 : 1.9) + r) return 'body';
    return null;
  }
  dmgTakenK(info) { return this.perched ? 1.5 : info.melee ? 1.2 : 1; }
  _physics(dt) {
    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; this.pos.z += this.vel.z * dt;
    const L = G.room.L, hw = L.w / 2 - 3, hd = L.d / 2 - 3;
    this.pos.x = clamp(this.pos.x, -hw, hw); this.pos.z = clamp(this.pos.z, -hd, hd);
    this.pos.y = Math.max(0, this.pos.y);
    this.groundH = 0;
  }
  flyTo(dt, x, y, z, speed, rate = 2.2) {
    const dx = x - this.pos.x, dy = y - this.pos.y, dz = z - this.pos.z, l = Math.hypot(dx, dy, dz) || 1;
    const k = Math.min(1, l / 4);
    this.vel.x = damp(this.vel.x, dx / l * speed * k, rate, dt);
    this.vel.y = damp(this.vel.y, dy / l * speed * k, rate, dt);
    this.vel.z = damp(this.vel.z, dz / l * speed * k, rate, dt);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 1) { const before = this.yaw; this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 3, dt); this.turnRate = wrapAngle(this.yaw - before) / Math.max(dt, 1e-4); }
    return l;
  }
  update(dt) {
    super.update(dt);
    if (!this.alive) return;
    // crystals heal through beams
    let healing = 0;
    for (const c of this.crystals) {
      if (!c.alive) continue;
      healing++;
      if (!c.beam) {
        c.beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#f0abfc', transparent: true, opacity: 0.8 }));
        G.room.group.add(c.beam);
      }
      const p = c.beam.geometry.attributes.position;
      p.setXYZ(0, c.pos.x, c.pos.y + 1.3, c.pos.z); p.setXYZ(1, this.pos.x, this.pos.y + 1.4, this.pos.z); p.needsUpdate = true;
      c.beam.material.opacity = 0.5 + Math.sin(G.time * 12) * 0.3;
    }
    if (healing && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.0035 * healing * dt);
  }
  think(dt) {
    const a = G.alex;
    this.phaseT += dt;
    this.neckYaw = wrapAngle(this.yawTo() - this.yaw);
    if (this.phase === 'circle') {
      this.perched = false;
      this.pose = null;
      this.ang += dt * 0.32;
      const r = 23;
      this.flyTo(dt, Math.sin(this.ang) * r, 13 + Math.sin(this.ang * 2) * 2, Math.cos(this.ang) * r, 15);
      this.fireCd -= dt;
      if (this.fireCd <= 0) { this.fireCd = 2.6 + Math.random(); this.fireball(); }
      if (this.phaseT > 13 + Math.random() * 4) {
        const crystals = this.crystals.filter((c) => c.alive).length;
        this.setPhase(Math.random() < (crystals > 4 ? 0.55 : 0.35) ? 'charge' : 'perch');
      }
    } else if (this.phase === 'charge') {
      if (!this.chargeStarted) {
        this.chargeStarted = true;
        const self = this;
        this.act([
          { t: 1.1, start() { self.pose = 'roar'; G.audio.sfx('dragon', { v: 0.8 }); G.hud.bubble(self, 'RAAAWR', '#d946ef', 1); self.threatDur = 1.1; G.hud.threatStart(self); },
            update(dt, k) { self.threatT = 1.1 * (1 - k); self.vel.multiplyScalar(Math.exp(-3 * dt)); self.yaw = dampAngle(self.yaw, self.yawTo(), 6, dt); } },
          { t: 2.2, start() { self.pose = null; const dx = a.pos.x - self.pos.x, dz = a.pos.z - self.pos.z, dy = 1.4 - self.pos.y, l = Math.hypot(dx, dy, dz) || 1; self.vel.set(dx / l * 27, dy / l * 27, dz / l * 27); self.hitOnce = false; },
            update(dt) {
              if (self.pos.y < 2) self.vel.y = Math.max(self.vel.y, 0);
              if (!self.hitOnce && Math.hypot(a.pos.x - self.pos.x, a.pos.z - self.pos.z) < 3.4 && Math.abs(a.pos.y - self.pos.y) < 3) { self.hitOnce = true; a.hurt(20, { source: self, kind: 'melee', dir: [self.vel.x, self.vel.z], knock: 14 }); G.cam.shake(0.4); }
            } },
        ]);
      }
      if (!this.seq) { this.chargeStarted = false; this.setPhase('circle'); }
    } else if (this.phase === 'perch') {
      const px = 0, pz = 5.5;
      if (!this.perched) {
        const d = this.flyTo(dt, px, this.phaseT < 4 ? 6 : 0.05, pz, 13, 2.5);
        if (d < 1.2 && this.pos.y < 0.4) {
          this.perched = true; this.perchT = 0; this.vel.set(0, 0, 0); this.pos.y = 0;
          G.audio.sfx('landHeavy', { v: 1 }); G.cam.shake(0.4);
          G.hud.popup('THE DRAGON IS PERCHED — HIT IT!', '#d946ef', 1.4, true);
        }
        if (this.phaseT > 9) this.setPhase('circle');
      } else {
        this.perchT += dt;
        this.vel.set(0, 0, 0);
        this.yaw = dampAngle(this.yaw, this.yawTo(), 2.5, dt);
        if (!this.seq && this.perchT > 0.8 && this.perchT < 8) {
          const d = this.distTo();
          const self = this;
          if (d < 5.5 && Math.random() < 0.5) {
            this.act([
              { ...this.tele(0.7, '#a855f7'), update(dt, k) { self.threatT = 0.7 * (1 - k); } },
              { t: 0.4, start() {
                G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 2, r1: 9, speed: 14, width: 0.8, height: 1.2, dmg: 14, owner: self, color: '#a855f7' });
                G.audio.sfx('dash', { v: 1, p: 0.5 }); G.cam.shake(0.3);
              } },
              { t: 0.6 },
            ]);
          } else {
            this.act([
              { t: 0.4, start() { self.pose = 'breath'; } },
              { t: 1.1, start() {
                const yaw = self.yaw, hx = self.pos.x + Math.sin(yaw) * 5, hz = self.pos.z + Math.cos(yaw) * 5;
                G.areas.cone({ x: hx, z: hz, yaw: self.yawTo({ pos: a.pos }), angle: 0.8, range: 11, delay: 0.9, dmg: 16, owner: self, color: '#c084fc', fxColor: ['#a855f7', '#f0abfc'], sound: 'dragon' });
                const ty = self.yawTo({ pos: a.pos });
                setTimeout(() => { if (G.room && self.alive) G.areas.circle({ x: hx + Math.sin(ty) * 7, z: hz + Math.cos(ty) * 7, r: 3, delay: 0.01, dmg: 0, linger: 4, lingerDps: 5, owner: 'hazard', color: '#a855f7' }); }, 950);
              }, end() { self.pose = null; } },
              { t: 0.8 },
            ]);
          }
        }
        if (this.perchT > 8.5 && !this.seq) { this.perched = false; this.vel.y = 6; this.setPhase('circle'); G.audio.sfx('dragon', { v: 0.5 }); }
      }
    }
  }
  setPhase(p) { this.phase = p; this.phaseT = 0; if (p === 'circle') this.ang = Math.atan2(this.pos.x, this.pos.z); }
  fireball() {
    const a = G.alex;
    this.pose = 'roar';
    setTimeout(() => { if (this.alive) this.pose = null; }, 400);
    const hx = this.pos.x + Math.sin(this.yaw) * 5, hz = this.pos.z + Math.cos(this.yaw) * 5, hy = this.pos.y + 1.6;
    const dx = a.pos.x - hx, dy = a.pos.y + 0.6 - hy, dz = a.pos.z - hz, l = Math.hypot(dx, dy, dz) || 1, sp = 17;
    G.projectiles.spawn({ owner: this, kind: 'orb', x: hx, y: hy, z: hz, vx: dx / l * sp, vy: dy / l * sp, vz: dz / l * sp, r: 0.6, dmg: 10, color: '#a855f7', life: 4,
      onHit: (p) => G.areas.circle({ x: p.x, z: p.z, r: 3.2, delay: 0.01, dmg: 6, linger: 4.5, lingerDps: 4, owner: 'hazard', color: '#a855f7' }) });
    G.audio.sfx('ghast', { v: 0.5, p: 0.6, pan: pan(this) });
  }
  die(info) {
    if (!this.alive) return;
    // the body stays behind for the death animation
    const g = this.model.group, room = G.room;
    this.group.remove(g);
    g.position.copy(this.pos); g.rotation.y = this.yaw;
    room.group.add(g);
    const beams = [];
    let t = 0;
    const x = this.pos.x, z = this.pos.z;
    room.animators.push((time, dt) => {
      if (t > 6) return;
      t += dt;
      g.position.y += dt * 1.6;
      g.rotation.y += dt * 0.3;
      if (Math.random() < dt * 14 && beams.length < 30) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.4, 30, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#fef3c7', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        b.geometry.translate(0, 15, 0);
        b.position.copy(g.position).add(new THREE.Vector3(0, 1.4, 0));
        b.rotation.set(Math.random() * Math.PI, 0, Math.random() * Math.PI);
        room.group.add(b); beams.push(b);
      }
      for (const b of beams) b.material.opacity = Math.max(0, 0.6 - t * 0.05);
      if (Math.random() < dt * 10) G.fx.burst(g.position.x, g.position.y + 1.4, g.position.z, { n: 6, color: ['#a855f7', '#fef3c7'], speed: 8, life: 0.6 });
      if (t > 6) { room.group.remove(g); for (const b of beams) room.group.remove(b); G.fx.burst(g.position.x, g.position.y, g.position.z, { n: 80, color: ['#a855f7', '#ffffff', '#fef3c7'], speed: 14, life: 1.2 }); G.audio.sfx('boom'); G.cam.shake(0.6); dropXp(room, 400, x * 0.3, z * 0.3); }
    });
    G.audio.sfx('dragon', { v: 1, p: 0.7 });
    for (const c of this.crystals) if (c.alive) c.die({});
    super.die(info);
  }
}

registerEnemy('enderDragon', EnderDragon, { name: 'Ender Dragon', franchise: 'minecraft', threat: 20, elite: true });
registerEnemy('endCrystal', EndCrystal, { name: 'End Crystal', franchise: 'minecraft', threat: 0 });

// Spawned by the End's boss room: the dragon, a crystal on every pillar, endermen milling about.
export function spawnDragon(room) {
  const dragon = room.spawnEnemy('enderDragon', 0, 22, {});
  dragon.noDrop = true;
  const pillars = room.world.blocks.filter((b) => b.data.pillar !== undefined);
  for (const p of pillars) {
    const c = room.spawnEnemy('endCrystal', p.x, p.z, { caged: p.data.pillar % 3 === 1 });
    if (!c) continue;
    c.pos.y = p.y1; c.groundH = p.y1;
    dragon.crystals.push(c);
  }
  for (let i = 0; i < 5; i++) {
    const q = room.world.openPoint(room.rng, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 10 }], 6);
    if (!q) continue;
    const e = room.spawnEnemy('enderman', q.x, q.z, { readyDelay: 2 });
    if (e) { e.passive = true; const prov = e.provoke?.bind(e); if (prov) e.provoke = (...args) => { e.passive = false; return prov(...args); }; }
  }
  // the list holds only the dragon: crystals and endermen don't block the clear
  room.enemies = room.enemies.filter((e) => e !== dragon);
  return { boss: dragon, list: [dragon], title: 'THE ENDER DRAGON', subtitle: 'Destroy the End Crystals. Hit it when it perches.', bar: () => ({ hp: dragon.hp, max: dragon.maxHp, name: 'ENDER DRAGON' + (dragon.crystals.some((c) => c.alive) ? ' (healing from crystals)' : '') }) };
}
