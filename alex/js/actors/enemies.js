// The fifteen demons of the venue (plus Fanwar's Solo Stans and Delulu's dancers).
// Stats and behaviour follow the design document's tables.

import * as THREE from 'three';
import { G } from '../state.js';
import { Enemy } from './enemy.js';
import { MODELS } from './enemyModels.js';
import { ENEMY_INFO } from '../world/encounters.js';
import { wrapAngle, clamp, dampAngle } from '../core/math.js';
import { MOVE } from '../config.js';

const RUN = MOVE.runSpeed;
const tmp = new THREE.Vector3();
const say = (e, text, color = '#ffffff', dur = 1.2) => G.hud.bubble(e, text, color, dur);

// ---------------------------------------------------------------------------
// FLOOR 1
// ---------------------------------------------------------------------------
class Lurker extends Enemy {
  constructor(o) { super({ hp: 30, speed: RUN * 0.9, radius: 0.45, height: 1.75, poise: 'low', ...o }); this.setModel(MODELS.lurker()); }
  think(dt) {
    // full speed until striking distance, then commit to the string
    const d = this.seek(dt, this.distTo() < 3 ? this.speed * 0.7 : this.speed);
    if (d < 2.8 && Math.abs(this.target().pos.y - this.pos.y) < 1.5) this.string();
  }
  swing(dmg) {
    const self = this;
    return [
      { ...this.tele(0.55), update(dt, k) { self.threatT = 0.55 * (1 - k); self.pose = 'wind'; self.faceTarget(dt, 6); self.stop(dt); self.setEmissive('#ff2e7e', 0.3 + 0.5 * k); } },
      { t: 0.12, start() { self.pose = 'swing'; self.setEmissive('#000', 0); const [x, z] = [Math.sin(self.yaw), Math.cos(self.yaw)]; self.vel.x = x * 5; self.vel.z = z * 5; G.audio.sfx('slash', { v: 0.5, pan: G.cam.panOf(self.pos.x, self.pos.z) }); G.fx.slash(self.pos.x, self.pos.y + 1, self.pos.z, self.yaw, { r: 2.1, arc: 1.9, color: '#b388ff', life: 0.15 }); self.meleeOut(2.3, 110, dmg, 3); } },
      { t: 0.28, update(dt) { self.stop(dt, 8); } },
    ];
  }
  meleeOut(r, arc, dmg, knock) {
    const t = this.target();
    if (t === G.alex) this.hitAlexMelee(r, arc, dmg, knock); else this.hitEnemiesMelee(r, arc, dmg, knock);
  }
  string() {
    const self = this;
    this.act([
      ...this.swing(8),
      ...this.swing(8),
      { ...this.tele(0.9, '#ff9ccf'), update(dt, k) { self.threatT = 0.9 * (1 - k); self.pose = 'big'; self.faceTarget(dt, 5); self.stop(dt); self.setEmissive('#ff4fa3', 0.3 + 0.7 * Math.abs(Math.sin(k * 20))); } },
      { t: 0.15, start() {
        self.pose = 'swing'; self.setEmissive('#000', 0);
        self.meleeOut(2.4, 120, 12, 5);
        self.shoot({ kind: 'crescent', vx: Math.sin(self.yaw) * 11, vz: Math.cos(self.yaw) * 11, y: self.pos.y + 0.9, r: 0.6, dmg: 12, life: 1.1, spin: 0 });
        G.audio.sfx('spin', { v: 0.5, pan: G.cam.panOf(self.pos.x, self.pos.z) });
      } },
      { t: 0.7, start() { self.pose = 'rest'; }, update(dt) { self.stop(dt, 6); } },
    ]);
  }
}

class Photocard extends Enemy {
  constructor(o) {
    super({ hp: 25, speed: RUN * 0.7, radius: 0.45, height: 1.9, poise: 'low', ...o });
    this.setModel(MODELS.photocard());
    this.binderHp = 20; this.binderBroken = false; this.volleys = 0; this.cd = 1 + Math.random();
  }
  binderPos(out) { return out.set(this.pos.x + Math.sin(this.yaw) * 0.38, this.pos.y + 1.35, this.pos.z + Math.cos(this.yaw) * 0.38); }
  hitTest(x, y, z, r) {
    if (!this.targetable()) return null;
    if (!this.binderBroken) { const b = this.binderPos(tmp); if (Math.hypot(x - b.x, y - b.y, z - b.z) < 0.34 + r) return 'binder'; }
    return super.hitTest(x, y, z, r);
  }
  meleeTest(apos, ayaw, range, halfArc, full) {
    const p = super.meleeTest(apos, ayaw, range, halfArc, full);
    if (!p || this.binderBroken) return p;
    const b = this.binderPos(tmp);
    return Math.hypot(b.x - apos.x, b.z - apos.z) < Math.hypot(this.pos.x - apos.x, this.pos.z - apos.z) - 0.15 ? 'binder' : 'body';
  }
  routeDamage(dmg, info) {
    if (info.part === 'binder' && !this.binderBroken) {
      this.binderHp -= dmg;
      if (this.binderHp <= 0) {
        this.binderBroken = true;
        this.interrupt();
        say(this, 'MY PHOTOCARDS!!', '#ff9ccf', 1.6);
        G.audio.sfx('armor');
        const b = this.binderPos(tmp);
        G.fx.burst(b.x, b.y, b.z, { n: 16, kind: 'confetti', color: ['#ffffff', '#ffafcc', '#caf0f8'], speed: 6, up: 1, life: 1.2, size: 0.2 });
        this.speed = RUN * 0.8;
      }
      return { dmg: dmg * 0.35, result: 'hit' };
    }
    return { dmg, result: 'hit' };
  }
  dmgTakenK() { return this.pose === 'reload' ? 1.25 : 1; }
  think(dt) {
    this.pose = null;
    if (this.binderBroken) {
      // pathetic melee fodder
      const d = this.seek(dt, this.speed);
      if (d < 1.9) {
        const self = this;
        this.act([this.tele(0.6), { t: 0.1, start() { self.hitAlexMelee(1.9, 90, 5, 2); G.audio.sfx('hit', { v: 0.3 }); } }, this.wait(0.6)]);
      }
      return;
    }
    const d = this.kite(dt, 8, 12, this.speed);
    this.cd -= dt;
    if (this.cd <= 0 && d < 17 && this.losCached()) {
      const self = this;
      this.volleys++;
      this.cd = 1.3;
      const steps = [this.tele(0.5, '#ff9ccf'), { t: 0.1, start() {
        self.faceTarget(1, 100);
        G.projectiles.fan({ hostile: true, owner: self, kind: 'card', x: self.pos.x, y: self.pos.y + 1.35, z: self.pos.z, r: 0.28, dmg: 7, life: 3 }, 3, 0.36, self.yawTo(), 12);
        G.audio.sfx('shot', { v: 0.35, p: 1.4, pan: G.cam.panOf(self.pos.x, self.pos.z) });
      } }];
      if (this.volleys >= 3) {
        this.volleys = 0;
        steps.push({ t: 1.8, start() { self.pose = 'reload'; G.audio.sfx('screech', { v: 0.3, pan: G.cam.panOf(self.pos.x, self.pos.z) }); say(self, '*BINDER SCREAMING*', '#ffafcc', 1.5); }, update(dt) { self.pose = 'reload'; self.stop(dt); }, end() { self.pose = null; } });
      }
      this.act(steps);
    }
  }
}

