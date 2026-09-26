// Memory fragments: small scenes from Nate's life. Each has three priorities
// (Create / Bond / Duty) made of ordered steps; the player picks two and lives them.
import * as THREE from 'three';
import * as P from './props.js';
import { tex, faceTex, toTex } from './tex.js';
import { audio } from './audio.js';
import { S } from './state.js';
import { CHAPTERS, KEEPSAKES } from './story.js';
import { Motes, lightShaft } from './fx3d.js';
import { renderComposition, newPaintCanvas } from './painting.js';
import { MEM_A } from './mem_a.js';
import { MEM_B } from './mem_b.js';

const MEMS = [...MEM_A, ...MEM_B];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LABEL = { create: 'Create', bond: 'Bond', duty: 'Duty' };

export class MemCtx {
  constructor(game, k) {
    this.game = game; this.k = k; this.ch = CHAPTERS[k];
    this.picked = null; this.prog = {}; this.steps = { create: [], bond: [], duty: [] };
    this.comp = null; this.flags = {}; this.npcs = [];
    this.allDone = new Promise((r) => { this._resolveAll = r; });
    this.holding = null;
  }
  get world() { return this._world; }
  set world(w) { this._world = w; }
  isPicked(p) { return !!this.picked && this.picked.includes(p); }
  get neglected() { return ['create', 'bond', 'duty'].find((p) => !this.picked.includes(p)); }
  prioOf(id) { return Object.keys(this.steps).find((p) => this.steps[p].some((s) => s.id === id)); }
  step(id) { for (const p in this.steps) { const s = this.steps[p].find((x) => x.id === id); if (s) return s; } return null; }
  isDone(id) { const s = this.step(id); return (this.prog[id] || 0) >= (s?.count || 1); }
  active(id) {
    if (!this.picked) return false;
    const p = this.prioOf(id);
    if (!this.isPicked(p)) return false;
    for (const s of this.steps[p]) { if (s.id === id) return !this.isDone(id); if (!this.isDone(s.id)) return false; }
    return false;
  }
  done(id, n = 1) {
    this.prog[id] = (this.prog[id] || 0) + n;
    const s = this.step(id);
    if (this.isDone(id)) { audio.play('pickup'); if (s?.onDone) s.onDone(); }
    const p = this.prioOf(id);
    if (p && this.isPicked(p) && this.prioDone(p) && !this._kept?.[p]) {
      (this._kept ||= {})[p] = true;
      const kd = KEEPSAKES[this.k]?.[p];
      if (kd) {
        S.cur.keepsakes.push([this.k, p]);
        setTimeout(() => this.game.ui.itemCard({ icon: kd[1], kick: 'KEEPSAKE', name: kd[0], desc: kd[2] }), 700);
      }
    }
    this.refreshHud();
    if (this.picked && this.picked.every((p) => this.steps[p].every((x) => this.isDone(x.id)))) setTimeout(() => this._resolveAll(), 900);
  }
  prioDone(p) { return this.steps[p].every((x) => this.isDone(x.id)); }
  refreshHud() {
    if (!this.picked) { this.game.ui.setTasks(null); return; }
    const list = [];
    for (const p of ['create', 'bond', 'duty']) {
      if (!this.isPicked(p)) { list.push({ label: `${LABEL[p]} — neglected`, kind: p, neglect: true }); continue; }
      const cur = this.steps[p].find((s) => !this.isDone(s.id));
      if (!cur) list.push({ label: `${LABEL[p]} — done`, kind: p, done: true });
      else list.push({ label: cur.label + (cur.count > 1 ? ` (${this.prog[cur.id] || 0}/${cur.count})` : ''), kind: p });
    }
    this.game.ui.setTasks(list);
  }

