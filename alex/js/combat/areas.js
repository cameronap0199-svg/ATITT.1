// Telegraphed area attacks. Every ground attack shows a floor telegraph whose inner
// fill grows to the edge exactly when it hits, answering "where" and "when".
// Primitives: circle strike, expanding shockwave ring (jumpable), lane strike, cone,
// rectangle, rotating beam and queue-rope sweep (low = jump, high = stay grounded).

import * as THREE from 'three';
import { G } from '../state.js';

const ALEX_R = 0.36;

function intensity() {
  const s = G.settings.indicatorIntensity;
  return s === 'low' ? 0.65 : s === 'high' ? 1.45 : 1;
}

const matPool = {};
function tmat(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
}

const circleGeo = new THREE.CircleGeometry(1, 48);
const ringGeo = new THREE.RingGeometry(0.94, 1, 64);
const planeGeo = new THREE.PlaneGeometry(1, 1);
const edgeGeo = (() => {
  // unit square outline
  const g = new THREE.BufferGeometry();
  const t = 0.04;
  const v = [];
  const quad = (x0, z0, x1, z1) => v.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z0, x1, 0, z1, x0, 0, z1);
  quad(-0.5, -0.5, 0.5, -0.5 + t); quad(-0.5, 0.5 - t, 0.5, 0.5); quad(-0.5, -0.5, -0.5 + t, 0.5); quad(0.5 - t, -0.5, 0.5, 0.5);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
})();

export class Areas {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }
  clear() { for (const a of this.list) a.dispose(); this.list.length = 0; }
  clearOwner(owner) { this.list = this.list.filter((a) => { if (a.o.owner === owner && !a.o.keep) { a.dispose(); return false; } return true; }); }
  update(dt) {
    this.list = this.list.filter((a) => {
      if (a.update(dt) === false) { a.dispose(); return false; }
      return true;
    });
  }
  add(a) { this.list.push(a); this.scene.add(a.group); return a; }

  circle(o) { return this.add(new CircleStrike(o)); }
  ring(o) { return this.add(new RingWave(o)); }
  lane(o) { return this.add(new LaneStrike(o)); }
  cone(o) { return this.add(new ConeStrike(o)); }
  rect(o) { return this.add(new RectStrike(o)); }
  beam(o) { return this.add(new Beam(o)); }
  rope(o) { return this.add(new Rope(o)); }
  // How many ground attacks are live (camera bullet-hell state).
  activeCount() { return this.list.length; }
}

// Damage helpers -------------------------------------------------------------
function alexFeetAbove(y) { return G.alex.pos.y - y; }
function hitAlex(o, dirx, dirz, kind = 'area') {
  return G.alex.hurt(o.dmg, { source: o.owner || 'hazard', kind, dir: [dirx, dirz], knock: o.knock ?? 5 });
}
function hitEnemiesWhere(o, test) {
  if (!o.ff || !G.room) return;
  for (const e of G.room.enemies) {
    if (!e.alive || e === o.owner || e.intangible) continue;
    if (test(e)) e.hurt(o.enemyDmg ?? o.dmg, { source: o.owner || 'hazard', dir: [e.pos.x - (o.x || 0), e.pos.z - (o.z || 0)], knock: o.knock ?? 5, friendly: true, area: true });
  }
}

class Base {
  constructor(o) {
    this.o = o;
    this.t = 0;
    this.group = new THREE.Group();
    this.y = (o.y ?? 0) + 0.04;
    this.mats = [];
    this.k = intensity();
    this.fired = false;
  }
  m(color, opacity) { const m = tmat(color, Math.min(1, opacity * this.k)); this.mats.push(m); return m; }
  dispose() { this.group.parent?.remove(this.group); for (const m of this.mats) m.dispose(); }
  progress() { return Math.min(1, this.t / Math.max(0.001, this.o.delay ?? 0.8)); }
}

