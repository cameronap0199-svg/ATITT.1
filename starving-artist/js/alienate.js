// Alienate: the thing that hunts Nate through the Vista Venue. A too-tall, too-thin
// figure with long dark hair and a blank canvas for a face.
import * as THREE from 'three';
import { mat, ensureColor } from './renderer.js';
import { canvas, toTex } from './tex.js';
import { audio } from './audio.js';

function faceTexture(stage) {
  const [c, g] = canvas(16, 20);
  g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 16, 20);
  g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 20; y += 2) g.fillRect(0, y, 16, 1);
  if (stage >= 2) { g.fillStyle = '#060506'; g.fillRect(3, 7, 3, 4); g.fillRect(10, 7, 3, 4); g.fillRect(4, 11, 1, 5); g.fillRect(11, 11, 1, 4); }
  if (stage >= 3) { g.fillStyle = '#a01828'; g.fillRect(3, 15, 10, 1); g.fillRect(2, 14, 1, 1); g.fillRect(13, 14, 1, 1); g.fillRect(6, 16, 1, 3); }
  return toTex(c, { repeat: false });
}

function part(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const col = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
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
    this.bodyMat = mat({ probe: true, wob: 0.012, emissive: 0.08 });
    this.faceMat = mat({ map: faceTexture(stage), probe: true, emissive: 0.6 });
    const B = 0x151117, H = 0x0c0a0e;
    const mk = (geo, m = this.bodyMat) => new THREE.Mesh(geo, m);
    const g = this.group;
    this.legL = mk(part(0.12, 1.25, 0.12, B)); this.legL.position.set(-0.1, 0.62, 0);
    this.legR = mk(part(0.12, 1.25, 0.12, B)); this.legR.position.set(0.1, 0.62, 0);
    this.torso = mk(part(0.44, 0.95, 0.2, B)); this.torso.position.set(0, 1.7, 0.02); this.torso.rotation.x = 0.18;
    this.armL = new THREE.Group(); this.armL.position.set(-0.3, 2.1, 0.04);
    const upper = mk(part(0.09, 1.65, 0.09, B)); upper.position.set(0, -0.82, 0);
    const hand = mk(part(0.14, 0.22, 0.06, B)); hand.position.set(0, -1.7, 0.02);
    this.armL.add(upper, hand);
    this.armR = this.armL.clone(); this.armR.position.x = 0.3;
    this.head = new THREE.Group(); this.head.position.set(0, 2.42, 0.12);
    const hair = mk(part(0.36, 0.5, 0.3, H)); hair.position.set(0, -0.02, -0.05);
    const hairL = mk(part(0.07, 0.8, 0.2, H)); hairL.position.set(-0.19, -0.3, -0.02);
    const hairR = mk(part(0.07, 0.9, 0.2, H)); hairR.position.set(0.19, -0.34, -0.02);
    const face = new THREE.Mesh(ensureColor(new THREE.PlaneGeometry(0.28, 0.36)), this.faceMat); face.position.z = 0.106;
    const frameGeo = part(0.32, 0.4, 0.04, 0xc9a24a); const frame = mk(frameGeo); frame.position.z = 0.08;
    this.head.add(hair, hairL, hairR, frame, face);
    g.add(this.legL, this.legR, this.torso, this.armL, this.armR, this.head);
    g.visible = false;
    world.scene.add(g);
    world.dynamics.push(g);
    g.userData.dynMats = [this.bodyMat, this.faceMat];
    this.pos = g.position;
    this.path = null; this.pathI = 0; this.repath = 0;
    this.lastSeen = null; this.lostT = 0; this.searchT = 0;
    this.stepT = 0; this.grace = 0;
    this.sawHide = false;
    this.patrol = [];
    this.alert = 0; // 0..1 how aware (for music)
    this.onCatch = null;
    this.glimpse = null;
    this.speedMul = 1;
  }

  setStage(s) { this.stage = s; this.faceMat.uniforms.map.value = faceTexture(s); }

  place(p, faceTo = null) {
    this.pos.set(p.x, 0, p.z);
    if (faceTo) this.group.rotation.y = Math.atan2(faceTo.x - p.x, faceTo.z - p.z);
    this.path = null;
  }
  show(v) { this.group.visible = v; }

  // ---------------------------------------------------------- perception
  canSee(player) {
    if (player.hidden) return false;
    const e = player.pos;
    const d = Math.hypot(e.x - this.pos.x, e.z - this.pos.z);
    const range = 11 + this.intensity * 8;
    if (d > range) return false;
    if (!this.world.level.los(this.pos, e)) return false;
    if (d < 4.5) return true;
    const fwd = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const to = new THREE.Vector3(e.x - this.pos.x, 0, e.z - this.pos.z).normalize();
    return fwd.dot(to) > 0.25;
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
  walkAnim(dt, speed) {
    this.stepT += dt * speed * 1.4;
    const s = Math.sin(this.stepT);
    this.legL.rotation.x = s * 0.5; this.legR.rotation.x = -s * 0.5;
    this.armL.rotation.x = -s * 0.25 + 0.1; this.armR.rotation.x = s * 0.25 + 0.1;
    if (Math.floor(this.stepT / Math.PI) !== this._lastStep) {
      this._lastStep = Math.floor(this.stepT / Math.PI);
      audio.play('monsterStep', { pos: this.pos });
      if (Math.random() < 0.25) audio.play('drip', { pos: this.pos });
    }
  }
  idleAnim(t) {
    this.head.rotation.z = Math.sin(t * 0.7) * 0.15 + (Math.random() < 0.02 ? (Math.random() - 0.5) * 0.6 : 0);
    this.armL.rotation.x *= 0.9; this.armR.rotation.x *= 0.9; this.legL.rotation.x *= 0.9; this.legR.rotation.x *= 0.9;
  }

  // ---------------------------------------------------------- hunting
  startHunt(patrolPoints) {
    this.mode = 'patrol'; this.patrol = patrolPoints; this.show(true); this.patrolTarget = null; this.grace = 4;
  }

  update(dt, t, player) {
    if (this.mode === 'off') return;
    const d = this.pos.distanceTo(player.pos);
    this.dist = d;
    this.head.rotation.y = Math.sin(t * 1.3) * 0.2;
    if (this.mode === 'glimpse') {
      this.idleAnim(t);
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
    if (this.grace > 0) this.grace -= dt;

    const sees = this.grace <= 0 && this.canSee(player);
    const hears = this.grace <= 0 && this.canHear(player);
    const baseSpeed = 1.5 + this.intensity * 0.5;
    const chaseSpeed = (3.15 + this.intensity * 1.2) * this.speedMul;

    if (sees || (hears && this.mode !== 'chase')) {
      if (this.mode !== 'chase') { this.mode = 'chase'; audio.play('stinger', { vol: 0.7 }); this.onSpot && this.onSpot(); }
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
      if (arrived) { this.searchT -= dt; this.idleAnim(t); this.group.rotation.y += dt * 1.2; }
      if (this.searchT <= 0) { this.mode = 'patrol'; this.patrolTarget = null; }
      return;
    }
    if (this.mode === 'patrol') {
      if (!this.patrolTarget) {
        // bias towards the player's rough area so it never feels absent for long
        const pts = [...this.patrol].sort(() => Math.random() - 0.5);
        this.patrolTarget = (Math.random() < 0.45 + this.intensity * 0.3 ? pts.sort((a, b) => a.distanceTo(player.pos) - b.distanceTo(player.pos))[0] : pts[0]).clone();
      }
      if (this.goTo(this.patrolTarget, baseSpeed, dt)) this.patrolTarget = null;
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
    this.place(far); this.mode = 'patrol'; this.patrolTarget = null; this.grace = 7; this.path = null; this.alert = 0;
  }

  startGlimpse(pos, player, { vanishDist = 7, life = 20, onEnd } = {}) {
    this.place(pos, player.pos);
    this.show(true);
    audio.play('scrape', { pos });
    this.mode = 'glimpse';
    this.glimpse = { t: 0, seen: 0, vanishDist, life, onEnd };
  }

  dispose() { this.world.scene.remove(this.group); }
}
