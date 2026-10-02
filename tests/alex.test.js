// Headless tests for Alex K-Pop Demon Hunter 2's pure systems: room layouts, floor
// generation, threat budgets, lottery odds, the Bible Check verse pool, items and
// relationship → chance tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../alex/js/core/rng.js';
import { allLayouts, buildLayout, SPECIAL, LAYOUTS, ROOM_TYPES } from '../alex/js/world/layouts.js';
import { World } from '../alex/js/world/collision.js';
import { generateFloor } from '../alex/js/world/floorgen.js';
import { composeEncounter, ENEMY_INFO, threatOf } from '../alex/js/world/encounters.js';
import { FLOOR_BUDGET, heartsFor, COOKOFF_CHANCE, NIGHTMARE_CHANCE } from '../alex/js/config.js';
import { VERSES, makeQuestion } from '../alex/js/phone/verses.js';
import { ITEMS, combineMods, poolFor, rollItems } from '../alex/js/items.js';

test('3 floors × 5 room types × 5 layouts = 75 unique layouts', () => {
  const all = allLayouts();
  assert.equal(all.length, 75);
  assert.equal(new Set(all.map((l) => l.key)).size, 75);
  for (const f of [1, 2, 3]) for (const t of 'ABCDE') {
    assert.equal(LAYOUTS[f][t].length, 5, `floor ${f} type ${t}`);
    assert.ok(ROOM_TYPES[f][t]);
  }
});

test('every layout keeps all four door approaches walkable and connected', () => {
  const doors = ['N', 'S', 'E', 'W'];
  for (const lay of allLayouts()) {
    for (let seed = 1; seed <= 3; seed++) {
      const L = buildLayout(lay, lay.floor, makeRng(seed), doors);
      const W = new World(L.w, L.d);
      for (const b of L.blocks) W.add(b);
      const pts = { N: [0, -L.d / 2 + 1.2], S: [0, L.d / 2 - 1.2], W: [-L.w / 2 + 1.2, 0], E: [L.w / 2 - 1.2, 0] };
      W.flowTo(...pts.N);
      for (const d of doors) {
        const c = W.cellOf(...pts[d]);
        assert.ok(W.nav.h[c] <= 0.5, `${lay.key} seed ${seed}: door ${d} blocked`);
        assert.ok(Number.isFinite(W.nav.dist[c]), `${lay.key} seed ${seed}: door ${d} unreachable`);
      }
    }
  }
});

test('floor maps: start → 6–9 fights → pre-boss → boss, with special rooms and a hidden bathroom', () => {
  const rng = makeRng(2024);
  let gas = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const f = 1 + (i % 3);
    const map = generateFloor(f, rng);
    const kinds = map.rooms.map((r) => r.kind);
    assert.equal(kinds.filter((k) => k === 'start').length, 1);
    assert.equal(kinds.filter((k) => k === 'boss').length, 1);
    assert.equal(kinds.filter((k) => k === 'preboss').length, 1);
    assert.equal(kinds.filter((k) => k === 'secret').length, 1);
    const combat = kinds.filter((k) => k === 'combat').length;
    assert.ok(combat >= 6 && combat <= 9, 'combat rooms ' + combat);
    assert.ok(kinds.includes('treasure'));
    if (kinds.includes('gas')) gas++;
    // connectivity: every room reachable from start through doors
    const seen = new Set([map.startId]);
    const q = [map.startId];
    while (q.length) { const r = map.rooms[q.shift()]; for (const id of Object.values(r.doors)) if (!seen.has(id)) { seen.add(id); q.push(id); } }
    assert.equal(seen.size, map.rooms.length);
    // boss is a dead end reached through the pre-boss room
    const boss = map.rooms[map.bossId];
    assert.equal(Object.keys(boss.doors).length, 1);
    assert.equal(map.rooms[Object.values(boss.doors)[0]].kind, 'preboss');
    // budgets within the floor's range (+ small pre-boss bonus)
    for (const r of map.rooms) if (r.kind === 'combat') {
      const [a, b] = FLOOR_BUDGET[f - 1];
      assert.ok(r.budget >= a - 1 && r.budget <= b + 1, `budget ${r.budget}`);
    }
  }
  // Gas Station replaces a special room on roughly 55–65 % of floors
  assert.ok(gas / N > 0.5 && gas / N < 0.7, 'gas ratio ' + gas / N);
});

test('encounters respect threat budgets, floor pools and caps', () => {
  const rng = makeRng(99);
  for (let i = 0; i < 3000; i++) {
    const floor = 1 + (i % 3);
    const [a, b] = FLOOR_BUDGET[floor - 1];
    const budget = a + rng() * (b - a);
    const { waves } = composeEncounter(floor, budget, rng, {});
    const list = waves.flat();
    assert.ok(list.length >= 2);
    assert.ok(threatOf(list) <= budget + 1.01, `threat ${threatOf(list)} > ${budget}`);
    for (const k of list) assert.ok(ENEMY_INFO[k].floor <= floor, `${k} on floor ${floor}`);
    assert.ok(list.filter((k) => ENEMY_INFO[k].elite).length <= 1);
    assert.ok(list.filter((k) => k === 'delulu').length <= 1);
    if (floor === 1) { assert.ok(!list.includes('fancam')); assert.ok(list.filter((k) => k === 'queue').length <= 2); }
    if (budget <= 9.5) assert.equal(waves.length, 1);
  }
});

