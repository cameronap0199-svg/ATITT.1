// Collection browser with filters, plus the reusable filter bar used by the deck builder.
import { el, setScreen, clear } from '../ui.js';
import { playMusic } from '../audio.js';
import { allCards, cardCount } from '../../../shared/cards.js';
import { CARD_TYPES, RARITIES, FACTIONS, ARCHETYPES, CLASSES, TYPE_ICONS } from '../../../shared/constants.js';
import { getProfile, owned, ownedVariant, ownedFoil, collectionCount, saveProfile } from '../profile.js';
import { cardEl, showCardModal } from '../cardView.js';
import { showHub } from './hub.js';
import { topButtons } from './settings.js';

export function filterBar(state, onChange, { showOwned = true } = {}) {
  const bar = el('div.filters');
  const search = el('input.field', { placeholder: '🔍 Search name or text…', value: state.q || '', style: { width: '200px' } });
  search.addEventListener('input', () => { state.q = search.value.toLowerCase(); onChange(); });
  bar.appendChild(search);
  const typeChips = el('div.row', { style: { gap: '4px', flexWrap: 'wrap' } });
  for (const t of ['All', ...CARD_TYPES]) {
    const chip = el('span.chip' + ((state.type || 'All') === t ? '.on' : ''), { 'data-tip': t }, t === 'All' ? 'All' : TYPE_ICONS[t] + ' ' + t);
    chip.addEventListener('click', () => { state.type = t; [...typeChips.children].forEach((c) => c.classList.remove('on')); chip.classList.add('on'); onChange(); });
    typeChips.appendChild(chip);
  }
  bar.appendChild(typeChips);
  const sel = (key, label, options) => {
    const s = el('select.field', el('option', { value: '' }, label), ...options.map((o) => el('option', { value: o[0] }, o[1])));
    s.value = state[key] || '';
    s.addEventListener('change', () => { state[key] = s.value; onChange(); });
    return s;
  };
  bar.appendChild(sel('rarity', 'Any Rarity', RARITIES.map((r) => [r, r])));
  bar.appendChild(sel('cls', 'Any Class', [0, 1, 2, 3, 4].map((i) => [String(i), `${CLASSES.Identity[i]} / ${CLASSES.Zone[i]} / …`])));
  bar.appendChild(sel('faction', 'Any Faction', FACTIONS.map((f) => [f, f])));
  bar.appendChild(sel('arch', 'Any Archetype', ARCHETYPES.map((a) => [a, a])));
  bar.appendChild(sel('cost', 'Any Tier', [0, 1, 2, 3, 4, 5, 6].map((c) => [String(c), 'Tier ' + c + (c === 6 ? '+' : '')])));
  bar.appendChild(sel('sort', 'Sort: Set #', [['cost', 'Sort: Cost'], ['name', 'Sort: Name'], ['rarity', 'Sort: Rarity'], ['type', 'Sort: Type']]));
  if (showOwned) {
    const o = el('label.row.tiny', { style: { gap: '4px' } });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = !!state.ownedOnly;
    cb.addEventListener('change', () => { state.ownedOnly = cb.checked; onChange(); });
    o.append(cb, 'Owned only');
    bar.appendChild(o);
  }
  return bar;
}

export function filterCards(state) {
  let list = allCards().filter((c) => {
    if (state.type && state.type !== 'All' && c.type !== state.type) return false;
    if (state.rarity && c.rarity !== state.rarity) return false;
    if (state.cls !== undefined && state.cls !== '' && c.classIndex !== +state.cls) return false;
    if (state.faction && c.faction !== state.faction) return false;
    if (state.arch && c.archetype !== state.arch) return false;
    if (state.cost !== undefined && state.cost !== '') { const n = +state.cost; if (n === 6 ? c.cost < 6 : c.cost !== n) return false; }
    if (state.ownedOnly && !owned(c.id)) return false;
    if (state.q) {
      const hay = (c.name + ' ' + c.text + ' ' + (c.shared ? c.shared.name + ' ' + c.shared.text : '') + ' ' + c.cls + ' ' + c.faction + ' ' + c.archetype).toLowerCase();
      if (!hay.includes(state.q)) return false;
    }
    return true;
  });
  const s = state.sort;
  if (s === 'cost') list = list.sort((a, b) => a.cost - b.cost || a.num - b.num);
  else if (s === 'name') list = list.sort((a, b) => a.name.localeCompare(b.name));
  else if (s === 'rarity') list = list.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.num - b.num);
  else if (s === 'type') list = list.sort((a, b) => CARD_TYPES.indexOf(a.type) - CARD_TYPES.indexOf(b.type) || a.cost - b.cost);
  return list;
}

export function showCollection() {
  playMusic('menu');
  const p = getProfile();
  const state = p.collectionFilter || (p.collectionFilter = { type: 'All' });
  const grid = el('div.card-grid', { style: { '--cw': '170px' } });
  const countEl = el('span.muted');
  const newSet = new Set(p.newCards || []);
  const render = () => {
    clear(grid);
    const list = filterCards(state);
    countEl.textContent = `${list.length} shown`;
    const frag = document.createDocumentFragment();
    for (const c of list) {
      const n = owned(c.id);
      const node = cardEl(c, { width: 170, variant: ownedVariant(c.id), foil: ownedFoil(c.id), unowned: !n, count: n || null, isNew: newSet.has(c.id), tilt: !!n });
      node.addEventListener('click', () => {
        const e = p.collection[c.id];
        showCardModal(c.id, { variant: ownedVariant(c.id), foil: ownedFoil(c.id), owned: n, variants: e ? e.v : [] });
        if (newSet.has(c.id)) { newSet.delete(c.id); p.newCards = [...newSet]; saveProfile(); node.querySelector('.new-badge')?.remove(); }
      });
      frag.appendChild(node);
    }
    grid.appendChild(frag);
  };
  const have = collectionCount();
  const node = el('div.page',
    el('div.page-head',
      el('button.btn.ghost', { onclick: showHub }, '← Back'), el('h1', 'Collection'),
      el('div.col', { style: { gap: '4px' } }, el('b', `${have} / ${cardCount()} discovered`), el('div.progress', el('div', { style: { width: (have / cardCount()) * 100 + '%' } }))),
      el('div.grow'), countEl),
    filterBar(state, render),
    el('div.page-body.scroll', grid));
  setScreen(el('div', node, topButtons()));
  render();
}
