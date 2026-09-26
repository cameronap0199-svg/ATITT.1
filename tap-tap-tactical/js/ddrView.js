// Drawing the rhythm track. Prompts are never abstract: brass casings for reloads, pills
// for chemicals, feathers, rocks, water, salt and flame for the relics.

import { DIRS, ARROW } from './ddr.js';
import { arrowPath, roundRect, text, FONT, hash } from './render.js';

export const LANE_COLORS = { left: '#ff3df2', down: '#00e5ff', up: '#39ff6a', right: '#ff4a4a' };
const KEYS = { left: '←/A', down: '↓/S', up: '↑/W', right: '→/D' };

export function drawTrack(ctx, chart, now, o) {
  const { x, y, w, h, hitY, rising = false, skin = 'brass', ghosts = [], invert = false, t = now, fx = [], label = '', sub = '', showKeys = true, panel = true } = o;
  const laneW = w / 4;
  const laneX = (d) => x + laneW * (DIRS.indexOf(d) + 0.5);
  const travelPx = rising ? y + h - hitY : hitY - y;
  const posY = (rem) => (rising ? hitY + (rem / chart.travel) * travelPx : hitY - (rem / chart.travel) * travelPx);

  ctx.save();
  if (panel) {
    ctx.fillStyle = 'rgba(4,8,6,0.72)';
    roundRect(ctx, x - 10, y - 34, w + 20, h + 44, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(57,255,106,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let i = 1; i < 4; i++) {
      ctx.fillStyle = 'rgba(57,255,106,0.08)';
      ctx.fillRect(x + laneW * i - 1, y, 2, h);
    }
    if (label) text(ctx, label, x, y - 12, { size: 20, color: '#39ff6a', glow: 6 });
    if (sub) text(ctx, sub, x + w, y - 12, { size: 18, color: 'rgba(57,255,106,0.75)', align: 'right' });
  }
  ctx.beginPath();
  ctx.rect(x - 10, y - 4, w + 20, h + 8);
  ctx.clip();

  // The Mark: glowing receptors
  for (const d of DIRS) {
    const lx = laneX(d);
    const hit = fx.find((f) => f.dir === d && now - f.t0 < 0.15);
    ctx.save();
    ctx.translate(lx, hitY);
    ctx.shadowColor = LANE_COLORS[d];
    ctx.shadowBlur = hit ? 26 : 10;
    ctx.strokeStyle = hit ? '#fff' : LANE_COLORS[d];
    ctx.globalAlpha = hit ? 1 : 0.55;
    ctx.lineWidth = 3;
    arrowPath(ctx, d, laneW * 0.62);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 6);
  ctx.fillStyle = '#39ff6a';
  ctx.fillRect(x, hitY - 1, w, 2);
  ctx.restore();

  // Ghost arrows (hallucination): drawn like the real thing, only paler.
  for (const g of ghosts) {
    const rem = g.time - now;
    const py = posY(rem);
    if (rem < -0.3 || rem > chart.travel * 1.05) continue;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 20 + g.time * 7);
    drawNote(ctx, laneX(g.dir), py, g.dir, skin, laneW, invert ? invertColor(g.dir, g.time, t) : LANE_COLORS[g.dir], t, g.time);
    ctx.restore();
  }

  // Real notes
  for (const n of chart.notes) {
    if (n.state && n.state !== 'miss') continue;
    if (n.state === 'miss' && (n.requeued || now - n.time > 0.35)) continue;
    const rem = chart.visualRemaining(n, now);
    if (rem > chart.travel * 1.05 || rem < -0.4) continue;
    const py = posY(rem);
    ctx.save();
    if (n.state === 'miss') ctx.globalAlpha = 0.35;
    drawNote(ctx, laneX(n.dir), py, n.dir, skin, laneW, invert ? invertColor(n.dir, n.seed, t) : LANE_COLORS[n.dir], t, n.seed);
    ctx.restore();
  }
  ctx.restore();

  // Judgement popups
  for (const f of fx) {
    const age = now - f.t0;
    if (age > 0.6) continue;
    const lx = f.dir ? laneX(f.dir) : x + w / 2;
    const col = f.type === 'perfect' ? '#fff27a' : f.type === 'good' ? '#7affc1' : '#ff4a4a';
    const label2 = f.type === 'perfect' ? 'PERFECT' : f.type === 'good' ? (f.forgiven ? 'FORGIVEN' : 'GOOD') : 'MISS';
    text(ctx, label2, lx, (rising ? hitY + 60 : hitY - 44) - age * 40, { size: 20, font: FONT.mono, color: col, align: 'center', alpha: 1 - age / 0.6, glow: 8 });
    if (f.type === 'perfect' && age < 0.2) {
      ctx.save();
      ctx.globalAlpha = 1 - age / 0.2;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lx, hitY, laneW * 0.4 + age * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (showKeys) {
    for (const d of DIRS) text(ctx, KEYS[d], laneX(d), rising ? y - 16 : y + h + 22, { size: 16, color: 'rgba(200,255,220,0.5)', align: 'center' });
  }
}

function invertColor(dir, seed, t) {
  const order = ['left', 'down', 'up', 'right'];
  const k = Math.floor(hash(seed * 31 + Math.floor(t * 5)) * 4);
  return LANE_COLORS[order[(order.indexOf(dir) + 1 + k) % 4]];
}

export function drawNote(ctx, x, y, dir, skin, laneW, color, t, seed = 0) {
  const s = laneW / 75;
  ctx.save();
  ctx.translate(x, y);
  switch (skin) {
    case 'brass': {
      const cw = 30 * s, ch = 50 * s;
      ctx.rotate(Math.sin(t * 3 + seed * 10) * 0.12);
      const g = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
      g.addColorStop(0, '#6b4a14'); g.addColorStop(0.35, '#f3cf73'); g.addColorStop(0.6, '#c7952f'); g.addColorStop(1, '#5a3d10');
      ctx.fillStyle = g;
      roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 4 * s);
      ctx.fill();
      ctx.fillStyle = '#8a6420';
      ctx.fillRect(-cw / 2 - 2 * s, ch / 2 - 7 * s, cw + 4 * s, 7 * s);
      ctx.fillStyle = '#d7b35b';
      ctx.beginPath(); ctx.arc(0, ch / 2 - 3.5 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      // arrow violently scratched into the metal
      ctx.strokeStyle = '#2b1b05';
      ctx.lineWidth = 3 * s;
      arrowPath(ctx, dir, 22 * s);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2 * s;
      ctx.stroke();
      break;
    }
    case 'pill': {
      const pw = 58 * s, ph = 28 * s;
      ctx.save();
      roundRect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
      ctx.clip();
      ctx.fillStyle = '#f4f6f5';
      ctx.fillRect(-pw / 2, -ph / 2, pw / 2, ph);
      ctx.fillStyle = color;
      ctx.fillRect(0, -ph / 2, pw / 2, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-pw / 2, -ph / 2 + 3 * s, pw, 4 * s);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      roundRect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2);
      ctx.stroke();
      text(ctx, ARROW[dir], -pw / 4, 1, { size: 22 * s, font: FONT.tech, color: '#1b2a33', align: 'center', baseline: 'middle', weight: 'bold' });
      break;
    }
    case 'feather': {
      ctx.rotate(Math.sin(t * 4 + seed * 6) * 0.35);
      ctx.fillStyle = '#f7f7f2';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -30 * s);
      ctx.quadraticCurveTo(22 * s, -8 * s, 4 * s, 26 * s);
      ctx.lineTo(-4 * s, 26 * s);
      ctx.quadraticCurveTo(-22 * s, -8 * s, 0, -30 * s);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#c9c4b5';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -26 * s); ctx.lineTo(0, 34 * s); ctx.stroke();
      ctx.fillStyle = color;
      arrowPath(ctx, dir, 18 * s);
      ctx.fill();
      break;
    }
    case 'rock': {
      ctx.fillStyle = '#6f6b66';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = (22 + hash(seed * 50 + i) * 8) * s;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.85);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.ellipse(-6 * s, -8 * s, 10 * s, 5 * s, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a2826';
      ctx.lineWidth = 3.5 * s;
      arrowPath(ctx, dir, 24 * s);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'water': {
      const g = ctx.createRadialGradient(-5 * s, 0, 2, 0, 4 * s, 28 * s);
      g.addColorStop(0, '#d9f3ff'); g.addColorStop(0.5, '#3fa9ff'); g.addColorStop(1, '#0b3d7a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -30 * s);
      ctx.bezierCurveTo(18 * s, -6 * s, 24 * s, 8 * s, 0, 26 * s);
      ctx.bezierCurveTo(-24 * s, 8 * s, -18 * s, -6 * s, 0, -30 * s);
      ctx.fill();
      ctx.fillStyle = '#fff';
      arrowPath(ctx, dir, 16 * s);
      ctx.translate(0, 6 * s);
      ctx.fill();
      break;
    }
    case 'salt': {
      const c = 20 * s;
      ctx.rotate(0.3 + seed);
      ctx.fillStyle = '#f7f7f7';
      ctx.beginPath(); ctx.moveTo(0, -c); ctx.lineTo(c, -c / 2); ctx.lineTo(0, 0); ctx.lineTo(-c, -c / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9d9d9';
      ctx.beginPath(); ctx.moveTo(-c, -c / 2); ctx.lineTo(0, 0); ctx.lineTo(0, c); ctx.lineTo(-c, c / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bdbdbd';
      ctx.beginPath(); ctx.moveTo(c, -c / 2); ctx.lineTo(0, 0); ctx.lineTo(0, c); ctx.lineTo(c, c / 2); ctx.closePath(); ctx.fill();
      ctx.rotate(-0.3 - seed);
      ctx.fillStyle = color;
      arrowPath(ctx, dir, 16 * s);
      ctx.fill();
      break;
    }
    case 'flame': {
      const f = 1 + 0.15 * Math.sin(t * 20 + seed * 9);
      const g = ctx.createLinearGradient(0, 26 * s, 0, -34 * s * f);
      g.addColorStop(0, '#ff3d00'); g.addColorStop(0.6, '#ffb020'); g.addColorStop(1, '#fff4c2');
      ctx.fillStyle = g;
      ctx.shadowColor = '#ff6a00';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0, -34 * s * f);
      ctx.bezierCurveTo(22 * s, -8 * s, 22 * s, 18 * s, 0, 26 * s);
      ctx.bezierCurveTo(-22 * s, 18 * s, -22 * s, -8 * s, 0, -34 * s * f);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3a0a00';
      arrowPath(ctx, dir, 16 * s);
      ctx.translate(0, 4 * s);
      ctx.fill();
      break;
    }
    case 'plain': {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      arrowPath(ctx, dir, 44 * s);
      ctx.stroke();
      break;
    }
    default: { // neon (dance-off)
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      arrowPath(ctx, dir, 50 * s);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

