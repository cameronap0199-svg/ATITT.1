// Knotwood AI. A one-ply planner that simulates candidate plans on cloned states
// and scores them with a positional evaluation. Difficulty (1–10) scales search
// breadth, threat awareness, follow-up combos, response usage and noise.
// Works for any seat in 1v1, 2v2 and free-for-all matches.

import { Game, cheb, STEP_INDEX } from './engine.js';
import * as C from './constants.js';

const clone = (s) => (typeof structuredClone === 'function' ? structuredClone({ ...s, undo: null }) : JSON.parse(JSON.stringify({ ...s, undo: null })));

function makeRand(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function difficultyProfile(d) {
  d = Math.max(1, Math.min(10, d | 0));
  return {
    d,
    noise: (10 - d) * 1.6,
    blunder: d <= 2 ? 0.3 : d <= 4 ? 0.12 : d <= 6 ? 0.04 : 0,
    threat: d <= 2 ? 0 : d <= 4 ? 0.4 : d <= 7 ? 0.6 : 0.7,
    followups: d >= 4,
    tileSample: d <= 2 ? 0.5 : d <= 4 ? 0.8 : 1,
    responses: d >= 3,
    moveTiles: d <= 3 ? 3 : d <= 6 ? 5 : d <= 8 ? 7 : 9,
    attackFrom: d <= 3 ? 1 : d <= 6 ? 2 : 3,
    comboLimit: d <= 3 ? 8 : d <= 6 ? 14 : 24,
    maxPlans: d <= 3 ? 60 : d <= 6 ? 140 : d <= 8 ? 240 : 320,
    lookahead: d >= 9 ? 6 : d >= 7 ? 4 : 0,
    lookaheadWidth: d >= 9 ? 90 : 50,
    lazy: d <= 1 ? 0.22 : d <= 2 ? 0.12 : 0,
    smartDiscard: d >= 4,
  };
}

// Run actions on a cloned state; everyone else auto-passes any response sequence.
function simulate(state, p, actions) {
  const G = new Game(clone(state));
  G.noUndo = true;
  for (const a of actions) {
    if (!a) continue;
    const r = G.act(p, a);
    if (!r.ok) return null;
    settleChain(G);
    if (G.s.winner !== null) break;
  }
  return G;
}
function settleChain(G) {
  let guard = 0;
  while (G.s.chain.length && G.s.priority !== null && guard++ < 12) G.act(G.s.priority, { type: 'pass' });
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
const AGGRO = { Poacher: 1, Understory: 0.9, Hydrologist: 0.75, Forager: 0.55, Silviculturist: 0.4 };

function baseStat(G, u, k) {
  let v = G.stat(u, k);
  for (const st of u.statuses) if (st.stat === k && (st.at === 'eot' || st.at === 'thisAct')) v -= st.v;
  return v;
}

export function unitValue(G, u) {
  const d = G.def(u.cardId);
  const base = d.token ? 3 : 5 + d.cost * 2.4;
  return base + baseStat(G, u, 'sp') * 0.8 + baseStat(G, u, 'rp') * 0.25 + baseStat(G, u, 'ap') * 0.2
    + (u.eq ? 2.5 : 0) + (u.cons ? 1.2 : 0);
}

// What each enemy could do on its coming turn: reach (move + range) and damage.
function threatMap(G, p) {
  const out = [];
  for (const e of G.allUnits()) {
    if (!G.foe(e.owner, p) || G.hasStatus(e, 'stasis')) continue;
    const ap = G.stat(e, 'ap', { activation: true });
    const hits = Math.max(1, Math.floor(G.maxMp(e) / Math.max(1, G.attackCost(e))));
    out.push({ x: e.x, y: e.y, reach: ap + G.stat(e, 'rp'), sp: G.stat(e, 'sp'), dmg: G.stat(e, 'sp') * Math.min(hits, 3) });
  }
  return out;
}
function threatAt(threats, t) {
  let pot = 0;
  for (const e of threats) if (Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) <= e.reach) pot += e.dmg;
  return pot;
}

// Walking-distance fields (8-way BFS over the plus-shaped board, ignoring units) from
// the things player p wants to reach. Computed once per decision and reused by every
// simulated position, so evaluation stays cheap.
let FIELD = null;
function bfsField(G, sources) {
  const N = G.s.size;
  const f = new Int16Array(N * N).fill(99);
  const q = [];
  for (const t of sources) { const i = t.y * N + t.x; if (f[i] > 0) { f[i] = 0; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % N, y = (i / N) | 0, d = f[i] + 1;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || !G.inBounds(nx, ny)) continue;
      const j = ny * N + nx;
      if (f[j] > d) { f[j] = d; q.push(j); }
    }
  }
  return f;
}
function buildField(G, p) {
  const N = G.s.size;
  const structs = [];
  for (const st of Object.values(G.s.structs)) if (G.foe(st.owner, p)) structs.push(st);
  for (const ln of G.s.lanes) if (ln.ctrl !== null && G.foe(ln.ctrl, p) && !ln.structure) structs.push({ x: ln.x0 + (ln.w >> 1), y: ln.y0 + (ln.h >> 1) });
  const units = G.allUnits().filter((e) => G.foe(e.owner, p));
  const fS = bfsField(G, structs), fU = bfsField(G, units);
  const f = new Int16Array(N * N);
  for (let i = 0; i < f.length; i++) f[i] = Math.min(fS[i], fU[i] + 2);
  return { p, N, f, key: G.s.turnSerial + ':' + G.s.nextId };
}
function fieldDist(t) {
  if (!FIELD) return 20;
  return Math.min(30, FIELD.f[t.y * FIELD.N + t.x]);
}
function urgency(G) { return Math.min(1, G.s.round / 16); }