// ---------------------------------------------------------------------------
class CircleStrike extends Base {
  constructor(o) {
    super(o);
    const col = o.color || '#ff2e7e';
    this.fill = new THREE.Mesh(circleGeo, this.m(col, 0.16));
    this.edge = new THREE.Mesh(ringGeo, this.m(col, 0.9));
    this.prog = new THREE.Mesh(circleGeo, this.m(col, 0.32));
    for (const m of [this.fill, this.edge, this.prog]) { m.rotation.x = -Math.PI / 2; this.group.add(m); }
    this.group.position.set(o.x, this.y, o.z);
    this.group.scale.setScalar(o.r);
    this.linger = o.linger || 0;
  }
  update(dt) {
    this.t += dt;
    const o = this.o, delay = o.delay ?? 0.8;
    if (o.follow && this.t < delay - (o.lockAt ?? 0.25)) { const p = o.follow(); o.x = p.x; o.z = p.z; this.group.position.set(o.x, this.y, o.z); }
    if (!this.fired) {
      const k = this.progress();
      this.prog.scale.setScalar(Math.max(0.02, k));
      if (k > 0.75) this.edge.material.opacity = (Math.sin(this.t * 40) * 0.3 + 0.7) * this.k;
      if (this.t >= delay) {
        this.fired = true;
        this.fire();
        this.fill.visible = this.prog.visible = false;
      }
      return true;
    }
    if (this.linger > 0) {
      this.linger -= dt;
      if (o.lingerDps) this.checkHit(o.lingerDps * dt, true);
      return this.linger > 0;
    }
    return false;
  }
  checkHit(dmg, quiet) {
    const o = this.o, a = G.alex;
    const d = Math.hypot(a.pos.x - o.x, a.pos.z - o.z);
    if (d < o.r + ALEX_R * 0.6 && alexFeetAbove(this.y) < (o.height ?? 3)) {
      if (quiet) { if (!this._tick || G.time - this._tick > 0.4) { this._tick = G.time; G.alex.hurt(Math.ceil(dmg * 2.5), { source: o.owner || 'hazard', kind: 'area', dir: [a.pos.x - o.x, a.pos.z - o.z], knock: 0.5 }); } } else hitAlex(o, a.pos.x - o.x, a.pos.z - o.z);
    }
  }
  fire() {
    const o = this.o;
    this.checkHit(o.dmg);
    hitEnemiesWhere(o, (e) => Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < o.r + e.radius);
    if (G.room && o.propDmg !== 0) G.room.damageBlocksInRadius(o.x, o.z, o.r, o.propDmg ?? o.dmg);
    if (o.onFire) o.onFire(this);
    const fxc = o.fxColor || '#ff9ccf';
    if (o.style === 'fire') {
      G.fx.burst(o.x, this.y + 0.3, o.z, { n: 26, color: ['#ff7b00', '#ffd60a', '#ff2e00'], speed: 4, up: 2.2, life: 0.7, size: 0.35, grav: -2, kind: 'spark' });
    } else if (o.style === 'flash') {
      G.fx.burst(o.x, this.y + 0.5, o.z, { n: 20, color: '#ffffff', speed: 7, up: 0.8, life: 0.3, size: 0.3 });
    } else {
      G.fx.burst(o.x, this.y + 0.2, o.z, { n: 18, color: fxc, speed: 6, up: 1, life: 0.45 });
      G.fx.ring(o.x, this.y, o.z, { r1: o.r * 1.1, color: fxc, life: 0.3 });
    }
    if (o.shake !== 0) G.cam?.shake(o.shake ?? 0.25, o.x, o.z);
    if (o.sound !== null) G.audio.sfx(o.sound || 'boom', { v: o.vol ?? 0.6, pan: G.cam?.panOf(o.x, o.z) });
  }
}

