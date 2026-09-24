import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, Game, viewFor } from '../shared/engine.js';
import { allCards } from '../shared/cards.js';
import * as C from '../shared/constants.js';

const id = (name) => allCards().find((c) => c.name === name).id;
const filler = (n = 60) => Array.from({ length: n }, () => id('Leafcutter Ant'));

// Build a started match (both keep) and return the game
function setup(deckA = filler(), deckB = filler(), first = 0) {
  const s = createMatch({ seed: 99, first, players: [{ name: 'A', deck: deckA }, { name: 'B', deck: deckB }] });
  const G = new Game(s);
  assert.ok(G.act(0, { type: 'mulligan', redraw: false }).ok);
  assert.ok(G.act(1, { type: 'mulligan', redraw: false }).ok);
  return G;
}
function giveCard(G, p, name) {
  const iid = G.newInst(id(name), p);
  G.P(p).hand.push(iid);
  return iid;
}
function place(G, p, name, x, y) {
  const iid = G.newInst(id(name), p);
  const u = G.makeUnit(iid, p, x, y);
  G.s.units[iid] = u;
  G.dirty();
  return u;
}

test('match starts with homelands, base camps and correct Sap', () => {
  const G = setup();
  const s = G.s;
  assert.equal(s.phase, 'play');
  assert.equal(s.lanes[C.HOME_LANES[0]].ctrl, 0);
  assert.equal(s.lanes[C.HOME_LANES[1]].ctrl, 1);
  assert.equal(Object.keys(s.structs).length, 2);
  assert.equal(G.P(0).sap, C.SAP_START);
  assert.equal(G.P(0).hand.length, C.START_HAND); // first player does not draw
  assert.equal(G.P(0).renown, 1); // base camp lane
});

test('summon, move and attack with retaliation', () => {
  const G = setup();
  const card = giveCard(G, 0, 'Barkhide Badger');
  const tiles = G.summonTiles(0);
  assert.ok(tiles.length > 0);
  let r = G.act(0, { type: 'play', iid: card, targets: [{ x: tiles[0].x, y: tiles[0].y }] });
  assert.ok(r.ok, r.error);
  const u = G.unit(card);
  assert.ok(u);
  assert.equal(G.P(0).sap, C.SAP_START - 2);
  // put an enemy next to it
  const e = place(G, 1, 'Nesting Heron', u.x, u.y + 1);
  const before = e.bp;
  r = G.act(0, { type: 'attack', unit: u.iid, target: e.iid });
  assert.ok(r.ok, r.error);
  const dmg = r.events.filter((x) => x.t === 'damage' && x.target === e.iid).reduce((a, x) => a + x.amount, 0);
  assert.ok(dmg >= 1);
  if (G.unit(e.iid)) {
    assert.equal(G.unit(e.iid).bp, before - dmg);
    assert.ok(r.events.some((x) => x.t === 'retaliate'), 'survivor retaliates');
  }
  // cannot attack twice
  assert.equal(G.act(0, { type: 'attack', unit: u.iid, target: e.iid }).ok, false);
});

test('movement respects AP and undo restores the move', () => {
  const G = setup();
  const u = place(G, 0, 'Burrow Rabbit', 0, 1);
  const reach = G.reachable(u);
  assert.ok(reach.size > 0);
  const far = [...reach.values()].sort((a, b) => b.cost - a.cost)[0];
  assert.ok(far.cost <= G.moveBudget(u));
  const to = far.path[far.path.length - 1];
  let r = G.act(0, { type: 'move', unit: u.iid, to });
  assert.ok(r.ok, r.error);
  assert.deepEqual({ x: G.unit(u.iid).x, y: G.unit(u.iid).y }, to);
  assert.ok(G.s.undo);
  r = G.act(0, { type: 'undo' });
  assert.ok(r.ok);
  assert.deepEqual({ x: G.unit(u.iid).x, y: G.unit(u.iid).y }, { x: 0, y: 1 });
  // cannot move into an occupied tile or beyond budget
  place(G, 1, 'Leafcutter Ant', 0, 2);
  assert.equal(G.act(0, { type: 'move', unit: u.iid, to: { x: 0, y: 2 } }).ok, false);
  assert.equal(G.act(0, { type: 'move', unit: u.iid, to: { x: 9, y: 7 } }).ok, false);
});

