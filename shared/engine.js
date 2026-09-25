// Knotwood rules engine — implements "Phase 1 – Core Game Rules" with the
// "Phase 2 – Card Framework" card systems.
// The whole match lives in a plain JSON-serialisable state object so it can be
// cloned for AI search, sent over the network, and replayed deterministically.

import * as C from './constants.js';
import { nextRandom } from './rng.js';
import { getCard, sharedAbilityFor } from './cards.js';

const UNDO_SAFE = new Set(['move', 'activate', 'deactivate', 'status', 'freeStep', 'log', 'mp', 'heal', 'step']);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const key = (x, y) => x + ',' + y;
const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
export const FORWARD = { S: { dx: 0, dy: -1 }, N: { dx: 0, dy: 1 }, W: { dx: 1, dy: 0 }, E: { dx: -1, dy: 0 } };
export const STEP_INDEX = Object.fromEntries(C.STEPS.map((s, i) => [s, i]));

// Home Lane rectangles for a seat side. Lane index i runs left→right from that player's view.
export function laneRect(side, i) {
  const a = C.LANE_L; // 12
  const W = C.LANE_W;
  switch (side) {
    case 'S': return { x0: a + W * i, y0: a + C.VOID, w: W, h: C.LANE_L };
    case 'N': return { x0: a + C.ARM - W * (i + 1), y0: 0, w: W, h: C.LANE_L };
    case 'W': return { x0: 0, y0: a + W * i, w: C.LANE_L, h: W };
    case 'E': return { x0: a + C.VOID, y0: a + C.ARM - W * (i + 1), w: C.LANE_L, h: W };
    default: throw new Error('bad side ' + side);
  }
}
export function onBoard(x, y, size = C.SIZE) {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  const lo = C.LANE_L, hi = size - C.LANE_L;
  return (x >= lo && x < hi) || (y >= lo && y < hi);
}
export function inRect(r, x, y) { return x >= r.x0 && y >= r.y0 && x < r.x0 + r.w && y < r.y0 + r.h; }

// ---------------------------------------------------------------------------
// Match creation
// ---------------------------------------------------------------------------
// players: [{name, deck:[cardId], avatar, bot}] in seat order; format: key of C.FORMATS
export function createMatch({ seed, players, format = null, first = 0 }) {
  const fmtKey = format || (players.length === 2 ? '1v1' : players.length === 3 ? 'ffa3' : 'ffa4');
  const fmt = C.FORMATS[fmtKey];
  if (!fmt || fmt.players !== players.length) throw new Error(`Format ${fmtKey} needs ${fmt ? fmt.players : '?'} players`);
  const s = {
    v: 2,
    seed,
    rng: seed | 0,
    format: fmtKey,
    size: C.SIZE,
    turnSerial: 0,
    round: 0,
    active: first,
    first,
    phase: 'setup',
    step: 'zone',
    players: [],
    inst: {},
    nextId: 1,
    lanes: [],
    units: {},
    structs: {},
    obstacles: [],
    mods: [],
    chain: [],
    priority: null,
    passes: 0,
    activeUnit: null,
    winner: null,
    winners: [],
    winReason: null,
    log: [],
    undo: null,
    stats: players.map(() => newStats()),
    setupDone: players.map(() => false),
  };
  const g = new Game(s);
  players.forEach((pl, p) => {
    const P = {
      name: pl.name || 'Player ' + (p + 1),
      side: fmt.sides[p],
      team: fmt.teams[p],
      deck: [], hand: [], discard: [],
      turns: 0, eliminated: false, established: false,
      autoRetaliate: true, bot: !!pl.bot,
      avatar: pl.avatar || null,
    };
    s.players.push(P);
    for (let i = 0; i < C.HOME_LANES; i++) {
      const r = laneRect(P.side, i);
      s.lanes.push({ id: s.lanes.length, home: p, side: P.side, i, ...r, zone: null, ctrl: null, structure: null, grace: null });
    }
    for (const cardId of pl.deck) P.deck.push(g.newInst(cardId, p));
    g.shuffle(P.deck);
  });
  for (let p = 0; p < players.length; p++) g.openingHand(p);
  g.log(`The battle begins! (${fmt.name}) ${s.players[first].name} goes first.`);
  g.log('Setup: place Zones into your Home Lanes.');
  return s;
}

function newStats() {
  return { damage: 0, kills: 0, structures: 0, captures: 0, summoned: 0, cards: 0, eliminations: 0 };
}

// ---------------------------------------------------------------------------
// Game wrapper
// ---------------------------------------------------------------------------
export class Game {
  constructor(state) {
    this.s = state;
    this.events = [];
    this._src = null;
    this._occ = null;
    this._laneGrid = null;
  }

  // ---- basic accessors ---------------------------------------------------
  rand() { return nextRandom(this.s); }
  randInt(n) { return Math.floor(this.rand() * n); }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  newInst(cardId, owner) {
    const iid = 'c' + this.s.nextId++;
    this.s.inst[iid] = { cardId, owner };
    return iid;
  }
  def(cardIdOrInst) {
    if (!cardIdOrInst) return null;
    const inst = this.s.inst[cardIdOrInst];
    return getCard(inst ? inst.cardId : cardIdOrInst);
  }
  P(p) { return this.s.players[p]; }
  get n() { return this.s.players.length; }
  unit(iid) { return this.s.units[iid] || null; }
  struct(iid) { return this.s.structs[iid] || null; }
  entity(iid) { return this.s.units[iid] || this.s.structs[iid] || null; }
  allUnits() { return Object.values(this.s.units); }
  unitsOf(p) { return this.allUnits().filter((u) => u.owner === p); }
  structsOf(p) { return Object.values(this.s.structs).filter((st) => st.owner === p); }
  alivePlayers() { return this.s.players.map((_, i) => i).filter((i) => !this.s.players[i].eliminated); }

  // teams
  team(p) { return this.s.players[p].team; }
  foe(a, b) { return a !== b && this.team(a) !== this.team(b); }
  ally(a, b) { return this.team(a) === this.team(b); }
  enemiesOf(p) { return this.alivePlayers().filter((q) => this.foe(p, q)); }

  // ---- geometry ------------------------------------------------------------
  // The board is a plus shape: the four 12x12 corners are off the map.
  inBounds(x, y) { return onBoard(x, y, this.s.size); }
  laneGrid() {
    if (this._laneGrid) return this._laneGrid;
    const N = this.s.size;
    const g = new Int16Array(N * N).fill(-1);
    for (const ln of this.s.lanes) for (let x = ln.x0; x < ln.x0 + ln.w; x++) for (let y = ln.y0; y < ln.y0 + ln.h; y++) g[y * N + x] = ln.id;
    this._laneGrid = g;
    return g;
  }
  laneAt(x, y) { return this.inBounds(x, y) ? this.laneGrid()[y * this.s.size + x] : -1; }
  laneOf(pos) { return pos ? this.laneAt(pos.x, pos.y) : -1; }
  isVoid(x, y) { return this.laneAt(x, y) === -1; }
  lane(l) { return this.s.lanes[l] || null; }
  laneName(l) {
    const ln = this.lane(l);
    if (!ln) return 'the Void';
    return `${this.P(ln.home).name}'s Lane ${ln.i + 1}`;
  }
  occ() {
    if (this._occ) return this._occ;
    const m = new Map();
    for (const u of Object.values(this.s.units)) m.set(key(u.x, u.y), u);
    for (const st of Object.values(this.s.structs)) m.set(key(st.x, st.y), st);
    for (const o of this.s.obstacles) m.set(key(o.x, o.y), o);
    this._occ = m;
    return m;
  }
  unitAt(x, y) { const e = this.occ().get(key(x, y)); return e && e.state !== undefined ? e : null; }
  structAt(x, y) { const e = this.occ().get(key(x, y)); return e && e.lane !== undefined && e.state === undefined ? e : null; }
  obstacleAt(x, y) { return this.s.obstacles.some((o) => o.x === x && o.y === y); }
  isEmpty(x, y) { return this.inBounds(x, y) && !this.occ().has(key(x, y)); }
  laneCtrl(l) { return this.s.lanes[l] ? this.s.lanes[l].ctrl : null; }
  structInLane(l) { const ln = this.s.lanes[l]; const id = ln && ln.structure; return id ? this.s.structs[id] : null; }
  unitsInLane(l, p) { return this.allUnits().filter((u) => this.laneOf(u) === l && (p === undefined || u.owner === p)); }
  foesInLane(l, p) { return this.allUnits().filter((u) => this.laneOf(u) === l && this.foe(u.owner, p)); }
  isDefending(u) { const c = this.laneCtrl(this.laneOf(u)); return c !== null && c !== undefined && this.ally(c, u.owner); }
  isInvading(u) { const c = this.laneCtrl(this.laneOf(u)); return c !== null && c !== undefined && this.foe(c, u.owner); }
  isContested(l) {
    const us = this.unitsInLane(l);
    return us.some((a) => us.some((b) => this.foe(a.owner, b.owner)));
  }
  dist(a, b) { return cheb(a, b); }
  friendlyAdjacent(u) { return this.allUnits().filter((o) => o.iid !== u.iid && o.owner === u.owner && cheb(o, u) === 1); }
  enemiesAdjacent(u) { return this.allUnits().filter((o) => this.foe(o.owner, u.owner) && cheb(o, u) === 1); }
  nearFriendlyStruct(u, n = 2) { return this.structsOf(u.owner).some((st) => cheb(u, st) <= n); }
  faction(u) { return this.def(u.cardId).faction; }
  sameFaction(a, b) { return this.faction(a) === this.faction(b); }
  laneMonopoly(u) {
    const l = this.laneOf(u);
    if (l < 0) return false;
    return this.unitsInLane(l, u.owner).every((f) => this.sameFaction(f, u));
  }
  forward(p) { return FORWARD[this.P(p).side]; }

  // once-per-turn flag stored on any object
  once(obj, k) {
    obj.flags = obj.flags || {};
    if (obj.flags[k] === this.s.turnSerial) return false;
    obj.flags[k] = this.s.turnSerial;
    return true;
  }
  usedThisTurn(obj, k) { return !!(obj.flags && obj.flags[k] === this.s.turnSerial); }
  oncePerActivation(u, k) {
    u.flags = u.flags || {};
    const tag = 'A' + (u.actSerial || 0);
    if (u.flags[k] === tag) return false;
    u.flags[k] = tag;
    return true;
  }

