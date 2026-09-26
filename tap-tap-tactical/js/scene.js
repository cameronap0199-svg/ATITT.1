// The black site, drawn procedurally: a cyber-cathedral of neon scripture, stained-glass
// surveillance and waist-high cover. Also the player's own barrier, hands and gun.

import { W, H, TICKER } from './data.js';
import { makeCanvas, text, FONT, hash, roundRect, clamp, COLORS } from './render.js';

export const THEMES = {
  chapel: { name: 'NAVE-7', wall: '#150c1f', wall2: '#261238', floor: '#0e0a14', neonA: '#ff2d95', neonB: '#00e5ff', glass: ['#ff2d95', '#00e5ff', '#ffd24a', '#7a3cff'], fog: 'rgba(90,20,110,0.28)' },
  morgue: { name: 'MORGUE-3', wall: '#0b1613', wall2: '#12241f', floor: '#0a100e', neonA: '#39ff6a', neonB: '#d8fff0', glass: ['#39ff6a', '#b8ffda', '#1f8a5a', '#e8fff4'], fog: 'rgba(20,90,55,0.24)' },
  reactor: { name: 'FURNACE-9', wall: '#1a0d08', wall2: '#2c140a', floor: '#110a07', neonA: '#ff6a00', neonB: '#ffd24a', glass: ['#ff6a00', '#ffd24a', '#ff2a2a', '#ffe9b0'], fog: 'rgba(120,45,10,0.24)' },
  abyss: { name: 'BAPTISTRY-0', wall: '#080b1c', wall2: '#0f1638', floor: '#070913', neonA: '#3fa9ff', neonB: '#a35cff', glass: ['#3fa9ff', '#a35cff', '#00e5ff', '#1b2a80'], fog: 'rgba(20,45,130,0.26)' },
  throne: { name: 'SANCTUM', wall: '#17110d', wall2: '#2a1f17', floor: '#0f0c0a', neonA: '#ffffff', neonB: '#ffd24a', glass: ['#ffffff', '#ffd24a', '#ff2a2a', '#fff3c0'], fog: 'rgba(130,105,70,0.22)' },
};

export const HORIZON = 280;
export const BACK = { x0: 250, x1: 1030, y0: 30, y1: 360 };
export const groundY = (z) => BACK.y1 + 400 * z;
export const scaleAt = (z) => 0.2 * (1 + 5 * z);
export const FIG_H = 260;
export const COVER_H = 100; // waist-high props, in figure units
export const STAND_TOP = 612;   // top of the player's barrier while popped up
export const CROUCH_TOP = 300;  // ... and while in cover
export const CROUCH_SHIFT = 190; // how far the room slides up when you duck

const SIGNS = ['OBEY', 'HE SEES YOU', 'REPORT DANCING', 'DRINK THE WATER', 'SMILE: YOU ARE JUDGED', 'NO RUNNING IN HADES', 'PRAY • WORK • COMPLY', 'CONFESS TODAY'];

export function buildScene(rng, themeName = 'chapel', { boss = false } = {}) {
  const theme = THEMES[themeName];
  const bg = makeCanvas(W, H);
  const g = bg.getContext('2d');
  paintRoom(g, rng, theme, boss);

  // Cover spots: back row, mid row, front row. Props are waist-high.
  const rows = boss
    ? [{ z: 0.46, xs: [150, 1130] }, { z: 0.6, xs: [300, 980] }]
    : [{ z: 0.2, xs: [420, 640, 860] }, { z: 0.45, xs: [180, 470, 810, 1100] }, { z: 0.64, xs: [330, 950] }];
  const types = themeName === 'chapel' || themeName === 'throne' ? ['pew', 'pew', 'altar', 'barrier', 'crate']
    : themeName === 'morgue' ? ['slab', 'slab', 'crate', 'barrier', 'rack']
      : themeName === 'reactor' ? ['crate', 'barrier', 'rack', 'barrier'] : ['barrier', 'rack', 'pew', 'crate'];
  const spots = [];
  for (const row of rows) {
    for (const x0 of row.xs) {
      const z = row.z + rng.range(-0.02, 0.02);
      const s = scaleAt(z);
      const x = x0 + rng.range(-25, 25);
      const type = z < 0.3 && rng.chance(0.4) ? 'altar' : rng.pick(types);
      const w = (type === 'rack' ? 110 : type === 'altar' ? 190 : type === 'pew' ? 230 : 170) * s;
      const h = COVER_H * s;
      spots.push({ x, z, s, y: groundY(z), prop: { type, w, h, seed: rng() }, coverTop: groundY(z) - h, enemy: null });
    }
  }
  return { theme, themeName, bg, spots, ticker: rng.shuffle([...TICKER]).join('      ✝      '), seed: rng() };
}

