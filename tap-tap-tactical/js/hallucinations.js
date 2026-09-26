// The Dynamic Psychosis System's visuals: the Dancing Rat, the JPEG Horse, Uncanny Valley
// Eyes, Film Grain, the Static of Guilt and the spider-webbing Terminal Overload fracture.

import { W, H } from './data.js';
import { makeCanvas, noiseFrame, hash, text, FONT, clamp } from './render.js';

// ---------------------------------------------------------------------------
// The Dancing Rat (N64-era, flat-shaded, replaces the crosshair)
// ---------------------------------------------------------------------------
export function drawRat(ctx, x, y, t) {
  const beat = t * 4.2;
  ctx.save();
  ctx.translate(x, y + Math.abs(Math.sin(beat)) * -10);
  ctx.rotate(Math.sin(beat) * 0.28);
  const tri = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); };
  // tail
  ctx.strokeStyle = '#d98c9a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-4, 18); ctx.quadraticCurveTo(-30, 30 + Math.sin(beat * 2) * 10, -38, 6); ctx.stroke();
  // legs (kicking)
  const k = Math.sin(beat * 2) * 8;
  tri([-10, 18, -4, 18, -10 + k, 34], '#6d6d78');
  tri([4, 18, 10, 18, 10 - k, 34], '#5d5d68');
  // body facets
  tri([-16, -6, 0, -14, 0, 20], '#8a8a96');
  tri([0, -14, 16, -6, 0, 20], '#74747f');
  tri([-16, -6, 0, 20, -12, 18], '#63636d');
  tri([16, -6, 12, 18, 0, 20], '#56565f');
  tri([-6, 0, 6, 0, 0, 14], '#c9c9d2');
  // arms up (dancing)
  const a = Math.sin(beat * 2 + 1) * 10;
  tri([-14, -4, -10, -2, -26, -20 + a], '#7d7d88');
  tri([14, -4, 10, -2, 26, -20 - a], '#7d7d88');
  // head
  tri([-12, -14, 12, -14, 0, -34], '#8f8f9b');
  tri([-12, -14, 0, -34, -4, -10], '#7a7a86');
  tri([0, -24, 3, -38, -3, -38], '#e58a9a');
  // ears
  tri([-12, -26, -24, -40, -4, -32], '#e58a9a');
  tri([12, -26, 24, -40, 4, -32], '#d97888');
  // eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(-6, -24, 3, 3);
  ctx.fillRect(3, -24, 3, 3);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The JPEG Horse: a stock photo that gallops across the screen, badly compressed.
