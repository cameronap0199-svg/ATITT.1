// UGLY KITCHEN COOK-OFF — an aggressively cheerful cooking minigame. Every cook-off
// picks a random dish and four random rounds from a pool of thirteen, each with its
// own randomized timing, targets and ingredients. Win: relationship restored.
// Lose: "Pay me."

import { G } from '../state.js';

const W = 960, H = 540;
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const ACTION = () => G.input.pressed('jump') || G.input.pressed('melee') || G.input.pressed('interact') || G.input.pressed('phone1');
const HELD = () => G.input.isHeld('jump') || G.input.isHeld('melee') || G.input.isHeld('interact') || G.input.isHeld('phone1');
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const ROUNDS = 4;

export const DISHES = [
  { name: 'GREEN SOUP', items: ['🥬', '🥒', '🧄', '🫛', '🥦'] },
  { name: 'KIMCHI STEW', items: ['🥬', '🌶️', '🧄', '🧅', '🍄'] },
  { name: 'TTEOKBOKKI', items: ['🍢', '🌶️', '🧅', '🥚', '🧀'] },
  { name: 'BIBIMBAP', items: ['🍚', '🥕', '🥚', '🥬', '🍄'] },
  { name: 'BIRTHDAY CAKE (FOR NO ONE)', items: ['🍓', '🥚', '🧈', '🍫', '🍒'] },
  { name: 'MYSTERY CASSEROLE', items: ['🧀', '🥫', '🍝', '🌽', '🍗'] },
  { name: 'BREAKFAST AT 2 AM', items: ['🥓', '🍳', '🥞', '🧈', '🍌'] },
  { name: 'SPAGHETTI (UNHOLY)', items: ['🍝', '🍅', '🧄', '🧀', '🌿'] },
];
const GARBAGE = ['🧦', '🪳', '🥾', '🧻', '🔋', '🐟'];

const OPENERS = [
  'Welcome to the UGLY KITCHEN! Tonight\'s dish: %!',
  'It\'s COOK-OFF time! The dish: %. The stakes: your relationship.',
  'Lights! Camera! %! Ugly Girlfriend is watching. She is always watching.',
  'Surprise! You\'re cooking %. Nobody asked. Here we go!',
];
const GOOD = ['PERFECT!! Even Ugly Girlfriend is impressed!', 'She nodded! SHE NODDED!', 'Chef\'s kiss. (She did not kiss you.)', 'Gordon would cry. Happy tears. Probably.'];
const OK = ['Not bad! Not good either!', 'Edible. Technically.', 'She says it\'s "interesting".'];
const MEH = ['Hmm. She is making a face.', 'She is chewing very slowly.', 'The smoke alarm has opinions.'];
const BAD = ['She has put her head in her hands.', 'The cat would not eat this.', 'She is texting someone. About you.'];

export class CookOff {
  constructor(onDone) {
    this.onDone = onDone;
    this.stageIdx = -1;
    this.t = 0;
    this.scores = [];
    this.msg = null;
    this.phase = 'intro';
    this.dish = pick(DISHES);
    const pool = shuffle([Chop, Stir, Flip, Crack, Plate, Season, Whisk, Memory, Grocery, Microwave, Pour, Grill, OrderUp]);
    this.stages = pool.slice(0, ROUNDS).map((C) => new C());
    this.host = pick(OPENERS).replace('%', this.dish.name);
    G.audio.playMusic('cookoff', { restart: true });
  }

  flash(text, color = '#ffffff') { this.msg = { text, color, t: 0.8 }; }

  update(dt) {
    this.t += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (this.phase === 'intro') {
      if (this.t > 3 || (this.t > 0.8 && ACTION())) this.next();
      return;
    }
    if (this.phase === 'stage') {
      const s = this.stages[this.stageIdx];
      s.update(dt, this);
      if (s.done) {
        this.scores.push(Math.max(0, Math.min(1, s.score())));
        this.phase = 'between';
        this.t = 0;
        const sc = this.scores[this.scores.length - 1];
        this.host = pick(sc >= 0.9 ? GOOD : sc >= 0.6 ? OK : sc > 0.2 ? MEH : BAD);
      }
      return;
    }
    if (this.phase === 'between') { if (this.t > 1.4) this.next(); return; }
    if (this.phase === 'result') {
      if (this.win) { if (this.t > 3.2) this.finish(); return; }
      // Losing: long silence → "Alex." "Yeah?" "Pay me."
      const lines = this.debtLines;
      const idx = Math.min(lines.length - 1, Math.floor(this.t / 1.3));
      this.host = lines[idx];
      if (this.t > lines.length * 1.3) { this.phase = 'debt'; this.t = 0; }
      return;
    }
    if (this.phase === 'debt') {
      if (G.input.pressed('phone1') || G.input.pressed('jump')) this.pay();
      else if (G.input.pressed('phone2') || G.input.pressed('dash')) this.refuse();
      return;
    }
    if (this.phase === 'after' && this.t > 2.4) this.finish();
  }

