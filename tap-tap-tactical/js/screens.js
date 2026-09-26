// Canvas screens between rooms: the title terminal, the Mainframe Topology map, node
// decryption, the elevator down, the game-over terminal and plain backdrops for DOM rooms.

import { W, H, NODE_TYPES, WEAPONS, CONSUMABLES, itemById, floorMult } from './data.js';
import { text, FONT, COLORS, hash, scanlines, vignette, roundRect, crt, dist } from './render.js';
import { drawWeaponIcon, drawItemIcon, drawTooltipBox } from './hud.js';
import { buildScene } from './scene.js';
import { input } from './input.js';

const GREEN = COLORS.phosphor;

// ---------------------------------------------------------------------------
// Title: the concept art behind a CRT, with a cheat-code prompt.
// ---------------------------------------------------------------------------
export class TitleScreen {
  constructor(game) { this.game = game; this.code = ''; this.msg = null; }
  update(dt, t) { this.t = t; this.game.ekg.update(dt, 'stable'); }
  onKey(code, time) {
    const m = /^(Digit|Numpad)(\d)$/.exec(code);
    if (m) {
      this.code = (this.code + m[2]).slice(-4);
      if (this.code.length === 4) {
        const res = this.game.toggleCheat(this.code);
        this.msg = { text: res ? `> CODE ${this.code}: ${res.name} ${res.on ? 'ENABLED' : 'DISABLED'}` : `> CODE ${this.code}: ACCESS DENIED`, t0: time, ok: !!res };
        this.code = '';
      }
    } else if (code === 'Backspace') this.code = this.code.slice(0, -1);
  }
  onClick() {}
  draw(ctx, t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const img = this.game.art('title');
    if (img && img.complete && img.naturalWidth) {
      const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(img, (W - iw) / 2 + Math.sin(t * 0.2) * 10, (H - ih) / 2, iw, ih);
      ctx.restore();
      if (hash(Math.floor(t * 8)) > 0.9) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25;
        const y = hash(Math.floor(t * 8) + 1) * H;
        ctx.drawImage(img, 0, y / k, img.naturalWidth, 30 / k, 14, y, W, 30);
        ctx.restore();
      }
    }
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.92)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Logo with a chromatic glitch
    const gx = hash(Math.floor(t * 6)) > 0.85 ? (hash(Math.floor(t * 30)) - 0.5) * 14 : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    text(ctx, 'TAP TAP TACTICAL', 64 + gx, 170, { size: 96, font: FONT.title, color: 'rgba(255,40,80,0.8)' });
    text(ctx, 'TAP TAP TACTICAL', 64 - gx, 170, { size: 96, font: FONT.title, color: 'rgba(0,229,255,0.8)' });
    ctx.restore();
    text(ctx, 'TAP TAP TACTICAL', 64, 170, { size: 96, font: FONT.title, color: '#f4efe4' });
    text(ctx, 'THE PSYCHOSIS PROTOCOL', 70, 214, { size: 40, color: GREEN, glow: 10 });
    text(ctx, 'A PSYCHOLOGICAL ARCADE RAIL-SHOOTER FROM THE BLACK SITE HADES', 70, 246, { size: 20, color: 'rgba(210,255,220,0.7)' });
    const p = this.game.profile;
    text(ctx, `SUBJECT 87 — ATTEMPT #${p.attempts + 1}${p.bestFloor ? `   •   DEEPEST FLOOR ${p.bestFloor}   •   BEST COMBO ×${p.bestCombo}` : ''}`, 70, H - 70, { size: 20, color: 'rgba(210,255,220,0.65)' });
    const cheats = this.game.activeCheats();
    text(ctx, `> ENTER CODE: ${this.code.padEnd(4, '_')}${Math.floor(t * 2) % 2 ? '█' : ' '}`, 70, H - 40, { size: 22, color: GREEN });
    if (cheats.length) text(ctx, `ACTIVE: ${cheats.join(' • ')}`, 70, H - 14, { size: 18, color: COLORS.amber });
    if (this.msg && t - this.msg.t0 < 3) text(ctx, this.msg.text, 420, H - 40, { size: 22, color: this.msg.ok ? COLORS.amber : '#ff5a5a' });
    crt(ctx, t, { lines: 0.18, flicker: 0.015 });
  }
}