class BiasBeast extends Enemy {
  constructor(o) { super({ hp: 45, speed: RUN * 0.55, radius: 0.7, height: 2.1, poise: 'med', ...o }); this.setModel(MODELS.biasBeast()); this.cd = 1.5 + Math.random(); }
  dmgTakenK() { return this.pose === 'dazed' ? 1.25 : 1; }
  think(dt) {
    this.pose = null;
    this.cd -= dt;
    const d = this.seek(dt, this.speed);
    if (this.cd <= 0 && d < 14 && d > 2.5 && this.losCached()) this.charge();
  }
  charge() {
    const self = this;
    let dir = 0, traveled = 0, hitAlex = false;
    this.act([
      { ...this.tele(0.9, '#ffd60a'), start() { self.pose = 'scream'; say(self, 'LOOK AT HIM!', '#ffd60a', 1.1); G.audio.sfx('shout', { pan: G.cam.panOf(self.pos.x, self.pos.z) }); G.hud.threatStart(self); self.threatDur = 0.9; },
        update(dt, k) { self.threatT = 0.9 * (1 - k); self.stop(dt); if (k < 0.8) self.faceTarget(dt, 8); self.setEmissive('#ffd60a', 0.3 + 0.6 * Math.abs(Math.sin(k * 25))); } },
      { t: 1.6, start() { self.pose = 'charge'; dir = self.yaw; self.setEmissive('#000', 0); self.hitWall = null; G.audio.sfx('charge', { pan: G.cam.panOf(self.pos.x, self.pos.z) }); },
        update(dt) {
          dir = dampAngle(dir, self.yawTo(), 0.6, dt); // minimal steering after launch
          self.yaw = dir;
          const sp = RUN * 1.75 * self.moveK();
          self.vel.x = Math.sin(dir) * sp; self.vel.z = Math.cos(dir) * sp;
          traveled += sp * dt;
          if (!hitAlex && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < self.radius + 0.55 && Math.abs(G.alex.pos.y - self.pos.y) < 1.5) {
            hitAlex = true;
            G.alex.hurt(18, { source: self, kind: 'melee', dir: [Math.sin(dir), Math.cos(dir)], knock: 11 });
          }
          if (Math.random() < 0.5) G.fx.burst(self.pos.x, self.pos.y + 0.1, self.pos.z, { n: 1, kind: 'smoke', color: '#bbb', speed: 1, up: 0.2, life: 0.4, size: 0.5, grav: 0 });
          if (self.hitWall && traveled > 1) {
            const b = self.hitWall.block;
            if (b && b.hp != null) G.room.damageBlock(b, 45);
            self.crash();
          } else if (traveled > 20) self.seq.t = 99;
        } },
      { t: 0.8, start() { self.pose = null; }, update(dt) { self.stop(dt, 4); } },
    ]);
    this.cd = 3.6;
  }
  crash() {
    const self = this;
    G.cam.shake(0.3, this.pos.x, this.pos.z);
    G.audio.sfx('slam', { v: 0.6, pan: G.cam.panOf(this.pos.x, this.pos.z) });
    G.fx.burst(this.pos.x + Math.sin(this.yaw) * 0.8, this.pos.y + 1.2, this.pos.z + Math.cos(this.yaw) * 0.8, { n: 16, color: ['#ffd60a', '#ffffff'], speed: 6, life: 0.4 });
    say(this, '@_@', '#ffd60a', 2);
    this.vel.x = -Math.sin(this.yaw) * 3; this.vel.z = -Math.cos(this.yaw) * 3;
    this.act([{ t: 2, start() { self.pose = 'dazed'; }, update(dt) { self.pose = 'dazed'; self.stop(dt, 4); }, end() { self.pose = null; } }]);
  }
}

class QueueCultist extends Enemy {
  constructor(o) { super({ hp: 35, speed: RUN * 0.5, radius: 0.5, height: 2.0, poise: 'low', ...o }); this.setModel(MODELS.queue()); this.cd = 2 + Math.random() * 2; }
  think(dt) {
    this.pose = null;
    this.kite(dt, 10, 16, this.speed);
    this.cd -= dt;
    const room = G.room;
    const limit = room.floor === 1 ? 1 : 2;
    room.queueTokens = (room.queueTokens || []).filter((t) => t.alive && t.summoning);
    if (this.cd <= 0 && room.queueTokens.length < limit) this.summon();
  }
  summon() {
    const self = this, room = G.room, L = room.L;
    room.queueTokens.push(this);
    this.summoning = true;
    this.cd = 4;
    // ropes sweep along the room's longer axis
    const alongX = L.w >= L.d;
    const low = G.run.rng.chance(0.5);
    this.act([
      { ...this.tele(0.5, '#ffb703'), start() { self.pose = 'summon'; say(self, 'PLEASE FORM A LINE', '#ffd166', 1.6); } },
      { t: 3.2, start() {
        self.pose = 'summon';
        const mk = (level, fromStart, delay) => {
          const half = (alongX ? L.d : L.w) / 2 - 0.3;
          const start = (alongX ? -L.w : -L.d) / 2 + 0.5;
          const s = fromStart ? start : -start;
          const dir = fromStart ? 1 : -1;
          const o = alongX
            ? { ax: s, az: -half, bx: s, bz: half, dir: [dir, 0], travel: L.w - 1 }
            : { ax: -half, az: s, bx: half, bz: s, dir: [0, dir], travel: L.d - 1 };
          G.areas.rope({ ...o, level, speed: 8, delay, dmg: 10, owner: self });
        };
        mk(low ? 'low' : 'high', true, 1.1);
        mk(low ? 'high' : 'low', false, 1.9);
        G.hud.popup(low ? 'LOW ROPE → JUMP · HIGH ROPE → STAY LOW' : 'HIGH ROPE → STAY LOW · LOW ROPE → JUMP', '#ffd166', 1.6, true);
      }, update(dt) { self.stop(dt); } },
      { t: 0.1, end() { self.summoning = false; self.pose = null; } },
    ]);
  }
  onInterrupt() { this.summoning = false; }
}

