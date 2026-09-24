// Headless AI-vs-AI simulation. Usage: node tests/simulate.js [games] [diffA] [diffB]
import { createMatch, Game } from '../shared/engine.js';
import { aiPlan } from '../shared/ai.js';
import { starterDeck, rivalDeck, RIVALS, deckToList, buildDeck } from '../shared/decks.js';
import { makeRng } from '../shared/rng.js';

export function playGame({ seed = 1, diffs = [5, 5], decks = null, maxActions = 4000, verbose = false } = {}) {
  const rng = makeRng(seed);
  const dA = decks ? decks[0] : deckToList(buildDeck(rng, { quality: 0.4 }));
  const dB = decks ? decks[1] : deckToList(buildDeck(rng, { quality: 0.4 }));
  const state = createMatch({ seed, players: [{ name: 'A', deck: dA }, { name: 'B', deck: dB }], first: seed % 2 });
  const G = new Game(state);
  G.noUndo = true;
  let actions = 0;
  let errors = [];
  const t0 = Date.now();
  let plansThisTurn = 0;
  let lastSerial = -1;
  while (state.winner === null && actions < maxActions) {
    let p;
    if (state.phase === 'mulligan') p = state.players[0].mulligan ? 1 : 0;
    else if (state.chain.length) p = state.priority;
    else p = state.active;
    if (state.turnSerial !== lastSerial) { lastSerial = state.turnSerial; plansThisTurn = 0; }
    let plan = aiPlan(state, p, diffs[p], seed + actions);
    if (++plansThisTurn > 60 && !state.chain.length) plan = [{ type: 'endTurn' }];
    if (!plan.length) plan = [state.chain.length ? { type: 'pass' } : { type: 'endTurn' }];
    for (const a of plan) {
      const who = state.chain.length && state.priority !== null ? state.priority : p;
      const r = G.act(who === p ? p : who, a);
      actions++;
      if (!r.ok) {
        errors.push(`${r.error} :: ${JSON.stringify(a)}`);
        if (r.error.startsWith('Engine error')) throw new Error(r.error);
        break;
      }
      // opponent auto-responds via AI
      let guard = 0;
      while (state.chain.length && state.priority !== null && guard++ < 6) {
        const q = state.priority;
        const [resp] = aiPlan(state, q, diffs[q], seed + actions);
        const r2 = G.act(q, resp || { type: 'pass' });
        if (!r2.ok) G.act(q, { type: 'pass' });
      }
      if (state.winner !== null) break;
    }
  }
  const out = {
    winner: state.winner, reason: state.winReason, rounds: state.round, actions,
    renown: state.players.map((P) => P.renown), ms: Date.now() - t0, errors, stats: state.stats,
  };
  if (verbose) console.log(state.log.slice(-15).join('\n'));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 4);
  const dA = +(process.argv[3] || 5);
  const dB = +(process.argv[4] || 5);
  const res = [];
  for (let i = 0; i < n; i++) {
    const r = playGame({ seed: 1000 + i, diffs: [dA, dB], verbose: process.env.VERBOSE === '1' });
    res.push(r);
    console.log(`game ${i}: winner=${r.winner} (${r.reason}) rounds=${r.rounds} renown=${r.renown} actions=${r.actions} ${r.ms}ms errs=${r.errors.length}`, r.errors.slice(0, 3));
  }
  const wins = [0, 0];
  res.forEach((r) => r.winner !== null && wins[r.winner]++);
  console.log('wins', wins, 'avg rounds', (res.reduce((a, r) => a + r.rounds, 0) / n).toFixed(1));
}
