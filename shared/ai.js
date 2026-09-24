// Knotwood AI. A one-ply planner that simulates candidate plans on cloned states
// and scores them with a positional evaluation. Difficulty (1–10) scales search
// breadth, threat awareness, follow-up combos, response usage and noise.

import { Game, laneOfX, cheb } from './engine.js';
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
    threat: d <= 2 ? 0 : d <= 4 ? 0.5 : d <= 7 ? 0.85 : 1,
    followups: d >= 5,
    hitAndRun: d >= 6,
    tileSample: d <= 2 ? 0.45 : d <= 4 ? 0.75 : 1,
    responses: d >= 3,
    moveTiles: d <= 3 ? 4 : d <= 6 ? 6 : d <= 8 ? 8 : 12,
    comboLimit: d <= 3 ? 8 : d <= 6 ? 16 : 28,
    lookahead: d >= 9 ? 7 : d >= 7 ? 4 : 0,   // depth-2 search over the top plans
    lookaheadWidth: d >= 9 ? 120 : 60,
    lazy: d <= 1 ? 0.22 : d <= 2 ? 0.12 : 0,  // chance to stop acting early (easy bots)
    income: d >= 5 ? 1 : 0.6,                  // how much future Renown income is valued
  };
}

// Run actions on a cloned state; the opponent auto-passes any chain.
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
  while (G.s.chain.length && G.s.priority !== null && guard++ < 6) G.act(G.s.priority, { type: 'pass' });
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
const AGGRO = { Poacher: 1, Understory: 0.9, Hydrologist: 0.7, Forager: 0.55, Silviculturist: 0.35 };

function baseStat(G, u, k) {
  let v = G.stat(u, k);
  for (const st of u.statuses) if (st.stat === k && (st.at === 'eot' || st.at === 'thisAct')) v -= st.v;
  return v;
}

export function unitValue(G, u) {
  const d = G.def(u.cardId);
  const max = G.maxBp(u);
  const base = d.token ? 3 : 4 + d.cost * 2.2;
  const frac = Math.max(0, u.bp) / Math.max(1, max);
  return base * (0.3 + 0.7 * frac) + baseStat(G, u, 'sp') * 0.9 + baseStat(G, u, 'rp') * 0.3
    + (u.eq ? 2 : 0) + (u.cons ? 1.2 : 0) + u.mp * 0.2 + u.barrier * 0.7;
}

function threatMap(G, attacker) {
  // Approximate what the opponent can hit next turn: Chebyshev reach ignoring blockers.
  return G.unitsOf(attacker).filter((e) => !G.hasStatus(e, 'stasis')).map((e) => ({
    x: e.x, y: e.y, reach: G.stat(e, 'ap', { activation: true }) + G.stat(e, 'rp'), sp: G.stat(e, 'sp'),
  }));
}