  // Deferred effects that must happen after a defeat has fully resolved
  later(fn) { (this._post || (this._post = [])).push(fn); }
  flushLater() {
    while (this._post && this._post.length) {
      const fns = this._post;
      this._post = null;
      for (const f of fns) f();
    }
  }
  autoAttachCons(u) {
    if (!u || u.cons) return false;
    const P = this.P(u.owner);
    const iid = P.hand.find((i) => this.def(i).type === 'Consumable');
    if (!iid) return false;
    P.hand.splice(P.hand.indexOf(iid), 1);
    this.attachCons(u.owner, iid, u.iid);
    return true;
  }
  discardLowest(p) {
    const P = this.P(p);
    if (!P.hand.length) return;
    const sorted = [...P.hand].sort((a, b) => this.def(a).cost - this.def(b).cost);
    this.discardFromHand(p, sorted[0]);
  }

  // ---- events / logging ----------------------------------------------------
  emit(evt) { this.events.push(evt); }
  log(text) {
    this.s.log.push(text);
    if (this.s.log.length > 100) this.s.log.shift();
    this.emit({ t: 'log', text });
  }
  dirty() { this._src = null; this._occ = null; }

  // ---- sources of passive abilities -------------------------------------
  sources() {
    if (this._src) return this._src;
    const list = [];
    for (const u of Object.values(this.s.units)) {
      const d = this.def(u.cardId);
      const sh = d.type === 'Identity' && !d.token ? sharedAbilityFor(d.cls, d.archetype) : null;
      if (sh && sh.hooks) list.push({ h: sh.hooks, src: { kind: 'unit', unit: u.iid, owner: u.owner, name: sh.name } });
      if (d.unique && d.unique.hooks) list.push({ h: d.unique.hooks, src: { kind: 'unit', unit: u.iid, owner: u.owner, name: d.unique.name } });
      if (u.eq) { const e = this.def(u.eq); if (e.hooks) list.push({ h: e.hooks, src: { kind: 'equip', unit: u.iid, owner: u.owner, name: e.name, card: u.eq } }); }
      if (u.cons) { const e = this.def(u.cons); if (e.hooks) list.push({ h: e.hooks, src: { kind: 'cons', unit: u.iid, owner: u.owner, name: e.name, card: u.cons } }); }
    }
    for (const st of Object.values(this.s.structs)) {
      const d = this.def(st.cardId);
      if (d.hooks) list.push({ h: d.hooks, src: { kind: 'struct', struct: st.iid, owner: st.owner, lane: st.lane, name: d.name } });
    }
    for (const ln of this.s.lanes) {
      if (ln.zone) {
        const d = this.def(ln.zone);
        if (d.hooks) list.push({ h: d.hooks, src: { kind: 'zone', lane: ln.id, owner: ln.ctrl, name: d.name } });
      }
    }
    for (const m of this.s.mods) {
      const d = getCard(m.cardId);
      const h = d && d.modHooks;
      if (h) list.push({ h, src: { kind: 'mod', mod: m.id, owner: m.owner, name: d.name, data: m.data } });
    }
    this._src = list;
    return list;
  }
  // Sum numeric hook results; supports {v, key} for non-stacking effects.
  hookSum(name, ...args) {
    let total = 0;
    const keyed = {};
    for (const { h, src } of this.sources()) {
      const fn = h[name];
      if (!fn) continue;
      const r = fn(this, src, ...args);
      if (!r) continue;
      if (typeof r === 'number') total += r;
      else if (r.key) {
        if (keyed[r.key] === undefined) keyed[r.key] = r.v;
        else keyed[r.key] = r.v < 0 ? Math.min(keyed[r.key], r.v) : Math.max(keyed[r.key], r.v);
      } else total += r.v || 0;
    }
    for (const k in keyed) total += keyed[k];
    return total;
  }
  hookAny(name, ...args) {
    for (const { h, src } of this.sources()) {
      if (h[name] && h[name](this, src, ...args)) return { src };
    }
    return null;
  }
  trigger(evtName, data) {
    const list = this.sources().slice();
    for (const { h, src } of list) {
      if (!h.on) continue;
      if (src.unit && !this.s.units[src.unit]) continue;
      if (src.struct && !this.s.structs[src.struct]) continue;
      h.on(this, src, evtName, data);
      if (this.s.winner !== null) return;
    }
  }

  // ---- stats ---------------------------------------------------------------
  stat(u, k, ctx = {}) {
    const d = this.def(u.cardId);
    let v = (d.stats ? d.stats[k] : 0) + ((u.boost && u.boost[k]) || 0);
    for (const st of u.statuses) if (st.stat === k) v += st.v;
    v += this.hookSum('stat', u, k, ctx);
    if (k === 'rp' || k === 'bp') return Math.max(1, v);
    return Math.max(0, v);
  }
  maxBp(u) { return this.stat(u, 'bp'); }
  maxMp(u) { return this.stat(u, 'mp'); }
  statsOf(u) {
    return { bp: u.bp, maxBp: this.maxBp(u), sp: this.stat(u, 'sp'), mp: u.mp, maxMp: this.maxMp(u), ap: this.apAvail(u), rp: this.stat(u, 'rp') };
  }
  // Normal movement: one move per turn, before attacking or using abilities.
  canMoveNormally(u) {
    if (!u || u.state === 'done' || this.hasStatus(u, 'stasis')) return false;
    if (u.act && (u.act.acted || u.act.movedOnce)) return false;
    return true;
  }
  apAvail(u) {
    if (!this.canMoveNormally(u)) return 0;
    const base = u.state === 'active' ? u.apBase : this.stat(u, 'ap', { activation: true }) + (u.apNext || 0);
    return Math.max(0, base + u.apBonus - u.apSpent);
  }
  moveBudget(u) { return this.apAvail(u) + (this.hasStatus(u, 'stasis') ? 0 : u.freeSteps); }
  hasStatus(u, kind) { return u.statuses.some((s) => s.kind === kind); }
  structHousing(st) { return Math.max(0, this.def(st.cardId).housing + this.hookSum('housing', st)); }
  housedCount(st) { return this.allUnits().filter((u) => u.via === st.iid).length; }
  structMaxBp(st) { return this.def(st.cardId).bp + (st.bonusBp || 0) + this.hookSum('structBp', st); }
  attackCost(u) { return Math.max(0, C.ATTACK_COST + this.hookSum('attackCost', u)); }
  retaliationCost(u) { return Math.max(0, this.attackCost(u) + this.hookSum('retaliationCost', u)); }

  // ---- statuses --------------------------------------------------------------
  addStatus(u, status) {
    const st = { cs: this.s.turnSerial, ...status };
    u.statuses.push(st);
    this.emit({ t: 'status', target: u.iid, text: status.label || statusLabel(status), good: status.good !== undefined ? status.good : (status.v || 0) > 0 });
    return st;
  }
  cleanse(u) {
    const before = u.statuses.length;
    u.statuses = u.statuses.filter((s) => !(s.v < 0 || s.kind === 'stasis' || s.kind === 'healReduce'));
    if (u.statuses.length !== before) this.emit({ t: 'status', target: u.iid, text: 'Cleansed', good: true });
  }
  addMod(cardId, owner, exp, data) {
    const m = { id: 'm' + this.s.nextId++, cardId, owner, exp: { cs: this.s.turnSerial, ...exp }, data: data || {} };
    this.s.mods.push(m);
    this.dirty();
    return m;
  }
  // at: 'eot' (end of this turn), 'sot' (start of player p's next turn),
  // 'act' (end of the unit's next activation, or the end of its controller's next turn),
  // 'thisAct' (end of the current activation), 'endNext' (end of player p's next turn).
  expireStatuses(when, info) {
    const serial = this.s.turnSerial;
    const test = (e, owner) => {
      if (!e) return false;
      if (when === 'eot') {
        return e.at === 'eot' || e.at === 'thisAct'
          || (e.at === 'act' && info.p === owner && serial > e.cs)
          || (e.at === 'endNext' && info.p === (e.p ?? owner) && serial > e.cs);
      }
      if (when === 'sot') return e.at === 'sot' && e.p === info.p && serial > e.cs;
      return false;
    };
    for (const u of Object.values(this.s.units)) u.statuses = u.statuses.filter((st) => !test(st, u.owner));
    const before = this.s.mods.length;
    this.s.mods = this.s.mods.filter((m) => !test(m.exp, m.owner));
    if (before !== this.s.mods.length) this.dirty();
  }

  // ---- cards -----------------------------------------------------------------
  // Draw n cards (an empty deck reshuffles the discard pile). Cards beyond the
  // hand maximum are discarded.
  draw(p, n = 1, { toLimit = false } = {}) {
    const P = this.P(p);
    for (let i = 0; i < n; i++) {
      if (toLimit && P.hand.length >= C.HAND_SIZE) break;
      if (!P.deck.length) {
        if (!P.discard.length) break;
        P.deck = P.discard.splice(0);
        this.shuffle(P.deck);
        this.emit({ t: 'reshuffle', p, count: P.deck.length });
        this.log(`${P.name} shuffles their discard pile into a new deck.`);
      }
      const iid = P.deck.pop();
      if (P.hand.length >= C.HAND_SIZE) {
        P.discard.push(iid);
        this.emit({ t: 'burn', p, iid, cardId: this.s.inst[iid].cardId });
        continue;
      }
      P.hand.push(iid);
      this.emit({ t: 'draw', p, iid, cardId: this.s.inst[iid].cardId });
    }
  }
  drawToHandSize(p) { this.draw(p, C.HAND_SIZE, { toLimit: true }); }
  discardFromHand(p, iid) {
    const P = this.P(p);
    const i = P.hand.indexOf(iid);
    if (i >= 0) P.hand.splice(i, 1);
    P.discard.push(iid);
    this.emit({ t: 'discard', p, iid, cardId: this.s.inst[iid].cardId });
  }
  toDiscard(iid) {
    const inst = this.s.inst[iid];
    if (!inst) return;
    const d = getCard(inst.cardId);
    if (d.token) return;
    this.P(inst.owner).discard.push(iid);
  }
  returnToHand(iid) {
    const inst = this.s.inst[iid];
    const P = this.P(inst.owner);
    if (P.hand.length >= C.HAND_SIZE) P.discard.push(iid);
    else P.hand.push(iid);
  }
  openingHand(p) {
    const P = this.P(p);
    // Opening-hand guarantee: a Zone, a Structure and an Identity if the deck has them.
    for (const type of ['Zone', 'Structure', 'Identity']) {
      const idx = P.deck.findIndex((iid) => this.def(iid).type === type);
      if (idx >= 0) P.hand.push(P.deck.splice(idx, 1)[0]);
    }
    while (P.hand.length < C.HAND_SIZE && P.deck.length) P.hand.push(P.deck.pop());
    this.shuffle(P.deck);
  }

