// Canvas helpers shared by every screen: text, glow, CRT treatment, noise and easing.

import { W, H } from './data.js';

export const FONT = {
  mono: '"VT323", "Share Tech Mono", ui-monospace, monospace',
  tech: '"Share Tech Mono", ui-monospace, monospace',
  title: '"Anton", Impact, "Arial Narrow", sans-serif',
  serif: '"Caudex", "Libre Baskerville", Georgia, serif',
};

export const COLORS = {
  phosphor: '#39ff6a',
  amber: '#ffb020',
  red: '#ff2a2a',
  cyan: '#00e5ff',
  magenta: '#ff2d95',
  violet: '#a35cff',
  gold: '#ffd24a',
  blueFire: '#3fa9ff',
  bone: '#efe6d2',
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function text(ctx, str, x, y, { size = 20, font = FONT.mono, color = '#fff', align = 'left', baseline = 'alphabetic', glow = 0, alpha = 1, weight = '', stroke = null, maxWidth } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  if (stroke) { ctx.lineWidth = stroke.width || 4; ctx.strokeStyle = stroke.color; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y, maxWidth); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y, maxWidth);
  ctx.restore();
}

// Word-wrap into lines no wider than maxW. Returns the y after the last line.
export function wrapText(ctx, str, x, y, maxW, lineH, opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || ''} ${opts.size || 20}px ${opts.font || FONT.mono}`;
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  ctx.restore();
  for (const l of lines) { text(ctx, l, x, y, opts); y += lineH; }
  return y;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Pre-generated static frames (film grain, Static of Guilt, CRT snow).
let noiseFrames = null;
export function noiseFrame(i) {
  if (!noiseFrames) {
    noiseFrames = [];
    for (let f = 0; f < 6; f++) {
      const c = makeCanvas(320, 180);
      const g = c.getContext('2d');
      const img = g.createImageData(320, 180);
      for (let p = 0; p < img.data.length; p += 4) {
        const v = Math.random() * 255;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
        img.data[p + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      noiseFrames.push(c);
    }
  }
  return noiseFrames[Math.abs(i | 0) % noiseFrames.length];
}

let scan = null;
export function scanlines(ctx, alpha = 0.18) {
  if (!scan) {
    const c = makeCanvas(4, 4);
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,1)';
    g.fillRect(0, 0, 4, 2);
    scan = ctx.createPattern(c, 'repeat');
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = scan;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function vignette(ctx, color = 'rgba(0,0,0,0.85)', inner = 0.45, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function crt(ctx, t, { lines = 0.16, flicker = 0.02 } = {}) {
  scanlines(ctx, lines);
  vignette(ctx, 'rgba(0,0,0,0.6)', 0.55);
  if (flicker) {
    ctx.save();
    ctx.globalAlpha = flicker * (0.5 + 0.5 * Math.sin(t * 60));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

export function scramble(str, t, seed = 0) {
  const glyphs = '▓▒░█▚▞◆◇※¤§¶∆∑≠∞¿¡ΞΨΩ#@%&';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ' ') { out += ' '; continue; }
    const k = Math.floor(t * 14 + i * 7.3 + seed * 13) % glyphs.length;
    out += glyphs[(k + glyphs.length) % glyphs.length];
  }
  return out;
}

// Seeded jitter without keeping state.
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function arrowPath(ctx, dir, size) {
  // Arrow centred on 0,0 pointing up; rotated for the direction.
  const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir];
  ctx.save();
  ctx.rotate(rot);
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, 0);
  ctx.lineTo(s * 0.42, 0);
  ctx.lineTo(s * 0.42, s);
  ctx.lineTo(-s * 0.42, s);
  ctx.lineTo(-s * 0.42, 0);
  ctx.lineTo(-s, 0);
  ctx.closePath();
  ctx.restore();
}
