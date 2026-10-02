// Minecraft mobs for the Nether, strongholds and Overworld rifts. Blocky pixel-faced
// models on the shared Enemy base. Zombified piglins are neutral until you hit one
// (then all of them come for you), ghast fireballs can be knocked back with a melee
// swing, magma cubes split, silverfish call their friends.

import * as THREE from 'three';
import { G } from '../state.js';
import { Enemy } from '../actors/enemy.js';
import { mat, glow } from '../world/props.js';
import { part as m, grp, box, walk } from '../actors/enemyModels.js';
import { RIFTS } from '../world/rifts.js';
import { MOVE } from '../config.js';
import { wrapAngle, clamp } from '../core/math.js';

const RUN = MOVE.runSpeed;
const now = () => performance.now() * 0.001;
const say = (e, text, color = '#ffffff', dur = 1.2) => G.hud.bubble(e, text, color, dur);
const pan = (e) => G.cam.panOf(e.pos.x, e.pos.z);

// ---------------------------------------------------------------------------- textures
const texCache = new Map();
export function pix(key, rows, pal) {
  if (texCache.has(key)) return texCache.get(key);
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = rows[y][x];
    let col = pal[k];
    if (typeof col === 'function') col = col(x, y);
    if (!col) continue;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}
export const noisy = (base, seed, amt = 0.35) => (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453; const f = (n - Math.floor(n)) * amt - amt / 2; const c = new THREE.Color(base); c.offsetHSL(0, 0, f); return '#' + c.getHexString(); };
const texMat = (t, o = {}) => new THREE.MeshToonMaterial({ map: t, color: '#ffffff', emissive: o.emissive || '#000000', emissiveIntensity: o.ei || 0, transparent: !!o.transparent });
export function faceBox(parent, size, face, side, pos, o = {}) {
  const sm = typeof side === 'string' ? mat(side) : texMat(side, o);
  const fm = texMat(face, o);
  const mesh = new THREE.Mesh(box(...size), [sm, sm, sm, sm, fm, sm]);
  mesh.position.set(...pos);
  mesh.userData.noMerge = true;
  parent.add(mesh);
  const ol = new THREE.Mesh(box(...size), new THREE.MeshBasicMaterial({ color: '#0b0714', side: THREE.BackSide }));
  ol.scale.setScalar(1.06); ol.userData.outline = true; ol.userData.noMerge = true;
  mesh.add(ol);
  return mesh;
}
const rep8 = (row) => Array.from({ length: 8 }, () => row);

