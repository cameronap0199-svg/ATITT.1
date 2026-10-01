// Alex: Flow Movement controller. Nearly every action transitions into another without
// returning to neutral: run ↔ dash ↔ jump ↔ vault ↔ wall kick ↔ attack. Quiet
// forgiveness (coyote time, buffers, vault grace, ledge protection, wall redirect,
// clutter clearing, melee magnetism) and a generous cancel hierarchy:
// Perfect Dodge/Dash → Jump → Movement → Attack animation → cosmetic animation.

import * as THREE from 'three';
import { G, slowMo, hitStop } from '../state.js';
import { MOVE, JUMP, DASH, WALLKICK, VAULT, LAND, PLAYER, TARGET } from '../config.js';
import { clamp, damp, dampAngle, wrapAngle, easeOutCubic, lerp } from '../core/math.js';
import { AlexModel } from './alexModel.js';
import { MELEE, RANGED } from '../combat/weapons.js';
import { useGadget } from '../gadgets.js';

const tmpV = new THREE.Vector3();
const aimV = new THREE.Vector3();

export class Alex {
  constructor(scene) {
    this.model = new AlexModel();
    this.model.addTo(scene);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = MOVE.radius;
    this.height = MOVE.height;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.renderOrder = 1;
    scene.add(sh);
    this.shadow = sh;
    this.reset();
  }

  reset() {
    this.alive = true;
    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.state = 'move';
    this.yaw = 0;
    this.aimYaw = 0;
    this.grounded = true;
    this.groundY = 0;
    this.lastGrounded = 0;
    this.airPeak = 0;
    this.airDashes = 0;
    this.wallKicks = 0;
    this.airCombo = 0;
    this.comboIdx = 0;
    this.comboResetAt = 0;
    this.charges = DASH.charges;
    this.rechargeT = 0;
    this.iframeUntil = 0;
    this.perfectUntil = 0;
    this.perfectBonusUntil = 0;
    this.lastPerfect = -9;
    this.mercyUntil = 0;
    this.safeUntil = 0;
    this.fireCd = 0;
    this.aimT = 0;
    this.runT = 0;
    this.phase = 0;
    this.ledgeT = 0;
    this.jumped = false;
    this.jumpCut = false;
    this.controlLock = 0;
    this.chargeT = 0;
    this.wallPlant = null;
    this.launchUntil = 0;
    this.spinT = 0; this.spinKind = null; this.spinDur = 0.35;
    this.atk = null; this.dash = null; this.vault = null; this.land = null;
    this.hurtT = 0;
    this.deadT = 0;
    this.grabber = null;
    this.comboBuild = 0; this.comboBuildAt = 0;
    this.shield = 0; this.absorb = 0; this.lastHitAt = -99; this.fireTrail = []; this.fireDropT = 0;
    this.vel.set(0, 0, 0);
    this.model.setVisible(true);
    this.model.body.rotation.set(0, 0, 0);
  }

  get mods() { return G.run.mods; }
  center(out = tmpV) { return out.set(this.pos.x, this.pos.y + 1.0, this.pos.z); }
  maxCharges() { return DASH.charges + (this.mods.dashCharges || 0); }
  facing() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  stickyTarget() { return !!(this.atk && (this.atk.kind !== 'combo' || this.comboIdx > 0)) || this.chargeT > 0.2 || (!this.grounded && this.airCombo > 0); }
  movingForward() {
    const [fx, fz] = G.cam.forward();
    const s = Math.hypot(this.vel.x, this.vel.z) || 1;
    return (this.vel.x * fx + this.vel.z * fz) / s > -0.35;
  }
  isInvulnerable() { return G.time < this.safeUntil || G.time < this.mercyUntil || (this.state === 'dash' && G.time < this.iframeUntil); }
  spawnSafe(t = PLAYER.spawnSafe) { this.safeUntil = Math.max(this.safeUntil, G.time + t); }

  place(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.aimYaw = yaw;
    this.state = 'move';
    this.atk = this.dash = this.vault = this.land = null;
    this.grounded = true; this.groundY = y; this.airPeak = y;
    this.model.scarfInit = false;
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = yaw;
  }

  // -------------------------------------------------------------------------
  update(dt) {
    if (this.state === 'dead') { this._deadUpdate(dt); return; }
    const inp = G.input, S = G.settings, m = this.mods, now = G.time;
    const world = G.room.world;

    // dash charges refill one after another
    const maxC = this.maxCharges();
    if (this.charges < maxC) {
      this.rechargeT -= dt * (m.dashRechargeMul || 1);
      if (this.rechargeT <= 0) { this.charges++; this.rechargeT = this.charges < maxC ? DASH.recharge : 0; }
    }
    this.controlLock = Math.max(0, this.controlLock - dt);

    // camera-relative input
    const [fx, fz] = G.cam.forward(), [rx, rz] = G.cam.right();
    const locked = G.run.inputLocked;
    const mag = locked ? 0 : inp.move.mag;
    let dx = fx * inp.move.y + rx * inp.move.x, dz = fz * inp.move.y + rz * inp.move.x;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-4) { dx /= dl; dz /= dl; }
    this.inDir = [dx, dz, mag];
    if (mag > 0.3) G.targeting.onApproach(dx, dz);

    const wantJump = !locked && inp.buffered('jump', JUMP.buffer);
    const wantDash = !locked && inp.buffered('dash', DASH.buffer);
    const meleePressed = !locked && inp.buffered('melee', PLAYER.inputQueue);
    const meleeHeld = !locked && inp.isHeld('melee');

    // charge (hold melee on the ground → Rising Encore launcher on release)
    if (meleeHeld && this.grounded && (this.state === 'move' || this.state === 'attack')) this.chargeT += dt; else if (!meleeHeld) {
      if (this.chargeT > 0.45 && this.grounded && (this.state === 'move' || this.state === 'attack') && !locked) { this.chargeT = 0; this._startAttack('charged'); }
      this.chargeT = 0;
    }

