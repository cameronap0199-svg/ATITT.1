// Out-of-battle Pokémon scenes on the minigame canvas: the evolution sequence ("What?
// X is evolving!" — white silhouettes flickering faster and faster between the two
// forms, a flash, "Congratulations!"; press B to stop it like the real thing) and the
// "forget a move?" prompt for moves learned outside battle.

import { G } from '../state.js';
import { SPECIES } from './dex.js';
import { MOVES } from './moves.js';
import { TYPES } from './types.js';
import { spriteCanvas, silhouette } from './sprites.js';
import { monName, evolve, learnMove } from './mon.js';

const W = 480, H = 320;
const FONT = '"Press Start 2P", monospace';

// items: [{ type: 'evolve', mon, to } | { type: 'learn', mon, move }]
export class PokeScene {
  constructor(items, onDone) {
    this.items = items.slice();
    this.onDone = onDone;
    this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H;
    this.g = this.cv.getContext('2d');
    this.t = 0;
    this.msgs = [];
    this.cur = null;
    this.tap = null;
    this.hits = [];
    this.pointer = (e) => {
      const r = e.target.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
      this.tap = { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
    };
    document.getElementById('mini').addEventListener('pointerdown', this.pointer);
    this.next();
  }
  confirm() { return G.input.pressed('jump') || G.input.pressed('interact'); }
  cancel() { return G.input.pressed('dash') || G.input.pressed('pause') || G.input.pressed('ranged'); }
  nav() { const i = G.input; return (i.pressed('up') || i.pressed('down') || i.pressed('phone1') || i.pressed('phone3')) ? (i.pressed('up') || i.pressed('phone1') ? -1 : 1) : 0; }
  takeTap() {
    if (!this.tap) return null;
    const t = this.tap; this.tap = null;
    for (const h of this.hits) if (t.x >= h.x && t.x <= h.x + h.w && t.y >= h.y && t.y <= h.y + h.h) return h;
    return { any: true };
  }
  say(s, fn) { this.msgs.push({ s, fn, shown: 0, hold: 0 }); }

  next() {
    const it = this.items.shift();
    if (!it) { this.done(); return; }
    this.cur = it;
    if (it.type === 'evolve') {
      const sp = SPECIES[it.mon.species];
      it.from = it.mon.species;
      it.phase = 'intro'; it.k = 0;
      G.audio.playMusic('pkEvolve', { restart: true });
      this.say('What?', () => G.audio.sfx('pkCry', { p: sp.cry }));
      this.say(`${monName(it.mon)} is evolving!`);
    } else {
      it.phase = 'ask'; it.cursor = 0;
      if (it.mon.moves.some((m) => m.id === it.move)) { this.next(); return; }
      if (learnMove(it.mon, it.move)) { this.say(`${monName(it.mon)} learned ${MOVES[it.move].name}!`, () => G.audio.sfx('pkLevel')); it.phase = 'done'; return; }
    }
  }
  done() {
    if (this.finished) return;
    this.finished = true;
    document.getElementById('mini').removeEventListener('pointerdown', this.pointer);
    this.onDone();
  }

  update(dt) {
    this.t += dt;
    const tap = this.takeTap();
    const ok = this.confirm() || this.cancel() || !!tap;
    // text first
    const m = this.msgs[0];
    if (m) {
      if (!m.started) { m.started = true; m.fn?.(); }
      m.shown += dt * 50;
      if (m.shown >= m.s.length) { m.hold += dt; if (ok || m.hold > 1.4) this.msgs.shift(); }
      else if (ok) m.shown = m.s.length;
      return;
    }
    const it = this.cur;
    if (!it) { this.done(); return; }
    if (it.type === 'evolve') {
      if (it.phase === 'intro') { it.phase = 'morph'; it.k = 0; return; }
      if (it.phase === 'morph') {
        it.k += dt;
        if (this.cancel() && it.k > 0.4) {
          it.phase = 'stopped';
          G.audio.stopMusic();
          this.say(`Huh? ${monName(it.mon)} stopped evolving!`, () => G.audio.sfx('pkCry', { p: SPECIES[it.mon.species].cry }));
          return;
        }
        if (it.k >= 5.2) {
          it.phase = 'flash'; it.k = 0;
          G.audio.sfx('pkFlash');
        }
        return;
      }
      if (it.phase === 'flash') {
        it.k += dt;
        if (it.k > 0.6) {
          const oldName = monName(it.mon);
          const r = evolve(it.mon, it.to);
          G.poke?.dexCatch(it.to);
          G.run?.stat('evolutions', 1);
          it.phase = 'after';
          G.audio.stopMusic();
          this.say(`Congratulations! Your ${oldName} evolved into ${SPECIES[it.to].name}!`, () => { G.audio.sfx('pkEvolved'); G.audio.sfx('pkCry', { p: SPECIES[it.to].cry }); });
          for (const mv of r.learn) this.items.unshift({ type: 'learn', mon: it.mon, move: mv });
        }
        return;
      }
      this.next();
      return;
    }
    // learn prompt
    if (it.phase === 'done') { this.next(); return; }
    const mv = MOVES[it.move];
    if (it.phase === 'ask' || it.phase === 'stop') {
      const d = this.nav();
      if (d) { it.cursor = 1 - it.cursor; G.audio.sfx('ui', { v: 0.4 }); }
      let pick = this.confirm() ? it.cursor : this.cancel() ? 1 : -1;
      if (tap && tap.yes !== undefined) pick = tap.yes;
      if (pick < 0) return;
      if (it.phase === 'ask') { if (pick === 0) { it.phase = 'pick'; it.cursor = 0; } else { it.phase = 'stop'; it.cursor = 0; } }
      else if (pick === 0) { it.phase = 'done'; this.say(`${monName(it.mon)} did not learn ${mv.name}.`); }
      else { it.phase = 'ask'; it.cursor = 0; }
      return;
    }
    if (it.phase === 'pick') {
      const d = this.nav();
      if (d) { it.cursor = (it.cursor + d + 5) % 5; G.audio.sfx('ui', { v: 0.4 }); }
      let pick = this.confirm() ? it.cursor : this.cancel() ? 4 : -1;
      if (tap && tap.forget !== undefined) pick = tap.forget;
      if (pick < 0) return;
      if (pick === 4) { it.phase = 'stop'; it.cursor = 0; return; }
      const old = MOVES[it.mon.moves[pick].id].name;
      learnMove(it.mon, it.move, pick);
      it.phase = 'done';
      this.say('1, 2, and... ... ... Poof!');
      this.say(`${monName(it.mon)} forgot ${old}.`);
      this.say('And...');
      this.say(`${monName(it.mon)} learned ${mv.name}!`, () => G.audio.sfx('pkLevel'));
    }
  }

  text(g, s, x, y, col = '#f8f8f8', size = 10, align = 'left') {
    g.font = `${size}px ${FONT}`; g.textAlign = align;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(s, x + 1, y + 1);
    g.fillStyle = col; g.fillText(s, x, y);
  }
  wrap(g, s, x, y, w, lh) {
    g.font = `10px ${FONT}`;
    let line = '', yy = y;
    for (const wd of s.split(' ')) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w && line) { this.text(g, line, x, yy); line = wd; yy += lh; } else line = t; }
    if (line) this.text(g, line, x, yy);
  }
  box(g, x, y, w, h, fill = '#f8f8f8', edge = '#706880') { g.fillStyle = edge; g.fillRect(x, y, w, h); g.fillStyle = fill; g.fillRect(x + 3, y + 3, w - 6, h - 6); }

  draw(out, cw, ch) {
    const g = this.g;
    this.hits = [];
    g.imageSmoothingEnabled = false;
    const it = this.cur;
    // backdrop: deep blue with rays and sparkles
    const bg = g.createRadialGradient(W / 2, 120, 10, W / 2, 120, 300);
    bg.addColorStop(0, '#2a3a8a'); bg.addColorStop(1, '#070a1e');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const morph = it && it.type === 'evolve' && (it.phase === 'morph' || it.phase === 'flash');
    if (morph) {
      g.save(); g.translate(W / 2, 120);
      for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = `rgba(160,200,255,${0.05 + (i % 2) * 0.05})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(-20, -320); g.lineTo(20, -320); g.fill(); }
      g.restore();
      for (let i = 0; i < 24; i++) { const a = i * 0.7 + this.t * 2, r = 40 + ((this.t * 60 + i * 23) % 140); g.fillStyle = i % 3 ? '#e0f2fe' : '#fde047'; g.fillRect(W / 2 + Math.cos(a) * r, 120 + Math.sin(a) * r * 0.7, 3, 3); }
    }
    // the Pokémon
    if (it && it.type === 'evolve') {
      const size = 168;
      const x = W / 2 - size / 2, y = 120 - size / 2;
      if (it.phase === 'morph') {
        // silhouettes alternate faster and faster
        const k = it.k / 5.2;
        const freq = 1 + k * k * 14;
        const showNew = Math.floor(it.k * freq) % 2 === 1 && k > 0.12;
        const id = showNew ? it.to : it.from;
        const sc = showNew ? 1.05 : 0.95;
        const sil = silhouette(id);
        g.drawImage(sil, W / 2 - size * sc / 2, y + size * (1 - sc), size * sc, size * sc);
        if (k < 0.15) { g.globalAlpha = 1 - k / 0.15; g.drawImage(spriteCanvas(it.from, { shiny: it.mon.shiny }), x, y, size, size); g.globalAlpha = 1; }
      } else if (it.phase === 'flash') {
        g.drawImage(silhouette(it.to), x, y, size, size);
        g.fillStyle = `rgba(255,255,255,${Math.min(1, 1.6 - Math.abs(it.k - 0.3) * 3)})`; g.fillRect(0, 0, W, H);
      } else {
        const id = it.phase === 'after' ? it.to : it.mon.species;
        g.drawImage(spriteCanvas(id, { shiny: it.mon.shiny }), x, y + Math.sin(this.t * 3) * 2, size, size);
      }
    } else if (it && it.type === 'learn') {
      g.drawImage(spriteCanvas(it.mon.species, { shiny: it.mon.shiny }), W / 2 - 64, 40, 128, 128);
    }
    // text box
    g.fillStyle = '#284860'; g.fillRect(0, 240, W, 80);
    g.fillStyle = '#c84040'; g.fillRect(4, 244, W - 8, 72);
    g.fillStyle = '#284860'; g.fillRect(8, 248, W - 16, 64);
    const m = this.msgs[0];
    let msg = m ? m.s.slice(0, Math.floor(m.shown)) : '';
    if (!m && it && it.type === 'learn') {
      const mv = MOVES[it.move];
      msg = it.phase === 'stop' ? `Stop learning ${mv.name}?` : it.phase === 'ask' ? `${monName(it.mon)} wants to learn ${mv.name}. But it can't learn more than four moves. Delete an older move?` : 'Which move should be forgotten?';
    }
    if (!m && it && it.type === 'evolve' && it.phase === 'morph') msg = `${monName(it.mon)} is evolving!  (${G.input.glyph('dash')}: stop)`;
    this.wrap(g, msg, 20, 272, 440, 18);
    if (!m && it && it.type === 'learn') {
      if (it.phase === 'ask' || it.phase === 'stop') {
        this.box(g, 380, 180, 92, 58);
        ['YES', 'NO'].forEach((t, i) => { const cy = 204 + i * 22; this.text(g, t, 406, cy, '#484848'); if (it.cursor === i) this.text(g, '▶', 390, cy, '#484848', 9); this.hits.push({ x: 380, y: cy - 16, w: 92, h: 22, yes: i }); });
      } else if (it.phase === 'pick') {
        const all = [...it.mon.moves.map((x) => x.id), it.move];
        all.forEach((id, i) => {
          const mv = MOVES[id], y = 10 + i * 44;
          this.box(g, 20, y, 300, 38, it.cursor === i ? '#f8e0a0' : i === 4 ? '#e0f0d0' : '#f8f8f8', it.cursor === i ? '#f87030' : '#706880');
          g.fillStyle = TYPES[mv.type].color; g.fillRect(28, y + 11, 50, 16);
          this.text(g, TYPES[mv.type].name.toUpperCase().slice(0, 5), 31, y + 23, '#fff', 7);
          this.text(g, mv.name.toUpperCase(), 86, y + 24, '#383838', 9);
          this.text(g, i === 4 ? 'NEW' : `PP ${it.mon.moves[i].pp}/${it.mon.moves[i].max}`, 312, y + 24, '#383838', 8, 'right');
          this.hits.push({ x: 20, y, w: 300, h: 38, forget: i });
        });
      }
    }
    const s = Math.min(cw / W, ch / H);
    out.imageSmoothingEnabled = false;
    out.fillStyle = '#000'; out.fillRect(0, 0, cw, ch);
    out.drawImage(this.cv, (cw - W * s) / 2, (ch - H * s) / 2, W * s, H * s);
  }
}
