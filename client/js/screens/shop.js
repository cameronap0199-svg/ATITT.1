// Booster shop + the pack-opening ceremony.
import { el, setScreen, toast, sleep, confirmBox, fmt } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import * as FX from '../fx.js';
import { getProfile, saveProfile, spendPoints, addCards } from '../profile.js';
import { openBooster } from '../../../shared/packs.js';
import { makeRng, randomSeed } from '../../../shared/rng.js';
import { getCard } from '../../../shared/cards.js';
import { CLASSES, RARITIES } from '../../../shared/constants.js';
import { cardEl, showCardModal, RARITY_COLORS } from '../cardView.js';
import { showHub } from './hub.js';
import { topButtons } from './settings.js';

const LINES = [
  'Welcome, welcome! Fresh boosters, straight from the forest floor!',
  'Every pack has a Gold-or-better Wildcard. That’s a Rummage guarantee!',
  'Psst… about one pack in thirty holds an Infinite card. Feeling lucky?',
  'Twelve cards a pack! Three Identities, every card type, two flex slots!',
  'Duplicates beyond three copies get recycled into Acorns. Nothing wasted!',
];

const PRODUCTS = [
  { id: 'pack', name: 'Booster Pack', desc: '12 cards · 1 guaranteed Gold+ Wildcard', price: 100, count: 1, cls: '' },
  { id: 'bundle', name: 'Booster Bundle', desc: '5 packs — save 50 Acorns', price: 450, count: 5, cls: '.bundle' },
  { id: 'box', name: 'Booster Box', desc: '10 packs — save 150 Acorns', price: 850, count: 10, cls: '.bundle' },
  { id: 'focus', name: 'Class Focus Pack', desc: 'Guarantees your chosen Class slot is featured in the pack’s hidden affinity', price: 140, count: 1, cls: '.focus', focus: true },
];

export function showShop() {
  playMusic('shop');
  const p = getProfile();
  const speech = el('div.speech', LINES[Math.floor(Math.random() * LINES.length)]);
  const pts = el('span.pill.acorns', fmt(p.points));
  const packsPill = el('span.pill', '🎁 ' + p.packs + ' unopened');
  const refresh = () => { pts.textContent = fmt(p.points); packsPill.textContent = '🎁 ' + p.packs + ' unopened'; openBtn.disabled = !p.packs; openBtn.textContent = p.packs ? `Open ${p.packs > 1 ? 'a Pack' : 'Pack'} (${p.packs})` : 'No packs'; };
  const openBtn = el('button.btn.gold.big', { onclick: () => { if (p.packs) runOpening(1, refresh); } });
  const openAll = el('button.btn.ghost', { onclick: () => { if (p.packs) runOpening(p.packs, refresh); } }, 'Open All');
  const focusSel = el('select.field', { style: { width: '100%', fontSize: '12px' } }, ...CLASSES.Identity.map((c, i) => el('option', { value: i }, `${c} · ${CLASSES.Zone[i]} · ${CLASSES.Structure[i]}…`)));
  const items = el('div.shop-items');
  for (const prod of PRODUCTS) {
    const art = el('div.pack-art' + prod.cls, el('div.pk-name', 'KNOTWOOD'), el('div.pk-tree', prod.focus ? '🔮' : '🌳'), el('div.pk-sub', 'BOOSTER · SET 1'), prod.count > 1 ? el('div.pk-count', '×' + prod.count) : null);
    const buy = el('button.btn.gold', { onclick: async () => {
      if (p.points < prod.price) { sfx('error'); speech.textContent = 'Ah… you’re a few Acorns short, friend. Win some battles and come back!'; return; }
      if (prod.price >= 450 && !(await confirmBox(`Buy ${prod.name} for ${prod.price} Acorns?`, { yes: 'Buy!' }))) return;
      spendPoints(prod.price);
      sfx('coin');
      FX.burst(innerWidth / 2, innerHeight / 2, { colors: ['#ffd76a', '#fff3b0'], count: 30, shape: 'circle', speed: 6 });
      if (prod.focus) {
        p.focusPacks = p.focusPacks || [];
        p.focusPacks.push(+focusSel.value);
      }
      p.packs += prod.count;
      saveProfile();
      speech.textContent = prod.count > 1 ? 'A fine haul! Go on, rip ’em open!' : 'Thank you kindly! Open it right here if you like~';
      refresh();
    } }, el('span.acorns', String(prod.price)));
    items.appendChild(el('div.win.shop-item', el('h3', prod.name), art, el('p.muted.tiny', { style: { margin: 0 } }, prod.desc), prod.focus ? focusSel : null, buy));
    art.addEventListener('click', () => buy.click());
  }
  items.appendChild(el('div.win.shop-item',
    el('h3', 'Booster Odds'),
    el('div.tiny', { style: { lineHeight: 1.5, textAlign: 'left' } },
      el('div', '• 6 Foundation slots: Base 50% · Bronze 35% · Silver 15%'),
      el('div', '• 3 Enhanced: Bronze 25% · Silver 45% · Gold 25% · Crystal 5%'),
      el('div', '• 2 Premium: Silver 40% · Gold 35% · Crystal 20% · Void 5%'),
      el('div', '• Wildcard: Gold 50% · Crystal 30% · Void 17% · Infinite 3%'),
      el('div.muted', 'Each pack secretly favours 3 Classes and 3 Factions. 8% of cards are Foil.'))));
  refresh();
  const node = el('div.page',
    el('div.page-head', el('button.btn.ghost', { onclick: showHub }, '← Back'), el('h1', 'Rummage’s Booster Shop'), el('div.grow'), pts, packsPill),
    el('div.page-body.shop',
      el('div.win.shopkeeper', el('div.keeper', '🦝'), speech, el('div', el('b', 'Rummage'), el('div.tiny.muted', 'Travelling Merchant')), openBtn, openAll),
      items));
  setScreen(el('div', node, topButtons()));
}