  next() {
    this.stageIdx++;
    this.t = 0;
    if (this.stageIdx >= this.stages.length) {
      const avg = this.scores.reduce((a, b) => a + b, 0) / this.scores.length;
      this.total = avg;
      this.win = avg >= 0.65;
      this.phase = 'result';
      this.t = 0;
      if (this.win) { this.host = `${this.dish.name}?! DELICIOUS?! Ugly Girlfriend: "...okay. I love you."`; G.audio.sfx('win'); } else {
        this.debt = Math.max(10, Math.floor(G.run.money * 0.6));
        this.debtLines = ['Ugly Girlfriend looks at Alex\'s ' + this.dish.name.toLowerCase() + '.', '...', '"Alex."', '"Yeah?"', '"Pay me."'];
        G.audio.sfx('lose');
      }
      return;
    }
    this.phase = 'stage';
    const s = this.stages[this.stageIdx];
    s.dish = this.dish;
    s.done = false;
    s.start(this);
    this.host = typeof s.intro === 'function' ? s.intro(this.dish) : s.intro;
  }

  pay() {
    const run = G.run;
    const amt = Math.min(run.money, this.debt);
    run.addMoney(-amt, true);
    run.stat('moneyToUglyGirlfriend', amt);
    const d = G.phone.change('ugly', amt >= this.debt ? 1 : 0);
    this.host = amt >= this.debt ? `Alex pays $${amt}. "...Thank you. We're okay." (${d > 0 ? '💚 +1' : '· · ·'})` : `Alex pays everything he has ($${amt}). "...It's a start."`;
    G.audio.sfx('buy');
    this.phase = 'after'; this.t = 0;
  }
  refuse() {
    const d = G.phone.change('ugly', -2);
    this.host = `Alex refuses. She writes something in a notebook. (💔 ${d})`;
    G.audio.sfx('heartDown');
    this.phase = 'after'; this.t = 0;
  }
  finish() {
    if (this.done) return;
    this.done = true;
    if (this.win) G.phone.change('ugly', 3);
    G.run.stat(this.win ? 'cookoffsWon' : 'cookoffsLost', 1);
    this.onDone(this.win);
  }

