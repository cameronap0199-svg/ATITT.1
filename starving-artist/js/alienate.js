// Alienate: the thing that hunts Nate through the Vista Venue. A too-tall, too-thin
// figure with long dark hair and a blank canvas for a face. It moves in stop-motion,
// twitches, leaves black paint footprints, and is drawn to light.
import * as THREE from 'three';
import { mat, ensureColor } from './renderer.js';
import { canvas, toTex } from './tex.js';
import { audio } from './audio.js';
import { Trail } from './fx3d.js';

function faceTexture(stage) {
  const [c, g] = canvas(16, 20);
  g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 16, 20);
  g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 20; y += 2) g.fillRect(0, y, 16, 1);
  g.fillStyle = 'rgba(120,100,90,0.25)'; g.fillRect(2, 2, 1, 6); g.fillRect(12, 3, 2, 1);
  if (stage >= 2) { g.fillStyle = '#060506'; g.fillRect(3, 7, 3, 4); g.fillRect(10, 7, 3, 4); g.fillRect(4, 11, 1, 5); g.fillRect(11, 11, 1, 4); }
  if (stage >= 3) { g.fillStyle = '#a01828'; g.fillRect(3, 15, 10, 1); g.fillRect(2, 14, 1, 1); g.fillRect(13, 14, 1, 1); g.fillRect(6, 16, 1, 3); g.fillRect(9, 16, 1, 2); }
  return toTex(c, { repeat: false });
}

