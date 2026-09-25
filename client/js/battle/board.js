// 3D tabletop board: a plus-shaped 39x39 battlefield with each player's three Home
// Lanes on one side and the Void in the middle. The view is rotated so the local
// player's side is always at the bottom of the screen.
import { el, clear } from '../ui.js';
import { artSVG, RARITY_COLORS } from '../cardView.js';
import { getCard } from '../../../shared/cards.js';
import { SIZE, LANE_L, SIDES } from '../../../shared/constants.js';
import { onBoard, laneRect } from '../../../shared/engine.js';
import { hashString } from '../../../shared/rng.js';

const TILE = 64;
export const BW = SIZE * TILE;
export const BH = SIZE * TILE;

const LANE_PALETTES = [
  ['#4f8a4a', '#2f5e33'], ['#3f7d6d', '#285549'], ['#6a8a3c', '#445f25'], ['#5d7a4a', '#3a5530'], ['#487a5e', '#2d5540'],
  ['#7a6a3e', '#54482a'], ['#4d6f86', '#2f4b5e'], ['#6e5a86', '#4a3b5e'], ['#86704d', '#5e4b33'], ['#3e6e7a', '#284d56'],
];
const NEUTRAL = ['#5b6b52', '#3e4a38'];

// Player colours: you are always blue, a teammate green, opponents red / amber / violet.
export const ME_COLOR = ['#4fb3ff', 'rgba(79,179,255,.9)'];
export const ALLY_COLOR = ['#5fe39a', 'rgba(95,227,154,.9)'];
export const FOE_COLORS = [['#ff5a6e', 'rgba(255,90,110,.9)'], ['#ffa94a', 'rgba(255,169,74,.9)'], ['#c07dff', 'rgba(192,125,255,.9)']];
export function colorsFor(view, seat) {
  const out = {};
  let k = 0;
  view.players.forEach((P, q) => {
    if (q === seat) out[q] = ME_COLOR;
    else if (P.team === view.players[seat].team) out[q] = ALLY_COLOR;
    else out[q] = FOE_COLORS[k++ % FOE_COLORS.length];
  });
  return out;
}

const STATUS_ICONS = {
  guard: '🛡️', marked: '🎯', stasis: '🧊', nextAttack: '⚔️', healReduce: '☠️', abilitiesFree: '✨', freeAbility: '✨', anchored: '⚓',
};

export class Board {
  constructor(seat, side, handlers) {
    this.seat = seat;
    this.side = side;
    this.h = handlers;
    this.units = new Map();
    this.structs = new Map();
    this.lit = new Set();
    this.cam = { x: BW / 2, y: BH / 2, z: 0.8, tilt: 44, rot: 0 };
    this.target = { ...this.cam };
    this.stage = el('div.stage');
    this.world = el('div.world');
    this.board = el('div.board', { style: { width: BW + 'px', height: BH + 'px' } });
    this.world.appendChild(this.board);
    this.stage.appendChild(this.world);
    this.build();
    this.bindCamera();
    this.fit();
    this.cam = { ...this.target };
    this.applyCam(true);
    this._raf = requestAnimationFrame(() => this.tick());
    this._onResize = () => this.fit(true);
    addEventListener('resize', this._onResize);
  }
  destroy() { cancelAnimationFrame(this._raf); removeEventListener('resize', this._onResize); this.destroyed = true; }

  // ---- coordinates ------------------------------------------------------
  // Board (x, y) -> display (X, Y) with this player's side at the bottom.
  disp(x, y) {
    const M = SIZE - 1;
    switch (this.side) {
      case 'N': return { X: M - x, Y: M - y };
      case 'W': return { X: y, Y: M - x };
      case 'E': return { X: M - y, Y: x };
      default: return { X: x, Y: y };
    }
  }
  tilePx(x, y) { const d = this.disp(x, y); return { left: d.X * TILE, top: d.Y * TILE }; }
  tileCenter(x, y) { const p = this.tilePx(x, y); return { x: p.left + TILE / 2, y: p.top + TILE / 2 }; }
  rectPx(r) {
    const a = this.disp(r.x0, r.y0), b = this.disp(r.x0 + r.w - 1, r.y0 + r.h - 1);
    const X0 = Math.min(a.X, b.X), Y0 = Math.min(a.Y, b.Y);
    return { left: X0 * TILE, top: Y0 * TILE, width: (Math.abs(a.X - b.X) + 1) * TILE, height: (Math.abs(a.Y - b.Y) + 1) * TILE };
  }
  // Is a Lane long along the screen's vertical axis?
  laneVertical(ln) { const r = this.rectPx(ln); return r.height > r.width; }