  draw(g, cw, ch) {
    const s = Math.min(cw / W, ch / H);
    g.save();
    g.fillStyle = '#ffd6e8'; g.fillRect(0, 0, cw, ch);
    g.translate((cw - W * s) / 2, (ch - H * s) / 2);
    g.scale(s, s);
    // kitchen backdrop: pastel stripes, tiles, bunting
    for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#ffe5ec' : '#ffc2d1'; g.fillRect(i * 40, 0, 40, H); }
    g.fillStyle = '#fff'; g.fillRect(0, 380, W, 160);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#bde0fe' : '#a2d2ff'; g.fillRect(i * 40, 380 + j * 40, 40, 40); }
    for (let i = 0; i < 16; i++) { g.fillStyle = ['#ff4fa3', '#ffd60a', '#4cc9f0', '#3cff8f'][i % 4]; g.beginPath(); g.moveTo(i * 62, 0); g.lineTo(i * 62 + 31, 34); g.lineTo(i * 62 + 62, 0); g.fill(); }
    // title + dish
    g.textAlign = 'center';
    g.font = 'bold 44px "Bungee", "Arial Black", sans-serif';
    g.lineWidth = 8; g.strokeStyle = '#7b2cbf'; g.strokeText('UGLY KITCHEN COOK-OFF', W / 2, 74);
    g.fillStyle = '#ffd60a'; g.fillText('UGLY KITCHEN COOK-OFF', W / 2, 74);
    g.font = 'bold 18px "M PLUS Rounded 1c", sans-serif'; g.fillStyle = '#7b2cbf';
    g.fillText('TONIGHT: ' + this.dish.name + '  ' + this.dish.items.join(''), W / 2, 98);
    // host (Ugly Girlfriend) face
    drawHost(g, 90, 440, this.win === false && this.phase !== 'stage' ? 'mad' : 'happy', this.t);
    // host line
    g.fillStyle = 'rgba(255,255,255,.92)'; roundRect(g, 170, 400, 760, 90, 18); g.fill();
    g.strokeStyle = '#7b2cbf'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#240046'; g.font = 'bold 22px "M PLUS Rounded 1c", sans-serif'; g.textAlign = 'left';
    wrap(g, this.host, 190, 435, 720, 28);
    // stage
    if (this.phase === 'stage') this.stages[this.stageIdx].draw(g, this);
    // progress pips (one per round)
    const n = this.stages.length;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i < this.scores.length ? (this.scores[i] >= 0.65 ? '#3cff8f' : '#ff4d6d') : i === this.stageIdx ? '#ffd60a' : '#ddd';
      g.beginPath(); g.arc(W / 2 - (n - 1) * 20 + i * 40, 122, 10, 0, Math.PI * 2); g.fill();
    }
    if (this.phase === 'result' || this.phase === 'after') {
      g.textAlign = 'center';
      g.font = 'bold 56px "Bungee", sans-serif';
      g.fillStyle = this.win ? '#3cff8f' : '#ff4d6d'; g.strokeStyle = '#240046'; g.lineWidth = 8;
      const txt = this.win ? 'DELICIOUS?!' : 'INEDIBLE';
      g.strokeText(txt, W / 2, 250); g.fillText(txt, W / 2, 250);
      g.font = 'bold 26px "M PLUS Rounded 1c", sans-serif'; g.fillStyle = '#240046';
      g.fillText('Score: ' + Math.round(this.total * 100) + '%  (need 65%)', W / 2, 300);
    }
    if (this.phase === 'debt') {
      g.textAlign = 'center';
      g.font = 'bold 30px "Bungee", sans-serif'; g.fillStyle = '#240046';
      g.fillText('"PAY ME."', W / 2, 220);
      g.font = 'bold 24px "M PLUS Rounded 1c", sans-serif';
      g.fillText(`[${G.input.glyph('phone1')}] PAY $${this.debt}        [${G.input.glyph('phone2')}] REFUSE (she will remember)`, W / 2, 290);
    }
    if (this.msg) {
      g.textAlign = 'center';
      g.font = 'bold 48px "Bungee", sans-serif';
      g.globalAlpha = Math.min(1, this.msg.t * 3);
      g.strokeStyle = '#240046'; g.lineWidth = 8; g.strokeText(this.msg.text, W / 2, 200);
      g.fillStyle = this.msg.color; g.fillText(this.msg.text, W / 2, 200);
      g.globalAlpha = 1;
    }
    if (this.phase === 'intro') {
      g.textAlign = 'center'; g.font = 'bold 30px "M PLUS Rounded 1c", sans-serif'; g.fillStyle = '#240046';
      g.fillText(`Relationship on the line. ${ROUNDS} random rounds. Zero mercy.`, W / 2, 220);
      g.font = 'bold 24px "M PLUS Rounded 1c", sans-serif';
      g.fillText(`Controls: [${G.input.glyph('jump')}] action (tap or hold) · stick / ${G.input.glyph('left')}${G.input.glyph('up')}${G.input.glyph('right')}${G.input.glyph('down')} move & pick`, W / 2, 268);
      g.font = `52px ${EMOJI}`;
      g.fillText(this.dish.items.join(' '), W / 2, 340);
    }
    g.restore();
  }
}

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = test;
  }
  g.fillText(line, x, yy);
}
function drawHost(g, x, y, mood) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#6f1d1b'; g.beginPath(); g.arc(0, -62, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e0ac69'; g.beginPath(); g.arc(0, -20, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6f1d1b'; g.beginPath(); g.arc(0, -34, 45, Math.PI, 0); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(-30, -28, 22, 16); g.strokeRect(8, -28, 22, 16);
  g.fillStyle = '#222'; g.beginPath(); g.arc(-19, -20, 4, 0, Math.PI * 2); g.arc(19, -20, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  if (mood === 'happy') { g.arc(0, 2, 16, 0, Math.PI); g.fill(); } else { g.fillRect(-12, 6, 24, 4); }
  g.fillStyle = '#fff'; g.fillRect(-40, 22, 80, 40);
  g.fillStyle = '#ff4fa3'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('CHEF', 0, 46);
  g.restore();
}
function label(g, text, x, y, size = 20, color = '#240046') { g.fillStyle = color; g.font = `bold ${size}px "M PLUS Rounded 1c", sans-serif`; g.textAlign = 'center'; g.fillText(text, x, y); }
function bar(g, x, y, w, h, k, color) { g.fillStyle = '#ddd'; g.fillRect(x, y, w, h); g.fillStyle = color; g.fillRect(x, y, w * Math.max(0, Math.min(1, k)), h); }
function emoji(g, e, x, y, size = 40) { g.font = `${size}px ${EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(e, x, y); }
// edge-detected stick direction: 'L' 'R' 'U' 'D' once per push
function dirTap(st) {
  const { x, y } = G.input.move;
  const d = Math.abs(x) > 0.6 ? (x > 0 ? 'R' : 'L') : Math.abs(y) > 0.6 ? (y > 0 ? 'U' : 'D') : null;
  const fresh = d && d !== st._lastDir ? d : null;
  st._lastDir = d;
  return fresh;
}

// =========================================================================== rounds
class Chop {
  intro = (d) => `CHOP the ${d.items[1]}! Hit [action] exactly as the knife crosses each line!`;
  start() {
    const n = irnd(4, 6);
    this.marks = []; let x = rnd(270, 320);
    for (let i = 0; i < n; i++) { this.marks.push(x); x += rnd(60, 95); if (x > 690) break; }
    this.x = 170; this.speed = rnd(200, 250); this.accel = rnd(25, 55); this.win = rnd(10, 14);
    this.next = 0; this.hits = 0; this.cuts = [];
  }
  update(dt, host) {
    this.x += this.speed * dt;
    this.speed += this.accel * dt;
    const m = this.marks[this.next];
    if (m === undefined) { if (this.x > 760) this.done = true; return; }
    if (ACTION()) {
      if (Math.abs(this.x - m) <= this.win) { this.hits++; this.cuts.push(m); host.flash('CHOP!', '#3cff8f'); G.audio.sfx('chop'); } else { host.flash('MISS', '#ff4d6d'); G.audio.sfx('bad'); }
      this.next++;
    } else if (this.x > m + this.win) { this.next++; host.flash('TOO SLOW', '#ff4d6d'); G.audio.sfx('bad'); }
  }
  score() { return this.hits / this.marks.length; }
  draw(g) {
    g.fillStyle = '#d4a373'; g.fillRect(200, 250, 560, 110);
    g.fillStyle = '#6a994e'; roundRect(g, 240, 280, 460, 50, 25); g.fill();
    emoji(g, this.dish.items[1], 470, 318, 34);
    g.fillStyle = '#a7c957'; for (const c of this.cuts) g.fillRect(c - 3, 280, 6, 50);
    g.setLineDash([6, 6]); g.strokeStyle = '#240046'; g.lineWidth = 3;
    this.marks.forEach((m, i) => { if (i >= this.next) { g.beginPath(); g.moveTo(m, 262); g.lineTo(m, 348); g.stroke(); } });
    g.setLineDash([]);
    g.fillStyle = '#adb5bd'; g.beginPath(); g.moveTo(this.x - 6, 170); g.lineTo(this.x + 6, 170); g.lineTo(this.x + 4, 280); g.lineTo(this.x - 4, 280); g.fill();
    g.fillStyle = '#3d2b1f'; g.fillRect(this.x - 8, 140, 16, 34);
  }
}

class Stir {
  intro = 'STIR! Alternate LEFT and RIGHT as fast as humanly possible!';
  start() { this.meter = 0; this.time = rnd(4, 5.5); this.t = this.time; this.gain = rnd(3.8, 4.6); this.decay = rnd(6, 10); this.last = 0; this.ang = 0; }
  update(dt, host) {
    this.t -= dt;
    const x = G.input.move.x;
    const dir = x > 0.5 ? 1 : x < -0.5 ? -1 : 0;
    if (dir && dir !== this.last) { this.meter += this.gain; this.ang += 0.8; if (this.last) G.audio.sfx('sizzle', { v: 0.3, gap: 0.05 }); this.last = dir; }
    this.meter = Math.max(0, this.meter - this.decay * dt);
    if (this.meter >= 100) { this.meter = 100; this.done = true; host.flash('SMOOTH!', '#3cff8f'); G.audio.sfx('good'); }
    if (this.t <= 0 && !this.done) { this.done = true; host.flash(this.meter > 60 ? 'LUMPY' : 'RAW', '#ff4d6d'); }
  }
  score() { return this.meter / 100; }
  draw(g) {
    g.fillStyle = '#495057'; g.beginPath(); g.ellipse(480, 300, 150, 50, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a994e'; g.beginPath(); g.ellipse(480, 295, 130, 38, 0, 0, Math.PI * 2); g.fill();
    emoji(g, this.dish.items[0], 440 + Math.cos(this.ang) * 40, 305, 26); emoji(g, this.dish.items[2], 520 - Math.cos(this.ang) * 40, 300, 26);
    g.save(); g.translate(480 + Math.cos(this.ang) * 60, 290 + Math.sin(this.ang) * 16); g.rotate(-0.4); g.fillStyle = '#b08968'; g.fillRect(-6, -140, 12, 150); g.restore();
    bar(g, 300, 190, 360, 20, this.meter / 100, this.meter > 70 ? '#3cff8f' : '#ffd60a');
    label(g, Math.max(0, this.t).toFixed(1) + 's', 480, 180);
  }
}

class Flip {
  intro = 'FLIP it when the needle is in the GREEN. The green gets smaller. Sorry.';
  start() { this.n = 0; this.ok = 0; this.t = 0; this.zone = rnd(0.3, 0.7); this.w = rnd(0.07, 0.1); this.air = 0; this.speed = rnd(4, 5.2); this.total = 3; }
  update(dt, host) {
    this.t += dt;
    this.air = Math.max(0, this.air - dt);
    this.needle = (Math.sin(this.t * (this.speed + this.n * 1.1)) + 1) / 2;
    if (ACTION() && this.air <= 0) {
      if (Math.abs(this.needle - this.zone) <= this.w / 2) { this.ok++; host.flash('FLIP!', '#3cff8f'); G.audio.sfx('good'); } else { host.flash('BURNT', '#ff4d6d'); G.audio.sfx('bad'); }
      this.n++; this.air = 0.6;
      this.zone = rnd(0.15, 0.85); this.w *= 0.88;
      if (this.n >= this.total) this.done = true;
    }
  }
  score() { return this.ok / this.total; }
  draw(g) {
    g.fillStyle = '#212529'; g.beginPath(); g.ellipse(480, 320, 140, 40, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9c6644'; g.beginPath(); g.ellipse(480, 310 - this.air * 150 * Math.sin(this.air * 5), 70, 22, this.air * 8, 0, Math.PI * 2); g.fill();
    bar(g, 260, 200, 440, 22, 0, '#ddd');
    g.fillStyle = '#3cff8f'; g.fillRect(260 + 440 * (this.zone - this.w / 2), 200, 440 * this.w, 22);
    g.fillStyle = '#e63946'; g.fillRect(260 + 440 * (this.needle || 0) - 3, 192, 6, 38);
  }
}

class Crack {
  intro = 'CRACK the eggs: tap once, then tap AGAIN in a tiny window. Too soon: shell. Too late: splat.';
  start() { this.total = irnd(3, 4); this.egg = 0; this.good = 0; this.state = 'wait'; this.t = 0; this.cool = 0.4; this.lo = rnd(0.08, 0.14); this.hi = this.lo + rnd(0.11, 0.15); }
  update(dt, host) {
    this.t += dt;
    this.cool -= dt;
    if (this.state === 'wait' && this.cool <= 0 && ACTION()) { this.state = 'cracking'; this.t = 0; G.audio.sfx('crack'); return; }
    if (this.state === 'cracking') {
      if (ACTION()) {
        if (this.t >= this.lo && this.t <= this.hi) { this.good++; host.flash('PERFECT CRACK', '#3cff8f'); G.audio.sfx('good'); } else { host.flash(this.t < this.lo ? 'SHELL IN IT' : 'SPLAT', '#ff4d6d'); G.audio.sfx('bad'); }
        this.nextEgg();
      } else if (this.t > this.hi) { host.flash('SPLAT', '#ff4d6d'); G.audio.sfx('bad'); this.nextEgg(); }
    }
  }
  nextEgg() { this.egg++; this.state = 'wait'; this.cool = 0.35; if (this.egg >= this.total) this.done = true; }
  score() { return this.good / this.total; }
  draw(g) {
    const x0 = 480 - (this.total - 1) * 50;
    for (let i = 0; i < this.total; i++) {
      const x = x0 + i * 100;
      g.fillStyle = i < this.egg ? '#ffd166' : '#fff8e7';
      g.beginPath(); g.ellipse(x, 290, 32, 42, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#b08968'; g.lineWidth = 3; g.stroke();
      if (i === this.egg && this.state === 'cracking') { g.strokeStyle = '#6f1d1b'; g.beginPath(); g.moveTo(x - 20, 285); g.lineTo(x - 5, 295); g.lineTo(x + 8, 283); g.lineTo(x + 22, 292); g.stroke(); }
    }
    label(g, this.state === 'cracking' ? 'NOW-ISH' : 'tap to start the crack', 480, 200);
  }
}

class Plate {
  intro = 'PLATE IT! Catch the falling food with the plate. It gets faster. Of course it does.';
  start() { this.x = 480; this.items = []; this.spawned = 0; this.caught = 0; this.t = 0; this.total = irnd(5, 6); this.base = rnd(230, 280); this.gap = rnd(0.6, 0.8); }
  update(dt, host) {
    this.t += dt;
    this.x = Math.max(200, Math.min(760, this.x + G.input.move.x * 520 * dt));
    if (this.spawned < this.total && this.t > 0.4 + this.spawned * this.gap) {
      this.items.push({ x: rnd(220, 740), y: 140, v: this.base + this.spawned * 65, e: this.dish.items[this.spawned % this.dish.items.length] });
      this.spawned++;
    }
    for (const it of this.items) {
      if (it.gone) continue;
      it.y += it.v * dt;
      if (it.y > 340 && it.y < 370 && Math.abs(it.x - this.x) < 60) { it.gone = true; this.caught++; host.flash('PLATED', '#3cff8f'); G.audio.sfx('good'); }
      else if (it.y > 400) { it.gone = true; host.flash('ON THE FLOOR', '#ff4d6d'); G.audio.sfx('bad'); }
    }
    if (this.spawned >= this.total && this.items.every((i) => i.gone)) this.done = true;
  }
  score() { return this.caught / this.total; }
  draw(g) {
    for (const it of this.items) if (!it.gone) emoji(g, it.e, it.x, it.y, 40);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(this.x, 360, 64, 14, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4cc9f0'; g.lineWidth = 4; g.stroke();
  }
}

class Season {
  intro = 'SEASON IT! HOLD [action] to shake the salt, let go inside the green. Over-salt and it\'s ruined.';
  start() { this.round = 0; this.rounds = 2; this.res = []; this.newRound(); }
  newRound() { this.k = 0; this.holding = false; this.lo = rnd(0.45, 0.75); this.hi = this.lo + rnd(0.1, 0.15); this.rate = rnd(0.32, 0.5); this.cool = 0.5; }
  update(dt, host) {
    this.cool -= dt;
    if (this.cool > 0) return;
    const h = HELD();
    if (h) { this.holding = true; this.k += this.rate * dt * (1 + this.k); if (Math.random() < dt * 20) G.audio.sfx('scratch', { v: 0.3, gap: 0.04 }); }
    if (this.k >= 1) { this.res.push(0); host.flash('TOO SALTY', '#ff4d6d'); G.audio.sfx('bad'); return this.after(); }
    if (this.holding && !h) {
      const inZone = this.k >= this.lo && this.k <= this.hi;
      const d = inZone ? 0 : Math.min(Math.abs(this.k - this.lo), Math.abs(this.k - this.hi));
      const s = inZone ? 1 : Math.max(0, 1 - d * 5);
      this.res.push(s);
      host.flash(inZone ? 'PERFECTLY SEASONED' : this.k < this.lo ? 'BLAND' : 'SALTY', inZone ? '#3cff8f' : '#ff4d6d');
      G.audio.sfx(inZone ? 'good' : 'bad');
      this.after();
    }
  }
  after() { this.round++; if (this.round >= this.rounds) this.done = true; else this.newRound(); }
  score() { return this.res.reduce((a, b) => a + b, 0) / this.rounds; }
  draw(g) {
    g.fillStyle = '#495057'; g.beginPath(); g.ellipse(480, 330, 140, 40, 0, 0, Math.PI * 2); g.fill();
    emoji(g, this.dish.items[0], 480, 342, 40);
    g.save(); g.translate(480, 230); g.rotate(this.holding && HELD() ? Math.sin(performance.now() * 0.04) * 0.4 : 0.2); emoji(g, '🧂', 0, 0, 56); g.restore();
    bar(g, 300, 160, 360, 22, 0, '#ddd');
    g.fillStyle = '#3cff8f'; g.fillRect(300 + 360 * this.lo, 160, 360 * (this.hi - this.lo), 22);
    g.fillStyle = '#e63946'; g.fillRect(300, 166, 360 * Math.min(1, this.k), 10);
    label(g, `Round ${this.round + 1} / ${this.rounds}`, 480, 150, 16);
  }
}

class Whisk {
  intro = 'WHISK! Alternate UP and DOWN until it\'s fluffy. Your arm will hurt. Hers did.';
  start() { this.meter = 0; this.time = rnd(4, 5); this.t = this.time; this.gain = rnd(4.2, 5); this.decay = rnd(7, 11); this.last = 0; this.ph = 0; }
  update(dt, host) {
    this.t -= dt;
    const y = G.input.move.y;
    const dir = y > 0.5 ? 1 : y < -0.5 ? -1 : 0;
    if (dir && dir !== this.last) { this.meter += this.gain; this.ph += 1; if (this.last) G.audio.sfx('blip', { gap: 0.04 }); this.last = dir; }
    this.meter = Math.max(0, this.meter - this.decay * dt);
    if (this.meter >= 100) { this.meter = 100; this.done = true; host.flash('FLUFFY!', '#3cff8f'); G.audio.sfx('good'); }
    if (this.t <= 0 && !this.done) { this.done = true; host.flash('SOUP', '#ff4d6d'); }
  }
  score() { return this.meter / 100; }
  draw(g) {
    g.fillStyle = '#e9ecef'; g.beginPath(); g.ellipse(480, 320, 120, 50, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#fff8e7'; g.beginPath(); g.ellipse(480, 310, 110, 20 + this.meter * 0.25, 0, Math.PI, 0); g.fill();
    g.save(); g.translate(480, 260 + (this.ph % 2 ? 18 : -10)); g.rotate(0.3); g.strokeStyle = '#adb5bd'; g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * 4, 30, 12, 34, 0, 0, Math.PI * 2); g.stroke(); } g.fillStyle = '#b08968'; g.fillRect(-6, -70, 12, 70); g.restore();
    bar(g, 300, 160, 360, 20, this.meter / 100, this.meter > 70 ? '#3cff8f' : '#ffd60a');
    label(g, Math.max(0, this.t).toFixed(1) + 's', 480, 150);
  }
}

class Memory {
  intro = 'SECRET RECIPE! Watch her add the ingredients, then repeat the order with the stick / arrows.';
  start() {
    const n = irnd(3, 5);
    const dirs = ['L', 'R', 'U', 'D'];
    this.map = {};
    shuffle(this.dish.items.slice()).slice(0, 4).forEach((e, i) => { this.map[dirs[i]] = e; });
    this.seq = Array.from({ length: n }, () => pick(dirs));
    this.mode = 'show'; this.t = 0; this.pos = 0; this.right = 0; this.input = [];
    this.step = rnd(0.6, 0.85);
  }
  update(dt, host) {
    this.t += dt;
    if (this.mode === 'show') {
      if (this.t > this.seq.length * this.step + 0.4) { this.mode = 'input'; this.t = 0; host.host = 'Your turn! Same order. No pressure. (Pressure.)'; }
      return;
    }
    const d = dirTap(this);
    if (d) {
      const ok = d === this.seq[this.pos];
      if (ok) { this.right++; G.audio.sfx('good'); } else { host.flash('WRONG', '#ff4d6d'); G.audio.sfx('bad'); }
      this.input.push(d);
      this.pos++;
      if (this.pos >= this.seq.length) { this.done = true; if (this.right === this.seq.length) host.flash('SHE\'S SHOOK', '#3cff8f'); }
    }
    if (this.t > 3 + this.seq.length * 1.2 && !this.done) { this.done = true; host.flash('TIME', '#ff4d6d'); }
  }
  score() { return this.right / this.seq.length; }
  draw(g) {
    const arrows = { L: '←', R: '→', U: '↑', D: '↓' };
    // legend
    let i = 0;
    for (const [d, e] of Object.entries(this.map)) { emoji(g, e, 300 + i * 120, 330, 34); label(g, arrows[d], 300 + i * 120, 365, 22); i++; }
    if (this.mode === 'show') {
      const k = Math.floor(this.t / this.step);
      const cur = this.seq[k];
      if (cur && (this.t % this.step) < this.step * 0.75) { emoji(g, this.map[cur], 480, 260, 80); label(g, `${k + 1} / ${this.seq.length}`, 480, 180); }
    } else {
      label(g, 'Repeat: ' + this.input.map((d) => arrows[d]).join(' ') + ' _'.repeat(this.seq.length - this.input.length), 480, 240, 28);
    }
  }
}

class Grocery {
  intro = (d) => `GROCERY RUN! Catch the ${d.name.toLowerCase()} ingredients. DON'T catch the garbage.`;
  start() {
    this.x = 480; this.items = []; this.t = 0; this.good = 0; this.bad = 0;
    const n = irnd(8, 10);
    this.queue = shuffle(Array.from({ length: n }, (_, i) => (i < Math.ceil(n * 0.65) ? { e: pick(this.dish.items), good: true } : { e: pick(GARBAGE), good: false })));
    this.goodTotal = this.queue.filter((q) => q.good).length;
    this.gap = rnd(0.45, 0.6); this.speed = rnd(240, 300);
  }
  update(dt, host) {
    this.t += dt;
    this.x = Math.max(200, Math.min(760, this.x + G.input.move.x * 560 * dt));
    if (this.queue.length && this.t > this.items.length * this.gap + 0.3) { const q = this.queue.shift(); this.items.push({ ...q, x: rnd(220, 740), y: 130, v: this.speed + this.items.length * 12 }); }
    for (const it of this.items) {
      if (it.gone) continue;
      it.y += it.v * dt;
      if (it.y > 335 && it.y < 368 && Math.abs(it.x - this.x) < 62) {
        it.gone = true;
        if (it.good) { this.good++; G.audio.sfx('good'); } else { this.bad++; host.flash('EW', '#ff4d6d'); G.audio.sfx('bad'); }
      } else if (it.y > 400) it.gone = true;
    }
    if (!this.queue.length && this.items.every((i) => i.gone)) this.done = true;
  }
  score() { return Math.max(0, (this.good - this.bad) / this.goodTotal); }
  draw(g) {
    for (const it of this.items) if (!it.gone) emoji(g, it.e, it.x, it.y, 40);
    emoji(g, '🧺', this.x, 372, 64);
  }
}

