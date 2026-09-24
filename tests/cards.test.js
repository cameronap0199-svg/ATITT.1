import test from 'node:test';
import assert from 'node:assert/strict';
import { allCards, getCard, allSharedAbilities } from '../shared/cards.js';
import * as C from '../shared/constants.js';
import { starterDeck, validateDeck, RIVALS, rivalDeck, deckSize } from '../shared/decks.js';
import { makeRng } from '../shared/rng.js';

test('set has 280 cards with the documented type distribution', () => {
  const cards = allCards();
  assert.equal(cards.length, 280);
  const byType = {};
  for (const c of cards) byType[c.type] = (byType[c.type] || 0) + 1;
  assert.deepEqual(byType, { Identity: 85, Zone: 35, Structure: 35, Equipment: 35, Consumable: 25, Action: 40, Event: 25 });
});

test('each Class slot has 56 cards with the documented rarity structure', () => {
  for (let c = 0; c < 5; c++) {
    const cards = allCards().filter((x) => x.classIndex === c);
    assert.equal(cards.length, 56);
    const r = {};
    for (const x of cards) r[x.rarity] = (r[x.rarity] || 0) + 1;
    assert.deepEqual(r, { Base: 14, Bronze: 12, Silver: 10, Gold: 9, Crystal: 6, Void: 4, Infinite: 1 });
    // per-type counts per class
    const t = {};
    for (const x of cards) t[x.type] = (t[x.type] || 0) + 1;
    assert.deepEqual(t, { Identity: 17, Zone: 7, Structure: 7, Equipment: 7, Consumable: 5, Action: 8, Event: 5 });
    // classes belong to the right type-specific class system
    for (const x of cards) assert.equal(x.cls, C.CLASSES[x.type][c]);
  }
});

test('Infinite rarity is exclusive to Identities', () => {
  for (const c of allCards()) if (c.rarity === 'Infinite') assert.equal(c.type, 'Identity');
});

test('card names are unique and every card has rules text', () => {
  const names = new Set();
  for (const c of allCards()) {
    assert.ok(!names.has(c.name), 'duplicate ' + c.name);
    names.add(c.name);
    assert.ok(c.text && c.text.length > 5, c.name + ' has text');
    assert.ok(C.FACTIONS.includes(c.faction), c.name + ' faction');
    assert.ok(C.ARCHETYPES.includes(c.archetype), c.name + ' archetype');
  }
});

test('all 75 Class + Archetype shared abilities exist and every Identity has one', () => {
  const sh = allSharedAbilities();
  assert.equal(Object.keys(sh).length, 75);
  for (const cls of C.CLASSES.Identity) for (const a of C.ARCHETYPES) assert.ok(sh[cls + ':' + a], cls + ':' + a);
  for (const c of allCards().filter((x) => x.type === 'Identity')) {
    assert.ok(c.shared && c.shared.name, c.name);
    assert.ok(c.unique, c.name + ' unique');
  }
});

test('every Identity class covers all 15 archetypes', () => {
  for (const cls of C.CLASSES.Identity) {
    const archs = new Set(allCards().filter((c) => c.cls === cls).map((c) => c.archetype));
    assert.equal(archs.size, 15, cls);
  }
});

test('identity stats follow ISB x class weight', () => {
  const c = getCard(allCards().find((x) => x.name === 'Canopy Owl').id);
  const B = C.ISB_BASE + C.ISB_PER_COST * c.cost + C.RARITY_ISB_BONUS[c.rarity];
  assert.equal(c.isb, B);
  assert.equal(c.stats.bp, Math.round(B * C.CLASS_WEIGHTS.Silviculturist.bp));
});

test('starter deck is legal and made of Base/Bronze cards', () => {
  const d = starterDeck();
  assert.equal(deckSize(d), 60);
  assert.ok(validateDeck(d).ok);
  for (const id of Object.keys(d)) assert.ok(['Base', 'Bronze'].includes(getCard(id).rarity), getCard(id).name);
});

test('rival decks are legal', () => {
  const rng = makeRng(7);
  for (const r of RIVALS) {
    const d = rivalDeck(r, rng);
    const v = validateDeck(d);
    assert.ok(v.ok, r.name + ': ' + v.errors.join(','));
  }
});
