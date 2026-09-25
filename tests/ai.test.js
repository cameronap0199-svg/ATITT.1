import test from 'node:test';
import assert from 'node:assert/strict';
import { playGame } from './simulate.js';

test('AI vs AI games finish without engine errors', () => {
  for (const [i, diffs, format] of [[1, [2, 8], '1v1'], [2, [6, 6], '1v1'], [3, [5, 5], 'ffa3']]) {
    const r = playGame({ seed: 4242 + i, diffs, format, maxActions: 4000 });
    assert.notEqual(r.winner, null, 'game ' + i + ' has a winner');
    assert.ok(r.winners.length >= 1);
    const hard = r.errors.filter((e) => e.startsWith('Engine error'));
    assert.equal(hard.length, 0, hard.join('\n'));
  }
});
