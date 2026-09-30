// UGLY KITCHEN COOK-OFF — an aggressively cheerful cooking minigame with
// unreasonably tight timing windows. Win: relationship restored. Lose: "Pay me."

import { G } from '../state.js';

const W = 960, H = 540;
const ACTION = () => G.input.pressed('jump') || G.input.pressed('melee') || G.input.pressed('interact') || G.input.pressed('phone1');

export class CookOff {
  constructor(onDone) {
    this.onDone = onDone;
    this.stageIdx = -1;
    this.t = 0;
    this.scores = [];
    this.msg = null;
    this.phase = 'intro';
    this.stages = [new Chop(), new Stir(), new Flip(), new Crack(), new Plate()];
    this.host = 'Welcome to the UGLY KITCHEN! Let\'s COOK for ALEX!';
    G.audio.playMusic('cookoff', { restart: true });
  }

  flash(text, color = '#ffffff') { this.msg = { text, color, t: 0.8 }; }

  update(dt) {
    this.t += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (this.phase === 'intro') {
      if (this.t > 2.6 || (this.t > 0.8 && ACTION())) this.next();
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
        this.host = sc >= 0.9 ? 'PERFECT!! Even Ugly Girlfriend is impressed!' : sc >= 0.6 ? 'Not bad! Not good either!' : sc > 0.2 ? 'Hmm. She is making a face.' : 'She has put her head in her hands.';
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
      if (this.t > lines.length * 1.3) {
        this.phase = 'debt';
        this.t = 0;
      }
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
      this.win = avg >= 0.7;
      this.phase = 'result';
      this.t = 0;
      if (this.win) { this.host = 'DELICIOUS?! Ugly Girlfriend: "...okay. I love you."'; G.audio.sfx('win'); } else {
        this.debt = Math.max(10, Math.floor(G.run.money * 0.6));
        this.debtLines = ['Ugly Girlfriend looks at Alex\'s food.', '...', '"Alex."', '"Yeah?"', '"Pay me."'];
        G.audio.sfx('lose');
      }
      return;
    }
    this.phase = 'stage';
    this.stages[this.stageIdx].start(this);
    this.host = this.stages[this.stageIdx].intro;
  }

