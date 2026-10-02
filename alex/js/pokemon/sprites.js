// Procedural battle sprites. Each species' "look" (body form + colours + features) is
// drawn with simple shapes on a small 64×64 canvas, then posterised: hard alpha edges
// and a dark 1-px outline, so scaled up with nearest-neighbour it reads like a GBA
// sprite. Front sprites face the player; back sprites are the same body from behind.
// Also: the white silhouette used by the evolution sequence, and shiny palettes.

import { SPECIES } from './dex.js';

const N = 64;
const cache = new Map();

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb([r, g, b]) { return `rgb(${r | 0},${g | 0},${b | 0})`; }
function shade(c, k) { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, k < 0 ? v * (1 + k) : v + (255 - v) * k)); return rgb([f(r), f(g), f(b)]); }
function hueShift(c, deg) {
  let [r, g, b] = hex(c).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  h = (h + deg / 360 + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const t = (x) => { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; };
  return '#' + [t(h + 1 / 3), t(h), t(h - 1 / 3)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
export function palette(sp, shiny) {
  let c = sp.look.c.slice();
  if (shiny) c = c.map((x, i) => (i === 2 ? x : hueShift(x, 140 + (sp.no % 5) * 25)));
  return c;
}

// ---------------------------------------------------------------------------- drawing kit
function kit(g, c) {
  const fillGrad = (x, y, r, col) => {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.15);
    gr.addColorStop(0, shade(col, 0.28)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.32));
    return gr;
  };
  const K = {
    ell(x, y, rx, ry, col, rot = 0, flat = false) { g.save(); g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2); g.fillStyle = flat ? col : fillGrad(x, y, Math.max(rx, ry), col); g.fill(); g.restore(); },
    circ(x, y, r, col, flat) { K.ell(x, y, r, r, col, 0, flat); },
    poly(pts, col, flat = true) {
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      if (flat) g.fillStyle = col; else { let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } g.fillStyle = fillGrad(mx / pts.length, my / pts.length, 10, col); }
      g.fill();
    },
    rect(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); },
    line(x0, y0, x1, y1, col, w = 1.5) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); },
    curve(pts, col, w = 2) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); },
    tri(x, y, w, h, col, dir = 'up') {
      const p = dir === 'up' ? [[x - w / 2, y], [x + w / 2, y], [x, y - h]] : dir === 'down' ? [[x - w / 2, y], [x + w / 2, y], [x, y + h]] : dir === 'left' ? [[x, y - w / 2], [x, y + w / 2], [x - h, y]] : [[x, y - w / 2], [x, y + w / 2], [x + h, y]];
      K.poly(p, col);
    },
    flame(x, y, s, col = '#f97316') { K.poly([[x - s * 0.5, y], [x - s * 0.6, y - s * 0.7], [x - s * 0.15, y - s * 0.45], [x, y - s * 1.3], [x + s * 0.2, y - s * 0.5], [x + s * 0.55, y - s * 0.8], [x + s * 0.5, y]], col); K.poly([[x - s * 0.25, y], [x, y - s * 0.7], [x + s * 0.25, y]], '#fde047'); },
    leaf(x, y, w, h, rot, col) { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w, -h * 0.5, 0, -h); g.quadraticCurveTo(-w, -h * 0.5, 0, 0); g.fillStyle = col; g.fill(); g.restore(); },
  };
  return K;
}

// Eyes, mouth and face details at a head centre (hx, hy, r), facing left (dir -1) or front.
function face(K, F, hx, hy, r, c, dir = -1) {
  const ex = r * 0.42, ey = -r * 0.05, er = Math.max(1.3, r * 0.17);
  const eyes = F.has('cyclops') ? [[hx + dir * r * 0.15, hy]] : [[hx + dir * r * 0.05 - ex * 0.85, hy + ey], [hx + dir * r * 0.05 + ex * 0.85, hy + ey]];
  if (F.has('noeyes')) { /* bats */ }
  else if (F.has('sleepy') || F.has('dotface')) for (const [x, y] of eyes) { if (F.has('dotface')) K.circ(x, y, 0.9, '#111827', true); else K.line(x - er, y, x + er, y, '#111827', 1.2); }
  else if (F.has('dazed')) for (const [x, y] of eyes) { K.circ(x, y, er * 1.2, '#f8fafc', true); K.circ(x, y, er * 0.35, '#111827', true); }
  else for (const [x, y] of eyes) {
    const big = F.has('bigeyes') ? 1.45 : 1;
    K.ell(x, y, er * big * 0.9, er * big * 1.15, '#f8fafc', 0, true);
    K.ell(x + dir * er * 0.25, y + er * 0.15, er * big * 0.55, er * big * 0.8, F.has('redeyes') ? '#dc2626' : F.has('mask') ? '#dc2626' : '#111827', 0, true);
    K.circ(x + dir * er * 0.05 - er * 0.2, y - er * 0.35, Math.max(0.6, er * 0.3), '#ffffff', true);
    if (F.has('angry')) K.line(x - er * 1.2, y - er * 1.6, x + er * 1.2, y - er * (x < hx ? 0.8 : 2.2) + (x < hx ? 0 : 1.4), '#111827', 1.3);
  }
  const my = hy + r * 0.45, mx = hx + dir * r * 0.05;
  if (F.has('grin') || F.has('bigmouth')) { K.ell(mx, my, r * 0.55, r * 0.22, F.has('grin') ? '#f8fafc' : '#7f1d1d', 0, true); if (F.has('grin')) K.line(mx - r * 0.5, my, mx + r * 0.5, my, '#111827', 0.8); }
  else if (F.has('duckbill')) K.ell(mx + dir * r * 0.15, my - r * 0.1, r * 0.55, r * 0.25, '#f8e5b0');
  else if (F.has('beak')) K.tri(hx + dir * r * 0.9, hy + r * 0.1, r * 0.4, r * 0.55, '#f59e0b', dir < 0 ? 'left' : 'right');
  else if (!F.has('noeyes')) K.curve([[mx - r * 0.18, my - 0.3], [mx, my + 0.6], [mx + r * 0.18, my - 0.3]], '#3b1d1d', 1);
  if (F.has('fangs')) { K.tri(mx - r * 0.2, my + 0.5, 1.6, 2.2, '#f8fafc', 'down'); K.tri(mx + r * 0.2, my + 0.5, 1.6, 2.2, '#f8fafc', 'down'); }
  if (F.has('teeth')) K.rect(mx - 1.2, my + 0.3, 2.4, 2.4, '#f8fafc');
  if (F.has('cheeks')) { K.circ(hx - r * 0.75, hy + r * 0.3, r * 0.2, '#ef4444', true); K.circ(hx + r * 0.75, hy + r * 0.3, r * 0.2, '#ef4444', true); }
  if (F.has('whiskers')) for (const s of [-1, 1]) for (const k of [0, 1]) K.line(hx + s * r * 0.5, hy + r * 0.3 + k * 1.5, hx + s * r * 1.3, hy + r * 0.15 + k * 2.4, '#111827', 0.6);
  if (F.has('mustache')) { K.curve([[hx - r * 0.1, hy + r * 0.35], [hx - r * 0.7, hy + r * 0.5], [hx - r * 1.1, hy + r * 1.1]], '#5c4423', 1.4); K.curve([[hx + r * 0.1, hy + r * 0.35], [hx + r * 0.7, hy + r * 0.5], [hx + r * 1.1, hy + r * 1.1]], '#5c4423', 1.4); }
  if (F.has('nose')) K.ell(hx, hy + r * 0.25, r * 0.4, r * 0.28, '#f472b6');
  if (F.has('mask')) { K.ell(hx - r * 0.45, hy, r * 0.35, r * 0.18, '#111827', 0.3, true); K.ell(hx + r * 0.45, hy, r * 0.35, r * 0.18, '#111827', -0.3, true); }
}

