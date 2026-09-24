// Deck rules, the beginner deck, AI rival decks and deck-builder helpers.

import { allCards, getCard } from './cards.js';
import * as C from './constants.js';

const byName = new Map();
function idOf(name) {
  if (!byName.size) for (const c of allCards()) byName.set(c.name, c.id);
  const id = byName.get(name);
  if (!id) throw new Error('Unknown card: ' + name);
  return id;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export function deckSize(deck) { return Object.values(deck || {}).reduce((a, b) => a + b, 0); }

export function validateDeck(deck, collection = null) {
  const errors = [];
  const size = deckSize(deck);
  if (size < C.DECK_MIN) errors.push(`Deck needs at least ${C.DECK_MIN} cards (has ${size}).`);
  if (size > C.DECK_MAX) errors.push(`Deck can have at most ${C.DECK_MAX} cards (has ${size}).`);
  for (const [id, n] of Object.entries(deck || {})) {
    const c = getCard(id);
    if (!c || c.token) { errors.push(`Unknown card ${id}.`); continue; }
    if (n > C.COPY_LIMIT) errors.push(`${c.name}: at most ${C.COPY_LIMIT} copies.`);
    if (collection) {
      const owned = collection[id] ? collection[id].n : 0;
      if (n > owned) errors.push(`${c.name}: you only own ${owned}.`);
    }
  }
  const types = deckTypeCounts(deck);
  if (!types.Zone) errors.push('Deck needs at least one Zone.');
  if (!types.Structure) errors.push('Deck needs at least one Structure.');
  if (!types.Identity) errors.push('Deck needs at least one Identity.');
  return { ok: errors.length === 0, errors, size };
}

export function deckTypeCounts(deck) {
  const out = {};
  for (const [id, n] of Object.entries(deck || {})) {
    const c = getCard(id);
    if (c) out[c.type] = (out[c.type] || 0) + n;
  }
  return out;
}

export function deckToList(deck) {
  const list = [];
  for (const [id, n] of Object.entries(deck)) for (let i = 0; i < n; i++) list.push(id);
  return list;
}

// ---------------------------------------------------------------------------
// Beginner deck — 60 cards, all Base / Bronze.
// ---------------------------------------------------------------------------
const STARTER = [
  // Zones (9)
  ['Dewfall Glade', 3], ['Contested Border', 3], ['Fertile Loam', 3],
  // Structures (7)
  ['Moss Hut', 3], ['Rabbit Warren', 2], ['Thornwall', 2],
  // Identities (25)
  ['Nesting Heron', 2], ['Mossback Tortoise', 2], ['Barkhide Badger', 2],
  ['Brook Newt', 2], ['Dipper Wren', 2], ['Streamrunner Otter', 2],
  ['Leafcutter Ant', 3], ['Burrow Rabbit', 2],
  ['Stoat Stalker', 3], ['Shrike', 2],
  ['Squirrel Gatherer', 2], ['Mushroom Kin', 1],
  // Equipment (5)
  ['Thorn Spear', 2], ['Bark Plate', 2], ['Feather Charm', 1],
  // Consumables (4)
  ['Healing Salve', 2], ['Trail Rations', 2],
  // Actions (7)
  ['Thorn Dart', 2], ['Rally Cry', 1], ['Dash', 2], ['Brace', 2],
  // Events (3)
  ['Treasure Cache', 1], ['Harvest Festival', 2],
];

export function starterDeck() {
  const deck = {};
  for (const [name, n] of STARTER) deck[idOf(name)] = n;
  return deck;
}

// ---------------------------------------------------------------------------
// Rival deck generator
// ---------------------------------------------------------------------------
export const DECK_SHAPE = { Zone: 9, Structure: 7, Identity: 25, Equipment: 5, Consumable: 4, Action: 7, Event: 3 };
const RARITY_ORDER = C.RARITIES;

export function buildDeck(rand, { rarityCap = 'Infinite', rarityFloor = 'Base', classFocus = null, factionFocus = null, pool = null, quality = 0.5 } = {}) {
  const capI = RARITY_ORDER.indexOf(rarityCap);
  const floorI = RARITY_ORDER.indexOf(rarityFloor);
  const cards = (pool ? pool.map(getCard).filter(Boolean) : allCards()).filter((c) => {
    const r = RARITY_ORDER.indexOf(c.rarity);
    return r <= capI && (r >= floorI || c.type !== 'Identity');
  });
  const deck = {};
  const avail = (c) => (pool ? pool.filter((x) => x === c.id).length || C.COPY_LIMIT : C.COPY_LIMIT);
  for (const [type, want] of Object.entries(DECK_SHAPE)) {
    let opts = cards.filter((c) => c.type === type);
    const weight = (c) => {
      let w = 1;
      if (classFocus !== null && c.classIndex === classFocus) w *= 2.2;
      if (factionFocus && c.faction === factionFocus) w *= 1.8;
      w *= 1 + RARITY_ORDER.indexOf(c.rarity) * quality * 0.35;
      if (type === 'Identity') {
        // a healthy curve: plenty of 1-3 cost bodies
        w *= c.cost <= 2 ? 1.6 : c.cost === 3 ? 1.3 : c.cost === 4 ? 0.9 : 0.55;
      }
      if (type === 'Zone' || type === 'Structure') w *= c.cost <= 2 ? 1.3 : 0.8;
      return w;
    };
    let got = 0;
    let guard = 0;
    while (got < want && opts.length && guard++ < 500) {
      const total = opts.reduce((n, c) => n + weight(c), 0);
      let r = rand() * total;
      let pick = opts[opts.length - 1];
      for (const c of opts) { if ((r -= weight(c)) < 0) { pick = c; break; } }
      const have = deck[pick.id] || 0;
      const lim = Math.min(C.COPY_LIMIT, avail(pick));
      const add = Math.min(lim - have, want - got, 1 + Math.floor(rand() * 3));
      if (add <= 0) { opts = opts.filter((c) => c !== pick); continue; }
      deck[pick.id] = have + add;
      got += add;
      if (deck[pick.id] >= lim) opts = opts.filter((c) => c !== pick);
    }
  }
  // top up with anything legal if a type ran dry (small collections)
  let size = deckSize(deck);
  const rest = cards.filter((c) => (deck[c.id] || 0) < Math.min(C.COPY_LIMIT, avail(c)));
  while (size < C.DECK_MIN && rest.length) {
    const c = rest[Math.floor(rand() * rest.length)];
    deck[c.id] = (deck[c.id] || 0) + 1;
    size++;
    if (deck[c.id] >= Math.min(C.COPY_LIMIT, avail(c))) rest.splice(rest.indexOf(c), 1);
  }
  return deck;
}

// Fill a deck to the minimum size from a collection (deck builder QoL)
export function autoFill(deck, collection, rand = Math.random) {
  const out = { ...deck };
  const shape = { ...DECK_SHAPE };
  const counts = deckTypeCounts(out);
  let size = deckSize(out);
  const owned = Object.entries(collection).map(([id, e]) => ({ c: getCard(id), n: e.n })).filter((o) => o.c && !o.c.token);
  const need = (type) => Math.max(0, (shape[type] || 0) - (counts[type] || 0));
  const score = (o) => (need(o.c.type) > 0 ? 10 : 0) + (o.c.type === 'Identity' ? 4 - Math.abs(o.c.cost - 2.5) : 1) + rand();
  let guard = 0;
  while (size < C.DECK_MIN && guard++ < 400) {
    const opts = owned.filter((o) => (out[o.c.id] || 0) < Math.min(C.COPY_LIMIT, o.n));
    if (!opts.length) break;
    opts.sort((a, b) => score(b) - score(a));
    const o = opts[0];
    out[o.c.id] = (out[o.c.id] || 0) + 1;
    counts[o.c.type] = (counts[o.c.type] || 0) + 1;
    size++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rival ladder — scaling difficulty
// ---------------------------------------------------------------------------
export const RIVALS = [
  { id: 'nib', name: 'Nib the Acorn Kid', title: 'Wide-eyed Beginner', avatar: '🐿️', difficulty: 1, rarityCap: 'Bronze', classFocus: 2, faction: 'Pelted', reward: 60, color: '#8bc34a', quote: 'I-I just started too! Let’s have fun!' },
  { id: 'wren', name: 'Wren Featherby', title: 'Bird-Watcher Scout', avatar: '🐦', difficulty: 2, rarityCap: 'Silver', classFocus: 1, faction: 'Feathered', reward: 80, color: '#4fc3f7', quote: 'Did you know herons can stand still for an hour? I can’t!' },
  { id: 'moss', name: 'Old Man Moss', title: 'Grumpy Groundskeeper', avatar: '🧓', difficulty: 3, rarityCap: 'Silver', classFocus: 0, faction: 'Magically-Mutated', reward: 100, color: '#689f38', quote: 'Get off my lawn — and my Lanes.' },
  { id: 'rook', name: 'Rook Blackquill', title: 'Rival Poacher', avatar: '🥷', difficulty: 4, rarityCap: 'Gold', classFocus: 3, faction: 'Ghoul', reward: 120, color: '#9575cd', quote: 'Hmph. I’ll make this quick.' },
  { id: 'coral', name: 'Coral Tidewater', title: 'River Princess', avatar: '🧜', difficulty: 5, rarityCap: 'Gold', classFocus: 1, faction: 'Scales', reward: 140, color: '#26c6da', quote: 'The current always wins. Always~!' },
  { id: 'bolt', name: 'Unit B-0LT', title: 'Rogue Knot-Bot', avatar: '🤖', difficulty: 6, rarityCap: 'Crystal', classFocus: 4, faction: 'Knot-Bots', reward: 170, color: '#ffb300', quote: 'CALCULATING VICTORY. PROBABILITY: HIGH.' },
  { id: 'hive', name: 'Mistress Vesparia', title: 'Voice of the Hive', avatar: '🐝', difficulty: 7, rarityCap: 'Crystal', classFocus: 2, faction: 'Arthropod', reward: 200, color: '#fdd835', quote: 'We are many. You are one. Bzzz.' },
  { id: 'gnarl', name: 'Mother Gnarl', title: 'The Grove Witch', avatar: '🧙', difficulty: 8, rarityCap: 'Void', classFocus: 0, faction: 'Character', reward: 240, color: '#43a047', quote: 'Such a sweet little deck. Shame about what happens next.' },
  { id: 'vesper', name: 'Vesper', title: 'The Moonlit Huntress', avatar: '🐺', difficulty: 9, rarityCap: 'Infinite', classFocus: 3, faction: 'Pelted', reward: 280, color: '#b39ddb', quote: 'The moon is full. Run.' },
  { id: 'knotwood', name: 'Doctor Knotwood', title: 'The Mad Arborist', avatar: '🧑‍🔬', difficulty: 10, rarityCap: 'Infinite', classFocus: 4, faction: 'Knot-Bots', reward: 350, color: '#ef5350', quote: 'Ahh, a test subject! Let us see what your deck is made of!' },
];

export function rivalDeck(rival, rand) {
  const quality = Math.min(1, rival.difficulty / 9);
  return buildDeck(rand, { rarityCap: rival.rarityCap, classFocus: rival.classFocus, factionFocus: rival.faction, quality });
}