class Microwave {
  intro = 'MICROWAVE! Press [action] to stop it EXACTLY on the target time. Two tries.';
  start() { this.tries = 0; this.res = []; this.newTry(); }
  newTry() { this.timeLeft = irnd(25, 45); this.target = irnd(4, 15); this.rate = rnd(7, 11); this.cool = 0.5; this.stopped = false; }
  update(dt, host) {
    this.cool -= dt;
    if (this.stopped) { if (this.cool <= 0) { this.tries++; if (this.tries >= 2) this.done = true; else this.newTry(); } return; }
    this.timeLeft -= this.rate * dt;
    G.audio.sfx('blip', { v: 0.1, gap: 0.25, p: 0.6 });
    if ((this.cool <= 0 && ACTION()) || this.timeLeft <= 0) {
      const diff = Math.abs(Math.max(0, this.timeLeft) - this.target);
      const s = Math.max(0, 1 - diff / 4);
      this.res.push(s);
      host.flash(diff < 0.6 ? 'DING! PERFECT' : this.timeLeft <= 0 ? 'EXPLODED' : diff < 2 ? 'CLOSE ENOUGH' : 'COLD IN THE MIDDLE', diff < 2 ? '#3cff8f' : '#ff4d6d');
      G.audio.sfx(diff < 2 ? 'good' : 'bad');
      this.stopped = true; this.cool = 0.9;
    }
  }
  score() { return this.res.reduce((a, b) => a + b, 0) / 2; }
  draw(g) {
    g.fillStyle = '#e9ecef'; roundRect(g, 300, 180, 360, 200, 16); g.fill();
    g.fillStyle = '#343a40'; roundRect(g, 320, 200, 220, 160, 10); g.fill();
    g.save(); g.translate(430, 300); g.rotate(performance.now() * 0.003 * (this.stopped ? 0 : 1)); emoji(g, this.dish.items[0], 0, 14, 48); g.restore();
    g.fillStyle = '#111'; g.fillRect(552, 210, 96, 40);
    const t = Math.max(0, this.timeLeft);
    g.fillStyle = '#3cff8f'; g.font = 'bold 26px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillText('0:' + String(Math.floor(t)).padStart(2, '0'), 600, 242);
    label(g, 'STOP AT 0:' + String(this.target).padStart(2, '0'), 480, 165, 22);
    label(g, `Try ${Math.min(2, this.tries + 1)} / 2`, 600, 290, 16);
  }
}