// Head accessories (ears, horns, crests…) around a head at (hx, hy, r).
function headgear(K, F, hx, hy, r, c, back) {
  const [c0, c1, c2] = c;
  if (F.has('longears')) for (const s of [-1, 1]) { K.ell(hx + s * r * 0.6, hy - r * 1.25, r * 0.28, r * 0.8, c0, s * 0.25); K.ell(hx + s * r * 0.68, hy - r * 1.75, r * 0.2, r * 0.35, F.has('tailbolt') ? '#1f2937' : c1, s * 0.25, true); }
  if (F.has('pointears')) for (const s of [-1, 1]) { K.tri(hx + s * r * 0.6, hy - r * 0.6, r * 0.6, r * 0.75, c0); K.tri(hx + s * r * 0.6, hy - r * 0.62, r * 0.3, r * 0.45, c2 === '#111827' ? c1 : shade(c0, -0.25)); }
  if (F.has('roundears')) for (const s of [-1, 1]) { K.circ(hx + s * r * 0.75, hy - r * 0.75, r * 0.38, c0); K.circ(hx + s * r * 0.75, hy - r * 0.75, r * 0.2, F.has('teeth') ? '#f9a8d4' : shade(c0, -0.2), true); }
  if (F.has('finears') || F.has('leafears')) for (const s of [-1, 1]) K.leaf(hx + s * r * 0.7, hy - r * 0.3, r * 0.45, r * 1.2, s * 0.9, F.has('leafears') ? '#5bb450' : '#f8fafc');
  if (F.has('horn')) K.tri(hx, hy - r * 0.85, r * 0.35, r * 0.9, F.has('scythehorn') ? '#1f2937' : '#f1eee3');
  if (F.has('horns2')) for (const s of [-1, 1]) K.tri(hx + s * r * 0.5, hy - r * 0.75, r * 0.3, r * 0.8, '#e5e7eb');
  if (F.has('scythehorn')) K.poly([[hx + r * 0.3, hy - r * 0.6], [hx + r * 1.4, hy - r * 1.6], [hx + r * 0.7, hy - r * 0.4]], '#1f2937');
  if (F.has('crest')) { K.poly([[hx - r * 0.2, hy - r * 0.8], [hx + r * 0.2, hy - r * 2], [hx + r * 0.6, hy - r * 0.7]], c2 && c2 !== '#111827' ? c2 : c1); }
  if (F.has('tuft')) for (let i = -1; i <= 1; i++) K.tri(hx + i * r * 0.3, hy - r * 0.85, r * 0.3, r * 0.6, F.has('dazed') ? '#111827' : c1);
  if (F.has('antenna')) for (const s of [-1, 1]) { K.line(hx + s * r * 0.3, hy - r * 0.8, hx + s * r * 0.8, hy - r * 1.8, '#111827', 1); K.circ(hx + s * r * 0.8, hy - r * 1.8, 1.4, c2 || '#111827', true); }
  if (F.has('crown')) { for (const s of [-0.5, 0, 0.5]) K.tri(hx + s * r, hy - r * 0.8, r * 0.4, r * 0.7, '#fde047'); }
  if (F.has('skullhelm')) { K.ell(hx, hy - r * 0.15, r * 1.08, r * 0.92, '#f1eee3'); if (!back) { K.ell(hx - r * 0.38, hy - r * 0.1, r * 0.22, r * 0.28, '#111827', 0, true); K.ell(hx + r * 0.38, hy - r * 0.1, r * 0.22, r * 0.28, '#111827', 0, true); } K.tri(hx - r * 0.7, hy - r * 0.8, r * 0.3, r * 0.6, '#f1eee3'); K.tri(hx + r * 0.7, hy - r * 0.8, r * 0.3, r * 0.6, '#f1eee3'); }
  if (F.has('helmet') || F.has('hairbob')) K.ell(hx, hy - r * 0.35, r * 1.1, r * 0.85, c1);
  if (F.has('star')) K.poly([0, 1, 2, 3, 4].flatMap((i) => [[hx + Math.sin(i * 1.2566) * r * 0.45, hy - r * 0.2 - Math.cos(i * 1.2566) * r * 0.45], [hx + Math.sin(i * 1.2566 + 0.628) * r * 0.2, hy - r * 0.2 - Math.cos(i * 1.2566 + 0.628) * r * 0.2]]), '#dc2626');
  if (F.has('gem')) K.ell(hx, hy - r * 0.55, r * 0.2, r * 0.25, c2 || '#dc2626', 0, true);
  if (F.has('dreads')) for (const s of [-1, 1]) K.ell(hx + s * r * 0.3, hy + r * 0.6, r * 0.18, r * 0.6, '#111827', s * 0.3);
  if (F.has('hood')) K.ell(hx, hy + r * 0.2, r * 1.7, r * 1.2, shade(c0, -0.15));
  if (F.has('rings')) { K.circ(hx + r * 0.6, hy - r * 1.1, r * 0.2, '#fde047', true); }
  if (F.has('curl')) K.curve([[hx, hy - r * 0.9], [hx - r * 0.3, hy - r * 1.3], [hx + r * 0.1, hy - r * 1.5], [hx + r * 0.2, hy - r * 1.2]], shade(c0, -0.2), 1.5);
  if (F.has('swirl')) { K.circ(hx, hy + r * 1.4, r * 0.65, '#f8fafc', true); K.curve(Array.from({ length: 14 }, (_, i) => [hx + Math.cos(i * 0.9) * i * 0.04 * r, hy + r * 1.4 + Math.sin(i * 0.9) * i * 0.04 * r]), '#111827', 0.9); }
}

