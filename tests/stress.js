// Stress test: many AI games across difficulties with random decks, looking for engine errors.
import { playGame } from './simulate.js';
const n = +(process.argv[2] || 20);
let errs = 0;
const wins = [0, 0];
let rounds = 0;
const reasons = {};
for (let i = 0; i < n; i++) {
  const dA = 1 + (i % 10), dB = 10 - (i % 10);
  try {
    const r = playGame({ seed: 5000 + i * 17, diffs: [dA, dB] });
    if (r.winner !== null) wins[r.winner]++;
    rounds += r.rounds;
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    if (r.errors.length) { errs += r.errors.length; console.log('game', i, 'soft errors', r.errors.slice(0, 5)); }
    console.log(`game ${i} d${dA} vs d${dB}: winner=${r.winner} ${r.reason} rounds=${r.rounds} renown=${r.renown} ${r.ms}ms`);
  } catch (e) {
    errs++;
    console.log('game', i, 'CRASH', e.stack);
  }
}
console.log('done', { wins, avgRounds: (rounds / n).toFixed(1), errs, reasons });
