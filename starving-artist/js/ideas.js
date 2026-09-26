// Ideas: small painted motifs the player drags onto a canvas. Each draws itself
// in a 40x40-unit box whose origin is the bottom-centre (its "feet").

function pen(g, ox, oy, k, flip, fx = {}) {
  const X = (x, w = 0) => (flip ? ox - (x + w) * k : ox + x * k);
  const col = (c) => (fx.desat ? desat(c, fx.desat) : c);
  return {
    r(x, y, w, h, c) { g.fillStyle = col(c); g.fillRect(Math.round(X(x, w)), Math.round(oy + y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); },
    c(x, y, rad, c) { g.fillStyle = col(c); g.beginPath(); g.arc(X(x), oy + y * k, Math.max(0.6, rad * k), 0, Math.PI * 2); g.fill(); },
    e(x, y, rx, ry, c) { g.fillStyle = col(c); g.beginPath(); g.ellipse(X(x), oy + y * k, Math.max(0.6, rx * k), Math.max(0.6, ry * k), 0, 0, Math.PI * 2); g.fill(); },
    p(pts, c) { g.fillStyle = col(c); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), oy + y * k) : g.moveTo(X(x), oy + y * k))); g.closePath(); g.fill(); },
    ring(x, y, rx, ry, c, w = 1) { g.strokeStyle = col(c); g.lineWidth = Math.max(1, w * k); g.beginPath(); g.ellipse(X(x), oy + y * k, Math.max(0.6, rx * k), Math.max(0.6, ry * k), 0, 0, Math.PI * 2); g.stroke(); },
    crescent(x, y, rad, c) { g.fillStyle = col(c); g.beginPath(); const cx = X(x), cy = oy + y * k, R = rad * k, s = flip ? -1 : 1; g.arc(cx, cy, R, Math.PI * 0.35, Math.PI * 1.65, false); g.arc(cx + s * R * 0.45, cy - R * 0.1, R * 0.82, Math.PI * 1.55, Math.PI * 0.45, true); g.closePath(); g.fill(); },
    l(pts, c, w = 1) { g.strokeStyle = col(c); g.lineWidth = Math.max(1, w * k); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), oy + y * k) : g.moveTo(X(x), oy + y * k))); g.stroke(); },
    fx,
  };
}

export function desat(c, amt) {
  if (!c.startsWith('#')) return c;
  let r = parseInt(c.slice(1, 3), 16), gg = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  const l = r * 0.3 + gg * 0.59 + b * 0.11;
  r = r + (l - r) * amt; gg = gg + (l - gg) * amt; b = b + (l - b) * amt;
  const d = 1 - amt * 0.25;
  return `rgb(${r * d | 0},${gg * d | 0},${b * d | 0})`;
}

function figure(P, v) {
  const h = v.h || 1;
  const skin = v.skin || '#e8b89a', hair = v.hair || '#3a2a22', shirt = v.shirt || '#6a8ac8', pants = v.pants || '#3a3a4a';
  const top = -40 * h;
  P.r(-5, -16 * h, 4, 16 * h, pants); P.r(1, -16 * h, 4, 16 * h, pants);
  P.r(-7, -30 * h, 14, 15 * h, shirt);
  P.r(-10, -29 * h, 3, 12 * h, shirt); P.r(7, -29 * h, 3, 12 * h, shirt);
  P.r(-10, -17 * h, 3, 3, skin); P.r(7, -17 * h, 3, 3, skin);
  P.c(0, top + 5, 5.5, skin);
  if (v.longHair) { P.r(-6.5, top - 0.5, 13, 5, hair); P.r(-6.5, top + 2, 3, 12, hair); P.r(3.5, top + 2, 3, 12, hair); }
  else { P.r(-6, top - 0.5, 12, 4, hair); }
  if (P.fx.faceless) { P.r(-3, top + 4, 6, 4, skin); }
  else { P.r(-3, top + 4, 1.6, 1.6, '#1b1622'); P.r(1.6, top + 4, 1.6, 1.6, '#1b1622'); P.r(-1.5, top + 8, 3, 0.9, '#8a3a40'); }
}

