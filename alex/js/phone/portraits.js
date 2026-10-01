// Illustrated caller portraits, painted on a 2D canvas: layered gradients for light
// and shade, glossy anime eyes, hair sheen, bokeh backgrounds. Portraits blink, talk
// (mouth flaps while a line is typing) and change expression with the caller's mood.
// If img/manifest.json lists a portrait image for a caller, that image is used instead.

const PI = Math.PI;
const overrides = {};

// Optional hand-made / generated art: img/manifest.json → { "portraits": { "gf": "portraits/gf.png" } }
export async function loadPortraitOverrides(base = 'img/') {
  try {
    const res = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const m = await res.json();
    for (const [k, file] of Object.entries(m.portraits || {})) {
      const img = new Image();
      img.onload = () => { overrides[k] = img; };
      img.src = base + file;
    }
  } catch { /* no manifest: procedural portraits */ }
}

function seeded(n) { let s = n | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 10000) / 10000; }; }

export function drawPortrait(key, g, s, t = 0, o = {}) {
  g.save();
  g.clearRect(0, 0, s, s);
  const img = overrides[key];
  if (img) {
    const bob = o.talk ? Math.sin(t * 16) * 0.012 * s : 0;
    const k = Math.max(s / img.width, s / img.height);
    g.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2 + bob, img.width * k, img.height * k);
    if (o.mood === 'angry') { g.fillStyle = 'rgba(255,0,40,.18)'; g.fillRect(0, 0, s, s); }
    g.restore();
    return;
  }
  g.scale(s / 100, s / 100);
  const P = makePainter(g, t, o);
  (ART[key] || ART.alex)(P, g, t, o);
  // soft vignette + glass sheen
  const v = g.createRadialGradient(50, 50, 30, 50, 50, 72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
  g.fillStyle = v; g.fillRect(0, 0, 100, 100);
  const sh = g.createLinearGradient(0, 0, 100, 100);
  sh.addColorStop(0, 'rgba(255,255,255,.16)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fillRect(0, 0, 100, 100);
  g.restore();
}

function makePainter(g, t, o) {
  const blink = (Math.sin(t * 1.25) > 0.985) || (Math.sin(t * 0.7 + 2) > 0.995);
  const talk = o.talk ? (Math.sin(t * 19) > -0.2 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 11)) : 0.12) : 0;
  const mood = o.mood || 'neutral';
  const P = {
    blink, talk, mood,
    ell(x, y, rx, ry, fill, rot = 0) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, PI * 2); g.fill(); },
    circ(x, y, r, fill) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); },
    radial(x, y, r0, r1, stops, ox = 0, oy = 0) { const gr = g.createRadialGradient(x + ox, y + oy, r0, x, y, r1); stops.forEach(([k, c]) => gr.addColorStop(k, c)); return gr; },
    linear(x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([k, c]) => gr.addColorStop(k, c)); return gr; },
    path(pts, fill, stroke, lw = 1) {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) g.quadraticCurveTo(p[0], p[1], p[2], p[3]); else if (p.length === 6) g.bezierCurveTo(...p); else g.lineTo(p[0], p[1]); }
      g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    },
    // background: gradient + bokeh discs
    bg(c0, c1, bokeh, seed = 1) {
      g.fillStyle = P.linear(0, 0, 0, 100, [[0, c0], [1, c1]]); g.fillRect(0, 0, 100, 100);
      const r = seeded(seed);
      for (let i = 0; i < 14; i++) {
        const x = r() * 100, y = r() * 100, rr = 3 + r() * 9, c = bokeh[i % bokeh.length];
        const drift = Math.sin(t * 0.6 + i) * 2;
        g.fillStyle = P.radial(x + drift, y, 0, rr, [[0, c], [1, 'rgba(255,255,255,0)']]);
        g.globalAlpha = 0.35 + r() * 0.35; g.beginPath(); g.arc(x + drift, y, rr, 0, PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    },
    // face: shaded skin oval with a soft jaw
    face(x, y, rx, ry, light, dark) {
      g.fillStyle = P.radial(x, y, 2, Math.max(rx, ry) * 1.1, [[0, light], [0.75, light], [1, dark]], -rx * 0.25, -ry * 0.35);
      g.beginPath();
      g.moveTo(x - rx, y - ry * 0.25);
      g.bezierCurveTo(x - rx, y - ry * 1.15, x + rx, y - ry * 1.15, x + rx, y - ry * 0.25);
      g.bezierCurveTo(x + rx, y + ry * 0.55, x + rx * 0.35, y + ry, x, y + ry);
      g.bezierCurveTo(x - rx * 0.35, y + ry, x - rx, y + ry * 0.55, x - rx, y - ry * 0.25);
      g.fill();
    },
    neck(x, y, w, h, light, dark) { g.fillStyle = P.linear(x - w, y, x + w, y, [[0, dark], [0.5, light], [1, dark]]); g.fillRect(x - w, y, w * 2, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - w, y, w * 2, h * 0.35); },
    blush(x, y, r = 5, c = 'rgba(255,90,140,.45)') { P.ell(x, y, r, r * 0.55, P.radial(x, y, 0, r, [[0, c], [1, 'rgba(255,90,140,0)']])); },
    eye(x, y, w, h, iris, o2 = {}) {
      const look = o2.look ?? Math.sin(t * 0.5) * 0.6;
      const tilt = o2.tilt ?? 0;
      if (P.blink || o2.closed) {
        g.strokeStyle = o2.line || '#1b1023'; g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - w, y + 1); g.quadraticCurveTo(x, y + (P.mood === 'happy' ? -3 : 3), x + w, y + 1); g.stroke();
        return;
      }
      const squint = P.mood === 'happy' ? 0.7 : P.mood === 'angry' ? 0.8 : P.mood === 'shock' ? 1.25 : 1;
      const hh = h * squint;
      g.save();
      g.beginPath(); g.ellipse(x, y, w, hh, tilt, 0, PI * 2); g.clip();
      g.fillStyle = '#fbf8ff'; g.fillRect(x - w, y - hh, w * 2, hh * 2);
      const ix = x + look, ir = Math.min(w * 0.72, h * 0.95);
      g.fillStyle = P.radial(ix, y, ir * 0.1, ir, [[0, o2.inner || '#fff'], [0.35, iris], [1, o2.irisDark || '#140a26']], 0, -ir * 0.4);
      g.beginPath(); g.arc(ix, y + 0.5, ir, 0, PI * 2); g.fill();
      if (o2.slit) P.ell(ix, y + 0.5, ir * 0.18, ir * 0.85, '#0a0610'); else P.circ(ix, y + 0.6, ir * 0.42, '#0d0614');
      if (o2.glow) { g.fillStyle = P.radial(ix, y, 0, ir * 1.6, [[0, o2.glow], [1, 'rgba(0,0,0,0)']]); g.fillRect(ix - ir * 2, y - ir * 2, ir * 4, ir * 4); }
      P.circ(ix - ir * 0.35, y - ir * 0.4, ir * 0.3, 'rgba(255,255,255,.95)');
      P.circ(ix + ir * 0.35, y + ir * 0.35, ir * 0.13, 'rgba(255,255,255,.8)');
      g.fillStyle = 'rgba(40,10,60,.22)'; g.fillRect(x - w, y - hh, w * 2, hh * 0.45);
      g.restore();
      // lash line
      g.strokeStyle = o2.line || '#1b1023'; g.lineWidth = o2.lash || 1.8; g.lineCap = 'round';
      g.beginPath(); g.ellipse(x, y, w * 1.02, hh * 1.02, tilt, PI * 1.05, PI * 1.95); g.stroke();
      if (o2.lashes) { g.lineWidth = 1.1; g.beginPath(); g.moveTo(x + w * 0.95, y - hh * 0.5); g.lineTo(x + w * 1.35, y - hh * 0.95); g.moveTo(x - w * 0.95, y - hh * 0.5); g.lineTo(x - w * 1.35, y - hh * 0.95); g.stroke(); }
    },
    brow(x, y, w, side, color = '#2a1a12', thick = 1.6) {
      const m = P.mood;
      const lift = m === 'angry' ? -2.2 : m === 'sad' ? 2.2 : m === 'shock' ? -2 : m === 'happy' ? -0.6 : 0;
      g.strokeStyle = color; g.lineWidth = thick; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - w * side, y + (side < 0 ? 0 : 0) - lift * 0.2); g.quadraticCurveTo(x, y - 2 - (m === 'shock' ? 2 : 0), x + w * side, y + lift); g.stroke();
    },
    mouth(x, y, w, o2 = {}) {
      const open = P.talk;
      const m = P.mood;
      const lip = o2.lip || '#c9184a';
      if (open > 0.15) {
        const hgt = 1.2 + open * (o2.big || 4.5);
        g.fillStyle = '#4a0d1e'; g.beginPath(); g.ellipse(x, y + hgt * 0.35, w * (0.55 + open * 0.2), hgt, 0, 0, PI * 2); g.fill();
        g.fillStyle = '#ff7a90'; g.beginPath(); g.ellipse(x, y + hgt * 0.9, w * 0.35, hgt * 0.4, 0, 0, PI * 2); g.fill();
        if (o2.teeth !== false) { g.fillStyle = '#fff'; g.fillRect(x - w * 0.45, y - hgt * 0.6, w * 0.9, Math.min(1.3, hgt * 0.4)); }
        if (o2.fang) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + w * 0.3, y - hgt * 0.6); g.lineTo(x + w * 0.45, y - hgt * 0.6); g.lineTo(x + w * 0.37, y + 0.8); g.fill(); }
        return;
      }
      g.strokeStyle = lip; g.lineWidth = o2.lw || 1.6; g.lineCap = 'round';
      g.beginPath();
      if (m === 'happy') { g.moveTo(x - w, y - 1); g.quadraticCurveTo(x, y + 4.5, x + w, y - 1); }
      else if (m === 'angry') { g.moveTo(x - w * 0.8, y + 1.5); g.quadraticCurveTo(x, y - 1.5, x + w * 0.8, y + 1.5); }
      else if (m === 'sad') { g.moveTo(x - w * 0.7, y + 1.8); g.quadraticCurveTo(x, y - 0.8, x + w * 0.7, y + 1.8); }
      else if (m === 'shock') { g.ellipse(x, y + 1, w * 0.35, 2.2, 0, 0, PI * 2); }
      else if (o2.smirk) { g.moveTo(x - w * 0.7, y + 0.6); g.quadraticCurveTo(x + w * 0.2, y + 1.6, x + w, y - 1.6); }
      else { g.moveTo(x - w * 0.75, y); g.quadraticCurveTo(x, y + 2.2, x + w * 0.75, y); }
      g.stroke();
      if (o2.gloss && m !== 'shock') { g.fillStyle = 'rgba(255,255,255,.55)'; P.ell(x - w * 0.2, y + 0.8, w * 0.22, 0.45, 'rgba(255,255,255,.5)'); }
    },
    nose(x, y, c = 'rgba(120,60,40,.45)') { g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 0.6, y - 3); g.quadraticCurveTo(x + 1.8, y, x - 0.6, y + 0.8); g.stroke(); },
    sheen(x, y, w, h, rot = -0.3) { g.save(); g.globalAlpha = 0.35; P.ell(x, y, w, h, P.linear(x - w, y, x + w, y, [[0, 'rgba(255,255,255,0)'], [0.5, '#fff'], [1, 'rgba(255,255,255,0)']]), rot); g.restore(); },
    sparkle(x, y, r, c = '#fff') { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2, q = i % 2 ? r * 0.25 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.fill(); },
  };
  return P;
}