  // A task interactable. def: { obj|pos, r, offsetY, step, prompt, use(ctx), neglect:{prompt,line}, after:{prompt,lines}, idle:{prompt,lines} }
  task(def) {
    const ctx = this;
    const st = () => def.step;
    const it = this.world.interact({
      obj: def.obj, pos: def.pos, r: def.r ?? 0.6, reach: def.reach ?? 2.4, offsetY: def.offsetY,
      enabled: () => {
        if (!ctx.picked) return !!def.idle;
        const p = ctx.prioOf(st());
        if (!ctx.isPicked(p)) return !!def.neglect;
        if (ctx.isDone(st())) return !!def.after;
        if (ctx.active(st())) return def.cond ? def.cond() : true;
        return !!def.idle || !!def.later;
      },
      prompt: () => {
        if (!ctx.picked) return def.idle?.prompt;
        const p = ctx.prioOf(st());
        if (!ctx.isPicked(p)) return def.neglect?.prompt;
        if (ctx.isDone(st())) return def.after?.prompt;
        if (ctx.active(st())) return typeof def.prompt === 'function' ? def.prompt() : def.prompt;
        return def.later ? def.later : def.idle?.prompt;
      },
      dim: () => {
        if (!ctx.picked) return false;
        const p = ctx.prioOf(st());
        return !ctx.isPicked(p) || (!ctx.active(st()) && !ctx.isDone(st()) && !!def.later);
      },
      use: async () => {
        const g = ctx.game;
        if (!ctx.picked) { for (const l of def.idle?.lines || []) await g.think(l); return; }
        const p = ctx.prioOf(st());
        if (!ctx.isPicked(p)) { if (def.neglect?.line) await g.think(def.neglect.line); return; }
        if (ctx.isDone(st())) { for (const l of def.after?.lines || []) await g.think(l); return; }
        if (!ctx.active(st())) { if (def.laterLine) await g.think(def.laterLine); else for (const l of def.idle?.lines || []) await g.think(l); return; }
        const r = await def.use(ctx);
        if (r !== false && !def.manual) ctx.done(st());
      },
    });
    it.step = def.step;
    return it;
  }

  inspect(def) {
    return this.world.interact({ obj: def.obj, pos: def.pos, r: def.r ?? 0.6, reach: def.reach ?? 2.4, offsetY: def.offsetY, prompt: def.prompt,
      enabled: def.enabled || (() => true),
      use: async () => { for (const l of typeof def.lines === 'function' ? def.lines(this) : def.lines) await this.game.think(l); } });
  }

  // A person standing at cell (i,j). They turn their head (and slowly their body) to Nate.
  npc(opts, i, j, { ry = 0, dx = 0, dz = 0, turn = true } = {}) {
    const p = P.person(opts);
    this.world.prop(p, i, j, { dx, dz, ry, dynamic: true, collide: 0.1 });
    p.userData.baseRy = ry;
    const ud = p.userData;
    const phase = Math.random() * 6;
    this.world.onUpdate((dt, t) => {
      if (!p.visible) return;
      ud.body.position.y = Math.sin(t * 1.6 + phase) * 0.006;
      ud.armL.rotation.x = Math.sin(t * 1.1 + phase) * 0.03; ud.armR.rotation.x = -ud.armL.rotation.x;
      if (!turn) return;
      const pl = this.game.player.pos;
      const d = Math.hypot(pl.x - p.position.x, pl.z - p.position.z);
      const want = Math.atan2(pl.x - p.position.x, pl.z - p.position.z);
      let rel = want - p.rotation.y; while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2;
      const hy = d < 5 ? Math.max(-1, Math.min(1, rel)) : 0;
      ud.head.rotation.y += (hy - ud.head.rotation.y) * Math.min(1, dt * 4);
      if (p.userData.talking) { p.rotation.y += rel * Math.min(1, dt * 3); }
    });
    this.npcs.push(p);
    return p;
  }
  setFace(p, mood) { const o = p.userData.opts; p.userData.faceMat.uniforms.map.value = faceTex(o.skin, o.hair, mood); }
  async talk(p, fn) { p.userData.talking = true; try { await fn(); } finally { p.userData.talking = false; } }
  async say(name, text, opts) { return this.game.say(name, text, opts); }
  async think(text) { return this.game.think(text); }
  async choose(opts, prompt) { return this.game.choose(opts, prompt); }
  rel(who, d) { S.cur.rel[who] = (S.cur.rel[who] || 0) + d; }

