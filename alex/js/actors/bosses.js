// Bosses. Each is an exaggerated supernatural concert persona (no real artists).
//  Floor 1 — PRELUDE, The Opening Act: one gimmick — every attack lands on the beat.
//  Floor 2 — CROWN//CORE, The Headliner Guardian: four members; only the Center
//            Position can be hurt, formation attacks by role, fan-chant escalation.
//  Floor 3 — THE K-POP DEMON KING: a giant on the main stage with target nodes
//            (head, body, arms, mic), three phases, relationship-dependent theatrics
//            and a phone call in the middle of his own boss fight.

import * as THREE from 'three';
import { G } from '../state.js';
import { Enemy } from './enemy.js';
import { MODELS } from './enemyModels.js';
import { mat, glow, textTexture } from '../world/props.js';
import { heartsFor } from '../config.js';
import { clamp, wrapAngle, lerp } from '../core/math.js';
import { createEnemy } from './enemies.js';

const tmp = new THREE.Vector3();
const say = (e, t, c = '#fff', d = 1.4) => G.hud.bubble(e, t, c, d);
const outline = new THREE.MeshBasicMaterial({ color: '#0b0714', side: THREE.BackSide });
function part(parent, geo, color, pos, o = {}) {
  const m = new THREE.Mesh(geo, o.material || mat(color, o.mat || {}));
  if (pos) m.position.set(...pos);
  if (o.scale) m.scale.set(...o.scale);
  if (o.rot) m.rotation.set(...o.rot);
  parent.add(m);
  if (o.outline !== false && !o.material) { const ol = new THREE.Mesh(geo, outline); ol.scale.setScalar(1.05); ol.userData.outline = true; m.add(ol); }
  return m;
}

class Boss extends Enemy {
  constructor(o) {
    super({ poise: 'boss', money: 'boss', readyDelay: 2.4, ...o });
    this.boss = true;
    this.unstaggerable = true;
    this.heavy = true;
    this.noRevive = true;
  }
  stagger() {}
  hpFrac() { return this.hp / this.maxHp; }
}

// ===========================================================================
// FLOOR 1 — PRELUDE, The Opening Act
// ===========================================================================
function idolModel(scale, colors) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.0;
  g.add(body);
  part(body, new THREE.ConeGeometry(0.5, 0.7, 16), colors.skirt, [0, -0.05, 0]);
  part(body, new THREE.CapsuleGeometry(0.22, 0.5, 4, 10), colors.top, [0, 0.4, 0]);
  const head = new THREE.Group(); head.position.y = 1.0; body.add(head);
  part(head, new THREE.SphereGeometry(0.22, 16, 12), '#f3cfae', [0, 0, 0]);
  part(head, new THREE.SphereGeometry(0.25, 16, 12), colors.hair, [0, 0.07, -0.04], { scale: [1.1, 0.95, 1.1] });
  for (const s of [-1, 1]) {
    part(head, new THREE.ConeGeometry(0.06, 0.3, 6), '#240046', [s * 0.14, 0.28, 0], { rot: [0, 0, -s * 0.4] });
    part(head, new THREE.SphereGeometry(0.045, 8, 6), '#fff', [s * 0.08, 0.02, 0.2], { material: glow(colors.eye) });
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.3, 0.6, 0); body.add(a);
    part(a, new THREE.CapsuleGeometry(0.06, 0.45, 4, 8), colors.top, [0, -0.28, 0]);
    arms.push(a);
  }
  part(arms[0], new THREE.CylinderGeometry(0.04, 0.03, 0.25, 8), '#adb5bd', [0, -0.6, 0.08]);
  part(arms[0], new THREE.SphereGeometry(0.07, 10, 8), '#495057', [0, -0.47, 0.08]);
  const wings = new THREE.Group(); wings.position.set(0, 0.55, -0.2); body.add(wings);
  for (const s of [-1, 1]) {
    const w = part(wings, new THREE.ConeGeometry(0.35, 1.2, 3), colors.wing, [s * 0.5, 0.2, 0], { rot: [0, 0, s * 1.2], mat: { emissive: colors.wing, emissiveIntensity: 0.4 } });
    w.scale.z = 0.15;
  }
  for (const s of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(s * 0.12, 0, 0); g.add(l);
    part(l, new THREE.CapsuleGeometry(0.07, 0.8, 4, 8), '#f8f9fa', [0, 0.5, 0]);
  }
  g.scale.setScalar(scale);
  return {
    group: g, parts: { body, arms, wings, head },
    anim(e) {
      const t = performance.now() * 0.001;
      const bp = e.beatPulse || 0;
      body.position.y = 1.0 + Math.abs(Math.sin(t * 4)) * 0.05 + bp * 0.08;
      wings.rotation.y = Math.sin(t * 6) * 0.2;
      arms[0].rotation.x = e.pose === 'point' ? -1.6 : e.pose === 'sing' ? -2.4 : -0.3 - bp * 0.5;
      arms[1].rotation.x = e.pose === 'point' ? -1.6 : e.pose === 'heart' ? -1.8 : -0.3 + bp * 0.5;
      arms[1].rotation.z = e.pose === 'pose' ? 1.4 : 0;
      body.rotation.y = e.pose === 'spin' ? t * 12 : 0;
    },
  };
}

