// Adventure ladder (10 rivals of rising difficulty) and Free Battle setup.
import { el, setScreen, modal, toast } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { getProfile, getDeck, deckValid, setActiveDeck } from '../profile.js';
import { RIVALS, rivalDeck, buildDeck, deckToList } from '../../../shared/decks.js';
import { makeRng, randomSeed } from '../../../shared/rng.js';
import { startLocalBattle } from '../battle/battle.js';
import { showHub } from './hub.js';
import { showDeckBuilder } from './deckBuilder.js';
import { topButtons } from './settings.js';

export const DIFF_NAMES = ['', 'Sprout', 'Seedling', 'Sapling', 'Young Oak', 'Grove Guard', 'Elder Pine', 'Ancient Oak', 'Heartwood', 'World Tree', 'Knotwood Legend'];

function ensureDeck() {
  const deck = getDeck();
  const v = deckValid(deck);
  if (!v.ok) {
    modal({ title: 'Deck Not Ready', body: el('p', `Your active deck “${deck.name}” isn’t legal: ${v.errors[0]}`), actions: [{ label: 'Close', value: false, cls: 'ghost' }, { label: 'Open Deck Workshop', value: true, cls: 'gold', onClick: () => { showDeckBuilder(); } }] });
    return null;
  }
  return deck;
}

function deckPicker() {
  const p = getProfile();
  const sel = el('select.field', { onchange: () => setActiveDeck(sel.value) });
  for (const d of p.decks) {
    const o = el('option', { value: d.id }, `${d.name} ${deckValid(d).ok ? '' : '(invalid)'}`);
    if (d.id === p.activeDeck) o.selected = true;
    sel.appendChild(o);
  }
  return el('label.row', el('b', 'Deck:'), sel);
}

export function showLadder() {
  playMusic('menu');
  const p = getProfile();
  const grid = el('div.ladder');
  RIVALS.forEach((r, i) => {
    const unlocked = i === 0 || p.ladder.beaten.includes(RIVALS[i - 1].id) || p.ladder.beaten.includes(r.id);
    const beaten = p.ladder.beaten.includes(r.id);
    const card = el('div.win.rival' + (unlocked ? '' : '.locked'), { style: { '--rc': r.color } },
      el('div.win-title', `STAGE ${i + 1}`),
      el('div.portrait', r.avatar),
      el('div.r-name', unlocked ? r.name : '???'),
      el('div.r-title', unlocked ? r.title : 'Defeat the previous rival'),
      el('div.stars', '★'.repeat(Math.ceil(r.difficulty / 2)) + '☆'.repeat(5 - Math.ceil(r.difficulty / 2))),
      el('div.tiny.muted', `Difficulty ${r.difficulty} · ${DIFF_NAMES[r.difficulty]}`),
      el('div.acorns', '+' + r.reward + (beaten ? '' : ' (+100 first win, +1 pack)')),
      beaten ? el('div.beaten', 'CLEARED') : null);
    card.addEventListener('click', () => {
      if (!unlocked) { sfx('error'); toast('Beat the previous rival first!', 'bad'); return; }
      sfx('confirm');
      startRival(r);
    });
    grid.appendChild(card);
  });
  const node = el('div.page',
    el('div.page-head', el('button.btn.ghost', { onclick: showHub }, '← Back'), el('h1', 'Adventure'), el('span.muted', `${p.ladder.beaten.length} / ${RIVALS.length} rivals defeated`), el('div.grow'), deckPicker()),
    el('div.page-body.scroll', grid));
  setScreen(el('div', node, topButtons()));
}

function startRival(r) {
  const deck = ensureDeck();
  if (!deck) return;
  const p = getProfile();
  const rng = makeRng(randomSeed());
  startLocalBattle({
    me: { name: p.name, avatar: p.avatar, deck: deckToList(deck.cards) },
    foe: { name: r.name, avatar: r.avatar, deck: deckToList(rivalDeck(r, rng)) },
    difficulty: r.difficulty,
    rival: r,
    onFinish: () => showLadder(),
  });
}

export function showFreeBattle() {
  const p = getProfile();
  let diff = Math.min(10, Math.max(1, p.lastDifficulty || 3));
  const label = el('b');
  const reward = el('span.acorns');
  const slider = el('input', { type: 'range', min: 1, max: 10, step: 1, value: diff, style: { width: '100%' } });
  const upd = () => { diff = +slider.value; label.textContent = `${diff} — ${DIFF_NAMES[diff]}`; reward.textContent = `Win: +${40 + diff * 15} · Lose: +${15 + diff * 3}`; };
  slider.addEventListener('input', () => { upd(); sfx('cursor'); });
  upd();
  const themes = ['Random', 'Silviculturist', 'Hydrologist', 'Understory', 'Poacher', 'Forager'];
  const theme = el('select.field', ...themes.map((t, i) => el('option', { value: i - 1 }, t)));
  const body = el('div.col', { style: { width: 'min(460px, 86vw)', gap: '14px' } },
    el('p.muted', { style: { margin: 0 } }, 'Practice against an AI opponent. Higher difficulties think deeper, avoid danger, chain combos — and bring stronger decks.'),
    el('div.row', { style: { justifyContent: 'space-between' } }, el('span', 'Difficulty'), label), slider, reward,
    el('label.row', el('span', 'Opponent style'), theme),
    deckPicker());
  modal({
    title: 'Free Battle', body,
    actions: [{ label: 'Cancel', value: null, cls: 'ghost' }, { label: '⚔ Battle!', cls: 'gold', onClick: (close) => {
      const deck = ensureDeck();
      if (!deck) return false;
      close(true);
      p.lastDifficulty = diff;
      const rng = makeRng(randomSeed());
      const focus = +theme.value;
      const caps = ['', 'Bronze', 'Bronze', 'Silver', 'Silver', 'Gold', 'Gold', 'Crystal', 'Void', 'Infinite', 'Infinite'];
      const names = ['Sprout Bot', 'Seedling Bot', 'Sapling Bot', 'Oak Bot', 'Grove Bot', 'Pine Bot', 'Ancient Bot', 'Heartwood Bot', 'World-Tree Bot', 'Legend Bot'];
      const avatars = ['🌱', '🌿', '🍀', '🌳', '🌲', '🎋', '🌴', '🍁', '🌍', '👑'];
      startLocalBattle({
        me: { name: p.name, avatar: p.avatar, deck: deckToList(deck.cards) },
        foe: { name: names[diff - 1], avatar: avatars[diff - 1], deck: deckToList(buildDeck(rng, { rarityCap: caps[diff], classFocus: focus >= 0 ? focus : Math.floor(rng() * 5), quality: diff / 10 })) },
        difficulty: diff,
        onFinish: () => showHub(),
      });
      return false;
    } }],
  });
}
