// HEARTLINE — Alex's phone. A real-time micro dating sim running inside the bullet hell.
// Nothing pauses: answering is voluntarily making the game harder.
// Every call rolls its own ringtone, caller mood, signal quality, option order and
// occasional chaos (dropped calls, hold music); between calls people text.

import { G } from '../state.js';
import { HEARTLINE, heartsFor } from '../config.js';
import { CALLERS, SCRIPTS, MORE_SCRIPTS, MOODS, moodDelta, TEXTS, catReaction, marioReaction, dkReaction, DK_STATS, DK_BOSS, drawPortrait, AGREE, PROVOKE, DEFLECT } from './callers.js';
import { portraitDataURL } from './portraits.js';
import { makeQuestion } from './verses.js';
import { RINGTONES } from '../core/audio.js';

const KEY = 'akdh2.heartline.v1';
const KEYS = ['gf', 'ugly', 'cat', 'mario', 'demonKing', 'jesus'];
const CH = [AGREE, PROVOKE, DEFLECT];
const CH_LABEL = { [AGREE]: 'AGREE', [PROVOKE]: 'PROVOKE', [DEFLECT]: 'DEFLECT' };
const SAD_CALLERS = new Set(['mario', 'jesus', 'cat']);

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pickText = (v, rng) => (Array.isArray(v) ? rng.pick(v) : v);