const ART = {
  gf(P, g, t) {
    P.bg('#ffc2dd', '#d61f69', ['#fff', '#ffd6e8', '#ff8fc0'], 3);
    // back hair
    P.path([[20, 40], [14, 70, 18, 98], [82, 98], [86, 70, 80, 40], [50, 6, 20, 40]], P.linear(0, 20, 0, 100, [[0, '#7a3b26'], [1, '#4a1e12']]));
    // shoulders / top
    P.path([[12, 100], [16, 84, 32, 80], [68, 80], [84, 84, 88, 100]], P.linear(0, 80, 0, 100, [[0, '#ffffff'], [1, '#ffd0e4']]));
    P.path([[30, 82], [50, 92, 70, 82], [70, 86], [50, 96, 30, 86]], '#ff4fa3');
    P.neck(50, 66, 6, 16, '#f6d2b8', '#d9a98a');
    P.face(50, 52, 19, 21, '#ffe3cf', '#e3ad8f');
    P.blush(38, 60); P.blush(62, 60);
    P.eye(41.5, 52, 5.2, 4.4, '#a0522d', { lashes: true, inner: '#ffd9a8' });
    P.eye(58.5, 52, 5.2, 4.4, '#a0522d', { lashes: true, inner: '#ffd9a8' });
    P.brow(41.5, 45, 5, -1, '#5c2a18'); P.brow(58.5, 45, 5, 1, '#5c2a18');
    P.nose(50, 59);
    P.mouth(50, 65.5, 4.6, { lip: '#e0245e', gloss: true, lw: 2 });
    // bangs
    P.path([[29, 46], [30, 26, 50, 24], [70, 24, 72, 46], [66, 34, 58, 36], [52, 40, 46, 33], [40, 38, 33, 40]], P.linear(0, 24, 0, 46, [[0, '#8a4630'], [1, '#5e2c1c']]));
    P.sheen(46, 30, 12, 2.4);
    // heart clip + earrings
    g.save(); g.translate(66, 33); g.rotate(0.4); g.fillStyle = '#ff2e7e';
    g.beginPath(); g.moveTo(0, 2); g.bezierCurveTo(-5, -2, -2, -6, 0, -3); g.bezierCurveTo(2, -6, 5, -2, 0, 2); g.fill(); g.restore();
    g.strokeStyle = '#ffd60a'; g.lineWidth = 1.2; g.beginPath(); g.arc(30.5, 64, 3, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(69.5, 64, 3, 0, PI * 2); g.stroke();
    P.sparkle(80, 18 + Math.sin(t * 2) * 2, 3); P.sparkle(18, 28, 2);
  },
  ugly(P, g, t) {
    P.bg('#b6f2ec', '#1d8f86', ['#fff', '#d6fff9', '#7fe0d6'], 7);
    // bun with pencil
    P.circ(50, 18, 12, P.radial(50, 18, 2, 13, [[0, '#a0522d'], [1, '#5b2810']], -3, -4));
    g.strokeStyle = '#ffd60a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(38, 10); g.lineTo(63, 24); g.stroke();
    P.circ(63.5, 24.3, 1.3, '#ff9fb0');
    // sweater
    P.path([[10, 100], [14, 82, 32, 78], [68, 78], [86, 82, 90, 100]], P.linear(0, 78, 0, 100, [[0, '#57cc99'], [1, '#2d8a5f']]));
    for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(20 + i * 15, 84); g.lineTo(24 + i * 15, 100); g.stroke(); }
    P.ell(62, 90, 4, 2.5, '#9ec95b'); // soup stain
    P.neck(50, 66, 6.5, 14, '#e8b98d', '#c48c62');
    P.face(50, 52, 20, 21, '#f2c79d', '#cf9668');
    // freckles
    for (const [x, y] of [[37, 59], [40, 61], [43, 59], [57, 59], [60, 61], [63, 59], [39, 57.5], [61, 57.5]]) P.circ(x, y, 0.75, '#a0522d');
    P.blush(37, 61, 4.5); P.blush(63, 61, 4.5);
    P.eye(41, 52, 4.4, 4, '#3a5a40', { inner: '#b7e4c7' });
    P.eye(59, 52, 4.4, 4, '#3a5a40', { inner: '#b7e4c7' });
    // glasses
    g.strokeStyle = '#1b1023'; g.lineWidth = 2.2;
    g.beginPath(); g.arc(41, 52, 8, 0, PI * 2); g.stroke(); g.beginPath(); g.arc(59, 52, 8, 0, PI * 2); g.stroke();
    g.beginPath(); g.moveTo(49, 51); g.quadraticCurveTo(50, 49.5, 51, 51); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.arc(38, 49, 3, 0, PI * 2); g.arc(56, 49, 3, 0, PI * 2); g.fill();
    P.brow(41, 41.5, 6, -1, '#4a2310', 2.2); P.brow(59, 42.5, 6, 1, '#4a2310', 2.2);
    P.nose(50, 60, 'rgba(110,50,20,.55)');
    if (P.talk > 0.15) P.mouth(50, 66, 6, { lip: '#a4133c', big: 5 });
    else {
      // big braces grin
      const m = P.mood;
      if (m === 'angry' || m === 'sad') P.mouth(50, 66, 6, { lip: '#a4133c' });
      else {
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(43, 64); g.quadraticCurveTo(50, 71.5, 57, 64); g.closePath(); g.fill();
        g.strokeStyle = '#9aa5b1'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(44, 65.6); g.quadraticCurveTo(50, 68.5, 56, 65.6); g.stroke();
        for (let i = 0; i < 5; i++) P.circ(45 + i * 2.5, 66.2 + Math.sin((i / 4) * PI) * 1.4, 0.55, '#c0c7d1');
        g.strokeStyle = '#a4133c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(43, 64); g.quadraticCurveTo(50, 71.5, 57, 64); g.stroke();
      }
    }
    // messy front strands
    g.strokeStyle = '#6f2f12'; g.lineWidth = 2;
    for (const [x0, y0, cx, cy, x1, y1] of [[34, 36, 30, 46, 33, 56], [66, 36, 71, 46, 68, 56], [44, 31, 40, 36, 41, 41], [56, 31, 61, 36, 58, 40]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); }
    P.path([[30, 42], [32, 28, 50, 27], [68, 28, 70, 42], [60, 33, 50, 34], [40, 33, 30, 42]], '#8a3c1a');
    P.sheen(48, 30, 10, 2);
  },
  cat(P, g, t) {
    P.bg('#5a6170', '#1c1f26', ['#9aa3b5', '#ffffff', '#6c7380'], 11);
    // yarn ball
    P.circ(86, 88, 10, P.radial(86, 88, 1, 11, [[0, '#ff8fc0'], [1, '#c9184a']], -3, -3));
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(86, 88, 4 + i * 1.8, 0.5 + i, 2.5 + i); g.stroke(); }
    // body fluff
    P.path([[16, 100], [22, 80, 50, 76], [78, 80, 84, 100]], P.linear(0, 76, 0, 100, [[0, '#9a9a9a'], [1, '#6e6e6e']]));
    P.ell(50, 90, 14, 10, P.radial(50, 88, 1, 14, [[0, '#ffffff'], [1, '#d6d6d6']]));
    // ears
    const ear = (s) => {
      P.path([[50 + s * 22, 44], [50 + s * 30, 12], [50 + s * 8, 30]], P.linear(0, 12, 0, 44, [[0, '#7c7c7c'], [1, '#9e9e9e']]));
      P.path([[50 + s * 21, 38], [50 + s * 27, 18], [50 + s * 13, 31]], '#ffb3c6');
    };
    ear(-1); ear(1);
    // head
    g.fillStyle = P.radial(50, 54, 4, 34, [[0, '#c2c2c2'], [0.7, '#a3a3a3'], [1, '#7a7a7a']], -6, -8);
    g.beginPath(); g.ellipse(50, 55, 31, 27, 0, 0, PI * 2); g.fill();
    // tabby stripes
    g.strokeStyle = '#6a6a6a'; g.lineWidth = 2.2; g.lineCap = 'round';
    for (const x of [44, 50, 56]) { g.beginPath(); g.moveTo(x, 30); g.quadraticCurveTo(x + (x - 50) * 0.3, 37, x, 42); g.stroke(); }
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(50 + s * 30, 52 + i * 5); g.lineTo(50 + s * 23, 53 + i * 5); g.stroke(); }
    // muzzle
    P.ell(50, 64, 12, 8, P.radial(50, 63, 1, 12, [[0, '#ffffff'], [1, '#dcdcdc']]));
    const mood = P.mood;
    P.eye(38, 52, 7.2, mood === 'angry' ? 4.6 : 7, '#b7f06a', { slit: mood !== 'happy', inner: '#f4ffd6', irisDark: '#3d6b16', lash: 1.4, look: Math.sin(t * 0.8) * 1.2 });
    P.eye(62, 52, 7.2, mood === 'angry' ? 4.6 : 7, '#b7f06a', { slit: mood !== 'happy', inner: '#f4ffd6', irisDark: '#3d6b16', lash: 1.4, look: Math.sin(t * 0.8) * 1.2 });
    // nose + mouth
    P.path([[47, 60.5], [53, 60.5], [50, 63.5]], '#ff8fab');
    if (P.talk > 0.15) {
      g.fillStyle = '#5c1a2a'; g.beginPath(); g.ellipse(50, 67.5, 4, 1.5 + P.talk * 3.5, 0, 0, PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(46.8, 66.4); g.lineTo(48, 69); g.lineTo(48.6, 66.4); g.moveTo(53.2, 66.4); g.lineTo(52, 69); g.lineTo(51.4, 66.4); g.fill();
    } else {
      g.strokeStyle = '#4a4a4a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(50, 63.5); g.lineTo(50, 65.5); g.quadraticCurveTo(47, 68, 45, 66); g.moveTo(50, 65.5); g.quadraticCurveTo(53, 68, 55, 66); g.stroke();
    }
    // whiskers
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.7;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(50 + s * 9, 64 + i * 1.6); g.quadraticCurveTo(50 + s * 22, 61 + i * 3, 50 + s * 38, 60 + i * 5 + Math.sin(t * 2 + i) * 0.8); g.stroke(); }
  },
  mario(P, g, t) {
    P.bg('#d7f6ff', '#4cc9f0', ['#ffffff', '#ffffff', '#b8ecff'], 5);
    // clouds
    for (const [x, y, k] of [[16, 22, 1], [82, 14, 0.8]]) { g.fillStyle = 'rgba(255,255,255,.9)'; for (const [dx, dy, r] of [[0, 0, 6], [6, -2, 7], [12, 0, 5]]) { g.beginPath(); g.arc(x + dx * k + Math.sin(t * 0.4) * 2, y + dy * k, r * k, 0, PI * 2); g.fill(); } }
    // shirt + bib
    P.path([[14, 100], [18, 84, 34, 80], [66, 80], [82, 84, 86, 100]], P.linear(0, 80, 0, 100, [[0, '#ef233c'], [1, '#a4161a']]));
    P.path([[36, 100], [36, 86], [64, 86], [64, 100]], P.linear(0, 86, 0, 100, [[0, '#4895ef'], [1, '#3a0ca3']]));
    P.circ(40, 89, 1.6, '#ffd60a'); P.circ(60, 89, 1.6, '#ffd60a');
    // chubby face
    g.fillStyle = P.radial(50, 58, 3, 30, [[0, '#ffe0c2'], [0.75, '#ffcfa6'], [1, '#e9a87c']], -6, -7);
    g.beginPath(); g.ellipse(50, 60, 26, 23, 0, 0, PI * 2); g.fill();
    P.ell(25, 60, 4, 6, '#ffcfa6'); P.ell(75, 60, 4, 6, '#ffcfa6'); // ears
    P.blush(34, 67, 7); P.blush(66, 67, 7);
    const sad = P.mood === 'sad' || P.mood === 'angry';
    P.eye(41, 59, 5.5, 6, '#6b3e1e', { inner: '#e9c39b', look: 0 });
    P.eye(59, 59, 5.5, 6, '#6b3e1e', { inner: '#e9c39b', look: 0 });
    if (sad && !P.blink) { g.fillStyle = 'rgba(120,200,255,.9)'; P.ell(35, 67 + (t * 8) % 8, 1.4, 2.2, 'rgba(120,200,255,.9)'); P.ell(65, 67 + ((t * 8 + 4) % 8), 1.4, 2.2, 'rgba(120,200,255,.9)'); }
    P.brow(41, 51, 4, -1, '#6b3e1e', 1.3); P.brow(59, 51, 4, 1, '#6b3e1e', 1.3);
    P.ell(50, 65, 3.4, 2.6, P.radial(50, 64, 0.5, 3.6, [[0, '#ffd2b0'], [1, '#e79b72']]));
    // pacifier (pops out when talking)
    if (P.talk > 0.15) P.mouth(50, 72, 5, { big: 4, teeth: false });
    else {
      P.ell(50, 74, 8, 5.5, P.radial(50, 73, 1, 8, [[0, '#a8e0ff'], [1, '#2b7bd6']], -2, -2));
      P.circ(50, 74, 2.6, '#ffffff');
      g.strokeStyle = '#2b7bd6'; g.lineWidth = 1.4; g.beginPath(); g.arc(50, 79.5, 3, 0, PI); g.stroke();
    }
    // cap
    P.path([[22, 50], [22, 22, 50, 20], [78, 22, 78, 50], [64, 44, 50, 44], [36, 44, 22, 50]], P.linear(0, 18, 0, 50, [[0, '#ff4d5a'], [1, '#c1121f']]));
    P.path([[24, 49], [50, 41, 82, 47], [84, 52], [52, 47, 22, 53]], '#a4161a');
    P.circ(50, 31, 7, '#ffffff');
    g.fillStyle = '#e63946'; g.font = 'bold 10px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', 50, 31.5);
    P.sheen(38, 28, 8, 2, -0.6);
  },
  demonKing(P, g, t, o) {
    P.bg('#4c0f80', '#0b0018', ['#ff2bd6', '#b388ff', '#ffd60a'], 13);
    // stage beams
    g.save(); g.globalAlpha = 0.2;
    for (const [x, a] of [[18, 0.25], [82, -0.25]]) { g.fillStyle = P.linear(x, 0, x, 100, [[0, '#ffd6ff'], [1, 'rgba(255,214,255,0)']]); g.beginPath(); g.moveTo(x - 3, 0); g.lineTo(x + 3, 0); g.lineTo(x + 30 * a + 14, 100); g.lineTo(x + 30 * a - 14, 100); g.fill(); }
    g.restore();
    // coat with high collar
    P.path([[8, 100], [14, 80, 34, 76], [66, 76], [86, 80, 92, 100]], P.linear(0, 76, 0, 100, [[0, '#240046'], [1, '#10002b']]));
    P.path([[26, 100], [30, 74], [40, 66], [44, 84], [36, 100]], '#3c096c'); P.path([[74, 100], [70, 74], [60, 66], [56, 84], [64, 100]], '#3c096c');
    g.strokeStyle = '#ffd60a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(30, 74); g.lineTo(40, 66); g.moveTo(70, 74); g.lineTo(60, 66); g.stroke();
    P.neck(50, 62, 5.5, 16, '#e4d4ff', '#b49be0');
    // horns
    const horn = (s) => P.path([[50 + s * 14, 32], [50 + s * 34, 30, 50 + s * 36, 6], [50 + s * 30, 22, 50 + s * 18, 38]], P.linear(50 + s * 14, 30, 50 + s * 36, 6, [[0, '#3c096c'], [0.6, '#9d4edd'], [1, '#f3d9ff']]), '#0b0018', 1.4);
    horn(-1); horn(1);
    P.face(50, 50, 17, 21, '#f0e6ff', '#b8a2e6');
    // slick hair
    P.path([[32, 46], [30, 24, 50, 22], [70, 24, 68, 46], [64, 34, 56, 32], [50, 31, 44, 32], [36, 34, 32, 46]], P.linear(0, 22, 0, 46, [[0, '#1b0033'], [1, '#3c096c']]));
    P.sheen(56, 28, 9, 2, 0.2);
    // crown
    g.fillStyle = P.linear(0, 10, 0, 26, [[0, '#fff3b0'], [1, '#d4a017']]);
    g.beginPath(); g.moveTo(36, 26); for (let i = 0; i <= 4; i++) { g.lineTo(36 + i * 7, 14 - (i % 2 ? 0 : 4)); g.lineTo(39.5 + i * 7, 24); } g.lineTo(64, 26); g.closePath(); g.fill();
    P.circ(50, 21, 1.6, '#ff006e');
    const glow = P.mood === 'angry' ? 'rgba(255,0,110,.9)' : 'rgba(255,0,110,.45)';
    P.eye(42, 50, 5, 3.4, '#ff006e', { inner: '#ffd6ec', irisDark: '#5c0029', glow, tilt: 0.15, lash: 2.2 });
    P.eye(58, 50, 5, 3.4, '#ff006e', { inner: '#ffd6ec', irisDark: '#5c0029', glow, tilt: -0.15, lash: 2.2 });
    g.strokeStyle = '#1b0033'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(35, 44); g.lineTo(46, 46 - (P.mood === 'angry' ? -1 : 1)); g.moveTo(65, 44); g.lineTo(54, 46 - (P.mood === 'angry' ? -1 : 1)); g.stroke();
    P.nose(50, 57, 'rgba(90,60,140,.5)');
    P.mouth(50, 63, 5, { lip: '#5a189a', smirk: true, fang: true, lw: 1.8 });
    if (P.talk <= 0.15 && P.mood !== 'sad') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(53.5, 62.6); g.lineTo(55, 62.4); g.lineTo(54.3, 65.2); g.fill(); }
    P.circ(33.5, 58, 1.4, '#ffd60a');
    P.sparkle(80, 20, 3, '#ffd60a'); P.sparkle(20, 70, 2.4, '#ff2bd6');
  },
  jesus(P, g, t) {
    P.bg('#fff8d6', '#f4b942', ['#ffffff', '#fff3b0', '#ffe08a'], 17);
    // light rays
    g.save(); g.translate(50, 40); g.rotate(t * 0.05);
    for (let i = 0; i < 16; i++) { g.rotate((PI * 2) / 16); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-4, -80); g.lineTo(4, -80); g.fill(); }
    g.restore();
    // halo
    g.fillStyle = P.radial(50, 30, 10, 30, [[0, 'rgba(255,255,220,.0)'], [0.7, 'rgba(255,250,200,.85)'], [1, 'rgba(255,240,170,0)']]);
    g.beginPath(); g.arc(50, 34, 30, 0, PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.4; g.beginPath(); g.arc(50, 34, 23, 0, PI * 2); g.stroke();
    // robe + sash
    P.path([[10, 100], [16, 80, 34, 76], [66, 76], [84, 80, 90, 100]], P.linear(0, 76, 0, 100, [[0, '#fffdf6'], [1, '#e9e2cf']]));
    P.path([[56, 78], [68, 100], [60, 100], [50, 80]], '#b7233a');
    // long hair behind
    P.path([[28, 40], [22, 70, 30, 88], [70, 88], [78, 70, 72, 40], [50, 14, 28, 40]], P.linear(0, 20, 0, 90, [[0, '#6f4518'], [1, '#3e2410']]));
    P.neck(50, 64, 6, 12, '#e8b98d', '#c48c62');
    P.face(50, 50, 16.5, 20, '#f3c9a0', '#c99068');
    // beard
    P.path([[34, 52], [36, 70, 50, 78], [64, 70, 66, 52], [60, 64, 50, 66], [40, 64, 34, 52]], P.linear(0, 52, 0, 78, [[0, '#6f4518'], [1, '#4a2b10']]));
    P.eye(43, 49, 4.3, 3.3, '#5b3a1e', { inner: '#e6c79b', look: 0 });
    P.eye(57, 49, 4.3, 3.3, '#5b3a1e', { inner: '#e6c79b', look: 0 });
    P.brow(43, 43.5, 5, -1, '#4a2b10'); P.brow(57, 43.5, 5, 1, '#4a2b10');
    P.nose(50, 56, 'rgba(110,60,30,.5)');
    if (P.talk > 0.15) P.mouth(50, 62, 3.6, { big: 3, teeth: false });
    else { g.strokeStyle = '#3e2410'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(46, 61.5); g.quadraticCurveTo(50, P.mood === 'sad' ? 60.5 : 63.5, 54, 61.5); g.stroke(); }
    // center part
    P.path([[34, 44], [36, 28, 50, 27], [64, 28, 66, 44], [58, 34, 50, 30], [42, 34, 34, 44]], '#5c3a17');
    P.sheen(44, 31, 8, 1.6);
  },
  alex(P, g, t) {
    P.bg('#4361ee', '#10002b', ['#67f3ff', '#ff4fa3', '#ffffff'], 19);
    // speed lines
    g.save(); g.globalAlpha = 0.18; g.strokeStyle = '#fff'; g.lineWidth = 0.8;
    for (let i = 0; i < 12; i++) { const y = (i * 9 + t * 40) % 100; g.beginPath(); g.moveTo(0, y); g.lineTo(26, y + 2); g.moveTo(74, y + 3); g.lineTo(100, y + 1); g.stroke(); }
    g.restore();
    // jacket
    P.path([[10, 100], [16, 82, 34, 78], [66, 78], [84, 82, 90, 100]], P.linear(0, 78, 0, 100, [[0, '#2b2140'], [1, '#120a20']]));
    g.strokeStyle = '#ff4fa3'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(42, 80); g.lineTo(46, 100); g.moveTo(58, 80); g.lineTo(54, 100); g.stroke();
    // scarf
    P.path([[30, 78], [50, 86, 70, 78], [70, 72], [50, 80, 30, 72]], P.linear(0, 72, 0, 86, [[0, '#ff2e4d'], [1, '#a4133c']]));
    P.path([[62, 80], [72, 98], [64, 99], [57, 82]], '#c9184a');
    P.neck(50, 64, 6, 10, '#f6d2b8', '#d9a98a');
    P.face(50, 52, 17.5, 20, '#ffe3cf', '#e3ad8f');
    // band-aid
    g.save(); g.translate(61, 60); g.rotate(-0.4); g.fillStyle = '#f7c59f'; g.fillRect(-4, -1.4, 8, 2.8); g.fillStyle = '#e8a87c'; g.fillRect(-1.2, -1.4, 2.4, 2.8); g.restore();
    P.eye(42, 53, 4.6, 3.8, '#ff4fa3', { inner: '#ffe0f0', irisDark: '#3a0ca3', tilt: 0.08 });
    P.eye(58, 53, 4.6, 3.8, '#67f3ff', { inner: '#e0fcff', irisDark: '#3a0ca3', tilt: -0.08 });
    g.strokeStyle = '#17121f'; g.lineWidth = 2; g.lineCap = 'round';
    const a = P.mood === 'happy' ? -0.5 : 1.2;
    g.beginPath(); g.moveTo(36, 46 - a); g.lineTo(46, 47.5); g.moveTo(64, 46 - a); g.lineTo(54, 47.5); g.stroke();
    P.nose(50, 60);
    P.mouth(50, 66, 4.2, { lip: '#6a040f' });
    // spiky hair
    g.fillStyle = P.linear(0, 6, 0, 50, [[0, '#2a2140'], [1, '#0d0816']]);
    g.beginPath(); g.moveTo(30, 52);
    const spikes = [[26, 34], [22, 18], [34, 26], [36, 6], [46, 22], [54, 4], [58, 22], [70, 10], [68, 28], [80, 22], [72, 40], [76, 52]];
    for (const [x, y] of spikes) g.lineTo(x, y + Math.sin(t * 3 + x) * 0.6);
    g.quadraticCurveTo(64, 38, 56, 40); g.lineTo(52, 46); g.lineTo(48, 39); g.quadraticCurveTo(38, 38, 30, 52);
    g.fill();
    P.path([[52, 38], [56, 6], [61, 22], [58, 38]], P.linear(0, 6, 0, 38, [[0, '#ff8fc0'], [1, '#ff2e7e']]));
    P.sheen(42, 22, 8, 2, -0.8);
  },
};

// Little round avatars for chat bubbles / nameplates.
export function portraitDataURL(key, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawPortrait(key, c.getContext('2d'), size, 1.3, {});
  return c.toDataURL();
}
