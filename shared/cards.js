// Set 1 — Knotwood Forest. 280 collectible cards + tokens.
// Card effects are plain functions that receive the engine (E) at call time.

import * as C from './constants.js';

const ch = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const me = (E, src) => E.unit(src.unit);

const REGISTRY = new Map();
const COLLECTIBLE = [];

export function getCard(id) { return REGISTRY.get(id) || null; }

// Tokens (not collectible)
function token(id, name, faction, emoji, stats, flavor) {
  REGISTRY.set(id, { id, token: true, type: 'Identity', name, cls: 'Understory', faction, archetype: null, rarity: 'Base', cost: 0, emoji, stats, flavor, unique: { name: 'Token', text: 'Tokens vanish when defeated.' }, text: 'Token.' });
}

token('TK-spiderling', 'Spiderling', 'Arthropod', '🕷️', { bp: 5, sp: 3, mp: 2, ap: 5, rp: 1 }, 'Tiny, fast, and there are always more.');
token('TK-ant', 'Worker Ant', 'Arthropod', '🐜', { bp: 7, sp: 3, mp: 2, ap: 4, rp: 1 }, 'For the Queen!');
token('TK-drone', 'Knot-Bot Drone', 'Knot-Bots', '🛸', { bp: 9, sp: 3, mp: 2, ap: 4, rp: 3 }, 'Beep boop. Hostile detected.');
token('TK-wisp', 'Wisp', 'Ghoul', '👻', { bp: 4, sp: 2, mp: 2, ap: 5, rp: 3 }, 'A candle flame with a grudge.');
token('TK-minnow', 'Minnow', 'Scales', '🐟', { bp: 5, sp: 2, mp: 2, ap: 5, rp: 1 }, 'Just keep swimming.');
token('TK-hatchling', 'Hatchling', 'Feathered', '🐣', { bp: 7, sp: 2, mp: 2, ap: 4, rp: 2 }, 'Peep!');

export function allCards() { return COLLECTIBLE; }
export function cardCount() { return COLLECTIBLE.length; }

// ===========================================================================
// Shared Abilities (Class + Archetype) — straight from the Card Framework
// ===========================================================================
const SHARED = {};
export function sharedAbilityFor(cls, arch) { return SHARED[cls + ':' + arch] || null; }
export function allSharedAbilities() { return SHARED; }
function shared(cls, arch, name, text, hooks) { SHARED[cls + ':' + arch] = { name, text, hooks, cls, arch }; }

// helpers used by several shared abilities
const firstHitReduce = (flag, cond) => (E, src, dmg) => {
  const m = me(E, src);
  if (!m || dmg.target !== m.iid || dmg.amount <= 0) return;
  if (!cond(E, m, dmg)) return;
  if (E.once(m, flag)) dmg.amount -= 1;
};
const isEnemyUnit = (E, m, id) => { const u = E.unit(id); return u && E.foe(u.owner, m.owner) ? u : null; };
const nearStruct = (E, m) => E.nearFriendlyStruct(m, 2);
const struct2 = (E, m) => E.structsOf(m.owner).filter((st) => E.dist(m, st) <= 2).sort((a, b) => E.dist(m, a) - E.dist(m, b))[0];
const freeStep = (E, u, why) => E.grantFreeSteps(u, 1, why);
const laneOf = (E, u) => E.laneOf(u);
const topBarrier = (E, u, n) => { if (u && u.barrier < n) E.giveBarrier(u, n - u.barrier); };
const actDebuff = (E, u, stat, v, label) => E.addStatus(u, { stat, v, at: 'act', label });

// ---- Silviculturist -------------------------------------------------------
shared('Silviculturist', 'Ancestry', 'Homebody', 'While this Identity is within 2 tiles of a friendly Structure, the first damage dealt each turn to an adjacent friendly Identity sharing its Faction is reduced by 1.', {
  incoming(E, src, dmg) {
    const m = me(E, src); const t = E.unit(dmg.target);
    if (!m || !t || t.iid === m.iid || t.owner !== m.owner || dmg.amount <= 0) return;
    if (ch(t, m) !== 1 || !E.sameFaction(t, m) || !nearStruct(E, m)) return;
    if (E.once(m, 'homebody')) dmg.amount -= 1;
  },
});
shared('Silviculturist', 'Succulence', 'Home Turf', 'While this Identity occupies a Lane you control, the first damage it receives each turn while at full BP is reduced by 1.', {
  incoming: firstHitReduce('homeTurf', (E, m) => E.isDefending(m) && m.bp >= E.maxBp(m)),
});
shared('Silviculturist', 'Stagnation', 'Pressure', 'Enemy Identities adjacent to this Identity while it occupies a Lane you control have -1 AP. This effect does not stack.', {
  stat(E, src, u, k) {
    if (k !== 'ap' || !E.foe(u.owner, src.owner)) return 0;
    const m = me(E, src);
    if (m && ch(u, m) === 1 && E.isDefending(m)) return { v: -1, key: 'Pressure' };
    return 0;
  },
});
shared('Silviculturist', 'Hardpan', 'Grounded', 'While within 2 tiles of a friendly Structure, this Identity cannot be forcibly moved by enemy effects.', {
  forcedImmune(E, src, u) { return u.iid === src.unit && nearStruct(E, u); },
});
shared('Silviculturist', 'Friction', 'Counter', 'While this Identity occupies a Lane you control, its first retaliation each turn costs 1 less MP, to a minimum of 0.', {
  retaliationCost(E, src, u) { return u.iid === src.unit && E.isDefending(u) && !E.usedThisTurn(u, 'counter') ? -1 : 0; },
  on(E, src, ev, d) { if (ev === 'retaliating' && d.unit === src.unit) E.once(me(E, src), 'counter'); },
});
shared('Silviculturist', 'Scarcity', 'Still Kicking', 'While this Identity is at half its maximum BP or less and occupies a Lane you control, the first damage it receives each turn is reduced by 1.', {
  incoming: firstHitReduce('stillKicking', (E, m) => m.bp <= E.maxBp(m) / 2 && E.isDefending(m)),
});
shared('Silviculturist', 'Obscurity', 'Sheltered', 'While within 2 tiles of a friendly Structure, the first ranged attack made against this Identity each turn deals 1 less damage.', {
  incoming: firstHitReduce('sheltered', (E, m, dmg) => dmg.attack && dmg.ranged && nearStruct(E, m)),
});
shared('Silviculturist', 'Seclusion', 'Watch Duty', 'While this Identity is the only friendly Identity within 2 tiles of a friendly Structure, the first damage it receives each turn is reduced by 1.', {
  incoming: firstHitReduce('watchDuty', (E, m) => E.structsOf(m.owner).some((st) => E.dist(m, st) <= 2
    && !E.unitsOf(m.owner).some((o) => o.iid !== m.iid && E.dist(o, st) <= 2))),
});
shared('Silviculturist', 'Venom', 'Taxing', 'The first enemy Identity that damages this Identity while it occupies a Lane you control each turn loses 1 MP.', {
  on(E, src, ev, d) {
    if (ev !== 'damaged' || d.target !== src.unit || !d.srcUnit) return;
    const m = me(E, src); const a = isEnemyUnit(E, m, d.srcUnit);
    if (a && E.isDefending(m) && E.once(m, 'taxing')) E.loseMp(a, 1);
  },
});
shared('Silviculturist', 'Monopoly', 'Community', "When all friendly Identities occupying a Lane share this Identity's Faction, the first damage dealt to a friendly Structure in this Lane each turn is reduced by 1.", {
  incoming(E, src, dmg) {
    if (!dmg.isStruct || dmg.amount <= 0) return;
    const m = me(E, src); const st = E.struct(dmg.target);
    if (!m || !st || st.owner !== m.owner || st.lane !== E.laneOf(m) || !E.laneMonopoly(m)) return;
    if (E.once(st, 'community')) dmg.amount -= 1;
  },
});
shared('Silviculturist', 'Labor', 'Upkeep', 'Once per turn, after this Identity attacks or uses an ability while within 2 tiles of a friendly Structure, restore 1 BP to that Structure.', {
  on(E, src, ev, d) {
    if ((ev === 'afterAttack' || ev === 'abilityUsed') && d.unit === src.unit) {
      const m = me(E, src); const st = m && struct2(E, m);
      if (st && E.once(m, 'upkeep')) E.healStruct(st, 1);
    }
  },
});
shared('Silviculturist', 'Infrastructure', 'Close To Home', 'While within 2 tiles of a friendly Structure, the first damage this Identity receives each turn is reduced by 1.', {
  incoming: firstHitReduce('closeToHome', (E, m) => nearStruct(E, m)),
});
shared('Silviculturist', 'Persistence', 'Last Stand', 'Once per turn, if this Identity would be reduced to 0 BP while within 2 tiles of a friendly Structure, it remains at 1 BP instead.', {
  lethal(E, src, u) { return u.iid === src.unit && nearStruct(E, u) && E.once(u, 'lastStand'); },
});
shared('Silviculturist', 'Erosion', 'Think Twice', "The first enemy Identity that damages this Identity while it occupies a Lane you control each turn receives -1 SP until the end of that enemy's next activation.", {
  on(E, src, ev, d) {
    if (ev !== 'damaged' || d.target !== src.unit || !d.srcUnit) return;
    const m = me(E, src); const a = isEnemyUnit(E, m, d.srcUnit);
    if (a && E.isDefending(m) && E.once(m, 'thinkTwice')) actDebuff(E, a, 'sp', -1, '-1 SP · Think Twice');
  },
});
shared('Silviculturist', 'Predation', 'Territorial', 'This Identity gains +1 SP when attacking an enemy Identity occupying a Lane you control.', {
  attackBonus(E, src, u, t, ctx) { return u.iid === src.unit && !ctx.isStruct && E.laneCtrl(E.laneOf(t)) === u.owner ? 1 : 0; },
});

// ---- Hydrologist -----------------------------------------------------------
shared('Hydrologist', 'Ancestry', 'Tag Along', "Once per turn, when another friendly Identity sharing this Identity's Faction moves within 2 tiles of it, this Identity may move 1 tile.", {
  on(E, src, ev, d) {
    if (ev !== 'moved' || d.unit === src.unit) return;
    const m = me(E, src); const o = E.unit(d.unit);
    if (m && o && o.owner === m.owner && E.sameFaction(o, m) && ch(o, m) <= 2 && E.once(m, 'tagAlong')) freeStep(E, m, 'Tag Along');
  },
});
shared('Hydrologist', 'Succulence', 'Afterthought', 'The first time this Identity spends MP during its activation, restore 1 MP after that ability resolves.', {
  on(E, src, ev, d) {
    if (ev === 'abilityUsed' && d.unit === src.unit && d.cost > 0) {
      const m = me(E, src);
      if (E.oncePerActivation(m, 'afterthought')) E.restoreMp(m, 1);
    }
  },
});
shared('Hydrologist', 'Stagnation', 'Off Balance', "Once per turn, when one of this Identity's abilities targets an enemy Identity, that enemy loses 1 AP until the end of its next activation.", {
  on(E, src, ev, d) {
    if (ev !== 'abilityUsed' || d.unit !== src.unit) return;
    const m = me(E, src);
    const t = (d.targets || []).map((id) => isEnemyUnit(E, m, id)).find(Boolean);
    if (t && E.once(m, 'offBalance')) actDebuff(E, t, 'ap', -1, '-1 AP · Off Balance');
  },
});
shared('Hydrologist', 'Hardpan', 'Roll With It', 'Whenever an enemy effect would forcibly move this Identity, reduce that movement by 1 tile. After the movement resolves, this Identity may move 1 tile.', {
  forcedDelta(E, src, u, byP) { return u.iid === src.unit && E.foe(byP, u.owner) ? -1 : 0; },
  on(E, src, ev, d) { if (ev === 'forcedMove' && d.unit === src.unit && E.foe(d.by, src.owner)) freeStep(E, me(E, src), 'Roll With It'); },
});
shared('Hydrologist', 'Friction', 'Brush By', 'Once per turn, after this Identity becomes adjacent to an enemy through movement, it may move 1 additional tile after that movement resolves.', {
  on(E, src, ev, d) {
    if (ev !== 'moved' || d.unit !== src.unit || d.forced) return;
    const m = me(E, src);
    if (E.enemiesAdjacent(m).length && E.once(m, 'brushBy')) freeStep(E, m, 'Brush By');
  },
});
shared('Hydrologist', 'Scarcity', 'Running On Empty', 'While this Identity has 1 MP or less, it gains +1 AP.', {
  stat(E, src, u, k) { return k === 'ap' && u.iid === src.unit && u.mp <= 1 ? 1 : 0; },
});
shared('Hydrologist', 'Obscurity', 'Room To Breathe', 'After this Identity moves at least 2 tiles without becoming adjacent to an enemy, it gains +1 RP until the end of its activation.', {
  on(E, src, ev, d) {
    if (ev !== 'moved' || d.unit !== src.unit) return;
    const m = me(E, src);
    if (m.act && m.act.moved >= 2 && !m.act.touchedEnemy && E.oncePerActivation(m, 'roomToBreathe')) E.addStatus(m, { stat: 'rp', v: 1, at: 'thisAct', label: '+1 RP · Room To Breathe' });
  },
});
shared('Hydrologist', 'Seclusion', 'Spotlight', 'If this Identity begins its activation with no friendly Identity adjacent to it, it gains +1 AP and +1 RP for that activation.', {
  on(E, src, ev, d) {
    if (ev !== 'activationStart' || d.unit !== src.unit) return;
    const m = me(E, src);
    if (!E.friendlyAdjacent(m).length) { E.addApBonus(m, 1, 'Spotlight'); E.addStatus(m, { stat: 'rp', v: 1, at: 'thisAct', label: '+1 RP · Spotlight' }); }
  },
});
shared('Hydrologist', 'Venom', 'Setback', 'Once per turn, when this Identity damages an enemy with an ability, that enemy loses 1 AP until the end of its next activation.', {
  on(E, src, ev, d) {
    if (ev !== 'damaged' || d.srcUnit !== src.unit || d.kind !== 'ability') return;
    const m = me(E, src); const t = isEnemyUnit(E, m, d.target);
    if (t && E.once(m, 'setback')) actDebuff(E, t, 'ap', -1, '-1 AP · Setback');
  },
});
shared('Hydrologist', 'Monopoly', 'Follow The Leader', "When all friendly Identities occupying a Lane share this Identity's Faction, the first friendly Identity sharing this Identity's Faction that moves in this Lane each turn may move 1 additional tile.", {
  on(E, src, ev, d) {
    if (ev !== 'moved' || d.forced) return;
    const m = me(E, src); const o = E.unit(d.unit);
    if (!m || !o || o.owner !== m.owner || !E.sameFaction(o, m) || E.laneOf(o) !== E.laneOf(m) || !E.laneMonopoly(m)) return;
    if (E.once(m, 'followLeader')) freeStep(E, o, 'Follow The Leader');
  },
});
shared('Hydrologist', 'Labor', 'Next Step', 'After this Identity spends 2 or more MP during an activation, it may move 1 tile.', {
  on(E, src, ev, d) {
    if (ev !== 'abilityUsed' || d.unit !== src.unit) return;
    const m = me(E, src);
    if (m.act && m.act.mpSpent >= 2 && E.oncePerActivation(m, 'nextStep')) freeStep(E, m, 'Next Step');
  },
});
shared('Hydrologist', 'Infrastructure', 'Extended Radius', "While within 2 tiles of a friendly Structure, this Identity's abilities gain +1 RP. After one of those abilities resolves, this Identity may move 1 tile once per turn.", {
  abilityRange(E, src, u) { return u.iid === src.unit && nearStruct(E, u) ? 1 : 0; },
  on(E, src, ev, d) {
    if (ev !== 'abilityUsed' || d.unit !== src.unit) return;
    const m = me(E, src);
    if (nearStruct(E, m) && E.once(m, 'extRadius')) freeStep(E, m, 'Extended Radius');
  },
});
shared('Hydrologist', 'Persistence', 'Spaced Out', 'The first time this Identity reaches 0 MP during its activation, it may immediately move 1 tile.', {
  on(E, src, ev, d) {
    if (ev === 'mpZero' && d.unit === src.unit) { const m = me(E, src); if (E.oncePerActivation(m, 'spacedOut')) freeStep(E, m, 'Spaced Out'); }
  },
});
shared('Hydrologist', 'Erosion', 'Shove', 'Once per turn, after this Identity forcibly moves an enemy Identity, deal 1 damage to that enemy.', {
  on(E, src, ev, d) {
    if (ev !== 'forcedMove' || d.srcUnit !== src.unit) return;
    const m = me(E, src); const t = isEnemyUnit(E, m, d.unit);
    if (t && E.once(m, 'shove')) E.dealDamage(t.iid, 1, { kind: 'ability', unit: m.iid, p: m.owner });
  },
});
shared('Hydrologist', 'Predation', 'Pursuit', "Once per turn, after an enemy Identity within this Identity's RP is moved by an effect, this Identity may move 1 tile toward it.", {
  on(E, src, ev, d) {
    if (ev !== 'forcedMove' && !(ev === 'moved' && d.teleport)) return;
    const m = me(E, src); const t = m && isEnemyUnit(E, m, d.unit);
    if (t && ch(t, m) <= E.stat(m, 'rp') && E.once(m, 'pursuit')) E.stepToward(m, t);
  },
});

