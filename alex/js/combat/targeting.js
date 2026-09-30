// Combat Focus: the game infers who Alex means to fight. Narrow cone to choose,
// huge cone to keep, sticky through combos, automatic switching on kills, and an
// optional hard lock. The player always wins: a decisive camera swing overrides it.

import * as THREE from 'three';
import { G } from '../state.js';
import { TARGET } from '../config.js';
import { DEG } from '../core/math.js';

const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();

export class Targeting {
  constructor(scene) {
    this.focus = null;          // { enemy, node }
    this.level = 'none';        // none | combat | hard
    this.soft = null;
    this.combatUntil = 0;
    this.outSince = 0;
    this.switchCd = 0;
    this.cands = [];
    this.losCache = new Map();
    // marker
    const g = new THREE.Group();
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: '#ff4fa3', depthTest: false, transparent: true }));
    dia.renderOrder = 30;
    dia.scale.y = 1.6;
    g.add(dia);
    const br = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: '#ffd60a', depthTest: false, transparent: true }));
      b.renderOrder = 30;
      const a = (i / 4) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0);
      b.rotation.z = a + Math.PI / 2;
      br.add(b);
    }
    g.add(br);
    g.visible = false;
    scene.add(g);
    this.marker = g; this.dia = dia; this.brackets = br;
  }

  reset() { this.focus = null; this.level = 'none'; this.soft = null; this.losCache.clear(); }

  nodePos(f, out = tmp) {
    if (f.node && f.node.pos) return f.node.pos(out);
    return f.enemy.aimPoint(out);
  }

  _collect() {
    const cam = G.camera;
    cam.getWorldDirection(fwd);
    const out = this.cands;
    out.length = 0;
    const room = G.room;
    if (!room) return out;
    const alex = G.alex;
    for (const e of room.enemies) {
      if (!e.alive || !e.targetable()) continue;
      const nodes = e.nodes && e.nodes.length ? e.nodes.filter((n) => !n.hidden) : [null];
      for (const node of nodes) {
        const p = node ? node.pos(new THREE.Vector3()) : e.aimPoint(new THREE.Vector3());
        tmp.copy(p).sub(cam.position);
        const dcam = tmp.length();
        const ang = Math.acos(Math.max(-1, Math.min(1, tmp.dot(fwd) / (dcam || 1)))) / DEG;
        const dist = Math.hypot(p.x - alex.pos.x, p.z - alex.pos.z);
        // screen x for directional switching
        const sp = p.clone().project(cam);
        out.push({ enemy: e, node, p, ang, dist, sx: sp.x, sy: sp.y, onScreen: sp.z < 1 && Math.abs(sp.x) < 1.05 && Math.abs(sp.y) < 1.05, vis: this._los(e, p) });
      }
    }
    return out;
  }

  _los(e, p) {
    const c = this.losCache.get(e);
    if (c && G.time - c.t < 0.15) return c.v;
    const a = G.alex;
    const v = G.room.world.losClear(a.pos.x, a.pos.y + 1.3, a.pos.z, p.x, p.y, p.z);
    this.losCache.set(e, { t: G.time, v });
    return v;
  }

  same(a, b) { return a && b && a.enemy === b.enemy && a.node === b.node; }
  find(f) { return f && this.cands.find((c) => this.same(c, f)); }

  update(dt) {
    const inp = G.input, S = G.settings, alex = G.alex;
    this.switchCd -= dt;
    const cands = this._collect();
    // soft target: narrow acquisition cone
    let best = null, bs = Infinity;
    for (const c of cands) {
      if (!c.vis || c.dist > TARGET.range || c.ang > TARGET.acquire) continue;
      const s = c.ang + c.dist * 0.8;
      if (s < bs) { bs = s; best = c; }
    }
    this.soft = best;

    // hard lock input
    const lockPressed = inp.pressed('lock');
    if (S.lockMode === 'hold') {
      if (inp.isHeld('lock') && this.level !== 'hard') this._hardLock(cands);
      else if (!inp.isHeld('lock') && this.level === 'hard') this.level = this.focus ? 'combat' : 'none';
    } else if (lockPressed) {
      if (this.level === 'hard') this.level = this.focus ? 'combat' : 'none';
      else this._hardLock(cands);
    }

    // validate current focus
    let cur = this.find(this.focus);
    if (this.focus && (!this.focus.enemy.alive || !cur)) {
      const died = !this.focus.enemy.alive;
      const wasHard = this.level === 'hard';
      this.focus = null;
      if (died && (S.autoSwitch || wasHard)) {
        const next = this._priority(cands);
        if (next) { this.focus = next; this.combatUntil = G.time + TARGET.combatTimeout; if (!wasHard) this.level = 'combat'; } else this.level = 'none';
      } else this.level = 'none';
      cur = this.find(this.focus);
    }

    if (cur && this.level !== 'hard') {
      const sticky = alex.stickyTarget();
      // retention cone
      if (cur.ang > TARGET.retain) { if (!this.outSince) this.outSince = G.time; } else this.outSince = 0;
      const decisive = inp.lookRate > 7 && cur.ang > TARGET.acquire * 1.4 && !sticky;
      if (!sticky && (decisive || (this.outSince && G.time - this.outSince > 0.8) || cur.dist > TARGET.range * 1.3 || G.time > this.combatUntil)) {
        this.focus = null; this.level = 'none';
      }
    }
    if (!S.autoTarget && this.level !== 'hard') { this.focus = null; this.level = 'none'; }

    // manual switching (flick while locked, or explicit keys)
    const dirKey = inp.pressed('targetNext') ? 1 : inp.pressed('targetPrev') ? -1 : 0;
    const flick = this.level === 'hard' ? inp.flick : 0;
    const dir = dirKey || flick;
    if (dir && this.switchCd <= 0 && (this.focus || dirKey)) {
      const from = this.find(this.focus);
      const fx = from ? from.sx : 0;
      let pick = null, pd = Infinity;
      for (const c of cands) {
        if (!c.vis || this.same(c, this.focus) || !c.onScreen) continue;
        const dx = (c.sx - fx) * dir;
        if (dx <= 0.02) continue;
        const score = dx + Math.abs(c.sy - (from ? from.sy : 0)) * 0.5;
        if (score < pd) { pd = score; pick = c; }
      }
      if (pick) {
        this.focus = { enemy: pick.enemy, node: pick.node };
        if (this.level === 'none') this.level = 'combat';
        this.combatUntil = G.time + TARGET.combatTimeout;
        this.switchCd = TARGET.switchCooldown;
        G.audio.sfx('ui', { p: 1.3, v: 0.6 });
      }
    }
    this._marker(dt);
  }

  _hardLock(cands) {
    let pick = this.find(this.focus) || this.soft;
    if (!pick) {
      let bd = Infinity;
      for (const c of cands) if (c.vis && c.dist < TARGET.range && c.ang + c.dist < bd) { bd = c.ang + c.dist; pick = c; }
    }
    if (pick) { this.focus = { enemy: pick.enemy, node: pick.node }; this.level = 'hard'; G.audio.sfx('ui', { p: 1.5, v: 0.6 }); }
  }

  // After a kill: pointed-at → attacking Alex → closest visible → closest to centre.
  _priority(cands) {
    const vis = cands.filter((c) => c.vis && c.dist < TARGET.range);
    if (!vis.length) return null;
    const pointed = vis.filter((c) => c.ang < TARGET.acquire).sort((a, b) => a.ang - b.ang)[0];
    if (pointed) return { enemy: pointed.enemy, node: pointed.node };
    const attacking = vis.filter((c) => c.enemy.threatening()).sort((a, b) => a.dist - b.dist)[0];
    if (attacking) return { enemy: attacking.enemy, node: attacking.node };
    const close = vis.slice().sort((a, b) => a.dist - b.dist)[0];
    return { enemy: close.enemy, node: close.node };
  }

  // Called when Alex attacks: looking at an enemy + attacking = "yes, this one".
  onAttack() {
    if (!G.settings.autoTarget) return;
    if (!this.focus && this.soft) { this.focus = { enemy: this.soft.enemy, node: this.soft.node }; this.level = 'combat'; }
    if (this.focus) this.combatUntil = Math.max(this.combatUntil, G.time + TARGET.combatTimeout);
  }
  onHit(enemy) {
    if (!G.settings.autoTarget) return;
    if (!this.focus && enemy.alive && enemy.targetable()) { this.focus = { enemy, node: enemy.nodes?.[0] || null }; if (this.level === 'none') this.level = 'combat'; }
    if (this.focus && this.focus.enemy === enemy) this.combatUntil = G.time + TARGET.combatTimeout;
  }
  // Aggressive movement toward an enemy acquires it softly.
  onApproach(dirx, dirz) {
    if (this.focus || !this.soft || !G.settings.autoTarget) return;
    const c = this.soft, a = G.alex;
    const dx = c.p.x - a.pos.x, dz = c.p.z - a.pos.z, l = Math.hypot(dx, dz) || 1;
    if (l < 10 && (dx * dirx + dz * dirz) / l > 0.93) {
      this._approachT = (this._approachT || 0) + G.dt;
      if (this._approachT > 0.45) { this.focus = { enemy: c.enemy, node: c.node }; this.level = 'combat'; this.combatUntil = G.time + TARGET.combatTimeout; this._approachT = 0; }
    } else this._approachT = 0;
  }

  // Melee correction target within `coneDeg` of `dir` and `range` of Alex.
  meleeTarget(dirx, dirz, coneDeg, range) {
    const a = G.alex;
    const f = this.find(this.focus);
    const rel = (c) => {
      const dx = c.p.x - a.pos.x, dz = c.p.z - a.pos.z, l = Math.hypot(dx, dz) || 1;
      return { ang: Math.acos(Math.max(-1, Math.min(1, (dx * dirx + dz * dirz) / l))) / DEG, l };
    };
    if (f && f.dist < range + 1) {
      const r = rel(f);
      if (r.ang < coneDeg * 1.5 && Math.abs(f.p.y - a.pos.y) < 3.5) return f;
    }
    let best = null, bs = Infinity;
    for (const c of this.cands) {
      if (c.dist > range || Math.abs(c.p.y - (a.pos.y + 1)) > 3) continue;
      const r = rel(c);
      if (r.ang > coneDeg) continue;
      const s = r.ang * 0.05 + r.l;
      if (s < bs) { bs = s; best = c; }
    }
    return best;
  }

  // Where a ranged shot should go: reticle ray, bent toward the best target within the
  // aim-assist cone. Returns a world point.
  aimPoint(out) {
    const cam = G.camera;
    cam.getWorldDirection(fwd);
    const cone = TARGET.aimAssist[G.settings.aimAssist] ?? 8;
    let best = null, bs = Infinity;
    const f = this.find(this.focus);
    for (const c of this.cands) {
      if (!c.vis || c.dist > 40) continue;
      if (c.ang > cone && !(f && this.same(c, f) && this.level === 'hard')) continue;
      // directly aimed > dangerous nearby > nearest > distant
      const s = c.ang * 1.0 + (c.enemy.threatening() && c.dist < 8 ? -2 : 0) + c.dist * 0.06 - (this.same(c, f) ? 1.5 : 0);
      if (s < bs) { bs = s; best = c; }
    }
    if (best) return out.copy(best.p);
    const w = G.room?.world;
    const hit = w && w.raycast(cam.position.x, cam.position.y, cam.position.z, fwd.x, fwd.y, fwd.z, 80, (b) => b.shoot && !b.wall);
    const t = hit ? hit.t : 60;
    out.copy(cam.position).addScaledVector(fwd, t);
    if (!hit && fwd.y < 0) {
      const tg = -cam.position.y / fwd.y;
      if (tg > 0 && tg < t) out.copy(cam.position).addScaledVector(fwd, tg);
    }
    return out;
  }

  focusPos(out) { const f = this.find(this.focus); return f ? out.copy(f.p) : null; }
  focusEnemy() { return this.focus && this.focus.enemy.alive ? this.focus.enemy : null; }

  _marker(dt) {
    const f = this.find(this.focus);
    const show = f && this.level !== 'none';
    this.marker.visible = !!show;
    if (!show) return;
    const p = f.p;
    const top = f.node ? 0.9 : f.enemy.height * 0.55 + 0.5;
    this.marker.position.set(p.x, p.y + top, p.z);
    this.marker.quaternion.copy(G.camera.quaternion);
    this.dia.rotation.y += dt * 4;
    this.dia.position.y = Math.sin(G.time * 5) * 0.06;
    this.brackets.visible = this.level === 'hard';
    this.brackets.rotation.z += dt * 1.5;
    this.brackets.scale.setScalar(Math.max(0.8, f.enemy.radius * 1.4));
    this.brackets.position.y = -top + (f.node ? 0 : f.enemy.height * 0.05);
  }
}
