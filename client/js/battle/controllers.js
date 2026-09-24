// Match controllers. LocalMatch runs the engine in the browser vs an AI rival;
// OnlineMatch mirrors a server-authoritative match over WebSockets.
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
  } catch (e) { workerFailed = true; worker = null; }
  return worker;
}

export class LocalMatch {
  constructor({ me, foe, difficulty, first = null, seed = randomSeed() }) {
    this.mode = 'ai';
    this.seat = 0;
    this.difficulty = difficulty;
    this.state = createMatch({ seed, first: first ?? (Math.random() < 0.5 ? 0 : 1), players: [me, { ...foe, bot: true }] });
    this.game = new Game(this.state);
    this.aiSeed = seed;
  }
  view() { return viewFor(this.state, this.seat); }
  apply(seat, action) { return this.game.act(seat, action); }
  needsAI() {
    const s = this.state;
    if (s.phase === 'over') return false;
    if (s.phase === 'mulligan') return !s.players[1].mulligan;
    if (s.chain.length) return s.priority === 1;
    return s.active === 1;
  }
  async think() {
    const snapshot = JSON.parse(JSON.stringify({ ...this.state, undo: null }));
    const seed = (this.aiSeed = (this.aiSeed * 1103515245 + 12345) >>> 0);
    const w = getWorker();
    if (w) {
      const id = ++reqId;
      const plan = await new Promise((resolve) => {
        pending.set(id, { resolve });
        w.postMessage({ id, state: snapshot, p: 1, difficulty: this.difficulty, seed });
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, 20000);
      });
      if (plan) return plan;
    }
    await new Promise((r) => setTimeout(r, 30));
    return aiPlan(snapshot, 1, this.difficulty, seed);
  }
  dispose() {}
}

export class OnlineMatch {
  constructor(net, { seat, opponent, matchId }) {
    this.mode = 'online';
    this.net = net;
    this.seat = seat;
    this.opponent = opponent;
    this.matchId = matchId;
    this.latest = null;
    this.listeners = [];
  }
  send(action) { this.net.send({ t: 'act', action }); }
  dispose() {}
}