// ---- Understory ------------------------------------------------------------
shared('Understory', 'Ancestry', 'Encouraged', 'If this Identity begins its activation adjacent to another friendly Identity sharing its Faction, it gains +1 AP for that activation.', {
  on(E, src, ev, d) {
    if (ev !== 'activationStart' || d.unit !== src.unit) return;
    const m = me(E, src);
    if (E.friendlyAdjacent(m).some((o) => E.sameFaction(o, m))) E.addApBonus(m, 1, 'Encouraged');
  },
});
shared('Understory', 'Succulence', 'Walk It Off', 'After this Identity moves at least 3 tiles during its activation, restore 1 BP.', {
  on(E, src, ev, d) {
    if (ev !== 'moved' || d.unit !== src.unit) return;
    const m = me(E, src);
    if (m.act && m.act.moved >= 3 && E.oncePerActivation(m, 'walkItOff')) E.heal(m, 1);
  },
});
shared('Understory', 'Stagnation', 'Outnumbered', 'An enemy Identity adjacent to this Identity and at least one other friendly Identity has -1 AP. This effect does not stack.', {
  stat(E, src, u, k) {
    if (k !== 'ap' || !E.foe(u.owner, src.owner)) return 0;
    const m = me(E, src);
    if (m && ch(u, m) === 1 && E.unitsOf(m.owner).some((o) => o.iid !== m.iid && ch(o, u) === 1)) return { v: -1, key: 'Outnumbered' };
    return 0;
  },
});
shared('Understory', 'Hardpan', 'Steady', 'While this Identity is adjacent to another friendly Identity, the first enemy effect each turn that would forcibly move it moves it 1 fewer tile.', {
  forcedDelta(E, src, u, byP) {
    if (u.iid !== src.unit || !E.foe(byP, u.owner) || !E.friendlyAdjacent(u).length) return 0;
    return E.once(u, 'steady') ? -1 : 0;
  },
});
shared('Understory', 'Friction', 'Back Up', 'This Identity gains +1 SP when attacking an enemy adjacent to another friendly Identity.', {
  attackBonus(E, src, u, t, ctx) {
    return u.iid === src.unit && !ctx.isStruct && E.unitsOf(u.owner).some((o) => o.iid !== u.iid && ch(o, t) === 1) ? 1 : 0;
  },
});
shared('Understory', 'Scarcity', 'Swiftness', 'If friendly Identities are outnumbered in this Lane, this Identity gains +1 AP. If it ends movement adjacent to another friendly Identity, that Identity also gains +1 AP during its next activation.', {
  stat(E, src, u, k) {
    if (k !== 'ap' || u.iid !== src.unit) return 0;
    const l = E.laneOf(u);
    return l >= 0 && E.unitsInLane(l, u.owner).length < E.foesInLane(l, u.owner).length ? 1 : 0;
  },
  on(E, src, ev, d) {
    if (ev !== 'moved' || d.unit !== src.unit || d.forced) return;
    const m = me(E, src); const f = E.friendlyAdjacent(m)[0];
    if (f && E.oncePerActivation(m, 'swiftness')) { f.apNext = (f.apNext || 0) + 1; E.emit({ t: 'status', target: f.iid, text: '+1 AP next · Swiftness', good: true }); }
  },
});
shared('Understory', 'Obscurity', 'Head Start', 'If this Identity begins its activation adjacent to another friendly Identity, it may move 1 tile before spending AP.', {
  on(E, src, ev, d) { if (ev === 'activationStart' && d.unit === src.unit && E.friendlyAdjacent(me(E, src)).length) freeStep(E, me(E, src), 'Head Start'); },
});
shared('Understory', 'Seclusion', 'Free Roam', 'If this Identity begins its activation with no friendly Identity adjacent to it, it gains +2 AP until it becomes adjacent to another friendly Identity.', {
  on(E, src, ev, d) {
    if (d.unit !== src.unit) return;
    const m = me(E, src);
    if (ev === 'activationStart' && !E.friendlyAdjacent(m).length) { E.addApBonus(m, 2, 'Free Roam'); m.flags.freeRoam = m.actSerial; }
    if (ev === 'moved' && m.flags.freeRoam === m.actSerial && E.friendlyAdjacent(m).length) { m.apBonus = Math.max(0, m.apBonus - 2); m.flags.freeRoam = -1; }
  },
});
shared('Understory', 'Venom', 'Wear Down', 'The first time each turn an enemy Identity is damaged by this Identity and another friendly Identity, that enemy restores 1 less BP the next time it would restore BP.', {
  on(E, src, ev, d) {
    if (ev !== 'damaged' || d.isStruct) return;
    const m = me(E, src); const t = isEnemyUnit(E, m, d.target);
    if (!t || !t.hitBy) return;
    const hitters = new Set(t.hitBy.filter((h) => h.o === m.owner).map((h) => h.u));
    if (hitters.has(m.iid) && hitters.size >= 2 && E.once(m, 'wearDown')) E.addStatus(t, { kind: 'healReduce', v: 1, label: 'Worn Down' });
  },
});
shared('Understory', 'Monopoly', 'Room For One More', "When all friendly Identities occupying a Lane share this Identity's Faction, the friendly Structure in this Lane gains +1 Housing. This effect does not stack.", {
  housing(E, src, st) {
    const m = me(E, src);
    return m && st.owner === m.owner && st.lane === E.laneOf(m) && E.laneMonopoly(m) ? { v: 1, key: 'roomForOneMore' } : 0;
  },
});
shared('Understory', 'Labor', 'After You', 'After this Identity uses all of its available AP during an activation, one adjacent friendly Identity may move 1 tile.', {
  on(E, src, ev, d) {
    if (ev !== 'moved' || d.unit !== src.unit || d.forced) return;
    const m = me(E, src);
    if (m.state === 'active' && E.apAvail(m) === 0 && m.apSpent > 0) {
      const f = E.friendlyAdjacent(m)[0];
      if (f && E.oncePerActivation(m, 'afterYou')) freeStep(E, f, 'After You');
    }
  },
});
shared('Understory', 'Infrastructure', 'Long Leash', 'If this Identity begins its activation within 2 tiles of a friendly Structure, it gains +1 AP for that activation.', {
  on(E, src, ev, d) { if (ev === 'activationStart' && d.unit === src.unit && nearStruct(E, me(E, src))) E.addApBonus(me(E, src), 1, 'Long Leash'); },
});
shared('Understory', 'Persistence', 'Take My Place', 'When this Identity is defeated, one adjacent friendly Identity may immediately move into its former tile.', {
  on(E, src, ev, d) {
    if (ev !== 'dying' || d.unit !== src.unit) return;
    const m = me(E, src);
    const f = E.friendlyAdjacent(m).sort((a, b) => E.stat(b, 'sp') - E.stat(a, 'sp'))[0];
    if (!f) return;
    const tile = { x: m.x, y: m.y };
    E.later(() => { if (E.unit(f.iid) && E.isEmpty(tile.x, tile.y)) { const from = { x: f.x, y: f.y }; f.x = tile.x; f.y = tile.y; E.dirty(); E.emit({ t: 'move', unit: f.iid, path: [from, tile] }); } });
  },
});
shared('Understory', 'Erosion', 'Follow-Up', 'This Identity gains +1 SP when attacking an enemy that has already been attacked by another friendly Identity this turn.', {
  attackBonus(E, src, u, t, ctx) {
    if (u.iid !== src.unit || ctx.isStruct || !t.attackedBy) return 0;
    return t.attackedBy.some((h) => h.s === E.s.turnSerial && h.o === u.owner && h.u !== u.iid) ? 1 : 0;
  },
});
shared('Understory', 'Predation', 'Boxed In', 'This Identity gains +1 SP when attacking an enemy adjacent to another friendly Identity.', {
  attackBonus(E, src, u, t, ctx) {
    return u.iid === src.unit && !ctx.isStruct && E.unitsOf(u.owner).some((o) => o.iid !== u.iid && ch(o, t) === 1) ? 1 : 0;
  },
});

// ---- Poacher -------------------------------------------------------------
shared('Poacher', 'Ancestry', 'Ganged Up', "This Identity gains +1 SP when attacking an enemy already damaged this turn by another friendly Identity sharing its Faction.", {
  attackBonus(E, src, u, t, ctx) {
    if (u.iid !== src.unit || ctx.isStruct || !t.hitBy) return 0;
    const f = E.faction(u);
    return t.hitBy.some((h) => h.s === E.s.turnSerial && h.o === u.owner && h.u !== u.iid && h.f === f) ? 1 : 0;
  },
});
shared('Poacher', 'Succulence', 'Still Standing', 'Whenever this Identity defeats an enemy Identity, restore 2 BP.', {
  on(E, src, ev, d) { if (ev === 'defeated' && d.killer === src.unit && E.foe(d.owner, src.owner)) E.heal(me(E, src), 2); },
});
shared('Poacher', 'Stagnation', 'Sitting Duck', 'This Identity gains +1 SP when attacking an enemy Identity that did not move during its most recent activation.', {
  attackBonus(E, src, u, t, ctx) { return u.iid === src.unit && !ctx.isStruct && !t.lastActMoved ? 1 : 0; },
});
shared('Poacher', 'Hardpan', 'Agitation', 'Whenever an enemy effect forcibly moves this Identity, its next attack that turn gains +1 SP.', {
  on(E, src, ev, d) {
    if (ev === 'forcedMove' && d.unit === src.unit && E.foe(d.by, src.owner)) E.addStatus(me(E, src), { kind: 'nextAttack', v: 1, at: 'eot', label: 'Agitated · +1 SP' });
  },
});
shared('Poacher', 'Friction', 'Face To Face', 'This Identity gains +1 SP when attacking an adjacent enemy Identity.', {
  attackBonus(E, src, u, t, ctx) { return u.iid === src.unit && !ctx.isStruct && ctx.dist === 1 ? 1 : 0; },
});
shared('Poacher', 'Scarcity', 'All Natural', 'While this Identity has no Equipment or Consumables attached, it gains +1 SP.', {
  stat(E, src, u, k) { return k === 'sp' && u.iid === src.unit && !u.eq && !u.cons ? 1 : 0; },
});
shared('Poacher', 'Obscurity', 'Long Shot', 'Attacks made by this Identity from 3 or more tiles away gain +1 SP.', {
  attackBonus(E, src, u, t, ctx) { return u.iid === src.unit && ctx.dist >= 3 ? 1 : 0; },
});
shared('Poacher', 'Seclusion', 'Solo Act', 'This Identity gains +1 SP while no friendly Identity is adjacent to it.', {
  stat(E, src, u, k) { return k === 'sp' && u.iid === src.unit && !E.friendlyAdjacent(u).length ? 1 : 0; },
});
shared('Poacher', 'Venom', 'Shaken', 'The first enemy Identity damaged by this Identity each turn receives -1 SP until the end of its next activation.', {
  on(E, src, ev, d) {
    if (ev !== 'damaged' || d.srcUnit !== src.unit) return;
    const m = me(E, src); const t = isEnemyUnit(E, m, d.target);
    if (t && E.once(m, 'shaken')) actDebuff(E, t, 'sp', -1, '-1 SP · Shaken');
  },
});
shared('Poacher', 'Monopoly', 'Home Team', "When all friendly Identities occupying a Lane share this Identity's Faction, this Identity gains +1 SP when attacking an enemy occupying this Lane.", {
  attackBonus(E, src, u, t, ctx) {
    if (u.iid !== src.unit || !E.laneMonopoly(u)) return 0;
    const tl = t.lane !== undefined && t.state === undefined ? t.lane : E.laneOf(t);
    return tl === E.laneOf(u) ? 1 : 0;
  },
});
shared('Poacher', 'Labor', 'Charge', 'If this Identity moves at least 2 tiles before attacking during the same activation, that attack gains +1 SP.', {
  attackBonus(E, src, u) { return u.iid === src.unit && u.act && u.act.movedBeforeAttack >= 2 ? 1 : 0; },
});
shared('Poacher', 'Infrastructure', 'First Impression', 'During the turn this Identity is summoned, its first attack against an enemy Identity or Structure occupying that Lane gains +1 SP.', {
  attackBonus(E, src, u, t) {
    if (u.iid !== src.unit || u.summonedSerial !== E.s.turnSerial || !u.act || u.act.attacks !== 1) return 0;
    const tl = t.lane !== undefined && t.state === undefined ? t.lane : E.laneOf(t);
    return tl === u.summonLane ? 1 : 0;
  },
});
shared('Poacher', 'Persistence', 'Danger Zone', 'While this Identity has 2 BP or less, it gains +1 SP.', {
  stat(E, src, u, k) { return k === 'sp' && u.iid === src.unit && u.bp <= 2 ? 1 : 0; },
});
shared('Poacher', 'Erosion', 'Tear It Down', 'This Identity gains +2 SP when attacking Structures.', {
  attackBonus(E, src, u, t, ctx) { return u.iid === src.unit && ctx.isStruct ? 2 : 0; },
});
shared('Poacher', 'Predation', 'On The Ropes', 'This Identity gains +2 SP when attacking an enemy at half its maximum BP or less.', {
  attackBonus(E, src, u, t, ctx) { return u.iid === src.unit && !ctx.isStruct && t.bp <= E.maxBp(t) / 2 ? 2 : 0; },
});

// ---- Forager ---------------------------------------------------------------
shared('Forager', 'Ancestry', 'Peace of Mind', "Once per turn, when another friendly Identity sharing this Identity's Faction uses a Consumable in the same Lane, restore 1 MP to this Identity.", {
  on(E, src, ev, d) {
    if (ev !== 'consumableUsed' || d.unit === src.unit) return;
    const m = me(E, src); const o = E.unit(d.unit);
    if (m && o && o.owner === m.owner && E.sameFaction(o, m) && E.laneOf(o) === E.laneOf(m) && E.once(m, 'peaceOfMind')) E.restoreMp(m, 1);
  },
});
shared('Forager', 'Succulence', 'Well Fed', 'Whenever a Consumable restores BP or MP to this Identity, increase that restoration by 1.', {
  healMod(E, src, u, heal) { if (u.iid === src.unit && heal.kind === 'consumable') heal.amount += 1; },
});
shared('Forager', 'Stagnation', 'Taking Note', 'Once per turn, when an enemy within 2 tiles ends its activation without moving, restore 1 MP to this Identity.', {
  on(E, src, ev, d) {
    if (ev !== 'activationEnd') return;
    const m = me(E, src); const e = isEnemyUnit(E, m, d.unit);
    if (e && ch(e, m) <= 2 && e.act && e.act.moved === 0 && E.once(m, 'takingNote')) E.restoreMp(m, 1);
  },
});
shared('Forager', 'Hardpan', 'Refuse', 'This Identity may spend 1 MP to prevent itself from being forcibly moved by an enemy effect.', {
  forcedImmune(E, src, u, byP) {
    if (u.iid !== src.unit || !E.foe(byP, u.owner) || u.mp < 1) return false;
    E.loseMp(u, 1);
    return true;
  },
});
shared('Forager', 'Friction', 'Give and Take', 'The first time this Identity both deals and receives damage during the same turn, restore 1 MP.', {
  on(E, src, ev, d) {
    if (ev !== 'damaged') return;
    const m = me(E, src);
    if (d.target === m.iid) m.flags.recv = E.s.turnSerial;
    if (d.srcUnit === m.iid) m.flags.dealt = E.s.turnSerial;
    if (m.flags.recv === E.s.turnSerial && m.flags.dealt === E.s.turnSerial && E.once(m, 'giveTake')) E.restoreMp(m, 1);
  },
});
shared('Forager', 'Scarcity', 'Resourceful', 'While its controller has 3 or fewer cards in hand, the first ability this Identity uses each turn costs 1 less MP.', {
  abilityCost(E, src, u) { return u.iid === src.unit && E.P(u.owner).hand.length <= 3 && !E.usedThisTurn(u, 'resourceful') ? -1 : 0; },
  on(E, src, ev, d) { if (ev === 'abilityUsed' && d.unit === src.unit && E.P(src.owner).hand.length <= 3) E.once(me(E, src), 'resourceful'); },
});
shared('Forager', 'Obscurity', 'Unbothered', 'If this Identity has not been targeted by an enemy effect since its previous activation, its first ability this turn costs 1 less MP.', {
  abilityCost(E, src, u) { return u.iid === src.unit && !u.targetedSince && !E.usedThisTurn(u, 'unbothered') ? -1 : 0; },
  on(E, src, ev, d) { if (ev === 'abilityUsed' && d.unit === src.unit) E.once(me(E, src), 'unbothered'); },
});
shared('Forager', 'Seclusion', 'Alone Time', 'If this Identity begins its activation with no friendly Identity adjacent to it, restore 1 MP.', {
  on(E, src, ev, d) { if (ev === 'activationStart' && d.unit === src.unit && !E.friendlyAdjacent(me(E, src)).length) E.restoreMp(me(E, src), 1); },
});
shared('Forager', 'Venom', 'Side Effect', 'Once per turn, after this Identity uses a Consumable, an enemy damaged by it that turn loses 1 MP.', {
  on(E, src, ev, d) {
    if (ev !== 'consumableUsed' || d.unit !== src.unit) return;
    const m = me(E, src);
    const hit = (m.dealtTo || []).filter((h) => h.s === E.s.turnSerial).map((h) => isEnemyUnit(E, m, h.u)).find(Boolean);
    if (hit && E.once(m, 'sideEffect')) E.loseMp(hit, 1);
  },
});
shared('Forager', 'Monopoly', 'Extra Servings', "When all friendly Identities occupying a Lane share this Identity's Faction, the first Consumable used by this Identity each turn restores 1 additional BP or MP if it normally restores either.", {
  healMod(E, src, u, heal) {
    if (u.iid === src.unit && heal.kind === 'consumable' && E.laneMonopoly(u) && E.once(u, 'extraServings')) heal.amount += 1;
  },
});
shared('Forager', 'Labor', 'Honest Work', 'Once per turn, after this Identity uses an Equipment or Consumable effect, restore 1 MP if it also attacked or used an ability during that activation.', {
  on(E, src, ev, d) {
    if (d.unit !== src.unit) return;
    const m = me(E, src);
    if (!m || !m.act) return;
    const item = ev === 'consumableUsed' || (ev === 'abilityUsed' && d.key === 'equip');
    const deed = ev === 'afterAttack' || (ev === 'abilityUsed' && d.key === 'unique');
    if ((item && (m.act.attacked || m.act.ability)) || (deed && m.act.usedItem)) { if (E.once(m, 'honestWork')) E.restoreMp(m, 1); }
  },
});
shared('Forager', 'Infrastructure', 'At Ease', 'While within 2 tiles of a friendly Structure, the first ability this Identity uses each turn costs 1 less MP.', {
  abilityCost(E, src, u) { return u.iid === src.unit && nearStruct(E, u) && !E.usedThisTurn(u, 'atEase') ? -1 : 0; },
  on(E, src, ev, d) { if (ev === 'abilityUsed' && d.unit === src.unit && nearStruct(E, me(E, src))) E.once(me(E, src), 'atEase'); },
});
shared('Forager', 'Persistence', 'Restock', 'Once per turn, after an attached Consumable is used and discarded, you may immediately attach a Consumable from your hand to this Identity if it has an available Consumable slot.', {
  on(E, src, ev, d) {
    if (ev === 'consumableUsed' && d.unit === src.unit) { const m = me(E, src); if (!m.cons && E.P(m.owner).hand.some((i) => E.def(i).type === 'Consumable') && E.once(m, 'restock')) E.autoAttachCons(m); }
  },
});
shared('Forager', 'Erosion', 'Shake Down', 'Once per turn, when this Identity damages an enemy with Equipment attached, restore 1 MP. If that Equipment is later discarded that turn, draw one card, then discard one card.', {
  on(E, src, ev, d) {
    const m = me(E, src);
    if (ev === 'damaged' && d.srcUnit === src.unit) {
      const t = isEnemyUnit(E, m, d.target);
      if (t && t.eq && E.once(m, 'shakeDown')) { E.restoreMp(m, 1); m.flags.shakeT = t.iid + '@' + E.s.turnSerial; }
    }
    if (ev === 'equipDiscarded' && m.flags.shakeT === d.unit + '@' + E.s.turnSerial && E.once(m, 'shakeDown2')) {
      E.draw(m.owner, 1);
      E.discardLowest(m.owner);
    }
  },
});
shared('Forager', 'Predation', 'Keep It Coming', 'Whenever this Identity defeats an enemy Identity, restore 1 MP. If it has an empty Consumable slot, you may also attach a Consumable from your hand to it.', {
  on(E, src, ev, d) {
    if (ev !== 'defeated' || d.killer !== src.unit || !E.foe(d.owner, src.owner)) return;
    const m = me(E, src);
    E.restoreMp(m, 1);
    E.autoAttachCons(m);
  },
});

// ===========================================================================
// Unique ability templates
// ===========================================================================
const enemyInRange = (label = 'Choose an enemy Identity in range') => ({ type: 'unit', side: 'enemy', range: 'rp', label });
const friendInRange = (label = 'Choose a friendly Identity in range') => ({ type: 'unit', side: 'friendly', range: 'rp', label });
const dmgA = (E, ctx, t, n) => E.dealDamage(t, n, { kind: 'ability', unit: ctx.unit, p: ctx.p, ranged: true });
const eot = (stat, v, label) => ({ stat, v, at: 'eot', label });

function mergeHooks(a, b) {
  if (!a) return b; if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (!out[k]) { out[k] = b[k]; continue; }
    const f1 = out[k], f2 = b[k];
    if (k === 'on' || k === 'incoming' || k === 'healMod') out[k] = (...args) => { f1(...args); f2(...args); };
    else if (['lethal', 'forcedImmune', 'passThrough', 'firstStepFree', 'untargetable', 'salvage'].includes(k)) out[k] = (...args) => f1(...args) || f2(...args);
    else out[k] = (...args) => { const r1 = f1(...args); const r2 = f2(...args); return (typeof r1 === 'number' ? r1 : (r1 && r1.v) || 0) + (typeof r2 === 'number' ? r2 : (r2 && r2.v) || 0); };
  }
  return out;
}

