// Real scratch-off tickets. The card is painted on one canvas, a silver foil layer on
// another; dragging the mouse / a finger erases the foil (or hold Interact to let the
// coin do it). Each scratch area reveals itself once it is mostly scratched, and when
// every area is open the ticket is judged, celebrated and paid out.

import { G } from '../state.js';
import { TICKETS, layoutTicket, prizeText } from '../lottery.js';
import { itemInfo } from '../items.js';

const W = 960, H = 600;
const BRUSH = 26;
const REVEAL_AT = 0.55;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function star(g, x, y, r, n = 5) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
function label(g, text, x, y, size, fill, stroke = '#1a0630', font = 'Bungee', align = 'center', lw = 6) {
  g.font = `${size}px "${font}", "Arial Black", sans-serif`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
}
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export class ScratchOff {
  constructor(root) {
    const d = document.createElement('div');
    d.className = 'scratchoff';
    d.innerHTML = `
      <div class="so-card">
        <canvas class="so-base" width="${W}" height="${H}"></canvas>
        <canvas class="so-foil" width="${W}" height="${H}"></canvas>
        <canvas class="so-fx" width="${W}" height="${H}"></canvas>
        <div class="so-stamp"></div>
        <div class="so-coin"></div>
      </div>
      <div class="so-bar">
        <div class="so-hint"></div>
        <button class="so-btn so-all">🪙 Scratch all</button>
        <button class="so-btn so-done">Collect ▶</button>
      </div>
      <div class="so-result"><div class="so-r1"></div><div class="so-r2"></div></div>
      <div class="so-rain"></div>`;
    root.appendChild(d);
    this.el = d;
    this.base = d.querySelector('.so-base');
    this.foil = d.querySelector('.so-foil');
    this.fx = d.querySelector('.so-fx');
    this.coin = d.querySelector('.so-coin');
    this.stamp = d.querySelector('.so-stamp');
    this.hint = d.querySelector('.so-hint');
    this.result = d.querySelector('.so-result');
    this.rain = d.querySelector('.so-rain');
    this.isOpen = false;
    this.dust = [];
    d.querySelector('.so-all').addEventListener('click', () => { this.auto = true; });
    d.querySelector('.so-done').addEventListener('click', () => this._finishOrClose());
    const f = this.foil;
    f.addEventListener('pointerdown', (e) => { if (!this.isOpen) return; f.setPointerCapture(e.pointerId); this.drag = this._pt(e); this._scratch(this.drag, this.drag); });
    f.addEventListener('pointermove', (e) => {
      if (!this.isOpen) return;
      const p = this._pt(e);
      this._coinAt(p);
      if (this.drag) { this._scratch(this.drag, p); this.drag = p; }
    });
    const up = () => { this.drag = null; };
    f.addEventListener('pointerup', up); f.addEventListener('pointercancel', up);
    f.addEventListener('pointerleave', () => { this.coin.style.opacity = 0; });
  }

  get scratching() { return this.isOpen; }

  _pt(e) { const r = this.foil.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; }
  _coinAt(p) { this.coin.style.opacity = 1; this.coin.style.left = (p.x / W) * 100 + '%'; this.coin.style.top = (p.y / H) * 100 + '%'; }

  open(res, done) {
    this.res = res;
    this.doneFn = done;
    this.paid = false;
    this.judged = false;
    this.auto = false;
    this.autoArea = 0; this.autoT = 0;
    this.t = 0;
    this.dust.length = 0;
    this.ticket = TICKETS[res.price];
    this.layout = layoutTicket(res, G.run.rng);
    this.itemName = res.item ? (itemInfo(res.item).icon || '') + ' ' + itemInfo(res.item).name : '';
    this.areas = this._areas();
    this._drawCard();
    this._drawFoil();
    this.fx.getContext('2d').clearRect(0, 0, W, H);
    this.stamp.className = 'so-stamp';
    this.result.className = 'so-result';
    this.rain.innerHTML = '';
    this.el.style.setProperty('--c1', this.ticket.colors[0]);
    this.el.style.setProperty('--c2', this.ticket.colors[1]);
    this.el.classList.remove('judged');
    this.el.classList.add('on');
    this.el.classList.remove('enter'); void this.el.offsetWidth; this.el.classList.add('enter');
    this.isOpen = true;
    this._hint();
    G.input.releaseLock?.();
    if (G.run) G.run.inputLocked = true;
    G.audio.sfx('uiOk');
  }

  _hint() {
    const k = G.input.glyph ? G.input.glyph('interact') : 'E';
    this.hint.innerHTML = G.touch ? 'Drag your finger over the silver to scratch' : `Drag the mouse over the silver to scratch · hold <b class="key">${esc(k)}</b> to let the coin do it`;
  }

  // Scratch areas per ticket kind: { x, y, w, h, pts[], hit[], revealed, content }
  _areas() {
    const L = this.layout, A = [];
    const add = (x, y, w, h, content) => {
      const pts = [];
      for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) pts.push([x + ((i + 0.5) / 7) * w, y + ((j + 0.5) / 4) * h]);
      A.push({ x, y, w, h, pts, hit: new Array(pts.length).fill(false), revealed: false, content });
    };
    if (L.kind === 'lucky') {
      L.cells.forEach((s, i) => add(70 + (i % 3) * 178, 190 + Math.floor(i / 3) * 172, 158, 150, s));
    } else if (L.kind === 'bingo') {
      L.winning.forEach((n, i) => add(320 + i * 200, 172, 170, 100, n));
      L.mine.forEach((m, i) => add(84 + (i % 3) * 270, 318 + Math.floor(i / 3) * 110, 240, 96, m));
    } else {
      L.cells.forEach((s, i) => add(64 + (i % 3) * 186, 160 + Math.floor(i / 3) * 128, 168, 112, s));
      add(660, 270, 236, 200, L.bonus);
    }
    return A;
  }

  _drawCard() {
    const g = this.base.getContext('2d'), t = this.ticket, L = this.layout;
    g.clearRect(0, 0, W, H);
    // body
    rr(g, 6, 6, W - 12, H - 12, 34);
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, t.colors[0]); bg.addColorStop(1, t.colors[1]);
    g.fillStyle = bg; g.fill();
    g.save(); g.clip();
    // sunburst + sparkles
    g.globalAlpha = 0.14;
    for (let i = 0; i < 28; i++) { g.fillStyle = i % 2 ? '#fff' : 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(W * 0.5, H * 0.18); const a = (i / 28) * Math.PI * 2; g.arc(W * 0.5, H * 0.18, W, a, a + Math.PI / 28); g.fill(); }
    g.globalAlpha = 0.5;
    const rng = this._seed(this.res.price * 97 + 3);
    for (let i = 0; i < 40; i++) { g.fillStyle = i % 3 ? '#fff' : '#ffd60a'; star(g, rng() * W, rng() * H, 3 + rng() * 7, 4); g.fill(); }
    g.globalAlpha = 1;
    // glossy top
    const gl = g.createLinearGradient(0, 0, 0, H * 0.4); gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, H * 0.4);
    g.restore();
    // border
    g.lineWidth = 8; g.strokeStyle = '#fff'; rr(g, 10, 10, W - 20, H - 20, 30); g.stroke();
    g.setLineDash([2, 10]); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; rr(g, 24, 24, W - 48, H - 48, 22); g.stroke(); g.setLineDash([]);
    // title + price badge
    label(g, t.name, W / 2 - 40, 72, t.name.length > 14 ? 50 : 62, '#fff', '#1a0630', 'Bungee', 'center', 10);
    g.save(); g.translate(W - 92, 78); g.rotate(0.18);
    star(g, 0, 0, 62, 12); g.fillStyle = '#ffd60a'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1a0630'; g.stroke();
    label(g, '$' + t.price, 0, 4, 40, '#ff006e', '#fff', 'Bungee', 'center', 6);
    g.restore();
    rr(g, 120, 116, W - 300, 34, 17); g.fillStyle = 'rgba(20,4,40,.75)'; g.fill();
    label(g, t.tag, W / 2 - 60, 134, 17, '#fff', 'rgba(0,0,0,0)', 'M PLUS Rounded 1c', 'center', 0);
    // under-foil content + frames
    for (const a of this.areas) {
      rr(g, a.x - 6, a.y - 6, a.w + 12, a.h + 12, 18); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
      rr(g, a.x, a.y, a.w, a.h, 14); g.fillStyle = '#fffaf0'; g.fill();
    }
    if (L.kind === 'lucky') {
      this.areas.forEach((a) => { g.font = `86px ${EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a.content, a.x + a.w / 2, a.y + a.h / 2 + 4); });
      // legend
      rr(g, 622, 182, 304, 340, 20); g.fillStyle = 'rgba(20,4,40,.72)'; g.fill();
      label(g, 'PRIZES', 774, 212, 26, '#ffd60a', '#1a0630', 'Bungee', 'center', 5);
      L.legend.forEach((x, i) => { g.font = `34px ${EMOJI}`; g.textAlign = 'left'; g.fillText(x.s + x.s + x.s, 646, 258 + i * 50); label(g, '$' + x.amount, 900, 258 + i * 50, 30, '#fff', '#1a0630', 'Bungee', 'right', 5); });
      g.font = `26px ${EMOJI}`; g.textAlign = 'left'; g.fillText('🎁🎁🎁', 646, 506); label(g, 'ITEM', 900, 506, 22, '#3cff8f', '#1a0630', 'Bungee', 'right', 4);
    } else if (L.kind === 'bingo') {
      label(g, 'WINNING', 168, 210, 30, '#ffd60a', '#1a0630', 'Bungee', 'center', 6);
      label(g, 'NUMBERS', 168, 246, 30, '#ffd60a', '#1a0630', 'Bungee', 'center', 6);
      this.areas.slice(0, 2).forEach((a) => { label(g, String(a.content), a.x + a.w / 2, a.y + a.h / 2 + 4, 64, '#ff006e', '#fff', 'Bungee', 'center', 6); });
      this.areas.slice(2).forEach((a) => {
        label(g, String(a.content.n), a.x + a.w / 2, a.y + 34, 42, '#3a0ca3', '#fff', 'Bungee', 'center', 5);
        label(g, a.content.prize, a.x + a.w / 2, a.y + a.h - 20, a.content.prize.length > 6 ? 20 : 26, '#ff006e', '#fff', 'Bungee', 'center', 4);
      });
      label(g, 'YOUR NUMBERS — PRIZE UNDER EACH', W / 2, 298, 22, '#fff', '#1a0630', 'Bungee', 'center', 5);
    } else {
      this.areas.slice(0, 9).forEach((a) => {
        const c = a.content;
        if (c.startsWith('$')) label(g, c, a.x + a.w / 2, a.y + a.h / 2 + 4, c.length > 4 ? 46 : 54, '#b5179e', '#fff', 'Bungee', 'center', 6);
        else { g.font = `70px ${EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c, a.x + a.w / 2, a.y + a.h / 2 + 4); }
      });
      const b = this.areas[9];
      label(g, 'BONUS', b.x + b.w / 2, b.y - 26, 26, '#ffd60a', '#1a0630', 'Bungee', 'center', 5);
      label(g, b.content, b.x + b.w / 2, b.y + b.h / 2, b.content === '2X' ? 96 : b.content.length > 8 ? 26 : 38, b.content === 'JACKPOT' || b.content === '2X' ? '#ff006e' : '#3a0ca3', '#fff', 'Bungee', 'center', b.content === '2X' ? 10 : 5);
    }
    // fine print + serial barcode
    label(g, 'Odds: much better than before. Void where prohibited by the K-Pop Demon King. Not redeemable for real money.', 40, H - 34, 13, 'rgba(255,255,255,.85)', 'rgba(0,0,0,0)', 'M PLUS Rounded 1c', 'left', 0);
    g.fillStyle = '#fff'; rr(g, W - 230, H - 62, 190, 40, 6); g.fill();
    g.fillStyle = '#111';
    for (let i = 0; i < 46; i++) if (rng() > 0.35) g.fillRect(W - 222 + i * 3.8, H - 56, rng() > 0.5 ? 2.4 : 1.2, 28);
  }

  _drawFoil() {
    const g = this.foil.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    const rng = this._seed(11);
    for (const a of this.areas) {
      g.save();
      rr(g, a.x - 4, a.y - 4, a.w + 8, a.h + 8, 16); g.clip();
      const sg = g.createLinearGradient(a.x, a.y, a.x + a.w, a.y + a.h);
      sg.addColorStop(0, '#d9dde3'); sg.addColorStop(0.35, '#ffffff'); sg.addColorStop(0.55, '#a9b0ba'); sg.addColorStop(1, '#eef1f5');
      g.fillStyle = sg; g.fillRect(a.x - 4, a.y - 4, a.w + 8, a.h + 8);
      // brushed noise
      for (let i = 0; i < 180; i++) { g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(90,96,110,.18)'; g.fillRect(a.x + rng() * a.w, a.y + rng() * a.h, 2 + rng() * 14, 1); }
      // embossed logo
      g.globalAlpha = 0.35;
      label(g, '♥', a.x + a.w / 2, a.y + a.h / 2 - 8, Math.min(a.w, a.h) * 0.45, '#ffffff', '#8a909c', 'Bungee', 'center', 3);
      g.globalAlpha = 0.7;
      label(g, 'SCRATCH', a.x + a.w / 2, a.y + a.h - 18, 15, '#6c7380', 'rgba(0,0,0,0)', 'Bungee', 'center', 0);
      g.restore();
    }
  }

  _seed(n) { let s = n | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 100000) / 100000; }; }

  _scratch(a, b) {
    if (this.judged) return;
    const g = this.foil.getContext('2d');
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = BRUSH * 2;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x + 0.01, b.y); g.stroke();
    g.globalCompositeOperation = 'source-over';
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let touched = false;
    for (const ar of this.areas) {
      if (ar.revealed) continue;
      if (Math.max(a.x, b.x) < ar.x - BRUSH || Math.min(a.x, b.x) > ar.x + ar.w + BRUSH || Math.max(a.y, b.y) < ar.y - BRUSH || Math.min(a.y, b.y) > ar.y + ar.h + BRUSH) continue;
      touched = true;
      ar.pts.forEach(([px, py], i) => {
        if (ar.hit[i]) return;
        // distance from point to segment
        let t = len > 0 ? ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / (len * len) : 0;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(px - (a.x + (b.x - a.x) * t), py - (a.y + (b.y - a.y) * t)) < BRUSH * 1.05) ar.hit[i] = true;
      });
      if (ar.hit.filter(Boolean).length / ar.hit.length >= REVEAL_AT) this._reveal(ar);
    }
    if (touched) {
      G.audio.sfx('scratch', { gap: 0.06, p: 0.9 + Math.random() * 0.3 });
      for (let i = 0; i < Math.min(6, 1 + len / 12); i++) this.dust.push({ x: b.x + (Math.random() - 0.5) * BRUSH, y: b.y + (Math.random() - 0.5) * BRUSH, vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 120, life: 0.6 + Math.random() * 0.4, t: 0, s: 2 + Math.random() * 4 });
    }
  }

  _reveal(ar) {
    if (ar.revealed) return;
    ar.revealed = true;
    ar.revealT = this.t;
    const g = this.foil.getContext('2d');
    g.clearRect(ar.x - 6, ar.y - 6, ar.w + 12, ar.h + 12);
    G.audio.sfx('pcoin', { v: 0.6, p: 1 + this.areas.filter((x) => x.revealed).length * 0.06 });
    for (let i = 0; i < 14; i++) this.dust.push({ x: ar.x + Math.random() * ar.w, y: ar.y + Math.random() * ar.h, vx: (Math.random() - 0.5) * 260, vy: -100 - Math.random() * 200, life: 0.7, t: 0, s: 3 + Math.random() * 4, spark: true });
    if (this.areas.every((x) => x.revealed)) this._judge();
  }

  _winning() {
    const L = this.layout;
    if (this.res.type === 'nothing') return [];
    if (L.kind === 'lucky' || L.kind === 'mega') {
      const out = this.areas.filter((a, i) => (L.kind === 'lucky' || i < 9) && a.content === L.win);
      if (L.kind === 'mega' && (L.bonus === 'JACKPOT' || L.bonus === '2X')) out.push(this.areas[9]);
      return out;
    }
    return this.areas.filter((a, i) => i < 2 ? L.mine.some((m) => m.hit && m.n === a.content) : a.content.hit);
  }

  _judge() {
    if (this.judged) return;
    this.judged = true;
    this.judgeT = this.t;
    this.winCells = this._winning();
    const win = this.res.type !== 'nothing';
    const txt = prizeText(this.res, this.itemName);
    this.result.querySelector('.so-r1').textContent = win ? (this.res.type === 'jackpot' ? '★ JACKPOT ★' : 'WINNER!') : 'NOT A WINNER';
    this.result.querySelector('.so-r2').textContent = win ? txt.replace(/^WINNER! /, '').replace(/^★ JACKPOT ★ /, '') : 'Thank you for playing. The cashier did not notice.';
    this.result.className = 'so-result on ' + (win ? 'win' : 'lose');
    this.el.classList.add('judged');
    if (!win) { this.stamp.textContent = 'NO WIN'; this.stamp.className = 'so-stamp on'; G.audio.sfx('lose'); }
    else {
      G.audio.sfx('win');
      const n = this.res.type === 'jackpot' ? 90 : this.res.amount >= 40 || this.res.type === 'item' ? 50 : 26;
      let html = '';
      for (let i = 0; i < n; i++) html += `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * 1.2).toFixed(2)}s;animation-duration:${(1.4 + Math.random() * 1.4).toFixed(2)}s;--r:${Math.floor(Math.random() * 720 - 360)}deg">${['🪙', '💵', '✨', '💖', '⭐'][i % 5]}</i>`;
      this.rain.innerHTML = html;
      if (this.res.amount) this._countUp(this.res.amount);
    }
    if (!this.paid) { this.paid = true; this.doneFn?.(); }
    this.closeAt = this.t + (win ? 7 : 4.5);
  }

  _countUp(amount) {
    const el = this.result.querySelector('.so-r2');
    const rest = this.res.type === 'jackpot' ? ' + ' + this.itemName + ' + IDOL CONTRACT' : '';
    const t0 = performance.now(), dur = Math.min(1600, 500 + amount * 6);
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = '$' + Math.round(amount * (1 - (1 - k) ** 3)) + rest;
      if (k < 1 && this.isOpen) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _finishOrClose() {
    if (!this.judged) { this.auto = true; this.autoFast = true; return; }
    this.close();
  }

  close() {
    if (!this.isOpen) return;
    if (!this.paid) { this.paid = true; this.doneFn?.(); }
    this.isOpen = false;
    this.el.classList.remove('on', 'enter');
    if (G.run) G.run.inputLocked = false;
    G.input.clearBuffers?.();
    G.alex?.spawnSafe(0.5);
  }

  // per frame (real time): keyboard / pad scratching, dust, winning glow, auto close
  update(dt) {
    if (!this.isOpen) return;
    this.t += dt;
    const inp = G.input;
    const holding = inp.isHeld('interact') || inp.isHeld('jump');
    if (this.judged) {
      if (this.t - this.judgeT > 0.6 && (inp.pressed('interact') || inp.pressed('jump') || inp.pressed('melee') || inp.pressed('pause'))) this.close();
      else if (this.t > this.closeAt) this.close();
    } else if (this.auto || holding) {
      // the coin zig-zags across the next unrevealed area
      const ar = this.areas.find((a) => !a.revealed);
      if (ar) {
        this.autoT += dt * (this.autoFast ? 4.5 : this.auto ? 3.2 : 2.2);
        const k = this.autoT % 1;
        const rows = 4;
        const row = Math.floor(k * rows), f = (k * rows) % 1;
        const x = ar.x + (row % 2 ? 1 - f : f) * ar.w, y = ar.y + ((row + 0.5) / rows) * ar.h;
        const p = { x, y };
        this._coinAt(p);
        this._scratch(this.autoLast && this.autoLast.ar === ar ? this.autoLast.p : p, p);
        this.autoLast = { ar, p };
      }
    }
    this._fx(dt);
  }

  _fx(dt) {
    const g = this.fx.getContext('2d');
    g.clearRect(0, 0, W, H);
    this.dust = this.dust.filter((d) => {
      d.t += dt;
      if (d.t > d.life) return false;
      d.vy += 520 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      g.globalAlpha = 1 - d.t / d.life;
      g.fillStyle = d.spark ? '#fff6a8' : '#c4cad3';
      if (d.spark) { star(g, d.x, d.y, d.s * 1.6, 4); g.fill(); } else g.fillRect(d.x, d.y, d.s, d.s * 0.6);
      return true;
    });
    g.globalAlpha = 1;
    // freshly revealed areas flash
    for (const a of this.areas) {
      if (!a.revealed) continue;
      const k = (this.t - a.revealT) / 0.35;
      if (k < 1) { g.globalAlpha = 1 - k; g.fillStyle = '#fff'; rr(g, a.x, a.y, a.w, a.h, 14); g.fill(); g.globalAlpha = 1; }
    }
    // winning cells glow
    if (this.judged && this.winCells) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 8);
      for (const a of this.winCells) {
        g.lineWidth = 8 + pulse * 4; g.strokeStyle = `rgba(255,214,10,${0.6 + pulse * 0.4})`;
        g.shadowColor = '#ffd60a'; g.shadowBlur = 24;
        rr(g, a.x - 4, a.y - 4, a.w + 8, a.h + 8, 16); g.stroke();
        g.shadowBlur = 0;
      }
    }
  }
}