class Prelude extends Boss {
  constructor(o) {
    super({ hp: 900, speed: 6, radius: 0.9, height: 3.4, name: 'PRELUDE', ...o });
    this.title = 'PRELUDE'; this.subtitle = 'The Opening Act';
    this.setModel(idolModel(1.6, { skirt: '#ff4fa3', top: '#ffffff', hair: '#ffafcc', eye: '#ff006e', wing: '#ff4fa3' }));
    this.bpm = 110;
    this.lastBeat = -1;
    this.measure = [];
    this.phase2 = false;
    this.beatStart = null;
  }
  dmgTakenK() { return this.pose === 'pose' ? 1.5 : 1; }
  beat() {
    const b = G.audio.beatPos?.();
    if (b != null && G.audio.musicName?.() === 'boss1') return b;
    if (this.beatStart == null) this.beatStart = G.time;
    return (G.time - this.beatStart) * this.bpm / 60;
  }
  think(dt) {
    const b = this.beat();
    const bi = Math.floor(b);
    this.beatPulse = Math.max(0, 1 - (b - bi) * 4);
    G.hud.setBeat(b, this.bpm);
    if (!this.phase2 && this.hpFrac() < 0.5) {
      this.phase2 = true;
      this.bpm = 128;
      G.audio.setTempo?.(128);
      say(this, 'HYPE MODE!!', '#ffd60a', 2);
      G.hud.popup('THE TEMPO RISES', '#ff4fa3', 1.5);
      G.fx.confetti(this.pos.x, 4, this.pos.z, 60);
      this.measure = [];
      this.addsAt = 0;
    }
    // reposition gently between beats
    const a = G.alex.pos;
    const d = this.distTo();
    if (this.pose !== 'jump') {
      if (d < 6) { const dx = this.pos.x - a.x, dz = this.pos.z - a.z, l = Math.hypot(dx, dz) || 1; this.steer(dt, dx / l, dz / l, 4); }
      else if (d > 12) this.seek(dt, 4, { drift: false });
      else { const dx = this.pos.x - a.x, dz = this.pos.z - a.z, l = Math.hypot(dx, dz) || 1; this.steer(dt, -dz / l, dx / l, 2.2, 3); }
      this.faceTarget(dt, 6);
    }
    if (bi !== this.lastBeat) {
      this.lastBeat = bi;
      if (!this.measure.length) this.planMeasure();
      const fn = this.measure.shift();
      if (fn) fn.call(this, bi % 4);
    }
  }
  planMeasure() {
    const pats = ['wave', 'micdrop', 'point', 'aegyo'];
    if (this.phase2) pats.push('solo', 'wave');
    let p = G.run.rng.pick(pats.filter((x) => x !== this.lastPat));
    if (this.phase2 && G.time > (this.addsAt || 0) && G.room.enemies.filter((e) => e.alive && !e.boss).length < 2) { p = 'crowd'; this.addsAt = G.time + 20; }
    this.lastPat = p;
    const rep = (f, n) => Array.from({ length: n }, () => f);
    const P = {
      wave: rep(this.warmUp, 8),
      aegyo: rep(this.aegyo, 8),
      micdrop: [this.micTele, null, this.micJump, this.micSlam],
      point: [this.pointLane, this.pointLane, this.pointLane, this.pointFan],
      solo: [this.soloStart, null, null, this.soloEnd],
      crowd: [this.crowdSurf, null, null, null],
    }[p];
    this.measure = P.slice();
  }
  warmUp(i) {
    this.pose = 'sing';
    // rings land on beats 1 and 3; the off-beats are for breathing (and dodging)
    if (i % 2) return;
    const n = this.phase2 ? 14 : 11;
    G.projectiles.ring({ owner: this, x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z, r: 0.28, dmg: 8, life: 4, color: (this.lastBeat >> 1) % 2 ? '#ffd6f0' : null }, n, this.phase2 ? 8 : 6.5, ((this.lastBeat >> 1) % 2) * Math.PI / n);
    G.audio.sfx('shot', { v: 0.3, p: 0.8 + (i % 4) * 0.1 });
  }
  aegyo(i) {
    this.pose = 'heart';
    const y = this.yawTo();
    G.projectiles.fan({ owner: this, kind: 'heart', x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z, r: 0.3, dmg: 8, life: 3.5 }, 3, 0.45, y, 10);
    if (this.phase2 && i % 2 === 0) G.projectiles.fan({ owner: this, kind: 'heart', x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z, r: 0.3, dmg: 8, life: 3.5, delay: 60 / this.bpm / 2 }, 2, 0.9, y, 10);
  }
  micTele() {
    this.pose = 'sing';
    say(this, 'MIC DROP!', '#ff4fa3', 1);
    const spb = 60 / this.bpm;
    this.micTarget = { x: G.alex.pos.x, z: G.alex.pos.z };
    const tgt = this.micTarget;
    G.areas.circle({ x: tgt.x, z: tgt.z, r: 2.6, delay: spb * 3, dmg: 20, owner: this, follow: () => G.alex.pos, lockAt: spb * 1.3, sound: 'slam', shake: 0.45, onFire: (c) => { tgt.x = c.o.x; tgt.z = c.o.z; } });
    G.areas.ring({ x: tgt.x, z: tgt.z, r0: 2.6, r1: 11, speed: 9, width: 0.7, height: 0.8, dmg: 10, delay: spb * 3, owner: this });
    this.ringRef = G.areas.list[G.areas.list.length - 1];
    G.hud.threatStart(this); this.threatDur = spb * 3; this.threatT = spb * 3;
  }
  micJump() {
    this.pose = 'jump';
    const t = this.micTarget;
    const circ = G.areas.list.find((a) => a.o.owner === this && a.o.r === 2.6 && !a.fired);
    if (circ) { t.x = circ.o.x; t.z = circ.o.z; if (this.ringRef) { this.ringRef.o.x = t.x; this.ringRef.o.z = t.z; this.ringRef.group.position.set(t.x, this.ringRef.y, t.z); } }
    this.vel.y = 11;
    const spb = 60 / this.bpm;
    this.vel.x = (t.x - this.pos.x) / spb; this.vel.z = (t.z - this.pos.z) / spb;
  }
  micSlam() { this.pose = null; this.vel.x = this.vel.z = 0; this.threatT = 0; G.fx.confetti(this.pos.x, 0.5, this.pos.z, 30); }
  pointLane() {
    this.pose = 'point';
    const a = G.alex.pos;
    const y = Math.atan2(a.x - this.pos.x, a.z - this.pos.z);
    const L = 30;
    G.areas.lane({ x1: this.pos.x, z1: this.pos.z, x2: this.pos.x + Math.sin(y) * L, z2: this.pos.z + Math.cos(y) * L, width: 1.8, delay: 60 / this.bpm * 0.95, dmg: 12, owner: this, duration: 0.3 });
    say(this, 'POINT!', '#ffd60a', 0.4);
  }
  pointFan() {
    this.pose = 'point';
    const y = this.yawTo(), L = 30;
    for (const off of [-0.45, 0, 0.45]) G.areas.lane({ x1: this.pos.x, z1: this.pos.z, x2: this.pos.x + Math.sin(y + off) * L, z2: this.pos.z + Math.cos(y + off) * L, width: 1.8, delay: 60 / this.bpm * 0.95, dmg: 12, owner: this, duration: 0.3 });
  }
  soloStart() { this.pose = 'pose'; say(this, '✧ SPOTLIGHT SOLO ✧', '#ffd60a', 2); G.hud.popup('PRELUDE POSES — HIT HER! (+50%)', '#ffd60a', 1.3); G.audio.sfx('cheer', { v: 0.5 }); }
  soloEnd() { this.pose = null; say(this, 'ENCORE!', '#ff4fa3', 1); }
  crowdSurf() {
    say(this, 'CROWD SURF!', '#4cc9f0', 1.5);
    for (let i = 0; i < 2; i++) {
      const p = G.room.world.openPoint(G.run.rng, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 6 }], 6) || { x: this.pos.x + 3, z: this.pos.z };
      G.room.spawnEnemy('lurker', p.x, p.z, { readyDelay: 1.2 });
    }
  }
}

