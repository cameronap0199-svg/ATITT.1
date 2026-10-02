// The Pack's Pokémon tabs: the party (with a full summary — stats, nature, moves),
// Bill's PC, the Bag, and the Poké Mart (at the gas station). DOM, mouse/touch first.

import { G } from '../state.js';
import { registerPackTab } from '../mc/craftUI.js';
import { SPECIES } from './dex.js';
import { MOVES } from './moves.js';
import { TYPES } from './types.js';
import { spriteURL, itemSprite } from './sprites.js';
import { monName, maxHp, calcStats, expProgress, expToNext, natureMods, STAT_NAMES } from './mon.js';
import { BAG_ITEMS } from './battle.js';
import { PARTY_MAX, useBagItem, refreshBuddy } from './index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const typeBadge = (t) => `<i class="pkt" style="--tc:${TYPES[t].color}">${TYPES[t].name.toUpperCase()}</i>`;
const hpCol = (k) => (k > 0.5 ? '#38d878' : k > 0.2 ? '#f8c030' : '#f05038');
const STATUS = { brn: 'BRN', par: 'PAR', psn: 'PSN', tox: 'PSN', slp: 'SLP', frz: 'FRZ' };

let sel = { where: 'party', i: 0 };
let msg = '';

function monCard(m, i, where) {
  const mh = maxHp(m), k = m.hp / mh;
  const isSel = sel.where === where && sel.i === i;
  return `<button class="pkmon ${isSel ? 'sel' : ''} ${m.hp <= 0 ? 'fnt' : ''}" data-w="${where}" data-i="${i}">
    <img src="${spriteURL(m.species, { shiny: m.shiny })}" alt="">
    <span class="pk-n">${esc(monName(m))}${m.shiny ? ' <em>✦</em>' : ''}</span><span class="pk-l">Lv${m.level}</span>
    <span class="pk-hp"><i style="width:${k * 100}%;background:${hpCol(k)}"></i></span><span class="pk-hpn">${m.hp}/${mh}${m.status ? ` <b class="st">${STATUS[m.status]}</b>` : ''}</span>
    ${where === 'party' ? `<span class="pk-exp"><i style="width:${expProgress(m) * 100}%"></i></span>` : ''}
  </button>`;
}

function summary(m, where, i) {
  const sp = SPECIES[m.species];
  const st = calcStats(m), nm = natureMods(m.nature);
  const run = G.run;
  const bagUse = Object.keys(BAG_ITEMS).filter((id) => (run.bag[id] || 0) > 0 && !BAG_ITEMS[id].ball);
  return `<div class="pk-sum">
    <div class="pk-sum-top"><img src="${spriteURL(m.species, { shiny: m.shiny })}" alt=""><div>
      <h4>${esc(monName(m))} <small>No.${String(sp.no).padStart(3, '0')} ${esc(sp.name)}</small></h4>
      <p>${sp.types.map(typeBadge).join(' ')} · Lv ${m.level} · ${esc(m.nature)} nature${m.shiny ? ' · ✦ shiny' : ''}</p>
      <p class="pk-dim">EXP to next level: ${expToNext(m)} · OT: ${esc(m.ot || 'Alex')}</p>
    </div></div>
    <table class="pk-stats">${['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((k) => `<tr class="${nm[k] > 1 ? 'up' : nm[k] < 1 ? 'down' : ''}"><td>${STAT_NAMES[k]}</td><td>${k === 'hp' ? `${m.hp}/${st.hp}` : st[k]}</td><td><span class="pk-sbar"><i style="width:${Math.min(100, (k === 'hp' ? st.hp : st[k]) / (m.level * 2.2 + 20) * 100)}%"></i></span></td></tr>`).join('')}</table>
    <div class="pk-moves">${m.moves.map((x) => { const mv = MOVES[x.id]; return `<div class="pk-move">${typeBadge(mv.type)}<b>${esc(mv.name)}</b><span>${mv.cat === 'status' ? 'Status' : `${mv.cat === 'phys' ? 'Phys' : 'Spec'} ${mv.power}`} · ${mv.acc ? mv.acc + '%' : '—'} · PP ${x.pp}/${x.max}</span></div>`; }).join('')}</div>
    <div class="pk-actions">
      ${where === 'party' && i > 0 ? '<button class="btn sm" data-a="lead">Make lead</button>' : ''}
      ${where === 'party' && run.party.length > 1 ? '<button class="btn sm" data-a="pc">Send to PC</button>' : ''}
      ${where === 'pc' ? `<button class="btn sm" data-a="withdraw" ${run.party.length >= PARTY_MAX ? 'disabled' : ''}>Withdraw</button><button class="btn sm" data-a="swap">Swap with lead</button>` : ''}
      <button class="btn sm" data-a="rename">Nickname</button>
      ${where === 'party' && bagUse.length ? `<select class="pk-use"><option value="">Use item…</option>${bagUse.map((id) => `<option value="${id}">${esc(BAG_ITEMS[id].name)} (${run.bag[id]})</option>`).join('')}</select>` : ''}
      <button class="btn sm danger" data-a="release">Release</button>
    </div>
    ${msg ? `<p class="pk-msg">${esc(msg)}</p>` : ''}
  </div>`;
}