const T = {
  // ---------- activated ----------
  strike: (n, cost, name = 'Strike') => ({ name, text: `Deal ${n} damage to target enemy Identity within RP.`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => dmgA(E, c, c.targets[0], n) } }),
  sunder: (n, cost, name = 'Sunder') => ({ name, text: `Deal ${n} damage to target enemy Structure within RP.`, active: { name, cost, targets: [{ type: 'struct', side: 'enemy', range: 'rp', label: 'Choose an enemy Structure' }], resolve: (E, c) => dmgA(E, c, c.targets[0], n) } }),
  push: (n, cost, name = 'Shove') => ({ name, text: `Push target enemy Identity within RP ${n} tile${n > 1 ? 's' : ''} away. (Blocked pushes deal 1 collision damage.)`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => E.push(E.unit(c.targets[0]), E.unit(c.unit), n, c.p, { srcUnit: c.unit }) } }),
  pull: (n, cost, name = 'Reel In') => ({ name, text: `Pull target enemy Identity within RP up to ${n} tiles toward this Identity.`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => E.pull(E.unit(c.targets[0]), E.unit(c.unit), n, c.p, { srcUnit: c.unit }) } }),
  pushAll: (n, r, cost, name = 'Shockwave') => ({ name, text: `Push each enemy Identity within ${r} tile${r > 1 ? 's' : ''} ${n} tile${n > 1 ? 's' : ''} away.`, active: { name, cost, targets: [], condition: (E, c) => E.allUnits().some((u) => E.foe(u.owner, c.p) && ch(u, E.unit(c.unit)) <= r), resolve: (E, c) => { const m = E.unit(c.unit); for (const u of E.allUnits().filter((x) => E.foe(x.owner, c.p) && ch(x, m) <= r).sort((a, b) => ch(b, m) - ch(a, m))) E.push(u, m, n, c.p, { srcUnit: c.unit }); } } }),
  heal: (n, cost, name = 'Mend') => ({ name, text: `Restore ${n} BP to target friendly Identity within RP.`, active: { name, cost, targets: [friendInRange()], resolve: (E, c) => E.heal(E.unit(c.targets[0]), n, { kind: 'ability' }) } }),
  selfHeal: (n, cost, name = 'Nibble') => ({ name, text: `Restore ${n} BP to this Identity.`, active: { name, cost, targets: [], resolve: (E, c) => E.heal(E.unit(c.unit), n, { kind: 'ability' }) } }),
  healAdj: (n, cost, name = 'Glow') => ({ name, text: `Restore ${n} BP to this Identity and each adjacent friendly Identity.`, active: { name, cost, targets: [], resolve: (E, c) => { const m = E.unit(c.unit); E.heal(m, n); for (const f of E.friendlyAdjacent(m)) E.heal(f, n); } } }),
  mendStruct: (n, cost, name = 'Repair') => ({ name, text: `Restore ${n} BP to target friendly Structure within RP.`, active: { name, cost, targets: [{ type: 'struct', side: 'friendly', range: 'rp', label: 'Choose a friendly Structure' }], resolve: (E, c) => E.healStruct(E.struct(c.targets[0]), n) } }),
  root: (n, cost, name = 'Root') => ({ name, text: `Target enemy Identity within RP loses ${n} AP until the end of its next activation.`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => actDebuff(E, E.unit(c.targets[0]), 'ap', -n, `-${n} AP · ${name}`) } }),
  hex: (n, cost, name = 'Hex') => ({ name, text: `Target enemy Identity within RP gets -${n} SP until the end of its next activation.`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => actDebuff(E, E.unit(c.targets[0]), 'sp', -n, `-${n} SP · ${name}`) } }),
  toll: (cost, name = 'Toll') => ({ name, text: 'Target enemy Identity within RP gets -1 SP and -1 AP until the end of its next activation.', active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => { const t = E.unit(c.targets[0]); actDebuff(E, t, 'sp', -1, '-1 SP'); actDebuff(E, t, 'ap', -1, '-1 AP'); } } }),
  rally: (n, cost, name = 'Rally') => ({ name, text: `Adjacent friendly Identities gain +${n} SP this turn.`, active: { name, cost, targets: [], condition: (E, c) => E.friendlyAdjacent(E.unit(c.unit)).length > 0, resolve: (E, c) => { for (const f of E.friendlyAdjacent(E.unit(c.unit))) E.addStatus(f, eot('sp', n, `+${n} SP · ${name}`)); } } }),
  haste: (n, cost, name = 'Tailwind') => ({ name, text: `Another target friendly Identity within RP gains +${n} AP this turn.`, active: { name, cost, targets: [{ ...friendInRange(), notSelf: true, filter: (E, u) => u.state !== 'done' }], resolve: (E, c) => E.addApBonus(E.unit(c.targets[0]), n, name) } }),
  hasteAll: (cost, name = 'Fae Ring') => ({ name, text: 'Each friendly Identity within 2 tiles gains +1 AP this turn and may move 1 tile.', active: { name, cost, targets: [], resolve: (E, c) => { const m = E.unit(c.unit); for (const f of E.unitsOf(c.p)) if (ch(f, m) <= 2) { E.addApBonus(f, 1, name); E.grantFreeSteps(f, 1, name); } } } }),
  blink: (n, cost, name = 'Blink') => ({ name, text: `Move this Identity to an empty tile within ${n}, ignoring other units.`, active: { name, cost, targets: [{ type: 'tile', range: n, label: 'Choose a destination' }], resolve: (E, c) => E.teleport(E.unit(c.unit), c.targets[0]) } }),
  swap: (n, cost, name = 'Switch') => ({ name, text: `Swap places with another friendly Identity within ${n} tiles.`, active: { name, cost, targets: [{ type: 'unit', side: 'friendly', range: n, notSelf: true, label: 'Swap with which ally?' }], resolve: (E, c) => E.swap(E.unit(c.unit), E.unit(c.targets[0])) } }),
  swapAny: (n, cost, name = 'Whirlpool Step') => ({ name, text: `Swap places with any other Identity within ${n} tiles.`, active: { name, cost, targets: [{ type: 'unit', side: 'any', range: n, notSelf: true, label: 'Swap with which Identity?' }], resolve: (E, c) => { const t = E.unit(c.targets[0]); if (E.foe(t.owner, c.p) && E.hookAny('forcedImmune', t, c.p)) return; E.swap(E.unit(c.unit), t); } } }),
  burst: (n, cost, name = 'Thrash') => ({ name, text: `Deal ${n} damage to each enemy Identity adjacent to this Identity.`, active: { name, cost, targets: [], condition: (E, c) => E.enemiesAdjacent(E.unit(c.unit)).length > 0, resolve: (E, c) => { for (const e of E.enemiesAdjacent(E.unit(c.unit))) E.dealDamage(e.iid, n, { kind: 'ability', unit: c.unit, p: c.p }); } } }),
  guard: (n, cost, name = 'Shell Up') => ({ name, text: `Until your next turn, this Identity takes ${n} less damage from each source.`, active: { name, cost, targets: [], resolve: (E, c) => E.addStatus(E.unit(c.unit), { kind: 'guard', v: n, at: 'sot', p: c.p, label: `Guard ${n}`, good: true }) } }),
  focus: (n, cost, name = 'Pounce') => ({ name, text: `This Identity's next attack this turn gains +${n} SP.`, active: { name, cost, targets: [], condition: (E, c) => E.canAttack(E.unit(c.unit)), resolve: (E, c) => E.addStatus(E.unit(c.unit), { kind: 'nextAttack', v: n, at: 'eot', label: `Next attack +${n}` }) } }),
  drain: (n, cost, name = 'Drain') => ({ name, text: `Deal ${n} damage to target enemy Identity within RP and restore that much BP to this Identity.`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => { const d = dmgA(E, c, c.targets[0], n); E.heal(E.unit(c.unit), d); } } }),
  draw: (n, cost, name = 'Foresight') => ({ name, text: `Draw ${n} card${n > 1 ? 's' : ''}.`, active: { name, cost, oncePerTurn: true, targets: [], resolve: (E, c) => E.draw(c.p, n) } }),
  scavenge: (cost, name = 'Scavenge') => ({ name, text: 'Return a random Equipment or Consumable card from your discard pile to your hand.', active: { name, cost, oncePerTurn: true, targets: [], condition: (E, c) => E.P(c.p).discard.some((i) => ['Equipment', 'Consumable'].includes(E.def(i).type)), resolve: (E, c) => { const P = E.P(c.p); const opts = P.discard.filter((i) => ['Equipment', 'Consumable'].includes(E.def(i).type)); if (!opts.length) return; const pick = opts[E.randInt(opts.length)]; P.discard.splice(P.discard.indexOf(pick), 1); E.returnToHand(pick); E.emit({ t: 'draw', p: c.p, iid: pick, cardId: E.s.inst[pick].cardId, from: 'discard' }); } } }),
  infuse: (n, cost, name = 'Transmute') => ({ name, text: `Restore ${n} MP to another target friendly Identity within RP.`, active: { name, cost, oncePerTurn: true, targets: [{ ...friendInRange(), notSelf: true }], resolve: (E, c) => E.restoreMp(E.unit(c.targets[0]), n) } }),
  mark: (n, cost, name = 'Call Out') => ({ name, text: `Target enemy Identity within RP is Marked this turn: attacks against it gain +${n} SP.`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => E.addStatus(E.unit(c.targets[0]), { kind: 'marked', v: n, at: 'eot', label: `Marked +${n}`, good: false }) } }),
  manaDrain: (n, cost, name = 'Pilfer') => ({ name, text: `Target adjacent enemy Identity loses ${n} MP; this Identity restores that much MP.`, active: { name, cost, targets: [{ type: 'unit', side: 'enemy', range: 1, label: 'Choose an adjacent enemy' }], resolve: (E, c) => { const got = E.loseMp(E.unit(c.targets[0]), n); E.restoreMp(E.unit(c.unit), got); } } }),
  barrier: (n, cost, name = 'Ward') => ({ name, text: `Target friendly Identity within RP gains a Barrier that prevents the next ${n} damage.`, active: { name, cost, targets: [friendInRange()], resolve: (E, c) => E.giveBarrier(E.unit(c.targets[0]), n) } }),
  brood: (tokenId, count, cost, name = 'Hatch') => ({ name, text: `Once per turn: create ${count} ${getCard(tokenId).name} token${count > 1 ? 's' : ''} on empty adjacent tiles.`, active: { name, cost, oncePerTurn: true, targets: [], condition: (E, c) => E.emptyAdjacentTiles(E.unit(c.unit)).length > 0, resolve: (E, c) => { const m = E.unit(c.unit); for (let i = 0; i < count; i++) { const t = E.emptyAdjacentTiles(m)[0]; if (t) E.createToken(c.p, tokenId, t); } } } }),
  refreshAlly: (cost, name = 'Second Wind') => ({ name, text: 'Once per turn: an adjacent friendly Identity that has finished its activation may activate again.', active: { name, cost, oncePerTurn: true, targets: [{ type: 'unit', side: 'friendly', range: 1, notSelf: true, filter: (E, u) => u.state === 'done', label: 'Refresh which ally?' }], resolve: (E, c) => E.refreshUnit(E.unit(c.targets[0])) } }),
  execute: (n, cost, name) => ({ name, text: `Deal ${n} damage to target enemy Identity within RP. If it is defeated, this Identity restores 2 MP and may move 2 tiles.`, active: { name, cost, targets: [enemyInRange()], resolve: (E, c) => { dmgA(E, c, c.targets[0], n); if (!E.unit(c.targets[0])) { const m = E.unit(c.unit); E.restoreMp(m, 2); E.grantFreeSteps(m, 2, name); } } } }),
  invent: (cost, name) => ({ name, text: 'Once per turn: create a Knot-Bot Drone token on an empty adjacent tile, then draw a card.', active: { name, cost, oncePerTurn: true, targets: [], resolve: (E, c) => { const t = E.emptyAdjacentTiles(E.unit(c.unit))[0]; if (t) E.createToken(c.p, 'TK-drone', t); E.draw(c.p, 1); } } }),
  aegis: (cost, name) => ({ name, text: 'Until your next turn, this and each friendly Identity within 2 tiles take 1 less damage from each source and cannot be forcibly moved.', active: { name, cost, targets: [], resolve: (E, c) => { const m = E.unit(c.unit); for (const f of E.unitsOf(c.p)) if (ch(f, m) <= 2) { E.addStatus(f, { kind: 'guard', v: 1, at: 'sot', p: c.p, label: 'Aegis', good: true }); E.addStatus(f, { kind: 'anchored', at: 'sot', p: c.p, label: 'Anchored', good: true }); } } }, hooks: { forcedImmune: (E, src, u) => u.statuses.some((s) => s.kind === 'anchored') } }),
  stew: (cost, name) => ({ name, text: 'Restore 2 BP and 1 MP to each friendly Identity within 2 tiles (including this one).', active: { name, cost, targets: [], resolve: (E, c) => { const m = E.unit(c.unit); for (const f of E.unitsOf(c.p)) if (ch(f, m) <= 2) { E.heal(f, 2); E.restoreMp(f, 1); } } } }),

  // ---------- passive ----------
  onSummonStrike: (n, name = 'Ambush') => ({ name, text: `When summoned: deal ${n} damage to the weakest enemy Identity within RP.`, hooks: { on(E, src, ev, d) { if (ev !== 'summoned' || d.unit !== src.unit) return; const m = me(E, src); const t = E.allUnits().filter((u) => E.foe(u.owner, m.owner) && ch(u, m) <= E.stat(m, 'rp')).sort((a, b) => a.bp - b.bp)[0]; if (t) E.dealDamage(t.iid, n, { kind: 'ability', unit: m.iid, p: m.owner, ranged: true }); } } }),
  deathHeal: (n, name = 'Parting Gift') => ({ name, text: `When defeated: restore ${n} BP to each adjacent friendly Identity.`, hooks: { on(E, src, ev, d) { if (ev === 'dying' && d.unit === src.unit) for (const f of E.friendlyAdjacent(me(E, src))) E.heal(f, n); } } }),
  deathBurst: (n, name = 'Death Throes') => ({ name, text: `When defeated: deal ${n} damage to each adjacent enemy Identity.`, hooks: { on(E, src, ev, d) { if (ev === 'dying' && d.unit === src.unit) { const m = me(E, src); const es = E.enemiesAdjacent(m).map((e) => e.iid); E.later(() => es.forEach((id) => E.dealDamage(id, n, { kind: 'effect', p: m.owner }))); } } } }),
  deathToken: (tokenId, name = 'Lingering Soul') => ({ name, text: `When defeated: create a ${getCard(tokenId).name} token on its tile.`, hooks: { on(E, src, ev, d) { if (ev === 'dying' && d.unit === src.unit) { const m = me(E, src); const t = { x: m.x, y: m.y }; E.later(() => E.createToken(m.owner, tokenId, t)); } } } }),
  defendSP: (n, name = 'Home Guard') => ({ name, text: `+${n} SP while this Identity occupies a Lane you control.`, hooks: { stat: (E, src, u, k) => (k === 'sp' && u.iid === src.unit && E.isDefending(u) ? n : 0) } }),
  invaderSP: (n, name = 'Raider') => ({ name, text: `+${n} SP while this Identity occupies an enemy-controlled Lane.`, hooks: { stat: (E, src, u, k) => (k === 'sp' && u.iid === src.unit && E.isInvading(u) ? n : 0) } }),
  factionAura: (fac, name) => ({ name, text: `Other friendly ${fac} Identities within 2 tiles gain +1 SP.`, hooks: { stat(E, src, u, k) { if (k !== 'sp' || u.iid === src.unit || !E.ally(u.owner, src.owner)) return 0; const m = me(E, src); return m && E.faction(u) === fac && ch(u, m) <= 2 ? 1 : 0; } } }),
  thorns: (n, name = 'Thorny Hide') => ({ name, text: `When an adjacent enemy attacks this Identity, deal ${n} damage to the attacker.`, hooks: { on(E, src, ev, d) { if (ev === 'afterAttack' && d.target === src.unit) { const a = E.unit(d.unit); const m = me(E, src); if (a && m && ch(a, m) === 1) E.dealDamage(a.iid, n, { kind: 'effect', unit: m.iid, p: m.owner }); } } } }),
  regen: (n, name = 'Regrowth') => ({ name, text: `At the start of your turn, this Identity gains a Barrier of ${n} (does not stack).`, hooks: { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) topBarrier(E, me(E, src), n); } } }),
  pathfinder: (name = 'Pathfinder') => ({ name, text: 'The first tile this Identity moves each activation costs no AP.', hooks: { firstStepFree: (E, src, u) => u.iid === src.unit && u.state !== 'done' } }),
  killDraw: (name = 'Trophy') => ({ name, text: 'Whenever this Identity defeats an enemy Identity, draw a card.', hooks: { on(E, src, ev, d) { if (ev === 'defeated' && d.killer === src.unit && E.foe(d.owner, src.owner)) E.draw(src.owner, 1); } } }),
  siege: (n, name = 'Siegebreaker') => ({ name, text: `+${n} SP when attacking Structures.`, hooks: { attackBonus: (E, src, u, t, ctx) => (u.iid === src.unit && ctx.isStruct ? n : 0) } }),
  rangedArmor: (n, name = 'Hard Shell') => ({ name, text: `This Identity takes ${n} less damage from ranged attacks.`, hooks: { incoming(E, src, dmg) { if (dmg.target === src.unit && dmg.attack && dmg.ranged) dmg.amount -= n; } } }),
  mpBattery: (n, name = 'Deep Roots') => ({ name, text: `This Identity has +${n} maximum MP.`, hooks: { stat: (E, src, u, k) => (k === 'mp' && u.iid === src.unit ? n : 0) } }),
  packHunter: (name = 'Pack Hunter') => ({ name, text: '+1 SP for each other friendly Identity adjacent to the target (max +2).', hooks: { attackBonus(E, src, u, t, ctx) { if (u.iid !== src.unit || ctx.isStruct) return 0; return Math.min(2, E.unitsOf(u.owner).filter((o) => o.iid !== u.iid && ch(o, t) === 1).length); } } }),
  sentinel: (n, name = 'Sentinel') => ({ name, text: `When an enemy Identity ends its movement adjacent to this Identity, deal ${n} damage to it (once per enemy each turn).`, hooks: { on(E, src, ev, d) { if (ev !== 'moved') return; const m = me(E, src); const e = m && isEnemyUnit(E, m, d.unit); if (e && ch(e, m) === 1 && E.once(e, 'sentinel' + m.iid)) E.dealDamage(e.iid, n, { kind: 'effect', unit: m.iid, p: m.owner }); } } }),
  rebirth: (name = 'Undying') => ({ name, text: 'The first time this Identity would be defeated each game, it survives with 3 BP instead.', hooks: { lethal(E, src, u) { if (u.iid !== src.unit || u.flags.reborn) return false; u.flags.reborn = true; u.bp = 3; return true; } } }),
  inspire: (name = 'Inspire') => ({ name, text: 'When summoned: other friendly Identities in this Lane gain +1 AP this turn.', hooks: { on(E, src, ev, d) { if (ev !== 'summoned' || d.unit !== src.unit) return; const m = me(E, src); for (const f of E.unitsInLane(E.laneOf(m), m.owner)) if (f.iid !== m.iid) E.addApBonus(f, 1, name); } } }),
  echo: (name = 'Echo') => ({ name, text: 'Whenever you play an Action, this Identity restores 1 MP.', hooks: { on(E, src, ev, d) { if (ev === 'cardPlayed' && d.p === src.owner && d.type === 'Action') E.restoreMp(me(E, src), 1); } } }),
  flyer: (name = 'Skim') => ({ name, text: 'This Identity may move through occupied tiles.', hooks: { passThrough: (E, src, u) => u.iid === src.unit } }),
  lifesteal: (n, name = 'Feast') => ({ name, text: `Whenever this Identity damages an enemy with an attack, restore ${n} BP to it.`, hooks: { on(E, src, ev, d) { if (ev === 'damaged' && d.srcUnit === src.unit && d.kind === 'attack') E.heal(me(E, src), n); } } }),
  crowdSP: (name = 'Strength in Numbers') => ({ name, text: '+1 SP while adjacent to 2 or more friendly Identities.', hooks: { stat: (E, src, u, k) => (k === 'sp' && u.iid === src.unit && E.friendlyAdjacent(u).length >= 2 ? 1 : 0) } }),
  summonToken: (tokenId, name = 'School') => ({ name, text: `When summoned: create a ${getCard(tokenId).name} token on an empty adjacent tile.`, hooks: { on(E, src, ev, d) { if (ev === 'summoned' && d.unit === src.unit) { const t = E.emptyAdjacentTiles(me(E, src))[0]; if (t) E.createToken(src.owner, tokenId, t); } } } }),
  summonScavenge: (name = 'Salvage') => ({ name, text: 'When summoned: return a random Equipment card from your discard pile to your hand.', hooks: { on(E, src, ev, d) { if (ev !== 'summoned' || d.unit !== src.unit) return; const P = E.P(src.owner); const opts = P.discard.filter((i) => E.def(i).type === 'Equipment'); if (!opts.length) return; const pick = opts[E.randInt(opts.length)]; P.discard.splice(P.discard.indexOf(pick), 1); E.returnToHand(pick); E.emit({ t: 'draw', p: src.owner, iid: pick, cardId: E.s.inst[pick].cardId, from: 'discard' }); } } }),
  poisonAttack: (name = 'Venomous') => ({ name, text: "Enemies damaged by this Identity's attacks lose 1 AP until the end of their next activation.", hooks: { on(E, src, ev, d) { if (ev === 'damaged' && d.srcUnit === src.unit && d.kind === 'attack') { const t = isEnemyUnit(E, me(E, src), d.target); if (t) actDebuff(E, t, 'ap', -1, '-1 AP · Venom'); } } } }),
  equipBoost: (name = 'Handy') => ({ name, text: 'While this Identity has Equipment attached, it gains +1 SP and +2 maximum BP.', hooks: { stat: (E, src, u, k) => (u.iid === src.unit && u.eq ? (k === 'sp' ? 1 : k === 'bp' ? 2 : 0) : 0) } }),
  cookAura: (name = 'Home Cooking') => ({ name, text: 'Consumables used by friendly Identities within 2 tiles restore 1 additional BP or MP.', hooks: { healMod(E, src, u, heal) { const m = me(E, src); if (m && heal.kind === 'consumable' && E.ally(u.owner, src.owner) && ch(u, m) <= 2) heal.amount += 1; } } }),
  killRefresh: (name = 'Trophy Hunt') => ({ name, text: 'Once per turn, when this Identity defeats an enemy Identity, it restores 2 MP.', hooks: { on(E, src, ev, d) { if (ev === 'defeated' && d.killer === src.unit && E.foe(d.owner, src.owner)) { const m = me(E, src); if (m && E.once(m, 'trophyHunt')) E.restoreMp(m, 2); } } } }),
  regenStructAura: (name = 'Grove Tender') => ({ name, text: 'At the start of your turn, friendly Structures within 2 tiles restore 1 BP.', hooks: { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) { const m = me(E, src); for (const st of E.structsOf(m.owner)) if (E.dist(m, st) <= 2) E.healStruct(st, 1); } } } }),
  collision: (n, name = 'Undertow') => ({ name, text: `Enemies that collide after being forcibly moved take ${n} additional damage.`, hooks: { collisionBonus: (E, src, u, byP) => (byP === src.owner && E.foe(u.owner, src.owner) ? n : 0) } }),
};