// ---------------------------------------------------------------------------
class RingWave extends Base {
  constructor(o) {
    super(o);
    const col = o.color || '#ff2e7e';
    this.warn = new THREE.Mesh(ringGeo, this.m(col, 0.7));
    this.warn.rotation.x = -Math.PI / 2;
    this.warn.scale.setScalar(o.r0 ?? 1);
    this.group.add(this.warn);
    const h = o.height ?? 0.8;
    const geo = new THREE.CylinderGeometry(1, 1, h, 64, 1, true);
    geo.translate(0, h / 2, 0);
    this.wall = new THREE.Mesh(geo, this.m(col, 0.45));
    this.wall.visible = false;
    this.group.add(this.wall);
    this.band = new THREE.Mesh(ringGeo, this.m('#ffffff', 0.9));
    this.band.rotation.x = -Math.PI / 2;
    this.band.visible = false;
    this.group.add(this.band);
    this.group.position.set(o.x, this.y, o.z);
    this.radius = o.r0 ?? 0.5;
    this.lastR = this.radius;
  }
  update(dt) {
    this.t += dt;
    const o = this.o, delay = o.delay ?? 0.5;
    if (this.t < delay) {
      this.warn.material.opacity = (0.35 + 0.5 * Math.abs(Math.sin(this.t * 14))) * this.k;
      return true;
    }
    if (!this.fired) { this.fired = true; this.warn.visible = false; this.wall.visible = this.band.visible = true; }
    this.lastR = this.radius;
    this.radius += (o.speed ?? 8) * dt;
    const R = this.radius;
    this.wall.scale.set(R, 1, R);
    this.band.scale.setScalar(R);
    this.wall.material.opacity = 0.45 * this.k * (1 - R / (o.r1 ?? 12)) + 0.1;
    const a = G.alex, w = (o.width ?? 0.7) / 2 + ALEX_R;
    const d = Math.hypot(a.pos.x - o.x, a.pos.z - o.z);
    if (!this.hitAlex && d > this.lastR - w && d < R + w && alexFeetAbove(this.y) < (o.height ?? 0.8) * 0.75) {
      this.hitAlex = true;
      hitAlex(o, a.pos.x - o.x, a.pos.z - o.z);
    }
    if (o.ff) {
      this.hitSet = this.hitSet || new Set();
      hitEnemiesWhere(o, (e) => {
        if (this.hitSet.has(e)) return false;
        const de = Math.hypot(e.pos.x - o.x, e.pos.z - o.z);
        if (de > this.lastR - 0.6 && de < R + 0.6 && e.pos.y < 0.5) { this.hitSet.add(e); return true; }
        return false;
      });
    }
    return R < (o.r1 ?? 12);
  }
}

// ---------------------------------------------------------------------------
class LaneStrike extends Base {
  constructor(o) {
    super(o);
    const col = o.color || '#ff2e7e';
    const len = Math.hypot(o.x2 - o.x1, o.z2 - o.z1);
    this.len = len;
    this.cx = (o.x1 + o.x2) / 2; this.cz = (o.z1 + o.z2) / 2;
    this.yaw = Math.atan2(o.x2 - o.x1, o.z2 - o.z1);
    this.dir = [(o.x2 - o.x1) / len, (o.z2 - o.z1) / len];
    this.fill = new THREE.Mesh(planeGeo, this.m(col, 0.16));
    this.prog = new THREE.Mesh(planeGeo, this.m(col, 0.34));
    this.edge = new THREE.Mesh(edgeGeo, this.m(col, 0.9));
    for (const m of [this.fill, this.prog]) { m.rotation.x = -Math.PI / 2; }
    this.inner = new THREE.Group();
    this.inner.add(this.fill, this.prog, this.edge);
    this.inner.scale.set(o.width, 1, len);
    this.inner.rotation.y = this.yaw;
    this.group.add(this.inner);
    this.group.position.set(this.cx, this.y, this.cz);
    const h = o.pillar ?? 5;
    const pg = new THREE.BoxGeometry(1, h, 1);
    pg.translate(0, h / 2, 0);
    this.pillar = new THREE.Mesh(pg, this.m(o.strikeColor || '#ffffff', 0.75));
    this.pillar.scale.set(o.width, 1, len);
    this.pillar.rotation.y = this.yaw;
    this.pillar.visible = false;
    this.group.add(this.pillar);
  }
  update(dt) {
    this.t += dt;
    const o = this.o, delay = o.delay ?? 0.8;
    if (!this.fired) {
      const k = this.progress();
      // fill grows from the centre line outwards
      this.prog.scale.set(Math.max(0.02, k), 1, 1);
      if (this.t >= delay) {
        this.fired = true;
        this.fill.visible = this.prog.visible = false;
        this.pillar.visible = true;
        G.audio.sfx(o.sound || 'hit', { v: 0.4, pan: G.cam?.panOf(this.cx, this.cz), gap: 0.05 });
        if (o.shake) G.cam?.shake(o.shake, this.cx, this.cz);
      }
      return true;
    }
    const act = this.t - delay;
    this.pillar.material.opacity = 0.75 * (1 - act / (o.duration ?? 0.25)) * this.k;
    // hit test during the active window
    const a = G.alex;
    if (!this.hitDone && this.inside(a.pos.x, a.pos.z, ALEX_R) && alexFeetAbove(this.y) < (o.height ?? 4)) {
      this.hitDone = true;
      const px = -this.dir[1], pz = this.dir[0];
      const side = (a.pos.x - this.cx) * px + (a.pos.z - this.cz) * pz;
      hitAlex(o, px * Math.sign(side || 1), pz * Math.sign(side || 1));
    }
    if (o.ff && !this.ffDone) { this.ffDone = true; hitEnemiesWhere(o, (e) => this.inside(e.pos.x, e.pos.z, e.radius)); }
    return act < (o.duration ?? 0.25);
  }
  inside(x, z, r) {
    const dx = x - this.cx, dz = z - this.cz;
    const along = dx * this.dir[0] + dz * this.dir[1];
    const perp = -dx * this.dir[1] + dz * this.dir[0];
    return Math.abs(along) < this.len / 2 + r * 0.5 && Math.abs(perp) < this.o.width / 2 + r * 0.6;
  }
}