// ===========================================================================
// FLOOR 2 — CROWN//CORE, The Headliner Guardian (four members)
// ===========================================================================
const ROLES = [
  { key: 'LEADER', color: '#e63946', hair: '#1d1a33' },
  { key: 'MAIN VOCAL', color: '#3a86ff', hair: '#f1faee' },
  { key: 'MAIN DANCER', color: '#ffd60a', hair: '#ff006e' },
  { key: 'VISUAL', color: '#ff4fa3', hair: '#c77dff' },
];

class Member extends Enemy {
  constructor(o) {
    super({ poise: 'boss', money: 'mini', hp: 400, speed: 7, radius: 0.6, height: 2.6, readyDelay: 2.4, ...o });
    this.boss = true; this.unstaggerable = true; this.heavy = true; this.noRevive = true;
    this.role = o.role;
    const R = ROLES[o.role];
    this.name = R.key;
    this.setModel(idolModel(1.25, { skirt: R.color, top: '#f8f9fa', hair: R.hair, eye: R.color, wing: R.color }));
    this.cd = 2 + o.role;
    this.home = { x: o.x, z: o.z };
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    this.group.add(ring);
    this.centerRing = ring;
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), new THREE.MeshBasicMaterial({ color: R.color, transparent: true, opacity: 0.12, depthWrite: false }));
    shield.position.y = 1.5;
    this.group.add(shield);
    this.shield = shield;
  }
  stagger() {}
  dmgTakenK() { return this.ctrl.center === this ? 1 : 0.2; }
  onHurt() { if (this.ctrl.center !== this && Math.random() < 0.15) say(this, 'NOT MY BIAS', '#aaaaaa', 0.8); }
  think(dt) {
    const c = this.ctrl;
    const isCenter = c.center === this;
    this.centerRing.visible = isCenter;
    this.shield.visible = !isCenter;
    // formation slot
    const slot = c.slotFor(this);
    const dx = slot.x - this.pos.x, dz = slot.z - this.pos.z, l = Math.hypot(dx, dz);
    if (l > 0.4) this.steer(dt, dx / l, dz / l, Math.min(9, l * 2.5)); else this.stop(dt);
    this.faceTarget(dt, 6);
    this.cd -= dt * c.speedK();
    if (this.cd > 0 || c.rotating) return;
    this.cd = isCenter ? 3.2 : 3.6 + Math.random();
    const self = this;
    const tk = c.telK();
    if (isCenter) {
      this.act([this.tele(0.5, '#ffd60a'), { t: 0.3, start() { self.pose = 'heart'; G.projectiles.fan({ owner: self, kind: 'heart', x: self.pos.x, y: self.pos.y + 1.8, z: self.pos.z, r: 0.34, dmg: 8, life: 4 }, 5, 0.9, self.yawTo(), 10); }, end() { self.pose = null; } }]);
      return;
    }
    switch (this.role) {
      case 0: { // LEADER: formation lanes toward Alex
        const y = this.yawTo();
        this.act([{ ...this.tele(0.4, '#e63946'), start() { self.pose = 'point'; for (const off of [-0.35, 0, 0.35]) G.areas.lane({ x1: self.pos.x, z1: self.pos.z, x2: self.pos.x + Math.sin(y + off) * 34, z2: self.pos.z + Math.cos(y + off) * 34, width: 1.7, delay: 1.0 * tk, dmg: 12, owner: self, duration: 0.3 }); } }, { t: 0.6, end() { self.pose = null; } }]);
        break;
      }
      case 1: // MAIN VOCAL: sound rings
        this.act([{ ...this.tele(0.6, '#3a86ff'), start() { self.pose = 'sing'; say(self, '♪ HIGH NOTE ♪', '#3a86ff', 1); } }, { t: 0.5, start() {
          G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 1, r1: 16, speed: 8, width: 0.7, height: 0.8, dmg: 10, delay: 0.3 * tk, owner: self, color: '#4cc9f0' });
          if (c.dead >= 1) G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 1, r1: 16, speed: 8, width: 0.7, height: 0.8, dmg: 10, delay: 1.2 * tk, owner: self, color: '#4cc9f0' });
        }, end() { self.pose = null; } }]);
        break;
      case 2: { // MAIN DANCER: dash strike through Alex
        let dir = 0, hit = false;
        this.act([{ ...this.tele(0.7, '#ffd60a'), start() { self.pose = 'spin'; }, update(dt) { self.stop(dt); self.faceTarget(dt, 10); } },
          { t: 0.45, start() { dir = self.yaw; hit = false; }, update(dt) { self.vel.x = Math.sin(dir) * 20; self.vel.z = Math.cos(dir) * 20; if (!hit && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < 1.3) { hit = true; G.alex.hurt(14, { source: self, dir: [Math.sin(dir), Math.cos(dir)], knock: 8 }); } G.fx.ghost(self.model.group, '#ffd60a', 0.2, 0.25); } },
          { t: 0.4, end() { self.pose = null; } }]);
        break;
      }
      case 3: { // VISUAL: fancam flash
        const p = { x: G.alex.pos.x, z: G.alex.pos.z };
        this.act([{ t: 1.4 * tk, start() {
          self.pose = 'pose';
          G.areas.rect({ x: p.x, z: p.z, w0: 5, d0: 5, w: 2.4, d: 2.4, delay: 1.25 * tk, lockAt: 0.22, dmg: 14, owner: self, color: '#ff0033', follow: () => { const a = G.alex.pos, dx = a.x - p.x, dz = a.z - p.z, l = Math.hypot(dx, dz), st = Math.min(l, 5 * G.dt); if (l > 1e-3) { p.x += dx / l * st; p.z += dz / l * st; } return p; }, onFire: () => { G.fx.flash(0.25); G.audio.sfx('flash', { v: 0.6 }); } });
        }, end() { self.pose = null; } }]);
        break;
      }
    }
  }
  onDeath() { this.ctrl.memberDied(this); }
}

