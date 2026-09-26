// [GATEWAY] rooms: the Jammed Bulkhead QTE and the Dance Soldier duel (Friday Night
// Funkin' by way of a G.O.D. neural calibration).

import { W, H, BULKHEAD_CURSES, DANCE_ROUNDS } from './data.js';
import { Chart, randomSteps, dirForCode, DIRS } from './ddr.js';
import { drawTrack, LANE_COLORS } from './ddrView.js';
import { drawDancer } from './figures.js';
import { text, FONT, COLORS, clamp, roundRect, arrowPath, scanlines, hash, vignette } from './render.js';
import { sfx, playMusic, stopMusic, speak } from './audio.js';

// ---------------------------------------------------------------------------
// Jammed Bulkhead: 5 random arrows in 1.5 seconds. Fail, regenerate, repeat.
// ---------------------------------------------------------------------------
export class BulkheadQTE {
  constructor(game) {
    this.game = game;
    this.rng = game.rng;
    this.attempts = 0;
    this.state = 'ready';
    this.t0 = game.time;
    this.limit = 1.5 * (1 + game.stats().window);
    this.curse = null;
    this.newSeq();
  }
  newSeq() {
    this.seq = randomSteps(this.rng, 5).map((s) => s[0]);
    this.idx = 0;
  }
  start(t) { this.state = 'input'; this.tStart = t; }
  fail(t) {
    this.attempts++;
    this.state = 'fail';
    this.failT = t;
    sfx('ddrMiss');
    this.game.run.combo.snap();
    this.curse = this.rng.pick(BULKHEAD_CURSES);
    speak(this.curse, { pitch: 0.8 });
  }
  onKey(code, time) {
    const dir = dirForCode(code);
    if (!dir || this.state !== 'input') return;
    if (dir === this.seq[this.idx]) {
      this.idx++;
      sfx('ddrHit');
      this.game.run.combo.hit();
      if (this.idx >= this.seq.length) {
        this.state = 'open';
        this.openT = time;
        sfx('door');
      }
    } else this.fail(time);
  }
  onClick() {}
  update(dt, t) {
    this.t = t;
    this.game.ekg.update(dt, this.game.vitals());
    this.game.eeg.update(dt, this.game.run.psyche.load);
    if (this.state === 'ready' && t - this.t0 > 1.3) this.start(t);
    if (this.state === 'input' && t - this.tStart > this.limit) this.fail(t);
    if (this.state === 'fail' && t - this.failT > 1.1) { this.newSeq(); this.start(t); }
    if (this.state === 'open' && t - this.openT > 1.8) {
      this.state = 'done';
      this.game.roomComplete({ kind: 'bulkhead', attempts: this.attempts });
    }
  }
  draw(ctx, t) {
    // Bulkhead door
    ctx.fillStyle = '#07090a';
    ctx.fillRect(0, 0, W, H);
    const open = this.state === 'open' || this.state === 'done' ? clamp((t - this.openT) / 1.4, 0, 1) : 0;
    const shake = this.state === 'fail' && t - this.failT < 0.3 ? (Math.random() - 0.5) * 14 : 0;
    ctx.save();
    ctx.translate(shake, 0);
    for (const side of [-1, 1]) {
      ctx.save();
      const x = side < 0 ? 140 - open * 420 : 640 + open * 420;
      const g = ctx.createLinearGradient(x, 0, x + 500, 0);
      g.addColorStop(0, '#2a2e33'); g.addColorStop(1, '#3a3f45');
      ctx.fillStyle = g;
      ctx.fillRect(x, 60, 500, 600);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, 60, 500, 600); ctx.clip();
      for (let k = -10; k < 20; k++) {
        ctx.fillStyle = k % 2 ? '#111' : '#d9a400';
        ctx.beginPath();
        const bx = x + k * 50;
        ctx.moveTo(bx, 600); ctx.lineTo(bx + 25, 600); ctx.lineTo(bx + 85, 660); ctx.lineTo(bx + 60, 660); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = '#15181b';
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 20, 80, 460, 500);
      for (let r = 0; r < 6; r++) { ctx.fillStyle = '#555c63'; ctx.beginPath(); ctx.arc(x + 40 + r * 84, 100, 8, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, side < 0 ? 'HADES' : 'SEC-7', x + 250, 360, { size: 90, font: FONT.title, color: 'rgba(0,0,0,0.35)', align: 'center' });
      ctx.restore();
    }
    ctx.restore();
    if (open > 0.6) text(ctx, 'ACCESS GRANTED', W / 2, H / 2, { size: 56, font: FONT.title, color: COLORS.phosphor, align: 'center', glow: 20 });
    if (this.state === 'open' || this.state === 'done') { this.drawHud(ctx, t); return; }
    // Terminal overlay
    ctx.save();
    ctx.fillStyle = 'rgba(2,10,4,0.92)';
    roundRect(ctx, W / 2 - 360, 170, 720, 330, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.phosphor;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, '[GATEWAY] // JAMMED BULKHEAD — MANUAL OVERRIDE', W / 2, 206, { size: 26, color: COLORS.phosphor, align: 'center', glow: 8 });
    text(ctx, `ATTEMPT ${this.attempts + 1}`, W / 2 + 340, 236, { size: 18, color: 'rgba(57,255,106,0.6)', align: 'right' });
    this.seq.forEach((d, i) => {
      const x = W / 2 - 240 + i * 120, y = 320;
      ctx.save();
      ctx.translate(x, y);
      const done = i < this.idx;
      const cur = i === this.idx && this.state === 'input';
      ctx.fillStyle = done ? COLORS.phosphor : this.state === 'fail' && i === this.idx ? '#ff3a3a' : 'rgba(57,255,106,0.12)';
      ctx.shadowColor = COLORS.phosphor;
      ctx.shadowBlur = cur ? 20 : 0;
      arrowPath(ctx, d, 70);
      ctx.fill();
      ctx.strokeStyle = cur ? '#fff' : COLORS.phosphor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    });
    if (this.state === 'ready') text(ctx, 'READY…', W / 2, 440, { size: 32, color: '#fff', align: 'center', alpha: 0.6 + 0.4 * Math.sin(t * 10) });
    if (this.state === 'input') {
      const p = clamp((t - this.tStart) / this.limit, 0, 1);
      ctx.fillStyle = 'rgba(57,255,106,0.15)';
      ctx.fillRect(W / 2 - 300, 420, 600, 18);
      ctx.fillStyle = p > 0.7 ? '#ff3a3a' : COLORS.phosphor;
      ctx.fillRect(W / 2 - 300, 420, 600 * (1 - p), 18);
      text(ctx, `${Math.max(0, this.limit - (t - this.tStart)).toFixed(2)}s`, W / 2, 470, { size: 26, color: '#fff', align: 'center' });
    }
    if (this.state === 'fail') {
      text(ctx, 'FAILURE — REGENERATING SEQUENCE', W / 2, 440, { size: 26, color: '#ff3a3a', align: 'center', glow: 10 });
      text(ctx, `SUBJECT 87: "${this.curse}"`, W / 2, 478, { size: 22, color: COLORS.phosphor, align: 'center' });
    }
    ctx.restore();
    this.drawHud(ctx, t);
  }
  drawHud(ctx, t) {
    this.game.ekg.draw(ctx, 16, H - 250, this.game.vitals(), t, { reduceFlash: this.game.settings.reduceFlash });
    this.game.eeg.draw(ctx, 16, H - 124, this.game.run.psyche.load, t, this.game.eegNotice);
    scanlines(ctx, 0.12);
  }
}