class MerchMimic extends Enemy {
  constructor(o) {
    super({ hp: 65, speed: RUN * 0.55, radius: 0.9, height: 1.9, poise: 'high', heavy: true, ...o });
    this.setModel(MODELS.mimic());
    this.disguised = !!o.disguised;
    this.cd = 2;
    if (this.disguised) { this.spawnT = 1; this.model.group.position.y = 0; if (this.spawnPortal) { this.group.remove(this.spawnPortal); this.spawnPortal = null; } }
  }
  targetable() { return this.alive && !this.disguised && this.spawnT > 0.4; }
  reveal() {
    if (!this.disguised) return;
    this.disguised = false;
    this.readyAt = G.time + 0.6;
    say(this, '!!', '#ff2e7e', 1);
    G.audio.sfx('roar', { v: 0.6, pan: G.cam.panOf(this.pos.x, this.pos.z) });
    G.fx.burst(this.pos.x, this.pos.y + 1, this.pos.z, { n: 20, kind: 'confetti', color: ['#ff4fa3', '#fff', '#4cc9f0', '#111'], speed: 6, up: 1.2, life: 1.2 });
    G.cam.shake(0.2, this.pos.x, this.pos.z);
  }
  dmgTakenK() { return this.pose === 'dazed' ? 1.25 : 1; }
  update(dt) {
    if (this.alive && this.disguised) {
      const d = Math.hypot(G.alex.pos.x - this.pos.x, G.alex.pos.z - this.pos.z);
      const others = G.room.enemies.some((e) => e !== this && e.alive && !e.disguised);
      this.twitch = d < 7;
      if (d < 4.2 || (!others && G.room.enemies.length > 0 && G.time > G.room.enteredAt + 3)) this.reveal();
      this._sync(dt);
      return;
    }
    super.update(dt);
  }
  think(dt) {
    this.pose = null;
    this.cd -= dt;
    const d = this.seek(dt, this.speed);
    const self = this;
    if (d < 6 && this.cd <= 0) {
      this.cd = 5;
      this.act([
        { ...this.tele(0.95, '#ff2e7e'), start() {
          self.pose = 'rise'; self.poseK = 0;
          G.areas.circle({ x: self.pos.x, z: self.pos.z, r: 2.2, delay: 0.95 / self.atkK() * self.telK(), dmg: 20, owner: self, sound: 'slam', shake: 0.35, propDmg: 30 });
          G.areas.ring({ x: self.pos.x, z: self.pos.z, r0: 2.2, r1: 8, speed: 9, width: 0.7, height: 0.8, dmg: 10, delay: 0.95 / self.atkK() * self.telK(), owner: self });
          G.hud.threatStart(self); self.threatDur = 0.95;
        }, update(dt, k) { self.threatT = 0.95 * (1 - k); self.poseK = k; self.stop(dt); self.setEmissive('#ff2e7e', 0.3 + 0.6 * k); } },
        { t: 0.1, start() { self.pose = null; self.setEmissive('#000', 0); G.fx.confetti(self.pos.x, self.pos.y + 0.5, self.pos.z, 30); } },
        { t: 1.5, start() { self.pose = 'dazed'; }, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    } else if (d < 2.3) {
      this.act([
        this.tele(0.5),
        { t: 0.15, start() { self.pose = 'bite'; self.hitAlexMelee(2.3, 90, 12, 5); G.audio.sfx('hitHeavy', { v: 0.4 }); } },
        { t: 0.5, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    }
  }
}

// ---------------------------------------------------------------------------
// FLOOR 2
// ---------------------------------------------------------------------------
class FancamFiend extends Enemy {
  constructor(o) { super({ hp: 35, speed: RUN * 0.6, radius: 0.45, height: 2.0, poise: 'low', ...o }); this.setModel(MODELS.fancam()); this.cd = 1.5 + Math.random() * 1.5; }
  think(dt) {
    this.pose = null;
    const d = this.kite(dt, 9, 15, this.speed);
    this.cd -= dt;
    if (this.cd <= 0 && d < 24 && this.losCached()) {
      this.cd = 3.5;
      const self = this;
      const p = { x: G.alex.pos.x, z: G.alex.pos.z };
      const dur = 1.25 / this.atkK() * this.telK();
      this.act([{ t: dur + 0.3, start() {
        self.pose = 'aim';
        self.threatDur = dur; G.hud.threatStart(self);
        G.areas.rect({ x: p.x, z: p.z, w0: 5, d0: 5, w: 2.2, d: 2.2, delay: dur, lockAt: 0.22, dmg: 14, ff: true, enemyDmg: 20, owner: self, color: '#ff0033',
          // the frame lags behind a moving Alex, so movement beats it
          follow: () => { const a = G.alex.pos, dx = a.x - p.x, dz = a.z - p.z, l = Math.hypot(dx, dz), st = Math.min(l, 5.2 * G.dt); if (l > 1e-3) { p.x += dx / l * st; p.z += dz / l * st; } return p; },
          onFire: (r) => { G.fx.flash(0.28); G.audio.sfx('flash', { v: 0.7, pan: G.cam.panOf(r.o.x, r.o.z) }); G.fx.burst(r.o.x, 0.8, r.o.z, { n: 16, color: '#ffffff', speed: 7, life: 0.3 }); } });
      }, update(dt, k) { self.threatT = Math.max(0, dur * (1 - k * 1.25)); self.faceTarget(dt, 6); self.stop(dt); }, end() { self.pose = null; } }]);
    }
  }
}

class Stalker extends Enemy {
  constructor(o) { super({ hp: 40, speed: RUN * 1.8, radius: 0.4, height: 2.4, poise: 'low', ...o }); this.setModel(MODELS.stalker()); }
  watched() {
    const cam = G.camera;
    const p = tmp.set(this.pos.x, this.pos.y + 1.4, this.pos.z).project(cam);
    if (p.z > 1 || Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.95) return false;
    if (!this._wT || G.time - this._wT > 0.2) { this._wT = G.time; this._w = G.room.world.losClear(cam.position.x, cam.position.y, cam.position.z, this.pos.x, this.pos.y + 1.4, this.pos.z); }
    return this._w;
  }
  dmgTakenK() { return this.pose === 'tumble' ? 1.25 : 1; }
  think(dt) {
    const d = this.distTo();
    if (d < 4 && Math.abs(G.alex.pos.y - this.pos.y) < 1.6) { this.lunge(); return; }
    if (this.watched()) {
      this.pose = 'innocent';
      this.seek(dt, RUN * 0.2, { drift: false });
      this.faceTarget(dt, 2);
    } else {
      this.pose = 'run';
      this.seek(dt, this.speed, { drift: false });
      if (Math.random() < 0.02) G.audio.sfx('tele', { v: 0.25, p: 0.6, pan: G.cam.panOf(this.pos.x, this.pos.z) });
    }
  }
  lunge() {
    const self = this;
    let dir = 0, hit = false, t0 = 0;
    this.act([
      { ...this.tele(0.5, '#ffffff', { sound: false }), start() { self.pose = 'screech'; G.audio.sfx('screech', { v: 0.9, pan: G.cam.panOf(self.pos.x, self.pos.z) }); say(self, 'I FOUND YOU ♥', '#ffffff', 1); G.hud.threatStart(self); self.threatDur = 0.5; },
        update(dt, k) { self.threatT = 0.5 * (1 - k); self.stop(dt, 20); self.faceTarget(dt, 12); } },
      { t: 0.38, start() { self.pose = 'lunge'; dir = self.yaw; t0 = G.time; },
        update(dt) {
          self.vel.x = Math.sin(dir) * 17; self.vel.z = Math.cos(dir) * 17;
          if (!hit && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < 1.0) { hit = G.alex.hurt(20, { source: self, dir: [Math.sin(dir), Math.cos(dir)], knock: 7 }) === 'hit'; if (!hit) hit = 'miss'; }
        } },
      { t: 0.3, update(dt) { self.stop(dt, 6); }, end() {
        if (hit === true && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < 2.2) G.alex.hurt(8, { source: self, dir: [Math.sin(dir), Math.cos(dir)], knock: 3 });
      } },
      { t: hit === true ? 0.6 : 1.4, start() { if (hit !== true) { self.pose = 'tumble'; say(self, '*trips*', '#aaaaaa', 1); } }, update(dt) { self.stop(dt, 3); }, end() { self.pose = null; } },
    ]);
    // tumble length is decided when the lunge resolves
    this.seq.steps[3].t = function () { return hit === true ? 0.6 : 1.4; };
  }
}

class AlbumHoarder extends Enemy {
  constructor(o) {
    super({ hp: 90, speed: RUN * 0.5, radius: 1.0, height: 2.2, poise: 'high', heavy: true, ...o });
    this.setModel(MODELS.hoarder());
    const k = this.maxHp / 90;
    this.plates = [20 * k, 20 * k, 20 * k];
    this.demonHp = 30 * k;
    this.cd = 2;
  }
  routeDamage(dmg, info) {
    let dx = 0, dz = 0;
    const src = info.source && info.source.pos ? info.source.pos : null;
    if (src) { dx = src.x - this.pos.x; dz = src.z - this.pos.z; } else if (info.dir) { dx = -info.dir[0]; dz = -info.dir[1]; }
    const a = wrapAngle(Math.atan2(dx, dz) - this.yaw);
    const idx = ((Math.round(a / (Math.PI * 2 / 3)) % 3) + 3) % 3;
    if (this.plates[idx] > 0) {
      const applied = Math.min(dmg, this.plates[idx]);
      this.plates[idx] -= dmg;
      if (this.plates[idx] <= 0) { this.plates[idx] = 0; this.breakPlate(idx); }
      return { dmg: applied, result: 'armor' };
    }
    this.demonHp -= dmg;
    // the demon underneath dies even if other plates are still on
    if (this.demonHp <= 0) return { dmg: this.hp, result: 'hit' };
    return { dmg, result: 'hit' };
  }
  breakPlate(i) {
    const a = this.yaw + (i * Math.PI * 2) / 3;
    G.audio.sfx('armor');
    G.cam.shake(0.1, this.pos.x, this.pos.z);
    say(this, 'MY ALBUMS!', '#ff006e', 1);
    const x = this.pos.x + Math.sin(a) * 0.9, z = this.pos.z + Math.cos(a) * 0.9;
    for (let k = 0; k < 4; k++) {
      const aa = a + (k - 1.5) * 0.45;
      G.projectiles.spawn({ owner: this, kind: 'cd', x, y: this.pos.y + 1.1, z, vx: Math.sin(aa) * 10, vz: Math.cos(aa) * 10, r: 0.3, dmg: 8, life: 2.5 });
    }
    G.fx.burst(x, this.pos.y + 1.1, z, { n: 12, kind: 'debris', color: ['#ff006e', '#8338ec', '#3a86ff', '#e0e0e0'], speed: 5, life: 0.8 });
  }
  think(dt) {
    this.pose = null;
    this.cd -= dt;
    const d = this.seek(dt, this.speed);
    const self = this;
    if (d < 5.5 && d > 2.2 && this.cd <= 0) {
      this.cd = 4.5;
      let tx = 0, tz = 0;
      this.act([
        { ...this.tele(0.8), start() { tx = G.alex.pos.x; tz = G.alex.pos.z; self.pose = 'slam'; self.poseK = 0; G.areas.circle({ x: tx, z: tz, r: 2.4, delay: 0.8 / self.atkK() * self.telK() + 0.25, dmg: 18, owner: self, sound: 'slam', shake: 0.3 }); G.hud.threatStart(self); self.threatDur = 1.05; },
          update(dt, k) { self.threatT = 1.05 - k * 0.8; self.poseK = k * 0.3; self.stop(dt); self.faceTarget(dt, 6); } },
        { t: 0.25, update(dt, k) { self.poseK = Math.sin(Math.PI * k); self.vel.x = (tx - self.pos.x) / 0.25; self.vel.z = (tz - self.pos.z) / 0.25; } },
        { t: 0.8, start() { self.pose = null; }, update(dt) { self.stop(dt, 10); } },
      ]);
    } else if (d < 2.3) {
      this.act([this.tele(0.5), { t: 0.15, start() { self.hitAlexMelee(2.4, 110, 12, 8); G.audio.sfx('hitHeavy', { v: 0.4 }); } }, this.wait(0.5)]);
    }
  }
}

class FanChanter extends Enemy {
  constructor(o) { super({ hp: 40, speed: RUN * 0.6, radius: 0.45, height: 1.9, poise: 'med', ...o }); this.setModel(MODELS.chanter()); this.cd = 2 + Math.random(); this.beat = 0; }
  think(dt) {
    this.pose = null;
    // stay near allies but away from Alex
    const allies = G.room.enemies.filter((e) => e !== this && e.alive);
    if (allies.length) {
      let cx = 0, cz = 0;
      for (const a of allies) { cx += a.pos.x; cz += a.pos.z; }
      cx /= allies.length; cz /= allies.length;
      const ad = Math.hypot(G.alex.pos.x - this.pos.x, G.alex.pos.z - this.pos.z);
      let dx = cx - this.pos.x, dz = cz - this.pos.z;
      if (ad < 7) { dx = this.pos.x - G.alex.pos.x; dz = this.pos.z - G.alex.pos.z; }
      const l = Math.hypot(dx, dz);
      if (l > 3) this.steer(dt, dx / l, dz / l, this.speed); else this.stop(dt);
      this.faceTarget(dt, 5);
    } else this.kite(dt, 7, 12, this.speed);
    this.cd -= dt;
    if (this.cd <= 0) this.chant();
    else if (Math.hypot(G.alex.pos.x - this.pos.x, G.alex.pos.z - this.pos.z) < 3) {
      const self = this;
      this.act([this.tele(0.5), { t: 0.2, start() { G.areas.cone({ x: self.pos.x, z: self.pos.z, yaw: self.yaw, angle: 1.2, range: 3.5, delay: 0.01, dmg: 6, owner: self, sound: 'shout', shake: 0.05 }); } }, this.wait(0.6)]);
    }
  }
  chant() {
    const self = this;
    this.cd = 4;
    const beat = (i) => ({ t: 0.55, start() {
      self.pose = 'chant'; self.beat = i;
      G.audio.sfx('chant', { p: i * 2, pan: G.cam.panOf(self.pos.x, self.pos.z) });
      say(self, ['FIGHTING!', 'SARANGHAE!', 'FOREVER!'][i], '#ffd60a', 0.5);
      for (const e of G.room.enemies) {
        if (!e.alive || e === self || Math.hypot(e.pos.x - self.pos.x, e.pos.z - self.pos.z) > 10) continue;
        // buffs never stack: refresh one shared buff
        e.buff = e.buff && G.time < e.buff.until ? e.buff : { until: 0, move: false, atk: false, poise: false };
        if (i >= 0) e.buff.move = true;
        if (i >= 1) e.buff.atk = true;
        if (i >= 2) e.buff.poise = true;
        e.buff.until = G.time + 6;
        G.fx.burst(e.pos.x, e.pos.y + e.height, e.pos.z, { n: 3, color: '#ffd60a', speed: 2, up: 2, life: 0.5 });
      }
    }, update(dt) { self.stop(dt); } });
    this.chanting = true;
    this.act([beat(0), beat(1), beat(2), { t: 0.05, end() { self.chanting = false; self.pose = null; } }]);
  }
  onHurt(dmg, info) {
    if (this.chanting && (dmg >= 12 || info.finisher || (info.stagger || 0) >= 2)) {
      this.chanting = false;
      say(this, 'CHANT INTERRUPTED', '#ff2e7e', 1.3);
      this.interrupt();
      this.stunUntil = G.time + 1.25;
      this.pose = null;
    }
  }
}

class UltBias extends Enemy {
  constructor(o) { super({ hp: 75, speed: RUN * 0.8, radius: 0.45, height: 1.95, poise: 'med', elite: true, money: 'elite', ...o }); this.setModel(MODELS.ultBias()); this.step = 0; }
  dmgTakenK() { return this.pose === 'tired' ? 1.3 : 1; }
  think(dt) {
    this.pose = null;
    const d = this.distTo();
    if (d > 10 || !this.losCached()) { this.seek(dt, this.speed); return; }
    this.routine();
  }
  danceStep() {
    const self = this;
    let tx, tz;
    return { t: 0.35, start() {
      const a = G.alex.pos;
      const ang = Math.atan2(self.pos.x - a.x, self.pos.z - a.z) + (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6);
      const r = 4 + Math.random() * 2;
      tx = a.x + Math.sin(ang) * r; tz = a.z + Math.cos(ang) * r;
      G.audio.sfx('dash', { v: 0.3 });
    }, update(dt) { self.vel.x = (tx - self.pos.x) * 6; self.vel.z = (tz - self.pos.z) * 6; self.faceTarget(dt, 10); self.gT = (self.gT || 0) - dt; if (self.gT <= 0) { self.gT = 0.08; G.fx.ghost(self.model.group, '#ffd60a', 0.2, 0.3); } } };
  }
  routine() {
    const self = this;
    this.act([
      this.danceStep(),
      { ...this.tele(0.5, '#ff4fa3'), start() { self.pose = 'heart'; say(self, 'FINGER HEART ♥', '#ff4fa3', 0.8); } },
      { t: 0.3, start() { G.projectiles.fan({ owner: self, kind: 'heart', x: self.pos.x, y: self.pos.y + 1.3, z: self.pos.z, r: 0.34, dmg: 8, life: 3 }, 3, 0.4, self.yawTo(), 13); G.audio.sfx('heartUp', { v: 0.4 }); }, update(dt) { self.stop(dt); } },
      this.danceStep(),
      { t: 0.5, update(dt) { self.seek(dt, self.speed * 1.4); if (self.distTo() < 2.5) self.seq.t = 99; } },
      { ...this.tele(0.45, '#ffd60a'), start() { self.pose = 'spin'; } },
      { t: 0.35, start() { self.hitAlexMelee(2.9, 360, 12, 6); G.audio.sfx('spin', { v: 0.5 }); G.fx.slash(self.pos.x, self.pos.y + 1, self.pos.z, self.yaw, { r: 2.9, arc: Math.PI * 2, color: '#ffd60a', life: 0.25 }); }, update(dt) { self.stop(dt); } },
      { ...this.tele(0.8, '#ff2e7e'), start() { self.pose = 'pose'; say(self, 'FINAL POSE ✧', '#ffd60a', 1); G.areas.cone({ x: self.pos.x, z: self.pos.z, yaw: self.yawTo(), angle: 1.05, range: 7, delay: 0.8 / self.atkK() * self.telK(), dmg: 18, owner: self, fxColor: ['#ffd60a', '#ff4fa3'], shake: 0.3 }); }, update(dt) { self.stop(dt); } },
      { t: 2, start() { self.pose = 'tired'; say(self, '*heavy breathing*', '#aaaaaa', 1.5); }, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
    ]);
  }
}

// ---------------------------------------------------------------------------
// FLOOR 3
// ---------------------------------------------------------------------------
class Akgae extends Enemy {
  constructor(o) { super({ hp: 65, speed: RUN * 1.2, radius: 0.5, height: 1.7, poise: 'med', ...o }); this.setModel(MODELS.akgae()); this.cd = 2; }
  onFriendlyHit(src) {
    if (src === this || !src.alive || src.intangible) return;
    this.aggro = { target: src, until: G.time + 4 };
    say(this, 'WHO HIT ME?!', '#ff2e4d', 1.2);
    this.interrupt();
  }
  out(r, arc, dmg, knock) {
    const t = this.target();
    if (t === G.alex) this.hitAlexMelee(r, arc, dmg, knock);
    this.hitEnemiesMelee(r, arc, dmg * 0.75, knock);   // hates everything
  }
  think(dt) {
    this.pose = null;
    this.cd -= dt;
    const t = this.target();
    const d = this.seek(dt, this.speed);
    const self = this;
    if (d > 6.5 && this.cd <= 0 && (t !== G.alex || this.losCached())) {
      this.cd = 4;
      let dir = 0, hitSet = new Set(), dist = 0;
      this.act([
        { ...this.tele(0.6, '#ff2e4d'), start() { self.pose = 'charge'; G.audio.sfx('roar', { v: 0.4, pan: G.cam.panOf(self.pos.x, self.pos.z) }); }, update(dt) { self.stop(dt); self.faceTarget(dt, 10, self.target()); } },
        { t: 0.8, start() { dir = self.yaw; }, update(dt) {
          self.vel.x = Math.sin(dir) * 16; self.vel.z = Math.cos(dir) * 16; dist += 16 * dt;
          if (!hitSet.has(G.alex) && Math.hypot(G.alex.pos.x - self.pos.x, G.alex.pos.z - self.pos.z) < 1.1) { hitSet.add(G.alex); G.alex.hurt(22, { source: self, dir: [Math.sin(dir), Math.cos(dir)], knock: 9 }); }
          for (const e of G.room.enemies) if (e !== self && e.alive && !hitSet.has(e) && Math.hypot(e.pos.x - self.pos.x, e.pos.z - self.pos.z) < e.radius + 0.7) { hitSet.add(e); e.hurt(22 * 0.75, { source: self, dir: [Math.sin(dir), Math.cos(dir)], knock: 8, friendly: true }); }
          if (self.hitWall) self.seq.t = 99;
        } },
        { t: 0.5, start() { self.pose = null; }, update(dt) { self.stop(dt, 6); } },
      ]);
    } else if (d < 2.4) {
      const claw = (dmg, side, tel) => [{ ...this.tele(tel, '#ff2e4d'), start() { self.pose = side; } }, { t: 0.12, start() { self.out(2.4, 120, dmg, 3); G.audio.sfx('slash', { v: 0.5 }); G.fx.slash(self.pos.x, self.pos.y + 0.9, self.pos.z, self.yaw, { r: 2.2, arc: 2, color: '#ff2e4d', life: 0.14 }); }, update(dt) { self.vel.x = Math.sin(self.yaw) * 4; self.vel.z = Math.cos(self.yaw) * 4; } }];
      this.act([...claw(10, 'clawR', 0.35), ...claw(10, 'clawL', 0.3), ...claw(14, 'clawR', 0.45), { t: 0.6, start() { self.pose = null; }, update(dt) { self.stop(dt); } }]);
    }
  }
}

class Parasocial extends Enemy {
  constructor(o) {
    super({ hp: 55, speed: RUN * 0.42, radius: 0.85, height: 1.9, poise: 'high', ...o });
    this.setModel(MODELS.parasocial());
    this.cd = 2.5;
    this.reach = [0, 0];            // arm extension per side (metres)
    this.armDir = [0, 0];           // yaw of each arm
    this.armOut = -1;               // which arm is stretched
    this.grabDmg = 0;
    this.holding = false;
  }
  shoulder(i, out) { const s = i === 0 ? -1 : 1; return out.set(this.pos.x + Math.cos(this.yaw) * s * 0.75, this.pos.y + 1.0, this.pos.z - Math.sin(this.yaw) * s * 0.75); }
  handPos(i, out) { const sh = this.shoulder(i, out); const a = this.armDir[i]; const r = 1 + this.reach[i]; return out.set(sh.x + Math.sin(a) * r, this.pos.y + (this.reach[i] > 1 ? 0.3 : 1.0), sh.z + Math.cos(a) * r); }
  armHit(x, y, z, r) {
    for (let i = 0; i < 2; i++) {
      if (this.reach[i] < 1) continue;
      const a = this.shoulder(i, new THREE.Vector3()), b = this.handPos(i, new THREE.Vector3());
      const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz || 1;
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / l2, 0, 1);
      const px = a.x + abx * t, pz = a.z + abz * t;
      if (Math.hypot(x - px, z - pz) < 0.45 + r && y < this.pos.y + 1.6) return 'arm';
    }
    return null;
  }
  hitTest(x, y, z, r) { if (!this.targetable()) return null; return this.armHit(x, y, z, r) || super.hitTest(x, y, z, r); }
  meleeTest(apos, ayaw, range, halfArc, full) {
    for (const k of [0.6, 1.2, 1.8]) {
      const x = apos.x + Math.sin(ayaw) * k, z = apos.z + Math.cos(ayaw) * k;
      if (this.armHit(x, apos.y + 1, z, 0.4)) return 'arm';
    }
    return super.meleeTest(apos, ayaw, range, halfArc, full);
  }
  routeDamage(dmg, info) {
    if (info.part === 'arm') {
      if (this.holding) {
        this.grabDmg += dmg;
        if (this.grabDmg >= 20) this.letGo(true);
      }
      return { dmg: dmg * 1.5, result: 'hit' };
    }
    return { dmg, result: 'hit' };
  }
  letGo(broken) {
    this.holding = false;
    G.alex.release(broken ? null : undefined);
    this.armOut = -1;
    if (broken) { say(this, 'NOOO COME BACK', '#ff8fab', 1.2); this.stunUntil = G.time + 1; this.interrupt(); G.audio.sfx('armor'); }
  }
  think(dt) {
    this.kite(dt, 6, 9, this.speed);
    this.cd -= dt;
    if (this.cd <= 0 && this.distTo() < 9.5 && this.losCached()) this.grab();
  }
  grab() {
    const self = this;
    const i = Math.random() < 0.5 ? 0 : 1;
    let tx = 0, tz = 0, tele = null;
    this.cd = 5;
    this.armOut = i;
    this.act([
      { ...this.tele(0.7, '#ff8fab'), start() {
        self.pose = 'reach';
        say(self, 'NOTICE ME', '#ff8fab', 0.9);
        tele = G.areas.circle({ x: G.alex.pos.x, z: G.alex.pos.z, r: 1.1, delay: 1.15, dmg: 0, owner: self, color: '#ff8fab', follow: () => G.alex.pos, lockAt: 0.45, sound: null, shake: 0, propDmg: 0 });
        G.hud.threatStart(self); self.threatDur = 1.15;
      }, update(dt, k) { self.threatT = 1.15 - 0.7 * k; self.stop(dt); self.faceTarget(dt, 6); } },
      { t: 0.45, start() { tx = tele.o.x; tz = tele.o.z; G.audio.sfx('dash', { v: 0.4 }); }, update(dt, k) {
        const sh = self.shoulder(i, tmp);
        self.armDir[i] = Math.atan2(tx - sh.x, tz - sh.z);
        self.reach[i] = Math.max(0, Math.hypot(tx - sh.x, tz - sh.z) - 1) * k;
        self.stop(dt, 20);
      } },
      { t: 0.05, start() {
        const a = G.alex.pos;
        if (Math.hypot(a.x - tx, a.z - tz) < 1.25 && Math.abs(a.y - self.pos.y) < 1.5 && G.alex.grab(self)) {
          self.holding = true; self.grabDmg = 0; self.holdT = 0; self.tickT = 0;
          G.audio.sfx('hurt', { v: 0.4 });
          G.hud.popup('GRABBED! ATTACK TO BREAK FREE', '#ff8fab', 1.2);
        } else { self.holding = false; G.cam.shake(0.1, tx, tz); G.fx.burst(tx, 0.2, tz, { n: 10, kind: 'debris', color: '#ff8fab', speed: 3, life: 0.4 }); }
      } },
      { t: 3.0, update(dt) {
        self.stop(dt);
        if (self.holding) {
          self.holdT += dt; self.tickT += dt;
          const a = G.alex.pos;
          const sh = self.shoulder(i, tmp);
          self.armDir[i] = Math.atan2(a.x - sh.x, a.z - sh.z);
          self.reach[i] = Math.max(0, Math.hypot(a.x - sh.x, a.z - sh.z) - 1);
          G.alex.pullToward(self.pos.x, self.pos.z, 3.4, dt);
          if (self.tickT > 0.5) { self.tickT = 0; G.alex.hp -= 2.5; G.run.stat('damageTaken', 2.5); G.hud.damageNumber(a.x, a.y + 2, a.z, 3, 'alex'); if (G.alex.hp <= 0) { self.letGo(false); G.alex.hp = 1; G.alex.hurt(5, { source: self }); } }
          if (Math.hypot(a.x - self.pos.x, a.z - self.pos.z) < self.radius + 0.7) {
            self.holding = false;
            G.alex.release();
            G.alex.mercyUntil = 0;
            say(self, 'POSSESSIVE HUG ♥', '#ff4d6d', 1.3);
            G.alex.hurt(15, { source: self, dir: [a.x - self.pos.x, a.z - self.pos.z], knock: 10 });
            self.seq.t = 99;
          } else if (self.holdT >= 3) { self.letGo(false); self.seq.t = 99; }
        } else if (self.seq.t > 2.0) self.seq.t = 99;    // missed: arm lies stretched & vulnerable for 2 s
      }, end() { if (self.holding) self.letGo(false); } },
      { t: 0.4, update(dt, k) { self.reach[i] *= 1 - k; }, end() { self.reach[i] = 0; self.armOut = -1; self.pose = null; } },
    ]);
  }
  onInterrupt() { if (this.holding) this.letGo(false); if (this.armOut >= 0) { this.reach[this.armOut] = 0; this.armOut = -1; } }
  onDeath() { if (this.holding) { this.holding = false; G.alex.release(); } }
  _sync(dt, stunned) {
    super._sync(dt, stunned);
    const arms = this.model.parts.arms;
    for (let i = 0; i < 2; i++) {
      const A = arms[i];
      const rel = wrapAngle(this.armDir[i] - this.yaw);
      A.sh.rotation.y = this.reach[i] > 0.05 ? rel : 0;
      A.sh.rotation.x = this.reach[i] > 1 ? 0.3 : 0;
      const len = 1 + this.reach[i];
      A.seg.scale.y = len;
      A.seg.position.z = len / 2;
      A.hand.position.z = len;
    }
  }
}

class ComebackQueen extends Enemy {
  constructor(o) { super({ hp: 50, speed: RUN * 0.55, radius: 0.55, height: 2.1, poise: 'med', ...o }); this.setModel(MODELS.queen()); this.cd = 3; this.shotCd = 1.5; }
  think(dt) {
    this.pose = null;
    this.kite(dt, 9, 14, this.speed);
    this.cd -= dt; this.shotCd -= dt;
    const room = G.room;
    const active = room.enemies.filter((e) => e.alive && e.revived).length;
    const corpse = room.corpses.filter((c) => !c.used && !c.noRevive).sort((a, b) => Math.hypot(a.x - this.pos.x, a.z - this.pos.z) - Math.hypot(b.x - this.pos.x, b.z - this.pos.z))[0];
    const self = this;
    if (this.cd <= 0 && corpse && active < 2) {
      this.cd = 9;
      corpse.used = true;
      this.act([
        { ...this.tele(1.0, '#b5179e', { target: false }), start() { self.pose = 'revive'; say(self, 'COMEBACK SZN!', '#ff4fa3', 1.2); G.areas.circle({ x: corpse.x, z: corpse.z, r: 1.2, delay: 1.0, dmg: 0, owner: self, color: '#b5179e', sound: null, shake: 0, propDmg: 0 }); }, update(dt) { self.stop(dt); } },
        { t: 0.4, start() {
          const e = G.room.spawnEnemy(corpse.type, corpse.x, corpse.z, { revived: true, readyDelay: 0.9 });
          if (e) { e.revived = true; e.hp = Math.ceil(e.maxHp * 0.5); addCostume(e); say(e, 'COMEBACK ✦', '#ff4fa3', 1.4); }
          G.fx.confetti(corpse.x, 0.5, corpse.z, 30);
          G.audio.sfx('win', { v: 0.4 });
        }, end() { self.pose = null; } },
      ]);
    } else if (this.shotCd <= 0 && this.losCached()) {
      this.shotCd = 2.2;
      this.act([this.tele(0.45), { t: 0.3, start() { self.pose = 'shoot'; const y = self.yawTo(); for (let k = 0; k < 3; k++) G.projectiles.spawn({ owner: self, x: self.pos.x, y: self.pos.y + 1.5, z: self.pos.z, vx: Math.sin(y) * 12, vz: Math.cos(y) * 12, r: 0.3, dmg: 8, life: 3, delay: k * 0.12, color: '#ffc8f0' }); }, end() { self.pose = null; } }]);
    }
  }
  onDeath() {
    for (const e of G.room.enemies) {
      if (!e.alive || !e.revived) continue;
      e.revived = false;
      e.hp -= e.hp * 0.25;
      if (e.costume) { e.group.remove(e.costume); e.costume = null; }
      say(e, 'FLOPPED', '#aaaaaa', 1.2);
    }
  }
}

function addCostume(e) {
  const kinds = ['party', 'shades', 'crown', 'afro', 'cowboy'];
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  const g = new THREE.Group();
  const top = e.height + 0.05;
  if (k === 'party') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 10), new THREE.MeshBasicMaterial({ color: '#ff4fa3' })); c.position.y = top + 0.2; g.add(c); }
  if (k === 'shades') { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: '#111' })); c.position.set(0, top - 0.3, 0.2); g.add(c); }
  if (k === 'crown') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.18, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd60a', side: THREE.DoubleSide })); c.position.y = top + 0.08; g.add(c); }
  if (k === 'afro') { const c = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: '#7b2cbf' })); c.position.y = top + 0.1; g.add(c); }
  if (k === 'cowboy') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16), new THREE.MeshBasicMaterial({ color: '#8b5e3c' })); c.position.y = top; g.add(c); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.25, 12), new THREE.MeshBasicMaterial({ color: '#8b5e3c' })); t.position.y = top + 0.12; g.add(t); }
  e.group.add(g);
  e.costume = g;
}