// Invisible conductor for the four members.
class HeadlinerCtrl {
  constructor(room, members) {
    this.room = room;
    this.members = members;
    for (const m of members) m.ctrl = this;
    this.center = members[0];
    this.rotateAt = G.time + 9;
    this.rotating = false;
    this.dead = 0;
    this.angle = 0;
    this.title = 'CROWN//CORE'; this.subtitle = 'The Headliner Guardian';
  }
  speedK() { return 1 + this.dead * 0.15; }
  telK() { return G.room.telegraphK || 1; }
  alive() { return this.members.filter((m) => m.alive); }
  slotFor(m) {
    const alive = this.alive();
    const i = alive.indexOf(m);
    if (m === this.center) return { x: Math.sin(this.angle) * 3, z: -4 + Math.cos(this.angle) * 2 };
    const others = alive.filter((x) => x !== this.center);
    const j = others.indexOf(m);
    const n = Math.max(1, others.length);
    const a = this.angle + ((j + 1) / (n + 1) - 0.5) * Math.PI * 1.4 + Math.PI;
    return { x: Math.sin(a) * 11, z: -3 + Math.cos(a) * 9 * (i >= 0 ? 1 : 1) };
  }
  update(dt) {
    this.angle += dt * 0.12 * this.speedK();
    const alive = this.alive();
    if (!alive.length) return;
    if (!this.center.alive) this.center = alive[0];
    if (G.time > this.rotateAt) {
      this.rotateAt = G.time + 9 / this.speedK();
      const opts = alive.filter((m) => m !== this.center);
      if (opts.length) {
        this.center = G.run.rng.pick(opts);
        this.angle += Math.PI * 0.7;
        G.hud.popup('CENTER POSITION: ' + this.center.name, ROLES[this.center.role].color, 1.4);
        G.audio.sfx('cheer', { v: 0.4 });
        for (const m of alive) m.interrupt();
      }
    }
  }
  memberDied(m) {
    this.dead++;
    const alive = this.alive();
    if (alive.length) {
      G.hud.popup(m.name + ' LEFT THE GROUP', '#ffffff', 1.6);
      for (const o of alive) { say(o, 'WE\'LL FIGHT FOR ' + m.name + '!', '#ffd60a', 1.4); o.buff = { until: G.time + 999, move: true, atk: true, poise: true }; }
      if (m === this.center) { this.center = alive[0]; this.rotateAt = G.time + 7; }
    }
  }
  get hp() { return this.members.reduce((s, m) => s + Math.max(0, m.alive ? m.hp : 0), 0); }
  get maxHp() { return this.members.reduce((s, m) => s + m.maxHp, 0); }
}