// ---------------------------------------------------------------------------- models
export const MC_MODELS = {
  piglin(brute = false) {
    const g = new THREE.Group();
    const skin = brute ? '#e8a598' : '#d98f8f';
    const face = pix(brute ? 'bruteFace' : 'zpigFace', [
      'pppppppp', 'pppppppp', 'pkwppwkp', 'pppppppp', 'ppSSSSpp', 'pSnSSnSp', 'pgSSSSgp', 'pgppppgp',
    ], { p: brute ? noisy(skin, 3) : (x, y) => (x + y * 3) % 5 === 0 ? '#7fa65a' : noisy(skin, 5)(x, y), k: '#1a1a1a', w: '#f5f5f5', S: '#f0b3b3', n: '#6b3030', g: '#f5e6c8' });
    const body = grp(g, 0, 0.8, 0);
    m(body, box(0.52, 0.72, 0.3), brute ? '#2b2b2b' : '#7a5230', [0, 0.36, 0]);
    if (brute) m(body, box(0.54, 0.12, 0.32), '#facc15', [0, 0.1, 0]);
    const head = faceBox(body, [0.6, 0.5, 0.5], face, skin, [0, 0.98, 0]);
    for (const s of [-1, 1]) m(head, box(0.12, 0.22, 0.06), skin, [s * 0.34, 0.08, 0], { rot: [0, 0, s * 0.4] });
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.36, 0.66, 0); m(a, box(0.2, 0.7, 0.2), skin, [0, -0.3, 0]); return a; });
    const weapon = grp(arms[1], 0, -0.62, 0.1);
    if (brute) { m(weapon, box(0.06, 0.8, 0.06), '#7a5230', [0, 0, 0.25], { rot: [Math.PI / 2, 0, 0] }); m(weapon, box(0.08, 0.4, 0.3), '#facc15', [0, 0.1, 0.55]); }
    else m(weapon, box(0.08, 0.9, 0.14), '#facc15', [0, 0, 0.45], { rot: [Math.PI / 2, 0, 0], material: glow('#fde047', 0.9) });
    const L = [-1, 1].map((s) => { const l = grp(g, s * 0.13, 0.8, 0); m(l, box(0.24, 0.8, 0.24), brute ? '#3a3a3a' : '#5a3a1e', [0, -0.4, 0]); return l; });
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L, 0.7);
        const swing = e.pose === 'swing' ? Math.sin(now() * 26) * 0.9 : 0;
        arms[0].rotation.x = -s * 0.6; arms[1].rotation.x = e.angry ? -1.2 + swing : s * 0.6;
      },
    };
  },
  ghast() {
    const g = new THREE.Group();
    const skin = noisy('#efefef', 7, 0.18);
    const calm = pix('ghastCalm', ['wwwwwwww', 'wwwwwwww', 'wkkwwkkw', 'wwwwwwww', 'wwwwwwww', 'wwwkkwww', 'wwwwwwww', 'wwwwwwww'], { w: skin, k: '#6b6b6b' });
    const angry = pix('ghastAngry', ['wwwwwwww', 'wwwwwwww', 'wkkwwkkw', 'wrkwwkrw', 'wwwwwwww', 'wwkkkkww', 'wwkkkkww', 'wwwwwwww'], { w: skin, k: '#262626', r: '#dc2626' });
    const sideT = pix('ghastSide', rep8('wwwwwwww'), { w: skin });
    const body = grp(g, 0, 1.6, 0);
    const head = faceBox(body, [2.4, 2.4, 2.4], calm, sideT, [0, 0.6, 0]);
    const tents = [];
    for (let i = 0; i < 9; i++) {
      const t = grp(body, -0.8 + (i % 3) * 0.8, -0.6, -0.8 + Math.floor(i / 3) * 0.8);
      m(t, box(0.18, 1.1 + (i % 2) * 0.4, 0.18), '#e5e5e5', [0, -0.6, 0]);
      tents.push(t);
    }
    return {
      group: g, parts: { head },
      anim(e) {
        const t = now();
        head.material[4].map = e.pose === 'shoot' ? angry : calm;
        tents.forEach((x, i) => { x.rotation.x = Math.sin(t * 2 + i) * 0.35; x.rotation.z = Math.cos(t * 1.7 + i * 1.3) * 0.3; });
        body.position.y = 1.6 + Math.sin(t * 1.3) * 0.15;
      },
    };
  },
  blaze() {
    const g = new THREE.Group();
    const face = pix('blazeFace', ['yyyyyyyy', 'yoyyyyoy', 'ykkyykky', 'yyyyyyyy', 'yyoyyoyy', 'ykkkkkky', 'yyyyyyyy', 'oyyyyyyo'], { y: noisy('#fbbf24', 9), o: '#f97316', k: '#3b2a14' });
    const side = pix('blazeSide', rep8('yyyyyyyy'), { y: noisy('#f59e0b', 11) });
    const core = grp(g, 0, 0.9, 0);
    faceBox(core, [0.55, 0.55, 0.55], face, side, [0, 0.55, 0], { emissive: '#f97316', ei: 0.4 });
    m(core, box(0.12, 0.7, 0.12), '#78350f', [0, -0.1, 0]);
    const rings = [0, 1, 2].map((k) => {
      const r = grp(core, 0, 0.35 - k * 0.38, 0);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; m(r, box(0.1, 0.5, 0.1), '#f59e0b', [Math.sin(a) * (0.5 - k * 0.06), 0, Math.cos(a) * (0.5 - k * 0.06)], { material: glow('#fbbf24', 0.95) }); }
      return r;
    });
    const light = new THREE.PointLight('#f97316', 1.2, 6, 1.8); light.position.y = 1.2; g.add(light);
    return {
      group: g, parts: {},
      anim(e, dt) {
        const t = now();
        rings.forEach((r, k) => { r.rotation.y = t * (1.4 + k * 0.6) * (k % 2 ? -1 : 1); r.position.y = 0.35 - k * 0.38 + Math.sin(t * 3 + k) * 0.05; });
        light.intensity = e.pose === 'charge' ? 2.5 + Math.sin(t * 30) * 0.6 : 1.2;
        if (Math.random() < 0.3) G.fx.burst(e.pos.x, e.pos.y + 0.6, e.pos.z, { n: 1, kind: 'smoke', color: '#3f3f46', speed: 0.6, up: 1, life: 0.6, size: 0.3, grav: -1 });
      },
    };
  },
  magmaCube(size = 3) {
    const g = new THREE.Group();
    const s = [0, 0.55, 1.0, 1.6][size];
    const face = pix('magmaFace', ['dddddddd', 'doodddod', 'dyydddyd', 'dddddddd', 'oooooooo', 'dddddddd', 'dooddood', 'dddddddd'], { d: noisy('#4a1010', 13), o: '#f97316', y: '#fde047' });
    const side = pix('magmaSide', ['dddddddd', 'dddddddd', 'oooooooo', 'dddddddd', 'dddddddd', 'oooooooo', 'dddddddd', 'dddddddd'], { d: noisy('#4a1010', 17), o: '#f97316' });
    const body = grp(g, 0, 0, 0);
    const cube = faceBox(body, [s, s, s], face, side, [0, s / 2, 0], { emissive: '#f97316', ei: 0.25 });
    return {
      group: g, parts: { cube },
      anim(e) {
        const sq = e.pose === 'squash' ? 0.65 : e.jumping ? 1.25 : 1;
        body.scale.y += (sq - body.scale.y) * 0.3;
        body.scale.x = body.scale.z = 1 + (1 - body.scale.y) * 0.5;
      },
    };
  },
  witherSkeleton() {
    const g = new THREE.Group();
    const face = pix('witherFace', ['kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'kwwkkwwk', 'kkkddkkk', 'kkkkkkkk', 'kddddddk', 'kkkkkkkk'], { k: noisy('#2b2b2b', 21, 0.25), w: '#0a0a0a', d: '#4a4a4a' });
    const body = grp(g, 0, 1.1, 0);
    m(body, box(0.5, 0.95, 0.22), '#262626', [0, 0.47, 0]);
    for (let i = 0; i < 4; i++) m(body, box(0.52, 0.04, 0.24), '#4a4a4a', [0, 0.2 + i * 0.18, 0.01], { outline: false });
    faceBox(body, [0.56, 0.56, 0.56], face, '#2b2b2b', [0, 1.22, 0]);
    const arms = [-1, 1].map((s) => { const a = grp(body, s * 0.33, 0.88, 0); m(a, box(0.12, 0.95, 0.12), '#2b2b2b', [0, -0.42, 0]); return a; });
    const sword = grp(arms[1], 0, -0.86, 0.1);
    m(sword, box(0.08, 1.0, 0.16), '#8a8a8a', [0, 0, 0.5], { rot: [Math.PI / 2, 0, 0] });
    m(sword, box(0.3, 0.06, 0.08), '#5c4423', [0, 0, 0.02]);
    const L = [-1, 1].map((s) => { const l = grp(g, s * 0.12, 1.1, 0); m(l, box(0.13, 1.1, 0.13), '#2b2b2b', [0, -0.55, 0]); return l; });
    return {
      group: g, parts: {},
      anim(e) {
        const s = walk(e, L, 0.8);
        const swing = e.pose === 'swing';
        arms[1].rotation.x = swing ? -2.2 + Math.sin(now() * 20) * 0.8 : s * 0.6 - 0.4;
        arms[0].rotation.x = -s * 0.6;
      },
    };
  },
  silverfish() {
    const g = new THREE.Group();
    const segs = [];
    for (let i = 0; i < 5; i++) {
      const sz = [0.18, 0.26, 0.3, 0.22, 0.14][i];
      const s = grp(g, 0, sz / 2, 0.3 - i * 0.18);
      m(s, box(sz * 1.3, sz, 0.18), i === 1 ? '#8a8a8a' : '#a3a3a3', [0, 0, 0]);
      segs.push(s);
    }
    return {
      group: g, parts: {},
      anim(e) { const t = now() * 14; segs.forEach((s, i) => { s.position.x = Math.sin(t + i * 0.9) * 0.05 * Math.min(1, Math.hypot(e.vel.x, e.vel.z) / 2); }); },
    };
  },
  spider() {
    const g = new THREE.Group();
    const face = pix('spiderFace', ['kkkkkkkk', 'kkrkkrkk', 'krrkkrrk', 'kkkkkkkk', 'kkrkkrkk', 'kkkkkkkk', 'kkkddkkk', 'kkkkkkkk'], { k: noisy('#2a2320', 31, 0.2), r: '#dc2626', d: '#5a4a40' });
    const body = grp(g, 0, 0.45, 0);
    faceBox(body, [0.55, 0.45, 0.45], face, '#2a2320', [0, 0.1, 0.45], { emissive: '#000', ei: 0 });
    m(body, box(0.4, 0.35, 0.3), '#2a2320', [0, 0.05, 0.1]);
    m(body, box(0.75, 0.55, 0.75), '#3a302a', [0, 0.15, -0.45]);
    const legsL = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const l = grp(body, s * 0.2, 0.05, 0.25 - i * 0.16);
      m(l, box(0.75, 0.07, 0.07), '#2a2320', [s * 0.38, 0.05, 0], { rot: [0, 0, s * 0.35] });
      legsL.push({ l, s, i });
    }
    return {
      group: g, parts: {},
      anim(e) {
        const sp = Math.hypot(e.vel.x, e.vel.z);
        e._ph = (e._ph || 0) + sp * (e._dt || 0.016) * 4;
        for (const { l, s, i } of legsL) l.rotation.y = Math.sin(e._ph + i * 1.3 + (s > 0 ? 0 : 1.5)) * 0.4 * Math.min(1, sp / 2);
        body.rotation.x = e.pose === 'leap' ? -0.4 : 0;
      },
    };
  },
};