  pay() {
    const run = G.run;
    const amt = Math.min(run.money, this.debt);
    run.addMoney(-amt, true);
    run.stat('moneyToUglyGirlfriend', amt);
    const d = G.phone.change('ugly', amt >= this.debt ? 1 : 0);
    this.host = amt >= this.debt ? `Alex pays $${amt}. "...Thank you. We\'re okay." (${d > 0 ? '💚 +1' : '· · ·'})` : `Alex pays everything he has ($${amt}). "...It\'s a start."`;
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
    // title
    g.textAlign = 'center';
    g.font = 'bold 44px "Bungee", "Arial Black", sans-serif';
    g.lineWidth = 8; g.strokeStyle = '#7b2cbf'; g.strokeText('UGLY KITCHEN COOK-OFF', W / 2, 80);
    g.fillStyle = '#ffd60a'; g.fillText('UGLY KITCHEN COOK-OFF', W / 2, 80);
    // host (Ugly Girlfriend) face
    drawHost(g, 90, 440, this.win === false && this.phase !== 'stage' ? 'mad' : 'happy', this.t);
    // host line
    g.fillStyle = 'rgba(255,255,255,.92)'; roundRect(g, 170, 400, 760, 90, 18); g.fill();
    g.strokeStyle = '#7b2cbf'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#240046'; g.font = 'bold 22px "M PLUS Rounded 1c", sans-serif'; g.textAlign = 'left';
    wrap(g, this.host, 190, 435, 720, 28);
    // stage
    if (this.phase === 'stage') this.stages[this.stageIdx].draw(g, this);
    // progress pips
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i < this.scores.length ? (this.scores[i] >= 0.7 ? '#3cff8f' : '#ff4d6d') : i === this.stageIdx ? '#ffd60a' : '#ddd';
      g.beginPath(); g.arc(W / 2 - 80 + i * 40, 110, 10, 0, Math.PI * 2); g.fill();
    }
    if (this.phase === 'result' || this.phase === 'after') {
      g.textAlign = 'center';
      g.font = 'bold 56px "Bungee", sans-serif';
      g.fillStyle = this.win ? '#3cff8f' : '#ff4d6d'; g.strokeStyle = '#240046'; g.lineWidth = 8;
      const txt = this.win ? 'DELICIOUS?!' : 'INEDIBLE';
      g.strokeText(txt, W / 2, 250); g.fillText(txt, W / 2, 250);
      g.font = 'bold 26px "M PLUS Rounded 1c", sans-serif'; g.fillStyle = '#240046';
      g.fillText('Score: ' + Math.round(this.total * 100) + '%  (need 70%)', W / 2, 300);
    }
    if (this.phase === 'debt') {
      g.textAlign = 'center';
      g.font = 'bold 30px "Bungee", sans-serif'; g.fillStyle = '#240046';
      g.fillText('"PAY ME."', W / 2, 220);
      g.font = 'bold 24px "M PLUS Rounded 1c", sans-serif';
      g.fillText(`[${G.input.glyph('phone1')}] PAY $${this.debt}        [${G.input.glyph('phone2')}] REFUSE (makes another Cook-Off more likely)`, W / 2, 290);
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
      g.fillText('Relationship on the line. Five dishes. Zero mercy.', W / 2, 220);
      g.fillText(`Controls: [${G.input.glyph('jump')}] action · [${G.input.glyph('left')}]/[${G.input.glyph('right')}] stir & move`, W / 2, 270);
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
function drawHost(g, x, y, mood, t) {
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

// ---------------------------------------------------------------------------
class Chop {
  intro = 'CHOP the cucumber! Hit [action] exactly when the knife crosses each line!';
  start() { this.x = 180; this.speed = 230; this.marks = [300, 390, 470, 560, 640]; this.next = 0; this.hits = 0; this.done = false; this.cuts = []; }
  update(dt, host) {
    this.x += this.speed * dt;
    this.speed += 40 * dt;
    const m = this.marks[this.next];
    if (m === undefined) { if (this.x > 760) this.done = true; return; }
    if (ACTION()) {
      if (Math.abs(this.x - m) <= 11) { this.hits++; this.cuts.push(m); host.flash('CHOP!', '#3cff8f'); G.audio.sfx('chop'); } else { host.flash('MISS', '#ff4d6d'); G.audio.sfx('bad'); }
      this.next++;
    } else if (this.x > m + 11) { this.next++; host.flash('TOO SLOW', '#ff4d6d'); G.audio.sfx('bad'); }
  }
  score() { return this.hits / this.marks.length; }
  draw(g) {
    g.fillStyle = '#d4a373'; g.fillRect(200, 250, 560, 110);
    g.fillStyle = '#6a994e'; roundRect(g, 240, 280, 460, 50, 25); g.fill();
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
  start() { this.meter = 0; this.t = 4.5; this.last = 0; this.done = false; this.ang = 0; }
  update(dt, host) {
    this.t -= dt;
    const x = G.input.move.x;
    const dir = x > 0.5 ? 1 : x < -0.5 ? -1 : 0;
    if (dir && dir !== this.last) { this.meter += 4.2; this.ang += 0.8; if (this.last) G.audio.sfx('sizzle', { v: 0.3, gap: 0.05 }); this.last = dir; }
    this.meter = Math.max(0, this.meter - 8 * dt);
    if (this.meter >= 100) { this.meter = 100; this.done = true; host.flash('SMOOTH!', '#3cff8f'); G.audio.sfx('good'); }
    if (this.t <= 0 && !this.done) { this.done = true; host.flash(this.meter > 60 ? 'LUMPY' : 'RAW', '#ff4d6d'); }
  }
  score() { return this.meter / 100; }
  draw(g) {
    g.fillStyle = '#495057'; g.beginPath(); g.ellipse(480, 300, 150, 50, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a994e'; g.beginPath(); g.ellipse(480, 295, 130, 38, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(480 + Math.cos(this.ang) * 60, 290 + Math.sin(this.ang) * 16); g.rotate(-0.4); g.fillStyle = '#b08968'; g.fillRect(-6, -140, 12, 150); g.restore();
    g.fillStyle = '#ddd'; g.fillRect(300, 190, 360, 20);
    g.fillStyle = this.meter > 70 ? '#3cff8f' : '#ffd60a'; g.fillRect(300, 190, 3.6 * this.meter, 20);
    g.fillStyle = '#240046'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.fillText(Math.max(0, this.t).toFixed(1) + 's', 480, 180);
  }
}
class Flip {
  intro = 'FLIP the meat when the needle is in the GREEN. The green is tiny. Sorry.';
  start() { this.n = 0; this.ok = 0; this.t = 0; this.done = false; this.zone = 0.3 + Math.random() * 0.4; this.w = 0.075; this.air = 0; }
  update(dt, host) {
    this.t += dt;
    this.air = Math.max(0, this.air - dt);
    const needle = (Math.sin(this.t * (4.6 + this.n * 1.2)) + 1) / 2;
    this.needle = needle;
    if (ACTION() && this.air <= 0) {
      if (Math.abs(needle - this.zone) <= this.w / 2) { this.ok++; host.flash('FLIP!', '#3cff8f'); G.audio.sfx('good'); } else { host.flash('BURNT', '#ff4d6d'); G.audio.sfx('bad'); }
      this.n++; this.air = 0.6;
      this.zone = 0.15 + Math.random() * 0.7; this.w *= 0.85;
      if (this.n >= 3) this.done = true;
    }
  }
  score() { return this.ok / 3; }
  draw(g) {
    g.fillStyle = '#212529'; g.beginPath(); g.ellipse(480, 320, 140, 40, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9c6644'; g.beginPath(); g.ellipse(480, 310 - this.air * 150 * Math.sin(this.air * 5), 70, 22, this.air * 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ddd'; g.fillRect(260, 200, 440, 22);
    g.fillStyle = '#3cff8f'; g.fillRect(260 + 440 * (this.zone - this.w / 2), 200, 440 * this.w, 22);
    g.fillStyle = '#e63946'; g.fillRect(260 + 440 * (this.needle || 0) - 3, 192, 6, 38);
  }
}
class Crack {
  intro = 'CRACK the eggs: tap once, then tap AGAIN in a tiny window. Too soon: shell. Too late: splat.';
  start() { this.egg = 0; this.good = 0; this.state = 'wait'; this.t = 0; this.done = false; this.cool = 0.4; }
  update(dt, host) {
    this.t += dt;
    this.cool -= dt;
    if (this.state === 'wait' && this.cool <= 0 && ACTION()) { this.state = 'cracking'; this.t = 0; G.audio.sfx('crack'); return; }
    if (this.state === 'cracking') {
      if (ACTION()) {
        if (this.t >= 0.1 && this.t <= 0.22) { this.good++; host.flash('PERFECT CRACK', '#3cff8f'); G.audio.sfx('good'); } else { host.flash(this.t < 0.1 ? 'SHELL IN IT' : 'SPLAT', '#ff4d6d'); G.audio.sfx('bad'); }
        this.nextEgg();
      } else if (this.t > 0.22) { host.flash('SPLAT', '#ff4d6d'); G.audio.sfx('bad'); this.nextEgg(); }
    }
  }
  nextEgg() { this.egg++; this.state = 'wait'; this.cool = 0.35; if (this.egg >= 3) this.done = true; }
  score() { return this.good / 3; }
  draw(g) {
    for (let i = 0; i < 3; i++) {
      const x = 380 + i * 100;
      g.fillStyle = i < this.egg ? '#ffd166' : '#fff8e7';
      g.beginPath(); g.ellipse(x, 290, 32, 42, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#b08968'; g.lineWidth = 3; g.stroke();
      if (i === this.egg && this.state === 'cracking') { g.strokeStyle = '#6f1d1b'; g.beginPath(); g.moveTo(x - 20, 285); g.lineTo(x - 5, 295); g.lineTo(x + 8, 283); g.lineTo(x + 22, 292); g.stroke(); }
    }
    g.fillStyle = '#240046'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center';
    g.fillText(this.state === 'cracking' ? 'NOW-ISH' : 'tap to start the crack', 480, 200);
  }
}
class Plate {
  intro = 'PLATE IT! Catch the falling food. It gets faster. Of course it does.';
  start() { this.x = 480; this.items = []; this.spawned = 0; this.caught = 0; this.t = 0; this.done = false; }
  update(dt, host) {
    this.t += dt;
    this.x = Math.max(200, Math.min(760, this.x + G.input.move.x * 520 * dt));
    if (this.spawned < 5 && this.t > 0.4 + this.spawned * 0.75) {
      this.items.push({ x: 220 + Math.random() * 520, y: 140, v: 260 + this.spawned * 70, kind: this.spawned });
      this.spawned++;
    }
    for (const it of this.items) {
      if (it.gone) continue;
      it.y += it.v * dt;
      if (it.y > 340 && it.y < 370 && Math.abs(it.x - this.x) < 60) { it.gone = true; this.caught++; host.flash('PLATED', '#3cff8f'); G.audio.sfx('good'); }
      else if (it.y > 400) { it.gone = true; host.flash('ON THE FLOOR', '#ff4d6d'); G.audio.sfx('bad'); }
    }
    if (this.spawned >= 5 && this.items.every((i) => i.gone)) this.done = true;
  }
  score() { return this.caught / 5; }
  draw(g) {
    const icons = ['🍳', '🥕', '🍖', '🥚', '🍓'];
    g.font = '40px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center';
    for (const it of this.items) if (!it.gone) g.fillText(icons[it.kind], it.x, it.y);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(this.x, 360, 64, 14, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4cc9f0'; g.lineWidth = 4; g.stroke();
  }
}
