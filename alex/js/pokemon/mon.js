// A Pokémon: species, level, EXP, IVs, nature, current HP, status and up to four moves
// with PP. Gen-3-style stat and EXP formulas, level-up move learning, and evolution
// checks. Pure functions over plain objects (saved in run.party / run.pc).

import { SPECIES, learnsetOf } from './dex.js';
import { MOVES } from './moves.js';

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_NAMES = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
// 25 natures: +10 % to one stat, −10 % to another (or neutral).
const NAT = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax', 'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash', 'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'];
const NAT_ORDER = ['atk', 'def', 'spe', 'spa', 'spd'];
export function natureMods(nature) {
  const i = NAT.indexOf(nature);
  if (i < 0) return {};
  const up = NAT_ORDER[Math.floor(i / 5)], down = NAT_ORDER[i % 5];
  return up === down ? {} : { [up]: 1.1, [down]: 0.9 };
}
export const NATURES = NAT;

let uidN = 1;
export const MAX_LEVEL = 100;
export const SHINY_ODDS = 1 / 128;

// EXP curves: total EXP to reach level L.
export function expAt(L, curve = 'medium') {
  if (L <= 1) return 0;
  if (curve === 'slow') return Math.floor(1.25 * L ** 3);
  if (curve === 'fast') return Math.floor(0.8 * L ** 3);
  return L ** 3;
}
export const curveOf = (sp) => (sp.legendary ? 'slow' : sp.catchRate >= 190 ? 'fast' : 'medium');

export function calcStats(mon) {
  const sp = SPECIES[mon.species];
  const nm = natureMods(mon.nature);
  const out = {};
  for (let i = 0; i < 6; i++) {
    const k = STATS[i], b = sp.base[i], iv = mon.ivs[k];
    if (k === 'hp') out.hp = mon.species === 'shedinja' ? 1 : Math.floor((2 * b + iv) * mon.level / 100) + mon.level + 10;
    else out[k] = Math.floor((Math.floor((2 * b + iv) * mon.level / 100) + 5) * (nm[k] || 1));
  }
  return out;
}

// Moves learned at exactly level L (for level-up learning).
export function movesAt(speciesId, L) { return learnsetOf(speciesId).filter(([lv]) => lv === L).map(([, m]) => m); }
// The last four moves a wild Pokémon of this level would know.
export function defaultMoves(speciesId, L) {
  const ids = [];
  for (const [lv, m] of learnsetOf(speciesId)) if (lv <= L && !ids.includes(m)) ids.push(m);
  return ids.slice(-4);
}
const moveSlot = (id) => ({ id, pp: MOVES[id].pp, max: MOVES[id].pp });

export function makeMon(speciesId, level, rng = Math.random, o = {}) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error('unknown species ' + speciesId);
  const ivs = {};
  for (const k of STATS) ivs[k] = o.perfect ? 31 : Math.floor(rng() * 32);
  const mon = {
    uid: 'm' + (uidN++) + '_' + Math.floor(rng() * 1e6),
    species: speciesId, nick: null, level, exp: expAt(level, curveOf(sp)),
    ivs, nature: o.nature || NAT[Math.floor(rng() * 25)],
    shiny: o.shiny ?? rng() < SHINY_ODDS,
    moves: (o.moves || defaultMoves(speciesId, level)).map(moveSlot),
    status: null, friendship: 70, ot: o.ot || null,
  };
  mon.hp = calcStats(mon).hp;
  return mon;
}
export const monName = (m) => m.nick || SPECIES[m.species].name;
export const maxHp = (m) => calcStats(m).hp;
export const isFainted = (m) => m.hp <= 0;

// Base EXP yield from defeating `foe` (Gen-ish): trainer battles pay 1.5×.
export function expYield(foe, { trainer = false, share = 1 } = {}) {
  const sp = SPECIES[foe.species];
  return Math.max(1, Math.floor(sp.exp * foe.level / 7 * (trainer ? 1.5 : 1) * share));
}

// Add EXP. Returns the events in order: level-ups (with stat changes), moves to learn
// and whether the mon now wants to evolve (handled after battle).
export function gainExp(mon, amount) {
  const sp = () => SPECIES[mon.species];
  const events = [];
  if (mon.level >= MAX_LEVEL) return events;
  mon.exp += amount;
  while (mon.level < MAX_LEVEL && mon.exp >= expAt(mon.level + 1, curveOf(sp()))) {
    const before = calcStats(mon);
    mon.level++;
    const after = calcStats(mon);
    mon.hp = Math.min(after.hp, mon.hp + (after.hp - before.hp));
    mon.friendship = Math.min(255, mon.friendship + 3);
    const deltas = {};
    for (const k of STATS) deltas[k] = after[k] - before[k];
    events.push({ type: 'level', level: mon.level, deltas, stats: after });
    for (const m of movesAt(mon.species, mon.level)) {
      if (mon.moves.some((x) => x.id === m)) continue;
      events.push(mon.moves.length < 4 ? { type: 'learned', move: m } : { type: 'learnPrompt', move: m });
      if (mon.moves.length < 4) mon.moves.push(moveSlot(m));
    }
  }
  const evo = evolutionFor(mon, {});
  if (evo) events.push({ type: 'canEvolve', to: evo });
  return events;
}
export function learnMove(mon, moveId, replaceIdx = -1) {
  if (mon.moves.some((x) => x.id === moveId)) return false;
  if (mon.moves.length < 4) mon.moves.push(moveSlot(moveId));
  else if (replaceIdx >= 0 && replaceIdx < 4) mon.moves[replaceIdx] = moveSlot(moveId);
  else return false;
  return true;
}

// Evolution: by level, or by stone when an item is used.
export function evolutionFor(mon, { item = null } = {}) {
  const sp = SPECIES[mon.species];
  if (!sp.evo) return null;
  for (const e of Array.isArray(sp.evo) ? sp.evo : [sp.evo]) {
    if (e.lvl && !item && mon.level >= e.lvl) return e.to;
    if (e.item && item === e.item) return e.to;
  }
  return null;
}
export function evolve(mon, to) {
  const before = calcStats(mon);
  const frac = mon.hp / before.hp;
  const from = mon.species;
  mon.species = to;
  const after = calcStats(mon);
  mon.hp = Math.max(mon.hp > 0 ? 1 : 0, Math.round(after.hp * frac));
  // moves the new form learns at its current level
  const learn = movesAt(to, mon.level).filter((m) => !mon.moves.some((x) => x.id === m));
  return { from, to, learn };
}

export function healMon(mon) {
  mon.hp = maxHp(mon);
  mon.status = null;
  for (const m of mon.moves) m.pp = m.max;
}
export function expProgress(mon) {
  const c = curveOf(SPECIES[mon.species]);
  const a = expAt(mon.level, c), b = expAt(mon.level + 1, c);
  return mon.level >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, (mon.exp - a) / (b - a)));
}
export const expToNext = (mon) => (mon.level >= MAX_LEVEL ? 0 : expAt(mon.level + 1, curveOf(SPECIES[mon.species])) - mon.exp);