// ---------------------------------------------------------------------------- enemies
export const MC_INFO = {
  piglin: { name: 'Zombified Piglin', franchise: 'minecraft', threat: 1.5 },
  piglinBrute: { name: 'Piglin Brute', franchise: 'minecraft', threat: 3 },
  ghast: { name: 'Ghast', franchise: 'minecraft', threat: 3 },
  blaze: { name: 'Blaze', franchise: 'minecraft', threat: 2.5 },
  magmaCube: { name: 'Magma Cube', franchise: 'minecraft', threat: 2 },
  witherSkeleton: { name: 'Wither Skeleton', franchise: 'minecraft', threat: 3 },
  silverfish: { name: 'Silverfish', franchise: 'minecraft', threat: 0.5 },
  spider: { name: 'Spider', franchise: 'minecraft', threat: 1.5 },
};

class Mob extends Enemy {
  constructor(o, model, ...args) {
    super(o);
    this.franchise = 'minecraft';
    this.franchiseTag = RIFTS.minecraft.tag;
    this.setModel(MC_MODELS[model](...args));
  }
  aim(speed, lead = 0.4) {
    const a = G.alex;
    const tx = a.pos.x + a.vel.x * lead * 0.3, tz = a.pos.z + a.vel.z * lead * 0.3;
    const dx = tx - this.pos.x, dz = tz - this.pos.z, l = Math.hypot(dx, dz) || 1;
    return { vx: dx / l * speed, vz: dz / l * speed, d: l };
  }
}

