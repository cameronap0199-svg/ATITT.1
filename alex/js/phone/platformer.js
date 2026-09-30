// BABY MARIO NIGHTMARE — a parody of a classic 8-bit platformer starring Horse Mario.
// Three stages. Die? Restart the nightmare. Original pixel art and music.

import { G } from '../state.js';

const T = 16, VW = 256, VH = 192;

// Level legend: '#' ground, 'B' brick, '?' question block, 'X' solid block, 'P' pipe,
// 'C' coin, 'E' Goombap, 'F' flag, 'H' hay platform, '=' bridge, ' ' air.
const LEVELS = [
  {
    name: 'WORLD 1-1: HORSE STREET', sky: '#6b8cff', ground: '#c84c0c', dark: '#7a2f08',
    rows: [
      '                                                                                                                                  ',
      '                                                                                                                                  ',
      '                                                                                                                             F    ',
      '                      C C C                                                                                                  F    ',
      '                                          BBBB                                                                               F    ',
      '              ?   B?B?B                                  B?B              ?  ?  ?                           XX               F    ',
      '                                                                                                           XXX               F    ',
      '                                    P                               P                                     XXXX               F    ',
      '                        P           P            E    E             P            E   E                   XXXXX               F    ',
      '             E          P     E     P                               P     E                             XXXXXX               F    ',
      '######################################  ##########################    #################################################  #########',
      '######################################  ##########################    #################################################  #########',
    ],
  },
  {
    name: 'WORLD 1-2: UNDER THE STABLE', sky: '#000000', ground: '#0e6b8c', dark: '#063d52', under: true,
    rows: [
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      'B                                                                                                                        ',
      'B                                                                                                                  F     ',
      'B                C C C C                        CCCCC                                                              F     ',
      'B                                                                     BBBBBBBB                                     F     ',
      'B             BBBBBBBBBBBB         ?B?B?        BBBBB          C C C                          ?                   F     ',
      'B                                                                                  X                               F     ',
      'B                           P                                P                    XX         P                     F     ',
      'B                     E     P      E  E                      P      E   E        XXX   E     P      E  E           F     ',
      'B          E      E         P                      E         P                  XXXX         P                     F     ',
      '###############################  #######################  ###################  #########################   ##############',
      '###############################  #######################  ###################  #########################   ##############',
    ],
  },
  {
    name: 'WORLD 1-3: HAY TOWERS', sky: '#9ec5ff', ground: '#3a8c2a', dark: '#1f5c14', hay: true,
    rows: [
      '                                                                                                                          ',
      '                                                                                                                          ',
      '                                    C C                                                                              F    ',
      '                             HHHH          C                       C C C                                             F    ',
      '                  C                      HHHHH                                        C                              F    ',
      '             HHHHH       E                        HHHHH        HHHHHHH         HHH   HHHH        HHHH                F    ',
      '                       HHHHHH       E                  E HHHH                             EHH          HH            F    ',
      '        HHHH       HH             HHHHHH                              E  HHHH                              HHHH      F    ',
      '                                                                    HHHHHHH                   HHHHH                  F    ',
      '                                               HHHH                                                                  F    ',
      '#######                                                                                                           ########',
      '#######                                                                                                           ########',
    ],
  },
];

const HORSE = [
  '........rrrrr...',
  '.......rrrrrrrr.',
  '.......ddbbbkb..',
  '......ddbbbbbbbb',
  '......ddbbbbkkkk',
  '.....ddd.bbbbbb.',
  '....dddooooob...',
  '..bbbboooyoob...',
  '.bbbbboooooob...',
  '.bbbbbbbbbbbb...',
  '.bbbbbbbbbbbb...',
  '..bb.bb..bb.bb..',
  '..bb.bb..bb.bb..',
  '..dd.dd..dd.dd..',
];
const HORSE2 = HORSE.slice(0, 11).concat(['...bb.bb.bb.bb..', '...bb.bb.bb.bb..', '...dd.dd.dd.dd..']);
const GOOMBAP = [
  '..d..........d..',
  '..dd..pppp..dd..',
  '...dpppppppppd..',
  '..pppppppppppp..',
  '.ppwwkppppkwwpp.',
  '.pppwkppppkwppp.',
  'pppppppppppppppp',
  'pppppkkkkkkppppp',
  '.pppppppppppppp.',
  '...ssssssssss...',
  '..kkss....sskk..',
  '.kkkk......kkkk.',
];
const PAL = { r: '#e63946', d: '#5c3317', b: '#a0642d', k: '#111111', o: '#1d4ed8', y: '#ffd60a', w: '#ffffff', p: '#7b2cbf', s: '#f4d7b5' };

