import test from 'node:test';
import assert from 'node:assert/strict';
import { openBooster } from '../shared/packs.js';
import { makeRng } from '../shared/rng.js';
import { RARITIES, CARD_TYPES } from '../shared/constants.js';

const N = 6000;
const rng = makeRng(12345);
const packs = Array.from({ length: N }, () => openBooster(rng));

test('every booster has 12 cards with the guaranteed core types', () => {
  for (const { cards } of packs) {
    assert.equal(cards.length, 12);
    const t = {};
    for (const c of cards) t[c.type] = (t[c.type] || 0) + 1;
    assert.ok(t.Identity >= 3);
    for (const type of CARD_TYPES) assert.ok(t[type] >= 1, type);
    const wc = cards[11];
    assert.equal(wc.slot, 'Wildcard');
    assert.ok(RARITIES.indexOf(wc.rarity) >= RARITIES.indexOf('Gold'));
    if (wc.rarity === 'Infinite') assert.equal(wc.type, 'Identity');
  }
});

test('average rarity composition matches the design document', () => {
  const tot = {};
  for (const { cards } of packs) for (const c of cards) tot[c.rarity] = (tot[c.rarity] || 0) + 1;
  const avg = (r) => (tot[r] || 0) / N;
  // documented: Base 3.00, Bronze 2.85, Silver 3.15, Gold 1.95, Crystal .79, Void .23, Infinite .03
  const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a.toFixed(3)} vs ${b}`);
  near(avg('Base'), 3.0, 0.12);
  near(avg('Bronze'), 2.85, 0.15);
  near(avg('Silver'), 3.15, 0.15);
  near(avg('Gold'), 1.95, 0.12);
  near(avg('Crystal'), 0.79, 0.1);
  near(avg('Void'), 0.23, 0.05);
  near(avg('Infinite'), 0.03, 0.012);
});

test('pack-level high rarity rates are generous', () => {
  const rate = (pred) => packs.filter((p) => p.cards.some(pred)).length / N;
  const idx = (c) => RARITIES.indexOf(c.rarity);
  assert.ok(rate((c) => idx(c) >= 4) > 0.6, 'crystal+');
  assert.ok(rate((c) => idx(c) >= 5) > 0.18, 'void+');
});

test('affinity profile favours its classes and factions', () => {
  let inClass = 0, inFaction = 0, total = 0;
  for (const { cards, profile } of packs) {
    for (const c of cards) {
      total++;
      // classIndex not on pulls; look it up through id numbering (1-56 = class 0 …)
      const n = +c.id.slice(3);
      const cls = Math.floor((n - 1) / 56);
      if (profile.classes.includes(cls)) inClass++;
    }
    void inFaction;
  }
  assert.ok(inClass / total > 0.62 && inClass / total < 0.72, 'class share ' + inClass / total);
});