// ---------------------------------------------------------------------------
// The Mainframe Topology
// ---------------------------------------------------------------------------
const GLYPH = {
  initiation: (ctx, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill(); },
  combat: (ctx, r) => { ctx.strokeRect(-r, -r, r * 2, r * 2); ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke(); },
  gateway: (ctx, r) => { ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 1.2, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 1.2, 0); ctx.closePath(); ctx.stroke(); },
  containment: (ctx, r) => { ctx.strokeRect(-r, -r, r * 2, r * 2); ctx.strokeRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1); },
  quarantine: (ctx, r) => { ctx.beginPath(); ctx.moveTo(0, -r * 1.25); ctx.lineTo(r * 1.2, r * 0.9); ctx.lineTo(-r * 1.2, r * 0.9); ctx.closePath(); ctx.stroke(); ctx.fillRect(-1.5, -r * 0.5, 3, r * 0.8); ctx.fillRect(-1.5, r * 0.45, 3, 3); },
  null: (ctx, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke(); },
  core: (ctx, r) => { ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke(); },
  unknown: (ctx, r) => { ctx.strokeRect(-r, -r, r * 2, r * 2); text(ctx, '?', 0, r * 0.55, { size: r * 1.6, color: ctx.strokeStyle, align: 'center' }); },
};

