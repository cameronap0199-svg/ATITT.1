// Heads-up display: the EKG (Vitals), the EEG (Cognitive Load), combo, ammo, the cover
// utility UI (weapon silhouettes, consumable grid, relic slots), crosshair and subtitles.

import { W, H, WEAPONS, CONSUMABLES, itemById } from './data.js';
import { text, roundRect, FONT, COLORS, hash, clamp, makeCanvas, wrapText, scramble } from './render.js';

// ---------------------------------------------------------------------------
// EKG: a sweeping phosphor trace. Health is never shown as a number.
// ---------------------------------------------------------------------------
function pqrst(p) {
  if (p >= 0.08 && p < 0.18) return 0.12 * Math.sin((Math.PI * (p - 0.08)) / 0.1);
  if (p >= 0.22 && p < 0.24) return -0.12;
  if (p >= 0.24 && p < 0.28) return 1 - Math.abs(p - 0.26) / 0.02;
  if (p >= 0.28 && p < 0.31) return -0.25;
  if (p >= 0.4 && p < 0.56) return 0.25 * Math.sin((Math.PI * (p - 0.4)) / 0.16);
  return 0;
}

let smudge = null;
function smudges(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 26;
    const rg = g.createRadialGradient(x, y, 1, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.07)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x, y, r * 0.2 + k * 3, 0, Math.PI * 1.6); g.stroke(); }
  }
  g.fillStyle = 'rgba(80,60,40,0.12)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  return c;
}

