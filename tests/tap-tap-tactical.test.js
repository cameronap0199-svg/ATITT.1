import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../tap-tap-tactical/js/rng.js';
import { Chart, randomSteps, stepOffsets, WINDOW, dirForCode } from '../tap-tap-tactical/js/ddr.js';
import { assignHallucinations, activeHallucinations, Psyche, Combo, vitalsState } from '../tap-tap-tactical/js/psyche.js';
import { generateFloor, enterNode, clearNode, nextOf, prevOf } from '../tap-tap-tactical/js/map.js';
import { TIERS, WEAPONS, ITEMS, HALLUCINATIONS, FLOOR_COUNTS, CHEATS, floorMult, speedMult } from '../tap-tap-tactical/js/data.js';
import { LORE } from '../tap-tap-tactical/js/lore.js';

const chartOf = (dirs, opts = {}) => new Chart(dirs.map((d) => (Array.isArray(d) ? d : [d])), { spacing: 0.5, travel: 1, lead: 1, now: 0, ...opts });

test('DDR: perfect, good and the too-late miss', () => {
  const c = chartOf(['left', 'up'], { onMiss: 'continue' });
  assert.equal(c.notes[0].time, 1);
  assert.equal(c.press('left', 1.01).type, 'perfect');
  assert.equal(c.press('up', 1.5 + WINDOW.perfect + 0.03).type, 'good');
  assert.equal(c.status, 'done');
  const late = chartOf(['down'], { onMiss: 'continue' });
  assert.deepEqual(late.update(1 + WINDOW.good + 0.01).map((e) => e.type), ['miss']);
  assert.equal(late.status, 'done');
});

test('DDR: wrong key and early taps are misses; reloads restart from the first arrow', () => {
  const c = chartOf(['left', 'right', 'up']);
  assert.equal(c.press('left', 1).type, 'perfect');
  const ev = c.press('down', 1.5);
  assert.equal(ev.type, 'miss');
  assert.equal(ev.reason, 'wrong');
  assert.ok(ev.restart);
  assert.ok(c.notes.every((n) => n.state === null), 'every arrow is pending again');
  assert.ok(c.notes[0].time > 1.5, 're-timed from now');
  const early = chartOf(['left']);
  assert.equal(early.press('left', 0.2).reason, 'early');
});

test('DDR: injections fail on a miss, the Emergency Sedative requeues it', () => {
  const inj = chartOf(['left', 'up'], { onMiss: 'fail' });
  inj.press('right', 1);
  assert.equal(inj.status, 'failed');
  const em = chartOf(['left', 'up'], { onMiss: 'requeue' });
  em.press('right', 1);
  assert.equal(em.status, 'active');
  assert.equal(em.pending.length, 2, 'missed pill goes to the back of the line');
  const requeued = em.pending.sort((a, b) => a.time - b.time)[1];
  assert.equal(requeued.dir, 'left');
  em.press('up', 1.5);
  em.press('left', requeued.time);
  assert.equal(em.status, 'done');
});

test('DDR: double notes need both keys; perfect runs are tracked', () => {
  const c = chartOf([['left', 'right']], { onMiss: 'continue' });
  assert.equal(c.notes.length, 2);
  c.press('left', 1);
  assert.equal(c.status, 'active');
  c.press('right', 1.01);
  assert.equal(c.status, 'done');
  assert.ok(c.perfectRun);
});

test('DDR: forgiveness (Sacred Heart) turns a miss into a good hit', () => {
  const c = chartOf(['left'], { onMiss: 'fail', forgive: () => true });
  const ev = c.press('up', 1);
  assert.equal(ev.type, 'good');
  assert.ok(ev.forgiven);
  assert.equal(c.status, 'done');
});

test('DDR: stuttering notes still land exactly on time', () => {
  const c = chartOf(['left'], { stutter: true });
  const n = c.notes[0];
  assert.equal(c.visualRemaining(n, n.time), 0);
  assert.ok(c.visualRemaining(n, 0.3) >= n.time - 0.3);
});

test('DDR: the Power Tax scales reload length with weapon tier', () => {
  const rng = makeRng(3);
  assert.deepEqual(Object.keys(TIERS), ['standard', 'tactical', 'heavy', 'experimental']);
  assert.ok(TIERS.standard.max <= 4 && TIERS.tactical.min >= 6 && TIERS.heavy.min >= 10 && TIERS.experimental.min >= 15);
  for (const w of Object.values(WEAPONS)) assert.ok(TIERS[w.tier], w.name);
  const steps = randomSteps(rng, 12, { doubles: 0.5 });
  assert.equal(steps.length, 12);
  assert.ok(steps.some((s) => s.length === 2));
  const offs = stepOffsets(12, 0.27, { clusters: true, rng });
  for (let i = 1; i < offs.length; i++) assert.ok(offs[i] - offs[i - 1] >= 0.129);
  assert.equal(dirForCode('KeyW'), 'up');
  assert.equal(dirForCode('ArrowLeft'), 'left');
});