// ===========================================================================
// FLOOR 3 — THE K-POP DEMON KING
// ===========================================================================
function kingModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0; g.add(body);
  part(body, new THREE.CylinderGeometry(2.2, 3.2, 5, 16), '#1d1a33', [0, 2.5, 0]);
  part(body, new THREE.BoxGeometry(1.4, 3.6, 0.2), '#f8f9fa', [0, 3.3, 2.05], { outline: false });
  part(body, new THREE.BoxGeometry(0.5, 1.6, 0.25), '#e63946', [0, 3.8, 2.15], { outline: false });
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(1.4, 3.4, 0.25), '#ff4fa3', [s * 1.35, 3.3, 1.9], { rot: [0, -s * 0.3, 0], outline: false, mat: { emissive: '#ff4fa3', emissiveIntensity: 0.25 } });
  const shoulders = part(body, new THREE.BoxGeometry(6.5, 0.9, 2.5), '#1d1a33', [0, 5.2, 0]);
  const head = new THREE.Group(); head.position.set(0, 6.6, 0.3); body.add(head);
  part(head, new THREE.SphereGeometry(1.3, 20, 16), '#e0aaff', [0, 0, 0], { scale: [1, 1.1, 1] });
  part(head, new THREE.SphereGeometry(1.4, 20, 16), '#10002b', [0, 0.4, -0.2], { scale: [1.05, 0.8, 1.05] });
  for (const s of [-1, 1]) {
    part(head, new THREE.ConeGeometry(0.3, 1.6, 8), '#240046', [s * 0.9, 1.3, 0], { rot: [0, 0, -s * 0.5] });
    part(head, new THREE.SphereGeometry(0.18, 10, 8), '#fff', [s * 0.45, 0.1, 1.15], { material: glow('#ff006e') });
  }
  const crown = new THREE.Group(); crown.position.y = 1.35; head.add(crown);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(crown, new THREE.ConeGeometry(0.16, 0.6, 4), '#ffd60a', [Math.sin(a) * 0.8, 0.2, Math.cos(a) * 0.8], { material: glow('#ffd60a') }); }
  const mouth = part(head, new THREE.BoxGeometry(0.7, 0.12, 0.1), '#370617', [0, -0.45, 1.2], { outline: false });
  const phone = new THREE.Group();
  part(phone, new THREE.BoxGeometry(0.7, 1.3, 0.1), '#111', [0, 0, 0]);
  part(phone, new THREE.BoxGeometry(0.6, 1.15, 0.02), '#fff', [0, 0, 0.06], { material: glow('#caf0f8'), outline: false });
  phone.visible = false;
  g.add(phone);
  // hands live in world space so they can slam anywhere in the arena
  const hands = [];
  for (let i = 0; i < 2; i++) {
    const h = new THREE.Group();
    part(h, new THREE.SphereGeometry(1.0, 16, 12), '#e0aaff', [0, 0, 0], { scale: [1.2, 0.7, 1.2] });
    for (let k = 0; k < 4; k++) part(h, new THREE.CapsuleGeometry(0.2, 0.6, 4, 8), '#e0aaff', [(k - 1.5) * 0.45, 0, 1.1], { rot: [Math.PI / 2, 0, 0] });
    if (i === 1) { part(h, new THREE.CylinderGeometry(0.2, 0.15, 1.6, 10), '#adb5bd', [0, 0.8, 0.4]); part(h, new THREE.SphereGeometry(0.4, 14, 10), '#495057', [0, 1.7, 0.4]); }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 10), mat('#1d1a33'));
    hands.push({ g: h, arm });
  }
  return {
    group: g, parts: { body, head, mouth, hands, phone, crown },
    anim(e) {
      const t = performance.now() * 0.001;
      body.rotation.y = Math.sin(t * 0.7) * 0.08;
      head.rotation.x = e.pose === 'visual' ? 0.45 : Math.sin(t * 1.3) * 0.05;
      mouth.scale.y = e.pose === 'sing' || e.pose === 'roar' ? 3 + Math.sin(t * 20) : 1;
      crown.rotation.y += 0.01;
      phone.visible = e.pose === 'phone';
    },
  };
}

const NODES = [
  { name: 'HEAD', key: 'head', r: 1.35 },
  { name: 'BODY', key: 'body', r: 2.4 },
  { name: 'LEFT ARM', key: 'hand0', r: 1.3 },
  { name: 'RIGHT ARM', key: 'hand1', r: 1.3 },
  { name: 'MIC', key: 'mic', r: 0.7, weak: true },
];

