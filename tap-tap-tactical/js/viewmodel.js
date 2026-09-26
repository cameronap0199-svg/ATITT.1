// First-person gun, held low and to the right like the concept art. Each weapon gets its
// own silhouette; muzzle flash and recoil are driven by the combat room.

import { COLORS, clamp } from './render.js';

const LOOK = {
  pistol: { L: 280, r0: 60, r1: 200, rh: 26, bh: 10, neon: '#ff4a4a' },
  slapper: { L: 310, r0: 50, r1: 210, rh: 30, bh: 15, neon: COLORS.gold, drum: true },
  rifle: { L: 410, r0: 40, r1: 260, rh: 32, bh: 9, neon: COLORS.cyan, scope: true, mag: true },
  doodler: { L: 400, r0: 30, r1: 170, rh: 30, bh: 9, neon: '#ffd24a', double: true, wood: true },
  judgment: { L: 330, r0: 40, r1: 300, rh: 44, bh: 0, neon: '#ffffff', quad: true, white: true },
  thurible: { L: 370, r0: 40, r1: 360, rh: 30, bh: 0, neon: COLORS.gold, censer: true, brass: true },
  needler: { L: 350, r0: 40, r1: 280, rh: 30, bh: 8, neon: '#ff5fb8', needles: true, organic: true },
  railgun: { L: 440, r0: 40, r1: 180, rh: 26, bh: 7, neon: COLORS.cyan, fins: true },
};

