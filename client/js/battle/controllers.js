// Match controllers. LocalMatch runs the engine in the browser against AI bots
// (any format); OnlineMatch mirrors a server-authoritative match over WebSockets.
import { createMatch, Game, viewFor } from '../../../shared/engine.js';
import { aiPlan } from '../../../shared/ai.js';
import { randomSeed } from '../../../shared/rng.js';

let worker = null;
let workerFailed = false;
let reqId = 0;
const pending = new Map();
function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) { console.error('AI worker error', e.data.error); p.resolve(null); } else p.resolve(e.data.plan);
    };
    worker.onerror = (e) => { console.warn('AI worker unavailable, using main thread', e.message); workerFailed = true; worker = null; for (const p of pending.values()) p.resolve(null); pending.clear(); };
  } catch { workerFailed = true; worker = null; }
  return worker;
}

// players: [{ name, avatar, deck, bot, difficulty }] in seat order; seat 0 is the human.
export class LocalMatch {
  constructor({ players, format = '1v1', first = null, seed = randomSeed() }) {
    this.mode = 'ai';
    this.seat = 0;
    this.difficulties = players.map((p) => p.difficulty || 5);
    this.bots = players.map((p, i) => i !== 0 && p.bot !== false);
    const f = first ?? Math.floor(Math.random() * players.length);
    this.state = createMatch({ seed, format, first: f, players: players.map((p, i) => ({ name: p.name, deck: p.deck, avatar: p.avatar, bot: i !== 0 })) });
    this.game = new Game(this.state);
    this.aiSeed = seed;
  }
  view() { return viewFor(this.state, this.seat); }
  apply(seat, action) { return this.game.act(seat, action); }
  // Which bot (if any) has to act now
  actingBot() {
    const s = this.state;
    if (s.phase === 'over') return -1;
    const p = s.chain.length ? s.priority : s.active;
    if (p === null || p === undefined) return -1;
    return this.bots[p] && !s.players[p].eliminated ? p : -1;
  }
  needsAI() { return this.actingBot() >= 0; }
  async think(p) {
    const snapshot = JSON.parse(JSON.stringify({ ...this.state, undo: null }));
    const seed = (this.aiSeed = (this.aiSeed * 1103515245 + 12345) >>> 0);
    const difficulty = this.difficulties[p];
    const w = getWorker();
    if (w) {
      const id = ++reqId;
      const plan = await new Promise((resolve) => {
        pending.set(id, { resolve });
        w.postMessage({ id, state: snapshot, p, difficulty, seed });
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, 20000);
      });
      if (plan) return plan;
    }
    await new Promise((r) => setTimeout(r, 30));
    return aiPlan(snapshot, p, difficulty, seed);
  }
  dispose() {}
}

export class OnlineMatch {
  constructor(net, { seat, matchId }) {
    this.mode = 'online';
    this.net = net;
    this.seat = seat;
    this.matchId = matchId;
  }
  send(action) { this.net.send({ t: 'act', action }); }
  dispose() {}
}
