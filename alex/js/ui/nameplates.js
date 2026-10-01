// Enemy nameplates: a name title over a health bar that appears when a demon takes
// damage, stays while Alex is focused on it (Combat Focus target, soft target or near
// the reticle) and fades out once it drifts out of focus. Bars trail damage with a
// ghost segment and show the stagger (poise) meter underneath.

import * as THREE from 'three';
import { G } from '../state.js';
import { clamp } from '../core/math.js';

const v = new THREE.Vector3();
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const MAX_PLATES = 9;

export class Nameplates {
  constructor(root) {
    this.root = root;
    this.pool = [];
    this.byEnemy = new Map();
  }

  _make() {
    const d = document.createElement('div');
    d.className = 'eplate';
    d.innerHTML = '<div class="ep-title"><span class="ep-tag"></span><span class="ep-affix"></span><span class="ep-name"></span></div><div class="ep-bar"><i class="ep-ghost"></i><i class="ep-fill"></i><i class="ep-shield"></i></div><div class="ep-poise"><i></i></div>';
    this.root.appendChild(d);
    return { d, tag: d.querySelector('.ep-tag'), affix: d.querySelector('.ep-affix'), name: d.querySelector('.ep-name'), fill: d.querySelector('.ep-fill'), ghost: d.querySelector('.ep-ghost'), shield: d.querySelector('.ep-shield'), poise: d.querySelector('.ep-poise i'), enemy: null, ghostK: 1, k: 0, lastFlash: 0 };
  }

  clear() { for (const p of this.pool) { p.enemy = null; p.k = 0; p.d.style.opacity = 0; } this.byEnemy.clear(); }

  // How strongly Alex is "looking at" an enemy (0–1).
  focusScore(e) {
    const T = G.targeting;
    if (T.focusEnemy() === e) return 1;
    if (T.soft && T.soft.enemy === e) return 0.9;
    let best = null;
    for (const c of T.cands) if (c.enemy === e && (!best || c.ang < best.ang)) best = c;
    if (!best) return 0;
    let s = clamp(1 - (best.ang - 6) / 26, 0, 1);
    if (best.dist > 24) s *= 0.5;
    if (!best.vis) s *= 0.35;
    return s;
  }

  update(dt) {
    const room = G.room;
    const on = G.settings.enemyBars !== false && room && G.mode !== 'title';
    const now = G.time;
    // pick candidates: damaged demons that are either just hit or in focus
    const want = [];
    if (on) {
      for (const e of room.enemies) {
        if (!e.alive || e.boss || e.disguised || !(e.hp < e.maxHp) || e.noPlate) continue;
        const recent = now - e.lastHurt < 1.3;
        const score = this.focusScore(e);
        if (recent || score > 0.42) e.plateHold = now + 0.55;
        if (now < (e.plateHold || 0)) want.push(e);
      }
    }
    const cam = G.camera;
    if (want.length > MAX_PLATES) {
      want.sort((a, b) => cam.position.distanceToSquared(a.pos) - cam.position.distanceToSquared(b.pos));
      want.length = MAX_PLATES;
    }
    const wanted = new Set(want);
    // release plates whose enemy is no longer wanted (they fade out first)
    for (const p of this.pool) {
      if (p.enemy && (!wanted.has(p.enemy) || !p.enemy.alive)) {
        p.k = Math.max(0, p.k - dt * 5);
        if (p.k <= 0) { this.byEnemy.delete(p.enemy); p.enemy = null; p.d.style.opacity = 0; p.d.classList.remove('on'); continue; }
        this._place(p, dt);
      }
    }
    for (const e of want) {
      let p = this.byEnemy.get(e);
      if (!p) {
        p = this.pool.find((x) => !x.enemy) || (this.pool.push(this._make()), this.pool[this.pool.length - 1]);
        p.enemy = e; p.k = 0; p.ghostK = e.hp / e.maxHp; p.lastFlash = 0;
        this.byEnemy.set(e, p);
        const a = e.affixInfo;
        p.affix.textContent = a ? a.title + ' ' : '';
        p.affix.style.color = a ? a.color : '';
        p.name.textContent = e.name || e.type;
        p.tag.textContent = e.franchise ? e.franchiseTag || '' : '';
        p.tag.style.display = e.franchise ? '' : 'none';
        p.d.dataset.franchise = e.franchise || '';
        p.d.classList.toggle('elite', !!e.elite);
        p.d.classList.toggle('shiny', e.affix === 'shiny');
        p.d.classList.remove('on'); void p.d.offsetWidth; p.d.classList.add('on');
      }
      p.k = Math.min(1, p.k + dt * 7);
      this._place(p, dt);
    }
  }

  _place(p, dt) {
    const e = p.enemy, cam = G.camera;
    const f = clamp(e.hp / e.maxHp, 0, 1);
    p.ghostK = Math.max(f, p.ghostK - dt * 0.6);
    p.fill.style.transform = `scaleX(${f})`;
    p.ghost.style.transform = `scaleX(${p.ghostK})`;
    p.fill.classList.toggle('low', f < 0.3);
    const sh = e.shieldMax ? clamp((e.shield || 0) / e.shieldMax, 0, 1) : 0;
    p.shield.style.transform = `scaleX(${sh})`;
    p.poise.style.transform = `scaleX(${clamp(e.poise / (e.poiseMax || 1), 0, 1)})`;
    if (e.hurtFlash && e.hurtFlash !== p.lastFlash) { p.lastFlash = e.hurtFlash; p.d.classList.remove('hit'); void p.d.offsetWidth; p.d.classList.add('hit'); }
    v.set(e.pos.x, e.pos.y + e.height + 0.42, e.pos.z).project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { p.d.style.opacity = 0; return; }
    const dist = cam.position.distanceTo(e.pos);
    const s = clamp(11 / Math.max(1, dist), 0.62, 1.12);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    p.d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${(s * (0.85 + 0.15 * p.k)).toFixed(3)})`;
    p.d.style.opacity = p.k.toFixed(3);
  }
}