test('zones claim lanes; structures build on controlled lanes; capture needs a raider in the enemy half', () => {
  const G = setup();
  G.P(0).sap = 10;
  const z = giveCard(G, 0, 'Dewfall Glade');
  assert.ok(G.zoneLanes(0).includes(0));
  assert.ok(!G.zoneLanes(0).includes(C.HOME_LANES[1]), 'cannot take enemy lane with a structure');
  assert.ok(G.act(0, { type: 'play', iid: z, targets: [0] }).ok);
  assert.equal(G.s.lanes[0].ctrl, 0);
  const st = giveCard(G, 0, 'Moss Hut');
  assert.ok(G.act(0, { type: 'play', iid: st, targets: [0] }).ok);
  assert.ok(G.structInLane(0));
  // enemy lane without structure: needs raider in enemy half
  const enemyZone = G.newInst(id('Misty Hollow'), 1);
  G.s.lanes[4].zone = enemyZone; G.s.lanes[4].ctrl = 1; G.dirty();
  assert.ok(!G.zoneLanes(0).includes(4));
  place(G, 0, 'Leafcutter Ant', 8, 5); // enemy half for player 1 is y >= 4
  assert.ok(G.zoneLanes(0).includes(4));
  const z2 = giveCard(G, 0, 'Contested Border');
  const ren = G.P(0).renown;
  assert.ok(G.act(0, { type: 'play', iid: z2, targets: [4] }).ok);
  assert.equal(G.s.lanes[4].ctrl, 0);
  assert.equal(G.P(0).renown, ren + C.RENOWN_CAPTURE);
});

test('destroying a structure grants renown', () => {
  const G = setup();
  const st = G.structInLane(C.HOME_LANES[1]);
  st.bp = 1;
  const u = place(G, 0, 'Stoat Stalker', C.HOME_LANES[1] * 2, 7);
  const ren = G.P(0).renown;
  const r = G.act(0, { type: 'attack', unit: u.iid, target: st.iid });
  assert.ok(r.ok, r.error);
  assert.ok(!G.structInLane(C.HOME_LANES[1]));
  assert.equal(G.P(0).renown, ren + C.RENOWN_STRUCTURE_KILL);
});

test('liberation at end of turn clears an undefended enemy lane', () => {
  const G = setup();
  const z = G.newInst(id('Misty Hollow'), 1);
  G.s.lanes[4].zone = z; G.s.lanes[4].ctrl = 1; G.dirty();
  place(G, 0, 'Leafcutter Ant', 9, 6);
  G.act(0, { type: 'endTurn' });
  assert.equal(G.s.lanes[4].ctrl, null);
});

test('response chain: Brace gives a barrier before the attack resolves', () => {
  const G = setup();
  const a = place(G, 0, 'Stoat Stalker', 4, 3);
  const d = place(G, 1, 'Mossback Tortoise', 4, 4);
  const brace = giveCard(G, 1, 'Brace');
  G.P(1).sap = 3;
  let r = G.act(0, { type: 'attack', unit: a.iid, target: d.iid });
  assert.ok(r.ok);
  assert.equal(G.s.priority, 1, 'defender gets priority');
  assert.equal(G.act(0, { type: 'endTurn' }).ok, false, 'attacker must wait');
  r = G.act(1, { type: 'play', iid: brace, targets: [d.iid] });
  assert.ok(r.ok, r.error);
  assert.equal(G.s.chain.length, 0, 'chain resolved');
  const blocked = r.events.filter((e) => e.t === 'damage' && e.target === d.iid).reduce((n, e) => n + e.blocked, 0);
  assert.equal(blocked, 2);
});

test('push into an occupied tile deals collision damage', () => {
  const G = setup();
  const pusher = place(G, 0, 'Streamrunner Otter', 4, 2);
  const target = place(G, 1, 'Leafcutter Ant', 4, 3);
  place(G, 1, 'Leafcutter Ant', 4, 4);
  const bp = target.bp;
  G.push(target, pusher, 1, 0, { srcUnit: pusher.iid });
  assert.equal(G.unit(target.iid)?.bp ?? 0, bp - C.COLLISION_DAMAGE);
});

test('forage discards a card and draws a new one once per turn', () => {
  const G = setup();
  const n = G.P(0).hand.length;
  const card = G.P(0).hand[0];
  assert.ok(G.act(0, { type: 'forage', iid: card }).ok);
  assert.equal(G.P(0).hand.length, n);
  assert.ok(G.P(0).discard.includes(card));
  assert.equal(G.act(0, { type: 'forage', iid: G.P(0).hand[0] }).ok, false);
});

test('views hide the opponent hand and decks', () => {
  const G = setup();
  const v = viewFor(G.s, 0);
  assert.ok(v.players[1].hand.every((h) => h === null));
  assert.equal(v.players[0].deck.length, 0);
  assert.ok(v.players[0].deckCount > 0);
});

test('reaching the renown target wins', () => {
  const G = setup();
  G.P(0).renown = C.WIN_RENOWN - 1;
  G.gainRenown(0, 1, 'test');
  assert.equal(G.s.winner, 0);
  assert.equal(G.s.phase, 'over');
});
