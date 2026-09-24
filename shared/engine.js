// Knotwood rules engine.
// The whole match lives in a plain JSON-serialisable state object so it can be
// cloned for AI search, sent over the network, and replayed deterministically.

import * as C from './constants.js';
import { nextRandom } from './rng.js';
import { getCard, sharedAbilityFor } from './cards.js';

const UNDO_SAFE = new Set(['move', 'activate', 'deactivate', 'status', 'freeStep', 'log', 'sap', 'mp', 'heal']);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const key = (x, y) => x + ',' + y;
const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function other(p) { return 1 - p; }
export function laneOfX(x) { return Math.floor(x / C.LANE_WIDTH); }
export function homeRow(p) { return p === 0 ? 0 : C.ROWS - 1; }
export function structRow(p) { return p === 0 ? -1 : C.ROWS; }
export function forwardDir(p) { return p === 0 ? 1 : -1; }
export function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

// ---------------------------------------------------------------------------
// Match creation
// ---------------------------------------------------------------------------
export function createMatch({ seed, players, first = 0 }) {
  const s = {
    v: 1,
    seed,
    rng: seed | 0,
    turnSerial: 0,
    round: 0,
    active: first,
    first,
    phase: 'mulligan',
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
    activeUnit: null,
    winner: null,
    winReason: null,
    log: [],
    undo: null,
    stats: [newStats(), newStats()],
  };
  for (let l = 0; l < C.LANES; l++) s.lanes.push({ zone: null, ctrl: null, structure: null });
  const g = new Game(s);
  players.forEach((pl, p) => {
    const P = {
      name: pl.name || 'Player ' + (p + 1),
      deck: [], hand: [], discard: [],
      sap: 0, sapMax: 0, renown: 0, turns: 0,
      mulligan: false, autoRetaliate: true, bot: !!pl.bot,
      avatar: pl.avatar || null,
    };
    s.players.push(P);
    for (const cardId of pl.deck) {
      const iid = g.newInst(cardId, p);
      P.deck.push(iid);
    }
    g.shuffle(P.deck);
  });
  // Starting foothold: a Homeland Zone and a Base Camp in each player's home Lane
  C.HOME_LANES.forEach((l, p) => {
    const z = g.newInst('TK-homeland', p);
    s.lanes[l].zone = z;
    s.lanes[l].ctrl = p;
    const b = g.newInst('TK-basecamp', p);
    const d = getCard('TK-basecamp');
    s.structs[b] = { iid: b, cardId: 'TK-basecamp', owner: p, lane: l, bp: d.bp, bonusBp: 0, flags: {}, builtSerial: 0 };
    s.lanes[l].structure = b;
  });
  for (let p = 0; p < 2; p++) g.openingHand(p);
  g.log(`The duel begins! ${s.players[first].name} goes first.`);
  return s;
}

function newStats() {
  return { damage: 0, kills: 0, structures: 0, captures: 0, summoned: 0, cards: 0 };
}

