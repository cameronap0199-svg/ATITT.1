// Menus: title, pause, settings (with remapping), Heartline status, how to play,
// game over and the ending.

import { G } from '../state.js';
import { TITLE, SUBTITLE, FLOOR_NAMES, heartsFor } from '../config.js';
import { SETTINGS_SPEC, ACTIONS, PAD_NAMES, saveSettings, resetSettings, DEFAULT_KEYS, DEFAULT_PAD } from '../core/settings.js';
import { codeLabel } from '../core/input.js';
import { CALLERS, DK_STATS, drawPortrait } from '../phone/callers.js';
import { CALLER_KEYS } from '../phone/heartline.js';
import { loadProfile, saveProfile } from '../run.js';
import { fmtMoney } from '../core/math.js';
import { ITEMS } from '../items.js';
import { compendiumPanel } from './compendium.js';

// Give list-like children a sibling index so CSS can stagger their entrance.
const STAGGER = '.menu > .btn, .row > .btn, .set, .inv-i, .stats > div, .hl-card, .comp-card, .tabs > .tab, .cols > div > *, .crawl p, .hl-end > span, .meta, .foot';
function stagger(root) {
  root.querySelectorAll(STAGGER).forEach((e) => e.style.setProperty('--i', Math.min(24, [...e.parentElement.children].indexOf(e))));
}
// Count numbers up from zero (game over / victory stats).
function countUp(root) {
  root.querySelectorAll('.stats b').forEach((b, i) => {
    const m = b.textContent.match(/^(\$?)([\d,]+)(.*)$/);
    if (!m) return;
    const target = +m[2].replace(/,/g, '');
    if (!target) return;
    const t0 = performance.now() + 250 + i * 70, dur = 700;
    const tick = (now) => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      b.textContent = m[1] + Math.round(target * (1 - (1 - k) ** 3)).toLocaleString('en-US') + m[3];
      if (k < 1) requestAnimationFrame(tick); else b.classList.add('done');
    };
    b.textContent = m[1] + '0' + m[3];
    requestAnimationFrame(tick);
  });
}
function letters(text) { return [...text].map((c, i) => c === ' ' ? ' ' : `<span style="--i:${i}">${c.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))}</span>`).join(''); }

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Screens {
  constructor(root, hooks) {
    this.root = root;
    this.hooks = hooks;   // { startRun, resume, quitToTitle, applySettings }
    this.stack = [];
    root.addEventListener('keydown', (e) => e.stopPropagation());
  }

  clear() { this.root.innerHTML = ''; this.stack = []; this.root.classList.remove('on'); }
  open(node) {
    this.root.innerHTML = '';
    this.root.appendChild(node);
    this.root.classList.add('on');
    node.classList.add('enter');
    stagger(node);
    const first = node.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }
  button(text, fn, cls = '') {
    const b = el('button', 'btn ' + cls, text);
    b.addEventListener('click', () => { G.audio.sfx('uiOk'); fn(); });
    b.addEventListener('mouseenter', () => G.audio.sfx('ui', { v: 0.5 }));
    return b;
  }

  // ---------------------------------------------------------------------------
  warning(then) {
    const n = el('div', 'panel warn');
    n.innerHTML = `<h2>⚠ Photosensitivity warning</h2>
      <p>This game contains flashing lights, strobing stage effects and fast-moving patterns. If you are sensitive to flashing lights, turn on <b>Reduce flashing</b> now (you can change it any time in Settings).</p>`;
    const row = el('div', 'row');
    row.appendChild(this.button('Continue', () => { G.settings.seenWarning = true; saveSettings(G.settings); then(); }, 'primary'));
    row.appendChild(this.button('Reduce flashing & continue', () => { G.settings.seenWarning = true; G.settings.reduceFlashing = true; saveSettings(G.settings); this.hooks.applySettings(); then(); }));
    n.appendChild(row);
    this.open(n);
  }

  title() {
    G.mode = 'title';
    const p = loadProfile();
    const n = el('div', 'titlescreen');
    n.innerHTML = `
      <div class="logo">
        <div class="logo-a">${letters(TITLE)}</div>
        <div class="logo-b">${esc(SUBTITLE)}</div>
        <div class="logo-c">A 3D comedy roguelike bullet hell · Parking lot → Venue → Stage</div>
      </div>
      <div class="menu"></div>
      <div class="meta">Runs ${p.runs} · Clears ${p.wins} · Best floor ${p.bestFloor || '—'}${p.bestLoop ? ' · Best ∞ loop ' + p.bestLoop : ''}</div>
      <div class="foot">Keyboard + mouse or controller. Everything is procedural — no art files were harmed.</div>`;
    const m = n.querySelector('.menu');
    m.appendChild(this.button('▶ START RUN', () => this.hooks.startRun(), 'primary big'));
    m.appendChild(this.button('∞ INFINITE MODE', () => this.hooks.startRun({ infinite: true }), 'infinite'));
    m.appendChild(this.button('♥ HEARTLINE', () => this.heartline(() => this.title())));
    m.appendChild(this.button('📖 COMPENDIUM', () => this.compendium(() => this.title())));
    m.appendChild(this.button('⚙ SETTINGS', () => this.settings(() => this.title())));
    m.appendChild(this.button('? HOW TO PLAY', () => this.howTo(() => this.title())));
    this.open(n);
    G.audio.playMusic('title');
  }

  pause() {
    const n = el('div', 'panel pause');
    n.innerHTML = `<h2>PAUSED</h2><p class="sub">${G.run.infinite ? `∞ Loop ${G.run.loop + 1} · ` : ''}Floor ${G.run.floor} · ${esc(FLOOR_NAMES[G.run.floor - 1])} · ${fmtMoney(G.run.money)}</p>`;
    const m = el('div', 'menu');
    m.appendChild(this.button('Resume', () => this.hooks.resume(), 'primary'));
    m.appendChild(this.button('Settings', () => this.settings(() => this.pause())));
    m.appendChild(this.button('Heartline', () => this.heartline(() => this.pause())));
    m.appendChild(this.button('Compendium', () => this.compendium(() => this.pause())));
    m.appendChild(this.button('How to play', () => this.howTo(() => this.pause())));
    m.appendChild(this.button('Abandon run', () => this.hooks.quitToTitle(), 'danger'));
    n.appendChild(m);
    n.appendChild(this.itemList());
    this.open(n);
  }

  itemList() {
    const run = G.run;
    const d = el('div', 'inv');
    if (!run) return d;
    const counts = {};
    for (const id of run.items) counts[id] = (counts[id] || 0) + 1;
    d.innerHTML = '<h3>Items</h3>' + (Object.keys(counts).length ? Object.entries(counts).map(([id, c]) => `<div class="inv-i"><span>${ITEMS[id]?.icon || '?'}</span><b>${esc(ITEMS[id]?.name || id)}${c > 1 ? ' ×' + c : ''}</b><small>${esc(ITEMS[id]?.desc || '')}</small></div>`).join('') : '<p class="sub">Nothing yet. The Gas Station is open 24/7.</p>');
    return d;
  }

  // ---------------------------------------------------------------------------
  settings(back) {
    const S = G.settings;
    const n = el('div', 'panel settings');
    n.innerHTML = '<h2>SETTINGS</h2>';
    const tabs = el('div', 'tabs');
    const body = el('div', 'tabbody');
    const groups = [...SETTINGS_SPEC.map(([g]) => g), 'Keyboard', 'Controller'];
    const show = (gname) => {
      [...tabs.children].forEach((t) => t.classList.toggle('on', t.textContent === gname));
      body.innerHTML = '';
      body.classList.remove('tabin'); void body.offsetWidth; body.classList.add('tabin');
      requestAnimationFrame(() => stagger(body));
      if (gname === 'Keyboard' || gname === 'Controller') { body.appendChild(this.remap(gname === 'Keyboard')); return; }
      const [, items] = SETTINGS_SPEC.find(([g]) => g === gname);
      for (const [key, label, type, o] of items) {
        const row = el('label', 'set');
        row.appendChild(el('span', 'lab', esc(label)));
        let input;
        if (type === 'toggle') {
          input = el('input'); input.type = 'checkbox'; input.checked = !!S[key];
          input.addEventListener('change', () => { S[key] = input.checked; this.commit(); });
        } else if (type === 'select') {
          input = el('select');
          for (const [v, t] of o.options) { const op = el('option', null, esc(t)); op.value = v; if (S[key] === v) op.selected = true; input.appendChild(op); }
          input.addEventListener('change', () => { S[key] = input.value; this.commit(); });
        } else {
          const wrap = el('span', 'rangewrap');
          input = el('input'); input.type = 'range'; input.min = o.min; input.max = o.max; input.step = o.step; input.value = S[key];
          const out = el('output', null, (o.fmt || ((x) => (+x).toFixed(2)))(+S[key]));
          input.addEventListener('input', () => { S[key] = +input.value; out.textContent = (o.fmt || ((x) => (+x).toFixed(2)))(+input.value); this.commit(); });
          wrap.appendChild(input); wrap.appendChild(out);
          row.appendChild(wrap);
          body.appendChild(row);
          continue;
        }
        row.appendChild(input);
        body.appendChild(row);
      }
    };
    for (const gname of groups) { const t = el('button', 'tab', gname); t.addEventListener('click', () => show(gname)); tabs.appendChild(t); }
    n.appendChild(tabs);
    n.appendChild(body);
    const row = el('div', 'row');
    row.appendChild(this.button('Back', back, 'primary'));
    row.appendChild(this.button('Reset to defaults', () => { resetSettings(S); this.commit(); this.settings(back); }));
    n.appendChild(row);
    this.open(n);
    show(groups[0]);
  }
  commit() { saveSettings(G.settings); this.hooks.applySettings(); }

  remap(keyboard) {
    const S = G.settings;
    const box = el('div', 'remap');
    box.appendChild(el('p', 'sub', keyboard ? 'Click a binding, then press a key or mouse button. Esc cancels.' : 'Click a binding, then press a controller button. (Standard gamepad layout.)'));
    for (const [a, label] of Object.entries(ACTIONS)) {
      if (!keyboard && ['up', 'down', 'left', 'right'].includes(a)) continue;
      const row = el('div', 'set');
      row.appendChild(el('span', 'lab', esc(label)));
      const list = keyboard ? S.keys[a] || [] : S.pad[a] || [];
      const b = el('button', 'bind', list.length ? list.map((c) => keyboard ? codeLabel(c) : PAD_NAMES[c] || 'B' + c).join(' / ') : '—');
      b.addEventListener('click', () => {
        b.textContent = keyboard ? 'press a key…' : 'press a button…';
        if (keyboard) {
          G.input.bindCapture = (code) => {
            if (code !== 'Escape') { S.keys[a] = [code, ...(S.keys[a] || []).filter((c) => c !== code)].slice(0, 2); for (const [o, l] of Object.entries(S.keys)) if (o !== a && l.includes(code)) S.keys[o] = l.filter((c) => c !== code); }
            this.commit();
            box.replaceWith(this.remap(true));
          };
        } else {
          const t0 = performance.now();
          const poll = () => {
            const p = [...(navigator.getGamepads?.() || [])].find((x) => x && x.connected);
            const idx = p ? p.buttons.findIndex((x) => x.pressed) : -1;
            if (idx >= 0 && performance.now() - t0 > 200) { S.pad[a] = [idx]; for (const [o, l] of Object.entries(S.pad)) if (o !== a && l.includes(idx)) S.pad[o] = l.filter((c) => c !== idx); this.commit(); box.replaceWith(this.remap(false)); return; }
            if (performance.now() - t0 < 6000) requestAnimationFrame(poll); else box.replaceWith(this.remap(false));
          };
          poll();
        }
      });
      row.appendChild(b);
      box.appendChild(row);
    }
    const r = this.button('Reset bindings', () => { if (keyboard) S.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); else S.pad = JSON.parse(JSON.stringify(DEFAULT_PAD)); this.commit(); box.replaceWith(this.remap(keyboard)); });
    box.appendChild(r);
    return box;
  }

  // ---------------------------------------------------------------------------
  heartline(back) {
    const H = G.phone;
    const n = el('div', 'panel heartline');
    n.innerHTML = `<h2>♥ HEARTLINE</h2><p class="sub">Relationships persist between runs. Agree, Provoke and Deflect mean different things to different people.</p>`;
    const grid = el('div', 'hl-grid');
    for (const k of CALLER_KEYS) {
      const c = el('div', 'hl-card');
      c.style.setProperty('--caller', CALLERS[k].color);
      const cv = el('canvas'); cv.width = cv.height = 120;
      drawPortrait(k, cv.getContext('2d'), 120);
      c.appendChild(cv);
      const h = heartsFor(H.score(k));
      const hint = {
        gf: 'Asks for money. The requests get bigger. At high hearts she sometimes sends gifts.',
        ugly: 'Fewer hearts → higher UGLY KITCHEN COOK-OFF chance.',
        cat: 'Hearts: fully functional.',
        mario: 'Fewer hearts → BABY MARIO NIGHTMARE chance.',
        demonKing: 'Obsesses over one of your statistics each run. Your relationship changes his boss fight.',
        jesus: 'Low relationship → Bible Check.',
      }[k];
      c.appendChild(el('div', 'hl-info', `<b>${esc(CALLERS[k].name)}</b><div class="hl-hearts">${h ? '❤️'.repeat(h) + '🤍'.repeat(5 - h) : '💔'}</div><small>${esc(hint)}</small><small class="dim">Calls answered: ${H.data.life.calls[k] || 0}</small>`));
      grid.appendChild(c);
    }
    n.appendChild(grid);
    n.appendChild(el('p', 'sub', `Lifetime: ${H.data.life.answered} calls answered · ${H.data.life.declined} declined · Bible Checks ${H.data.life.bibleRight}✓ ${H.data.life.bibleWrong}✗`));
    const row = el('div', 'row');
    row.appendChild(this.button('Back', back, 'primary'));
    row.appendChild(this.button('Reset all relationships', () => { if (confirm('Reset every relationship to neutral?')) { H.resetAll(); this.heartline(back); } }, 'danger'));
    n.appendChild(row);
    this.open(n);
  }

  compendium(back) { this.open(compendiumPanel(back, (t, fn, cls) => this.button(t, fn, cls))); }

  howTo(back) {
    const I = G.input;
    const k = (a) => `<b class="key">${I.glyph(a)}</b>`;
    const n = el('div', 'panel howto');
    n.innerHTML = `<h2>HOW TO PLAY</h2>
      <div class="cols">
      <div>
        <h3>Flow Movement</h3>
        <p>${k('up')}${k('left')}${k('down')}${k('right')} run (keep running to break into an anime sprint) · mouse / right stick: camera</p>
        <p>${k('jump')} jump — tap for a hop, hold for full height. Coyote time and jump buffering are on.</p>
        <p>Jump + forward near waist/chest-high cover (cars, barriers, seats, tables) to <b>vault</b>. Jump into a wall mid-air to <b>wall kick</b> (once per airtime).</p>
        <p>${k('dash')} <b>dash</b>: 2 charges, i-frames, cancels almost anything. One air dash per jump. Dash <i>through</i> an attack at the last moment for a <b>PERFECT DODGE</b> — slow-mo and a stronger counterattack.</p>
        <p>Falls: small = keep running, medium = crouch (any input cancels), huge = superhero landing (shockwave!).</p>
        <h3>Combat</h3>
        <p>${k('melee')} melee combo (3 hits) · dash → melee = dash slash · hold ${k('melee')} (or pull back + ${k('melee')}) = <b>launcher</b>, then jump to follow · melee in the air for aerials.</p>
        <p>${k('ranged')} shoot (hold). Aim with the camera; aim assist bends shots toward what you're pointing at.</p>
        <p><b>Combat Focus</b>: look at an enemy and attack — Alex keeps them in mind. ${k('lock')} hard focus, ${k('targetPrev')}/${k('targetNext')} or a stick/mouse flick switches.</p>
      </div>
      <div>
        <h3>The Run</h3>
        <p>Parking Lot → Venue → Backstage → the Main Stage. Clear rooms (doors lock during fights), find the boss, go deeper.</p>
        <p>Demons drop money. Spend it at the <b>Gas Station</b> (sometimes there's one per floor): healing, snacks, weapons in the locked case, big upgrades on the back wall, and lottery tickets.</p>
        <p>Off-screen attacks show an edge indicator: <span class="tag prep">dim</span> preparing → <span class="tag soon">bright</span> imminent → <span class="tag now">flash</span> NOW.</p>
        <h3>♥ Heartline</h3>
        <p>Your phone rings mid-fight. Nothing pauses. ${k('phone1')} accept · ${k('phone2')} decline. Then ${k('phone1')} AGREE · ${k('phone2')} PROVOKE · ${k('phone3')} DEFLECT.</p>
        <p>Six callers, six personalities. Relationships persist between runs and have consequences. Mostly.</p>
        <h3>Rifts, gadgets &amp; rides</h3>
        <p>Some fights tear open a <b>rift</b> to Halo, Minecraft, One Piece, Pokémon or the Bible. Close it for loot: weapons, items, and a <b>gadget</b> — ${k('gadget')} throws grenades, drops TNT, pearls you across the room, parts the sea, or <b>catches a weakened demon</b> as a companion.</p>
        <p>${k('ride')} or ${k('interact')} hops into a <b>vehicle</b>: steer with the stick, ${k('dash')} boost, ${k('ranged')} vehicle weapon, ${k('jump')} horn / hop. Rides plough straight through cars, crates and anything else that isn't a wall, and follow you through doors.</p>
        <p>Elite demons wear titles (Swift, Armored, Shiny…) and pay better. Gas Station scratchers are real: drag to scratch.</p>
        <h3>⛏ Minecraft</h3>
        <p>Everything drops materials: demons, mobs, Pokémon, smashed props, trees and ore veins (hit them). ${k('pack')} opens the <b>Pack</b>: 2×2 crafting anywhere, the full 3×3 grid next to a <b>Crafting Table</b> (4 planks — place it from the Pack), a recipe book that fills the grid, the Furnace and the Enchanting Table. Better pickaxes mine better ores; obsidian needs diamond.</p>
        <p>10 obsidian + Flint and Steel = a <b>Nether Portal</b>. Blazes in the fortress drop rods; rods + ender pearls make <b>Eyes of Ender</b>. Throw one: it flies toward the hidden <b>stronghold</b>. Fill the End Portal frame and go fight the <b>Ender Dragon</b> (shoot the crystals first).</p>
        <h3>◓ Pokémon</h3>
        <p>Professor Oakley waits in the first parking lot with three starters. Walk through <b>tall grass</b> for wild battles (FIGHT / BAG / POKéMON / RUN — catch them with Poké Balls). Trainers spot you and challenge you. Pokémon level up from battles <i>and</i> from every demon you defeat, learn moves, and evolve. Up to six in your party, the rest in Bill's PC. Your lead Pokémon follows you and fights with its moves. Pokémon Center and Poké Mart: at the Gas Station.</p>
        <h3>∞ Infinite Mode</h3>
        <p>From the title menu: beat the Demon King and the show starts over from the parking lot, harder each loop. Your Pokémon, materials and gear come with you.</p>
        <h3>Tips</h3>
        <p>Hold ${k('map')} for the full map. ${k('interact')} buys / takes / uses. Photosensitivity, reduced UI motion, camera assist, aim assist, projectile contrast and more are in Settings. The Compendium tracks every creature you meet.</p>
      </div></div>`;
    const row = el('div', 'row');
    row.appendChild(this.button('Back', back, 'primary'));
    n.appendChild(row);
    this.open(n);
  }

  // ---------------------------------------------------------------------------
  statsHtml() {
    const r = G.run, s = r.stats;
    const t = Math.round(s.time || 0);
    const rows = [
      ['Floor reached', r.infinite ? `Loop ${r.loop + 1} · F${r.floor}` : r.floor], ['Time', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')], ['Demons defeated', Math.round(s.kills || 0)],
      ['Money collected', fmtMoney(s.moneyCollected || 0)], ['Sent to Girlfriend', fmtMoney(s.moneyToGirlfriend || 0)], ['Perfect dodges', s.perfectDodges || 0],
      ['Rooms cleared', s.roomsCleared || 0], ['Calls answered / declined', `${s.callsAnswered || 0} / ${s.callsDeclined || 0}`], ['Accuracy', r.statValue('accuracy') + '%'],
      ['Items purchased', s.itemsPurchased || 0], ['Lottery tickets', s.lotteryTickets || 0], ['Props destroyed', s.propsDestroyed || 0],
      ['Rifts closed', s.riftsOpened || 0], ['Demons caught', s.caught || 0], ['Vehicles ridden', s.vehiclesRidden || 0], ['Blocks mined', s.blocksMined || 0],
      ['Things crafted', s.crafted || 0], ['Pokémon caught', s.pkCaught || 0], ['Pokémon levels gained', s.pkLevels || 0], ['Evolutions', s.evolutions || 0],
      ['Trainer battles', s.pkTrainerBattles || 0], ['Nether trips', s.netherVisits || 0], ['Ender Dragons slain', s.dragonsSlain || 0], ['Props rammed', s.propsRammed || 0],
    ];
    return '<div class="stats">' + rows.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(String(b))}</b></div>`).join('') + '</div>';
  }

  gameOver() {
    G.mode = 'gameover';
    G.phone.reset();
    G.input.releaseLock();
    G.audio.playMusic('gameover');
    const r = G.run;
    const dk = DK_STATS[r.dkStat];
    const n = el('div', 'panel over');
    n.innerHTML = `<h1 class="bad">ALEX HAS FALLEN</h1>
      <p class="quote"><b>THE K-POP DEMON KING:</b> "${esc(dk.line(r.statValue(r.dkStat)))} ...And now you have died. I will be adding that to the statistic."</p>
      ${this.statsHtml()}`;
    const row = el('div', 'row');
    row.appendChild(this.button('Try again', () => this.hooks.startRun({ infinite: r.infinite }), 'primary'));
    row.appendChild(this.button('Title', () => this.hooks.quitToTitle()));
    n.appendChild(row);
    this.open(n);
    countUp(n);
  }

  victory() {
    G.mode = 'victory';
    G.phone.reset();
    G.input.releaseLock();
    G.audio.playMusic('victory', { restart: true });
    const p = loadProfile();
    p.wins++;
    saveProfile(p);
    const H = G.phone;
    const n = el('div', 'panel victory');
    const hearts = CALLER_KEYS.map((k) => `<span style="--caller:${CALLERS[k].color}"><b>${esc(CALLERS[k].name)}</b> ${heartsFor(H.score(k)) ? '❤️'.repeat(heartsFor(H.score(k))) : '💔'}</span>`).join('');
    n.innerHTML = `<h1>THE SHOW IS OVER</h1>
      <div class="crawl">
        <p>The K-Pop Demon King collapses in a shower of confetti and pyrotechnics.</p>
        <p>Thirty thousand fans scream. From where they are standing, this was an unbelievably elaborate part of the show.</p>
        <p>Somewhere, a gas station cashier does not look up.</p>
        <p>Alex's phone buzzes. It is a text from Cameron's Cat. It says: <b>"."</b></p>
        <p>It means nothing. It has always meant nothing.</p>
      </div>
      <div class="hl-end">${hearts}</div>
      ${this.statsHtml()}`;
    const row = el('div', 'row');
    row.appendChild(this.button('Another run', () => this.hooks.startRun(), 'primary'));
    row.appendChild(this.button('Title', () => this.hooks.quitToTitle()));
    n.appendChild(row);
    this.open(n);
    countUp(n);
  }
}