export class MapScreen {
  constructor(game) {
    this.game = game;
    this.hover = null;
    this.invHover = null;
    this.t0 = game.time;
  }
  get map() { return this.game.run.map; }
  nodeAt(x, y) { return this.map.nodes.find((n) => dist(x, y, n.x, n.y) < 22) || null; }
  update(dt, t) {
    this.t = t;
    this.game.ekg.update(dt, this.game.vitals());
    this.game.eeg.update(dt, this.game.run.psyche.load);
    this.hover = this.nodeAt(input.mouse.x, input.mouse.y);
    this.invHover = this.inventorySlots().find((s) => input.mouse.x > s.x && input.mouse.x < s.x + s.w && input.mouse.y > s.y && input.mouse.y < s.y + s.h) || null;
  }
  cursor() { return this.hover && this.hover.state === 'available' ? 'pointer' : 'default'; }
  onClick(x, y) {
    const n = this.nodeAt(x, y);
    if (n && n.state === 'available') this.game.selectNode(n.id);
  }
  onKey(code) {
    if (code === 'Enter' || code === 'Space') {
      const avail = this.map.nodes.filter((n) => n.state === 'available');
      if (avail.length === 1) this.game.selectNode(avail[0].id);
    }
  }
  jagged(a, b) {
    const pts = [[a.x, a.y]];
    const n = 9;
    for (let i = 1; i < n; i++) {
      const p = i / n;
      const off = (hash(a.id * 31 + b.id * 7 + i) - 0.5) * 16;
      const nx = -(b.y - a.y), ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      pts.push([a.x + (b.x - a.x) * p + (nx / len) * off, a.y + (b.y - a.y) * p + (ny / len) * off]);
    }
    pts.push([b.x, b.y]);
    return pts;
  }
  inventorySlots() {
    const run = this.game.run;
    const slots = [];
    let x = 630;
    const y = 612;
    run.weapons.forEach((w) => { slots.push({ x, y, w: 104, h: 60, kind: 'weapon', id: w.id, ammo: w.ammo }); x += 112; });
    run.consumables.forEach((c) => { slots.push({ x, y, w: 44, h: 60, kind: 'consumable', id: c }); x += 48; });
    x += 8;
    run.actives.forEach((a) => { slots.push({ x, y, w: 44, h: 60, kind: 'item', id: a.id }); x += 48; });
    run.passives.forEach((id, i) => { slots.push({ x: 630 + (i % 16) * 38, y: 678 + Math.floor(i / 16) * 0, w: 34, h: 34, kind: 'item', id }); });
    return slots;
  }
  draw(ctx, t) {
    const run = this.game.run;
    const map = this.map;
    ctx.fillStyle = '#020603';
    ctx.fillRect(0, 0, W, H);
    // faint grid + random hex noise
    ctx.strokeStyle = 'rgba(57,255,106,0.05)';
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    text(ctx, `HADES // FLOOR ${run.floor} // SUBNET TOPOLOGY`, 24, 40, { size: 30, color: GREEN, glow: 10 });
    text(ctx, 'SELECT A CONNECTED NODE ▸ CONTENTS ENCRYPTED ▸ NO BACKTRACKING ▸ ALL ROUTES END AT THE [SYSTEM_CORE]', 24, 68, { size: 18, color: 'rgba(57,255,106,0.7)' });
    text(ctx, `THREAT ×${floorMult(run.floor).toFixed(2)}`, W - 24, 40, { size: 26, color: COLORS.amber, align: 'right', glow: 6 });
    // edges
    for (const [a, b] of map.edges) {
      const A = map.nodes[a], B = map.nodes[b];
      const pts = this.jagged(A, B);
      let style;
      if (B.state === 'available' && (A.state === 'cleared' || A.state === 'current')) style = 'live';
      else if (B.state === 'burnt' || A.state === 'burnt' || (B.state === 'cleared' || B.state === 'current')) style = 'burnt';
      else style = 'locked';
      ctx.save();
      if (style === 'live') { ctx.strokeStyle = GREEN; ctx.shadowColor = GREEN; ctx.shadowBlur = 10; ctx.lineWidth = 2.5; } else if (style === 'burnt') {
        ctx.strokeStyle = `rgba(255,60,50,${0.35 + 0.25 * hash(a * 3 + b + Math.floor(t * 12))})`;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = Math.floor(t * 20) % 8;
        ctx.lineWidth = 1.5;
      } else { ctx.strokeStyle = 'rgba(57,255,106,0.22)'; ctx.lineWidth = 1.2; }
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      if (style === 'live') {
        const p = (t * 0.8 + hash(a + b)) % 1;
        const idx = Math.floor(p * (pts.length - 1));
        const f = p * (pts.length - 1) - idx;
        const [x1, y1] = pts[idx], [x2, y2] = pts[idx + 1];
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // nodes
    for (const n of map.nodes) {
      const known = n.known || this.game.run.cheats.unlockAll;
      const type = known ? n.type : 'unknown';
      let color = 'rgba(57,255,106,0.35)';
      if (n.state === 'available') color = GREEN;
      if (n.state === 'cleared') color = 'rgba(57,255,106,0.55)';
      if (n.state === 'current') color = '#fff';
      if (n.state === 'burnt') color = 'rgba(255,60,50,0.6)';
      if (known && n.type === 'quarantine' && n.state !== 'burnt' && n.state !== 'cleared') color = Math.sin(t * 6) > 0 ? '#ffd24a' : '#8a6d10';
      if (known && n.type === 'core') color = n.state === 'burnt' ? color : `rgba(255,${60 + 40 * Math.sin(t * 3)},60,1)`;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.fillStyle = '#020603';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = color;
      ctx.shadowBlur = n.state === 'available' ? 14 : 4;
      GLYPH[type](ctx, n.type === 'core' ? 13 : 11);
      if (n.state === 'available') {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5);
        ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(t * 5) * 3, 0, Math.PI * 2); ctx.stroke();
      }
      if (n.state === 'burnt') { ctx.strokeStyle = 'rgba(255,60,50,0.8)'; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.moveTo(14, -14); ctx.lineTo(-14, 14); ctx.stroke(); }
      if (n.state === 'cleared') { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (n.id === map.current) text(ctx, 'YOU', n.x, n.y - 30, { size: 16, color: '#fff', align: 'center' });
    }
    if (this.hover) {
      const n = this.hover;
      const known = n.known || this.game.run.cheats.unlockAll;
      const def = NODE_TYPES[n.type];
      const tx = Math.min(W - 380, n.x + 26), ty = Math.max(90, n.y - 100);
      drawTooltipBox(ctx, tx, ty, known ? def.tag : '[ENCRYPTED NODE]', known ? `${def.name}. ${n.state === 'available' ? 'CLICK TO ROUTE.' : n.state.toUpperCase()}` : `Contents unknown. ${n.state === 'available' ? 'Click to route and decrypt.' : n.state === 'burnt' ? 'Signal lost. Unreachable.' : 'Not yet reachable.'}`, t);
    }
    // bottom strip: monitors + inventory
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 180, W, 180);
    ctx.fillStyle = 'rgba(57,255,106,0.3)';
    ctx.fillRect(0, H - 180, W, 1);
    this.game.ekg.draw(ctx, 16, H - 166, this.game.vitals(), t, { reduceFlash: this.game.settings.reduceFlash });
    this.game.eeg.draw(ctx, 310, H - 138, run.psyche.load, t, this.game.eegNotice);
    text(ctx, 'LOADOUT', 630, H - 118, { size: 18, color: 'rgba(57,255,106,0.7)' });
    text(ctx, `SCRAP ${run.scrap}   COMBO ×${run.combo.count} (BEST ×${run.combo.best})   SCORE ${run.combo.score}`, W - 24, H - 118, { size: 18, color: COLORS.amber, align: 'right' });
    if (run.passives.length) text(ctx, 'PASSIVES', 630 + 0, 674, { size: 13, color: 'rgba(57,255,106,0.5)' });
    for (const s of this.inventorySlots()) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,14,8,0.9)';
      roundRect(ctx, s.x, s.y, s.w, s.h, 6);
      ctx.fill();
      ctx.strokeStyle = this.invHover === s ? '#fff' : 'rgba(57,255,106,0.4)';
      ctx.stroke();
      if (s.kind === 'weapon') {
        drawWeaponIcon(ctx, s.id, s.x + 6, s.y + 6, 92, 34);
        text(ctx, `${s.ammo}/${WEAPONS[s.id].mag}`, s.x + s.w - 6, s.y + s.h - 6, { size: 16, color: '#dfe', align: 'right' });
      } else if (s.id) drawItemIcon(ctx, s.id, s.x + s.w / 2, s.y + s.h / 2, Math.min(s.w, s.h) - 8, t);
      ctx.restore();
    }
    if (this.invHover && this.invHover.id) {
      const s = this.invHover;
      let title, body;
      if (s.kind === 'weapon') { const w = WEAPONS[s.id]; title = w.name; body = `${w.kind} • ${w.tier.toUpperCase()} reload. ${w.desc}`; } else if (s.kind === 'consumable') { const c = CONSUMABLES[s.id]; title = c.name; body = c.desc; } else { const it = itemById(s.id); title = `${it.name} (${it.kind.toUpperCase()})`; body = it.effect; }
      ctx.save();
      ctx.font = `17px ${FONT.mono}`;
      drawTooltipBox(ctx, Math.min(W - 370, s.x), s.y - 120, title, body, t);
      ctx.restore();
    }
    scanlines(ctx, 0.14);
    vignette(ctx, 'rgba(0,0,0,0.7)', 0.6);
  }
}