// ---------------------------------------------------------------------------
// The Dance Soldier: three rounds of call and response, and a tug-of-war bar.
// ---------------------------------------------------------------------------
const POSES = {
  idle: { la: 0.25, ra: -0.25, lae: 0.2, rae: -0.2 },
  left: { la: 1.9, lae: 0.1, ra: -0.4, ll: 0.5, lean: -0.12 },
  right: { ra: -1.9, rae: -0.1, la: 0.4, rl: -0.5, lean: 0.12 },
  up: { la: 2.9, ra: -2.9, lae: 0, rae: 0, jump: 26 },
  down: { la: 1.2, ra: -1.2, ll: 0.9, rl: -0.9, llk: -1.6, rlk: 1.6, jump: -40 },
};

export class DanceDuel {
  constructor(game) {
    this.game = game;
    this.rng = game.rng;
    this.round = -1;
    this.bar = 50;
    this.state = 'intro';
    this.t0 = game.time;
    this.fx = [];
    this.line = null;
    this.soldierPose = POSES.idle;
    this.playerPose = POSES.idle;
    this.poseT = { s: 0, p: 0 };
    playMusic('dance');
  }
  say(who, line) { this.line = { who, text: line, t0: this.game.time }; speak(line, who === 'SUBJECT 87' ? { pitch: 0.8 } : { pitch: 0.3, rate: 0.9 }); }
  nextRound(t) {
    this.round++;
    const R = DANCE_ROUNDS[this.round];
    this.steps = randomSteps(this.rng, R.notes, { doubles: R.doubles });
    this.chart = new Chart(this.steps, { spacing: R.spacing, travel: R.travel, rng: this.rng, now: t, onMiss: 'continue', strayMisses: false, windowScale: 1 + this.game.stats().window });
    this.state = 'soldier';
    this.say(...R.lines[0]);
    this.lineIdx = 1;
  }
  onKey(code, time) {
    const dir = dirForCode(code);
    if (!dir || this.state !== 'player') return;
    this.chart.update(time).forEach((e) => this.judge(e));
    const ev = this.chart.press(dir, time);
    if (ev.type === 'stray') { this.bar = clamp(this.bar - 2, 0, 100); return; }
    this.judge(ev);
    this.playerPose = POSES[dir];
    this.poseT.p = time;
  }
  onClick() {}
  judge(ev) {
    if (!ev) return;
    const run = this.game.run;
    if (ev.type === 'perfect') { this.bar = clamp(this.bar + 4, 0, 100); run.combo.hit(); sfx('ddrPerfect'); } else if (ev.type === 'good') { this.bar = clamp(this.bar + 2, 0, 100); run.combo.hit(); sfx('ddrHit'); } else if (ev.type === 'miss') { this.bar = clamp(this.bar - 9, 0, 100); run.combo.snap(); sfx('ddrMiss'); }
    this.fx.push({ dir: ev.note ? ev.note.dir : null, type: ev.type, t0: this.game.time, forgiven: ev.forgiven });
  }
  update(dt, t) {
    this.t = t;
    this.game.ekg.update(dt, this.game.vitals());
    this.game.eeg.update(dt, this.game.run.psyche.load);
    if (this.state === 'intro' && t - this.t0 > 2.2) this.nextRound(t);
    if (this.state === 'soldier') {
      // The soldier hits every note perfectly.
      for (const n of this.chart.pending) {
        if (t >= n.time) {
          n.state = 'perfect';
          this.soldierPose = POSES[n.dir];
          this.poseT.s = t;
          this.fx.push({ dir: n.dir, type: 'perfect', t0: t, soldier: true });
          sfx('ddrHit');
        }
      }
      if (!this.chart.pending.length && t > this.chart.endTime + 0.5) {
        this.chart = new Chart(this.steps, { spacing: DANCE_ROUNDS[this.round].spacing, travel: DANCE_ROUNDS[this.round].travel, rng: this.rng, now: t, onMiss: 'continue', strayMisses: false, windowScale: 1 + this.game.stats().window });
        this.state = 'player';
        this.say(...DANCE_ROUNDS[this.round].lines[1]);
      }
    } else if (this.state === 'player') {
      this.chart.update(t).forEach((e) => this.judge(e));
      if (this.lineIdx < 4 && t - this.line.t0 > 2.4) { this.say(...DANCE_ROUNDS[this.round].lines[this.lineIdx]); this.lineIdx++; }
      if (this.bar <= 0) this.lose(t);
      else if (this.chart.status === 'done') {
        if (this.round < 2) { this.state = 'between'; this.betweenT = t; } else if (this.bar > 50) this.win(t); else this.lose(t);
      }
    } else if (this.state === 'between' && t - this.betweenT > 1.2) this.nextRound(t);
    else if ((this.state === 'won' || this.state === 'lost') && t - this.endT > 3.2 && !this.reported) {
      this.reported = true;
      stopMusic();
      this.game.roomComplete({ kind: 'dance', won: this.state === 'won' });
    }
    if (t - this.poseT.s > 0.25) this.soldierPose = POSES.idle;
    if (t - this.poseT.p > 0.25) this.playerPose = POSES.idle;
  }
  win(t) {
    this.state = 'won';
    this.endT = t;
    stopMusic();
    sfx('reward');
    this.line = null;
  }
  lose(t) {
    this.state = 'lost';
    this.endT = t;
    stopMusic();
    sfx('scratch');
    setTimeout(() => sfx('gunshotBig'), 700);
    this.shotAt = t + 0.7;
    this.line = null;
  }
  draw(ctx, t) {
    // Stage
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12051c'); g.addColorStop(1, '#040208');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const beat = (t * 172) / 60;
    const pulse = Math.pow(1 - (beat % 1), 3);
    for (let i = 0; i < 8; i++) {
      const x = (i + 0.5) * (W / 8);
      ctx.save();
      ctx.globalAlpha = 0.08 + 0.12 * pulse * (i % 2 === Math.floor(beat) % 2 ? 1 : 0.3);
      ctx.fillStyle = i % 2 ? COLORS.magenta : COLORS.cyan;
      ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 20, 0); ctx.lineTo(x + 140, H); ctx.lineTo(x - 140, H); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#0b0610';
    ctx.fillRect(0, 560, W, 160);
    for (let i = 0; i < 16; i++) { ctx.fillStyle = (i + Math.floor(beat)) % 2 ? 'rgba(255,45,149,0.18)' : 'rgba(0,229,255,0.12)'; ctx.fillRect(i * 80, 560, 80, 160); }
    text(ctx, 'SACRED CALIBRATION IN PROGRESS', W / 2, 548, { size: 22, font: FONT.title, color: 'rgba(255,255,255,0.15)', align: 'center' });
    // Dancers
    const spin = this.round >= 1 && this.state === 'soldier' && hash(Math.floor(t * 2)) > 0.7 ? t * 12 : 0;
    drawDancer(ctx, 330, 620, 1.1, { ...this.playerPose, lean: (this.playerPose.lean || 0) + Math.sin(t * 7) * 0.05 }, { soldier: false, t });
    const salute = this.state === 'won' && t - this.endT > 0.6;
    const aim = this.state === 'lost';
    drawDancer(ctx, 950, 620, 1.1, salute ? { ra: -2.6, rae: -2.2, la: 0.2 } : aim ? { ra: -1.57, rae: 0, la: 0.3 } : { ...this.soldierPose, spin }, { soldier: true, t });
    if (aim) {
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(820, 400, 110, 18);
      if (this.shotAt && t > this.shotAt && t < this.shotAt + 0.12) {
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath(); ctx.arc(812, 409, 40, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    // Tracks (arrows fly UP, FNF style)
    const trackW = 300;
    if (this.chart) {
      const soldierSide = this.state === 'soldier';
      const pc = soldierSide ? null : this.chart;
      const sc = soldierSide ? this.chart : null;
      const opts = { y: 40, h: 262, hitY: 78, rising: true, skin: 'neon', panel: false, showKeys: false };
      drawTrackOrEmpty(ctx, pc, t, { ...opts, x: 120, w: trackW, fx: this.fx.filter((f) => !f.soldier) });
      drawTrackOrEmpty(ctx, sc, t, { ...opts, x: W - 120 - trackW, w: trackW, fx: this.fx.filter((f) => f.soldier) });
    }
    text(ctx, 'SUBJECT 87', 270, 30, { size: 20, color: COLORS.phosphor, align: 'center' });
    text(ctx, 'DANCE SOLDIER', W - 270, 30, { size: 20, color: COLORS.magenta, align: 'center' });
    // Dominance bar
    const bx = W / 2 - 300, by = 670;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, bx - 6, by - 6, 612, 30, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(bx, by, 600, 18);
    ctx.fillStyle = COLORS.phosphor;
    ctx.fillRect(bx, by, 600 * (this.bar / 100), 18);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx + 600 * (this.bar / 100) - 2, by - 6, 4, 30);
    text(ctx, 'DOMINANCE', W / 2, by - 12, { size: 18, color: '#fff', align: 'center' });
    // Round title & dialogue
    if (this.round >= 0 && this.state !== 'won' && this.state !== 'lost') {
      text(ctx, DANCE_ROUNDS[this.round].name, W / 2, 60, { size: 30, font: FONT.title, color: '#fff', align: 'center', glow: 12 });
      text(ctx, this.state === 'soldier' ? 'OBSERVE.' : this.state === 'player' ? 'REPLICATE. (←↓↑→ / WASD)' : '', W / 2, 92, { size: 22, color: this.state === 'soldier' ? COLORS.magenta : COLORS.phosphor, align: 'center' });
    }
    if (this.state === 'intro') {
      text(ctx, '[GATEWAY] // SACRED CALIBRATION', W / 2, 250, { size: 40, font: FONT.title, color: '#fff', align: 'center', glow: 16 });
      text(ctx, 'A soldier in full G.O.D. tactical armor stands at rigid attention. The bassline drops.', W / 2, 296, { size: 22, color: '#ddd', align: 'center' });
    }
    if (this.line && t - this.line.t0 < 3) {
      const right = this.line.who !== 'SUBJECT 87';
      const w = 400, x = W / 2 - w / 2, y = 132;
      const lines = splitLines(ctx, this.line.text, w - 28);
      const h = 44 + lines.length * 24;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = right ? COLORS.magenta : COLORS.phosphor;
      ctx.lineWidth = 2;
      ctx.stroke();
      // tail pointing at the speaker
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.beginPath();
      const tx = right ? x + w : x;
      ctx.moveTo(tx, y + h - 30); ctx.lineTo(tx + (right ? 60 : -60), y + h + 40); ctx.lineTo(tx, y + h - 10); ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      text(ctx, this.line.who, x + 14, y + 24, { size: 18, color: right ? COLORS.magenta : COLORS.phosphor });
      lines.forEach((l, i) => text(ctx, l, x + 14, y + 50 + i * 24, { size: 21, color: right ? '#ffd0ea' : '#d8ffe4' }));
    }
    if (this.state === 'won' && t - this.endT > 0.8) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 250, W, 110);
      text(ctx, 'G.O.D. NEURAL CALIBRATION COMPLETE.', W / 2, 296, { size: 38, color: COLORS.phosphor, align: 'center', glow: 16 });
      text(ctx, 'FUNDING APPROVED.', W / 2, 338, { size: 32, color: '#fff', align: 'center' });
    }
    if (this.state === 'lost' && t - this.endT > 1.2) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 250, W, 110);
      text(ctx, 'CALIBRATION FAILED.', W / 2, 296, { size: 40, color: '#ff3a3a', align: 'center', glow: 16 });
      text(ctx, 'ANOMALY REASSIGNED TO THE NEAREST COMBAT NODE.', W / 2, 336, { size: 24, color: '#fff', align: 'center' });
    }
    vignette(ctx, 'rgba(0,0,0,0.7)', 0.5);
    scanlines(ctx, 0.08);
  }
}

function drawTrackOrEmpty(ctx, chart, t, o) {
  // Receptors always show; notes only on the active side.
  const laneW = o.w / 4;
  for (const d of DIRS) {
    const x = o.x + laneW * (DIRS.indexOf(d) + 0.5);
    const hit = o.fx.find((f) => f.dir === d && t - f.t0 < 0.12);
    ctx.save();
    ctx.translate(x, o.hitY);
    ctx.strokeStyle = hit ? '#fff' : LANE_COLORS[d];
    ctx.shadowColor = LANE_COLORS[d];
    ctx.shadowBlur = hit ? 24 : 6;
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = hit ? 1 : 0.7;
    arrowPath(ctx, d, laneW * 0.78);
    ctx.stroke();
    ctx.restore();
  }
  if (chart) drawTrack(ctx, chart, t, { ...o, fx: o.fx });
}

function splitLines(ctx, str, maxW) {
  ctx.save();
  ctx.font = `21px ${FONT.mono}`;
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  ctx.restore();
  return lines;
}

