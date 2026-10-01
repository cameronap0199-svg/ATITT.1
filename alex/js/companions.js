// Captured companions (Capture Ball): any demon or crossover critter, shrunk down,
// following Alex between rooms and shooting at whatever he is fighting. They can't be
// hurt — when things get hot they hop back into the ball for a moment.

import * as THREE from 'three';
import { G } from './state.js';
import { MODELS } from './actors/enemyModels.js';
import { CROSS_MODELS } from './actors/crossoverModels.js';
import { collapseRig } from './world/props.js';
import { RIFTS } from './world/rifts.js';
import { damp, dampAngle } from './core/math.js';

const COLORS = { halo: '#7dd3fc', minecraft: '#86efac', onepiece: '#fca5a5', pokemon: '#fde047', bible: '#fde68a' };
const CRY = ['Go, %!', '% is fired up!', '% used TACKLE!', '% is doing its best!', '%: ♪'];

export class Pal {
  constructor(info) {
    this.info = info;
    const make = MODELS[info.type] || CROSS_MODELS[info.type] || MODELS.lurker;
    this.model = make();
    collapseRig(this.model.group);
    this.group = new THREE.Group();
    this.model.group.scale.setScalar(0.58);
    this.group.add(this.model.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 24), new THREE.MeshBasicMaterial({ color: COLORS[info.franchise] || '#ff4fa3', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    this.group.add(ring);
    this.ring = ring;
    const a = G.alex;
    this.pos = new THREE.Vector3(a.pos.x - Math.sin(a.yaw) * 1.5 + 1, a.pos.y, a.pos.z - Math.cos(a.yaw) * 1.5);
    this.vel = new THREE.Vector3();
    this.yaw = a.yaw;
    this.height = 1.2;
    this.alive = true;
    this.cd = 1;
    this.surfaceK = 1;
    this.pose = null;
    this.cryT = 4;
    G.room.group.add(this.group);
    this.group.position.copy(this.pos);
    G.fx.burst(this.pos.x, 1, this.pos.z, { n: 18, color: ['#ef4444', '#ffffff'], speed: 4, life: 0.4 });
  }

  dmg() { const m = G.run.mods; return (5 + (this.info.threat || 1) * 3) * (m.companionDmg || 1) * (m.dmgMul || 1) * (1 + (this.info.level - 1) * 0.15); }

  update(dt) {
    const a = G.alex;
    this._dt = dt;
    // follow: hover behind Alex's right shoulder
    const tx = a.pos.x - Math.sin(a.yaw) * 1.6 + Math.cos(a.yaw) * 1.1, tz = a.pos.z - Math.cos(a.yaw) * 1.6 - Math.sin(a.yaw) * 1.1;
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const sp = d > 8 ? 30 : Math.min(12, d * 4);
    this.vel.x = damp(this.vel.x, d > 0.2 ? dx / d * sp : 0, 8, dt);
    this.vel.z = damp(this.vel.z, d > 0.2 ? dz / d * sp : 0, 8, dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (d > 14) { this.pos.set(tx, a.pos.y, tz); }
    const g = G.room.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 1, 0.2);
    this.pos.y = damp(this.pos.y, g.h, 10, dt);
    // attack the focus target, or the closest demon
    let target = G.targeting.focusEnemy();
    if (!target || !target.alive) {
      let bd = 14;
      target = null;
      for (const e of G.room.enemies) { if (!e.alive || !e.targetable() || e.intangible) continue; const dd = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z); if (dd < bd) { bd = dd; target = e; } }
    }
    if (target) this.yaw = dampAngle(this.yaw, Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z), 10, dt);
    else if (Math.hypot(this.vel.x, this.vel.z) > 0.5) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    this.cd -= dt;
    if (target && this.cd <= 0) {
      this.cd = 1.15;
      const p = target.aimPoint(new THREE.Vector3());
      const sx = this.pos.x, sy = this.pos.y + 0.8, sz = this.pos.z;
      const vx = p.x - sx, vy = p.y - sy, vz = p.z - sz, l = Math.hypot(vx, vy, vz) || 1;
      G.projectiles.spawn({ hostile: false, kind: 'star', x: sx, y: sy, z: sz, vx: vx / l * 24, vy: vy / l * 24, vz: vz / l * 24, r: 0.2, dmg: this.dmg(), knock: 2, stagger: 1, life: 1.2, color: COLORS[this.info.franchise] || '#ff9ccf' });
      this.pose = 'shoot';
      this.poseT = 0.25;
      this.cryT -= 1;
      if (this.cryT <= 0) { this.cryT = 5 + Math.random() * 5; G.hud.bubble(this, G.run.rng.pick(CRY).replace('%', this.info.name.toUpperCase()), COLORS[this.info.franchise] || '#ffffff', 1); }
    }
    if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0) this.pose = null; }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.ring.rotation.z += dt * 2;
    this.model.anim?.(this, dt, false);
  }

  dispose() { this.alive = false; this.group.parent?.remove(this.group); }
}
