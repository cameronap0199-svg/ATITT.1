// Restrained HUD: health, money and dash charges are always readable; everything else
// is contextual. Includes off-screen threat indicators (direction + timing), boss bar,
// beat bar, minimap, reticle, damage numbers, speech bubbles and interaction prompts.

import * as THREE from 'three';
import { G } from '../state.js';
import { fmtMoney, clamp } from '../core/math.js';
import { itemInfo, ITEMS } from '../items.js';
import { MELEE, RANGED } from '../combat/weapons.js';
import { UNUSUAL_TEXT } from '../shop.js';
import { FLOOR_NAMES } from '../config.js';

const v = new THREE.Vector3();
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-tl">
        <div class="hp"><div class="hp-fill"></div><div class="hp-ghost"></div><span class="hp-txt"></span></div>
        <div class="money"></div>
        <div class="weapons"><span class="w melee"></span><span class="w ranged"></span></div>
        <div class="items"></div>
      </div>
      <div class="hud-top"><div class="where"></div></div>
      <div class="boss"><div class="boss-name"></div><div class="boss-bar"><i></i><b></b></div></div>
      <div class="beatbar"><div class="beat-center"></div></div>
      <canvas class="minimap" width="200" height="200"></canvas>
      <canvas class="bigmap" width="560" height="560"></canvas>
      <div class="reticle"><i></i></div>
      <div class="dashpips"></div>
      <div class="threats"></div>
      <div class="nums"></div>
      <div class="bubbles"></div>
      <div class="popups"></div>
      <div class="prompt"></div>
      <div class="intro"><div class="intro-t"></div><div class="intro-s"></div></div>
      <div class="roomtitle"><div class="rt-a"></div><div class="rt-b"></div></div>
      <div class="scratch"></div>
      <div class="tutorial"></div>
      <div class="fps"></div>
      <div class="lockhint"></div>`;
    const q = (s) => root.querySelector(s);
    this.e = {
      hpFill: q('.hp-fill'), hpGhost: q('.hp-ghost'), hpTxt: q('.hp-txt'), money: q('.money'), melee: q('.w.melee'), ranged: q('.w.ranged'), items: q('.items'),
      where: q('.where'), boss: q('.boss'), bossName: q('.boss-name'), bossFill: q('.boss-bar i'), bossGhost: q('.boss-bar b'), beat: q('.beatbar'),
      mini: q('.minimap'), big: q('.bigmap'), reticle: q('.reticle'), pips: q('.dashpips'), threats: q('.threats'), nums: q('.nums'), bubbles: q('.bubbles'),
      popups: q('.popups'), prompt: q('.prompt'), intro: q('.intro'), introT: q('.intro-t'), introS: q('.intro-s'), rt: q('.roomtitle'), rtA: q('.rt-a'), rtB: q('.rt-b'),
      scratch: q('.scratch'), tutorial: q('.tutorial'), fps: q('.fps'), lockhint: q('.lockhint'),
    };
    this.bubbleList = [];
    this.threatEls = [];
    this.pipEls = [];
    this.ghostHp = 1;
    this.bossGhost = 1;
    this.beatMarks = [];
    this.lastItems = '';
    this.fpsT = 0; this.frames = 0;
    this.visible = false;
    this.pipsFullT = 0;
  }

  show(on) { this.visible = on; this.root.classList.toggle('on', on); }

  // -------------------------------------------------------------------------
  update(dt, realDt) {
    if (!this.visible) return;
    const run = G.run, a = G.alex, e = this.e;
    if (!run || !a) return;
    // HP (ghost bar trails behind damage)
    const f = clamp(a.hp / a.maxHp, 0, 1);
    this.ghostHp = Math.max(f, this.ghostHp - realDt * 0.5);
    e.hpFill.style.width = f * 100 + '%';
    e.hpGhost.style.width = this.ghostHp * 100 + '%';
    e.hpTxt.textContent = Math.ceil(a.hp) + ' / ' + a.maxHp;
    e.hpFill.classList.toggle('low', f < 0.3);
    e.money.textContent = fmtMoney(run.money);
    const mw = MELEE[run.weapons.melee], rw = RANGED[run.weapons.ranged];
    e.melee.innerHTML = `${mw.icon}<small>${esc(mw.name)}</small>`;
    e.ranged.innerHTML = `${rw.icon}<small>${esc(rw.name)}</small>`;
    const itemsKey = run.items.join(',') + '|' + run.buffs.map((b) => b.id + b.roomsLeft).join(',');
    if (itemsKey !== this.lastItems) {
      this.lastItems = itemsKey;
      const counts = {};
      for (const id of run.items) counts[id] = (counts[id] || 0) + 1;
      e.items.innerHTML = Object.entries(counts).map(([id, n]) => `<span class="it" title="${esc(ITEMS[id]?.name || id)}: ${esc(ITEMS[id]?.desc || '')}">${ITEMS[id]?.icon || '?'}${n > 1 ? '<sub>' + n + '</sub>' : ''}</span>`).join('')
        + run.buffs.map((b) => `<span class="it buff" title="${esc(ITEMS[b.id]?.name || b.id)}">${ITEMS[b.id]?.icon || '✦'}<sub>${b.floor ? 'F' : b.roomsLeft}</sub></span>`).join('');
    }
    // reticle + dash pips
    const combat = G.room && G.room.combatLive();
    e.reticle.classList.toggle('on', !!combat || a.aimT > 0);
    e.reticle.classList.toggle('hot', !!(G.targeting.soft || G.targeting.focusEnemy()));
    this._pips(realDt);
    this._threats(realDt);
    this._bubbles(realDt);
    // boss
    if (G.room && G.room.bossInfo && G.room.bossInfo.list.some((x) => x.alive)) {
      const b = G.room.bossInfo.bar();
      const bf = clamp(b.hp / b.max, 0, 1);
      this.bossGhost = Math.max(bf, this.bossGhost - realDt * 0.3);
      e.boss.classList.add('on');
      e.bossName.textContent = b.name;
      e.bossFill.style.width = bf * 100 + '%';
      e.bossGhost.style.width = this.bossGhost * 100 + '%';
    } else e.boss.classList.remove('on');
    if (!(G.room && G.room.bossInfo && G.room.floor === 1 && G.room.bossInfo.list[0].alive)) e.beat.classList.remove('on');
    // minimap
    this.mapT = (this.mapT || 0) - realDt;
    if (this.mapT <= 0) { this.mapT = 0.2; this._minimap(e.mini, 200, 16, false); }
    const big = G.input.isHeld('map');
    e.big.classList.toggle('on', big);
    if (big) this._minimap(e.big, 560, 44, true);
    // fps
    this.frames++; this.fpsT += realDt;
    if (this.fpsT > 0.5) { e.fps.textContent = Math.round(this.frames / this.fpsT) + ' fps'; this.frames = 0; this.fpsT = 0; }
    e.fps.style.display = G.settings.showFps ? 'block' : 'none';
    e.lockhint.style.display = !G.input.pointerLocked && G.input.device === 'kbm' && G.mode === 'run' && !G.touch ? 'block' : 'none';
    e.lockhint.textContent = 'Click the game to capture the mouse';
  }

  _pips(dt) {
    const a = G.alex, max = a.maxCharges();
    while (this.pipEls.length < max) { const p = el('i'); this.e.pips.appendChild(p); this.pipEls.push(p); }
    while (this.pipEls.length > max) this.pipEls.pop().remove();
    const full = a.charges >= max;
    this.pipsFullT = full ? this.pipsFullT + dt : 0;
    const rechargeK = a.rechargeT > 0 ? 1 - a.rechargeT / 1.5 : 0;
    this.pipEls.forEach((p, i) => {
      p.className = i < a.charges ? 'full' : i === a.charges ? 'fill' : '';
      p.style.setProperty('--k', i === a.charges ? rechargeK.toFixed(2) : 0);
    });
    // anchored under Alex; settles down once both are available
    v.set(a.pos.x, a.pos.y - 0.1, a.pos.z).project(G.camera);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    this.e.pips.style.transform = `translate(${x}px, ${y + 14}px)`;
    this.e.pips.style.opacity = full ? Math.max(0.12, 1 - this.pipsFullT * 1.5) : 1;
  }

  // Off-screen threats: direction + timing (dim → brighter → flash).
  threatStart(e) {
    v.set(e.pos.x, e.pos.y + 1, e.pos.z).project(G.camera);
    const off = v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
    if (off) G.audio.sfx('offscreen', { pan: G.cam.panOf(e.pos.x, e.pos.z), gap: 0.12 });
  }
  _threats() {
    const list = [];
    const cam = G.camera, a = G.alex;
    if (G.room && G.mode === 'run') {
      for (const e of G.room.enemies) {
        if (!e.alive || !e.threatening()) continue;
        list.push({ x: e.pos.x, y: e.pos.y + 1, z: e.pos.z, t: e.threatT });
      }
      let n = 0;
      for (const p of G.projectiles.list) {
        if (!p.hostile || p.delay > 0 || n > 10) continue;
        const dx = a.pos.x - p.x, dz = a.pos.z - p.z;
        const vv = p.vx * p.vx + p.vz * p.vz;
        if (vv < 1) continue;
        const t = (dx * p.vx + dz * p.vz) / vv;
        if (t < 0 || t > 1.1) continue;
        const cx = p.x + p.vx * t - a.pos.x, cz = p.z + p.vz * t - a.pos.z;
        if (Math.hypot(cx, cz) > 1.0) continue;
        list.push({ x: p.x, y: p.y, z: p.z, t });
        n++;
      }
    }
    const k = { low: 0.65, normal: 1, high: 1.35 }[G.settings.indicatorIntensity] || 1;
    let used = 0;
    const W = innerWidth, H = innerHeight;
    for (const t of list) {
      v.set(t.x, t.y, t.z).project(cam);
      const behind = v.z > 1;
      let sx = v.x, sy = v.y;
      if (behind) { sx = -sx; sy = -sy; }
      if (!behind && Math.abs(sx) <= 0.95 && Math.abs(sy) <= 0.95) continue;
      const ang = Math.atan2(sy, sx);
      const m = Math.max(Math.abs(Math.cos(ang)) / 0.9, Math.abs(Math.sin(ang)) / 0.85);
      const ex = (Math.cos(ang) / m * 0.5 + 0.5) * W, ey = (-Math.sin(ang) / m * 0.5 + 0.5) * H;
      let d = this.threatEls[used];
      if (!d) { d = el('div', 'threat', '<b>!</b>'); this.e.threats.appendChild(d); this.threatEls.push(d); }
      used++;
      const level = t.t < 0.2 ? 'now' : t.t < 0.6 ? 'soon' : 'prep';
      d.className = 'threat on ' + level;
      d.style.transform = `translate(${ex}px, ${ey}px) rotate(${-ang}rad) scale(${k})`;
    }
    for (let i = used; i < this.threatEls.length; i++) this.threatEls[i].className = 'threat';
  }

  // Damage numbers ------------------------------------------------------------
  damageNumber(x, y, z, value, kind) {
    if (!G.settings.damageNumbers && kind !== 'alex' && kind !== 'heal') return;
    const d = el('div', 'num ' + kind, String(value));
    d.style.setProperty('--dx', (Math.random() - 0.5) * 40 + 'px');
    this.e.nums.appendChild(d);
    const item = { d, x, y, z, t: 0 };
    this.nums = this.nums || [];
    this.nums.push(item);
    if (this.nums.length > 40) { const o = this.nums.shift(); o.d.remove(); }
  }
  _bubbles(dt) {
    const cam = G.camera, W = innerWidth, H = innerHeight;
    this.nums = (this.nums || []).filter((n) => {
      n.t += dt;
      if (n.t > 0.9) { n.d.remove(); return false; }
      v.set(n.x, n.y + n.t * 0.8, n.z).project(cam);
      if (v.z > 1) { n.d.style.opacity = 0; return true; }
      n.d.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px)`;
      n.d.style.opacity = n.t < 0.6 ? 1 : 1 - (n.t - 0.6) / 0.3;
      return true;
    });
    this.bubbleList = this.bubbleList.filter((b) => {
      b.t -= dt;
      if (b.t <= 0 || (b.ent.alive === false && !b.keep)) { b.d.remove(); return false; }
      const p = b.ent.pos;
      v.set(p.x, p.y + (b.ent.height || 2) + 0.6, p.z).project(cam);
      if (v.z > 1) { b.d.style.opacity = 0; return true; }
      b.d.style.opacity = Math.min(1, b.t * 4);
      b.d.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px)`;
      return true;
    });
  }
  bubble(ent, text, color = '#ffffff', dur = 1.2) {
    const old = this.bubbleList.find((b) => b.ent === ent);
    if (old) { old.d.remove(); this.bubbleList.splice(this.bubbleList.indexOf(old), 1); }
    const d = el('div', 'bubble', esc(text));
    d.style.setProperty('--c', color);
    this.e.bubbles.appendChild(d);
    this.bubbleList.push({ ent, d, t: dur, keep: !ent.type });
    if (this.bubbleList.length > 14) { const o = this.bubbleList.shift(); o.d.remove(); }
  }
  popup(text, color = '#ffffff', dur = 1.2, small = false) {
    const d = el('div', 'pop' + (small ? ' small' : ''), esc(text));
    d.style.setProperty('--c', color);
    d.style.animationDuration = dur + 0.4 + 's';
    this.e.popups.appendChild(d);
    setTimeout(() => d.remove(), (dur + 0.4) * 1000);
    while (this.e.popups.children.length > 3) this.e.popups.firstChild.remove();
  }

  prompt(p, obj) {
    const e = this.e.prompt;
    if (!p) { if (this._promptObj) { e.classList.remove('on'); this._promptObj = null; } return; }
    const key = obj.id || obj;
    if (this._promptObj !== key || this._promptPrice !== p.price || this._promptMoney !== G.run.money) {
      this._promptObj = key; this._promptPrice = p.price; this._promptMoney = G.run.money;
      const afford = p.price == null || p.price === 0 || G.run.money >= p.price;
      e.innerHTML = `<div class="pt">${esc(p.title)}</div><div class="px">${esc(p.text || '')}</div><div class="pa"><b class="key">${G.input.glyph('interact')}</b> ${esc(p.action || 'Use')}${p.price ? ` <span class="price ${afford ? '' : 'no'}">${fmtMoney(p.price)}</span>` : p.price === 0 ? ' <span class="price free">FREE</span>' : ''}</div>`;
      e.classList.add('on');
    }
  }

  bossIntro(title, sub) {
    const e = this.e;
    e.introT.textContent = title;
    e.introS.textContent = sub;
    e.intro.classList.remove('on');
    void e.intro.offsetWidth;
    e.intro.classList.add('on');
    G.audio.sfx('roar', { v: 0.6 });
    this.bossGhost = 1;
  }
  hideBoss() { this.e.boss.classList.remove('on'); this.e.beat.classList.remove('on'); }
  roomTitle(a, b) {
    const e = this.e;
    e.rtA.textContent = a; e.rtB.textContent = b || '';
    e.rt.classList.remove('on'); void e.rt.offsetWidth; e.rt.classList.add('on');
    e.where.textContent = `FLOOR ${G.run.floor} · ${FLOOR_NAMES[G.run.floor - 1]}`;
  }

  setBeat(b, bpm) {
    const e = this.e.beat;
    e.classList.add('on');
    if (!this.beatMarks.length) for (let i = 0; i < 8; i++) { const m = el('i'); e.appendChild(m); this.beatMarks.push(m); }
    const frac = b - Math.floor(b);
    this.beatMarks.forEach((m, i) => {
      const k = i - frac;            // beats until this mark reaches centre
      const x = 50 + (k / 4) * 50;
      m.style.left = x + '%';
      m.style.opacity = clamp(1 - k / 4, 0, 1);
      m.classList.toggle('bar', (Math.floor(b) + i) % 4 === 0);
    });
    e.querySelector('.beat-center').style.transform = `scale(${1 + Math.max(0, 1 - frac * 5) * 0.5})`;
  }

  scratchCard(name, res, done) {
    const e = this.e.scratch;
    this.scratching = true;
    const txt = res.type === 'nothing' ? 'NOT A WINNER. (Thank you for playing.)'
      : res.type === 'money' ? 'WINNER: ' + fmtMoney(res.amount) + '!'
        : res.type === 'item' ? 'WINNER: ' + (itemInfo(res.item).icon || '') + ' ' + itemInfo(res.item).name
          : res.type === 'jackpot' ? '★ JACKPOT ★ $150 + ' + itemInfo(res.item).name + ' + IDOL CONTRACT'
            : UNUSUAL_TEXT[res.unusual];
    const syms = res.type === 'nothing' ? ['💀', '🍋', '🐴'] : res.type === 'jackpot' ? ['💎', '💎', '💎'] : res.type === 'unusual' ? ['❓', '🐈', '❓'] : ['⭐', '⭐', '⭐'];
    e.innerHTML = `<div class="sc-name">${esc(name)}</div><div class="sc-cells">${syms.map((s) => `<span><em>${s}</em><i></i></span>`).join('')}</div><div class="sc-res">${esc(txt)}</div>`;
    e.classList.add('on');
    const cells = [...e.querySelectorAll('.sc-cells span')];
    cells.forEach((c, i) => setTimeout(() => { c.classList.add('open'); G.audio.sfx('scratch'); }, 350 + i * 380));
    setTimeout(() => { e.querySelector('.sc-res').classList.add('on'); done(); }, 1600);
    setTimeout(() => { e.classList.remove('on'); this.scratching = false; }, 3600);
  }

  tutorial() {
    const I = G.input;
    const k = (a) => `<b class="key">${I.glyph(a)}</b>`;
    const lines = I.device === 'pad'
      ? ['Left stick: run · Right stick: camera', `${k('jump')} jump (tap = hop) · jump into walls to wall-kick · jump + forward near cover to vault`, `${k('dash')} dash (2 charges) — dash through attacks for a PERFECT DODGE`, `${k('melee')} melee (hold for launcher) · ${k('ranged')} shoot · ${k('lock')} hard focus`, `Phone: D-pad answers calls. ${k('map')} map`]
      : [`WASD run · mouse camera · ${k('jump')} jump (tap = hop) · jump near walls to wall-kick · jump + forward near cover to vault`, `${k('dash')} dash (2 charges) — dash through attacks for a PERFECT DODGE`, `${k('melee')} melee (hold for launcher) · ${k('ranged')} shoot · ${k('lock')} hard focus · ${k('targetPrev')}/${k('targetNext')} switch`, `Phone: ${k('phone1')} ${k('phone2')} ${k('phone3')} answer while fighting · ${k('interact')} interact · hold ${k('map')} map`];
    const e = this.e.tutorial;
    e.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    e.classList.add('on');
    clearTimeout(this._tutT);
    this._tutT = setTimeout(() => e.classList.remove('on'), 14000);
  }
  hideTutorial() { this.e.tutorial.classList.remove('on'); }

  _minimap(canvas, size, cell, big) {
    const run = G.run;
    if (!run || !run.map) return;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, size, size);
    const cur = run.map.rooms[run.roomId];
    const cx = big ? 5.5 : cur.gx + 0.5, cy = big ? 5.5 : cur.gy + 0.5;
    const off = (gx, gy) => [size / 2 + (gx - cx) * cell, size / 2 + (gy - cy) * cell];
    g.fillStyle = big ? 'rgba(10,4,24,.85)' : 'rgba(10,4,24,.55)';
    g.beginPath(); g.roundRect ? g.roundRect(0, 0, size, size, 14) : g.rect(0, 0, size, size); g.fill();
    const w = cell * 0.82, h = cell * 0.62;
    for (const r of run.map.rooms) {
      if (r.hidden && !run.flags.bathroomKey) continue;
      const known = r.visited || r.seen || run.flags.atlas;
      if (!known) continue;
      const [x, y] = off(r.gx, r.gy);
      if (x < -cell || y < -cell || x > size + cell || y > size + cell) continue;
      // doors
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
      for (const [d, id] of Object.entries(r.doors)) {
        const o = run.map.rooms[id];
        if (o.hidden && !run.flags.bathroomKey) continue;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (o.gx - r.gx) * cell * 0.5, y + (o.gy - r.gy) * cell * 0.5); g.stroke();
      }
      g.fillStyle = r.id === run.roomId ? '#ff4fa3' : r.visited ? (r.cleared || r.kind === 'start' || r.kind === 'gas' || r.kind === 'treasure' ? '#6c63a8' : '#8a4b7a') : 'rgba(120,110,170,.35)';
      g.fillRect(x - w / 2, y - h / 2, w, h);
      g.strokeStyle = r.id === run.roomId ? '#fff' : 'rgba(255,255,255,.4)'; g.lineWidth = r.id === run.roomId ? 2 : 1;
      g.strokeRect(x - w / 2, y - h / 2, w, h);
      const icon = { gas: '⛽', treasure: '★', boss: '♥', secret: '🚽', preboss: '!', start: '' }[r.kind];
      if (icon) { g.font = `${Math.round(cell * 0.45)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = r.kind === 'boss' ? '#ff0054' : '#ffd60a'; g.fillText(icon, x, y + 1); }
    }
    if (big) {
      g.fillStyle = '#fff'; g.font = 'bold 18px "Bungee", sans-serif'; g.textAlign = 'center';
      g.fillText(`FLOOR ${run.floor} — ${FLOOR_NAMES[run.floor - 1]}`, size / 2, 30);
    }
  }
}
