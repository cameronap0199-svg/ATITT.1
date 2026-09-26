// First-person controller: walking, running with stamina, head bob, footsteps,
// grid collision, and a "hidden" state for hiding spots.
import * as THREE from 'three';
import { input } from './input.js';
import { audio } from './audio.js';

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.eye = 1.6;
    this.radius = 0.3;
    this.bob = 0; this.bobAmt = 0;
    this.stamina = 1;
    this.exhausted = false;
    this.hidden = null;
    this.frozen = false;
    this.speedMul = 1;
    this.settings = { sens: 1, invertY: false, headBob: true, fov: 70 };
    this.lastStep = 0;
    this.moving = false;
    this.lookTarget = null; // cutscene look-at
    this.shake = 0;
  }

  place(p, yaw = 0) { this.pos.set(p.x, 0, p.z); this.yaw = yaw; this.pitch = 0; this.vel.set(0, 0, 0); this.floorY = undefined; }

  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  lookDir() {
    const d = new THREE.Vector3(0, 0, -1);
    d.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return d;
  }
  eyePos() { return new THREE.Vector3(this.pos.x, this.eye + this.bobOffset() + (this.floorY || 0), this.pos.z); }
  bobOffset() { return this.settings.headBob ? Math.sin(this.bob * 2) * 0.045 * this.bobAmt : 0; }

  faceTowards(p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    this.yaw = Math.atan2(-dx, -dz);
  }

  update(dt, level, surfaceFn) {
    const s = this.settings;
    // look
    let [mx, my] = input.consumeLook();
    if (!this.frozen || this.hidden) {
      const k = 0.0022 * s.sens;
      this.yaw -= mx * k;
      this.pitch -= my * k * (s.invertY ? -1 : 1);
      const pk = 2.6 * s.sens * dt;
      this.yaw -= input.pad.x * pk;
      this.pitch -= input.pad.y * pk * (s.invertY ? -1 : 1);
      if (input.down('turnLeft')) this.yaw += 2.2 * dt;
      if (input.down('turnRight')) this.yaw -= 2.2 * dt;
    }
    if (this.lookTarget) {
      const e = this.eyePos();
      const d = this.lookTarget.clone().sub(e);
      const ty = Math.atan2(-d.x, -d.z);
      const tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let dy = ty - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 4); this.pitch += (tp - this.pitch) * Math.min(1, dt * 4);
    }
    const lim = this.hidden ? 0.5 : 1.45;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    if (this.hidden) {
      const hy = this.hidden.yaw;
      let d = this.yaw - hy; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      d = Math.max(-0.7, Math.min(0.7, d)); this.yaw = hy + d;
    }

    // move
    let fx = 0, fz = 0;
    if (!this.frozen && !this.hidden) {
      if (input.down('forward')) fz += 1;
      if (input.down('back')) fz -= 1;
      if (input.down('left')) fx -= 1;
      if (input.down('right')) fx += 1;
      fx += input.pad.lx; fz -= input.pad.ly;
    }
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    const wantRun = input.down('run') && len > 0.1 && !this.exhausted;
    const speed = (wantRun ? 5.0 : 2.9) * this.speedMul;
    if (wantRun) { this.stamina -= dt / 6; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; audio.play('breath', { vol: 2 }); } }
    else { this.stamina = Math.min(1, this.stamina + dt / (len > 0.1 ? 5 : 3)); if (this.exhausted && this.stamina > 0.45) this.exhausted = false; }
    const f = this.forward();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const target = new THREE.Vector3().addScaledVector(f, fz * speed).addScaledVector(r, fx * speed);
    this.vel.lerp(target, Math.min(1, dt * 10));
    if (!this.hidden) {
      this.pos.addScaledVector(this.vel, dt);
      if (level) level.collide(this.pos, this.radius);
    }
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.moving = sp > 0.3;
    this.bobAmt += ((this.moving ? Math.min(1.4, sp / 2.9) : 0) - this.bobAmt) * Math.min(1, dt * 8);
    const prevPhase = Math.floor(this.bob * 2 / Math.PI);
    this.bob += dt * sp * 2.3;
    const phase = Math.floor(this.bob * 2 / Math.PI);
    if (this.moving && phase !== prevPhase && phase % 2 === 1) audio.play('step', { surface: surfaceFn ? surfaceFn(this.pos) : 'hard', vol: wantRun ? 1.4 : 1 });

    // camera
    const cam = this.camera;
    const e = this.hidden ? this.hidden.eye : this.eyePos();
    cam.position.copy(e);
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake; cam.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 0.8); }
    cam.rotation.set(this.pitch, this.yaw, (this.settings.headBob ? Math.sin(this.bob) * 0.006 * this.bobAmt : 0), 'YXZ');
    cam.fov += (s.fov + (wantRun ? 4 : 0) - cam.fov) * Math.min(1, dt * 6);
  }
}
