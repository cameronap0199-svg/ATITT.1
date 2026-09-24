// Booster generation — implements the Rarity & Booster Distribution System:
// 9 core + 2 flex + 1 wildcard, hidden Affinity Profile (3 Classes, 3 Factions),
// Foundation / Enhanced / Premium rarity slots and duplicate damping.

import { allCards } from './cards.js';
import * as C from './constants.js';

export const FLEX_WEIGHTS = {
  Identity: 21.43, Zone: 16.67, Structure: 16.67, Equipment: 16.67, Consumable: 2.38, Action: 23.81, Event: 2.38,
};
export const FOUNDATION = { Base: 50, Bronze: 35, Silver: 15 };
export const ENHANCED = { Bronze: 25, Silver: 45, Gold: 25, Crystal: 5 };
export const PREMIUM = { Silver: 40, Gold: 35, Crystal: 20, Void: 5 };
export const WILDCARD = { Gold: 50, Crystal: 30, Void: 17, Infinite: 3 };
export const CLASS_MULT = 1.3;
export const FACTION_MULT = 1.35;
export const FOIL_CHANCE = 0.08;
export const VARIANTS = 81; // 3 primary x 3 secondary x 3 accent x 3 pattern

let POOLS = null;
function pools() {
  if (POOLS) return POOLS;
  POOLS = {};
  for (const c of allCards()) {
    const k = c.type + '|' + c.rarity;
    (POOLS[k] = POOLS[k] || []).push(c);
  }
  return POOLS;
}
const pool = (type, rarity) => pools()[type + '|' + rarity] || [];

function weighted(rand, table) {
  const entries = Object.entries(table).filter(([, w]) => w > 0);
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    if ((r -= w) < 0) return k;
  }
  return entries[entries.length - 1][0];
}
function pickN(rand, arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function affinityProfile(rand) {
  return { classes: pickN(rand, [0, 1, 2, 3, 4], 3), factions: pickN(rand, C.FACTIONS, 3) };
}

function selectCard(rand, candidates, profile, counts) {
  const weights = candidates.map((c) => {
    let w = 1;
    if (profile.classes.includes(c.classIndex)) w *= CLASS_MULT;
    if (profile.factions.includes(c.faction)) w *= FACTION_MULT;
    const n = counts[c.id] || 0;
    if (n === 1) w *= 0.5;
    else if (n >= 2) w *= 0.1;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < candidates.length; i++) {
    if ((r -= weights[i]) < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Roll a rarity from a profile table, rerolling rarities that have no card of `type`.
function rollRarity(rand, table, type) {
  const t = { ...table };
  for (const r of Object.keys(t)) if (!pool(type, r).length) t[r] = 0;
  return weighted(rand, t);
}

export function openBooster(rand, opts = {}) {
  const profile = opts.profile || affinityProfile(rand);
  if (opts.focusClass !== undefined && !profile.classes.includes(opts.focusClass)) profile.classes[0] = opts.focusClass;
  const slots = ['Identity', 'Identity', 'Identity', 'Zone', 'Structure', 'Equipment', 'Consumable', 'Action', 'Event'];
  slots.push(weighted(rand, FLEX_WEIGHTS), weighted(rand, FLEX_WEIGHTS));
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const counts = {};
  const out = [];
  slots.forEach((type, i) => {
    const table = i < 6 ? FOUNDATION : i < 9 ? ENHANCED : PREMIUM;
    const rarity = rollRarity(rand, table, type);
    const card = selectCard(rand, pool(type, rarity), profile, counts);
    counts[card.id] = (counts[card.id] || 0) + 1;
    out.push(makePull(rand, card, i < 6 ? 'Foundation' : i < 9 ? 'Enhanced' : 'Premium'));
  });
  // Wildcard
  const wr = weighted(rand, WILDCARD);
  let wtype;
  if (wr === 'Infinite') wtype = 'Identity';
  else {
    const w = { ...FLEX_WEIGHTS };
    for (const t of Object.keys(w)) if (!pool(t, wr).length) w[t] = 0;
    wtype = weighted(rand, w);
  }
  const wc = selectCard(rand, pool(wtype, wr), profile, counts);
  out.push(makePull(rand, wc, 'Wildcard'));
  return { cards: out, profile };
}

function makePull(rand, card, slot) {
  return { id: card.id, rarity: card.rarity, type: card.type, slot, variant: Math.floor(rand() * VARIANTS), foil: rand() < FOIL_CHANCE };
}

export function variantParts(v) {
  return { primary: v % 3, secondary: Math.floor(v / 3) % 3, accent: Math.floor(v / 9) % 3, pattern: Math.floor(v / 27) % 3 };
}