  // =========================================================================
  // Elimination & victory
  // =========================================================================
  checkEliminations() {
    const s = this.s;
    if (s.winner !== null || s.phase === 'setup') return;
    for (let p = 0; p < this.n; p++) {
      const P = this.P(p);
      if (P.eliminated) continue;
      const hasStuff = this.structsOf(p).length > 0 || this.unitsOf(p).length > 0;
      if (hasStuff) P.established = true;
      else if (P.established) this.eliminate(p, 'lost all Structures and Identities');
    }
    this.checkVictory();
  }
  eliminate(p, why) {
    const s = this.s;
    const P = this.P(p);
    if (P.eliminated) return;
    P.eliminated = true;
    // remove everything they control from the battlefield
    for (const u of this.unitsOf(p)) { delete s.units[u.iid]; this.emit({ t: 'defeat', target: u.iid, cardId: u.cardId, owner: p, x: u.x, y: u.y, quiet: true }); }
    for (const st of this.structsOf(p)) { delete s.structs[st.iid]; this.lane(st.lane).structure = null; this.emit({ t: 'destroy', target: st.iid, lane: st.lane, owner: p, cardId: st.cardId, quiet: true }); }
    for (const ln of s.lanes) if (ln.ctrl === p) { ln.ctrl = null; ln.zone = null; ln.grace = null; this.emit({ t: 'unclaim', lane: ln.id }); }
    s.chain = s.chain.filter((it) => it.p !== p);
    s.mods = s.mods.filter((m) => m.owner !== p);
    this.dirty();
    // credit the elimination to whoever acted last
    const by = s.active !== p ? s.active : null;
    if (by !== null) s.stats[by].eliminations++;
    this.emit({ t: 'eliminated', p });
    this.log(`💀 ${P.name} has been eliminated (${why})!`);
  }
  checkVictory() {
    const s = this.s;
    if (s.winner !== null) return;
    const alive = this.alivePlayers();
    const teams = [...new Set(alive.map((p) => this.team(p)))];
    if (teams.length <= 1) {
      const team = teams.length ? teams[0] : this.team(s.active);
      this.win(team, alive.length ? 'Elimination' : 'Draw');
    }
  }
  win(team, reason) {
    const s = this.s;
    if (s.winner !== null) return;
    s.winner = team;
    s.winners = s.players.map((_, i) => i).filter((i) => this.team(i) === team);
    s.winReason = reason;
    s.phase = 'over';
    s.chain = [];
    s.priority = null;
    this.emit({ t: 'win', team, players: s.winners, reason });
    this.log(`🏆 ${s.winners.map((i) => this.P(i).name).join(' & ')} win${s.winners.length > 1 ? '' : 's'} by ${reason}!`);
  }
  isWinner(p) { return this.s.winners.includes(p); }

  // =========================================================================
  // Turn flow
  // =========================================================================
  // The seat that opens each round: the first player, or the next one still in the game.
  roundStarter() { return this.P(this.s.first).eliminated ? this.nextPlayer(this.s.first) : this.s.first; }
  nextPlayer(p) {
    for (let k = 1; k <= this.n; k++) {
      const q = (p + k) % this.n;
      if (!this.P(q).eliminated) return q;
    }
    return p;
  }
  startTurn(p) {
    const s = this.s;
    s.turnSerial++;
    s.active = p;
    s.activeUnit = null;
    s.step = 'zone';
    const P = this.P(p);
    P.turns++;
    if (p === this.roundStarter()) s.round++;
    this.expireStatuses('sot', { p });
    // Mind refreshes before their controller's turn; Body damage stays until healed
    for (const u of this.unitsOf(p)) {
      u.state = 'ready';
      u.apSpent = 0;
      u.apBonus = 0;
      u.apBase = 0;
      u.act = null;
      u.firstStepUsed = false;
      u.mp = this.maxMp(u);
    }
    this.emit({ t: 'turn', p, serial: s.turnSerial, round: s.round });
    this.emit({ t: 'recover', p });
    // Grace periods on the defender's own Lanes last through this turn
    this.trigger('turnStart', { p });
    if (s.winner !== null) return;
    // Draw Phase
    this.drawToHandSize(p);
    this.emit({ t: 'step', step: 'zone' });
    this.log(`— ${P.name}'s turn (Round ${s.round}) —`);
  }

  // End Phase: discard chosen cards, resolve end-of-turn effects, pass play on.
  endTurn(p, discards = []) {
    const s = this.s;
    if (s.activeUnit) this.endActivation(this.unit(s.activeUnit));
    s.step = 'end';
    const P = this.P(p);
    for (const iid of discards) if (P.hand.includes(iid)) this.discardFromHand(p, iid);
    if (discards.length) this.log(`${P.name} discards ${discards.length} card${discards.length > 1 ? 's' : ''}.`);
    this.trigger('turnEnd', { p });
    if (s.winner !== null) return;
    this.expireStatuses('eot', { p });
    for (const u of this.unitsOf(p)) {
      u.freeSteps = 0;
      u.apBonus = 0;
      if (u.state !== 'done') u.lastActMoved = false;
      u.state = 'done';
    }
    // The defender's rebuild window ends with their own turn
    for (const ln of s.lanes) if (ln.grace && ln.grace.p === p && s.turnSerial > ln.grace.cs) ln.grace = null;
    s.obstacles = s.obstacles.filter((o) => o.until > s.turnSerial);
    this.dirty();
    s.undo = null;
    if (!P.eliminated && P.turns >= 3) P.established = true;
    this.checkEliminations();
    if (s.winner !== null) return;
    if (s.round >= C.ROUND_LIMIT && this.nextPlayer(p) === this.roundStarter()) { this.timeUp(); return; }
    this.startTurn(this.nextPlayer(p));
  }
  timeUp() {
    // Safety valve: the team with the most Structure BP + Identities wins
    const score = {};
    for (const p of this.alivePlayers()) {
      const t = this.team(p);
      score[t] = (score[t] || 0) + this.structsOf(p).reduce((n, st) => n + st.bp, 0) + this.unitsOf(p).length * 5;
    }
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    this.win(+best[0], 'Time limit');
  }

  beginActivation(u) {
    const s = this.s;
    if (u.state === 'active') return;
    if (s.activeUnit && s.activeUnit !== u.iid) {
      const prev = this.unit(s.activeUnit);
      if (prev) this.endActivation(prev);
    }
    u.state = 'active';
    u.actSerial = (u.actSerial || 0) + 1;
    u.actStamp = s.turnSerial;
    const kept = u.keepAct && u.act ? u.act : null;
    u.keepAct = false;
    if (!kept) u.apSpent = 0;
    u.firstStepUsed = !!kept;
    u.act = kept || { moved: 0, movedOnce: false, acted: false, mpSpent: 0, attacked: false, ability: false, usedItem: false, touchedEnemy: false, movedBeforeAttack: 0 };
    s.activeUnit = u.iid;
    this.trigger('activationStart', { unit: u.iid });
    u.apBase = this.stat(u, 'ap', { activation: true }) + (u.apNext || 0);
    u.apNext = 0;
    this.emit({ t: 'activate', unit: u.iid });
  }
  endActivation(u) {
    if (!u || u.state !== 'active') return;
    u.state = 'done';
    u.lastActMoved = (u.act && u.act.moved > 0) || false;
    this.s.activeUnit = null;
    this.trigger('activationEnd', { unit: u.iid });
    const before = u.statuses.length;
    u.statuses = u.statuses.filter((st) => !(st.at === 'act' && st.cs < u.actStamp) && !(st.at === 'thisAct'));
    if (u.statuses.length !== before) this.dirty();
    u.targetedSince = false;
    this.emit({ t: 'deactivate', unit: u.iid });
  }
  // After attacking or using an ability the Identity's normal movement is over.
  markActed(u) {
    if (!u.act) return;
    u.act.acted = true;
  }

  // =========================================================================
  // Damage, healing, defeat
  // =========================================================================
  dealDamage(targetId, amount, o = {}) {
    const s = this.s;
    const u = this.unit(targetId);
    const st = u ? null : this.struct(targetId);
    if (!u && !st) return 0;
    const dmg = { amount: Math.max(0, amount), kind: o.kind || 'effect', ranged: !!o.ranged, srcUnit: o.unit || null, p: o.p, target: targetId, isStruct: !!st, attack: o.kind === 'attack' || o.kind === 'retaliation' };
    if (dmg.amount > 0) for (const { h, src } of this.sources()) if (h.incoming) h.incoming(this, src, dmg);
    if (u && dmg.amount > 0) for (const g of u.statuses) if (g.kind === 'guard') dmg.amount -= g.v;
    let amt = Math.max(0, Math.floor(dmg.amount));
    let blocked = 0;
    if (u && u.barrier > 0 && amt > 0) {
      blocked = Math.min(u.barrier, amt);
      u.barrier -= blocked;
      amt -= blocked;
    }
    const ent = u || st;
    ent.bp -= amt;
    const attackerUnit = o.unit ? this.unit(o.unit) : null;
    if (amt > 0 && o.p !== undefined && o.p !== null && o.p !== ent.owner) s.stats[o.p].damage += amt;
    this.emit({ t: 'damage', target: targetId, amount: amt, blocked, bp: Math.max(0, ent.bp), kind: dmg.kind, struct: !!st });
    if (u && amt > 0) {
      u.hitBy = (u.hitBy || []).filter((h) => h.s === s.turnSerial);
      if (attackerUnit) u.hitBy.push({ u: attackerUnit.iid, s: s.turnSerial, f: this.faction(attackerUnit), o: attackerUnit.owner });
      if (attackerUnit) {
        attackerUnit.dealtTo = (attackerUnit.dealtTo || []).filter((h) => h.s === s.turnSerial);
        attackerUnit.dealtTo.push({ u: u.iid, s: s.turnSerial });
      }
    }
    if (amt > 0) this.trigger('damaged', { target: targetId, amount: amt, kind: dmg.kind, srcUnit: o.unit || null, p: o.p, isStruct: !!st, ranged: dmg.ranged });
    if (u && this.s.units[u.iid] && u.bp <= 0) {
      const save = this.hookAny('lethal', u, o);
      if (save) {
        u.bp = Math.max(1, u.bp);
        this.emit({ t: 'status', target: u.iid, text: save.src.name + '!', good: true });
      } else this.defeat(u, o);
    } else if (st && this.s.structs[st.iid] && st.bp <= 0) {
      this.destroyStruct(st, o);
    }
    return amt;
  }