test('Psychosis: 7 of 11 hallucinations are dealt to 10%..70% and stack', () => {
  const rng = makeRng(42);
  const a = assignHallucinations(rng);
  assert.deepEqual(Object.keys(a).map(Number), [10, 20, 30, 40, 50, 60, 70]);
  assert.equal(new Set(Object.values(a)).size, 7);
  for (const id of Object.values(a)) assert.ok(HALLUCINATIONS.some((h) => h.id === id));
  assert.equal(HALLUCINATIONS.length, 11);
  assert.deepEqual(activeHallucinations(a, 45), [a[10], a[20], a[30], a[40]]);
  assert.deepEqual(activeHallucinations(a, 100).length, 7);
  const p = new Psyche(makeRng(1));
  assert.deepEqual(p.add(45).onset.length, 4);
  const { relief } = p.add(-10);
  assert.deepEqual(relief, [p.assign[40]], 'dropping below 40% removes only the 40% penalty');
  assert.equal(p.set(250).onset.length, 4, "35% -> 100% adds the 40..70 penalties");
  assert.equal(p.load, 100);
});

test('Vitals states and the invisible combo', () => {
  assert.equal(vitalsState(100, 100), 'stable');
  assert.equal(vitalsState(69, 100), 'trauma');
  assert.equal(vitalsState(29, 100), 'critical');
  assert.equal(vitalsState(0, 100), 'dead');
  const c = new Combo();
  c.hit(); c.hit();
  assert.equal(c.visible, false);
  c.hit();
  assert.equal(c.visible, true);
  assert.equal(c.snap(), true);
  assert.equal(c.visible, false);
  assert.equal(c.best, 3);
  assert.equal(c.snap(), false);
});

test('Sector map: node counts, forward-only edges, everything funnels into the core', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const map = generateFloor(makeRng(seed), 1);
    const count = (t) => map.nodes.filter((n) => n.type === t).length;
    assert.equal(count('initiation'), 1);
    assert.equal(count('core'), 1);
    for (const [t, [lo, hi]] of Object.entries(FLOOR_COUNTS)) {
      assert.ok(count(t) >= lo && count(t) <= hi, `${t} count ${count(t)} (seed ${seed})`);
    }
    for (const [a, b] of map.edges) assert.equal(map.nodes[b].layer, map.nodes[a].layer + 1);
    for (const n of map.nodes) {
      if (n.type !== 'initiation') assert.ok(prevOf(map, n.id).length > 0, `node ${n.id} unreachable`);
      if (n.type !== 'core') assert.ok(nextOf(map, n.id).length > 0, `node ${n.id} is a dead end`);
      if (n.layer === 1) assert.notEqual(n.type, 'quarantine');
    }
    assert.equal(map.nodes[map.core].layer, map.layers - 1);
  }
});

test('Sector map: routing burns siblings and cleared rooms cannot be revisited', () => {
  const map = generateFloor(makeRng(7), 1);
  enterNode(map, 0);
  const next = clearNode(map, 0);
  assert.ok(next.length >= 2);
  assert.ok(next.every((n) => n.state === 'available'));
  enterNode(map, next[0].id);
  assert.ok(next.slice(1).every((n) => n.state === 'burnt'));
  clearNode(map, next[0].id);
  assert.equal(map.nodes[0].state, 'cleared');
  assert.ok(map.nodes.filter((n) => n.state === 'available').every((n) => n.layer === 2));
});

test('Content: items, cheats, lore and the 1.5x descent', () => {
  assert.ok(ITEMS.length >= 12);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  for (const i of ITEMS) {
    if (i.kind !== 'passive') assert.ok(i.active && i.active.notes > 0, i.name);
    if (i.kind !== 'active') assert.ok(i.passive, i.name);
  }
  assert.deepEqual(Object.keys(CHEATS).sort(), ['1111', '4612', '7298', '9074']);
  assert.equal(LORE[0].id, '0.0');
  assert.equal(floorMult(3), 2.25);
  assert.equal(speedMult(10), 3);
});