function spriteCanvas(rows, flip) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PAL[ch]; g.fillRect(flip ? 15 - x : x, y + (16 - rows.length), 1, 1); } }));
  return c;
}
export function horseCanvas(scale = 1, creepy = false) {
  const c = document.createElement('canvas');
  c.width = 16 * scale; c.height = 16 * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const rows = HORSE.map((r) => creepy ? r.replace('k', 'X') : r);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = ch === 'X' ? '#ff0000' : PAL[ch]; g.fillRect(x * scale, (y + 2) * scale, scale, scale); } }));
  return c;
}

export class HorseMario {
  constructor(onDone) {
    this.onDone = onDone;
    this.stage = 0;
    this.deaths = 0;
    this.coins = 0;
    this.spr = { h: [spriteCanvas(HORSE), spriteCanvas(HORSE2)], hl: [spriteCanvas(HORSE, true), spriteCanvas(HORSE2, true)], g: spriteCanvas(GOOMBAP) };
    G.audio.playMusic('nightmare', { restart: true });
    this.load(0);
  }

  load(i) {
    this.stage = i;
    const L = LEVELS[i];
    this.L = L;
    this.grid = L.rows.map((r) => [...r]);
    this.w = Math.max(...L.rows.map((r) => r.length));
    this.enemies = [];
    this.coinsFloat = [];
    for (let y = 0; y < this.grid.length; y++) for (let x = 0; x < this.grid[y].length; x++) {
      const ch = this.grid[y][x];
      if (ch === 'E') { this.enemies.push({ x: x * T, y: y * T, vx: -0.5, vy: 0, alive: true, squish: 0 }); this.grid[y][x] = ' '; }
      if (ch === 'C') { this.coinsFloat.push({ x: x * T + 4, y: y * T + 2, got: false }); this.grid[y][x] = ' '; }
    }
    this.p = { x: 24, y: 8 * T, vx: 0, vy: 0, w: 14, h: 14, face: 1, ground: false, frame: 0, dead: 0, win: 0 };
    this.cam = 0;
    this.time = 300;
    this.banner = 1.8;
    this.bumps = [];
  }

  tile(tx, ty) {
    if (ty < 0) return this.L.under ? 'B' : ' ';
    if (ty >= this.grid.length) return ' ';
    return (this.grid[ty] && this.grid[ty][tx]) || ' ';
  }
  solid(ch) { return ch === '#' || ch === 'B' || ch === '?' || ch === 'X' || ch === 'P' || ch === 'H' || ch === 'U' || ch === '='; }

  update(dt) {
    // fixed 60 Hz steps for crisp platforming
    this.acc = (this.acc || 0) + Math.min(dt, 0.1);
    while (this.acc >= 1 / 60) { this.acc -= 1 / 60; this.step(); }
  }