  defeat(u, o = {}) {
    const s = this.s;
    const d = this.def(u.cardId);
    const killer = o.unit ? this.unit(o.unit) : null;
    this.trigger('dying', { unit: u.iid, killer: killer ? killer.iid : null, p: o.p });
    if (!this.s.units[u.iid]) return;
    delete s.units[u.iid];
    if (s.activeUnit === u.iid) s.activeUnit = null;
    this.dirty();
    const eq = u.eq;
    const cons = u.cons;
    this.toDiscard(u.iid);
    if (eq) {
      const back = this.hookAny('salvage', u, eq);
      if (back) this.returnToHand(eq); else this.toDiscard(eq);
      this.trigger('equipDiscarded', { unit: u.iid, card: eq, owner: u.owner });
    }
    if (cons) this.toDiscard(cons);
    if (o.p !== undefined && o.p !== null && this.foe(o.p, u.owner)) s.stats[o.p].kills++;
    this.emit({ t: 'defeat', target: u.iid, cardId: u.cardId, x: u.x, y: u.y, owner: u.owner });
    this.log(`${d.name} is defeated!`);
    this.trigger('defeated', { unit: u.iid, snapshot: u, killer: killer ? killer.iid : null, p: o.p, owner: u.owner, x: u.x, y: u.y, via: u.via });
    this.flushLater();
  }

  destroyStruct(st, o = {}) {
    const s = this.s;
    const d = this.def(st.cardId);
    delete s.structs[st.iid];
    const ln = this.lane(st.lane);
    ln.structure = null;
    // Phase 1: the Zone cannot be replaced this turn, and its owner gets their next turn to rebuild.
    ln.grace = { p: st.owner, cs: s.turnSerial };
    this.dirty();
    this.toDiscard(st.iid);
    this.emit({ t: 'destroy', target: st.iid, lane: st.lane, owner: st.owner, cardId: st.cardId, x: st.x, y: st.y });
    this.log(`${d.name} crumbles! ${this.laneName(st.lane)} is now vulnerable.`);
    const by = o.p !== undefined && o.p !== null ? o.p : s.active;
    if (this.foe(by, st.owner)) s.stats[by].structures++;
    this.trigger('structDestroyed', { struct: st.iid, lane: st.lane, owner: st.owner, by });
  }

  heal(u, amount, o = {}) {
    if (!u || amount <= 0) return 0;
    const heal = { amount, stat: 'bp', kind: o.kind || 'effect' };
    for (const { h, src } of this.sources()) if (h.healMod) h.healMod(this, src, u, heal);
    const red = u.statuses.find((s) => s.kind === 'healReduce');
    if (red) { heal.amount -= red.v; u.statuses = u.statuses.filter((s) => s !== red); }
    const mx = this.maxBp(u);
    const n = Math.max(0, Math.min(heal.amount, mx - u.bp));
    if (n <= 0) return 0;
    u.bp += n;
    this.emit({ t: 'heal', target: u.iid, amount: n, bp: u.bp });
    this.trigger('healed', { unit: u.iid, amount: n, kind: heal.kind });
    return n;
  }
  restoreMp(u, amount, o = {}) {
    if (!u || amount <= 0) return 0;
    const heal = { amount, stat: 'mp', kind: o.kind || 'effect' };
    for (const { h, src } of this.sources()) if (h.healMod) h.healMod(this, src, u, heal);
    const mx = this.maxMp(u);
    const n = Math.max(0, Math.min(heal.amount, mx - u.mp));
    if (n <= 0) return 0;
    u.mp += n;
    this.emit({ t: 'mp', target: u.iid, amount: n, mp: u.mp });
    return n;
  }
  loseMp(u, amount) {
    if (!u) return 0;
    const n = Math.min(u.mp, amount);
    if (n <= 0) return 0;
    u.mp -= n;
    this.emit({ t: 'mp', target: u.iid, amount: -n, mp: u.mp });
    return n;
  }
  healStruct(st, amount) {
    if (!st) return 0;
    const n = Math.max(0, Math.min(amount, this.structMaxBp(st) - st.bp));
    if (!n) return 0;
    st.bp += n;
    this.emit({ t: 'heal', target: st.iid, amount: n, bp: st.bp, struct: true });
    return n;
  }
  grantFreeSteps(u, n = 1, why) {
    if (!u || n <= 0) return;
    u.freeSteps += n;
    this.emit({ t: 'freeStep', unit: u.iid, n, why });
  }
  addApBonus(u, n, why) {
    if (!u || !n) return;
    u.apBonus += n;
    this.emit({ t: 'status', target: u.iid, text: `${n > 0 ? '+' : ''}${n} AP${why ? ' · ' + why : ''}`, good: n > 0 });
  }
  giveBarrier(u, n) {
    if (!u) return;
    u.barrier += n;
    this.emit({ t: 'status', target: u.iid, text: `Barrier ${n}`, good: true });
  }
  // "May keep acting": a finished Identity gets another activation but keeps its
  // movement/attack record for this turn (so it cannot make a second normal move).
  extend(u) {
    if (!u) return;
    if (u.state === 'done') { u.state = 'ready'; u.keepAct = true; }
    this.emit({ t: 'status', target: u.iid, text: 'Act again!', good: true });
  }
  refreshUnit(u) {
    if (!u) return;
    if (this.s.activeUnit === u.iid) this.endActivation(u);
    u.state = 'ready';
    u.apSpent = 0;
    u.act = null;
    u.mp = Math.max(u.mp, this.maxMp(u));
    this.emit({ t: 'status', target: u.iid, text: 'Refreshed!', good: true });
  }
  createToken(p, tokenId, tile, via = null) {
    if (!tile || !this.isEmpty(tile.x, tile.y)) return null;
    if (this.unitsOf(p).filter((u) => this.def(u.cardId).token).length >= C.TOKEN_CAP) {
      this.emit({ t: 'fizzle', text: 'Too many tokens on the battlefield!' });
      return null;
    }
    const iid = this.newInst(tokenId, p);
    const u = this.makeUnit(iid, p, tile.x, tile.y);
    u.via = via;
    this.s.units[iid] = u;
    this.dirty();
    this.emit({ t: 'summon', unit: iid, p, cardId: tokenId, x: tile.x, y: tile.y, token: true });
    this.trigger('summoned', { unit: iid, token: true });
    return u;
  }
  makeUnit(iid, p, x, y) {
    const d = this.def(iid);
    return {
      iid, cardId: this.s.inst[iid].cardId, owner: p, x, y,
      bp: d.stats.bp, mp: d.stats.mp,
      apSpent: 0, apBonus: 0, apBase: 0, apNext: 0,
      state: 'ready', eq: null, cons: null, statuses: [], barrier: 0, freeSteps: 0,
      summonedSerial: this.s.turnSerial, via: null, flags: {}, act: null, lastActMoved: false,
      boost: {}, actSerial: 0, actStamp: 0, firstStepUsed: false,
    };
  }
  emptyAdjacentTiles(pos) {
    const out = [];
    for (const [dx, dy] of DIRS) {
      const x = pos.x + dx, y = pos.y + dy;
      if (this.isEmpty(x, y)) out.push({ x, y });
    }
    return out;
  }
  emptyTilesNear(pos, n = 1, sameLane = null) {
    const out = [];
    for (let x = pos.x - n; x <= pos.x + n; x++) for (let y = pos.y - n; y <= pos.y + n; y++) {
      if ((x !== pos.x || y !== pos.y) && this.isEmpty(x, y) && (sameLane === null || this.laneAt(x, y) === sameLane)) out.push({ x, y });
    }
    return out.sort((a, b) => cheb(a, pos) - cheb(b, pos));
  }
  emptyTilesNearStruct(st, n = 1) { return this.emptyTilesNear(st, n); }
  laneTiles(l, emptyOnly = true) {
    const ln = this.lane(l);
    const out = [];
    for (let x = ln.x0; x < ln.x0 + ln.w; x++) for (let y = ln.y0; y < ln.y0 + ln.h; y++) if (!emptyOnly || this.isEmpty(x, y)) out.push({ x, y });
    return out;
  }

  // =========================================================================
  // Movement
  // =========================================================================
  canPassThrough(u, x, y) { return !!this.hookAny('passThrough', u, { x, y }); }
  stepCost(u, from, to, stepIndex) {
    let c = 1;
    if (stepIndex === 0 && !u.firstStepUsed && u.state !== 'done' && this.hookAny('firstStepFree', u)) c = 0;
    c += this.hookSum('moveCost', u, from, to);
    return Math.max(0, c);
  }
  // Uniform-cost search over tiles. Returns Map "x,y" -> {cost, path} for legal end tiles.
  reachable(u, budget = this.moveBudget(u)) {
    const res = new Map();
    if (this.hasStatus(u, 'stasis')) return res;
    const freeFirst = !u.firstStepUsed && u.state !== 'done' && this.hookAny('firstStepFree', u);
    if (budget <= 0 && !freeFirst) return res;
    const occ = this.occ();
    const hasMoveMods = this.sources().some(({ h }) => h.moveCost);
    const best = new Map([[key(u.x, u.y), 0]]);
    const buckets = [[{ x: u.x, y: u.y, path: [], steps: 0 }]];
    for (let cost = 0; cost < buckets.length; cost++) {
      const bucket = buckets[cost];
      if (!bucket) continue;
      for (const cur of bucket) {
        if (best.get(key(cur.x, cur.y)) < cost) continue;
        for (const [dx, dy] of DIRS) {
          const nx = cur.x + dx, ny = cur.y + dy;
          if (!this.inBounds(nx, ny)) continue;
          const k = key(nx, ny);
          const o = occ.get(k);
          if (o && o !== u) {
            if (o.state === undefined) continue; // structures & obstacles block
            if (!this.canPassThrough(u, nx, ny)) continue;
          }
          const step = hasMoveMods || freeFirst ? this.stepCost(u, cur, { x: nx, y: ny }, cur.steps) : 1;
          const c = cost + step;
          if (c > budget) continue;
          if (best.has(k) && best.get(k) <= c) continue;
          best.set(k, c);
          const path = [...cur.path, { x: nx, y: ny }];
          (buckets[c] || (buckets[c] = [])).push({ x: nx, y: ny, path, steps: cur.steps + 1 });
          if (!o) res.set(k, { cost: c, path });
        }
      }
    }
    return res;
  }

