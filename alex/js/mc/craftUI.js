// The Pack: Alex's inventory screen (I / B, or a crafting station). Minecraft-style
// crafting — a 2×2 pocket grid everywhere, the full 3×3 grid next to a Crafting Table,
// drag-or-click ingredients into slots, a recipe book that fills the grid for you —
// plus the Furnace and the Enchanting Table. Other systems (Pokémon party and bag)
// add their own tabs with registerPackTab. The world is paused while it's open.

import { G } from '../state.js';
import { MC, MC_GEAR, MC_IDS, mcInfo, RECIPES, matchRecipe, recipeCost, canAfford, recipeFits, layout, SMELT, SMELT_XP, fuelValue, ENCHANTS, rollEnchantOffers, roman, levelFromXp, bestPick, PORTAL_OBSIDIAN } from './data.js';
import { iconURL, iconHTML } from './icons.js';
import { addMat, takeMat, addXp, spendLevels, useItem, nearStation, canBuildPortal, buildNetherPortal, invCount } from './world.js';
import { itemInfo } from '../items.js';
import { MELEE } from '../combat/weapons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GALACTIC = 'ᔑʖᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹!¡ᑑ∷ᓭℸ ̣⚍⍊∴ ̇/||⨅';
const galactic = (n) => Array.from({ length: n }, () => GALACTIC[Math.floor(Math.random() * 26)]).join('');

const TABS = [];
export function registerPackTab(tab) { TABS.push(tab); TABS.sort((a, b) => (a.order ?? 50) - (b.order ?? 50)); }