export function drawGun(ctx, id, t, { recoil = 0, muzzle = 0, aimX = 640, aimY = 360, overload = false, drop = 0, sway = 0 } = {}) {
  const g = LOOK[id] || LOOK.rifle;
  const px = 1040, py = 800 + drop;
  const aim = Math.atan2(aimY - py, aimX - px);
  const a = -2.2 + clamp(aim + 2.2, -0.5, 0.5) * 0.4 - recoil * 0.07 + Math.sin(t * 1.7) * 0.01 * (1 + sway);
  ctx.save();
  ctx.translate(px + Math.sin(t * 2.1) * sway * 3, py + Math.cos(t * 1.9) * sway * 3);
  ctx.rotate(a);
  ctx.scale(1, -1);
  ctx.translate(-recoil * 26, 0);
  const f = (x) => 1 - 0.5 * (x / g.L);
  const metal = g.white ? '#e7e1d2' : g.brass ? '#9c7a2e' : g.organic ? '#3b2140' : '#1c1f23';
  const edge = g.white ? '#fff' : g.brass ? '#e3c26c' : g.organic ? '#7a3a80' : '#40464e';
  // sleeve + glove at the grip
  ctx.fillStyle = '#2b2f24';
  ctx.beginPath(); ctx.moveTo(-140, -60); ctx.lineTo(90, -40); ctx.lineTo(110, 70); ctx.lineTo(-140, 110); ctx.closePath(); ctx.fill();
  // receiver
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(g.r0 - 80, g.rh * f(0));
  ctx.lineTo(g.r1, g.rh * f(g.r1));
  ctx.lineTo(g.r1, -g.rh * f(g.r1));
  ctx.lineTo(g.r0 - 80, -g.rh * 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (g.wood) {
    ctx.fillStyle = '#6b3f1d';
    ctx.beginPath(); ctx.moveTo(-90, -30); ctx.lineTo(g.r0 + 20, -24); ctx.lineTo(g.r0 + 20, 26); ctx.lineTo(-90, 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(-10, 6, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b3f1d';
    ctx.fillRect(-16, 0, 3, 5); ctx.fillRect(-6, 0, 3, 5);
    ctx.strokeStyle = '#6b3f1d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-10, 8, 7, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  // barrel(s)
  if (g.bh) {
    const barrel = (off) => {
      ctx.fillStyle = '#121418';
      ctx.beginPath();
      ctx.moveTo(g.r1 - 10, off + g.bh * f(g.r1));
      ctx.lineTo(g.L, off * f(g.L) + g.bh * f(g.L));
      ctx.lineTo(g.L, off * f(g.L) - g.bh * f(g.L));
      ctx.lineTo(g.r1 - 10, off - g.bh * f(g.r1));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    if (g.double) { barrel(-10); barrel(10); } else barrel(0);
  }
  if (g.drum) {
    ctx.fillStyle = '#2a2d33';
    ctx.beginPath(); ctx.arc(140, 0, 38 * f(140), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 6; i++) { const aa = (i / 6) * Math.PI * 2 + recoil; ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.arc(140 + Math.cos(aa) * 22 * f(140), Math.sin(aa) * 22 * f(140), 6, 0, Math.PI * 2); ctx.fill(); }
  }
  if (g.quad) {
    const x = g.r1;
    ctx.fillStyle = '#d9d3c4';
    ctx.fillRect(x - 6, -g.rh * f(x) - 4, 30, (g.rh * f(x) + 4) * 2);
    for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillStyle = '#050505';
      ctx.beginPath(); ctx.ellipse(x + 26, oy * 14 * f(x), 6, 10 * f(x), 0, 0, Math.PI * 2); ctx.fill();
      if (ox > 0) { ctx.fillStyle = '#9d0f1b'; ctx.fillRect(x - 60, -4, 40, 8); }
    }
  }
  if (g.scope) {
    ctx.fillStyle = '#0e1013';
    ctx.fillRect(110, -g.rh - 26, 110, 22);
    ctx.fillStyle = '#29425a';
    ctx.beginPath(); ctx.ellipse(220, -g.rh - 15, 5, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e1013';
    ctx.fillRect(140, -g.rh - 6, 12, 8); ctx.fillRect(190, -g.rh - 6, 12, 8);
  }
  if (g.mag) {
    ctx.fillStyle = '#15171a';
    ctx.beginPath(); ctx.moveTo(150, g.rh * f(150)); ctx.lineTo(185, g.rh * f(185)); ctx.lineTo(175, g.rh + 70); ctx.lineTo(138, g.rh + 64); ctx.closePath(); ctx.fill();
  }
  if (g.needles) {
    ctx.fillStyle = '#ff5fb8';
    ctx.shadowColor = '#ff5fb8';
    ctx.shadowBlur = 10;
    for (let i = 0; i < 7; i++) {
      const x = 80 + i * 26;
      ctx.beginPath(); ctx.moveTo(x - 7, -g.rh * f(x)); ctx.lineTo(x + 4, -g.rh * f(x) - 30 - Math.sin(t * 5 + i) * 4); ctx.lineTo(x + 8, -g.rh * f(x)); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  if (g.fins) {
    ctx.fillStyle = '#0f1216';
    ctx.strokeStyle = COLORS.cyan;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 12;
    for (let i = 0; i < 3; i++) {
      const x = 200 + i * 70;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, sgn * 8 * f(x)); ctx.lineTo(x + 40, sgn * 8 * f(x)); ctx.lineTo(x + 10, sgn * (46 - i * 8) * f(x)); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  }
  if (g.censer) {
    const sw = Math.sin(t * 3) * 0.5;
    const cx = g.L - 40 + Math.sin(sw) * 40, cy = 60 + Math.cos(sw) * 30;
    ctx.strokeStyle = '#d6b35a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.L - 40, g.rh * f(g.L - 40)); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.fillStyle = '#b8902f';
    ctx.beginPath(); ctx.arc(cx, cy + 14, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,200,200,0.25)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + Math.sin(t * 2 + i) * 10, cy + 30 + i * 16, 8 + i * 3, 0, Math.PI * 2); ctx.fill(); }
  }
  // neon strip
  ctx.save();
  ctx.strokeStyle = overload ? COLORS.gold : g.neon;
  ctx.shadowColor = overload ? COLORS.gold : g.neon;
  ctx.shadowBlur = overload ? 22 : 10;
  ctx.lineWidth = overload ? 4 : 2.5;
  ctx.beginPath(); ctx.moveTo(g.r0, 4); ctx.lineTo(g.r1 - 16, 4 * f(g.r1)); ctx.stroke();
  ctx.restore();
  // front hand
  ctx.fillStyle = '#3b4231';
  ctx.beginPath(); ctx.ellipse(Math.min(g.r1 - 20, 230), g.rh * 0.8, 34, 22, 0.3, 0, Math.PI * 2); ctx.fill();
  // muzzle flash
  if (muzzle > 0) {
    ctx.save();
    ctx.translate(g.L + 12, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = overload ? COLORS.gold : '#ffd27a';
    ctx.shadowBlur = 40;
    ctx.fillStyle = overload ? '#fff1a8' : '#fff3c4';
    const k = muzzle * 16;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const aa = (i / 10) * Math.PI * 2;
      const r = (i % 2 ? 10 : 34) * k * (id === 'judgment' || id === 'doodler' || id === 'slapper' ? 1.6 : 1);
      ctx.lineTo(Math.cos(aa) * r * 1.4, Math.sin(aa) * r * 0.8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