function combo(name, ...parts) {
  const out = { name, combo: true, text: parts.map((p) => (p.active ? `${p.name} (${p.active.cost} MP): ${p.text}` : `${p.name}: ${p.text}`)).join(' '), hooks: null, active: null };
  for (const p of parts) {
    if (p.active) out.active = { ...p.active, name: p.active.name };
    out.hooks = mergeHooks(out.hooks, p.hooks);
  }
  return out;
}

// ===========================================================================
// Card construction helpers
// ===========================================================================
const RARITY_PLAN = {
  Identity: ['Base', 'Base', 'Base', 'Base', 'Bronze', 'Bronze', 'Bronze', 'Silver', 'Silver', 'Silver', 'Gold', 'Gold', 'Gold', 'Crystal', 'Crystal', 'Void', 'Infinite'],
  Zone: ['Base', 'Base', 'Bronze', 'Bronze', 'Silver', 'Gold', 'Crystal'],
  Structure: ['Base', 'Base', 'Bronze', 'Silver', 'Gold', 'Crystal', 'Void'],
  Equipment: ['Base', 'Base', 'Bronze', 'Bronze', 'Silver', 'Gold', 'Crystal'],
  Consumable: ['Base', 'Bronze', 'Silver', 'Gold', 'Void'],
  Action: ['Base', 'Base', 'Bronze', 'Bronze', 'Silver', 'Silver', 'Gold', 'Void'],
  Event: ['Base', 'Bronze', 'Silver', 'Gold', 'Crystal'],
};

let serial = 0;
function register(card) {
  if (!card.token) {
    serial++;
    card.id = 'KF-' + String(serial).padStart(3, '0');
    card.num = serial;
    COLLECTIBLE.push(card);
  }
  REGISTRY.set(card.id, card);
  return card;
}

// Stat = ISB x Class Weight x Individual Modifier. `cost` is the Identity's power tier (1-6).
function identityStats(cls, cost, rarity, mod = {}) {
  const B = C.ISB_BASE + C.ISB_PER_TIER * cost + (C.RARITY_ISB_BONUS[rarity] || 0);
  const w = C.CLASS_WEIGHTS[cls];
  const s = {};
  for (const k of ['bp', 'sp', 'mp', 'ap', 'rp']) s[k] = Math.round(B * w[k] * (mod[k] || 1));
  s.bp = Math.max(2, Math.round(s.bp * C.BP_SCALE));
  s.sp = Math.max(1, s.sp);
  s.mp = Math.max(1, s.mp);
  s.mp = Math.max(2, s.mp);
  s.ap = Math.min(C.STAT_CAPS.ap, Math.max(3, s.ap));
  s.rp = Math.min(C.STAT_CAPS.rp, Math.max(1, s.rp));
  return { stats: s, isb: B };
}

// ===========================================================================
// IDENTITIES — [name, faction, archetype, cost, emoji, unique, statMods, flavor]
// ===========================================================================
const IDENTITIES = {
  Silviculturist: [
    ['Mossback Tortoise', 'Scales', 'Hardpan', 2, '🐢', T.guard(1, 1, 'Shell Up'), { rp: 0.6, bp: 1.15 }, 'Older than most trees, and twice as stubborn.'],
    ['Oakling Sentinel', 'Magically-Mutated', 'Infrastructure', 2, '🌳', T.defendSP(1, 'Rooted Resolve'), {}, 'A sapling that learned to stand guard.'],
    ['Barkhide Badger', 'Pelted', 'Friction', 2, '🦡', T.thorns(1, 'Bristling Bark'), { rp: 0.5, sp: 1.2 }, 'Dig in. Bite back.'],
    ['Nesting Heron', 'Feathered', 'Ancestry', 1, '🦢', T.heal(1, 1, 'Preen'), {}, 'Keeps the whole rookery tidy.'],
    ['Rootwarden Beetle', 'Arthropod', 'Stagnation', 3, '🪲', T.root(1, 1, 'Root Snare'), {}, 'Its horns tangle roots around trespassing feet.'],
    ['Stumpguard Mk-I', 'Knot-Bots', 'Labor', 3, '🤖', T.mendStruct(2, 1, 'Patch Job'), {}, "Doctor Knotwood's first successful caretaker."],
    ['Grave Moss Wight', 'Ghoul', 'Succulence', 3, '👻', T.regen(1, 'Grave Growth'), {}, 'Moss grows over its wounds as fast as they open.'],
    ['Ranger Hazel Thornwick', 'Character', 'Predation', 3, '🧝', T.mark(1, 1, 'Call Out'), {}, '"Every trail tells me who walked it."'],
    ['Bramblehorn Stag', 'Pelted', 'Erosion', 4, '🦌', T.burst(1, 1, 'Antler Rake'), { rp: 0.6 }, 'Its antlers are thornbushes. Mind the points.'],
    ['Canopy Owl', 'Feathered', 'Obscurity', 3, '🦉', T.strike(2, 2, 'Silent Swoop'), {}, 'You never hear the one that gets you.'],
    ['Old Snapjaw', 'Scales', 'Scarcity', 4, '🐊', T.drain(2, 2, 'Death Roll'), { rp: 0.6, bp: 1.1 }, 'The river provides. Old Snapjaw takes.'],
    ['Hivewall Matriarch', 'Arthropod', 'Monopoly', 4, '🐝', T.barrier(2, 1, 'Wax Ward'), {}, 'The hive is a fortress. She is its wall.'],
    ['Sprucebark Colossus', 'Magically-Mutated', 'Persistence', 5, '🌲', T.regen(2, 'Evergreen'), { ap: 0.8, bp: 1.1 }, 'A mountain of bark that simply refuses to fall.'],
    ['Gatekeeper Unit G-8', 'Knot-Bots', 'Seclusion', 5, '🦾', T.sentinel(1, 'Perimeter Alarm'), {}, 'HALT. STATE YOUR BUSINESS. …INCORRECT.'],
    ['Lantern Wraith', 'Ghoul', 'Venom', 4, '🏮', T.hex(2, 2, 'Dimming Light'), {}, 'Its glow drinks the courage from the air.'],
    ['Mother Gnarl, the Grove Witch', 'Character', 'Infrastructure', 5, '🧙', combo('Grove Mother', T.regenStructAura('Grove Tender'), T.mendStruct(3, 2, 'Knit the Timber')), {}, '"Every root in this wood answers to me, dearie."'],
    ['Elder Burlheart, the Rooted King', 'Character', 'Persistence', 6, '👑', combo('Heartwood Crown', T.rebirth('Undying Heartwood'), T.aegis(2, 'Rootbound Aegis')), { ap: 0.9 }, 'When the first tree fell, he was already old.'],
  ],
  Hydrologist: [
    ['Brook Newt', 'Scales', 'Obscurity', 1, '🦎', T.blink(2, 1, 'Slip Away'), {}, 'Now you see it — splash — now you do not.'],
    ['Dipper Wren', 'Feathered', 'Ancestry', 1, '🐦', T.haste(1, 1, 'Chirp'), {}, 'Its song gets everyone moving.'],
    ['Streamrunner Otter', 'Pelted', 'Friction', 2, '🦦', T.push(1, 1, 'Tail Slap'), {}, 'Playful. Also extremely rude.'],
    ['Pond Skater', 'Arthropod', 'Seclusion', 2, '🦟', T.flyer('Skim'), {}, 'Walks on water, and occasionally on heads.'],
    ['Mistcaller Toad', 'Magically-Mutated', 'Stagnation', 3, '🐸', T.root(2, 2, 'Sticky Tongue'), {}, 'Its croak thickens the air into glue.'],
    ['Tide Drone Mk-II', 'Knot-Bots', 'Hardpan', 3, '⚙️', T.pull(2, 1, 'Grapple Line'), {}, 'Designed to fetch buckets. Fetches enemies instead.'],
    ['Marsh Wisp', 'Ghoul', 'Succulence', 2, '✨', T.swap(3, 1, 'Flicker Swap'), {}, 'Follow the light. Regret it later.'],
    ['Riverkeeper Ondine', 'Character', 'Venom', 3, '🧜', T.strike(2, 2, 'Riptide Lash'), {}, '"The river remembers every insult."'],
    ['Heron Monk', 'Feathered', 'Labor', 3, '🕊️', T.haste(2, 2, 'Still Water Sutra'), {}, 'Stands on one leg for a week. Moves like lightning.'],
    ['Current Eel', 'Scales', 'Erosion', 3, '🐍', T.push(2, 2, 'Undertow'), {}, 'It wraps around the current and pulls.'],
    ['Whirlpool Mantis', 'Arthropod', 'Predation', 4, '🦗', T.pull(3, 2, 'Vortex Grasp'), {}, 'Prey spirals in. Nothing spirals out.'],
    ['Flood Hound', 'Magically-Mutated', 'Monopoly', 4, '🐕', T.blink(3, 2, 'Surge Leap'), {}, 'Half dog, half flash flood, all enthusiasm.'],
    ['Rain Oracle Pim', 'Character', 'Scarcity', 3, '🧚', T.draw(1, 3, 'Foresight'), {}, '"It will rain at noon. Also, duck."'],
    ['Aqueduct Walker', 'Knot-Bots', 'Infrastructure', 5, '🚰', T.pushAll(1, 1, 2, 'Pressure Wave'), {}, 'A walking canal with opinions about trespassers.'],
    ['Drowned Bell Spirit', 'Ghoul', 'Persistence', 4, '🔔', T.toll(2, 'Toll of the Deep'), {}, 'When it rings, the living slow to listen.'],
    ['Kappa Sage Oruru', 'Magically-Mutated', 'Succulence', 5, '🥒', combo('Sage of Still Waters', T.mpBattery(1, 'Brimming Dish'), T.swapAny(3, 2, 'Whirlpool Step')), {}, 'Bow politely. The water in its dish is very important.'],
    ['Maru of the Rising Tide', 'Scales', 'Stagnation', 6, '🐉', combo('Rising Tide', T.collision(1, 'Crushing Current'), T.pushAll(2, 2, 3, 'Tidal Surge')), {}, 'The river dragon wakes, and the banks forget where they were.'],
  ],
  Understory: [
    ['Leafcutter Ant', 'Arthropod', 'Ancestry', 1, '🐜', T.packHunter('Colony Bite'), {}, 'Alone, a nuisance. Together, a harvest.'],
    ['Burrow Rabbit', 'Pelted', 'Seclusion', 1, '🐇', T.pathfinder('Burrow Dash'), {}, 'Down one hole, up another, already behind you.'],
    ['Sparrow Scout', 'Feathered', 'Obscurity', 1, '🐤', T.flyer('Flutter'), {}, 'Always first to arrive, always first to leave.'],
    ['Mudskipper', 'Scales', 'Friction', 1, '🐟', T.blink(2, 1, 'Skip'), {}, 'A fish that decided walking was overrated, so it hops.'],
    ['Clockwork Mouse', 'Knot-Bots', 'Labor', 2, '🐭', T.inspire('Wind-Up'), {}, 'Tick-tick-tick-squeak.'],
    ['Ghoul Rat Swarm', 'Ghoul', 'Venom', 2, '🐀', T.deathBurst(1, 'Plague Burst'), {}, 'Kill one and a hundred more remember you.'],
    ['Thistle Imp', 'Magically-Mutated', 'Stagnation', 2, '👺', T.root(1, 1, 'Prickle'), {}, 'It grew from a curse and a thistle seed.'],
    ['Scout Captain Pip', 'Character', 'Monopoly', 3, '🤠', T.rally(1, 1, 'Rally the Scouts'), {}, '"Squad! Formation… uh… pointy!"'],
    ['Vole Brigade', 'Pelted', 'Hardpan', 2, '🐹', T.crowdSP('Shoulder to Shoulder'), {}, 'Small shields. Big hearts. Bigger numbers.'],
    ['Firefly Cloud', 'Arthropod', 'Succulence', 2, '💫', T.healAdj(1, 1, 'Glow'), {}, 'Their light is warm enough to mend.'],
    ['Magpie Thief', 'Feathered', 'Scarcity', 3, '🐦', T.manaDrain(2, 1, 'Pilfer'), {}, 'Shiny things, secrets, and your last spell.'],
    ['Brook Minnow School', 'Scales', 'Infrastructure', 2, '🐠', T.summonToken('TK-minnow', 'School'), {}, 'There is always one more minnow.'],
    ['Swarmling Brood-Mother', 'Arthropod', 'Persistence', 4, '🕷️', T.brood('TK-spiderling', 2, 2, 'Hatch'), {}, 'Every egg sac is a promise.'],
    ['Rustpack Hounds', 'Knot-Bots', 'Predation', 3, '🐺', combo('Rust Pack', T.packHunter('Pack Tactics'), T.pathfinder('Tireless Gears')), {}, 'Built to herd sheep. Now they herd trespassers.'],
    ['Hollow Lantern Kids', 'Ghoul', 'Erosion', 3, '🎃', T.deathToken('TK-wisp', 'Lingering Soul'), {}, 'Trick. Or. Treat.'],
    ['Bramble Fae Court', 'Magically-Mutated', 'Friction', 4, '🧚', T.hasteAll(2, 'Fae Ring'), {}, 'The court dances, and the forest dances with it.'],
    ['Queen Myrmidia of the Thousand', 'Arthropod', 'Monopoly', 6, '🐜', combo('Thousandfold Crown', T.factionAura('Arthropod', 'Royal Pheromone'), T.brood('TK-ant', 2, 2, 'Brood Call')), {}, 'Her empire is beneath your feet. All of it.'],
  ],
  Poacher: [
    ['Stoat Stalker', 'Pelted', 'Predation', 1, '🐿️', T.focus(1, 1, 'Pounce'), {}, 'Small enough to hide. Fierce enough to matter.'],
    ['Shrike', 'Feathered', 'Obscurity', 2, '🦅', T.strike(1, 1, 'Impale'), {}, 'It keeps a pantry on the thornbush.'],
    ['Pike Lurker', 'Scales', 'Stagnation', 2, '🐡', T.invaderSP(1, 'Deep Ambush'), {}, 'It waits in the reeds of other people’s rivers.'],
    ['Hornet Raider', 'Arthropod', 'Venom', 1, '🐝', T.poisonAttack('Venomous Sting'), {}, 'It stings, and your legs forget how to run.'],
    ['Scrap Hunter Unit', 'Knot-Bots', 'Erosion', 3, '🤖', T.siege(1, 'Wrecking Claw'), {}, 'Salvage protocol: take everything apart.'],
    ['Graveyard Jackal', 'Ghoul', 'Succulence', 2, '🐺', T.lifesteal(1, 'Feast'), {}, 'It laughs at funerals.'],
    ['Thornback Lynx', 'Pelted', 'Friction', 3, '🐈', T.focus(2, 1, 'Coiled Leap'), {}, 'Tufted ears. Hooked claws. No patience.'],
    ['Poacher Brann Ashvale', 'Character', 'Scarcity', 3, '🥷', T.mark(2, 1, 'Mark the Quarry'), {}, '"I don’t miss. I just choose not to hit, sometimes."'],
    ['Night Heron Assassin', 'Feathered', 'Seclusion', 3, '🦩', T.blink(3, 2, 'Moonlit Glide'), {}, 'A silhouette against the moon, then nothing.'],
    ['Blight Mantis', 'Magically-Mutated', 'Monopoly', 3, '🦗', T.killDraw('Trophy Wing'), {}, 'It collects wings from its victims.'],
    ['Viper Queen Sslith', 'Scales', 'Hardpan', 4, '🐍', T.drain(2, 2, 'Venom Kiss'), {}, '"Hold ssstill. It only hurtsss forever."'],
    ['Stinger Wasp Captain', 'Arthropod', 'Labor', 4, '🐝', T.onSummonStrike(2, 'Dive Bomb'), {}, 'Arrives already stinging.'],
    ['Wendigo', 'Ghoul', 'Infrastructure', 4, '💀', T.burst(2, 2, 'Hungering Howl'), {}, 'It is always hungry. Always.'],
    ['Hunter-Killer K-9', 'Knot-Bots', 'Ancestry', 5, '🦾', combo('Hunter Protocol', T.packHunter('Target Lock'), T.siege(1, 'Breach Charge')), {}, 'TARGET ACQUIRED. TARGET ACQUIRED. TARGET—'],
    ['Chimera Stalker', 'Magically-Mutated', 'Persistence', 5, '🐲', T.strike(3, 2, 'Triple Maw'), {}, 'Three heads, one appetite.'],
    ['Grand Poacher Rusk', 'Character', 'Predation', 5, '🧔', combo('Legendary Hunter', T.killRefresh('Trophy Hunt'), T.mark(2, 1, 'Hunter’s Eye')), {}, '"The forest is my trophy room."'],
    ['Vesper, the Moonlit Huntress', 'Pelted', 'Predation', 6, '🐺', combo('Moonlit Huntress', T.pathfinder('Silver Stride'), T.execute(4, 3, 'Moonfall Execution')), {}, 'When the moon is full, the forest holds its breath.'],
  ],
  Forager: [
    ['Squirrel Gatherer', 'Pelted', 'Succulence', 1, '🐿️', T.selfHeal(2, 1, 'Nibble'), {}, 'Stashes acorns. Forgets where. Grows forests.'],
    ['Crow Collector', 'Feathered', 'Scarcity', 2, '🐦', T.scavenge(2, 'Shiny Find'), {}, 'One crow’s junk is another crow’s treasure.'],
    ['Tinkerer Beetle', 'Arthropod', 'Labor', 2, '🪲', T.equipBoost('Handy Mandibles'), {}, 'Fixes anything. Eats the leftovers.'],
    ['Mushroom Kin', 'Magically-Mutated', 'Ancestry', 1, '🍄', T.deathHeal(1, 'Spore Gift'), {}, 'When one falls, the others grow.'],
    ['Frog Herbalist', 'Scales', 'Infrastructure', 2, '🐸', T.heal(2, 1, 'Poultice'), {}, 'Ribbit. (Apply twice daily.)'],
    ['Salvage Bot S-4', 'Knot-Bots', 'Erosion', 3, '🤖', T.summonScavenge('Salvage Routine'), {}, 'Nothing is ever truly broken. Only unassembled.'],
    ['Bog Hag', 'Ghoul', 'Venom', 3, '🧟', T.hex(1, 1, 'Bog Curse'), {}, 'She brews her soup from bad luck.'],
    ['Mira the Wandering Cook', 'Character', 'Monopoly', 3, '🥘', T.cookAura('Home Cooking'), {}, '"Nobody fights on an empty stomach. Eat!"'],
    ['Raccoon Rummager', 'Pelted', 'Predation', 2, '🦝', T.scavenge(2, 'Rummage'), {}, 'Masked bandit of the bins.'],
    ['Hermit Crab Tinker', 'Arthropod', 'Hardpan', 3, '🦀', T.guard(2, 2, 'Shell Swap'), {}, 'Carries its workshop on its back.'],
    ['Owl Apothecary', 'Feathered', 'Persistence', 3, '🦉', T.heal(3, 2, 'Remedy'), {}, 'Wise enough to know which mushrooms not to eat.'],
    ['Newt Alchemist', 'Scales', 'Stagnation', 3, '⚗️', T.infuse(2, 1, 'Transmute'), {}, 'Lead into gold? Pah. Mud into mana.'],
    ['Bone Picker', 'Ghoul', 'Friction', 4, '🦴', T.killDraw('Picked Clean'), {}, 'Waste not.'],
    ['Patchwork Golem', 'Magically-Mutated', 'Seclusion', 5, '🧸', combo('Stitched Together', T.regen(1, 'Loose Stitches'), T.mpBattery(1, 'Button Eyes')), {}, 'Made of everything the forest threw away.'],
    ['Scrap Collector Mk-V', 'Knot-Bots', 'Obscurity', 4, '🛠️', T.draw(1, 2, 'Data Mining'), {}, 'Archiving the forest, one piece of junk at a time.'],
    ['Granny Fernsby', 'Character', 'Succulence', 5, '👵', combo('Granny’s Kitchen', T.mpBattery(1, 'Secret Recipe'), T.stew(2, 'Hearty Stew')), {}, '"You look thin. Sit. Eat. Then go fight."'],
    ['Doctor Knotwood, Mad Arborist', 'Character', 'Labor', 6, '🧑', combo('Mad Genius', T.factionAura('Knot-Bots', 'Creator’s Pride'), T.invent(2, 'Grand Invention')), {}, '"Nature is simply machinery that hasn\'t been improved yet!"'],
  ],
};