  // Easel helper: returns { easel, cover(on) }, and shows the finished painting when painted.
  easel(i, j, opts = {}) {
    const surf = newPaintCanvas();
    const g = surf.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, surf.width, surf.height);
    const t = toTex(surf, { repeat: false });
    const e = P.easel(t, { w: 1.1, h: 0.82 });
    this.world.prop(e, i, j, { ...opts, collide: 0.05 });
    const sheet = P.box(1.2, 1.0, 0.1, 0xd8d2c6, 'sheet'); sheet.position.set(0, 1.35, 0.1); sheet.rotation.x = -0.08;
    e.add(sheet); sheet.visible = !!opts.covered;
    this.world.level.bakeObject(e);
    return { easel: e, sheet, surf, tex: t, show: (comp) => { renderComposition(surf, comp); t.needsUpdate = true; } };
  }
  async paint(extra = {}) {
    const comp = await this.game.paint({ ...this.ch.paint, ...extra, chapterName: `MEMORY ${this.k + 1} · ${this.ch.title.toUpperCase()}` });
    this.comp = comp;
    return comp;
  }
}

export async function runMemory(game, k) {
  const def = MEMS[k];
  const ch = CHAPTERS[k];
  const ctx = new MemCtx(game, k);
  game.memCtx = ctx;
  ctx.steps = def.steps;
  await game.beginLoad(true);
  const built = def.build(ctx);
  ctx.world = built.world;
  game.setWorld(built.world, built.spawn);
  game.player.floorY = undefined;
  game.setFlashlight(false);
  game.alert = 0; game.proximity = 0;
  // memories are warm and dusty; light pours in through the windows
  const motes = new Motes(built.world.scene, { count: 90, color: k === 2 ? 0xd8e8d0 : 0xffe8c8, size: 0.03, radius: 7, y0: 0.3, y1: 3 });
  built.world.onUpdate((dt, t) => motes.update(dt, t, game.camera));
  for (const sh of built.world.shafts || []) {
    const s = lightShaft(sh.w, sh.h, sh.color ?? 0xfff0d8, sh.op ?? 0.14);
    s.position.set(sh.x, sh.y || 0, sh.z); s.rotation.set(sh.tx || 0, sh.ry || 0, sh.tz || 0);
    built.world.scene.add(s);
    built.world.onUpdate((dt, t) => { s.userData.mat.uniforms.uOpacity.value = s.userData.base * (0.85 + 0.15 * Math.sin(t * 0.5 + sh.x)); });
  }
  game.setMood({ fog: [0xfff4e6, 5, 26], desat: 0.05, tint: [1.07, 1.0, 0.92], vignette: 1.5, grain: 0.05, bloom: 0.55, warp: 0.12, music: 'memory', corrupt: Math.min(0.5, k * 0.08), ambient: ['crackle', 'room'], playerLight: 0, ...(built.mood || {}) });
  game.ui.setTasks(null);
  game.hint(null);
  game.mode = 'cutscene';
  await game.endLoad();
  await game.fade(0, 2.2);
  await game.ui.card(`MEMORY ${k + 1} · ${ch.when.toUpperCase()}`, ch.title, `Nate, age ${ch.age}`);
  if (built.onEnter) await built.onEnter(ctx);
  for (const l of def.intro) { const d = game.ui.subtitle(l); await game.skippable(d + 250); }
  game.ui.clearSubtitle();
  const picked = await game.ui.pickPriorities({ chapterName: `MEMORY ${k + 1}`, question: ch.question, create: ch.create, bond: ch.bond, duty: ch.duty });
  ctx.picked = picked;
  ctx.refreshHud();
  game.hint(null);
  if (built.onPicked) await built.onPicked(ctx);
  game.mode = 'play';
  game.ui.toast(`You chose ${LABEL[picked[0]]} and ${LABEL[picked[1]]}.\n${LABEL[ctx.neglected]} will be neglected.`, 3600);
  await ctx.allDone;
  game.mode = 'cutscene';
  game.ui.setTasks(null);
  game.ui.setPrompt(null);
  if (built.onNeglect) await built.onNeglect(ctx, ctx.neglected);
  const J = ch.journal;
  const notes = [J[picked[0]], J[picked[1]], J.neglect[ctx.neglected]];
  await wait(400);
  game.ui.subtitle(J.neglect[ctx.neglected], 4200);
  await wait(1200);
  await game.fade(1, 3.2, 0xfff8f0);
  game.ui.clearSubtitle();
  const comp = ctx.comp || { blank: true, seed: k * 31 + 7, alien: { x: 70 + (k * 37) % 60, y: 128, s: 0.6, behind: -1, reason: 'space' } };
  if (comp.blank) comp.insp = [];
  return { picked, neglected: ctx.neglected, comp, notes };
}