class Fanwar extends Enemy {
  constructor(o) { super({ hp: 85, speed: RUN * 0.55, radius: 0.95, height: 2.1, poise: 'med', ...o }); this.setModel(MODELS.fanwar()); this.argueAt = G.time + 5 + Math.random() * 3; this.cd = 1; }
  dmgTakenK() { return this.pose === 'argue' ? 1.25 : 1; }
  routeDamage(dmg) {
    // overkill still splits: Fanwar always argues its way into two Solo Stans
    if (!this.split && this.hp - dmg <= 0) return { dmg: this.hp - 1, result: 'hit' };
    return { dmg, result: 'hit' };
  }
  onHurt() {
    if (this.alive && this.hp <= 30 && !this.split) {
      this.split = true;
      say(this, 'THAT\'S IT, WE\'RE DONE', '#ffffff', 1.5);
      const x = this.pos.x, z = this.pos.z, yaw = this.yaw;
      this.die({ source: 'split', noMoney: false, split: true });
      const px = Math.cos(yaw) * 1.1, pz = -Math.sin(yaw) * 1.1;
      G.room.spawnEnemy('soloA', x - px, z - pz, { noSpawnAnim: true, readyDelay: 0.6 });
      G.room.spawnEnemy('soloB', x + px, z + pz, { noSpawnAnim: true, readyDelay: 0.6 });
      G.fx.burst(x, 1.2, z, { n: 24, color: ['#e63946', '#3a86ff', '#ffffff'], speed: 7, life: 0.6 });
      G.audio.sfx('boom', { v: 0.5 });
    }
  }
  think(dt) {
    this.pose = null;
    this.cd -= dt;
    const self = this;
    if (G.time > this.argueAt) {
      this.argueAt = G.time + 7;
      const lines = [['UR BIAS FLOPPED', 'RATIO'], ['STREAM OUR SONG', 'NOBODY ASKED'], ['WE WON DAESANG', 'IT WAS RIGGED']][Math.floor(Math.random() * 3)];
      this.act([{ t: 2, start() { self.pose = 'argue'; say(self, lines[0] + ' / ' + lines[1], '#ffffff', 2); G.audio.sfx('shout', { v: 0.4 }); }, update(dt) { self.stop(dt); }, end() { self.pose = null; } }]);
      return;
    }
    const d = this.seek(dt, d0(this) > 4.5 ? this.speed : this.speed * 0.4);
    if (this.cd > 0) return;
    if (d < 2.7) {
      this.cd = 1.2;
      if (Math.random() < 0.55) this.act([{ ...this.tele(0.45, '#e63946'), start() { self.pose = 'punch'; } }, { t: 0.15, start() { self.hitAlexMelee(2.6, 90, 10, 5); G.audio.sfx('hit', { v: 0.5 }); } }, { t: 0.4, end() { self.pose = null; } }]);
      else {
        const x = this.pos.x + Math.sin(this.yaw) * 1.6, z = this.pos.z + Math.cos(this.yaw) * 1.6;
        this.act([{ ...this.tele(0.7, '#e63946'), start() { self.pose = 'slam'; G.areas.circle({ x, z, r: 2.1, delay: 0.7 / self.atkK() * self.telK(), dmg: 16, owner: self, sound: 'slam', shake: 0.2 }); }, update(dt) { self.stop(dt); } }, { t: 0.5, end() { self.pose = null; } }]);
      }
    } else if (d > 3.5 && this.losCached()) {
      this.cd = 2.2;
      const texts = ['#BIAS', 'RATIO', 'L', 'FLOP', 'MID'];
      this.act([{ ...this.tele(0.5, '#3a86ff'), start() { self.pose = 'shoot'; } }, { t: 0.5, start() {
        const y = self.yawTo();
        for (let k = 0; k < 3; k++) G.projectiles.spawn({ owner: self, kind: 'bubble', x: self.pos.x, y: self.pos.y + 1.6, z: self.pos.z, vx: Math.sin(y + (k - 1) * 0.08) * 12, vz: Math.cos(y + (k - 1) * 0.08) * 12, r: 0.34, dmg: 8, life: 3, delay: k * 0.15, tag: texts[k] });
        G.audio.sfx('text', { v: 0.5 });
      }, end() { self.pose = null; } }]);
    }
  }
}
const d0 = (e) => e.distTo();