class DemonKing extends Boss {
  constructor(o) {
    super({ hp: 2600, speed: 0, radius: 3.2, height: 8, name: 'THE K-POP DEMON KING', readyDelay: 3, ...o });
    this.title = 'THE K-POP DEMON KING'; this.subtitle = 'Center of It All';
    this.setModel(kingModel());
    this.hands = this.model.parts.hands.map((h, i) => {
      G.room.group.add(h.g); G.room.group.add(h.arm);
      return { i, g: h.g, arm: h.arm, pos: new THREE.Vector3(i ? 5 : -5, 3.5, this.pos.z + 3.5), rest: new THREE.Vector3(i ? 5.5 : -5.5, 4, this.pos.z + 3), state: 'rest', linger: 0 };
    });
    const rel = G.run.heartline.score('demonKing');
    this.theatrical = rel >= 3;
    this.spiteful = rel <= -3;
    this.offended = false;
    this.called = false;
    this.phaseN = 1;
    this.cd = 2;
    this.lastAttack = null;
    this.fanService = { 1: false, 2: false, 3: false };
    this.spiral = 0;
    this.nodes = NODES.map((n) => ({ ...n, pos: (out) => this.nodePos(n.key, out), hidden: false }));
  }
  targetable() { return this.alive && this.spawnT > 0.4; }
  nodePos(key, out) {
    switch (key) {
      case 'head': return out.set(this.pos.x, this.pos.y + 6.6, this.pos.z + 0.4);
      case 'body': return out.set(this.pos.x, this.pos.y + 3, this.pos.z + 2.3);
      case 'hand0': return out.copy(this.hands[0].pos);
      case 'hand1': return out.copy(this.hands[1].pos);
      case 'mic': return out.set(this.hands[1].pos.x, this.hands[1].pos.y + 1.7, this.hands[1].pos.z + 0.4);
    }
    return out.copy(this.pos);
  }
  aimPoint(out) { return this.nodePos('body', out); }
  hitTest(x, y, z, r) {
    if (!this.targetable()) return null;
    for (const n of this.nodes) { const p = n.pos(tmp); if (Math.hypot(x - p.x, y - p.y, z - p.z) < n.r + r) return n.key; }
    if (Math.hypot(x - this.pos.x, z - this.pos.z) < 3.2 + r && y < this.pos.y + 5.5) return 'body';
    return null;
  }
  meleeTest(apos, ayaw, range, halfArc, full) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      const p = n.pos(tmp);
      if (p.y > apos.y + 3.5) continue;
      const dx = p.x - apos.x, dz = p.z - apos.z, d = Math.hypot(dx, dz) - n.r;
      if (d > range) continue;
      if (!full && Math.abs(wrapAngle(Math.atan2(dx, dz) - ayaw)) > halfArc + 0.4) continue;
      if (d < bd) { bd = d; best = n.key; }
    }
    if (!best) { const dx = this.pos.x - apos.x, dz = (this.pos.z + 2) - apos.z; if (Math.hypot(dx, dz) - 3 < range) best = 'body'; }
    return best;
  }
  routeDamage(dmg, info) {
    const k = { head: this.pose === 'visual' || this.pose === 'fanservice' ? 1.6 : 0.6, body: 1, hand0: this.hands[0].state === 'linger' ? 1.2 : 0.7, hand1: this.hands[1].state === 'linger' ? 1.2 : 0.7, mic: 2 }[info.part] ?? 1;
    return { dmg: dmg * k, result: k < 0.8 ? 'armor' : 'hit' };
  }
  atkK() { return super.atkK() * (this.offended ? 1.25 : 1) * (this.spiteful ? 1.15 : 1); }
  telK() { return super.telK() * (this.theatrical ? 1.25 : 1); }
  announce(t) { if (this.theatrical) say(this, t, '#ffd60a', 1.4); }

  think(dt) {
    const f = this.hpFrac();
    const newPhase = f > 0.7 ? 1 : f > 0.4 ? 2 : 3;
    if (newPhase !== this.phaseN) {
      this.phaseN = newPhase;
      say(this, newPhase === 2 ? '♪ CHORUS ♪' : '♪ BRIDGE — ENCORE ♪', '#ff4fa3', 2);
      G.hud.popup(newPhase === 2 ? 'PHASE 2 — CHORUS' : 'PHASE 3 — ENCORE', '#ff4fa3', 1.6);
      G.audio.sfx('roar');
      G.cam.shake(0.4);
      G.fx.confetti(0, 6, this.pos.z + 4, 80);
    }
    // the phone call, mid-fight
    if (!this.called && f < 0.65) { this.called = true; this.phoneCall(); return; }
    // fan service (theatrical): once per phase, a free window
    if (this.theatrical && !this.fanService[this.phaseN] && f < [1, 0.9, 0.6, 0.3][this.phaseN]) {
      this.fanService[this.phaseN] = true;
      const self = this;
      this.act([{ t: 3, start() { self.pose = 'fanservice'; say(self, 'A MOMENT FOR MY FANS ♥', '#ff4fa3', 2.5); G.audio.sfx('cheer', { v: 0.7 }); G.hud.popup('HEAD EXPOSED!', '#ffd60a', 1.2); }, end() { self.pose = null; } }]);
      return;
    }
    this.cd -= dt * this.atkK();
    this.bossMajorT = Math.max(0, (this.bossMajorT || 0) - dt);
    G.room.bossMajor = this.bossMajorT > 0;
    if (this.cd > 0) return;
    const opts = ['slam', 'lasers', 'spiral'];
    if (this.phaseN >= 2) opts.push('lanes', 'pyro', 'screens', 'hearts');
    if (this.phaseN >= 3) opts.push('doubleSlam', 'hell', 'hell');
    if (f < 0.15 && !this.encored) { this.encored = true; this.encore(); return; }
    const pick = G.run.rng.pick(opts.filter((o) => o !== this.lastAttack));
    this.lastAttack = pick;
    this[pick]();
  }

  slamHand(i, tx, tz, delay) {
    const h = this.hands[i];
    const tk = this.telK() / this.atkK();
    h.state = 'windup';
    h.target = new THREE.Vector3(tx, 0.7, tz);
    h.t0 = G.time; h.dur = delay * tk;
    G.areas.circle({ x: tx, z: tz, r: 3, delay: delay * tk, dmg: 20, owner: this, sound: 'slam', shake: 0.5, color: '#ff006e', propDmg: 0, onFire: () => { h.state = 'linger'; h.linger = 2.5; G.fx.burst(tx, 0.3, tz, { n: 20, kind: 'debris', color: ['#e0aaff', '#10002b'], speed: 7, up: 1, life: 0.8 }); } });
    G.areas.ring({ x: tx, z: tz, r0: 3, r1: 13, speed: 9, width: 0.7, height: 0.8, dmg: 10, delay: delay * tk, owner: this });
    if (this.spiteful) G.areas.ring({ x: tx, z: tz, r0: 3, r1: 13, speed: 7, width: 0.7, height: 0.8, dmg: 10, delay: delay * tk + 0.7, owner: this });
    G.hud.threatStart(this); this.threatDur = delay * tk; this.threatT = delay * tk;
  }
  slam() {
    const i = G.run.rng.int(2);
    this.announce(i ? 'BEHOLD! MY RIGHT HAND!' : 'BEHOLD! MY LEFT HAND!');
    this.slamHand(i, G.alex.pos.x, G.alex.pos.z, 1.2);
    this.cd = 3.4;
  }
  doubleSlam() {
    this.announce('BOTH HANDS! FOR YOU!');
    const a = G.alex.pos;
    this.slamHand(0, a.x - 2.5, a.z, 1.1);
    const self = this;
    setTimeoutGame(() => { if (self.alive) self.slamHand(1, G.alex.pos.x + 1, G.alex.pos.z, 1.0); }, 1.1);
    this.cd = 4.2;
  }
  lasers() {
    this.announce('LASER CHOREOGRAPHY!');
    this.pose = 'sing';
    const n = this.phaseN >= 3 ? 3 : 2;
    const tk = this.telK() / this.atkK();
    for (let k = 0; k < n; k++) {
      const yaw = Math.PI + (k - (n - 1) / 2) * 0.7;
      G.areas.beam({ x: this.pos.x, z: this.pos.z + 2.5, yaw: yaw - 0.9, yawSpeed: 0.55 * (k % 2 ? -1 : 1), length: 26, width: 0.8, height: 0.8, dmg: 12, delay: 1.1 * tk, duration: 3.4, tick: 0.7, owner: this, color: '#ff006e' });
    }
    this.cd = 4.8;
  }
  spiral() {
    this.announce('SPIN WITH ME!');
    this.pose = 'sing';
    const arms = this.spiteful ? 6 : 4;
    const dur = 3.2, rate = 0.12;
    let t = 0, a = Math.random() * 6;
    const self = this;
    this.bossMajorT = dur;
    this.act([{ t: dur, update(dt) {
      t += dt;
      while (t > rate) {
        t -= rate;
        a += 0.23;
        for (let k = 0; k < arms; k++) {
          const ang = a + (k / arms) * Math.PI * 2;
          G.projectiles.spawn({ owner: self, x: self.pos.x, y: 1.3, z: self.pos.z + 2.5, vx: Math.sin(ang) * 8, vz: Math.cos(ang) * 8, r: 0.3, dmg: 8, life: 5 });
        }
      }
    }, end() { self.pose = null; } }]);
    this.cd = 4.2;
  }
  lanes() {
    this.announce('BACKUP DANCERS, ASSEMBLE!');
    const L = G.room.L, tk = this.telK() / this.atkK();
    const alongX = G.run.rng.chance(0.5);
    const offs = G.run.rng.chance(0.5) ? [-0.33, -0.1, 0.13, 0.36] : [-0.22, 0.01, 0.24, 0.45];
    for (const f of offs) {
      const v = (alongX ? L.w : L.d) * f;
      const lane = alongX ? { x1: v, z1: -L.d / 2, x2: v, z2: L.d / 2 } : { x1: -L.w / 2, z1: v, x2: L.w / 2, z2: v };
      G.areas.lane({ ...lane, width: 2.4, delay: 1.2 * tk, dmg: 16, duration: 0.4, owner: this, color: '#b388ff', strikeColor: '#e0c3fc' });
      const d = MODELS.dancer();
      d.group.position.set(alongX ? v : -L.w / 2 + 2, 0, alongX ? -L.d / 2 + 3 : v);
      G.room.group.add(d.group);
      setTimeoutGame(() => d.group.parent?.remove(d.group), 2);
    }
    this.cd = 3.6;
  }
  pyro() {
    this.announce('PYROTECHNICS!');
    const L = G.room.L, tk = this.telK() / this.atkK();
    const cells = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) cells.push([-L.w / 2 + 5 + i * (L.w - 10) / 4, -L.d / 2 + 12 + j * (L.d - 16) / 3]);
    G.run.rng.shuffle(cells);
    cells.slice(0, 9).forEach(([x, z], k) => G.areas.circle({ x, z, r: 2.4, delay: (1.0 + k * 0.08) * tk, dmg: 14, owner: this, style: 'fire', color: '#ff7b00', sound: k ? null : 'boom', shake: k ? 0 : 0.3, propDmg: 0 }));
    this.cd = 3.4;
  }
  screens() {
    this.announce('ON THE BIG SCREEN!');
    const tk = this.telK() / this.atkK();
    for (let k = 0; k < 2; k++) {
      const p = { x: G.alex.pos.x + (k ? 3 : -3), z: G.alex.pos.z };
      G.areas.rect({ x: p.x, z: p.z, w0: 6, d0: 6, w: 2.6, d: 2.6, delay: (1.3 + k * 0.5) * tk, lockAt: 0.25, dmg: 14, owner: this, color: '#ff0033', follow: () => { const a = G.alex.pos, dx = a.x - p.x, dz = a.z - p.z, l = Math.hypot(dx, dz), st = Math.min(l, 5 * G.dt); if (l > 1e-3) { p.x += dx / l * st; p.z += dz / l * st; } return p; }, onFire: () => { G.fx.flash(0.22); G.audio.sfx('flash', { v: 0.6 }); } });
    }
    this.cd = 3.2;
  }
  hearts() {
    this.announce('HEARTS FOR MY FANS!');
    const self = this;
    let n = 0;
    this.act([{ t: 1.8, update(dt) {
      self._ht = (self._ht || 0) + dt;
      if (self._ht > 0.3) { self._ht = 0; n++; G.projectiles.fan({ owner: self, kind: 'heart', x: self.pos.x, y: 3, z: self.pos.z + 3, r: 0.36, dmg: 8, life: 5, vy: 0 }, 7 + (n % 2), 1.4, Math.atan2(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z - 3), 11); }
    } }]);
    this.cd = 3;
  }
  hell() {
    this.announce('THE FINAL CHORUS!');
    this.pose = 'roar';
    G.audio.sfx('roar');
    const self = this;
    let t = 0, a = 0;
    this.bossMajorT = 4.5;
    this.act([{ t: 4.2, update(dt) {
      t += dt;
      if (t > 0.16) {
        t = 0; a += 0.19;
        const arms = this.spiteful ? 7 : 5;
        for (let k = 0; k < arms; k++) {
          const ang = a + (k / arms) * Math.PI * 2;
          G.projectiles.spawn({ owner: self, x: self.pos.x, y: 1.3, z: self.pos.z + 2.5, vx: Math.sin(ang) * 7.5, vz: Math.cos(ang) * 7.5, r: 0.3, dmg: 8, life: 6 });
          G.projectiles.spawn({ owner: self, x: self.pos.x, y: 1.3, z: self.pos.z + 2.5, vx: Math.sin(-ang) * 6, vz: Math.cos(-ang) * 6, r: 0.26, dmg: 8, life: 6, color: '#fff3b0' });
        }
      }
    }, end() { self.pose = null; } }]);
    this.cd = 5.2;
  }
  encore() {
    const self = this;
    say(this, 'ENCORE! ENCORE! ENCORE!', '#ff006e', 3);
    G.hud.popup('DESPERATION ENCORE — SURVIVE!', '#ff006e', 2);
    this.bossMajorT = 9;
    let t = 0, a = 0, s = 0;
    this.act([
      { t: 8, update(dt) {
        t += dt; s += dt;
        if (t > 0.14) {
          t = 0; a += 0.27;
          for (let k = 0; k < 4; k++) { const ang = a + k * Math.PI / 2; G.projectiles.spawn({ owner: self, x: self.pos.x, y: 1.3, z: self.pos.z + 2.5, vx: Math.sin(ang) * 8, vz: Math.cos(ang) * 8, r: 0.3, dmg: 8, life: 6 }); }
        }
        if (s > 2.2) { s = 0; self.slamHand(G.run.rng.int(2), G.alex.pos.x, G.alex.pos.z, 1.0); }
      } },
      { t: 4, start() { self.pose = 'visual'; say(self, '...*visual pose*...', '#e0aaff', 3); G.hud.popup('HIS HEAD IS EXPOSED — FINISH IT!', '#ffd60a', 1.8); G.audio.sfx('cheer'); }, end() { self.pose = null; } },
    ]);
  }
  phoneCall() {
    const self = this;
    this.interrupt();
    G.projectiles.clearHostile();
    G.areas.clearOwner(this);
    say(this, '...hold on.', '#ffffff', 1.5);
    this.pose = 'phone';
    this.onCall = true;
    G.phone.forceCall('demonKing', {
      boss: true,
      onEnd: (answered) => {
        self.onCall = false;
        self.pose = null;
        if (!answered) {
          self.offended = true;
          say(self, '...wow.', '#ff006e', 2);
          G.hud.popup('THE DEMON KING IS OFFENDED (+25% attack speed)', '#ff006e', 1.8);
          G.audio.sfx('roar');
        } else say(self, 'Now. Where were we.', '#ffd60a', 2);
        self.cd = 1.5;
      },
    });
  }
  update(dt) {
    if (this.onCall && this.alive) { this.pose = 'phone'; this._sync(dt); this._hands(dt); return; }
    super.update(dt);
    if (this.alive) this._hands(dt);
  }
  _physics(dt) { this.vel.set(0, 0, 0); }
  _hands(dt) {
    const shoulderY = this.pos.y + 5.2;
    for (const h of this.hands) {
      if (h.state === 'windup') {
        const k = clamp((G.time - h.t0) / h.dur, 0, 1);
        const up = new THREE.Vector3(h.target.x, 7, h.target.z);
        if (k < 0.8) h.pos.lerp(up, 1 - Math.exp(-6 * dt));
        else h.pos.lerp(h.target, 1 - Math.exp(-30 * dt));
      } else if (h.state === 'linger') {
        h.linger -= dt;
        h.pos.lerp(h.target, 0.3);
        if (h.linger <= 0) h.state = 'rest';
      } else {
        const rest = h.rest.clone();
        rest.y += Math.sin(G.time * 1.5 + h.i * 2) * 0.4;
        h.pos.lerp(rest, 1 - Math.exp(-3 * dt));
      }
      h.g.position.copy(h.pos);
      h.g.rotation.y = h.i ? -0.3 : 0.3;
      // arm from shoulder to hand
      const sh = new THREE.Vector3(this.pos.x + (h.i ? 3 : -3), shoulderY, this.pos.z + 0.3);
      const mid = sh.clone().add(h.pos).multiplyScalar(0.5);
      h.arm.position.copy(mid);
      h.arm.scale.set(1, sh.distanceTo(h.pos), 1);
      h.arm.lookAt(h.pos);
      h.arm.rotateX(Math.PI / 2);
    }
  }
  die(info) {
    for (const h of this.hands) { h.g.parent?.remove(h.g); h.arm.parent?.remove(h.arm); }
    G.room.bossMajor = false;
    super.die(info);
  }
}

