// Crossover rift enemies. Every one is built on the same Enemy base as the venue
// demons (telegraphs, poise, threat indicators, friendly fire) with a gimmick from
// its home franchise.

import * as THREE from 'three';
import { G } from '../state.js';
import { Enemy } from './enemy.js';
import { CROSS_MODELS } from './crossoverModels.js';
import { RIFTS } from '../world/rifts.js';
import { clamp, dampAngle, wrapAngle } from '../core/math.js';
import { MOVE } from '../config.js';

const RUN = MOVE.runSpeed;
const say = (e, text, color = '#ffffff', dur = 1.2) => G.hud.bubble(e, text, color, dur);
const pan = (e) => G.cam.panOf(e.pos.x, e.pos.z);
const tmp = new THREE.Vector3();

class Cross extends Enemy {
  constructor(o, model) {
    super(o);
    this.franchise = o.franchise;
    this.franchiseTag = RIFTS[o.franchise]?.tag;
    this.setModel(CROSS_MODELS[model]());
  }
  // attack arriving from in front of the enemy (dir = travel direction of the hit)
  fromFront(info, cos = 0.2) {
    const [dx, dz] = info.dir || [0, 0];
    const l = Math.hypot(dx, dz) || 1;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / l < -cos;
  }
  aimAt(speed, lead = 0.6) {
    const a = G.alex;
    const tx = a.pos.x + a.vel.x * lead * 0.3, tz = a.pos.z + a.vel.z * lead * 0.3;
    const dx = tx - this.pos.x, dz = tz - this.pos.z, l = Math.hypot(dx, dz) || 1;
    return { vx: (dx / l) * speed, vz: (dz / l) * speed, yaw: Math.atan2(dx, dz), d: l };
  }
  teleTo(x, z) {
    G.fx.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, { n: 18, color: ['#c77dff', '#5a189a', '#ffffff'], speed: 4, life: 0.5, size: 0.18 });
    const w = G.room.world;
    const hw = G.room.L.w / 2 - 1.2, hd = G.room.L.d / 2 - 1.2;
    this.pos.x = clamp(x, -hw, hw); this.pos.z = clamp(z, -hd, hd);
    this.pos.y = w.groundAt(this.pos.x, this.pos.z, 10, 0.3).h;
    this.vel.set(0, 0, 0);
    G.fx.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, { n: 18, color: ['#c77dff', '#5a189a', '#ffffff'], speed: 4, life: 0.5, size: 0.18 });
    G.audio.sfx('teleport', { pan: pan(this) });
  }
}

// =============================================================================== HALO
class Grunt extends Cross {
  constructor(o) { super({ hp: 22, speed: RUN * 0.62, radius: 0.42, height: 1.35, poise: 'low', ...o }, 'grunt'); this.cd = 0.8 + Math.random(); this.panicUntil = 0; }
  think(dt) {
    this.pose = null;
    if (G.time < this.panicUntil) {
      const a = G.alex, dx = this.pos.x - a.pos.x, dz = this.pos.z - a.pos.z, l = Math.hypot(dx, dz) || 1;
      this.steer(dt, dx / l, dz / l, this.speed * 1.25);
      this.yaw = Math.atan2(dx, dz);
      this.pose = 'panic';
      return;
    }
    if (this.kamikaze) { this.pose = 'kamikaze'; this.seek(dt, RUN * 0.95); return; }
    const d = this.kite(dt, 5, 11, this.speed);
    this.cd -= dt;
    if (this.cd <= 0 && d < 20 && this.losCached()) this.burst();
  }
  burst() {
    const self = this;
    this.cd = 2.2 + Math.random();
    const shot = () => { const v = self.aimAt(15); self.shoot({ kind: 'orb', vx: v.vx, vz: v.vz, r: 0.2, dmg: 6, color: '#b6ff6b', life: 2.2 }); G.audio.sfx('shot', { v: 0.4, p: 0.7, pan: pan(self) }); };
    this.act([
      { ...this.tele(0.45, '#9eff6b'), update(dt, k) { self.threatT = 0.45 * (1 - k); self.pose = 'shoot'; self.faceTarget(dt, 8); self.stop(dt); } },
      { t: 0.14, start() { self.pose = 'shoot'; shot(); } }, { t: 0.14, start: shot }, { t: 0.3, start: shot, update(dt) { self.stop(dt); } },
    ]);
  }
  onHurt() {
    if (this.kamikaze || !this.alive) return;
    if (this.hp < this.maxHp * 0.45 && Math.random() < 0.4) this.goKamikaze();
    else if (Math.random() < 0.18) this.panic();
  }
  panic() { this.panicUntil = G.time + 2.2; say(this, G.run.rng.pick(['RUN AWAY!', 'THEY\'RE EVERYWHERE!', 'AAAAAH!']), '#b6ff6b', 1.4); }
  goKamikaze() {
    const self = this;
    this.kamikaze = true;
    this.interrupt();
    say(this, 'AAAAAAAAAH!!', '#6ee7ff', 2);
    G.audio.sfx('shout', { pan: pan(this) });
    G.areas.circle({ x: this.pos.x, z: this.pos.z, r: 2.6, delay: 2.3, follow: () => self.pos, lockAt: 0.15, dmg: 18, ff: true, enemyDmg: 30, owner: self, color: '#6ee7ff', fxColor: '#6ee7ff', sound: 'boom', shake: 0.35, propDmg: 25, keep: true,
      onFire: () => { if (self.alive) { self.noDrop = false; self.die({ source: G.alex }); } } });
  }
  onDeath() {
    if (Math.random() < 0.25) { G.fx.confetti(this.pos.x, this.pos.y + 1, this.pos.z, 40); say({ pos: this.pos.clone(), height: 1.2, alive: true }, 'YAAAY!', '#ffd60a', 1); G.audio.sfx('cheer', { v: 0.5 }); }
  }
}

class Jackal extends Cross {
  constructor(o) { super({ hp: 28, speed: RUN * 0.66, radius: 0.45, height: 1.9, poise: 'low', ...o }, 'jackal'); this.cd = 1 + Math.random(); this.shieldHp = 45; this.shieldBroken = false; this.shieldFlash = 0; }
  routeDamage(dmg, info) {
    if (!this.shieldBroken && !info.pierceArmor && this.fromFront(info)) {
      this.shieldHp -= dmg;
      this.shieldFlash = 1;
      G.audio.sfx('armor', { v: 0.5, pan: pan(this) });
      if (this.shieldHp <= 0) { this.shieldBroken = true; this.stun(1.2); say(this, 'SKREEE!', '#4cc9f0', 1.2); G.fx.burst(this.pos.x, this.pos.y + 1, this.pos.z, { n: 18, color: ['#4cc9f0', '#ffffff'], speed: 6, life: 0.4 }); }
      return { dmg: dmg * 0.1, result: 'armor' };
    }
    return { dmg: dmg * (this.shieldBroken ? 1 : 1.15), result: 'hit' };
  }
  idle(dt) { this.shieldFlash = Math.max(0, this.shieldFlash - dt * 4); }
  think(dt) {
    this.pose = null;
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 4);
    const d = this.kite(dt, 7, 13, this.speed);
    this.cd -= dt;
    if (this.cd <= 0 && d < 22 && this.losCached()) {
      this.cd = 1.8 + Math.random() * 0.8;
      const self = this;
      this.act([
        { ...this.tele(0.6, '#ff9f1c'), update(dt, k) { self.threatT = 0.6 * (1 - k); self.pose = 'aim'; self.faceTarget(dt, 10); self.stop(dt); } },
        { t: 0.35, start() { const v = self.aimAt(34, 1); self.shoot({ kind: 'arrow', vx: v.vx, vz: v.vz, r: 0.16, dmg: 9, color: '#ffb347', life: 1.4 }); G.audio.sfx('heavyShot', { v: 0.35, pan: pan(self) }); }, update(dt) { self.stop(dt); } },
      ]);
    }
  }
}

