// Minecraft bits of the HUD: the green XP bar with the level number, the best pickaxe
// you're carrying, and the item pickup feed ("+3 Iron Ingot") on the right.

import { G } from '../state.js';
import { mcInfo, levelFromXp, bestPick } from './data.js';
import { iconURL } from './icons.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class McHud {
  constructor(root, slot) {
    this.slot = slot;
    slot.innerHTML = '<span class="mc-pick"></span><span class="mc-xp"><i></i><b></b></span>';
    this.pick = slot.querySelector('.mc-pick');
    this.xpFill = slot.querySelector('.mc-xp i');
    this.xpLvl = slot.querySelector('.mc-xp b');
    this.feed = document.createElement('div');
    this.feed.className = 'mcfeed';
    root.appendChild(this.feed);
    this.rows = new Map();
    this._key = '';
  }
  update() {
    const run = G.run;
    if (!run) return;
    const { level, frac } = levelFromXp(run.xp || 0);
    const p = bestPick(run.inv || {});
    const key = level + '|' + Math.round(frac * 100) + '|' + p.id + '|' + (run.inv?.torch || 0);
    if (key === this._key) return;
    const lvlUp = this._lvl !== undefined && level > this._lvl;
    this._key = key; this._lvl = level;
    this.slot.classList.toggle('on', !!(run.xp || p.id));
    this.xpFill.style.transform = `scaleX(${frac})`;
    this.xpLvl.textContent = level || '';
    if (lvlUp) { this.xpLvl.classList.remove('up'); void this.xpLvl.offsetWidth; this.xpLvl.classList.add('up'); }
    this.pick.innerHTML = (p.id ? `<img src="${iconURL(p.id)}" alt="" title="${esc(mcInfo(p.id).name)}">` : '') + (run.inv?.torch ? `<img src="${iconURL('torch')}" alt="" title="Torches">` : '');
  }
  add(id, n) {
    const it = mcInfo(id);
    if (!it) return;
    let r = this.rows.get(id);
    if (r && performance.now() - r.t < 2500) {
      r.n += n; r.t = performance.now();
      r.el.querySelector('b').textContent = '+' + r.n;
      r.el.classList.remove('bump'); void r.el.offsetWidth; r.el.classList.add('bump');
    } else {
      const el = document.createElement('div');
      el.className = 'mcrow';
      el.innerHTML = `<img src="${iconURL(id)}" alt=""><b>+${n}</b><span>${esc(it.name)}</span>`;
      this.feed.prepend(el);
      r = { el, n, t: performance.now() };
      this.rows.set(id, r);
      while (this.feed.children.length > 6) this.feed.lastChild.remove();
    }
    clearTimeout(r.timer);
    r.timer = setTimeout(() => { r.el.classList.add('out'); setTimeout(() => { r.el.remove(); if (this.rows.get(id) === r) this.rows.delete(id); }, 400); }, 2800);
  }
  clear() { this.feed.innerHTML = ''; this.rows.clear(); }
}
