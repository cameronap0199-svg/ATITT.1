// Enemy base: spawn-in, flow-field navigation, action sequences with telegraphs,
// poise / stagger, knockback and launch, buffs (Fan-Chanter), burning, friendly fire,
// part-based hit routing, and death rewards.

import * as THREE from 'three';
import { G } from '../state.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/math.js';
import { collapseRig } from '../world/props.js';

const tmp = new THREE.Vector3();
const POISE = { low: 8, med: 22, high: 45, boss: 400 };

export class Enemy {
  constructor(o) {
    this.type = o.type;
    this.name = o.name;
    this.pos = new THREE.Vector3(o.x, o.y || 0, o.z);
    this.vel = new THREE.Vector3();
    this.yaw = o.yaw ?? Math.atan2(G.alex.pos.x - o.x, G.alex.pos.z - o.z);
    this.radius = o.radius ?? 0.5;
    this.height = o.height ?? 1.8;
    this.maxHp = Math.round(o.hp * (o.hpMul || 1));
    this.hp = this.maxHp;
    this.speed = o.speed ?? 4;
    this.alive = true;
    this.heavy = !!o.heavy;
    this.elite = !!o.elite;
    this.threat = o.threat || 1;
    this.poiseMax = POISE[o.poise || 'low'];
    this.poise = 0;
    this.money = o.money || 'normal';
    this.flying = !!o.flying;
    this.spawnT = o.noSpawnAnim ? 1.2 : 0;
    this.readyAt = G.time + (o.readyDelay ?? 1.3);
    this.seq = null;
    this.stunUntil = 0;
    this.buff = null;
    this.burn = null;
    this.aggro = null;        // Akgae-style target override: { target, until }
    this.threatT = 0;         // seconds until the current attack lands (for indicators)
    this.threatDur = 0;
    this.threatTarget = true;
    this.flashT = 0;
    this.revived = !!o.revived;
    this.group = new THREE.Group();
    this.mats = [];
    this.nodes = null;
    this.intangible = false;
    this.disguised = false;
    this.navT = Math.random() * 0.2;
    this.wander = Math.random() * Math.PI * 2;
    this.drift = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.35);
    this.spawnPortal = null;
    this.bubbleText = null;
    G.room.group.add(this.group);
    this.group.position.copy(this.pos);
  }

  // Model helpers ------------------------------------------------------------
  setModel(m) {
    this.model = m;
    collapseRig(m.group);
    this.group.add(m.group);
    m.group.traverse((c) => {
      if (c.isMesh && c.material && c.material.emissive && !c.userData.outline) {
        const m = c.material.clone();
        m.userData = { baseEmissive: m.emissive.clone(), baseEI: m.emissiveIntensity };
        c.material = m;
        this.mats.push(m);
      }
    });
    if (this.spawnT < 1) {
      m.group.position.y = -this.height;
      const portal = new THREE.Mesh(new THREE.RingGeometry(0.2, 1, 32), new THREE.MeshBasicMaterial({ color: '#ff2e7e', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      portal.rotation.x = -Math.PI / 2;
      portal.position.y = 0.05;
      portal.scale.setScalar(this.radius * 2.2);
      this.group.add(portal);
      this.spawnPortal = portal;
    }
  }
  setEmissive(color, k) {
    for (const m of this.mats) {
      if (k <= 0) { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEI; } else { m.emissive.set(color); m.emissiveIntensity = k; }
    }
  }

  // Queries --------------------------------------------------------------------
  targetable() { return this.alive && this.spawnT > 0.4 && !this.disguised; }
  threatening() { return this.threatT > 0 && this.threatTarget; }
  ready() { return G.time >= this.readyAt && this.spawnT >= 1; }
  aimPoint(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z); }
  hitTest(x, y, z, r) {
    if (!this.targetable() || this.intangible) return null;
    if (y < this.pos.y - r || y > this.pos.y + this.height + r) return null;
    return Math.hypot(x - this.pos.x, z - this.pos.z) < this.radius + r ? 'body' : null;
  }
  meleeTest(apos, ayaw, range, halfArc, full) {
    if (!this.targetable() || this.intangible) return null;
    const dx = this.pos.x - apos.x, dz = this.pos.z - apos.z, d = Math.hypot(dx, dz);
    if (d - this.radius > range) return null;
    if (this.pos.y + this.height < apos.y - 1.2 || this.pos.y > apos.y + 2.6) return null;
    if (!full && d > this.radius) {
      const a = Math.abs(wrapAngle(Math.atan2(dx, dz) - ayaw));
      if (a > halfArc + Math.atan2(this.radius, d)) return null;
    }
    return 'body';
  }
  target() {
    if (this.aggro && G.time < this.aggro.until && this.aggro.target.alive) return this.aggro.target;
    this.aggro = null;
    return G.alex;
  }
  distTo(t = this.target()) { return Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z); }
  yawTo(t = this.target()) { return Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z); }
  los(t = this.target()) { return G.room.world.losClear(this.pos.x, this.pos.y + 1.2, this.pos.z, t.pos.x, t.pos.y + 1, t.pos.z); }
  atkK() { let k = 1; if (this.buff && G.time < this.buff.until) k *= 1.15; if (this.revived) k *= 1.15; return k * (G.room.enemyAtkK || 1); }
  moveK() { let k = 1; if (this.buff && G.time < this.buff.until) k *= 1.15; if (this.revived) k *= 1.15; return k; }
  telK() { return G.room.telegraphK || 1; }

  // Movement -----------------------------------------------------------------
  faceTarget(dt, rate = 10, t = this.target()) { this.yaw = dampAngle(this.yaw, this.yawTo(t), rate, dt); }
  steer(dt, dirx, dirz, speed, rate = 10) {
    const tx = dirx * speed * this.moveK(), tz = dirz * speed * this.moveK();
    this.vel.x = damp(this.vel.x, tx, rate, dt);
    this.vel.z = damp(this.vel.z, tz, rate, dt);
  }
  // Seek the target via LOS or the room's flow field (target = Alex).
  seek(dt, speed, opts = {}) {
    const t = this.target();
    let dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    const useFlow = t === G.alex && (opts.flow || !this.losCached());
    if (useFlow) {
      const f = G.room.world.flowDir(this.pos.x, this.pos.z);
      if (f) { dx = f[0]; dz = f[1]; }
    }
    if (opts.drift !== false) {
      const s = this.drift * (d > 3 ? 1 : 0.3);
      const px = -dz * s, pz = dx * s;
      dx += px; dz += pz;
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    }
    this.steer(dt, dx, dz, speed);
    this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
    return d;
  }
  losCached() {
    if (!this._losT || G.time - this._losT > 0.25) { this._losT = G.time; this._los = this.los(G.alex); }
    return this._los;
  }
  // Keep a preferred range band, strafing when inside it.
  kite(dt, min, max, speed) {
    const t = this.target();
    const d = this.distTo(t);
    let dx = (t.pos.x - this.pos.x) / (d || 1), dz = (t.pos.z - this.pos.z) / (d || 1);
    if (d > max || !this.losCached()) return this.seek(dt, speed);
    if (d < min) this.steer(dt, -dx, -dz, speed);
    else { const s = this.drift > 0 ? 1 : -1; this.steer(dt, -dz * s * 0.6, dx * s * 0.6, speed * 0.6, 4); }
    this.faceTarget(dt, 8);
    return d;
  }
  stop(dt, rate = 12) { this.vel.x = damp(this.vel.x, 0, rate, dt); this.vel.z = damp(this.vel.z, 0, rate, dt); }

  _physics(dt) {
    const w = G.room.world;
    if (!this.flying) {
      if (this.pos.y > this.groundH + 0.01 || this.vel.y > 0) this.vel.y -= 26 * dt;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    const contacts = w.collide(this.pos, this.radius, this.height, { ignoreClutter: true, stepUp: 0.6 });
    this.hitWall = contacts.find((c) => c.block.wall || c.block.y1 > this.pos.y + 1) || null;
    this.contactBlocks = contacts;
    const g = w.groundAt(this.pos.x, this.pos.z, this.pos.y, this.radius * 0.6, 0.6);
    this.groundH = g.h;
    if (this.flying) { this.pos.y = damp(this.pos.y, g.h + (this.hover || 0), 6, dt); }
    else if (this.pos.y <= g.h) { this.pos.y = g.h; if (this.vel.y < 0) { if (this.airborne && this.vel.y < -6) this._bounce(); this.vel.y = 0; } this.airborne = false; }
    // separation from other enemies
    for (const o of G.room.enemies) {
      if (o === this || !o.alive || o.intangible) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz), min = this.radius + o.radius;
      if (d < min && d > 1e-4) { const push = (min - d) * 0.5; this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push; }
    }
    // push Alex a little (can't walk through bodies)
    const a = G.alex;
    if (a.state !== 'dash' && !this.intangible && this.targetable()) {
      const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z, d = Math.hypot(dx, dz), min = this.radius + a.radius * 0.8;
      if (d < min && d > 1e-4 && Math.abs(a.pos.y - this.pos.y) < this.height) { const push = (min - d); a.pos.x += (dx / d) * push; a.pos.z += (dz / d) * push; }
    }
  }
  _bounce() { G.fx.burst(this.pos.x, this.pos.y + 0.1, this.pos.z, { n: 6, kind: 'smoke', color: '#ccc', speed: 2, up: 0.1, life: 0.3, size: 0.4, grav: 0 }); }

  // Action sequences -------------------------------------------------------------
  // steps: [{ t, start(), update(dt, k), end(), threat: bool }]
  act(steps) { this.seq = { steps, i: -1, t: 0 }; this._next(); }
  _next() {
    const s = this.seq;
    if (s.i >= 0 && s.steps[s.i].end) s.steps[s.i].end.call(this);
    s.i++;
    s.t = 0;
    if (!this.seq || s.i >= s.steps.length) { if (this.seq === s) this.seq = null; this.threatT = 0; return; }
    const st = s.steps[s.i];
    if (st.start) st.start.call(this);
  }
  _runSeq(dt) {
    const s = this.seq;
    const st = s.steps[s.i];
    s.t += dt;
    const dur = typeof st.t === 'function' ? st.t.call(this) : st.t;
    if (st.update) st.update.call(this, dt, Math.min(1, s.t / Math.max(1e-4, dur)));
    if (this.seq === s && s.t >= dur) this._next();
  }
  interrupt() {
    if (this.seq) { const st = this.seq.steps[this.seq.i]; if (st && st.cancel) st.cancel.call(this); }
    this.seq = null;
    this.threatT = 0;
    this.setEmissive('#000', 0);
    this.onInterrupt?.();
  }
  // A telegraph step: glow + "!" + optional threat timing for off-screen indicators.
  tele(dur, color = '#ff2e7e', { sound = true, target = true } = {}) {
    const self = this;
    const d = dur / this.atkK() * this.telK();
    return {
      t: d,
      start() { if (sound) G.audio.sfx('tele', { pan: G.cam.panOf(self.pos.x, self.pos.z), p: 0.9 + Math.random() * 0.2, gap: 0.05 }); self.threatDur = d; self.threatTarget = target; G.hud.threatStart(self); },
      update(dt, k) { self.threatT = d * (1 - k); self.setEmissive(color, 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(k * 30))); },
      end() { self.threatT = 0; self.setEmissive('#000', 0); },
    };
  }
  wait(t, update) { return { t, update }; }

  // Damage out --------------------------------------------------------------------
  hitAlexMelee(range, arcDeg, dmg, knock = 4, kind = 'melee') {
    const a = G.alex;
    const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    let hit = false;
    if (d < range + a.radius && Math.abs(a.pos.y - this.pos.y) < 2) {
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - this.yaw)) * 180 / Math.PI;
      if (ang <= arcDeg / 2 || d < this.radius + 0.4) { a.hurt(dmg, { source: this, kind, dir: [dx, dz], knock }); hit = true; }
    }
    return hit;
  }
  hitEnemiesMelee(range, arcDeg, dmg, knock = 4) {
    for (const e of G.room.enemies) {
      if (e === this || !e.alive || !e.targetable()) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d - e.radius > range) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - this.yaw)) * 180 / Math.PI;
      if (ang <= arcDeg / 2) e.hurt(dmg, { source: this, dir: [dx, dz], knock, friendly: true });
    }
  }
  shoot(o) {
    return G.projectiles.spawn({ owner: this, x: this.pos.x, y: this.pos.y + this.height * 0.6, z: this.pos.z, ...o });
  }

  // Damage in ------------------------------------------------------------------------
  hurt(dmg, info = {}) {
    if (!this.alive || this.intangible) return null;
    if (this.disguised) this.reveal?.();
    if (!this.targetable() && info.source === G.alex) return null;
    const routed = this.routeDamage ? this.routeDamage(dmg, info) : { dmg, result: 'hit' };
    if (!routed) return null;
    dmg = routed.dmg * (this.dmgTakenK ? this.dmgTakenK(info) : 1);
    if (dmg > 0) {
      this.hp -= dmg;
      this.flashT = 0.1;
      if (G.settings.damageNumbers) G.hud.damageNumber(this.pos.x, this.pos.y + this.height + 0.3, this.pos.z, Math.round(dmg), info.perfect ? 'crit' : info.friendly ? 'friendly' : routed.result === 'armor' ? 'armor' : 'enemy');
    }
    if (info.source === G.alex) G.run.stat('damageDealt', dmg);
    // Akgae-style aggro on friendly fire
    if (info.friendly && info.source && info.source !== G.alex && info.source.alive && this.onFriendlyHit) this.onFriendlyHit(info.source);
    if (this.hp <= 0) { this.die(info); return 'dead'; }
    // knockback / launch / stagger
    const [kx, kz] = info.dir || [0, 0];
    const kl = Math.hypot(kx, kz) || 1;
    const knock = (info.knock ?? 2) * (this.heavy ? 0.25 : 1);
    this.vel.x += (kx / kl) * knock; this.vel.z += (kz / kl) * knock;
    let poiseK = 1;
    if (this.buff && G.time < this.buff.until) poiseK = 1.2;
    this.poise += ((info.stagger ?? 1) * 7 + dmg * 0.25) / poiseK;
    if (info.launch && !this.heavy && !this.flying) { this.vel.y = info.launch; this.airborne = true; this.poise = this.poiseMax; }
    if (this.poise >= this.poiseMax || info.perfect) {
      this.poise = 0;
      this.stagger(info.launch ? 0.9 : 0.35 + (info.stagger || 1) * 0.08);
    }
    this.onHurt?.(dmg, info);
    return routed.result;
  }
  stagger(t) {
    if (this.unstaggerable) return;
    this.interrupt();
    this.stunUntil = Math.max(this.stunUntil, G.time + t);
  }
  stun(t) { this.stagger(t); G.hud.bubble(this, 'STUNNED', '#ffd60a', 0.8); }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.interrupt();
    this.threatT = 0;
    const room = G.room;
    const c = this.aimPoint(tmp);
    G.fx.burst(c.x, c.y, c.z, { n: 20, color: ['#ff4fa3', '#b388ff', '#ffffff'], speed: 7, life: 0.5 });
    G.fx.hearts(c.x, c.y, c.z, 4, '#b388ff');
    G.fx.burst(c.x, c.y, c.z, { n: 10, kind: 'smoke', color: '#6a4c93', speed: 2, up: 0.4, life: 0.8, size: 0.7, grav: -0.5 });
    G.audio.sfx('die', { pan: G.cam.panOf(this.pos.x, this.pos.z), p: 0.9 + Math.random() * 0.3 });
    G.run.stat('kills', 1);
    if (info.source !== G.alex) G.run.stat('assistedKills', 1);
    room.onEnemyDeath(this, info);
    this.onDeath?.(info);
    this.group.parent?.remove(this.group);
    for (const m of this.mats) m.dispose();
  }

  // Frame ---------------------------------------------------------------------------
  update(dt) {
    if (!this.alive) return;
    // spawn rise
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt / 1.0);
      const e = 1 - (1 - this.spawnT) ** 3;
      if (this.model) this.model.group.position.y = -this.height * (1 - e);
      if (this.spawnPortal) { this.spawnPortal.material.opacity = 0.8 * (1 - this.spawnT); this.spawnPortal.rotation.z += dt * 4; }
      if (this.spawnT >= 1 && this.spawnPortal) { this.group.remove(this.spawnPortal); this.spawnPortal.geometry.dispose(); this.spawnPortal.material.dispose(); this.spawnPortal = null; }
      this.faceTarget(dt, 4);
      this._sync(dt);
      return;
    }
    if (this.burn && G.time < this.burn.until) {
      this.burnTick = (this.burnTick || 0) + dt;
      if (this.burnTick > 0.5) { this.burnTick = 0; this.hurt(this.burn.dps * 0.5, { source: G.alex, knock: 0, stagger: 0 }); if (!this.alive) return; G.fx.burst(this.pos.x, this.pos.y + 1, this.pos.z, { n: 3, color: ['#ff7b00', '#ffd60a'], speed: 1.5, up: 2, life: 0.4, grav: -2 }); }
    }
    const stunned = G.time < this.stunUntil || this.airborne;
    if (stunned) {
      this.stop(dt, this.airborne ? 0.5 : 6);
    } else if (this.seq) {
      this._runSeq(dt);
    } else if (this.ready() || this.preReady) {
      this.think(dt);
    } else {
      this.idle?.(dt);
      this.stop(dt);
      this.faceTarget(dt, 5);
    }
    if (this.flashT > 0) { this.flashT -= dt; this.setEmissive('#ffffff', this.flashT > 0 ? 0.9 : 0); }
    this._physics(dt);
    this._sync(dt, stunned);
  }
  _sync(dt, stunned) {
    this._dt = dt;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    if (this.model && this.model.anim) this.model.anim(this, dt, stunned);
    if (stunned && this.model) this.model.group.rotation.z = Math.sin(G.time * 30) * 0.08;
    else if (this.model) this.model.group.rotation.z = 0;
  }
  think() {}
}
