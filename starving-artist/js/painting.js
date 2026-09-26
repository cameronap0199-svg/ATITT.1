// Paintings: composition data -> pixel canvas (with Alienate hiding inside it), plus the
// painting minigame UI: drag Ideas, brush strokes, backgrounds, and Inspiration bubbles.
import { IDEAS, drawIdea, ideaIcon, desat } from './ideas.js';
import { audio } from './audio.js';
import { rng } from './tex.js';

export const PW = 192, PH = 144;

// ---------------------------------------------------------------- backgrounds
const grad = (g, stops, y0 = 0, y1 = PH) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, y0, PW, y1 - y0); };
export const BACKGROUNDS = {
  dawn: { name: 'Dawn', draw: (g) => { grad(g, [[0, '#9cc8f2'], [0.7, '#fbe3ec']], 0, 100); grad(g, [[0, '#a8d890'], [1, '#7fb86b']], 100, PH); } },
  dusk: { name: 'Dusk', draw: (g) => { grad(g, [[0, '#473a78'], [0.55, '#d77b9c'], [1, '#ffc38a']], 0, 104); grad(g, [[0, '#5a4a6a'], [1, '#3a2a48']], 104, PH); } },
  room: { name: 'Room', draw: (g) => { grad(g, [[0, '#f2e6cf'], [1, '#e6d4b4']], 0, 104); g.fillStyle = '#d8c8a8'; g.fillRect(0, 102, PW, 3); grad(g, [[0, '#b07a4a'], [1, '#8a5a36']], 105, PH); } },
  night: { name: 'Night', draw: (g) => { grad(g, [[0, '#0e0c24'], [1, '#2a2050']], 0, 108); const r = rng(5); g.fillStyle = '#e8e4ff'; for (let i = 0; i < 40; i++) g.fillRect(r() * PW | 0, r() * 100 | 0, 1, 1); grad(g, [[0, '#1a1a2a'], [1, '#0a0a12']], 108, PH); } },
  fever: { name: 'Fever', draw: (g) => { grad(g, [[0, '#6a8a5a'], [0.5, '#b8a0c8'], [1, '#e8d890']], 0, PH); const r = rng(9); for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(${120 + r() * 100 | 0},${80 + r() * 80 | 0},${140 + r() * 80 | 0},0.35)`; g.lineWidth = 3; g.beginPath(); g.arc(r() * PW, r() * PH, 10 + r() * 40, 0, 4); g.stroke(); } } },
  snow: { name: 'Snow', draw: (g) => { grad(g, [[0, '#1a2448'], [1, '#4a5a8a']], 0, 106); grad(g, [[0, '#f0f4ff'], [1, '#c8d4ee']], 106, PH); const r = rng(11); g.fillStyle = '#fff'; for (let i = 0; i < 50; i++) g.fillRect(r() * PW | 0, r() * 106 | 0, 1, 1); } },
  blank: { name: 'Blank', draw: (g) => { g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, PW, PH); } },
  gallery: { name: 'Gallery', draw: (g) => { grad(g, [[0, '#5a1219'], [1, '#3a0a10']], 0, 100); grad(g, [[0, '#2a1a14'], [1, '#140a08']], 100, PH); g.fillStyle = 'rgba(255,230,160,0.25)'; g.beginPath(); g.moveTo(80, 0); g.lineTo(112, 0); g.lineTo(140, PH); g.lineTo(52, PH); g.fill(); } },
  sea: { name: 'Sea', draw: (g) => { grad(g, [[0, '#8ab8f0'], [1, '#e8f0ff']], 0, 84); grad(g, [[0, '#3a7ab8'], [1, '#1a4a7a']], 84, 118); grad(g, [[0, '#f0dcae'], [1, '#d8c090']], 118, PH); } },
  mirror: { name: 'Mirror', draw: (g) => { grad(g, [[0, '#dfe8ee'], [1, '#aabccc']], 0, PH); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(20, 0); g.lineTo(50, 0); g.lineTo(10, PH); g.lineTo(-20, PH); g.fill(); } },
  home: { name: 'Home', draw: (g) => { grad(g, [[0, '#f8d8a8'], [1, '#f0b890']], 0, 100); g.fillStyle = '#e0a078'; g.fillRect(0, 98, PW, 3); grad(g, [[0, '#8aa870'], [1, '#6a8a58']], 101, PH); } },
};

export const BRUSH_COLORS = ['#1a1418', '#f6f2ea', '#e8637a', '#f6d36b', '#6fd3c1', '#5a78d8', '#9a5ab8', '#6ab05a', '#c8925a'];

// ---------------------------------------------------------------- Alienate (2D)
export function drawAlien(g, x, y, s, stage, creep = 0, { alpha = 1 } = {}) {
  if (stage <= 0) return;
  g.save();
  g.globalAlpha = alpha * (stage === 1 ? 0.55 : 1);
  const k = s * (1 + creep * 0.12);
  const P = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + px * k), Math.round(y + py * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
  const body = stage === 1 ? '#4a4450' : '#141016';
  const tilt = creep >= 2 ? 3 : 0;
  // legs
  P(-4, -24, 2.4, 24, body); P(1.6, -24, 2.4, 24, body);
  // torso (hunched)
  P(-6, -44, 12, 21, body);
  P(-7, -46, 14, 4, body);
  // arms, far too long
  P(-9.5, -44, 2.4, 36, body); P(7.1, -44, 2.4, 36, body);
  P(-10.5, -9, 3.6, 5, body); P(7, -9, 3.6, 5, body);
  // neck + head (a small blank canvas)
  P(-1.2 + tilt * 0.3, -48, 2.4, 4, body);
  const hx = -5 + tilt, hy = -60;
  P(hx - 1.5, hy - 1, 13, 15, '#1a1418'); // hair frame
  P(hx, hy, 10, 12, stage === 1 ? '#bcb8b0' : '#efe9dc');
  P(hx - 1.5, hy + 8, 2, 12, '#1a1418'); P(hx + 9.5, hy + 8, 2, 14, '#1a1418');
  if (stage >= 2) { P(hx + 2, hy + 4, 2, 2.4, '#0a0a0c'); P(hx + 6, hy + 4, 2, 2.4, '#0a0a0c'); }
  if (stage >= 3) {
    P(hx + 1.5, hy + 8.5, 7, 1.2, '#a01828'); P(hx + 1, hy + 8, 1, 1, '#a01828'); P(hx + 8, hy + 8, 1, 1, '#a01828');
    P(hx + 2.5, hy + 6.4, 1, 4 + creep, 'rgba(10,10,12,0.8)'); P(hx + 6.5, hy + 6.4, 1, 3 + creep * 1.5, 'rgba(10,10,12,0.8)');
    P(-5, -22, 1, 8, '#a01828');
  }
  g.restore();
}
export function alienBox(x, y, s, creep = 0) { const k = s * (1 + creep * 0.12); return { x0: x - 11 * k, x1: x + 11 * k, y0: y - 62 * k, y1: y }; }

function tearOut(g, x, y, s) {
  const b = alienBox(x, y, s);
  const r = rng(Math.floor(x * 31 + y));
  g.save();
  g.beginPath();
  const cx = (b.x0 + b.x1) / 2;
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([cx - 6 * s - r() * 4 * s + Math.sin(t * 9) * 2, b.y0 + t * (b.y1 - b.y0)]); }
  for (let i = 16; i >= 0; i--) { const t = i / 16; pts.push([cx + 6 * s + r() * 4 * s + Math.cos(t * 7) * 2, b.y0 + t * (b.y1 - b.y0)]); }
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  g.fillStyle = '#e8e0cc'; g.lineWidth = 3; g.strokeStyle = '#e8e0cc'; g.stroke();
  g.fillStyle = '#050406'; g.fill();
  g.restore();
}

// ---------------------------------------------------------------- composition render
// opts: { alien: {stage, creep}, faceless, desat, drips, torn, unsigned }
export function renderComposition(canvasEl, comp, opts = {}) {
  const g = canvasEl.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, PW, PH);
  const al = opts.alien && opts.alien.stage > 0 && comp?.alien ? comp.alien : null;
  if (!comp || comp.blank) {
    BACKGROUNDS.blank.draw(g);
    const r = rng(comp?.seed || 3);
    g.strokeStyle = 'rgba(70,60,64,0.6)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { g.beginPath(); const x = 30 + r() * 130, y = 30 + r() * 80; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 40); g.stroke(); }
    g.fillStyle = 'rgba(70,60,64,0.75)'; g.font = 'italic 16px serif'; g.fillText('later.', 136, 132);
    g.strokeStyle = 'rgba(70,60,64,0.5)'; g.strokeRect(6.5, 6.5, PW - 13, PH - 13);
    if (al && !opts.torn) drawAlien(g, al.x, al.y, al.s, Math.min(opts.alien.stage, 3), opts.alien.creep || 0, { alpha: 0.35 + opts.alien.stage * 0.12 });
    if (al && opts.torn) tearOut(g, al.x, al.y, al.s);
    grain(g, comp?.seed || 1, 0.5);
    return canvasEl;
  }
  (BACKGROUNDS[comp.bg] || BACKGROUNDS.blank).draw(g);
  if (opts.desat) desatCanvas(g, opts.desat);
  for (const s of comp.strokes || []) drawStroke(g, s, opts.desat);
  const items = [...comp.items].map((it, i) => ({ ...it, i })).sort((a, b) => a.y - b.y);
  let alienDrawn = false;
  const drawA = () => {
    if (!al || alienDrawn) return; alienDrawn = true;
    if (opts.torn) return;
    drawAlien(g, al.x, al.y, al.s, opts.alien.stage, opts.alien.creep || 0);
  };
  for (const it of items) {
    if (al && al.behind === it.i) drawA();
    else if (al && al.behind < 0 && it.y > al.y) drawA();
    drawIdea(g, it.id, it.x, it.y, it.s, { flip: it.flip, faceless: opts.faceless && IDEAS[it.id]?.people, desat: opts.desat || 0 });
  }
  drawA();
  if (al && opts.torn) tearOut(g, al.x, al.y, al.s);
  if (opts.drips) {
    const r = rng(comp.seed || 7);
    for (let i = 0; i < opts.drips * 5; i++) { const x = r() * PW | 0, len = 8 + r() * 30 * opts.drips; g.fillStyle = `rgba(${40 + r() * 60 | 0},20,${30 + r() * 30 | 0},0.55)`; g.fillRect(x, PH - len, 2, len); g.fillRect(x - 1, PH - len, 4, 2); }
  }
  grain(g, comp.seed || 1, 1);
  return canvasEl;
}

function drawStroke(g, s, ds = 0) {
  g.strokeStyle = ds ? desat(s.c, ds) : s.c; g.lineWidth = s.w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (s.pts.length === 1) g.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
  g.stroke();
}
function desatCanvas(g, amt) {
  const img = g.getImageData(0, 0, PW, PH), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] += (l - d[i]) * amt; d[i + 1] += (l - d[i + 1]) * amt; d[i + 2] += (l - d[i + 2]) * amt; }
  g.putImageData(img, 0, 0);
}
function grain(g, seed, amt) {
  const img = g.getImageData(0, 0, PW, PH), d = img.data;
  const r = rng(seed * 7 + 1);
  for (let y = 0; y < PH; y++) {
    const row = (r() - 0.5) * 6 * amt;
    for (let x = 0; x < PW; x++) { const i = (y * PW + x) * 4; const n = row + (r() - 0.5) * 10 * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  }
  g.putImageData(img, 0, 0);
}

export function newPaintCanvas() { const c = document.createElement('canvas'); c.width = PW; c.height = PH; return c; }

// Work out where Alienate will live inside a finished composition.
export function computeAlienSpot(comp) {
  const items = comp.items;
  const followed = comp.insp.filter((i) => i.followed);
  const empties = followed.filter((i) => i.kind === 'empty');
  if (empties.length) { const e = empties[empties.length - 1]; return { x: e.x, y: Math.min(PH - 4, e.y + e.r * 0.6), s: 0.55 + e.r / 60, behind: -1, reason: 'empty' }; }
  const placed = followed.filter((i) => i.kind === 'place');
  if (placed.length) {
    const p = placed[placed.length - 1];
    let best = -1, bd = 1e9;
    items.forEach((it, i) => { if (it.id === p.idea) { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < bd) { bd = d; best = i; } } });
    if (best >= 0) { const it = items[best]; return { x: it.x + 10 * it.s, y: it.y - 2, s: 0.5 + it.s * 0.35, behind: best, reason: 'behind' }; }
  }
  // largest open space on the ground line
  let bx = PW / 2, bs = -1;
  for (let x = 16; x < PW - 16; x += 4) {
    let d = 1e9;
    for (const it of items) d = Math.min(d, Math.abs(it.x - x) - 20 * it.s * 0.5);
    if (d > bs) { bs = d; bx = x; }
  }
  return { x: bx, y: 128, s: 0.6, behind: -1, reason: 'space' };
}

// ---------------------------------------------------------------- Painter UI
export class Painter {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.id = 'painter';
    this.el.className = 'overlay hidden';
    this.el.innerHTML = `
      <div class="p-head"><div class="p-chapter"></div><div class="p-theme"></div></div>
      <div class="p-body">
        <div class="p-ideas"><div class="p-label">IDEAS</div><div class="p-idea-grid"></div></div>
        <div class="p-center">
          <div class="p-canvas-wrap">
            <canvas class="p-canvas" width="${PW}" height="${PH}"></canvas>
            <canvas class="p-overlay" width="${PW * 4}" height="${PH * 4}"></canvas>
            <div class="p-bubble hidden"><canvas class="p-bubble-icon" width="40" height="40"></canvas><div class="p-bubble-text"></div><button class="p-bubble-x" title="Ignore">✕</button></div>
          </div>
          <div class="p-hint">Drag ideas onto the canvas · drag to move · <b>scroll</b> or <b>[ ]</b> to resize · <b>F</b> flip · <b>right-click</b>/<b>Del</b> remove · <b>Ctrl+Z</b> undo</div>
        </div>
        <div class="p-tools">
          <div class="p-label">TOOL</div>
          <div class="p-row"><button class="p-tool on" data-tool="move">✥ Arrange</button><button class="p-tool" data-tool="brush">✎ Brush</button></div>
          <div class="p-label">PAINT</div>
          <div class="p-colors"></div>
          <div class="p-row p-sizes"><button data-size="2">·</button><button class="on" data-size="4">•</button><button data-size="8">●</button></div>
          <div class="p-label">WASH</div>
          <div class="p-bgs"></div>
          <div class="p-label">SELECTED</div>
          <div class="p-row p-sel"><button data-act="smaller" title="Smaller ( [ )">−</button><button data-act="bigger" title="Bigger ( ] )">+</button><button data-act="flip" title="Flip (F)">⇋</button><button data-act="del" title="Remove (Del)">✕</button></div>
          <div class="p-row"><button class="p-undo">↶ Undo</button><button class="p-clear">Clear</button></div>
          <div class="p-spacer"></div>
          <div class="p-count"></div>
          <button class="p-finish big">Sign it</button>
        </div>
      </div>
      <div class="p-title hidden">
        <div class="p-title-card">
          <div class="p-label">NAME THIS PAINTING</div>
          <input class="p-title-input" maxlength="28" spellcheck="false">
          <button class="p-title-ok big">Hang it</button>
        </div>
      </div>
      <div class="p-drag hidden"></div>`;
    root.appendChild(this.el);
    this.q = (s) => this.el.querySelector(s);
    this.cv = this.q('.p-canvas');
    this.ov = this.q('.p-overlay');
    this.og = this.ov.getContext('2d');
    this.bubble = this.q('.p-bubble');
    this.dragEl = this.q('.p-drag');
    this._bind();
  }

  _bind() {
    const cv = this.ov;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * PW, (e.clientY - r.top) / r.height * PH]; };
    this._pos = pos;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this.active) return;
      const [x, y] = pos(e);
      if (e.button === 2) { const i = this.hit(x, y); if (i >= 0) { this.snap(); this.comp.items.splice(i, 1); this.sel = -1; audio.play('remove'); this.redraw(); } return; }
      if (this.tool === 'brush') { this.snap(); this.stroke = { c: this.color, w: this.size, pts: [[x, y]] }; this.comp.strokes.push(this.stroke); audio.play('brush'); this.redraw(); return; }
      const i = this.hit(x, y);
      this.sel = i;
      if (i >= 0) { this.snap(); const it = this.comp.items[i]; this.moving = { i, ox: x - it.x, oy: y - it.y }; this.comp.items.push(this.comp.items.splice(i, 1)[0]); this.sel = this.moving.i = this.comp.items.length - 1; }
      this.redraw();
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (this.newDrag) { this.dragEl.style.left = e.clientX + 'px'; this.dragEl.style.top = e.clientY + 'px'; return; }
      const [x, y] = pos(e);
      if (this.stroke) { const last = this.stroke.pts[this.stroke.pts.length - 1]; if (Math.hypot(x - last[0], y - last[1]) > 0.8) { this.stroke.pts.push([x, y]); if (Math.random() < 0.15) audio.play('brush'); this.redraw(); } return; }
      if (this.moving) { const it = this.comp.items[this.moving.i]; it.x = clamp(x - this.moving.ox, 0, PW); it.y = clamp(y - this.moving.oy, 8, PH + 10); this.redraw(); return; }
      this.hover = this.hit(x, y);
      this.mouse = [x, y];
      this.drawOverlay();
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.active) return;
      if (this.newDrag) {
        const r = cv.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (inside) { const [x, y] = pos(e); this.addItem(this.newDrag, x, y + 20 * 0.5); }
        else if (this.newDrag && this.newDragStart && Date.now() - this.newDragStart < 250) this.addItem(this.newDrag, PW / 2 + (Math.random() - 0.5) * 40, 110 + (Math.random() - 0.5) * 20);
        this.newDrag = null; this.dragEl.classList.add('hidden');
        return;
      }
      if (this.moving) { audio.play('place'); this.checkInsp(); }
      this.moving = null; this.stroke = null;
    });
    cv.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      const i = this.sel >= 0 ? this.sel : this.hover;
      if (i >= 0 && this.comp.items[i]) { const it = this.comp.items[i]; it.s = clamp(it.s * (e.deltaY < 0 ? 1.1 : 0.9), 0.35, 3); this.redraw(); }
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!this.active || e.target.tagName === 'INPUT') return;
      const it = this.comp.items[this.sel];
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { this.undo(); e.preventDefault(); return; }
      if (!it) return;
      if (e.code === 'KeyF') { this.snap(); it.flip = !it.flip; this.redraw(); }
      if (e.code === 'BracketRight' || e.code === 'Equal') { it.s = clamp(it.s * 1.1, 0.35, 3); this.redraw(); }
      if (e.code === 'BracketLeft' || e.code === 'Minus') { it.s = clamp(it.s * 0.9, 0.35, 3); this.redraw(); }
      if (e.code === 'Delete' || e.code === 'Backspace') { this.snap(); this.comp.items.splice(this.sel, 1); this.sel = -1; audio.play('remove'); this.redraw(); }
    });
    this.el.querySelectorAll('.p-tool').forEach((b) => b.addEventListener('click', () => {
      this.tool = b.dataset.tool;
      this.el.querySelectorAll('.p-tool').forEach((x) => x.classList.toggle('on', x === b));
      this.ov.style.cursor = this.tool === 'brush' ? 'crosshair' : 'default';
      audio.play('click');
    }));
    this.el.querySelectorAll('.p-sizes button').forEach((b) => b.addEventListener('click', () => {
      this.size = +b.dataset.size; this.el.querySelectorAll('.p-sizes button').forEach((x) => x.classList.toggle('on', x === b)); audio.play('click');
    }));
    const colors = this.q('.p-colors');
    BRUSH_COLORS.forEach((c, i) => {
      const b = document.createElement('button'); b.className = 'p-swatch' + (i === 2 ? ' on' : ''); b.style.background = c;
      b.addEventListener('click', () => { this.color = c; colors.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); if (this.tool !== 'brush') this.el.querySelector('[data-tool=brush]').click(); audio.play('click'); });
      colors.appendChild(b);
    });
    this.el.querySelectorAll('.p-sel button').forEach((b) => b.addEventListener('click', () => {
      const it = this.comp.items[this.sel];
      if (!it) { audio.play('back'); return; }
      this.snap();
      if (b.dataset.act === 'smaller') it.s = clamp(it.s * 0.88, 0.35, 3);
      if (b.dataset.act === 'bigger') it.s = clamp(it.s * 1.12, 0.35, 3);
      if (b.dataset.act === 'flip') it.flip = !it.flip;
      if (b.dataset.act === 'del') { this.comp.items.splice(this.sel, 1); this.sel = -1; audio.play('remove'); } else audio.play('click');
      this.redraw();
    }));
    this.q('.p-undo').addEventListener('click', () => this.undo());
    this.q('.p-clear').addEventListener('click', () => { this.snap(); this.comp.items = []; this.comp.strokes = []; this.sel = -1; audio.play('remove'); this.redraw(); });
    this.q('.p-finish').addEventListener('click', () => this.finish());
    this.q('.p-bubble-x').addEventListener('click', () => this.dismissInsp());
    this.q('.p-bubble-icon').addEventListener('pointerdown', (e) => { if (this.curInsp?.kind === 'place') this.startNewDrag(this.curInsp.idea, e); });
    this.q('.p-title-ok').addEventListener('click', () => this.commitTitle());
    this.q('.p-title-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.commitTitle(); e.stopPropagation(); });
  }

  startNewDrag(id, e) {
    e.preventDefault();
    this.newDrag = id; this.newDragStart = Date.now();
    this.dragEl.innerHTML = ''; this.dragEl.appendChild(ideaIcon(id, 64, 64));
    this.dragEl.style.left = e.clientX + 'px'; this.dragEl.style.top = e.clientY + 'px';
    this.dragEl.classList.remove('hidden');
    audio.play('hover');
  }

  addItem(id, x, y) {
    this.snap();
    this.comp.items.push({ id, x: clamp(x, 0, PW), y: clamp(y, 10, PH + 6), s: 1, flip: false });
    this.sel = this.comp.items.length - 1;
    audio.play('place');
    this.redraw();
    this.checkInsp();
  }

  hit(x, y) {
    for (let i = this.comp.items.length - 1; i >= 0; i--) {
      const it = this.comp.items[i];
      const hw = 16 * it.s, h = 40 * it.s;
      if (x >= it.x - hw && x <= it.x + hw && y >= it.y - h && y <= it.y + 2) return i;
    }
    return -1;
  }

  snap() { this.undoStack.push(JSON.stringify({ items: this.comp.items, strokes: this.comp.strokes, bg: this.comp.bg })); if (this.undoStack.length > 40) this.undoStack.shift(); }
  undo() { const s = this.undoStack.pop(); if (!s) return; Object.assign(this.comp, JSON.parse(s)); this.sel = -1; audio.play('back'); this.redraw(); }

  redraw() {
    renderComposition(this.cv, this.comp);
    this.drawOverlay();
    const n = this.comp.items.length;
    this.q('.p-count').textContent = n < 3 ? `Place at least ${3 - n} more idea${3 - n === 1 ? '' : 's'}` : `${n} ideas on canvas`;
    this.q('.p-finish').disabled = n < 3;
  }

  drawOverlay() {
    const g = this.og, S = 4;
    g.clearRect(0, 0, this.ov.width, this.ov.height);
    const t = performance.now() / 1000;
    for (const ins of this.offered) {
      if (ins.dismissed) continue;
      const live = ins === this.curInsp;
      if (!live && ins.kind === 'place') continue;
      g.save();
      g.globalAlpha = live ? 0.5 + Math.sin(t * 3) * 0.25 : 0.18;
      g.strokeStyle = this.inspColor; g.lineWidth = 2; g.setLineDash([6, 5]); g.lineDashOffset = -t * 20;
      g.beginPath(); g.arc(ins.x * S, (ins.y - (ins.kind === 'place' ? 16 : 10)) * S, ins.r * S, 0, Math.PI * 2); g.stroke();
      if (live && ins.kind === 'place') { g.globalAlpha = 0.28; drawIdea(g, ins.idea, ins.x * S, ins.y * S, S, {}); }
      if (live && ins.kind === 'empty') { g.fillStyle = this.inspColor; g.globalAlpha = 0.08; g.fill(); }
      g.restore();
    }
    const i = this.sel >= 0 ? this.sel : this.hover;
    if (i >= 0 && this.comp.items[i] && this.tool === 'move') {
      const it = this.comp.items[i];
      g.strokeStyle = i === this.sel ? '#ffffff' : 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.setLineDash([4, 4]);
      g.strokeRect((it.x - 17 * it.s) * S, (it.y - 41 * it.s) * S, 34 * it.s * S, 43 * it.s * S);
    }
  }

  // ------------------------------------------------ inspiration
  pickInsp() {
    while (this.inspQueue.length) {
      const d = this.inspQueue[0];
      if (d.rel) {
        const it = this.comp.items.find((x) => x.id === d.rel);
        if (!it) { if (this.elapsed > (d.waitUntil || 40)) { this.inspQueue.shift(); continue; } return null; }
        this.inspQueue.shift();
        return { ...d, x: clamp(it.x + (d.dx || 0) * it.s, 12, PW - 12), y: clamp(it.y + (d.dy || 0), 20, PH - 4) };
      }
      this.inspQueue.shift();
      return { ...d, x: d.at[0], y: d.at[1] };
    }
    return null;
  }
  showInsp(ins) {
    ins.r = ins.r || 18;
    this.curInsp = ins; this.offered.push(ins); this.inspShownAt = this.elapsed;
    const ic = this.q('.p-bubble-icon'); const g = ic.getContext('2d'); g.clearRect(0, 0, 40, 40);
    if (ins.kind === 'place') drawIdea(g, ins.idea, 20, 37, 0.85);
    else { g.strokeStyle = this.inspColor; g.setLineDash([3, 3]); g.lineWidth = 2; g.beginPath(); g.arc(20, 20, 13, 0, 7); g.stroke(); }
    this.q('.p-bubble-icon').style.cursor = ins.kind === 'place' ? 'grab' : 'default';
    this.q('.p-bubble-icon').title = ins.kind === 'place' ? 'Drag me onto the canvas' : '';
    this.bubble.classList.remove('hidden', 'pop');
    void this.bubble.offsetWidth; this.bubble.classList.add('pop');
    this.bubble.style.setProperty('--ic', this.inspColor);
    const txt = this.q('.p-bubble-text'); txt.textContent = '';
    let n = 0; clearInterval(this._tw);
    this._tw = setInterval(() => { txt.textContent = ins.text.slice(0, ++n); if (n >= ins.text.length) clearInterval(this._tw); }, 28);
    audio.play('inspire');
    this.drawOverlay();
  }
  dismissInsp() {
    if (!this.curInsp) return;
    this.curInsp.dismissed = true; this.curInsp = null;
    this.bubble.classList.add('hidden'); audio.play('back');
    this.lastInspT = this.elapsed; this.drawOverlay();
  }
  checkInsp() {
    const ins = this.curInsp;
    if (!ins || ins.kind !== 'place') return;
    if (this.comp.items.some((it) => it.id === ins.idea && Math.hypot(it.x - ins.x, it.y - ins.y) < ins.r + 6)) {
      this.q('.p-bubble-text').textContent = ins.yes || 'yes. like that.';
      audio.play('chime');
      this.curInsp = null; this.lastInspT = this.elapsed - 4;
      setTimeout(() => { if (!this.curInsp) this.bubble.classList.add('hidden'); }, 1600);
      this.drawOverlay();
    }
  }
  tick(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (!this.curInsp && this.elapsed - this.lastInspT > (this.offered.length ? 9 : 4)) {
      const ins = this.pickInsp();
      if (ins) this.showInsp(ins); else this.lastInspT = this.elapsed - 6;
    }
    if (this.curInsp && this.elapsed - this.inspShownAt > 26) { this.curInsp = null; this.bubble.classList.add('hidden'); this.lastInspT = this.elapsed; }
    this.drawOverlay();
  }

  // ------------------------------------------------ open / finish
  open(cfg) {
    this.cfg = cfg;
    this.comp = { bg: cfg.backgrounds[0], items: [], strokes: [], seed: (Math.random() * 1e6) | 0 };
    this.undoStack = []; this.sel = -1; this.hover = -1; this.tool = 'move'; this.color = BRUSH_COLORS[2]; this.size = 4;
    this.offered = []; this.curInsp = null; this.inspQueue = [...cfg.insp]; this.elapsed = 0; this.lastInspT = 0;
    this.inspColor = cfg.inspColor || '#ffd24a';
    this.q('.p-chapter').textContent = cfg.chapterName;
    this.q('.p-theme').textContent = cfg.theme;
    const grid = this.q('.p-idea-grid'); grid.innerHTML = '';
    for (const id of cfg.ideas) {
      const b = document.createElement('button'); b.className = 'p-idea';
      b.appendChild(ideaIcon(id, 44, 44));
      const s = document.createElement('span'); s.textContent = IDEAS[id].name; b.appendChild(s);
      b.addEventListener('pointerdown', (e) => this.startNewDrag(id, e));
      b.addEventListener('mouseenter', () => audio.play('hover'));
      grid.appendChild(b);
    }
    const bgs = this.q('.p-bgs'); bgs.innerHTML = '';
    for (const k of cfg.backgrounds) {
      const b = document.createElement('button'); b.className = 'p-bg' + (k === this.comp.bg ? ' on' : '');
      const c = document.createElement('canvas'); c.width = 48; c.height = 36;
      const tmp = newPaintCanvas(); BACKGROUNDS[k].draw(tmp.getContext('2d'));
      c.getContext('2d').drawImage(tmp, 0, 0, 48, 36);
      b.appendChild(c); b.title = BACKGROUNDS[k].name;
      b.addEventListener('click', () => { this.snap(); this.comp.bg = k; bgs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); audio.play('brush'); this.redraw(); });
      bgs.appendChild(b);
    }
    this.el.querySelectorAll('.p-tool').forEach((x) => x.classList.toggle('on', x.dataset.tool === 'move'));
    this.bubble.classList.add('hidden');
    this.q('.p-title').classList.add('hidden');
    this.el.classList.remove('hidden');
    this.active = true;
    this.redraw();
    return new Promise((res) => { this.resolve = res; });
  }

  finish() {
    if (this.comp.items.length < 3) return;
    audio.play('choose');
    this.active = false;
    this.bubble.classList.add('hidden');
    this.q('.p-title').classList.remove('hidden');
    const inp = this.q('.p-title-input');
    inp.value = this.cfg.defaultTitle || 'Untitled';
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  }

  commitTitle() {
    const title = this.q('.p-title-input').value.trim() || 'Untitled';
    const comp = this.comp;
    comp.title = title;
    comp.insp = this.offered.map((ins) => {
      let followed;
      if (ins.kind === 'place') followed = comp.items.some((it) => it.id === ins.idea && Math.hypot(it.x - ins.x, it.y - ins.y) < ins.r + 6);
      else followed = !ins.dismissed && !comp.items.some((it) => Math.hypot(it.x - ins.x, (it.y - 12 * it.s) - (ins.y - 10)) < ins.r * 0.9);
      return { kind: ins.kind, idea: ins.idea || null, x: ins.x, y: ins.y, r: ins.r, followed, following: !!ins.following };
    });
    comp.alien = computeAlienSpot(comp);
    audio.play('chime');
    this.el.classList.add('hidden');
    this.active = false;
    clearInterval(this._tw);
    this.resolve(comp);
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