  walk(u, path, cost) {
    const from = { x: u.x, y: u.y };
    const usingNormal = this.canMoveNormally(u);
    const spentAp = usingNormal ? Math.min(cost, this.apAvail(u)) : 0;
    u.apSpent += spentAp;
    u.freeSteps -= Math.max(0, cost - spentAp);
    if (usingNormal && u.act) {
      u.act.movedOnce = true; // one move per turn
    }
    if (path.length) u.firstStepUsed = true;
    const done = [{ x: u.x, y: u.y }];
    u.moveStopped = false;
    for (const step of path) {
      const prevLane = this.laneOf(u);
      const prev = { x: u.x, y: u.y };
      u.x = step.x;
      u.y = step.y;
      done.push({ x: u.x, y: u.y });
      if (u.act) {
        u.act.moved++;
        if (this.enemiesAdjacent(u).length) u.act.touchedEnemy = true;
      }
      this.dirty();
      const nl = this.laneOf(u);
      if (nl !== prevLane && nl >= 0) this.trigger('enterLane', { unit: u.iid, lane: nl, from: prevLane });
      this.trigger('step', { unit: u.iid, from: prev, to: { x: u.x, y: u.y } });
      if (!this.s.units[u.iid] || u.moveStopped || this.s.winner !== null) break;
    }
    this.emit({ t: 'move', unit: u.iid, path: done });
    if (this.s.units[u.iid]) this.trigger('moved', { unit: u.iid, from, to: { x: u.x, y: u.y }, steps: done.length - 1, forced: false });
  }