// Game-time timeouts (pause-safe) for bosses.
const timers = [];
export function setTimeoutGame(fn, t) { timers.push({ at: G.time + t, fn }); }
export function tickTimers() {
  for (let i = timers.length - 1; i >= 0; i--) if (G.time >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); }
}
export function clearTimers() { timers.length = 0; }

export function spawnBoss(floor, room) {
  if (floor === 1) {
    const b = new Prelude({ type: 'boss1', x: 0, z: -9 });
    return { boss: b, list: [b], title: b.title, subtitle: b.subtitle, bar: () => ({ hp: b.hp, max: b.maxHp, name: 'PRELUDE — The Opening Act' }) };
  }
  if (floor === 2) {
    const ms = [0, 1, 2, 3].map((r) => new Member({ type: 'member', role: r, x: -6 + r * 4, z: -12 }));
    const ctrl = new HeadlinerCtrl(room, ms);
    return { boss: ctrl, list: ms, ctrl, title: ctrl.title, subtitle: ctrl.subtitle, bar: () => ({ hp: ctrl.hp, max: ctrl.maxHp, name: 'CROWN//CORE — Center: ' + (ctrl.center?.name || '') }) };
  }
  const k = new DemonKing({ type: 'boss3', x: 0, z: -14.5, yaw: 0 });
  return { boss: k, list: [k], title: k.title, subtitle: k.subtitle, bar: () => ({ hp: k.hp, max: k.maxHp, name: 'THE K-POP DEMON KING' + (k.offended ? ' (offended)' : '') }) };
}