function renderParty(el, pack) {
  const run = G.run;
  const party = run.party, pc = run.pc;
  if (!party.length && !pc.length) {
    el.innerHTML = `<div class="pk-empty">No Pokémon yet. ${run.floor === 1 && !run.flags.starter ? 'Professor Oakley is waiting in the parking lot with three Poké Balls.' : 'Catch one: Capture Ball a Pokémon in a rift, or find tall grass.'}</div>`;
    return;
  }
  if (sel.where === 'party' && sel.i >= party.length) sel = { where: party.length ? 'party' : 'pc', i: 0 };
  if (sel.where === 'pc' && sel.i >= pc.length) sel = { where: 'party', i: 0 };
  const cur = sel.where === 'party' ? party[sel.i] : pc[sel.i];
  el.innerHTML = `<div class="pk-party">
    <div class="pk-left"><h3>Party (${party.length}/${PARTY_MAX})</h3><div class="pk-list">${party.map((m, i) => monCard(m, i, 'party')).join('')}</div>
      <h3>Bill's PC (${pc.length})</h3><div class="pk-pc">${pc.length ? pc.map((m, i) => `<button class="pk-box ${sel.where === 'pc' && sel.i === i ? 'sel' : ''}" data-w="pc" data-i="${i}" title="${esc(monName(m))} Lv${m.level}"><img src="${spriteURL(m.species, { shiny: m.shiny })}" alt=""><b>${m.level}</b></button>`).join('') : '<p class="pk-dim">Empty. Pokémon caught with a full party go here.</p>'}</div></div>
    <div class="pk-right">${cur ? summary(cur, sel.where, sel.i) : ''}</div></div>`;
  el.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => { sel = { where: b.dataset.w, i: +b.dataset.i }; msg = ''; G.audio.sfx('ui', { v: 0.4 }); pack.refresh(); }));
  el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => act(b.dataset.a, cur, pack)));
  const use = el.querySelector('.pk-use');
  if (use) use.addEventListener('change', () => {
    const id = use.value;
    if (!id) return;
    const r = useBagItem(id, cur);
    msg = r.msg;
    if (r.ok && r.scenes && G.run.pokeQueue.length) { pack.close(); G.poke.runQueuedNow(); return; }
    pack.refresh();
  });
}

function act(a, mon, pack) {
  const run = G.run;
  if (a === 'lead') { const i = run.party.indexOf(mon); run.party.splice(i, 1); run.party.unshift(mon); sel = { where: 'party', i: 0 }; msg = `${monName(mon)} is now leading. It will follow you around.`; refreshBuddy(); }
  if (a === 'pc') { const i = run.party.indexOf(mon); run.party.splice(i, 1); run.pc.push(mon); sel = { where: 'party', i: 0 }; msg = `${monName(mon)} was sent to the PC.`; refreshBuddy(); }
  if (a === 'withdraw' && run.party.length < PARTY_MAX) { run.pc.splice(run.pc.indexOf(mon), 1); run.party.push(mon); sel = { where: 'party', i: run.party.length - 1 }; msg = `Withdrew ${monName(mon)}.`; }
  if (a === 'swap' && run.party.length) { const i = run.pc.indexOf(mon); const out = run.party[0]; run.party[0] = mon; run.pc[i] = out; sel = { where: 'party', i: 0 }; msg = `${monName(mon)} swapped in for ${monName(out)}.`; refreshBuddy(); }
  if (a === 'rename') { const n = prompt('Nickname?', monName(mon)); if (n != null) { mon.nick = n.trim().slice(0, 12) || null; msg = 'Nickname set.'; } }
  if (a === 'release') {
    if (run.party.length + run.pc.length <= 1) { msg = 'You can\'t release your last Pokémon!'; }
    else if (confirm(`Release ${monName(mon)}? Bye-bye, ${monName(mon)}!`)) { const L = sel.where === 'party' ? run.party : run.pc; L.splice(L.indexOf(mon), 1); sel = { where: 'party', i: 0 }; msg = `${monName(mon)} was released outside. Bye-bye!`; refreshBuddy(); }
  }
  G.audio.sfx('uiOk', { v: 0.5 });
  pack.refresh();
}