// ---------------------------------------------------------------------------
let horseFrames = null;
function paintHorse(frame) {
  const w = 480, h = 320;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#6fa8e8'); sky.addColorStop(0.55, '#cfe3f5'); sky.addColorStop(0.56, '#6b9c3a'); sky.addColorStop(1, '#3d6420');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath(); g.ellipse(90, 50, 50, 16, 0, 0, Math.PI * 2); g.ellipse(330, 70, 70, 18, 0, 0, Math.PI * 2); g.fill();
  g.translate(250, 190);
  const legPhase = (frame / 4) * Math.PI * 2;
  const coat = g.createLinearGradient(0, -80, 0, 60);
  coat.addColorStop(0, '#9a5f2c'); coat.addColorStop(1, '#3b1f0c');
  const leg = (hx, hy, a1, a2) => {
    g.strokeStyle = '#4a2810';
    g.lineWidth = 14;
    g.lineCap = 'round';
    const kx = hx + Math.sin(a1) * 44, ky = hy + Math.cos(a1) * 44;
    const fx = kx + Math.sin(a1 + a2) * 44, fy = ky + Math.cos(a1 + a2) * 44;
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.stroke();
    g.strokeStyle = '#1e1208';
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    g.fillStyle = '#111';
    g.fillRect(fx - 7, fy - 2, 14, 7);
  };
  leg(-70, 20, 0.6 * Math.sin(legPhase), 0.5 + 0.4 * Math.sin(legPhase + 1));
  leg(70, 20, -0.7 * Math.sin(legPhase + 2), -0.6 + 0.4 * Math.sin(legPhase + 3));
  // tail
  g.fillStyle = '#1b0f06';
  g.beginPath(); g.moveTo(-110, -20); g.quadraticCurveTo(-170, 0 + Math.sin(legPhase) * 20, -150, 60); g.quadraticCurveTo(-130, 10, -105, -5); g.fill();
  // body
  g.fillStyle = coat;
  g.beginPath(); g.ellipse(0, 0, 118, 46, 0, 0, Math.PI * 2); g.fill();
  // neck + head
  g.beginPath();
  g.moveTo(80, -30); g.lineTo(140, -120); g.lineTo(170, -118); g.lineTo(215, -76); g.lineTo(200, -62); g.lineTo(160, -80); g.lineTo(118, 10);
  g.closePath();
  g.fill();
  g.fillStyle = '#f2ece2';
  g.beginPath(); g.moveTo(178, -104); g.lineTo(206, -76); g.lineTo(200, -70); g.lineTo(174, -96); g.closePath(); g.fill();
  g.fillStyle = '#1b0f06';
  g.beginPath(); g.moveTo(84, -34); g.lineTo(142, -124); g.lineTo(150, -116); g.lineTo(98, -26); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(150, -122); g.lineTo(156, -140); g.lineTo(162, -120); g.fill();
  g.fillStyle = '#000';
  g.beginPath(); g.arc(168, -100, 3.5, 0, Math.PI * 2); g.fill();
  leg(-60, 24, -0.5 * Math.sin(legPhase + 0.5), 0.6 + 0.3 * Math.sin(legPhase));
  leg(80, 24, 0.7 * Math.sin(legPhase + 2.4), -0.4 + 0.3 * Math.sin(legPhase + 2));
  g.setTransform(1, 0, 0, 1, 0, 0);
  // watermark
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.35);
  g.globalAlpha = 0.28;
  text(g, 'STOCK • STOCK • STOCK', 0, 0, { size: 42, font: FONT.title, color: '#fff', align: 'center' });
  g.restore();
  // JPEG it: 8x8 blocks, posterised flats, smeared edges, chroma bleed
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let by = 0; by < h; by += 8) {
    for (let bx = 0; bx < w; bx += 8) {
      let r = 0, gg = 0, b = 0, n = 0, vr = 0;
      for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const i = (y * w + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      r /= n; gg /= n; b /= n;
      for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const i = (y * w + x) * 4; vr += Math.abs(d[i] - r) + Math.abs(d[i + 1] - gg); }
      const busy = vr / n > 40;
      for (let y = by; y < by + 8; y++) {
        for (let x = bx; x < bx + 8; x++) {
          const i = (y * w + x) * 4;
          const ring = busy ? ((x + y) % 3 === 0 ? 18 : -10) : 0;
          const k = busy ? 0.45 : 0.8;
          d[i] = Math.round((d[i] * (1 - k) + r * k + ring) / 20) * 20;
          d[i + 1] = Math.round((d[i + 1] * (1 - k) + gg * k + ring) / 20) * 20;
          d[i + 2] = Math.round((d[i + 2] * (1 - k) + b * k + ring * 1.4) / 24) * 24;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function drawHorse(ctx, horse, t) {
  if (!horseFrames) horseFrames = [0, 1, 2, 3].map(paintHorse);
  const frame = horseFrames[Math.floor(t * 12) % 4];
  const w = 620, h = 413;
  const x = horse.x - w / 2;
  const y = H / 2 - h / 2 - 40 + Math.abs(Math.sin(t * 12)) * -14;
  ctx.save();
  ctx.fillStyle = '#c9ccd2';
  ctx.fillRect(x - 3, y - 26, w + 6, h + 29);
  ctx.fillStyle = '#1b3a8f';
  ctx.fillRect(x - 3, y - 26, w + 6, 22);
  text(ctx, 'horse.jpg — Image Viewer', x + 8, y - 9, { size: 16, font: FONT.tech, color: '#fff' });
  text(ctx, '✕', x + w - 12, y - 9, { size: 16, font: FONT.tech, color: '#fff', align: 'center' });
  ctx.imageSmoothingEnabled = true;
  if (horse.dir < 0) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(frame, 0, 0, w, h); } else ctx.drawImage(frame, x, y, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Uncanny Valley Eyes: hyper-real, unblinking, and they follow the crosshair.
// ---------------------------------------------------------------------------
export function drawEye(ctx, e, t, lookX, lookY) {
  const life = t - e.t0;
  const a = clamp(Math.min(life / 1.2, (e.dur - life) / 1.2), 0, 1) * 0.92;
  if (a <= 0) return;
  const s = e.size;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(e.x, e.y);
  // skin & socket shadow
  const skin = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.5);
  skin.addColorStop(0, '#3a2016');
  skin.addColorStop(0.6, 'rgba(120,80,60,0.9)');
  skin.addColorStop(1, 'rgba(120,80,60,0)');
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.5, s * 1.0, 0, 0, Math.PI * 2); ctx.fill();
  // almond
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(0, -s * 0.72, s, 0);
  ctx.quadraticCurveTo(0, s * 0.62, -s, 0);
  ctx.closePath();
  ctx.clip();
  const sc = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s);
  sc.addColorStop(0, '#fbf6ef'); sc.addColorStop(0.8, '#e6d6c8'); sc.addColorStop(1, '#b89484');
  ctx.fillStyle = sc;
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeStyle = 'rgba(190,40,40,0.35)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 7; i++) {
    const ang = hash(e.seed + i) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * s, Math.sin(ang) * s * 0.5);
    ctx.quadraticCurveTo(Math.cos(ang + 0.3) * s * 0.6, Math.sin(ang + 0.4) * s * 0.3, Math.cos(ang) * s * 0.4, Math.sin(ang) * s * 0.2);
    ctx.stroke();
  }
  const dx = clamp((lookX - e.x) / 400, -1, 1) * s * 0.28;
  const dy = clamp((lookY - e.y) / 400, -1, 1) * s * 0.12;
  const ir = s * 0.42;
  const iris = ctx.createRadialGradient(dx, dy, ir * 0.2, dx, dy, ir);
  iris.addColorStop(0, e.hue === 0 ? '#6f8f3a' : '#4a7fb0');
  iris.addColorStop(0.7, e.hue === 0 ? '#5a4520' : '#2b4c6e');
  iris.addColorStop(1, '#1a1410');
  ctx.fillStyle = iris;
  ctx.beginPath(); ctx.arc(dx, dy, ir, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(dx + Math.cos(ang) * ir * 0.35, dy + Math.sin(ang) * ir * 0.35); ctx.lineTo(dx + Math.cos(ang) * ir * 0.95, dy + Math.sin(ang) * ir * 0.95); ctx.stroke();
  }
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.arc(dx, dy, ir * (0.38 + 0.05 * Math.sin(t * 0.7)), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(dx - ir * 0.3, dy - ir * 0.35, ir * 0.16, ir * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
  // upper lid shadow
  const lid = ctx.createLinearGradient(0, -s * 0.6, 0, -s * 0.1);
  lid.addColorStop(0, 'rgba(60,30,20,0.7)');
  lid.addColorStop(1, 'rgba(60,30,20,0)');
  ctx.fillStyle = lid;
  ctx.fillRect(-s, -s, s * 2, s * 0.9);
  ctx.restore();
  // lashes
  ctx.strokeStyle = 'rgba(20,10,5,0.8)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    const tt = i / 13;
    const px = -s + tt * s * 2;
    const py = -Math.sin(tt * Math.PI) * s * 0.36;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (tt - 0.5) * 8, py - 8); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Film grain / Static of Guilt
// ---------------------------------------------------------------------------
export function drawGrain(ctx, t, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noiseFrame(Math.floor(t * 24)), 0, 0, W, H);
  ctx.restore();
}

export function drawGuilt(ctx, t, amount) {
  if (amount <= 0) return;
  drawGrain(ctx, t, 0.55 * amount);
  ctx.save();
  ctx.globalAlpha = amount * 0.8;
  for (let i = 0; i < 6; i++) {
    const y = hash(i + Math.floor(t * 12)) * H;
    ctx.fillStyle = i % 2 ? 'rgba(255,0,60,0.25)' : 'rgba(0,255,220,0.2)';
    ctx.fillRect(0, y, W, 6 + hash(i * 7) * 18);
  }
  text(ctx, "la'anah", W / 2 + Math.sin(t * 30) * 6, H / 2, { size: 64, font: FONT.serif, color: 'rgba(255,255,255,0.25)', align: 'center' });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Terminal Overload: glass cracks spider-webbing inward, then shattering outward.
// ---------------------------------------------------------------------------
export function makeCracks(rng) {
  const cracks = [];
  for (let i = 0; i < 14; i++) {
    const edge = Math.floor(rng() * 4);
    let x = edge === 0 ? rng() * W : edge === 1 ? W : edge === 2 ? rng() * W : 0;
    let y = edge === 0 ? 0 : edge === 1 ? rng() * H : edge === 2 ? H : rng() * H;
    const pts = [[x, y]];
    const ang = Math.atan2(H / 2 - y, W / 2 - x);
    for (let k = 0; k < 9; k++) {
      const a = ang + (rng() - 0.5) * 0.9;
      x += Math.cos(a) * (40 + rng() * 50);
      y += Math.sin(a) * (40 + rng() * 50);
      pts.push([x, y]);
    }
    cracks.push({ pts, delay: rng() * 0.3 });
  }
  return cracks;
}

export function drawCracks(ctx, cracks, p) {
  ctx.save();
  ctx.strokeStyle = 'rgba(230,255,240,0.85)';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.6;
  for (const c of cracks) {
    const q = clamp((p - c.delay) / (1 - c.delay), 0, 1);
    const n = Math.floor(q * (c.pts.length - 1));
    if (n < 1) continue;
    ctx.beginPath();
    ctx.moveTo(c.pts[0][0], c.pts[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(c.pts[i][0], c.pts[i][1]);
    ctx.stroke();
    // branches
    for (let i = 2; i <= n; i += 3) {
      const [x, y] = c.pts[i];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hash(x) - 0.5) * 60, y + (hash(y) - 0.5) * 60); ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawShatter(ctx, p) {
  // Shards fly outward as the sedative kicks in.
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const a = hash(i) * Math.PI * 2;
    const r = p * (300 + hash(i + 3) * 700);
    const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = 'rgba(220,255,235,0.5)';
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    const s = 20 + hash(i + 5) * 50;
    ctx.moveTo(x, y); ctx.lineTo(x + s, y + s * 0.3); ctx.lineTo(x + s * 0.2, y + s); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// CRT power-down: the frame collapses to a line, then a dot, then nothing.
// ---------------------------------------------------------------------------
export function drawPowerDown(ctx, snapshot, p) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (p < 0.45) {
    const k = 1 - p / 0.45;
    const h = Math.max(2, H * k * k);
    ctx.save();
    ctx.filter = `brightness(${1 + (1 - k) * 3})`;
    if (snapshot) ctx.drawImage(snapshot, 0, H / 2 - h / 2, W, h);
    ctx.restore();
  } else if (p < 0.8) {
    const k = 1 - (p - 0.45) / 0.35;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 20;
    ctx.fillRect(W / 2 - (W / 2) * k, H / 2 - 1.5, W * k, 3);
  } else if (p < 1) {
    const k = 1 - (p - 0.8) / 0.2;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 5 * k + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
}