export function evaluate(G, p, prof = difficultyProfile(6)) {
  const s = G.s;
  const o = 1 - p;
  if (s.winner === p) return 1e6;
  if (s.winner === o) return -1e6;
  let score = 0;
  const P = G.P(p);
  const O = G.P(o);
  const renownNeed = C.WIN_RENOWN;
  score += (P.renown - O.renown) * 11;
  // closeness to victory matters more near the end
  score += Math.max(0, P.renown - renownNeed + 8) * 4 - Math.max(0, O.renown - renownNeed + 8) * 4;

  // Lanes & structures
  s.lanes.forEach((ln, l) => {
    const st = G.structInLane(l);
    const sign = ln.ctrl === p ? 1 : ln.ctrl === o ? -1 : 0;
    score += sign * 11;
    if (st) {
      const ss = st.owner === p ? 1 : -1;
      const producing = ln.ctrl === st.owner;
      score += ss * (9 + st.bp * 0.75 + G.structHousing(st) * 1.2 + (producing ? 10 * prof.income : 0));
    }
  });

  const threatsOnMe = prof.threat ? threatMap(G, o) : [];
  const nearestTarget = (u) => {
    let best = 99;
    for (const st of G.structsOf(o)) best = Math.min(best, G.dist(u, st));
    s.lanes.forEach((ln, l) => { if (ln.ctrl === o && !G.structInLane(l)) best = Math.min(best, Math.abs(laneOfX(u.x) - l) * 2 + 1); });
    for (const e of G.unitsOf(o)) best = Math.min(best, cheb(u, e) + 1);
    return best;
  };

  for (const u of G.allUnits()) {
    const mine = u.owner === p;
    const v = unitValue(G, u);
    score += mine ? v : -v;
    if (!mine) continue;
    const d = G.def(u.cardId);
    const aggro = AGGRO[d.cls] ?? 0.7;
    const l = laneOfX(u.x);
    const ctrl = G.laneCtrl(l);
    // advance toward something worth fighting
    const dist = nearestTarget(u);
    score -= Math.min(dist, 10) * 0.28 * aggro;
    if (ctrl === o && !G.structInLane(l) && G.unitsInLane(l, o).length === 0) score += 6; // liberation pending
    if (ctrl === o) score += 0.8 * aggro;
    // defend own lanes with invaders
    const invaders = G.unitsInLane(l, o).length;
    if (ctrl === p && invaders) score += 1.2;
    // threat
    if (prof.threat) {
      let pot = 0;
      for (const t of threatsOnMe) if (Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) <= t.reach) pot += t.sp;
      if (pot > 0) {
        const guard = u.barrier + (u.statuses.find((x) => x.kind === 'guard')?.v || 0);
        const eff = Math.max(0, pot - guard);
        if (eff >= u.bp) score -= v * 0.55 * prof.threat;
        else score -= eff * 0.45 * prof.threat;
      }
    }
  }
  // enemy pressure against my structures
  if (prof.threat) {
    for (const st of G.structsOf(p)) {
      let pot = 0;
      for (const t of threatsOnMe) {
        const dd = G.dist({ x: t.x, y: t.y }, st);
        if (dd <= t.reach) pot += t.sp;
      }
      if (pot >= st.bp) score -= (C.RENOWN_STRUCTURE_KILL * 11 + 9) * 0.5 * prof.threat;
      else score -= pot * 0.35 * prof.threat;
    }
  }
  // cards & resources
  score += (P.hand.length - (O.handCount ?? O.hand.length)) * 1.1;
  score += Math.min(P.sap, 3) * 0.15;
  return score;
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------
function tileSafety(G, threats, t) {
  let pot = 0;
  for (const e of threats) if (Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) <= e.reach) pot += e.sp;
  return pot;
}

