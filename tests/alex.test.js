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

// ---------------------------------------------------------------------------- Minecraft
test('minecraft: shaped, mirrored and shapeless recipes match; costs and layouts agree', async () => {
  const D = await import('../alex/js/mc/data.js');
  const P = 'oakPlanks', S = 'stick', I = 'ironIngot';
  assert.equal(D.matchRecipe(['oakLog', null, null, null], 2)?.out, 'oakPlanks');
  assert.equal(D.matchRecipe([P, P, P, P], 2)?.out, 'craftingTable');
  assert.equal(D.matchRecipe([null, P, null, null, P, null, null, null, null], 3)?.out, 'stick');
  assert.equal(D.matchRecipe([I, I, I, null, S, null, null, S, null], 3)?.out, 'ironPickaxe');
  // the bow and its mirror image
  assert.equal(D.matchRecipe([null, S, 'string', S, null, 'string', null, S, 'string'], 3)?.out, 'bow');
  assert.equal(D.matchRecipe(['string', S, null, 'string', null, S, 'string', S, null], 3)?.out, 'bow');
  assert.equal(D.matchRecipe(['flint', I, null, null], 2)?.out, 'flintAndSteel');
  assert.equal(D.matchRecipe(['blazePowder', null, null, 'enderPearl'], 2)?.out, 'eyeOfEnder');
  assert.equal(D.matchRecipe([I, I, I, null], 2), null);
  for (const r of D.RECIPES) {
    assert.ok(D.mcInfo(r.out), r.out);
    for (const id of Object.keys(D.recipeCost(r))) assert.ok(D.MC[id], `${r.out} needs ${id}`);
    const w = D.recipeFits(r, 2) ? 2 : 3;
    assert.equal(D.matchRecipe(D.layout(r, w), w)?.out, r.out, `layout round-trips for ${r.out}`);
  }
  assert.ok(D.canAfford({ oakPlanks: 4 }, D.RECIPES.find((r) => r.out === 'craftingTable')));
  assert.ok(!D.canAfford({ oakPlanks: 3 }, D.RECIPES.find((r) => r.out === 'craftingTable')));
});

test('minecraft: drops, ores, smelting, pickaxes and the XP curve', async () => {
  const D = await import('../alex/js/mc/data.js');
  const rng = makeRng(4);
  for (const t of [...Object.values(D.DROPS), ...Object.values(D.TYPE_DROPS), ...Object.values(D.PROP_DROPS)]) for (const [id, ch, a, b] of t) { assert.ok(D.MC[id], id); assert.ok(ch > 0 && ch <= 1 && a <= b); }
  for (const [k, o] of Object.entries(D.ORES)) for (const [id] of o.drop) assert.ok(D.MC[id], `${k} drops ${id}`);
  for (const [a, b] of Object.entries(D.SMELT)) assert.ok(D.MC[a] && D.MC[b]);
  for (const w of Object.values(D.ORE_WEIGHTS)) for (const k of Object.keys(w)) assert.ok(D.ORES[k], k);
  // every enemy in the game has a table (or the default) and rolls deterministic counts
  let total = 0;
  for (let i = 0; i < 200; i++) total += D.rollDrops(D.DROPS.creeper, rng).reduce((s, [, n]) => s + n, 0);
  assert.ok(total > 150, 'creepers drop gunpowder');
  assert.equal(D.bestPick({}).tier, 0);
  assert.equal(D.bestPick({ woodPickaxe: 1, ironPickaxe: 1 }).tier, 3);
  assert.equal(D.bestPick({ diamondPickaxe: 1 }).tier, D.ORES.obsidian.tier);
  // Minecraft's XP curve: level 30 = 1395 points
  assert.equal(D.xpForLevel(30), 1395);
  assert.equal(D.levelFromXp(1395).level, 30);
  assert.equal(D.levelFromXp(6).level, 0);
  assert.equal(D.levelFromXp(7).level, 1);
  const offers = D.rollEnchantOffers(makeRng(1), {});
  assert.equal(offers.length, 3);
  assert.deepEqual(offers.map((o) => o.cost), [1, 2, 3]);
  assert.equal(D.PORTAL_OBSIDIAN, 10);
  for (let i = 0; i < 50; i++) { const n = D.prefilledEyes(makeRng(i)); assert.ok(n >= 0 && n < D.END_FRAME_SLOTS); }
});

