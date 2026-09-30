// HEARTLINE — Alex's phone. A real-time micro dating sim running inside the bullet hell.
// Nothing pauses: answering is voluntarily making the game harder.

import { G } from '../state.js';
import { HEARTLINE, heartsFor } from '../config.js';
import { CALLERS, SCRIPTS, catReaction, marioReaction, dkReaction, DK_STATS, DK_BOSS, drawPortrait, AGREE, PROVOKE, DEFLECT } from './callers.js';
import { makeQuestion } from './verses.js';

const KEY = 'akdh2.heartline.v1';
const KEYS = ['gf', 'ugly', 'cat', 'mario', 'demonKing', 'jesus'];
const CH = [AGREE, PROVOKE, DEFLECT];
const CH_LABEL = { [AGREE]: 'AGREE', [PROVOKE]: 'PROVOKE', [DEFLECT]: 'DEFLECT' };

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class Heartline {
  constructor(root) {
    this.data = this._load();
    this.state = 'idle';
    this.lastEnd = -99;
    this.lastCaller = null;
    this.call = null;
    this._buildUI(root);
  }

  _load() {
    const d = { scores: Object.fromEntries(KEYS.map((k) => [k, 0])), life: { answered: 0, declined: 0, bibleRight: 0, bibleWrong: 0, calls: Object.fromEntries(KEYS.map((k) => [k, 0])) } };
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); Object.assign(d.scores, s.scores || {}); Object.assign(d.life, s.life || {}); d.life.calls = { ...d.life.calls, ...(s.life?.calls || {}) }; } } catch { /* ignore */ }
    return d;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ } }
  resetAll() { for (const k of KEYS) this.data.scores[k] = 0; this.save(); }
  score(k) { return this.data.scores[k] ?? 0; }
  hearts(k) { return heartsFor(this.score(k)); }
  change(k, delta) {
    if (!delta) return 0;
    const run = G.run;
    if (delta < 0 && run && run.flags.mints) { run.flags.mints = false; G.hud.popup('BREATH MINTS: relationship loss cancelled', '#3cff8f', 1.4); return 0; }
    const before = this.score(k);
    const after = Math.max(HEARTLINE.scoreMin, Math.min(HEARTLINE.scoreMax, before + delta));
    this.data.scores[k] = after;
    this.save();
    return after - before;
  }

  // ---------------------------------------------------------------------------
  _buildUI(root) {
    const phone = el('div', 'phone');
    phone.innerHTML = `
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <div class="phone-label">INCOMING CALL</div>
        <canvas class="phone-portrait" width="160" height="160"></canvas>
        <div class="phone-name"></div>
        <div class="phone-hearts"></div>
        <div class="phone-btns">
          <button class="pbtn accept"><b class="key k1"></b> ❤️ Accept</button>
          <button class="pbtn decline"><b class="key k2"></b> 💔 Decline</button>
        </div>
        <div class="phone-timer"><i></i></div>
      </div>`;
    root.appendChild(phone);
    const codec = el('div', 'codec');
    codec.innerHTML = `
      <div class="codec-side left"><canvas width="160" height="160"></canvas><div class="codec-name"></div><div class="codec-hearts"></div><div class="codec-delta"></div></div>
      <div class="codec-main">
        <div class="codec-freq">♥ HEARTLINE <span class="codec-status">LIVE</span></div>
        <div class="codec-line"></div>
        <div class="codec-verse"></div>
        <div class="codec-opts"></div>
        <div class="codec-typed"></div>
        <div class="codec-timer"><i></i></div>
      </div>
      <div class="codec-side right"><canvas width="160" height="160"></canvas><div class="codec-name">ALEX</div></div>`;
    root.appendChild(codec);
    const texts = el('div', 'texts');
    root.appendChild(texts);
    this.ui = {
      phone, codec, texts,
      pPortrait: phone.querySelector('.phone-portrait'), pName: phone.querySelector('.phone-name'), pHearts: phone.querySelector('.phone-hearts'),
      pTimer: phone.querySelector('.phone-timer i'), accept: phone.querySelector('.accept'), decline: phone.querySelector('.decline'),
      k1: phone.querySelector('.k1'), k2: phone.querySelector('.k2'),
      cPortrait: codec.querySelector('.left canvas'), aPortrait: codec.querySelector('.right canvas'), cName: codec.querySelector('.left .codec-name'),
      cHearts: codec.querySelector('.codec-hearts'), cDelta: codec.querySelector('.codec-delta'), line: codec.querySelector('.codec-line'),
      verse: codec.querySelector('.codec-verse'), opts: codec.querySelector('.codec-opts'), typed: codec.querySelector('.codec-typed'),
      cTimer: codec.querySelector('.codec-timer i'), status: codec.querySelector('.codec-status'),
    };
    this.ui.accept.addEventListener('click', () => this.accept());
    this.ui.decline.addEventListener('click', () => this.decline(false));
    drawPortrait('alex', this.ui.aPortrait.getContext('2d'), 160);
  }

  heartsHtml(k) {
    const h = this.hearts(k);
    if (h === 0) return '<span class="broken">💔</span>';
    return '❤️'.repeat(h) + '<span class="empty">' + '🤍'.repeat(5 - h) + '</span>';
  }

  // ---------------------------------------------------------------------------
  reset() {
    this._close(true);
    this.state = 'idle';
    this.lastEnd = G.time;
    this.ui.texts.innerHTML = '';
  }

  update(dt) {
    const inp = G.input;
    // portraits animate (blink)
    if (this.call && this.state !== 'idle') {
      const t = G.realTime;
      if (this.state === 'ringing') drawPortrait(this.call.key, this.ui.pPortrait.getContext('2d'), 160, t);
      else drawPortrait(this.call.key, this.ui.cPortrait.getContext('2d'), 160, t);
    }
    switch (this.state) {
      case 'idle': this._maybeCall(dt); break;
      case 'ringing': {
        const c = this.call;
        c.ring -= dt;
        this.ui.pTimer.style.width = Math.max(0, (c.ring / c.ringMax) * 100) + '%';
        if (Math.floor(c.ring * 4) !== Math.floor((c.ring + dt) * 4)) G.input.rumble(0.35, 90);
        if (inp.pressed('phone1')) this.accept();
        else if (inp.pressed('phone2')) this.decline(false);
        else if (c.ring <= 0) this.decline(true);
        break;
      }
      case 'talk': case 'quiz': case 'reaction': this._talkUpdate(dt); break;
    }
  }

  eligible() {
    const room = G.room, run = G.run;
    if (!room || !run || G.mode !== 'run' || run.inputLocked || run.nightmare?.active) return false;
    if (!room.combatLive() || room.bossInfo) return false;
    if (G.time - room.enteredAt < HEARTLINE.minRoomTime) return false;
    if (G.time - this.lastEnd < HEARTLINE.cooldown) return false;
    return true;
  }

  _maybeCall(dt) {
    if (!this.eligible()) return;
    const run = G.run;
    // the first call of a run arrives early so everyone meets the phone
    const force = !run.hadCall && run.combatRoomsEntered >= 2 && G.time - G.room.enteredAt > 5;
    const p = 1 - Math.pow(1 - HEARTLINE.chancePerSecond, dt);
    if (!force && Math.random() > p) return;
    this.startRinging(this._pickCaller(force));
  }

  _pickCaller(first) {
    if (first) return 'gf';
    const w = KEYS.map((k) => {
      let wt = CALLERS[k].weight;
      if (k === 'gf' && this.score('gf') <= -2) wt *= 2;
      if (k === 'jesus' && this.score('jesus') <= -1) wt += 1;
      if (k === this.lastCaller) wt *= 0.15;
      return [k, wt];
    });
    return G.run.rng.weighted(w);
  }

  startRinging(key, opts = {}) {
    const run = G.run;
    run.hadCall = true;
    const ringMax = HEARTLINE.ringTime + ((run.mods.phoneTime || 1) > 1 ? 3 : 0) + (opts.boss ? 2 : 0);
    this.call = { key, ring: ringMax, ringMax, opts };
    this.lastCaller = key;
    this.state = 'ringing';
    const u = this.ui;
    u.pName.textContent = CALLERS[key].name + (key === 'jesus' ? ' IS CALLING' : '');
    u.pHearts.innerHTML = this.heartsHtml(key);
    u.k1.textContent = G.input.glyph('phone1');
    u.k2.textContent = G.input.glyph('phone2');
    u.phone.style.setProperty('--caller', CALLERS[key].color);
    u.phone.classList.add('show', 'ringing');
    G.audio.startRing();
    G.input.rumble(0.5, 150);
  }

  forceCall(key, opts) {
    this._close(true);
    this.state = 'idle';
    this.startRinging(key, opts);
  }

  decline(missed) {
    const c = this.call;
    if (!c) return;
    G.audio.stopRing();
    this.ui.phone.classList.remove('show', 'ringing');
    this.state = 'idle';
    this.lastEnd = G.time;
    G.run.stat('callsDeclined', 1);
    this.data.life.declined++;
    const key = c.key;
    this.call = null;
    if (c.opts.onEnd) c.opts.onEnd(false);
    const text = G.run.rng.pick(CALLERS[key].decline);
    setTimeoutGame(() => {
      const applied = this.change(key, -1);
      this.toast(key, text, applied);
    }, HEARTLINE.declineTextDelay);
  }

  toast(key, text, delta) {
    const t = el('div', 'text');
    t.style.setProperty('--caller', CALLERS[key].color);
    t.innerHTML = `<b>${esc(CALLERS[key].name)}:</b> ${esc(text)} ${delta < 0 ? '<span class="d neg">💔 ' + delta + '</span>' : delta > 0 ? '<span class="d pos">💚 +' + delta + '</span>' : ''}`;
    this.ui.texts.appendChild(t);
    G.audio.sfx('text');
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
    while (this.ui.texts.children.length > 4) this.ui.texts.firstChild.remove();
  }

  accept() {
    const c = this.call;
    if (!c) return;
    G.audio.stopRing();
    G.audio.duckMusic(true);
    this.ui.phone.classList.remove('show', 'ringing');
    G.run.stat('callsAnswered', 1);
    this.data.life.answered++;
    this.data.life.calls[c.key] = (this.data.life.calls[c.key] || 0) + 1;
    this.save();
    const u = this.ui;
    u.cName.textContent = CALLERS[c.key].name;
    u.cHearts.innerHTML = this.heartsHtml(c.key);
    u.cDelta.textContent = '';
    u.cDelta.className = 'codec-delta';
    u.verse.textContent = '';
    u.typed.textContent = '';
    u.opts.innerHTML = '';
    u.codec.style.setProperty('--caller', CALLERS[c.key].color);
    u.codec.classList.add('show');
    u.status.textContent = 'LIVE';
    this._beginScript();
  }

  // ---------------------------------------------------------------------------
  ctx() {
    const run = G.run, self = this, key = this.call.key;
    const req = run.gfRequest();
    return {
      run, rng: run.rng, money: run.money, score: this.score(key),
      request: req.amount, requestIdx: req.idx,
      advanceRequest: () => run.advanceGfRequest(this.score('gf') <= -2 ? 2 : 1),
      pay: (n) => { if (n > 0) { run.addMoney(-n, true); run.stat('moneyToGirlfriend', n); G.hud.popup('SENT ' + '$' + n + ' TO GIRLFRIEND', '#ff4fa3', 1.3); } },
      gift: () => run.girlfriendGift(),
      enemiesAlive: G.room ? G.room.enemies.filter((e) => e.alive).length : 0,
      floor: run.floor,
      dkLine: () => DK_STATS[run.dkStat].line(run.statValue(run.dkStat)),
      dkOptions: () => DK_STATS[run.dkStat].opts(run.statValue(run.dkStat)),
      self,
    };
  }

  _beginScript() {
    const c = this.call, key = c.key;
    const ctx = this.ctx();
    c.ctx = ctx;
    c.t = 0;
    c.choiceMax = HEARTLINE.choiceTime * (G.run.mods.phoneTime || 1);
    c.choiceT = c.choiceMax;
    // Jesus' Bible Check when the relationship is low enough
    if (key === 'jesus' && this.score('jesus') <= -1 && (this.score('jesus') <= -3 || G.run.rng() < 0.7)) {
      const s = this.score('jesus');
      const level = s <= -5 ? 3 : s <= -3 ? 2 : 1;
      c.quiz = makeQuestion(G.run.rng, level);
      c.quizStep = 0;
      c.seq = [['JESUS CHRIST', 'Alex.'], ['ALEX', 'Yeah?'], ['JESUS CHRIST', 'Finish this verse.']];
      c.seqI = 0; c.seqT = 0;
      this.state = 'quiz';
      this._say(c.seq[0][0], c.seq[0][1]);
      return;
    }
    if (c.opts.boss) {
      c.script = { open: () => DK_BOSS.line, options: DK_BOSS.opts, pick: DK_BOSS.pick };
    } else {
      const pool = SCRIPTS[key].filter((s) => !s.when || s.when(ctx));
      // the run's very first call is a gentle introduction to the phone
      const intro = !G.run.introCallDone && key === 'gf' ? pool.find((s) => s.id === 'where') : null;
      c.script = intro || G.run.rng.weighted(pool.map((s) => [s, s.weight || 1]));
      G.run.introCallDone = true;
    }
    const open = c.script.open(ctx);
    const options = typeof c.script.options === 'function' ? c.script.options(ctx) : c.script.options;
    c.options = options;
    this.state = 'talk';
    this._say(CALLERS[key].name, open);
    this._showOptions(CH.map((ch) => [ch, CH_LABEL[ch], options[ch]]));
  }

  _say(who, text) {
    const c = this.call;
    c.lineWho = who; c.lineText = text; c.lineShown = 0;
    this.ui.line.innerHTML = `<b>${esc(who)}:</b> <span></span>`;
  }

  _showOptions(list) {
    const u = this.ui;
    u.opts.innerHTML = '';
    list.forEach(([id, label, text], i) => {
      const b = el('button', 'opt');
      b.innerHTML = `<b class="key">${G.input.glyph('phone' + (i + 1))}</b> <span class="lab">${esc(label)}</span> <span class="txt">${esc(text)}</span>`;
      b.addEventListener('click', () => this._pick(i));
      u.opts.appendChild(b);
    });
    this.call.optList = list;
  }

  _talkUpdate(dt) {
    const c = this.call, u = this.ui, inp = G.input;
    // typewriter
    if (c.lineText && c.lineShown < c.lineText.length) {
      const before = Math.floor(c.lineShown);
      c.lineShown = Math.min(c.lineText.length, c.lineShown + dt * 48);
      const n = Math.floor(c.lineShown);
      if (n !== before) { u.line.querySelector('span').textContent = c.lineText.slice(0, n); if (n % 3 === 0) G.audio.sfx('blip', { p: 0.9 + Math.random() * 0.3, gap: 0.02 }); }
    }
    if (this.state === 'reaction') {
      c.endT -= dt;
      u.cTimer.style.width = '0%';
      if (c.endT <= 0) this.endCall();
      return;
    }
    if (this.state === 'quiz' && c.seq && c.seqI < c.seq.length) {
      c.seqT += dt;
      if (c.seqT > 0.9) {
        c.seqT = 0; c.seqI++;
        if (c.seqI < c.seq.length) this._say(c.seq[c.seqI][0], c.seq[c.seqI][1]);
        else this._showQuestion();
      }
      return;
    }
    // choices
    c.choiceT -= dt;
    u.cTimer.style.width = Math.max(0, (c.choiceT / c.choiceMax) * 100) + '%';
    if (c.optList) {
      for (let i = 0; i < c.optList.length; i++) if (inp.pressed('phone' + (i + 1))) { this._pick(i); return; }
    }
    if (c.choiceT <= 0) this._timeout();
  }

  _pick(i) {
    const c = this.call;
    if (!c || !c.optList || !c.optList[i]) return;
    const [id, , text] = c.optList[i];
    if (this.state === 'quiz') { this._answer(id); return; }
    if (this.state !== 'talk') return;
    const key = c.key;
    let res;
    if (key === 'cat') res = catReaction(id, G.run.rng);
    else if (key === 'mario') res = marioReaction(id, c.ctx);
    else if (key === 'demonKing' && !c.opts.boss) res = dkReaction(id, G.run.rng);
    else res = c.script.pick(id, c.ctx);
    this.ui.opts.innerHTML = `<div class="said"><b>ALEX:</b> ${esc(text)}</div>`;
    c.optList = null;
    if (res.room) G.run.nextRoomMod = res.room;
    this._react(res.reply, res.delta);
  }

  _react(reply, delta) {
    const c = this.call, key = c.key;
    const applied = this.change(key, delta);
    c.applied = applied;
    this._say(CALLERS[key].name, reply);
    const u = this.ui;
    u.cHearts.innerHTML = this.heartsHtml(key);
    u.cDelta.className = 'codec-delta show ' + (applied > 0 ? 'pos' : applied < 0 ? 'neg' : 'zero');
    u.cDelta.textContent = applied > 0 ? '💚 +' + applied : applied < 0 ? '💔 ' + applied : '· · ·';
    G.audio.sfx(applied > 0 ? 'heartUp' : applied < 0 ? 'heartDown' : 'blip');
    this.state = 'reaction';
    c.endT = 2.4 + reply.length * 0.02;
    c.answered = true;
  }

  _timeout() {
    const c = this.call;
    this.ui.opts.innerHTML = '<div class="said"><b>ALEX:</b> <i>(too busy dodging to answer)</i></div>';
    c.optList = null;
    const replies = { gf: 'Hello?? Are you ignoring me on a CALL?', ugly: 'I can hear explosions. Call me back.', cat: '*hangs up*', mario: 'BABY?', demonKing: 'Answer me when I monologue!', jesus: 'I\'ll let you focus.' };
    if (c.quiz) { this._quizResult(false); return; }
    this._react(replies[c.key] || '...', c.key === 'jesus' ? 0 : -1);
  }

  // Bible Check --------------------------------------------------------------
  _showQuestion() {
    const c = this.call, q = c.quiz, u = this.ui;
    c.choiceMax = (q.level === 3 ? 30 : 20) * (G.run.mods.phoneTime || 1);
    c.choiceT = c.choiceMax;
    this._say('JESUS CHRIST', q.ref);
    u.verse.textContent = q.display;
    if (q.level === 3) {
      u.opts.innerHTML = '<div class="said">TYPE THE MISSING WORD <i>(the game does not pause)</i></div>';
      c.typed = '';
      u.typed.textContent = '▌';
      c.optList = null;
      const answer = q.blanks[0];
      G.input.textCapture = (k) => {
        if (k === 'Backspace') c.typed = c.typed.slice(0, -1);
        else if (k === 'Enter') { this._typedDone(); return; }
        else c.typed += k;
        u.typed.textContent = c.typed + '▌';
        G.audio.sfx('blip');
        if (c.typed.length >= answer.length) this._typedDone();
      };
      return;
    }
    this._quizChoices();
  }
  _quizChoices() {
    const c = this.call, q = c.quiz;
    const choices = q.choices[c.quizStep];
    this._showOptions(choices.map((w) => [w, q.blanks.length > 1 ? 'BLANK ' + (c.quizStep + 1) : 'WORD', w]));
  }
  _answer(word) {
    const c = this.call, q = c.quiz;
    const right = word.toLowerCase() === q.blanks[c.quizStep].toLowerCase();
    if (!right) { this._quizResult(false); return; }
    c.quizStep++;
    if (c.quizStep < q.blanks.length) { G.audio.sfx('good'); this._quizChoices(); c.choiceT = Math.max(c.choiceT, 8); return; }
    this._quizResult(true);
  }
  _typedDone() {
    const c = this.call;
    G.input.textCapture = null;
    this._quizResult(c.typed.trim().toLowerCase() === c.quiz.blanks[0].toLowerCase());
  }
  _quizResult(ok) {
    const c = this.call;
    G.input.textCapture = null;
    this.ui.verse.textContent = c.quiz.text;
    this.ui.typed.textContent = '';
    this.ui.opts.innerHTML = '';
    c.optList = null;
    if (ok) { this.data.life.bibleRight++; G.run.stat('bibleCorrect', 1); this._react('Good.', 1); } else { this.data.life.bibleWrong++; this._react('...Alex.', -1); }
    this.call.endT += 1.5;
  }

  endCall() {
    const c = this.call;
    this._close(false);
    this.state = 'idle';
    this.lastEnd = G.time;
    if (c && c.opts.onEnd) c.opts.onEnd(true);
    G.alex?.spawnSafe(0.6); // "finishing dialogue" grace
  }

  _close(silent) {
    G.audio.stopRing();
    G.audio.duckMusic(false);
    G.input.textCapture = null;
    this.ui.phone.classList.remove('show', 'ringing');
    this.ui.codec.classList.remove('show');
    if (silent && this.call && this.call.opts.onEnd && this.state !== 'idle') this.call.opts.onEnd(this.state !== 'ringing');
    this.call = null;
  }

  busy() { return this.state !== 'idle'; }
}

// pause-safe timeouts in game time
const pending = [];
export function setTimeoutGame(fn, t) { pending.push({ at: G.time + t, fn }); }
export function tickPhoneTimers() {
  for (let i = pending.length - 1; i >= 0; i--) if (G.time >= pending[i].at) { const f = pending[i].fn; pending.splice(i, 1); f(); }
}
export { KEYS as CALLER_KEYS };