export class EKG {
  constructor(w = 280, h = 120) {
    this.w = w; this.h = h;
    this.inner = { x: 14, y: 22, w: w - 28, h: h - 34 };
    this.vals = new Float32Array(this.inner.w);
    this.ages = new Float32Array(this.inner.w).fill(99);
    this.head = 0;
    this.phase = 0;
    this.beatLen = 1;
    this.spike = 0;
    this.freeze = 0;
    this.surge = 0;
    this.flat = 0;
    this.bpm = 72;
    this.tear = 0;
  }
  hurt() { this.spike = 0.16; this.freeze = 0.5; }
  heal() { this.surge = 0.9; }
  flatline() { this.flat = 1; this.spike = 0.14; this.freeze = 0; }
  update(dt, state) {
    this.spike = Math.max(0, this.spike - dt);
    this.surge = Math.max(0, this.surge - dt);
    this.tear = Math.max(0, this.tear - dt);
    for (let i = 0; i < this.ages.length; i++) this.ages[i] += dt;
    if (this.freeze > 0 && this.spike <= 0) { this.freeze -= dt; return; }
    const target = state === 'stable' ? 72 : state === 'trauma' ? 124 : 46;
    this.bpm += (target - this.bpm) * Math.min(1, dt * 2);
    const speed = 120;
    let steps = Math.round(speed * dt + (this.carry || 0));
    this.carry = speed * dt + (this.carry || 0) - steps;
    while (steps-- > 0) {
      const colDt = 1 / speed;
      this.phase += (colDt * this.bpm) / 60 / this.beatLen;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.beatLen = state === 'trauma' ? 0.7 + Math.random() * 0.5 : state === 'critical' ? 0.8 + Math.random() * 0.9 : 1;
        if (state === 'trauma' && Math.random() < 0.3) this.tear = 0.12;
      }
      let v;
      if (this.flat) v = this.spike > 0 ? (Math.random() - 0.5) * 3 : 0;
      else if (this.spike > 0) v = (Math.random() - 0.5) * 3.2;
      else if (state === 'stable') v = pqrst(this.phase) * 0.85;
      else if (state === 'trauma') v = pqrst(this.phase) * 0.75 + (Math.random() - 0.5) * 0.22 + (Math.random() < 0.02 ? 0.5 : 0);
      else v = (this.phase > 0.24 && this.phase < 0.27 ? 0.25 * Math.random() : 0) + (Math.random() - 0.5) * 0.05 + (Math.random() < 0.015 ? 0.3 : 0);
      if (this.surge > 0) v *= 1 + this.surge * 0.4;
      this.vals[this.head] = v;
      this.ages[this.head] = 0;
      this.head = (this.head + 1) % this.vals.length;
      for (let k = 1; k < 14; k++) this.ages[(this.head + k) % this.vals.length] = 99;
    }
  }
  draw(ctx, x, y, state, t, { reduceFlash = false, iframes = 0 } = {}) {
    const { w, h, inner } = this;
    ctx.save();
    ctx.translate(x, y);
    // bezel
    const bz = ctx.createLinearGradient(0, 0, 0, h);
    bz.addColorStop(0, '#3a3d3a'); bz.addColorStop(1, '#1b1d1b');
    ctx.fillStyle = bz;
    roundRect(ctx, 0, 0, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = '#0c0d0c';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const [sx, sy] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) {
      ctx.fillStyle = '#555';
      ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#020a04';
    roundRect(ctx, inner.x - 4, inner.y - 4, inner.w + 8, inner.h + 8, 8);
    ctx.fill();
    // grid
    ctx.strokeStyle = 'rgba(57,255,106,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= inner.w; gx += 14) { ctx.beginPath(); ctx.moveTo(inner.x + gx, inner.y); ctx.lineTo(inner.x + gx, inner.y + inner.h); ctx.stroke(); }
    for (let gy = 0; gy <= inner.h; gy += 14) { ctx.beginPath(); ctx.moveTo(inner.x, inner.y + gy); ctx.lineTo(inner.x + inner.w, inner.y + gy); ctx.stroke(); }
    // trace colour
    let color = state === 'stable' ? COLORS.phosphor : state === 'trauma' ? COLORS.amber : COLORS.red;
    if (state === 'trauma' && hash(Math.floor(t * 20)) > 0.85) color = '#6a4a10';
    if (state === 'critical' && !reduceFlash && Math.sin(t * 16) > 0.3) color = '#7a0a0a';
    if (this.flat && this.spike <= 0) color = COLORS.red;
    if (this.spike > 0 || this.freeze > 0 || iframes > 0) color = '#ffffff';
    const width = state === 'stable' ? 2.6 : state === 'trauma' ? 2 : 1.6;
    const mid = inner.y + inner.h * 0.58;
    const amp = inner.h * 0.45;
    ctx.save();
    ctx.beginPath();
    ctx.rect(inner.x - 2, inner.y - 30, inner.w + 4, inner.h + 60);
    ctx.clip();
    if (this.tear > 0) ctx.translate((Math.random() - 0.5) * 16, 0);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (1 + this.surge * 0.8);
    ctx.lineJoin = 'round';
    const n = this.vals.length;
    const buckets = 6;
    for (let b = 0; b < buckets; b++) {
      ctx.globalAlpha = 1 - b / buckets;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < n; i++) {
        const age = this.ages[i];
        const bucket = Math.floor((age / 2.2) * buckets);
        if (age > 2.2 || bucket !== b) { pen = false; continue; }
        const px = inner.x + i;
        const py = mid - this.vals[i] * amp;
        if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // sweep head
    ctx.globalAlpha = 1;
    const hx = inner.x + this.head;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(hx, mid - this.vals[(this.head - 1 + n) % n] * amp, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // labels
    text(ctx, 'VITALS', inner.x, 16, { size: 16, color: 'rgba(57,255,106,0.8)' });
    const hr = this.flat ? '---' : String(Math.round(this.bpm + (state === 'trauma' ? Math.sin(t * 7) * 6 : 0)));
    text(ctx, `HR ${hr}`, w - inner.x, 16, { size: 16, color, align: 'right' });
    if (!smudge) smudge = smudges(w, h);
    ctx.drawImage(smudge, 0, 0);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// EEG Neural Spectrogram: Cognitive Load. Taller, sharper waves the closer to a break.
// ---------------------------------------------------------------------------
export class EEG {
  constructor(w = 280, h = 92) {
    this.w = w; this.h = h;
    this.samples = new Float32Array(w - 28);
    this.i = 0;
    this.clock = 0;
    this.notice = 0;
  }
  update(dt, load) {
    this.clock += dt;
    const k = load / 100;
    const n = Math.max(1, Math.round(dt * 90));
    for (let s = 0; s < n; s++) {
      const t = this.clock + s / 90;
      let v = Math.sin(t * 9) * 0.3 + Math.sin(t * 23 + 1) * 0.2 + Math.sin(t * 51) * 0.12 * k;
      const sharp = 1 + k * 4;
      v = Math.sign(v) * Math.pow(Math.abs(v), 1 / sharp);
      v *= 0.12 + k * 0.95;
      if (Math.random() < k * 0.08) v += (Math.random() - 0.5) * k * 1.6;
      this.samples[this.i] = v;
      this.i = (this.i + 1) % this.samples.length;
    }
    this.notice = Math.max(0, this.notice - dt);
  }
  draw(ctx, x, y, load, t, noticeText = '') {
    const { w, h } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#050805';
    roundRect(ctx, 0, 0, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(57,255,106,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, 'COGNITIVE LOAD', 12, 18, { size: 18, color: COLORS.phosphor, glow: 6 });
    const k = load / 100;
    const color = k < 0.5 ? COLORS.phosphor : k < 0.8 ? COLORS.amber : COLORS.red;
    // spectrogram bars (right)
    for (let b = 0; b < 10; b++) {
      const hh = (0.15 + hash(b * 13 + Math.floor(t * 8)) * 0.85) * k * 40 + 2;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35 + 0.05 * b;
      ctx.fillRect(w - 90 + b * 8, 22 + 44 - hh, 6, hh);
    }
    ctx.globalAlpha = 1;
    const mid = 60;
    ctx.beginPath();
    const n = this.samples.length;
    for (let i = 0; i < n; i++) {
      const v = this.samples[(this.i + i) % n];
      const px = 14 + i;
      const py = mid - v * 26;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (this.notice > 0 && noticeText) {
      const a = Math.min(1, this.notice);
      text(ctx, noticeText, w / 2, h - 6, { size: 15, color: COLORS.amber, align: 'center', alpha: a * (0.6 + 0.4 * Math.sin(t * 20)) });
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
export function drawWeaponIcon(ctx, id, x, y, w, h, color = '#d8e8dc') {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  const r = (a, b, c, d) => ctx.fillRect(a * w, b * h, c * w, d * h);
  switch (id) {
    case 'pistol': r(0.25, 0.3, 0.55, 0.18); r(0.28, 0.45, 0.14, 0.4); r(0.78, 0.33, 0.06, 0.1); break;
    case 'slapper': r(0.15, 0.25, 0.7, 0.24); r(0.2, 0.45, 0.16, 0.45); ctx.beginPath(); ctx.arc(0.45 * w, 0.52 * h, 0.12 * h, 0, Math.PI * 2); ctx.fill(); break;
    case 'rifle': r(0.05, 0.38, 0.9, 0.14); r(0.02, 0.4, 0.14, 0.3); r(0.42, 0.5, 0.08, 0.35); r(0.3, 0.22, 0.26, 0.12); break;
    case 'doodler': r(0.05, 0.3, 0.9, 0.1); r(0.05, 0.42, 0.9, 0.1); r(0.02, 0.4, 0.22, 0.34); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0.12 * w, 0.58 * h, 0.07 * h, 0, Math.PI * 2); ctx.fill(); break;
    case 'judgment': r(0.08, 0.28, 0.6, 0.44); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((0.76 + (i % 2) * 0.1) * w, (0.38 + (i < 2 ? 0 : 0.24)) * h, 0.08 * h, 0, Math.PI * 2); ctx.fill(); } break;
    case 'thurible': r(0.1, 0.32, 0.7, 0.26); r(0.2, 0.55, 0.12, 0.3); ctx.beginPath(); ctx.arc(0.82 * w, 0.72 * h, 0.12 * h, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(0.81 * w, 0.45 * h, 2, 0.2 * h); break;
    case 'needler': r(0.1, 0.4, 0.6, 0.22); r(0.2, 0.6, 0.12, 0.28); ctx.fillStyle = '#ff5fb8'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo((0.25 + i * 0.1) * w, 0.4 * h); ctx.lineTo((0.3 + i * 0.1) * w, 0.12 * h); ctx.lineTo((0.33 + i * 0.1) * w, 0.4 * h); ctx.fill(); } break;
    case 'railgun': r(0.05, 0.42, 0.9, 0.1); r(0.1, 0.52, 0.12, 0.3); ctx.fillStyle = COLORS.cyan; for (let i = 0; i < 3; i++) { r(0.3 + i * 0.17, 0.18, 0.08, 0.22); r(0.3 + i * 0.17, 0.54, 0.08, 0.22); } break;
    default: r(0.1, 0.4, 0.8, 0.2);
  }
  ctx.restore();
}

export function drawItemIcon(ctx, id, x, y, size, t = 0) {
  const s = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'stim':
      ctx.save(); ctx.rotate(-0.7);
      ctx.fillStyle = '#d9f3ff'; ctx.fillRect(-8, -22, 16, 36);
      ctx.fillStyle = '#39ff6a'; ctx.fillRect(-6, -8, 12, 20);
      ctx.fillStyle = '#9aa'; ctx.fillRect(-12, -26, 24, 5); ctx.fillRect(-2, -38, 4, 12);
      ctx.fillStyle = '#ccc'; ctx.fillRect(-1, 14, 2, 16);
      ctx.restore(); break;
    case 'sedative':
      ctx.fillStyle = '#e8a33c'; roundRect(ctx, -16, -16, 32, 38, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-18, -24, 36, 10); ctx.fillRect(-12, -4, 24, 14);
      ctx.fillStyle = '#b00018'; ctx.fillRect(-2, -2, 4, 10); ctx.fillRect(-5, 1, 10, 4); break;
    case 'adrenaline':
      ctx.fillStyle = '#ff3d3d'; roundRect(ctx, -10, -22, 20, 44, 8); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(3, -14); ctx.lineTo(-6, 2); ctx.lineTo(1, 2); ctx.lineTo(-3, 16); ctx.lineTo(7, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill(); break;
    case 'dove':
      ctx.strokeStyle = '#d0c9b0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -4, 22, Math.PI, 0); ctx.lineTo(22, 24); ctx.lineTo(-22, 24); ctx.closePath(); ctx.stroke();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, -24 + Math.abs(i) * 3); ctx.lineTo(i * 8, 24); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 8, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, 2, 5, 0, Math.PI * 2); ctx.fill(); break;
    case 'boots':
      ctx.fillStyle = '#8e969e'; ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(6, -26); ctx.lineTo(6, 6); ctx.lineTo(26, 12); ctx.lineTo(26, 24); ctx.lineTo(-16, 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#555'; ctx.fillRect(-16, 18, 42, 6); break;
    case 'heart':
      ctx.fillStyle = '#d4142a'; ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-30, 0, -18, -24, 0, -10); ctx.bezierCurveTo(18, -24, 30, 0, 0, 22); ctx.fill();
      ctx.strokeStyle = '#6b8e23'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(0, -34 - Math.sin(t * 8) * 3, 6, -12); ctx.fill(); break;
    case 'stone':
      ctx.fillStyle = '#7a7672'; ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-10, -16); ctx.lineTo(12, -18); ctx.lineTo(22, 0); ctx.lineTo(12, 18); ctx.lineTo(-14, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-8, -12, 14, 4); break;
    case 'worms':
      ctx.fillStyle = '#4a3624'; roundRect(ctx, -24, -18, 48, 38, 6); ctx.fill();
      ctx.strokeStyle = '#e88fa0'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-18, -8 + i * 8); ctx.bezierCurveTo(-6, -14 + i * 8 + Math.sin(t * 6 + i) * 3, 6, -2 + i * 8, 18, -8 + i * 8); ctx.stroke(); } break;
    case 'water':
      ctx.fillStyle = '#3fa9ff'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(16, -4, 20, 8, 0, 22); ctx.bezierCurveTo(-20, 8, -16, -4, 0, -26); ctx.fill();
      ctx.strokeStyle = '#b00018'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-2, 2); ctx.moveTo(8, -2); ctx.lineTo(2, 2); ctx.moveTo(-6, 12); ctx.quadraticCurveTo(0, 6, 6, 12); ctx.stroke(); break;
    case 'cain':
      ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 4; ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 24); ctx.moveTo(-14, -10); ctx.lineTo(14, 10); ctx.moveTo(14, -10); ctx.lineTo(-14, 10); ctx.stroke(); break;
    case 'silver':
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#c9ccd1' : '#e9ecf0'; ctx.beginPath(); ctx.ellipse(0, 14 - i * 8, 18, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, '30', 0, -14, { size: 14, font: FONT.title, color: '#333', align: 'center' }); break;
    case 'salt':
      ctx.fillStyle = '#e9ecef'; roundRect(ctx, -12, -8, 24, 32, 6); ctx.fill();
      ctx.fillStyle = '#aab'; roundRect(ctx, -12, -20, 24, 14, 6); ctx.fill();
      ctx.fillStyle = '#444'; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 6 - 1, -16, 2, 2); break;
    case 'lazarus':
      ctx.fillStyle = '#1b3a2a'; roundRect(ctx, -20, -20, 40, 40, 4); ctx.fill();
      ctx.strokeStyle = '#39ff6a'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-26, i * 10); ctx.lineTo(-20, i * 10); ctx.moveTo(20, i * 10); ctx.lineTo(26, i * 10); ctx.stroke(); }
      ctx.fillStyle = '#39ff6a'; ctx.fillRect(-2, -12, 4, 24); ctx.fillRect(-8, -5, 16, 4); break;
    case 'rosary':
      ctx.fillStyle = '#d7d2c4'; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 18, Math.sin(a) * 14 - 6, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#222'; ctx.fillRect(-2, 8, 4, 18); ctx.fillRect(-7, 13, 14, 3); break;
    case 'loaves':
      ctx.fillStyle = '#c9893a'; ctx.beginPath(); ctx.ellipse(-6, 4, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fb3c9'; ctx.beginPath(); ctx.ellipse(10, -10, 14, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(22, -6); ctx.lineTo(30, -14); ctx.lineTo(30, 0); ctx.fill(); break;
    case 'shard':
      ctx.fillStyle = '#b8ff5a'; ctx.shadowColor = '#b8ff5a'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(12, 0); ctx.lineTo(2, 26); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill(); break;
    case 'halo':
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4; ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(0, -12, 20, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#999'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 10, 18, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.fillRect(-24, 6, 10, 16); ctx.fillRect(14, 6, 10, 16); break;
    case 'bush':
      ctx.fillStyle = '#2f4a1f'; ctx.beginPath(); ctx.arc(-8, 10, 12, 0, Math.PI * 2); ctx.arc(8, 10, 12, 0, Math.PI * 2); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8a00'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 12;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 10 - 6, 2); ctx.quadraticCurveTo(i * 10, -26 - Math.sin(t * 9 + i) * 4, i * 10 + 6, 2); ctx.fill(); } break;
    default:
      text(ctx, '?', 0, 8, { size: 30, color: '#fff', align: 'center' });
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cover UI layout (shared by drawing and hit testing)
// ---------------------------------------------------------------------------
export const TRACK = { x: 524, y: 152, w: 272, h: 398, hitY: 512 };
export const coverLayout = () => ({
  weapons: [0, 1].map((i) => ({ x: 312, y: 196 + i * 92, w: 196, h: 80 })),
  consumables: [0, 1, 2, 3].map((i) => ({ x: 522 + i * 70, y: 604, w: 64, h: 64 })),
  actives: [0, 1, 2, 3].map((i) => ({ x: 822 + (i % 2) * 92, y: 196 + Math.floor(i / 2) * 92, w: 84, h: 84 })),
});
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function drawCoverUI(ctx, run, room, t, mouse, { scrambled = false } = {}) {
  const L = coverLayout();
  // Weapon silhouettes: click to reload
  run.weapons.forEach((w, i) => {
    const r = L.weapons[i];
    const def = WEAPONS[w.id];
    const hover = inRect(r, mouse.x, mouse.y);
    const active = room.ddr && room.ddr.kind === 'reload' && room.ddr.weapon === i;
    const full = w.ammo >= def.mag;
    ctx.save();
    ctx.fillStyle = active ? 'rgba(255,210,74,0.18)' : hover ? 'rgba(57,255,106,0.16)' : 'rgba(4,10,6,0.75)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = i === run.current ? COLORS.phosphor : 'rgba(57,255,106,0.35)';
    ctx.lineWidth = i === run.current ? 2 : 1;
    ctx.stroke();
    drawWeaponIcon(ctx, w.id, r.x + 8, r.y + 6, 78, 32, w.ammo === 0 ? '#ff6a6a' : '#d8e8dc');
    const name = scrambled ? scramble(def.name, t, i) : def.name;
    const ammo = scrambled ? scramble(`${w.ammo}/${def.mag}`, t, i + 3) : `${w.ammo}/${def.mag}`;
    text(ctx, ammo, r.x + r.w - 10, r.y + 30, { size: 26, color: w.ammo === 0 ? '#ff6a6a' : '#fff', align: 'right' });
    text(ctx, name, r.x + 8, r.y + 55, { size: 16, color: '#cfe', maxWidth: r.w - 16 });
    text(ctx, full ? 'FULL' : `RELOAD${i === run.current ? ' [R]' : ''}`, r.x + 8, r.y + 73, { size: 15, color: full ? 'rgba(200,255,220,0.4)' : COLORS.gold });
    ctx.restore();
  });
  // Consumable grid
  text(ctx, 'TACTICAL GRID', 660, 596, { size: 15, color: 'rgba(57,255,106,0.7)', align: 'center' });
  run.consumables.forEach((c, i) => {
    const r = L.consumables[i];
    const hover = inRect(r, mouse.x, mouse.y);
    const active = room.ddr && room.ddr.kind === 'consumable' && room.ddr.slot === i;
    ctx.save();
    ctx.fillStyle = active ? 'rgba(255,210,74,0.2)' : hover && c ? 'rgba(57,255,106,0.18)' : 'rgba(4,10,6,0.78)';
    ctx.shadowColor = COLORS.phosphor;
    ctx.shadowBlur = 8;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(57,255,106,0.55)';
    ctx.stroke();
    if (c) drawItemIcon(ctx, c, r.x + r.w / 2, r.y + r.h / 2, 40, t);
    text(ctx, String(i + 1), r.x + 6, r.y + 16, { size: 15, color: 'rgba(200,255,220,0.6)' });
    if (c && hover) text(ctx, CONSUMABLES[c].name, r.x + r.w / 2, r.y - 8, { size: 16, color: '#fff', align: 'center' });
    ctx.restore();
  });
  // Relic (active item) slots
  if (run.actives.length) text(ctx, 'RELICS', 910, 188, { size: 15, color: 'rgba(57,255,106,0.7)', align: 'center' });
  run.actives.forEach((a, i) => {
    const r = L.actives[i];
    const item = itemById(a.id);
    const hover = inRect(r, mouse.x, mouse.y);
    const spent = a.used;
    ctx.save();
    ctx.fillStyle = spent ? 'rgba(20,20,20,0.7)' : hover ? 'rgba(255,210,74,0.18)' : 'rgba(4,10,6,0.78)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = spent ? '#333' : 'rgba(255,210,74,0.6)';
    ctx.stroke();
    ctx.globalAlpha = spent ? 0.35 : 1;
    drawItemIcon(ctx, a.id, r.x + r.w / 2, r.y + r.h / 2 - 2, 50, t);
    ctx.globalAlpha = 1;
    text(ctx, String(i + 5), r.x + 6, r.y + 16, { size: 15, color: 'rgba(255,230,160,0.7)' });
    if (spent) text(ctx, 'SPENT', r.x + r.w / 2, r.y + r.h - 8, { size: 14, color: '#888', align: 'center' });
    if (hover) text(ctx, item.name, r.x + r.w / 2, r.y - 6, { size: 15, color: '#fff', align: 'center' });
    ctx.restore();
  });
}

export function drawAmmo(ctx, run, t, { scrambled = false, unlimited = false } = {}) {
  const w = run.weapons[run.current];
  const def = WEAPONS[w.id];
  const x = W - 24, y = H - 30;
  ctx.save();
  const name = scrambled ? scramble(def.name, t) : def.name;
  text(ctx, name.toUpperCase(), x, y - 44, { size: 20, color: '#dff', align: 'right', glow: 4 });
  const ammoStr = unlimited ? '∞' : `${w.ammo}`;
  text(ctx, scrambled ? scramble(ammoStr + '/' + def.mag, t, 2) : `${ammoStr}`, x - 56, y, { size: 44, font: FONT.mono, color: w.ammo === 0 && !unlimited ? '#ff5050' : w.overload ? COLORS.gold : '#fff', align: 'right', glow: w.overload ? 14 : 4 });
  if (!scrambled) text(ctx, `/${def.mag}`, x, y, { size: 26, color: 'rgba(220,255,230,0.6)', align: 'right' });
  // bullet ticks
  const n = Math.min(def.mag, 30);
  const filled = unlimited ? n : Math.round((w.ammo / def.mag) * n);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < filled ? (w.overload ? COLORS.gold : '#e9d9a0') : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x - 6 - i * 7, y + 8, 4, 10);
  }
  const other = run.weapons[1 - run.current];
  if (other) {
    const od = WEAPONS[other.id];
    text(ctx, `[Q] ${scrambled ? scramble(od.name, t, 5) : od.name} ${other.ammo}/${od.mag}`, x, y - 70, { size: 16, color: 'rgba(200,230,210,0.55)', align: 'right' });
  }
  if (w.ammo === 0 && !unlimited) text(ctx, 'EMPTY — DROP TO COVER TO RELOAD', W / 2, H - 150, { size: 24, color: '#ff5050', align: 'center', alpha: 0.6 + 0.4 * Math.sin(t * 10) });
  ctx.restore();
}

export function drawCombo(ctx, combo, t, fx) {
  const x = W - 28, y = 64;
  if (fx.snap > 0) {
    text(ctx, 'SNAP', x, y, { size: 44, font: FONT.title, color: '#ff3a3a', align: 'right', alpha: fx.snap, glow: 12 });
  }
  if (!combo.visible) return;
  const pulse = 1 + fx.pulse * 0.25;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  text(ctx, `×${combo.count}`, 0, 0, { size: 52, font: FONT.title, color: combo.count >= 50 ? COLORS.gold : combo.count >= 20 ? COLORS.magenta : '#fff', align: 'right', glow: 14 });
  ctx.restore();
  text(ctx, 'COMBO', x, y + 22, { size: 18, color: 'rgba(255,255,255,0.7)', align: 'right' });
  text(ctx, `SCORE ${String(combo.score).padStart(7, '0')}`, x, y + 44, { size: 20, color: COLORS.phosphor, align: 'right', glow: 4 });
}

export function drawCrosshair(ctx, x, y, spread, t, { color = '#ffffff', overload = false } = {}) {
  ctx.save();
  ctx.strokeStyle = overload ? COLORS.gold : color;
  ctx.shadowColor = overload ? COLORS.gold : COLORS.cyan;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  const g = 6 + spread * 0.4;
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(x + dx * g, y + dy * g);
    ctx.lineTo(x + dx * (g + 12), y + dy * (g + 12));
  }
  ctx.stroke();
  ctx.fillStyle = overload ? COLORS.gold : color;
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  if (spread > 2) {
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(x, y, spread, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawSubtitle(ctx, sub, t) {
  if (!sub) return;
  const age = t - sub.t0;
  const a = clamp(Math.min(age * 5, (sub.dur - age) * 3), 0, 1);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `22px ${FONT.mono}`;
  const maxW = 440;
  const words = sub.text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const tst = line ? line + ' ' + w : w;
    if (ctx.measureText(tst).width > maxW && line) { lines.push(line); line = w; } else line = tst;
  }
  lines.push(line);
  const bh = 34 + lines.length * 24;
  const y = 60;
  const x0 = 36;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  roundRect(ctx, x0 - 20, y, maxW + 40, bh, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(57,255,106,0.5)';
  ctx.fillRect(x0 - 20, y, 3, bh);
  const col = sub.who === 'SUBJECT 87' ? COLORS.phosphor : sub.who.includes('WARDEN') || sub.who.includes('SOLDIER') || sub.who.includes('ANGEL') ? COLORS.cyan : sub.who.includes('A-4RON') ? '#c8ff3a' : COLORS.gold;
  text(ctx, sub.who, x0, y + 22, { size: 18, color: col, glow: 6 });
  lines.forEach((l, i) => text(ctx, l, x0, y + 48 + i * 24, { size: 22, color: '#f0f0f0' }));
  ctx.restore();
}

export function drawBossBar(ctx, name, hp, maxHp, segments, t, color = '#fff') {
  const w = 620, x = W / 2 - w / 2, y = 30;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  roundRect(ctx, x - 10, y - 24, w + 20, 44, 6);
  ctx.fill();
  text(ctx, name, W / 2, y - 6, { size: 18, color, align: 'center', glow: 8 });
  const seg = maxHp / segments;
  for (let i = 0; i < segments; i++) {
    const sx = x + (i * w) / segments + 2;
    const sw = w / segments - 4;
    const fill = clamp((hp - i * seg) / seg, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(sx, y + 2, sw, 10);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(sx, y + 2, sw * fill, 10);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

export function drawBanner(ctx, msg, t) {
  if (!msg) return;
  const age = t - msg.t0;
  const a = clamp(Math.min(age * 4, (msg.dur - age) * 2), 0, 1);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, msg.y - 46, W, msg.sub ? 92 : 70);
  text(ctx, msg.text, W / 2, msg.y, { size: 48, font: FONT.title, color: msg.color || '#fff', align: 'center', glow: 16 });
  if (msg.sub) text(ctx, msg.sub, W / 2, msg.y + 34, { size: 22, color: 'rgba(230,255,235,0.85)', align: 'center' });
  ctx.restore();
}

export function drawTooltipBox(ctx, x, y, title, body, t) {
  ctx.save();
  const w = 360;
  ctx.fillStyle = 'rgba(2,8,4,0.92)';
  roundRect(ctx, x, y, w, 90, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.phosphor;
  ctx.stroke();
  text(ctx, title, x + 12, y + 24, { size: 20, color: COLORS.phosphor });
  wrapText(ctx, body, x + 12, y + 46, w - 24, 20, { size: 17, color: '#dfe' });
  ctx.restore();
}