// ---------------------------------------------------------------------------
// Pack opening
// ---------------------------------------------------------------------------
async function runOpening(n, onDone) {
  const p = getProfile();
  const stage = el('div.pack-stage');
  document.body.appendChild(stage);
  let remaining = n;
  const rng = makeRng(randomSeed());
  const close = () => { stage.remove(); onDone && onDone(); };
  while (remaining > 0 && p.packs > 0) {
    const focus = p.focusPacks && p.focusPacks.length ? p.focusPacks.shift() : undefined;
    p.packs--;
    p.stats.packsOpened++;
    const pack = openBooster(rng, { focusClass: focus });
    const { newIds } = addCards(pack.cards);
    saveProfile();
    remaining--;
    const cont = await revealPack(stage, pack, newIds, remaining);
    if (cont === 'stop') break;
  }
  close();
}

function revealPack(stage, pack, newIds, remaining) {
  return new Promise((resolve) => {
    stage.innerHTML = '';
    const big = el('div.pack-art.big-pack', el('div.pk-name', 'KNOTWOOD'), el('div.pk-tree', '🌳'), el('div.pk-sub', 'BOOSTER · 12 CARDS'));
    const hint = el('div.pack-hint', 'CLICK TO OPEN');
    stage.append(big, hint);
    sfx('open');
    let opened = false;
    const open = async () => {
      if (opened) return;
      opened = true;
      hint.remove();
      big.classList.add('shake');
      sfx('card');
      await sleep(500);
      big.classList.remove('shake');
      big.classList.add('tear');
      sfx('tear');
      const r = big.getBoundingClientRect();
      FX.burst(r.left + r.width / 2, r.top + 20, { colors: ['#ffe9a8', '#fff', '#2e8b57'], count: 40, speed: 9, shape: 'rect', size: 5, gravity: 0.25 });
      FX.lightRays(r.left + r.width / 2, r.top + r.height / 2, { colors: ['#fff6c0', '#ffe28a'], life: 1.2 });
      await sleep(520);
      big.remove();
      showCards();
    };
    big.addEventListener('click', open);
    const keyOpen = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!opened) open(); } };
    addEventListener('keydown', keyOpen);

    const showCards = () => {
      const grid = el('div.reveal-grid');
      const cw = Math.max(96, Math.min(170, (innerWidth - 120) / 6.6, (innerHeight - 230) / 2 / 1.4));
      const flips = [];
      pack.cards.forEach((pull, i) => {
        const card = getCard(pull.id);
        const rIdx = RARITIES.indexOf(card.rarity);
        const f = el('div.flip', { style: { width: cw + 'px', height: cw * 1.397 + 'px', animationDelay: i * 0.06 + 's' } });
        if (rIdx >= 3) f.appendChild(el('div.aura.r-' + card.rarity.toLowerCase()));
        f.appendChild(cardEl(null, { width: cw, back: true }));
        const front = cardEl(card, { width: cw, variant: pull.variant, foil: pull.foil, isNew: newIds.includes(pull.id), tilt: false });
        front.classList.add('front');
        f.appendChild(front);
        const wrap = el('div.flip-wrap', f);
        if (pull.slot === 'Wildcard') wrap.appendChild(el('div.slot-tag', '★ WILDCARD'));
        if (pull.refund) wrap.appendChild(el('div.refund-tag', `♻ +${pull.refund} Acorns`));
        f.addEventListener('click', () => flip(i));
        front.addEventListener('contextmenu', (e) => { e.preventDefault(); showCardModal(pull.id, { variant: pull.variant, foil: pull.foil }); });
        front.addEventListener('click', (e) => { if (f.classList.contains('flipped')) { e.stopPropagation(); showCardModal(pull.id, { variant: pull.variant, foil: pull.foil }); } });
        grid.appendChild(wrap);
        flips.push({ f, pull, card, rIdx, done: false });
      });
      const summary = el('div.pack-summary');
      const revealAll = el('button.btn.gold', { onclick: async () => { for (let i = 0; i < flips.length; i++) if (!flips[i].done) { flip(i, true); await sleep(110); } } }, '✨ Reveal All');
      const nextBtn = el('button.btn.green.hidden', { onclick: () => finish('next') }, remaining ? `Open Next (${remaining} left)` : 'Done');
      const stopBtn = el('button.btn.ghost.hidden', { onclick: () => finish('stop') }, 'Stop Here');
      stage.append(el('div.pack-hint', { style: { animation: 'none' } }, 'Click the cards to reveal them!'), grid, el('div.row', revealAll, nextBtn, remaining ? stopBtn : null), summary);
      let revealedCount = 0;
      async function flip(i, quick = false) {
        const fl = flips[i];
        if (fl.done) return;
        fl.done = true;
        const high = fl.rIdx >= 4;
        if (high && !quick) {
          const r = fl.f.getBoundingClientRect();
          const spot = el('div.spotlight', { style: { '--sx': r.left + r.width / 2 + 'px', '--sy': r.top + r.height / 2 + 'px' } });
          document.body.appendChild(spot);
          fl.f.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1) rotate(-3deg)' }, { transform: 'scale(1.1) rotate(3deg)' }, { transform: 'scale(1)' }], { duration: 600 });
          sfx('whoosh');
          await sleep(650);
          setTimeout(() => spot.remove(), 900);
        }
        fl.f.classList.add('flipped');
        sfx('flip');
        const r = fl.f.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const col = RARITY_COLORS[fl.card.rarity];
        setTimeout(() => {
          sfx('reveal' + Math.min(6, fl.rIdx));
          if (fl.rIdx >= 2) FX.burst(cx, cy, { colors: [col, '#ffffff'], count: 10 + fl.rIdx * 8, speed: 3 + fl.rIdx, shape: 'star', size: 3 + fl.rIdx * 0.6, gravity: 0.04 });
          if (fl.rIdx >= 3) FX.ring(cx, cy, { color: col, radius: 90 + fl.rIdx * 20, life: 0.7, width: 6 });
          if (fl.rIdx >= 4) FX.lightRays(cx, cy, { colors: fl.rIdx === 6 ? ['#ff9a9e', '#fad0c4', '#a1ffce', '#faffd1', '#a1c4fd', '#fbc2eb'] : fl.rIdx === 5 ? ['#b25cff', '#ff2244', '#330044'] : ['#bfe9ff', '#ffffff'], len: 360 + fl.rIdx * 40, life: 1.6 });
          if (fl.rIdx === 6) { FX.confetti(); toast('✨ INFINITE PULL! ✨', 'gold', 3.5); }
          if (fl.rIdx === 5) { FX.shake(stage, 1.2); toast('A VOID card crackles into existence!', '', 3); }
        }, 260);
        revealedCount++;
        if (revealedCount === flips.length) done();
      }
      function done() {
        revealAll.classList.add('hidden');
        nextBtn.classList.remove('hidden');
        stopBtn.classList.remove('hidden');
        const counts = {};
        for (const fl of flips) counts[fl.card.rarity] = (counts[fl.card.rarity] || 0) + 1;
        summary.appendChild(el('span.pill', `✨ ${newIds.length} new`));
        for (const r of RARITIES) if (counts[r]) summary.appendChild(el('span.pill', { style: { borderColor: RARITY_COLORS[r], color: RARITY_COLORS[r] } }, `${counts[r]} ${r}`));
        const refunds = pack.cards.reduce((n, c) => n + (c.refund || 0), 0);
        if (refunds) summary.appendChild(el('span.pill.acorns', `+${refunds} recycled`));
      }
    };
    function finish(v) { removeEventListener('keydown', keyOpen); resolve(v); }
  });
}