// ---------------------------------------------------------------------------
// Node decryption: a harsh green boot screen that reveals the room.
// ---------------------------------------------------------------------------
export class DecryptScreen {
  constructor(game, node, onDone) {
    this.game = game;
    this.node = node;
    this.onDone = onDone;
    this.t0 = game.time;
    const def = NODE_TYPES[node.type];
    const hex = Math.floor(hash(node.id + game.run.floor * 17) * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    this.lines = [
      `> ROUTING SUBJECT 87 CLEARANCE THROUGH NODE 0x${hex}...`,
      '> DECRYPTING NODE...',
      `> ${def.tag} IDENTIFIED. ${def.line}`,
    ];
    this.done = false;
  }
  finish() { if (!this.done) { this.done = true; this.onDone(); } }
  onKey() { if (this.game.time - this.t0 > 0.4) this.finish(); }
  onClick() { if (this.game.time - this.t0 > 0.4) this.finish(); }
  update(dt, t) { if (t - this.t0 > 2.4) this.finish(); }
  draw(ctx, t) {
    const age = t - this.t0;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      text(ctx, Math.floor(hash(i * 13 + Math.floor(t * 20)) * 1e8).toString(16), (i % 10) * 130 + 20, 40 + Math.floor(i / 10) * 18, { size: 14, color: 'rgba(57,255,106,0.12)' });
    }
    let y = 300;
    this.lines.forEach((l, i) => {
      const start = i * 0.55;
      if (age < start) return;
      const n = Math.floor((age - start) * 70);
      const shown = l.slice(0, n);
      const col = i === 2 ? (this.node.type === 'quarantine' || this.node.type === 'core' ? COLORS.amber : '#e8ffe8') : GREEN;
      text(ctx, shown + (n < l.length && Math.floor(t * 8) % 2 ? '█' : ''), 120, y, { size: 30, color: col, glow: 8 });
      y += 46;
    });
    crt(ctx, t, { lines: 0.22, flicker: 0.03 });
  }
}

