import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, Game, viewFor, onBoard, laneRect } from '../shared/engine.js';
import { allCards } from '../shared/cards.js';
import * as C from '../shared/constants.js';

const id = (name) => allCards().find((c) => c.name === name).id;
const filler = (n = 60) => Array.from({ length: n }, () => id('Leafcutter Ant'));

// A match that has finished setup (nobody placed Zones) and is on player `first`'s turn.
function setup({ n = 2, format = null, first = 0, decks = null } = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, deck: decks ? decks[i] : filler() }));
  const s = createMatch({ seed: 99, first, players, format });
  const G = new Game(s);
  for (let k = 0; k < n; k++) assert.ok(G.act(s.active, { type: 'ready' }).ok);
  assert.equal(s.phase, 'play');
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
// Zone + Structure for player p in its home lane i; returns { lane, st }
function base(G, p, i = 1, structName = 'Moss Hut') {
  const lane = G.s.lanes.find((ln) => ln.home === p && ln.i === i);
  G.placeZone(p, G.newInst(id('Dewfall Glade'), p), lane.id);
  const t = { x: lane.x0 + 2, y: lane.y0 + (lane.side === 'S' ? 8 : lane.side === 'N' ? 3 : 2) };
  if (lane.side === 'W') { t.x = lane.x0 + 3; t.y = lane.y0 + 2; }
  if (lane.side === 'E') { t.x = lane.x0 + 8; t.y = lane.y0 + 2; }
  G.placeStruct(p, G.newInst(id(structName), p), t);
  return { lane: lane.id, st: G.structInLane(lane.id) };
}

test('battlefield: plus-shaped 39x39 board, 3 home lanes of 5x12 per player, Void in the middle', () => {
  assert.equal(C.SIZE, 39);
  assert.ok(!onBoard(0, 0) && !onBoard(38, 38) && onBoard(19, 19) && onBoard(0, 19) && onBoard(19, 0));
  const G = setup({ n: 4, format: 'ffa4' });
  assert.equal(G.s.lanes.length, 12);
  for (const ln of G.s.lanes) {
    assert.equal(ln.w * ln.h, C.LANE_W * C.LANE_L);
    for (let x = ln.x0; x < ln.x0 + ln.w; x++) for (let y = ln.y0; y < ln.y0 + ln.h; y++) {
      assert.ok(onBoard(x, y));
      assert.equal(G.laneAt(x, y), ln.id);
    }
  }
  assert.ok(G.isVoid(19, 19));
  // a player's three lanes are adjacent
  const s0 = [0, 1, 2].map((i) => laneRect('S', i));
  assert.equal(s0[0].x0 + C.LANE_W, s0[1].x0);
});

test('setup: players may only place Zones into their own Home Lanes, then play starts', () => {
  const s = createMatch({ seed: 5, first: 1, players: [{ name: 'A', deck: filler() }, { name: 'B', deck: filler() }] });
  const G = new Game(s);
  assert.equal(s.phase, 'setup');
  assert.equal(G.P(0).hand.length, C.HAND_SIZE);
  const z = giveCard(G, 1, 'Dewfall Glade');
  const foreign = s.lanes.find((ln) => ln.home === 0).id;
  assert.equal(G.act(1, { type: 'play', iid: z, targets: [foreign] }).ok, false);
  const mine = s.lanes.find((ln) => ln.home === 1).id;
  assert.ok(G.act(1, { type: 'play', iid: z, targets: [mine] }).ok);
  assert.equal(s.lanes[mine].ctrl, 1);
  const st = giveCard(G, 1, 'Moss Hut');
  assert.equal(G.act(1, { type: 'play', iid: st, targets: [{ x: s.lanes[mine].x0, y: s.lanes[mine].y0 }] }).ok, false, 'no building in setup');
  assert.ok(G.act(1, { type: 'ready' }).ok);
  assert.equal(s.active, 0);
  assert.ok(G.act(0, { type: 'ready' }).ok);
  assert.equal(s.phase, 'play');
  assert.equal(s.active, 1);
});

test('turn phases run in order: cards of a passed phase can no longer be played', () => {
  const G = setup();
  const s = G.s;
  const lane = s.lanes.find((ln) => ln.home === 0 && ln.i === 1);
  const zone = giveCard(G, 0, 'Dewfall Glade');
  assert.ok(G.act(0, { type: 'play', iid: zone, targets: [lane.id] }).ok);
  const st = giveCard(G, 0, 'Moss Hut');
  assert.ok(G.act(0, { type: 'play', iid: st, targets: [{ x: lane.x0 + 2, y: lane.y0 + 8 }] }).ok);
  assert.equal(s.step, 'build');
  const idc = giveCard(G, 0, 'Barkhide Badger');
  assert.ok(G.act(0, { type: 'play', iid: idc, targets: [{ x: lane.x0 + 2, y: lane.y0 + 1 }] }).ok);
  assert.equal(s.step, 'summon');
  const z2 = giveCard(G, 0, 'Contested Border');
  assert.equal(G.canPlay(0, z2), false, 'Zone phase has passed');
  assert.ok(G.act(0, { type: 'nextStep' }).ok);
  assert.equal(s.step, 'equip');
});