class Pour {
  intro = 'POUR the sauce! HOLD [action] to pour, let go when it reaches the line. It speeds up.';
  start() { this.cup = 0; this.cups = 3; this.res = []; this.newCup(); }
  newCup() { this.k = 0; this.line = rnd(0.55, 0.85); this.rate = rnd(0.25, 0.4); this.started = false; this.cool = 0.4; }
  update(dt, host) {
    this.cool -= dt;
    if (this.cool > 0) return;
    const h = HELD();
    if (h) { this.started = true; this.k += this.rate * dt * (1 + this.k * 1.5); }
    const end = (s, txt, good) => { this.res.push(s); host.flash(txt, good ? '#3cff8f' : '#ff4d6d'); G.audio.sfx(good ? 'good' : 'bad'); this.cup++; if (this.cup >= this.cups) this.done = true; else this.newCup(); };
    if (this.k >= 1) return end(0, 'OVERFLOW', false);
    if (this.started && !h) { const d = Math.abs(this.k - this.line); end(Math.max(0, 1 - d * 6), d < 0.04 ? 'PERFECT POUR' : d < 0.1 ? 'NICE' : 'MESSY', d < 0.1); }
  }
  score() { return this.res.reduce((a, b) => a + b, 0) / this.cups; }
  draw(g) {
    const x = 430, y = 200, w = 100, h = 160;
    g.strokeStyle = '#240046'; g.lineWidth = 4; g.strokeRect(x, y, w, h);
    g.fillStyle = '#c1121f'; g.fillRect(x + 2, y + h * (1 - Math.min(1, this.k)), w - 4, h * Math.min(1, this.k) - 2);
    g.setLineDash([8, 6]); g.strokeStyle = '#3cff8f'; g.beginPath(); g.moveTo(x - 20, y + h * (1 - this.line)); g.lineTo(x + w + 20, y + h * (1 - this.line)); g.stroke(); g.setLineDash([]);
    if (HELD() && this.cool <= 0) { g.fillStyle = '#c1121f'; g.fillRect(x + w / 2 - 4, 186, 8, y - 186 + h * (1 - Math.min(1, this.k))); }
    emoji(g, '🫙', x + w / 2 + 34, 196, 40);
    label(g, `Cup ${Math.min(this.cups, this.cup + 1)} / ${this.cups}`, 640, 300, 18);
  }
}