// ---------------------------------------------------------------------------
// The elevator: an infinite descent.
// ---------------------------------------------------------------------------
export class ElevatorScreen {
  constructor(game, onDone) { this.game = game; this.onDone = onDone; this.t0 = game.time; this.done = false; }
  finish() { if (!this.done) { this.done = true; this.onDone(); } }
  onKey() { if (this.game.time - this.t0 > 1) this.finish(); }
  onClick() { if (this.game.time - this.t0 > 1) this.finish(); }
  update(dt, t) { if (t - this.t0 > 4.5) this.finish(); }
  draw(ctx, t) {
    const age = t - this.t0;
    const floor = this.game.run.floor;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      const y = ((i * 90 - age * 520) % (H + 90) + H + 90) % (H + 90) - 45;
      ctx.fillStyle = 'rgba(255,230,180,0.08)';
      ctx.fillRect(0, y, W, 6);
    }
    ctx.fillStyle = '#16181b';
    ctx.fillRect(0, 0, 200, H);
    ctx.fillRect(W - 200, 0, 200, H);
    text(ctx, 'ELEVATOR // DESCENDING', W / 2, 180, { size: 34, color: GREEN, align: 'center', glow: 10 });
    text(ctx, '"The first ripple has been cast. The sea begins to wake."', W / 2, 240, { size: 24, font: FONT.serif, color: '#e8e2d2', align: 'center' });
    const depth = Math.floor(age * 180 + (floor - 2) * 666);
    text(ctx, `DEPTH -${String(depth).padStart(5, '0')} M`, W / 2, 330, { size: 40, color: '#fff', align: 'center' });
    if (age > 1.4) {
      text(ctx, `FLOOR ${floor}`, W / 2, 430, { size: 90, font: FONT.title, color: '#fff', align: 'center', glow: 20 });
      text(ctx, `THREAT LEVEL ×${floorMult(floor).toFixed(2)} — ENEMY HEALTH, SPEED AND DAMAGE ×1.5`, W / 2, 480, { size: 22, color: COLORS.amber, align: 'center' });
      text(ctx, 'THERE IS NO FINAL ESCAPE. ONLY SURVIVAL.', W / 2, 520, { size: 22, color: 'rgba(255,255,255,0.6)', align: 'center' });
    }
    crt(ctx, t, { lines: 0.16, flicker: 0.01 });
  }
}