  step() {
    if (this.banner > 0) { this.banner -= 1 / 60; return; }
    const p = this.p, inp = G.input;
    if (p.dead) {
      p.dead++;
      if (p.dead < 30) return;
      p.vy += 0.3; p.y += p.vy;
      if (p.dead > 150) this.restart();
      return;
    }
    if (p.win) {
      p.win++;
      if (p.y < 9 * T) p.y += 2;
      if (p.win > 110) {
        if (this.stage >= LEVELS.length - 1) { this.finished = true; this.onDone(); } else this.load(this.stage + 1);
      }
      return;
    }
    this.time -= 2.5 / 60;
    if (this.time <= 0) { this.die(); return; }
    const run = inp.isHeld('dash') || inp.isHeld('ranged');
    const max = run ? 2.6 : 1.55;
    const mx = inp.move.x;
    if (Math.abs(mx) > 0.2) { p.vx += Math.sign(mx) * 0.12; p.face = Math.sign(mx); } else p.vx *= p.ground ? 0.82 : 0.97;
    p.vx = Math.max(-max, Math.min(max, p.vx));
    if ((inp.pressed('jump') || inp.pressed('phone1')) && p.ground) { p.vy = -4.7; p.ground = false; G.audio.sfx('pjump'); }
    const holding = inp.isHeld('jump') || inp.isHeld('phone1');
    p.vy += p.vy < 0 && holding ? 0.17 : 0.42;
    p.vy = Math.min(p.vy, 5);
    // x move + collide
    p.x += p.vx;
    if (p.x < this.cam) { p.x = this.cam; p.vx = 0; }
    this.collideX(p);
    p.y += p.vy;
    p.ground = false;
    this.collideY(p);
    if (p.y > VH + 20) { this.die(); return; }
    p.frame += Math.abs(p.vx) * 0.12;
    // camera only moves forward
    this.cam = Math.max(this.cam, Math.min(p.x - VW * 0.4, this.w * T - VW));
    // coins
    for (const c of this.coinsFloat) if (!c.got && Math.abs(c.x + 4 - (p.x + 7)) < 10 && Math.abs(c.y + 6 - (p.y + 7)) < 12) { c.got = true; this.coins++; G.audio.sfx('pcoin'); }
    // enemies
    for (const e of this.enemies) {
      if (!e.alive) { if (e.squish) e.squish--; continue; }
      if (e.x > this.cam + VW + 32) continue;
      e.vy = Math.min(5, e.vy + 0.4);
      e.x += e.vx;
      const bx = e.vx < 0 ? e.x : e.x + 15;
      if (this.solid(this.tile(Math.floor(bx / T), Math.floor((e.y + 8) / T)))) e.vx *= -1;
      e.y += e.vy;
      const ty = Math.floor((e.y + 16) / T);
      if (this.solid(this.tile(Math.floor((e.x + 8) / T), ty))) { e.y = ty * T - 16; e.vy = 0; }
      if (e.y > VH + 30) { e.alive = false; continue; }
      if (Math.abs(e.x + 8 - (p.x + 7)) < 13 && Math.abs(e.y + 10 - (p.y + 8)) < 13) {
        if (p.vy > 0.5 && p.y + 8 < e.y + 8) { e.alive = false; e.squish = 30; p.vy = -3.2; G.audio.sfx('pstomp'); }
        else { this.die(); return; }
      }
    }
    // flag
    const fx = Math.floor((p.x + 8) / T);
    for (let y = 0; y < this.grid.length; y++) if (this.tile(fx, y) === 'F') { p.win = 1; p.vx = 0; G.audio.sfx('win'); break; }
    for (const b of this.bumps) b.t--;
    this.bumps = this.bumps.filter((b) => b.t > 0);
  }

  collideX(p) {
    const top = Math.floor((p.y + 2) / T), bot = Math.floor((p.y + p.h - 1) / T);
    for (let ty = top; ty <= bot; ty++) {
      if (p.vx > 0) { const tx = Math.floor((p.x + p.w) / T); if (this.solid(this.tile(tx, ty))) { p.x = tx * T - p.w - 0.01; p.vx = 0; } }
      else if (p.vx < 0) { const tx = Math.floor(p.x / T); if (this.solid(this.tile(tx, ty))) { p.x = (tx + 1) * T + 0.01; p.vx = 0; } }
    }
  }
  collideY(p) {
    const l = Math.floor((p.x + 2) / T), r = Math.floor((p.x + p.w - 2) / T);
    for (let tx = l; tx <= r; tx++) {
      if (p.vy > 0) {
        const ty = Math.floor((p.y + p.h) / T);
        if (this.solid(this.tile(tx, ty))) { p.y = ty * T - p.h; p.vy = 0; p.ground = true; }
      } else if (p.vy < 0) {
        const ty = Math.floor(p.y / T);
        const ch = this.tile(tx, ty);
        if (this.solid(ch)) {
          p.y = (ty + 1) * T; p.vy = 0.5;
          if (ch === '?') { this.grid[ty][tx] = 'U'; this.coins++; G.audio.sfx('pcoin'); this.bumps.push({ x: tx, y: ty, t: 20, coin: true }); }
          else if (ch === 'B') { G.audio.sfx('pbump'); this.bumps.push({ x: tx, y: ty, t: 8 }); }
          break;
        }
      }
    }
  }