    // --- state machine --------------------------------------------------
    switch (this.state) {
      case 'move': this._move(dt, wantJump, wantDash, meleePressed, meleeHeld); break;
      case 'dash': this._dashUpdate(dt, wantJump, meleePressed); break;
      case 'vault': this._vaultUpdate(dt, wantDash); break;
      case 'land': this._landUpdate(dt, wantJump, wantDash, meleePressed); break;
      case 'attack': this._attackUpdate(dt, wantJump, wantDash, meleePressed, meleeHeld); break;
      case 'hurt':
        this.hurtT -= dt;
        if (wantDash && this.charges > 0) { this._startDash(); break; }
        this._physics(dt, 0, 0, 0, false);
        if (this.hurtT <= 0) this.state = 'move';
        break;
      case 'grabbed': this._grabbedUpdate(dt, meleePressed); break;
    }
    this._ranged(dt);
    this._zones(dt);
    this._shieldTick(dt);
    this._fireTrail(dt);
    if (!locked && G.input.pressed('gadget') && this.state !== 'grabbed' && !this.vehicle) useGadget();
    this._animate(dt);
  }

  // Overshield-style recharging shield (Halo items) + Golden Apple absorption.
  _shieldTick(dt) {
    const max = this.mods.shield || 0;
    if (this.shield > max) this.shield = max;
    if (max > 0 && this.shield < max && G.time - this.lastHitAt > 4) {
      if (this.shield === 0 && !this._recharging) { this._recharging = true; G.audio.sfx('heartUp', { v: 0.4 }); }
      this.shield = Math.min(max, this.shield + 28 * dt);
    } else this._recharging = false;
  }
  // Flame-Flame Fruit: dashing leaves fire that burns demons.
  _fireTrail(dt) {
    if (this.mods.fireDash && this.state === 'dash') {
      this.fireDropT -= dt;
      if (this.fireDropT <= 0) { this.fireDropT = 0.045; this.fireTrail.push({ x: this.pos.x, z: this.pos.z, t: 1.8 }); }
    }
    if (!this.fireTrail.length) return;
    for (const f of this.fireTrail) {
      f.t -= dt;
      if (Math.random() < dt * 10) G.fx.burst(f.x, 0.2, f.z, { n: 1, color: ['#ff7b00', '#ffd60a', '#ff2e00'], speed: 0.6, up: 2.2, life: 0.45, size: 0.3, grav: -2, kind: 'spark' });
      for (const e of G.room.enemies) {
        if (!e.alive || e.intangible || e.flying) continue;
        if (Math.hypot(e.pos.x - f.x, e.pos.z - f.z) < e.radius + 0.7 && !(e.burn && G.time < e.burn.until - 1.6)) { e.burn = { until: G.time + 2.2, dps: 8 * (this.mods.dmgMul || 1) }; e.hurt(2, { source: this, knock: 0, stagger: 0, fire: true }); }
      }
    }
    this.fireTrail = this.fireTrail.filter((f) => f.t > 0);
  }

  // -------------------------------------------------------------------------
  _move(dt, wantJump, wantDash, meleePressed, meleeHeld) {
    const inp = G.input, now = G.time;
    const [dx, dz, mag] = this.inDir;
    // priority: dash → jump/vault/wall kick → attack → movement
    if (wantDash && this.canDash()) { this._startDash(); return; }
    if (wantJump) {
      const coyote = now - this.lastGrounded <= JUMP.coyote && !this.jumped;
      if (this.grounded || coyote) {
        const v = mag > 0.3 ? this._findVault(dx, dz) : null;
        if (v) { G.input.consume('jump'); this._startVault(v); return; }
        G.input.consume('jump');
        this._jump();
      } else if (this.wallKicks < WALLKICK.perAir) {
        const w = this._findWall();
        if (w) { G.input.consume('jump'); this._wallKick(w); }
      }
    }
    if (meleePressed && this.chargeT < 0.2) {
      G.input.consume('melee');
      // melee while pulling back (toward the camera) = Rising Encore launcher
      const pullBack = G.input.move.y < -0.6 && Math.abs(G.input.move.x) < 0.5;
      if (now < this.perfectBonusUntil) this._startAttack('counter');
      else if (this.grounded && pullBack) this._startAttack('charged');
      else this._startAttack(this.grounded ? 'combo' : 'air');
      return;
    }
    if (G.settings.rapidFire && meleeHeld && this.chargeT < 0.2 && this.grounded === false && now > this.comboResetAt - 0.3 && this.airCombo > 0 && this.airCombo < 3) {
      this._startAttack('air');
      return;
    }
    // wall plant: airborne, falling, pushing into a wall
    if (!this.grounded && this.vel.y < 0 && mag > 0.3 && this.wallKicks < WALLKICK.perAir) {
      const w = this._findWall(0.15);
      if (w && dx * -w.nx + dz * -w.nz > 0.5) {
        this.wallPlant = this.wallPlant || { t: 0, nx: w.nx, nz: w.nz };
        this.wallPlant.t += dt;
        if (this.wallPlant.t < 0.55) this.vel.y = Math.max(this.vel.y, -1.8);
      } else this.wallPlant = null;
    } else if (this.grounded) this.wallPlant = null;

    this._physics(dt, dx, dz, mag, true);
  }

  canDash() {
    if (this.charges <= 0) return false;
    if (!this.grounded && this.airDashes >= 1 + (this.mods.airDashes || 0)) return false;
    return true;
  }

  // Horizontal acceleration + gravity + collision.
  _physics(dt, dx, dz, mag, control) {
    const S = G.settings, m = this.mods;
    const zone = this.zone;
    let speed = MOVE.runSpeed;
    const full = S.autoSprint || G.input.device !== 'pad' || mag >= MOVE.walkTilt;
    if (!full) speed *= 0.45 + 0.55 * (mag / MOVE.walkTilt);
    if (mag > 0.3 && full) this.runT += dt; else this.runT = 0;
    if ((S.autoSprint && mag > 0.3) || this.runT > MOVE.sprintAfter) speed = MOVE.sprintSpeed;
    this.sprinting = speed >= MOVE.sprintSpeed && mag > 0.3;
    speed *= (m.moveMul || 1);
    if (zone && zone.type === 'sticky') speed *= 0.6;
    const air = !this.grounded;
    let accel = MOVE.runSpeed / MOVE.accelTime, decel = MOVE.runSpeed / MOVE.decelTime;
    if (zone && zone.type === 'grease' && !air) { accel *= 0.22; decel *= 0.12; }
    if (air) { accel *= MOVE.airControl; decel *= 0.25; }
    if (this.controlLock > 0) { accel *= 0.15; decel = 0; }
    if (!control) { mag = 0; decel = this.grounded ? decel * 0.5 : 0; }
    const tx = dx * speed * (mag > 0.05 ? 1 : 0), tz = dz * speed * (mag > 0.05 ? 1 : 0);
    const vx = this.vel.x, vz = this.vel.z;
    if (mag > 0.05) {
      const dot = vx * dx + vz * dz;
      const k = dot < 0 ? MOVE.reverseBoost : 1;
      const ax = tx - vx, az = tz - vz, al = Math.hypot(ax, az);
      const step = accel * k * dt;
      if (al <= step) { this.vel.x = tx; this.vel.z = tz; } else { this.vel.x += (ax / al) * step; this.vel.z += (az / al) * step; }
      // turn toward travel direction (legs); torso handles aiming
      this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), air ? 10 : 20, dt);
    } else {
      const sp = Math.hypot(vx, vz);
      if (sp > 0) { const ns = Math.max(0, sp - decel * dt); this.vel.x *= ns / sp; this.vel.z *= ns / sp; }
    }
    // variable jump height
    if (this.jumped && !this.jumpCut && this.vel.y > 0 && !G.input.isHeld('jump')) { this.vel.y *= JUMP.cutMul; this.jumpCut = true; }
    this._integrate(dt);
  }

  _integrate(dt, opts = {}) {
    const world = G.room.world;
    const prev = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    const wasGrounded = this.grounded;
    const oldGround = this.groundY;
    if (!this.grounded || this.vel.y > 0) {
      const g = this.vel.y > 0 ? JUMP.gravityUp : JUMP.gravityDown;
      if (!opts.noGravity) this.vel.y = Math.max(-JUMP.maxFall, this.vel.y - g * dt);
    }
    const dist = Math.hypot(this.vel.x, this.vel.z) * dt;
    const steps = Math.max(1, Math.ceil(dist / 0.22));
    const ignoreClutter = this.state === 'dash' || this.state === 'vault';
    let contacts = [];
    for (let s = 0; s < steps; s++) {
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.z += (this.vel.z * dt) / steps;
      const c = world.collide(this.pos, this.radius, this.height, { ignoreClutter });
      if (c.length) contacts = contacts.concat(c);
    }
    this.pos.y += this.vel.y * dt;
    this.contacts = contacts;
    // contact responses
    for (const c of contacts) {
      const vn = this.vel.x * c.nx + this.vel.z * c.nz;
      if (c.block.clutter && this.grounded && this.state === 'move' && vn < -1 && c.block.y1 - this.pos.y <= JUMP.autoHop) {
        this.vel.y = 6.3; this.grounded = false; this.hopT = 0.3; // clears chairs, curbs, cables
        continue;
      }
      if (vn < 0) {
        if (this.state === 'dash' && this.dash) {
          const d = this.dash;
          const into = -(d.dx * c.nx + d.dz * c.nz);
          if (into > 0.86) { this._endDash(true); } else {
            // redirect along the wall instead of face-planting
            let tx = d.dx + c.nx * into, tz = d.dz + c.nz * into;
            const tl = Math.hypot(tx, tz) || 1;
            d.dx = tx / tl; d.dz = tz / tl; d.speedK = (d.speedK || 1) * DASH.wallRedirect;
          }
        }
        this.vel.x -= vn * c.nx; this.vel.z -= vn * c.nz;
      }
    }
    // ground
    const gnd = world.groundAt(this.pos.x, this.pos.z, this.pos.y, this.radius);
    if (this.vel.y <= 0 && this.pos.y <= gnd.h + 0.02) {
      this.pos.y = gnd.h;
      if (!wasGrounded) this._landed(this.airPeak - gnd.h);
      this.vel.y = 0;
      this.grounded = true;
    } else if (wasGrounded && this.vel.y <= 0 && this.pos.y - gnd.h < 0.55 && !this.hopT) {
      this.pos.y = gnd.h; this.vel.y = 0; this.grounded = true; // stick to stairs going down
    } else {
      if (this.grounded) { this.lastGrounded = G.time; this.airPeak = this.pos.y; }
      this.grounded = false;
    }
    if (this.hopT) this.hopT = Math.max(0, this.hopT - dt);
    if (!this.grounded) this.airPeak = Math.max(this.airPeak, this.pos.y);
    else { this.lastGrounded = G.time; this.jumped = false; }
    this.groundY = this.grounded ? this.pos.y : gnd.h;
    this.groundBlock = gnd.block;

    // ledge protection: in combat, don't stroll off big drops unless pushing on purpose
    if (G.settings.ledgeProtect && wasGrounded && !this.grounded && this.state === 'move' && !this.jumped && G.room.combatLive()) {
      const below = world.groundAt(this.pos.x, this.pos.z, this.pos.y - 0.01, this.radius * 0.2).h;
      if (oldGround - below > PLAYER.ledgeDrop) {
        this.ledgeT += dt;
        if (this.ledgeT < PLAYER.ledgePush) {
          this.pos.x = prev.x; this.pos.z = prev.z; this.pos.y = oldGround;
          this.vel.x *= 0.2; this.vel.z *= 0.2; this.vel.y = 0;
          this.grounded = true; this.groundY = oldGround;
        }
      }
    } else if (this.grounded) this.ledgeT = Math.max(0, this.ledgeT - dt * 2);
  }

  _jump(extra = 0) {
    this.vel.y = JUMP.velocity + extra;
    this.grounded = false;
    this.jumped = true; this.jumpCut = false;
    this.airPeak = this.pos.y;
    this.lastGrounded = -9;
    this.state = 'move';
    G.audio.sfx('jump');
    G.fx.burst(this.pos.x, this.pos.y + 0.05, this.pos.z, { n: 5, kind: 'smoke', color: '#ddd', speed: 1.5, up: 0.2, life: 0.4, size: 0.35, grav: 0 });
    // launcher follow-up: jump pulls Alex toward the airborne enemy
    if (G.time < this.launchUntil && this.launchTarget && this.launchTarget.alive) {
      const t = this.launchTarget;
      const ddx = t.pos.x - this.pos.x, ddz = t.pos.z - this.pos.z, l = Math.hypot(ddx, ddz) || 1;
      this.vel.y = JUMP.velocity + 3.2;
      this.vel.x = (ddx / l) * Math.min(9, l * 3); this.vel.z = (ddz / l) * Math.min(9, l * 3);
      this.yaw = Math.atan2(ddx, ddz);
      this.launchUntil = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Vault: jump + forward near waist/chest-high geometry → plant and clear it.
  _findVault(dx, dz) {
    const world = G.room.world;
    let best = null;
    for (const b of world.near(this.pos.x + dx, this.pos.z + dz, 1.8, [])) {
      if (!b.alive || !b.solid || b.wall) continue;
      const rel = b.y1 - this.pos.y;
      if (rel < VAULT.minH - 0.12 || rel > VAULT.maxH) continue;
      if (b.y0 > this.pos.y + 0.3) continue;
      const hit = b.rayHit(this.pos.x, this.pos.y + 0.25, this.pos.z, dx, 0, dz, VAULT.reach + this.radius);
      if (!hit) continue;
      if (!best || hit.t < best.t) best = { b, t: hit.t };
    }
    if (!best) return null;
    const b = best.b;
    let t = best.t;
    while (t < best.t + 5 && b.containsXZ(this.pos.x + dx * t, this.pos.z + dz * t, 0.02)) t += 0.08;
    const thick = t - best.t;
    const land = t + this.radius + 0.3;
    let ex = this.pos.x + dx * land, ez = this.pos.z + dz * land, ey;
    let onTop = thick > VAULT.maxThick;
    if (!onTop) {
      // far side must be free and not a huge drop
      const g = world.groundAt(ex, ez, b.y1, this.radius);
      const probe = { x: ex, y: g.h, z: ez };
      const before = { ...probe };
      world.collide(probe, this.radius, this.height, {});
      if (Math.hypot(probe.x - before.x, probe.z - before.z) > 0.15 || g.h < this.pos.y - 3) onTop = true;
      ey = g.h;
    }
    if (onTop) {
      const into = best.t + Math.min(1.1, thick * 0.5);
      ex = this.pos.x + dx * into; ez = this.pos.z + dz * into; ey = b.y1;
    }
    return { sx: this.pos.x, sy: this.pos.y, sz: this.pos.z, ex, ey, ez, top: b.y1, dx, dz, onTop, dur: VAULT.duration * clamp(land / 3.2, 0.75, 1.25), block: b };
  }
  _startVault(v) {
    this.vault = { ...v, t: 0 };
    this.state = 'vault';
    this.yaw = Math.atan2(v.dx, v.dz);
    this.jumped = true;
    G.audio.sfx('vault');
    this.atk = null;
  }
  _vaultUpdate(dt, wantDash) {
    const v = this.vault;
    v.t += dt;
    if (wantDash && v.t > 0.08 && this.charges > 0) { this.state = 'move'; this.grounded = false; this._startDash(); return; }
    const k = Math.min(1, v.t / v.dur);
    const e = easeOutCubic(k);
    const px = lerp(v.sx, v.ex, k), pz = lerp(v.sz, v.ez, k);
    const peak = v.top - v.sy + 0.35;
    const py = lerp(v.sy, v.ey, e) + Math.sin(Math.PI * k) * Math.max(0.25, peak - (v.ey - v.sy) * 0.5) * (v.onTop ? 0.6 : 1);
    this.vel.set((px - this.pos.x) / Math.max(dt, 1e-4), 0, (pz - this.pos.z) / Math.max(dt, 1e-4));
    this.pos.set(px, Math.max(py, v.onTop ? Math.min(py, v.top) : py), pz);
    if (k >= 1) {
      this.pos.set(v.ex, v.ey, v.ez);
      const sp = this.inDir[2] > 0.3 ? MOVE.runSpeed : MOVE.runSpeed * 0.4;
      this.vel.set(v.dx * sp, 0, v.dz * sp);
      this.state = 'move';
      this.grounded = true; this.airPeak = this.pos.y;
      this.vault = null;
      this.lastGrounded = G.time;
    }
  }

  // -------------------------------------------------------------------------
  _findWall(extra = 0) {
    const world = G.room.world;
    const r = this.radius + WALLKICK.reach + extra;
    for (const b of world.near(this.pos.x, this.pos.z, r + 0.5, [])) {
      if (!b.alive || !b.solid || b.clutter) continue;
      if (b.y1 < this.pos.y + 1.0 || b.y0 > this.pos.y + 1.0) continue;
      const hit = b.pushCircle(this.pos.x, this.pos.z, r);
      if (hit) return { nx: hit.nx, nz: hit.nz, b };
    }
    return null;
  }
  _wallKick(w) {
    this.wallKicks++;
    this.vel.set(w.nx * WALLKICK.out, WALLKICK.up, w.nz * WALLKICK.out);
    this.yaw = Math.atan2(w.nx, w.nz);
    this.controlLock = WALLKICK.lockout;
    this.jumped = true; this.jumpCut = false;
    this.airPeak = this.pos.y;
    this.wallPlant = null;
    this.spinKind = 'flipBack'; this.spinT = 0.001; this.spinDur = 0.4;
    G.audio.sfx('wallkick');
    G.fx.burst(this.pos.x - w.nx * 0.4, this.pos.y + 0.8, this.pos.z - w.nz * 0.4, { n: 10, color: '#ffffff', speed: 4, dir: [w.nx, w.nz], spread: 1.5, life: 0.3 });
    G.fx.ring(this.pos.x - w.nx * 0.4, this.pos.y + 0.8, this.pos.z - w.nz * 0.4, { r1: 1.2, life: 0.25 });
  }

  // -------------------------------------------------------------------------
  _startDash() {
    G.input.consume('dash');
    const [ix, iz, mag] = this.inDir;
    let dx = ix, dz = iz;
    if (mag < 0.2) [dx, dz] = this.facing();
    const air = !this.grounded;
    if (air) this.airDashes++;
    this.charges--;
    if (this.rechargeT <= 0) this.rechargeT = DASH.recharge;
    const now = G.time;
    const assist = { off: 0, low: 0.04, high: 0.09 }[G.settings.perfectAssist] || 0;
    this.iframeUntil = now + DASH.iframes + (this.mods.dashIframes || 0);
    this.perfectUntil = now + DASH.perfectWindow + assist + (this.mods.perfectWindow || 0);
    this.dash = { t: 0, dx, dz, air, ghostT: 0, speedK: 1, dist: DASH.distance * (this.mods.dashDist || 1) };
    this.state = 'dash';
    this.atk = null;
    this.wallPlant = null;
    this.yaw = Math.atan2(dx, dz);
    if (air) this.vel.y = 0;
    G.audio.sfx('dash');
    G.fx.speed(0.8);
    G.input.rumble(0.25, 60);
    G.fx.burst(this.pos.x, this.pos.y + 0.1, this.pos.z, { n: 6, kind: 'smoke', color: '#eee', speed: 2, dir: [-dx, -dz], spread: 1, up: 0.1, life: 0.35, size: 0.4, grav: 0 });
    G.run.stat('dashes', 1);
  }
  _dashUpdate(dt, wantJump, meleePressed) {
    const d = this.dash;
    d.t += dt;
    const k = Math.min(1, d.t / DASH.duration);
    // anticipation → burst → snap: most distance early, easing into the destination
    const v = (d.dist * 2 * (1 - k)) / DASH.duration * d.speedK + 1.5;
    this.vel.x = d.dx * v; this.vel.z = d.dz * v;
    if (d.air) this.vel.y = 0;
    d.ghostT -= dt;
    if (d.ghostT <= 0) { d.ghostT = 0.035; G.fx.ghost(this.model.root, G.time < this.perfectUntil ? '#67f3ff' : '#ff4fa3', 0.22, 0.4); }
    // Dash → Jump (keeps momentum)
    if (wantJump && (this.grounded || G.time - this.lastGrounded < JUMP.coyote) && d.t > 0.03) {
      G.input.consume('jump');
      this._endDash(false);
      this._jump();
      this.vel.x = d.dx * MOVE.sprintSpeed * 1.05; this.vel.z = d.dz * MOVE.sprintSpeed * 1.05;
      return;
    }
    if (wantJump && !this.grounded && this.wallKicks < WALLKICK.perAir) {
      const w = this._findWall();
      if (w) { G.input.consume('jump'); this._endDash(false); this._wallKick(w); return; }
    }
    // Dash → Attack
    if (meleePressed && d.t > 0.06) {
      G.input.consume('melee');
      this._endDash(false);
      this._startAttack(G.time < this.perfectBonusUntil ? 'counter' : 'dash');
      return;
    }
    this._integrate(dt, { noGravity: d.air });
    if (this.state === 'dash' && d.t >= DASH.duration) this._endDash(false);
  }
  _endDash(bonk) {
    const d = this.dash;
    if (!d) return;
    this.dash = null;
    if (this.state === 'dash') this.state = 'move';
    const running = this.inDir[2] > 0.2;
    const sp = bonk ? 0 : running ? MOVE.runSpeed : MOVE.runSpeed * 0.3;
    this.vel.x = d.dx * sp; this.vel.z = d.dz * sp;
    if (running) this.runT = MOVE.sprintAfter * 0.7;
    if (bonk) { G.audio.sfx('land', { v: 0.6 }); G.cam.shake(0.1); }
  }

  // -------------------------------------------------------------------------
  _landed(fall) {
    this.airDashes = 0; this.wallKicks = 0; this.airCombo = 0; this.wallPlant = null;
    this.jumped = false;
    if (this.state === 'attack' && this.atk && this.atk.kind === 'air') { this.atk = null; this.state = 'move'; }
    if (this.state === 'dash' || this.state === 'vault' || this.state === 'grabbed') return;
    if (fall > LAND.huge) {
      this.state = 'land';
      this.land = { t: 0, dur: LAND.hugeTime, huge: true };
      G.audio.sfx('landHeavy');
      G.cam.shake(0.45);
      G.input.rumble(0.8, 200);
      G.fx.ring(this.pos.x, this.pos.y, this.pos.z, { r1: 4, color: '#ffffff', life: 0.45 });
      G.fx.burst(this.pos.x, this.pos.y + 0.1, this.pos.z, { n: 18, kind: 'debris', color: ['#999', '#666', '#ccc'], speed: 6, up: 0.9, life: 0.7, size: 0.18 });
      for (const e of G.room.enemies) {
        if (e.alive && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 3 + e.radius) e.hurt(10 * (this.mods.dmgMul || 1), { source: this, dir: [e.pos.x - this.pos.x, e.pos.z - this.pos.z], knock: 7, stagger: 2, melee: true });
      }
      this.vel.x *= 0.2; this.vel.z *= 0.2;
    } else if (fall > LAND.medium) {
      this.state = 'land';
      this.land = { t: 0, dur: LAND.mediumTime, huge: false };
      G.audio.sfx('land', { v: 1 });
      G.cam.shake(0.12);
      G.fx.burst(this.pos.x, this.pos.y + 0.05, this.pos.z, { n: 8, kind: 'smoke', color: '#ddd', speed: 2.5, up: 0.1, life: 0.4, size: 0.4, grav: 0 });
    } else if (fall > 0.6) {
      G.audio.sfx('land', { v: 0.5 });
      G.fx.burst(this.pos.x, this.pos.y + 0.05, this.pos.z, { n: 4, kind: 'smoke', color: '#ddd', speed: 1.5, up: 0.1, life: 0.3, size: 0.3, grav: 0 });
    }
  }
  _landUpdate(dt, wantJump, wantDash, meleePressed) {
    const L = this.land;
    L.t += dt;
    const [dx, dz, mag] = this.inDir;
    const canCancel = !L.huge || L.t > LAND.hugeCancelAfter;
    if (canCancel && wantDash && this.canDash()) { this.state = 'move'; this.land = null; this._startDash(); return; }
    if (canCancel && wantJump) { G.input.consume('jump'); this.state = 'move'; this.land = null; this._jump(); return; }
    if (canCancel && meleePressed) { G.input.consume('melee'); this.state = 'move'; this.land = null; this._startAttack('combo'); return; }
    if (!L.huge && mag > 0.3) { this.state = 'move'; this.land = null; this.runT = MOVE.sprintAfter * 0.5; this._physics(dt, dx, dz, mag, true); return; }
    this._physics(dt, 0, 0, 0, false);
    if (L.t >= L.dur) { this.state = 'move'; this.land = null; }
  }

  // -------------------------------------------------------------------------
  // Melee
  _startAttack(kind) {
    const w = MELEE[G.run.weapons.melee] || MELEE.hunterBlade;
    let step;
    const now = G.time;
    if (now > this.comboResetAt) this.comboIdx = 0;
    if (kind === 'counter') step = w.counter;
    else if (kind === 'dash') step = w.dash;
    else if (kind === 'charged') step = w.charged;
    else if (kind === 'air') { step = w.air[Math.min(this.airCombo, w.air.length - 1)]; this.airCombo++; }
    else { step = w.combo[this.comboIdx % w.combo.length]; }
    const perfect = now < this.perfectBonusUntil;
    if (perfect) this.perfectBonusUntil = 0;
    // intended direction: stick > focus target > camera forward
    let [dx, dz, mag] = this.inDir;
    const fp = G.targeting.focusPos(aimV);
    if (mag < 0.3) {
      if (fp) { dx = fp.x - this.pos.x; dz = fp.z - this.pos.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; } else [dx, dz] = G.cam.forward();
    }
    const cone = TARGET.meleeCone[step.cone] || 55;
    const reach = this.mods.meleeRange || 0;
    const lungeMax = Math.min(step.lunge ?? 1, kind === 'dash' ? 2.4 : (w.lungeMax || TARGET.lungeMax)) + reach * 0.6;
    const tgt = G.targeting.meleeTarget(dx, dz, cone, step.range + reach + lungeMax + 0.5);
    let lunge = 0.3;
    if (tgt) {
      const tx = tgt.p.x - this.pos.x, tz = tgt.p.z - this.pos.z, l = Math.hypot(tx, tz) || 1;
      dx = tx / l; dz = tz / l;
      lunge = clamp(l - ((step.range + reach) * 0.55 + tgt.enemy.radius * 0.5), 0, lungeMax);
    }
    this.yaw = Math.atan2(dx, dz);
    this.aimYaw = this.yaw;
    this.atk = { step, kind, t: 0, phase: 'startup', hits: new Set(), lunge, dx, dz, target: tgt?.enemy || null, perfect, queued: false, hitAny: false };
    this.state = 'attack';
    this.chargeT = 0;
    G.targeting.onAttack();
    if (kind === 'counter' || perfect) { G.fx.flash(0.12, '#67f3ff'); this.spinKind = 'spin'; this.spinT = 0.001; this.spinDur = 0.3; }
    if (step.pose === 'spin' || step.pose === 'airSpin') { this.spinKind = step.pose === 'spin' ? 'spin' : 'flipFront'; this.spinT = 0.001; this.spinDur = step.startup + step.active + 0.06; }
    if (kind === 'air') this.vel.y = Math.max(this.vel.y, step.hover || 2);
  }
  _attackUpdate(dt, wantJump, wantDash, meleePressed, meleeHeld) {
    const a = this.atk, s = a.step, m = this.mods;
    const spd = m.attackSpeed || 1;
    a.t += dt * spd;
    const t1 = s.startup, t2 = s.startup + s.active, t3 = t2 + s.recover;
    const commit = s.commit && a.t < t2;
    // cancels
    if (wantDash && !commit && this.canDash()) { this.atk = null; this.state = 'move'; this._startDash(); return; }
    if (wantJump && a.t >= t2 && this.grounded) { G.input.consume('jump'); this.atk = null; this.state = 'move'; this._jump(); return; }
    if (meleePressed && a.t > t1 * 0.5) { a.queued = true; G.input.consume('melee'); }
    if (G.settings.rapidFire && meleeHeld && a.t > t2) a.queued = true;
    // lunge / motion
    if (a.t < t2) {
      const v = a.lunge / Math.max(0.05, t2) + (a.kind === 'dash' ? 3 : 0);
      this.vel.x = a.dx * v; this.vel.z = a.dz * v;
      if (a.kind === 'air') this.vel.y = Math.max(this.vel.y, (s.hover || 2) * 0.5);
    } else {
      const k = Math.exp(-14 * dt);
      this.vel.x *= k; this.vel.z *= k;
    }
    if (a.phase === 'startup' && a.t >= t1) {
      a.phase = 'active';
      G.audio.sfx(s.sfx || 'slash', { p: 0.9 + Math.random() * 0.2 });
      const col = (MELEE[G.run.weapons.melee] || MELEE.hunterBlade).color;
      const r = s.range + 0.2 + (m.meleeRange || 0);
      if (m.meleeRange && s.finisher && Math.random() < 0.5) G.hud.bubble(this, 'GUM-GUM… PISTOL!', '#fca5a5', 0.8);
      if (s.arc >= 360) G.fx.slash(this.pos.x, this.pos.y + 0.9, this.pos.z, this.yaw, { r, arc: Math.PI * 2, color: col, life: 0.22 });
      else G.fx.slash(this.pos.x, this.pos.y + (s.pose === 'launcher' ? 1.3 : 0.95), this.pos.z, this.yaw, { r, arc: (s.arc * Math.PI) / 180, color: col, tilt: s.pose === 'slash2' ? 0.3 : s.pose === 'launcher' ? 1.3 : -0.25, roll: s.pose === 'slash2' ? Math.PI : 0 });
    }
    if (a.phase === 'active') {
      this._meleeHit(a);
      if (a.t >= t2) a.phase = 'recover';
    }
    // movement input cancels the back half of recovery
    const [dx, dz, mag] = this.inDir;
    if (a.phase === 'recover') {
      const chainAt = t2 + s.recover * 0.25;
      if (a.queued && a.t >= chainAt) {
        this.atk = null;
        if (a.kind === 'combo' || a.kind === 'counter' || a.kind === 'dash') {
          const w = MELEE[G.run.weapons.melee] || MELEE.hunterBlade;
          this.comboIdx = a.kind === 'combo' ? (this.comboIdx + 1) % w.combo.length : 1;
          this.comboResetAt = G.time + 0.6;
          if (a.kind === 'combo' && this.comboIdx === 0) { this.state = 'move'; this.comboResetAt = 0; }
          else { this._startAttack(this.grounded ? 'combo' : 'air'); return; }
        } else if (a.kind === 'air' && this.airCombo < 3 && !this.grounded) { this._startAttack('air'); return; }
        else { this.state = 'move'; }
      }
      if (this.atk && mag > 0.3 && a.t > t2 + s.recover * 0.5) { this._finishAttack(); this._physics(dt, dx, dz, mag, true); return; }
      if (this.atk && a.t >= t3) { this._finishAttack(); }
    }
    this._integrate(dt, { noGravity: a.kind === 'air' && a.t < t2 });
  }
  _finishAttack() {
    const a = this.atk;
    this.atk = null;
    this.state = 'move';
    if (a.kind === 'combo') {
      const w = MELEE[G.run.weapons.melee] || MELEE.hunterBlade;
      const step = a.step;
      this.comboIdx = step.finisher ? 0 : (this.comboIdx + 1) % w.combo.length;
      this.comboResetAt = G.time + 0.35;
    }
  }

  _meleeHit(a) {
    const s = a.step, m = this.mods;
    const w = MELEE[G.run.weapons.melee] || MELEE.hunterBlade;
    const halfArc = (s.arc * Math.PI) / 360;
    for (const e of G.room.enemies) {
      if (!e.alive || e.intangible || a.hits.has(e)) continue;
      const part = e.meleeTest(this.pos, this.yaw, s.range + (m.meleeRange || 0), halfArc, s.arc >= 360);
      if (!part) continue;
      a.hits.add(e);
      a.hitAny = true;
      // Nunchuck combo build
      let build = 1;
      if (w.comboBuild) {
        if (G.time - this.comboBuildAt > 1.2) this.comboBuild = 0;
        this.comboBuild = Math.min(10, this.comboBuild + 1);
        this.comboBuildAt = G.time;
        build = 1 + this.comboBuild * w.comboBuild;
      }
      const perfectK = a.perfect ? 1.5 : 1;
      const crowd = w.crowdBonus ? 1 + w.crowdBonus * (a.hits.size - 1) : 1;
      const dmg = s.dmg * (m.dmgMul || 1) * (m.meleeMul || 1) * perfectK * build * crowd;
      const dealt = e.hurt(dmg, { source: this, dir: [e.pos.x - this.pos.x, e.pos.z - this.pos.z], knock: s.knock, stagger: s.stagger + (a.perfect ? 3 : 0), launch: s.launch, melee: true, part, perfect: a.perfect, finisher: s.finisher, pierceArmor: !!m.pierceArmor });
      if (s.launch && e.alive && !e.heavy) { this.launchTarget = e; this.launchUntil = G.time + 0.8; }
      if (m.stunChance && Math.random() < m.stunChance) e.stun?.(1);
      if (m.lifesteal && s.finisher) this.heal(m.lifesteal, true);
      G.targeting.onHit(e);
      const hp = e.aimPoint(aimV);
      G.fx.burst(hp.x, hp.y, hp.z, { n: s.finisher ? 16 : 9, color: [w.color, '#ffffff'], speed: s.finisher ? 9 : 6, life: 0.3, size: 0.16 });
      G.audio.sfx(s.finisher ? 'hitHeavy' : 'hit', { pan: G.cam.panOf(e.pos.x, e.pos.z) });
      hitStop(s.finisher || a.perfect ? 0.075 : 0.04);
      G.cam.shake(s.finisher ? 0.2 : 0.07);
      G.input.rumble(s.finisher ? 0.5 : 0.25, 50);
      if (dealt === 'armor') G.audio.sfx('armor');
    }
    if (G.room.damageBlocksInArc) G.room.damageBlocksInArc(this.pos.x, this.pos.z, this.yaw, s.range + (m.meleeRange || 0), halfArc, s.dmg * 0.8, a.hits);
  }

  // -------------------------------------------------------------------------
  // Ranged: fires while held, alongside movement, jumps, vaults and wall kicks.
  _ranged(dt) {
    const inp = G.input;
    const w = RANGED[G.run.weapons.ranged] || RANGED.micBlaster;
    this.fireCd -= dt;
    this.aimT = Math.max(0, this.aimT - dt);
    const blocked = this.state === 'dash' || this.state === 'dead' || (this.state === 'attack' && this.atk && this.atk.phase !== 'recover') || G.run.inputLocked;
    if (!inp.isHeld('ranged') || blocked) return;
    this.aimT = 0.45;
    if (this.fireCd > 0) return;
    this.fireCd = 1 / (w.rate * (this.mods.fireRate || 1));
    const aim = G.targeting.aimPoint(aimV);
    const [fx, fz] = [Math.sin(this.aimYaw), Math.cos(this.aimYaw)];
    const mx = this.pos.x + fx * 0.45 + fz * 0.2, my = this.pos.y + 1.3, mz = this.pos.z + fz * 0.45 - fx * 0.2;
    let dx = aim.x - mx, dy = aim.y - my, dz = aim.z - mz;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    this.aimYaw = Math.atan2(dx, dz);
    const n = w.count || 1;
    const perfect = G.time < this.perfectBonusUntil;
    if (perfect) this.perfectBonusUntil = 0;
    const dmgK = (this.mods.dmgMul || 1) * (this.mods.rangedMul || 1) * (perfect ? 1.5 : 1);
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i / (n - 1) - 0.5) * w.spread * 2 : (Math.random() - 0.5) * w.spread * 2;
      const c = Math.cos(off), s = Math.sin(off);
      const vx = dx * c + dz * s, vz = -dx * s + dz * c;
      const vy = dy + (w.grav ? 0.18 : 0) + (n === 1 ? (Math.random() - 0.5) * w.spread : 0);
      G.projectiles.spawn({
        hostile: false, kind: w.kind, x: mx, y: my, z: mz, vx: vx * w.speed, vy: vy * w.speed, vz: vz * w.speed,
        r: w.r, dmg: w.dmg * dmgK, knock: w.knock, stagger: (w.stagger || 0) + (perfect ? 3 : 0), pierce: w.pierce || 0,
        grav: w.grav || 0, life: w.life ?? 1.5, weapon: G.run.weapons.ranged, perfect, homing: w.homing || 0,
        onHit: (w.splash || w.burn || w.supercombine) ? (p, e) => this._rangedEffect(w, p, e) : null,
      });
    }
    G.audio.sfx(w.sfx, { v: 0.7, gap: 0.02 });
    if (w.shake) G.cam.shake(w.shake);
    G.run.stat('shotsFired', n);
    G.targeting.onAttack();
    if (w.kind !== 'flame') G.fx.burst(mx + dx * 0.3, my + dy * 0.3, mz + dz * 0.3, { n: 2, color: '#9ff6ff', speed: 2, life: 0.12, size: 0.12 });
  }
  _rangedEffect(w, p, e) {
    if (w.splash) {
      G.fx.burst(p.x, p.y, p.z, { n: 14, kind: 'confetti', color: ['#ff4fa3', '#fff', '#4cc9f0'], speed: 5, life: 0.8, size: 0.2 });
      for (const o of G.room.enemies) {
        if (!o.alive || o === e) continue;
        if (Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < w.splash + o.radius) o.hurt(w.splashDmg * (this.mods.dmgMul || 1), { source: this, dir: [o.pos.x - p.x, o.pos.z - p.z], knock: 5, ranged: true });
      }
    }
    if (w.burn && e && e.alive) e.burn = { until: G.time + 2, dps: w.burn };
    if (w.supercombine && e && e.alive) {
      if (G.time - (e.needleT || 0) > 3) e.needles = 0;
      e.needles = (e.needles || 0) + 1; e.needleT = G.time;
      if (e.needles >= w.supercombine) {
        e.needles = 0;
        G.fx.burst(p.x, p.y, p.z, { n: 30, color: ['#f472b6', '#fbcfe8', '#ffffff'], speed: 8, life: 0.5 });
        G.audio.sfx('boom', { v: 0.5 });
        G.hud.bubble(e, 'SUPERCOMBINE!', '#f472b6', 0.9);
        for (const o of G.room.enemies) if (o.alive && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 2.4 + o.radius) o.hurt(35 * (this.mods.dmgMul || 1), { source: this, dir: [o.pos.x - p.x, o.pos.z - p.z], knock: 7, stagger: 3, area: true });
      }
    }
  }

  // -------------------------------------------------------------------------
  _grabbedUpdate(dt, meleePressed) {
    // Parasocial pulls; Alex can fight back to break the grip
    if (meleePressed) {
      G.input.consume('melee');
      const w = MELEE[G.run.weapons.melee] || MELEE.hunterBlade;
      const step = w.combo[this.comboIdx % w.combo.length];
      this.comboIdx++;
      this.atk = { step: { ...step, arc: 360, range: step.range + 0.5 }, kind: 'grab', t: 0, hits: new Set(), dx: 0, dz: 0, lunge: 0 };
      this._meleeHit(this.atk);
      G.audio.sfx('slash');
      G.fx.slash(this.pos.x, this.pos.y + 1, this.pos.z, this.yaw, { r: 2, arc: Math.PI * 2, color: w.color });
      this.atk = null;
      this.spinKind = 'spin'; this.spinT = 0.001; this.spinDur = 0.25;
    }
    if (!this.grabber || !this.grabber.alive) this.release();
  }
  grab(by) {
    if (this.state === 'dead' || this.isInvulnerable()) return false;
    this.state = 'grabbed';
    this.grabber = by;
    this.atk = this.dash = this.vault = this.land = null;
    this.vel.set(0, 0, 0);
    return true;
  }
  pullToward(x, z, speed, dt) {
    const dx = x - this.pos.x, dz = z - this.pos.z, l = Math.hypot(dx, dz);
    if (l > 0.05) { this.vel.x = (dx / l) * speed; this.vel.z = (dz / l) * speed; }
    this.yaw = Math.atan2(-dx, -dz);
    this._integrate(dt);
  }
  release(knock) {
    if (this.state !== 'grabbed') return;
    this.state = 'move';
    this.grabber = null;
    this.mercyUntil = Math.max(this.mercyUntil, G.time + 0.35);
    if (knock) { this.vel.x = knock[0]; this.vel.z = knock[1]; this.vel.y = 4; this.grounded = false; }
  }

  // -------------------------------------------------------------------------
  // Damage
  testProjectile(p) {
    // a projectile Alex already dodged through never hits him afterwards
    if (p.dodged) return 'pass';
    const y0 = this.pos.y + 0.35, y1 = this.pos.y + this.height - 0.3;
    const py = clamp(p.y, y0, y1);
    const d = Math.hypot(p.x - this.pos.x, p.y - py, p.z - this.pos.z);
    const hitR = p.r * 0.9 + 0.3;
    if (d < hitR) {
      const res = this.hurt(p.dmg, { source: p.owner, kind: 'proj', dir: [p.vx, p.vz], knock: p.knock, water: p.tag === 'water' });
      if (res === 'dodged') p.dodged = true;
      return res === 'hit' ? 'hit' : 'pass';
    }
    if (!p.grazed && this.state === 'dash' && G.time < this.perfectUntil && d < hitR + DASH.perfectGraze) { p.grazed = true; p.dodged = true; this._perfect(); }
    return 'pass';
  }

  hurt(dmg, info = {}) {
    if (this.state === 'dead' || !this.alive) return 'immune';
    const now = G.time;
    if (now < this.safeUntil || G.run.godMode) return 'immune';
    if (this.state === 'dash' && now < this.iframeUntil) {
      if (now < this.perfectUntil) this._perfect(info);
      return 'dodged';
    }
    if (now < this.mercyUntil) return 'immune';
    if (!(dmg > 0)) return 'immune';
    if (info.kind === 'proj' && this.mods.faithBlock && Math.random() < this.mods.faithBlock) {
      G.hud.bubble(this, 'SHIELD OF FAITH', '#fde68a', 0.7);
      G.fx.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, { n: 10, color: ['#fde68a', '#ffffff'], speed: 4, life: 0.3 });
      G.audio.sfx('armor', { v: 0.5 });
      this.mercyUntil = now + 0.2;
      return 'dodged';
    }
    if (info.water && this.mods.devilFruit) { dmg *= 2; G.hud.bubble(this, 'CAN\'T SWIM!', '#7dd3fc', 0.7); }
    let amount = Math.max(1, Math.round(dmg * (this.mods.dmgTakenMul || 1)));
    this.lastHitAt = now;
    const soak = (pool) => { const s = Math.min(this[pool], amount); this[pool] -= s; amount -= s; return s; };
    const soaked = soak('absorb') + soak('shield');
    if (soaked > 0) {
      G.hud.damageNumber(this.pos.x, this.pos.y + 2.3, this.pos.z, Math.round(soaked), 'shield');
      G.fx.burst(this.pos.x, this.pos.y + 1.1, this.pos.z, { n: 8, color: ['#7dd3fc', '#ffffff'], speed: 4, life: 0.3 });
      if (this.shield <= 0 && (this.mods.shield || 0) > 0 && soaked > 0) G.audio.sfx('armor', { v: 0.6 });
      if (amount <= 0) { this.mercyUntil = now + PLAYER.mercy * 0.6; G.audio.sfx('armor', { v: 0.4 }); G.cam.shake(0.12); return 'hit'; }
    }
    this.hp -= amount;
    G.run.stat('damageTaken', amount);
    G.run.stat('timesHit', 1);
    this.mercyUntil = now + PLAYER.mercy;
    const [kx, kz] = info.dir || [0, 0];
    const kl = Math.hypot(kx, kz) || 1;
    const knock = info.knock ?? 3;
    if (this.state !== 'grabbed') {
      this.vel.x = (kx / kl) * knock; this.vel.z = (kz / kl) * knock;
      if (knock > 4 && this.grounded) { this.vel.y = 3; this.grounded = false; }
      if (!(this.atk && this.atk.step.commit)) { this.atk = null; this.vault = null; this.land = null; this.dash = null; this.state = 'hurt'; this.hurtT = 0.22; }
    }
    G.fx.hurtVignette(0.55 + amount / 40);
    G.cam.shake(0.3 + amount / 60);
    G.audio.sfx('hurt');
    G.input.rumble(0.6, 150);
    G.hud.damageNumber(this.pos.x, this.pos.y + 2, this.pos.z, amount, 'alex');
    G.fx.burst(this.pos.x, this.pos.y + 1, this.pos.z, { n: 10, color: ['#ff2e4d', '#ffffff'], speed: 5, life: 0.35 });
    hitStop(0.06);
    if (this.hp <= 0) {
      if (G.run.consumeRevive()) {
        this.hp = Math.round(this.maxHp * 0.5);
        this.mercyUntil = now + 2;
        G.hud.popup('EXTENDED WARRANTY CLAIMED', '#3cff8f');
        G.audio.sfx('heal');
        G.fx.flash(0.4, '#3cff8f');
      } else this._die();
    }
    return 'hit';
  }

  _perfect() {
    const now = G.time;
    if (now - this.lastPerfect < 0.3) return;
    this.lastPerfect = now;
    slowMo(DASH.perfectSlow, DASH.perfectScale);
    this.perfectBonusUntil = now + 1.4;
    this.spinKind = 'dodge'; this.spinT = 0.001; this.spinDur = 0.35;
    G.audio.sfx('perfect');
    G.fx.ring(this.pos.x, this.pos.y + 0.05, this.pos.z, { r1: 3.2, color: '#67f3ff', life: 0.35 });
    G.fx.burst(this.pos.x, this.pos.y + 1, this.pos.z, { n: 14, color: ['#67f3ff', '#ffffff'], speed: 6, life: 0.4 });
    G.fx.flash(0.15, '#67f3ff');
    G.hud.popup('PERFECT!', '#67f3ff', 0.8);
    G.input.rumble(0.4, 80);
    G.run.stat('perfectDodges', 1);
  }

  heal(n, quiet) {
    n *= this.mods.healMul || 1;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    const got = this.hp - before;
    if (got > 0) {
      G.run.stat('healthRecovered', got);
      if (!quiet) { G.audio.sfx('heal'); G.fx.hearts(this.pos.x, this.pos.y + 1.4, this.pos.z, 5, '#3cff8f'); }
      G.hud.damageNumber(this.pos.x, this.pos.y + 2.1, this.pos.z, '+' + Math.round(got), 'heal');
    }
    return got;
  }

  _die() {
    this.hp = 0;
    this.state = 'dead';
    this.alive = false;
    this.deadT = 0;
    this.atk = this.dash = null;
    slowMo(1.2, 0.3);
    G.audio.sfx('die');
    G.fx.flash(0.4, '#ff2e4d');
    G.cam.shake(0.6);
    G.run.onDeath();
  }
  _deadUpdate(dt) {
    this.deadT += dt;
    this.vel.x *= Math.exp(-3 * dt); this.vel.z *= Math.exp(-3 * dt);
    this._integrate(dt);
    const k = Math.min(1, this.deadT / 0.6);
    this.model.body.rotation.x = -k * 1.45;
    this.model.apply({ hipY: -0.55 * k, torsoX: -0.2, shLZ: 1.2, shRZ: -1.2, knL: 0.4, knR: 0.8 }, dt);
    this.model.root.position.copy(this.pos);
    this._shadow();
  }

  _zones(dt) {
    const w = G.room.world;
    this.zone = this.grounded ? w.zoneAt(this.pos.x, this.pos.z) : null;
    if (this.zone && this.zone.type === 'hot' && G.room.combatLive()) {
      this.hotT = (this.hotT || 0) + dt;
      if (this.hotT > 0.5) { this.hotT = 0; this.hurt(5, { source: 'hazard', kind: 'area', knock: 0.5 }); }
    } else this.hotT = 0;
  }

  // -------------------------------------------------------------------------
  // Animation
  _animate(dt) {
    const M = this.model;
    const P = { rate: 20 };
    const now = G.time;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const st = this.state;
    // aim / combat orientation (torso twists toward the target while legs follow movement)
    const fp = G.targeting.focusPos(aimV);
    let aimRel = 0;
    if (this.aimT > 0) aimRel = wrapAngle(this.aimYaw - this.yaw);
    else if (fp && G.targeting.level !== 'none' && st === 'move') aimRel = wrapAngle(Math.atan2(fp.x - this.pos.x, fp.z - this.pos.z) - this.yaw) * 0.5;
    if (Math.abs(aimRel) > 1.3 && sp < 1.5) { this.yaw = dampAngle(this.yaw, this.aimYaw, 14, dt); aimRel = wrapAngle(this.aimYaw - this.yaw); }
    aimRel = clamp(aimRel, -1.3, 1.3);

    this.phase += (sp / 1.55) * Math.PI * dt;
    const ph = this.phase;
    const idleB = Math.sin(now * 2.2);
    Object.assign(P, { hipY: -0.02 + idleB * 0.01, torsoX: 0.05, shLZ: 0.18, shRZ: -0.25, shRX: 0.15, elL: -0.35, elR: -0.55, bladeX: -1.1, headX: 0 });

    if (st === 'move' || st === 'hurt') {
      if (!this.grounded) {
        if (this.wallPlant) Object.assign(P, { legRX: -1.3, knR: 1.3, legLX: 0.3, knL: 0.8, torsoX: -0.25, shLZ: 1.0, shRZ: -0.8, shRX: -0.5 });
        else if (this.vel.y > 0) Object.assign(P, { legLX: -0.9, knL: 1.5, legRX: -0.15, knR: 0.7, shLZ: 0.9, shRZ: -0.9, shLX: -0.4, shRX: -0.4, torsoX: 0.15 });
        else Object.assign(P, { legLX: -0.35, knL: 0.5, legRX: 0.45, knR: 1.0, shLZ: 1.15, shRZ: -1.15, torsoX: 0.05, rate: 10 });
      } else if (sp > 0.8) {
        const k = clamp(sp / MOVE.runSpeed, 0, 1.2);
        const s = Math.sin(ph), c = Math.cos(ph);
        P.legLX = s * 0.95 * k; P.legRX = -s * 0.95 * k;
        P.knL = 0.2 + 1.3 * Math.max(0, -c) * k; P.knR = 0.2 + 1.3 * Math.max(0, c) * k;
        P.hipY = -0.04 - Math.abs(c) * 0.06 * k;
        P.torsoX = 0.2 + 0.18 * k;
        P.torsoY = s * 0.15 * k;
        if (this.sprinting) {
          // the anime run: arms swept back, deep lean
          Object.assign(P, { shLX: 1.25, shRX: 1.25, elL: -0.1, elR: -0.1, shLZ: 0.3, shRZ: -0.3, torsoX: 0.62, headX: -0.4, bladeX: 0.9 });
        } else {
          P.shLX = -s * 0.8 * k; P.shRX = s * 0.8 * k; P.elL = -1.2; P.elR = -1.2;
        }
        P.rate = 26;
      }
      if (st === 'hurt') Object.assign(P, { torsoX: -0.45, headX: -0.35, shLZ: 0.9, shRZ: -0.9, rate: 30 });
      if (this.chargeT > 0.2) Object.assign(P, { hipY: -0.2, knL: 0.8, knR: 0.8, legLX: -0.4, legRX: 0.3, shRX: 0.9, elR: -0.2, bladeX: 0.4, torsoX: 0.4, rate: 14 });
    } else if (st === 'dash') {
      const k = this.dash ? this.dash.t / DASH.duration : 1;
      if (k < 0.12) Object.assign(P, { hipY: -0.25, knL: 1.2, knR: 1.2, torsoX: 0.7, rate: 60 });
      else Object.assign(P, { torsoX: 0.95, headX: -0.7, legLX: 0.8, knL: 0.3, legRX: -0.5, knR: 1.1, shLX: 1.4, shRX: 1.4, elL: 0, elR: 0, bladeX: 1.2, rate: 60 });
    } else if (st === 'vault') {
      const k = this.vault.t / this.vault.dur;
      Object.assign(P, { torsoZ: 0.9 * Math.sin(Math.PI * k), torsoX: 0.3, shRX: -0.3, shRZ: -1.4, elR: 0, legLZ: 1.0 * Math.sin(Math.PI * k), legRZ: 0.8 * Math.sin(Math.PI * k), knL: 0.5, knR: 0.9, legLX: -0.5, legRX: -0.3, rate: 40 });
    } else if (st === 'land') {
      if (this.land.huge) Object.assign(P, { hipY: -0.5, legLX: -1.55, knL: 1.8, legRX: 0.7, knR: 2.3, torsoX: 0.75, shRX: -0.8, elR: -0.1, shLZ: 1.1, shLX: 0.6, headX: 0.35, bladeX: 1.4, rate: 40 });
      else Object.assign(P, { hipY: -0.33, legLX: -0.9, legRX: -0.7, knL: 1.5, knR: 1.4, torsoX: 0.55, shLZ: 0.9, shRZ: -0.9, rate: 40 });
    } else if (st === 'attack' && this.atk) {
      const a = this.atk, s = a.step;
      const t1 = s.startup, t2 = t1 + s.active;
      const k = a.t < t1 ? 0 : clamp((a.t - t1) / Math.max(0.01, s.active + s.recover * 0.35), 0, 1);
      const e = easeOutCubic(k);
      const lerpP = (A, B) => { for (const key in B) P[key] = lerp(A[key] ?? P[key] ?? 0, B[key], e); };
      P.rate = 45;
      switch (s.pose) {
        case 'slash1': case 'airSlash': case 'dashSlash':
          lerpP({ shRX: -2.5, shRZ: -0.5, elR: -0.3, torsoY: 0.7, bladeX: -0.2, torsoX: 0.15 }, { shRX: -0.2, shRZ: 0.9, elR: -0.1, torsoY: -0.6, bladeX: 0.3, torsoX: 0.4 });
          if (s.pose === 'dashSlash') { P.torsoX += 0.4; P.legLX = -0.8; P.knL = 1.0; P.legRX = 0.7; P.knR = 0.4; }
          break;
        case 'slash2': case 'airSlash2':
          lerpP({ shRX: -1.5, shRZ: 1.1, elR: -0.8, torsoY: -0.7, bladeZ: 1.4 }, { shRX: -1.4, shRZ: -1.3, elR: -0.1, torsoY: 0.8, bladeZ: 1.4 });
          break;
        case 'spin': case 'airSpin': case 'counter':
          Object.assign(P, { shRX: -1.45, shRZ: -1.5, elR: 0, shLZ: 1.3, bladeZ: 1.5, torsoX: 0.25, hipY: -0.15, knL: 0.6, knR: 0.6 });
          break;
        case 'launcher':
          lerpP({ shRX: 0.9, shRZ: -0.3, elR: -0.2, torsoX: 0.6, hipY: -0.3, knL: 1.1, knR: 1.1 }, { shRX: -2.9, shRZ: -0.2, elR: 0, torsoX: -0.3, hipY: 0.05, knL: 0.1, knR: 0.3, legLX: -0.3 });
          break;
      }
      if (a.kind === 'air') { P.legLX = -0.7; P.knL = 1.3; P.legRX = -0.2; P.knR = 1.0; }
      else if (a.t < t2 && s.pose !== 'launcher') { P.legLX = -0.55; P.knL = 0.7; P.legRX = 0.45; P.knR = 0.5; P.hipY = (P.hipY || 0) - 0.12; }
    } else if (st === 'grabbed') {
      Object.assign(P, { shLZ: 1.4 + Math.sin(now * 20) * 0.3, shRZ: -1.4 - Math.sin(now * 20) * 0.3, legLX: Math.sin(now * 16) * 0.6, legRX: -Math.sin(now * 16) * 0.6, torsoX: -0.3, rate: 30 });
    }
    // ranged overlay: left arm points at the aim, torso twists
    M.gun.visible = this.aimT > 0;
    if (this.aimT > 0 && st !== 'attack') {
      const pitch = 0;
      Object.assign(P, { shLX: -1.55 + pitch, shLY: 0, shLZ: 0.05, elL: 0 });
    }
    P.torsoY = (P.torsoY || 0) + aimRel * 0.65;
    P.headY = aimRel * 0.35;
    M.apply(P, dt);

    // whole-body flips / spins
    const B = M.body;
    if (this.spinT > 0) {
      this.spinT += dt;
      const k = Math.min(1, this.spinT / this.spinDur);
      const e = easeOutCubic(k);
      B.position.y = 0;
      if (this.spinKind === 'spin') B.rotation.set(0, -e * Math.PI * 2, 0);
      else if (this.spinKind === 'flipBack') { B.rotation.set(-e * Math.PI * 2, 0, 0); B.position.y = Math.sin(Math.PI * k) * 0.9; }
      else if (this.spinKind === 'flipFront') { B.rotation.set(e * Math.PI * 2, 0, 0); B.position.y = Math.sin(Math.PI * k) * 0.9; }
      else if (this.spinKind === 'dodge') B.rotation.set(-Math.sin(Math.PI * k) * 0.9, 0, Math.sin(Math.PI * k) * 0.35);
      if (k >= 1) { this.spinT = 0; B.rotation.set(0, 0, 0); B.position.y = 0; }
    }
    M.root.position.copy(this.pos);
    M.root.rotation.set(0, this.yaw, 0);
    // mercy blink
    M.setFlash(!(G.time < this.mercyUntil && Math.floor(G.time * 16) % 2 === 0));
    M.setXray(!!(G.room && G.room.combatLive()));
    M.secondary(dt, this.vel);
    this._shadow();
  }

  _shadow() {
    const w = G.room?.world;
    const g = w ? w.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.05, 0.1).h : 0;
    const h = this.pos.y - g;
    this.shadow.position.set(this.pos.x, g + 0.03, this.pos.z);
    const s = clamp(1 - h / 6, 0.35, 1);
    this.shadow.scale.setScalar(s);
    this.shadow.material.opacity = 0.45 * s;
  }
}