class Grill {
  intro = 'GRILL! TAP [action] to stoke the fire and keep the needle inside the moving green band.';
  start() { this.temp = 0.3; this.time = rnd(5, 6.5); this.t = 0; this.inside = 0; this.drift = rnd(0.25, 0.4); this.bump = rnd(0.1, 0.14); this.ph = Math.random() * 6; this.w = rnd(0.16, 0.22); }
  band() { const c = 0.5 + Math.sin(this.t * 0.9 + this.ph) * 0.25; return [c - this.w / 2, c + this.w / 2]; }
  update(dt, host) {
    this.t += dt;
    if (ACTION()) { this.temp += this.bump; G.audio.sfx('sizzle', { v: 0.25, gap: 0.05 }); }
    this.temp = Math.max(0, Math.min(1, this.temp - this.drift * dt));
    const [lo, hi] = this.band();
    if (this.temp >= lo && this.temp <= hi) this.inside += dt;
    if (this.t >= this.time) { this.done = true; host.flash(this.score() > 0.7 ? 'SEARED' : 'RAW / BURNT', this.score() > 0.7 ? '#3cff8f' : '#ff4d6d'); }
  }
  score() { return Math.min(1, (this.inside / this.time) * 1.25); }
  draw(g) {
    g.fillStyle = '#343a40'; g.fillRect(320, 300, 320, 60);
    for (let i = 0; i < 7; i++) { g.fillStyle = '#adb5bd'; g.fillRect(330 + i * 45, 290, 6, 18); }
    emoji(g, this.dish.items[0], 420, 300, 40); emoji(g, this.dish.items[1], 540, 300, 40);
    const [lo, hi] = this.band();
    g.fillStyle = '#ddd'; g.fillRect(700, 150, 26, 220);
    g.fillStyle = '#3cff8f'; g.fillRect(700, 150 + 220 * (1 - hi), 26, 220 * (hi - lo));
    g.fillStyle = '#e63946'; g.fillRect(694, 150 + 220 * (1 - this.temp) - 3, 38, 6);
    label(g, Math.max(0, this.time - this.t).toFixed(1) + 's', 480, 200);
  }
}