// ---------------------------------------------------------------------------
class ConeStrike extends Base {
  constructor(o) {
    super(o);
    const col = o.color || '#ff2e7e';
    const ang = o.angle;
    const geo = new THREE.CircleGeometry(1, 32, Math.PI / 2 - ang / 2, ang);
    this.fill = new THREE.Mesh(geo, this.m(col, 0.18));
    this.prog = new THREE.Mesh(geo, this.m(col, 0.36));
    const eg = new THREE.RingGeometry(0.96, 1, 32, 1, Math.PI / 2 - ang / 2, ang);
    this.edge = new THREE.Mesh(eg, this.m(col, 0.9));
    this.geos = [geo, eg];
    for (const m of [this.fill, this.prog, this.edge]) { m.rotation.x = -Math.PI / 2; this.group.add(m); }
    this.group.position.set(o.x, this.y, o.z);
    this.group.rotation.y = o.yaw + Math.PI;
    this.group.scale.setScalar(o.range);
    // rotate so the cone points along yaw: circle segment at +y (local) maps to -z after rotation.x
  }
  update(dt) {
    this.t += dt;
    const o = this.o, delay = o.delay ?? 0.8;
    if (o.follow && this.t < delay - 0.25) { const f = o.follow(); o.x = f.x; o.z = f.z; o.yaw = f.yaw; this.group.position.set(o.x, this.y, o.z); this.group.rotation.y = o.yaw + Math.PI; }
    if (!this.fired) {
      this.prog.scale.setScalar(Math.max(0.02, this.progress()));
      if (this.t >= delay) {
        this.fired = true;
        const a = G.alex;
        if (this.inside(a.pos.x, a.pos.z) && alexFeetAbove(this.y) < (o.height ?? 2.5)) hitAlex(o, a.pos.x - o.x, a.pos.z - o.z);
        hitEnemiesWhere(o, (e) => this.inside(e.pos.x, e.pos.z));
        const fx = o.x + Math.sin(o.yaw) * o.range * 0.5, fz = o.z + Math.cos(o.yaw) * o.range * 0.5;
        G.fx.burst(fx, this.y + 0.5, fz, { n: 24, color: o.fxColor || ['#ff4fa3', '#ffd60a'], speed: 7, dir: [Math.sin(o.yaw), Math.cos(o.yaw)], spread: 1.2, up: 0.5, life: 0.5 });
        G.audio.sfx(o.sound || 'boom', { v: 0.5, pan: G.cam?.panOf(o.x, o.z) });
        G.cam?.shake(o.shake ?? 0.2, o.x, o.z);
        this.fill.visible = this.prog.visible = false;
      }
      return true;
    }
    this.edge.material.opacity *= 0.8;
    return this.t < delay + 0.15;
  }
  inside(x, z) {
    const o = this.o, dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz);
    if (d > o.range + ALEX_R) return false;
    const a = Math.atan2(dx, dz);
    let diff = Math.abs(((a - o.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return diff < o.angle / 2 + 0.05 || d < 0.8;
  }
  dispose() { super.dispose(); this.geos.forEach((g) => g.dispose()); }
}

// ---------------------------------------------------------------------------
class RectStrike extends Base {
  constructor(o) {
    super(o);
    const col = o.color || '#ff2e7e';
    this.fill = new THREE.Mesh(planeGeo, this.m(col, 0.12));
    this.fill.rotation.x = -Math.PI / 2;
    this.edge = new THREE.Mesh(edgeGeo, this.m(col, 0.95));
    this.corners = new THREE.Group();
    this.corners.add(this.fill, this.edge);
    this.group.add(this.corners);
    this.group.position.set(o.x, this.y, o.z);
    this.group.rotation.y = o.rot || 0;
    this.w = o.w0 ?? o.w; this.d = o.d0 ?? o.d;
  }
  update(dt) {
    this.t += dt;
    const o = this.o, delay = o.delay ?? 1;
    if (!this.fired) {
      const k = this.progress();
      // tightens from w0/d0 to w/d
      this.w = (o.w0 ?? o.w) + (o.w - (o.w0 ?? o.w)) * k;
      this.d = (o.d0 ?? o.d) + (o.d - (o.d0 ?? o.d)) * k;
      if (o.follow && this.t < delay - (o.lockAt ?? 0.3)) { const f = o.follow(); o.x = f.x; o.z = f.z; }
      this.group.position.set(o.x, this.y, o.z);
      this.corners.scale.set(this.w, 1, this.d);
      this.edge.material.opacity = (k > 0.8 ? 0.6 + 0.4 * Math.sin(this.t * 50) : 0.95) * this.k;
      if (this.t >= delay) {
        this.fired = true;
        const a = G.alex;
        const inside = (x, z, r) => Math.abs(x - o.x) < this.w / 2 + r && Math.abs(z - o.z) < this.d / 2 + r;
        if (inside(a.pos.x, a.pos.z, ALEX_R * 0.5) && alexFeetAbove(this.y) < 4) hitAlex(o, a.pos.x - o.x, a.pos.z - o.z);
        hitEnemiesWhere(o, (e) => inside(e.pos.x, e.pos.z, e.radius * 0.5));
        if (o.onFire) o.onFire(this);
        this.fill.material.opacity = 0.8;
        this.fill.material.color.set('#ffffff');
      }
      return true;
    }
    this.fill.material.opacity *= 0.82;
    this.edge.material.opacity *= 0.82;
    return this.t < delay + 0.25;
  }
}

// ---------------------------------------------------------------------------
// Rotating (or static) beam: a segment from (x,z) at yaw sweeping at yawSpeed.
class Beam extends Base {
  constructor(o) {
    super(o);
    const col = o.color || '#ff2e7e';
    const len = o.length ?? 12, w = o.width ?? 0.8, h = o.height ?? 1.2;
    this.tele = new THREE.Mesh(planeGeo, this.m(col, 0.25));
    this.tele.rotation.x = -Math.PI / 2;
    this.tele.scale.set(w, len, 1);
    this.tele.position.z = len / 2;
    const bg = new THREE.BoxGeometry(w * 0.6, 0.3, len);
    bg.translate(0, h, len / 2);
    this.beam = new THREE.Mesh(bg, this.m('#ffffff', 0.85));
    this.glow = new THREE.Mesh(bg, this.m(col, 0.35));
    this.glow.scale.set(2.2, 3, 1);
    this.beam.visible = this.glow.visible = false;
    this.pivot = new THREE.Group();
    this.pivot.add(this.tele, this.beam, this.glow);
    this.group.add(this.pivot);
    this.group.position.set(o.x, this.y, o.z);
    this.yaw = o.yaw ?? 0;
    this.pivot.rotation.y = this.yaw;
    this.geo = bg;
    this.lastYaw = this.yaw;
  }
  update(dt) {
    this.t += dt;
    const o = this.o, delay = o.delay ?? 0.9;
    if (this.t < delay) {
      this.tele.material.opacity = (0.15 + 0.25 * (this.t / delay) + (this.t > delay * 0.7 ? 0.2 * Math.sin(this.t * 40) : 0)) * this.k;
      return true;
    }
    if (!this.fired) { this.fired = true; this.beam.visible = this.glow.visible = true; this.tele.visible = !!o.keepTele; G.audio.sfx('charge', { v: 0.4 }); }
    this.lastYaw = this.yaw;
    this.yaw += (o.yawSpeed || 0) * dt;
    this.pivot.rotation.y = this.yaw;
    const a = G.alex;
    const dx = a.pos.x - o.x, dz = a.pos.z - o.z, d = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    const within = (y0, y1) => {
      const span = ((y1 - y0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const rel = ((ang - y0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const pad = Math.atan2((o.width ?? 0.8) / 2 + ALEX_R, Math.max(d, 0.5));
      return span >= 0 ? rel >= -pad && rel <= span + pad : rel <= pad && rel >= span - pad;
    };
    if (d < (o.length ?? 12) + ALEX_R && within(this.lastYaw, this.yaw)) {
      const feet = alexFeetAbove(this.y), h = o.height ?? 1.2;
      if (feet < h + 0.3 && feet + 1.7 > h - 0.3 && (!this.lastHit || G.time - this.lastHit > (o.tick ?? 0.6))) {
        this.lastHit = G.time;
        hitAlex(o, -dz, dx);
      }
    }
    return this.t < delay + (o.duration ?? 2);
  }
  dispose() { super.dispose(); this.geo.dispose(); }
}

// ---------------------------------------------------------------------------
// Queue rope: a segment (a→b) that travels along `dir` for `travel` metres.
// low: at 0.35 m — jump it. high: at 2.15 m — passes over grounded Alex, hits if airborne.
class Rope extends Base {
  constructor(o) {
    super(o);
    const low = o.level === 'low';
    this.h = low ? 0.4 : 2.15;
    const col = low ? '#ffb703' : '#b388ff';
    const len = Math.hypot(o.bx - o.ax, o.bz - o.az);
    this.len = len;
    this.axis = [(o.bx - o.ax) / len, (o.bz - o.az) / len];
    this.dir = o.dir;
    this.pos = 0;
    this.last = 0;
    const cx = (o.ax + o.bx) / 2, cz = (o.az + o.bz) / 2;
    this.cx = cx; this.cz = cz;
    this.yaw = Math.atan2(this.axis[0], this.axis[1]);
    // telegraph: a glowing band over the whole path the rope will sweep
    this.path = new THREE.Mesh(planeGeo, this.m(col, 0.14));
    this.path.rotation.x = -Math.PI / 2;
    this.path.scale.set(len, o.travel, 1);
    const pg = new THREE.Group();
    pg.add(this.path);
    pg.rotation.y = Math.atan2(o.dir[0], o.dir[1]);
    pg.position.set(cx + o.dir[0] * o.travel / 2, this.y, cz + o.dir[1] * o.travel / 2);
    this.group.add(pg);
    // rope itself
    const rg = new THREE.CylinderGeometry(0.09, 0.09, len, 8);
    rg.rotateZ(Math.PI / 2);
    this.rope = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: low ? '#ffd166' : '#d0a2ff' }));
    this.ropeGlow = new THREE.Mesh(rg, this.m(col, 0.4));
    this.ropeGlow.scale.set(1, 3, 3);
    this.posts = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, this.h + 0.3, 8), new THREE.MeshBasicMaterial({ color: '#d4af37' }));
      p.position.set(s * len / 2, (this.h + 0.3) / 2, 0);
      this.posts.add(p);
    }
    this.ropeG = new THREE.Group();
    this.ropeG.add(this.rope, this.ropeGlow, this.posts);
    this.rope.position.y = this.ropeGlow.position.y = this.h;
    this.ropeG.rotation.y = this.yaw - Math.PI / 2;
    this.ropeG.position.set(cx, this.y, cz);
    this.ropeG.visible = false;
    this.group.add(this.ropeG);
    this.geos = [rg];
    this.label = o.label;
  }
  update(dt) {
    this.t += dt;
    const o = this.o, delay = o.delay ?? 1.1;
    if (this.t < delay) {
      this.path.material.opacity = (0.1 + 0.2 * (this.t / delay)) * this.k;
      this.ropeG.visible = this.t > delay * 0.4;
      this.ropeG.position.y = this.y - (1 - this.t / delay) * 2;
      return true;
    }
    if (!this.fired) { this.fired = true; G.audio.sfx('rope', { v: 0.5 }); this.ropeG.position.y = this.y; }
    this.last = this.pos;
    this.pos += (o.speed ?? 9) * dt;
    const px = this.cx + this.dir[0] * this.pos, pz = this.cz + this.dir[1] * this.pos;
    this.ropeG.position.set(px, this.y, pz);
    const a = G.alex;
    const rel = (a.pos.x - this.cx) * this.dir[0] + (a.pos.z - this.cz) * this.dir[1];
    const lat = Math.abs((a.pos.x - this.cx) * this.axis[0] + (a.pos.z - this.cz) * this.axis[1]);
    if (!this.hitDone && lat < this.len / 2 && rel > this.last - ALEX_R && rel < this.pos + ALEX_R) {
      const feet = alexFeetAbove(this.y);
      const hit = this.h < 1 ? feet < this.h + 0.05 : feet + 1.72 > this.h;
      if (hit) { this.hitDone = true; hitAlex(o, this.dir[0], this.dir[1]); }
    }
    return this.pos < o.travel;
  }
  dispose() { super.dispose(); this.geos.forEach((g) => g.dispose()); }
}