// ---------------------------------------------------------------------------
// [PREPARE NEXT SUBJECT.]
// ---------------------------------------------------------------------------
export class GameOverScreen {
  constructor(game, kind, summary) { this.game = game; this.kind = kind; this.summary = summary; this.t0 = game.time; }
  onKey(code) {
    if (this.game.time - this.t0 < 1.2) return;
    if (code === 'Enter' || code === 'Space') this.game.newRun();
    else if (code === 'Escape') this.game.showTitle();
  }
  onClick() { if (this.game.time - this.t0 > 1.2) this.game.newRun(); }
  update() {}
  draw(ctx, t) {
    const age = t - this.t0;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const s = this.summary;
    const head = this.kind === 'neural' ? '[SUBJECT 87: NEURAL DEATH. PREPARE NEXT SUBJECT.]' : '[SUBJECT 87: FLATLINE.]';
    const lines = [
      head,
      '',
      `FLOOR REACHED ........ ${s.floor}`,
      `ROOMS SURVIVED ....... ${s.rooms}`,
      `HOSTILES DOWN ........ ${s.kills}`,
      `PRISONERS KILLED ..... ${s.prisoners}`,
      `PERFECT RELOADS ...... ${s.perfectReloads}`,
      `TERMINAL OVERLOADS ... ${s.overloads}`,
      `HIGHEST COMBO ........ ×${s.best}`,
      `SCORE ................ ${s.score}`,
      '',
      '> He cannot escape. Worse, he cannot die.',
      '> Resetting subject...',
    ];
    let y = 150;
    lines.forEach((l, i) => {
      const start = i * 0.12;
      if (age < start) return;
      text(ctx, l.slice(0, Math.floor((age - start) * 90)), 150, y, { size: i === 0 ? 30 : 24, color: i === 0 ? (this.kind === 'neural' ? '#ff4a4a' : GREEN) : GREEN, glow: i === 0 ? 10 : 4 });
      y += i === 0 ? 50 : 30;
    });
    if (age > 2) {
      text(ctx, `[PREPARE NEXT SUBJECT.]${Math.floor(t * 2) % 2 ? '█' : ''}`, W / 2, H - 90, { size: 34, color: '#fff', align: 'center', glow: 10 });
      text(ctx, 'ENTER / CLICK — NEXT SUBJECT      ESC — TITLE', W / 2, H - 50, { size: 20, color: 'rgba(57,255,106,0.6)', align: 'center' });
    }
    crt(ctx, t, { lines: 0.22, flicker: 0.02 });
  }
}

// ---------------------------------------------------------------------------
// Backdrop for DOM-driven rooms (vaults, null zones, reward pedestals).
// ---------------------------------------------------------------------------
export class BackdropScreen {
  constructor(game, theme = 'morgue', { title = '', sub = '' } = {}) {
    this.game = game;
    this.scene = buildScene(game.rng, theme);
    this.title = title;
    this.sub = sub;
  }
  onKey() {}
  onClick() {}
  update(dt) {
    this.game.ekg.update(dt, this.game.vitals());
    this.game.eeg.update(dt, this.game.run.psyche.load);
  }
  draw(ctx, t) {
    ctx.drawImage(this.scene.bg, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);
    if (this.title) text(ctx, this.title, W / 2, 56, { size: 34, color: GREEN, align: 'center', glow: 12 });
    if (this.sub) text(ctx, this.sub, W / 2, 86, { size: 20, color: 'rgba(210,255,220,0.75)', align: 'center' });
    this.game.ekg.draw(ctx, 16, H - 250, this.game.vitals(), t, { reduceFlash: this.game.settings.reduceFlash });
    this.game.eeg.draw(ctx, 16, H - 124, this.game.run.psyche.load, t, this.game.eegNotice);
    scanlines(ctx, 0.12);
  }
}