  // Forced movement (push / pull). dir = {dx, dy}. Returns tiles moved.
  forceMove(u, dir, n, byP, o = {}) {
    if (!u || n <= 0) return 0;
    const byEnemy = this.foe(byP, u.owner);
    if (byEnemy && this.hookAny('forcedImmune', u, byP)) {
      this.emit({ t: 'status', target: u.iid, text: 'Unmoved!', good: true });
      return 0;
    }
    n += this.hookSum('forcedDelta', u, byP, n);
    if (n <= 0) { this.emit({ t: 'status', target: u.iid, text: 'Resisted', good: true }); return 0; }
    const path = [{ x: u.x, y: u.y }];
    let moved = 0;
    let collided = false;
    for (let i = 0; i < n; i++) {
      const nx = u.x + dir.dx, ny = u.y + dir.dy;
      if (!this.isEmpty(nx, ny)) { collided = true; break; }
      u.x = nx; u.y = ny;
      this.dirty();
      path.push({ x: nx, y: ny });
      moved++;
    }
    if (moved) this.emit({ t: 'move', unit: u.iid, path, forced: true });
    if (collided) {
      const extra = this.hookSum('collisionBonus', u, byP);
      this.emit({ t: 'bump', unit: u.iid, dx: dir.dx, dy: dir.dy });
      this.dealDamage(u.iid, C.COLLISION_DAMAGE + extra, { kind: 'collision', p: byP, unit: o.srcUnit || null });
    }
    if (this.s.units[u.iid]) this.trigger('forcedMove', { unit: u.iid, by: byP, moved, srcUnit: o.srcUnit || null });
    return moved;
  }
  push(u, fromPos, n, byP, o = {}) {
    let dx = sign(u.x - fromPos.x), dy = sign(u.y - fromPos.y);
    if (!dx && !dy) ({ dx, dy } = this.forward(byP));
    return this.forceMove(u, { dx, dy }, n, byP, o);
  }
  pull(u, toPos, n, byP, o = {}) {
    const d = Math.max(0, cheb(u, toPos) - 1);
    return this.forceMove(u, { dx: sign(toPos.x - u.x), dy: sign(toPos.y - u.y) }, Math.min(n, d), byP, o);
  }
  teleport(u, tile, o = {}) {
    if (!u || !this.isEmpty(tile.x, tile.y)) return false;
    const from = { x: u.x, y: u.y };
    u.x = tile.x; u.y = tile.y;
    this.dirty();
    this.emit({ t: 'teleport', unit: u.iid, from, to: { ...tile } });
    this.trigger('moved', { unit: u.iid, from, to: { ...tile }, steps: 0, teleport: true, forced: !!o.forced });
    return true;
  }
  swap(a, b) {
    const pa = { x: a.x, y: a.y };
    a.x = b.x; a.y = b.y;
    b.x = pa.x; b.y = pa.y;
    this.dirty();
    this.emit({ t: 'teleport', unit: a.iid, from: { x: b.x, y: b.y }, to: { x: a.x, y: a.y } });
    this.emit({ t: 'teleport', unit: b.iid, from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } });
  }
  stepToward(u, target) {
    let best = null;
    let bd = cheb(u, target);
    for (const t of this.emptyAdjacentTiles(u)) {
      const d = cheb(t, target);
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) return false;
    const from = { x: u.x, y: u.y };
    u.x = best.x; u.y = best.y;
    this.dirty();
    this.emit({ t: 'move', unit: u.iid, path: [from, best] });
    return true;
  }

  // =========================================================================
  // Costs & ranges
  // =========================================================================
  abilityCost(u, ab) {
    if (u.statuses.some((s) => s.kind === 'abilitiesFree' || s.kind === 'freeAbility')) return 0;
    return Math.max(0, ab.cost + this.hookSum('abilityCost', u, ab));
  }
  abilityRange(u) { return this.stat(u, 'rp') + this.hookSum('abilityRange', u); }

  // =========================================================================
  // Targeting
  // =========================================================================
  // spec: {type, side, range, near, filter, optional}
  targetOptions(spec, ctx) {
    const p = ctx.p;
    const src = ctx.unit ? this.unit(ctx.unit) : null;
    const within = (pos) => {
      if (spec.range === undefined || !src) return true;
      const r = spec.range === 'rp' ? this.abilityRange(src) : spec.range === 'rp+1' ? this.abilityRange(src) + 1 : spec.range;
      return cheb(src, pos) <= r;
    };
    const sideOk = (owner) => spec.side === 'any' || !spec.side || (spec.side === 'friendly' ? this.ally(owner, p) : spec.side === 'own' ? owner === p : this.foe(owner, p));
    const out = [];
    const fromCard = ctx.card && ['Action', 'Event'].includes(this.def(ctx.card).type);
    if (spec.type === 'unit' || spec.type === 'unitOrStruct') {
      for (const u of this.allUnits()) {
        if (!sideOk(u.owner) || !within(u)) continue;
        if (spec.notSelf && src && u.iid === src.iid) continue;
        if (spec.near && !this.allUnits().some((f) => f.iid !== u.iid && (spec.near.side === 'enemy' ? this.foe(f.owner, p) : this.ally(f.owner, p)) && cheb(f, u) <= spec.near.n)) continue;
        if (fromCard && this.foe(u.owner, p) && this.hookAny('untargetable', u, p)) continue;
        if (spec.filter && !spec.filter(this, u, ctx)) continue;
        out.push(u.iid);
      }
    }
    if (spec.type === 'struct' || spec.type === 'unitOrStruct') {
      for (const st of Object.values(this.s.structs)) {
        if (!sideOk(st.owner) || !within(st)) continue;
        if (spec.near && !this.allUnits().some((f) => this.ally(f.owner, p) && cheb(f, st) <= spec.near.n)) continue;
        if (spec.filter && !spec.filter(this, st, ctx)) continue;
        out.push(st.iid);
      }
    }
    if (spec.type === 'tile') {
      const N = this.s.size;
      let x0 = 0, x1 = N - 1, y0 = 0, y1 = N - 1;
      if (spec.range !== undefined && src) {
        const r = spec.range === 'rp' ? this.abilityRange(src) : spec.range;
        x0 = Math.max(0, src.x - r); x1 = Math.min(N - 1, src.x + r); y0 = Math.max(0, src.y - r); y1 = Math.min(N - 1, src.y + r);
      }
      if (spec.lane !== undefined) {
        const lanes = typeof spec.lane === 'function' ? spec.lane(this, ctx) : [spec.lane];
        for (const l of lanes) for (const t of this.laneTiles(l, !spec.occupied)) if (within(t) && (!spec.filter || spec.filter(this, t, ctx))) out.push(t);
        return out;
      }
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const t = { x, y };
        if (!spec.occupied && !this.isEmpty(x, y)) continue;
        if (!within(t)) continue;
        if (spec.filter && !spec.filter(this, t, ctx)) continue;
        out.push(t);
      }
    }
    if (spec.type === 'lane') {
      for (const ln of this.s.lanes) if (!spec.filter || spec.filter(this, ln.id, ctx)) out.push(ln.id);
    }
    if (spec.type === 'chain') {
      this.s.chain.forEach((it, i) => { if (!spec.filter || spec.filter(this, it, ctx)) out.push(i); });
    }
    return out;
  }
  validTarget(spec, value, ctx) {
    const opts = this.targetOptions(spec, ctx);
    if (spec.type === 'tile') return opts.some((t) => value && t.x === value.x && t.y === value.y);
    return opts.includes(value);
  }
  targetCombos(specs, ctx, limit = 400) {
    const out = [];
    const rec = (i, acc) => {
      if (out.length >= limit) return;
      if (i >= specs.length) { out.push(acc); return; }
      const opts = this.targetOptions(specs[i], { ...ctx, targets: acc });
      if (!opts.length && specs[i].optional) { rec(i + 1, [...acc, null]); return; }
      for (const o of opts) rec(i + 1, [...acc, o]);
    };
    rec(0, []);
    return out;
  }
  hasTargets(specs, ctx) {
    if (!specs || !specs.length) return true;
    return this.targetCombos(specs, ctx, 1).length > 0;
  }
  checkTargets(specs, targets, ctx) {
    specs = specs || [];
    targets = targets || [];
    for (let i = 0; i < specs.length; i++) {
      const t = targets[i];
      if ((t === null || t === undefined) && specs[i].optional) continue;
      if (!this.validTarget(specs[i], t, { ...ctx, targets: targets.slice(0, i) })) return false;
    }
    return true;
  }

  // =========================================================================
  // Queries for UI / AI
  // =========================================================================
  canAct(p) {
    const s = this.s;
    if (s.winner !== null || this.P(p).eliminated) return false;
    if (s.phase === 'setup') return s.active === p;
    if (s.phase !== 'play') return false;
    if (s.chain.length) return s.priority === p;
    return s.active === p;
  }
  stepOk(needed) {
    return STEP_INDEX[this.s.step] <= STEP_INDEX[needed];
  }
  // Legal Zone lanes for player p (Phase 1 §4.1 / §4.2)
  zoneLanes(p) {
    const out = [];
    for (const ln of this.s.lanes) if (this.zoneLaneOk(p, ln.id)) out.push(ln.id);
    return out;
  }
  zoneLaneOk(p, l) {
    const ln = this.lane(l);
    const home = ln.home === p;
    const present = this.unitsInLane(l, p).length > 0;
    if (this.s.phase === 'setup') return home && ln.zone === null;
    if (ln.zone === null) return home || present;
    if (ln.ctrl === p) return !this.structInLane(l) && (home || present);
    if (this.ally(ln.ctrl, p)) return false;
    // enemy Zone: Structure destroyed, rebuild window over, and one of your Identities in the Lane
    if (this.structInLane(l) || ln.grace) return false;
    const need = 1 + this.hookSum('captureReq', l, p);
    return this.unitsInLane(l, p).length >= need;
  }
  structLanes(p) {
    return this.s.lanes.filter((ln) => ln.ctrl === p && !this.structInLane(ln.id) && this.laneTiles(ln.id).length).map((ln) => ln.id);
  }
  summonTiles(p, st = null) {
    const out = [];
    const seen = new Set();
    for (const s of st ? [st] : this.structsOf(p)) {
      if (this.housedCount(s) >= this.structHousing(s)) continue;
      const extra = this.hookSum('summonRange', s);
      const tiles = this.laneTiles(s.lane);
      if (extra > 0) tiles.push(...this.emptyTilesNear(s, extra));
      for (const t of tiles) {
        const k = key(t.x, t.y);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ ...t, struct: s.iid });
      }
    }
    return out;
  }
  structForSummon(p, tile) {
    for (const st of this.structsOf(p)) {
      if (this.housedCount(st) >= this.structHousing(st)) continue;
      if (!this.isEmpty(tile.x, tile.y)) continue;
      if (this.laneAt(tile.x, tile.y) === st.lane) return st;
      const extra = this.hookSum('summonRange', st);
      if (extra > 0 && cheb(tile, st) <= extra) return st;
    }
    return null;
  }
  // Which turn step a card belongs to
  cardStep(d) {
    return { Zone: 'zone', Structure: 'build', Identity: 'summon', Equipment: 'equip', Consumable: 'equip' }[d.type] || null;
  }
  playSpecs(iid) {
    const d = this.def(iid);
    const p = this.s.inst[iid].owner;
    switch (d.type) {
      case 'Zone': return [{ type: 'lane', label: 'Choose a Lane to claim', filter: (E, l) => E.zoneLaneOk(p, l) }];
      case 'Structure': return [{ type: 'tile', label: 'Choose a tile in a Lane you control', lane: (E) => E.structLanes(p) }];
      case 'Identity': return [{ type: 'tile', label: 'Choose a tile in a Lane with your Structure', filter: (E, t) => !!E.structForSummon(p, t) }];
      case 'Equipment': return [{ type: 'unit', side: 'own', label: 'Equip which Identity?' }];
      case 'Consumable': return [{ type: 'unit', side: 'own', label: 'Give to which Identity?' }];
      default: return (d.play && d.play.targets) || [];
    }
  }
  canPlay(p, iid, { ignoreTargets = false } = {}) {
    const s = this.s;
    if (!this.canAct(p)) return false;
    const P = this.P(p);
    if (!P.hand.includes(iid)) return false;
    const d = this.def(iid);
    if (!d) return false;
    if (s.phase === 'setup') {
      if (d.type !== 'Zone') return false;
    } else if (s.chain.length) {
      if (!(['Action', 'Event'].includes(d.type) && d.play && d.play.timing === 'response')) return false;
    } else {
      const step = this.cardStep(d);
      if (step && !this.stepOk(step)) return false;
    }
    if (d.type === 'Identity' && !this.summonTiles(p).length) return false;
    if (d.type === 'Structure' && !this.structLanes(p).length) return false;
    if (d.type === 'Zone' && !this.zoneLanes(p).length) return false;
    if (d.play && d.play.condition && !d.play.condition(this, { p, card: iid })) return false;
    if (ignoreTargets) return true;
    return this.hasTargets(this.playSpecs(iid), { p, card: iid });
  }
  playableCards(p) { return this.P(p).hand.filter((iid) => this.canPlay(p, iid)); }
  responseConsumables(p) {
    return this.unitsOf(p).filter((u) => u.cons && this.consumableUsable(u, true));
  }
  hasResponse(p) {
    if (this.P(p).eliminated) return false;
    const saved = this.s.priority;
    this.s.priority = p;
    const any = this.P(p).hand.some((iid) => { const d = this.def(iid); return d && d.play && d.play.timing === 'response' && this.canPlay(p, iid); })
      || this.responseConsumables(p).length > 0;
    this.s.priority = saved;
    return any;
  }
  canAttack(u) {
    if (!u || u.state === 'done' || this.hasStatus(u, 'stasis') || this.hasStatus(u, 'noAttack')) return false;
    return u.mp >= this.attackCost(u);
  }
  attackTargets(u, from = null) {
    if (!this.canAttack(u)) return [];
    const pos = from || u;
    const rp = this.stat(u, 'rp', { position: pos });
    const out = [];
    for (const e of this.allUnits()) if (this.foe(e.owner, u.owner) && cheb(pos, e) <= rp) out.push(e.iid);
    for (const st of Object.values(this.s.structs)) if (this.foe(st.owner, u.owner) && cheb(pos, st) <= rp) out.push(st.iid);
    return out;
  }
  unitAbilities(u) {
    const out = [];
    const d = this.def(u.cardId);
    if (d.unique && d.unique.active) out.push({ key: 'unique', ab: d.unique.active, name: d.unique.active.name || d.unique.name });
    if (u.eq) { const e = this.def(u.eq); if (e.active) out.push({ key: 'equip', ab: e.active, name: e.active.name || e.name }); }
    return out;
  }
  abilityUsable(u, k) {
    if (!u || u.state === 'done' || this.hasStatus(u, 'stasis')) return false;
    const entry = this.unitAbilities(u).find((a) => a.key === k);
    if (!entry) return false;
    if (entry.ab.oncePerTurn && this.usedThisTurn(u, 'abT_' + k)) return false;
    if (u.mp < this.abilityCost(u, entry.ab)) return false;
    if (entry.ab.condition && !entry.ab.condition(this, { p: u.owner, unit: u.iid })) return false;
    return this.hasTargets(entry.ab.targets, { p: u.owner, unit: u.iid });
  }
  consumableUsable(u, asResponse = false) {
    if (!u || !u.cons) return false;
    const d = this.def(u.cons);
    if (!d.use) return false;
    if (asResponse && d.use.timing !== 'response') return false;
    if (d.use.condition && !d.use.condition(this, { p: u.owner, unit: u.iid })) return false;
    return this.hasTargets(d.use.targets, { p: u.owner, unit: u.iid, card: u.cons });
  }

  // =========================================================================
  // Actions (the only way the outside world mutates the game)
  // =========================================================================
  act(p, a) {
    this.events = [];
    const s = this.s;
    try {
      if (s.phase === 'over') return this.fail('The match is over.');
      if (a.type === 'concede') {
        if (this.P(p).eliminated) return this.fail('Already out.');
        this.log(`${this.P(p).name} concedes.`);
        this.eliminate(p, 'conceded');
        this.checkVictory();
        if (s.winner === null) this.afterAction(p);
        return this.ok();
      }
      if (a.type === 'setAutoRetaliate') { this.P(p).autoRetaliate = !!a.on; return this.ok(); }
      if (!this.canAct(p)) return this.fail("It isn't your turn to act.");
      if (s.phase === 'setup') {
        if (a.type === 'play') return this.doPlay(p, a.iid, a.targets || []);
        if (a.type === 'ready') return this.doReady(p);
        return this.fail('During setup you may only place Zones in your Home Lanes.');
      }
      if (a.type === 'undo') return this.doUndo(p);
      const snapshot = a.type === 'move' && !s.chain.length && !this.noUndo ? JSON.stringify({ ...s, undo: null }) : null;
      let r;
      switch (a.type) {
        case 'pass': r = this.doPass(p); break;
        case 'endTurn': r = this.doEndTurn(p, a.discard || []); break;
        case 'nextStep': r = this.doNextStep(p); break;
        case 'play': r = this.doPlay(p, a.iid, a.targets || []); break;
        case 'move': r = this.doMove(p, a.unit, a.to); break;
        case 'attack': r = this.doAttack(p, a.unit, a.target); break;
        case 'ability': r = this.doAbility(p, a.unit, a.key || 'unique', a.targets || []); break;
        case 'consume': r = this.doConsume(p, a.unit, a.targets || []); break;
        case 'wait': r = this.doWait(p, a.unit); break;
        default: return this.fail('Unknown action.');
      }
      if (r.ok) {
        this.afterAction(p);
        const clean = r.events.every((e) => UNDO_SAFE.has(e.t));
        s.undo = snapshot && clean && s.winner === null ? snapshot : null;
      }
      return r;
    } catch (err) {
      console.error(err);
      return this.fail('Engine error: ' + err.message);
    }
  }
  // Eliminations can happen mid-turn; if the active player is knocked out, play passes on.
  afterAction() {
    const s = this.s;
    this.checkEliminations();
    if (s.winner !== null) return;
    if (s.priority !== null && this.P(s.priority).eliminated) { s.priority = this.nextPlayer(s.priority); this.advancePriority(); }
    if (this.P(s.active).eliminated && s.phase === 'play') {
      s.chain = [];
      s.priority = null;
      this.startTurn(this.nextPlayer(s.active));
    }
  }
  ok() { return { ok: true, events: this.events }; }
  fail(err) { return { ok: false, error: err, events: [] }; }

  // ---- setup ----------------------------------------------------------------
  doReady(p) {
    const s = this.s;
    s.setupDone[p] = true;
    this.emit({ t: 'ready', p });
    const next = s.players.findIndex((_, i) => !s.setupDone[(s.first + i) % this.n] ) ;
    if (next === -1) {
      s.phase = 'play';
      this.log('Setup complete — let the battle begin!');
      this.startTurn(s.first);
    } else {
      s.active = (s.first + next) % this.n;
      this.emit({ t: 'setupTurn', p: s.active });
    }
    return this.ok();
  }

  doUndo(p) {
    const s = this.s;
    if (!s.undo || s.active !== p) return this.fail('Nothing to undo.');
    const prev = JSON.parse(s.undo);
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, prev);
    s.undo = null;
    this.dirty();
    this.emit({ t: 'undo' });
    return this.ok();
  }

  advanceStep(to) {
    const s = this.s;
    if (STEP_INDEX[to] > STEP_INDEX[s.step]) {
      if (STEP_INDEX[to] > STEP_INDEX.summon && s.activeUnit === null) {/* nothing */}
      s.step = to;
      this.emit({ t: 'step', step: to });
    }
  }
  doNextStep(p) {
    const s = this.s;
    if (s.chain.length) return this.fail('Resolve the chain first.');
    const i = STEP_INDEX[s.step];
    if (i >= STEP_INDEX.combat) return this.fail('Use End Turn to finish.');
    this.advanceStep(C.STEPS[i + 1]);
    return this.ok();
  }
  doEndTurn(p, discard) {
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    this.endTurn(p, discard);
    return this.ok();
  }

  doWait(p, uid) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (u.state === 'done') return this.fail('Already done.');
    if (!this.stepOk('combat')) return this.fail('Too late in the turn.');
    this.advanceStep('combat');
    if (u.state === 'ready') this.beginActivation(u);
    this.endActivation(u);
    return this.ok();
  }

  doMove(p, uid, to) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (!to) return this.fail('No destination.');
    if (!this.stepOk('combat')) return this.fail('Too late in the turn.');
    if (this.hasStatus(u, 'stasis')) return this.fail('That Identity is held in Stasis.');
    const normal = this.canMoveNormally(u);
    if (!normal && u.freeSteps <= 0) return this.fail(u.state === 'done' ? 'That Identity has finished its activation.' : 'It has already moved or acted this turn.');
    this.advanceStep('combat');
    if (normal && u.state === 'ready') this.beginActivation(u);
    const budget = this.moveBudget(u);
    const r = this.reachable(u, budget).get(key(to.x, to.y));
    if (!r) return this.fail('Cannot reach that tile.');
    this.walk(u, r.path, r.cost);
    return this.ok();
  }

  doAttack(p, uid, targetId) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (!this.stepOk('combat')) return this.fail('Too late in the turn.');
    if (!this.attackTargets(u).includes(targetId)) return this.fail(this.canAttack(u) ? 'Target out of range.' : 'Not enough MP to attack.');
    this.advanceStep('combat');
    if (u.state === 'ready') this.beginActivation(u);
    const cost = this.attackCost(u);
    u.mp -= cost;
    u.act.mpSpent += cost;
    u.act.attacked = true;
    u.act.attacks = (u.act.attacks || 0) + 1;
    u.act.movedBeforeAttack = u.act.moved;
    this.markActed(u);
    const tgt = this.entity(targetId);
    this.emit({ t: 'declare', unit: uid, target: targetId, cost });
    this.log(`${this.def(u.cardId).name} attacks ${this.def(tgt.cardId).name}!`);
    this.openChain({ kind: 'attack', p, unit: uid, target: targetId, mods: { reduce: 0 } });
    if (this.s.units[uid] && u.mp === 0 && cost > 0) this.trigger('mpZero', { unit: uid });
    return this.ok();
  }

  doAbility(p, uid, k, targets) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (!this.stepOk('combat')) return this.fail('Too late in the turn.');
    if (!this.abilityUsable(u, k)) return this.fail('Ability not available.');
    const entry = this.unitAbilities(u).find((a) => a.key === k);
    const ab = entry.ab;
    const ctx = { p, unit: uid, targets };
    if (!this.checkTargets(ab.targets, targets, ctx)) return this.fail('Invalid target.');
    this.advanceStep('combat');
    if (u.state === 'ready') this.beginActivation(u);
    const cost = this.abilityCost(u, ab);
    u.mp -= cost;
    u.act.mpSpent += cost;
    u.act.ability = true;
    this.markActed(u);
    if (ab.oncePerTurn) this.once(u, 'abT_' + k);
    const free = u.statuses.find((s) => s.kind === 'freeAbility');
    if (free) u.statuses = u.statuses.filter((s) => s !== free);
    this.emit({ t: 'ability', unit: uid, name: entry.name, cost, targets });
    this.log(`${this.def(u.cardId).name} uses ${entry.name}!`);
    for (const t of targets) {
      const tu = this.unit(t);
      if (tu && this.foe(tu.owner, p)) { tu.targetedSince = true; this.trigger('targeted', { unit: tu.iid, by: p, srcUnit: uid }); }
    }
    ab.resolve(this, ctx);
    if (this.s.units[uid]) {
      this.trigger('abilityUsed', { unit: uid, cost, targets, key: k });
      if (u.mp === 0 && cost > 0) this.trigger('mpZero', { unit: uid });
    }
    return this.ok();
  }

  // Using an attached Consumable goes on the response sequence (Phase 1 §14.6).
  doConsume(p, uid, targets) {
    const s = this.s;
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    const responding = s.chain.length > 0;
    if (!this.consumableUsable(u, responding)) return this.fail(responding ? 'That Consumable cannot be used as a response.' : 'No usable Consumable.');
    if (!responding && !this.stepOk('combat')) return this.fail('Too late in the turn.');
    const cid = u.cons;
    const d = this.def(cid);
    const ctx = { p, unit: uid, targets, card: cid };
    if (!this.checkTargets(d.use.targets, targets, ctx)) return this.fail('Invalid target.');
    if (!responding && d.use.timing !== 'response') this.advanceStep('combat');
    u.cons = null;
    this.dirty();
    if (u.act) u.act.usedItem = true;
    this.emit({ t: 'consume', unit: uid, cardId: this.s.inst[cid].cardId, name: d.name });
    this.log(`${this.def(u.cardId).name} uses ${d.name}.`);
    this.openChain({ kind: 'consume', p, unit: uid, card: cid, targets, cardId: this.s.inst[cid].cardId });
    return this.ok();
  }

  doPlay(p, iid, targets) {
    const s = this.s;
    const P = this.P(p);
    if (!this.canPlay(p, iid, { ignoreTargets: true })) return this.fail(this.whyNot(p, iid));
    const d = this.def(iid);
    const specs = this.playSpecs(iid);
    const ctx = { p, card: iid, targets };
    if (!this.checkTargets(specs, targets, ctx)) return this.fail('Invalid target.');
    const step = this.cardStep(d);
    if (step && s.phase === 'play') this.advanceStep(step);
    P.hand.splice(P.hand.indexOf(iid), 1);
    s.stats[p].cards++;
    this.emit({ t: 'play', p, iid, cardId: this.s.inst[iid].cardId, targets });
    this.trigger('cardPlayed', { p, card: iid, type: d.type });
    switch (d.type) {
      case 'Zone': this.placeZone(p, iid, targets[0]); break;
      case 'Structure': this.placeStruct(p, iid, targets[0]); break;
      case 'Identity': this.summon(p, iid, targets[0], this.structForSummon(p, targets[0])); break;
      case 'Equipment': this.attachEquip(p, iid, targets[0]); break;
      case 'Consumable': this.attachCons(p, iid, targets[0]); break;
      default:
        this.log(`${P.name} plays ${d.name}.`);
        for (const t of targets) {
          const tu = this.unit(t);
          if (tu && this.foe(tu.owner, p)) { tu.targetedSince = true; this.trigger('targeted', { unit: tu.iid, by: p, card: iid }); }
        }
        this.openChain({ kind: 'card', p, iid, targets, cardId: this.s.inst[iid].cardId });
    }
    return this.ok();
  }
  whyNot(p, iid) {
    const s = this.s;
    const d = this.def(iid);
    if (!d) return "You can't play that.";
    if (s.phase === 'setup') return d.type === 'Zone' ? 'No open Home Lane for that Zone.' : 'During setup you may only place Zones.';
    if (s.chain.length) return 'Only ⚡Response cards can be played now.';
    if (s.active !== p) return "It isn't your turn.";
    const step = this.cardStep(d);
    if (step && !this.stepOk(step)) return `The ${C.STEP_NAMES[step]} Phase has already passed this turn.`;
    if (d.type === 'Identity') return 'No Structure with free Housing.';
    if (d.type === 'Structure') return 'You need a Lane you control without a Structure.';
    if (d.type === 'Zone') return 'No Lane you can claim right now.';
    return 'No valid target.';
  }

  placeZone(p, iid, l) {
    const ln = this.lane(l);
    const prev = ln.zone;
    const capture = ln.ctrl !== null && this.foe(ln.ctrl, p);
    const prevCtrl = ln.ctrl;
    if (prev) this.toDiscard(prev);
    ln.zone = iid;
    ln.ctrl = p;
    ln.grace = null;
    this.dirty();
    this.emit({ t: 'zone', lane: l, p, iid, cardId: this.s.inst[iid].cardId, replaced: !!prev, capture, from: prevCtrl });
    this.log(`${this.P(p).name} ${capture ? 'captures' : 'claims'} ${this.laneName(l)} with ${this.def(iid).name}.`);
    if (capture) this.s.stats[p].captures++;
    this.trigger('zonePlaced', { lane: l, p, capture, card: iid });
  }
  placeStruct(p, iid, tile) {
    const d = this.def(iid);
    const l = this.laneAt(tile.x, tile.y);
    const st = { iid, cardId: this.s.inst[iid].cardId, owner: p, lane: l, x: tile.x, y: tile.y, bp: d.bp, bonusBp: 0, flags: {}, builtSerial: this.s.turnSerial };
    this.s.structs[iid] = st;
    this.lane(l).structure = iid;
    this.lane(l).grace = null;
    this.dirty();
    st.bp = this.structMaxBp(st);
    this.P(p).established = true;
    this.emit({ t: 'struct', lane: l, p, iid, cardId: st.cardId, bp: st.bp, x: st.x, y: st.y });
    this.log(`${this.P(p).name} builds ${d.name} in ${this.laneName(l)}.`);
    this.trigger('structBuilt', { struct: iid, lane: l, p });
  }
  summon(p, iid, tile, st) {
    const u = this.makeUnit(iid, p, tile.x, tile.y);
    u.via = st.iid;
    u.summonLane = this.laneAt(tile.x, tile.y);
    this.s.units[iid] = u;
    this.s.stats[p].summoned++;
    this.P(p).established = true;
    this.dirty();
    this.emit({ t: 'summon', unit: iid, p, cardId: u.cardId, x: tile.x, y: tile.y, struct: st.iid });
    this.log(`${this.P(p).name} summons ${this.def(iid).name}!`);
    this.trigger('summoned', { unit: iid, struct: st.iid, lane: u.summonLane });
  }
  attachEquip(p, iid, uid) {
    const u = this.unit(uid);
    if (u.eq) { this.toDiscard(u.eq); this.trigger('equipDiscarded', { unit: uid, card: u.eq, owner: u.owner }); }
    const beforeMax = this.maxBp(u);
    const beforeMp = this.maxMp(u);
    u.eq = iid;
    this.dirty();
    const afterMax = this.maxBp(u);
    if (afterMax > beforeMax) u.bp += afterMax - beforeMax;
    u.bp = Math.min(u.bp, afterMax);
    const afterMp = this.maxMp(u);
    if (afterMp > beforeMp) u.mp += afterMp - beforeMp;
    u.mp = Math.min(u.mp, afterMp);
    this.emit({ t: 'attach', unit: uid, iid, cardId: this.s.inst[iid].cardId, slot: 'eq' });
    this.log(`${this.def(u.cardId).name} equips ${this.def(iid).name}.`);
    this.trigger('equipped', { unit: uid, card: iid });
  }
  attachCons(p, iid, uid) {
    const u = this.unit(uid);
    if (u.cons) this.toDiscard(u.cons);
    u.cons = iid;
    this.dirty();
    this.emit({ t: 'attach', unit: uid, iid, cardId: this.s.inst[iid].cardId, slot: 'cons' });
    this.log(`${this.def(u.cardId).name} readies ${this.def(iid).name}.`);
  }
  detachEquip(u) {
    if (!u || !u.eq) return;
    const eq = u.eq;
    u.eq = null;
    this.dirty();
    u.bp = Math.min(u.bp, this.maxBp(u));
    u.mp = Math.min(u.mp, this.maxMp(u));
    this.toDiscard(eq);
    this.emit({ t: 'detach', unit: u.iid, cardId: this.s.inst[eq].cardId });
    this.trigger('equipDiscarded', { unit: u.iid, card: eq, owner: u.owner });
  }
  bounce(u) {
    if (!u) return;
    delete this.s.units[u.iid];
    if (this.s.activeUnit === u.iid) this.s.activeUnit = null;
    this.dirty();
    if (u.eq) this.toDiscard(u.eq);
    if (u.cons) this.toDiscard(u.cons);
    const d = this.def(u.cardId);
    this.emit({ t: 'bounce', target: u.iid, cardId: u.cardId, x: u.x, y: u.y });
    if (!d.token) this.returnToHand(u.iid);
    this.log(`${d.name} returns to ${this.P(u.owner).name}'s hand.`);
  }

  // =========================================================================
  // Response sequence (Phase 1 §14) — every player may respond, newest resolves first
  // =========================================================================
  openChain(item) {
    const s = this.s;
    s.chain.push(item);
    s.passes = 0;
    s.priority = this.nextPlayer(item.p);
    this.emit({ t: 'chain', items: s.chain.map((c) => ({ ...c })), priority: s.priority });
    this.advancePriority();
  }
  // Skip players who have nothing to respond with; resolve once everyone has passed in a row.
  advancePriority() {
    const s = this.s;
    const count = this.alivePlayers().length;
    let guard = 0;
    while (s.chain.length && s.passes < count && guard++ < 16) {
      // the player who added the newest item already had their chance to act
      const mine = s.chain[s.chain.length - 1].p === s.priority;
      if (!mine && this.hasResponse(s.priority)) {
        this.emit({ t: 'priority', p: s.priority });
        return;
      }
      s.passes++;
      s.priority = this.nextPlayer(s.priority);
    }
    this.resolveChain();
  }
  doPass(p) {
    const s = this.s;
    if (!s.chain.length) return this.fail('Nothing to pass on.');
    s.passes++;
    s.priority = this.nextPlayer(p);
    this.advancePriority();
    return this.ok();
  }
  resolveChain() {
    const s = this.s;
    s.priority = null;
    s.passes = 0;
    while (s.chain.length && s.winner === null) {
      const item = s.chain.pop();
      if (item.kind === 'attack') this.resolveAttack(item);
      else if (item.kind === 'card') this.resolveCard(item);
      else if (item.kind === 'consume') this.resolveConsume(item);
    }
    s.chain = [];
    this.emit({ t: 'chainEnd' });
  }
  resolveConsume(item) {
    const d = this.def(item.card);
    const u = this.unit(item.unit);
    if (item.negated || !u) {
      this.emit({ t: 'fizzle', text: `${d.name} fizzles.`, cardId: item.cardId });
      this.toDiscard(item.card);
      return;
    }
    const ctx = { p: item.p, unit: item.unit, targets: item.targets, card: item.card };
    if (!this.checkTargets(d.use.targets, item.targets, ctx)) {
      this.emit({ t: 'fizzle', text: `${d.name} fizzles — its target is gone.`, cardId: item.cardId });
      this.toDiscard(item.card);
      return;
    }
    this.emit({ t: 'resolve', cardId: item.cardId, p: item.p, targets: item.targets, consumable: true });
    d.use.resolve(this, ctx);
    this.toDiscard(item.card);
    if (this.s.units[item.unit]) this.trigger('consumableUsed', { unit: item.unit, card: item.card, restores: !!d.restores });
  }
  resolveCard(item) {
    const d = this.def(item.iid);
    if (item.negated) {
      this.emit({ t: 'fizzle', text: `${d.name} was negated!`, cardId: item.cardId });
      this.toDiscard(item.iid);
      return;
    }
    const ctx = { p: item.p, card: item.iid, targets: item.targets, chainItem: item };
    const specs = (d.play && d.play.targets) || [];
    if (!this.checkTargets(specs, item.targets, ctx)) {
      this.emit({ t: 'fizzle', text: `${d.name} fizzles — its target is gone.`, cardId: item.cardId });
      this.log(`${d.name} fizzles.`);
      this.toDiscard(item.iid);
      return;
    }
    this.emit({ t: 'resolve', cardId: item.cardId, p: item.p, targets: item.targets });
    d.play.resolve(this, ctx);
    this.toDiscard(item.iid);
    this.trigger('cardResolved', { p: item.p, card: item.iid, type: d.type });
  }
  resolveAttack(item) {
    const u = this.unit(item.unit);
    const tgt = this.entity(item.target);
    if (item.negated) {
      this.emit({ t: 'fizzle', text: 'The attack was negated!' });
      if (u && item.reflect) this.dealDamage(u.iid, this.stat(u, 'sp'), { kind: 'effect', p: item.reflectBy });
      return;
    }
    if (!u || !tgt) { this.emit({ t: 'fizzle', text: 'The attack fizzles.' }); return; }
    const dist = cheb(u, tgt);
    if (dist > this.stat(u, 'rp')) {
      this.emit({ t: 'fizzle', text: `${this.def(tgt.cardId).name} dodged out of range!`, target: tgt.iid });
      this.log('The attack misses — target out of range.');
      return;
    }
    const isStruct = !!this.struct(tgt.iid);
    const ranged = dist >= 2;
    this.trigger('beforeAttack', { unit: u.iid, target: tgt.iid, ranged, dist, isStruct });
    if (!this.s.units[u.iid] || !this.entity(tgt.iid)) return;
    const sp = this.attackDamage(u, tgt, { dist, ranged, isStruct, consume: true }) - (item.mods.reduce || 0);
    if (!isStruct) {
      tgt.attackedBy = (tgt.attackedBy || []).filter((h) => h.s === this.s.turnSerial);
      tgt.attackedBy.push({ u: u.iid, s: this.s.turnSerial, o: u.owner });
    }
    this.emit({ t: 'attack', unit: u.iid, target: tgt.iid, ranged, amount: Math.max(0, sp) });
    const splash = u._splash || 0;
    u._splash = 0;
    this.dealDamage(tgt.iid, Math.max(0, sp), { kind: 'attack', unit: u.iid, p: u.owner, ranged });
    if (splash && !isStruct) {
      for (const e of this.allUnits()) if (this.foe(e.owner, u.owner) && e.iid !== tgt.iid && cheb(e, tgt) === 1) this.dealDamage(e.iid, splash, { kind: 'effect', unit: u.iid, p: u.owner });
    }
    this.trigger('afterAttack', { unit: u.iid, target: tgt.iid, ranged, dist, isStruct, killed: !this.entity(tgt.iid) });
    // Retaliation (Phase 1 §13.4): the defender may strike back if the attacker is in its Range
    // and it can pay the attack's MP cost.
    const def = this.unit(tgt.iid);
    const att = this.unit(u.iid);
    if (def && att && !isStruct && cheb(def, att) <= this.stat(def, 'rp') && this.P(def.owner).autoRetaliate && !this.hasStatus(def, 'stasis') && !this.hasStatus(def, 'noAttack')) {
      const cost = this.retaliationCost(def);
      if (def.mp >= cost) {
        def.mp -= cost;
        const d2 = cheb(def, att);
        const dmg = this.attackDamage(def, att, { dist: d2, ranged: d2 >= 2, isStruct: false, retaliation: true });
        this.emit({ t: 'retaliate', unit: def.iid, target: att.iid, amount: dmg, cost, mp: def.mp });
        this.trigger('retaliating', { unit: def.iid, target: att.iid });
        this.dealDamage(att.iid, dmg, { kind: 'retaliation', unit: def.iid, p: def.owner, ranged: d2 >= 2 });
      }
    }
  }
  // Damage an attack by u would deal to tgt (used by previews too).
  attackDamage(u, tgt, { dist, ranged, isStruct, consume = false, retaliation = false }) {
    const ctx = { attack: true, target: tgt.iid, dist, ranged, isStruct, retaliation };
    let sp = this.stat(u, 'sp', ctx) + this.hookSum('attackBonus', u, tgt, ctx);
    let mult = 1;
    let splash = 0;
    if (!retaliation) {
      for (const st of u.statuses) {
        if (st.kind === 'nextAttack') {
          sp += st.v || 0;
          if (st.mult) mult = Math.max(mult, st.mult);
          if (st.splash) splash += st.splash;
          if (isStruct && st.vsStruct) sp += st.vsStruct;
        }
      }
      if (consume) { u.statuses = u.statuses.filter((st) => st.kind !== 'nextAttack'); u._splash = splash; }
    }
    if (!isStruct && tgt.statuses) for (const st of tgt.statuses) if (st.kind === 'marked') sp += st.v;
    return Math.max(0, sp * mult);
  }
}