function part(w, h, d, color, geo = null) {
  geo = (geo || new THREE.BoxGeometry(w, h, d)).toNonIndexed();
  const col = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 0.85 + Math.random() * 0.15; arr[i * 3] = col.r * k; arr[i * 3 + 1] = col.g * k; arr[i * 3 + 2] = col.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export class Alienate {
  constructor(world, { stage = 4, intensity = 0.5 } = {}) {
    this.world = world;
    this.stage = stage;
    this.intensity = intensity;
    this.mode = 'off';
    this.group = new THREE.Group();
    this.bodyMat = mat({ probe: true, wob: 0.01, emissive: 0.06 });
    this.faceMat = mat({ map: faceTexture(stage), probe: true, emissive: 0.6 });
    this.eyeMat = mat({ color: 0xff3030, emissive: 1, fog: false });
    const B = 0x151117, H = 0x0c0a0e;
    const mk = (geo, m = this.bodyMat) => new THREE.Mesh(geo, m);
    const g = this.group;
    this.rig = new THREE.Group(); g.add(this.rig);
    this.legL = new THREE.Group(); this.legL.position.set(-0.1, 1.25, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.1, 1.25, 0);
    for (const leg of [this.legL, this.legR]) {
      const l = mk(part(0.11, 1.25, 0.11, B)); l.position.y = -0.62; leg.add(l);
      const f = mk(part(0.13, 0.06, 0.26, B)); f.position.set(0, -1.22, 0.06); leg.add(f);
    }
    this.hips = mk(part(0, 0, 0, B, new THREE.CylinderGeometry(0.2, 0.36, 0.7, 5))); this.hips.position.set(0, 1.35, 0);
    this.torso = new THREE.Group(); this.torso.position.set(0, 1.62, 0);
    const chest = mk(part(0.42, 0.9, 0.2, B)); chest.position.set(0, 0.42, 0.04); chest.rotation.x = 0.22;
    this.torso.add(chest);
    for (let i = 0; i < 4; i++) { const sp = mk(part(0.06, 0.06, 0.06, 0x241c22)); sp.position.set(0, 0.2 + i * 0.18, -0.1 + i * 0.03); this.torso.add(sp); }
    const mkArm = (side) => {
      const a = new THREE.Group(); a.position.set(side * 0.29, 0.82, 0.12);
      const up = mk(part(0.085, 1.0, 0.085, B)); up.position.y = -0.5; a.add(up);
      const fore = new THREE.Group(); fore.position.y = -1.0; a.add(fore);
      const lo = mk(part(0.075, 0.8, 0.075, B)); lo.position.y = -0.4; fore.add(lo);
      const hand = mk(part(0.12, 0.16, 0.05, B)); hand.position.y = -0.86; fore.add(hand);
      for (let f = 0; f < 3; f++) { const fi = mk(part(0.018, 0.26, 0.018, B)); fi.position.set(-0.04 + f * 0.04, -1.04, 0); fi.rotation.z = (f - 1) * 0.12; fore.add(fi); }
      a.userData.fore = fore;
      return a;
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    this.torso.add(this.armL, this.armR);
    this.head = new THREE.Group(); this.head.position.set(0, 0.96, 0.2);
    const hair = mk(part(0.36, 0.5, 0.3, H)); hair.position.set(0, -0.02, -0.05);
    const hairL = mk(part(0.07, 0.9, 0.2, H)); hairL.position.set(-0.19, -0.34, -0.02);
    const hairR = mk(part(0.07, 1.0, 0.2, H)); hairR.position.set(0.19, -0.4, -0.02);
    const hairB = mk(part(0.3, 1.1, 0.06, H)); hairB.position.set(0, -0.5, -0.18);
    const face = new THREE.Mesh(ensureColor(new THREE.PlaneGeometry(0.28, 0.36)), this.faceMat); face.position.z = 0.106;
    const frame = mk(part(0.32, 0.4, 0.04, 0xc9a24a)); frame.position.z = 0.08;
    this.eyes = new THREE.Group();
    for (const x of [-0.06, 0.06]) { const e = new THREE.Mesh(ensureColor(new THREE.PlaneGeometry(0.022, 0.022)), this.eyeMat); e.position.set(x, 0.02, 0.109); this.eyes.add(e); }
    this.eyes.visible = stage >= 2;
    this.head.add(hair, hairL, hairR, hairB, frame, face, this.eyes);
    this.torso.add(this.head);
    this.rig.add(this.legL, this.legR, this.hips, this.torso);
    g.visible = false;
    world.scene.add(g);
    world.dynamics.push(g);
    g.userData.dynMats = [this.bodyMat, this.faceMat];
    this.pos = g.position;
    this.trail = new Trail(world.scene, 46, 0x0a0608, world.level);
    this.path = null; this.pathI = 0; this.repath = 0;
    this.lastSeen = null; this.lostT = 0; this.searchT = 0;
    this.stepT = 0; this.grace = 0; this.poseT = 0; this.twitch = 0; this.twitchT = 1;
    this.sawHide = false;
    this.patrol = [];
    this.alert = 0; // 0..1 how aware (for music)
    this.onCatch = null;
    this.glimpse = null;
    this.speedMul = 1;
    this.breathT = 2;
    this.pauseT = 0;
  }

  setStage(s) { this.stage = s; this.faceMat.uniforms.map.value = faceTexture(s); this.eyes.visible = s >= 2; }

  place(p, faceTo = null) {
    this.pos.set(p.x, 0, p.z);
    if (faceTo) this.group.rotation.y = Math.atan2(faceTo.x - p.x, faceTo.z - p.z);
    this.path = null;
  }
  show(v) { this.group.visible = v; }
  headWorld() { return this.head.getWorldPosition(new THREE.Vector3()); }

  // ---------------------------------------------------------- perception
  canSee(player) {
    if (player.hidden) return false;
    const e = player.pos;
    const d = Math.hypot(e.x - this.pos.x, e.z - this.pos.z);
    const lit = !!player.lightOn;
    const range = 10 + this.intensity * 7 + (lit ? 7 : 0);
    if (d > range) return false;
    if (!this.world.level.los(this.pos, e)) return false;
    if (d < 4.5) return true;
    const fwd = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const to = new THREE.Vector3(e.x - this.pos.x, 0, e.z - this.pos.z).normalize();
    if (fwd.dot(to) > (lit ? -0.1 : 0.3)) return true;
    // a flashlight shone straight at it always gives you away
    if (lit && d < 14) {
      const look = player.lookDir(); look.y = 0; look.normalize();
      return look.dot(to.clone().negate()) > 0.93;
    }
    return false;
  }
  canHear(player) {
    if (player.hidden) return false;
    const d = this.pos.distanceTo(player.pos);
    const running = player.moving && Math.hypot(player.vel.x, player.vel.z) > 3.6;
    return (running && d < 10 + this.intensity * 4) || (player.moving && d < 3.5);
  }

  // ---------------------------------------------------------- movement
  goTo(target, speed, dt) {
    const L = this.world.level;
    this.repath -= dt;
    if (!this.path || this.repath <= 0 || this.pathTarget?.distanceTo(target) > 1.5) {
      this.path = L.path(this.pos, target) || [];
      this.path.push(target.clone());
      this.pathI = 0; this.repath = 0.6; this.pathTarget = target.clone();
    }
    let wp = this.path[this.pathI];
    while (wp && Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.35) { this.pathI++; wp = this.path[this.pathI]; }
    if (!wp) return true;
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, speed * dt);
    this.pos.x += dx / d * step; this.pos.z += dz / d * step;
    const ty = Math.atan2(dx, dz);
    let dy = ty - this.group.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, dt * 6);
    this.walkAnim(dt, speed);
    return false;
  }
  // Limbs update at a stuttering ~9fps: stop-motion, wrong.
  walkAnim(dt, speed) {
    this.stepT += dt * speed * 1.35;
    this.poseT -= dt;
    if (this.poseT <= 0) {
      this.poseT = 0.09 + Math.random() * 0.05;
      const s = Math.sin(this.stepT);
      const lunge = speed > 3 ? 1 : 0;
      this.legL.rotation.x = s * 0.55; this.legR.rotation.x = -s * 0.55;
      this.armL.rotation.x = -s * 0.3 - lunge * 0.9; this.armR.rotation.x = s * 0.3 - lunge * 0.9;
      this.armL.userData.fore.rotation.x = -0.2 - lunge * 0.5; this.armR.userData.fore.rotation.x = -0.2 - lunge * 0.5;
      this.torso.rotation.x = 0.1 + lunge * 0.35 + Math.abs(s) * 0.05;
      this.rig.position.y = Math.abs(Math.cos(this.stepT)) * 0.05;
      this.rig.rotation.z = s * 0.06;
    }
    if (Math.floor(this.stepT / Math.PI) !== this._lastStep) {
      this._lastStep = Math.floor(this.stepT / Math.PI);
      audio.play('monsterStep', { pos: this.pos });
      if (Math.random() < 0.3) audio.play('drip', { pos: this.pos });
      this.trail.step(this.pos, this.group.rotation.y);
    }
  }
  idleAnim(t, dt = 0.016) {
    this.poseT -= dt;
    if (this.poseT > 0) return;
    this.poseT = 0.12;
    this.head.rotation.z = Math.sin(t * 0.7) * 0.18 + this.twitch;
    this.armL.rotation.x *= 0.7; this.armR.rotation.x *= 0.7; this.legL.rotation.x *= 0.6; this.legR.rotation.x *= 0.6;
    this.torso.rotation.x = 0.18 + Math.sin(t * 0.9) * 0.04;
    this.armL.userData.fore.rotation.x = -0.1; this.armR.userData.fore.rotation.x = -0.1 + Math.sin(t * 1.3) * 0.1;
    this.rig.position.y *= 0.5;
  }
  twitchTick(dt) {
    this.twitchT -= dt;
    if (this.twitchT <= 0) {
      this.twitchT = 0.8 + Math.random() * 2.2;
      this.twitch = (Math.random() - 0.5) * 1.1;
      this.head.rotation.y = (Math.random() - 0.5) * 1.2;
      setTimeout(() => { this.twitch = 0; }, 140 + Math.random() * 120);
    }
  }
  faceTowards(p, dt, rate = 8) {
    const ty = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let dy = ty - this.group.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, dt * rate);
  }

  // ---------------------------------------------------------- hunting
  startHunt(patrolPoints) {
    this.mode = 'patrol'; this.patrol = patrolPoints; this.show(true); this.patrolTarget = null; this.grace = 4;
  }

  update(dt, t, player) {
    if (this.mode === 'off') return;
    const d = this.pos.distanceTo(player.pos);
    this.dist = d;
    this.twitchTick(dt);
    // it breathes. you can hear it before you see it.
    this.breathT -= dt;
    if (this.breathT <= 0 && this.group.visible) { this.breathT = 2.2 + Math.random() * 1.6; if (d < 14) audio.play('breath', { vol: 2.2, pos: this.headWorld() }); }
    if (this.mode === 'glimpse') {
      this.idleAnim(t, dt);
      const g = this.glimpse;
      g.t += dt;
      const toMe = this.pos.clone().sub(player.eyePos()).normalize();
      const look = player.lookDir();
      const inView = toMe.dot(look) > 0.8 && this.world.level.los(player.pos, this.pos);
      if (inView) g.seen += dt;
      if (d < g.vanishDist || g.seen > 1.6 || g.t > g.life) {
        this.show(false); this.mode = 'off';
        if (g.seen > 0.2) audio.play('static', { vol: 0.5, dur: 0.3 });
        if (g.onEnd) g.onEnd(g.seen > 0.2);
      }
      return;
    }
    if (this.mode === 'scripted') { if (this.script) this.script(dt, t); return; }
    if (this.mode === 'caught') return;
    if (this.grace > 0) this.grace -= dt;

    const sees = this.grace <= 0 && this.canSee(player);
    const hears = this.grace <= 0 && this.canHear(player);
    const baseSpeed = 1.45 + this.intensity * 0.5;
    const chaseSpeed = (3.2 + this.intensity * 1.15) * this.speedMul;

    // The tell: when it first notices you it stops, snaps its head round, and screams.
    if (this.mode === 'spotted') {
      this.spotT -= dt;
      this.faceTowards(player.pos, dt, 14);
      this.idleAnim(t, dt);
      this.armL.rotation.x = -1.4; this.armR.rotation.x = -1.2;
      this.head.rotation.z = 0.5;
      if (this.spotT <= 0) { this.mode = 'chase'; this.lastSeen = player.pos.clone(); this.lostT = 0; }
      return;
    }
    if (sees || (hears && this.mode !== 'chase')) {
      if (this.mode !== 'chase') {
        this.spotT = this.mode === 'search' ? 0.35 : 0.75;
        this.mode = 'spotted';
        audio.play('stinger', { vol: 0.75 }); audio.play('scream', { pos: this.headWorld() });
        this.onSpot && this.onSpot();
        this.lastSeen = player.pos.clone();
        return;
      }
      this.lastSeen = player.pos.clone(); this.lostT = 0;
    }

    if (this.mode === 'chase') {
      this.alert = Math.min(1, this.alert + dt * 2);
      if (!sees) this.lostT += dt;
      if (player.hidden) {
        if (!this.hideChecked) { this.hideChecked = true; this.sawHide = this.lostT < 0.4 && d < 9; }
        if (this.sawHide) { this.goTo(player.hidden.front, chaseSpeed, dt); if (d < 1.4) this.catch(player); return; }
        this.mode = 'search'; this.searchT = 5 + Math.random() * 3; this.searchTarget = player.hidden.front.clone(); return;
      }
      this.hideChecked = false;
      if (this.lostT > 4.5) { this.mode = 'search'; this.searchT = 6; this.searchTarget = this.lastSeen.clone(); return; }
      this.goTo(sees ? player.pos.clone() : this.lastSeen, chaseSpeed, dt);
      if (d < 0.95) this.catch(player);
      return;
    }
    this.alert = Math.max(0, this.alert - dt * 0.25);
    if (this.mode === 'search') {
      const arrived = this.goTo(this.searchTarget, baseSpeed * 1.4, dt);
      if (arrived) {
        this.searchT -= dt; this.idleAnim(t, dt); this.group.rotation.y += dt * 1.4;
        // standing right outside your hiding place, breathing
        if (player.hidden && d < 3 && Math.random() < dt * 0.6) audio.play('scrape', { pos: this.pos });
      }
      if (this.searchT <= 0) { this.mode = 'patrol'; this.patrolTarget = null; }
      return;
    }
    if (this.mode === 'patrol') {
      if (this.pauseT > 0) { this.pauseT -= dt; this.idleAnim(t, dt); this.group.rotation.y += Math.sin(t * 0.8) * dt * 0.8; return; }
      if (!this.patrolTarget) {
        // bias towards the player's rough area so it never feels absent for long
        const pts = [...this.patrol].sort(() => Math.random() - 0.5);
        this.patrolTarget = (Math.random() < 0.45 + this.intensity * 0.3 ? pts.sort((a, b) => a.distanceTo(player.pos) - b.distanceTo(player.pos))[0] : pts[0]).clone();
      }
      if (this.goTo(this.patrolTarget, baseSpeed, dt)) { this.patrolTarget = null; this.pauseT = 1.2 + Math.random() * 2.2; }
    }
  }

  catch(player) {
    if (this.mode === 'caught') return;
    this.mode = 'caught';
    if (this.onCatch) this.onCatch();
  }

  // Teleport somewhere far from the player and resume patrol after a grace period.
  reset(player, points) {
    const far = [...points].sort((a, b) => b.distanceTo(player.pos) - a.distanceTo(player.pos))[0];
    this.place(far); this.mode = 'patrol'; this.patrolTarget = null; this.grace = 7; this.path = null; this.alert = 0; this.pauseT = 0;
  }

  startGlimpse(pos, player, { vanishDist = 7, life = 20, onEnd } = {}) {
    this.place(pos, player.pos);
    this.show(true);
    audio.play('scrape', { pos });
    this.mode = 'glimpse';
    this.glimpse = { t: 0, seen: 0, vanishDist, life, onEnd };
  }

  dispose() { this.world.scene.remove(this.group); this.trail.clear(); }
}
