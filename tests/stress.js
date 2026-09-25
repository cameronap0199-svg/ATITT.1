// Stress test: many AI games across difficulties and formats with random decks, looking for engine errors.
import { playGame } from './simulate.js';
const n = +(process.argv[2] || 20);
const formats = (process.argv[3] || '1v1,ffa3,2v2,ffa4').split(',');
let errs = 0;
let rounds = 0;
const reasons = {};
for (let i = 0; i < n; i++) {
  const format = formats[i % formats.length];
  const dA = 1 + (i % 10), dB = 10 - (i % 10);
  try {
    const r = playGame({ seed: 5000 + i * 17, diffs: [dA, dB], format });
    rounds += r.rounds;
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    if (r.errors.length) { errs += r.errors.length; console.log('game', i, 'soft errors', r.errors.slice(0, 5)); }
    console.log(`game ${i} ${format} d${dA}/d${dB}: winners=${r.winners} ${r.reason} rounds=${r.rounds} left=[${r.left}] ${r.ms}ms`);
  } catch (e) {
    errs++;
    console.log('game', i, 'CRASH', e.stack);
  }
}
console.log('done', { avgRounds: (rounds / n).toFixed(1), errs, reasons });