function candidatePlans(G, p, prof, rand) {
  const s = G.s;
  const plans = [];
  const P = G.P(p);
  const threats = threatMap(G, 1 - p);

  // --- cards
  for (const iid of P.hand) {
    if (!G.canPlay(p, iid)) continue;
    const d = G.def(iid);
    const specs = G.playSpecs(iid);
    let combos = G.targetCombos(specs, { p, card: iid }, 200);
    if (d.type === 'Identity') {
      // prefer tiles in contested / forward lanes; sample a handful
      combos = combos.sort((a, b) => tileScoreForSummon(G, p, b[0]) - tileScoreForSummon(G, p, a[0])).slice(0, 3);
    } else if (d.type === 'Equipment' || d.type === 'Consumable') {
      combos = combos.sort((a, b) => unitValue(G, G.unit(b[0])) - unitValue(G, G.unit(a[0]))).slice(0, 3);
    } else if (combos.length > prof.comboLimit) {
      shuffleWith(combos, rand);
      combos = combos.slice(0, prof.comboLimit);
    }
    for (const t of combos) plans.push({ kind: 'card', card: iid, actions: [{ type: 'play', iid, targets: t }], followup: prof.followups && ['Action', 'Event', 'Consumable', 'Equipment'].includes(d.type) });
  }

  // --- units
  for (const u of G.unitsOf(p)) {
    if (u.state === 'done') {
      if (u.freeSteps > 0) {
        const reach = [...G.reachable(u, u.freeSteps).values()];
        for (const r of reach.slice(0, 8)) plans.push({ kind: 'move', actions: [{ type: 'move', unit: u.iid, to: r.path[r.path.length - 1] }] });
      }
      if (u.cons && G.consumableUsable(u)) addConsume(G, u, plans, prof);
      continue;
    }
    if (G.hasStatus(u, 'stasis')) {
      plans.push({ kind: 'wait', actions: [{ type: 'wait', unit: u.iid }], wait: true });
      continue;
    }
    const reachMap = G.reachable(u);
    const tiles = [{ x: u.x, y: u.y, stay: true, cost: 0 }];
    for (const r of reachMap.values()) {
      const t = r.path[r.path.length - 1];
      if (rand() <= prof.tileSample) tiles.push({ x: t.x, y: t.y, cost: r.cost });
    }
    const rp = G.stat(u, 'rp');
    const canAtk = G.canAttack(u);
    // attacks (possibly after moving)
    if (canAtk) {
      const targets = [...G.allUnits().filter((e) => e.owner !== p), ...G.structsOf(1 - p)];
      for (const tgt of targets) {
        const from = tiles.filter((t) => G.dist(t, tgt) <= rp);
        if (!from.length) continue;
        from.sort((a, b) => (tileSafety(G, threats, a) - tileSafety(G, threats, b)) || (a.cost - b.cost));
        for (const t of from.slice(0, 3)) {
          const acts = [];
          if (!t.stay) acts.push({ type: 'move', unit: u.iid, to: { x: t.x, y: t.y } });
          acts.push({ type: 'attack', unit: u.iid, target: tgt.iid });
          plans.push({ kind: 'attack', actions: acts, unit: u.iid, hitRun: prof.hitAndRun && t.stay });
        }
      }
    }
    // abilities
    for (const ab of G.unitAbilities(u)) {
      if (u.mp < G.abilityCost(u, ab.ab)) continue;
      const spots = [tiles[0], ...tiles.slice(1).sort((a, b) => positional(G, p, u, b, threats) - positional(G, p, u, a, threats)).slice(0, 2)];
      for (const t of spots) {
        const pre = t.stay ? [] : [{ type: 'move', unit: u.iid, to: { x: t.x, y: t.y } }];
        const G1 = pre.length ? simulate(s, p, pre) : G;
        if (!G1) continue;
        const u1 = G1.unit(u.iid);
        if (!u1 || !G1.abilityUsable(u1, ab.key)) continue;
        let combos = G1.targetCombos(ab.ab.targets || [], { p, unit: u.iid }, 60);
        if (combos.length > 6) { shuffleWith(combos, rand); combos = combos.slice(0, 6); }
        for (const c of combos) plans.push({ kind: 'ability', actions: [...pre, { type: 'ability', unit: u.iid, key: ab.key, targets: c }], followup: prof.followups });
      }
    }
    // plain repositioning
    const moveTiles = tiles.filter((t) => !t.stay).sort((a, b) => positional(G, p, u, b, threats) - positional(G, p, u, a, threats)).slice(0, prof.moveTiles);
    for (const t of moveTiles) plans.push({ kind: 'move', actions: [{ type: 'move', unit: u.iid, to: { x: t.x, y: t.y } }, ...(canAtk ? [] : [{ type: 'wait', unit: u.iid }])] });
    if (u.cons && G.consumableUsable(u)) addConsume(G, u, plans, prof);
  }
  return plans;
}

function addConsume(G, u, plans, prof) {
  const d = G.def(u.cons);
  let combos = G.targetCombos(d.use.targets || [], { p: u.owner, unit: u.iid, card: u.cons }, 40);
  if (combos.length > 6) combos = combos.slice(0, 6);
  for (const c of combos) plans.push({ kind: 'consume', actions: [{ type: 'consume', unit: u.iid, targets: c }], followup: prof.followups });
}