function renderBag(el, pack) {
  const run = G.run;
  const ids = Object.keys(BAG_ITEMS).filter((id) => (run.bag[id] || 0) > 0);
  el.innerHTML = `<div class="pk-bag"><h3>Bag</h3>${ids.length ? ids.map((id) => `<div class="pk-bagi"><img src="${itemSprite(id)}" alt=""><b>${esc(BAG_ITEMS[id].name)}</b><span>×${run.bag[id]}</span><small>${esc(BAG_ITEMS[id].desc)}</small>${!BAG_ITEMS[id].ball && run.party.length ? `<select data-id="${id}"><option value="">Use on…</option>${run.party.map((m, i) => `<option value="${i}">${esc(monName(m))} (Lv${m.level}, ${m.hp}/${maxHp(m)})</option>`).join('')}</select>` : ''}</div>`).join('') : '<p class="pk-empty">The Bag is empty. Poké Balls drop from defeated enemies now and then; the gas station has a Poké Mart.</p>'}${msg ? `<p class="pk-msg">${esc(msg)}</p>` : ''}</div>`;
  el.querySelectorAll('select[data-id]').forEach((s) => s.addEventListener('change', () => {
    if (s.value === '') return;
    const r = useBagItem(s.dataset.id, run.party[+s.value]);
    msg = r.msg;
    if (r.ok && r.scenes && G.run.pokeQueue.length) { pack.close(); G.poke.runQueuedNow(); return; }
    pack.refresh();
  }));
}

const MART = ['pokeBall', 'greatBall', 'ultraBall', 'potion', 'superPotion', 'hyperPotion', 'revive', 'fireStone', 'waterStone', 'thunderStone', 'leafStone', 'moonStone'];
function renderMart(el, pack) {
  const run = G.run;
  const atStore = G.room?.def.kind === 'gas';
  if (!atStore) { el.innerHTML = '<p class="pk-empty">The Poké Mart counter is in the Gas Station (next to the Pokémon Center).</p>'; return; }
  const price = (id) => Math.max(1, Math.round(BAG_ITEMS[id].price * (run.mods.priceMul || 1)));
  el.innerHTML = `<div class="pk-bag"><h3>Poké Mart — you have $${run.money}</h3>${MART.map((id) => `<div class="pk-bagi"><img src="${itemSprite(id)}" alt=""><b>${esc(BAG_ITEMS[id].name)}</b><span>$${price(id)}</span><small>${esc(BAG_ITEMS[id].desc)} (In bag: ${run.bag[id] || 0})</small><button class="btn sm" data-buy="${id}" data-n="1" ${run.money < price(id) ? 'disabled' : ''}>Buy 1</button><button class="btn sm" data-buy="${id}" data-n="5" ${run.money < price(id) * 5 ? 'disabled' : ''}>Buy 5</button></div>`).join('')}${msg ? `<p class="pk-msg">${esc(msg)}</p>` : ''}</div>`;
  el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.buy, n = +b.dataset.n, cost = price(id) * n;
    if (run.money < cost) { G.audio.sfx('deny'); return; }
    run.addMoney(-cost, true);
    run.bag[id] = (run.bag[id] || 0) + n;
    msg = `Bought ${n} ${BAG_ITEMS[id].name}${n > 1 ? 's' : ''}. Thank you!`;
    G.audio.sfx('buy');
    run.stat('itemsPurchased', n);
    pack.refresh();
  }));
}

registerPackTab({ id: 'pokemon', label: '◓ Pokémon', order: 10, render: (el, pack) => renderParty(el, pack) });
registerPackTab({ id: 'bag', label: '🎒 Bag', order: 11, render: (el, pack) => renderBag(el, pack) });
registerPackTab({ id: 'mart', label: '🛒 Poké Mart', order: 12, locked: () => (G.room?.def.kind === 'gas' ? '' : 'At the Gas Station'), render: (el, pack) => renderMart(el, pack) });
export function resetPackSelection() { sel = { where: 'party', i: 0 }; msg = ''; }