export class Heartline {
  constructor(root) {
    this.data = this._load();
    this.state = 'idle';
    this.lastEnd = -99;
    this.lastCaller = null;
    this.call = null;
    this.textT = 18;
    this.callback = null;
    this.avatars = {};
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
  avatar(k) { return this.avatars[k] || (this.avatars[k] = portraitDataURL(k, 72)); }

  // ---------------------------------------------------------------------------
  _buildUI(root) {
    const phone = el('div', 'phone');
    phone.innerHTML = `
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <div class="phone-wall"></div>
        <div class="phone-status"><span class="ps-time"></span><span class="ps-sig"><i></i><i></i><i></i><i></i></span><span class="ps-bat"><b></b><em></em></span></div>
        <div class="phone-label">INCOMING CALL</div>
        <div class="phone-sub"></div>
        <div class="phone-pwrap"><span class="ring1"></span><span class="ring2"></span><canvas class="phone-portrait" width="200" height="200"></canvas></div>
        <div class="phone-name"></div>
        <div class="phone-mood"></div>
        <div class="phone-hearts"></div>
        <div class="phone-btns">
          <button class="pbtn accept"><b class="key k1"></b> <span>❤️ Accept</span></button>
          <button class="pbtn decline"><b class="key k2"></b> <span>💔 Decline</span></button>
        </div>
        <div class="phone-timer"><i></i></div>
      </div>`;
    root.appendChild(phone);
    const codec = el('div', 'codec');
    codec.innerHTML = `
      <div class="codec-side left"><div class="cp-frame"><canvas width="200" height="200"></canvas><div class="cp-static"></div></div><div class="codec-name"></div><div class="codec-mood"></div><div class="codec-hearts"></div><div class="codec-delta"></div></div>
      <div class="codec-main">
        <div class="codec-freq">♥ HEARTLINE <span class="codec-status">LIVE</span><span class="codec-sig"></span></div>
        <div class="codec-line"></div>
        <div class="codec-verse"></div>
        <div class="codec-opts"></div>
        <div class="codec-typed"></div>
        <div class="codec-timer"><i></i></div>
      </div>
      <div class="codec-side right"><div class="cp-frame"><canvas width="200" height="200"></canvas></div><div class="codec-name">ALEX</div></div>`;
    root.appendChild(codec);
    const texts = el('div', 'texts');
    root.appendChild(texts);
    const q = (n, s) => n.querySelector(s);
    this.ui = {
      phone, codec, texts,
      pPortrait: q(phone, '.phone-portrait'), pName: q(phone, '.phone-name'), pHearts: q(phone, '.phone-hearts'), pSub: q(phone, '.phone-sub'), pMood: q(phone, '.phone-mood'),
      pTime: q(phone, '.ps-time'), pSig: q(phone, '.ps-sig'), pBat: q(phone, '.ps-bat'), pWall: q(phone, '.phone-wall'),
      pTimer: q(phone, '.phone-timer i'), accept: q(phone, '.accept'), decline: q(phone, '.decline'),
      k1: q(phone, '.k1'), k2: q(phone, '.k2'),
      cPortrait: q(codec, '.left canvas'), aPortrait: q(codec, '.right canvas'), cName: q(codec, '.left .codec-name'), cMood: q(codec, '.codec-mood'),
      cHearts: q(codec, '.codec-hearts'), cDelta: q(codec, '.codec-delta'), line: q(codec, '.codec-line'), cSig: q(codec, '.codec-sig'),
      verse: q(codec, '.codec-verse'), opts: q(codec, '.codec-opts'), typed: q(codec, '.codec-typed'),
      cTimer: q(codec, '.codec-timer i'), status: q(codec, '.codec-status'),
    };
    this.ui.accept.addEventListener('click', () => this.accept());
    this.ui.decline.addEventListener('click', () => this.decline(false));
    drawPortrait('alex', this.ui.aPortrait.getContext('2d'), 200);
  }

  heartsHtml(k) {
    const h = this.hearts(k);
    if (h === 0) return '<span class="broken">💔</span>';
    return [...Array(5)].map((_, i) => i < h ? `<span class="h" style="--i:${i}">❤️</span>` : `<span class="empty" style="--i:${i}">🤍</span>`).join('');
  }

  // ---------------------------------------------------------------------------
  reset() {
    this._close(true);
    this.state = 'idle';
    this.lastEnd = G.time;
    this.textT = 14 + Math.random() * 10;
    this.callback = null;
    this.ui.texts.innerHTML = '';
  }

  update(dt) {
    const inp = G.input;
    const c = this.call;
    if (c && this.state !== 'idle') {
      const t = G.realTime;
      if (this.state === 'ringing') drawPortrait(c.key, this.ui.pPortrait.getContext('2d'), 200, t, { mood: c.face });
      else {
        const talking = c.lineWho && c.lineWho !== 'ALEX' && c.lineShown < (c.lineText || '').length;
        drawPortrait(c.key, this.ui.cPortrait.getContext('2d'), 200, t, { mood: c.face, talk: talking });
        drawPortrait('alex', this.ui.aPortrait.getContext('2d'), 200, t + 3, { mood: c.alexFace, talk: G.time < (c.alexTalkUntil || 0) });
      }
    }
    switch (this.state) {
      case 'idle': this._maybeCall(dt); this._maybeText(dt); break;
      case 'ringing': {
        c.ring -= dt;
        this.ui.pTimer.style.transform = `scaleX(${Math.max(0, c.ring / c.ringMax)})`;
        this.ui.phone.classList.toggle('urgent', c.ring < 1.6);
        if (Math.floor(c.ring * 4) !== Math.floor((c.ring + dt) * 4)) G.input.rumble(0.35, 90);
        if (inp.pressed('phone1')) this.accept();
        else if (inp.pressed('phone2')) this.decline(false);
        else if (c.ring <= 0) this.decline(true);
        break;
      }
      case 'hold': {
        c.holdT -= dt;
        this.ui.cTimer.style.transform = 'scaleX(1)';
        if (c.holdT <= 0) { this.ui.codec.classList.remove('onhold'); this._beginScript(); }
        break;
      }
      case 'talk': case 'quiz': case 'reaction': this._talkUpdate(dt); break;
    }
  }

  eligible() {
    const room = G.room, run = G.run;
    if (!room || !run || G.mode !== 'run' || run.inputLocked || run.transition || run.nightmare?.active) return false;
    if (room.bossInfo || G.hud.scratching) return false;
    if (G.time - room.enteredAt < HEARTLINE.minRoomTime) return false;
    if (G.time - this.lastEnd < HEARTLINE.cooldown) return false;
    return true;
  }

  _maybeCall(dt) {
    if (this.callback && G.time > this.callback.at && this.eligible()) {
      const cb = this.callback; this.callback = null;
      this.startRinging(cb.key, { callback: true });
      return;
    }
    if (!this.eligible()) return;
    const run = G.run;
    const fight = G.room.combatLive();
    // the first call of a run arrives early so everyone meets the phone
    const force = !run.hadCall && run.combatRoomsEntered >= 1 && fight && G.time - G.room.enteredAt > 4;
    const rate = HEARTLINE.chancePerSecond * (fight ? 1 : 0.55) * (G.room.rift ? 1.4 : 1);
    const p = 1 - Math.pow(1 - rate, dt);
    if (!force && Math.random() > p) return;
    this.startRinging(this._pickCaller(force));
  }

  _pickCaller(first) {
    if (first) return 'gf';
    const rift = G.room?.rift?.id;
    const w = KEYS.map((k) => {
      let wt = CALLERS[k].weight;
      if (k === 'gf' && this.score('gf') <= -2) wt *= 2;
      if (k === 'jesus' && (this.score('jesus') <= -1 || rift === 'bible')) wt += 1.5;
      if (k === 'demonKing' && rift) wt += 1;
      if (k === this.lastCaller) wt *= 0.15;
      return [k, wt];
    });
    return G.run.rng.weighted(w);
  }

  // Texts between calls -------------------------------------------------------
  _maybeText(dt) {
    const run = G.run;
    if (!run || G.mode !== 'run' || run.transition || !G.room) return;
    this.textT -= dt;
    if (this.textT > 0) return;
    this.textT = 16 + Math.random() * 22;
    const key = run.rng.weighted(KEYS.map((k) => [k, CALLERS[k].weight]));
    let pick = run.rng.pick(TEXTS[key]);
    if (pick[0] === this.lastText) pick = TEXTS[key][(TEXTS[key].indexOf(pick) + 1) % TEXTS[key].length];
    this.lastText = pick[0];
    this.toast(key, pick[0], 0, { typing: true, effect: pick[1] });
  }
  _textEffect(fx) {
    const run = G.run;
    if (!run || !fx) return '';
    if (fx === 'money5') { run.addMoney(5); return '+$5'; }
    if (fx === 'money1') { run.addMoney(1); return '+$1'; }
    if (fx === 'heal10') { G.alex.heal(10); return '+10 HP'; }
    if (fx === 'heal5') { G.alex.heal(5, true); return '+5 HP'; }
    return '';
  }

  toast(key, text, delta, o = {}) {
    const t = el('div', 'text');
    t.style.setProperty('--caller', CALLERS[key].color);
    const deltaHtml = delta < 0 ? '<span class="d neg">💔 ' + delta + '</span>' : delta > 0 ? '<span class="d pos">💚 +' + delta + '</span>' : '';
    t.innerHTML = `<img class="tx-av" src="${this.avatar(key)}" alt=""><div class="tx-body"><b>${esc(CALLERS[key].name)} <i>now</i></b><span class="tx-msg">${o.typing ? '<span class="dots"><i></i><i></i><i></i></span>' : esc(text) + ' ' + deltaHtml}</span></div>`;
    this.ui.texts.appendChild(t);
    const msg = t.querySelector('.tx-msg');
    const show = () => {
      const got = this._textEffect(o.effect);
      msg.innerHTML = esc(text) + ' ' + deltaHtml + (got ? ` <span class="d pos">${esc(got)}</span>` : '');
      t.classList.add('in');
      G.audio.sfx('text');
    };
    if (o.typing) setTimeout(show, 900); else show();
    setTimeout(() => t.classList.add('out'), 5200);
    setTimeout(() => t.remove(), 5800);
    while (this.ui.texts.children.length > 3) this.ui.texts.firstChild.remove();
  }

  // Ringing --------------------------------------------------------------------
  startRinging(key, opts = {}) {
    const run = G.run, rng = run.rng;
    run.hadCall = true;
    const extra = ((run.mods.phoneTime || 1) > 1 ? 3 : 0) + (opts.boss ? 2 : 0);
    const ringMax = rng.range(HEARTLINE.ringTime - 0.5, HEARTLINE.ringTime + 2.5) + extra;
    const mood = opts.boss ? 'normal' : rng.weighted(Object.entries(MOODS).map(([k, m]) => [k, m.w]));
    const sigR = rng();
    const signal = opts.boss ? 'good' : sigR < 0.68 ? 'good' : sigR < 0.9 ? 'weak' : 'bad';
    const ringtone = rng() < 0.72 ? CALLERS[key].ring : rng.pick(Object.keys(RINGTONES));
    this.call = { key, ring: ringMax, ringMax, opts, mood, signal, ringtone, face: mood === 'grumpy' ? 'angry' : mood === 'happy' ? 'happy' : 'neutral', alexFace: 'neutral' };
    this.lastCaller = key;
    this.state = 'ringing';
    const u = this.ui;
    u.pName.textContent = CALLERS[key].name + (key === 'jesus' ? ' IS CALLING' : '');
    u.pSub.textContent = opts.callback ? 'calling back…' : rng.pick(CALLERS[key].sub || ['mobile']);
    u.pMood.innerHTML = MOODS[mood].emoji ? `<span>${MOODS[mood].emoji} ${esc(MOODS[mood].label)}</span>` : '';
    u.pHearts.innerHTML = this.heartsHtml(key);
    u.k1.textContent = G.input.glyph('phone1');
    u.k2.textContent = G.input.glyph('phone2');
    const now = new Date();
    u.pTime.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const bars = signal === 'good' ? 4 : signal === 'weak' ? 2 : 1;
    [...u.pSig.children].forEach((b, i) => b.classList.toggle('on', i < bars));
    const bat = rng() < 0.2 ? rng.int(2, 12) : rng.int(20, 100);
    u.pBat.querySelector('b').style.width = bat + '%';
    u.pBat.querySelector('em').textContent = bat + '%';
    u.pBat.classList.toggle('low', bat < 15);
    u.pWall.className = 'phone-wall w' + rng.int(0, 4);
    u.phone.style.setProperty('--caller', CALLERS[key].color);
    u.phone.classList.remove('urgent');
    u.phone.classList.add('show', 'ringing');
    G.audio.startRing(ringtone);
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
    this.ui.phone.classList.remove('show', 'ringing', 'urgent');
    this.state = 'idle';
    this.lastEnd = G.time;
    G.run.stat('callsDeclined', 1);
    this.data.life.declined++;
    const key = c.key;
    this.call = null;
    if (c.opts.onEnd) c.opts.onEnd(false);
    const text = G.run.rng.pick(CALLERS[key].decline);
    setTimeoutGame(() => {
      const applied = this.change(key, moodDelta(c.mood, -1, G.run.rng));
      this.toast(key, (missed ? '📵 missed call. ' : '') + text, applied);
    }, HEARTLINE.declineTextDelay);
  }

  accept() {
    const c = this.call;
    if (!c) return;
    G.audio.stopRing();
    G.audio.duckMusic(true);
    this.ui.phone.classList.remove('show', 'ringing', 'urgent');
    G.run.stat('callsAnswered', 1);
    this.data.life.answered++;
    this.data.life.calls[c.key] = (this.data.life.calls[c.key] || 0) + 1;
    this.save();
    const u = this.ui;
    u.cName.textContent = CALLERS[c.key].name;
    u.cMood.innerHTML = MOODS[c.mood].emoji ? `${MOODS[c.mood].emoji} ${esc(MOODS[c.mood].label)}` : '';
    u.cHearts.innerHTML = this.heartsHtml(c.key);
    u.cDelta.textContent = '';
    u.cDelta.className = 'codec-delta';
    u.verse.textContent = '';
    u.typed.textContent = '';
    u.opts.innerHTML = '';
    u.line.innerHTML = '';
    u.cSig.textContent = c.signal === 'good' ? '' : c.signal === 'weak' ? ' · WEAK SIGNAL' : ' · BAD SIGNAL';
    u.codec.style.setProperty('--caller', CALLERS[c.key].color);
    u.codec.classList.toggle('static', c.signal !== 'good');
    u.codec.classList.toggle('bad', c.signal === 'bad');
    u.codec.classList.remove('onhold', 'dropped');
    u.codec.classList.remove('show'); void u.codec.offsetWidth;
    u.codec.classList.add('show');
    u.status.textContent = 'LIVE';
    // sometimes you get put on hold first
    if (!c.opts.boss && !c.opts.callback && G.run.rng() < 0.07) {
      this.state = 'hold';
      c.holdT = 2.6;
      u.codec.classList.add('onhold');
      u.status.textContent = 'ON HOLD';
      u.line.innerHTML = `<b>${esc(CALLERS[c.key].name)}:</b> <span>${esc(G.run.rng.pick(['Please hold. Your call is important to us.', 'hold on hold on hold on', '*elevator music*', 'One sec, I\'m on the other line.']))}</span>`;
      G.audio.sfx('heartUp', { v: 0.5 });
      return;
    }
    this._beginScript();
  }

  // ---------------------------------------------------------------------------
  ctx() {
    const run = G.run, key = this.call.key;
    const req = run.gfRequest();
    return {
      run, rng: run.rng, money: run.money, score: this.score(key),
      request: req.amount, requestIdx: req.idx,
      advanceRequest: () => run.advanceGfRequest(this.score('gf') <= -2 ? 2 : 1),
      pay: (n) => { if (n > 0) { run.addMoney(-n, true); run.stat('moneyToGirlfriend', n); G.hud.popup('SENT ' + '$' + n + ' TO GIRLFRIEND', '#ff4fa3', 1.3); } },
      gift: () => run.girlfriendGift(),
      enemiesAlive: G.room ? G.room.enemies.filter((e) => e.alive).length : 0,
      floor: run.floor,
      rift: G.room?.rift?.id || null,
      dkLine: () => DK_STATS[run.dkStat].line(run.statValue(run.dkStat)),
      dkOptions: () => DK_STATS[run.dkStat].opts(run.statValue(run.dkStat)),
      self: this,
    };
  }

  _beginScript() {
    const c = this.call, key = c.key, rng = G.run.rng;
    const ctx = this.ctx();
    c.ctx = ctx;
    c.t = 0;
    c.choiceMax = rng.range(HEARTLINE.choiceTime - 2, HEARTLINE.choiceTime + 2) * (G.run.mods.phoneTime || 1) * (c.mood === 'sleepy' ? 1.35 : 1);
    c.choiceT = c.choiceMax;
    this.state = 'talk';
    // Jesus' Bible Check when the relationship is low enough
    if (key === 'jesus' && !c.opts.callback && this.score('jesus') <= -1 && (this.score('jesus') <= -3 || rng() < 0.7)) {
      const s = this.score('jesus');
      const level = s <= -5 ? 3 : s <= -3 ? 2 : 1;
      c.quiz = makeQuestion(rng, level);
      c.quizStep = 0;
      c.seq = [['JESUS CHRIST', 'Alex.'], ['ALEX', 'Yeah?'], ['JESUS CHRIST', rng.pick(['Finish this verse.', 'Quick question.', 'Pop quiz.'])]];
      c.seqI = 0; c.seqT = 0;
      this.state = 'quiz';
      this._say(c.seq[0][0], c.seq[0][1]);
      return;
    }
    if (c.opts.boss) {
      c.script = { open: () => DK_BOSS.line, options: DK_BOSS.opts, pick: DK_BOSS.pick };
    } else {
      const pool = [...SCRIPTS[key], ...(MORE_SCRIPTS[key] || [])].filter((s) => !s.when || s.when(ctx));
      // the run's very first call is a gentle introduction to the phone
      const intro = !G.run.introCallDone && key === 'gf' ? pool.find((s) => s.id === 'where') : null;
      // rift lines jump the queue while a rift is open
      const rift = ctx.rift && rng() < 0.6 ? pool.find((s) => s.id === 'rift') : null;
      c.script = intro || rift || rng.weighted(pool.map((s) => [s, s.weight || 1]));
      G.run.introCallDone = true;
    }
    let open = typeof c.script.open === 'function' ? c.script.open(ctx) : c.script.open;
    open = pickText(open, rng);
    if (c.opts.callback) open = rng.pick(['Sorry, tunnel. ', 'Okay I\'m back. ', 'The call dropped?? ']) + open;
    const options = typeof c.script.options === 'function' ? c.script.options(ctx) : c.script.options;
    c.options = options;
    this._say(CALLERS[key].name, open);
    // randomized option order every call
    const order = c.opts.boss ? CH.slice() : rng.shuffle(CH.slice());
    this._showOptions(order.map((ch) => [ch, CH_LABEL[ch], pickText(options[ch], rng)]));
    // weak signal: the call may drop part-way through
    c.dropAt = c.signal === 'bad' && rng() < 0.35 ? rng.range(2, 6) : c.signal === 'weak' && rng() < 0.12 ? rng.range(3, 7) : null;
  }

  _garble(text) {
    const c = this.call;
    if (!c || c.signal === 'good') return text;
    const k = c.signal === 'bad' ? 0.22 : 0.1;
    return text.split('').map((ch) => (ch !== ' ' && Math.random() < k ? (Math.random() < 0.5 ? '·' : '#') : ch)).join('');
  }

  _say(who, text) {
    const c = this.call;
    const shown = who === 'ALEX' ? text : this._garble(text);
    c.lineWho = who; c.lineText = shown; c.lineShown = 0;
    this.ui.line.innerHTML = `<b>${esc(who)}:</b> <span></span><i class="caret"></i>`;
    if (who === 'ALEX') c.alexTalkUntil = G.time + 0.9;
  }

  _showOptions(list) {
    const u = this.ui;
    u.opts.innerHTML = '';
    list.forEach(([id, label, text], i) => {
      const b = el('button', 'opt opt-' + (label || '').toLowerCase());
      b.style.setProperty('--i', i);
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
      if (n !== before) { const sp = u.line.querySelector('span'); if (sp) sp.textContent = c.lineText.slice(0, n); if (n % 3 === 0) G.audio.sfx('blip', { p: 0.9 + Math.random() * 0.3, gap: 0.02 }); }
    }
    if (this.state === 'reaction') {
      c.endT -= dt;
      u.cTimer.style.transform = 'scaleX(0)';
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
    // dropped call
    c.t += dt;
    if (c.dropAt && c.t > c.dropAt && this.state === 'talk' && c.optList) { this._drop(); return; }
    // choices
    c.choiceT -= dt;
    const k = Math.max(0, c.choiceT / c.choiceMax);
    u.cTimer.style.transform = `scaleX(${k})`;
    u.cTimer.parentElement.classList.toggle('hurry', k < 0.3);
    if (c.optList) {
      for (let i = 0; i < c.optList.length; i++) if (inp.pressed('phone' + (i + 1))) { this._pick(i); return; }
    }
    if (c.choiceT <= 0) this._timeout();
  }

  _drop() {
    const c = this.call;
    c.optList = null;
    this.ui.opts.innerHTML = '<div class="said dropped">📵 CALL DROPPED</div>';
    this.ui.codec.classList.add('dropped');
    this.ui.status.textContent = 'NO SIGNAL';
    G.audio.sfx('static', { v: 0.5 });
    this.state = 'reaction';
    c.endT = 1.4;
    this.callback = { key: c.key, at: G.time + HEARTLINE.cooldown * 0.4 };
  }

  _pick(i) {
    const c = this.call;
    if (!c || !c.optList || !c.optList[i]) return;
    const [id, , text] = c.optList[i];
    if (this.state === 'quiz') { this._answer(id); return; }
    if (this.state !== 'talk') return;
    const key = c.key, rng = G.run.rng;
    let res;
    if (key === 'cat') res = catReaction(id, rng);
    else if (key === 'mario') res = marioReaction(id, c.ctx);
    else if (key === 'demonKing' && !c.opts.boss) res = dkReaction(id, rng);
    else if (c.script.react) { const [reply, delta] = rng.pick(c.script.react[id]); res = { reply, delta }; }
    else res = c.script.pick(id, c.ctx);
    if (!c.opts.boss) res.delta = moodDelta(c.mood, res.delta, rng);
    c.alexFace = id === AGREE ? 'happy' : id === PROVOKE ? 'angry' : 'neutral';
    this.ui.opts.innerHTML = `<div class="said"><b>ALEX:</b> ${esc(text)}</div>`;
    c.alexTalkUntil = G.time + 0.9;
    c.optList = null;
    if (res.room) G.run.nextRoomMod = res.room;
    this._react(res.reply, res.delta);
  }

  _react(reply, delta) {
    const c = this.call, key = c.key;
    const applied = this.change(key, delta);
    c.applied = applied;
    c.face = applied > 0 ? 'happy' : applied < 0 ? (SAD_CALLERS.has(key) ? 'sad' : 'angry') : 'neutral';
    if (applied < 0) c.alexFace = 'shock';
    this._say(CALLERS[key].name, reply);
    const u = this.ui;
    u.cHearts.innerHTML = this.heartsHtml(key);
    u.cHearts.classList.remove('pop'); void u.cHearts.offsetWidth; u.cHearts.classList.add('pop');
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
    const replies = { gf: ['Hello?? Are you ignoring me on a CALL?', 'I can HEAR you breathing.'], ugly: ['I can hear explosions. Call me back.', 'Ok. Dinner\'s in the microwave.'], cat: ['*hangs up*', '*sits on the phone*'], mario: ['BABY?', 'baby mario waiting'], demonKing: ['Answer me when I monologue!', 'Silence. Bold.'], jesus: ['I\'ll let you focus.', 'Take your time.'] };
    if (c.quiz) { this._quizResult(false); return; }
    this._react(G.run.rng.pick(replies[c.key] || ['...']), c.key === 'jesus' ? 0 : moodDelta(c.mood, -1, G.run.rng));
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
    if (ok) { this.data.life.bibleRight++; G.run.stat('bibleCorrect', 1); this._react(G.run.rng.pick(['Good.', 'Well done, Alex.', 'Yes.']), 1); if (G.run.rng() < 0.5) G.alex.heal(15); } else { this.data.life.bibleWrong++; this._react('...Alex.', -1); }
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
    this.ui.phone.classList.remove('show', 'ringing', 'urgent');
    this.ui.codec.classList.remove('show', 'onhold', 'dropped');
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