function tail(K, F, x, y, s, c) {
  const [c0, c1, c2] = c;
  if (F.has('flametail')) { K.curve([[x, y], [x + s * 0.5, y - s * 0.2], [x + s * 0.8, y - s * 0.6]], c0, s * 0.25); K.flame(x + s * 0.85, y - s * 0.6, s * 0.45); }
  if (F.has('tailbolt')) K.poly([[x, y], [x + s * 0.4, y - s * 0.3], [x + s * 0.25, y - s * 0.45], [x + s * 0.7, y - s * 0.9], [x + s * 0.55, y - s * 0.45], [x + s * 0.75, y - s * 0.35], [x + s * 0.3, y - s * 0.05]], F.has('wool') ? '#111827' : c0);
  if (F.has('tailcurl')) K.curve([[x, y], [x + s * 0.4, y - s * 0.1], [x + s * 0.6, y - s * 0.4], [x + s * 0.4, y - s * 0.6], [x + s * 0.3, y - s * 0.4]], F.has('shell') ? c0 : shade(c0, -0.15), Math.max(1.5, s * 0.14));
  if (F.has('tailfluffy') || F.has('tails6') || F.has('tails9')) { const n = F.has('tails9') ? 5 : F.has('tails6') ? 3 : 1; for (let i = 0; i < n; i++) K.ell(x + s * 0.45, y - s * 0.35 - i * s * 0.12, s * 0.35, s * 0.2, i % 2 ? shade(c0, 0.15) : c0, -0.8 + i * 0.25); if (F.has('tailfluffy')) K.ell(x + s * 0.75, y - s * 0.55, s * 0.15, s * 0.12, c1 === '#111827' ? '#fde68a' : c1, 0, true); }
  if (F.has('longtail')) K.curve([[x, y], [x + s * 0.6, y + s * 0.05], [x + s * 0.95, y - s * 0.3], [x + s * 1.0, y - s * 0.6]], F.has('tube') ? c1 : c0, Math.max(1.5, s * 0.14));
  if (F.has('tailorb')) { K.line(x, y, x + s * 0.6, y - s * 0.2, c0, s * 0.12); K.circ(x + s * 0.7, y - s * 0.25, s * 0.14, '#ef4444'); }
  if (F.has('flattail')) K.ell(x + s * 0.35, y + s * 0.05, s * 0.35, s * 0.15, '#7a4a20', 0.2);
  if (F.has('fishtail') || F.has('leaftail')) K.leaf(x, y, s * 0.35, s * 0.8, 1.1, F.has('leaftail') ? '#5bb450' : c1);
  if (F.has('tadtail')) K.ell(x + s * 0.4, y, s * 0.4, s * 0.12, '#bfdbfe', 0.1);
  if (F.has('stinger')) K.tri(x + s * 0.2, y + s * 0.15, s * 0.2, s * 0.4, '#f8fafc', 'right');
  if (F.has('rattle')) K.circ(x, y, s * 0.12, c1);
}