class OrderUp {
  intro = (d) => `ORDER UP! Which one goes in the ${d.name.toLowerCase()}? Pick with LEFT/RIGHT + [action] (or 1 2 3).`;
  start() {
    this.q = 0; this.total = 4; this.right = 0; this.newQ();
  }
  newQ() {
    const others = [...new Set(DISHES.flatMap((d) => d.items).concat(GARBAGE))].filter((e) => !this.dish.items.includes(e));
    this.answer = pick(this.dish.items);
    this.opts = shuffle([this.answer, ...shuffle(others.slice()).slice(0, 2)]);
    this.sel = 1; this.t = 0; this.limit = rnd(3, 4); this._lastDir = 'X';
  }
  update(dt, host) {
    this.t += dt;
    const d = dirTap(this);
    if (d === 'L') this.sel = Math.max(0, this.sel - 1);
    if (d === 'R') this.sel = Math.min(2, this.sel + 1);
    let choice = -1;
    for (let i = 0; i < 3; i++) if (G.input.pressed('phone' + (i + 1))) choice = i;
    if (choice < 0 && (G.input.pressed('jump') || G.input.pressed('melee') || G.input.pressed('interact'))) choice = this.sel;
    if (choice >= 0 || this.t > this.limit) {
      const ok = choice >= 0 && this.opts[choice] === this.answer;
      if (ok) { this.right++; G.audio.sfx('good'); host.flash('YES CHEF', '#3cff8f'); } else { G.audio.sfx('bad'); host.flash(choice < 0 ? 'TOO SLOW' : 'NO CHEF', '#ff4d6d'); }
      this.q++;
      if (this.q >= this.total) this.done = true; else this.newQ();
    }
  }
  score() { return this.right / this.total; }
  draw(g) {
    label(g, `${this.q + 1} / ${this.total}`, 480, 170);
    for (let i = 0; i < 3; i++) {
      const x = 340 + i * 140;
      g.fillStyle = i === this.sel ? '#ffd60a' : '#ffffff'; roundRect(g, x - 55, 210, 110, 110, 18); g.fill();
      g.strokeStyle = '#7b2cbf'; g.lineWidth = i === this.sel ? 6 : 3; g.stroke();
      emoji(g, this.opts[i], x, 290, 60);
      label(g, String(i + 1), x, 345, 18);
    }
    bar(g, 300, 362, 360, 8, 1 - this.t / this.limit, '#ff4fa3');
  }
}
