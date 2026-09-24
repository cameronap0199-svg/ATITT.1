// Player profile: collection, decks, Acorn points, ladder progress and settings.
// Stored in localStorage (with an in-memory fallback), exportable as JSON.
import { starterDeck, validateDeck, deckSize } from '../../shared/decks.js';
import { getCard } from '../../shared/cards.js';
import { COPY_LIMIT } from '../../shared/constants.js';

const KEY = 'knotwood.profile.v1';
const SURPLUS_REFUND = { Base: 5, Bronze: 8, Silver: 12, Gold: 20, Crystal: 35, Void: 60, Infinite: 120 };
export const MAX_KEEP = 3; // copies kept; extra copies are auto-recycled into Acorns

let memory = null;
let profile = null;
const listeners = new Set();

function storageGet() {
  try { return localStorage.getItem(KEY); } catch { return memory; }
}
function storageSet(v) {
  try { localStorage.setItem(KEY, v); } catch { memory = v; }
}

export function defaultProfile() {
  const deck = starterDeck();
  const collection = {};
  for (const [id, n] of Object.entries(deck)) collection[id] = { n, v: Array.from({ length: n }, (_, i) => (i * 29 + id.length * 7) % 81), f: 0 };
  return {
    version: 1,
    created: Date.now(),
    name: '',
    avatar: '🧑‍🌾',
    points: 300,
    packs: 1,
    collection,
    decks: [{ id: 'd1', name: 'Beginner’s Grove', cards: { ...deck } }],
    activeDeck: 'd1',
    stats: { wins: 0, losses: 0, streak: 0, best: 0, packsOpened: 0, online: { wins: 0, losses: 0 } },
    ladder: { beaten: [] },
    daily: { last: null },
    settings: { music: 0.35, sfx: 0.6, muted: false, animSpeed: 1, autoCamera: true, autoRetaliate: true, confirmEndTurn: true, showHints: true, server: '' },
    seenTutorial: false,
    newCards: [],
  };
}

export function loadProfile() {
  const raw = storageGet();
  if (raw) {
    try {
      const p = JSON.parse(raw);
      profile = { ...defaultProfile(), ...p, settings: { ...defaultProfile().settings, ...(p.settings || {}) }, stats: { ...defaultProfile().stats, ...(p.stats || {}) } };
      return profile;
    } catch { /* fall through */ }
  }
  profile = defaultProfile();
  return profile;
}
export function getProfile() { return profile || loadProfile(); }
export function saveProfile() {
  storageSet(JSON.stringify(profile));
  for (const f of listeners) try { f(profile); } catch { /* ignore */ }
}
export function onProfile(f) { listeners.add(f); return () => listeners.delete(f); }
export function resetProfile() { profile = defaultProfile(); saveProfile(); return profile; }
export function exportProfile() { return JSON.stringify(profile); }
export function importProfile(json) {
  const p = JSON.parse(json);
  if (!p || !p.collection || !p.decks) throw new Error('That does not look like a Knotwood save.');
  profile = { ...defaultProfile(), ...p };
  saveProfile();
  return profile;
}

// ---- points ------------------------------------------------------------------
export function addPoints(n) { profile.points = Math.max(0, profile.points + n); saveProfile(); }
export function spendPoints(n) {
  if (profile.points < n) return false;
  profile.points -= n;
  saveProfile();
  return true;
}

// ---- collection ----------------------------------------------------------------
export function owned(id) { return profile.collection[id] ? profile.collection[id].n : 0; }
export function ownedVariant(id) {
  const e = profile.collection[id];
  return e && e.v && e.v.length ? e.v[e.fav || 0] ?? e.v[0] : 0;
}
export function ownedFoil(id) { const e = profile.collection[id]; return !!(e && e.f > 0); }
// Adds pulled cards; returns {newIds, refunded}
export function addCards(pulls) {
  const newIds = [];
  let refunded = 0;
  for (const pull of pulls) {
    const e = profile.collection[pull.id] || (profile.collection[pull.id] = { n: 0, v: [], f: 0 });
    if (e.n === 0) newIds.push(pull.id);
    if (e.n >= MAX_KEEP) {
      const c = getCard(pull.id);
      const r = SURPLUS_REFUND[c.rarity] || 5;
      refunded += r;
      pull.refund = r;
      continue;
    }
    e.n++;
    e.v.push(pull.variant);
    if (pull.foil) e.f++;
  }
  profile.points += refunded;
  profile.newCards = [...new Set([...(profile.newCards || []), ...newIds])].slice(-200);
  saveProfile();
  return { newIds, refunded };
}
export function collectionCount() { return Object.values(profile.collection).filter((e) => e.n > 0).length; }

// ---- decks ---------------------------------------------------------------------
export function getDeck(id = profile.activeDeck) { return profile.decks.find((d) => d.id === id) || profile.decks[0]; }
export function activeDeckCards() { return getDeck().cards; }
export function deckValid(deck) { return validateDeck(deck.cards, profile.collection); }
export function newDeck(name = 'New Deck', cards = {}) {
  const id = 'd' + Date.now().toString(36);
  const d = { id, name, cards: { ...cards } };
  profile.decks.push(d);
  saveProfile();
  return d;
}
export function deleteDeck(id) {
  if (profile.decks.length <= 1) return false;
  profile.decks = profile.decks.filter((d) => d.id !== id);
  if (profile.activeDeck === id) profile.activeDeck = profile.decks[0].id;
  saveProfile();
  return true;
}
export function setActiveDeck(id) { profile.activeDeck = id; saveProfile(); }
export function addToDeck(deck, id) {
  const have = deck.cards[id] || 0;
  if (have >= Math.min(COPY_LIMIT, owned(id))) return false;
  deck.cards[id] = have + 1;
  saveProfile();
  return true;
}
export function removeFromDeck(deck, id) {
  if (!deck.cards[id]) return false;
  deck.cards[id]--;
  if (!deck.cards[id]) delete deck.cards[id];
  saveProfile();
  return true;
}
export { deckSize };

// ---- rewards ---------------------------------------------------------------------
export function recordResult({ win, online = false }) {
  const s = profile.stats;
  if (win) { s.wins++; s.streak = Math.max(1, s.streak + 1); s.best = Math.max(s.best, s.streak); }
  else { s.losses++; s.streak = 0; }
  if (online) { if (win) s.online.wins++; else s.online.losses++; }
  saveProfile();
}
export function claimDaily() {
  const today = new Date().toDateString();
  if (profile.daily.last === today) return 0;
  profile.daily.last = today;
  profile.points += 100;
  saveProfile();
  return 100;
}
export function firstWinToday() {
  const today = new Date().toDateString();
  if (profile.daily.firstWin === today) return false;
  profile.daily.firstWin = today;
  saveProfile();
  return true;
}
