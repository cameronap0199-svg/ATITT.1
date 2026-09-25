// Headless AI-vs-AI simulation. Usage: node tests/simulate.js [games] [diffA] [diffB] [format]
import { createMatch, Game } from '../shared/engine.js';
import { aiPlan } from '../shared/ai.js';
import { deckToList, buildDeck } from '../shared/decks.js';
import { makeRng } from '../shared/rng.js';
import { FORMATS } from '../shared/constants.js';

export function playGame({ seed = 1, diffs = [5, 5], format = '1v1', decks = null, maxActions = 6000, verbose = false } = {}) {
  const rng = makeRng(seed);
  const n = FORMATS[format].players;
  const players = [];
  for (let i = 0; i < n; i++) players.push({ name: 'P' + i, deck: decks ? decks[i] : deckToList(buildDeck(rng, { quality: 0.4 })), bot: true });
  const state = createMatch({ seed, players, format, first: seed % n });
  const G = new Game(state);
  G.noUndo = true;
  const diff = (p) => diffs[p % diffs.length];
  let actions = 0;
  const errors = [];
  const t0 = Date.now();
  let plansThisTurn = 0;
  let lastSerial = -1;
  const respond = () => {
    let guard = 0;
    while (state.chain.length && state.priority !== null && guard++ < 12) {
      const q = state.priority;
      const [resp] = aiPlan(state, q, diff(q), seed + actions);
      const r2 = G.act(q, resp || { type: 'pass' });
      if (!r2.ok) G.act(q, { type: 'pass' });
    }
  };
  while (state.winner === null && actions < maxActions) {
    const p = state.chain.length ? state.priority : state.active;
    if (state.turnSerial !== lastSerial) { lastSerial = state.turnSerial; plansThisTurn = 0; }
    let plan = aiPlan(state, p, diff(p), seed + actions);
    if (++plansThisTurn > 80 && !state.chain.length && state.phase === 'play') plan = [{ type: 'endTurn' }];
    if (!plan.length) plan = [state.chain.length ? { type: 'pass' } : state.phase === 'setup' ? { type: 'ready' } : { type: 'endTurn' }];
    for (const a of plan) {
      if (state.chain.length && state.priority !== p) break; // someone else must respond first
      const r = G.act(p, a);
      actions++;
      if (!r.ok) {
        errors.push(`${r.error} :: ${JSON.stringify(a).slice(0, 160)}`);
        if (r.error.startsWith('Engine error')) throw new Error(r.error);
        break;
      }
      respond();
      if (state.winner !== null || state.active !== p) break;
    }
  }
  const out = {
    winner: state.winner, winners: state.winners, reason: state.winReason, rounds: state.round, actions,
    ms: Date.now() - t0, errors, stats: state.stats,
    left: state.players.map((P, i) => (P.eliminated ? 'x' : `${G.structsOf(i).length}s/${G.unitsOf(i).length}u`)).join(' '),
  };
  if (verbose) console.log(state.log.slice(-20).join('\n'));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 4);
  const dA = +(process.argv[3] || 5);
  const dB = +(process.argv[4] || 5);
  const format = process.argv[5] || '1v1';
  const res = [];
  for (let i = 0; i < n; i++) {
    const r = playGame({ seed: 1000 + i, diffs: [dA, dB], format, verbose: process.env.VERBOSE === '1' });
    res.push(r);
    console.log(`game ${i}: winners=${r.winners} (${r.reason}) rounds=${r.rounds} left=[${r.left}] actions=${r.actions} ${r.ms}ms errs=${r.errors.length}`, r.errors.slice(0, 3));
  }
  const wins = {};
  res.forEach((r) => { const k = r.winners.join('+'); wins[k] = (wins[k] || 0) + 1; });
  console.log('wins', wins, 'avg rounds', (res.reduce((a, r) => a + r.rounds, 0) / n).toFixed(1));
}