export function evaluate(G, p, prof = difficultyProfile(6)) {
  const s = G.s;
  const myTeam = G.team(p);
  if (s.winner !== null) return s.winner === myTeam ? 1e6 : -1e6;
  if (G.P(p).eliminated) return -5e5;
  const enemies = G.enemiesOf(p);
  const foeW = 1 / Math.sqrt(Math.max(1, enemies.length));
  // In free-for-all, gang up on the weakest opponent so games actually finish.
  const focus = {};
  if (enemies.length > 1) {
    const power = (q) => G.structsOf(q).length * 3 + G.unitsOf(q).length;
    const weakest = enemies.reduce((a, b) => (power(b) < power(a) ? b : a));
    for (const q of enemies) focus[q] = q === weakest ? 1.35 : 0.85;
  }
  const w = (owner) => (G.ally(owner, p) ? (owner === p ? 1 : 0.8) : -foeW * (focus[owner] || 1));
  let score = 0;

  // players still standing
  for (let q = 0; q < G.n; q++) if (q !== p && G.foe(q, p) && G.P(q).eliminated) score += 400;

  // Lanes & Structures
  for (const ln of s.lanes) {
    if (ln.ctrl !== null && ln.ctrl !== undefined) score += w(ln.ctrl) * 10;
  }
  for (const st of Object.values(s.structs)) {
    const free = Math.max(0, G.structHousing(st) - G.housedCount(st));
    const last = G.structsOf(st.owner).length === 1 ? 10 : 0;
    score += w(st.owner) * (14 + st.bp * (G.ally(st.owner, p) ? 0.55 : 0.85) + free * 1.2 + last);
  }
  // hand
  for (let q = 0; q < G.n; q++) {
    if (G.P(q).eliminated) continue;
    const n = q === p ? G.P(q).hand.length : (G.P(q).handCount ?? G.P(q).hand.length);
    score += w(q) * n * 0.5;
  }

  const threats = prof.threat ? threatMap(G, p) : [];
  const caution = prof.threat * (1 - 0.45 * urgency(G));
  for (const u of G.allUnits()) {
    const v = unitValue(G, u);
    const mine = G.ally(u.owner, p);
    if (!mine) {
      // Damage heals at the start of its owner's turn, so it only counts partly.
      const frac = Math.max(0, u.bp) / Math.max(1, G.maxBp(u));
      score += w(u.owner) * v * (0.7 + 0.3 * frac);
      continue;
    }
    const own = u.owner === p ? 1 : 0.8;
    const frac = Math.max(0, u.bp) / Math.max(1, G.maxBp(u));
    score += own * v * (0.6 + 0.4 * frac);
    if (u.owner !== p) continue;
    const d = G.def(u.cardId);
    const aggro = AGGRO[d.cls] ?? 0.7;
    score -= fieldDist(u) * (0.3 + 0.35 * urgency(G)) * aggro;
    const l = G.laneOf(u);
    if (l >= 0) {
      const ln = s.lanes[l];
      if (ln.ctrl !== null && G.foe(ln.ctrl, p)) score += (ln.structure ? 0.8 : 4) * aggro;
      if (ln.ctrl === p && G.foesInLane(l, p).length) score += 1.2;
    }
    // Keeping enough MP to retaliate deters attacks.
    if (u.mp >= G.retaliationCost(u)) score += 1;
    if (caution) {
      const pot = threatAt(threats, u);
      if (pot > 0) {
        const eff = Math.max(0, pot - u.barrier);
        if (eff >= u.bp) score -= v * 0.5 * caution;
        else score -= eff * 0.25 * caution;
      }
    }
  }
  if (prof.threat) {
    for (const st of G.structsOf(p)) {
      const pot = threatAt(threats, st);
      if (pot >= st.bp) score -= (14 + (G.structsOf(p).length === 1 ? 30 : 8)) * 0.5 * prof.threat;
      else score -= pot * 0.2 * prof.threat;
    }
  }
  return score;
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------
function backness(G, ln, t) {
  // 0 at the Lane's inner edge (toward the Void), 11 at the outer edge
  switch (ln.side) {
    case 'S': return t.y - ln.y0;
    case 'N': return ln.y0 + ln.h - 1 - t.y;
    case 'W': return ln.x0 + ln.w - 1 - t.x;
    default: return t.x - ln.x0;
  }
}

function structTiles(G, p, l) {
  const ln = G.s.lanes[l];
  const foes = G.allUnits().filter((u) => G.foe(u.owner, p));
  const tiles = G.laneTiles(l).map((t) => {
    let near = 12;
    for (const e of foes) near = Math.min(near, cheb(e, t));
    const mid = Math.abs(ln.side === 'S' || ln.side === 'N' ? t.x - (ln.x0 + 2) : t.y - (ln.y0 + 2));
    return { t, v: backness(G, ln, t) * 0.6 + Math.min(near, 8) - mid * 0.4 - (backness(G, ln, t) >= 11 ? 3 : 0) };
  });
  return tiles.sort((a, b) => b.v - a.v).slice(0, 2).map((x) => x.t);
}

function summonScore(G, p, t, objs, threats) {
  return -fieldDist(t) - threatAt(threats, t) * 0.15;
}

function positional(G, p, u, t, objs, threats) {
  const d = G.def(u.cardId);
  const aggro = AGGRO[d.cls] ?? 0.7;
  return -fieldDist(t) * aggro - threatAt(threats, t) * 0.12 * (1 - 0.45 * urgency(G));
}

function shuffleWith(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Plans grouped by the turn step they belong to, so the AI plays its turn in order.
function candidatePlans(G, p, prof, rand) {
  const s = G.s;
  const groups = { zone: [], build: [], summon: [], equip: [], combat: [] };
  const P = G.P(p);
  const threats = threatMap(G, p);
  const objs = null;

  for (const iid of P.hand) {
    if (!G.canPlay(p, iid)) continue;
    const d = G.def(iid);
    const step = G.cardStep(d) || 'combat';
    let combos;
    if (d.type === 'Structure') {
      combos = G.structLanes(p).flatMap((l) => structTiles(G, p, l).map((t) => [t]));
    } else if (d.type === 'Identity') {
      const tiles = G.summonTiles(p).sort((a, b) => summonScore(G, p, b, objs, threats) - summonScore(G, p, a, objs, threats));
      combos = tiles.slice(0, 3).map((t) => [{ x: t.x, y: t.y }]);
    } else {
      combos = G.targetCombos(G.playSpecs(iid), { p, card: iid }, 200);
      if (d.type === 'Equipment' || d.type === 'Consumable') {
        combos = combos.sort((a, b) => unitValue(G, G.unit(b[0])) - unitValue(G, G.unit(a[0]))).slice(0, 3);
      } else if (combos.length > prof.comboLimit) {
        shuffleWith(combos, rand);
        combos = combos.slice(0, prof.comboLimit);
      }
    }
    for (const t of combos) groups[step].push({ kind: 'card', type: d.type, card: iid, actions: [{ type: 'play', iid, targets: t }], followup: prof.followups && ['Action', 'Event'].includes(d.type) });
  }

  const units = G.unitsOf(p).filter((u) => u.state !== 'done' || u.freeSteps > 0);
  for (const u of units) {
    if (u.state === 'done' || !G.canMoveNormally(u)) {
      // Already acted / active: extra steps, remaining attacks, abilities
      if (u.freeSteps > 0 && !G.hasStatus(u, 'stasis')) {
        const reach = [...G.reachable(u, u.freeSteps).values()].map((r) => r.path[r.path.length - 1]);
        reach.sort((a, b) => positional(G, p, u, b, objs, threats) - positional(G, p, u, a, objs, threats));
        for (const t of reach.slice(0, 3)) groups.combat.push({ kind: 'move', actions: [{ type: 'move', unit: u.iid, to: t }] });
      }
      if (u.state !== 'done') addActs(G, p, u, [{ x: u.x, y: u.y, stay: true }], groups.combat, prof, rand, objs, threats);
      if (u.cons && G.consumableUsable(u)) addConsume(G, u, groups.combat, prof);
      continue;
    }
    if (G.hasStatus(u, 'stasis')) continue;
    const tiles = [{ x: u.x, y: u.y, stay: true, cost: 0 }];
    for (const r of G.reachable(u).values()) {
      const t = r.path[r.path.length - 1];
      if (rand() <= prof.tileSample) tiles.push({ x: t.x, y: t.y, cost: r.cost });
    }
    addActs(G, p, u, tiles, groups.combat, prof, rand, objs, threats);
    const moveTiles = tiles.filter((t) => !t.stay).sort((a, b) => positional(G, p, u, b, objs, threats) - positional(G, p, u, a, objs, threats)).slice(0, prof.moveTiles);
    for (const t of moveTiles) groups.combat.push({ kind: 'move', actions: [{ type: 'move', unit: u.iid, to: { x: t.x, y: t.y } }] });
    if (u.cons && G.consumableUsable(u)) addConsume(G, u, groups.combat, prof);
  }
  for (const k of Object.keys(groups)) if (groups[k].length > prof.maxPlans) groups[k] = shuffleWith(groups[k], rand).slice(0, prof.maxPlans);
  return groups;
}

function addActs(G, p, u, tiles, out, prof, rand, objs, threats) {
  const rp = G.stat(u, 'rp');
  if (G.canAttack(u)) {
    const targets = [...G.allUnits().filter((e) => G.foe(e.owner, p)), ...Object.values(G.s.structs).filter((st) => G.foe(st.owner, p))];
    for (const tgt of targets) {
      const from = tiles.filter((t) => cheb(t, tgt) <= rp);
      if (!from.length) continue;
      // prefer safe tiles, and tiles out of the target's retaliation range
      const trp = tgt.state !== undefined ? G.stat(tgt, 'rp') : -1;
      from.sort((a, b) => ((cheb(a, tgt) <= trp) - (cheb(b, tgt) <= trp)) * 4 + (threatAt(threats, a) - threatAt(threats, b)) * 0.1 + ((a.cost || 0) - (b.cost || 0)) * 0.01);
      for (const t of from.slice(0, prof.attackFrom)) {
        const acts = [];
        if (!t.stay) acts.push({ type: 'move', unit: u.iid, to: { x: t.x, y: t.y } });
        acts.push({ type: 'attack', unit: u.iid, target: tgt.iid });
        out.push({ kind: 'attack', actions: acts, unit: u.iid, chase: true });
      }
    }
  }
  for (const ab of G.unitAbilities(u)) {
    if (u.mp < G.abilityCost(u, ab.ab)) continue;
    if (ab.ab.oncePerTurn && G.usedThisTurn(u, 'abT_' + ab.key)) continue;
    const spots = [tiles[0], ...tiles.slice(1).sort((a, b) => positional(G, p, u, b, objs, threats) - positional(G, p, u, a, objs, threats)).slice(0, 2)];
    for (const t of spots) {
      const pre = t.stay ? [] : [{ type: 'move', unit: u.iid, to: { x: t.x, y: t.y } }];
      const G1 = pre.length ? simulate(G.s, p, pre) : G;
      if (!G1) continue;
      const u1 = G1.unit(u.iid);
      if (!u1 || !G1.abilityUsable(u1, ab.key)) continue;
      let combos = G1.targetCombos(ab.ab.targets || [], { p, unit: u.iid }, 60);
      if (combos.length > 5) { shuffleWith(combos, rand); combos = combos.slice(0, 5); }
      for (const c of combos) out.push({ kind: 'ability', actions: [...pre, { type: 'ability', unit: u.iid, key: ab.key, targets: c }], unit: u.iid, chase: true, followup: prof.followups });
    }
  }
}

function addConsume(G, u, plans, prof) {
  const d = G.def(u.cons);
  let combos = G.targetCombos(d.use.targets || [], { p: u.owner, unit: u.iid, card: u.cons }, 40);
  if (combos.length > 5) combos = combos.slice(0, 5);
  for (const c of combos) plans.push({ kind: 'consume', actions: [{ type: 'consume', unit: u.iid, targets: c }], followup: prof.followups });
}

// After an attack/ability, keep spending the same Identity's MP on the best hits.
function chaseAttacks(G, p, uid, prof, depth = 4) {
  const actions = [];
  let cur = G;
  let score = evaluate(cur, p, prof);
  for (let i = 0; i < depth; i++) {
    const u = cur.unit(uid);
    if (!u || u.state !== 'active' || !cur.canAttack(u)) break;
    let best = null;
    for (const t of cur.attackTargets(u)) {
      const a = { type: 'attack', unit: uid, target: t };
      const G2 = simulate(cur.s, p, [a]);
      if (!G2) continue;
      const sc = evaluate(G2, p, prof);
      if (!best || sc > best.sc) best = { sc, a, G2 };
    }
    if (!best || best.sc <= score) break;
    actions.push(best.a);
    cur = best.G2;
    score = best.sc;
  }
  return { actions, score, G: cur };
}

// Best immediate attack by any Identity (no movement) — used to value buffs.
function bestFollowup(G, p, prof) {
  let best = { score: evaluate(G, p, prof), actions: [] };
  for (const u of G.unitsOf(p)) {
    if (!G.canAttack(u) || !G.canMoveNormally(u) && u.state !== 'active') continue;
    for (const t of G.attackTargets(u)) {
      const acts = [{ type: 'attack', unit: u.iid, target: t }];
      const G2 = simulate(G.s, p, acts);
      if (!G2) continue;
      const sc = evaluate(G2, p, prof);
      if (sc > best.score) best = { score: sc, actions: acts };
    }
  }
  return best;
}

function scorePlan(state, p, plan, prof) {
  const G2 = simulate(state, p, plan.actions);
  if (!G2) return null;
  let sc = evaluate(G2, p, prof);
  let actions = plan.actions;
  if (plan.chase && G2.s.winner === null) {
    const c = chaseAttacks(G2, p, plan.unit, prof, prof.d >= 5 ? 4 : 2);
    if (c.actions.length) { sc = c.score; actions = [...actions, ...c.actions]; }
  }
  if (plan.followup && G2.s.winner === null) {
    const f = bestFollowup(G2, p, prof);
    if (f.actions.length && f.score > sc) { sc = f.score - 0.2; actions = [...actions, ...f.actions]; }
  }
  return { plan, actions, score: sc };
}

// ---------------------------------------------------------------------------
// Card value & discards
// ---------------------------------------------------------------------------
export function aiDiscards(state, p, difficulty = 5) {
  const prof = difficultyProfile(difficulty);
  const G = new Game(clone(state));
  const P = G.P(p);
  if (!prof.smartDiscard || !P.hand.length) return [];
  const openHome = G.s.lanes.filter((ln) => ln.home === p && ln.zone === null).length;
  const capturable = G.s.lanes.filter((ln) => ln.ctrl !== null && G.foe(ln.ctrl, p) && !ln.structure).length;
  const emptyLanes = G.s.lanes.filter((ln) => ln.ctrl === p && !ln.structure).length;
  let zonesKept = 0, structsKept = 0;
  const out = [];
  const byCost = [...P.hand].sort((a, b) => G.def(b).cost - G.def(a).cost);
  for (const iid of byCost) {
    const d = G.def(iid);
    if (d.type === 'Zone') {
      if (zonesKept < Math.max(1, openHome + capturable + emptyLanes > 0 ? openHome + capturable + 1 : 1)) zonesKept++;
      else out.push(iid);
    } else if (d.type === 'Structure') {
      if (structsKept < Math.max(1, emptyLanes + openHome)) structsKept++;
      else if (structsKept >= 2) out.push(iid);
      else structsKept++;
    } else if (d.type === 'Equipment' || d.type === 'Consumable') {
      if (!G.unitsOf(p).length && P.hand.filter((i) => G.def(i).type === 'Identity').length === 0) out.push(iid);
    }
  }
  return out.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function setupPlan(G, p) {
  const P = G.P(p);
  const zones = P.hand.filter((i) => G.def(i).type === 'Zone').sort((a, b) => G.def(b).cost - G.def(a).cost);
  const lanes = G.zoneLanes(p).sort((a, b) => Math.abs(G.s.lanes[a].i - 1) - Math.abs(G.s.lanes[b].i - 1));
  if (zones.length && lanes.length) return [{ type: 'play', iid: zones[0], targets: [lanes[0]] }];
  return [{ type: 'ready' }];
}

function endTurnAction(state, p, difficulty) {
  return { type: 'endTurn', discard: aiDiscards(state, p, difficulty) };
}

export function aiPlan(state, p, difficulty = 5, seed = 1) {
  const prof = difficultyProfile(difficulty);
  const rand = makeRand(seed ^ (state.turnSerial * 7919) ^ (state.nextId * 31));
  const G = new Game(clone(state));
  G.noUndo = true;
  if (G.s.winner !== null || G.P(p).eliminated) return [];
  if (G.s.phase === 'setup') return G.s.active === p ? setupPlan(G, p) : [];
  if (G.s.chain.length) return G.s.priority === p ? [aiRespond(state, p, difficulty, seed)] : [];
  if (G.s.active !== p) return [];

  FIELD = buildField(G, p);
  const baseline = evaluate(G, p, prof);
  const groups = candidatePlans(G, p, prof, rand);
  if (prof.lazy && rand() < prof.lazy && G.s.turnSerial > 2 && G.s.step === 'combat') return [endTurnAction(state, p, difficulty)];

  // Walk the turn steps in order; take the best plan of the earliest step that helps.
  const cur = STEP_INDEX[G.s.step];
  for (const step of C.STEPS) {
    if (STEP_INDEX[step] < cur || step === 'end') continue;
    const plans = groups[step];
    if (!plans || !plans.length) continue;
    const scored = [];
    for (const plan of plans) {
      const r = scorePlan(state, p, plan, prof);
      if (!r) continue;
      const noise = prof.noise ? (rand() + rand() + rand() - 1.5) * prof.noise : 0;
      scored.push({ ...r, noisy: r.score + noise });
    }
    if (!scored.length) continue;
    scored.sort((a, b) => b.noisy - a.noisy);
    if (prof.lookahead && step === 'combat') {
      for (const cand of scored.slice(0, prof.lookahead)) {
        const G2 = simulate(state, p, cand.actions);
        if (!G2 || G2.s.winner !== null || G2.s.active !== p) continue;
        const next = candidatePlans(G2, p, { ...prof, tileSample: 0.6, moveTiles: 3, attackFrom: 1, comboLimit: 6, maxPlans: prof.lookaheadWidth }, rand).combat;
        let best = cand.score;
        for (const plan of next.slice(0, prof.lookaheadWidth)) {
          const G3 = simulate(G2.s, p, plan.actions);
          if (G3) best = Math.max(best, evaluate(G3, p, prof));
        }
        cand.noisy = cand.score * 0.35 + best * 0.65;
      }
      scored.sort((a, b) => b.noisy - a.noisy);
    }
    let pick = scored[0];
    if (prof.blunder && rand() < prof.blunder) {
      const ok = scored.filter((x) => x.score > baseline - 3).slice(0, 5);
      if (ok.length) pick = ok[Math.floor(rand() * ok.length)];
    }
    const threshold = pick.plan.kind === 'move' ? 0.3 : 0.05;
    if (pick.score > baseline + threshold) return pick.actions;
  }
  // Finish any activation cleanly, then end the turn.
  return [endTurnAction(state, p, difficulty)];
}

export function aiRespond(state, p, difficulty = 5, seed = 1) {
  const prof = difficultyProfile(difficulty);
  if (!prof.responses) return { type: 'pass' };
  const G = new Game(clone(state));
  G.noUndo = true;
  FIELD = buildField(G, p);
  const passG = simulate(state, p, [{ type: 'pass' }]);
  const passScore = passG ? evaluate(passG, p, prof) : -Infinity;
  let best = { score: passScore + 1.5, action: { type: 'pass' } };
  const tryAct = (a) => {
    const G2 = simulate(state, p, [a]);
    if (!G2) return;
    const sc = evaluate(G2, p, prof);
    if (sc > best.score) best = { score: sc, action: a };
  };
  for (const iid of G.P(p).hand) {
    if (!G.canPlay(p, iid)) continue;
    for (const t of G.targetCombos(G.playSpecs(iid), { p, card: iid }, 30)) tryAct({ type: 'play', iid, targets: t });
  }
  for (const u of G.responseConsumables(p)) {
    const d = G.def(u.cons);
    for (const t of G.targetCombos(d.use.targets || [], { p, unit: u.iid, card: u.cons }, 12)) tryAct({ type: 'consume', unit: u.iid, targets: t });
  }
  return best.action;
}