// Zombified piglin: wanders, minds its own business. Hit one and they all come.
class Piglin extends Mob {
  constructor(o) {
    super({ hp: 40, speed: RUN * 0.55, radius: 0.42, height: 1.95, poise: 'low', ...o }, 'piglin');
    this.passive = true;
    this.angry = false;
    this.wanderT = 0;
  }
  onHurt(dmg, info) { if (info.source === G.alex || info.source?.friendlyPal) this.provokeAll(); }
  provokeAll() {
    for (const e of G.room.enemies) if (e.alive && e instanceof Piglin && !e.angry && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 22) e.provoke();
    if (!this.angry) this.provoke();
  }
  provoke() {
    this.angry = true; this.passive = false;
    say(this, G.run.rng.pick(['*angry oink*', 'HRRNK!', '*zombie pig noises*']), '#f87171', 1);
    G.audio.sfx('roar', { v: 0.25, p: 1.6, pan: pan(this) });
  }
  think(dt) {
    this.pose = null;
    if (!this.angry) {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 3; this.wander = Math.random() * Math.PI * 2; this.idleWalk = Math.random() < 0.6; }
      if (this.idleWalk) { this.steer(dt, Math.sin(this.wander), Math.cos(this.wander), this.speed * 0.35); this.yaw = this.wander; } else this.stop(dt);
      return;
    }
    const d = this.seek(dt, this.speed * 1.25);
    if (d < 1.9) {
      const self = this;
      this.act([
        this.tele(0.4, '#fde047'),
        { t: 0.2, start() { self.pose = 'swing'; self.hitAlexMelee(2, 110, 11, 3); G.audio.sfx('slash', { v: 0.4, pan: pan(self) }); } },
        { t: 0.45, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    }
  }
}
class PiglinBrute extends Mob {
  constructor(o) { super({ hp: 75, speed: RUN * 0.62, radius: 0.45, height: 2, poise: 'med', ...o }, 'piglin', true); this.angry = true; }
  think(dt) {
    this.pose = null;
    const d = this.seek(dt, this.speed);
    if (d < 2.2) {
      const self = this;
      this.act([
        this.tele(0.55, '#facc15'),
        { t: 0.25, start() { self.pose = 'swing'; self.hitAlexMelee(2.4, 130, 17, 6); G.audio.sfx('hitHeavy', { v: 0.5, pan: pan(self) }); G.cam.shake(0.15); } },
        { t: 0.6, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    }
  }
}

// Ghast: drifts high above, crying, and lobs explosive fireballs. Swing at a fireball
// as it arrives to knock it back ("return to sender").
class Ghast extends Mob {
  constructor(o) {
    super({ hp: 60, speed: RUN * 0.3, radius: 1.3, height: 2.8, poise: 'high', flying: true, ...o }, 'ghast');
    this.flying = true;
    this.hover = 4.5 + Math.random() * 1.5;
    this.cd = 2.5 + Math.random() * 2;
    this.balls = [];
    this.cryT = 2 + Math.random() * 4;
    this.unstaggerable = true;
  }
  aimPoint(out) { return out.set(this.pos.x, this.pos.y + 1.9, this.pos.z); }
  think(dt) {
    this.pose = null;
    this.kite(dt, 9, 16, this.speed);
    this.cryT -= dt;
    if (this.cryT <= 0) { this.cryT = 4 + Math.random() * 5; G.audio.sfx('ghast', { v: 0.35, p: 0.8 + Math.random() * 0.4, pan: pan(this) }); }
    this.cd -= dt;
    if (this.cd <= 0 && this.distTo() < 26) {
      this.cd = 3.6 + Math.random() * 1.8;
      const self = this;
      this.act([
        { ...this.tele(0.8, '#f97316'), update(dt, k) { self.threatT = 0.8 * (1 - k); self.pose = 'shoot'; self.faceTarget(dt, 6); self.stop(dt); } },
        { t: 0.5, start() {
          self.pose = 'shoot';
          G.audio.sfx('ghast', { v: 0.5, p: 1.3, pan: pan(self) });
          const a = G.alex, sy = self.pos.y + 1.8;
          const dx = a.pos.x - self.pos.x, dz = a.pos.z - self.pos.z, dy = a.pos.y + 1 - sy, l = Math.hypot(dx, dy, dz) || 1, sp = 11;
          const ball = self.shoot({ kind: 'orb', y: sy, vx: dx / l * sp, vy: dy / l * sp, vz: dz / l * sp, r: 0.55, dmg: 12, color: '#f97316', life: 5, tag: 'ghastball',
            onHit: (p) => G.areas.circle({ x: p.x, z: p.z, r: 2.2, delay: 0.01, dmg: p.hostile ? 10 : 0, ff: p.hostile, enemyDmg: p.hostile ? 0 : 60, owner: 'hazard', style: 'fire', sound: 'boom', shake: 0.25, propDmg: 12 }) });
          self.balls.push(ball);
        }, end() { self.pose = null; } },
      ]);
    }
  }
  update(dt) {
    super.update(dt);
    if (!this.alive) return;
    // reflect fireballs with a melee swing
    const a = G.alex;
    this.balls = this.balls.filter((p) => p.t < p.life && G.projectiles.list.includes(p));
    for (const p of this.balls) {
      if (!p.hostile) continue;
      const dx = p.x - a.pos.x, dz = p.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.9 || Math.abs(p.y - (a.pos.y + 1)) > 2.2 || !a.atk || a.atk.phase !== 'active') continue;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - a.yaw));
      if (ang > 1.9) continue;
      p.hostile = false;
      p.owner = a;
      p.dmg = 60;
      const tx = this.pos.x - p.x, ty = this.pos.y + 1.6 - p.y, tz = this.pos.z - p.z, l = Math.hypot(tx, ty, tz) || 1;
      p.vx = tx / l * 24; p.vy = ty / l * 24; p.vz = tz / l * 24;
      p.t = 0;
      G.hud.bubble(a, 'RETURN TO SENDER', '#fde047', 1.2);
      G.audio.sfx('perfect', { v: 0.6 });
      G.run.stat('ghastReturns', 1);
    }
  }
}

// Blaze: hovers, smokes, charges up and spits three fireballs.
class Blaze extends Mob {
  constructor(o) {
    super({ hp: 50, speed: RUN * 0.4, radius: 0.5, height: 1.9, poise: 'med', flying: true, ...o }, 'blaze');
    this.flying = true;
    this.hover = 1.2;
    this.cd = 1.5 + Math.random() * 1.5;
  }
  think(dt) {
    if (this.pose !== 'charge') this.pose = null;
    this.hover = 1.2 + Math.max(0, Math.sin(G.time * 0.6 + this.drift * 9)) * 2.2;
    this.kite(dt, 5, 11, this.speed);
    this.cd -= dt;
    if (this.cd <= 0 && this.losCached()) {
      this.cd = 3 + Math.random() * 1.2;
      const self = this;
      const shot = () => ({ t: 0.28, start() {
        const a = G.alex, sy = self.pos.y + 1.1;
        const dx = a.pos.x - self.pos.x + (Math.random() - 0.5), dz = a.pos.z - self.pos.z + (Math.random() - 0.5), dy = a.pos.y + 1 - sy, l = Math.hypot(dx, dy, dz) || 1;
        self.shoot({ kind: 'orb', y: sy, vx: dx / l * 19, vy: dy / l * 19, vz: dz / l * 19, r: 0.24, dmg: 7, color: '#fb923c', life: 2.5 });
        G.audio.sfx('flame', { v: 0.5, pan: pan(self) });
      } });
      this.act([
        { ...this.tele(0.7, '#f97316'), start() { self.pose = 'charge'; G.audio.sfx('blaze', { v: 0.4, pan: pan(self) }); self.threatDur = 0.7; G.hud.threatStart(self); }, update(dt, k) { self.threatT = 0.7 * (1 - k); self.faceTarget(dt, 8); self.stop(dt); self.setEmissive('#f97316', 0.4 + k * 0.6); }, end() { self.setEmissive('#000', 0); } },
        shot(), shot(), shot(),
        { t: 0.2, end() { self.pose = null; } },
      ]);
    }
  }
}

// Magma cube: hops at you. Splits into smaller cubes.
class MagmaCube extends Mob {
  constructor(o) {
    const size = o.size || 3;
    super({ hp: [0, 10, 24, 46][size], speed: RUN * 0.5, radius: [0, 0.35, 0.6, 0.9][size], height: [0, 0.55, 1.0, 1.6][size], poise: 'low', ...o }, 'magmaCube', size);
    this.size = size;
    this.cd = 0.6 + Math.random();
    if (size < 3) { this.name = size === 2 ? 'Magma Cube' : 'Small Magma Cube'; this.threat = size * 0.6; }
    if (size === 1) this.noDrop = true;
  }
  think(dt) {
    if (this.jumping) {
      if (this.pos.y <= this.groundH + 0.02 && this.vel.y <= 0) {
        this.jumping = false;
        this.stop(dt, 30);
        G.audio.sfx('land', { v: 0.4, pan: pan(this) });
        G.fx.burst(this.pos.x, this.pos.y + 0.1, this.pos.z, { n: 8, color: ['#f97316', '#4a1010'], speed: 3, life: 0.4, size: 0.15 });
        if (this.distTo() < this.radius + 0.9) G.alex.hurt(this.size * 4 + 2, { source: this, kind: 'melee', dir: [G.alex.pos.x - this.pos.x, G.alex.pos.z - this.pos.z], knock: 3 + this.size });
      }
      return;
    }
    this.pose = null;
    this.stop(dt, 10);
    this.faceTarget(dt, 8);
    this.cd -= dt;
    if (this.cd <= 0) {
      this.cd = 0.9 + Math.random() * 0.8;
      const self = this;
      this.act([
        { t: 0.35 / this.atkK(), start() { self.pose = 'squash'; }, update(dt) { self.stop(dt); } },
        { t: 0.05, start() {
          self.pose = null;
          const v = self.aim(Math.min(9, self.distTo() * 1.2 + 2));
          self.vel.x = v.vx; self.vel.z = v.vz; self.vel.y = 8 + self.size;
          self.jumping = true;
        } },
      ]);
    }
  }
  onDeath() {
    if (this.size <= 1) return;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const c = G.room.spawnEnemy('magmaCube', this.pos.x + Math.sin(a) * 0.6, this.pos.z + Math.cos(a) * 0.6, { size: this.size - 1, readyDelay: 0.4, noSpawnAnim: true });
      if (c) { c.vel.set(Math.sin(a) * 4, 6, Math.cos(a) * 4); c.jumping = true; c.noDrop = this.size - 1 === 1; }
    }
  }
}

class WitherSkeleton extends Mob {
  constructor(o) { super({ hp: 65, speed: RUN * 0.62, radius: 0.45, height: 2.5, poise: 'med', ...o }, 'witherSkeleton'); }
  think(dt) {
    this.pose = null;
    const d = this.seek(dt, this.speed);
    if (d < 2.3) {
      const self = this;
      this.act([
        this.tele(0.42, '#525252'),
        { t: 0.22, start() {
          self.pose = 'swing';
          if (self.hitAlexMelee(2.4, 120, 13, 4)) { G.hud.bubble(G.alex, 'WITHERED', '#525252', 0.8); G.fx.burst(G.alex.pos.x, G.alex.pos.y + 1, G.alex.pos.z, { n: 12, kind: 'smoke', color: '#1f1f1f', speed: 2, life: 0.8, size: 0.4 }); }
          G.audio.sfx('slash', { v: 0.45, p: 0.8, pan: pan(self) });
        } },
        { t: 0.5, update(dt) { self.stop(dt); }, end() { self.pose = null; } },
      ]);
    }
  }
}

// Silverfish: tiny, fast, and when one gets hurt more crawl out of the walls.
class Silverfish extends Mob {
  constructor(o) { super({ hp: 9, speed: RUN * 0.9, radius: 0.3, height: 0.35, poise: 'low', ...o }, 'silverfish'); this.cd = 0; }
  think(dt) {
    const d = this.seek(dt, this.speed);
    this.cd -= dt;
    if (d < 0.9 && this.cd <= 0) { this.cd = 0.7; this.hitAlexMelee(1.0, 180, 4, 1); G.audio.sfx('hit', { v: 0.2, p: 1.8, pan: pan(this) }); }
  }
  onHurt(dmg, info) {
    if (info.source !== G.alex || this.called || !this.alive) return;
    this.called = true;
    if (Math.random() < 0.5 && G.room.enemies.filter((e) => e.alive).length < 24) {
      for (let i = 0; i < 2; i++) {
        const p = G.room.world.openPointNear(G.room.rng, this.pos.x, this.pos.z, 5, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 2 }]);
        if (p) G.room.spawnEnemy('silverfish', p.x, p.z, { readyDelay: 0.6 });
      }
      say(this, '*skitter*', '#d4d4d4', 0.8);
    }
  }
}