test('structures house Identities by class and summon anywhere in their Lane', () => {
  const G = setup();
  const { lane, st } = base(G, 0, 1, 'Thornwall'); // Bastion: housing 2
  assert.equal(G.structHousing(st), C.HOUSING_BY_CLASS.Bastion);
  assert.equal(st.bp, Math.round(12 * C.STRUCTURE_BP_SCALE));
  const ln = G.s.lanes[lane];
  const outside = { x: ln.x0 - 1, y: ln.y0 + 1 };
  assert.equal(G.structForSummon(0, outside), null);
  for (let k = 0; k < 2; k++) {
    const c = giveCard(G, 0, 'Leafcutter Ant');
    assert.ok(G.act(0, { type: 'play', iid: c, targets: [{ x: ln.x0 + k, y: ln.y0 }] }).ok);
  }
  const extra = giveCard(G, 0, 'Leafcutter Ant');
  assert.equal(G.canPlay(0, extra), false, 'housing full');
});

test('move once, then attack for 2 MP each while MP lasts; retaliation costs the defender MP', () => {
  const G = setup();
  const a = place(G, 0, 'Barkhide Badger', 19, 20);
  const d = place(G, 1, 'Mossback Tortoise', 19, 18);
  G.s.step = 'combat';
  assert.ok(G.act(0, { type: 'move', unit: a.iid, to: { x: 19, y: 19 } }).ok);
  assert.equal(G.act(0, { type: 'move', unit: a.iid, to: { x: 18, y: 19 } }).ok, false, 'only one move per turn');
  const mp0 = a.mp, dmp0 = d.mp, dbp0 = d.bp, abp0 = a.bp;
  assert.ok(G.act(0, { type: 'attack', unit: a.iid, target: d.iid }).ok);
  assert.equal(a.mp, mp0 - C.ATTACK_COST);
  assert.ok(d.bp < dbp0);
  assert.equal(d.mp, dmp0 - C.ATTACK_COST, 'defender paid to retaliate');
  assert.ok(a.bp < abp0, 'attacker took retaliation damage');
  assert.equal(G.act(0, { type: 'move', unit: a.iid, to: { x: 18, y: 19 } }).ok, false, 'no moving after attacking');
  if (G.unit(d.iid) && a.mp >= C.ATTACK_COST) assert.ok(G.act(0, { type: 'attack', unit: a.iid, target: d.iid }).ok, 'second attack');
});

test('MP refreshes at the start of the controller\'s turn, but BP damage stays', () => {
  const G = setup();
  const u = place(G, 1, 'Mossback Tortoise', 19, 12);
  u.bp = 1; u.mp = 0;
  G.act(0, { type: 'endTurn' });
  assert.equal(G.s.active, 1);
  assert.equal(u.bp, 1, 'no free healing');
  assert.equal(u.mp, G.maxMp(u));
});

test('capture: the defender gets a turn to rebuild, then an invader in the Lane can replace the Zone', () => {
  const G = setup();
  const { lane, st } = base(G, 1, 1);
  place(G, 1, 'Leafcutter Ant', 19, 20); // keep P1 alive
  const ln = G.s.lanes[lane];
  const raider = place(G, 0, 'Barkhide Badger', ln.x0 + 1, ln.y0 + ln.h - 1);
  G.destroyStruct(st, { p: 0 });
  assert.ok(ln.grace);
  const z = giveCard(G, 0, 'Contested Border');
  assert.equal(G.zoneLaneOk(0, lane), false, 'not during the turn it fell');
  G.act(0, { type: 'endTurn' });
  G.act(1, { type: 'endTurn' }); // defender does not rebuild
  assert.equal(G.s.active, 0);
  assert.equal(ln.grace, null);
  assert.ok(G.zoneLaneOk(0, lane));
  assert.ok(G.act(0, { type: 'play', iid: z, targets: [lane] }).ok);
  assert.equal(ln.ctrl, 0);
  assert.equal(G.s.stats[0].captures, 1);
  void raider;
});

test('a Lane outside your Home Lanes needs one of your Identities in it to claim', () => {
  const G = setup();
  const foreign = G.s.lanes.find((ln) => ln.home === 1 && ln.i === 0);
  assert.equal(G.zoneLaneOk(0, foreign.id), false);
  place(G, 0, 'Leafcutter Ant', foreign.x0, foreign.y0);
  assert.ok(G.zoneLaneOk(0, foreign.id));
});

