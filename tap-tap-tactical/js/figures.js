// Procedural figures for every combatant. All take feet position (x, y), scale s and an
// options bag; heights are in "figure units" (FIG_H = 260 at s = 1).

import { roundRect, hash, COLORS, text, FONT } from './render.js';

const HALO = { angel: COLORS.cyan, elite: COLORS.gold, ember: COLORS.blueFire, phantom: '#ff3df2', warden: '#ffffff', dancer: COLORS.magenta };

// Hit flashes, salt and fire tint only the figure's own pixels, so tinted figures are
// painted on a scratch layer first and then composited into the room.
let layer = null;
let lg = null;
export function drawFigure(ctx, fn, x, y, s, o = {}) {
  if (!(o.flash > 0 || o.salt > 0 || o.burn > 0)) return fn(ctx, x, y, s, o);
  if (!layer) { layer = document.createElement('canvas'); layer.width = 900; layer.height = 900; lg = layer.getContext('2d'); }
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalAlpha = 1;
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, 900, 900);
  const ox = 450, oy = 840;
  const r = fn(lg, ox, oy, s, o);
  ctx.drawImage(layer, x - ox, y - oy);
  return r ? { x: r.x - ox + x, y: r.y - oy + y } : r;
}

function halo(ctx, x, y, r, color, t, spikes = 0) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (spikes) {
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2 + t * 0.6;
      const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r * 0.28;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.3, cy - r * 0.35); ctx.stroke();
    }
  }
  ctx.restore();
}