class Spider extends Mob {
  constructor(o) { super({ hp: 32, speed: RUN * 0.78, radius: 0.7, height: 0.9, poise: 'low', ...o }, 'spider'); this.cd = 1 + Math.random(); }
  think(dt) {
    if (this.leaping) {
      if (this.pos.y <= this.groundH + 0.02 && this.vel.y <= 0) { this.leaping = false; this.pose = null; }
      else if (this.distTo() < 1.2 && !this.bit) { this.bit = true; G.alex.hurt(9, { source: this, kind: 'melee', dir: [G.alex.pos.x - this.pos.x, G.alex.pos.z - this.pos.z], knock: 4 }); }
      return;
    }
    const d = this.seek(dt, this.speed);
    this.cd -= dt;
    if (d < 6 && d > 2 && this.cd <= 0 && this.losCached()) {
      this.cd = 2.2 + Math.random();
      const self = this;
      this.act([
        { ...this.tele(0.45, '#dc2626'), update(dt, k) { self.threatT = 0.45 * (1 - k); self.stop(dt); self.faceTarget(dt, 12); self.pose = 'leap'; } },
        { t: 0.05, start() { const v = self.aim(Math.min(13, d * 2), 0.6); self.vel.x = v.vx; self.vel.z = v.vz; self.vel.y = 7; self.leaping = true; self.bit = false; G.audio.sfx('hiss', { v: 0.3, pan: pan(self) }); } },
      ]);
    } else if (d < 1.5 && this.cd <= 0) {
      this.cd = 1.1;
      this.hitAlexMelee(1.6, 120, 7, 2);
    }
  }
}

export const MC_CLASSES = { piglin: Piglin, piglinBrute: PiglinBrute, ghast: Ghast, blaze: Blaze, magmaCube: MagmaCube, witherSkeleton: WitherSkeleton, silverfish: Silverfish, spider: Spider };
export { Piglin };