test('elimination: no Structures and no Identities; the last team standing wins', () => {
  const G = setup();
  base(G, 0, 1);
  const { st } = base(G, 1, 1);
  const u = place(G, 1, 'Leafcutter Ant', 19, 19);
  G.P(1).established = true;
  G.s.step = 'combat';
  G.destroyStruct(st, { p: 0 });
  G.checkEliminations();
  assert.equal(G.P(1).eliminated, false, 'an Identity keeps them in the game');
  G.dealDamage(u.iid, 99, { p: 0 });
  G.checkEliminations();
  assert.equal(G.P(1).eliminated, true);
  assert.equal(G.s.winner, G.team(0));
  assert.deepEqual(G.s.winners, [0]);
});

test('2v2: teammates cannot attack each other and the team wins together', () => {
  const G = setup({ n: 4, format: '2v2' });
  assert.equal(G.team(0), G.team(2));
  const a = place(G, 0, 'Barkhide Badger', 19, 19);
  const ally = place(G, 2, 'Leafcutter Ant', 19, 18);
  const foe = place(G, 1, 'Leafcutter Ant', 20, 19);
  G.s.step = 'combat';
  const targets = G.attackTargets(a);
  assert.ok(!targets.includes(ally.iid) && targets.includes(foe.iid));
  for (const q of [0, 2]) base(G, q, 1);
  G.P(1).established = G.P(3).established = true;
  G.eliminate(1, 'test');
  G.checkVictory();
  assert.equal(G.s.winner, null);
  G.eliminate(3, 'test');
  G.checkVictory();
  assert.deepEqual(G.s.winners.sort(), [0, 2]);
});

test('free-for-all: turns go around the table and skip eliminated players', () => {
  const G = setup({ n: 3, format: 'ffa3' });
  assert.deepEqual(G.s.players.map((P) => P.side), ['S', 'W', 'N']);
  base(G, 0, 1); base(G, 2, 1);
  G.P(1).established = true;
  G.eliminate(1, 'test');
  G.act(0, { type: 'endTurn' });
  assert.equal(G.s.active, 2);
});

test('response sequence: another player can Brace before an attack resolves', () => {
  const G = setup();
  const a = place(G, 0, 'Barkhide Badger', 19, 20);
  const d = place(G, 1, 'Mossback Tortoise', 19, 19);
  G.P(1).hand = [];
  const brace = giveCard(G, 1, 'Brace');
  G.P(0).hand = [giveCard(G, 0, 'Brace')].filter(() => false);
  G.s.step = 'combat';
  assert.ok(G.act(0, { type: 'attack', unit: a.iid, target: d.iid }).ok);
  assert.equal(G.s.priority, 1);
  const before = d.bp;
  assert.ok(G.act(1, { type: 'play', iid: brace, targets: [d.iid] }).ok);
  assert.equal(G.s.priority, null, 'attacker has nothing to add, so the sequence resolves');
  assert.equal(G.s.chain.length, 0);
  assert.equal(before - d.bp, Math.max(0, G.stat(a, 'sp') - 2));
});

test('forced movement into an occupied tile deals collision damage', () => {
  const G = setup();
  const u = place(G, 1, 'Leafcutter Ant', 19, 19);
  place(G, 1, 'Leafcutter Ant', 19, 18);
  const bp = u.bp;
  G.forceMove(u, { dx: 0, dy: -1 }, 2, 0);
  assert.equal(u.bp, bp - C.COLLISION_DAMAGE);
});

test('End Phase discards and an empty deck reshuffles the discard pile', () => {
  const G = setup();
  const P = G.P(0);
  const toss = P.hand.slice(0, 3);
  assert.ok(G.act(0, { type: 'endTurn', discard: toss }).ok);
  assert.equal(P.discard.length, 3);
  G.P(0).deck = [];
  G.act(1, { type: 'endTurn' });
  assert.equal(P.hand.length, C.HAND_SIZE, 'drew back up to seven from the reshuffled discard');
  assert.equal(P.discard.length, 0);
});

test('undo restores a move', () => {
  const G = setup();
  const u = place(G, 0, 'Barkhide Badger', 19, 20);
  G.s.step = 'combat';
  assert.ok(G.act(0, { type: 'move', unit: u.iid, to: { x: 19, y: 18 } }).ok);
  assert.ok(G.s.undo);
  assert.ok(G.act(0, { type: 'undo' }).ok);
  assert.deepEqual([G.unit(u.iid).x, G.unit(u.iid).y], [19, 20]);
});

test('views hide other players\' hands and decks', () => {
  const G = setup({ n: 3, format: 'ffa3' });
  const v = viewFor(G.s, 0);
  assert.equal(v.players[1].hand.every((x) => x === null), true);
  assert.equal(v.players[0].hand.every((x) => typeof x === 'string'), true);
  assert.equal(v.players[2].deck.length, 0);
  assert.ok(v.players[2].deckCount > 0);
  for (const iid of G.P(1).hand) assert.equal(v.inst[iid], undefined);
});