class Pack {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'pack';
    this.root.innerHTML = '<div class="pk-panel"><div class="pk-tabs"></div><div class="pk-body"></div><div class="pk-foot"></div></div><div class="pk-cursor"></div>';
    document.body.appendChild(this.root);
    this.tabsEl = this.root.querySelector('.pk-tabs');
    this.body = this.root.querySelector('.pk-body');
    this.foot = this.root.querySelector('.pk-foot');
    this.cursorEl = this.root.querySelector('.pk-cursor');
    this.isOpen = false;
    this.grid = Array(9).fill(null);
    this.held = null;
    this.selected = null;
    this.root.addEventListener('pointermove', (e) => { this.cursorEl.style.transform = `translate(${e.clientX + 6}px, ${e.clientY + 6}px)`; });
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('keydown', (e) => e.stopPropagation());
  }

  open(o = {}) {
    if (G.mode !== 'run' || G.run?.transition || G.run?.inputLocked) return;
    this.prevMode = G.mode;
    G.mode = 'pack';
    G.input.releaseLock();
    G.audio.sfx('mcChest', { v: 0.5 });
    this.isOpen = true;
    this.station = o.station || null;
    this.grid = Array(9).fill(null);
    this.held = null;
    this.selected = null;
    this.root.classList.add('on');
    this._shown = false;
    this.show(o.tab || 'craft');
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('on');
    this.held = null;
    this.cursorEl.innerHTML = '';
    G.mode = 'run';
    G.input.clearBuffers();
    G.alex.spawnSafe(0.4);
    if (!G.touch) G.input.requestLock();
    G.audio.sfx('ui', { v: 0.5 });
  }
  update() {
    if (!this.isOpen) return;
    const i = G.input;
    if (i.pressed('pause') || i.pressed('pack')) this.close();
  }

  tabs() {
    const t = [
      { id: 'craft', label: '⚒ Crafting', order: 0 },
      { id: 'furnace', label: '🔥 Furnace', order: 1, locked: () => !nearStation('furnace') && this.station !== 'furnace' ? 'Stand next to a Furnace' : '' },
      { id: 'enchant', label: '✨ Enchanting', order: 2, locked: () => !nearStation('enchantingTable') && this.station !== 'enchantingTable' ? 'Stand next to an Enchanting Table' : '' },
      ...TABS,
    ];
    return t;
  }
  show(id) {
    const changed = this.tab !== id || !this._shown;
    this._shown = true;
    this.tab = id;
    this.tabsEl.innerHTML = '';
    for (const t of this.tabs()) {
      const b = document.createElement('button');
      b.className = 'pk-tab' + (t.id === id ? ' on' : '');
      b.textContent = t.label;
      const why = t.locked?.();
      if (why) { b.classList.add('locked'); b.title = why; }
      b.addEventListener('click', () => { G.audio.sfx('ui'); this.show(t.id); });
      this.tabsEl.appendChild(b);
    }
    this.body.innerHTML = '';
    if (changed) { this.body.classList.remove('tabin'); void this.body.offsetWidth; this.body.classList.add('tabin'); } else this.body.classList.remove('tabin');
    this.foot.innerHTML = `<span>${G.input.glyph('pack')} / Esc — close</span><span>World paused</span>`;
    const ext = TABS.find((t) => t.id === id);
    if (ext) { ext.render(this.body, this); return; }
    if (id === 'craft') this.renderCraft();
    else if (id === 'furnace') this.renderFurnace();
    else if (id === 'enchant') this.renderEnchant();
  }
  refresh() { this.show(this.tab); }

  // -------------------------------------------------------------------------- crafting
  gridW() { return nearStation('craftingTable') || this.station === 'craftingTable' ? 3 : 2; }
  inGrid(id) { return this.grid.filter((g) => g === id).length; }
  avail(id) { return invCount(id) - this.inGrid(id); }
  cells() { const w = this.gridW(); return this.grid.slice(0, 9).filter((_, i) => (i % 3) < w && Math.floor(i / 3) < w); }
  gridAsW() { const w = this.gridW(); const out = []; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) out.push(this.grid[y * 3 + x]); return out; }

  renderCraft() {
    const w = this.gridW();
    const rec = matchRecipe(this.gridAsW(), w);
    const out = rec ? mcInfo(rec.out) : null;
    const d = document.createElement('div');
    d.className = 'pk-craft';
    let slots = '';
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const id = this.grid[y * 3 + x]; slots += `<button class="mcslot" data-cell="${y * 3 + x}">${id ? `<img src="${iconURL(id)}" alt="">` : ''}</button>`; }
    d.innerHTML = `
      <div class="pk-left">
        <h3>${w === 3 ? 'Crafting Table' : 'Crafting'}</h3>
        <div class="pk-grid-row"><div class="pk-grid g${w}">${slots}</div><div class="pk-arrow">➜</div>
        <button class="mcslot out ${rec ? 'ready' : ''}" data-out="1">${rec ? iconHTML(rec.out, rec.n || 1) : ''}</button></div>
        <p class="pk-hint">${rec ? `<b>${esc(out.name)}</b>${rec.n > 1 ? ' ×' + rec.n : ''} — ${esc(this.outDesc(rec))}` : w === 2 ? 'Pocket grid (2×2). Place a <b>Crafting Table</b> and stand next to it for the full 3×3 grid.' : 'Put ingredients in the grid, or pick a recipe from the book.'}</p>
        <div class="pk-actions">${rec ? '<button class="btn primary sm" data-craft="1">Craft</button><button class="btn sm" data-craft="max">Craft all</button>' : ''}<button class="btn sm" data-clear="1">Clear grid</button></div>
        <h3>Inventory</h3>
        <div class="pk-inv"></div>
        <div class="pk-info"></div>
      </div>
      <div class="pk-right"><h3>Recipe book</h3><div class="pk-book"></div></div>`;
    this.body.appendChild(d);
    // grid slots: click places the held item (or the selected one); right-click empties
    d.querySelectorAll('[data-cell]').forEach((s) => {
      s.addEventListener('click', () => this.clickCell(+s.dataset.cell));
      s.addEventListener('contextmenu', (e) => { e.preventDefault(); this.grid[+s.dataset.cell] = null; G.audio.sfx('ui', { v: 0.4 }); this.refresh(); });
    });
    d.querySelector('[data-out]').addEventListener('click', () => rec && this.craft(rec, 1));
    d.querySelectorAll('[data-craft]').forEach((b) => b.addEventListener('click', () => rec && this.craft(rec, b.dataset.craft === 'max' ? 64 : 1)));
    d.querySelector('[data-clear]').addEventListener('click', () => { this.grid.fill(null); this.refresh(); });
    this.renderInv(d.querySelector('.pk-inv'));
    this.renderInfo(d.querySelector('.pk-info'));
    this.renderBook(d.querySelector('.pk-book'), w);
  }
  outDesc(rec) {
    const g = MC_GEAR[rec.out];
    if (g?.grant?.startsWith('w:')) {
      const id = g.grant.slice(2);
      const cur = G.run.weapons[MELEE[id] ? 'melee' : 'ranged'];
      return `Equips now${cur && cur !== id ? ` (replaces your ${itemInfo('w:' + cur)?.name})` : ''}.`;
    }
    if (g?.grant) return itemInfo(g.grant)?.desc || '';
    if (g?.vehicle) return 'Spawns a Minecart next to you. Hop in.';
    return MC[rec.out]?.desc || 'Goes into your inventory.';
  }
  clickCell(i) {
    const cur = this.grid[i];
    const id = this.held || this.selected;
    if (id && this.avail(id) > 0 && cur !== id) { this.grid[i] = id; G.audio.sfx('mcPop', { v: 0.5 }); if (this.avail(id) <= 0) this.setHeld(null); }
    else if (cur) { this.grid[i] = null; G.audio.sfx('ui', { v: 0.4 }); }
    this.refresh();
  }
  setHeld(id) {
    this.held = id;
    this.cursorEl.innerHTML = id ? `<img src="${iconURL(id)}" alt="">` : '';
  }
  renderInv(el) {
    const ids = MC_IDS.filter((id) => invCount(id) > 0);
    if (!ids.length) { el.innerHTML = '<p class="pk-empty">Empty. Punch a tree. (Hit the logs with melee.) Everything you break and everything you kill drops something.</p>'; return; }
    el.innerHTML = ids.map((id) => {
      const n = this.avail(id);
      return `<button class="mcslot inv ${this.selected === id ? 'sel' : ''} ${n <= 0 ? 'used' : ''}" data-id="${id}" title="${esc(MC[id].name)}"><img src="${iconURL(id)}" alt="">${n > 1 ? `<b>${n}</b>` : ''}</button>`;
    }).join('');
    el.querySelectorAll('[data-id]').forEach((b) => {
      b.addEventListener('click', () => { const id = b.dataset.id; this.selected = id; this.setHeld(this.held === id ? null : id); G.audio.sfx('ui', { v: 0.4 }); this.refresh(); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); const id = b.dataset.id; const empty = this.grid.findIndex((g, i) => !g && (i % 3) < this.gridW() && Math.floor(i / 3) < this.gridW()); if (empty >= 0 && this.avail(id) > 0) { this.grid[empty] = id; this.refresh(); } });
    });
  }
  renderInfo(el) {
    const id = this.selected;
    if (!id || !MC[id]) { el.innerHTML = '<p class="pk-empty">Click an item to hold it, then click a grid slot. Right-click a grid slot to empty it. Right-click an item to drop one into the next free slot.</p>'; return; }
    const it = MC[id];
    const acts = [];
    if (it.food) acts.push(['eat', `Eat (+${it.food.heal} HP)`]);
    if (it.place) acts.push(['use', 'Place it in front of you']);
    if (it.use === 'bed') acts.push(['use', 'Sleep']);
    if (it.use === 'eye') acts.push(['use', 'Throw it']);
    if (id === 'obsidian') { const c = canBuildPortal(); acts.push(['portal', c.ok ? `Build a Nether Portal (${PORTAL_OBSIDIAN} obsidian)` : c.why, !c.ok]); }
    const p = bestPick(G.run.inv);
    const extra = it.pick ? (p.id === id ? ' · In use (your best pickaxe).' : '') : it.fuel ? ` · Fuel: smelts ${it.fuel} item${it.fuel === 1 ? '' : 's'}.` : SMELT[id] ? ` · Smelts into ${MC[SMELT[id]].name}.` : '';
    el.innerHTML = `<div class="pk-item"><img src="${iconURL(id)}" alt=""><div><b>${esc(it.name)}</b> <small>×${invCount(id)}</small><p>${esc(it.desc || '')}${esc(extra)}</p></div></div><div class="pk-actions">${acts.map(([a, t, dis]) => `<button class="btn sm ${dis ? 'disabled' : ''}" data-act="${a}" ${dis ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'portal') { this.close(); buildNetherPortal(); return; }
      if (a === 'use' && (it.place || it.use === 'eye' || it.use === 'bed')) { this.close(); useItem(id); return; }
      useItem(id);
      if (!invCount(id)) this.selected = null;
      this.refresh();
    }));
  }
  renderBook(el, w) {
    const inv = G.run.inv;
    const seen = new Set();
    const list = RECIPES.filter((r) => { const k = r.out + JSON.stringify(r.shape || r.shapeless); if (seen.has(k)) return false; seen.add(k); return true; });
    const score = (r) => (canAfford(inv, r) ? 0 : Object.entries(recipeCost(r)).some(([id]) => (inv[id] || 0) > 0) ? 1 : 2) + (recipeFits(r, w) ? 0 : 3);
    list.sort((a, b) => score(a) - score(b));
    el.innerHTML = list.map((r, i) => {
      const cost = recipeCost(r);
      const ok = canAfford(inv, r) && recipeFits(r, w);
      const fits = recipeFits(r, w);
      return `<button class="pk-rec ${ok ? 'ok' : ''} ${fits ? '' : 'big'}" data-r="${RECIPES.indexOf(r)}">${iconHTML(r.out, r.n || 1)}<span><b>${esc(mcInfo(r.out).name)}</b><small>${Object.entries(cost).map(([id, n]) => `<i class="${(inv[id] || 0) >= n ? 'have' : ''}">${n}× ${esc(MC[id]?.name || id)}</i>`).join(' ')}${fits ? '' : ' · <em>needs a Crafting Table</em>'}</small></span></button>`;
    }).join('');
    el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
      const r = RECIPES[+b.dataset.r];
      if (!recipeFits(r, w)) { G.audio.sfx('deny'); G.hud.popup('NEEDS A CRAFTING TABLE (3×3)', '#ff4d6d', 1); return; }
      const g = layout(r, w);
      this.grid.fill(null);
      g.forEach((id, i) => { if (id) this.grid[Math.floor(i / w) * 3 + (i % w)] = id; });
      G.audio.sfx('ui');
      this.refresh();
    }));
  }
  craft(rec, times) {
    const w = this.gridW();
    let made = 0;
    for (let t = 0; t < times; t++) {
      if (matchRecipe(this.gridAsW(), w) !== rec) break;
      const cells = this.gridAsW().filter(Boolean);
      const need = {};
      for (const id of cells) need[id] = (need[id] || 0) + 1;
      if (!Object.entries(need).every(([id, n]) => invCount(id) >= n)) break;
      for (const [id, n] of Object.entries(need)) takeMat(id, n);
      this.give(rec);
      made++;
      // keep the pattern while you can still afford it
      for (let i = 0; i < 9; i++) { const id = this.grid[i]; if (id && invCount(id) < this.inGrid(id)) for (let j = 0; j < 9; j++) if (this.grid[j] === id) this.grid[j] = null; }
      if (MC_GEAR[rec.out] && !['goldenApple', 'tnt'].includes(rec.out)) break;
    }
    if (made) {
      G.audio.sfx('mcCraft');
      G.run.stat('crafted', made);
      this.flash = rec.out;
    } else G.audio.sfx('deny');
    if (G.mode === 'pack') this.refresh();
  }
  give(rec) {
    const g = MC_GEAR[rec.out];
    const n = rec.n || 1;
    if (!g) { addMat(rec.out, n, { quiet: true }); G.hud.mcPickup(rec.out, n); return; }
    if (g.vehicle) {
      const a = G.alex;
      this.close();
      const v = G.room.spawnVehicle(g.vehicle, a.pos.x + Math.sin(a.yaw) * 2.5, a.pos.z + Math.cos(a.yaw) * 2.5, a.yaw);
      G.hud.popup('MINECART CRAFTED — hop in', '#9ca3af', 1.4);
      return v;
    }
    if (g.grant === 'g:tnt' && G.run.gadget?.id === 'tnt') { G.run.gadget.charges += 3; G.run.gadget.max = Math.max(G.run.gadget.max, G.run.gadget.charges); G.hud.popup('+3 TNT', '#dc2626', 1); return; }
    G.run.grant(g.grant);
  }

  // -------------------------------------------------------------------------- furnace
  renderFurnace() {
    const run = G.run;
    const d = document.createElement('div');
    d.className = 'pk-furnace';
    if (!nearStation('furnace') && this.station !== 'furnace') {
      d.innerHTML = `<p class="pk-empty">Stand next to a Furnace to smelt. Craft one from 8 Cobblestone (in a ring on the 3×3 grid) and place it from your inventory.</p>`;
      this.body.appendChild(d);
      return;
    }
    const inputs = Object.keys(SMELT).filter((id) => invCount(id) > 0);
    const fuels = MC_IDS.filter((id) => fuelValue(id) && invCount(id) > 0).sort((a, b) => fuelValue(b) - fuelValue(a));
    const fuelLeft = run.furnaceFuel || 0;
    d.innerHTML = `
      <div class="pk-left">
        <h3>Furnace</h3>
        <div class="pk-furn-row">
          <div class="pk-furn-col"><button class="mcslot">${this.smeltIn ? iconHTML(this.smeltIn, invCount(this.smeltIn)) : ''}</button><div class="pk-flame ${fuelLeft > 0 ? 'on' : ''}">🔥</div><button class="mcslot">${fuels[0] ? iconHTML(fuels[0], invCount(fuels[0])) : ''}</button></div>
          <div class="pk-arrow big"><i style="--k:0"></i>➜</div>
          <button class="mcslot out">${this.smeltIn ? `<img src="${iconURL(SMELT[this.smeltIn])}" alt="">` : ''}</button>
        </div>
        <p class="pk-hint">${fuelLeft > 0 ? `Burning: ${fuelLeft.toFixed(1)} more item${fuelLeft === 1 ? '' : 's'} from the last fuel.` : fuels.length ? `Fuel: ${esc(MC[fuels[0]].name)} (smelts ${fuelValue(fuels[0])}).` : 'No fuel! Coal, charcoal, planks, logs, sticks or blaze rods.'}</p>
        <div class="pk-actions">${this.smeltIn ? '<button class="btn primary sm" data-smelt="1">Smelt 1</button><button class="btn sm" data-smelt="all">Smelt all</button>' : ''}</div>
      </div>
      <div class="pk-right"><h3>Smeltable</h3><div class="pk-book">${inputs.length ? inputs.map((id) => `<button class="pk-rec ok ${this.smeltIn === id ? 'sel' : ''}" data-in="${id}">${iconHTML(id, invCount(id))}<span><b>${esc(MC[id].name)}</b><small>→ ${esc(MC[SMELT[id]].name)}</small></span></button>`).join('') : '<p class="pk-empty">Nothing to smelt. Raw iron, raw gold, sand, logs, netherrack, rotten flesh.</p>'}</div></div>`;
    this.body.appendChild(d);
    d.querySelectorAll('[data-in]').forEach((b) => b.addEventListener('click', () => { this.smeltIn = b.dataset.in; G.audio.sfx('ui'); this.refresh(); }));
    d.querySelectorAll('[data-smelt]').forEach((b) => b.addEventListener('click', () => this.smelt(b.dataset.smelt === 'all' ? 64 : 1, d)));
  }
  smelt(times, d) {
    const run = G.run, id = this.smeltIn;
    if (!id || this._smelting) return;
    let n = 0;
    const step = () => {
      if (n >= times || invCount(id) < 1) { this._smelting = false; if (!invCount(id)) this.smeltIn = null; if (G.mode === 'pack' && this.tab === 'furnace') this.refresh(); return; }
      if ((run.furnaceFuel || 0) < 1) {
        const fuel = MC_IDS.filter((f) => fuelValue(f) && invCount(f) > 0 && f !== id).sort((a, b) => fuelValue(b) - fuelValue(a))[0];
        if (!fuel) { G.hud.popup('OUT OF FUEL', '#ff4d6d', 1); this._smelting = false; this.refresh(); return; }
        takeMat(fuel, 1);
        run.furnaceFuel = (run.furnaceFuel || 0) + fuelValue(fuel);
      }
      run.furnaceFuel -= 1;
      takeMat(id, 1);
      addMat(SMELT[id], 1, { quiet: true });
      G.hud.mcPickup(SMELT[id], 1);
      addXp(SMELT_XP[id] >= 1 || Math.random() < SMELT_XP[id] ? Math.max(1, Math.round(SMELT_XP[id])) : 0);
      n++;
      G.audio.sfx('mcSmelt', { v: 0.5 });
      const ar = this.body.querySelector('.pk-arrow i');
      if (ar) { ar.style.setProperty('--k', 0); void ar.offsetWidth; ar.style.setProperty('--k', 1); }
      setTimeout(step, times > 1 ? 160 : 0);
      run.stat('smelted', 1);
    };
    this._smelting = true;
    step();
  }

  // -------------------------------------------------------------------------- enchanting
  renderEnchant() {
    const run = G.run;
    const d = document.createElement('div');
    d.className = 'pk-ench';
    if (!nearStation('enchantingTable') && this.station !== 'enchantingTable') {
      d.innerHTML = '<p class="pk-empty">Stand next to an Enchanting Table. Craft one from a Book, 2 Diamonds and 4 Obsidian. Enchantments cost XP levels and lapis lazuli.</p>';
      this.body.appendChild(d);
      return;
    }
    if (!run.enchOffers) run.enchOffers = rollEnchantOffers(Math.random, run.ench);
    const { level } = levelFromXp(run.xp);
    const lapis = invCount('lapis');
    const owned = Object.entries(run.ench);
    d.innerHTML = `
      <div class="pk-left"><h3>Enchant</h3>
        <p class="pk-hint">Level <b class="xpnum">${level}</b> · Lapis ${iconHTML('lapis', lapis)} ${lapis}</p>
        <div class="pk-offers">${run.enchOffers.map((o, i) => {
          const E = ENCHANTS[o.id];
          const ok = level >= o.cost && lapis >= o.lapis;
          return `<button class="pk-offer ${ok ? 'ok' : ''}" data-o="${i}"><span class="gal">${galactic(10 + i * 3)}</span><b>${E.icon} ${esc(E.name)} ${roman(o.level)}</b><i>${o.cost} level${o.cost > 1 ? 's' : ''} · ${o.lapis} lapis</i></button>`;
        }).join('')}</div>
      </div>
      <div class="pk-right"><h3>Your enchantments</h3><div class="pk-book">${owned.length ? owned.map(([id, l]) => `<div class="pk-rec ok"><span><b>${ENCHANTS[id].icon} ${esc(ENCHANTS[id].name)} ${roman(l)}</b></span></div>`).join('') : '<p class="pk-empty">None yet. They apply to everything Alex uses.</p>'}</div></div>`;
    this.body.appendChild(d);
    d.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => {
      const o = run.enchOffers[+b.dataset.o];
      if (levelFromXp(run.xp).level < o.cost || invCount('lapis') < o.lapis) { G.audio.sfx('deny'); return; }
      spendLevels(o.cost);
      takeMat('lapis', o.lapis);
      run.ench[o.id] = o.level;
      run.enchOffers = null;
      run.recomputeMods();
      G.audio.sfx('mcEnchant');
      G.hud.popup(`ENCHANTED: ${ENCHANTS[o.id].name.toUpperCase()} ${roman(o.level)}`, '#c084fc', 1.6);
      G.run.stat('enchants', 1);
      this.refresh();
    }));
  }
}

export function initPack() {
  G.pack = new Pack();
  return G.pack;
}