  die() {
    if (this.p.dead) return;
    this.p.dead = 1;
    this.p.vy = -5;
    this.deaths++;
    G.audio.sfx('pdie');
    G.run.stat('nightmareDeaths', 1);
  }
  restart() {
    // Die? Restart the nightmare. (After enough deaths the horse takes pity and
    // only restarts the current stage.)
    this.load(this.deaths >= 5 ? this.stage : 0);
    this.pity = this.deaths >= 5;
  }

  draw(g, cw, ch) {
    const scale = Math.max(1, Math.floor(Math.min(cw / VW, ch / VH)));
    const ox = Math.floor((cw - VW * scale) / 2), oy = Math.floor((ch - VH * scale) / 2);
    g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(ox, oy);
    g.scale(scale, scale);
    g.beginPath(); g.rect(0, 0, VW, VH); g.clip();
    const L = this.L;
    g.fillStyle = L.sky; g.fillRect(0, 0, VW, VH);
    const cam = Math.floor(this.cam);
    // background hills / clouds (parallax)
    if (!L.under) {
      for (let i = 0; i < 20; i++) {
        const x = i * 90 - (cam * 0.5) % 90;
        g.fillStyle = L.hay ? '#ffffff' : '#4aa82d';
        if (!L.hay) { g.beginPath(); g.arc(x, 160, 30, Math.PI, 0); g.fill(); }
        g.fillStyle = '#ffffff';
        g.fillRect(x + 20, 30 + (i % 3) * 12, 24, 8); g.fillRect(x + 24, 26 + (i % 3) * 12, 16, 4);
      }
    }
    const x0 = Math.floor(cam / T), x1 = x0 + VW / T + 1;
    for (let ty = 0; ty < this.grid.length; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = this.tile(tx, ty);
      if (c === ' ' || c === 'F') continue;
      const bump = this.bumps.find((b) => b.x === tx && b.y === ty);
      const px = tx * T - cam, py = ty * T - (bump ? Math.sin((bump.t / 20) * Math.PI) * 4 : 0);
      this.drawTile(g, c, px, py, tx, ty);
    }
    // flag
    for (let ty = 0; ty < this.grid.length; ty++) for (let tx = x0; tx <= x1; tx++) if (this.tile(tx, ty) === 'F') {
      g.fillStyle = '#9ef01a'; g.fillRect(tx * T - cam + 7, ty * T, 2, T);
      if (this.tile(tx, ty - 1) !== 'F') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(tx * T - cam + 7, ty * T + 2); g.lineTo(tx * T - cam - 6, ty * T + 7); g.lineTo(tx * T - cam + 7, ty * T + 12); g.fill(); g.fillStyle = '#e63946'; g.fillRect(tx * T - cam - 2, ty * T + 5, 4, 4); }
    }
    for (const c of this.coinsFloat) if (!c.got) { g.fillStyle = '#ffd60a'; g.fillRect(c.x - cam, c.y, 8, 12); g.fillStyle = '#b8860b'; g.fillRect(c.x - cam + 3, c.y + 2, 2, 8); }
    for (const e of this.enemies) {
      if (!e.alive && !e.squish) continue;
      if (e.squish) { g.save(); g.translate(e.x - cam, e.y + 10); g.scale(1, 0.4); g.drawImage(this.spr.g, 0, 0); g.restore(); continue; }
      g.drawImage(this.spr.g, e.x - cam, e.y + (Math.floor(e.x / 6) % 2));
    }
    const p = this.p;
    const fr = Math.floor(p.frame) % 2;
    const img = (p.face >= 0 ? this.spr.h : this.spr.hl)[p.ground ? fr : 1];
    g.drawImage(img, Math.floor(p.x - cam - 1), Math.floor(p.y - 2));
    // HUD
    g.fillStyle = '#fff';
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'left';
    g.fillText('HORSE MARIO', 8, 12);
    g.fillText('x' + String(this.coins).padStart(2, '0'), 100, 12);
    g.fillText(L.name.split(':')[0], 150, 12);
    g.fillText('TIME ' + Math.max(0, Math.ceil(this.time)), 200, 22);
    g.fillText('DEATHS ' + this.deaths, 8, 22);
    if (this.banner > 0) {
      g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH);
      g.fillStyle = '#fff'; g.textAlign = 'center';
      g.fillText(L.name, VW / 2, 80);
      g.drawImage(this.spr.h[0], VW / 2 - 24, 96);
      g.fillText('x ∞', VW / 2 + 12, 108);
      if (this.pity) g.fillText('THE HORSE FEELS SORRY FOR YOU', VW / 2, 140);
      else if (this.stage === 0 && this.deaths === 0) g.fillText('BABY MARIO NIGHTMARE', VW / 2, 140);
    }
    g.restore();
  }

  drawTile(g, c, x, y, tx, ty) {
    const L = this.L;
    if (c === '#') { g.fillStyle = L.ground; g.fillRect(x, y, T, T); g.fillStyle = L.dark; g.fillRect(x, y + T - 2, T, 2); g.fillRect(x + T - 2, y, 2, T); if (this.tile(tx, ty - 1) !== '#' && L.hay) { g.fillStyle = '#9ef01a'; g.fillRect(x, y, T, 3); } }
    else if (c === 'B') { g.fillStyle = L.under ? '#1b8cb8' : '#b8471a'; g.fillRect(x, y, T, T); g.fillStyle = L.under ? '#063d52' : '#5c1a05'; g.fillRect(x, y + 7, T, 1); g.fillRect(x, y + 15, T, 1); g.fillRect(x + 7, y, 1, 7); g.fillRect(x + 3, y + 8, 1, 7); g.fillRect(x + 11, y + 8, 1, 7); }
    else if (c === '?') { g.fillStyle = '#ffb703'; g.fillRect(x, y, T, T); g.fillStyle = '#8a4b08'; g.fillRect(x, y + 15, T, 1); g.fillRect(x + 15, y, 1, T); g.fillStyle = '#fff'; g.font = '10px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillText('?', x + 8, y + 12); }
    else if (c === 'U') { g.fillStyle = '#8a4b08'; g.fillRect(x, y, T, T); g.fillStyle = '#5c3317'; g.fillRect(x + 2, y + 2, 2, 2); g.fillRect(x + 12, y + 12, 2, 2); }
    else if (c === 'X') { g.fillStyle = '#c0a080'; g.fillRect(x, y, T, T); g.fillStyle = '#6b4f3a'; g.fillRect(x, y + 15, T, 1); g.fillRect(x + 15, y, 1, T); g.fillStyle = '#e8d4b8'; g.fillRect(x, y, T, 1); g.fillRect(x, y, 1, T); }
    else if (c === 'P') {
      const top = this.tile(tx, ty - 1) !== 'P';
      g.fillStyle = '#2f9e44'; g.fillRect(x - (top ? 2 : 0), y, T + (top ? 4 : 0), T);
      g.fillStyle = '#8ce99a'; g.fillRect(x + 2, y, 3, T);
      g.fillStyle = '#1b5e20'; g.fillRect(x + T - 3, y, 2, T);
    }
    else if (c === 'H') { g.fillStyle = '#e9c46a'; g.fillRect(x, y, T, 10); g.fillStyle = '#b08968'; g.fillRect(x, y + 10, T, 2); for (let i = 0; i < 4; i++) { g.fillStyle = '#f4a261'; g.fillRect(x + i * 4 + 1, y + 2, 1, 6); } }
  }
}