class SoloA extends Enemy {
  constructor(o) { super({ hp: 15, speed: RUN * 0.75, radius: 0.45, height: 1.3, poise: 'low', ...o }); this.setModel(MODELS.soloA()); }
  think(dt) {
    const d = this.seek(dt, this.speed);
    const self = this;
    if (d < 2) this.act([{ ...this.tele(0.45, '#e63946'), start() { self.pose = 'punch'; } }, { t: 0.15, start() { self.hitAlexMelee(2, 90, 8, 4); } }, { t: 0.5, end() { self.pose = null; } }]);
  }
}
class SoloB extends Enemy {
  constructor(o) { super({ hp: 15, speed: RUN * 0.6, radius: 0.45, height: 1.3, poise: 'low', ...o }); this.setModel(MODELS.soloB()); this.cd = 1; }
  think(dt) {
    const d = this.kite(dt, 6, 10, this.speed);
    this.cd -= dt;
    const self = this;
    if (this.cd <= 0 && d < 16 && this.losCached()) {
      this.cd = 1.6;
      this.act([this.tele(0.4, '#3a86ff'), { t: 0.1, start() { const y = self.yawTo(); G.projectiles.spawn({ owner: self, kind: 'bubble', x: self.pos.x, y: self.pos.y + 1.1, z: self.pos.z, vx: Math.sin(y) * 12, vz: Math.cos(y) * 12, r: 0.32, dmg: 8, life: 3 }); } }]);
    }
  }
}

