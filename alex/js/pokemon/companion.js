// Your lead Pokémon follows Alex around the 3D world as a pixel-sprite billboard (like
// the follower Pokémon in the handheld games) and fights alongside him with its real
// moves: special moves fire a projectile in the move's type colour, physical moves dash
// in and hit, healing moves patch Alex up. Damage scales with level, move power and
// STAB. It can't be hurt in real time — battles happen in the tall grass.

import * as THREE from 'three';
import { G } from '../state.js';
import { SPECIES } from './dex.js';
import { MOVES } from './moves.js';
import { TYPES } from './types.js';
import { spriteCanvas } from './sprites.js';
import { monName } from './mon.js';
import { damp } from '../core/math.js';

const texCache = new Map();
function spriteTex(id, shiny) {
  const k = id + (shiny ? '*' : '');
  if (texCache.has(k)) return texCache.get(k);
  const t = new THREE.CanvasTexture(spriteCanvas(id, { shiny }));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  texCache.set(k, t);
  return t;
}

// A billboard group for any species (also used for trainers' Pokémon and the dex).
export function monBillboard(id, shiny = false) {
  const sp = SPECIES[id];
  const g = new THREE.Group();
  const tex = spriteTex(id, shiny).clone();
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3 });
  const s = new THREE.Sprite(mat);
  const h = Math.max(0.7, Math.min(2.4, 0.55 + sp.look.size * 0.6));
  s.scale.set(h * 1.15, h * 1.15, 1);
  s.position.y = h * 0.5;
  g.add(s);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(h * 0.32, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03;
  g.add(shadow);
  return { group: g, sprite: s, tex, h };
}

const tmp = new THREE.Vector3();

export class Buddy {
  constructor(mon) {
    this.mon = mon;
    const b = monBillboard(mon.species, mon.shiny);
    this.b = b;
    this.group = b.group;
    const a = G.alex;
    this.pos = new THREE.Vector3(a.pos.x - Math.sin(a.yaw) * 1.6, a.pos.y, a.pos.z - Math.cos(a.yaw) * 1.6);
    this.vel = new THREE.Vector3();
    this.alive = true;
    this.cd = 1.2;
    this.moveIdx = 0;
    this.hop = 0;
    this.dash = null;
    this.height = b.h;
    this.chatT = 6 + Math.random() * 6;
    this.friendlyPal = true;
    G.room.group.add(this.group);
    this.group.position.copy(this.pos);
    G.fx.burst(this.pos.x, 0.8, this.pos.z, { n: 18, color: ['#ef4444', '#ffffff'], speed: 4, life: 0.4 });
    G.audio.sfx('pkCry', { p: SPECIES[mon.species].cry, v: 0.5 });
  }
  dispose() { this.alive = false; this.group.parent?.remove(this.group); this.b.tex.dispose(); this.b.sprite.material.dispose(); }

  // real-time damage for a move from this Pokémon
  moveDamage(mv) {
    const L = this.mon.level, m = G.run.mods;
    const stab = SPECIES[this.mon.species].types.includes(mv.type) ? 1.5 : 1;
    const power = mv.fx.fixed ? (mv.fx.fixed === 'level' ? L : mv.fx.fixed) * 1.4 : mv.power * (mv.fx.multi ? (mv.fx.multi[0] + mv.fx.multi[1]) / 2 : 1);
    return power / 40 * (3 + L * 0.45) * stab * (m.companionDmg || 1) * (m.dmgMul || 1);
  }
  pickMove() {
    const ms = this.mon.moves.filter((x) => MOVES[x.id]);
    if (!ms.length) return null;
    for (let i = 0; i < ms.length; i++) {
      const mv = MOVES[ms[(this.moveIdx + i) % ms.length].id];
      const ok = mv.cat !== 'status' || mv.fx.heal || mv.fx.rest || mv.fx.self;
      if (ok) { this.moveIdx = (this.moveIdx + i + 1) % ms.length; return mv; }
    }
    return null;
  }