test('realms: Nether maps, strongholds and the eye of ender path', async () => {
  const R = await import('../alex/js/mc/realmLayouts.js');
  const { generateFloor } = await import('../alex/js/world/floorgen.js');
  for (let s = 0; s < 40; s++) {
    const n = R.generateNether(makeRng(s), [8, 12]);
    const biomes = n.rooms.map((r) => r.biome);
    for (const b of ['wastes', 'fortress', 'spawner', 'bastion', 'trade']) assert.ok(biomes.includes(b), `seed ${s} has ${b}`);
    for (const r of n.rooms) { for (const [d, to] of Object.entries(r.doors)) assert.equal(n.rooms[to].doors[{ N: 'S', S: 'N', W: 'E', E: 'W' }[d]], r.id); assert.ok(R.REALM_LAYOUTS[r.layout], r.layout); }
    assert.ok(R.pathTo(n, n.startId, n.rooms.find((r) => r.biome === 'spawner').id).length >= 6);
    const floor = generateFloor(1 + (s % 3), makeRng(s));
    const st = R.addStronghold(floor, makeRng(s + 99));
    assert.ok(st && st.hidden && st.special === 'stronghold');
    assert.ok(R.pathTo(floor, floor.startId, st.id), 'stronghold reachable');
  }
  for (const b of Object.keys(R.REALM_SPAWNS)) {
    const list = R.composeRealm(b, 10, makeRng(3));
    assert.ok(list.length > 0);
  }
  for (const L of Object.values(R.REALM_LAYOUTS)) {
    const { makeBuilder } = await import('../alex/js/world/layouts.js');
    const b = makeBuilder(L.w, L.d, makeRng(1));
    L.build(b, 2);
    for (const o of b.L.blocks) { assert.ok(Math.abs(o.x) < L.w / 2 && Math.abs(o.z) < L.d / 2, `${L.key} block inside`); }
  }
});

// ---------------------------------------------------------------------------- Pokémon
test('pokemon: dex, learnsets, evolutions and habitats are consistent', async () => {
  const D = await import('../alex/js/pokemon/dex.js');
  const { MOVES } = await import('../alex/js/pokemon/moves.js');
  const { TYPES } = await import('../alex/js/pokemon/types.js');
  assert.ok(D.SPECIES_LIST.length >= 100, 'way more pokemon');
  const nos = new Set();
  for (const s of D.SPECIES_LIST) {
    assert.ok(!nos.has(s.no), `dup dex no ${s.no}`); nos.add(s.no);
    assert.equal(s.base.length, 6);
    for (const t of s.types) assert.ok(TYPES[t], `${s.id} type ${t}`);
    const ls = D.learnsetOf(s.id);
    assert.ok(ls.length >= 4, `${s.id} learns moves`);
    for (const [lv, m] of ls) { assert.ok(MOVES[m], `${s.id} move ${m}`); assert.ok(lv >= 1 && lv <= 100); }
    for (const e of s.evo ? (Array.isArray(s.evo) ? s.evo : [s.evo]) : []) { assert.ok(D.SPECIES[e.to], `${s.id} → ${e.to}`); assert.ok(e.lvl || D.STONES[e.item], `${s.id} evolves somehow`); }
    assert.ok(s.look && s.look.form && s.look.c.length >= 3);
  }
  for (const list of Object.values(D.HABITATS)) for (const id of list) assert.ok(D.SPECIES[id], id);
  for (const id of D.STARTERS) assert.ok(D.SPECIES[id].evo);
});

test('pokemon: stats, EXP, level-up learning and evolution', async () => {
  const M = await import('../alex/js/pokemon/mon.js');
  const D = await import('../alex/js/pokemon/dex.js');
  const rng = makeRng(8);
  const m = M.makeMon('charmandork', 5, rng, { nature: 'Hardy' });
  assert.equal(m.moves.length, 3);
  assert.deepEqual(m.moves.map((x) => x.id).sort(), ['ember', 'growl', 'scratch']);
  const st = M.calcStats(m);
  assert.ok(st.hp >= 19 && st.hp <= 21, `level-5 hp ${st.hp}`);
  // perfect IVs, neutral nature, level 100 Charizzard has textbook stats
  const z = M.makeMon('charizzard', 100, rng, { perfect: true, nature: 'Hardy' });
  assert.equal(M.calcStats(z).hp, 297);
  assert.equal(M.calcStats(z).spa, 254);
  // Adamant: +Atk −SpA
  assert.deepEqual(M.natureMods('Adamant'), { atk: 1.1, spa: 0.9 });
  // EXP to level 16 learns Fire Fang and offers evolution
  const evs = M.gainExp(m, M.expAt(16) - m.exp);
  assert.equal(m.level, 16);
  // Leer fills the fourth slot at 8; Dragon Breath (12) and Fire Fang (16) need a move forgotten
  assert.ok(evs.some((e) => e.type === 'learned' && e.move === 'leer'));
  assert.ok(evs.some((e) => e.type === 'learnPrompt' && e.move === 'fireFang'));
  assert.ok(evs.some((e) => e.type === 'canEvolve' && e.to === 'charmelon'));
  const levelEv = evs.filter((e) => e.type === 'level');
  assert.equal(levelEv.length, 11);
  const r = M.evolve(m, 'charmelon');
  assert.equal(m.species, 'charmelon');
  assert.ok(M.calcStats(m).atk > st.atk);
  void r;
  // full moveset → prompt instead of learning
  const full = M.makeMon('bulbasore', 15, rng);
  assert.equal(full.moves.length, 4);
  const e2 = M.gainExp(full, M.expAt(19) - full.exp);
  assert.ok(e2.some((e) => e.type === 'learnPrompt' && e.move === 'takeDown'));
  assert.ok(M.learnMove(full, 'takeDown', 0));
  assert.equal(full.moves[0].id, 'takeDown');
  // stones
  const p = M.makeMon('pikachew', 10, rng);
  assert.equal(M.evolutionFor(p, { item: 'thunderStone' }), 'raichew');
  assert.equal(M.evolutionFor(p, { item: 'fireStone' }), null);
  const e = M.makeMon('eevie', 10, rng);
  assert.equal(M.evolutionFor(e, { item: 'waterStone' }), 'vaporieon');
  assert.equal(M.evolutionFor(e, { item: 'moonStone' }), 'umbreeon');
  assert.ok(D.SPECIES.raichew);
});