test('threat values match the design document', () => {
  const T = Object.fromEntries(Object.entries(ENEMY_INFO).map(([k, v]) => [k, v.threat]));
  assert.deepEqual(T, { lurker: 1, photocard: 1, biasBeast: 1.5, queue: 2, mimic: 2.5, fancam: 2, stalker: 2, hoarder: 3, chanter: 2, ultBias: 3.5, akgae: 3, parasocial: 3, queen: 3.5, fanwar: 4, delulu: 6 });
});

test('Bible Check questions are well-formed at every level', () => {
  const rng = makeRng(7);
  for (const v of VERSES) for (const w of v.blanks) assert.match(v.text, new RegExp('\\b' + w + '\\b'), `${v.ref}: "${w}"`);
  for (let i = 0; i < 600; i++) {
    const level = 1 + (i % 3);
    const q = makeQuestion(rng, level);
    assert.equal(q.blanks.length, level === 2 ? Math.min(2, q.blanks.length) : 1);
    assert.ok(q.display.includes('____'));
    q.choices.forEach((c, k) => {
      assert.equal(c.length, 4);
      assert.equal(new Set(c.map((x) => x.toLowerCase())).size, 4);
      assert.ok(c.includes(q.blanks[k]));
    });
  }
});

test('lottery: generous odds, bounded stock and cards that show the rolled outcome', async () => {
  const { rollTicket, layoutTicket, rollStock, TICKETS } = await import('../alex/js/lottery.js');
  const rng = makeRng(5);
  const N = 40000;
  for (const price of [2, 5, 10]) {
    let money = 0, losses = 0, items = 0, jackpots = 0;
    for (let i = 0; i < N; i++) {
      const r = rollTicket(price, rng);
      if (r.type === 'nothing') losses++;
      if (r.amount) money += r.amount;
      if (r.item) items++;
      if (r.type === 'jackpot') jackpots++;
    }
    const ev = money / N;
    assert.ok(ev > price * 1.2, `$${price} pays back more than it costs on average (EV ${ev.toFixed(2)})`);
    assert.ok(ev < price * 3, `$${price} is generous but not absurd (EV ${ev.toFixed(2)})`);
    assert.ok(losses / N > 0.35 && losses / N < 0.5, `$${price} still loses sometimes (${losses / N})`);
    assert.ok(items > 0, `$${price} can win items`);
    if (price === 10) assert.ok(jackpots > 0 && jackpots / N < 0.03, 'jackpot is rare');
  }
  // printed cards are consistent with the outcome
  const count = (arr, v) => arr.filter((x) => x === v).length;
  for (let i = 0; i < 3000; i++) {
    const price = [2, 5, 10][i % 3];
    const r = rollTicket(price, rng);
    const L = layoutTicket(r, rng);
    const win = r.type !== 'nothing';
    if (L.kind === 'lucky' || L.kind === 'mega') {
      const triples = [...new Set(L.cells)].filter((s) => count(L.cells, s) >= 3);
      assert.equal(triples.length, win ? 1 : 0, JSON.stringify([r, L]));
      if (win && triples.length) assert.equal(triples[0], L.win);
      assert.equal(L.cells.length, L.kind === 'lucky' ? 6 : 9);
    } else {
      const hits = L.mine.filter((m) => L.winning.includes(m.n));
      assert.equal(hits.length, win ? 1 : 0, JSON.stringify([r, L]));
    }
  }
  const st = rollStock(rng);
  for (const p of [2, 5, 10]) assert.ok(st[p] >= 1 && st[p] <= 5 && TICKETS[p].name);
});

test('items: categories, prices and stacking modifiers', () => {
  const inRange = (cat, lo, hi) => { for (const k of poolFor(cat)) { const it = ITEMS[k]; if (it) assert.ok(it.price >= lo && it.price <= hi, `${k} $${it.price}`); } };
  inRange('counter', 5, 15); inRange('snack', 10, 25); inRange('backwall', 30, 60);
  assert.equal(ITEMS.energyDrink.price, 8);
  assert.equal(ITEMS.sushi.price, 5);
  assert.equal(ITEMS.protein.price, 12);
  assert.equal(ITEMS.lightstick.price, 18);
  assert.equal(ITEMS.tourShirt.price, 22);
  assert.equal(ITEMS.sunglasses.price, 15);
  assert.equal(ITEMS.bathroomKey.price, 10);
  const m = combineMods(['premiumMic', 'spicyRamen', 'sneakers', 'sneakers'], [{ mods: { moveMul: 1.15 } }]);
  assert.ok(Math.abs(m.dmgMul - 1.2) < 1e-9);
  assert.ok(Math.abs(m.meleeMul - 1.08) < 1e-9);
  assert.equal(m.dashCharges, 2);
  assert.ok(Math.abs(m.moveMul - 1.15) < 1e-9);
  const rng = makeRng(1);
  const picks = rollItems('snack', 3, rng, { items: [], weapons: { melee: 'hunterBlade', ranged: 'micBlaster' }, flags: {}, floor: 1 });
  assert.equal(new Set(picks).size, 3);
});