class Elite extends Cross {
  constructor(o) {
    super({ hp: 60, speed: RUN * 0.8, radius: 0.6, height: 2.5, poise: 'med', ...o }, 'elite');
    this.shieldMax = 40; this.shield = 40; this.shieldFlash = 0; this.cd = 1.2; this.roared = false;
  }
  routeDamage(dmg, info) {
    if (this.shield > 0) {
      const through = info.pierceArmor ? 0.5 : 0;
      const absorb = Math.min(this.shield, dmg * (1 - through));
      this.shield -= absorb;
      this.shieldFlash = 1;
      if (this.shield <= 0) {
        G.fx.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, { n: 26, color: ['#ffd166', '#ffffff'], speed: 7, life: 0.45 });
        G.audio.sfx('armor', { pan: pan(this) });
        say(this, 'GRAAAH!', '#ffd166', 1);
        this.stagger(0.5);
      }
      const left = dmg - absorb;
      return { dmg: left, result: left > 0.01 ? 'hit' : 'armor' };
    }
    return { dmg, result: 'hit' };
  }
  update(dt) {
    if (this.alive) {
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 3);
      if (G.time - this.lastHurt > 3.5 && this.shield < this.shieldMax) { this.shield = Math.min(this.shieldMax, this.shield + 22 * dt); this.shieldFlash = Math.max(this.shieldFlash, 0.4); }
    }
    super.update(dt);
  }
  think(dt) {
    this.pose = null;
    const self = this;
    if (!this.roared) { this.roared = true; say(this, 'WORT WORT WORT!', '#a5b4fc', 1.4); G.audio.sfx('roar', { v: 0.4, pan: pan(this) }); this.act([{ t: 0.6, start() { self.pose = 'roar'; }, update(dt) { self.stop(dt); } }]); return; }
    const d = this.kite(dt, 4, 12, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    if (d < 5) {
      this.cd = 3;
      let dir = 0;
      this.act([
        { ...this.tele(0.5, '#9ef6ff'), start() { self.pose = 'sword'; self.threatDur = 0.5; G.hud.threatStart(self); G.audio.sfx('charge', { v: 0.4, pan: pan(self) }); }, update(dt, k) { self.threatT = 0.5 * (1 - k); self.faceTarget(dt, 10); self.stop(dt); } },
        { t: 0.28, start() { self.pose = 'lunge'; dir = self.yaw; G.fx.slash(self.pos.x, self.pos.y + 1.3, self.pos.z, dir, { r: 2.6, arc: 2, color: '#9ef6ff', life: 0.2 }); G.audio.sfx('slash2', { pan: pan(self) }); },
          update(dt) { self.vel.x = Math.sin(dir) * 13; self.vel.z = Math.cos(dir) * 13; if (!self._hit && self.hitAlexMelee(2.4, 110, 20, 8)) self._hit = true; }, end() { self._hit = false; } },
        { t: 0.6, start() { self.pose = 'sword'; }, update(dt) { self.stop(dt, 8); } },
      ]);
    } else if (this.losCached() && d < 24) {
      this.cd = 2.4 + Math.random();
      const shot = () => { const v = self.aimAt(22); self.shoot({ kind: 'orb', vx: v.vx + (Math.random() - 0.5) * 2, vz: v.vz + (Math.random() - 0.5) * 2, r: 0.18, dmg: 6, color: '#e9a8ff', life: 2 }); G.audio.sfx('shot', { v: 0.3, p: 0.6, pan: pan(self) }); };
      const steps = [{ ...this.tele(0.5, '#d38cff'), update(dt, k) { self.threatT = 0.5 * (1 - k); self.pose = 'shoot'; self.faceTarget(dt, 8); self.stop(dt); } }];
      for (let i = 0; i < 5; i++) steps.push({ t: 0.1, start() { self.pose = 'shoot'; shot(); }, update(dt) { self.faceTarget(dt, 3); } });
      steps.push({ t: 0.35, update(dt) { self.stop(dt); } });
      this.act(steps);
    }
  }
  onDeath() { for (const e of G.room.enemies) if (e.alive && e.type === 'grunt' && Math.random() < 0.7) e.panic?.(); }
}