// ---------------------------------------------------------------------------- body forms
// Each draws the body and returns the head { x, y, r } and facing.
const FORMS = {
  quad(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 34, by = 40, brx = 15 * s, bry = 9 * s;
    tail(K, F, bx + brx * 0.85, by - bry * 0.3, 22 * s, c);
    for (const [lx, back] of [[bx + brx * 0.55, 1], [bx - brx * 0.5, 1]]) K.rect(lx - 2.5 * s, by + 2, 5 * s, 9 * s, shade(c0, -0.3));
    if (F.has('wool')) { for (let i = 0; i < 9; i++) K.circ(bx - brx * 0.8 + (i % 5) * brx * 0.4, by - bry * 0.5 + Math.floor(i / 5) * bry * 0.6, bry * 0.6, c0); }
    else K.ell(bx, by, brx, bry, c0);
    if (F.has('bulb') || F.has('bud') || F.has('flower')) {
      if (F.has('flower')) { for (let i = 0; i < 6; i++) K.ell(bx + Math.cos(i * 1.05) * 9 * s, by - bry - 4 * s + Math.sin(i * 1.05) * 3 * s, 7 * s, 3.5 * s, c2, i * 1.05); K.circ(bx, by - bry - 4 * s, 4 * s, '#fde047'); }
      else K.ell(bx + 2, by - bry - 2 * s, (F.has('bud') ? 8 : 9) * s, (F.has('bud') ? 9 : 7) * s, F.has('bud') ? c2 : shade(c1, 0.15));
      if (F.has('bud')) for (const s2 of [-1, 1]) K.leaf(bx + s2 * 6 * s, by - bry, 3 * s, 10 * s, s2 * 1.1, '#2f7a5c');
    }
    if (F.has('stripes')) for (let i = 0; i < 3; i++) K.line(bx - 4 + i * 6, by - bry + 1, bx - 2 + i * 6, by - bry * 0.2, c1, 1.6);
    if (F.has('spots')) for (const [dx, dy] of [[-4, -2], [5, -4], [2, 3]]) K.ell(bx + dx * s, by + dy * s, 2.4 * s, 1.6 * s, c1, 0, true);
    if (F.has('fins')) K.leaf(bx + 4, by - bry, 5 * s, 9 * s, 0.4, '#f8fafc');
    if (F.has('leaves')) K.leaf(bx + 2, by - bry, 4 * s, 9 * s, 0.6, '#5bb450');
    if (F.has('rings')) K.circ(bx + 4, by - 2, 2.2 * s, '#fde047', true);
    for (const lx of [bx + brx * 0.35, bx - brx * 0.7]) K.rect(lx - 2.5 * s, by + 3, 5 * s, 9 * s, c0);
    if (c3 && c3 !== c0) K.ell(bx - 2, by + bry * 0.4, brx * 0.6, bry * 0.45, c3, 0, true);
    const hx = bx - brx * 0.85, hy = by - bry * 1.15, hr = 9.5 * s;
    if (F.has('mane')) K.ell(hx + 3, hy + hr * 0.6, hr * 1.1, hr * 0.8, F.has('tails9') ? '#fffbeb' : c1 === '#111827' ? c0 : c1);
    K.circ(hx, hy, hr, c0);
    if (F.has('scythehorn')) { /* drawn by headgear */ }
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  biped(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 32, by = 38, brx = 11 * s, bry = 13 * s;
    tail(K, F, bx + brx * 0.8, by + bry * 0.4, 20 * s, c);
    if (F.has('wool')) K.ell(bx, by - bry * 0.6, brx * 1.2, bry * 0.5, '#f8fafc');
    for (const sx of [-1, 1]) K.ell(bx + sx * brx * 0.55, by + bry * 0.95, 5 * s, 3 * s, shade(c0, -0.2));
    if (F.has('flattail') || F.has('gown') || F.has('tutu')) { if (F.has('gown')) K.poly([[bx - brx * 1.3, by + bry], [bx + brx * 1.3, by + bry], [bx + brx * 0.4, by - bry * 0.3], [bx - brx * 0.4, by - bry * 0.3]], c0); if (F.has('tutu')) K.ell(bx, by + 2, brx * 1.4, bry * 0.4, c0); }
    K.ell(bx, by, brx, bry, F.has('gown') ? c1 : c0);
    if (c3 && c3 !== c0) K.ell(bx - 1, by + 2, brx * 0.65, bry * 0.65, c3, 0, true);
    if (F.has('belt')) K.rect(bx - brx, by + bry * 0.25, brx * 2, 2.4, c2);
    if (F.has('stripes')) for (let i = 0; i < 2; i++) K.line(bx - brx * 0.6, by - 3 + i * 4, bx + brx * 0.6, by - 3 + i * 4, '#111827', 1.4);
    if (F.has('chestspike')) K.tri(bx, by + 2, 4 * s, 7 * s, '#ef4444', 'up');
    if (F.has('spikes')) for (const sx of [-1, 1]) K.tri(bx + sx * brx * 0.9, by - bry * 0.2, 4 * s, 6 * s, '#f1eee3', sx < 0 ? 'left' : 'right');
    const arms = F.has('arms4') ? [-0.2, 0.25] : [0];
    for (const ay of arms) for (const sx of [-1, 1]) {
      const ax = bx + sx * brx * 1.05, aY = by - bry * 0.2 + ay * bry;
      K.ell(ax, aY, 3.4 * s * (F.has('muscles') ? 1.4 : 1), 6 * s, c0, sx * 0.5);
      if (F.has('fists')) K.circ(ax + sx * 2, aY + 5 * s, 3 * s, F.has('angry') && c1 !== '#f8fafc' ? c1 : c0);
      if (F.has('claws')) for (const k of [-1, 0, 1]) K.tri(ax + sx * 1.5 + k * 1.5, aY + 6 * s, 1.4, 2.5, '#f8fafc', 'down');
    }
    if (F.has('spoon')) K.line(bx - brx * 1.4, by + 2, bx - brx * 1.6, by - bry, '#9ca3af', 1.4);
    if (F.has('spoon2')) for (const sx of [-1, 1]) K.line(bx + sx * brx * 1.4, by + 2, bx + sx * brx * 1.7, by - bry, '#9ca3af', 1.4);
    if (F.has('bone')) { K.line(bx - brx * 1.3, by + 6, bx - brx * 1.7, by - bry * 0.7, '#f1eee3', 2.2); K.circ(bx - brx * 1.75, by - bry * 0.75, 2.2, '#f1eee3', true); }
    if (F.has('coin')) K.circ(bx - 1, by - bry - 7 * s, 3 * s, '#fbbf24');
    if (F.has('tailorb')) { /* tail() handles */ }
    if (F.has('fins')) K.tri(bx + 2, by - bry * 0.9, 6 * s, 9 * s, c0, 'up');
    if (F.has('shellbite')) K.ell(bx + brx * 1.2, by + bry * 0.6, 6 * s, 5 * s, '#9ca3af');
    const longneck = F.has('longneck');
    const hx = bx - 1, hy = by - bry - (longneck ? 12 : 8) * s, hr = (F.has('roundhead') ? 10 : 9) * s;
    if (longneck) K.rect(hx - 3 * s, hy, 6 * s, 12 * s, c0);
    if (F.has('gills')) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) K.ell(hx + sx * hr * 1.05, hy - hr * 0.3 + k * 2.5 * s, 2.6 * s, 1.1 * s, c2, sx * 0.3, true);
    K.circ(hx, hy, hr, c0);
    if (F.has('crest') && F.has('fists')) K.ell(hx, hy - hr * 0.8, hr * 0.35, hr * 0.5, shade(c0, -0.25));
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  humanoid(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 32, by = 38;
    tail(K, F, bx + 5 * s, by + 8 * s, 22 * s, c);
    for (const sx of [-1, 1]) K.rect(bx + sx * 3 * s - 1.5 * s, by + 8 * s, 3 * s, 13 * s, shade(c0, -0.15));
    K.ell(bx, by, 7 * s, 13 * s, F.has('tube') ? c1 : c0);
    if (F.has('tutu') || F.has('gown')) K.ell(bx, by + 8 * s, 11 * s, 4 * s, c0);
    if (F.has('tube')) K.line(bx + 2, by - 10 * s, bx + 6, by - 13 * s, c1, 2.5);
    for (const sx of [-1, 1]) { K.ell(bx + sx * 8 * s, by - 2 * s, 2.4 * s, 8 * s, c0, sx * 0.4); }
    if (F.has('spoon')) K.line(bx - 11 * s, by + 4, bx - 13 * s, by - 9 * s, '#9ca3af', 1.4);
    if (F.has('spoon2')) for (const sx of [-1, 1]) K.line(bx + sx * 11 * s, by + 4, bx + sx * 13 * s, by - 9 * s, '#9ca3af', 1.4);
    if (F.has('floaty')) { /* Meww floats: no ground shadow */ }
    const hx = bx, hy = by - 17 * s, hr = 7.5 * s;
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  dragon(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 33, by = 38;
    if (F.has('bigwings') || F.has('jetwings') || F.has('tinywings')) for (const sx of [-1, 1]) {
      const w = F.has('tinywings') ? 6 : 15;
      K.poly([[bx + sx * 4, by - 10 * s], [bx + sx * (4 + w) * s, by - (18 + w * 0.4) * s], [bx + sx * (6 + w * 0.9) * s, by - 2 * s], [bx + sx * 6, by - 4 * s]], F.has('jetwings') ? shade(c0, -0.2) : c2 === '#3b82c4' ? '#3b82c4' : shade(c0, -0.2), false);
    }
    tail(K, F, bx + 10 * s, by + 8 * s, 24 * s, c);
    K.curve([[bx + 8 * s, by + 8 * s], [bx + 18 * s, by + 12 * s], [bx + 24 * s, by + 6 * s]], c0, 4 * s);
    for (const sx of [-1, 1]) K.ell(bx + sx * 7 * s, by + 14 * s, 5 * s, 3 * s, shade(c0, -0.2));
    K.ell(bx, by, 12 * s, 14 * s, c0);
    if (c3) K.ell(bx - 1, by + 3, 7.5 * s, 9 * s, c3, 0, true);
    if (F.has('spikes')) for (let i = 0; i < 3; i++) K.tri(bx + 9 * s, by - 9 * s + i * 6 * s, 4 * s, 5 * s, '#e5e7eb', 'right');
    if (F.has('fins')) K.tri(bx + 2, by - 13 * s, 6 * s, 9 * s, c0, 'up');
    for (const sx of [-1, 1]) K.ell(bx + sx * 11 * s, by - 2 * s, 3 * s, 6 * s, c0, sx * 0.5);
    if (F.has('claws')) for (const sx of [-1, 1]) K.tri(bx + sx * 12 * s, by + 4 * s, 2.5 * s, 3 * s, '#f8fafc', 'down');
    const hx = bx - 6 * s, hy = by - 19 * s, hr = 8 * s;
    K.ell(hx - hr * 0.6, hy + hr * 0.3, hr * 0.8, hr * 0.5, c0);
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  turtle(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 34, by = 38;
    tail(K, F, bx + 12 * s, by + 8 * s, 18 * s, c);
    K.ell(bx + 4 * s, by - 2 * s, 14 * s, 13 * s, c1);
    K.ell(bx + 4 * s, by - 2 * s, 10 * s, 9 * s, shade(c1, 0.15), 0, true);
    if (F.has('rocky')) for (let i = 0; i < 6; i++) K.circ(bx + Math.cos(i) * 10 * s, by - 2 * s + Math.sin(i) * 9 * s, 3.5 * s, c1);
    if (F.has('cannons')) for (const sx of [-1, 1]) { K.rect(bx + sx * 6 * s - 2.5 * s, by - 20 * s, 5 * s, 9 * s, c2); K.circ(bx + sx * 6 * s, by - 20 * s, 2.6 * s, '#111827', true); }
    for (const sx of [-1, 1]) K.ell(bx + sx * 7 * s, by + 12 * s, 4.5 * s, 3 * s, c0);
    K.ell(bx - 2 * s, by + 2 * s, 9 * s, 11 * s, c3 || c0);
    for (const sx of [-1, 1]) K.ell(bx + sx * 10 * s - 2 * s, by, 3 * s, 5 * s, c0, sx * 0.5);
    const hx = bx - 6 * s, hy = by - 13 * s, hr = 8.5 * s;
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  larva(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    for (let i = 4; i >= 1; i--) K.circ(18 * s + 10 + i * 8 * s, 46 - i * 1.2 * s, (8 - i * 0.6) * s, i % 2 ? c0 : shade(c0, -0.1));
    for (let i = 1; i < 5; i++) K.circ(18 * s + 10 + i * 8 * s, 50, 2 * s, c3 || c1, true);
    const hx = 18 * s + 6, hy = 40, hr = 10 * s;
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  cocoon(K, c, F) {
    const [c0, c1] = c;
    K.poly([[32, 8], [44, 20], [46, 40], [38, 56], [26, 56], [18, 40], [20, 20]], c0, false);
    K.line(24, 30, 40, 26, c1, 1.5); K.line(24, 40, 40, 36, c1, 1.5);
    return { x: 30, y: 24, r: 7, dir: -1, faceOnly: true };
  },
  bug(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 32, by = 36;
    for (const sx of [-1, 1]) { K.ell(bx + sx * 13 * s, by - 10 * s, 11 * s, 8 * s, F.has('stripes') ? 'rgba(220,240,255,.9)' : c1, sx * 0.5); K.ell(bx + sx * 11 * s, by + 4 * s, 8 * s, 6 * s, F.has('stripes') ? 'rgba(220,240,255,.9)' : c1, -sx * 0.4); if (!F.has('stripes')) K.circ(bx + sx * 14 * s, by - 11 * s, 2.5 * s, c2, true); }
    K.ell(bx + 2, by + 8 * s, 6 * s, 9 * s, c0);
    if (F.has('stripes')) for (let i = 0; i < 3; i++) K.line(bx - 4, by + 4 * s + i * 3.5 * s, bx + 8, by + 4 * s + i * 3.5 * s, '#111827', 1.5);
    tail(K, F, bx + 2, by + 16 * s, 12 * s, c);
    K.ell(bx, by - 2, 5 * s, 6 * s, c0);
    const hx = bx - 2, hy = by - 11 * s, hr = 7 * s;
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  mantis(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 32, by = 36;
    for (const sx of [-1, 1]) K.ell(bx + sx * 9 * s, by - 6 * s, 9 * s, 5 * s, 'rgba(240,250,255,.85)', sx * 0.6);
    for (const sx of [-1, 1]) K.rect(bx + sx * 4 * s - 1.5, by + 10 * s, 3, 12 * s, c1);
    K.ell(bx + 3, by + 8 * s, 6 * s, 9 * s, c0);
    K.ell(bx, by - 4 * s, 5 * s, 9 * s, c0);
    for (const sx of [-1, 1]) K.poly([[bx + sx * 5 * s, by - 6 * s], [bx + sx * 14 * s, by - 2 * s], [bx + sx * 16 * s, by - 16 * s], [bx + sx * 12 * s, by - 4 * s]], '#f1f5f9');
    const hx = bx - 2, hy = by - 16 * s, hr = 6.5 * s;
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  bird(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 34, by = 36;
    if (F.has('longtail') || F.has('firemane')) K.poly([[bx + 8 * s, by], [bx + 26 * s, by + 4 * s], [bx + 24 * s, by - 6 * s]], F.has('firemane') ? '#f97316' : c1);
    else K.poly([[bx + 8 * s, by + 2], [bx + 18 * s, by + 8 * s], [bx + 17 * s, by - 2]], c0);
    for (const sx of [-1, 1]) K.line(bx + sx * 3 * s, by + 8 * s, bx + sx * 3 * s, by + 17 * s, '#f59e0b', 1.5);
    K.ell(bx, by, 12 * s, 9 * s, c0, -0.2);
    if (c3) K.ell(bx - 3 * s, by + 3 * s, 7 * s, 5 * s, c3, 0, true);
    if (F.has('bigwings')) for (const sx of [-1, 1]) K.poly([[bx + sx * 2, by - 4 * s], [bx + sx * 20 * s, by - 22 * s], [bx + sx * 22 * s, by - 6 * s], [bx + sx * 8 * s, by + 2]], F.has('firemane') ? '#f97316' : shade(c0, -0.1), false);
    else K.ell(bx + 3 * s, by - 1, 8 * s, 5 * s, shade(c0, -0.15), -0.3);
    if (F.has('firemane')) for (let i = 0; i < 3; i++) K.flame(bx - 10 * s + i * 4 * s, by - 14 * s, 5 * s);
    if (F.has('spikes')) for (let i = 0; i < 4; i++) K.tri(bx - 6 * s + i * 4 * s, by - 8 * s, 3 * s, 5 * s, c0);
    const hx = bx - 10 * s, hy = by - 9 * s, hr = 6.5 * s;
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  bat(K, c, F, s) {
    const [c0, c1] = c;
    const bx = 32, by = 32;
    const wn = F.has('wings4') ? [0, 1] : [0];
    for (const k of wn) for (const sx of [-1, 1]) K.poly([[bx + sx * 4, by - 2 + k * 8], [bx + sx * 26 * s, by - 14 * s + k * 12], [bx + sx * 22 * s, by + 2 + k * 10], [bx + sx * 15 * s, by - 2 + k * 10], [bx + sx * 9 * s, by + 6 + k * 8]], c1, false);
    K.ell(bx, by, 10 * s, 11 * s, c0);
    return { x: bx, y: by - 2, r: 9 * s, dir: 0 };
  },
  serpent(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const pts = Array.from({ length: 11 }, (_, i) => [50 - i * 2.6 * s * 0.7 - 6, 54 - i * 3.2 * s * 0.55 + Math.sin(i * 0.9) * 6 * s * 0.4]);
    const r0 = (F.has('boulders') ? 7 : 6) * Math.min(1.25, s * 0.6 + 0.5);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const r = r0 * (0.6 + i * 0.04);
      if (F.has('boulders')) K.circ(x, y, r, i % 2 ? c0 : shade(c0, -0.12));
      else { K.circ(x, y, r, c0); K.circ(x - r * 0.15, y + r * 0.35, r * 0.55, c3 || c1, true); }
    }
    if (F.has('rattle')) K.circ(pts[0][0] + 3, pts[0][1] - 2, 3, c1);
    const [hx, hy] = pts[pts.length - 1];
    const hr = r0 * 1.25;
    if (F.has('hood')) K.ell(hx, hy + hr * 0.6, hr * 1.7, hr * 1.4, c0);
    return { x: hx - 1, y: hy - 2, r: hr, dir: -1 };
  },
  blob(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 32, by = 37, r = 16 * Math.min(1.25, s * 0.55 + 0.45);
    if (F.has('tinywings')) for (const sx of [-1, 1]) K.ell(bx + sx * r * 0.95, by - r * 0.5, r * 0.35, r * 0.2, '#f8fafc', sx * 0.6);
    if (F.has('spikes')) for (let i = 0; i < 5; i++) K.tri(bx - r * 0.6 + i * r * 0.3, by - r * 0.85, r * 0.3, r * 0.4, c0);
    for (const sx of [-1, 1]) K.ell(bx + sx * r * 0.5, by + r * 0.9, r * 0.35, r * 0.18, shade(c0, -0.2));
    if (F.has('goo')) K.ell(bx, by + r * 0.6, r * 1.3, r * 0.5, c0);
    K.ell(bx, by, r, r * (F.has('goo') ? 0.8 : 1), c0);
    if (F.has('belly')) K.ell(bx, by + r * 0.3, r * 0.75, r * 0.6, c1, 0, true);
    for (const sx of [-1, 1]) K.ell(bx + sx * r * 0.95, by + r * 0.1, r * 0.25, r * 0.15, c0, sx * 0.8);
    const hr = r * 0.65;
    return { x: bx, y: by - r * 0.15, r: hr, dir: 0, headless: true, hy0: by - r * 0.7 };
  },
  plant(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 32, by = 42, r = 10 * (0.6 + s * 0.4);
    if (F.has('leaves')) for (const a of [-0.6, 0, 0.6]) K.leaf(bx, by - r * 0.8, 5, 18 * s + 6, a, c1);
    if (F.has('bigflower')) for (let i = 0; i < 5; i++) K.ell(bx + Math.cos(i * 1.26) * 11, by - r - 6 + Math.sin(i * 1.26) * 4, 8, 4, c1, i * 1.26);
    if (F.has('rafflesia')) { for (let i = 0; i < 5; i++) K.ell(bx + Math.cos(i * 1.26) * 13, by - r - 7 + Math.sin(i * 1.26) * 5, 9, 5, c1, i * 1.26); for (let i = 0; i < 5; i++) K.circ(bx + Math.cos(i * 1.26) * 13, by - r - 7 + Math.sin(i * 1.26) * 5, 2, c2, true); K.circ(bx, by - r - 7, 4, '#fde047'); }
    for (const sx of [-1, 1]) K.ell(bx + sx * r * 0.45, by + r * 0.95, r * 0.35, r * 0.2, shade(c0, -0.2));
    K.circ(bx, by, r, c0);
    if (F.has('drool')) K.ell(bx - 2, by + r * 0.55, 1.2, 2.5, '#fde047', 0, true);
    return { x: bx, y: by, r: r * 0.85, dir: 0, headless: true, hy0: by - r };
  },
  mole(K, c, F, s) {
    const [c0, c1] = c;
    const xs = F.has('triple') ? [22, 42, 32] : [32];
    K.ell(32, 54, 22, 6, '#8b5a2b'); K.ell(32, 52, 18, 4, '#a0703a', 0, true);
    for (const x of xs) { const y = x === 32 && xs.length > 1 ? 34 : 40; K.ell(x, y, 8, 12, c0); }
    const x0 = xs[xs.length - 1];
    return { x: x0, y: xs.length > 1 ? 30 : 36, r: 7, dir: 0, many: xs.length > 1 ? xs.map((x) => [x, x === 32 ? 30 : 36]) : null };
  },
  jelly(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 32, by = 28;
    const n = F.has('bigtentacles') ? 8 : 4;
    for (let i = 0; i < n; i++) K.curve([[bx - 10 + i * (20 / (n - 1)), by + 6], [bx - 12 + i * (24 / (n - 1)) + Math.sin(i) * 3, by + 18], [bx - 10 + i * (20 / (n - 1)), by + 30]], c0, 2.4);
    K.ell(bx, by, 14 * s * 0.8 + 3, 11, c2 || c0);
    const gems = F.has('gems3') ? 3 : 2;
    for (let i = 0; i < gems; i++) K.circ(bx - 6 + i * (12 / Math.max(1, gems - 1)), by - 2, 3, c1);
    return { x: bx, y: by + 5, r: 7, dir: 0, headless: true, hy0: by - 6, noFace: true };
  },
  rock(K, c, F, s) {
    const [c0, c1] = c;
    const bx = 32, by = 38, r = 14 * (0.65 + s * 0.35);
    const arms = F.has('arms4') ? [-0.3, 0.3] : [0];
    for (const a of arms) for (const sx of [-1, 1]) { K.ell(bx + sx * r * 1.25, by + a * r, r * 0.35, r * 0.25, c0); K.circ(bx + sx * r * 1.6, by + a * r + 2, r * 0.32, c0); }
    K.poly(Array.from({ length: 12 }, (_, i) => [bx + Math.cos(i / 12 * Math.PI * 2) * r * (0.9 + (i % 3) * 0.08), by + Math.sin(i / 12 * Math.PI * 2) * r * (0.85 + (i % 2) * 0.1)]), c0, false);
    if (F.has('rocky')) for (let i = 0; i < 5; i++) K.circ(bx - r * 0.6 + i * r * 0.3, by - r * 0.85, r * 0.25, c1);
    return { x: bx, y: by, r: r * 0.85, dir: 0, headless: true, hy0: by - r };
  },
  horse(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 36, by = 34;
    const mane = F.has('rainbowmane') ? ['#f9a8d4', '#a78bfa', '#93c5fd'] : null;
    if (F.has('firemane') || mane) for (let i = 0; i < 3; i++) K.flame(bx + 14 * s + i * 2, by - 2 + i * 2, 7 * s, mane ? mane[i] : '#f97316');
    for (const lx of [bx + 10 * s, bx - 8 * s]) K.rect(lx - 2, by + 4 * s, 4 * s, 16 * s, shade(c0, -0.2));
    K.ell(bx, by, 14 * s, 8 * s, c0);
    for (const lx of [bx + 7 * s, bx - 11 * s]) { K.rect(lx - 2, by + 5 * s, 4 * s, 16 * s, c0); K.rect(lx - 2, by + 18 * s, 4 * s, 3 * s, '#f8e5b0'); }
    K.poly([[bx - 10 * s, by - 2 * s], [bx - 16 * s, by - 16 * s], [bx - 10 * s, by - 18 * s], [bx - 4 * s, by - 4 * s]], c0, false);
    if (F.has('firemane') || mane) for (let i = 0; i < 4; i++) K.flame(bx - 8 * s + i * 2, by - 6 * s - i * 3 * s, 6 * s, mane ? mane[i % 3] : '#f97316');
    const hx = bx - 16 * s, hy = by - 18 * s, hr = 6 * s;
    K.ell(hx - 3 * s, hy + 2 * s, 6 * s, 4 * s, c0, 0.4);
    K.circ(hx, hy, hr, c0);
    return { x: hx, y: hy, r: hr, dir: -1 };
  },
  orb(K, c, F, s) {
    const [c0, c1, c2] = c;
    const list = F.has('triple') ? [[32, 22, 9], [20, 42, 9], [44, 42, 9]] : F.has('twin') ? [[24, 30, 11], [42, 40, 8]] : [[32, 34, 12 * Math.min(1.4, s * 0.6 + 0.6)]];
    for (const [x, y, r] of list) {
      if (F.has('magnets')) for (const sx of [-1, 1]) { K.rect(x + sx * r * 1.15 - 2, y - 3, 4, 7, '#dc2626'); K.rect(x + sx * r * 1.15 - 2, y + 3, 4, 2, '#93c5fd'); }
      if (F.has('pokeball')) { K.circ(x, y, r, c1); g_halfTop(K, x, y, r, c0); K.rect(x - r, y - 0.8, r * 2, 1.6, '#111827'); }
      else K.circ(x, y, r, c0);
      if (F.has('screws')) K.circ(x, y - r - 1, 1.6, '#9ca3af', true);
      if (F.has('craters')) for (const [dx, dy] of [[-0.4, 0.3], [0.45, -0.2], [0.1, 0.55]]) K.circ(x + dx * r, y + dy * r, r * 0.13, shade(c0, -0.25), true);
      if (F.has('skull')) { K.circ(x, y + r * 0.35, r * 0.18, '#fde047', true); K.line(x - r * 0.25, y + r * 0.6, x + r * 0.25, y + r * 0.6, '#fde047', 1); }
    }
    if (F.has('smoke')) for (let i = 0; i < 5; i++) K.circ(20 + i * 6, 14 + (i % 2) * 3, 3, 'rgba(200,190,140,.8)');
    const [x, y, r] = list[0];
    return { x, y: y - (F.has('pokeball') ? r * 0.15 : 0), r: r * 0.85, dir: 0, many: list.length > 1 ? list.map(([a, b, rr]) => [a, b, rr * 0.85]) : null };
  },
  ghost(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 32, by = 30, r = 13 * Math.min(1.3, s * 0.4 + 0.75);
    if (F.has('disguise')) {
      K.poly([[bx - r, by + 20], [bx - r * 0.9, by - r * 0.4], [bx, by - r * 1.1], [bx + r * 0.9, by - r * 0.4], [bx + r, by + 20], [bx + r * 0.4, by + 16], [bx, by + 20], [bx - r * 0.4, by + 16]], c0, false);
      K.tri(bx - r * 0.45, by - r * 0.9, r * 0.4, r * 0.9, c0); K.poly([[bx + r * 0.2, by - r * 1.0], [bx + r * 0.9, by - r * 1.4], [bx + r * 0.6, by - r * 0.6]], c0);
      K.curve([[bx - 5, by + 1], [bx, by + 4], [bx + 5, by + 1]], '#111827', 1);
      K.circ(bx - 4, by - 4, 1.4, '#111827', true); K.circ(bx + 4, by - 4, 1.4, '#111827', true);
      K.circ(bx - 6, by - 1, 1.6, '#f472b6', true); K.circ(bx + 6, by - 1, 1.6, '#f472b6', true);
      K.ell(bx + 2, by + 18, 3, 1.5, '#111827', 0, true);
      return { x: bx, y: by, r, dir: 0, noFace: true };
    }
    if (F.has('gasaura')) { K.circ(bx, by, r * 1.42, '#4c1d95', true); K.circ(bx, by, r * 1.22, '#6d28d9', true); }
    if (F.has('hands')) for (const sx of [-1, 1]) K.ell(bx + sx * r * 1.6, by + r * 0.5, r * 0.35, r * 0.45, c0, sx * 0.3);
    if (F.has('spikes')) for (let i = 0; i < 5; i++) K.tri(bx - r * 0.7 + i * r * 0.35, by - r * 0.8, r * 0.35, r * 0.55, c0);
    K.circ(bx, by, r, c0);
    return { x: bx, y: by, r: r * 0.9, dir: 0 };
  },
  fish(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 34, by = 36;
    K.poly([[bx + 12 * s, by], [bx + 24 * s, by - 9 * s], [bx + 24 * s, by + 9 * s]], c1);
    K.ell(bx, by, 14 * s, 10 * s, c0);
    K.tri(bx, by - 9 * s, 6 * s, 8 * s, c1);
    K.ell(bx + 2, by + 4 * s, 4 * s, 3 * s, c1, 0.5);
    return { x: bx - 6 * s, y: by - 2 * s, r: 6 * s, dir: -1 };
  },
  plesio(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 36, by = 42;
    for (const sx of [-1, 1]) K.ell(bx + sx * 12, by + 6, 6, 3, c0, sx * 0.4);
    K.ell(bx, by, 16, 9, c3);
    K.ell(bx + 2, by - 5, 15, 9, c1);
    for (let i = 0; i < 5; i++) K.tri(bx - 8 + i * 5, by - 12, 3, 4, shade(c1, -0.2));
    K.poly([[bx - 12, by - 2], [bx - 18, by - 22], [bx - 13, by - 24], [bx - 6, by - 4]], c0, false);
    return { x: bx - 17, y: by - 26, r: 6, dir: -1 };
  },
  egg(K, c, F, s) {
    const [c0, c1, c2] = c;
    const bx = 32, by = 40;
    for (const sx of [-1, 1]) K.ell(bx + sx * 8, by + 10, 3, 2, '#fde68a');
    K.ell(bx, by + 2, 10, 12, c0);
    for (const [x, y, col] of [[-5, 0, c1], [4, 6, c2], [3, -4, c1]]) K.tri(bx + x, by + y + 2, 4, 3.5, col);
    const hx = bx, hy = by - 13, hr = 6.5;
    K.circ(hx, hy, hr, '#fde68a');
    return { x: hx, y: hy, r: hr, dir: 0 };
  },
  frog(K, c, F, s) {
    const [c0, c1, c2, c3] = c;
    const bx = 32, by = 42;
    const tall = F.has('tall');
    for (const sx of [-1, 1]) K.ell(bx + sx * 9 * s, by + 10 * s, 6 * s, 3 * s, c0);
    K.ell(bx, by - (tall ? 4 : 0), 10 * s, (tall ? 15 : 11) * s, c0);
    if (F.has('bubbles') || F.has('tongue')) { if (F.has('tongue')) K.ell(bx, by - 10 * s, 9 * s, 3 * s, c2); else for (let i = 0; i < 5; i++) K.circ(bx - 8 * s + i * 4 * s, by - 9 * s, 3 * s, '#f8fafc'); }
    const hx = bx, hy = by - (tall ? 22 : 15) * s, hr = 8 * s;
    K.circ(hx, hy, hr, c0);
    if (F.has('star')) { /* headgear */ }
    return { x: hx, y: hy, r: hr, dir: 0, bigFrogEyes: true };
  },
};
function g_halfTop(K, x, y, r, col) { K.poly(Array.from({ length: 13 }, (_, i) => [x - r * Math.cos(i / 12 * Math.PI), y - r * Math.sin(i / 12 * Math.PI)]), col, false); }

// Posterise: hard alpha edges + dark outline.
function posterise(cv, outline = '#140c1c') {
  const g = cv.getContext('2d');
  const img = g.getImageData(0, 0, N, N), d = img.data;
  const solid = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const a = d[i * 4 + 3];
    if (a >= 110) { solid[i] = 1; const k = 255 / a; d[i * 4] = Math.min(255, d[i * 4] * k); d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] * k); d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * k); d[i * 4 + 3] = 255; } else d[i * 4 + 3] = 0;
  }
  const [or, og, ob] = hex(outline);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < N - 1 && solid[i + 1]) || (y > 0 && solid[i - N]) || (y < N - 1 && solid[i + N])) { d[i * 4] = or; d[i * 4 + 1] = og; d[i * 4 + 2] = ob; d[i * 4 + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
}

// The sprite for a species. back = the player's side.
export function spriteCanvas(id, { back = false, shiny = false } = {}) {
  const key = `${id}|${back ? 'b' : 'f'}|${shiny ? 's' : ''}`;
  if (cache.has(key)) return cache.get(key);
  const sp = SPECIES[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  if (sp) {
    const c = palette(sp, shiny);
    const F = new Set(sp.look.f);
    const s = Math.max(0.7, Math.min(1.25, 0.72 + sp.look.size * 0.22));
    const K = kit(g, c);
    const draw = FORMS[sp.look.form] || FORMS.blob;
    const h = draw(K, c, F, s);
    const heads = h.many || [[h.x, h.y, h.r]];
    for (const [hx, hy, hr] of heads.map((m) => [m[0], m[1], m[2] ?? h.r])) {
      if (!h.headless && !h.faceOnly && !h.noFace) headgear(K, F, hx, hy, hr, c, back);
      else if (h.headless) headgear(K, F, hx, h.hy0 ?? hy - hr, hr, c, back);
      if (!back && !h.noFace) {
        if (h.bigFrogEyes) { for (const sx of [-1, 1]) { K.circ(hx + sx * hr * 0.55, hy - hr * 0.7, hr * 0.4, c[0]); K.circ(hx + sx * hr * 0.55, hy - hr * 0.7, hr * 0.25, '#f8fafc', true); K.circ(hx + sx * hr * 0.55, hy - hr * 0.65, hr * 0.13, '#111827', true); } K.curve([[hx - hr * 0.4, hy + hr * 0.2], [hx, hy + hr * 0.35], [hx + hr * 0.4, hy + hr * 0.2]], '#111827', 1); if (F.has('star')) K.circ(hx, hy - hr * 0.1, hr * 0.15, '#ec4899', true); }
        else face(K, F, hx, hy, hr, c, h.dir ?? -1);
      }
    }
    if (shiny && !back) for (const [x, y] of [[10, 10], [52, 14], [48, 50]]) { K.rect(x - 0.5, y - 2, 1, 4, '#fff7c2'); K.rect(x - 2, y - 0.5, 4, 1, '#fff7c2'); }
    posterise(cv);
    if (back) { const t = document.createElement('canvas'); t.width = t.height = N; const tg = t.getContext('2d'); tg.translate(N, 0); tg.scale(-1, 1); tg.drawImage(cv, 0, 0); cache.set(key, t); return t; }
  }
  cache.set(key, cv);
  return cv;
}
export function spriteURL(id, o) { const k = 'url|' + id + JSON.stringify(o || {}); if (cache.has(k)) return cache.get(k); const u = spriteCanvas(id, o).toDataURL(); cache.set(k, u); return u; }

// Pure white silhouette (evolution flashes).
export function silhouette(id) {
  const key = id + '|sil';
  if (cache.has(key)) return cache.get(key);
  const src = spriteCanvas(id);
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, N, N);
  cache.set(key, cv);
  return cv;
}
export const SPRITE_SIZE = N;

// Item icons for the Bag (Poké Balls, potions, stones…), drawn the same way.
const ITEM_ART = {
  pokeBall: (K) => { K.circ(32, 32, 20, '#f8fafc'); K.poly(Array.from({ length: 13 }, (_, i) => [32 - 20 * Math.cos(i / 12 * Math.PI), 32 - 20 * Math.sin(i / 12 * Math.PI)]), '#ef4444', false); K.rect(12, 30, 40, 4, '#111827'); K.circ(32, 32, 6, '#111827', true); K.circ(32, 32, 4, '#f8fafc', true); },
  greatBall: (K) => { ITEM_ART.pokeBall(K); K.poly(Array.from({ length: 13 }, (_, i) => [32 - 20 * Math.cos(i / 12 * Math.PI), 32 - 20 * Math.sin(i / 12 * Math.PI)]), '#3b82f6', false); K.rect(17, 17, 7, 6, '#ef4444'); K.rect(40, 17, 7, 6, '#ef4444'); K.rect(12, 30, 40, 4, '#111827'); K.circ(32, 32, 6, '#111827', true); K.circ(32, 32, 4, '#f8fafc', true); },
  ultraBall: (K) => { ITEM_ART.pokeBall(K); K.poly(Array.from({ length: 13 }, (_, i) => [32 - 20 * Math.cos(i / 12 * Math.PI), 32 - 20 * Math.sin(i / 12 * Math.PI)]), '#1f2937', false); K.rect(20, 14, 6, 14, '#fde047'); K.rect(38, 14, 6, 14, '#fde047'); K.rect(12, 30, 40, 4, '#111827'); K.circ(32, 32, 6, '#111827', true); K.circ(32, 32, 4, '#f8fafc', true); },
  masterBall: (K) => { ITEM_ART.pokeBall(K); K.poly(Array.from({ length: 13 }, (_, i) => [32 - 20 * Math.cos(i / 12 * Math.PI), 32 - 20 * Math.sin(i / 12 * Math.PI)]), '#7c3aed', false); K.circ(24, 21, 3.5, '#ec4899', true); K.circ(40, 21, 3.5, '#ec4899', true); K.rect(12, 30, 40, 4, '#111827'); K.circ(32, 32, 6, '#111827', true); K.circ(32, 32, 4, '#f8fafc', true); },
  potion: (K, col = '#a855f7') => { K.rect(26, 10, 12, 8, '#9ca3af'); K.ell(32, 36, 16, 18, '#e0f2fe'); K.ell(32, 40, 13, 13, col); K.rect(22, 28, 20, 5, '#f8fafc'); },
  superPotion: (K) => ITEM_ART.potion(K, '#ef4444'),
  hyperPotion: (K) => ITEM_ART.potion(K, '#ec4899'),
  revive: (K) => { K.poly([[32, 10], [38, 26], [54, 32], [38, 38], [32, 54], [26, 38], [10, 32], [26, 26]], '#fde047'); K.circ(32, 32, 6, '#facc15'); },
  rareCandy: (K) => { K.tri(16, 32, 12, 10, '#93c5fd', 'left'); K.tri(48, 32, 12, 10, '#93c5fd', 'right'); K.circ(32, 32, 12, '#60a5fa'); K.rect(22, 30, 20, 4, '#f8fafc'); },
  fireStone: (K) => { K.poly([[32, 10], [50, 30], [42, 54], [22, 54], [14, 30]], '#f97316', false); K.flame(32, 44, 12, '#ef4444'); },
  waterStone: (K) => { K.poly([[32, 10], [50, 30], [42, 54], [22, 54], [14, 30]], '#3b82f6', false); K.ell(32, 38, 6, 9, '#bfdbfe', 0, true); },
  thunderStone: (K) => { K.poly([[32, 10], [50, 30], [42, 54], [22, 54], [14, 30]], '#84cc16', false); K.poly([[34, 18], [26, 34], [32, 34], [28, 48], [40, 28], [33, 28]], '#fde047'); },
  leafStone: (K) => { K.poly([[32, 10], [50, 30], [42, 54], [22, 54], [14, 30]], '#65a30d', false); K.leaf(32, 48, 8, 26, 0, '#bef264'); },
  moonStone: (K) => { K.poly([[20, 12], [48, 18], [52, 44], [30, 54], [12, 36]], '#57534e', false); K.circ(30, 30, 6, '#d6d3d1', true); K.circ(40, 40, 3, '#d6d3d1', true); },
  escapeRope: (K) => { K.curve([[14, 50], [24, 20], [40, 44], [50, 14]], '#a16207', 5); },
};
export function itemCanvas(id) {
  const key = 'itemcv|' + id;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const K = kit(g, []);
  (ITEM_ART[id] || ITEM_ART.potion)(K);
  posterise(cv);
  cache.set(key, cv);
  return cv;
}
export function itemSprite(id) {
  const key = 'item|' + id;
  if (cache.has(key)) return cache.get(key);
  const url = itemCanvas(id).toDataURL();
  cache.set(key, url);
  return url;
}