test('relationship hearts drive cook-off and nightmare chances', () => {
  assert.equal(heartsFor(5), 5);
  assert.equal(heartsFor(0), 3);
  assert.equal(heartsFor(-5), 0);
  for (let i = 1; i < COOKOFF_CHANCE.length; i++) assert.ok(COOKOFF_CHANCE[i] <= COOKOFF_CHANCE[i - 1], 'fewer hearts → more cook-offs');
  assert.ok(COOKOFF_CHANCE[0] <= 0.2, 'cook-offs stay occasional even at zero hearts');
  assert.equal(COOKOFF_CHANCE[5], 0);
  assert.equal(NIGHTMARE_CHANCE[5], 0);
  assert.ok(NIGHTMARE_CHANCE[0] > NIGHTMARE_CHANCE[1]);
  for (const s of Object.values(SPECIAL)) assert.ok(s.w > 0 && s.d > 0);
});

test('crossover rifts: every franchise composes within budget from its own roster', async () => {
  const { RIFTS, CROSS_INFO, composeRift, rollRift, RIFT_IDS } = await import('../alex/js/world/rifts.js');
  const rng = makeRng(77);
  assert.equal(RIFT_IDS.length, 5);
  for (const id of RIFT_IDS) {
    const R = RIFTS[id];
    for (const k of Object.keys(R.weights)) assert.equal(CROSS_INFO[k].franchise, id, k);
    for (const floor of [1, 2, 3]) for (let i = 0; i < 300; i++) {
      const budget = rng.range(2.5, 12);
      const list = composeRift(id, floor, budget, rng);
      assert.ok(list.length >= 1);
      const threat = list.reduce((s, k) => s + CROSS_INFO[k].threat, 0);
      assert.ok(threat <= budget + 1e-6 || list.length === 1, `${id} ${threat} > ${budget}`);
      const count = {};
      for (const k of list) count[k] = (count[k] || 0) + 1;
      for (const [k, cap] of Object.entries(R.caps)) assert.ok((count[k] || 0) <= cap + (k === 'frog' ? 2 : 0), `${id} cap ${k}`);
      if (count.frog) assert.equal(count.frog % 3, 0, 'frogs come in threes');
    }
  }
  // generous: roughly a quarter to a third of fights open a rift
  let n = 0;
  for (let i = 0; i < 20000; i++) if (rollRift(2, rng)) n++;
  assert.ok(n / 20000 > 0.25 && n / 20000 < 0.35, `rift rate ${n / 20000}`);
});

test('crossover loot: every reward resolves to a real item, weapon or gadget', async () => {
  const { RIFTS } = await import('../alex/js/world/rifts.js');
  const { itemInfo, poolFor, GADGETS } = await import('../alex/js/items.js');
  const { MC_GEAR } = await import('../alex/js/mc/data.js');
  for (const [id, R] of Object.entries(RIFTS)) {
    for (const k of R.rewards) { const it = itemInfo(k); assert.ok(it && it.name && it.icon && it.desc, `${id}: ${k}`); }
    assert.deepEqual(poolFor('rift:' + id), R.rewards);
  }
  for (const g of Object.values(MC_GEAR)) if (g.grant) assert.ok(itemInfo(g.grant), g.grant);
  for (const g of Object.keys(GADGETS)) assert.ok(itemInfo('g:' + g).gadget === g);
  const mods = combineMods(['overshield', 'gumGum', 'flameFruit', 'loavesFishes', 'armorOfGod', 'armorOfGod', 'armorOfGod'], []);
  assert.equal(mods.shield, 40); assert.equal(mods.healMul, 2); assert.ok(mods.faithBlock <= 0.35); assert.equal(mods.devilFruit, 2);
});

test('elite affixes: generous but not universal', async () => {
  const { rollAffix, AFFIXES } = await import('../alex/js/actors/affixes.js');
  const rng = makeRng(9);
  for (const floor of [1, 2, 3]) {
    let any = 0, shiny = 0;
    for (let i = 0; i < 20000; i++) { const a = rollAffix(rng, floor, 'lurker'); if (a) { any++; assert.ok(AFFIXES[a]); } if (a === 'shiny') shiny++; }
    assert.ok(any / 20000 > 0.1 && any / 20000 < 0.3, `floor ${floor}: ${any / 20000}`);
    assert.ok(shiny > 0);
  }
  assert.equal(rollAffix(rng, 3, 'soloA'), null);
});