class Hunter extends Cross {
  constructor(o) { super({ hp: 140, speed: RUN * 0.36, radius: 0.95, height: 3.2, poise: 'high', heavy: true, ...o }, 'hunter'); this.cd = 1.5; }
  dmgTakenK(info) {
    if (!info.dir) return 1;
    const [dx, dz] = info.dir, l = Math.hypot(dx, dz) || 1;
    const dot = (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / l;
    if (dot > 0.35) { if (G.time - (this._weakSay || 0) > 3) { this._weakSay = G.time; say(this, 'WEAK SPOT!', '#ff7b00', 0.8); } return 1.9; }
    if (dot < -0.2 && !info.pierceArmor) return 0.45;
    return 1;
  }
  think(dt) {
    this.pose = null;
    const self = this;
    const d = this.seek(dt, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    if (d < 4.5) {
      this.cd = 3.2;
      this.act([
        { ...this.tele(0.8, '#ff7b00'), start() { self.pose = 'bash'; G.areas.cone({ x: self.pos.x, z: self.pos.z, yaw: self.yaw, range: 4.6, angle: 1.4, delay: 0.8 / self.atkK() * self.telK(), dmg: 22, knock: 12, owner: self, color: '#ff7b00', sound: 'slam', shake: 0.35, follow: () => ({ x: self.pos.x, z: self.pos.z, yaw: self.yaw }) }); }, update(dt, k) { self.threatT = 0.8 * (1 - k); self.faceTarget(dt, 3); self.stop(dt); } },
        { t: 0.7, start() { self.pose = 'bash'; }, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    } else if (d < 18 && this.losCached()) {
      this.cd = 3.6;
      const tx = G.alex.pos.x, tz = G.alex.pos.z;
      const delay = 1.15 / this.atkK() * this.telK();
      this.act([
        { t: 0.3, start() { self.pose = 'aim'; G.audio.sfx('charge', { v: 0.5, pan: pan(self) }); }, update(dt) { self.faceTarget(dt, 6); self.stop(dt); } },
        { t: delay, start() {
          self.pose = 'aim'; self.threatDur = delay; G.hud.threatStart(self);
          const sx = self.pos.x + Math.sin(self.yaw) * 1.2, sz = self.pos.z + Math.cos(self.yaw) * 1.2, sy = self.pos.y + 2;
          const T = delay, vx = (tx - sx) / T, vz = (tz - sz) / T, vy = (0 - sy) / T + 0.5 * 12 * T;
          self.shoot({ kind: 'orb', x: sx, y: sy, z: sz, vx, vy, vz, grav: 12, r: 0.42, dmg: 0, color: '#7dff4f', life: T, noBlock: true });
          G.areas.circle({ x: tx, z: tz, r: 2.6, delay: T, dmg: 18, ff: true, enemyDmg: 25, owner: self, color: '#7dff4f', fxColor: '#7dff4f', sound: 'boom', shake: 0.3 });
        }, update(dt, k) { self.threatT = delay * (1 - k); self.stop(dt); } },
        { t: 0.4, update(dt) { self.stop(dt); } },
      ]);
    }
  }
}

// =========================================================================== MINECRAFT
class Creeper extends Cross {
  constructor(o) { super({ hp: 20, speed: RUN * 0.58, radius: 0.35, height: 1.75, poise: 'low', ...o }, 'creeper'); this.fuseK = 0; this.fusing = false; }
  think(dt) {
    const d = this.distTo();
    if (this.fusing) {
      this.fuseT += dt;
      this.fuseK = Math.min(1, this.fuseT / this.fuseDur);
      this.setEmissive('#ffffff', Math.sin(this.fuseT * (8 + this.fuseT * 14)) > 0 ? 0.85 : 0);
      this.stop(dt, 6);
      this.threatT = Math.max(0, this.fuseDur - this.fuseT);
      if (d > 4.8) {
        this.fusing = false; this.fuseK = 0; this.threatT = 0; this.setEmissive('#000', 0);
        G.areas.clearOwner(this);
        say(this, '...', '#ffffff', 0.8);
      }
      return;
    }
    this.seek(dt, this.speed, { drift: false });
    if (d < 2.6 && Math.abs(G.alex.pos.y - this.pos.y) < 2) this.fuse();
  }
  fuse() {
    const self = this;
    this.fusing = true; this.fuseT = 0;
    this.fuseDur = 1.5 / this.atkK() * this.telK();
    this.threatDur = this.fuseDur; this.threatTarget = true; G.hud.threatStart(this);
    G.audio.sfx('hiss', { pan: pan(this) });
    say(this, 'tsssss…', '#9ef01a', 1.4);
    G.areas.circle({ x: this.pos.x, z: this.pos.z, r: 3.2, delay: this.fuseDur, follow: () => self.pos, lockAt: 0.1, dmg: 24, ff: true, enemyDmg: 40, owner: self, color: '#9ef01a', style: 'fire', sound: 'boom', shake: 0.5, propDmg: 40,
      onFire: () => { self.exploded = true; if (self.alive) self.die({ source: G.alex }); } });
  }
  onDeath() { if (!this.exploded) G.areas.clearOwner(this); }
}

class Zombie extends Cross {
  constructor(o) {
    const baby = o.baby ?? Math.random() < 0.2;
    super({ hp: baby ? 16 : 34, speed: RUN * (baby ? 0.82 : 0.42), radius: baby ? 0.3 : 0.42, height: baby ? 1.1 : 1.9, poise: 'low', ...o }, 'zombie');
    this.baby = baby;
    if (baby) { this.model.group.scale.setScalar(0.6); this.name = 'Baby Zombie'; }
    this.groanT = 2 + Math.random() * 4;
  }
  think(dt) {
    this.pose = null;
    const d = this.seek(dt, this.speed);
    this.groanT -= dt;
    if (this.groanT <= 0) { this.groanT = 4 + Math.random() * 5; say(this, G.run.rng.pick(['Hrrrnnnn…', 'Braaaains… (lightsticks?)', 'Urrgh.']), '#9ef01a', 1.2); }
    if (d < (this.baby ? 1.4 : 1.9)) {
      const self = this;
      this.act([
        this.tele(0.45, '#9ef01a'),
        { t: 0.2, start() { self.pose = 'swipe'; self.hitAlexMelee(self.baby ? 1.5 : 1.9, 100, self.baby ? 6 : 9, 3); G.audio.sfx('hit', { v: 0.3, pan: pan(self) }); } },
        { t: 0.55, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    }
  }
  onDeath() {
    if (!this.baby && Math.random() < 0.12 && G.room.enemies.filter((e) => e.alive).length < 18) {
      const p = G.room.world.openPoint(G.room.rng, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 6 }], 6);
      if (p) { const z = G.room.spawnEnemy('zombie', p.x, p.z, { readyDelay: 1.2, franchise: 'minecraft' }); if (z) say(z, '(reinforcements)', '#9ef01a', 1.4); }
    }
  }
}

class Skeleton extends Cross {
  constructor(o) { super({ hp: 24, speed: RUN * 0.6, radius: 0.38, height: 1.85, poise: 'low', ...o }, 'skeleton'); this.cd = 1 + Math.random(); }
  think(dt) {
    this.pose = null;
    const d = this.kite(dt, 8, 14, this.speed);
    this.cd -= dt;
    if (this.cd <= 0 && d < 24 && this.losCached()) {
      this.cd = 1.7 + Math.random() * 0.8;
      const self = this;
      this.act([
        { ...this.tele(0.7, '#e5e5e5'), update(dt, k) { self.threatT = 0.7 * (1 - k); self.pose = 'draw'; self.faceTarget(dt, 10); self.stop(dt); } },
        { t: 0.3, start() {
          const v = self.aimAt(26, 1);
          const T = v.d / 26;
          self.shoot({ kind: 'arrow', vx: v.vx, vz: v.vz, vy: 0.5 * 5 * T, grav: 5, r: 0.13, dmg: 9, color: '#f5f5f4', life: 1.8 });
          G.audio.sfx('rope', { v: 0.3, pan: pan(self) });
        }, update(dt) { self.stop(dt); } },
      ]);
    }
  }
}

class Enderman extends Cross {
  constructor(o) { super({ hp: 55, speed: RUN * 0.5, radius: 0.4, height: 2.9, poise: 'med', ...o }, 'enderman'); this.provoked = false; this.stare = 0; this.cd = 1; this.wanderT = 0; }
  routeDamage(dmg, info) {
    if (!this.provoked) this.provoke();
    if (info.ranged && Math.random() < 0.55 && G.time - (this._tp || 0) > 0.6) {
      this._tp = G.time;
      const a = Math.random() * Math.PI * 2;
      this.teleTo(this.pos.x + Math.sin(a) * 5, this.pos.z + Math.cos(a) * 5);
      return null;
    }
    return { dmg, result: 'hit' };
  }
  provoke() {
    if (this.provoked) return;
    this.provoked = true;
    this.speed = RUN * 1.05;
    say(this, 'AAAAHHHHH', '#c77dff', 1.4);
    G.audio.sfx('screech', { pan: pan(this) });
    G.cam.shake(0.25, this.pos.x, this.pos.z);
    this.readyAt = G.time + 0.5;
  }
  think(dt) {
    this.pose = null;
    if (!this.provoked) {
      // neutral: wanders until Alex stares at it
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 2; this.wander = Math.random() * Math.PI * 2; }
      this.steer(dt, Math.sin(this.wander), Math.cos(this.wander), RUN * 0.2);
      this.yaw = dampAngle(this.yaw, this.wander, 3, dt);
      const c = G.targeting.cands.find((x) => x.enemy === this);
      if (c && c.vis && c.ang < 9 && c.dist < 20) { this.stare += dt; if (this.stare > 0.45) this.provoke(); } else this.stare = Math.max(0, this.stare - dt);
      this.threatTarget = false;
      return;
    }
    this.threatTarget = true;
    const d = this.seek(dt, this.speed);
    this.cd -= dt;
    if (d > 7 && this.cd <= 0) {
      this.cd = 2.5;
      const [fx, fz] = G.cam.forward();
      this.teleTo(G.alex.pos.x - fx * 2.4 + (Math.random() - 0.5) * 2, G.alex.pos.z - fz * 2.4 + (Math.random() - 0.5) * 2);
      this.faceTarget(1, 30);
      return;
    }
    if (d < 2.3) {
      const self = this;
      const punch = (dmg) => ({ t: 0.18, start() { self.pose = 'punch'; self.hitAlexMelee(2.3, 100, dmg, 6); G.audio.sfx('hitHeavy', { v: 0.35, pan: pan(self) }); } });
      this.act([this.tele(0.4, '#c77dff'), punch(12), { t: 0.25, update(dt) { self.stop(dt); } }, this.tele(0.25, '#c77dff'), punch(14), { t: 0.6, update(dt) { self.stop(dt); }, end() { self.pose = null; } }]);
    }
  }
}

// =========================================================================== ONE PIECE
class Marine extends Cross {
  constructor(o) { super({ hp: 26, speed: RUN * 0.55, radius: 0.42, height: 1.85, poise: 'low', ...o }, 'marine'); this.cd = 1.2 + Math.random() * 1.5; }
  think(dt) {
    this.pose = null;
    const d = this.kite(dt, 7, 14, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    const self = this;
    if (d < 2.6) {
      this.cd = 1.8;
      this.act([this.tele(0.45, '#60a5fa'), { t: 0.2, start() { G.fx.slash(self.pos.x, self.pos.y + 1, self.pos.z, self.yaw, { r: 2.2, arc: 2, color: '#e0f2fe', life: 0.15 }); self.hitAlexMelee(2.3, 120, 10, 4); G.audio.sfx('slash', { v: 0.4, pan: pan(self) }); } }, { t: 0.4, update(dt) { self.stop(dt); } }]);
    } else if (this.losCached() && d < 22) {
      this.cd = 2.8 + Math.random();
      const delay = 1.0 / this.atkK() * this.telK();
      let x2, z2;
      this.act([
        { t: delay, start() {
          self.pose = 'aim';
          say(self, G.run.rng.pick(['READY… AIM…', 'FOR JUSTICE!', 'HALT, PIRATE!']), '#bfdbfe', 1);
          const v = self.aimAt(1, 0.8);
          x2 = self.pos.x + Math.sin(v.yaw) * 18; z2 = self.pos.z + Math.cos(v.yaw) * 18;
          self.yaw = v.yaw;
          self.threatDur = delay; G.hud.threatStart(self);
          G.areas.lane({ x1: self.pos.x + Math.sin(v.yaw) * 0.6, z1: self.pos.z + Math.cos(v.yaw) * 0.6, x2, z2, width: 0.85, delay, dmg: 11, owner: self, ff: true, enemyDmg: 12, color: '#60a5fa', sound: 'heavyShot', pillar: 1.6, height: 2.4 });
        }, update(dt, k) { self.threatT = delay * (1 - k); self.stop(dt); } },
        { t: 0.35, start() { self.pose = 'fire'; G.fx.burst(self.pos.x + Math.sin(self.yaw) * 0.9, self.pos.y + 1.3, self.pos.z + Math.cos(self.yaw) * 0.9, { n: 6, color: ['#fde68a', '#ffffff'], speed: 4, life: 0.2 }); }, update(dt) { self.stop(dt); } },
      ]);
    }
  }
}

class Fishman extends Cross {
  constructor(o) { super({ hp: 52, speed: RUN * 0.62, radius: 0.55, height: 2.2, poise: 'med', ...o }, 'fishman'); this.cd = 1.2; }
  think(dt) {
    this.pose = null;
    const d = this.kite(dt, 3, 9, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    const self = this;
    if (d < 4.6) {
      this.cd = 2.6;
      const delay = 0.6 / this.atkK() * this.telK();
      this.act([
        { t: delay, start() { self.pose = 'palm'; say(self, 'FISH-MAN KARATE!', '#7dd3fc', 1); G.areas.cone({ x: self.pos.x, z: self.pos.z, yaw: self.yaw, range: 3.8, angle: 1.2, delay, dmg: 16, knock: 13, owner: self, color: '#38bdf8', fxColor: ['#38bdf8', '#ffffff'], sound: 'slam', shake: 0.25, follow: () => ({ x: self.pos.x, z: self.pos.z, yaw: self.yaw }) }); self.threatDur = delay; G.hud.threatStart(self); },
          update(dt, k) { self.threatT = delay * (1 - k); self.faceTarget(dt, 6); self.stop(dt); } },
        { t: 0.2, start() { G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 1, r1: 5, speed: 10, width: 0.5, height: 0.6, dmg: 8, owner: self, color: '#38bdf8' }); } },
        { t: 0.5, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    } else if (this.losCached()) {
      this.cd = 2.2;
      this.act([
        { ...this.tele(0.5, '#7dd3fc'), update(dt, k) { self.threatT = 0.5 * (1 - k); self.pose = 'flick'; self.faceTarget(dt, 10); self.stop(dt); } },
        { t: 0.3, start() { self.pose = 'flick'; G.projectiles.fan({ owner: self, x: self.pos.x, y: self.pos.y + 1.4, z: self.pos.z, kind: 'orb', r: 0.17, dmg: 6, color: '#bae6fd', life: 2, tag: 'water' }, 5, 0.7, self.yaw, 20); G.audio.sfx('splash', { pan: pan(self) }); }, update(dt) { self.stop(dt); } },
      ]);
    }
  }
}

class Pacifista extends Cross {
  constructor(o) { super({ hp: 120, speed: RUN * 0.32, radius: 0.85, height: 3.2, poise: 'high', heavy: true, ...o }, 'pacifista'); this.cd = 1.6; this.greeted = false; }
  think(dt) {
    this.pose = null;
    if (!this.greeted) { this.greeted = true; say(this, 'TARGET: ALEX. BOUNTY: ฿30,000,000', '#fde047', 2); }
    const d = this.kite(dt, 5, 14, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    const self = this;
    if (d < 8 && Math.random() < 0.5) {
      this.cd = 2.6;
      const delay = 0.8 / this.atkK() * this.telK();
      this.act([{ t: delay + 0.3, start() {
        self.pose = 'palm';
        const v = self.aimAt(1);
        self.yaw = v.yaw;
        G.areas.lane({ x1: self.pos.x, z1: self.pos.z, x2: self.pos.x + Math.sin(v.yaw) * 11, z2: self.pos.z + Math.cos(v.yaw) * 11, width: 1.3, delay, dmg: 18, owner: self, ff: true, enemyDmg: 20, color: '#fde047', sound: 'charge', pillar: 2.5 });
        self.threatDur = delay; G.hud.threatStart(self);
      }, update(dt, k) { self.threatT = Math.max(0, delay - k * (delay + 0.3)); self.stop(dt); } }]);
    } else if (this.losCached()) {
      this.cd = 4.2;
      const delay = 1.0 / this.atkK() * this.telK();
      this.act([
        { t: delay + 1.8, start() {
          self.pose = 'laser';
          G.audio.sfx('charge', { v: 0.6, pan: pan(self) });
          const yaw = self.yawTo() - 0.55 * Math.sign(Math.random() - 0.5);
          G.areas.beam({ x: self.pos.x, z: self.pos.z, yaw, yawSpeed: (self.yawTo() - yaw) * 1.2, length: 17, width: 0.7, height: 1.1, delay, duration: 1.8, dmg: 14, owner: self, color: '#fde047' });
          self.threatDur = delay; G.hud.threatStart(self);
        }, update(dt, k) { self.threatT = Math.max(0, delay - k * (delay + 1.8)); self.stop(dt); }, end() { self.pose = null; } },
      ]);
    }
  }
}

class SeaKing extends Cross {
  constructor(o) {
    super({ hp: 160, speed: RUN * 0.55, radius: 1.1, height: 5.2, poise: 'high', heavy: true, flying: true, ...o }, 'seaKing');
    this.surfaceK = 0; this.state = 'under'; this.stT = 1.5; this.unstaggerable = true;
  }
  targetable() { return this.alive && this.surfaceK > 0.6 && this.spawnT > 0.4; }
  aimPoint(out) { return out.set(this.pos.x, this.pos.y + 3.2 * this.surfaceK, this.pos.z); }
  hitTest(x, y, z, r) {
    if (!this.targetable()) return null;
    if (y > this.pos.y + 5.2 * this.surfaceK + r) return null;
    return Math.hypot(x - this.pos.x, z - this.pos.z) < this.radius + r ? 'body' : null;
  }
  _physics(dt) {
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const hw = G.room.L.w / 2 - 1.5, hd = G.room.L.d / 2 - 1.5;
    this.pos.x = clamp(this.pos.x, -hw, hw); this.pos.z = clamp(this.pos.z, -hd, hd);
    this.pos.y = 0;
  }
  update(dt) {
    if (!this.alive) return;
    if (this.spawnT < 1) { this.spawnT = 1; if (this.spawnPortal) { this.group.remove(this.spawnPortal); this.spawnPortal = null; } if (this.model) this.model.group.position.y = 0; }
    super.update(dt);
  }
  think(dt) {
    const self = this;
    this.stT -= dt;
    if (this.state === 'under') {
      this.intangible = true;
      this.surfaceK = Math.max(0, this.surfaceK - dt * 3);
      const a = G.alex, dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z, l = Math.hypot(dx, dz) || 1;
      this.steer(dt, dx / l, dz / l, l > 3 ? this.speed : 0);
      if (this.stT <= 0) {
        this.state = 'rising';
        const delay = 1.1 / this.atkK() * this.telK();
        this.stT = delay;
        this.threatDur = delay; G.hud.threatStart(this);
        const p = { x: a.pos.x, z: a.pos.z };
        G.areas.circle({ x: p.x, z: p.z, r: 2.3, delay, follow: () => { p.x += (G.alex.pos.x - p.x) * 0.06; p.z += (G.alex.pos.z - p.z) * 0.06; return p; }, lockAt: 0.35, dmg: 22, knock: 11, owner: self, color: '#38bdf8', fxColor: '#38bdf8', sound: 'slam', shake: 0.45,
          onFire: () => { self.pos.x = p.x; self.pos.z = p.z; self.state = 'up'; self.stT = 3.2; self.bites = 2; G.fx.burst(p.x, 0.5, p.z, { n: 40, color: ['#38bdf8', '#e0f2fe', '#ffffff'], speed: 9, up: 2, life: 0.8 }); say(self, 'ROOOAAAR', '#38bdf8', 1); } });
        G.audio.sfx('rope', { v: 0.6 });
      }
      this.threatT = 0;
      return;
    }
    if (this.state === 'rising') { this.stop(dt); this.threatT = Math.max(0, this.stT); return; }
    if (this.state === 'up') {
      this.intangible = false;
      this.surfaceK = Math.min(1, this.surfaceK + dt * 4);
      this.stop(dt);
      this.faceTarget(dt, 3);
      if (this.bites > 0 && this.stT < 2.6 && !this.seq && this.distTo() < 6) {
        this.bites--;
        const delay = 0.6 / this.atkK() * this.telK();
        this.act([{ t: delay + 0.3, start() {
          self.pose = 'bite';
          G.areas.cone({ x: self.pos.x, z: self.pos.z, yaw: self.yawTo(), range: 5, angle: 1.0, delay, dmg: 20, knock: 9, owner: self, color: '#38bdf8', sound: 'hitHeavy' });
          self.threatDur = delay; G.hud.threatStart(self);
        }, update(dt, k) { self.threatT = Math.max(0, delay * (1 - k * 1.5)); }, end() { self.pose = null; } }]);
      }
      if (this.stT <= 0) { this.state = 'under'; this.stT = 2.2 + Math.random(); say(this, '*splash*', '#38bdf8', 0.8); }
    }
  }
}

// ============================================================================ POKÉMON
class Pikachew extends Cross {
  constructor(o) { super({ hp: 22, speed: RUN * 1.0, radius: 0.35, height: 1.05, poise: 'low', ...o }, 'pikachew'); this.cd = 1 + Math.random(); }
  think(dt) {
    this.pose = null;
    const d = this.kite(dt, 4, 9, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    const self = this;
    if (Math.random() < 0.6 && this.losCached()) {
      this.cd = 3;
      const delay = 0.9 / this.atkK() * this.telK();
      say(this, 'PIKA…', '#fde047', 0.9);
      this.act([
        { t: delay, start() {
          self.pose = 'zap'; self.threatDur = delay; G.hud.threatStart(self);
          const a = G.alex;
          for (let i = 0; i < 3; i++) {
            const ang = Math.random() * Math.PI * 2, rr = i === 0 ? 0 : 1.6 + Math.random() * 1.2;
            G.areas.circle({ x: a.pos.x + Math.sin(ang) * rr, z: a.pos.z + Math.cos(ang) * rr, r: 1.3, delay: delay + i * 0.12, dmg: 12, owner: self, color: '#fde047', style: 'flash', sound: 'zap', shake: 0.15,
              onFire: (s) => G.fx.burst(s.o.x, 3, s.o.z, { n: 14, color: ['#fde047', '#ffffff'], speed: 2, up: -6, life: 0.3, size: 0.25 }) });
          }
        }, update(dt, k) { self.threatT = delay * (1 - k); self.stop(dt); } },
        { t: 0.4, start() { say(self, 'CHEW!!', '#fde047', 0.8); }, update(dt) { self.stop(dt); } },
      ]);
    } else if (d < 9) {
      this.cd = 2;
      let dir = 0, hit = false;
      this.act([
        this.tele(0.35, '#fde047'),
        { t: 0.32, start() { dir = self.yawTo(); G.audio.sfx('dash', { v: 0.4, pan: pan(self) }); }, update() { self.vel.x = Math.sin(dir) * 17; self.vel.z = Math.cos(dir) * 17; if (!hit && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < 0.9) { hit = true; G.alex.hurt(8, { source: self, kind: 'melee', dir: [Math.sin(dir), Math.cos(dir)], knock: 6 }); } if (Math.random() < 0.5) G.fx.ghost(self.model.group, '#fde047', 0.15, 0.4); } },
        { t: 0.4, update(dt) { self.stop(dt, 6); } },
      ]);
    }
  }
}

class Gastlee extends Cross {
  constructor(o) { super({ hp: 22, speed: RUN * 0.7, radius: 0.5, height: 1.8, poise: 'low', flying: true, ...o }, 'gastlee'); this.hover = 0; this.cd = 1.2; this.phaseT = 2 + Math.random() * 2; }
  think(dt) {
    this.pose = null;
    this.phaseT -= dt;
    if (this.phaseT <= 0) {
      if (this.intangible) { this.intangible = false; this.phaseT = 3 + Math.random() * 2; } else { this.intangible = true; this.phaseT = 1.3; say(this, '♪ hehehe', '#c084fc', 0.8); }
    }
    const d = this.kite(dt, 3, 8, this.speed);
    this.cd -= dt;
    if (this.cd > 0 || this.intangible) return;
    const self = this;
    if (d < 6 && Math.random() < 0.5) {
      this.cd = 2.6;
      let dir = 0, hit = false;
      this.act([
        this.tele(0.45, '#c084fc'),
        { t: 0.4, start() { dir = self.yawTo(); say(self, 'LICK!', '#f472b6', 0.6); }, update() { self.vel.x = Math.sin(dir) * 14; self.vel.z = Math.cos(dir) * 14; if (!hit && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < 1) { hit = true; G.alex.hurt(7, { source: self, kind: 'melee', dir: [Math.sin(dir), Math.cos(dir)], knock: 2 }); } } },
        { t: 0.4, update(dt) { self.stop(dt, 5); } },
      ]);
    } else {
      this.cd = 2.8;
      this.act([
        { ...this.tele(0.6, '#c084fc'), update(dt, k) { self.threatT = 0.6 * (1 - k); self.stop(dt); } },
        { t: 0.3, start() { G.projectiles.ring({ owner: self, x: self.pos.x, y: self.pos.y + 1.2, z: self.pos.z, kind: 'orb', r: 0.22, dmg: 7, color: '#d8b4fe', life: 2.4 }, 8, 9, Math.random()); G.audio.sfx('spawn', { v: 0.4, pan: pan(self) }); } },
      ]);
    }
  }
}

class Magikrap extends Cross {
  constructor(o) { super({ hp: 15, speed: RUN * 0.4, radius: 0.4, height: 0.9, poise: 'low', ...o }, 'magikrap'); this.hopT = 0.5; this.hopK = 0; this.life = 0; this.evolveAt = 12 + Math.random() * 2; this.threatTarget = false; }
  think(dt) {
    this.life += dt;
    this.hopT -= dt;
    if (this.hopT <= 0) { this.hopT = 0.6 + Math.random() * 0.6; this.hop = 0.35; const a = Math.random() * Math.PI * 2; this.vel.x = Math.sin(a) * 3; this.vel.z = Math.cos(a) * 3; if (Math.random() < 0.18) say(this, 'MAGIKRAP used SPLASH! …But nothing happened.', '#fdba74', 1.8); }
    if (this.hop > 0) { this.hop -= dt; this.hopK = Math.sin((1 - this.hop / 0.35) * Math.PI) * 0.4; } else { this.hopK = 0; this.stop(dt, 8); }
    if (this.life > this.evolveAt - 3 && !this.glowSaid) { this.glowSaid = true; say(this, 'MAGIKRAP is glowing…?', '#ffffff', 2.5); }
    if (this.life > this.evolveAt - 3) this.setEmissive('#ffffff', 0.4 + 0.4 * Math.sin(this.life * 14));
    if (this.life > this.evolveAt) this.evolve();
  }
  evolve() {
    const x = this.pos.x, z = this.pos.z;
    G.hud.popup('What? MAGIKRAP is evolving!', '#ffffff', 2);
    G.fx.flash(0.4, '#ffffff');
    G.fx.burst(x, 1, z, { n: 40, color: ['#ffffff', '#60a5fa', '#fde68a'], speed: 8, life: 0.8 });
    G.audio.sfx('perfect');
    this.noDrop = true;
    this.die({ source: 'evolve' });
    const g = G.room.spawnEnemy('gyarados', x, z, { readyDelay: 1.2, noSpawnAnim: true, franchise: 'pokemon' });
    if (g) { say(g, 'GYARA-DOS!!', '#60a5fa', 1.6); G.room.waveMembers?.push(g); }
  }
}

class Gyarados extends Cross {
  constructor(o) { super({ hp: 150, speed: RUN * 0.45, radius: 1.0, height: 5, poise: 'high', heavy: true, flying: true, ...o }, 'gyarados'); this.hover = 0.3; this.cd = 1.5; }
  dmgTakenK() { return this.pose === 'recharge' ? 1.5 : 1; }
  think(dt) {
    this.pose = null;
    const d = this.kite(dt, 6, 14, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    const self = this;
    if (d < 3.6) {
      this.cd = 2.5;
      this.act([{ ...this.tele(0.6, '#60a5fa'), start() { say(self, 'THRASH!', '#60a5fa', 0.8); G.areas.circle({ x: self.pos.x, z: self.pos.z, r: 3.4, delay: 0.6 / self.atkK() * self.telK(), dmg: 16, owner: self, color: '#60a5fa', sound: 'slam' }); } }, { t: 0.5, update(dt) { self.stop(dt); } }]);
    } else if (Math.random() < 0.5) {
      this.cd = 5.5;
      const delay = 1.3 / this.atkK() * this.telK();
      this.act([
        { t: delay + 1.2, start() {
          self.pose = 'charge'; say(self, 'GYARA-DOS used HYPER BEAM!', '#fbbf24', 1.6);
          G.areas.beam({ x: self.pos.x, z: self.pos.z, yaw: self.yawTo(), yawSpeed: 0.25 * Math.sign(Math.random() - 0.5), length: 22, width: 1.1, height: 1.0, delay, duration: 1.2, dmg: 22, owner: self, color: '#fbbf24' });
          self.threatDur = delay; G.hud.threatStart(self);
        }, update(dt, k) { self.pose = k * (delay + 1.2) > delay ? 'beam' : 'charge'; self.threatT = Math.max(0, delay - k * (delay + 1.2)); self.stop(dt); } },
        { t: 2, start() { self.pose = 'recharge'; say(self, 'GYARA-DOS must recharge!', '#ffffff', 1.6); }, update(dt) { self.pose = 'recharge'; self.stop(dt); }, end() { self.pose = null; } },
      ]);
    } else {
      this.cd = 3.2;
      this.act([
        { ...this.tele(0.7, '#60a5fa'), start() { say(self, 'DRAGON RAGE!', '#60a5fa', 0.9); } },
        { t: 0.6, start() { G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 1.2, r1: 11, speed: 7, width: 0.6, height: 0.8, dmg: 12, owner: self, color: '#60a5fa' }); }, update(dt) { self.stop(dt); } },
        { t: 0.7, start() { G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 1.2, r1: 11, speed: 7, width: 0.6, height: 0.8, dmg: 12, owner: self, color: '#60a5fa' }); }, update(dt) { self.stop(dt); } },
      ]);
    }
  }
}

class Snorelax extends Cross {
  constructor(o) { super({ hp: 110, speed: RUN * 0.3, radius: 1.2, height: 2.8, poise: 'high', heavy: true, ...o }, 'snorelax'); this.asleep = true; this.sleepDmg = 0; this.zzzT = 0; this.attacks = 0; this.cd = 1.2; this.threatTarget = false; }
  dmgTakenK() { return this.asleep ? 0.5 : 1; }
  onHurt(dmg) { if (this.asleep) { this.sleepDmg += dmg; if (this.sleepDmg > 25) this.wake(); } }
  wake() { if (!this.asleep) return; this.asleep = false; this.threatTarget = true; this.sleepDmg = 0; say(this, 'SNORELAX woke up!', '#fef3c7', 1.4); G.audio.sfx('roar', { v: 0.5, pan: pan(this) }); this.readyAt = G.time + 0.6; }
  think(dt) {
    this.pose = null;
    if (this.asleep) {
      this.stop(dt);
      this.zzzT -= dt;
      if (this.zzzT <= 0) { this.zzzT = 1.6; say(this, 'Z z z', '#bae6fd', 1.2); }
      if (G.time - G.room.enteredAt > 9 && !this.restUntil) this.wake();
      if (this.restUntil && G.time > this.restUntil) { this.restUntil = 0; this.wake(); }
      return;
    }
    this.seek(dt, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    const self = this;
    if (this.attacks >= 3) {
      this.attacks = 0;
      this.asleep = true; this.threatTarget = false;
      this.restUntil = G.time + 4;
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
      say(this, 'SNORELAX used REST! (it\'s sleeping again)', '#bae6fd', 1.8);
      G.fx.hearts(this.pos.x, this.pos.y + 2.5, this.pos.z, 6, '#3cff8f');
      return;
    }
    this.attacks++;
    this.cd = 2.2;
    const delay = 1.0 / this.atkK() * this.telK();
    const tx = G.alex.pos.x, tz = G.alex.pos.z;
    this.act([
      { t: 0.35, start() { self.pose = 'slam'; say(self, 'SNORELAX used BODY SLAM!', '#fef3c7', 1.2); }, update(dt) { self.stop(dt); self.faceTarget(dt, 6); } },
      { t: delay, start() {
        self.pose = 'slam';
        self.threatDur = delay; G.hud.threatStart(self);
        G.areas.circle({ x: tx, z: tz, r: 2.8, delay, dmg: 22, knock: 12, owner: self, color: '#fef3c7', fxColor: '#fef3c7', sound: 'slam', shake: 0.5, ff: true, enemyDmg: 25, onFire: () => G.areas.ring({ x: tx, z: tz, r0: 2.8, r1: 8, speed: 9, width: 0.6, height: 0.6, dmg: 10, owner: self, color: '#fef3c7' }) });
        self.vel.y = 13; self.airborne = false;
        self.slamV = [(tx - self.pos.x) / delay, (tz - self.pos.z) / delay];
      }, update(dt, k) { self.threatT = delay * (1 - k); self.vel.x = self.slamV[0]; self.vel.z = self.slamV[1]; } },
      { t: 0.8, update(dt) { self.stop(dt, 10); }, end() { self.pose = null; } },
    ]);
  }
}

// =========================================================================== THE BIBLE
class Frog extends Cross {
  constructor(o) { super({ hp: 10, speed: RUN * 0.6, radius: 0.3, height: 0.55, poise: 'low', ...o }, 'frog'); this.hopT = Math.random() * 0.6; this.hopK = 0; this.cd = 1 + Math.random(); }
  think(dt) {
    this.pose = null;
    this.hopT -= dt;
    const d = this.distTo();
    if (this.hopT <= 0) {
      this.hopT = 0.6 + Math.random() * 0.4; this.hop = 0.4;
      const ang = this.yawTo() + (Math.random() - 0.5) * 1.2;
      const sp = d > 3 ? 7 : -2;
      this.vel.x = Math.sin(ang) * sp; this.vel.z = Math.cos(ang) * sp; this.yaw = ang;
      if (Math.random() < 0.1) say(this, 'ribbit', '#a3e635', 0.7);
    }
    if (this.hop > 0) { this.hop -= dt; this.hopK = Math.sin((1 - this.hop / 0.4) * Math.PI) * 0.5; } else { this.hopK = 0; this.stop(dt, 8); }
    this.cd -= dt;
    if (this.cd <= 0 && d < 3.4 && this.hop <= 0) {
      this.cd = 2 + Math.random();
      const self = this;
      const v = this.aimAt(1);
      this.yaw = v.yaw;
      this.act([
        { t: 0.35, start() { G.areas.lane({ x1: self.pos.x, z1: self.pos.z, x2: self.pos.x + Math.sin(v.yaw) * 3.6, z2: self.pos.z + Math.cos(v.yaw) * 3.6, width: 0.45, delay: 0.35 / self.atkK() * self.telK(), dmg: 6, knock: 2, owner: self, color: '#f43f5e', pillar: 0.6, sound: 'pjump' }); }, update(dt) { self.stop(dt); } },
        { t: 0.25, start() { self.pose = 'tongue'; }, update(dt, k) { self.tongueK = 0.4 + Math.sin(k * Math.PI) * 3; }, end() { self.pose = null; self.tongueK = 1; } },
      ]);
    }
  }
}

class Locust extends Cross {
  constructor(o) { super({ hp: 18, speed: RUN * 0.72, radius: 0.9, height: 2.0, poise: 'low', flying: true, ...o }, 'locust'); this.hover = 0; this.biteT = 0; }
  dmgTakenK(info) { return info.area || info.fire || info.burn ? 2 : info.melee ? 0.85 : 1; }
  think(dt) {
    this.pose = null;
    const d = this.seek(dt, this.speed);
    this.biteT -= dt;
    if (d < this.radius + 0.5 && this.biteT <= 0 && Math.abs(G.alex.pos.y - this.pos.y) < 2.2) {
      this.biteT = 0.5;
      this.pose = 'dive';
      G.alex.hurt(4, { source: this, kind: 'area', dir: [G.alex.pos.x - this.pos.x, G.alex.pos.z - this.pos.z], knock: 0.6 });
    }
  }
}

class Charioteer extends Cross {
  constructor(o) { super({ hp: 60, speed: RUN * 0.6, radius: 1.0, height: 2.4, poise: 'med', heavy: true, ...o }, 'charioteer'); this.cd = 1.5; this.shotCd = 1.2; }
  think(dt) {
    this.pose = null;
    const d = this.kite(dt, 6, 13, this.speed);
    this.cd -= dt; this.shotCd -= dt;
    const self = this;
    if (this.cd <= 0) {
      this.cd = 4.2;
      const v = this.aimAt(1);
      const len = 20;
      const delay = 1.0 / this.atkK() * this.telK();
      let hit = false, traveled = 0;
      this.act([
        { t: delay, start() {
          self.yaw = v.yaw; say(self, 'CHAAARGE!', '#fbbf24', 1);
          G.areas.lane({ x1: self.pos.x, z1: self.pos.z, x2: self.pos.x + Math.sin(v.yaw) * len, z2: self.pos.z + Math.cos(v.yaw) * len, width: 2.0, delay, dmg: 0, owner: self, color: '#fbbf24', pillar: 0.1, sound: 'charge' });
          self.threatDur = delay; G.hud.threatStart(self);
        }, update(dt, k) { self.threatT = delay * (1 - k); self.stop(dt); } },
        { t: 1.6, start() { self.hitWall = null; G.audio.sfx('charge', { pan: pan(self) }); }, update(dt) {
          self.vel.x = Math.sin(v.yaw) * 15; self.vel.z = Math.cos(v.yaw) * 15;
          traveled += 15 * dt;
          if (!hit && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < self.radius + 0.6) { hit = true; G.alex.hurt(18, { source: self, kind: 'melee', dir: [Math.sin(v.yaw), Math.cos(v.yaw)], knock: 11 }); }
          for (const e of G.room.enemies) if (e !== self && e.alive && !e.heavy && Math.hypot(e.pos.x - self.pos.x, e.pos.z - self.pos.z) < self.radius + e.radius) e.hurt(10, { source: self, dir: [Math.sin(v.yaw), Math.cos(v.yaw)], knock: 8, friendly: true });
          if (Math.random() < 0.6) G.fx.burst(self.pos.x, 0.2, self.pos.z, { n: 1, kind: 'smoke', color: '#d6b98c', speed: 1, up: 0.3, life: 0.5, size: 0.6, grav: 0 });
          if ((self.hitWall && traveled > 1.5) || traveled > len) self.seq.t = 99;
        } },
        { t: 0.6, update(dt) { self.stop(dt, 5); } },
      ]);
    } else if (this.shotCd <= 0 && d < 20 && this.losCached()) {
      this.shotCd = 1.6;
      this.act([
        { ...this.tele(0.5, '#fbbf24'), update(dt, k) { self.threatT = 0.5 * (1 - k); self.pose = 'shoot'; self.faceTarget(dt, 6); self.stop(dt); } },
        { t: 0.2, start() { const a = self.aimAt(24, 1); self.shoot({ kind: 'arrow', vx: a.vx, vz: a.vz, r: 0.13, dmg: 8, color: '#fde68a', life: 1.6 }); } },
      ]);
    }
  }
}

class GoldenCalf extends Cross {
  constructor(o) { super({ hp: 70, speed: 0, radius: 0.95, height: 1.9, poise: 'high', heavy: true, ...o }, 'goldenCalf'); this.buffT = 1; this.cd = 2.5; this.unstaggerable = true; }
  think(dt) {
    this.stop(dt, 20);
    this.pose = null;
    this.buffT -= dt;
    if (this.buffT <= 0) {
      this.buffT = 3;
      let n = 0;
      for (const e of G.room.enemies) if (e !== this && e.alive && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 10) { e.buff = { until: G.time + 3.5 }; n++; G.fx.burst(e.pos.x, e.pos.y + e.height, e.pos.z, { n: 4, color: '#fbbf24', speed: 1.5, up: 2, life: 0.5, size: 0.15, grav: -2 }); }
      if (n) say(this, G.run.rng.pick(['WORSHIP ME', 'BOW DOWN', 'MOOO (divinely)']), '#fbbf24', 1);
    }
    this.cd -= dt;
    if (this.cd <= 0) {
      this.cd = 3.6;
      const self = this;
      this.act([
        { ...this.tele(0.7, '#fbbf24'), update(dt, k) { self.threatT = 0.7 * (1 - k); self.pose = 'spin'; } },
        { t: 0.6, start() { self.pose = 'spin'; G.projectiles.ring({ owner: self, x: self.pos.x, y: self.pos.y + 1.1, z: self.pos.z, kind: 'cd', r: 0.24, dmg: 6, color: '#fde047', life: 3 }, 10, 8, Math.random()); G.audio.sfx('coin', { pan: pan(self) }); }, end() { self.pose = null; } },
      ]);
    }
  }
  onDeath() {
    G.room.dropMoney(this.pos.x, this.pos.z, 18 + Math.floor(Math.random() * 18));
    say({ pos: this.pos.clone(), height: 2, alive: true }, 'THOU SHALT NOT… (it broke)', '#fbbf24', 1.6);
  }
}

class Goliath extends Cross {
  constructor(o) { super({ hp: 220, speed: RUN * 0.4, radius: 1.0, height: 4.3, poise: 'high', heavy: true, ...o }, 'goliath'); this.cd = 1.5; this.taunted = false; this.showWeakSpot = true; this.poiseMax = 70; }
  hitTest(x, y, z, r) {
    const p = super.hitTest(x, y, z, r);
    if (p && y > this.pos.y + this.height * 0.82) return 'head';
    return p;
  }
  routeDamage(dmg, info) {
    let k = 1;
    if (info.part === 'head') k *= 2.5;
    if (info.weapon === 'davidSling') k *= 5;
    if (k > 1 && G.time - (this._hs || 0) > 1) { this._hs = G.time; say(this, info.weapon === 'davidSling' ? 'A STONE?! (1 Samuel 17:49)' : 'HEADSHOT', '#ffe08a', 1.2); }
    return { dmg: dmg * k, result: k > 1 ? 'hit' : 'hit' };
  }
  think(dt) {
    this.pose = null;
    const self = this;
    if (!this.taunted) { this.taunted = true; say(this, 'Am I a dog, that thou comest to me with staves?', '#fde68a', 2.6); this.act([{ t: 1, start() { self.pose = 'taunt'; }, update(dt) { self.stop(dt); } }]); return; }
    const d = this.seek(dt, this.speed);
    this.cd -= dt;
    if (this.cd > 0) return;
    if (d < 3.6 && Math.random() < 0.5) {
      this.cd = 2.6;
      const delay = 0.9 / this.atkK() * this.telK();
      this.act([
        { t: delay, start() { self.pose = 'wind'; G.areas.circle({ x: self.pos.x, z: self.pos.z, r: 3.4, delay, dmg: 18, knock: 10, owner: self, color: '#f59e0b', sound: 'slam', shake: 0.5, onFire: () => G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 3.4, r1: 9, speed: 8, width: 0.6, height: 0.6, dmg: 9, owner: self, color: '#f59e0b' }) }); self.threatDur = delay; G.hud.threatStart(self); },
          update(dt, k) { self.threatT = delay * (1 - k); self.stop(dt); } },
        { t: 0.6, update(dt) { self.stop(dt); } },
      ]);
    } else {
      this.cd = 2.4;
      const delay = 0.85 / this.atkK() * this.telK();
      const v = this.aimAt(1);
      this.act([
        { t: delay, start() {
          self.pose = 'wind'; self.yaw = v.yaw;
          G.areas.lane({ x1: self.pos.x, z1: self.pos.z, x2: self.pos.x + Math.sin(v.yaw) * 8, z2: self.pos.z + Math.cos(v.yaw) * 8, width: 1.2, delay, dmg: 20, knock: 9, owner: self, ff: true, enemyDmg: 25, color: '#f59e0b', sound: 'hitHeavy', pillar: 1.5, shake: 0.3 });
          self.threatDur = delay; G.hud.threatStart(self);
        }, update(dt, k) { self.threatT = delay * (1 - k); self.stop(dt); } },
        { t: 0.5, start() { self.pose = 'thrust'; }, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    }
  }
  onDeath() { G.hud.popup('THE GIANT FALLS', '#fde68a', 1.6); G.cam.shake(0.6, this.pos.x, this.pos.z); }
}

export const CROSS_CLASSES = {
  grunt: Grunt, jackal: Jackal, elite: Elite, hunter: Hunter,
  creeper: Creeper, zombie: Zombie, skeleton: Skeleton, enderman: Enderman,
  marine: Marine, fishman: Fishman, pacifista: Pacifista, seaKing: SeaKing,
  pikachew: Pikachew, gastlee: Gastlee, magikrap: Magikrap, gyarados: Gyarados, snorelax: Snorelax,
  frog: Frog, locust: Locust, charioteer: Charioteer, goldenCalf: GoldenCalf, goliath: Goliath,
};