export const IDEAS = {
  sun: { name: 'Sun', draw: (P) => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.l([[Math.cos(a) * 10, -20 + Math.sin(a) * 10], [Math.cos(a) * 17, -20 + Math.sin(a) * 17]], '#ffd24a', 2); } P.c(0, -20, 9, '#ffcf3a'); P.c(-2, -22, 5, '#ffe68a'); } },
  moon: { name: 'Moon', draw: (P) => { P.crescent(0, -20, 12, '#f4f0d8'); } },
  cloud: { name: 'Cloud', draw: (P) => { P.c(-9, -10, 7, '#ffffff'); P.c(0, -15, 9, '#ffffff'); P.c(10, -10, 7, '#ffffff'); P.r(-16, -10, 32, 7, '#ffffff'); P.r(-15, -4, 30, 2, '#dfe7f7'); } },
  rain: { name: 'Rain', draw: (P) => { P.c(-8, -30, 7, '#8a94a8'); P.c(2, -34, 9, '#8a94a8'); P.c(11, -30, 6, '#8a94a8'); P.r(-15, -30, 30, 6, '#8a94a8'); for (let i = 0; i < 7; i++) P.l([[-13 + i * 4.5, -20], [-15 + i * 4.5, -4 - (i % 2) * 4]], '#7ab8e8', 1.2); } },
  star: { name: 'Star', draw: (P) => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2; const r = i % 2 ? 5 : 12; pts.push([Math.cos(a) * r, -18 + Math.sin(a) * r]); } P.p(pts, '#ffe36e'); } },
  window: { name: 'Window', draw: (P) => { P.r(-15, -38, 30, 36, '#f6f2ea'); P.r(-13, -36, 12, 15, '#9cc8f2'); P.r(1, -36, 12, 15, '#9cc8f2'); P.r(-13, -19, 12, 15, '#bcdcf6'); P.r(1, -19, 12, 15, '#bcdcf6'); P.c(-6, -30, 3, '#ffffff'); P.r(-17, -3, 34, 3, '#d8d0c0'); } },
  door: { name: 'Door', draw: (P) => { P.r(-11, -40, 22, 40, '#8a5a36'); P.r(-9, -38, 18, 17, '#9a6a44'); P.r(-9, -19, 18, 17, '#9a6a44'); P.c(6, -20, 1.6, '#ffd24a'); } },
  chair: { name: 'Chair', draw: (P) => { P.r(-8, -30, 3, 30, '#a0643c'); P.r(-8, -30, 14, 3, '#a0643c'); P.r(-8, -16, 18, 3, '#b8784a'); P.r(7, -14, 3, 14, '#a0643c'); P.r(-8, -24, 14, 2, '#a0643c'); } },
  table: { name: 'Table', draw: (P) => { P.r(-18, -18, 36, 3, '#b07a4a'); P.r(-16, -15, 3, 15, '#8a5a36'); P.r(13, -15, 3, 15, '#8a5a36'); } },
  bed: { name: 'Bed', draw: (P) => { P.r(-19, -12, 38, 7, '#e7a8c0'); P.r(-19, -6, 38, 3, '#8a6a4a'); P.r(-19, -22, 4, 22, '#8a6a4a'); P.r(-14, -16, 10, 5, '#ffffff'); P.r(16, -14, 3, 14, '#8a6a4a'); } },
  lamp: { name: 'Lamp', draw: (P) => { P.p([[-7, -36], [7, -36], [10, -26], [-10, -26]], '#ffe2b0'); P.r(-1, -26, 2, 24, '#333'); P.r(-6, -2, 12, 2, '#333'); P.c(0, -24, 3, 'rgba(255,240,180,0.9)'); } },
  tree: { name: 'Tree', draw: (P) => { P.r(-3, -16, 6, 16, '#7a5234'); P.c(0, -26, 12, '#4f9a4a'); P.c(-7, -22, 8, '#5fae55'); P.c(7, -22, 8, '#448a40'); P.c(2, -32, 7, '#6ec060'); } },
  flower: { name: 'Flower', draw: (P) => { P.r(-0.8, -20, 1.6, 20, '#3a8a3a'); P.e(4, -9, 4, 2, '#4f9a4a'); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; P.c(Math.cos(a) * 4, -22 + Math.sin(a) * 4, 3.2, '#f6a6c1'); } P.c(0, -22, 2.5, '#ffd24a'); } },
  house: { name: 'House', draw: (P) => { P.r(-16, -20, 32, 20, '#f2e2c8'); P.p([[-19, -20], [0, -36], [19, -20]], '#c0504a'); P.r(-4, -12, 8, 12, '#8a5a36'); P.r(-13, -16, 6, 6, '#ffe8a0'); P.r(7, -16, 6, 6, '#ffe8a0'); P.r(8, -34, 4, 8, '#8a4a40'); } },
  city: { name: 'City', draw: (P) => { const b = [[-20, 22, '#6a6a8a'], [-13, 30, '#7a7aa0'], [-5, 18, '#5a5a7a'], [2, 34, '#8a88b0'], [10, 24, '#6a6a8a']]; b.forEach(([x, h, c]) => { P.r(x, -h, 8, h, c); for (let y = 4; y < h - 2; y += 5) { P.r(x + 1.5, -h + y, 2, 2, '#ffe8a0'); P.r(x + 4.5, -h + y, 2, 2, (y / 5) % 2 ? '#ffe8a0' : '#3a3a50'); } }); } },
  hill: { name: 'Hills', draw: (P) => { P.e(-8, 0, 16, 12, '#7fc36b'); P.e(10, 0, 14, 9, '#6ab05a'); P.e(0, 0, 20, 5, '#8fd07a'); } },
  cat: { name: 'Cat', draw: (P) => { P.e(0, -7, 9, 6, '#3a3a40'); P.c(8, -14, 5, '#3a3a40'); P.p([[4, -17], [5, -22], [7, -18]], '#3a3a40'); P.p([[9, -18], [11, -22], [12, -17]], '#3a3a40'); P.l([[-8, -8], [-13, -16], [-11, -20]], '#3a3a40', 2); P.r(7, -15, 1.3, 1.3, '#d8f070'); P.r(10, -15, 1.3, 1.3, '#d8f070'); } },
  dog: { name: 'Dog', draw: (P) => { P.e(0, -10, 11, 6, '#c8925a'); P.c(11, -16, 5, '#c8925a'); P.e(9, -16, 2, 4, '#8a5a36'); P.r(-8, -6, 3, 6, '#c8925a'); P.r(6, -6, 3, 6, '#c8925a'); P.l([[-10, -12], [-15, -17]], '#c8925a', 2); P.r(13, -17, 1.3, 1.3, '#111'); P.r(15, -15, 2, 1.5, '#111'); } },
  bird: { name: 'Bird', draw: (P) => { P.l([[-9, -24], [-3, -20], [0, -23], [3, -20], [9, -24]], '#2a2a3a', 1.5); } },
  person: { name: 'Stranger', people: true, draw: (P) => figure(P, { shirt: '#8a8a9a' }) },
  mom: { name: 'Mom', people: true, draw: (P) => figure(P, { hair: '#5a3a2a', shirt: '#d87a8a', pants: '#4a4a6a', longHair: true, h: 0.95 }) },
  dad: { name: 'Dad', people: true, draw: (P) => figure(P, { hair: '#4a4a4a', shirt: '#5a7a5a', pants: '#3a3a4a', h: 1.02 }) },
  teo: { name: 'Teo', people: true, draw: (P) => figure(P, { hair: '#2a1a12', shirt: '#f0c040', pants: '#4a5a8a', h: 0.72 }) },
  priya: { name: 'Priya', people: true, draw: (P) => figure(P, { skin: '#b07a52', hair: '#1a1212', shirt: '#9a5ab8', pants: '#2a2a3a', longHair: true, h: 0.96 }) },
  self: { name: 'Me', people: true, draw: (P) => figure(P, { hair: '#1a1418', shirt: '#e8e0d0', pants: '#5a4a6a', longHair: true, h: 0.95 }) },
  eye: { name: 'Eye', following: true, draw: (P) => { P.e(0, -20, 16, 8, '#f7f1ea'); P.c(0, -20, 6, '#4a7bc8'); P.c(0, -20, 3, '#0a0a12'); P.r(1, -23, 2, 2, '#ffffff'); P.l([[-16, -20], [-8, -27], [8, -27], [16, -20]], '#2a1a1a', 1); } },
  crowd: { name: 'Crowd', following: true, draw: (P) => { for (let i = 0; i < 6; i++) { const x = -18 + i * 7.2; P.c(x, -14 - (i % 2) * 3, 3.5, '#3a3040'); P.r(x - 3.5, -11 - (i % 2) * 3, 7, 11 + (i % 2) * 3, '#3a3040'); } for (let i = 0; i < 3; i++) P.r(-12 + i * 12, -26, 2, 3, '#bcdcf6'); } },
  halo: { name: 'Halo', following: true, draw: (P) => { P.ring(0, -26, 12, 4, '#ffd24a', 2.4); P.ring(0, -26.5, 12, 4, '#fff4c0', 0.8); for (let i = 0; i < 5; i++) P.l([[-8 + i * 4, -32], [-9 + i * 4.5, -36]], 'rgba(255,230,140,0.8)', 0.8); } },
  mask: { name: 'Mask', following: true, draw: (P) => { P.e(0, -20, 11, 13, '#f4efe2'); P.e(-4.5, -23, 3, 2, '#1a1418'); P.e(4.5, -23, 3, 2, '#1a1418'); P.l([[-5, -13], [0, -11], [5, -13]], '#c04050', 1.2); } },
  hand: { name: 'Hand', draw: (P) => { P.r(-6, -18, 12, 12, '#e8b89a'); for (let i = 0; i < 4; i++) P.r(-6 + i * 3.2, -28 + (i === 0 || i === 3 ? 3 : 0), 2.6, 11, '#e8b89a'); P.r(6, -16, 7, 3, '#e8b89a'); P.r(-5, -6, 10, 6, '#e8b89a'); } },
  clock: { name: 'Clock', draw: (P) => { P.c(0, -20, 12, '#f4efe2'); P.c(0, -20, 10.5, '#ffffff'); P.l([[0, -20], [0, -28]], '#1a1418', 1.5); P.l([[0, -20], [6, -18]], '#1a1418', 1.5); P.c(0, -20, 1.4, '#c04050'); } },
  cup: { name: 'Coffee', draw: (P) => { P.r(-6, -14, 12, 14, '#ffffff'); P.r(-6, -14, 12, 3, '#6a4a2a'); P.l([[6, -11], [10, -9], [6, -5]], '#ffffff', 2); P.l([[-2, -17], [-3, -22], [-1, -26]], 'rgba(255,255,255,0.8)', 1); } },
  phone: { name: 'Phone', draw: (P) => { P.r(-6, -24, 12, 22, '#1a1a1e'); P.r(-5, -22, 10, 16, '#9ad6ff'); P.r(-1.5, -5, 3, 1.5, '#555'); } },
  mirror: { name: 'Mirror', draw: (P) => { P.e(0, -22, 11, 16, '#8a6a4a'); P.e(0, -22, 9, 14, '#bcd0dc'); P.l([[-4, -30], [-1, -33]], '#ffffff', 1.4); P.r(-2, -6, 4, 6, '#8a6a4a'); } },
  frame: { name: 'Frame', draw: (P) => { P.r(-14, -36, 28, 30, '#c9a24a'); P.r(-11, -33, 22, 24, '#f6f2ea'); } },
  stairs: { name: 'Stairs', draw: (P) => { for (let i = 0; i < 6; i++) P.r(-18 + i * 6, -6 - i * 6, 36 - i * 6, 6, i % 2 ? '#e8dcd8' : '#f6eef0'); } },
  candle: { name: 'Candle', draw: (P) => { P.r(-3, -14, 6, 14, '#f6f2ea'); P.l([[0, -14], [0, -16]], '#222', 1); P.e(0, -19, 2, 3.5, '#ffcc55'); P.e(0, -18.5, 1, 1.8, '#fff4c0'); } },
  cake: { name: 'Cake', draw: (P) => { P.r(-12, -12, 24, 12, '#f6c7d8'); P.r(-12, -13, 24, 3, '#ffffff'); for (let i = 0; i < 4; i++) { P.r(-7 + i * 4.5, -18, 1.4, 5, '#9ad0f5'); P.c(-6.3 + i * 4.5, -19.5, 1.2, '#ffcc55'); } } },
  heart: { name: 'Heart', draw: (P) => { P.c(-5, -24, 6, '#e8637a'); P.c(5, -24, 6, '#e8637a'); P.p([[-10.5, -22], [10.5, -22], [0, -8]], '#e8637a'); P.c(-6, -26, 2, '#f6a6b4'); } },
  key: { name: 'Key', draw: (P) => { P.ring(-8, -20, 4, 4, '#e8c24a', 2.2); P.r(-4, -21, 16, 2.5, '#e8c24a'); P.r(8, -21, 2, 5, '#e8c24a'); P.r(11, -21, 2, 4, '#e8c24a'); } },
  brush: { name: 'Brush', draw: (P) => { P.l([[-12, -6], [8, -30]], '#8a5a36', 2.5); P.l([[8, -30], [11, -34]], '#c0c0c8', 3); P.p([[10, -33], [14, -38], [13, -32]], '#e8637a'); } },
  gift: { name: 'Gift', draw: (P) => { P.r(-9, -16, 18, 16, '#6fd3c1'); P.r(-1.5, -16, 3, 16, '#f6d36b'); P.r(-9, -9, 18, 3, '#f6d36b'); P.e(-3, -18, 3, 2, '#f6d36b'); P.e(3, -18, 3, 2, '#f6d36b'); } },
  snow: { name: 'Snowman', draw: (P) => { P.c(0, -7, 7, '#ffffff'); P.c(0, -18, 5, '#ffffff'); P.r(-1, -19, 1, 1, '#111'); P.r(1.5, -19, 1, 1, '#111'); P.r(0, -17.5, 3, 1, '#f08a3a'); P.r(-4, -24, 8, 2, '#222'); P.r(-2.5, -29, 5, 5, '#222'); } },
  train: { name: 'Train', draw: (P) => { P.r(-19, -18, 30, 14, '#c0504a'); P.r(11, -14, 8, 10, '#8a3a34'); for (let i = 0; i < 3; i++) P.r(-16 + i * 9, -15, 6, 5, '#ffe8a0'); P.c(-12, -3, 3, '#222'); P.c(0, -3, 3, '#222'); P.c(12, -3, 3, '#222'); } },
  suitcase: { name: 'Suitcase', draw: (P) => { P.r(-11, -18, 22, 16, '#6a4a8a'); P.r(-4, -21, 8, 3, '#3a2a4a'); P.r(-11, -11, 22, 1.5, '#3a2a4a'); P.c(-7, -1.5, 1.5, '#222'); P.c(7, -1.5, 1.5, '#222'); } },
};

export function drawIdea(g, id, x, y, size = 1, { flip = false, faceless = false, desat: ds = 0, alpha = 1 } = {}) {
  const def = IDEAS[id];
  if (!def) return;
  g.save();
  g.globalAlpha = alpha;
  const k = size;
  def.draw(pen(g, x, y, k, flip, { faceless, desat: ds }));
  g.restore();
}

// Icon rendering for the palette: fit into w x h.
export function ideaIcon(id, w = 48, h = 48) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  drawIdea(g, id, w / 2, h - 3, (h - 6) / 40);
  return c;
}
