// Intelligent third-person camera: distance / pitch / FOV states (explore → combat →
// crowd → bullet hell), gentle Combat Focus assistance that the player always
// overrides, shot composition around Alex + target, collision with occluder fading,
// recentering and trauma-based shake.

import * as THREE from 'three';
import { G } from './state.js';
import { CAMERA, TARGET } from './config.js';
import { clamp, damp, dampAngle, DEG, wrapAngle } from './core/math.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.pitch = CAMERA.basePitch;
    this.dist = CAMERA.states.explore.dist;
    this.colDist = this.dist;
    this.fov = 70;
    this.state = 'explore';
    this.pending = 'explore'; this.pendingT = 0; this.bulletHold = 0;
    this.suppress = 1;
    this.lastManual = -99;
    this.trauma = 0;
    this.lp = new THREE.Vector3(0, 1.4, 0);
    this.faded = new Map();
    this.shakeSeed = Math.random() * 100;
    this.pitchAdd = 0;
  }

  forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  right() { return [-Math.cos(this.yaw), Math.sin(this.yaw)]; }

  snapBehind(yaw, alexPos) {
    this.yaw = yaw;
    this.pitch = CAMERA.basePitch;
    if (alexPos) this.lp.set(alexPos.x, alexPos.y + CAMERA.lookHeight + 0.5, alexPos.z);
    this.colDist = this.dist;
    this.trauma = 0;
  }

  shake(amount, x, z) {
    let k = 1;
    if (x !== undefined && G.alex) k = clamp(1.3 - Math.hypot(x - G.alex.pos.x, z - G.alex.pos.z) / 25, 0.2, 1);
    this.trauma = Math.min(1, this.trauma + amount * k);
  }
  panOf(x, z) {
    const dx = x - this.cam.position.x, dz = z - this.cam.position.z, l = Math.hypot(dx, dz) || 1;
    const [rx, rz] = this.right();
    return clamp(((dx * rx + dz * rz) / l) * 0.8, -0.8, 0.8);
  }

  _chooseState(dt) {
    const room = G.room, alex = G.alex;
    let want = 'explore';
    if (room && room.combatLive()) {
      want = 'combat';
      let alive = 0, close = 0;
      for (const e of room.enemies) {
        if (!e.alive) continue;
        alive++;
        if (Math.hypot(e.pos.x - alex.pos.x, e.pos.z - alex.pos.z) < CAMERA.surroundRadius) close++;
      }
      if (alive >= CAMERA.crowdEnemies || close >= 3) want = 'crowd';
      const bullets = G.projectiles.hostileCount;
      if (bullets >= CAMERA.bulletProjectiles || G.areas.activeCount() >= 7 || room.bossMajor) this.bulletHold = 1.6;
    }
    if (this.bulletHold > 0) { this.bulletHold -= dt; if (room && room.combatLive()) want = 'bullet'; }
    if (want !== this.pending) { this.pending = want; this.pendingT = 0; }
    this.pendingT += dt;
    const order = ['explore', 'combat', 'crowd', 'bullet'];
    // widen quickly, narrow slowly
    const need = order.indexOf(want) > order.indexOf(this.state) ? 0.15 : 1.1;
    if (this.pendingT > need) this.state = want;
  }

  update(dt, realDt) {
    const inp = G.input, S = G.settings, alex = G.alex;
    if (!alex) return;
    // --- manual input
    const mx = inp.look.dx, my = inp.look.dy;
    if (mx || my) {
      this.yaw -= mx;
      this.pitch = clamp(this.pitch + my / DEG, CAMERA.minPitch, CAMERA.maxPitch);
      this.lastManual = G.realTime;
    }
    const rate = inp.lookRate;
    const target = rate > 4 ? 0 : rate > 0.8 ? 0.4 : 1;
    this.suppress = target < this.suppress ? target : Math.min(1, this.suppress + realDt * 1.0);

    this._chooseState(realDt);
    const st = CAMERA.states[this.state];
    let wantDist = st.dist * S.camDistance;
    let wantPitchAdd = st.pitch;
    let wantFov = st.fov + S.fov;
    if (alex.vehicle) {
      wantDist = Math.max(wantDist, 8.4 * S.camDistance); wantFov += 5; wantPitchAdd += 3;
      // follow the vehicle's heading when the player isn't steering the camera
      if (G.realTime - (this.lastManual || 0) > 0.6 && (this.vehicleSpeed = alex.vehicle.speed) > 4) this.yaw = dampAngle(this.yaw, alex.vehicle.yaw, 2.2, realDt);
    }

    // --- combat focus assistance
    const tg = G.targeting;
    const fpos = tg.focusPos(v1);
    const assistK = TARGET.camAssist[S.combatCamAssist] ?? 1;
    if (fpos && tg.level !== 'none') {
      const dx = fpos.x - alex.pos.x, dz = fpos.z - alex.pos.z, d = Math.hypot(dx, dz);
      const dy = fpos.y - (alex.pos.y + 1);
      if (d > 0.8) {
        let desired = Math.atan2(dx, dz);
        // composition: keep the target off to one side, Alex opposite
        const side = Math.sign(wrapAngle(desired - this.yaw)) || 1;
        desired -= side * 9 * DEG * clamp(d / 8, 0.3, 1);
        const strength = assistK * (tg.level === 'hard' ? 3.2 : 1.0) * this.suppress;
        this.yaw = dampAngle(this.yaw, desired, strength * 1.8, realDt);
      }
      if (dy > 2) { wantDist += Math.min(3, dy * 0.6); wantPitchAdd += 5; }
      if (tg.focus.enemy.boss) { wantDist += 1.5; wantPitchAdd += 3; }
    } else if (tg.soft && assistK > 0) {
      const c = tg.soft;
      const desired = Math.atan2(c.p.x - alex.pos.x, c.p.z - alex.pos.z);
      this.yaw = dampAngle(this.yaw, desired, 0.25 * assistK * this.suppress, realDt);
    }
    // --- recentering behind a running Alex
    const speed = Math.hypot(alex.vel.x, alex.vel.z);
    if (S.autoRecenter && G.realTime - this.lastManual > S.recenterDelay && speed > 2.5 && !(fpos && tg.level !== 'none') && alex.movingForward()) {
      const behind = Math.atan2(alex.vel.x, alex.vel.z);
      const k = G.room && G.room.combatLive() ? 0.35 : 1.3;
      this.yaw = dampAngle(this.yaw, behind, k, realDt);
    }
    // player's own pitch returns slowly to the base pitch when idle
    if (G.realTime - this.lastManual > 3) this.pitch = damp(this.pitch, CAMERA.basePitch, 0.4, realDt);

    this.dist = damp(this.dist, wantDist, 2.2, realDt);
    this.pitchAdd = damp(this.pitchAdd, wantPitchAdd, 2.2, realDt);

    // --- look point
    const head = v2.set(alex.pos.x, alex.pos.y + CAMERA.lookHeight + 0.45, alex.pos.z);
    if (fpos && tg.level !== 'none') {
      const w = tg.level === 'hard' ? 0.38 : 0.28;
      v3.copy(fpos).sub(head);
      v3.y = clamp(v3.y, -1, 2.5);
      if (v3.length() > 9) v3.setLength(9);
      head.addScaledVector(v3, w);
    } else if (speed > 1) {
      head.x += (alex.vel.x / speed) * 0.7; head.z += (alex.vel.z / speed) * 0.7;
    }
    const lpRate = 9;
    this.lp.x = damp(this.lp.x, head.x, lpRate, realDt);
    this.lp.z = damp(this.lp.z, head.z, lpRate, realDt);
    this.lp.y = damp(this.lp.y, head.y, alex.grounded ? 6 : 2.5, realDt);

    // --- desired position + collision
    const p = (this.pitch + this.pitchAdd) * DEG;
    const fx = Math.sin(this.yaw) * Math.cos(p), fy = -Math.sin(p), fz = Math.cos(this.yaw) * Math.cos(p);
    let dist = this.dist;
    const w = G.room?.world;
    let pullK = 0;
    if (w) {
      const hit = w.raycast(this.lp.x, this.lp.y, this.lp.z, -fx, -fy, -fz, dist + CAMERA.collisionPad, (b) => b.camBlock && !b.wall && !b.faded);
      if (hit) {
        const d2 = Math.max(CAMERA.minDist, hit.t - CAMERA.collisionPad);
        if (d2 < dist) { pullK = 1 - d2 / dist; dist = d2; }
      }
    }
    this.colDist = dist < this.colDist ? damp(this.colDist, dist, CAMERA.inwardRate, realDt) : damp(this.colDist, dist, CAMERA.outwardRate, realDt);
    wantFov += pullK * 9;
    this.fov = damp(this.fov, wantFov, 3, realDt);

    const cam = this.cam;
    cam.position.set(this.lp.x - fx * this.colDist, this.lp.y - fy * this.colDist, this.lp.z - fz * this.colDist);
    if (cam.position.y < 0.6) cam.position.y = 0.6;
    // shake
    this.trauma = Math.max(0, this.trauma - realDt * 1.7);
    const sh = this.trauma * this.trauma * S.camShake;
    const t = G.realTime * 28 + this.shakeSeed;
    const ox = (Math.sin(t * 1.3) + Math.sin(t * 2.9) * 0.5) * sh * 0.32;
    const oy = (Math.sin(t * 1.7 + 3) + Math.sin(t * 3.3) * 0.5) * sh * 0.32;
    v3.set(this.lp.x + ox, this.lp.y + oy, this.lp.z);
    cam.lookAt(v3);
    cam.rotateZ(Math.sin(t * 1.1) * sh * 0.03);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    this._occluders(realDt);
    this._sideFade(realDt);
  }

  // Walls and door frames between the camera and the room go see-through.
  _sideFade(dt) {
    const room = G.room;
    if (!room || !room.fadeSide) return;
    const c = this.cam.position, L = room.L, m = 0.6;
    const want = { N: c.z < -L.d / 2 + m, S: c.z > L.d / 2 - m, W: c.x < -L.w / 2 + m, E: c.x > L.w / 2 - m };
    for (const side of ['N', 'S', 'W', 'E']) {
      const cur = room.sideFade[side];
      const target = want[side] ? 0 : 1;
      room.fadeSide(side, cur + (target - cur) * Math.min(1, dt * 10));
    }
  }

  // Props between the camera and Alex go see-through.
  _occluders(dt) {
    const w = G.room?.world, alex = G.alex;
    if (!w) return;
    const cam = this.cam.position;
    const hitNow = new Set();
    for (const hy of [0.4, 1.2, 1.9]) {
      const tx = alex.pos.x, ty = alex.pos.y + hy, tz = alex.pos.z;
      const dx = tx - cam.x, dy = ty - cam.y, dz = tz - cam.z;
      for (const b of w.blocks) {
        if (!b.alive || b.wall || !b.meshes || b.y1 < 1.2) continue;
        const h = b.rayHit(cam.x, cam.y, cam.z, dx, dy, dz, 0.97);
        if (h) hitNow.add(b);
      }
    }
    for (const b of hitNow) { this.faded.set(b, G.realTime); setFade(b, true); }
    for (const [b, t] of this.faded) {
      if (!hitNow.has(b) && G.realTime - t > 0.25) { setFade(b, false); this.faded.delete(b); }
    }
  }
  clearFades() { for (const b of this.faded.keys()) setFade(b, false); this.faded.clear(); }
}

const fadeCache = new Map();
function setFade(b, on) {
  if (!!b.faded === on || !b.meshes) return;
  b.faded = on;
  b.meshes.traverse((c) => {
    if (!c.isMesh) return;
    if (on) {
      c.userData.origMat = c.material;
      const fade1 = (m) => {
        let fm = fadeCache.get(m);
        if (!fm) {
          fm = m.clone();
          fm.transparent = true;
          fm.opacity = 0.22;
          fm.depthWrite = false;
          fadeCache.set(m, fm);
        }
        return fm;
      };
      // Minecraft blocks carry one material per face
      c.material = Array.isArray(c.material) ? c.material.map(fade1) : fade1(c.material);
    } else if (c.userData.origMat) c.material = c.userData.origMat;
  });
}