  update(dt) {
    const a = G.alex, room = G.room;
    if (!room) return;
    // pick a target: Alex's focus, else the nearest demon
    let target = G.targeting.focusEnemy?.();
    if (!target || !target.alive || target.passive) {
      let bd = 15; target = null;
      for (const e of room.enemies) { if (!e.alive || !e.targetable() || e.intangible || e.passive) continue; const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z); if (d < bd) { bd = d; target = e; } }
    }
    // movement: follow Alex (or dash at the target during a physical move)
    if (this.dash) {
      this.dash.t += dt;
      const e = this.dash.e;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
      if (this.dash.t < 0.45 && d > e.radius + 0.5) { this.vel.set(dx / d * 18, 0, dz / d * 18); }
      else if (!this.dash.hit) { this.dash.hit = true; this.strike(e, this.dash.mv); }
      if (this.dash.t > 0.7) this.dash = null;
    } else {
      const tx = a.pos.x - Math.sin(a.yaw) * 1.7 + Math.cos(a.yaw) * 1.0, tz = a.pos.z - Math.cos(a.yaw) * 1.7 - Math.sin(a.yaw) * 1.0;
      const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
      const sp = d > 8 ? 26 : Math.min(11, d * 4);
      this.vel.x = damp(this.vel.x, d > 0.25 ? dx / d * sp : 0, 8, dt);
      this.vel.z = damp(this.vel.z, d > 0.25 ? dz / d * sp : 0, 8, dt);
      if (d > 16) this.pos.set(tx, a.pos.y, tz);
    }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const g = room.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2, 0.2);
    this.pos.y = damp(this.pos.y, g.h, 10, dt);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.hop = speed > 1 ? Math.abs(Math.sin(G.time * 11)) * 0.18 : Math.max(0, this.hop - dt);
    // attack
    this.cd -= dt;
    if (target && !this.dash && this.cd <= 0 && G.mode === 'run') {
      const mv = this.pickMove();
      const spe = this.mon.level ? Math.min(0.6, SPECIES[this.mon.species].base[5] / 250) : 0;
      this.cd = 1.7 - spe;
      if (mv) this.use(mv, target);
    }
    // chatter
    this.chatT -= dt;
    if (this.chatT <= 0) {
      this.chatT = 9 + Math.random() * 9;
      const nm = monName(this.mon).toUpperCase();
      G.hud.bubble(this, G.run.rng.pick([`${nm}!`, `${nm} is happy to be with you.`, `${nm} looks around.`, `${nm} is doing its best!`, `${nm} wants to fight!`]), '#fde047', 1.1);
    }
    // face the way it's going (the sprite faces left by default)
    const camR = tmp.set(1, 0, 0).applyQuaternion(G.camera.quaternion);
    const vx = (this.dash ? this.vel.x : this.vel.x), vz = (this.dash ? this.vel.z : this.vel.z);
    if (Math.hypot(vx, vz) > 0.6) this.faceRight = vx * camR.x + vz * camR.z > 0;
    this.b.tex.repeat.x = this.faceRight ? -1 : 1;
    this.b.tex.offset.x = this.faceRight ? 1 : 0;
    this.group.position.set(this.pos.x, this.pos.y + this.hop, this.pos.z);
  }

  use(mv, e) {
    const col = TYPES[mv.type]?.color || '#ffffff';
    if (mv.cat === 'status') {
      if (mv.fx.heal || mv.fx.rest) { G.alex.heal(8 + this.mon.level * 0.3); G.fx.burst(G.alex.pos.x, 1.2, G.alex.pos.z, { n: 12, color: ['#86efac', '#ffffff'], speed: 2, up: 2, life: 0.6 }); }
      else if (mv.fx.self) { G.run.buffs.push({ id: 'pkbuff', roomsLeft: 1, mods: { dmgMul: 1.08 } }); G.run.recomputeMods(); setTimeout(() => { G.run.buffs = G.run.buffs.filter((b) => b.id !== 'pkbuff'); G.run.recomputeMods(); }, 6000); }
      G.hud.bubble(this, `${monName(this.mon).toUpperCase()} used ${mv.name.toUpperCase()}!`, col, 0.9);
      return;
    }
    if (Math.random() < 0.35) G.hud.bubble(this, `${mv.name.toUpperCase()}!`, col, 0.7);
    if (mv.cat === 'phys' && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 9) { this.dash = { e, mv, t: 0, hit: false }; G.audio.sfx('dash', { v: 0.4 }); return; }
    const p = e.aimPoint(new THREE.Vector3());
    const sx = this.pos.x, sy = this.pos.y + this.height * 0.6, sz = this.pos.z;
    const vx = p.x - sx, vy = p.y - sy, vz = p.z - sz, l = Math.hypot(vx, vy, vz) || 1;
    const dmg = this.moveDamage(mv);
    G.projectiles.spawn({ hostile: false, kind: 'star', x: sx, y: sy, z: sz, vx: vx / l * 26, vy: vy / l * 26, vz: vz / l * 26, r: 0.24, dmg, knock: 2.5, stagger: 1, life: 1.4, color: col, homing: 2,
      onHit: (pr, hit) => { if (hit && hit.alive) this.statusOn(hit, mv); G.fx.burst(pr.x, pr.y, pr.z, { n: 10, color: [col, '#ffffff'], speed: 4, life: 0.35 }); } });
    G.audio.sfx('pkHit', { v: 0.35 });
  }
  strike(e, mv) {
    if (!e.alive) return;
    const col = TYPES[mv.type]?.color || '#ffffff';
    e.hurt(this.moveDamage(mv), { source: G.alex, dir: [e.pos.x - this.pos.x, e.pos.z - this.pos.z], knock: 5, stagger: 2, friendly: false });
    this.statusOn(e, mv);
    G.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, { n: 16, color: [col, '#ffffff'], speed: 5, life: 0.4 });
    G.audio.sfx('pkSuper', { v: 0.35 });
    this.vel.multiplyScalar(-0.3);
  }
  statusOn(e, mv) {
    const st = mv.fx.status, ch = mv.fx.chance ?? 1;
    if (st && Math.random() < ch * 0.8) {
      if (st === 'brn') e.burn = { until: G.time + 3, dps: 4 + this.mon.level * 0.2 };
      else if (st === 'par' || st === 'slp' || st === 'frz') e.stun?.(st === 'par' ? 0.7 : 1.4);
      else if (st === 'psn' || st === 'tox') e.burn = { until: G.time + 4, dps: 3 + this.mon.level * 0.15 };
    }
    if (mv.fx.flinch && Math.random() < mv.fx.flinch) e.stun?.(0.4);
    if (mv.fx.drain) G.alex.heal(2 + this.mon.level * 0.08);
  }
}