function paintRoom(g, rng, th, boss) {
  const { x0, x1, y0, y1 } = BACK;
  // Base
  g.fillStyle = '#050407';
  g.fillRect(0, 0, W, H);
  // Ceiling
  const ceil = g.createLinearGradient(0, 0, 0, y0);
  ceil.addColorStop(0, '#020203');
  ceil.addColorStop(1, th.wall);
  g.fillStyle = ceil;
  g.fillRect(0, 0, W, y0 + 2);
  // Side walls
  const side = (flip) => {
    g.save();
    if (flip) { g.translate(W, 0); g.scale(-1, 1); }
    const grd = g.createLinearGradient(0, 0, x0, 0);
    grd.addColorStop(0, '#040305');
    grd.addColorStop(1, th.wall2);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, -140); g.lineTo(x0, y0); g.lineTo(x0, y1); g.lineTo(0, 411); g.closePath();
    g.fill();
    // pillars with neon strips
    for (let i = 0; i < 3; i++) {
      const px = 40 + i * 70;
      const top = y0 - (x0 - px) * 0.66;
      const bot = y1 + (x0 - px) * 0.13;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(px - 10, top, 20 - i * 3, bot - top);
      g.save();
      g.shadowColor = i % 2 ? th.neonB : th.neonA;
      g.shadowBlur = 14;
      g.fillStyle = i % 2 ? th.neonB : th.neonA;
      g.fillRect(px + 4 - i, top + 20, 2.5, bot - top - 40);
      g.restore();
    }
    // posters
    const sign = SIGNS[Math.floor(rng() * SIGNS.length)];
    g.save();
    g.transform(1, 0.13, 0, 1, 0, 0);
    g.fillStyle = 'rgba(230,220,200,0.12)';
    g.fillRect(150, 130, 70, 100);
    g.strokeStyle = th.neonA;
    g.globalAlpha = 0.6;
    g.strokeRect(150, 130, 70, 100);
    g.globalAlpha = 1;
    text(g, sign.split(' ')[0], 185, 170, { size: 18, font: FONT.title, color: th.neonA, align: 'center', glow: 8 });
    text(g, sign.split(' ').slice(1).join(' '), 185, 192, { size: 11, font: FONT.tech, color: '#ddd', align: 'center' });
    g.beginPath();
    g.arc(185, 212, 9, 0, Math.PI * 2);
    g.strokeStyle = '#ddd';
    g.stroke();
    g.fillStyle = '#ddd';
    g.beginPath(); g.arc(185, 212, 3, 0, Math.PI * 2); g.fill();
    g.restore();
    // pipes
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, 300 + (flip ? 20 : 0)); g.lineTo(x0, 330); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 297 + (flip ? 20 : 0)); g.lineTo(x0, 328); g.stroke();
    g.restore();
  };
  side(false);
  side(true);
  // Back wall
  const bw = g.createLinearGradient(0, y0, 0, y1);
  bw.addColorStop(0, th.wall2);
  bw.addColorStop(1, th.wall);
  g.fillStyle = bw;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Brick / panel lines
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  for (let y = y0 + 14; y < y1; y += 14) {
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    for (let x = x0 + ((y / 14) % 2) * 20; x < x1; x += 40) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 14); g.stroke(); }
  }
  // Gothic arches
  const arch = (cx, w, top, bot, color) => {
    g.save();
    g.beginPath();
    g.moveTo(cx - w / 2, bot);
    g.lineTo(cx - w / 2, top + w * 0.55);
    g.quadraticCurveTo(cx - w / 2, top, cx, top - w * 0.15);
    g.quadraticCurveTo(cx + w / 2, top, cx + w / 2, top + w * 0.55);
    g.lineTo(cx + w / 2, bot);
    g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fill();
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.stroke();
    g.restore();
  };
  arch(400, 120, 80, y1, th.neonA);
  arch(880, 120, 80, y1, th.neonA);
  arch(640, 250, 50, y1, th.neonB);
  // Neon crosses in the side arches
  for (const cx of [400, 880]) {
    g.save();
    g.shadowColor = th.neonA;
    g.shadowBlur = 22;
    g.fillStyle = th.neonA;
    g.fillRect(cx - 4, 140, 8, 120);
    g.fillRect(cx - 32, 170, 64, 8);
    g.restore();
  }
  // Rose window: the G.O.D. eye
  roseWindow(g, 640, 165, boss ? 110 : 95, th, rng);
  // Dais / steps under the window
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(520, y1 - 22, 240, 22);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(520, y1 - 22, 240, 2);
  // Floor
  const fl = g.createLinearGradient(0, y1, 0, H);
  fl.addColorStop(0, th.floor);
  fl.addColorStop(1, '#030304');
  g.fillStyle = fl;
  g.beginPath();
  g.moveTo(x0, y1); g.lineTo(x1, y1); g.lineTo(W, 411); g.lineTo(W, H); g.lineTo(0, H); g.lineTo(0, 411); g.closePath();
  g.fill();
  // Tile grid in perspective
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.045)';
  g.lineWidth = 1;
  for (let i = -12; i <= 12; i++) {
    const bx = 640 + i * 65;
    g.beginPath(); g.moveTo(bx, y1); g.lineTo(640 + (bx - 640) * 6, y1 + 400); g.stroke();
  }
  for (let z = 0.04; z < 1; z *= 1.45) {
    const y = y1 + 400 * z;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  g.restore();
  // Neon reflections on the floor
  for (const [x, c] of [[400, th.neonA], [880, th.neonA], [640, th.neonB]]) {
    const rg = g.createLinearGradient(0, y1, 0, y1 + 260);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.globalAlpha = 0.13;
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(x - 20, y1); g.lineTo(x + 20, y1); g.lineTo(x + (x - 640) * 0.8 + 90, y1 + 260); g.lineTo(x + (x - 640) * 0.8 - 90, y1 + 260); g.closePath();
    g.fill();
    g.restore();
  }
  // Stains, casings, drains
  for (let i = 0; i < 9; i++) {
    const z = rng.range(0.05, 0.9);
    const y = y1 + 400 * z;
    const x = 640 + rng.range(-1, 1) * (300 + 500 * z);
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = rng.chance(0.6) ? '#3a0508' : '#000';
    g.beginPath();
    g.ellipse(x, y, 30 + 60 * z, (8 + 16 * z) * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  for (let i = 0; i < 40; i++) {
    const z = rng.range(0.5, 1);
    const y = y1 + 400 * z;
    const x = rng.range(0, W);
    g.save();
    g.translate(x, y);
    g.rotate(rng.range(0, Math.PI));
    g.fillStyle = '#b8892f';
    g.fillRect(-4 * z * 1.5, -1.5 * z * 1.5, 8 * z * 1.5, 3 * z * 1.5);
    g.restore();
  }
  // Hanging chains and cables
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  for (let i = 0; i < 7; i++) {
    const x = rng.range(60, W - 60);
    const len = rng.range(40, 170);
    g.lineWidth = rng.range(1, 3);
    g.beginPath();
    g.moveTo(x, 0);
    g.quadraticCurveTo(x + rng.range(-30, 30), len * 0.6, x + rng.range(-10, 10), len);
    g.stroke();
  }
  // Fluorescent tubes
  for (const x of [330, 950]) {
    g.save();
    g.shadowColor = '#e8f6ff';
    g.shadowBlur = 20;
    g.fillStyle = '#e8f6ff';
    g.fillRect(x - 60, 14, 120, 4);
    g.restore();
  }
  // Fog
  const fog = g.createLinearGradient(0, HORIZON - 120, 0, y1 + 140);
  fog.addColorStop(0, 'rgba(0,0,0,0)');
  fog.addColorStop(0.5, th.fog);
  fog.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fog;
  g.fillRect(0, HORIZON - 120, W, 400);
}

function roseWindow(g, cx, cy, r, th, rng) {
  g.save();
  g.translate(cx, cy);
  const segs = 12;
  for (let ring = 0; ring < 3; ring++) {
    const r0 = r * (ring / 3), r1 = r * ((ring + 1) / 3);
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2 + ring * 0.26, a1 = ((i + 1) / segs) * Math.PI * 2 + ring * 0.26;
      g.beginPath();
      g.arc(0, 0, r1, a0, a1);
      g.arc(0, 0, r0, a1, a0, true);
      g.closePath();
      g.globalAlpha = 0.35 + rng() * 0.35;
      g.fillStyle = th.glass[(i + ring) % th.glass.length];
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = '#050305';
      g.lineWidth = 3;
      g.stroke();
    }
  }
  // Eye of G.O.D. with wings
  g.shadowColor = '#fff';
  g.shadowBlur = 18;
  g.fillStyle = '#f7f1e3';
  g.beginPath();
  g.moveTo(-r * 0.62, 0);
  g.quadraticCurveTo(0, -r * 0.5, r * 0.62, 0);
  g.quadraticCurveTo(0, r * 0.5, -r * 0.62, 0);
  g.fill();
  g.fillStyle = '#b00018';
  g.beginPath(); g.arc(0, 0, r * 0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#000';
  g.beginPath(); g.arc(0, 0, r * 0.09, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = th.neonB;
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, r + 4, 0, Math.PI * 2); g.stroke();
  // Letters under the window
  g.restore();
  text(g, 'G . O . D .', cx, cy + r + 34, { size: 22, font: FONT.title, color: th.neonB, align: 'center', glow: 12 });
}

// Animated bits over the cached background: ticker, flicker, drifting ash.
export function drawSceneDynamic(ctx, scene, t) {
  const th = scene.theme;
  // LED ticker band on the back wall
  const y = 318;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(BACK.x0 + 10, y - 14, BACK.x1 - BACK.x0 - 20, 22);
  ctx.beginPath();
  ctx.rect(BACK.x0 + 12, y - 14, BACK.x1 - BACK.x0 - 24, 22);
  ctx.clip();
  ctx.font = `18px ${FONT.mono}`;
  const tw = ctx.measureText(scene.ticker).width + 200;
  const off = (t * 70) % tw;
  text(ctx, scene.ticker, BACK.x1 - off, y + 2, { size: 18, color: '#ff4a3a', glow: 6 });
  text(ctx, scene.ticker, BACK.x1 - off + tw, y + 2, { size: 18, color: '#ff4a3a', glow: 6 });
  ctx.restore();
  // Window pulse / neon flicker
  const flick = hash(Math.floor(t * 12) + scene.seed * 100) > 0.93;
  if (flick) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.fillRect(BACK.x0, BACK.y0, BACK.x1 - BACK.x0, 260);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.08 + 0.05 * Math.sin(t * 2);
  ctx.fillStyle = th.neonB;
  ctx.beginPath();
  ctx.arc(640, 165, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Ash / dust
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 26; i++) {
    const px = (hash(i) * W + t * (8 + hash(i + 9) * 16)) % W;
    const py = (hash(i + 3) * H * 0.8 + t * (10 + hash(i + 5) * 20)) % (H * 0.8);
    ctx.globalAlpha = 0.15 + hash(i + 7) * 0.3;
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.restore();
}

// Waist-high cover in the room.
export function drawProp(ctx, spot, th, t) {
  const { x, y } = spot;
  const { type, w, h, seed } = spot.prop;
  const s = spot.s;
  ctx.save();
  ctx.translate(x, y);
  switch (type) {
    case 'pew': {
      ctx.fillStyle = '#1b0f0a';
      ctx.fillRect(-w / 2, -h, w, h * 0.35);           // backrest
      ctx.fillStyle = '#2a170f';
      ctx.fillRect(-w / 2, -h * 0.55, w, h * 0.2);     // seat
      ctx.fillStyle = '#120905';
      ctx.fillRect(-w / 2, -h * 0.35, w, h * 0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(-w / 2, -h, w, 2);
      for (const ex of [-w / 2, w / 2 - 10 * s]) { ctx.fillStyle = '#0c0604'; ctx.fillRect(ex, -h * 1.12, 10 * s, h * 1.12); }
      ctx.save();
      ctx.shadowColor = th.neonA; ctx.shadowBlur = 8; ctx.fillStyle = th.neonA;
      ctx.fillRect(-w / 2 + 12 * s, -h * 0.66, w - 24 * s, 1.5);
      ctx.restore();
      break;
    }
    case 'altar': {
      ctx.fillStyle = '#231d18';
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.fillStyle = '#e9e1cf';
      ctx.fillRect(-w / 2 - 4 * s, -h, w + 8 * s, h * 0.18);
      ctx.fillRect(-w * 0.18, -h, w * 0.36, h * 0.8);
      ctx.fillStyle = '#b00018';
      ctx.fillRect(-3 * s, -h * 0.78, 6 * s, h * 0.5);
      ctx.fillRect(-14 * s, -h * 0.66, 28 * s, 5 * s);
      for (let i = 0; i < 4; i++) {
        const cx = -w / 2 + 14 * s + i * (w - 28 * s) / 3;
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(cx - 2.5 * s, -h - 16 * s, 5 * s, 16 * s);
        const fl = 1 + 0.25 * Math.sin(t * 17 + i * 2 + seed * 9);
        ctx.save();
        ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 12; ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.ellipse(cx, -h - 20 * s, 2.5 * s, 5 * s * fl, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'crate': {
      const cw = w / 2;
      for (let i = 0; i < 2; i++) {
        const cx = -w / 2 + i * cw;
        ctx.fillStyle = i ? '#2b2e30' : '#23272a';
        ctx.fillRect(cx, -h, cw - 2, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(cx + 3, -h + 3, cw - 8, h - 6);
        ctx.save();
        ctx.beginPath(); ctx.rect(cx, -h * 0.22, cw - 2, h * 0.14); ctx.clip();
        for (let k = -2; k < 12; k++) { ctx.fillStyle = k % 2 ? '#111' : '#d9a400'; ctx.fillRect(cx + k * 10 * s, -h * 0.22, 5 * s, h * 0.14); }
        ctx.restore();
        text(ctx, 'G.O.D.', cx + cw / 2, -h * 0.5, { size: Math.max(8, 16 * s), font: FONT.title, color: 'rgba(255,255,255,0.35)', align: 'center' });
      }
      break;
    }
    case 'rack': {
      ctx.fillStyle = '#0d0f12';
      ctx.fillRect(-w / 2, -h, w, h);
      ctx.strokeStyle = '#2a2f36';
      ctx.strokeRect(-w / 2, -h, w, h);
      for (let r = 0; r < 5; r++) {
        const ry = -h + 6 * s + r * (h - 10 * s) / 5;
        ctx.fillStyle = '#16191e';
        ctx.fillRect(-w / 2 + 4 * s, ry, w - 8 * s, (h - 14 * s) / 5 - 2);
        for (let l = 0; l < 4; l++) {
          const on = hash(Math.floor(t * 6) + r * 11 + l * 3 + seed * 50) > 0.45;
          ctx.fillStyle = on ? (l % 2 ? th.neonB : '#39ff6a') : '#113';
          ctx.fillRect(-w / 2 + 8 * s + l * 7 * s, ry + 3 * s, 3 * s, 3 * s);
        }
      }
      break;
    }
    case 'slab': {
      ctx.fillStyle = '#9aa6a3';
      ctx.fillRect(-w / 2, -h, w, h * 0.16);
      ctx.fillStyle = '#5c6664';
      ctx.fillRect(-w / 2 + 8 * s, -h * 0.84, w - 16 * s, h * 0.84);
      ctx.fillStyle = '#d7dcd6';
      ctx.beginPath(); ctx.ellipse(-w * 0.15, -h - 8 * s, w * 0.32, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8bdb6';
      ctx.fillRect(w * 0.18, -h - 12 * s, 8 * s, 6 * s);
      break;
    }
    default: { // concrete barrier
      ctx.fillStyle = '#4c4e52';
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 + 10 * s, -h * 0.35); ctx.lineTo(-w / 2 + 18 * s, -h);
      ctx.lineTo(w / 2 - 18 * s, -h); ctx.lineTo(w / 2 - 10 * s, -h * 0.35); ctx.lineTo(w / 2, 0); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(-w / 2 + 18 * s, -h, w - 36 * s, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.1, -h); ctx.lineTo(-w * 0.05, -h * 0.7); ctx.lineTo(-w * 0.12, -h * 0.45);
      ctx.stroke();
      text(ctx, 'F.A.I.T.H.', w * 0.05, -h * 0.4, { size: Math.max(7, 15 * s), font: FONT.title, color: 'rgba(170,20,30,0.55)', align: 'center' });
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The player's own barrier. Textures are painted once.
// ---------------------------------------------------------------------------
let concrete = null;
let flesh = null;
function paintConcrete() {
  const c = makeCanvas(W, 440);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 440);
  grd.addColorStop(0, '#6d6f71');
  grd.addColorStop(1, '#2b2c2e');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, 440);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`;
    g.fillRect(Math.random() * W, Math.random() * 440, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let k = 0; k < 7; k++) {
    let x = Math.random() * W, y = 0;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath(); g.moveTo(x, y);
    while (y < 440) { x += (Math.random() - 0.5) * 40; y += 10 + Math.random() * 30; g.lineTo(x, y); }
    g.stroke();
  }
  // seams between barrier blocks
  for (const x of [300, 980]) {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(x, 0, 6, 440);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(x + 6, 0, 2, 440);
  }
  g.save();
  g.globalAlpha = 0.22;
  text(g, 'F.A.I.T.H.', 640, 150, { size: 120, font: FONT.title, color: '#8d1018', align: 'center' });
  g.restore();
  text(g, 'HADES // SECTOR 7 — SUBJECT HOLDING — DO NOT FEED', 640, 250, { size: 20, font: FONT.tech, color: 'rgba(230,220,180,0.35)', align: 'center' });
  text(g, '87', 1120, 330, { size: 70, font: FONT.title, color: 'rgba(230,220,180,0.18)', align: 'center' });
  return c;
}
function paintFlesh() {
  const c = makeCanvas(W, 440);
  const g = c.getContext('2d');
  g.fillStyle = '#5a0d12';
  g.fillRect(0, 0, W, 440);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * 440;
    g.strokeStyle = `rgba(${150 + Math.random() * 90},${20 + Math.random() * 40},${30 + Math.random() * 30},0.5)`;
    g.lineWidth = 2 + Math.random() * 5;
    g.beginPath();
    g.moveTo(-20, y);
    g.bezierCurveTo(W * 0.3, y + (Math.random() - 0.5) * 60, W * 0.6, y + (Math.random() - 0.5) * 60, W + 20, y + (Math.random() - 0.5) * 40);
    g.stroke();
  }
  // Ribs
  for (let i = 0; i < 9; i++) {
    const x = 90 + i * 140;
    g.strokeStyle = '#e9dcc4';
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, 20);
    g.quadraticCurveTo(x + 70, 180, x + 10, 420);
    g.stroke();
    g.strokeStyle = 'rgba(120,90,60,0.5)';
    g.lineWidth = 3;
    g.stroke();
  }
  return c;
}

export function drawBarrier(ctx, top, t, { anatomy = false, fire = 0, reduceFlash = false } = {}) {
  if (!concrete) concrete = paintConcrete();
  ctx.save();
  // Top face
  ctx.fillStyle = '#8a8c8e';
  ctx.fillRect(-10, top, W + 20, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-10, top, W + 20, 2);
  ctx.drawImage(concrete, 0, top + 16);
  if (anatomy) {
    if (!flesh) flesh = paintFlesh();
    const pulse = 0.55 + 0.3 * Math.sin(t * 5.2);
    ctx.save();
    ctx.beginPath();
    // Torn patches where the concrete has peeled away from the meat underneath.
    for (let i = 0; i < 4; i++) {
      const cx = 170 + i * 310 + Math.sin(i * 2.3) * 50;
      const cy = top + 150 + (i % 2) * 90;
      const breathe = 1 + 0.06 * Math.sin(t * 5.2 + i);
      for (let k = 0; k <= 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        const r = (0.62 + 0.4 * hash(i * 40 + k)) * breathe;
        const x = cx + Math.cos(a) * 190 * r, y = cy + Math.sin(a) * 105 * r;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.clip();
    ctx.globalAlpha = pulse;
    ctx.drawImage(flesh, 0, top + 16);
    ctx.restore();
  }
  // Grime at the lip
  const lip = ctx.createLinearGradient(0, top + 16, 0, top + 60);
  lip.addColorStop(0, 'rgba(0,0,0,0.5)');
  lip.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lip;
  ctx.fillRect(0, top + 16, W, 44);
  if (fire > 0) drawBlueFire(ctx, top, t, fire, reduceFlash);
  ctx.restore();
}

function drawBlueFire(ctx, top, t, amount, reduceFlash) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const a = clamp(amount, 0, 1);
  for (let i = 0; i < 46; i++) {
    const x = (i / 45) * W + Math.sin(t * 3 + i) * 12;
    const hgt = (60 + 70 * hash(i + Math.floor(t * 18))) * a;
    const g = ctx.createLinearGradient(0, top + 30, 0, top - hgt);
    g.addColorStop(0, 'rgba(40,120,255,0.85)');
    g.addColorStop(0.5, 'rgba(90,200,255,0.5)');
    g.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 26, top + 30);
    ctx.quadraticCurveTo(x - 10, top - hgt * 0.5, x + Math.sin(t * 9 + i) * 8, top - hgt);
    ctx.quadraticCurveTo(x + 10, top - hgt * 0.5, x + 26, top + 30);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = (reduceFlash ? 0.12 : 0.22) * a;
  ctx.fillStyle = COLORS.blueFire;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Subject 87's hands, seen while crouched. Flayed Hands strips them to muscle and bone.
export function drawHands(ctx, t, { flayed = false, busy = false, top = CROUCH_TOP } = {}) {
  for (const side of [-1, 1]) {
    ctx.save();
    const bx = side < 0 ? 150 : W - 150;
    const tap = busy ? Math.max(0, Math.sin(t * 22 + (side > 0 ? 1.5 : 0))) * 10 : 0;
    ctx.translate(bx, H + 30 - tap * 0.4);
    ctx.scale(side, 1);
    ctx.rotate(-0.25);
    // forearm
    ctx.fillStyle = flayed ? '#7b1119' : '#2e3326';
    roundRect(ctx, -60, -60, 120, 200, 40);
    ctx.fill();
    // palm
    ctx.fillStyle = flayed ? '#a3202a' : '#3b4231';
    roundRect(ctx, -58, -190, 116, 150, 38);
    ctx.fill();
    const fingers = [[-44, -250, 24, 90], [-15, -275, 24, 110], [14, -268, 24, 104], [42, -240, 22, 82]];
    fingers.forEach(([fx, fy, fw, fh], i) => {
      const lift = busy && i === Math.floor(t * 10 + (side > 0 ? 2 : 0)) % 4 ? 14 : 0;
      ctx.fillStyle = flayed ? '#b52531' : '#454d39';
      roundRect(ctx, fx - fw / 2, fy - lift, fw, fh, 11);
      ctx.fill();
      if (flayed) {
        ctx.strokeStyle = '#efe6d2';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx, fy - lift + 8); ctx.lineTo(fx, fy - lift + fh - 6); ctx.stroke();
        ctx.fillStyle = '#efe6d2';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(fx, fy - lift + 10 + k * fh / 3, 5, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(fx - fw / 2 + 3, fy - lift + fh * 0.42, fw - 6, 3);
      }
    });
    // thumb
    ctx.fillStyle = flayed ? '#a3202a' : '#3f4634';
    ctx.save();
    ctx.translate(-66, -120);
    ctx.rotate(-0.8);
    roundRect(ctx, -12, -70, 26, 80, 12);
    ctx.fill();
    ctx.restore();
    if (flayed) {
      ctx.strokeStyle = 'rgba(255,190,190,0.35)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(-50 + k * 12, -180); ctx.quadraticCurveTo(-40 + k * 11, -110, -50 + k * 12, -40); ctx.stroke(); }
    } else {
      // fingerless glove cuffs & tally marks
      ctx.fillStyle = '#1d2118';
      ctx.fillRect(-60, -70, 120, 22);
      ctx.strokeStyle = 'rgba(220,210,190,0.5)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-40 + k * 9, -20); ctx.lineTo(-40 + k * 9, 10); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-46, 4); ctx.lineTo(0, -16); ctx.stroke();
    }
    ctx.restore();
  }
}