class Delulu extends Enemy {
  constructor(o) {
    super({ hp: 110, speed: RUN * 0.8, radius: 0.5, height: 2.0, poise: 'high', elite: true, money: 'elite', ...o });
    this.setModel(MODELS.delulu());
    this.phase = 0;
    this.dancers = [];
  }
  dmgTakenK() { return this.pose === 'pose' ? 1.35 : 1; }
  think(dt) {
    this.pose = null;
    if (this.distTo() > 12 && this.phase === 0) { this.seek(dt, this.speed); return; }
    const ph = this.phase;
    this.phase = (this.phase + 1) % 4;
    if (ph === 0) this.verse(); else if (ph === 1) this.preChorus(); else if (ph === 2) this.chorus(); else this.finalPose();
  }
  verse() {
    const self = this;
    const hit = (dmg, tel) => [
      { t: 0.35, update(dt) { self.pose = 'verse'; self.seek(dt, self.speed * 1.3); } },
      { ...this.tele(tel, '#ff4fa3'), start() { self.pose = 'verse'; } },
      { t: 0.15, start() { self.hitAlexMelee(2.6, 140, dmg, 5); G.audio.sfx('slash', { v: 0.5 }); G.fx.slash(self.pos.x, self.pos.y + 1, self.pos.z, self.yaw, { r: 2.6, arc: 2.4, color: '#ff4fa3' }); } },
    ];
    say(this, '♪ VERSE ♪', '#ff4fa3', 1);
    this.act([...hit(8, 0.6), ...hit(8, 0.6), ...hit(12, 0.75), this.wait(0.4)]);
  }
  preChorus() {
    const self = this;
    say(this, '♪ PRE-CHORUS ♪', '#ffd60a', 1);
    const wave = (i) => ({ t: 0.55, start() {
      const n = 7 + i * 2, spread = 1.6 - i * 0.26;
      G.projectiles.fan({ owner: self, kind: i % 2 ? 'heart' : 'orb', x: self.pos.x, y: self.pos.y + 1.3, z: self.pos.z, r: 0.3, dmg: 8, life: 3.5, color: i % 2 ? null : '#fff3b0' }, n, spread, self.yawTo(), 10 + i);
      G.audio.sfx('shot', { v: 0.4, p: 1.2 });
    }, update(dt) { self.faceTarget(dt, 6); self.stop(dt); } });
    this.act([
      { t: 0.8, update(dt) { const a = G.alex.pos; const dx = self.pos.x - a.x, dz = self.pos.z - a.z, l = Math.hypot(dx, dz) || 1; if (l < 9) self.steer(dt, dx / l, dz / l, self.speed); else self.stop(dt); self.faceTarget(dt, 6); } },
      this.tele(0.5, '#ffd60a'), wave(0), wave(1), wave(2), wave(3), this.wait(0.3),
    ]);
  }
  chorus() {
    const self = this, L = G.room.L;
    say(this, '♪♪ CHORUS ♪♪', '#b388ff', 1.2);
    const lanesA = [-0.36, -0.12, 0.12, 0.36], lanesB = [-0.24, 0, 0.24, 0.48];
    const round = (offs) => [
      { t: 0.1, start() {
        self.pose = 'chorus';
        const alongX = G.run.rng.chance(0.5);
        for (const f of offs) {
          const v = (alongX ? L.w : L.d) * f;
          const lane = alongX ? { x1: v, z1: -L.d / 2, x2: v, z2: L.d / 2 } : { x1: -L.w / 2, z1: v, x2: L.w / 2, z2: v };
          G.areas.lane({ ...lane, width: 2.2, delay: 1.1 / self.atkK() * self.telK(), dmg: 16, duration: 0.35, owner: self, color: '#b388ff', strikeColor: '#e0c3fc' });
          self.spawnDancer(alongX ? v : 0, alongX ? 0 : v);
        }
        const a = G.alex.pos;
        G.areas.circle({ x: a.x, z: a.z, r: 2.2, delay: 1.3 / self.atkK() * self.telK(), dmg: 22, owner: self, sound: 'slam', shake: 0.3 });
        self.diveTo = { x: a.x, z: a.z };
        G.hud.threatStart(self); self.threatDur = 1.3;
      } },
      { t: 1.2, start() { self.vel.y = 12.5; }, update(dt, k) { self.threatT = 1.3 - k * 1.2; const d = self.diveTo; self.vel.x = (d.x - self.pos.x) * 3; self.vel.z = (d.z - self.pos.z) * 3; } },
      { t: 0.5, update(dt) { self.stop(dt); } },
    ];
    this.act([...round(lanesA), ...round(lanesB), { t: 0.1, end() { self.clearDancers(); self.pose = null; } }]);
  }
  spawnDancer(x, z) {
    const m = MODELS.dancer();
    m.group.position.set(x, 0, z);
    G.room.group.add(m.group);
    this.dancers.push(m);
    if (this.dancers.length > 8) { const d = this.dancers.shift(); d.group.parent?.remove(d.group); }
  }
  clearDancers() { for (const d of this.dancers) d.group.parent?.remove(d.group); this.dancers.length = 0; }
  finalPose() {
    const self = this;
    this.act([
      { t: 3, start() {
        self.pose = 'pose';
        say(self, '✧ FINAL POSE ✧', '#ffd60a', 2.5);
        G.fx.confetti(self.pos.x, self.pos.y + 3, self.pos.z, 60);
        G.audio.sfx('cheer', { v: 0.7 });
        G.fx.flash(0.15, '#fff3b0');
        G.hud.popup('DELULU IS VULNERABLE! (+35% damage)', '#ffd60a', 1.6);
      }, update(dt) { self.pose = 'pose'; self.stop(dt); } },
      { t: 0.6, start() { self.pose = null; say(self, 'ENCORE!', '#ff2e7e', 1.2); G.audio.sfx('shout'); } },
    ]);
  }
  onDeath() { this.clearDancers(); }
  onInterrupt() { if (this.pos.y > this.groundH) this.vel.y = -5; }
}

