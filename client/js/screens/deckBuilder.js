// Deck Workshop: build and manage decks from your collection.
import { el, setScreen, clear, toast, confirmBox, promptBox, modal } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { getCard } from '../../../shared/cards.js';
import { CARD_TYPES, TYPE_ICONS, DECK_MIN, DECK_MAX, COPY_LIMIT } from '../../../shared/constants.js';
import { autoFill, deckTypeCounts } from '../../../shared/decks.js';
import { getProfile, saveProfile, owned, ownedVariant, ownedFoil, getDeck, newDeck, deleteDeck, setActiveDeck, addToDeck, removeFromDeck, deckValid, deckSize } from '../profile.js';
import { cardEl, showCardModal, RARITY_COLORS } from '../cardView.js';
import { filterBar, filterCards } from './collection.js';
import { showHub } from './hub.js';
import { topButtons } from './settings.js';

export function showDeckBuilder() {
  playMusic('menu');
  const p = getProfile();
  let deck = getDeck();
  const state = { type: 'All', ownedOnly: true, sort: 'cost' };
  const grid = el('div.card-grid', { style: { '--cw': '140px' } });
  const list = el('div.deck-list.scroll');
  const status = el('div.deck-status');
  const curve = el('div.curve');
  const typesRow = el('div.row.tiny', { style: { flexWrap: 'wrap', gap: '4px' } });
  const deckSel = el('select.field', { style: { flex: 1 } });
  const nameEl = el('b', { style: { fontSize: '18px', cursor: 'pointer' }, 'data-tip': 'Click to rename' });

  const refreshDeckSel = () => {
    clear(deckSel);
    for (const d of p.decks) {
      const o = el('option', { value: d.id }, (d.id === p.activeDeck ? '★ ' : '') + d.name);
      if (d.id === deck.id) o.selected = true;
      deckSel.appendChild(o);
    }
  };
  deckSel.addEventListener('change', () => { deck = p.decks.find((d) => d.id === deckSel.value); renderAll(); sfx('cursor'); });
  nameEl.addEventListener('click', async () => {
    const n = await promptBox('Deck name:', { value: deck.name, title: 'Rename Deck' });
    if (n) { deck.name = n.slice(0, 30); saveProfile(); renderAll(); }
  });

  const renderGrid = () => {
    clear(grid);
    const frag = document.createDocumentFragment();
    for (const c of filterCards(state)) {
      const n = owned(c.id);
      const inDeck = deck.cards[c.id] || 0;
      const node = cardEl(c, { width: 140, variant: ownedVariant(c.id), foil: ownedFoil(c.id), unowned: !n, count: n || null });
      if (inDeck) node.appendChild(el('div.in-deck', `${inDeck} in deck`));
      node.addEventListener('click', () => {
        if (!n) { sfx('error'); toast('You don’t own this card yet — find it in booster packs!', 'bad', 1.6); return; }
        if (deckSize(deck.cards) >= DECK_MAX) { sfx('error'); toast(`Decks can hold at most ${DECK_MAX} cards.`, 'bad'); return; }
        if (addToDeck(deck, c.id)) { sfx('card'); renderAll(); }
        else { sfx('error'); toast(inDeck >= COPY_LIMIT ? `Max ${COPY_LIMIT} copies per deck.` : `You only own ${n}.`, 'bad', 1.5); }
      });
      node.addEventListener('contextmenu', (e) => { e.preventDefault(); showCardModal(c.id, { variant: ownedVariant(c.id), owned: n }); });
      frag.appendChild(node);
    }
    grid.appendChild(frag);
  };
  const renderDeck = () => {
    clear(list);
    const entries = Object.entries(deck.cards).map(([id, n]) => ({ c: getCard(id), n })).filter((e) => e.c);
    for (const type of CARD_TYPES) {
      const rows = entries.filter((e) => e.c.type === type).sort((a, b) => a.c.cost - b.c.cost || a.c.name.localeCompare(b.c.name));
      if (!rows.length) continue;
      list.appendChild(el('div.deck-group', el('span', TYPE_ICONS[type] + ' ' + (type === 'Identity' ? 'Identities' : type + 's')), el('span', String(rows.reduce((a, r) => a + r.n, 0)))));
      for (const r of rows) {
        const row = el('div.deck-row', { style: { '--rc': RARITY_COLORS[r.c.rarity] }, 'data-tip': `<b>${r.c.name}</b><br>${r.c.text}<br><i>Click to remove one · right-click to inspect</i>` },
          el('span.dr-cost', String(r.c.cost)), el('span', r.c.emoji + ' ' + r.c.name), el('span.muted.tiny', r.c.rarity), el('span.dr-n', '×' + r.n));
        row.addEventListener('click', () => { removeFromDeck(deck, r.c.id); sfx('cancel'); renderAll(); });
        row.addEventListener('contextmenu', (e) => { e.preventDefault(); showCardModal(r.c.id); });
        list.appendChild(row);
      }
    }
    if (!entries.length) list.appendChild(el('p.muted', 'Empty deck. Click cards on the left to add them, or use Auto-Fill.'));
    // curve
    clear(curve);
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    for (const e of entries) buckets[Math.min(6, e.c.cost)] += e.n;
    const max = Math.max(1, ...buckets);
    buckets.forEach((n, i) => curve.appendChild(el('div', { style: { height: (n / max) * 100 + '%' } }, el('b', n ? String(n) : ''), el('span', i === 6 ? '6+' : String(i)))));
    clear(typesRow);
    const tc = deckTypeCounts(deck.cards);
    for (const t of CARD_TYPES) typesRow.appendChild(el('span.pill', { 'data-tip': t }, `${TYPE_ICONS[t]} ${tc[t] || 0}`));
    const v = deckValid(deck);
    status.className = 'deck-status ' + (v.ok ? 'ok' : 'bad');
    status.textContent = v.ok ? `✔ Legal deck · ${v.size} cards` : `✖ ${v.size}/${DECK_MIN}+ — ${v.errors[0]}`;
    nameEl.textContent = deck.name + (deck.id === p.activeDeck ? ' ★' : '');
  };
  const renderAll = () => { refreshDeckSel(); renderDeck(); renderGrid(); };

  const tools = el('div.row', { style: { flexWrap: 'wrap', gap: '6px' } },
    el('button.btn.small.gold', { onclick: () => { setActiveDeck(deck.id); sfx('confirm'); toast(`“${deck.name}” is now your active deck.`, 'good'); renderAll(); } }, '★ Use This Deck'),
    el('button.btn.small', { onclick: async () => { const n = await promptBox('Name your new deck:', { value: 'New Deck', title: 'New Deck' }); if (n) { deck = newDeck(n); renderAll(); } } }, '＋ New'),
    el('button.btn.small', { onclick: () => { deck = newDeck(deck.name + ' (copy)', deck.cards); renderAll(); toast('Deck duplicated.', 'good'); } }, '⧉ Copy'),
    el('button.btn.small.green', { onclick: () => { deck.cards = autoFill(deck.cards, p.collection); saveProfile(); sfx('buff'); renderAll(); toast('Filled with your best available cards!', 'good'); } }, '🪄 Auto-Fill'),
    el('button.btn.small.ghost', { onclick: async () => { if (await confirmBox('Remove all cards from this deck?', { yes: 'Clear', danger: true })) { deck.cards = {}; saveProfile(); renderAll(); } } }, '🧹 Clear'),
    el('button.btn.small.red', { onclick: async () => {
      if (p.decks.length <= 1) { toast('You need at least one deck.', 'bad'); return; }
      if (await confirmBox(`Delete “${deck.name}”?`, { yes: 'Delete', danger: true })) { deleteDeck(deck.id); deck = getDeck(); renderAll(); }
    } }, '🗑'));

  const node = el('div.page',
    el('div.page-head', el('button.btn.ghost', { onclick: showHub }, '← Back'), el('h1', 'Deck Workshop'), el('div.grow'),
      el('button.btn.small.ghost', { onclick: () => modal({ title: 'Deck Building Rules', body: el('div', { style: { maxWidth: '460px', lineHeight: 1.6 }, html: `<p>• Decks hold <b>${DECK_MIN}–${DECK_MAX}</b> cards, up to <b>${COPY_LIMIT} copies</b> of any card (any rarity).</p><p>• Include Zones (to claim Lanes) and Structures (to house Identities and earn Renown). About 9 Zones and 7 Structures in 60 cards works well.</p><p>• A good curve has plenty of 1–3 Sap Identities.</p><p>• Factions and Archetypes create synergies — but you can mix freely.</p>` }) }) }, '❔ Rules')),
    el('div.page-body.builder',
      el('div.builder-left', filterBar(state, renderGrid), el('div.scroll', { style: { flex: 1, minHeight: 0 } }, grid)),
      el('div.builder-right.win',
        el('div.row', deckSel),
        el('div.row', { style: { justifyContent: 'space-between' } }, nameEl),
        status, typesRow, curve, el('div', { style: { height: '12px' } }),
        list,
        tools)));
  setScreen(el('div', node, topButtons()));
  renderAll();
}
