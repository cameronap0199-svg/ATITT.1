import test from 'node:test';
import assert from 'node:assert/strict';
import { playGame } from './simulate.js';

test('AI vs AI games finish without engine errors', () => {
  for (const [i, diffs] of [[1, [2, 8]], [2, [6, 6]], [3, [9, 3]]]) {
    const r = playGame({ seed: 4242 + i, diffs, maxActions: 3000 });
    assert.notEqual(r.winner, null, 'game ' + i + ' has a winner');
    const hard = r.errors.filter((e) => e.startsWith('Engine error'));
    assert.equal(hard.length, 0, hard.join('\n'));
  }
});