// ===========================================================================
// ZONES — [name, faction, archetype, cost, emoji, text, hooks]
// ===========================================================================
const inLane = (E, src, u) => E.laneOf(u) === src.lane;
const ZONES = {
  Environmental: [
    ['Dewfall Glade', 'Feathered', 'Succulence', 1, '🌿', 'At the start of your turn, your Identities in this Lane gain a Barrier of 1 (does not stack).', { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) for (const u of E.unitsInLane(src.lane, d.p)) topBarrier(E, u, 1); } }],
    ['Misty Hollow', 'Ghoul', 'Obscurity', 1, '🌫️', 'Identities in this Lane have -1 RP (minimum 1).', { stat: (E, src, u, k) => (k === 'rp' && inLane(E, src, u) ? -1 : 0) }],
    ['Sunbeam Meadow', 'Pelted', 'Labor', 1, '🌻', 'At the end of an Identity\'s activation in this Lane, it restores 1 MP.', { on(E, src, ev, d) { if (ev === 'activationEnd') { const u = E.unit(d.unit); if (u && inLane(E, src, u)) E.restoreMp(u, 1); } } }],
    ['Spore Fog', 'Magically-Mutated', 'Venom', 1, '🍄', 'Abilities used by enemy Identities in this Lane cost 1 additional MP.', { abilityCost: (E, src, u) => (inLane(E, src, u) && E.foe(u.owner, src.owner) ? 1 : 0) }],
    ['Moonlit Clearing', 'Character', 'Seclusion', 1, '🌙', 'Abilities used by your Identities in this Lane cost 1 less MP.', { abilityCost: (E, src, u) => (inLane(E, src, u) && u.owner === src.owner ? -1 : 0) }],
    ['Stinging Nettlefield', 'Arthropod', 'Erosion', 2, '🌾', 'At the start of your turn, each enemy Identity in this Lane takes 1 damage.', { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) for (const u of E.foesInLane(src.lane, src.owner)) E.dealDamage(u.iid, 1, { kind: 'hazard', p: src.owner }); } }],
    ['Ancient Spring', 'Scales', 'Persistence', 2, '⛲', 'Your Identities in this Lane have +1 maximum MP and +1 maximum BP.', { stat: (E, src, u, k) => ((k === 'mp' || k === 'bp') && u.owner === src.owner && inLane(E, src, u) ? 1 : 0) }],
  ],
  Terrain: [
    ['Tangled Thicket', 'Pelted', 'Stagnation', 1, '🌳', 'Enemy Identities must spend 1 additional AP to enter this Lane.', { moveCost: (E, src, u, from, to) => (E.foe(u.owner, src.owner) && E.laneAt(to.x, to.y) === src.lane && E.laneAt(from.x, from.y) !== src.lane ? 1 : 0) }],
    ['Mossy Path', 'Arthropod', 'Labor', 1, '🟩', 'The first tile an Identity moves each activation within this Lane costs no AP.', { firstStepFree: (E, src, u) => u.state !== 'done' && inLane(E, src, u) }],
    ['Muddy Bank', 'Scales', 'Erosion', 1, '🟫', 'Forced movement within this Lane moves an additional tile.', { forcedDelta: (E, src, u) => (inLane(E, src, u) ? 1 : 0) }],
    ['Hollow Log Run', 'Feathered', 'Obscurity', 1, '🪵', 'Identities in this Lane may move through occupied tiles within it.', { passThrough: (E, src, u, t) => inLane(E, src, u) && E.laneAt(t.x, t.y) === src.lane }],
    ['Sheer Ravine', 'Knot-Bots', 'Hardpan', 1, '🏔️', 'Identities in this Lane cannot be forcibly moved.', { forcedImmune: (E, src, u) => inLane(E, src, u) }],
    ['Rolling Hills', 'Character', 'Friction', 2, '⛰️', 'Your Identities that begin their activation in this Lane gain +1 AP.', { on(E, src, ev, d) { if (ev === 'activationStart') { const u = E.unit(d.unit); if (u && u.owner === src.owner && inLane(E, src, u)) E.addApBonus(u, 1, 'Rolling Hills'); } } }],
    ['Briar Maze', 'Magically-Mutated', 'Seclusion', 2, '🌹', 'Enemy Identities must spend 1 additional AP to leave this Lane.', { moveCost: (E, src, u, from, to) => (E.foe(u.owner, src.owner) && E.laneAt(from.x, from.y) === src.lane && E.laneAt(to.x, to.y) !== src.lane ? 1 : 0) }],
  ],
  Property: [
    ['Warren Commons', 'Pelted', 'Ancestry', 1, '🏡', 'Your Identities in this Lane gain +1 SP while adjacent to another friendly Identity.', { stat: (E, src, u, k) => (k === 'sp' && u.owner === src.owner && inLane(E, src, u) && E.friendlyAdjacent(u).length ? 1 : 0) }],
    ['Watchpost Grove', 'Feathered', 'Obscurity', 1, '🗼', 'Once per turn, when an enemy Identity enters this Lane, one of your Identities in this Lane may move 1 tile.', { on(E, src, ev, d) { if (ev !== 'enterLane' || d.lane !== src.lane) return; const u = E.unit(d.unit); if (!u || !E.foe(u.owner, src.owner)) return; const f = E.unitsInLane(src.lane, src.owner)[0]; if (f && E.once(E.s.lanes[src.lane], 'watchpost')) E.grantFreeSteps(f, 1, 'Watchpost'); } }],
    ['Hearth Circle', 'Character', 'Succulence', 1, '🔥', 'When one of your Identities enters this Lane, it restores 1 MP.', { on(E, src, ev, d) { if (ev === 'enterLane' && d.lane === src.lane) { const u = E.unit(d.unit); if (u && u.owner === src.owner && E.once(u, 'hearth')) E.restoreMp(u, 1); } } }],
    ['Toll Bridge', 'Knot-Bots', 'Scarcity', 1, '🌉', 'When an enemy Identity enters this Lane, it loses 1 MP.', { on(E, src, ev, d) { if (ev === 'enterLane' && d.lane === src.lane) { const u = E.unit(d.unit); if (u && E.foe(u.owner, src.owner)) E.loseMp(u, 1); } } }],
    ['Crowded Burrows', 'Arthropod', 'Monopoly', 1, '🕳️', 'Your Identities in this Lane take 1 less damage while adjacent to 2 or more friendly Identities.', { incoming(E, src, dmg) { const u = E.unit(dmg.target); if (u && u.owner === src.owner && inLane(E, src, u) && E.friendlyAdjacent(u).length >= 2) dmg.amount -= 1; } }],
    ['Rookery Heights', 'Feathered', 'Friction', 2, '🕊️', 'If 3 or more of your Identities occupy this Lane, they gain +1 AP.', { stat: (E, src, u, k) => (k === 'ap' && u.owner === src.owner && inLane(E, src, u) && E.unitsInLane(src.lane, src.owner).length >= 3 ? 1 : 0) }],
    ['Gathering Stump', 'Ghoul', 'Labor', 2, '🪑', 'While 2 or more of your Identities occupy this Lane, they have +1 maximum MP.', { stat: (E, src, u, k) => (k === 'mp' && u.owner === src.owner && inLane(E, src, u) && E.unitsInLane(src.lane, src.owner).length >= 2 ? 1 : 0) }],
  ],
  Domain: [
    ['Fertile Loam', 'Arthropod', 'Infrastructure', 1, '🌱', 'The Structure in this Lane gains +1 Housing.', { housing: (E, src, st) => (st.lane === src.lane && st.owner === src.owner ? 1 : 0) }],
    ['Rooted Foundations', 'Knot-Bots', 'Hardpan', 1, '🧱', 'Your Structure in this Lane takes 1 less damage from each source.', { incoming(E, src, dmg) { const st = E.struct(dmg.target); if (st && st.lane === src.lane && st.owner === src.owner) dmg.amount -= 1; } }],
    ['Nursery Bed', 'Feathered', 'Ancestry', 1, '🥚', 'Identities summoned in this Lane gain +1 SP until the end of the turn.', { on(E, src, ev, d) { if (ev === 'summoned') { const u = E.unit(d.unit); if (u && u.owner === src.owner && inLane(E, src, u)) E.addStatus(u, eot('sp', 1, '+1 SP · Nursery')); } } }],
    ['Sap Wells', 'Scales', 'Succulence', 1, '🍯', 'Whenever you summon an Identity in this Lane, restore 2 BP to your Structure here.', { on(E, src, ev, d) { if (ev === 'summoned') { const u = E.unit(d.unit); const st = E.structInLane(src.lane); if (u && u.owner === src.owner && inLane(E, src, u) && st && st.owner === src.owner) E.healStruct(st, 2); } } }],
    ['Builder\'s Clearing', 'Character', 'Labor', 1, '🪓', 'Once per turn, when one of your Identities in this Lane attacks or uses an ability, restore 2 BP to your Structure here.', { on(E, src, ev, d) { if (ev !== 'afterAttack' && ev !== 'abilityUsed') return; const u = E.unit(d.unit); const st = E.structInLane(src.lane); if (u && st && u.owner === src.owner && st.owner === src.owner && inLane(E, src, u) && E.once(E.s.lanes[src.lane], 'builders')) E.healStruct(st, 2); } }],
    ['Old Growth', 'Magically-Mutated', 'Persistence', 2, '🌲', 'Your Structure in this Lane has +8 maximum BP.', { structBp: (E, src, st) => (st.lane === src.lane && st.owner === src.owner ? 8 : 0) }],
    ['Mycelial Web', 'Ghoul', 'Infrastructure', 2, '🕸️', 'Identities you summon in this Lane gain +1 AP on the turn they are summoned.', { on(E, src, ev, d) { if (ev === 'summoned') { const u = E.unit(d.unit); if (u && u.owner === src.owner && inLane(E, src, u)) E.addApBonus(u, 1, 'Mycelial Web'); } } }],
  ],
  Territory: [
    ['Contested Border', 'Pelted', 'Friction', 1, '🚧', 'Your Identities in this Lane gain +1 SP.', { stat: (E, src, u, k) => (k === 'sp' && u.owner === src.owner && inLane(E, src, u) ? 1 : 0) }],
    ['Snarlwood Frontier', 'Magically-Mutated', 'Stagnation', 1, '🌵', 'Enemy Identities invading this Lane have -1 AP.', { stat: (E, src, u, k) => (k === 'ap' && E.foe(u.owner, src.owner) && inLane(E, src, u) ? -1 : 0) }],
    ['Victor\'s Glen', 'Character', 'Succulence', 1, '🏆', 'When you capture this Lane with this Zone, restore 2 BP to each of your Identities in it. Your Identities here restore +1 BP from all healing.', { on(E, src, ev, d) { if (ev === 'zonePlaced' && d.lane === src.lane && d.capture) for (const u of E.unitsInLane(src.lane, src.owner)) E.heal(u, 2); }, healMod(E, src, u, h) { if (h.stat === 'bp' && u.owner === src.owner && inLane(E, src, u)) h.amount += 1; } }],
    ['Battle-Scarred Field', 'Ghoul', 'Erosion', 1, '⚔️', 'Attacks made by Identities in this Lane gain +1 SP while it is contested.', { attackBonus: (E, src, u) => (inLane(E, src, u) && E.isContested(src.lane) ? 1 : 0) }],
    ['Watchtower Ridge', 'Feathered', 'Obscurity', 1, '🔭', 'Your Identities in this Lane gain +1 RP.', { stat: (E, src, u, k) => (k === 'rp' && u.owner === src.owner && inLane(E, src, u) ? 1 : 0) }],
    ['Bloodmoss Marches', 'Scales', 'Venom', 2, '🩸', 'Enemy Identities that end their activation in this Lane take 1 damage.', { on(E, src, ev, d) { if (ev === 'activationEnd') { const u = E.unit(d.unit); if (u && E.foe(u.owner, src.owner) && inLane(E, src, u)) E.dealDamage(u.iid, 1, { kind: 'hazard', p: src.owner }); } } }],
    ['Ancestral Grounds', 'Arthropod', 'Ancestry', 2, '🏯', 'At the start of your turn, restore 3 BP to your Structure in this Lane.', { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) { const st = E.structInLane(src.lane); if (st && st.owner === src.owner) E.healStruct(st, 3); } } }],
  ],
};