export function statusLabel(st) {
  if (st.label) return st.label;
  if (st.stat) return `${st.v > 0 ? '+' : ''}${st.v} ${st.stat.toUpperCase()}`;
  return st.kind;
}

// ---------------------------------------------------------------------------
// Views (hide private information) and helpers
// ---------------------------------------------------------------------------
export function viewFor(state, p) {
  const v = JSON.parse(JSON.stringify({ ...state, undo: null }));
  v.canUndo = !!state.undo && state.active === p;
  v.you = p;
  const hidden = new Set();
  state.players.forEach((P, q) => {
    for (const iid of P.deck) hidden.add(iid);
    if (q !== p) for (const iid of P.hand) hidden.add(iid);
  });
  v.players.forEach((P, q) => {
    P.deckCount = P.deck.length;
    P.deck = [];
    P.handCount = P.hand.length;
    if (q !== p) P.hand = P.hand.map(() => null);
  });
  for (const iid of hidden) delete v.inst[iid];
  return v;
}

export function redactEvents(events, p) {
  return events.map((e) => {
    if ((e.t === 'draw' || e.t === 'burn' || e.t === 'discard') && e.p !== p && e.t === 'draw') return { t: 'draw', p: e.p };
    if (e.t === 'chain') return { ...e, items: e.items.map((c) => ({ ...c })) };
    return e;
  });
}

export { key as tileKey, DIRS };