function tileScoreForSummon(G, p, t) {
  if (!t) return 0;
  const l = laneOfX(t.x);
  let v = 0;
  v += G.unitsInLane(l, 1 - p).length * 2;
  if (G.laneCtrl(l) === p) v += 1;
  for (const e of G.unitsOf(1 - p)) v -= Math.max(0, 3 - cheb(e, t)) * 0.3;
  v += (p === 0 ? t.y : C.ROWS - 1 - t.y) * 0.2;
  return v;
}

function positional(G, p, u, t, threats) {
  const d = G.def(u.cardId);
  const aggro = AGGRO[d.cls] ?? 0.7;
  let v = 0;
  let best = 99;
  for (const st of G.structsOf(1 - p)) best = Math.min(best, G.dist(t, st));
  for (const e of G.unitsOf(1 - p)) best = Math.min(best, cheb(t, e));
  G.s.lanes.forEach((ln, l) => { if (ln.ctrl === 1 - p && !G.structInLane(l)) best = Math.min(best, Math.abs(laneOfX(t.x) - l) * 2 + 1); });
  v -= Math.min(best, 10) * aggro;
  v -= tileSafety(G, threats, t) * 0.4;
  return v;
}

function shuffleWith(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Best immediate attack (no movement) — used to value buffs and setups.
function bestFollowup(G, p, prof) {
  let best = { score: evaluate(G, p, prof), actions: [] };
  for (const u of G.unitsOf(p)) {
    if (!G.canAttack(u)) continue;
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

// Retreat after attacking (hit-and-run)
function bestRetreat(G, p, uid, prof) {
  const u = G.unit(uid);
  if (!u || u.state === 'done') return null;
  const threats = threatMap(G, 1 - p);
  const reach = [...G.reachable(u).values()].map((r) => r.path[r.path.length - 1]);
  if (!reach.length) return null;
  reach.sort((a, b) => tileSafety(G, threats, a) - tileSafety(G, threats, b));
  let best = null;
  for (const t of reach.slice(0, 3)) {
    const acts = [{ type: 'move', unit: uid, to: t }];
    const G2 = simulate(G.s, p, acts);
    if (!G2) continue;
    const sc = evaluate(G2, p, prof);
    if (!best || sc > best.score) best = { score: sc, actions: acts };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function aiMulligan(state, p) {
  const G = new Game(clone(state));
  const hand = G.P(p).hand.map((i) => G.def(i));
  const cheapIds = hand.filter((d) => d.type === 'Identity' && d.cost <= 3).length;
  const avg = hand.reduce((n, d) => n + d.cost, 0) / Math.max(1, hand.length);
  return cheapIds === 0 || avg > 3.3;
}

export function aiPlan(state, p, difficulty = 5, seed = 1) {
  const prof = difficultyProfile(difficulty);
  const rand = makeRand(seed ^ (state.turnSerial * 7919) ^ (state.nextId * 31));
  const G = new Game(clone(state));
  G.noUndo = true;
  if (G.s.phase === 'mulligan') return [{ type: 'mulligan', redraw: aiMulligan(state, p) }];
  if (G.s.chain.length && G.s.priority === p) return [aiRespond(state, p, difficulty, seed)];
  if (G.s.active !== p || G.s.winner !== null) return [];

  const baseline = evaluate(G, p, prof);
  const plans = candidatePlans(G, p, prof, rand);
  const scored = [];
  for (const plan of plans) {
    const G2 = simulate(state, p, plan.actions);
    if (!G2) continue;
    let sc = evaluate(G2, p, prof);
    let actions = plan.actions;
    if (plan.followup && G2.s.winner === null) {
      const f = bestFollowup(G2, p, prof);
      if (f.actions.length && f.score > sc) { sc = f.score - 0.2; actions = [...actions, ...f.actions]; }
    }
    if (plan.hitRun && G2.s.winner === null) {
      const r = bestRetreat(G2, p, plan.unit, prof);
      if (r && r.score > sc + 0.5) { sc = r.score; actions = [...actions, ...r.actions]; }
    }
    const noise = prof.noise ? (rand() + rand() + rand() - 1.5) * prof.noise : 0;
    scored.push({ plan, actions, score: sc, noisy: sc + noise });
  }
  if (!scored.length) return [{ type: 'endTurn' }];
  scored.sort((a, b) => b.noisy - a.noisy);
  // Depth-2: re-score the best few plans by the best plan that could follow them this turn.
  if (prof.lookahead) {
    for (const cand of scored.slice(0, prof.lookahead)) {
      const G2 = simulate(state, p, cand.actions);
      if (!G2 || G2.s.winner !== null || G2.s.active !== p) continue;
      const next = candidatePlans(G2, p, { ...prof, tileSample: 0.6, moveTiles: 3, comboLimit: 6 }, rand);
      let best = cand.score;
      for (const plan of next.slice(0, prof.lookaheadWidth)) {
        const G3 = simulate(G2.s, p, plan.actions);
        if (G3) best = Math.max(best, evaluate(G3, p, prof));
      }
      cand.noisy = cand.score * 0.35 + best * 0.65;
    }
    scored.sort((a, b) => b.noisy - a.noisy);
  }
  if (prof.lazy && rand() < prof.lazy && G.s.turnSerial > 2) return [{ type: 'endTurn' }];
  let pick = scored[0];
  if (prof.blunder && rand() < prof.blunder) {
    const ok = scored.filter((x) => x.score > baseline - 3).slice(0, 5);
    if (ok.length) pick = ok[Math.floor(rand() * ok.length)];
  }
  const threshold = pick.plan.kind === 'move' ? 0.35 : 0.05;
  if (pick.score <= baseline + threshold) {
    const f = forageChoice(G, p);
    if (f) return [f];
    return [{ type: 'endTurn' }];
  }
  return pick.actions;
}

// Forage away the least useful card when there is nothing better to do.
function forageChoice(G, p) {
  if (!G.canForage(p)) return null;
  const P = G.P(p);
  const zonesInHand = P.hand.some((i) => G.def(i).type === 'Zone');
  let worst = null;
  let worstScore = Infinity;
  for (const iid of P.hand) {
    const d = G.def(iid);
    let v = 5 - Math.max(0, d.cost - P.sapMax) * 2;
    if (d.type === 'Structure' && !G.structLanes(p).length && !zonesInHand) v -= 4;
    if (d.type === 'Identity' && !G.summonTiles(p).length) v -= 2;
    if (G.canPlay(p, iid)) v += 3;
    if (v < worstScore) { worstScore = v; worst = iid; }
  }
  if (worstScore > 3 && P.hand.length < 7) return null;
  return worst ? { type: 'forage', iid: worst } : null;
}

export function aiRespond(state, p, difficulty = 5, seed = 1) {
  const prof = difficultyProfile(difficulty);
  if (!prof.responses) return { type: 'pass' };
  const G = new Game(clone(state));
  G.noUndo = true;
  const passG = simulate(state, p, [{ type: 'pass' }]);
  const passScore = passG ? evaluate(passG, p, prof) : -Infinity;
  let best = { score: passScore + 1.5, action: { type: 'pass' } };
  for (const iid of G.P(p).hand) {
    if (!G.canPlay(p, iid)) continue;
    const combos = G.targetCombos(G.playSpecs(iid), { p, card: iid }, 30);
    for (const t of combos) {
      const a = { type: 'play', iid, targets: t };
      const G2 = simulate(state, p, [a]);
      if (!G2) continue;
      const sc = evaluate(G2, p, prof);
      if (sc > best.score) best = { score: sc, action: a };
    }
  }
  return best.action;
}