// ===========================================================================
// STRUCTURES — [name, faction, archetype, cost, bp, housing, emoji, text, hooks]
// ===========================================================================
const nearSt = (E, src, u, n = 2) => { const st = E.struct(src.struct); return st && E.dist(u, st) <= n; };
const STRUCTS = {
  Shelter: [
    ['Moss Hut', 'Pelted', 'Succulence', 2, 8, 2, '🛖', 'At the start of your turn, friendly Identities within 2 tiles gain a Barrier of 1 (does not stack).', { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) for (const u of E.unitsOf(src.owner)) if (nearSt(E, src, u)) topBarrier(E, u, 1); } }],
    ['Hollow Log Refuge', 'Feathered', 'Obscurity', 2, 9, 2, '🪵', 'Friendly Identities within 1 tile take 1 less damage from ranged attacks.', { incoming(E, src, dmg) { const u = E.unit(dmg.target); if (u && u.owner === src.owner && dmg.attack && dmg.ranged && nearSt(E, src, u, 1)) dmg.amount -= 1; } }],
    ['Bramble Burrow', 'Arthropod', 'Hardpan', 2, 8, 2, '🌰', 'Identities summoned here gain a Barrier that prevents the next 2 damage.', { on(E, src, ev, d) { if (ev === 'summoned' && d.struct === src.struct) E.giveBarrier(E.unit(d.unit), 2); } }],
    ['Lantern Cottage', 'Character', 'Seclusion', 3, 10, 2, '🏮', 'Friendly Identities within 2 tiles have +1 maximum MP.', { stat: (E, src, u, k) => (k === 'mp' && u.owner === src.owner && nearSt(E, src, u) ? 1 : 0) }],
    ['Root Cellar', 'Magically-Mutated', 'Persistence', 3, 10, 2, '🥔', 'Once per turn, when a friendly Identity within 2 tiles would be defeated, it survives with 1 BP instead.', { lethal(E, src, u) { const st = E.struct(src.struct); return st && u.owner === src.owner && E.dist(u, st) <= 2 && E.once(st, 'rootCellar'); } }],
    ['Healer\'s Hollow', 'Scales', 'Succulence', 3, 11, 2, '💚', 'At the start of your turn, friendly Identities within 2 tiles gain a Barrier of 2 (does not stack).', { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) for (const u of E.unitsOf(src.owner)) if (nearSt(E, src, u)) topBarrier(E, u, 2); } }],
    ['Sanctuary Tree', 'Magically-Mutated', 'Infrastructure', 4, 14, 3, '🌳', 'Friendly Identities within 2 tiles take 1 less damage and cannot be targeted by enemy Actions or Events.', { incoming(E, src, dmg) { const u = E.unit(dmg.target); if (u && u.owner === src.owner && nearSt(E, src, u)) dmg.amount -= 1; }, untargetable: (E, src, u) => u.owner === src.owner && nearSt(E, src, u) }],
  ],
  Bastion: [
    ['Thornwall', 'Magically-Mutated', 'Friction', 2, 12, 1, '🌵', 'When an enemy Identity attacks this Structure from an adjacent tile, deal 2 damage to it.', { on(E, src, ev, d) { if (ev === 'afterAttack' && d.target === src.struct) { const a = E.unit(d.unit); if (a && E.dist(a, E.struct(src.struct) || { lane: src.lane, owner: src.owner }) <= 1) E.dealDamage(a.iid, 2, { kind: 'effect', p: src.owner }); } } }],
    ['Stone Palisade', 'Knot-Bots', 'Hardpan', 2, 13, 1, '🧱', 'This Structure takes 1 less damage from each source.', { incoming(E, src, dmg) { if (dmg.target === src.struct) dmg.amount -= 1; } }],
    ['Watch Keep', 'Feathered', 'Stagnation', 3, 12, 1, '🗼', 'Enemy Identities within 2 tiles of this Structure have -1 AP.', { stat: (E, src, u, k) => (k === 'ap' && E.foe(u.owner, src.owner) && nearSt(E, src, u) ? { v: -1, key: 'watchKeep' } : 0) }],
    ['Spiked Barricade', 'Pelted', 'Erosion', 3, 13, 1, '🪤', 'Enemy Identities that end their movement within 1 tile of this Structure take 1 damage.', { on(E, src, ev, d) { if (ev === 'moved') { const u = E.unit(d.unit); if (u && E.foe(u.owner, src.owner) && nearSt(E, src, u, 1)) E.dealDamage(u.iid, 1, { kind: 'hazard', p: src.owner }); } } }],
    ['Iron-Root Citadel', 'Knot-Bots', 'Infrastructure', 4, 16, 2, '🏰', 'When an enemy Identity within 3 tiles attacks this Structure, deal 2 damage to it.', { on(E, src, ev, d) { if (ev === 'afterAttack' && d.target === src.struct) { const a = E.unit(d.unit); const st = E.struct(src.struct); if (a && (!st || E.dist(a, st) <= 3)) E.dealDamage(a.iid, 2, { kind: 'effect', p: src.owner }); } } }],
    ['Gatehouse', 'Character', 'Predation', 3, 14, 2, '🏯', 'Friendly Identities within 2 tiles gain +1 SP while in a Lane you control.', { stat: (E, src, u, k) => (k === 'sp' && u.owner === src.owner && nearSt(E, src, u) && E.isDefending(u) ? 1 : 0) }],
    ['Knot-Bot Bulwark', 'Knot-Bots', 'Labor', 4, 18, 2, '🏭', 'This Structure takes 1 less damage. At the start of your turn, if it has free Housing, create a Knot-Bot Drone token next to it.', { incoming(E, src, dmg) { if (dmg.target === src.struct) dmg.amount -= 1; }, on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) { const st = E.struct(src.struct); if (st && E.housedCount(st) < E.structHousing(st)) { const t = E.emptyTilesNearStruct(st, 1)[0]; if (t) E.createToken(src.owner, 'TK-drone', t, st.iid); } } } }],
  ],
  Den: [
    ['Rabbit Warren', 'Pelted', 'Monopoly', 2, 6, 4, '🐇', 'A roomy den with space for four.', null],
    ['Hive Nest', 'Arthropod', 'Labor', 2, 6, 3, '🍯', 'Identities summoned here gain +1 AP and +1 SP this turn.', { on(E, src, ev, d) { if (ev === 'summoned' && d.struct === src.struct) { const u = E.unit(d.unit); E.addApBonus(u, 1, 'Hive Nest'); E.addStatus(u, eot('sp', 1, '+1 SP · Hive Nest')); } } }],
    ['Brood Den', 'Scales', 'Ancestry', 2, 7, 3, '🥚', 'Identities summoned here gain +1 AP this turn.', { on(E, src, ev, d) { if (ev === 'summoned' && d.struct === src.struct) E.addApBonus(E.unit(d.unit), 1, 'Brood Den'); } }],
    ['Wolf Den', 'Pelted', 'Predation', 3, 8, 3, '🐺', 'Identities summoned here gain +1 SP this turn.', { on(E, src, ev, d) { if (ev === 'summoned' && d.struct === src.struct) E.addStatus(E.unit(d.unit), eot('sp', 1, '+1 SP · Wolf Den')); } }],
    ['Spawning Pool', 'Ghoul', 'Persistence', 3, 7, 4, '💧', 'When a friendly Identity summoned here is defeated, draw a card.', { on(E, src, ev, d) { if (ev === 'defeated' && d.via === src.struct) E.draw(src.owner, 1); } }],
    ['Roost', 'Feathered', 'Obscurity', 3, 7, 3, '🐓', 'You may also summon Identities through this Structure onto empty tiles adjacent to it, even outside its Lane.', { summonRange: (E, src, st) => (st.iid === src.struct ? 1 : 0) }],
    ['Hatchery', 'Feathered', 'Ancestry', 4, 9, 4, '🐣', 'At the start of your turn, if this Structure has free Housing, create a Hatchling token next to it.', { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner) { const st = E.struct(src.struct); if (st && E.housedCount(st) < E.structHousing(st)) { const t = E.emptyTilesNearStruct(st, 1)[0]; if (t) E.createToken(src.owner, 'TK-hatchling', t, st.iid); } } } }],
  ],
  Landmark: [
    ['Old Totem', 'Character', 'Ancestry', 2, 9, 2, '🗿', 'Your Identities in this Lane gain +1 RP.', { stat: (E, src, u, k) => (k === 'rp' && u.owner === src.owner && E.laneOf(u) === src.lane ? 1 : 0) }],
    ['Weeping Willow', 'Ghoul', 'Venom', 2, 9, 2, '🌳', 'Enemy Identities in this Lane have -1 SP.', { stat: (E, src, u, k) => (k === 'sp' && E.foe(u.owner, src.owner) && E.laneOf(u) === src.lane ? -1 : 0) }],
    ['Great Stump', 'Pelted', 'Friction', 3, 10, 2, '🪵', 'Your Identities in this Lane gain +1 SP.', { stat: (E, src, u, k) => (k === 'sp' && u.owner === src.owner && E.laneOf(u) === src.lane ? 1 : 0) }],
    ['Beacon Pine', 'Feathered', 'Labor', 3, 10, 2, '🎄', 'Your Identities that begin their activation in this Lane gain +1 AP.', { on(E, src, ev, d) { if (ev === 'activationStart') { const u = E.unit(d.unit); if (u && u.owner === src.owner && E.laneOf(u) === src.lane) E.addApBonus(u, 1, 'Beacon Pine'); } } }],
    ['Standing Stones', 'Magically-Mutated', 'Infrastructure', 3, 11, 2, '🪨', 'Abilities of your Identities in this Lane cost 1 less MP.', { abilityCost: (E, src, u) => (u.owner === src.owner && E.laneOf(u) === src.lane ? -1 : 0) }],
    ['Moon Pool', 'Scales', 'Succulence', 3, 10, 2, '🌕', 'Your Identities in this Lane have +1 maximum MP and +2 maximum BP.', { stat: (E, src, u, k) => (u.owner === src.owner && E.laneOf(u) === src.lane ? (k === 'mp' ? 1 : k === 'bp' ? 2 : 0) : 0) }],
    ['Knotwood Clocktower', 'Knot-Bots', 'Monopoly', 4, 13, 2, '🕰️', 'At the start of your turn, if you control 3 or more Lanes, restore 3 BP to each of your Structures.', { on(E, src, ev, d) { if (ev === 'turnStart' && d.p === src.owner && E.s.lanes.filter((l) => l.ctrl === src.owner).length >= 3) for (const st of E.structsOf(src.owner)) E.healStruct(st, 3); } }],
  ],
  Facility: [
    ['Tinker\'s Workshop', 'Knot-Bots', 'Labor', 2, 9, 2, '🔧', 'Your Identities with Equipment in this Lane gain +1 AP.', { stat: (E, src, u, k) => (k === 'ap' && u.owner === src.owner && u.eq && E.laneOf(u) === src.lane ? 1 : 0) }],
    ['Apothecary', 'Scales', 'Succulence', 2, 9, 2, '⚗️', 'Consumables used by your Identities restore 1 additional BP or MP. (Does not stack.)', { healMod(E, src, u, heal) { if (heal.kind === 'consumable' && u.owner === src.owner && !heal.apoth) { heal.apoth = true; heal.amount += 1; } } }],
    ['Sap Press', 'Arthropod', 'Scarcity', 3, 9, 2, '🏭', 'Once per turn, when one of your Identities in this Lane reaches 0 MP, restore 2 MP to it.', { on(E, src, ev, d) { if (ev !== 'mpZero') return; const u = E.unit(d.unit); const st = E.struct(src.struct); if (u && st && u.owner === src.owner && E.laneOf(u) === src.lane && E.once(st, 'sapPress')) E.restoreMp(u, 2); } }],
    ['Scrapyard', 'Knot-Bots', 'Erosion', 2, 9, 2, '♻️', 'When a friendly Identity is defeated, return its Equipment to your hand instead of discarding it.', { salvage: (E, src, u) => u.owner === src.owner }],
    ['Archive Hollow', 'Character', 'Obscurity', 3, 10, 2, '📚', 'Once per turn, when you play an Action or Event, draw a card.', { on(E, src, ev, d) { if (ev === 'cardPlayed' && d.p === src.owner && (d.type === 'Action' || d.type === 'Event')) { const st = E.struct(src.struct); if (st && E.once(st, 'archive')) E.draw(src.owner, 1); } } }],
    ['Forge Stump', 'Pelted', 'Friction', 3, 10, 2, '🔥', 'Friendly Identities with Equipment within 2 tiles gain +1 SP.', { stat: (E, src, u, k) => (k === 'sp' && u.owner === src.owner && u.eq && nearSt(E, src, u) ? 1 : 0) }],
    ['Knotwood Laboratory', 'Knot-Bots', 'Infrastructure', 4, 12, 3, '🧪', 'Your Identities have +1 maximum MP. Your Knot-Bot Identities also gain +1 SP.', { stat: (E, src, u, k) => (u.owner !== src.owner ? 0 : k === 'mp' ? 1 : k === 'sp' && E.faction(u) === 'Knot-Bots' ? 1 : 0) }],
  ],
};

// ===========================================================================
// EQUIPMENT — [name, faction, archetype, cost, emoji, text, hooks, active]
// ===========================================================================
const eqStat = (mods) => (E, src, u, k) => (u.iid === src.unit && mods[k] ? mods[k] : 0);
const EQUIP = {
  Tool: [
    ['Gardener\'s Trowel', 'Character', 'Labor', 1, '🧤', 'The equipped Identity\'s abilities cost 1 less MP (minimum 1).', { abilityCost: (E, src, u, ab) => (u.iid === src.unit && ab.cost > 1 ? -1 : 0) }],
    ['Bark Chisel', 'Pelted', 'Erosion', 1, '🪛', '+2 SP when attacking Structures.', { attackBonus: (E, src, u, t, ctx) => (u.iid === src.unit && ctx.isStruct ? 2 : 0) }],
    ['Grappling Vine', 'Arthropod', 'Obscurity', 2, '🪢', 'Activated — Vine Swing (1 MP): move to an empty tile within 2, ignoring other units.', null, { name: 'Vine Swing', cost: 1, targets: [{ type: 'tile', range: 2, label: 'Swing where?' }], resolve: (E, c) => E.teleport(E.unit(c.unit), c.targets[0]) }],
    ['Surveyor\'s Lens', 'Feathered', 'Infrastructure', 1, '🧭', '+1 RP. The equipped Identity\'s abilities gain +1 range.', { stat: eqStat({ rp: 1 }), abilityRange: (E, src, u) => (u.iid === src.unit ? 1 : 0) }],
    ['Lantern of Dusk', 'Ghoul', 'Seclusion', 2, '🏮', '+1 maximum MP and +1 RP.', { stat: eqStat({ mp: 1, rp: 1 }) }],
    ['Builder\'s Mallet', 'Knot-Bots', 'Labor', 2, '🔨', 'Activated — Hammer Time (1 MP): restore 2 BP to a friendly Structure within 2 tiles.', null, { name: 'Hammer Time', cost: 1, targets: [{ type: 'struct', side: 'friendly', range: 2, label: 'Repair which Structure?' }], resolve: (E, c) => E.healStruct(E.struct(c.targets[0]), 2) }],
    ['Doctor\'s Wrench', 'Knot-Bots', 'Infrastructure', 2, '🔧', '+1 SP. If the equipped Identity is a Knot-Bot, it also gains +2 BP and +1 AP.', { stat(E, src, u, k) { if (u.iid !== src.unit) return 0; if (k === 'sp') return 1; const bot = E.faction(u) === 'Knot-Bots'; if (bot && k === 'bp') return 2; if (bot && k === 'ap') return 1; return 0; } }],
  ],
  Accessory: [
    ['Feather Charm', 'Feathered', 'Obscurity', 1, '🪶', '+1 AP.', { stat: eqStat({ ap: 1 }) }],
    ['Owl Monocle', 'Feathered', 'Predation', 1, '🧐', '+1 RP.', { stat: eqStat({ rp: 1 }) }],
    ['Lucky Acorn', 'Pelted', 'Succulence', 1, '🌰', '+2 maximum MP.', { stat: eqStat({ mp: 2 }) }],
    ['Hunter\'s Whistle', 'Character', 'Predation', 1, '📯', '+1 SP when attacking a damaged enemy.', { attackBonus: (E, src, u, t, ctx) => (u.iid === src.unit && !ctx.isStruct && t.bp < E.maxBp(t) ? 1 : 0) }],
    ['Ancestral Locket', 'Character', 'Ancestry', 2, '📿', '+1 SP and +1 AP while adjacent to a friendly Identity sharing the equipped Identity\'s Faction.', { stat(E, src, u, k) { if (u.iid !== src.unit || (k !== 'sp' && k !== 'ap')) return 0; return E.friendlyAdjacent(u).some((o) => E.sameFaction(o, u)) ? 1 : 0; } }],
    ['Swiftwind Anklet', 'Feathered', 'Labor', 2, '🦶', '+1 AP. The first tile moved each activation costs no AP.', { stat: eqStat({ ap: 1 }), firstStepFree: (E, src, u) => u.iid === src.unit && u.state !== 'done' }],
    ['Moonstone Pendant', 'Magically-Mutated', 'Seclusion', 2, '💎', '+2 maximum MP. Abilities gain +1 range.', { stat: eqStat({ mp: 2 }), abilityRange: (E, src, u) => (u.iid === src.unit ? 1 : 0) }],
  ],
  Armor: [
    ['Bark Plate', 'Magically-Mutated', 'Hardpan', 1, '🛡️', '+2 maximum BP.', { stat: eqStat({ bp: 2 }) }],
    ['Shell Guard', 'Scales', 'Obscurity', 1, '🐚', 'The equipped Identity takes 1 less damage from ranged attacks.', { incoming(E, src, dmg) { if (dmg.target === src.unit && dmg.attack && dmg.ranged) dmg.amount -= 1; } }],
    ['Mossweave Cloak', 'Pelted', 'Persistence', 2, '🧥', 'The first damage the equipped Identity receives each turn is reduced by 1.', { incoming(E, src, dmg) { if (dmg.target === src.unit && dmg.amount > 0 && E.once(E.unit(src.unit), 'mossweave')) dmg.amount -= 1; } }],
    ['Rooted Greaves', 'Arthropod', 'Hardpan', 1, '🥾', '+1 maximum BP. The equipped Identity cannot be forcibly moved.', { stat: eqStat({ bp: 1 }), forcedImmune: (E, src, u) => u.iid === src.unit }],
    ['Ironbark Mail', 'Knot-Bots', 'Hardpan', 2, '⛓️', '+3 maximum BP, -1 AP.', { stat: eqStat({ bp: 3, ap: -1 }) }],
    ['Scaled Hauberk', 'Scales', 'Persistence', 2, '🐉', '+2 maximum BP. The equipped Identity takes 1 less damage from attacks.', { stat: eqStat({ bp: 2 }), incoming(E, src, dmg) { if (dmg.target === src.unit && dmg.attack) dmg.amount -= 1; } }],
    ['Crystal Carapace', 'Arthropod', 'Scarcity', 3, '💠', '+1 maximum BP. Damage greater than 3 from a single source is reduced to 3.', { stat: eqStat({ bp: 1 }), incoming(E, src, dmg) { if (dmg.target === src.unit && dmg.amount > 3) dmg.amount = 3; } }],
  ],
  Weapon: [
    ['Thorn Spear', 'Pelted', 'Friction', 1, '🔱', '+1 SP.', { stat: eqStat({ sp: 1 }) }],
    ['Hunting Bow', 'Character', 'Obscurity', 1, '🏹', '+1 RP. +1 SP on attacks from 2 or more tiles away.', { stat: eqStat({ rp: 1 }), attackBonus: (E, src, u, t, ctx) => (u.iid === src.unit && ctx.dist >= 2 ? 1 : 0) }],
    ['Fang Dagger', 'Ghoul', 'Predation', 2, '🗡️', '+2 SP when attacking adjacent enemies.', { attackBonus: (E, src, u, t, ctx) => (u.iid === src.unit && ctx.dist === 1 ? 2 : 0) }],
    ['Splitting Maul', 'Knot-Bots', 'Erosion', 2, '🔨', '+1 SP. +2 more SP when attacking Structures.', { stat: eqStat({ sp: 1 }), attackBonus: (E, src, u, t, ctx) => (u.iid === src.unit && ctx.isStruct ? 2 : 0) }],
    ['Venom Stinger', 'Arthropod', 'Venom', 2, '🦂', '+1 SP. Enemies damaged by the equipped Identity\'s attacks lose 1 AP until the end of their next activation.', { stat: eqStat({ sp: 1 }), on(E, src, ev, d) { if (ev === 'damaged' && d.srcUnit === src.unit && d.kind === 'attack') { const t = E.unit(d.target); if (t && E.foe(t.owner, src.owner)) actDebuff(E, t, 'ap', -1, '-1 AP · Venom'); } } }],
    ['Rusted Cleaver', 'Knot-Bots', 'Scarcity', 2, '🪓', '+3 SP, -1 AP.', { stat: eqStat({ sp: 3, ap: -1 }) }],
    ['Crystal Longbow', 'Magically-Mutated', 'Obscurity', 3, '🎯', '+1 SP, +2 RP.', { stat: eqStat({ sp: 1, rp: 2 }) }],
  ],
  Trap: [
    ['Snare Wire', 'Pelted', 'Stagnation', 1, '🪢', 'Once per turn, when an enemy Identity moves adjacent to the equipped Identity, it loses its remaining AP.', { on(E, src, ev, d) { if (ev !== 'step') return; const m = E.unit(src.unit); const e = E.unit(d.unit); if (m && e && E.foe(e.owner, m.owner) && ch(e, m) === 1 && e.state === 'active' && E.once(m, 'snare')) { e.apSpent += E.apAvail(e); e.freeSteps = 0; e.moveStopped = true; E.emit({ t: 'status', target: e.iid, text: 'Snared!', good: false }); } } }],
    ['Pitfall Stakes', 'Knot-Bots', 'Erosion', 1, '🪤', 'Once per turn, an enemy Identity that ends its movement adjacent to the equipped Identity takes 2 damage.', { on(E, src, ev, d) { if (ev !== 'moved') return; const m = E.unit(src.unit); const e = E.unit(d.unit); if (m && e && E.foe(e.owner, m.owner) && ch(e, m) === 1 && E.once(m, 'pitfall')) E.dealDamage(e.iid, 2, { kind: 'effect', unit: m.iid, p: m.owner }); } }],
    ['Bramble Coil', 'Magically-Mutated', 'Friction', 1, '🌿', 'When the equipped Identity is attacked by an adjacent enemy, deal 2 damage to the attacker.', { on(E, src, ev, d) { if (ev === 'afterAttack' && d.target === src.unit) { const a = E.unit(d.unit); const m = E.unit(src.unit); if (a && m && ch(a, m) === 1) E.dealDamage(a.iid, 2, { kind: 'effect', unit: m.iid, p: m.owner }); } } }],
    ['Tripwire Bell', 'Feathered', 'Obscurity', 1, '🔔', 'Once per turn, when an enemy Identity moves within 2 tiles of the equipped Identity, it may move 1 tile.', { on(E, src, ev, d) { if (ev !== 'moved') return; const m = E.unit(src.unit); const e = E.unit(d.unit); if (m && e && E.foe(e.owner, m.owner) && ch(e, m) <= 2 && E.once(m, 'tripwire')) E.grantFreeSteps(m, 1, 'Tripwire'); } }],
    ['Spore Mine', 'Ghoul', 'Venom', 2, '💥', 'When the equipped Identity is defeated, deal 2 damage to each adjacent enemy Identity.', { on(E, src, ev, d) { if (ev === 'dying' && d.unit === src.unit) { const m = E.unit(src.unit); const es = E.enemiesAdjacent(m).map((e) => e.iid); E.later(() => es.forEach((id) => E.dealDamage(id, 2, { kind: 'effect', p: m.owner }))); } } }],
    ['Net Launcher', 'Knot-Bots', 'Stagnation', 2, '🥅', 'When the equipped Identity is attacked from range, the attacker loses 2 AP until the end of its next activation.', { on(E, src, ev, d) { if (ev === 'afterAttack' && d.target === src.unit && d.ranged) { const a = E.unit(d.unit); if (a) actDebuff(E, a, 'ap', -2, '-2 AP · Netted'); } } }],
    ['Deadfall', 'Character', 'Predation', 3, '🪵', 'Once per turn, when an enemy attacks the equipped Identity, deal 3 damage to that enemy before the attack resolves.', { on(E, src, ev, d) { if (ev === 'beforeAttack' && d.target === src.unit) { const a = E.unit(d.unit); const m = E.unit(src.unit); if (a && m && E.once(m, 'deadfall')) E.dealDamage(a.iid, 3, { kind: 'effect', unit: m.iid, p: m.owner }); } } }],
  ],
};