// G.O.D. soldier: angel / elite / ember / phantom share the silhouette.
export function drawSoldier(ctx, x, y, s, o = {}) {
  const { rise = 1, variant = 'angel', t = 0, flash = 0, fire = 0, windup = 0, dying = 0, glitch = false, holdGrenade = false, burn = 0, salt = 0 } = o;
  const u = s;
  ctx.save();
  ctx.translate(x, y + (1 - rise) * 175 * u + dying * 60 * u);
  if (dying) { ctx.globalAlpha *= 1 - dying; ctx.rotate(dying * 0.4 * (hash(x) > 0.5 ? 1 : -1)); }
  const armor = variant === 'ember' ? '#2a1a14' : variant === 'elite' ? '#1d1a12' : '#15171b';
  const trim = variant === 'elite' ? COLORS.gold : variant === 'ember' ? '#ff6a00' : '#d9d4c7';
  const visor = fire > 0 ? '#ff2a2a' : variant === 'ember' ? COLORS.blueFire : HALO[variant] || COLORS.cyan;
  const bob = Math.sin(t * 2 + x) * 1.5 * u;
  // wings (tech fins)
  ctx.save();
  ctx.globalAlpha *= 0.85;
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#0b0c0f';
    ctx.beginPath();
    ctx.moveTo(side * 22 * u, -200 * u + bob);
    ctx.lineTo(side * 74 * u, -250 * u + bob);
    ctx.lineTo(side * 64 * u, -170 * u + bob);
    ctx.lineTo(side * 30 * u, -150 * u + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HALO[variant] || COLORS.cyan;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha *= 0.6;
    ctx.stroke();
    ctx.globalAlpha /= 0.6;
  }
  ctx.restore();
  // legs
  ctx.fillStyle = '#0d0e11';
  ctx.fillRect(-26 * u, -112 * u, 20 * u, 112 * u);
  ctx.fillRect(6 * u, -112 * u, 20 * u, 112 * u);
  // torso
  ctx.fillStyle = armor;
  roundRect(ctx, -36 * u, -205 * u + bob, 72 * u, 100 * u, 10 * u);
  ctx.fill();
  // surplice / tabard with cross
  ctx.fillStyle = variant === 'ember' ? '#3a2418' : '#e8e2d2';
  ctx.beginPath();
  ctx.moveTo(-26 * u, -196 * u + bob);
  ctx.lineTo(26 * u, -196 * u + bob);
  ctx.lineTo(22 * u, -78 * u + bob);
  ctx.lineTo(-22 * u, -78 * u + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = variant === 'ember' ? '#3fa9ff' : '#9d0f1b';
  ctx.fillRect(-4 * u, -180 * u + bob, 8 * u, 60 * u);
  ctx.fillRect(-16 * u, -165 * u + bob, 32 * u, 7 * u);
  // pauldrons
  ctx.fillStyle = trim;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 38 * u, -196 * u + bob, 18 * u, 11 * u, side * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // arms & weapon (aimed at the camera)
  ctx.fillStyle = armor;
  ctx.fillRect(-46 * u, -192 * u + bob, 14 * u, 64 * u);
  ctx.fillRect(32 * u, -192 * u + bob, 14 * u, 64 * u);
  if (holdGrenade || windup > 0) {
    // throwing arm raised with a blue grenade
    ctx.save();
    ctx.translate(40 * u, -196 * u + bob);
    ctx.rotate(-2.4 + windup * 0.6);
    ctx.fillStyle = armor;
    ctx.fillRect(-7 * u, 0, 14 * u, 60 * u);
    ctx.shadowColor = COLORS.blueFire;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath(); ctx.arc(0, 66 * u, 11 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = '#08090b';
    roundRect(ctx, -30 * u, -150 * u + bob, 60 * u, 24 * u, 5 * u);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0, -138 * u + bob, 11 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, -138 * u + bob, 6 * u, 0, Math.PI * 2); ctx.fill();
    if (fire > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#ffd24a';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = (i % 2 ? 10 : 26) * u * (0.8 + fire * 0.6);
        ctx.lineTo(Math.cos(a) * r, -138 * u + bob + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // helmet
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.ellipse(0, -228 * u + bob, 22 * u, 26 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(-2 * u, -254 * u + bob, 4 * u, 18 * u);
  ctx.save();
  ctx.shadowColor = visor;
  ctx.shadowBlur = 12;
  ctx.fillStyle = visor;
  ctx.fillRect(-16 * u, -232 * u + bob, 32 * u, 5 * u);
  ctx.restore();
  halo(ctx, 0, -268 * u + bob, 24 * u, HALO[variant] || COLORS.cyan, t, variant === 'elite' ? 8 : 0);
  if (salt > 0) tintOver(ctx, u, 'rgba(240,240,235,' + salt + ')');
  if (burn > 0) flames(ctx, u, t, burn);
  if (flash > 0) tintOver(ctx, u, `rgba(255,255,255,${flash * 0.8})`);
  ctx.restore();
  if (glitch) glitchSlices(ctx, x, y, s, t);
}

function tintOver(ctx, u, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.fillRect(-90 * u, -300 * u, 180 * u, 300 * u);
  ctx.restore();
}

function flames(ctx, u, t, amount) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const fx = (-40 + i * 13) * u;
    const fh = (40 + 40 * hash(i + Math.floor(t * 14))) * u * amount;
    const g = ctx.createLinearGradient(0, -110 * u, 0, -110 * u - fh);
    g.addColorStop(0, 'rgba(255,120,0,0.8)');
    g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(fx - 9 * u, -100 * u);
    ctx.quadraticCurveTo(fx, -110 * u - fh, fx + 9 * u, -100 * u);
    ctx.fill();
  }
  ctx.restore();
}

function glitchSlices(ctx, x, y, s, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const yy = y - (60 + hash(i + Math.floor(t * 20)) * 200) * s;
    ctx.fillStyle = i % 2 ? 'rgba(255,0,80,0.35)' : 'rgba(0,255,255,0.35)';
    ctx.fillRect(x - 60 * s + (hash(i * 3 + Math.floor(t * 30)) - 0.5) * 40 * s, yy, 120 * s, 4 + hash(i) * 8 * s);
  }
  ctx.restore();
}

// Prisoner of F.A.I.T.H.: ragged, bound, "swimming" through the dark.
export function drawPrisoner(ctx, x, y, s, o = {}) {
  const { t = 0, moving = true, flash = 0, dying = 0, facing = 1 } = o;
  const u = s;
  const step = moving ? Math.sin(t * 7) : 0;
  ctx.save();
  ctx.translate(x, y + dying * 40 * u);
  if (dying) { ctx.globalAlpha *= 1 - dying; ctx.rotate(dying * 1.2 * facing); }
  ctx.scale(facing, 1);
  // legs
  ctx.strokeStyle = '#3a3a3c';
  ctx.lineWidth = 12 * u;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8 * u, -100 * u); ctx.lineTo(-8 * u + step * 16 * u, -4 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8 * u, -100 * u); ctx.lineTo(8 * u - step * 16 * u, -4 * u); ctx.stroke();
  // coat
  ctx.fillStyle = '#4a3f33';
  ctx.beginPath();
  ctx.moveTo(-26 * u, -190 * u);
  ctx.lineTo(26 * u, -190 * u);
  ctx.lineTo(34 * u, -86 * u);
  for (let i = 0; i < 6; i++) ctx.lineTo(34 * u - i * 13 * u, (-86 + (i % 2 ? 12 : 0)) * u);
  ctx.lineTo(-34 * u, -86 * u);
  ctx.closePath();
  ctx.fill();
  // spray-painted circle-A
  ctx.strokeStyle = '#b3141e';
  ctx.lineWidth = 3 * u;
  ctx.beginPath(); ctx.arc(0, -140 * u, 13 * u, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9 * u, -128 * u); ctx.lineTo(0, -154 * u); ctx.lineTo(9 * u, -128 * u); ctx.moveTo(-6 * u, -136 * u); ctx.lineTo(6 * u, -136 * u); ctx.stroke();
  // arms reaching forward, bound at the wrist
  const sway = Math.sin(t * 3) * 8 * u;
  ctx.strokeStyle = '#8d8a84';
  ctx.lineWidth = 9 * u;
  ctx.beginPath(); ctx.moveTo(-20 * u, -180 * u); ctx.quadraticCurveTo(-30 * u, -150 * u, -6 * u + sway, -130 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20 * u, -180 * u); ctx.quadraticCurveTo(30 * u, -150 * u, 6 * u + sway, -130 * u); ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#ffb020';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffb020';
  ctx.fillRect(-9 * u + sway, -134 * u, 18 * u, 5 * u);
  ctx.restore();
  // hooded head
  ctx.fillStyle = '#2d2620';
  ctx.beginPath(); ctx.ellipse(0, -212 * u, 22 * u, 27 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b9b2a5';
  ctx.beginPath(); ctx.ellipse(3 * u, -208 * u, 13 * u, 17 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-2 * u, -212 * u, 3 * u, 0, Math.PI * 2); ctx.arc(8 * u, -212 * u, 3 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b0a0a';
  ctx.fillRect(0, -200 * u, 7 * u, 3 * u);
  if (flash) tintOver(ctx, u, `rgba(255,255,255,${flash})`);
  ctx.restore();
}

// Bejeweled Berserker. `weak` = 'visor' | 'core' | 'heel'. Returns weak point world position.
export function drawBerserker(ctx, x, y, s, o = {}) {
  const { t = 0, weak = 'core', strike = 0, flash = 0, dying = 0, salt = 0, burn = 0 } = o;
  const u = s * 1.15;
  ctx.save();
  ctx.translate(x, y + dying * 50 * u);
  if (dying) ctx.globalAlpha *= 1 - dying;
  const bob = Math.abs(Math.sin(t * 3.2)) * 4 * u;
  // body (flesh between crystals)
  ctx.fillStyle = '#5b3b4e';
  roundRect(ctx, -46 * u, -210 * u - bob, 92 * u, 130 * u, 20 * u);
  ctx.fill();
  ctx.fillStyle = '#4a2f40';
  ctx.fillRect(-36 * u, -90 * u - bob, 26 * u, 90 * u + bob);
  ctx.fillRect(10 * u, -90 * u - bob, 26 * u, 90 * u + bob);
  // arms, raised for the strike
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 48 * u, -196 * u - bob);
    ctx.rotate(side * (0.2 + strike * 2.4) * (strike > 0 ? -1 : 1));
    ctx.fillStyle = '#5b3b4e';
    ctx.fillRect(-12 * u, 0, 24 * u, 90 * u);
    crystal(ctx, 0, 96 * u, 24 * u, t, 3);
    ctx.restore();
  }
  // crystal armor (90% coverage)
  const shards = [[-30, -190, 26], [0, -198, 30], [30, -186, 24], [-34, -150, 22], [34, -146, 26], [-20, -118, 22], [20, -112, 24], [-26, -60, 20], [24, -50, 22], [0, -236, 30], [-18, -250, 18], [20, -248, 20]];
  shards.forEach(([sx, sy, r], i) => crystal(ctx, sx * u, sy * u - bob, r * u, t, i));
  // weak point
  const wp = weakPointOffset(weak, u, bob);
  const pulse = 0.6 + 0.4 * Math.sin(t * 8);
  ctx.save();
  ctx.shadowColor = '#ff4d8d';
  ctx.shadowBlur = 20;
  ctx.fillStyle = `rgba(255,${120 + pulse * 100},${170 + pulse * 60},1)`;
  ctx.beginPath(); ctx.arc(wp.x, wp.y, 8 * u * (0.85 + pulse * 0.2), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(wp.x, wp.y, 13 * u, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (salt > 0) tintOver(ctx, u, `rgba(240,240,235,${salt})`);
  if (burn > 0) flames(ctx, u, t, burn);
  if (flash) tintOver(ctx, u, `rgba(255,255,255,${flash})`);
  ctx.restore();
  return { x: x + wp.x, y: y + wp.y };
}
export function weakPointOffset(weak, u, bob = 0) {
  if (weak === 'visor') return { x: 6 * u, y: -236 * u - bob };
  if (weak === 'heel') return { x: -26 * u, y: -10 * u };
  return { x: 0, y: -160 * u - bob };
}

function crystal(ctx, x, y, r, t, i) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(i * 1.3);
  const hue = [285, 200, 320, 260][i % 4];
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, `hsl(${hue},90%,82%)`);
  g.addColorStop(0.5, `hsl(${hue},70%,52%)`);
  g.addColorStop(1, `hsl(${hue},80%,28%)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, -r * 0.2);
  ctx.lineTo(r * 0.45, r * 0.8);
  ctx.lineTo(-r * 0.5, r * 0.7);
  ctx.lineTo(-r * 0.75, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const glint = (Math.sin(t * 2 + i * 1.7) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,255,${glint * 0.6})`;
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.2, -r * 0.2); ctx.lineTo(-r * 0.2, -r * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Failed Subject: crawls on all fours, climbs over cover.
export function drawCrawler(ctx, x, y, s, o = {}) {
  const { t = 0, lunge = 0, flash = 0, dying = 0, num = 86, burn = 0, salt = 0 } = o;
  const u = s;
  ctx.save();
  ctx.translate(x, y - lunge * 80 * u);
  if (dying) { ctx.globalAlpha *= 1 - dying; ctx.translate(0, dying * 30 * u); }
  const j = (k) => Math.sin(t * 11 + k) * 10 * u + (hash(Math.floor(t * 9) + k) - 0.5) * 6 * u;
  ctx.strokeStyle = '#c9c1b5';
  ctx.lineCap = 'round';
  ctx.lineWidth = 9 * u;
  // limbs
  const limbs = [[-40, -40, -95, -5], [40, -40, 95, -5], [-30, -30, -70, 0], [30, -30, 70, 0]];
  limbs.forEach(([ax, ay, bx, by], k) => {
    ctx.beginPath();
    ctx.moveTo(ax * u, ay * u);
    ctx.quadraticCurveTo((ax + bx) * 0.5 * u, (ay - 55) * u + j(k), bx * u + j(k + 4), by * u);
    ctx.stroke();
  });
  // torso
  ctx.fillStyle = '#d8d0c3';
  ctx.beginPath(); ctx.ellipse(0, -48 * u, 48 * u, 26 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b2d2d';
  ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-30 * u + k * 15 * u, -62 * u); ctx.lineTo(-26 * u + k * 15 * u, -36 * u); ctx.stroke(); }
  text(ctx, String(num), 20 * u, -40 * u, { size: Math.max(8, 18 * u), font: FONT.title, color: '#222', align: 'center' });
  // head: tilted, too many teeth
  ctx.fillStyle = '#e4ddd2';
  ctx.beginPath(); ctx.ellipse(0, -84 * u, 22 * u, 20 * u, Math.sin(t * 5) * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(-8 * u, -88 * u, 5 * u, 7 * u, 0, 0, Math.PI * 2); ctx.ellipse(8 * u, -88 * u, 5 * u, 7 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#300';
  ctx.beginPath(); ctx.ellipse(0, -72 * u, 12 * u, 5 * u + lunge * 6 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eee';
  for (let k = -3; k <= 3; k++) ctx.fillRect(k * 3.2 * u - 1, -75 * u, 2, 4 * u);
  if (salt > 0) tintOver(ctx, u, `rgba(240,240,235,${salt})`);
  if (burn > 0) flames(ctx, u * 0.6, t, burn);
  if (flash) tintOver(ctx, u, `rgba(255,255,255,${flash})`);
  ctx.restore();
}

// Archangel Unit-01 "The Warden". phase 1..3.
export function drawWarden(ctx, x, y, s, o = {}) {
  const { t = 0, phase = 1, flash = 0, slam = 0, dying = 0, fire = 0 } = o;
  const u = s;
  ctx.save();
  ctx.translate(x, y + dying * 80 * u);
  if (dying) ctx.globalAlpha *= 1 - dying * 0.9;
  const bob = Math.sin(t * 1.4) * 3 * u;
  // wings: huge, ragged
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.moveTo(side * 40 * u, -230 * u + bob);
    for (let i = 0; i <= 6; i++) ctx.lineTo(side * (60 + i * 26) * u, (-300 + i * 30 + (i % 2) * 24) * u + bob);
    ctx.lineTo(side * 50 * u, -120 * u + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = phase === 3 ? COLORS.violet : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // legs
  ctx.fillStyle = '#0c0d10';
  ctx.fillRect(-40 * u, -118 * u, 30 * u, 118 * u);
  ctx.fillRect(10 * u, -118 * u, 30 * u, 118 * u);
  // body
  ctx.fillStyle = '#121317';
  roundRect(ctx, -54 * u, -232 * u + bob, 108 * u, 130 * u, 14 * u);
  ctx.fill();
  // white armored surplice
  ctx.fillStyle = '#efe9da';
  ctx.beginPath();
  ctx.moveTo(-44 * u, -226 * u + bob); ctx.lineTo(44 * u, -226 * u + bob); ctx.lineTo(38 * u, -70 * u + bob); ctx.lineTo(-38 * u, -70 * u + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9d0f1b';
  ctx.fillRect(-6 * u, -210 * u + bob, 12 * u, 110 * u);
  ctx.fillRect(-26 * u, -186 * u + bob, 52 * u, 10 * u);
  if (phase === 3) {
    // cracked armor + violet core
    ctx.save();
    ctx.strokeStyle = COLORS.violet;
    ctx.shadowColor = COLORS.violet;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, -165 * u + bob);
      ctx.lineTo(Math.cos(a) * 25 * u, -165 * u + bob + Math.sin(a) * 25 * u);
      ctx.lineTo(Math.cos(a + 0.3) * 50 * u, -165 * u + bob + Math.sin(a + 0.3) * 45 * u);
      ctx.stroke();
    }
    const p = 0.7 + 0.3 * Math.sin(t * 9);
    ctx.fillStyle = '#e8c8ff';
    ctx.beginPath(); ctx.arc(0, -165 * u + bob, 13 * u * p, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // head
  ctx.fillStyle = '#121317';
  ctx.beginPath(); ctx.ellipse(0, -262 * u + bob, 28 * u, 32 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.shadowColor = phase === 3 ? COLORS.violet : '#fff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = phase === 3 ? COLORS.violet : '#fff';
  ctx.fillRect(-20 * u, -266 * u + bob, 40 * u, 6 * u);
  ctx.restore();
  halo(ctx, 0, -310 * u + bob, 40 * u, phase === 3 ? COLORS.violet : '#ffffff', t, 12);
  // right arm: quad-barreled Judgment Cannon
  const cannon = cannonPos(u, bob);
  ctx.fillStyle = '#16181c';
  roundRect(ctx, 40 * u, -220 * u + bob, 34 * u, 90 * u, 8 * u);
  ctx.fill();
  ctx.fillStyle = '#e8e2d2';
  roundRect(ctx, cannon.x - 32 * u, cannon.y - 32 * u, 64 * u, 64 * u, 10 * u);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const bx = cannon.x + (i % 2 ? 14 : -14) * u, by = cannon.y + (i < 2 ? -14 : 14) * u;
    ctx.fillStyle = '#050505';
    ctx.beginPath(); ctx.arc(bx, by, 10 * u, 0, Math.PI * 2); ctx.fill();
    if (fire > 0) {
      ctx.save();
      ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 20; ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.arc(bx, by, 10 * u * (1 + fire), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // left arm: tactical cross-shield (gone in phase 3)
  if (phase < 3) {
    ctx.save();
    ctx.translate(-78 * u, -160 * u + bob + slam * 60 * u);
    ctx.fillStyle = '#d9d3c4';
    roundRect(ctx, -34 * u, -90 * u, 68 * u, 190 * u, 10 * u);
    ctx.fill();
    ctx.fillStyle = '#16181c';
    roundRect(ctx, -28 * u, -84 * u, 56 * u, 178 * u, 8 * u);
    ctx.fill();
    ctx.shadowColor = phase === 2 ? COLORS.cyan : '#ffffff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = phase === 2 ? COLORS.cyan : '#ffffff';
    ctx.fillRect(-5 * u, -70 * u, 10 * u, 150 * u);
    ctx.fillRect(-24 * u, -40 * u, 48 * u, 10 * u);
    ctx.restore();
  }
  if (flash) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
    ctx.fillRect(-200 * u, -360 * u, 400 * u, 360 * u);
    ctx.restore();
  }
  ctx.restore();
}
export const cannonPos = (u, bob = 0) => ({ x: 60 * u, y: -120 * u + bob });

// Experiment A-4RON: Aaron from the rebel camp, after G.O.D. was done with him.
export function drawAaron(ctx, x, y, s, o = {}) {
  const { t = 0, swing = 0, flash = 0, dying = 0, vomit = 0 } = o;
  const u = s;
  ctx.save();
  ctx.translate(x, y + dying * 60 * u);
  if (dying) { ctx.globalAlpha *= 1 - dying; ctx.rotate(dying * 0.5); }
  const sway = Math.sin(t * 1.8) * 6 * u;
  // legs
  ctx.fillStyle = '#3e4a3a';
  ctx.fillRect(-44 * u, -110 * u, 34 * u, 110 * u);
  ctx.fillRect(12 * u, -110 * u, 34 * u, 110 * u);
  // bloated body
  ctx.fillStyle = '#7d8a6c';
  ctx.beginPath(); ctx.ellipse(sway, -170 * u, 72 * u, 82 * u, 0, 0, Math.PI * 2); ctx.fill();
  // torn F.A.I.T.H. jacket
  ctx.fillStyle = '#3b3027';
  ctx.beginPath();
  ctx.moveTo(-70 * u + sway, -230 * u); ctx.lineTo(-30 * u + sway, -240 * u); ctx.lineTo(-40 * u + sway, -110 * u); ctx.lineTo(-74 * u + sway, -140 * u);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(70 * u + sway, -230 * u); ctx.lineTo(30 * u + sway, -240 * u); ctx.lineTo(40 * u + sway, -110 * u); ctx.lineTo(74 * u + sway, -140 * u);
  ctx.closePath(); ctx.fill();
  // stitches
  ctx.strokeStyle = '#2a1414';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sway, -236 * u); ctx.lineTo(sway, -110 * u); ctx.stroke();
  for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(sway - 7 * u, -228 * u + k * 13 * u); ctx.lineTo(sway + 7 * u, -224 * u + k * 13 * u); ctx.stroke(); }
  // the old wound (weak point)
  const w = aaronWeak(u);
  const p = 0.6 + 0.4 * Math.sin(t * 7);
  ctx.save();
  ctx.shadowColor = '#c8ff3a';
  ctx.shadowBlur = 18;
  ctx.fillStyle = `rgba(200,255,58,${0.7 + p * 0.3})`;
  ctx.beginPath(); ctx.arc(w.x, w.y, 12 * u, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3 * u;
  ctx.beginPath(); ctx.moveTo(w.x - 10 * u, w.y - 10 * u); ctx.lineTo(w.x + 10 * u, w.y + 10 * u); ctx.moveTo(w.x + 10 * u, w.y - 10 * u); ctx.lineTo(w.x - 10 * u, w.y + 10 * u); ctx.stroke();
  ctx.restore();
  // hook arm
  ctx.save();
  ctx.translate(70 * u + sway, -220 * u);
  ctx.rotate(-0.3 - swing * 2.2);
  ctx.fillStyle = '#6d7a5e';
  ctx.fillRect(-12 * u, 0, 24 * u, 100 * u);
  ctx.strokeStyle = '#b8bcc2';
  ctx.lineWidth = 8 * u;
  ctx.beginPath(); ctx.arc(0, 120 * u, 20 * u, -Math.PI / 2, Math.PI * 0.9); ctx.stroke();
  ctx.restore();
  // other arm
  ctx.fillStyle = '#6d7a5e';
  ctx.save();
  ctx.translate(-70 * u + sway, -220 * u);
  ctx.rotate(0.3 + Math.sin(t * 2) * 0.1);
  ctx.fillRect(-12 * u, 0, 24 * u, 105 * u);
  ctx.restore();
  // head with cyber jaw
  ctx.fillStyle = '#8f9a7c';
  ctx.beginPath(); ctx.ellipse(sway * 1.3, -270 * u, 30 * u, 32 * u, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9aa0a8';
  roundRect(ctx, sway * 1.3 - 24 * u, -262 * u, 48 * u, 22 * u + vomit * 12 * u, 5 * u);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(sway * 1.3 - 18 * u, -252 * u, 36 * u, 4 * u + vomit * 12 * u);
  ctx.save();
  ctx.shadowColor = '#c8ff3a';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#c8ff3a';
  ctx.beginPath(); ctx.arc(sway * 1.3 - 11 * u, -278 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#300';
  ctx.beginPath(); ctx.arc(sway * 1.3 + 11 * u, -278 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (flash) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
    ctx.fillRect(-160 * u, -330 * u, 320 * u, 330 * u);
    ctx.restore();
  }
  ctx.restore();
}
export const aaronWeak = (u) => ({ x: 0, y: -104 * u });

// Articulated dancer for the Dance Soldier duel. pose = { la, ra, ll, rl, lean, spin, jump }.
export function drawDancer(ctx, x, y, s, pose, { soldier = true, t = 0, flash = 0 } = {}) {
  const u = s;
  ctx.save();
  ctx.translate(x, y - (pose.jump || 0) * u);
  ctx.rotate(pose.spin || 0);
  ctx.rotate(pose.lean || 0);
  const armor = soldier ? '#15171b' : '#3a3a2e';
  const limb = (ax, ay, a1, a2, l1, l2, w) => {
    const ex = ax + Math.sin(a1) * l1, ey = ay + Math.cos(a1) * l1;
    const hx = ex + Math.sin(a1 + a2) * l2, hy = ey + Math.cos(a1 + a2) * l2;
    ctx.strokeStyle = armor;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    return { hx, hy };
  };
  limb(-12 * u, -110 * u, pose.ll ?? 0.15, pose.llk ?? -0.1, 60 * u, 58 * u, 18 * u);
  limb(12 * u, -110 * u, pose.rl ?? -0.15, pose.rlk ?? 0.1, 60 * u, 58 * u, 18 * u);
  ctx.fillStyle = armor;
  roundRect(ctx, -34 * u, -210 * u, 68 * u, 108 * u, 12 * u);
  ctx.fill();
  if (soldier) {
    ctx.fillStyle = '#e8e2d2';
    ctx.fillRect(-22 * u, -202 * u, 44 * u, 94 * u);
    ctx.fillStyle = '#9d0f1b';
    ctx.fillRect(-4 * u, -190 * u, 8 * u, 56 * u);
    ctx.fillRect(-15 * u, -176 * u, 30 * u, 7 * u);
  } else {
    ctx.fillStyle = '#4b4a3a';
    ctx.fillRect(-30 * u, -206 * u, 60 * u, 30 * u);
    text(ctx, '87', 0, -140 * u, { size: 22 * u, font: FONT.title, color: 'rgba(230,220,190,0.6)', align: 'center' });
  }
  const la = limb(-36 * u, -198 * u, pose.la ?? 0.3, pose.lae ?? 0.3, 52 * u, 50 * u, 15 * u);
  limb(36 * u, -198 * u, pose.ra ?? -0.3, pose.rae ?? -0.3, 52 * u, 50 * u, 15 * u);
  if (!soldier) {
    // Subject 87 keeps holding his gun, looking confused
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(la.hx - 6 * u, la.hy - 6 * u, 40 * u, 12 * u);
  }
  if (soldier) {
    ctx.fillStyle = armor;
    ctx.beginPath(); ctx.ellipse(0, -234 * u, 22 * u, 26 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.shadowColor = COLORS.magenta; ctx.shadowBlur = 12; ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(-16 * u, -238 * u, 32 * u, 5 * u);
    ctx.restore();
    halo(ctx, 0, -272 * u, 24 * u, COLORS.magenta, t);
  } else {
    ctx.fillStyle = '#3d3a2f';
    ctx.beginPath(); ctx.ellipse(0, -232 * u, 24 * u, 28 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a987';
    ctx.beginPath(); ctx.ellipse(4 * u, -228 * u, 14 * u, 18 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-2 * u, -234 * u, 4 * u, 3 * u);
    ctx.fillRect(8 * u, -234 * u, 4 * u, 3 * u);
    ctx.fillRect(0, -218 * u, 10 * u, 2 * u);
  }
  if (flash) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.fillRect(-120 * u, -320 * u, 240 * u, 320 * u);
    ctx.restore();
  }
  ctx.restore();
}
