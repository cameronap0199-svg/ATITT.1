// DOM user interface: HUD, typewriter dialogue, choices, the Create/Bond/Duty picker,
// menus (title, pause, settings, controls, journal) and ending/credits screens.
import { input } from './input.js';
import { audio } from './audio.js';
import { renderComposition, newPaintCanvas } from './painting.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PR = {
  create: { icon: '✎', name: 'CREATE', color: '#f09ab8' },
  bond: { icon: '♥', name: 'BOND', color: '#8fc2f5' },
  duty: { icon: '⌂', name: 'DUTY', color: '#f3d98a' },
};
export { PR };

export class UI {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.hooks = { unlock: () => {}, relock: () => {}, onSettings: () => {} };
    root.insertAdjacentHTML('beforeend', `
      <div id="hud">
        <div id="crosshair"></div><div id="prompt"></div>
        <div id="objective"></div><div id="tasks"></div>
        <div id="subtitle"></div><div id="toast"></div>
        <div id="card"><div class="c-num"></div><div class="c-title"></div><div class="c-sub"></div></div>
        <div id="stamina"><i></i></div>
        <div id="hideveil" class="hidden"></div><div id="hidehint" class="hidden">Hiding — hold still. <b>E</b> to leave</div>
      </div>
      <div id="dialogue" class="hidden"><div class="box"><div class="name"></div><div class="text"></div><div class="choices"></div><div class="more">▼</div></div></div>
      <div id="priority" class="overlay hidden"></div>
      <div id="menu" class="overlay hidden"></div>
      <div id="ending" class="overlay hidden"></div>
      <div id="clicklock" class="hidden">click to continue</div>`);
    this.$ = (id) => document.getElementById(id);
    this.dlg = this.$('dialogue');
    this.dlg.addEventListener('mousedown', (e) => { if (!e.target.closest('.choice')) this._advance(); });
    this.$('clicklock').addEventListener('click', () => { this.$('clicklock').classList.add('hidden'); this.hooks.relock(); });
    this.applyTextSize();
  }

  applyTextSize() { document.documentElement.style.setProperty('--ts', this.settings.textSize); }

  // ------------------------------------------------------------ HUD
  setPrompt(text, dim = false) {
    const p = this.$('prompt');
    if (!text) { p.classList.remove('on'); this.$('crosshair').classList.remove('active'); return; }
    const key = input.usingPad ? 'A' : 'E';
    p.innerHTML = dim ? esc(text) : `<span class="key">${key}</span>${esc(text)}`;
    p.classList.toggle('dim', dim);
    p.classList.add('on');
    this.$('crosshair').classList.toggle('active', !dim);
  }
  showCrosshair(on) { this.$('crosshair').style.display = on ? '' : 'none'; }
  setObjective(text, label = 'OBJECTIVE') {
    const o = this.$('objective');
    if (!text || !this.settings.hints) { o.classList.remove('on'); return; }
    o.innerHTML = `<small>${esc(label)}</small>${esc(text)}`;
    o.classList.add('on');
  }
  setTasks(list) {
    const t = this.$('tasks');
    if (!list || !list.length) { t.innerHTML = ''; return; }
    t.innerHTML = list.map((x) => `<div class="t ${x.done ? 'done' : ''} ${x.neglect ? 'neglect' : ''}">${esc(x.label)}<span class="dot" style="background:${x.neglect ? '#555' : PR[x.kind]?.color || '#fff'}"></span></div>`).join('');
  }
  setStamina(v, show) { this.$('stamina').classList.toggle('on', show); this.$('stamina').firstChild.style.width = `${v * 100}%`; }
  setHiding(on) { this.$('hidehint').classList.toggle('hidden', !on); this.$('hideveil').classList.toggle('hidden', !on); }
  toast(text, ms = 2600) {
    const t = this.$('toast'); t.innerHTML = esc(text).replace(/\n/g, '<br>'); t.classList.add('on');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }
  subtitle(text, ms) {
    const s = this.$('subtitle');
    s.textContent = text; s.classList.add('on');
    clearTimeout(this._subT);
    const dur = ms ?? Math.max(2400, text.length * 55 / this.settings.textSpeed);
    this._subT = setTimeout(() => s.classList.remove('on'), dur);
    return dur;
  }
  clearSubtitle() { this.$('subtitle').classList.remove('on'); }
  async narrate(lines, gap = 400) {
    for (const l of [].concat(lines)) { const d = this.subtitle(l); await wait(d + gap); }
  }
  async card(num, title, sub = '', ms = 3600) {
    const c = this.$('card');
    c.querySelector('.c-num').textContent = num; c.querySelector('.c-title').textContent = title; c.querySelector('.c-sub').textContent = sub;
    c.classList.add('on'); audio.play('chime');
    await wait(ms);
    c.classList.remove('on');
    await wait(900);
  }
  hideHud(h) { this.$('hud').style.visibility = h ? 'hidden' : ''; }

  // ------------------------------------------------------------ dialogue
  say(name, text, opts = {}) {
    return new Promise((resolve) => {
      this.dlg.classList.remove('hidden');
      const nm = this.dlg.querySelector('.name');
      const kind = opts.kind || (name === 'Nate' ? 'nate' : name === 'Alienate' ? 'alien' : name ? '' : 'none');
      nm.className = 'name ' + kind; nm.textContent = name || '';
      const tx = this.dlg.querySelector('.text');
      tx.classList.toggle('italic', !!opts.italic || kind === 'thought' || kind === 'none');
      this.dlg.classList.toggle('alien', kind === 'alien');
      this.dlg.querySelector('.choices').innerHTML = '';
      this.dlg.querySelector('.more').style.display = 'none';
      this._typing = { text, i: 0, t: 0, el: tx, pitch: opts.pitch || (name === 'Nate' ? 520 : name ? 380 + (name.length * 37) % 300 : 0), done: false, resolve, skip: 0.15 };
      tx.textContent = '';
      this._mode = 'say';
    });
  }
  choose(options, prompt = null) {
    return new Promise((resolve) => {
      this.dlg.classList.remove('hidden');
      const nm = this.dlg.querySelector('.name'); nm.className = 'name nate'; nm.textContent = 'Nate';
      const tx = this.dlg.querySelector('.text'); tx.textContent = prompt || ''; tx.classList.add('italic');
      tx.style.minHeight = prompt ? '' : '0';
      this.dlg.querySelector('.more').style.display = 'none';
      const box = this.dlg.querySelector('.choices'); box.innerHTML = '';
      this._choice = { sel: 0, n: options.length, resolve, box };
      options.forEach((o, i) => {
        const b = document.createElement('button'); b.className = 'choice' + (i === 0 ? ' sel' : '');
        b.innerHTML = `<span class="n">${i + 1}.</span>${esc(o)}`;
        b.addEventListener('mouseenter', () => { this._choice.sel = i; this._markSel(); audio.play('hover'); });
        b.addEventListener('click', () => this._pick(i));
        box.appendChild(b);
      });
      this._mode = 'choose';
      this.hooks.unlock();
    });
  }
  _markSel() { [...this._choice.box.children].forEach((b, i) => b.classList.toggle('sel', i === this._choice.sel)); }
  _pick(i) {
    if (this._mode !== 'choose') return;
    const c = this._choice; this._mode = null;
    audio.play('click');
    this.dlg.querySelector('.text').style.minHeight = '';
    this.dlg.classList.add('hidden');
    this.hooks.relock();
    c.resolve(i);
  }
  _advance() {
    if (this._mode !== 'say' || !this._typing) return;
    const ty = this._typing;
    if (!ty.done) { if (ty.t > ty.skip) { ty.i = ty.text.length; ty.el.textContent = ty.text; ty.done = true; this.dlg.querySelector('.more').style.display = ''; } return; }
    this._mode = null; this._typing = null;
    audio.play('click');
    this.dlg.classList.add('hidden');
    ty.resolve();
  }
  closeDialogue() { this.dlg.classList.add('hidden'); this._mode = null; }
  inDialogue() { return !!this._mode; }

  update(dt) {
    const ty = this._typing;
    if (this._mode === 'say' && ty) {
      ty.t += dt;
      if (!ty.done) {
        const cps = 42 * this.settings.textSpeed;
        const before = Math.floor(ty.i);
        ty.i = Math.min(ty.text.length, ty.i + dt * cps);
        const now = Math.floor(ty.i);
        if (now !== before) {
          ty.el.textContent = ty.text.slice(0, now);
          const ch = ty.text[now - 1];
          if (this.settings.blips && ty.pitch && ch && /\w/.test(ch) && now % 2 === 0) audio.play('blip', { freq: ty.pitch + Math.random() * 40 });
        }
        if (ty.i >= ty.text.length) { ty.done = true; this.dlg.querySelector('.more').style.display = ''; }
      }
      if (input.anyAdvance()) this._advance();
    } else if (this._mode === 'choose') {
      const c = this._choice;
      for (let i = 0; i < c.n; i++) if (input.code('Digit' + (i + 1)) || input.code('Numpad' + (i + 1))) { this._pick(i); return; }
      if (input.code('ArrowUp') || input.code('KeyW') || input.code('pad:up')) { c.sel = (c.sel + c.n - 1) % c.n; this._markSel(); audio.play('hover'); }
      if (input.code('ArrowDown') || input.code('KeyS') || input.code('pad:down')) { c.sel = (c.sel + 1) % c.n; this._markSel(); audio.play('hover'); }
      if (input.code('Enter') || input.code('Space') || input.code('KeyE') || input.code('pad:interact')) this._pick(c.sel);
    }
  }

  needClick(on) { this.$('clicklock').classList.toggle('hidden', !on); }

  // ------------------------------------------------------------ priorities
  pickPriorities(cfg) {
    return new Promise((resolve) => {
      this.hooks.unlock();
      const el = this.$('priority');
      el.innerHTML = `<div class="pr-head"><div class="s">${esc(cfg.chapterName)}</div><div class="t">${esc(cfg.question || 'What matters today?')}</div><div class="s" style="color:#cfc6d8;font-size:20px;margin-top:6px">Choose two. The third will be neglected.</div></div>
        <div class="pr-cards">${['create', 'bond', 'duty'].map((k) => `
          <div class="pr-card ${k}" data-k="${k}">
            <div class="ic">${PR[k].icon}</div><div class="nm">${PR[k].name}</div>
            <div class="ds">${esc(cfg[k].label)}</div>
            <div class="wh">${esc(cfg[k].whisper || '')}</div>
          </div>`).join('')}</div>
        <button class="btn pr-go" disabled>Live it</button>
        <div class="pr-note">1 / 2 / 3 to toggle · Enter to confirm</div>`;
      el.classList.remove('hidden');
      const sel = [];
      const cards = [...el.querySelectorAll('.pr-card')];
      const go = el.querySelector('.pr-go');
      const refresh = () => {
        cards.forEach((c) => { c.classList.toggle('on', sel.includes(c.dataset.k)); c.classList.toggle('off', sel.length === 2 && !sel.includes(c.dataset.k)); });
        go.disabled = sel.length !== 2;
      };
      const toggle = (k) => {
        const i = sel.indexOf(k);
        if (i >= 0) { sel.splice(i, 1); audio.play('unchoose'); }
        else { if (sel.length === 2) sel.shift(); sel.push(k); audio.play('choose'); }
        refresh();
      };
      cards.forEach((c) => { c.addEventListener('click', () => toggle(c.dataset.k)); c.addEventListener('mouseenter', () => audio.play('hover')); });
      const done = () => {
        if (sel.length !== 2) return;
        window.removeEventListener('keydown', key);
        el.classList.add('hidden');
        audio.play('chime');
        this.hooks.relock();
        resolve([...sel]);
      };
      go.addEventListener('click', done);
      const key = (e) => {
        if (e.code === 'Digit1') toggle('create'); if (e.code === 'Digit2') toggle('bond'); if (e.code === 'Digit3') toggle('duty');
        if (e.code === 'Enter') done();
      };
      window.addEventListener('keydown', key);
    });
  }

  // ------------------------------------------------------------ menus
  menu(html, cls = '') {
    const m = this.$('menu');
    m.className = 'overlay ' + cls;
    m.innerHTML = html;
    m.classList.remove('hidden');
    const btns = [...m.querySelectorAll('.btn')];
    btns.forEach((b) => b.addEventListener('mouseenter', () => audio.play('hover')));
    this._menuBtns = btns.filter((b) => !b.disabled);
    this._menuSel = -1;
    return m;
  }
  hideMenu() { this.$('menu').classList.add('hidden'); this._menuBtns = null; }
  menuOpen() { return !this.$('menu').classList.contains('hidden'); }
  menuNav() {
    if (!this._menuBtns || !this._menuBtns.length) return;
    const n = this._menuBtns.length;
    let moved = false;
    if (input.code('ArrowDown') || input.code('pad:down')) { this._menuSel = (this._menuSel + 1) % n; moved = true; }
    if (input.code('ArrowUp') || input.code('pad:up')) { this._menuSel = (this._menuSel + n - 1) % n; moved = true; }
    if (moved) { this._menuBtns.forEach((b, i) => b.classList.toggle('sel', i === this._menuSel)); audio.play('hover'); }
    if ((input.code('Enter') || input.code('pad:interact')) && this._menuSel >= 0) this._menuBtns[this._menuSel].click();
  }

  title({ hasSave, endings, onContinue, onNew, onSettings, onControls, onEndings }) {
    const m = this.menu(`
      <div class="title-wrap">
        <h1 class="logo">Starving Artist<small>A MEMORY IN SEVEN CANVASES</small></h1>
        <div class="title-menu">
          <button class="btn" id="m-cont" ${hasSave ? '' : 'disabled'}>Continue</button>
          <button class="btn" id="m-new">New Memory</button>
          <button class="btn" id="m-set">Settings</button>
          <button class="btn" id="m-ctl">Controls</button>
          <button class="btn" id="m-end">Endings  ${endings}/4</button>
        </div>
      </div>
      <div class="footnote">headphones recommended · best played in one sitting (~60 min)</div>`, 'title-bg');
    m.querySelector('#m-cont').onclick = () => { audio.play('click'); onContinue(); };
    m.querySelector('#m-new').onclick = () => { audio.play('click'); onNew(); };
    m.querySelector('#m-set').onclick = () => { audio.play('click'); onSettings(); };
    m.querySelector('#m-ctl').onclick = () => { audio.play('click'); onControls(); };
    m.querySelector('#m-end').onclick = () => { audio.play('click'); onEndings(); };
  }

  confirm(text, yes = 'Yes', no = 'No') {
    return new Promise((res) => {
      const m = this.menu(`<div class="panel"><p>${esc(text)}</p><button class="btn" id="c-y">${esc(yes)}</button><button class="btn" id="c-n">${esc(no)}</button></div>`);
      m.querySelector('#c-y').onclick = () => { audio.play('click'); res(true); };
      m.querySelector('#c-n').onclick = () => { audio.play('back'); res(false); };
    });
  }

  contentNote() {
    return new Promise((res) => {
      const m = this.menu(`<div class="panel" style="max-width:640px">
        <h2>Before you remember</h2>
        <p><i>Starving Artist</i> is a psychological horror game about a young woman slowly abandoning herself.</p>
        <p style="color:#f6c7d8">It contains depictions of self-neglect, disordered eating, illness, isolation, a stalking presence, a disappearance, flashing and glitch effects, and sudden loud sounds.</p>
        <p>You can reduce flashing, change text size and adjust audio at any time from <b>Settings</b>.</p>
        <p>Your choices are permanent. The game saves each time you return from a memory.</p>
        <button class="btn" id="c-ok">I understand</button></div>`);
      m.querySelector('#c-ok').onclick = () => { audio.play('click'); res(); };
    });
  }

  settingsPanel(onBack) {
    const s = this.settings;
    const rows = [
      ['AUDIO'], ['master', 'Master volume', 'range', 0, 1, 0.05], ['music', 'Music', 'range', 0, 1, 0.05], ['sfx', 'Sound effects', 'range', 0, 1, 0.05], ['blips', 'Dialogue voice blips', 'bool'],
      ['CONTROLS'], ['sens', 'Mouse / stick sensitivity', 'range', 0.2, 3, 0.05], ['invertY', 'Invert look', 'bool'], ['fov', 'Field of view', 'range', 55, 100, 1], ['headBob', 'Head bob', 'bool'],
      ['PICTURE'], ['res', 'Resolution', 'select', [[200, '200p (crunchy)'], [240, '240p (PS1)'], [360, '360p'], [480, '480p (clean)']]],
      ['dither', 'Dithering', 'bool'], ['snap', 'Vertex wobble (jitter)', 'bool'], ['affine', 'Texture warping', 'bool'], ['crt', 'CRT lines', 'bool'], ['grain', 'Film grain', 'bool'],
      ['ACCESSIBILITY'], ['reduceFlash', 'Reduce flashing & glitches', 'bool'], ['hints', 'Objective hints', 'bool'], ['textSize', 'Text size', 'range', 0.8, 1.5, 0.05], ['textSpeed', 'Text speed', 'range', 0.5, 3, 0.1],
    ];
    const html = rows.map((r) => {
      if (r.length === 1) return `<div class="section">${r[0]}</div>`;
      const [k, label, type, a, b, st] = r;
      if (type === 'range') return `<div class="row"><label>${label}</label><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${s[k]}"></div>`;
      if (type === 'bool') return `<div class="row"><label>${label}</label><button class="toggle ${s[k] ? 'on' : ''}" data-k="${k}">${s[k] ? 'ON' : 'OFF'}</button></div>`;
      if (type === 'select') return `<div class="row"><label>${label}</label><select data-k="${k}">${a.map(([v, t]) => `<option value="${v}" ${+s[k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
      return '';
    }).join('');
    const m = this.menu(`<div class="panel" style="min-width:520px"><h2>Settings</h2>${html}<button class="btn" id="s-back" style="margin-top:16px">Back</button></div>`);
    m.querySelectorAll('input[type=range]').forEach((el) => el.addEventListener('input', () => { s[el.dataset.k] = +el.value; this.hooks.onSettings(); }));
    m.querySelectorAll('select').forEach((el) => el.addEventListener('change', () => { s[el.dataset.k] = +el.value; this.hooks.onSettings(); }));
    m.querySelectorAll('.toggle').forEach((el) => el.addEventListener('click', () => { s[el.dataset.k] = !s[el.dataset.k]; el.classList.toggle('on', s[el.dataset.k]); el.textContent = s[el.dataset.k] ? 'ON' : 'OFF'; audio.play('click'); this.hooks.onSettings(); }));
    m.querySelector('#s-back').onclick = () => { audio.play('back'); onBack(); };
  }

  controlsPanel(onBack) {
    const m = this.menu(`<div class="panel"><h2>Controls</h2><div class="keys">
      <b>W A S D</b><span>walk (arrows also work)</span>
      <b>Mouse</b><span>look (click the screen to capture the mouse)</span>
      <b>Shift</b><span>run — you tire quickly</span>
      <b>E / Space / Click</b><span>interact · advance dialogue</span>
      <b>1 2 3</b><span>pick dialogue choices / priorities</span>
      <b>Tab / J</b><span>journal of memories</span>
      <b>Esc / P</b><span>pause</span>
      <b>Painting</b><span>drag ideas · scroll to resize · F flip · right-click remove · Ctrl+Z undo</span>
      <b>Gamepad</b><span>left stick move · right stick look · A interact · Start pause · Select journal</span>
      </div><button class="btn" id="k-back" style="margin-top:16px">Back</button></div>`);
    m.querySelector('#k-back').onclick = () => { audio.play('back'); onBack(); };
  }

  endingsPanel(found, onBack) {
    const all = [['good', 'Natalee'], ['gone', 'Gone'], ['bad', 'Cult Following'], ['boring', 'Boring']];
    const m = this.menu(`<div class="panel"><h2>Endings</h2>${all.map(([k, n]) => `<p>${found.includes(k) ? '◆ ' + n : '◇ ???'}</p>`).join('')}
      <p style="font-size:18px;color:#aaa">Every playthrough is permanent. A different life needs another playthrough.</p>
      <button class="btn" id="e-back">Back</button></div>`);
    m.querySelector('#e-back').onclick = () => { audio.play('back'); onBack(); };
  }

  pause({ onResume, onJournal, onSettings, onControls, onQuit }) {
    const m = this.menu(`<div class="panel"><h2>Paused</h2>
      <button class="btn" id="p-res">Resume</button><button class="btn" id="p-jou">Journal</button>
      <button class="btn" id="p-set">Settings</button><button class="btn" id="p-ctl">Controls</button>
      <button class="btn" id="p-quit">Quit to title</button>
      <p style="font-size:18px;color:#aaa;margin-bottom:0">Progress is saved each time you return from a memory.</p></div>`);
    m.querySelector('#p-res').onclick = () => { audio.play('click'); onResume(); };
    m.querySelector('#p-jou').onclick = () => { audio.play('click'); onJournal(); };
    m.querySelector('#p-set').onclick = () => { audio.play('click'); onSettings(); };
    m.querySelector('#p-ctl').onclick = () => { audio.play('click'); onControls(); };
    m.querySelector('#p-quit').onclick = () => { audio.play('click'); onQuit(); };
  }

  journal(state, chapters, onBack) {
    const entries = state.records.map((r, i) => {
      const ch = chapters[i];
      return `<div class="j-entry"><canvas data-i="${i}" width="192" height="144"></canvas><div>
        <h3>${esc(ch.title)} <span style="font-size:18px;color:#aaa">· age ${ch.age}</span></h3>
        <div class="tags">${r.picked.map((p) => `<span class="tag ${p}">${PR[p].name}</span>`).join('')}<span class="tag neg">${PR[r.neglected].name}</span></div>
        <div class="note">${(r.notes || []).map(esc).join(' ')}</div>
        ${r.comp && !r.comp.blank ? `<div class="note" style="color:#f6c7d8">“${esc(r.comp.title)}”</div>` : ''}
      </div></div>`;
    }).join('') || '<p>No memories yet. Find a blank canvas.</p>';
    const m = this.menu(`<div class="panel journal"><h2>Nate's Journal</h2>${entries}<button class="btn" id="j-back" style="margin-top:14px">Back</button></div>`);
    m.querySelectorAll('canvas').forEach((c) => { const r = state.records[+c.dataset.i]; renderComposition(c, r.comp || { blank: true, seed: +c.dataset.i + 1 }); });
    m.querySelector('#j-back').onclick = () => { audio.play('back'); onBack(); };
  }

  // ------------------------------------------------------------ endings
  async endingText(lines, name, { hold = 3000, light = false } = {}) {
    const e = this.$('ending');
    e.classList.toggle('light', light);
    e.innerHTML = '<div class="e-line"></div><div class="e-name"></div>';
    e.classList.remove('hidden');
    const el = e.querySelector('.e-line');
    for (let i = 0; i < lines.length; i++) {
      el.textContent = lines[i];
      await wait(300); el.classList.add('on');
      await wait(Math.max(2800, lines[i].length * 62 / this.settings.textSpeed));
      if (i < lines.length - 1) { el.classList.remove('on'); await wait(1900); }
    }
    if (name) { await wait(700); const n = e.querySelector('.e-name'); n.textContent = name; n.classList.add('on'); }
    await wait(hold);
  }
  credits({ stats, comps, endingName }) {
    return new Promise((res) => {
      const e = this.$('ending');
      e.classList.remove('light');
      e.innerHTML = `<div class="panel" style="text-align:center;max-width:900px">
        <div class="section">ENDING</div><h2>${esc(endingName)}</h2>
        <div class="gallery">${comps.map((c, i) => `<figure><canvas data-i="${i}" width="192" height="144"></canvas><figcaption>${esc(c && !c.blank ? c.title : 'unfinished')}</figcaption></figure>`).join('')}</div>
        <div class="cred-stats">${stats}</div>
        <p style="font-family:var(--serif);font-style:italic;color:#ddd">A meaningful life does not require fame, or greatness.<br>Thank you for remembering her.</p>
        <p style="font-size:18px;color:#999">STARVING ARTIST · a PS1-style psychological horror · made with three.js, WebAudio and canvas — no pre-made assets</p>
        <button class="btn" id="cr-done" style="text-align:center">Return to title</button></div>`;
      e.classList.remove('hidden');
      e.querySelectorAll('canvas').forEach((c) => renderComposition(c, comps[+c.dataset.i] || { blank: true, seed: 5 }));
      e.querySelector('#cr-done').onclick = () => { audio.play('click'); e.classList.add('hidden'); res(); };
    });
  }
  hideEnding() { this.$('ending').classList.add('hidden'); }
}

export function thumb(comp) { const c = newPaintCanvas(); renderComposition(c, comp); return c; }