// ===========================================================================
// CONSUMABLES — [name, faction, archetype, cost, emoji, text, use|hooks, restores]
// ===========================================================================
const selfUse = (resolve, condition) => ({ targets: [], resolve, condition });
// Consumables that may be used as a Response (Phase 1 §14.6)
const RESPONSE_CONS = new Set(['Smoke Pellet', 'Mirror Shard', 'Ironbark Tonic', 'Healing Salve', 'Antidote Leaf', 'Full Restorative', 'Hunter\'s Jerky', 'Trail Rations', 'Whistle Reed']);
const CONS = {
  Trinket: [
    ['Smoke Pellet', 'Character', 'Obscurity', 1, '💨', 'Use: move the equipped Identity to an empty tile within 2, ignoring other units.', { targets: [{ type: 'tile', range: 2, label: 'Vanish to where?' }], resolve: (E, c) => E.teleport(E.unit(c.unit), c.targets[0]) }],
    ['Whistle Reed', 'Feathered', 'Stagnation', 1, '🎶', 'Use: target enemy Identity within 2 tiles loses 2 AP until the end of its next activation.', { targets: [{ type: 'unit', side: 'enemy', range: 2, label: 'Whistle at whom?' }], resolve: (E, c) => actDebuff(E, E.unit(c.targets[0]), 'ap', -2, '-2 AP · Startled') }],
    ['Mirror Shard', 'Magically-Mutated', 'Seclusion', 1, '🪞', 'Use: swap places with an adjacent Identity.', { targets: [{ type: 'unit', side: 'any', range: 1, notSelf: true, label: 'Swap with whom?' }], resolve: (E, c) => { const t = E.unit(c.targets[0]); if (E.foe(t.owner, c.p) && E.hookAny('forcedImmune', t, c.p)) return; E.swap(E.unit(c.unit), t); } }],
    ['Lucky Coin', 'Pelted', 'Scarcity', 1, '🪙', 'Use: draw 2 cards.', selfUse((E, c) => E.draw(c.p, 2))],
    ['Hourglass Charm', 'Character', 'Persistence', 2, '⏳', 'Use: the equipped Identity may activate again this turn.', selfUse((E, c) => E.refreshUnit(E.unit(c.unit)), (E, c) => E.unit(c.unit).state === 'done')],
  ],
  Enchantment: [
    ['Bramble Draught', 'Magically-Mutated', 'Friction', 1, '🧪', 'Use: +2 SP this turn.', selfUse((E, c) => E.addStatus(E.unit(c.unit), eot('sp', 2, '+2 SP')))],
    ['Ironbark Tonic', 'Pelted', 'Hardpan', 1, '🍶', 'Use: gain a Barrier that prevents the next 3 damage.', selfUse((E, c) => E.giveBarrier(E.unit(c.unit), 3))],
    ['Hasteberry', 'Feathered', 'Labor', 1, '🫐', 'Use: +2 AP this turn.', selfUse((E, c) => E.addApBonus(E.unit(c.unit), 2, 'Hasteberry'))],
    ['Firefly Jar', 'Arthropod', 'Obscurity', 1, '🧴', 'Use: +2 RP and +1 SP this turn.', selfUse((E, c) => { const u = E.unit(c.unit); E.addStatus(u, eot('rp', 2, '+2 RP')); E.addStatus(u, eot('sp', 1, '+1 SP')); })],
    ['Moon Elixir', 'Ghoul', 'Seclusion', 2, '🌙', 'Use: the equipped Identity\'s abilities cost 0 MP this turn.', selfUse((E, c) => E.addStatus(E.unit(c.unit), { kind: 'abilitiesFree', at: 'eot', label: 'Free abilities', good: true }))],
  ],
  Recovery: [
    ['Healing Salve', 'Scales', 'Succulence', 1, '🩹', 'Use: restore 3 BP.', selfUse((E, c) => E.heal(E.unit(c.unit), 3, { kind: 'consumable' })), true],
    ['Mind Moss', 'Magically-Mutated', 'Succulence', 1, '🌱', 'Use: restore 3 MP.', selfUse((E, c) => E.restoreMp(E.unit(c.unit), 3, { kind: 'consumable' })), true],
    ['Antidote Leaf', 'Character', 'Venom', 1, '🍃', 'Use: remove negative effects and restore 2 BP.', selfUse((E, c) => { const u = E.unit(c.unit); E.cleanse(u); E.heal(u, 2, { kind: 'consumable' }); }), true],
    ['Full Restorative', 'Feathered', 'Persistence', 2, '💖', 'Use: restore all BP and MP.', selfUse((E, c) => { const u = E.unit(c.unit); E.heal(u, 99, { kind: 'consumable' }); E.restoreMp(u, 99, { kind: 'consumable' }); }), true],
    ['Phoenix Feather', 'Feathered', 'Persistence', 2, '🔥', 'Automatic: when the equipped Identity would be defeated, it survives with half its maximum BP instead. Then discard this.', { auto: true }],
  ],
  Provision: [
    ['Trail Rations', 'Pelted', 'Labor', 0, '🥪', 'Use: restore 2 BP and 1 MP.', selfUse((E, c) => { const u = E.unit(c.unit); E.heal(u, 2, { kind: 'consumable' }); E.restoreMp(u, 1, { kind: 'consumable' }); }), true],
    ['Acorn Cake', 'Pelted', 'Succulence', 1, '🧁', 'Use: +1 AP this turn and restore 1 MP.', selfUse((E, c) => { const u = E.unit(c.unit); E.addApBonus(u, 1, 'Acorn Cake'); E.restoreMp(u, 1, { kind: 'consumable' }); }), true],
    ['Canteen', 'Scales', 'Scarcity', 1, '🥤', 'Use: restore 2 MP and 1 BP.', selfUse((E, c) => { const u = E.unit(c.unit); E.restoreMp(u, 2, { kind: 'consumable' }); E.heal(u, 1, { kind: 'consumable' }); }), true],
    ['Hunter\'s Jerky', 'Character', 'Predation', 1, '🍖', 'Use: +1 SP this turn and restore 2 BP.', selfUse((E, c) => { const u = E.unit(c.unit); E.addStatus(u, eot('sp', 1, '+1 SP')); E.heal(u, 2, { kind: 'consumable' }); }), true],
    ['Feast Basket', 'Character', 'Ancestry', 2, '🧺', 'Use: restore 2 BP to each friendly Identity in the equipped Identity\'s Lane, then draw a card.', selfUse((E, c) => { const m = E.unit(c.unit); for (const u of E.unitsInLane(E.laneOf(m), c.p)) E.heal(u, 2, { kind: 'consumable' }); E.draw(c.p, 1); }), true],
  ],
  Catalyst: [
    ['Adrenal Sap', 'Magically-Mutated', 'Friction', 1, '💉', 'Use: restore 2 MP and gain +1 SP this turn.', selfUse((E, c) => { const u = E.unit(c.unit); E.restoreMp(u, 2, { kind: 'consumable' }); E.addStatus(u, eot('sp', 1, '+1 SP')); }), true],
    ['Surge Spore', 'Arthropod', 'Scarcity', 1, '⚡', 'Use: +3 AP this turn.', selfUse((E, c) => E.addApBonus(E.unit(c.unit), 3, 'Surge Spore'))],
    ['Overcharge Cell', 'Knot-Bots', 'Labor', 1, '🔋', 'Use: restore 3 MP. If the equipped Identity is a Knot-Bot, restore 4 instead.', selfUse((E, c) => { const u = E.unit(c.unit); E.restoreMp(u, E.faction(u) === 'Knot-Bots' ? 4 : 3, { kind: 'consumable' }); }), true],
    ['Wild Mutagen', 'Magically-Mutated', 'Erosion', 1, '🧬', 'Use: +3 SP this turn. The equipped Identity takes 1 damage.', selfUse((E, c) => { const u = E.unit(c.unit); E.addStatus(u, eot('sp', 3, '+3 SP')); E.dealDamage(u.iid, 1, { kind: 'effect', p: c.p }); })],
    ['Time Seed', 'Ghoul', 'Persistence', 2, '🌰', 'Use: +2 AP this turn, and the equipped Identity\'s next ability this turn costs 0 MP.', selfUse((E, c) => { const u = E.unit(c.unit); E.addApBonus(u, 2, 'Time Seed'); E.addStatus(u, { kind: 'freeAbility', at: 'eot', label: 'Next ability free', good: true }); })],
  ],
};
const PHOENIX_HOOKS = {
  lethal(E, src, u) {
    if (u.iid !== src.unit || !u.cons || u.cons !== src.card) return false;
    const cid = u.cons;
    u.cons = null;
    E.dirty();
    u.bp = Math.ceil(E.maxBp(u) / 2);
    E.toDiscard(cid);
    E.emit({ t: 'consume', unit: u.iid, cardId: E.s.inst[cid].cardId, name: 'Phoenix Feather' });
    return true;
  },
};

// ===========================================================================
// ACTIONS — [name, faction, archetype, cost, emoji, text, play]
// ===========================================================================
const friendly = (label, extra = {}) => ({ type: 'unit', side: 'friendly', label, ...extra });
const enemy = (label, extra = {}) => ({ type: 'unit', side: 'enemy', label, ...extra });
const nearFriend = (n) => ({ side: 'friendly', n });
const chainAttackOn = (side) => (E, it, ctx) => it.kind === 'attack' && !it.negated && E.entity(it.target) && (side === 'friendly' ? E.entity(it.target).owner === ctx.p : true);
const ACTIONS = {
  Interaction: [
    ['Thorn Dart', 'Pelted', 'Friction', 1, '🎯', 'Deal 2 damage to target enemy Identity within 2 tiles of a friendly Identity.', { targets: [enemy('Dart which enemy?', { near: nearFriend(2) })], resolve: (E, c) => E.dealDamage(c.targets[0], 2, { kind: 'effect', p: c.p, ranged: true }) }],
    ['Sap Siphon', 'Magically-Mutated', 'Scarcity', 1, '🩸', 'Target enemy Identity loses 3 MP.', { targets: [enemy('Siphon which enemy?')], resolve: (E, c) => E.loseMp(E.unit(c.targets[0]), 3) }],
    ['Entangle', 'Arthropod', 'Stagnation', 2, '🕸️', 'Target enemy Identity loses 3 AP until the end of its next activation.', { targets: [enemy('Entangle which enemy?')], resolve: (E, c) => actDebuff(E, E.unit(c.targets[0]), 'ap', -3, '-3 AP · Entangled') }],
    ['Disarm', 'Character', 'Erosion', 2, '🤚', 'Discard the Equipment attached to target enemy Identity.', { targets: [enemy('Disarm which enemy?', { filter: (E, u) => !!u.eq })], resolve: (E, c) => E.detachEquip(E.unit(c.targets[0])) }],
    ['Splinter Volley', 'Knot-Bots', 'Erosion', 2, '🪵', 'Deal 3 damage to target enemy Structure within 3 tiles of a friendly Identity.', { targets: [{ type: 'struct', side: 'enemy', near: nearFriend(3), label: 'Volley which Structure?' }], resolve: (E, c) => E.dealDamage(c.targets[0], 3, { kind: 'effect', p: c.p, ranged: true }) }],
    ['Poison Dart', 'Arthropod', 'Venom', 2, '☠️', 'Deal 1 damage to target enemy Identity. It gets -2 SP until the end of its next activation.', { targets: [enemy('Poison which enemy?')], resolve: (E, c) => { const u = E.unit(c.targets[0]); actDebuff(E, u, 'sp', -2, '-2 SP · Poisoned'); E.dealDamage(u.iid, 1, { kind: 'effect', p: c.p, ranged: true }); } }],
    ['Uproot', 'Magically-Mutated', 'Hardpan', 3, '🌪️', 'Return target enemy Identity with cost 3 or less to its owner\'s hand.', { targets: [enemy('Uproot which enemy?', { filter: (E, u) => E.def(u.cardId).cost <= 3 })], resolve: (E, c) => E.bounce(E.unit(c.targets[0])) }],
    ['Duel of Fates', 'Character', 'Friction', 3, '⚔️', 'Choose a friendly Identity and an enemy Identity within its RP. Each deals damage equal to its SP to the other.', { targets: [friendly('Choose your duelist'), { type: 'unit', side: 'enemy', label: 'Choose their opponent', filter: (E, u, ctx) => { const f = E.unit(ctx.targets[0]); return f && E.dist(f, u) <= E.stat(f, 'rp'); } }], resolve: (E, c) => { const a = E.unit(c.targets[0]); const b = E.unit(c.targets[1]); const sa = E.stat(a, 'sp'); const sb = E.stat(b, 'sp'); E.dealDamage(b.iid, sa, { kind: 'effect', unit: a.iid, p: c.p }); E.dealDamage(a.iid, sb, { kind: 'effect', unit: b.iid, p: b.owner }); } }],
  ],
  Command: [
    ['Rally Cry', 'Character', 'Ancestry', 1, '📯', 'Your Identities in target Lane gain +1 AP this turn.', { targets: [{ type: 'lane', label: 'Rally which Lane?', filter: (E, l, ctx) => E.unitsInLane(l, ctx.p).length > 0 }], resolve: (E, c) => { for (const u of E.unitsInLane(c.targets[0], c.p)) E.addApBonus(u, 1, 'Rally Cry'); } }],
    ['War Drums', 'Pelted', 'Friction', 2, '🥁', 'Your Identities gain +1 SP this turn.', { targets: [], condition: (E, c) => E.unitsOf(c.p).length > 0, resolve: (E, c) => { for (const u of E.unitsOf(c.p)) E.addStatus(u, eot('sp', 1, '+1 SP · War Drums')); } }],
    ['Advance!', 'Knot-Bots', 'Labor', 2, '🚩', 'Each of your Identities may move 1 tile (even if it has finished its activation).', { targets: [], condition: (E, c) => E.unitsOf(c.p).length > 0, resolve: (E, c) => { for (const u of E.unitsOf(c.p)) E.grantFreeSteps(u, 1, 'Advance!'); } }],
    ['Focus Fire', 'Feathered', 'Predation', 1, '🎯', 'Target enemy Identity is Marked this turn: attacks against it gain +2 SP.', { targets: [enemy('Mark which enemy?')], resolve: (E, c) => E.addStatus(E.unit(c.targets[0]), { kind: 'marked', v: 2, at: 'eot', label: 'Marked +2', good: false }) }],
    ['Hold the Line', 'Scales', 'Hardpan', 2, '🛡️', 'Until your next turn, your Identities in target Lane take 1 less damage from each source.', { targets: [{ type: 'lane', label: 'Hold which Lane?', filter: (E, l, ctx) => E.unitsInLane(l, ctx.p).length > 0 }], resolve: (E, c) => { for (const u of E.unitsInLane(c.targets[0], c.p)) E.addStatus(u, { kind: 'guard', v: 1, at: 'sot', p: c.p, label: 'Hold the Line', good: true }); } }],
    ['Muster', 'Arthropod', 'Infrastructure', 1, '📣', 'Identities you summon this turn gain +1 AP and +1 SP this turn. Draw a card.', { targets: [], resolve: (E, c) => { E.addMod('KF-MUSTER', c.p, { at: 'eot' }); E.draw(c.p, 1); } }],
    ['Charge Orders', 'Character', 'Labor', 3, '⚔️', 'Your Identities gain +1 AP and +1 SP this turn.', { targets: [], condition: (E, c) => E.unitsOf(c.p).length > 0, resolve: (E, c) => { for (const u of E.unitsOf(c.p)) { E.addApBonus(u, 1, 'Charge!'); E.addStatus(u, eot('sp', 1, '+1 SP · Charge!')); } } }],
    ['Regroup', 'Ghoul', 'Persistence', 3, '🔁', 'Target friendly Identity that has finished its activation restores its MP and may activate again this turn (including moving).', { targets: [friendly('Regroup which Identity?', { filter: (E, u) => u.state === 'done' })], resolve: (E, c) => E.refreshUnit(E.unit(c.targets[0])) }],
  ],
  Maneuver: [
    ['Dash', 'Pelted', 'Labor', 1, '💨', 'Target friendly Identity gains +2 AP this turn.', { targets: [friendly('Who dashes?', { filter: (E, u) => u.state !== 'done' })], resolve: (E, c) => E.addApBonus(E.unit(c.targets[0]), 2, 'Dash') }],
    ['Retreat', 'Scales', 'Seclusion', 1, '↩️', 'Move target friendly Identity to an empty tile within 2 tiles and restore 1 BP to it.', { targets: [friendly('Who retreats?'), { type: 'tile', label: 'Retreat to where?', filter: (E, t, ctx) => { const u = E.unit(ctx.targets[0]); return u && ch(u, t) <= 2; } }], resolve: (E, c) => { const u = E.unit(c.targets[0]); E.teleport(u, c.targets[1]); E.heal(u, 1); } }],
    ['Leapfrog', 'Feathered', 'Obscurity', 2, '🐸', 'Move target friendly Identity to an empty tile within 3 tiles, ignoring other units.', { targets: [friendly('Who leaps?'), { type: 'tile', label: 'Leap to where?', filter: (E, t, ctx) => { const u = E.unit(ctx.targets[0]); return u && ch(u, t) <= 3; } }], resolve: (E, c) => E.teleport(E.unit(c.targets[0]), c.targets[1]) }],
    ['Shove', 'Knot-Bots', 'Hardpan', 1, '👐', 'Push target enemy Identity adjacent to a friendly Identity 2 tiles away from it.', { targets: [enemy('Shove which enemy?', { near: nearFriend(1) })], resolve: (E, c) => { const t = E.unit(c.targets[0]); const f = E.unitsOf(c.p).find((u) => ch(u, t) === 1); if (f) E.push(t, f, 2, c.p, { srcUnit: f.iid }); } }],
    ['Reposition', 'Arthropod', 'Ancestry', 1, '🔄', 'Swap the positions of two friendly Identities.', { targets: [friendly('First Identity'), friendly('Second Identity', { filter: (E, u, ctx) => u.iid !== ctx.targets[0] })], resolve: (E, c) => E.swap(E.unit(c.targets[0]), E.unit(c.targets[1])) }],
    ['Flank', 'Ghoul', 'Predation', 2, '🌀', 'Move target friendly Identity to an empty tile adjacent to an enemy Identity within 4 tiles of it.', { targets: [friendly('Who flanks?'), { type: 'tile', label: 'Flank to where?', filter: (E, t, ctx) => { const u = E.unit(ctx.targets[0]); return u && ch(u, t) <= 4 && E.allUnits().some((e) => E.foe(e.owner, ctx.p) && ch(e, t) === 1); } }], resolve: (E, c) => E.teleport(E.unit(c.targets[0]), c.targets[1]) }],
    ['Burrow Tunnel', 'Pelted', 'Infrastructure', 2, '🕳️', 'Move target friendly Identity to any empty tile in a Lane you control.', { targets: [friendly('Who tunnels?'), { type: 'tile', label: 'Emerge where?', filter: (E, t, ctx) => E.laneCtrl(E.laneAt(t.x, t.y)) === ctx.p }], resolve: (E, c) => E.teleport(E.unit(c.targets[0]), c.targets[1]) }],
    ['Hit and Run', 'Character', 'Friction', 2, '🏃', 'Target friendly Identity that has attacked this turn restores 2 MP and may move 2 tiles.', { targets: [friendly('Who strikes again?', { filter: (E, u) => !!(u.act && u.act.attacks > 0) })], resolve: (E, c) => { const u = E.unit(c.targets[0]); E.extend(u); E.restoreMp(u, 2); E.grantFreeSteps(u, 2, 'Hit and Run'); } }],
  ],
  Technique: [
    ['Power Strike', 'Pelted', 'Friction', 1, '💥', 'Target friendly Identity\'s next attack this turn gains +2 SP.', { targets: [friendly('Empower whom?')], resolve: (E, c) => E.addStatus(E.unit(c.targets[0]), { kind: 'nextAttack', v: 2, at: 'eot', label: 'Next attack +2' }) }],
    ['Piercing Shot', 'Feathered', 'Obscurity', 1, '🏹', 'Target friendly Identity gains +2 RP this turn.', { targets: [friendly('Who aims?')], resolve: (E, c) => E.addStatus(E.unit(c.targets[0]), eot('rp', 2, '+2 RP')) }],
    ['Siege Tactics', 'Knot-Bots', 'Erosion', 1, '🧨', 'Target friendly Identity\'s next attack against a Structure this turn gains +3 SP.', { targets: [friendly('Who lays siege?')], resolve: (E, c) => E.addStatus(E.unit(c.targets[0]), { kind: 'nextAttack', v: 0, vsStruct: 3, at: 'eot', label: 'Siege +3' }) }],
    ['Momentum', 'Scales', 'Labor', 1, '🌊', 'Target friendly Identity gains +1 SP this turn for each tile it moved during its current activation (maximum +3).', { targets: [friendly('Whose momentum?', { filter: (E, u) => u.act && u.act.moved > 0 && u.state === 'active' })], resolve: (E, c) => { const u = E.unit(c.targets[0]); const n = Math.min(3, (u.act && u.act.moved) || 0); if (n) E.addStatus(u, eot('sp', n, `+${n} SP · Momentum`)); } }],
    ['Double Tap', 'Character', 'Predation', 2, '✌️', 'Target friendly Identity that has attacked this turn restores 3 MP and may keep acting (but not move).', { targets: [friendly('Who attacks again?', { filter: (E, u) => !!(u.act && u.act.attacks > 0) })], resolve: (E, c) => { const u = E.unit(c.targets[0]); E.extend(u); E.restoreMp(u, 3); } }],
    ['Sweeping Blow', 'Pelted', 'Erosion', 2, '🌀', 'Target friendly Identity\'s next attack this turn also deals 1 damage to each enemy adjacent to its target.', { targets: [friendly('Who sweeps?')], resolve: (E, c) => E.addStatus(E.unit(c.targets[0]), { kind: 'nextAttack', v: 0, splash: 1, at: 'eot', label: 'Sweeping' }) }],
    ['Execution', 'Ghoul', 'Predation', 2, '⚰️', 'Deal 3 damage to target enemy Identity at half its maximum BP or less that is within 3 tiles of a friendly Identity.', { targets: [enemy('Execute which enemy?', { near: nearFriend(3), filter: (E, u) => u.bp <= E.maxBp(u) / 2 })], resolve: (E, c) => E.dealDamage(c.targets[0], 3, { kind: 'effect', p: c.p }) }],
    ['Perfect Form', 'Character', 'Labor', 3, '🌟', 'Target friendly Identity\'s next attack this turn deals double damage.', { targets: [friendly('Who strikes perfectly?')], resolve: (E, c) => E.addStatus(E.unit(c.targets[0]), { kind: 'nextAttack', v: 0, mult: 2, at: 'eot', label: 'Double damage!' }) }],
  ],
  Reaction: [
    ['Brace', 'Pelted', 'Hardpan', 1, '🛡️', 'Response. Target friendly Identity gains a Barrier that prevents the next 2 damage.', { timing: 'response', targets: [friendly('Brace whom?')], resolve: (E, c) => E.giveBarrier(E.unit(c.targets[0]), 2) }],
    ['Sidestep', 'Feathered', 'Obscurity', 1, '💃', 'Response. Move target friendly Identity to an empty adjacent tile. (Attacks that lose range miss.)', { timing: 'response', targets: [friendly('Who sidesteps?', { filter: (E, u) => E.emptyAdjacentTiles(u).length > 0 }), { type: 'tile', label: 'Step where?', filter: (E, t, ctx) => { const u = E.unit(ctx.targets[0]); return u && ch(u, t) === 1; } }], resolve: (E, c) => E.teleport(E.unit(c.targets[0]), c.targets[1]) }],
    ['Counterstrike', 'Character', 'Friction', 2, '↪️', 'Response. Choose an attack targeting one of your Identities: that Identity first deals damage equal to its SP to the attacker.', { timing: 'response', targets: [{ type: 'chain', label: 'Counter which attack?', filter: (E, it, ctx) => chainAttackOn('friendly')(E, it, ctx) && !!E.unit(it.target) }], resolve: (E, c) => { const it = E.s.chain[c.targets[0]]; if (!it || it.kind !== 'attack') return; const d = E.unit(it.target); const a = E.unit(it.unit); if (d && a) E.dealDamage(a.iid, E.stat(d, 'sp'), { kind: 'effect', unit: d.iid, p: c.p }); } }],
    ['Distraction', 'Magically-Mutated', 'Seclusion', 1, '🎭', 'Response. Choose an attack: it deals 2 less damage.', { timing: 'response', targets: [{ type: 'chain', label: 'Distract which attack?', filter: (E, it) => it.kind === 'attack' }], resolve: (E, c) => { const it = E.s.chain[c.targets[0]]; if (it && it.kind === 'attack') it.mods.reduce = (it.mods.reduce || 0) + 2; } }],
    ['Emergency Recall', 'Knot-Bots', 'Persistence', 2, '📦', 'Response. Return target friendly Identity to your hand.', { timing: 'response', targets: [friendly('Recall whom?', { filter: (E, u) => !E.def(u.cardId).token })], resolve: (E, c) => E.bounce(E.unit(c.targets[0])) }],
    ['Barkskin Ward', 'Magically-Mutated', 'Infrastructure', 2, '🌳', 'Response. Your Identities in target Lane take 1 less damage from each source this turn.', { timing: 'response', targets: [{ type: 'lane', label: 'Ward which Lane?', filter: (E, l, ctx) => E.unitsInLane(l, ctx.p).length > 0 }], resolve: (E, c) => { for (const u of E.unitsInLane(c.targets[0], c.p)) E.addStatus(u, { kind: 'guard', v: 1, at: 'eot', label: 'Barkskin', good: true }); } }],
    ['Snap Negation', 'Character', 'Scarcity', 3, '🚫', 'Response. Negate target Action or Event on the chain.', { timing: 'response', targets: [{ type: 'chain', label: 'Negate which card?', filter: (E, it, ctx) => it.kind === 'card' && it.p !== ctx.p && !it.negated }], resolve: (E, c) => { const it = E.s.chain[c.targets[0]]; if (it) it.negated = true; } }],
    ['Mirror Reversal', 'Ghoul', 'Erosion', 3, '🪞', 'Response. Negate target attack against one of your Identities; the attacker takes damage equal to its own SP.', { timing: 'response', targets: [{ type: 'chain', label: 'Reverse which attack?', filter: chainAttackOn('friendly') }], resolve: (E, c) => { const it = E.s.chain[c.targets[0]]; if (it) { it.negated = true; it.reflect = true; } } }],
  ],
};