  // ---- build static board -----------------------------------------------
  build() {
    const b = this.board;
    b.appendChild(el('div.table-top'));
    // the Void: centre square plus any side without a player (filled in by setLanes)
    const c = LANE_L;
    const mid = SIZE - 2 * LANE_L;
    this.voidLayer = el('div');
    this.voidLayer.appendChild(el('div.void-bg', { style: this.boxStyle(this.rectPx({ x0: c, y0: c, w: mid, h: mid })) }, el('div.void-label', 'THE VOID')));
    b.appendChild(this.voidLayer);
    this.laneLayer = el('div');
    b.appendChild(this.laneLayer);
    this.laneEls = [];
    // tiles (event delegation keeps this cheap)
    this.tiles = new Map();
    const frag = document.createDocumentFragment();
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        if (!onBoard(x, y)) continue;
        const p = this.tilePx(x, y);
        const t = document.createElement('div');
        t.className = 'tile';
        t.style.left = p.left + 'px';
        t.style.top = p.top + 'px';
        t.dataset.x = x;
        t.dataset.y = y;
        frag.appendChild(t);
        this.tiles.set(x + ',' + y, t);
      }
    }
    this.tileLayer = el('div.tile-layer');
    this.tileLayer.appendChild(frag);
    b.appendChild(this.tileLayer);
    const tileOf = (e) => { const t = e.target.closest && e.target.closest('.tile'); return t ? { x: +t.dataset.x, y: +t.dataset.y } : null; };
    this.tileLayer.addEventListener('click', (e) => { if (this.justPanned) return; const p = tileOf(e); if (p && this.h.onTile) this.h.onTile(p, e); });
    let lastHover = null;
    this.tileLayer.addEventListener('pointerover', (e) => {
      const p = tileOf(e);
      const k = p ? p.x + ',' + p.y : null;
      if (k === lastHover) return;
      lastHover = k;
      this.h.onTileHover && this.h.onTileHover(p);
    });
    this.tileLayer.addEventListener('pointerleave', () => { lastHover = null; this.h.onTileHover && this.h.onTileHover(null); });
    this.layer = el('div', { style: { position: 'absolute', inset: 0, transformStyle: 'preserve-3d', pointerEvents: 'none' } });
    b.appendChild(this.layer);
  }
  boxStyle(r) { return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }; }

  // Lanes are created once the view (and so the seating) is known.
  setLanes(view) {
    if (this.lanesBuilt) return;
    this.lanesBuilt = true;
    const seated = new Set(view.players.map((P) => P.side));
    for (const side of SIDES) {
      if (seated.has(side)) continue;
      const a = laneRect(side, 0), z = laneRect(side, 2);
      const x0 = Math.min(a.x0, z.x0), y0 = Math.min(a.y0, z.y0);
      const x1 = Math.max(a.x0 + a.w, z.x0 + z.w), y1 = Math.max(a.y0 + a.h, z.y0 + z.h);
      this.voidLayer.appendChild(el('div.void-bg.arm', { style: this.boxStyle(this.rectPx({ x0, y0, w: x1 - x0, h: y1 - y0 })) }));
    }
    view.lanes.forEach((ln, l) => {
      const r = this.rectPx(ln);
      const vertical = r.height > r.width;
      const lane = el('div.lane-bg' + (vertical ? '' : '.horiz'), { style: this.boxStyle(r), dataset: { lane: l } });
      const decal = el('div.lane-decal', el('div.ld-emoji', ''), el('div.ld-name', ''), el('div.ld-owner', ''));
      lane.appendChild(decal);
      this.laneLayer.appendChild(lane);
      this.laneEls.push({ lane, decal });
    });
  }

  // ---- sync with game view ------------------------------------------------
  sync(view, G) {
    this.view = view;
    this.G = G;
    this.colors = colorsFor(view, this.seat);
    this.setLanes(view);
    view.lanes.forEach((ln, l) => this.syncLane(l, ln.zone ? view.inst[ln.zone] && view.inst[ln.zone].cardId : null, ln.ctrl, ln));
    const seenS = new Set();
    for (const st of Object.values(view.structs)) {
      seenS.add(st.iid);
      let node = this.structs.get(st.iid);
      if (!node) node = this.addStruct(st.iid, st.cardId, st.owner, st.x, st.y);
      this.updateStruct(node, st, G);
    }
    for (const [iid, node] of this.structs) if (!seenS.has(iid) && !node.dataset.dying) { node.remove(); this.structs.delete(iid); }
    const seen = new Set();
    for (const u of Object.values(view.units)) {
      seen.add(u.iid);
      let node = this.units.get(u.iid);
      if (!node) node = this.addUnit(u.iid, u.cardId, u.owner, u.x, u.y);
      this.placeUnit(node, u.x, u.y);
      this.updateUnit(node, u, G);
    }
    for (const [iid, node] of this.units) if (!seen.has(iid) && !node.dataset.dying) { node.remove(); this.units.delete(iid); }
    this.layer.querySelectorAll('.obstacle').forEach((o) => o.remove());
    for (const o of view.obstacles || []) this.addObstacle(o.x, o.y);
  }
  sideColor(owner) { return (this.colors && this.colors[owner]) || ['#fff', '#fff']; }
  paint(node, owner) {
    const [c, g] = this.sideColor(owner);
    node.style.setProperty('--side', c);
    node.style.setProperty('--side-glow', g);
  }

  syncLane(l, zoneCardId, ctrl, ln = null) {
    const entry = this.laneEls[l];
    if (!entry) return;
    const { lane, decal } = entry;
    const card = zoneCardId ? getCard(zoneCardId) : null;
    const pal = card ? LANE_PALETTES[hashString(card.id) % LANE_PALETTES.length] : NEUTRAL;
    lane.style.setProperty('--lane-a', pal[0]);
    lane.style.setProperty('--lane-b', pal[1]);
    const owned = ctrl !== null && ctrl !== undefined;
    if (owned) this.paint(lane, ctrl); else { lane.style.removeProperty('--side'); lane.style.removeProperty('--side-glow'); }
    lane.classList.toggle('owned', owned);
    const view = this.view;
    const home = ln && view ? view.players[ln.home] : null;
    decal.children[0].textContent = card ? card.emoji : '🌾';
    decal.children[1].textContent = card ? card.name : 'Unclaimed';
    const who = !owned ? 'OPEN LANE' : ctrl === this.seat ? 'YOUR LANE' : `${(view && view.players[ctrl].name) || 'ENEMY'}'S LANE`;
    decal.children[2].textContent = who + (ln && ln.grace ? ' · REBUILDING' : '');
    decal.children[2].style.color = !owned ? '#ddd' : this.sideColor(ctrl)[0];
    lane.dataset.tip = (card ? `<b>${card.name}</b> (${card.cls} Zone)<br>${card.text}` : '<b>Unclaimed Lane</b><br>Play a Zone here to claim it.')
      + (home ? `<br><span class="muted">${home.name}'s Home Lane ${ln.i + 1}</span>` : '');
  }

  addStruct(iid, cardId, owner, x, y) {
    const card = getCard(cardId);
    const c = this.tileCenter(x, y);
    const node = el('div.structure' + (owner === this.seat ? '.mine' : '.theirs'), { style: { left: c.x + 'px', top: c.y + 'px' }, dataset: { iid } },
      el('div.foot'), el('div.ring'),
      el('div.bb', el('div.bld', card.emoji), el('div.sname', card.name), el('div.hpbar', el('i.ghost'), el('i'), el('span.hpt')), el('div.housing')));
    this.paint(node, owner);
    node.addEventListener('click', (e) => { if (this.justPanned) return; e.stopPropagation(); this.h.onStruct && this.h.onStruct(iid, e); });
    node.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.h.onInspect && this.h.onInspect(iid); });
    node.addEventListener('pointerenter', () => this.h.onHoverEntity && this.h.onHoverEntity(iid));
    node.addEventListener('pointerleave', () => this.h.onHoverEntity && this.h.onHoverEntity(null));
    this.layer.appendChild(node);
    node.style.pointerEvents = 'auto';
    this.structs.set(iid, node);
    return node;
  }
  updateStruct(node, st, G) {
    const card = getCard(st.cardId);
    const max = G ? G.structMaxBp(st) : card.bp;
    setHp(node.querySelector('.hpbar'), st.bp, max);
    const hs = node.querySelector('.housing');
    clear(hs);
    const cap = G ? G.structHousing(st) : card.housing;
    const used = G ? G.housedCount(st) : 0;
    for (let i = 0; i < cap; i++) hs.appendChild(el('i' + (i < used ? '.on' : '')));
    node.dataset.tip = `<b>${card.name}</b> — Structure<br>BP ${st.bp}/${max} · Housing ${used}/${cap}<br>${card.text}`;
  }

  addUnit(iid, cardId, owner, x, y) {
    const card = getCard(cardId);
    const node = el('div.unit' + (owner === this.seat ? '.mine' : '.theirs'), { dataset: { iid }, style: { '--idle': (hashString(iid) % 32) / 10 } },
      el('div.shadow'), el('div.ring'),
      el('div.sb', el('div.sb-in',
        el('div.ready-dot', '!'),
        el('div.lbadges'), el('div.badges'),
        el('div.portrait', { style: { '--rcol': RARITY_COLORS[card.rarity] || '#fff' }, html: artSVG(card, (hashString(iid) % 81)) }, el('div.pe', card.emoji), el('div.pside')),
        el('div.uname', card.name),
        el('div.hpbar', el('i.ghost'), el('i'), el('span.hpt')),
        el('div.mpbar'))));
    this.paint(node, owner);
    const sb = node.querySelector('.sb');
    sb.addEventListener('click', (e) => { if (this.justPanned) return; e.stopPropagation(); this.h.onUnit && this.h.onUnit(iid, e); });
    node.addEventListener('click', (e) => { if (this.justPanned) return; e.stopPropagation(); this.h.onUnit && this.h.onUnit(iid, e); });
    const ctx = (e) => { e.preventDefault(); e.stopPropagation(); this.h.onInspect && this.h.onInspect(iid); };
    sb.addEventListener('contextmenu', ctx);
    node.addEventListener('contextmenu', ctx);
    sb.addEventListener('dblclick', () => this.focusTile(this.view && this.view.units[iid] ? this.view.units[iid] : { x, y }, 1.3));
    sb.addEventListener('pointerenter', () => this.h.onHoverEntity && this.h.onHoverEntity(iid));
    sb.addEventListener('pointerleave', () => this.h.onHoverEntity && this.h.onHoverEntity(null));
    this.layer.appendChild(node);
    node.style.pointerEvents = 'auto';
    this.units.set(iid, node);
    this.placeUnit(node, x, y);
    return node;
  }
  placeUnit(node, x, y) {
    const p = this.tilePx(x, y);
    node.style.transform = `translate3d(${p.left}px, ${p.top}px, 1px)`;
    node.dataset.x = x;
    node.dataset.y = y;
  }
  updateUnit(node, u, G) {
    const card = getCard(u.cardId);
    const st = G ? G.statsOf(u) : { bp: u.bp, maxBp: card.stats.bp, mp: u.mp, maxMp: card.stats.mp };
    setHp(node.querySelector('.hpbar'), u.bp, st.maxBp);
    const mp = node.querySelector('.mpbar');
    clear(mp);
    for (let i = 0; i < Math.min(10, st.maxMp); i++) mp.appendChild(el('i' + (i < u.mp ? '.on' : '')));
    node.classList.toggle('done', u.state === 'done' && u.owner === this.seat);
    const myTurn = this.view && this.view.active === this.seat && this.view.phase === 'play' && !this.view.chain.length;
    const rd = node.querySelector('.ready-dot');
    rd.style.display = myTurn && u.owner === this.seat && (u.state !== 'done' || u.freeSteps > 0) ? '' : 'none';
    rd.textContent = u.state === 'done' && u.freeSteps > 0 ? '👣' + u.freeSteps : u.state === 'active' ? '…' : '!';
    const lb = node.querySelector('.lbadges');
    clear(lb);
    if (u.eq) { const d = getCard(this.view.inst[u.eq] && this.view.inst[u.eq].cardId); if (d) lb.appendChild(el('span', { 'data-tip': `<b>${d.name}</b><br>${d.text}` }, d.emoji)); }
    if (u.cons) { const d = getCard(this.view.inst[u.cons] && this.view.inst[u.cons].cardId); if (d) lb.appendChild(el('span', { 'data-tip': `<b>${d.name}</b> (Consumable)<br>${d.text}` }, d.emoji)); }
    const bd = node.querySelector('.badges');
    clear(bd);
    if (u.barrier > 0) bd.appendChild(el('span', { 'data-tip': `<b>Barrier ${u.barrier}</b>` }, '💠'));
    const seenK = new Set();
    for (const s of u.statuses) {
      let ic = s.kind ? STATUS_ICONS[s.kind] : s.stat ? (s.v > 0 ? '🔺' : '🔻') : null;
      if (s.stat === 'ap' && s.v < 0) ic = '🐌';
      if (!ic || seenK.has(ic)) continue;
      seenK.add(ic);
      bd.appendChild(el('span', { 'data-tip': `<b>${s.label || s.kind || s.stat}</b>` }, ic));
    }
    if (u.freeSteps > 0) bd.appendChild(el('span', { 'data-tip': `<b>${u.freeSteps} Free Step${u.freeSteps > 1 ? 's' : ''}</b>` }, '👣'));
  }
  addObstacle(x, y) {
    const p = this.tilePx(x, y);
    const o = el('div.obstacle', { style: { left: p.left + 'px', top: p.top + 'px' } }, el('div.ob', '🪵'));
    this.layer.appendChild(o);
  }

  // ---- highlights ----------------------------------------------------------
  clearHighlights() {
    for (const t of this.lit) t.className = 'tile';
    this.lit.clear();
    for (const { lane } of this.laneEls) lane.classList.remove('pick');
    for (const n of this.units.values()) n.classList.remove('target', 'pick', 'selected');
    for (const n of this.structs.values()) n.classList.remove('target', 'pick');
  }
  tileClass(pos, cls) { const t = this.tiles.get(pos.x + ',' + pos.y); if (t) { t.classList.add(cls); this.lit.add(t); } }
  tileHas(pos, cls) { const t = this.tiles.get(pos.x + ',' + pos.y); return t && t.classList.contains(cls); }
  entityClass(iid, cls) { const n = this.units.get(iid) || this.structs.get(iid); if (n) n.classList.add(cls); }
  pickLane(l) { if (this.laneEls[l]) this.laneEls[l].lane.classList.add('pick'); }
  clearPath() { for (const t of this.lit) t.classList.remove('path', 'range'); }
  // tiles within Chebyshev distance r of pos
  *around(pos, r) {
    for (let x = pos.x - r; x <= pos.x + r; x++) for (let y = pos.y - r; y <= pos.y + r; y++) if (onBoard(x, y)) yield { x, y };
  }

  // ---- positions on screen ---------------------------------------------------
  screenOf(iid) {
    const n = this.units.get(iid);
    if (n) { const r = n.querySelector('.portrait').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    const s = this.structs.get(iid);
    if (s) { const r = s.querySelector('.bld').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return null;
  }
  screenOfTile(pos) {
    const t = this.tiles.get(pos.x + ',' + pos.y);
    if (!t) return { x: innerWidth / 2, y: innerHeight / 2 };
    const r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  screenOfLane(l) {
    const e = this.laneEls[l];
    if (!e) return { x: innerWidth / 2, y: innerHeight / 2 };
    const r = e.lane.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  laneCenter(ln) { return { x: ln.x0 + (ln.w >> 1), y: ln.y0 + (ln.h >> 1) }; }

  // ---- camera ------------------------------------------------------------
  // Home view: your three Lanes and the Void in front of them.
  fit(soft = false) {
    const vw = innerWidth, vh = innerHeight;
    const narrow = vw < 700;
    const t = (this.target.tilt * Math.PI) / 180;
    const wantW = (narrow ? 18 : 24) * TILE;
    const wantH = 22 * TILE * Math.cos(t);
    const z = Math.max(0.2, Math.min(1.1, Math.min(vw / wantW, (vh - 60) / wantH)));
    this.baseZoom = z;
    // centre a little in front of your Lanes; the hand covers the bottom of the screen
    Object.assign(this.target, { z, x: BW / 2, y: BH - 11 * TILE, rot: 0 });
    if (!soft) this.cam = { ...this.target };
  }
  overview() {
    const vw = innerWidth, vh = innerHeight;
    const t = (this.target.tilt * Math.PI) / 180;
    const z = Math.max(0.12, Math.min(vw / (BW + 80), (vh - 120) / (BH * Math.cos(t) + 200)));
    Object.assign(this.target, { z, x: BW / 2, y: BH / 2 + 40 / z, rot: 0 });
  }
  resetCam() { this.target.tilt = 44; this.fit(true); }
  focusTile(pos, zoomMul = null) {
    const c = this.tileCenter(pos.x, pos.y);
    this.focusPx(c.x, c.y, zoomMul);
  }
  focusPx(x, y, zoomMul = null) {
    this.target.x = Math.max(0, Math.min(BW, x));
    this.target.y = Math.max(0, Math.min(BH, y));
    if (zoomMul) this.target.z = Math.min(1.8, this.baseZoom * zoomMul);
  }
  focusEntity(iid, zoomMul = null) {
    const u = this.view && (this.view.units[iid] || this.view.structs[iid]);
    if (u) { this.focusTile(u, zoomMul); return; }
    const n = this.units.get(iid);
    if (n) this.focusTile({ x: +n.dataset.x, y: +n.dataset.y }, zoomMul);
  }
  // Pan toward a point if it's off in the distance; zoom out a little if needed.
  gentleFollow(pos) {
    const c = this.tileCenter(pos.x, pos.y);
    const dx = c.x - this.target.x, dy = c.y - this.target.y;
    const far = Math.hypot(dx, dy);
    if (far > 6 * TILE) { this.target.x += dx * 0.7; this.target.y += dy * 0.7; }
  }
  tick() {
    if (this.destroyed) return;
    const k = 0.14;
    let moving = false;
    for (const key of ['x', 'y', 'z', 'tilt', 'rot']) {
      const d = this.target[key] - this.cam[key];
      if (Math.abs(d) > 0.001) { this.cam[key] += d * k; moving = true; }
    }
    if (moving) this.applyCam();
    this._raf = requestAnimationFrame(() => this.tick());
  }
  applyCam() {
    const c = this.cam;
    this.world.style.transform = `scale(${c.z}) rotateX(${c.tilt}deg) rotateZ(${c.rot}deg) translate(${-c.x}px, ${-c.y}px)`;
    this.world.style.setProperty('--tilt', c.tilt + 'deg');
    this.world.style.setProperty('--rot', c.rot + 'deg');
  }
  zoomBy(f) { this.target.z = Math.max(0.12, Math.min(1.9, this.target.z * f)); }
  rotateBy(d) { this.target.rot += d; }
  tiltBy(d) { this.target.tilt = Math.max(15, Math.min(68, this.target.tilt + d)); }
  panScreen(dx, dy) {
    const c = this.target;
    const r = (-c.rot * Math.PI) / 180;
    const cos = Math.cos((c.tilt * Math.PI) / 180);
    const sx = dx / c.z, sy = dy / c.z / Math.max(0.35, cos);
    const bx = sx * Math.cos(r) - sy * Math.sin(r);
    const by = sx * Math.sin(r) + sy * Math.cos(r);
    c.x = Math.max(-100, Math.min(BW + 100, c.x - bx));
    c.y = Math.max(-100, Math.min(BH + 100, c.y - by));
  }
  bindCamera() {
    const st = this.stage;
    st.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
    let drag = null;
    const pointers = new Map();
    let pinch = null;
    st.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.target.z };
        drag = null;
        return;
      }
      const onUnit = e.target.closest('.sb, .structure');
      if (e.button === 1 || e.button === 2 || (e.button === 0 && !onUnit)) {
        drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, moved: false, rotate: e.button === 1 || (e.button === 2 && e.shiftKey) };
      }
    });
    addEventListener('pointermove', this._pm = (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.target.z = Math.max(0.12, Math.min(1.9, pinch.z * (d / pinch.d)));
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 7) { drag.moved = true; st.classList.add('panning'); }
      if (drag.moved) {
        if (drag.rotate) { this.target.rot += dx * 0.3; this.tiltBy(-dy * 0.15); }
        else this.panScreen(dx, dy);
      }
      drag.x = e.clientX; drag.y = e.clientY;
    });
    addEventListener('pointerup', this._pu = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && drag.moved) {
        this.justPanned = true;
        setTimeout(() => { this.justPanned = false; }, 60);
      } else if (drag && drag.btn === 2) {
        this.h.onRightClick && this.h.onRightClick(e);
      }
      drag = null;
      st.classList.remove('panning');
    });
    st.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  unbind() { removeEventListener('pointermove', this._pm); removeEventListener('pointerup', this._pu); }

  // ---- animations ---------------------------------------------------------
  async animateMove(iid, path, msPerStep = 120) {
    const node = this.units.get(iid);
    if (!node || !path || path.length < 2) return;
    const frames = path.map((p) => { const q = this.tilePx(p.x, p.y); return { transform: `translate3d(${q.left}px, ${q.top}px, 1px)` }; });
    const anim = node.animate(frames, { duration: msPerStep * (path.length - 1), easing: 'linear' });
    const last = path[path.length - 1];
    this.placeUnit(node, last.x, last.y);
    await anim.finished.catch(() => {});
  }
  async animateTeleport(iid, to, ms = 380) {
    const node = this.units.get(iid);
    if (!node) return;
    const sb = node.querySelector('.sb-in');
    await sb.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.3) translateY(-30px)' }], { duration: ms / 2, easing: 'ease-in' }).finished.catch(() => {});
    this.placeUnit(node, to.x, to.y);
    await sb.animate([{ opacity: 0, transform: 'scale(.3) translateY(-30px)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ms / 2, easing: 'ease-out' }).finished.catch(() => {});
  }
  async lunge(iid, towardIid, ms = 260) {
    const node = this.units.get(iid);
    const tgt = this.units.get(towardIid) || this.structs.get(towardIid);
    if (!node || !tgt) return;
    const a = node.querySelector('.portrait').getBoundingClientRect();
    const bEl = tgt.querySelector('.portrait') || tgt.querySelector('.bld');
    const b = bEl.getBoundingClientRect();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(34, len * 0.45) / len;
    const sb = node.querySelector('.sb-in');
    await sb.animate([{ translate: '0 0' }, { translate: `${-dx * k * 0.25}px ${-dy * k * 0.25}px`, offset: 0.35 }, { translate: `${dx * k}px ${dy * k}px`, offset: 0.7 }, { translate: '0 0' }], { duration: ms, easing: 'ease-in-out' }).finished.catch(() => {});
  }
  flash(iid, cls = 'hit') {
    const n = this.units.get(iid) || this.structs.get(iid);
    if (!n) return;
    n.classList.remove(cls);
    void n.offsetWidth;
    n.classList.add(cls);
    setTimeout(() => n.classList.remove(cls), 450);
  }
  setHpFromEvent(iid, bp) {
    const n = this.units.get(iid) || this.structs.get(iid);
    if (!n) return;
    const bar = n.querySelector('.hpbar');
    const max = +bar.dataset.max || bp;
    setHp(bar, bp, max);
  }
  setMpFromEvent(iid, mp) {
    const n = this.units.get(iid);
    if (!n) return;
    [...n.querySelectorAll('.mpbar i')].forEach((i, k) => i.classList.toggle('on', k < mp));
  }
  async killUnit(iid, ms = 600) {
    const n = this.units.get(iid);
    if (!n) return;
    n.dataset.dying = '1';
    n.classList.add('dying');
    await new Promise((r) => setTimeout(r, ms));
    n.remove();
    this.units.delete(iid);
  }
  async crumble(iid, ms = 900) {
    const n = this.structs.get(iid);
    if (!n) return;
    n.dataset.dying = '1';
    n.classList.add('crumbling');
    await new Promise((r) => setTimeout(r, ms));
    n.remove();
    this.structs.delete(iid);
  }
}

export function setHp(bar, bp, max) {
  if (!bar) return;
  bar.dataset.max = max;
  const pct = Math.max(0, Math.min(100, (bp / Math.max(1, max)) * 100));
  const [ghost, fill] = bar.querySelectorAll('i');
  fill.style.width = pct + '%';
  ghost.style.width = pct + '%';
  bar.classList.toggle('low', pct <= 50 && pct > 25);
  bar.classList.toggle('crit', pct <= 25);
  const t = bar.querySelector('.hpt');
  if (t) t.textContent = `${Math.max(0, bp)}/${max}`;
}