// ---------------------------------------------------------------------------
// Game wrapper
// ---------------------------------------------------------------------------
export class Game {
  constructor(state) {
    this.s = state;
    this.events = [];
    this._src = null;
    this.sideEffect = false;
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
  unit(iid) { return this.s.units[iid] || null; }
  struct(iid) { return this.s.structs[iid] || null; }
  entity(iid) { return this.s.units[iid] || this.s.structs[iid] || null; }
  allUnits() { return Object.values(this.s.units); }
  unitsOf(p) { return this.allUnits().filter((u) => u.owner === p); }
  structsOf(p) { return Object.values(this.s.structs).filter((st) => st.owner === p); }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < C.COLS && y < C.ROWS; }
  unitAt(x, y) {
    for (const u of Object.values(this.s.units)) if (u.x === x && u.y === y) return u;
    return null;
  }
  obstacleAt(x, y) { return this.s.obstacles.some((o) => o.x === x && o.y === y); }
  isEmpty(x, y) { return this.inBounds(x, y) && !this.unitAt(x, y) && !this.obstacleAt(x, y); }
  laneOf(u) { return laneOfX(u.x); }
  laneCtrl(l) { return this.s.lanes[l] ? this.s.lanes[l].ctrl : null; }
  structInLane(l) { const id = this.s.lanes[l].structure; return id ? this.s.structs[id] : null; }
  unitsInLane(l, p) { return this.allUnits().filter((u) => laneOfX(u.x) === l && (p === undefined || u.owner === p)); }
  isDefending(u) { return this.laneCtrl(laneOfX(u.x)) === u.owner; }
  isInvading(u) { const c = this.laneCtrl(laneOfX(u.x)); return c !== null && c !== u.owner; }
  // Is a position inside player p's half of the battlefield?
  inTerritory(pos, p) { return p === 0 ? pos.y < C.ROWS / 2 : pos.y >= C.ROWS / 2; }
  // Identities of player p pushing into the enemy half of Lane l
  raiders(l, p) { return this.unitsInLane(l, p).filter((u) => this.inTerritory(u, other(p))); }
  isContested(l) { const us = this.unitsInLane(l); return us.some((u) => u.owner === 0) && us.some((u) => u.owner === 1); }
  structCells(st) {
    const y = structRow(st.owner);
    return [{ x: st.lane * C.LANE_WIDTH, y }, { x: st.lane * C.LANE_WIDTH + 1, y }];
  }
  // Distance between two entities or positions (units are tiles, structures are 2 virtual cells)
  dist(a, b) {
    const ca = a && a.lane !== undefined && a.x === undefined ? this.structCells(a) : [a];
    const cb = b && b.lane !== undefined && b.x === undefined ? this.structCells(b) : [b];
    let best = Infinity;
    for (const p of ca) for (const q of cb) best = Math.min(best, cheb(p, q));
    return best;
  }
  adjacentUnits(pos, side, p) {
    return this.allUnits().filter((u) => cheb(u, pos) === 1 && (side === undefined || (side === 'friendly' ? u.owner === p : u.owner !== p)));
  }
  friendlyAdjacent(u) { return this.allUnits().filter((o) => o.iid !== u.iid && o.owner === u.owner && cheb(o, u) === 1); }
  enemiesAdjacent(u) { return this.allUnits().filter((o) => o.owner !== u.owner && cheb(o, u) === 1); }
  nearFriendlyStruct(u, n = 2) { return this.structsOf(u.owner).some((st) => this.dist(u, st) <= n); }
  faction(u) { return this.def(u.cardId).faction; }
  sameFaction(a, b) { return this.faction(a) === this.faction(b); }
  laneMonopoly(u) {
    const friends = this.unitsInLane(laneOfX(u.x), u.owner);
    return friends.every((f) => this.sameFaction(f, u));
  }
  opp(p) { return 1 - p; }

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
    const opts = P.hand
      .filter((iid) => this.def(iid).type === 'Consumable')
      .map((iid) => ({ iid, c: this.cardCost(u.owner, iid, { target: u.iid }) }))
      .filter((o) => o.c <= P.sap)
      .sort((a, b) => a.c - b.c);
    if (!opts.length) return false;
    const { iid, c } = opts[0];
    P.sap -= c;
    P.hand.splice(P.hand.indexOf(iid), 1);
    this.emit({ t: 'sap', p: u.owner, sap: P.sap, sapMax: P.sapMax, delta: -c });
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
    if (this.s.log.length > 80) this.s.log.shift();
    this.emit({ t: 'log', text });
  }
  dirty() { this._src = null; }

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
    this.s.lanes.forEach((ln, l) => {
      if (ln.zone) {
        const d = this.def(ln.zone);
        if (d.hooks) list.push({ h: d.hooks, src: { kind: 'zone', lane: l, owner: ln.ctrl, name: d.name } });
      }
    });
    for (const m of this.s.mods) {
      const d = getCard(m.cardId);
      const h = d && (d.modHooks || (d.mods && d.mods[m.variant]));
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
    // snapshot the list: triggers can change the board
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
    if (k === 'rp') return Math.max(1, v);
    if (k === 'bp') return Math.max(1, v);
    return Math.max(0, v);
  }
  maxBp(u) { return this.stat(u, 'bp'); }
  maxMp(u) { return this.stat(u, 'mp'); }
  statsOf(u) {
    return { bp: u.bp, maxBp: this.maxBp(u), sp: this.stat(u, 'sp'), mp: u.mp, maxMp: this.maxMp(u), ap: this.apAvail(u), rp: this.stat(u, 'rp') };
  }
  apAvail(u) {
    if (this.hasStatus(u, 'stasis')) return 0;
    if (u.state === 'done') return 0;
    const base = u.state === 'active' ? u.apBase : this.stat(u, 'ap', { activation: true }) + (u.apNext || 0);
    return Math.max(0, base + u.apBonus - u.apSpent);
  }
  moveBudget(u) { return this.apAvail(u) + (this.hasStatus(u, 'stasis') ? 0 : u.freeSteps); }
  hasStatus(u, kind) { return u.statuses.some((s) => s.kind === kind); }
  structHousing(st) {
    return Math.max(0, this.def(st.cardId).housing + this.hookSum('housing', st));
  }
  housedCount(st) { return this.allUnits().filter((u) => u.via === st.iid).length; }
  structMaxBp(st) { return this.def(st.cardId).bp + (st.bonusBp || 0) + this.hookSum('structBp', st); }

  // ---- statuses --------------------------------------------------------------
  addStatus(u, status) {
    const st = { cs: this.s.turnSerial, ...status };
    u.statuses.push(st);
    this.sideEffect = true;
    this.emit({ t: 'status', target: u.iid, text: status.label || statusLabel(status), good: status.good !== undefined ? status.good : (status.v || 0) > 0 });
    return st;
  }
  removeStatuses(u, pred) { u.statuses = u.statuses.filter((s) => !pred(s)); }
  cleanse(u) {
    const before = u.statuses.length;
    u.statuses = u.statuses.filter((s) => !(s.v < 0 || s.kind === 'stasis' || s.kind === 'healReduce'));
    if (u.statuses.length !== before) this.emit({ t: 'status', target: u.iid, text: 'Cleansed', good: true });
  }
  addMod(cardId, owner, exp, data, variant) {
    const m = { id: 'm' + this.s.nextId++, cardId, owner, exp: { cs: this.s.turnSerial, ...exp }, data: data || {}, variant };
    this.s.mods.push(m);
    this.dirty();
    return m;
  }
  // Status expiry. at: 'eot' (end of this turn), 'sot' (start of player p's next turn),
  // 'act' (end of the unit's next activation, or the end of its controller's next turn),
  // 'thisAct' (end of the current activation).
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
    for (const u of Object.values(this.s.units)) {
      u.statuses = u.statuses.filter((st) => !test(st, u.owner));
    }
    const beforeMods = this.s.mods.length;
    this.s.mods = this.s.mods.filter((m) => !test(m.exp, m.owner));
    if (beforeMods !== this.s.mods.length) this.dirty();
  }

  // ---- resources -----------------------------------------------------------
  gainSap(p, n) {
    const P = this.P(p);
    P.sap = Math.max(0, P.sap + n);
    this.sideEffect = true;
    this.emit({ t: 'sap', p, sap: P.sap, sapMax: P.sapMax, delta: n });
  }
  gainRenown(p, n, reason) {
    if (n <= 0 || this.s.winner !== null) return;
    const P = this.P(p);
    P.renown += n;
    this.emit({ t: 'renown', p, amount: n, total: P.renown, reason });
    if (P.renown >= C.WIN_RENOWN) this.win(p, 'Renown');
  }
  draw(p, n = 1) {
    const P = this.P(p);
    for (let i = 0; i < n; i++) {
      if (!P.deck.length) {
        // Exhausted deck: lose Renown instead of drawing
        P.renown = Math.max(0, P.renown - 2);
        this.emit({ t: 'renown', p, amount: -2, total: P.renown, reason: 'Deck exhausted' });
        this.log(`${P.name}'s deck is empty! They lose 2 Renown.`);
        continue;
      }
      const iid = P.deck.pop();
      if (P.hand.length >= C.HAND_LIMIT) {
        P.discard.push(iid);
        this.emit({ t: 'burn', p, iid, cardId: this.s.inst[iid].cardId });
        continue;
      }
      P.hand.push(iid);
      this.sideEffect = true;
      this.emit({ t: 'draw', p, iid, cardId: this.s.inst[iid].cardId });
    }
  }
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
    if (P.hand.length >= C.HAND_LIMIT) P.discard.push(iid);
    else P.hand.push(iid);
  }

  openingHand(p) {
    const P = this.P(p);
    // Opening-hand guarantee: at least one Zone and one Structure if the deck has them.
    for (const type of ['Zone', 'Structure']) {
      const idx = P.deck.findIndex((iid) => this.def(iid).type === type);
      if (idx >= 0) {
        const [iid] = P.deck.splice(idx, 1);
        P.hand.push(iid);
      }
    }
    while (P.hand.length < C.START_HAND && P.deck.length) P.hand.push(P.deck.pop());
    this.shuffle(P.deck);
  }

  // ---- win conditions ------------------------------------------------------
  win(p, reason) {
    if (this.s.winner !== null) return;
    this.s.winner = p;
    this.s.winReason = reason;
    this.s.phase = 'over';
    this.s.chain = [];
    this.s.priority = null;
    this.emit({ t: 'win', p, reason });
    this.log(`${this.P(p).name} wins by ${reason}!`);
  }

  // =========================================================================
  // Turn flow
  // =========================================================================
  startTurn(p) {
    const s = this.s;
    s.turnSerial++;
    s.active = p;
    s.activeUnit = null;
    const P = this.P(p);
    P.turns++;
    if (p === s.first) s.round++;
    this.expireStatuses('sot', { p });
    let sapMax = Math.min(C.SAP_CAP, C.SAP_START + P.turns - 1);
    if (p !== s.first && P.turns === 1) sapMax += C.SECOND_PLAYER_BONUS_SAP;
    P.sapMax = sapMax;
    P.sap = sapMax;
    this.emit({ t: 'turn', p, serial: s.turnSerial, round: s.round });
    this.emit({ t: 'sap', p, sap: P.sap, sapMax: P.sapMax, delta: 0 });
    // Renown for controlled Lanes
    let lanes = 0;
    let built = 0;
    s.lanes.forEach((ln, l) => {
      if (ln.ctrl === p) {
        lanes++;
        const st = this.structInLane(l);
        if (st && st.owner === p) built++;
      }
    });
    if (lanes === C.LANES) { this.win(p, 'Dominion'); return; }
    const gain = lanes * C.RENOWN_PER_LANE + built * C.RENOWN_PER_BUILT_LANE;
    if (gain) this.gainRenown(p, gain, `${lanes} Lane${lanes === 1 ? '' : 's'} held`);
    if (s.winner !== null) return;
    // Refresh Identities
    for (const u of this.unitsOf(p)) {
      u.state = 'ready';
      u.apSpent = 0;
      u.apBonus = 0;
      u.apBase = 0;
      u.attacks = 0;
      u.extraAttacks = 0;
      u.firstStepUsed = false;
      const mx = this.maxMp(u);
      if (u.mp < mx) u.mp = Math.min(mx, u.mp + C.MP_REGEN);
    }
    this.trigger('turnStart', { p });
    if (s.winner !== null) return;
    if (!(p === s.first && P.turns === 1)) this.draw(p, 1);
    this.log(`— ${P.name}'s turn (Round ${s.round}) —`);
  }

  endTurn(p) {
    const s = this.s;
    if (s.activeUnit) this.endActivation(this.unit(s.activeUnit));
    this.trigger('turnEnd', { p });
    if (s.winner !== null) return;
    // Liberation: undefended enemy Lanes occupied by your Identities fall.
    s.lanes.forEach((ln, l) => {
      if (ln.ctrl === other(p) && !this.structInLane(l)) {
        const mine = this.raiders(l, p).length;
        const theirs = this.unitsInLane(l, other(p)).length;
        if (mine > 0 && theirs === 0) {
          const old = ln.zone;
          ln.zone = null;
          ln.ctrl = null;
          this.toDiscard(old);
          this.dirty();
          this.s.stats[p].captures++;
          this.emit({ t: 'liberate', lane: l, p });
          this.log(`${this.P(p).name} liberates Lane ${l + 1}!`);
          this.gainRenown(p, C.RENOWN_LIBERATE, 'Lane liberated');
        }
      }
    });
    if (s.winner !== null) return;
    this.expireStatuses('eot', { p });
    for (const u of this.unitsOf(p)) {
      u.freeSteps = 0;
      u.apBonus = 0;
      if (u.state !== 'done') u.lastActMoved = false;
      u.state = 'done';
    }
    // obstacles decay
    s.obstacles = s.obstacles.filter((o) => o.until > s.turnSerial);
    s.undo = null;
    if (s.round >= C.ROUND_LIMIT && p !== s.first) {
      const [a, b] = [this.P(0).renown, this.P(1).renown];
      if (a !== b) this.win(a > b ? 0 : 1, 'Time (Renown lead)');
      else {
        const hp = (q) => this.structsOf(q).reduce((n, st) => n + st.bp, 0) + this.unitsOf(q).length;
        this.win(hp(0) >= hp(1) ? 0 : 1, 'Time (board presence)');
      }
      return;
    }
    this.startTurn(other(p));
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
    u.actStamp = this.s.turnSerial;
    u.apSpent = 0;
    u.firstStepUsed = false;
    u.act = { moved: 0, mpSpent: 0, attacked: false, ability: false, usedItem: false, touchedEnemy: false, reachedZeroMp: false, movedBeforeAttack: 0 };
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
    // "until the end of its next activation" statuses created before this activation began
    const before = u.statuses.length;
    u.statuses = u.statuses.filter((st) => !(st.at === 'act' && st.cs < u.actStamp) && !(st.at === 'thisAct'));
    if (u.statuses.length !== before) this.dirty();
    u.targetedSince = false;
    this.emit({ t: 'deactivate', unit: u.iid });
  }

  // =========================================================================
  // Damage, healing, defeat
  // =========================================================================
  dealDamage(targetId, amount, o = {}) {
    const s = this.s;
    const u = this.unit(targetId);
    const st = u ? null : this.struct(targetId);
    if (!u && !st) return 0;
    this.sideEffect = true;
    const dmg = { amount: Math.max(0, amount), kind: o.kind || 'effect', ranged: !!o.ranged, srcUnit: o.unit || null, p: o.p, target: targetId, isStruct: !!st, attack: o.kind === 'attack' };
    if (dmg.amount > 0) {
      for (const { h, src } of this.sources()) if (h.incoming) h.incoming(this, src, dmg);
    }
    if (u && dmg.amount > 0) {
      for (const g of u.statuses) if (g.kind === 'guard') dmg.amount -= g.v;
    }
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
    if (amt > 0 && o.p !== undefined && o.p !== ent.owner) s.stats[o.p].damage += amt;
    this.emit({ t: 'damage', target: targetId, amount: amt, blocked, bp: Math.max(0, ent.bp), kind: dmg.kind, struct: !!st });
    if (u && amt > 0) {
      u.hitBy = (u.hitBy || []).filter((h) => h.s === s.turnSerial);
      if (attackerUnit) u.hitBy.push({ u: attackerUnit.iid, s: s.turnSerial, f: this.faction(attackerUnit), o: attackerUnit.owner });
      u.lastHurt = s.turnSerial;
      if (attackerUnit) {
        attackerUnit.dealtTo = (attackerUnit.dealtTo || []).filter((h) => h.s === s.turnSerial);
        attackerUnit.dealtTo.push({ u: u.iid, s: s.turnSerial });
      }
      if (u.statuses.some((x) => x.kind === 'healReduce')) {/* kept until next heal */}
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
    // Dying unit's own triggers
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
    if (o.p !== undefined && o.p !== u.owner) s.stats[o.p].kills++;
    this.emit({ t: 'defeat', target: u.iid, cardId: u.cardId, x: u.x, y: u.y, owner: u.owner });
    this.log(`${d.name} is defeated!`);
    this.trigger('defeated', { unit: u.iid, snapshot: u, killer: killer ? killer.iid : null, p: o.p, owner: u.owner, x: u.x, y: u.y, via: u.via });
    this.flushLater();
  }

  destroyStruct(st, o = {}) {
    const s = this.s;
    const d = this.def(st.cardId);
    delete s.structs[st.iid];
    s.lanes[st.lane].structure = null;
    this.dirty();
    this.toDiscard(st.iid);
    this.emit({ t: 'destroy', target: st.iid, lane: st.lane, owner: st.owner, cardId: st.cardId });
    this.log(`${d.name} crumbles!`);
    const by = o.p !== undefined ? o.p : other(st.owner);
    if (by !== st.owner) {
      s.stats[by].structures++;
      this.gainRenown(by, C.RENOWN_STRUCTURE_KILL, 'Structure destroyed');
    }
    this.trigger('structDestroyed', { struct: st.iid, lane: st.lane, owner: st.owner, by });
  }

  heal(u, amount, o = {}) {
    if (!u || amount <= 0) return 0;
    const heal = { amount, stat: 'bp', kind: o.kind || 'effect' };
    for (const { h, src } of this.sources()) if (h.healMod) h.healMod(this, src, u, heal);
    const red = u.statuses.find((s) => s.kind === 'healReduce');
    if (red) {
      heal.amount -= red.v;
      u.statuses = u.statuses.filter((s) => s !== red);
    }
    const mx = this.maxBp(u);
    const n = Math.max(0, Math.min(heal.amount, mx - u.bp));
    if (n <= 0) return 0;
    u.bp += n;
    this.sideEffect = true;
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
    this.sideEffect = true;
    this.emit({ t: 'mp', target: u.iid, amount: n, mp: u.mp });
    return n;
  }
  loseMp(u, amount) {
    if (!u) return 0;
    const n = Math.min(u.mp, amount);
    if (n <= 0) return 0;
    u.mp -= n;
    this.sideEffect = true;
    this.emit({ t: 'mp', target: u.iid, amount: -n, mp: u.mp });
    return n;
  }
  healStruct(st, amount) {
    if (!st) return 0;
    const n = Math.max(0, Math.min(amount, this.structMaxBp(st) - st.bp));
    if (!n) return 0;
    st.bp += n;
    this.sideEffect = true;
    this.emit({ t: 'heal', target: st.iid, amount: n, bp: st.bp, struct: true });
    return n;
  }
  grantFreeSteps(u, n = 1, why) {
    if (!u || n <= 0) return;
    u.freeSteps += n;
    this.sideEffect = true;
    this.emit({ t: 'freeStep', unit: u.iid, n, why });
  }
  addApBonus(u, n, why) {
    if (!u || !n) return;
    u.apBonus += n;
    this.sideEffect = true;
    this.emit({ t: 'status', target: u.iid, text: `${n > 0 ? '+' : ''}${n} AP${why ? ' · ' + why : ''}`, good: n > 0 });
  }
  giveBarrier(u, n) {
    if (!u) return;
    u.barrier += n;
    this.sideEffect = true;
    this.emit({ t: 'status', target: u.iid, text: `Barrier ${n}`, good: true });
  }
  refreshUnit(u) {
    if (!u) return;
    if (this.s.activeUnit === u.iid) this.endActivation(u);
    u.state = 'ready';
    u.apSpent = 0;
    u.attacks = 0;
    u.extraAttacks = 0;
    this.emit({ t: 'status', target: u.iid, text: 'Refreshed!', good: true });
  }
  tokenDef(tokenId) { return getCard(tokenId); }
  createToken(p, tokenId, tile, via = null) {
    if (!tile || !this.isEmpty(tile.x, tile.y)) return null;
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
      state: 'ready', attacks: 0, extraAttacks: 0,
      eq: null, cons: null, statuses: [], barrier: 0, freeSteps: 0,
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
  emptyTilesNearStruct(st, n = 1) {
    const out = [];
    for (let x = 0; x < C.COLS; x++) for (let y = 0; y < C.ROWS; y++) {
      if (this.isEmpty(x, y) && this.dist({ x, y }, st) <= n) out.push({ x, y });
    }
    return out;
  }

  // =========================================================================
  // Movement
  // =========================================================================
  canPassThrough(u, x, y) {
    return !!this.hookAny('passThrough', u, { x, y });
  }
  stepCost(u, from, to, stepIndex) {
    let c = 1;
    if (stepIndex === 0 && !u.firstStepUsed && this.hookAny('firstStepFree', u)) c = 0;
    c += this.hookSum('moveCost', u, from, to);
    return Math.max(0, c);
  }
  // Dijkstra over tiles. Returns Map "x,y" -> {cost, path:[{x,y}...]} for legal end tiles.
  reachable(u, budget = this.moveBudget(u)) {
    const res = new Map();
    if (budget <= 0 && !(!u.firstStepUsed && this.hookAny('firstStepFree', u))) return res;
    if (this.hasStatus(u, 'stasis')) return res;
    const start = { x: u.x, y: u.y };
    const best = new Map([[key(u.x, u.y), 0]]);
    const queue = [{ x: u.x, y: u.y, cost: 0, path: [], steps: 0 }];
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const cur = queue.shift();
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.inBounds(nx, ny) || this.obstacleAt(nx, ny)) continue;
        const occ = this.unitAt(nx, ny);
        if (occ && occ.iid !== u.iid && !this.canPassThrough(u, nx, ny)) continue;
        const c = cur.cost + this.stepCost(u, { x: cur.x, y: cur.y }, { x: nx, y: ny }, cur.steps);
        if (c > budget) continue;
        const k = key(nx, ny);
        if (best.has(k) && best.get(k) <= c) continue;
        best.set(k, c);
        const path = [...cur.path, { x: nx, y: ny }];
        queue.push({ x: nx, y: ny, cost: c, path, steps: cur.steps + 1 });
        if (!occ && !(nx === start.x && ny === start.y)) res.set(k, { cost: c, path });
      }
    }
    return res;
  }

  // Voluntary movement along a path (already validated). Handles step triggers.
  walk(u, path, cost) {
    const from = { x: u.x, y: u.y };
    let spentAp = Math.min(cost, this.apAvail(u));
    u.apSpent += spentAp;
    u.freeSteps -= Math.max(0, cost - spentAp);
    if (path.length) u.firstStepUsed = true;
    const done = [{ x: u.x, y: u.y }];
    u.moveStopped = false;
    for (const step of path) {
      const prevLane = laneOfX(u.x);
      const prev = { x: u.x, y: u.y };
      u.x = step.x;
      u.y = step.y;
      done.push({ x: u.x, y: u.y });
      if (u.act) {
        u.act.moved++;
        if (this.enemiesAdjacent(u).length) u.act.touchedEnemy = true;
      }
      this.dirty();
      if (laneOfX(u.x) !== prevLane) this.trigger('enterLane', { unit: u.iid, lane: laneOfX(u.x), from: prevLane });
      this.trigger('step', { unit: u.iid, from: prev, to: { x: u.x, y: u.y } });
      if (!this.s.units[u.iid] || u.moveStopped || this.s.winner !== null) break;
    }
    this.emit({ t: 'move', unit: u.iid, path: done });
    if (this.s.units[u.iid]) {
      this.trigger('moved', { unit: u.iid, from, to: { x: u.x, y: u.y }, steps: done.length - 1, forced: false });
    }
  }

  // Forced movement (push / pull). dir = {dx, dy}. Returns tiles moved.
  forceMove(u, dir, n, byP, o = {}) {
    if (!u || n <= 0) return 0;
    const byEnemy = byP !== u.owner;
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
      path.push({ x: nx, y: ny });
      moved++;
    }
    this.dirty();
    this.sideEffect = true;
    if (moved) this.emit({ t: 'move', unit: u.iid, path, forced: true });
    if (collided) {
      const extra = this.hookSum('collisionBonus', u, byP);
      this.emit({ t: 'bump', unit: u.iid, dx: dir.dx, dy: dir.dy });
      this.dealDamage(u.iid, C.COLLISION_DAMAGE + extra, { kind: 'collision', p: byP, unit: o.srcUnit || null });
    }
    if (this.s.units[u.iid]) {
      this.trigger('forcedMove', { unit: u.iid, by: byP, moved, srcUnit: o.srcUnit || null });
    }
    return moved;
  }
  push(u, fromPos, n, byP, o = {}) {
    return this.forceMove(u, { dx: sign(u.x - fromPos.x), dy: sign(u.y - fromPos.y) || (fromPos.x === u.x ? forwardDir(byP) : 0) }, n, byP, o);
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
    this.sideEffect = true;
    this.emit({ t: 'teleport', unit: u.iid, from, to: { ...tile } });
    this.trigger('moved', { unit: u.iid, from, to: { ...tile }, steps: 0, teleport: true, forced: !!o.forced });
    return true;
  }
  swap(a, b) {
    const pa = { x: a.x, y: a.y };
    a.x = b.x; a.y = b.y;
    b.x = pa.x; b.y = pa.y;
    this.dirty();
    this.sideEffect = true;
    this.emit({ t: 'teleport', unit: a.iid, from: { x: b.x, y: b.y }, to: { x: a.x, y: a.y } });
    this.emit({ t: 'teleport', unit: b.iid, from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } });
  }
  // Move one tile toward target if possible (used by auto-steps)
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
  // Costs
  // =========================================================================
  cardCost(p, iid, ctx = {}) {
    const d = this.def(iid);
    let c = d.cost + this.hookSum('cardCost', p, d, ctx);
    if (d.type === 'Identity') c = Math.max(1, c);
    return Math.max(0, c);
  }
  abilityCost(u, ab) {
    if (u.statuses.some((s) => s.kind === 'abilitiesFree')) return 0;
    if (u.statuses.some((s) => s.kind === 'freeAbility')) return 0;
    const c = ab.cost + this.hookSum('abilityCost', u, ab);
    return Math.max(ab.cost > 0 ? (ab.minCost ?? 0) : 0, c);
  }
  abilityRange(u) { return this.stat(u, 'rp') + this.hookSum('abilityRange', u); }
  retaliationCost(u) { return Math.max(0, C.RETALIATION_COST + this.hookSum('retaliationCost', u)); }

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
      return this.dist(src, pos) <= r;
    };
    const sideOk = (owner) => spec.side === 'any' || !spec.side || (spec.side === 'friendly' ? owner === p : owner !== p);
    const out = [];
    const fromCard = ctx.card && ['Action', 'Event'].includes(this.def(ctx.card).type);
    if (spec.type === 'unit' || spec.type === 'unitOrStruct') {
      for (const u of this.allUnits()) {
        if (!sideOk(u.owner) || !within(u)) continue;
        if (spec.notSelf && src && u.iid === src.iid) continue;
        if (spec.near && !this.unitsOf(spec.near.side === 'enemy' ? other(p) : p).some((f) => f.iid !== u.iid && cheb(f, u) <= spec.near.n)) continue;
        if (fromCard && u.owner !== p && this.hookAny('untargetable', u, p)) continue;
        if (spec.filter && !spec.filter(this, u, ctx)) continue;
        out.push(u.iid);
      }
    }
    if (spec.type === 'struct' || spec.type === 'unitOrStruct') {
      for (const st of Object.values(this.s.structs)) {
        if (!sideOk(st.owner) || !within(st)) continue;
        if (spec.near && !this.unitsOf(p).some((f) => this.dist(f, st) <= spec.near.n)) continue;
        if (spec.filter && !spec.filter(this, st, ctx)) continue;
        out.push(st.iid);
      }
    }
    if (spec.type === 'tile') {
      for (let x = 0; x < C.COLS; x++) for (let y = 0; y < C.ROWS; y++) {
        const t = { x, y };
        if (!spec.occupied && !this.isEmpty(x, y)) continue;
        if (!within(t)) continue;
        if (spec.filter && !spec.filter(this, t, ctx)) continue;
        out.push(t);
      }
    }
    if (spec.type === 'lane') {
      for (let l = 0; l < C.LANES; l++) if (!spec.filter || spec.filter(this, l, ctx)) out.push(l);
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
  // Enumerate every full target list for a list of specs (used by AI and "has any target" checks)
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
    if (s.phase !== 'play' || s.winner !== null) return false;
    if (s.chain.length) return s.priority === p;
    return s.active === p;
  }
  // Legal Zone lanes for player p
  zoneLanes(p) {
    const out = [];
    this.s.lanes.forEach((ln, l) => {
      if (ln.ctrl === null) out.push(l);
      else if (ln.ctrl === p) { if (!this.structInLane(l)) out.push(l); }
      else if (!this.structInLane(l) && this.raiders(l, p).length) out.push(l);
    });
    return out;
  }
  structLanes(p) {
    const out = [];
    this.s.lanes.forEach((ln, l) => { if (ln.ctrl === p && !this.structInLane(l)) out.push(l); });
    return out;
  }
  summonTiles(p) {
    const out = [];
    for (const st of this.structsOf(p)) {
      if (this.housedCount(st) >= this.structHousing(st)) continue;
      const r = 1 + this.hookSum('summonRange', st);
      for (const t of this.emptyTilesNearStruct(st, r)) if (!out.some((o) => o.x === t.x && o.y === t.y)) out.push({ ...t, struct: st.iid });
    }
    return out;
  }
  structForSummon(p, tile) {
    for (const st of this.structsOf(p)) {
      if (this.housedCount(st) >= this.structHousing(st)) continue;
      const r = 1 + this.hookSum('summonRange', st);
      if (this.isEmpty(tile.x, tile.y) && this.dist(tile, st) <= r) return st;
    }
    return null;
  }
  // Target specs needed to play a card from hand
  playSpecs(iid) {
    const d = this.def(iid);
    const p = this.s.inst[iid].owner;
    switch (d.type) {
      case 'Zone': return [{ type: 'lane', label: 'Choose a Lane to claim', filter: (E, l) => E.zoneLanes(p).includes(l) }];
      case 'Structure': return [{ type: 'lane', label: 'Choose a Lane you control', filter: (E, l) => E.structLanes(p).includes(l) }];
      case 'Identity': return [{ type: 'tile', label: 'Choose a tile next to your Structure', filter: (E, t) => !!E.structForSummon(p, t) }];
      case 'Equipment': return [{ type: 'unit', side: 'friendly', label: 'Equip which Identity?', filter: (E, u) => !E.def(u.cardId).token || true }];
      case 'Consumable': return [{ type: 'unit', side: 'friendly', label: 'Give to which Identity?' }];
      default: return (d.play && d.play.targets) || [];
    }
  }
  timingOk(p, d) {
    const s = this.s;
    const timing = (d.play && d.play.timing) || 'main';
    if (s.chain.length) return timing === 'response' && s.priority === p;
    if (s.active !== p) return false;
    return true;
  }
  canPlay(p, iid, { ignoreTargets = false } = {}) {
    const s = this.s;
    if (!this.canAct(p)) return false;
    const P = this.P(p);
    if (!P.hand.includes(iid)) return false;
    const d = this.def(iid);
    if (!d) return false;
    if (s.chain.length && !['Action', 'Event'].includes(d.type)) return false;
    if (!this.timingOk(p, d)) return false;
    if (d.type === 'Identity') {
      const tiles = this.summonTiles(p);
      if (!tiles.length) return false;
      const min = Math.min(...tiles.map((t) => this.cardCost(p, iid, { struct: t.struct })));
      if (min > P.sap) return false;
      return true;
    }
    if (d.type === 'Structure') {
      const lanes = this.structLanes(p);
      if (!lanes.length) return false;
      if (Math.min(...lanes.map((l) => this.cardCost(p, iid, { target: l }))) > P.sap) return false;
    } else if (this.cardCost(p, iid) > P.sap) return false;
    if (d.play && d.play.condition && !d.play.condition(this, { p, card: iid })) return false;
    if (ignoreTargets) return true;
    return this.hasTargets(this.playSpecs(iid), { p, card: iid });
  }
  playableCards(p) { return this.P(p).hand.filter((iid) => this.canPlay(p, iid)); }
  hasResponse(p) {
    return this.P(p).hand.some((iid) => {
      const d = this.def(iid);
      return d && d.play && d.play.timing === 'response' && this.canPlay(p, iid);
    });
  }
  unitCanAct(u) {
    return u && u.state !== 'done' && !this.hasStatus(u, 'stasis');
  }
  canAttack(u) {
    if (!u || u.state === 'done' || this.hasStatus(u, 'stasis') || this.hasStatus(u, 'noAttack')) return false;
    return u.attacks < 1 + u.extraAttacks;
  }
  attackTargets(u, from = null) {
    if (!this.canAttack(u)) return [];
    const pos = from || u;
    const rp = this.stat(u, 'rp', { position: pos });
    const out = [];
    for (const e of this.allUnits()) if (e.owner !== u.owner && this.dist(pos, e) <= rp) out.push(e.iid);
    for (const st of Object.values(this.s.structs)) if (st.owner !== u.owner && this.dist(pos, st) <= rp) out.push(st.iid);
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
    const tag = k + ':' + (u.state === 'active' ? u.actSerial : (u.actSerial || 0) + 1);
    if (u.flags['ab_' + k] === tag) return false;
    if (entry.ab.oncePerTurn && this.usedThisTurn(u, 'abT_' + k)) return false;
    if (u.mp < this.abilityCost(u, entry.ab)) return false;
    if (entry.ab.condition && !entry.ab.condition(this, { p: u.owner, unit: u.iid })) return false;
    return this.hasTargets(entry.ab.targets, { p: u.owner, unit: u.iid });
  }
  consumableUsable(u) {
    if (!u || !u.cons) return false;
    const d = this.def(u.cons);
    if (!d.use) return false;
    if (d.use.condition && !d.use.condition(this, { p: u.owner, unit: u.iid })) return false;
    return this.hasTargets(d.use.targets, { p: u.owner, unit: u.iid, card: u.cons });
  }

  // =========================================================================
  // Actions (the only way the outside world mutates the game)
  // =========================================================================
  act(p, a) {
    this.events = [];
    this.sideEffect = false;
    const s = this.s;
    try {
      if (s.phase === 'over') return this.fail('The match is over.');
      if (a.type === 'concede') { this.log(`${this.P(p).name} concedes.`); this.win(other(p), 'Concession'); return this.ok(); }
      if (a.type === 'setAutoRetaliate') { this.P(p).autoRetaliate = !!a.on; return this.ok(); }
      if (s.phase === 'mulligan') {
        if (a.type !== 'mulligan') return this.fail('Choose whether to keep your hand.');
        return this.doMulligan(p, !!a.redraw);
      }
      if (!this.canAct(p)) return this.fail("It isn't your turn to act.");
      if (a.type === 'undo') return this.doUndo(p);
      const snapshot = a.type === 'move' && !s.chain.length && !this.noUndo ? JSON.stringify({ ...s, undo: null }) : null;
      let r;
      switch (a.type) {
        case 'pass': r = this.doPass(p); break;
        case 'endTurn': r = this.doEndTurn(p); break;
        case 'play': r = this.doPlay(p, a.iid, a.targets || []); break;
        case 'move': r = this.doMove(p, a.unit, a.to); break;
        case 'attack': r = this.doAttack(p, a.unit, a.target); break;
        case 'ability': r = this.doAbility(p, a.unit, a.key || 'unique', a.targets || []); break;
        case 'consume': r = this.doConsume(p, a.unit, a.targets || []); break;
        case 'wait': r = this.doWait(p, a.unit); break;
        case 'forage': r = this.doForage(p, a.iid); break;
        default: return this.fail('Unknown action.');
      }
      if (r.ok) {
        // A move can be undone if it revealed nothing new (no draws, damage or defeats).
        const clean = r.events.every((e) => UNDO_SAFE.has(e.t));
        s.undo = snapshot && clean && s.winner === null ? snapshot : null;
      }
      return r;
    } catch (err) {
      console.error(err);
      return this.fail('Engine error: ' + err.message);
    }
  }
  ok() { return { ok: true, events: this.events }; }
  fail(err) { return { ok: false, error: err, events: [] }; }

  doMulligan(p, redraw) {
    const P = this.P(p);
    if (P.mulligan) return this.fail('Already decided.');
    if (redraw) {
      P.deck.push(...P.hand);
      P.hand = [];
      this.shuffle(P.deck);
      this.openingHand(p);
      this.log(`${P.name} redraws their opening hand.`);
    }
    P.mulligan = true;
    this.emit({ t: 'mulligan', p, redraw });
    if (this.P(0).mulligan && this.P(1).mulligan) {
      this.s.phase = 'play';
      this.startTurn(this.s.first);
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

  doEndTurn(p) {
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    this.endTurn(p);
    return this.ok();
  }

  canForage(p) {
    const P = this.P(p);
    return this.s.active === p && !this.s.chain.length && P.forageSerial !== this.s.turnSerial && P.sap >= C.FORAGE_COST && P.hand.length > 0;
  }
  doForage(p, iid) {
    const P = this.P(p);
    if (!this.canForage(p)) return this.fail('You cannot Forage right now.');
    if (!P.hand.includes(iid)) return this.fail('Choose a card from your hand.');
    P.forageSerial = this.s.turnSerial;
    P.sap -= C.FORAGE_COST;
    this.emit({ t: 'sap', p, sap: P.sap, sapMax: P.sapMax, delta: -C.FORAGE_COST });
    this.discardFromHand(p, iid);
    this.log(`${P.name} forages for a new card.`);
    this.draw(p, 1);
    return this.ok();
  }

  doWait(p, uid) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (u.state === 'done') return this.fail('Already done.');
    if (u.state === 'ready') this.beginActivation(u);
    this.endActivation(u);
    return this.ok();
  }

  doMove(p, uid, to) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (!to) return this.fail('No destination.');
    if (this.hasStatus(u, 'stasis')) return this.fail('That Identity is held in Stasis.');
    const onlyFree = u.state === 'done';
    if (onlyFree && u.freeSteps <= 0) return this.fail('That Identity has finished its activation.');
    if (!onlyFree && u.state === 'ready') this.beginActivation(u);
    const budget = onlyFree ? u.freeSteps : this.moveBudget(u);
    const r = this.reachable(u, budget).get(key(to.x, to.y));
    if (!r) return this.fail('Cannot reach that tile.');
    this.walk(u, r.path, r.cost);
    return this.ok();
  }

  doAttack(p, uid, targetId) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (!this.attackTargets(u).includes(targetId)) return this.fail('Target out of range.');
    if (u.state === 'ready') this.beginActivation(u);
    u.attacks++;
    u.act.attacked = true;
    u.act.movedBeforeAttack = u.act.moved;
    const tgt = this.entity(targetId);
    this.emit({ t: 'declare', unit: uid, target: targetId });
    this.log(`${this.def(u.cardId).name} attacks ${this.def(tgt.cardId).name}!`);
    this.openChain({ kind: 'attack', p, unit: uid, target: targetId, mods: { reduce: 0 } });
    return this.ok();
  }

  doAbility(p, uid, k, targets) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (!this.abilityUsable(u, k)) return this.fail('Ability not available.');
    const entry = this.unitAbilities(u).find((a) => a.key === k);
    const ab = entry.ab;
    const ctx = { p, unit: uid, targets };
    if (!this.checkTargets(ab.targets, targets, ctx)) return this.fail('Invalid target.');
    if (u.state === 'ready') this.beginActivation(u);
    const cost = this.abilityCost(u, ab);
    u.mp -= cost;
    u.act.mpSpent += cost;
    u.act.ability = true;
    u.flags['ab_' + k] = k + ':' + u.actSerial;
    if (ab.oncePerTurn) this.once(u, 'abT_' + k);
    const free = u.statuses.find((s) => s.kind === 'freeAbility');
    if (free) u.statuses = u.statuses.filter((s) => s !== free);
    this.emit({ t: 'ability', unit: uid, name: entry.name, cost, targets });
    this.log(`${this.def(u.cardId).name} uses ${entry.name}!`);
    for (const t of targets) {
      const tu = this.unit(t);
      if (tu && tu.owner !== p) { tu.targetedSince = true; this.trigger('targeted', { unit: tu.iid, by: p, srcUnit: uid }); }
    }
    ab.resolve(this, ctx);
    if (this.s.units[uid]) {
      this.trigger('abilityUsed', { unit: uid, cost, targets, key: k });
      if (u.mp === 0 && cost > 0) this.trigger('mpZero', { unit: uid });
    }
    return this.ok();
  }

  doConsume(p, uid, targets) {
    const u = this.unit(uid);
    if (!u || u.owner !== p) return this.fail('Not your Identity.');
    if (this.s.chain.length) return this.fail('Resolve the chain first.');
    if (!this.consumableUsable(u)) return this.fail('No usable Consumable.');
    const cid = u.cons;
    const d = this.def(cid);
    const ctx = { p, unit: uid, targets, card: cid };
    if (!this.checkTargets(d.use.targets, targets, ctx)) return this.fail('Invalid target.');
    u.cons = null;
    this.dirty();
    if (u.act) u.act.usedItem = true;
    this.emit({ t: 'consume', unit: uid, cardId: this.s.inst[cid].cardId, name: d.name });
    this.log(`${this.def(u.cardId).name} uses ${d.name}.`);
    d.use.resolve(this, ctx);
    this.toDiscard(cid);
    if (this.s.units[uid]) this.trigger('consumableUsed', { unit: uid, card: cid, restores: !!d.restores });
    return this.ok();
  }

  doPlay(p, iid, targets) {
    const s = this.s;
    const P = this.P(p);
    if (!this.canPlay(p, iid, { ignoreTargets: true })) return this.fail("You can't play that card now.");
    const d = this.def(iid);
    const specs = this.playSpecs(iid);
    const ctx = { p, card: iid, targets };
    if (!this.checkTargets(specs, targets, ctx)) return this.fail('Invalid target.');
    let cost;
    let struct = null;
    if (d.type === 'Identity') {
      struct = this.structForSummon(p, targets[0]);
      cost = this.cardCost(p, iid, { struct: struct.iid });
    } else cost = this.cardCost(p, iid, { target: targets[0] });
    if (cost > P.sap) return this.fail('Not enough Sap.');
    P.sap -= cost;
    P.hand.splice(P.hand.indexOf(iid), 1);
    s.stats[p].cards++;
    this.emit({ t: 'sap', p, sap: P.sap, sapMax: P.sapMax, delta: -cost });
    this.emit({ t: 'play', p, iid, cardId: this.s.inst[iid].cardId, targets });
    this.trigger('cardPlayed', { p, card: iid, type: d.type });
    switch (d.type) {
      case 'Zone': this.placeZone(p, iid, targets[0]); break;
      case 'Structure': this.placeStruct(p, iid, targets[0]); break;
      case 'Identity': this.summon(p, iid, targets[0], struct); break;
      case 'Equipment': this.attachEquip(p, iid, targets[0]); break;
      case 'Consumable': this.attachCons(p, iid, targets[0]); break;
      default:
        this.log(`${P.name} plays ${d.name}.`);
        for (const t of targets) {
          const tu = this.unit(t);
          if (tu && tu.owner !== p) { tu.targetedSince = true; this.trigger('targeted', { unit: tu.iid, by: p, card: iid }); }
        }
        this.openChain({ kind: 'card', p, iid, targets, cardId: this.s.inst[iid].cardId });
    }
    return this.ok();
  }

  placeZone(p, iid, l) {
    const ln = this.s.lanes[l];
    const prev = ln.zone;
    const capture = ln.ctrl !== null && ln.ctrl !== p;
    if (prev) this.toDiscard(prev);
    ln.zone = iid;
    ln.ctrl = p;
    this.dirty();
    this.emit({ t: 'zone', lane: l, p, iid, cardId: this.s.inst[iid].cardId, replaced: !!prev, capture });
    this.log(`${this.P(p).name} ${capture ? 'captures' : 'claims'} Lane ${l + 1} with ${this.def(iid).name}.`);
    if (capture) {
      this.s.stats[p].captures++;
      this.gainRenown(p, C.RENOWN_CAPTURE, 'Lane captured');
    }
    this.trigger('zonePlaced', { lane: l, p, capture, card: iid });
  }
  placeStruct(p, iid, l) {
    const d = this.def(iid);
    const st = { iid, cardId: this.s.inst[iid].cardId, owner: p, lane: l, bp: d.bp, bonusBp: 0, flags: {}, builtSerial: this.s.turnSerial };
    this.s.structs[iid] = st;
    this.s.lanes[l].structure = iid;
    this.dirty();
    st.bp = this.structMaxBp(st);
    this.emit({ t: 'struct', lane: l, p, iid, cardId: st.cardId, bp: st.bp });
    this.log(`${this.P(p).name} builds ${d.name} in Lane ${l + 1}.`);
    this.trigger('structBuilt', { struct: iid, lane: l, p });
  }
  summon(p, iid, tile, st) {
    const u = this.makeUnit(iid, p, tile.x, tile.y);
    u.via = st.iid;
    u.summonLane = laneOfX(tile.x);
    this.s.units[iid] = u;
    this.s.stats[p].summoned++;
    this.dirty();
    this.emit({ t: 'summon', unit: iid, p, cardId: u.cardId, x: tile.x, y: tile.y, struct: st.iid });
    this.log(`${this.P(p).name} summons ${this.def(iid).name}!`);
    this.trigger('summoned', { unit: iid, struct: st.iid, lane: laneOfX(tile.x) });
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
  // Chain (response system — newest to oldest)
  // =========================================================================
  openChain(item) {
    const s = this.s;
    s.chain.push(item);
    const opp = other(item.p);
    s.priority = opp;
    this.emit({ t: 'chain', items: s.chain.map((c) => ({ ...c })), priority: opp });
    if (!this.hasResponse(opp)) this.resolveChain();
  }
  doPass(p) {
    if (!this.s.chain.length) return this.fail('Nothing to pass on.');
    this.resolveChain();
    return this.ok();
  }
  resolveChain() {
    const s = this.s;
    s.priority = null;
    while (s.chain.length && s.winner === null) {
      const item = s.chain.pop();
      if (item.kind === 'attack') this.resolveAttack(item);
      else if (item.kind === 'card') this.resolveCard(item);
      if (item.negated) continue;
    }
    s.chain = [];
    this.emit({ t: 'chainEnd' });
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
      if (u && item.reflect) this.dealDamage(u.iid, this.stat(u, 'sp'), { kind: 'effect', p: other(item.p) });
      return;
    }
    if (!u || !tgt) { this.emit({ t: 'fizzle', text: 'The attack fizzles.' }); return; }
    const dist = this.dist(u, tgt);
    if (dist > this.stat(u, 'rp')) {
      this.emit({ t: 'fizzle', text: `${this.def(tgt.cardId).name} dodged out of range!`, target: tgt.iid });
      this.log('The attack misses — target out of range.');
      return;
    }
    const isStruct = !!this.struct(tgt.iid);
    const ranged = dist >= 2;
    this.trigger('beforeAttack', { unit: u.iid, target: tgt.iid, ranged, dist, isStruct });
    if (!this.s.units[u.iid] || !this.entity(tgt.iid)) return;
    const ctx = { attack: true, target: tgt.iid, dist, ranged, isStruct };
    let sp = this.stat(u, 'sp', ctx) + this.hookSum('attackBonus', u, tgt, ctx);
    let mult = 1;
    let splash = 0;
    for (const st of u.statuses) {
      if (st.kind === 'nextAttack') { sp += st.v || 0; if (st.mult) mult = Math.max(mult, st.mult); if (st.splash) splash += st.splash; if (isStruct && st.vsStruct) sp += st.vsStruct; }
    }
    u.statuses = u.statuses.filter((st) => st.kind !== 'nextAttack');
    if (!isStruct) for (const st of tgt.statuses) if (st.kind === 'marked') sp += st.v;
    sp = Math.max(0, sp * mult - (item.mods.reduce || 0));
    if (!isStruct) {
      tgt.attackedBy = (tgt.attackedBy || []).filter((h) => h.s === this.s.turnSerial);
      tgt.attackedBy.push({ u: u.iid, s: this.s.turnSerial, o: u.owner });
    }
    this.emit({ t: 'attack', unit: u.iid, target: tgt.iid, ranged, amount: sp });
    const tAlive = () => !!this.entity(tgt.iid);
    this.dealDamage(tgt.iid, sp, { kind: 'attack', unit: u.iid, p: u.owner, ranged });
    if (splash && !isStruct) {
      for (const e of this.allUnits()) if (e.owner !== u.owner && e.iid !== tgt.iid && cheb(e, tgt) === 1) this.dealDamage(e.iid, splash, { kind: 'effect', unit: u.iid, p: u.owner });
    }
    this.trigger('afterAttack', { unit: u.iid, target: tgt.iid, ranged, dist, isStruct, killed: !tAlive() });
    // Retaliation
    const def = this.unit(tgt.iid);
    const att = this.unit(u.iid);
    if (def && att && !isStruct && this.dist(def, att) <= this.stat(def, 'rp') && this.P(def.owner).autoRetaliate
        && !this.hasStatus(def, 'stasis')) {
      const cost = this.retaliationCost(def);
      if (def.mp >= cost) {
        def.mp -= cost;
        const dmg = Math.ceil(this.stat(def, 'sp') / 2);
        this.emit({ t: 'retaliate', unit: def.iid, target: att.iid, amount: dmg, cost });
        this.trigger('retaliating', { unit: def.iid, target: att.iid });
        this.dealDamage(att.iid, dmg, { kind: 'retaliation', unit: def.iid, p: def.owner, ranged: this.dist(def, att) >= 2 });
      }
    }
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
  v.hasResponse = [false, false];
  v.players.forEach((P, q) => {
    P.deckCount = P.deck.length;
    P.deck = [];
    if (q !== p) {
      P.handCount = P.hand.length;
      P.hand = P.hand.map(() => null);
    } else P.handCount = P.hand.length;
  });
  // strip instance map entries for hidden cards (opponent hand/deck)
  const hidden = new Set([...state.players[1 - p].hand, ...state.players[0].deck, ...state.players[1].deck]);
  for (const iid of hidden) delete v.inst[iid];
  return v;
}

export function redactEvents(events, p) {
  return events.map((e) => {
    if ((e.t === 'draw') && e.p !== p) return { t: 'draw', p: e.p };
    if (e.t === 'chain') return { ...e, items: e.items.map((c) => ({ ...c })) };
    return e;
  });
}

export { key as tileKey, DIRS };