// ---------------------------------------------------------------------------
const CLASSES = {
  lurker: Lurker, photocard: Photocard, biasBeast: BiasBeast, queue: QueueCultist, mimic: MerchMimic,
  fancam: FancamFiend, stalker: Stalker, hoarder: AlbumHoarder, chanter: FanChanter, ultBias: UltBias,
  akgae: Akgae, parasocial: Parasocial, queen: ComebackQueen, fanwar: Fanwar, delulu: Delulu,
  soloA: SoloA, soloB: SoloB,
};
const NAMES = { soloA: 'Solo Stan A', soloB: 'Solo Stan B' };
const NO_REVIVE = new Set(['queen', 'ultBias', 'delulu', 'soloA', 'soloB', 'fanwar']);

export function createEnemy(type, x, z, opts = {}) {
  const C = CLASSES[type];
  if (!C) return null;
  const info = ENEMY_INFO[type] || { name: NAMES[type], floor: 3, threat: 1 };
  const floorGap = Math.max(0, (G.room?.floor || 1) - (info.floor || 1));
  const e = new C({ type, name: info.name, x, z, threat: info.threat, hpMul: (opts.hpMul || 1) * (1 + 0.18 * floorGap) * (G.run?.mods.enemyHpMul || 1), ...opts });
  e.noRevive = NO_REVIVE.has(type);
  return e;
}