// ===========================================================================
// EVENTS — [name, faction, archetype, cost, emoji, duration, text, play, modHooks]
// ===========================================================================
const EVENTS = {
  Object: [
    ['Treasure Cache', 'Character', 'Scarcity', 2, '💰', 'Instant', 'Draw 2 cards.', { targets: [], resolve: (E, c) => E.draw(c.p, 2) }],
    ['Fallen Log', 'Pelted', 'Hardpan', 1, '🪵', '2 rounds', 'Place a Fallen Log on target empty tile. It blocks movement until the end of your next turn.', { targets: [{ type: 'tile', label: 'Drop the log where?' }], resolve: (E, c) => { const t = c.targets[0]; if (!E.isEmpty(t.x, t.y)) return; E.s.obstacles.push({ x: t.x, y: t.y, until: E.s.turnSerial + 2, kind: 'log' }); E.dirty(); E.emit({ t: 'obstacle', x: t.x, y: t.y }); } }],
    ['Beehive Drop', 'Arthropod', 'Venom', 2, '🐝', 'Instant', 'Deal 1 damage to each Identity in target Lane. Enemy Identities there also lose 1 AP until the end of their next activation.', { targets: [{ type: 'lane', label: 'Drop the hive on which Lane?', filter: (E, l) => E.unitsInLane(l).length > 0 }], resolve: (E, c) => { for (const u of E.unitsInLane(c.targets[0])) { if (E.foe(u.owner, c.p)) actDebuff(E, u, 'ap', -1, '-1 AP · Stung'); E.dealDamage(u.iid, 1, { kind: 'effect', p: c.p }); } } }],
    ['Ancient Relic', 'Magically-Mutated', 'Ancestry', 3, '🏺', 'Permanent', 'Target friendly Identity permanently gains +1 SP and +2 maximum BP.', { targets: [friendly('Who claims the relic?')], resolve: (E, c) => { const u = E.unit(c.targets[0]); u.boost.sp = (u.boost.sp || 0) + 1; u.boost.bp = (u.boost.bp || 0) + 2; u.bp += 2; E.dirty(); E.emit({ t: 'status', target: u.iid, text: '+1 SP +2 BP!', good: true }); } }],
    ['Sap Geyser', 'Knot-Bots', 'Succulence', 2, '⛲', 'Instant', 'Restore 2 MP to each of your Identities.', { targets: [], condition: (E, c) => E.unitsOf(c.p).length > 0, resolve: (E, c) => { for (const u of E.unitsOf(c.p)) E.restoreMp(u, 2); } }],
  ],
  Weather: [
    ['Downpour', 'Scales', 'Obscurity', 2, '🌧️', 'Until end of your next turn', 'All Identities have -1 RP until the end of your next turn.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'endNext', p: c.p }) }, { stat: (E, src, u, k) => (k === 'rp' ? -1 : 0) }],
    ['Gale', 'Feathered', 'Hardpan', 2, '🌬️', 'Instant', 'Push each enemy Identity 1 tile back toward its controller\'s side of the battlefield.', { targets: [], resolve: (E, c) => { const es = E.allUnits().filter((u) => E.foe(u.owner, c.p)); const back = (u) => { const f = E.forward(u.owner); return { dx: -f.dx, dy: -f.dy }; }; es.sort((a, b) => { const fa = back(a), fb = back(b); return (b.x * fb.dx + b.y * fb.dy) - (a.x * fa.dx + a.y * fa.dy); }); for (const u of es) E.forceMove(u, back(u), 1, c.p); } }],
    ['Fog Bank', 'Ghoul', 'Seclusion', 2, '🌫️', 'Until end of your next turn', 'Ranged attacks deal 1 less damage until the end of your next turn.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'endNext', p: c.p }) }, { incoming(E, src, dmg) { if (dmg.attack && dmg.ranged) dmg.amount -= 1; } }],
    ['Thunderstorm', 'Magically-Mutated', 'Erosion', 3, '⛈️', 'Instant', 'Deal 2 damage to up to 3 random enemy Identities.', { targets: [], condition: (E, c) => E.allUnits().some((u) => E.foe(u.owner, c.p)), resolve: (E, c) => { const es = E.shuffle(E.allUnits().filter((u) => E.foe(u.owner, c.p)).map((u) => u.iid)).slice(0, 3); for (const id of es) E.dealDamage(id, 2, { kind: 'effect', p: c.p }); } }],
    ['Heatwave', 'Pelted', 'Stagnation', 3, '☀️', 'Until your next turn', 'Enemy Identities have -1 AP until the start of your next turn.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'sot', p: c.p }) }, { stat: (E, src, u, k) => (k === 'ap' && E.foe(u.owner, src.owner) ? -1 : 0) }],
  ],
  'Space-Time': [
    ['Quickening', 'Knot-Bots', 'Labor', 2, '⏩', 'This turn', 'Your Identities gain +1 AP this turn.', { targets: [], condition: (E, c) => E.unitsOf(c.p).length > 0, resolve: (E, c) => { for (const u of E.unitsOf(c.p)) E.addApBonus(u, 1, 'Quickening'); } }],
    ['Warp Rift', 'Magically-Mutated', 'Obscurity', 2, '🌀', 'Instant', 'Swap the positions of two target Identities.', { targets: [{ type: 'unit', side: 'any', label: 'First Identity' }, { type: 'unit', side: 'any', label: 'Second Identity', filter: (E, u, ctx) => u.iid !== ctx.targets[0] }], resolve: (E, c) => { const a = E.unit(c.targets[0]); const b = E.unit(c.targets[1]); for (const u of [a, b]) if (E.foe(u.owner, c.p) && E.hookAny('forcedImmune', u, c.p)) return; E.swap(a, b); } }],
    ['Stasis Field', 'Ghoul', 'Stagnation', 2, '🧊', 'Until end of their next turn', 'Target enemy Identity cannot move, attack, retaliate or use abilities until the end of its controller\'s next turn.', { targets: [enemy('Freeze which enemy?')], resolve: (E, c) => { const u = E.unit(c.targets[0]); E.addStatus(u, { kind: 'stasis', at: 'endNext', p: u.owner, label: 'Stasis', good: false }); } }],
    ['Echo of Tomorrow', 'Character', 'Persistence', 2, '🔮', 'Until end of your next turn', 'Draw a card. Until the end of your next turn, whenever one of your Identities is defeated, draw a card.', { targets: [], resolve: (E, c) => { E.draw(c.p, 1); E.addMod(c.cardId, c.p, { at: 'endNext', p: c.p }); } }, { on(E, src, ev, d) { if (ev === 'defeated' && d.owner === src.owner) E.draw(src.owner, 1); } }],
    ['Rewind', 'Scales', 'Erosion', 3, '⏪', 'Instant', 'Return target enemy Identity to its owner\'s hand.', { targets: [enemy('Rewind which enemy?')], resolve: (E, c) => E.bounce(E.unit(c.targets[0])) }],
  ],
  Customs: [
    ['Harvest Festival', 'Pelted', 'Succulence', 2, '🎑', 'Instant', 'Restore 2 BP and 1 MP to each of your Identities, and 2 BP to each of your Structures.', { targets: [], resolve: (E, c) => { for (const u of E.unitsOf(c.p)) { E.heal(u, 2); E.restoreMp(u, 1); } for (const st of E.structsOf(c.p)) E.healStruct(st, 2); } }],
    ['Truce Day', 'Character', 'Hardpan', 2, '🕊️', 'Until your next turn', 'Your Structures cannot be damaged until the start of your next turn.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'sot', p: c.p }) }, { incoming(E, src, dmg) { if (dmg.isStruct) { const st = E.struct(dmg.target); if (st && st.owner === src.owner) dmg.amount = 0; } } }],
    ['Hunting Season', 'Feathered', 'Predation', 2, '🦌', 'This turn', 'This turn, your Poacher Identities gain +1 SP and your Identities invading enemy Lanes gain +1 AP.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'eot' }) }, { stat(E, src, u, k) { if (u.owner !== src.owner) return 0; if (k === 'sp' && E.def(u.cardId).cls === 'Poacher') return 1; if (k === 'ap' && E.isInvading(u)) return 1; return 0; } }],
    ['Tribute', 'Ghoul', 'Scarcity', 2, '💸', 'Instant', 'Each opponent discards a random card, and each enemy Identity loses 1 MP.', { targets: [], resolve: (E, c) => { for (const o of E.enemiesOf(c.p)) { const h = E.P(o).hand; if (h.length) E.discardFromHand(o, h[E.randInt(h.length)]); } for (const u of E.allUnits()) if (E.foe(u.owner, c.p)) E.loseMp(u, 1); } }],
    ['Ancestor\'s Day', 'Character', 'Ancestry', 3, '🏮', 'This turn', 'This turn, your Identities adjacent to a friendly Identity sharing their Faction gain +1 SP and +1 AP.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'eot' }) }, { stat(E, src, u, k) { if (u.owner !== src.owner || (k !== 'sp' && k !== 'ap')) return 0; return E.friendlyAdjacent(u).some((o) => E.sameFaction(o, u)) ? 1 : 0; } }],
  ],
  Ecology: [
    ['Bloom', 'Magically-Mutated', 'Succulence', 2, '🌸', 'Instant', 'Restore 1 BP and 1 MP to each of your Identities.', { targets: [], resolve: (E, c) => { for (const u of E.unitsOf(c.p)) { E.heal(u, 1); E.restoreMp(u, 1); } } }],
    ['Migration', 'Feathered', 'Labor', 2, '🦆', 'This turn', 'Each of your Identities may move up to 2 tiles (even if it has finished its activation).', { targets: [], condition: (E, c) => E.unitsOf(c.p).length > 0, resolve: (E, c) => { for (const u of E.unitsOf(c.p)) E.grantFreeSteps(u, 2, 'Migration'); } }],
    ['Swarm Season', 'Arthropod', 'Monopoly', 3, '🕷️', 'Instant', 'Create two Spiderling tokens on empty tiles next to your Structures.', { targets: [], condition: (E, c) => E.structsOf(c.p).length > 0, resolve: (E, c) => { for (let i = 0; i < 2; i++) { const tiles = E.structsOf(c.p).flatMap((st) => E.emptyTilesNearStruct(st, 1)); if (tiles.length) E.createToken(c.p, 'TK-spiderling', tiles[0]); } } }],
    ['Food Chain', 'Scales', 'Predation', 2, '🦈', 'This turn', 'This turn, your Identities gain +1 SP when attacking an enemy with lower current BP.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'eot' }) }, { attackBonus: (E, src, u, t, ctx) => (u.owner === src.owner && !ctx.isStruct && t.bp < u.bp ? 1 : 0) }],
    ['Predator\'s Moon', 'Pelted', 'Predation', 3, '🌕', 'This turn', 'This turn, your Identities gain +2 SP when attacking a damaged enemy.', { targets: [], resolve: (E, c) => E.addMod(c.cardId, c.p, { at: 'eot' }) }, { attackBonus: (E, src, u, t, ctx) => (u.owner === src.owner && !ctx.isStruct && t.bp < E.maxBp(t) ? 2 : 0) }],
  ],
};

// ===========================================================================
// Build the set in canonical order: for each Class slot, all seven Card Types.
// ===========================================================================
function build() {
  for (let c = 0; c < 5; c++) {
    // Identities
    const icls = C.CLASSES.Identity[c];
    IDENTITIES[icls].forEach((row, i) => {
      const [name, faction, archetype, cost, emoji, unique, mods, flavor] = row;
      const rarity = RARITY_PLAN.Identity[i];
      const { stats, isb } = identityStats(icls, cost, rarity, mods || {});
      const sh = SHARED[icls + ':' + archetype];
      register({
        type: 'Identity', name, cls: icls, classIndex: c, faction, archetype, rarity, cost, emoji, flavor,
        stats, isb, unique, shared: sh ? { name: sh.name, text: sh.text } : null,
        text: unique.combo ? unique.text : unique.active ? `${unique.active.name} (${unique.active.cost} MP): ${unique.text}` : `${unique.name}: ${unique.text}`,
      });
    });
    const zcls = C.CLASSES.Zone[c];
    ZONES[zcls].forEach((row, i) => {
      const [name, faction, archetype, cost, emoji, text, hooks] = row;
      register({ type: 'Zone', name, cls: zcls, classIndex: c, faction, archetype, rarity: RARITY_PLAN.Zone[i], cost, emoji, text, hooks });
    });
    const scls = C.CLASSES.Structure[c];
    STRUCTS[scls].forEach((row, i) => {
      const [name, faction, archetype, cost, bp, , emoji, text, hooks] = row;
      const housing = C.HOUSING_BY_CLASS[scls];
      register({ type: 'Structure', name, cls: scls, classIndex: c, faction, archetype, rarity: RARITY_PLAN.Structure[i], cost, bp: Math.round(bp * C.STRUCTURE_BP_SCALE), housing, emoji, text, hooks: hooks || null });
    });
    const ecls = C.CLASSES.Equipment[c];
    EQUIP[ecls].forEach((row, i) => {
      const [name, faction, archetype, cost, emoji, text, hooks, active] = row;
      register({ type: 'Equipment', name, cls: ecls, classIndex: c, faction, archetype, rarity: RARITY_PLAN.Equipment[i], cost, emoji, text, hooks: hooks || null, active: active || null });
    });
    const ccls = C.CLASSES.Consumable[c];
    CONS[ccls].forEach((row, i) => {
      const [name, faction, archetype, cost, emoji, text, use, restores] = row;
      const card = { type: 'Consumable', name, cls: ccls, classIndex: c, faction, archetype, rarity: RARITY_PLAN.Consumable[i], cost, emoji, text, restores: !!restores };
      if (use && use.auto) card.hooks = PHOENIX_HOOKS;
      else card.use = { ...use, timing: RESPONSE_CONS.has(name) ? 'response' : 'main' };
      register(card);
    });
    const acls = C.CLASSES.Action[c];
    ACTIONS[acls].forEach((row, i) => {
      const [name, faction, archetype, cost, emoji, text, play] = row;
      const card = { type: 'Action', name, cls: acls, classIndex: c, faction, archetype, rarity: RARITY_PLAN.Action[i], cost, emoji, text, play: { timing: 'main', ...play } };
      register(card);
    });
    const vcls = C.CLASSES.Event[c];
    EVENTS[vcls].forEach((row, i) => {
      const [name, faction, archetype, cost, emoji, duration, text, play, modHooks] = row;
      const card = { type: 'Event', name, cls: vcls, classIndex: c, faction, archetype, rarity: RARITY_PLAN.Event[i], cost, emoji, duration, text, play: { timing: 'main', ...play }, modHooks: modHooks || null };
      register(card);
      // resolve() needs its own card id for addMod
      const inner = card.play.resolve;
      card.play.resolve = (E, ctx) => inner(E, { ...ctx, cardId: card.id });
    });
  }
}

// Hidden modifier for Muster
REGISTRY.set('KF-MUSTER', { id: 'KF-MUSTER', token: true, type: 'Event', name: 'Muster', modHooks: {
  on(E, src, ev, d) { if (ev === 'summoned' && !d.token) { const u = E.unit(d.unit); if (u && u.owner === src.owner) { E.addApBonus(u, 1, 'Muster'); E.addStatus(u, eot('sp', 1, '+1 SP · Muster')); } } },
} });

build();

export const TOKENS = ['TK-spiderling', 'TK-ant', 'TK-drone', 'TK-wisp', 'TK-minnow', 'TK-hatchling'];