test('pokemon: damage, type chart, status and catching', async () => {
  const B = await import('../alex/js/pokemon/battleCore.js');
  const M = await import('../alex/js/pokemon/mon.js');
  const { effectiveness } = await import('../alex/js/pokemon/types.js');
  assert.equal(effectiveness('water', ['fire']), 2);
  assert.equal(effectiveness('electric', ['ground']), 0);
  assert.equal(effectiveness('grass', ['fire', 'flying']), 0.25);
  assert.equal(effectiveness('ground', ['rock', 'steel']), 4);
  assert.equal(effectiveness('fighting', ['ghost']), 0);
  const rng = makeRng(2);
  const a = B.battler(M.makeMon('squirtul', 20, rng, { perfect: true, nature: 'Hardy' }), 'me');
  const d = B.battler(M.makeMon('charmandork', 20, rng, { perfect: true, nature: 'Hardy' }), 'foe');
  const se = B.calcDamage(a, d, 'waterGun', rng, { crit: false, roll: 1 });
  const nve = B.calcDamage(d, a, 'ember', rng, { crit: false, roll: 1 });
  assert.equal(se.eff, 2); assert.equal(nve.eff, 0.5);
  assert.ok(se.dmg > nve.dmg * 3, `${se.dmg} vs ${nve.dmg}`);
  const crit = B.calcDamage(a, d, 'waterGun', rng, { crit: true, roll: 1 });
  assert.ok(crit.dmg > se.dmg);
  // a turn produces readable events and changes HP
  const ev = [];
  const before = d.mon.hp;
  B.useMove(a, d, 'waterGun', ev, () => 0.5);
  assert.ok(d.mon.hp < before);
  assert.ok(ev.some((e) => e.t === 'text' && /super effective/.test(e.s)));
  // status: fire types can't be burned; a paralysed Pokémon is slower
  assert.ok(!B.inflict(d, 'brn', [], () => 0));
  const sp0 = B.effStat(a, 'spe');
  assert.ok(B.inflict(a, 'par', [], () => 0));
  assert.equal(B.effStat(a, 'spe'), sp0 / 2);
  // catching: Master Ball always works; full-HP legendaries rarely do
  const leg = B.battler(M.makeMon('mewtoo', 70, rng), 'foe');
  assert.equal(B.catchShakes(leg, 'masterBall', rng), 4);
  let caught = 0;
  for (let i = 0; i < 400; i++) if (B.catchShakes(leg, 'pokeBall', makeRng(i)) >= 4) caught++;
  assert.ok(caught < 10, `legendary catches ${caught}`);
  const weak = B.battler(M.makeMon('rattatat', 3, rng), 'foe');
  weak.mon.hp = 1;
  let c2 = 0;
  for (let i = 0; i < 200; i++) if (B.catchShakes(weak, 'pokeBall', makeRng(i)) >= 4) c2++;
  assert.ok(c2 > 150, `weak rattatat catches ${c2}`);
  // speed decides who moves first, priority beats speed
  const fast = B.battler(M.makeMon('pidgeyet', 50, rng), 'me'), slow = B.battler(M.makeMon('snorelax', 50, rng), 'foe');
  assert.equal(B.order(fast, 'tackle', slow, 'tackle', rng)[0], fast);
  assert.equal(B.order(fast, 'tackle', slow, 'quickAttack', rng)[0], slow);
});
