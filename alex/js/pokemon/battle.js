// The battle screen. Classic handheld layout on the minigame canvas: the foe on its
// platform top-right with its HP box, your Pokémon's back bottom-left with HP and EXP
// bars, the text box, FIGHT / BAG / POKéMON / RUN, the move list with PP and type,
// switching, items, Poké Ball throws with shakes, EXP gain, level-up stat boxes and
// "forget a move?" prompts. Keyboard, gamepad, mouse and touch all work.

import { G } from '../state.js';
import { SPECIES } from './dex.js';
import { MOVES } from './moves.js';
import { TYPES } from './types.js';
import { spriteCanvas, itemSprite } from './sprites.js';
import { battler, useMove, endOfTurn, chooseMove, order, catchShakes, canRun, STATUS_NAMES } from './battleCore.js';
import { monName, maxHp, calcStats, gainExp, learnMove, expYield, expProgress, STAT_NAMES, evolutionFor } from './mon.js';

const W = 480, H = 320;
const FONT = '"Press Start 2P", monospace';
export const BAG_ITEMS = {
  pokeBall: { name: 'Poké Ball', ball: true, price: 4, desc: 'A device for catching wild Pokémon.' },
  greatBall: { name: 'Great Ball', ball: true, price: 9, desc: 'A good, high-performance Poké Ball.' },
  ultraBall: { name: 'Ultra Ball', ball: true, price: 16, desc: 'An ultra-performance Poké Ball.' },
  masterBall: { name: 'Master Ball', ball: true, price: 0, desc: 'Catches any wild Pokémon without fail.' },
  potion: { name: 'Potion', heal: 20, price: 4, desc: 'Restores 20 HP.' },
  superPotion: { name: 'Super Potion', heal: 60, price: 9, desc: 'Restores 60 HP.' },
  hyperPotion: { name: 'Hyper Potion', heal: 200, price: 16, desc: 'Restores 200 HP.' },
  revive: { name: 'Revive', revive: true, price: 14, desc: 'Revives a fainted Pokémon with half its HP.' },
  rareCandy: { name: 'Rare Candy', candy: true, price: 0, desc: 'Raises a Pokémon\'s level by one.' },
  fireStone: { name: 'Fire Stone', stone: true, price: 20, desc: 'Makes certain Pokémon evolve.' },
  waterStone: { name: 'Water Stone', stone: true, price: 20, desc: 'Makes certain Pokémon evolve.' },
  thunderStone: { name: 'Thunder Stone', stone: true, price: 20, desc: 'Makes certain Pokémon evolve.' },
  leafStone: { name: 'Leaf Stone', stone: true, price: 20, desc: 'Makes certain Pokémon evolve.' },
  moonStone: { name: 'Moon Stone', stone: true, price: 20, desc: 'Makes certain Pokémon evolve.' },
};

const BG = {
  grass: { sky: ['#a8e0f8', '#e8f8d0'], ground: '#b8e078', plat: ['#88c050', '#6aa038'], fog: null },
  cave: { sky: ['#4a3a2a', '#7a6248'], ground: '#8a7058', plat: ['#a08060', '#705038'] },
  nether: { sky: ['#3a0a06', '#8a2a14'], ground: '#6e2b2b', plat: ['#8a3a3a', '#4f1c1c'] },
  end: { sky: ['#0b0712', '#2a1b3d'], ground: '#cfc98a', plat: ['#dcd79c', '#a8a270'] },
  night: { sky: ['#1b1040', '#6a2c70'], ground: '#4a6a48', plat: ['#5a8a50', '#3a6030'] },
};

const hpColor = (k) => (k > 0.5 ? '#38d878' : k > 0.2 ? '#f8c030' : '#f05038');
const ease = (k) => 1 - (1 - k) ** 2;

export class Battle {
  constructor({ foes, trainer = null, terrain = 'grass', onDone }) {
    const run = G.run;
    this.run = run;
    this.party = run.party;
    this.trainer = trainer;
    this.foes = foes;
    this.fi = 0;
    this.foe = battler(foes[0], 'foe');
    this.foe.wild = !trainer;
    this.pi = this.party.findIndex((m) => m.hp > 0);
    this.me = battler(this.party[this.pi], 'me');
    this.participants = new Set([this.party[this.pi].uid]);
    this.onDone = onDone;
    this.bg = BG[terrain] || BG.grass;
    this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H;
    this.g = this.cv.getContext('2d');
    this.t = 0;
    this.q = [];
    this.step = null;
    this.state = 'intro';
    this.cursor = 0;
    this.mcursor = 0;
    this.disp = { me: this.me.mon.hp, foe: this.foe.mon.hp };
    this.expDisp = expProgress(this.me.mon);
    this.vis = { me: 0, foe: 0 };          // slide-in progress
    this.fx = [];                          // particles / flashes
    this.shake = { me: 0, foe: 0 };
    this.blink = { me: 0, foe: 0 };
    this.faintK = { me: 0, foe: 0 };
    this.ball = null;
    this.hits = [];
    this.runTries = 0;
    this.evolutions = [];
    this.result = null;
    this.navT = 0;
    this.finished = false;
    this.seen(this.foe.mon);
    this.pointer = (e) => this.onPointer(e);
    G.audio.playMusic(trainer ? 'pkTrainer' : 'pkBattle', { restart: true });
    const mini = document.getElementById('mini');
    mini.addEventListener('pointerdown', this.pointer);
    // intro
    const fn = this.foe.mon;
    if (trainer) {
      this.say(`${trainer.title} ${trainer.name} would like to battle!`);
      this.say(`${trainer.title} ${trainer.name} sent out ${monName(fn)}!`, () => { this.vis.foe = 0; this.slideIn('foe'); G.audio.sfx('pkCry', { p: SPECIES[fn.species].cry }); });
    } else {
      this.push({ t: 'fn', fn: () => { this.slideIn('foe'); G.audio.sfx('pkCry', { p: SPECIES[fn.species].cry }); } });
      this.say(`${fn.shiny ? 'A shiny' : 'A'} wild ${monName(fn)} appeared!${fn.shiny ? ' ✦' : ''}`);
    }
    this.say(`Go! ${monName(this.me.mon)}!`, () => { this.slideIn('me'); G.audio.sfx('pkBall'); setTimeout(() => G.audio.sfx('pkCry', { p: SPECIES[this.me.mon.species].cry }), 300); });
    this.push({ t: 'fn', fn: () => { this.state = 'menu'; } });
  }

  seen(mon) { G.poke?.dexSee(mon.species); }
  push(s) { this.q.push(s); }
  say(s, fn) { this.q.push({ t: 'text', s, fn }); }
  get log() { return this._log || (this._log = []); }
  slideIn(side) { this.vis[side] = 0.001; }

  // ------------------------------------------------------------------------------ input
  confirm() { return G.input.pressed('jump') || G.input.pressed('interact'); }
  cancel() { return G.input.pressed('dash') || G.input.pressed('pause') || G.input.pressed('ranged'); }
  nav() {
    const i = G.input;
    let dx = 0, dy = 0;
    if (i.pressed('left') || i.pressed('phone4')) dx = -1;
    if (i.pressed('right') || i.pressed('phone2')) dx = 1;
    if (i.pressed('up') || i.pressed('phone1')) dy = -1;
    if (i.pressed('down') || i.pressed('phone3')) dy = 1;
    const m = i.move;
    if (!dx && !dy && m && (Math.abs(m.x) > 0.6 || Math.abs(m.y) > 0.6) && this.navT <= 0) {
      if (Math.abs(m.x) > Math.abs(m.y)) dx = Math.sign(m.x); else dy = -Math.sign(m.y);
      this.navT = 0.22;
    }
    if (m && Math.abs(m.x) < 0.3 && Math.abs(m.y) < 0.3) this.navT = 0;
    if (dx || dy) G.audio.sfx('ui', { v: 0.4 });
    return [dx, dy];
  }
  onPointer(e) {
    const r = e.target.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
    const x = (e.clientX - r.left - ox) / s, y = (e.clientY - r.top - oy) / s;
    this.tap = { x, y };
  }
  takeTap() {
    if (!this.tap) return null;
    const t = this.tap; this.tap = null;
    for (const h of this.hits) if (t.x >= h.x && t.x <= h.x + h.w && t.y >= h.y && t.y <= h.y + h.h) return h;
    return { any: true };
  }

  // ------------------------------------------------------------------------------ flow
  update(dt) {
    this.t += dt;
    this.navT = Math.max(0, this.navT - dt);
    for (const s of ['me', 'foe']) { if (this.vis[s] > 0 && this.vis[s] < 1) this.vis[s] = Math.min(1, this.vis[s] + dt * 2.2); this.shake[s] = Math.max(0, this.shake[s] - dt); this.blink[s] = Math.max(0, this.blink[s] - dt); }
    this.fx = this.fx.filter((f) => (f.t += dt) < f.life);
    const tap = this.takeTap();
    if (this.state === 'learn') { this.learnInput(tap); return; }
    if (this.step || this.q.length) { this.runQueue(dt, tap); return; }
    if (this.state === 'menu') this.menuInput(tap);
    else if (this.state === 'fight') this.fightInput(tap);
    else if (this.state === 'bag') this.bagInput(tap);
    else if (this.state === 'party') this.partyInput(tap);
    else if (this.state === 'end' && !this.finished) this.finish();
  }

  runQueue(dt, tap) {
    if (!this.step) {
      this.step = this.q.shift();
      if (!this.step) return;
      this.step.k = 0;
      const s = this.step;
      if (s.t === 'fn') { s.fn(); this.step = null; return; }
      if (s.t === 'text') { s.shown = 0; s.hold = 0; this.log.push(s.s); if (s.fn) s.fn(); }
      if (s.t === 'hp') { s.dur = Math.min(1.1, 0.35 + Math.abs(s.to - s.from) / s.max * 1.2); if (s.to < s.from) { this.blink[s.who] = 0.5; this.shake[s.who] = 0.3; } }
      if (s.t === 'anim') this.startAnim(s);
      if (s.t === 'status') { s.dur = 0.05; }
      if (s.t === 'stat') { s.dur = 0.5; G.audio.sfx(s.up ? 'pkLevel' : 'pkWeak', { v: 0.5 }); this.fx.push({ kind: s.up ? 'statup' : 'statdown', side: s.who, t: 0, life: 0.5 }); }
      if (s.t === 'faint') { s.dur = 0.8; G.audio.sfx('pkFaint'); G.audio.sfx('pkCry', { p: SPECIES[(s.who === 'me' ? this.me : this.foe).mon.species].cry * 0.75 }); }
      if (s.t === 'exp') { s.dur = 0.7; s.from = this.expDisp; G.audio.sfx('orb', { v: 0.5 }); }
      if (s.t === 'wait') s.dur = s.d;
      if (s.t === 'levelbox') { s.phase = 0; G.audio.sfx('pkLevel'); }
      if (s.t === 'catch') { this.ball = { t: 0, shakes: s.shakes, item: s.item }; G.audio.sfx('pkBall'); }
      if (s.t === 'learnPrompt') { this.learn = { mon: s.mon, move: s.move, phase: 'ask', cursor: 0 }; this.state = 'learn'; this.step = null; return; }
    }
    const s = this.step;
    const ok = this.confirm() || this.cancel() || !!tap;
    if (s.t === 'text') {
      s.shown += dt * 55;
      if (s.shown >= s.s.length) { s.hold += dt; if (ok || s.hold > (s.auto ?? 1.1)) this.step = null; }
      else if (ok) s.shown = s.s.length;
      return;
    }
    if (s.t === 'levelbox') { if (ok) { s.phase++; if (s.phase > 1) this.step = null; } return; }
    if (s.t === 'catch') { const b = this.ball; this.updateBall(dt); if (!b || b.done) this.step = null; return; }
    s.k += dt / Math.max(0.01, s.dur ?? 0.5);
    if (s.t === 'hp') this.disp[s.who] = s.from + (s.to - s.from) * ease(Math.min(1, s.k));
    if (s.t === 'faint') this.faintK[s.who] = Math.min(1, s.k);
    if (s.t === 'exp') this.expDisp = s.from + (s.to - s.from) * Math.min(1, s.k);
    if (s.k >= 1) {
      if (s.t === 'hp') this.disp[s.who] = s.to;
      if (s.t === 'exp') { this.expDisp = s.to; if (s.wrap) this.expDisp = 0; }
      this.step = null;
    }
  }

  startAnim(s) {
    s.dur = 0.55;
    const mv = MOVES[s.move] || {};
    const col = TYPES[mv.type]?.color || '#ffffff';
    if (s.kind === 'phys' || s.kind === 'spec' || s.kind === 'hit') {
      this.fx.push({ kind: s.kind === 'spec' ? 'beam' : 'lunge', from: s.who, side: s.target, color: col, t: 0, life: 0.55 });
      setTimeout(() => { this.shake[s.target] = 0.35; this.blink[s.target] = 0.45; G.audio.sfx(s.eff > 1 ? 'pkSuper' : s.eff < 1 ? 'pkWeak' : 'pkHit'); }, 260);
    } else if (s.kind === 'status') { this.fx.push({ kind: 'sparkle', side: s.target, color: col, t: 0, life: 0.55 }); G.audio.sfx('pkFlash', { v: 0.5 }); }
    else if (s.kind === 'zzz' || s.kind === 'par' || s.kind === 'brn' || s.kind === 'psn' || s.kind === 'splash') { this.fx.push({ kind: s.kind, side: s.who, t: 0, life: 0.55 }); if (s.kind === 'splash') this.shake[s.who] = 0.5; }
  }

  // Resolve a full turn once the player has chosen.
  turn(action) {
    const ev = [];
    const me = this.me, foe = this.foe;
    const foeMove = chooseMove(foe, me, Math.random, !!this.trainer);
    const doFoe = () => { if (foe.mon.hp > 0 && me.mon.hp > 0) useMove(foe, me, foeMove, ev); };
    if (action.type === 'fight') {
      const [a, b] = order(me, action.move, foe, foeMove);
      const run = (x) => { if (x.mon.hp <= 0) return; if (x === me) useMove(me, foe, action.move, ev, Math.random, { onMoney: (n) => { this.payDay = (this.payDay || 0) + n; } }); else doFoe(); };
      run(a); if (me.mon.hp > 0 && foe.mon.hp > 0) run(b);
    } else doFoe();
    if (me.mon.hp > 0 && foe.mon.hp > 0) { endOfTurn(me, ev); endOfTurn(foe, ev); }
    for (const e of ev) this.push(e);
    this.push({ t: 'fn', fn: () => this.afterTurn() });
  }

  afterTurn() {
    const me = this.me, foe = this.foe;
    if (foe.mon.hp <= 0) {
      this.push({ t: 'faint', who: 'foe' });
      this.say(`${foe.wild ? 'The wild ' : 'The foe\'s '}${monName(foe.mon)} fainted!`);
      this.giveExp(foe.mon);
      this.push({ t: 'fn', fn: () => {
        this.fi++;
        if (this.trainer && this.fi < this.foes.length) {
          const next = this.foes[this.fi];
          this.say(`${this.trainer.title} ${this.trainer.name} is about to send out ${monName(next)}.`);
          this.push({ t: 'fn', fn: () => { this.foe = battler(next, 'foe'); this.disp.foe = next.hp; this.faintK.foe = 0; this.vis.foe = 0; this.seen(next); this.slideIn('foe'); G.audio.sfx('pkCry', { p: SPECIES[next.species].cry }); this.participants = new Set([this.me.mon.uid]); } });
          this.say(`${this.trainer.title} ${this.trainer.name} sent out ${monName(next)}!`);
          this.push({ t: 'fn', fn: () => { if (this.me.mon.hp > 0) this.state = 'menu'; else this.forceSwitch(); } });
        } else this.win();
      } });
      if (me.mon.hp <= 0) this.push({ t: 'faint', who: 'me' });
      return;
    }
    if (me.mon.hp <= 0) {
      this.push({ t: 'faint', who: 'me' });
      this.say(`${monName(me.mon)} fainted!`);
      this.push({ t: 'fn', fn: () => this.forceSwitch() });
      return;
    }
    this.state = 'menu';
  }
  forceSwitch() {
    if (!this.party.some((m) => m.hp > 0)) { this.lose(); return; }
    this.state = 'party'; this.forced = true; this.pcursor = this.party.findIndex((m) => m.hp > 0);
  }
  giveExp(foeMon) {
    const share = this.run.items.includes('expShare');
    const trainer = !!this.trainer;
    for (const mon of this.party) {
      if (mon.hp <= 0) continue;
      const part = this.participants.has(mon.uid);
      if (!part && !share) continue;
      const amt = expYield(foeMon, { trainer, share: part ? 1 : 0.5 });
      const active = mon === this.me.mon;
      this.say(`${monName(mon)} gained ${amt} EXP. Points!`);
      const before = mon.level;
      const evs = gainExp(mon, amt);
      if (active) {
        // fill the bar (and roll over on level-ups)
        for (const e of evs) if (e.type === 'level') this.push({ t: 'exp', to: 1, wrap: true });
        this.push({ t: 'exp', to: expProgress(mon) });
      }
      for (const e of evs) {
        if (e.type === 'level') {
          this.push({ t: 'fn', fn: () => { if (active) this.disp.me = mon.hp; } });
          this.say(`${monName(mon)} grew to Lv. ${e.level}!`, () => G.audio.sfx('pkLevel'));
          this.push({ t: 'levelbox', mon, deltas: e.deltas, stats: e.stats });
        } else if (e.type === 'learned') this.say(`${monName(mon)} learned ${MOVES[e.move].name}!`, () => G.audio.sfx('pkLevel'));
        else if (e.type === 'learnPrompt') this.push({ t: 'learnPrompt', mon, move: e.move });
        else if (e.type === 'canEvolve' && !this.evolutions.some((x) => x.mon === mon)) this.evolutions.push({ mon, to: e.to });
      }
      if (mon.level > before) G.run.stat('pkLevels', mon.level - before);
    }
  }
  win() {
    if (this.trainer) {
      const money = this.trainer.money;
      G.audio.playMusic('pkVictory', { restart: true });
      this.say(`Alex defeated ${this.trainer.title} ${this.trainer.name}!`);
      if (this.trainer.lose) this.say(`"${this.trainer.lose}"`);
      this.say(`Alex got $${money} for winning!`, () => { G.run.addMoney(money); });
    } else G.audio.playMusic('pkVictory', { restart: true });
    if (this.payDay) this.say(`Alex picked up $${this.payDay}!`, () => G.run.addMoney(this.payDay));
    this.push({ t: 'fn', fn: () => { this.result = 'win'; this.state = 'end'; } });
  }
  lose() {
    this.say('Alex is out of usable Pokémon!');
    const lost = Math.floor(G.run.money * 0.15);
    this.say(`Alex panicked and dropped $${lost}...`, () => G.run.addMoney(-lost, true));
    this.say('... ... ...');
    this.say('Alex blacked out! (Your Pokémon were patched up with gas station bandages.)');
    this.push({ t: 'fn', fn: () => { for (const m of this.party) { m.hp = Math.max(1, Math.round(maxHp(m) * 0.5)); m.status = null; } this.result = 'lose'; this.state = 'end'; } });
  }
  finish() {
    if (this.finished) return;
    this.finished = true;
    document.getElementById('mini').removeEventListener('pointerdown', this.pointer);
    for (const m of this.party) if (m.hp > 0 && m.status === 'slp' && this.result !== 'lose') { /* stays asleep, like the games */ }
    G.lastBattle = { result: this.result, log: this.log };
    this.onDone(this.result, this.evolutions);
  }

  // ------------------------------------------------------------------------------ menus
  menuInput(tap) {
    const [dx, dy] = this.nav();
    if (dx) this.cursor = (this.cursor % 2 === 0 ? this.cursor + 1 : this.cursor - 1);
    if (dy) this.cursor = (this.cursor + 2) % 4;
    let pick = this.confirm() ? this.cursor : -1;
    if (tap && tap.menu !== undefined) pick = tap.menu;
    if (pick < 0) return;
    G.audio.sfx('uiOk', { v: 0.6 });
    if (pick === 0) { this.state = 'fight'; this.mcursor = Math.min(this.mcursor, this.me.mon.moves.length - 1); }
    if (pick === 1) { this.state = 'bag'; this.bcursor = 0; }
    if (pick === 2) { this.state = 'party'; this.forced = false; this.pcursor = this.pi; }
    if (pick === 3) this.tryRun();
  }
  fightInput(tap) {
    const moves = this.me.mon.moves;
    const [dx, dy] = this.nav();
    if (dx) this.mcursor = Math.max(0, Math.min(moves.length - 1, this.mcursor + dx));
    if (dy) this.mcursor = Math.max(0, Math.min(moves.length - 1, this.mcursor + dy * 2));
    if (this.cancel() || (tap && tap.back)) { this.state = 'menu'; return; }
    let pick = this.confirm() ? this.mcursor : -1;
    if (tap && tap.move !== undefined) pick = tap.move;
    if (pick < 0 || !moves[pick]) return;
    if (!moves.some((m) => m.pp > 0)) { this.state = 'play'; this.say(`${monName(this.me.mon)} has no moves left!`); this.turn({ type: 'fight', move: 'struggle' }); return; }
    if (moves[pick].pp <= 0) { this.say('There\'s no PP left for this move!'); return; }
    this.state = 'play';
    this.participants.add(this.me.mon.uid);
    this.turn({ type: 'fight', move: moves[pick].id });
  }
  bagList() {
    const bag = this.run.bag || {};
    return Object.keys(BAG_ITEMS).filter((k) => (bag[k] || 0) > 0 && !BAG_ITEMS[k].stone && !BAG_ITEMS[k].candy);
  }
  bagInput(tap) {
    const list = this.bagList();
    const [, dy] = this.nav();
    if (dy) this.bcursor = Math.max(0, Math.min(list.length - 1, this.bcursor + dy));
    if (this.cancel() || (tap && tap.back)) { this.state = 'menu'; return; }
    let pick = this.confirm() ? this.bcursor : -1;
    if (tap && tap.bag !== undefined) pick = tap.bag;
    const id = list[pick];
    if (pick < 0 || !id) return;
    const it = BAG_ITEMS[id];
    if (it.ball) {
      if (this.trainer) { this.state = 'play'; this.say('The Trainer blocked the Ball!'); this.say('Don\'t be a thief!'); this.push({ t: 'fn', fn: () => { this.state = 'menu'; } }); return; }
      this.run.bag[id]--;
      this.state = 'play';
      const shakes = catchShakes(this.foe, id);
      this.say(`Alex used one ${it.name}!`);
      this.push({ t: 'catch', shakes, item: id });
      this.push({ t: 'fn', fn: () => this.afterCatch(shakes) });
      G.run.stat('ballsThrown', 1);
      return;
    }
    // healing items work on the active Pokémon (revive goes to the party screen)
    if (it.revive) { this.state = 'party'; this.useItem = id; this.forced = false; this.pcursor = this.party.findIndex((m) => m.hp <= 0); if (this.pcursor < 0) { this.state = 'bag'; this.useItem = null; } return; }
    const mon = this.me.mon;
    if (it.heal) {
      if (mon.hp >= maxHp(mon)) { this.say('It won\'t have any effect.'); return; }
      this.run.bag[id]--;
      this.state = 'play';
      const from = mon.hp;
      mon.hp = Math.min(maxHp(mon), mon.hp + it.heal);
      this.say(`Alex used a ${it.name}!`, () => G.audio.sfx('pkHeal'));
      this.push({ t: 'hp', who: 'me', from, to: mon.hp, max: maxHp(mon) });
      this.say(`${monName(mon)}'s HP was restored by ${mon.hp - from} point(s).`);
      this.turn({ type: 'item' });
    }
  }
  afterCatch(shakes) {
    if (shakes >= 4) {
      const mon = this.foe.mon;
      this.say(`Gotcha! ${monName(mon)} was caught!`, () => { G.audio.sfx('pkCatch'); G.audio.stopMusic(); });
      this.push({ t: 'fn', fn: () => { const where = G.poke.addCaught(mon); if (where === 'pc') this.say(`${monName(mon)} was transferred to Bill's PC!`); this.push({ t: 'fn', fn: () => { this.result = 'caught'; this.state = 'end'; } }); } });
      return;
    }
    this.say(['Oh, no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Shoot! It was so close, too!'][shakes]);
    this.push({ t: 'fn', fn: () => { this.ball = null; this.turn({ type: 'item' }); } });
  }
  partyInput(tap) {
    const [, dy] = this.nav();
    if (dy) this.pcursor = (this.pcursor + dy + this.party.length) % this.party.length;
    if (!this.forced && (this.cancel() || (tap && tap.back))) { this.state = this.useItem ? 'bag' : 'menu'; this.useItem = null; return; }
    let pick = this.confirm() ? this.pcursor : -1;
    if (tap && tap.party !== undefined) pick = tap.party;
    if (pick < 0) return;
    const mon = this.party[pick];
    if (this.useItem) {
      if (mon.hp > 0) { this.say('It won\'t have any effect.'); return; }
      this.run.bag[this.useItem]--;
      this.useItem = null;
      mon.hp = Math.floor(maxHp(mon) / 2); mon.status = null;
      this.state = 'play';
      this.say(`${monName(mon)} was revived!`, () => G.audio.sfx('pkHeal'));
      this.turn({ type: 'item' });
      return;
    }
    if (mon.hp <= 0) { this.say(`${monName(mon)} has no energy left to battle!`); return; }
    if (pick === this.pi && this.me.mon.hp > 0) { this.say(`${monName(mon)} is already in battle!`); return; }
    const forced = this.forced;
    this.state = 'play';
    if (this.me.mon.hp > 0) this.say(`${monName(this.me.mon)}, come back!`, () => { this.vis.me = 0; });
    this.push({ t: 'fn', fn: () => { this.pi = pick; this.me = battler(mon, 'me'); this.disp.me = mon.hp; this.faintK.me = 0; this.expDisp = expProgress(mon); this.participants.add(mon.uid); } });
    this.say(`Go! ${monName(mon)}!`, () => { this.vis.me = 0; this.slideIn('me'); G.audio.sfx('pkBall'); setTimeout(() => G.audio.sfx('pkCry', { p: SPECIES[mon.species].cry }), 300); });
    if (forced) this.push({ t: 'fn', fn: () => { this.state = 'menu'; } });
    else this.push({ t: 'fn', fn: () => this.turn({ type: 'switch' }) });
  }
  tryRun() {
    this.state = 'play';
    if (this.trainer) { this.say('No! There\'s no running from a Trainer battle!'); this.push({ t: 'fn', fn: () => { this.state = 'menu'; } }); return; }
    this.runTries++;
    if (canRun(this.me, this.foe, this.runTries)) { this.say('Got away safely!', () => G.audio.sfx('dash', { v: 0.5 })); this.push({ t: 'fn', fn: () => { this.result = 'run'; this.state = 'end'; } }); }
    else { this.say('Can\'t escape!'); this.turn({ type: 'run' }); }
  }
  learnInput(tap) {
    const L = this.learn;
    const mon = L.mon, mv = MOVES[L.move];
    if (L.phase === 'ask') {
      if (!L.said) { L.said = true; this.learnText = `${monName(mon)} wants to learn ${mv.name}. But ${monName(mon)} can't learn more than four moves. Delete an older move to make room for ${mv.name}?`; }
      const [dx, dy] = this.nav();
      if (dx || dy) L.cursor = 1 - L.cursor;
      let pick = this.confirm() ? L.cursor : this.cancel() ? 1 : -1;
      if (tap && tap.yes !== undefined) pick = tap.yes;
      if (pick === 0) { L.phase = 'pick'; L.cursor = 0; }
      else if (pick === 1) { L.phase = 'stop'; L.cursor = 0; }
      return;
    }
    if (L.phase === 'stop') {
      const [dx, dy] = this.nav();
      if (dx || dy) L.cursor = 1 - L.cursor;
      this.learnText = `Stop learning ${mv.name}?`;
      let pick = this.confirm() ? L.cursor : this.cancel() ? 1 : -1;
      if (tap && tap.yes !== undefined) pick = tap.yes;
      if (pick === 0) { this.learn = null; this.state = 'play'; this.q.unshift({ t: 'text', s: `${monName(mon)} did not learn ${mv.name}.` }); }
      else if (pick === 1) { L.phase = 'ask'; L.cursor = 0; L.said = false; }
      return;
    }
    // choose a move to forget
    const [, dy] = this.nav();
    if (dy) L.cursor = (L.cursor + dy + 5) % 5;
    let pick = this.confirm() ? L.cursor : this.cancel() ? 4 : -1;
    if (tap && tap.forget !== undefined) pick = tap.forget;
    if (pick < 0) return;
    if (pick === 4) { L.phase = 'stop'; L.cursor = 0; return; }
    const old = MOVES[mon.moves[pick].id].name;
    learnMove(mon, L.move, pick);
    this.learn = null;
    this.state = 'play';
    this.q.unshift({ t: 'text', s: '1, 2, and... ... ... Poof!' }, { t: 'text', s: `${monName(mon)} forgot ${old}.` }, { t: 'text', s: 'And...' }, { t: 'text', s: `${monName(mon)} learned ${mv.name}!`, fn: () => G.audio.sfx('pkLevel') });
  }

  // ------------------------------------------------------------------------------ ball
  updateBall(dt) {
    const b = this.ball;
    b.t += dt;
    const shakeStart = 1.1;
    if (!b.flashed && b.t > 0.55) { b.flashed = true; this.fx.push({ kind: 'flash', side: 'foe', t: 0, life: 0.3 }); G.audio.sfx('pkFlash'); }
    const n = Math.min(3, b.shakes);
    const shakeEnd = shakeStart + n * 0.75;
    if (b.t > shakeStart && b.t < shakeEnd) { const i = Math.floor((b.t - shakeStart) / 0.75); if (i !== b.lastShake) { b.lastShake = i; G.audio.sfx('pkShake'); } }
    if (b.t > shakeEnd + 0.4 && !b.resolved) {
      b.resolved = true;
      if (b.shakes >= 4) { G.audio.sfx('pkShake'); this.fx.push({ kind: 'stars', side: 'foe', t: 0, life: 0.8 }); }
      else { this.fx.push({ kind: 'flash', side: 'foe', t: 0, life: 0.3 }); G.audio.sfx('pkFlash'); }
    }
    if (b.t > shakeEnd + 1.1) { b.done = true; if (b.shakes < 4) this.ball = null; }
  }

  // ------------------------------------------------------------------------------ drawing
  draw(out, cw, ch) {
    const g = this.g;
    this.hits = [];
    g.imageSmoothingEnabled = false;
    // backdrop
    const sky = g.createLinearGradient(0, 0, 0, 240);
    sky.addColorStop(0, this.bg.sky[0]); sky.addColorStop(1, this.bg.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, 240);
    g.fillStyle = this.bg.ground; g.fillRect(0, 150, W, 90);
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 150 + i * 8, W, 3); }
    const plat = (x, y, rx, ry) => { g.fillStyle = this.bg.plat[1]; g.beginPath(); g.ellipse(x, y + 3, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = this.bg.plat[0]; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
    plat(350, 132, 92, 22);
    plat(120, 228, 120, 26);
    // sprites
    const fv = ease(Math.min(1, this.vis.foe)), mv = ease(Math.min(1, this.vis.me));
    const foeX = 350 + (1 - fv) * -360 + (this.shake.foe > 0 ? Math.sin(this.t * 80) * 4 : 0);
    const meX = 112 + (1 - mv) * 360 + (this.shake.me > 0 ? Math.sin(this.t * 80) * 4 : 0);
    const lunge = (side) => { const f = this.fx.find((x) => x.kind === 'lunge' && x.from === side); return f ? Math.sin(Math.min(1, f.t / 0.3) * Math.PI) * 18 : 0; };
    const inBall = this.ball && this.ball.t > 0.55 && !(this.ball.done && this.ball.shakes < 4) && !(this.ball.resolved && this.ball.shakes < 4);
    if (this.vis.foe > 0 && !(inBall) && this.faintK.foe < 1 && !(this.blink.foe > 0 && Math.floor(this.t * 20) % 2)) this.drawMon(g, this.foe.mon, false, foeX - lunge('foe'), 140, 2, this.faintK.foe);
    if (this.vis.me > 0 && this.faintK.me < 1 && !(this.blink.me > 0 && Math.floor(this.t * 20) % 2)) this.drawMon(g, this.me.mon, true, meX + lunge('me'), 252, 2.6, this.faintK.me);
    this.drawBall(g);
    this.drawFx(g);
    // HP boxes
    if (this.vis.foe >= 1 || this.state !== 'intro') this.drawFoeBox(g);
    if (this.vis.me >= 1) this.drawMyBox(g);
    // text box + menus
    this.drawTextBox(g);
    if (this.levelBox()) this.drawLevelBox(g, this.levelBox());
    if (this.state === 'party' && !this.step && !this.q.length) this.drawParty(g);
    // blit to the screen canvas, letterboxed
    const s = Math.min(cw / W, ch / H);
    out.imageSmoothingEnabled = false;
    out.fillStyle = '#000'; out.fillRect(0, 0, cw, ch);
    out.drawImage(this.cv, (cw - W * s) / 2, (ch - H * s) / 2, W * s, H * s);
  }
  levelBox() { return this.step && this.step.t === 'levelbox' ? this.step : null; }
  drawMon(g, mon, back, x, y, scale, faint) {
    const sp = spriteCanvas(mon.species, { back, shiny: mon.shiny });
    const sz = 64 * scale * (0.75 + Math.min(1.6, SPECIES[mon.species].look.size) * 0.18);
    const bob = Math.sin(this.t * 3 + (back ? 0 : 1.5)) * 1.5;
    g.save();
    if (faint > 0) { g.beginPath(); g.rect(x - sz, y - sz * 1.3, sz * 2, sz * 1.3); g.clip(); }
    g.drawImage(sp, Math.round(x - sz / 2), Math.round(y - sz + faint * sz + bob), Math.round(sz), Math.round(sz));
    g.restore();
  }
  drawBall(g) {
    const b = this.ball;
    if (!b) return;
    const sx = 60, sy = 220, tx = 350, ty = 108;
    let x, y, rot = 0;
    if (b.t < 0.55) { const k = b.t / 0.55; x = sx + (tx - sx) * k; y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 70; rot = k * 12; }
    else if (b.t < 1.1) { const k = (b.t - 0.55) / 0.55; x = tx; y = ty + Math.min(1, k * 1.6) * 24 - Math.abs(Math.sin(k * Math.PI * 2)) * 8 * (1 - k); }
    else { x = tx; y = ty + 24; const n = Math.min(3, b.shakes), i = (b.t - 1.1) / 0.75; if (i < n) rot = Math.sin((i % 1) * Math.PI * 2) * 0.5; }
    if (b.resolved && b.shakes < 4) return;
    g.save(); g.translate(x, y); g.rotate(rot);
    const img = this._ballImg || (this._ballImg = {});
    if (!img[b.item]) { img[b.item] = new Image(); img[b.item].src = itemSprite(b.item); }
    g.drawImage(img[b.item], -12, -12, 24, 24);
    g.restore();
  }
  drawFx(g) {
    for (const f of this.fx) {
      const k = f.t / f.life;
      const pos = f.side === 'foe' ? [350, 100] : [112, 200];
      if (f.kind === 'beam') {
        const from = f.from === 'foe' ? [330, 100] : [140, 190];
        const p = Math.min(1, k * 2);
        const x = from[0] + (pos[0] - from[0]) * p, y = from[1] + (pos[1] - from[1]) * p;
        g.fillStyle = f.color; for (let i = 0; i < 6; i++) { const q = Math.max(0, p - i * 0.05); g.fillRect(from[0] + (pos[0] - from[0]) * q - 4 + i, from[1] + (pos[1] - from[1]) * q - 4 + i, 9 - i, 9 - i); }
        if (k > 0.45) { g.globalAlpha = 1 - k; g.fillStyle = f.color; g.beginPath(); g.arc(pos[0], pos[1], 10 + k * 26, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
        void x; void y;
      } else if (f.kind === 'lunge' && k > 0.45) {
        g.globalAlpha = 1 - k; g.strokeStyle = f.color; g.lineWidth = 4;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(pos[0] - 22 + i * 10, pos[1] - 20); g.lineTo(pos[0] - 6 + i * 10, pos[1] + 18); g.stroke(); }
        g.globalAlpha = 1;
      } else if (f.kind === 'sparkle' || f.kind === 'statup' || f.kind === 'statdown') {
        g.fillStyle = f.kind === 'statdown' ? '#60a5fa' : f.kind === 'statup' ? '#f87171' : f.color;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const r = 10 + k * 30; g.fillRect(pos[0] + Math.cos(a) * r - 2, pos[1] + (f.kind === 'statdown' ? k * 30 : f.kind === 'statup' ? -k * 30 : 0) + Math.sin(a) * r * 0.5 - 2, 4, 4); }
      } else if (f.kind === 'flash') { g.globalAlpha = 1 - k; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(pos[0], pos[1] + 8, 40 * (1 - k * 0.5), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
      else if (f.kind === 'stars') { g.fillStyle = '#fde047'; for (let i = 0; i < 3; i++) g.fillRect(pos[0] - 20 + i * 20, pos[1] + 10 - k * 30 - (i % 2) * 8, 5, 5); }
      else if (f.kind === 'zzz') { g.fillStyle = '#e5e7eb'; g.font = `10px ${FONT}`; g.fillText('Z', pos[0] + 10 + k * 14, pos[1] - 10 - k * 20); g.fillText('z', pos[0] + 22 + k * 10, pos[1] - 24 - k * 16); }
      else if (f.kind === 'par') { g.strokeStyle = '#fde047'; g.lineWidth = 2; g.beginPath(); g.moveTo(pos[0] - 20, pos[1] - 10); g.lineTo(pos[0] - 6, pos[1]); g.lineTo(pos[0] - 12, pos[1] + 4); g.lineTo(pos[0] + 6, pos[1] + 18); g.stroke(); }
      else if (f.kind === 'brn' || f.kind === 'psn') { g.fillStyle = f.kind === 'brn' ? '#f97316' : '#a855f7'; for (let i = 0; i < 6; i++) g.fillRect(pos[0] - 24 + i * 9, pos[1] + 20 - k * 40 - (i % 2) * 10, 5, 5); }
    }
  }
  bar(g, x, y, w, k, col, h = 4) {
    g.fillStyle = '#3a3a3a'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#585858'; g.fillRect(x, y, w, h);
    g.fillStyle = col; g.fillRect(x, y, Math.max(0, Math.round(w * k)), h);
  }
  box(g, x, y, w, h, fill = '#f8f8d8', edge = '#404040') {
    g.fillStyle = edge; g.fillRect(x, y, w, h);
    g.fillStyle = fill; g.fillRect(x + 3, y + 3, w - 6, h - 6);
  }
  text(g, s, x, y, col = '#383838', size = 10, align = 'left') {
    g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillText(s, x + 1, y + 1);
    g.fillStyle = col; g.fillText(s, x, y);
  }
  statusTag(g, mon, x, y) {
    if (!mon.status) return;
    const col = { brn: '#f08030', par: '#f8d030', psn: '#a040a0', tox: '#a040a0', slp: '#8c8c8c', frz: '#98d8d8' }[mon.status];
    g.fillStyle = col; g.fillRect(x, y - 9, 30, 11);
    this.text(g, STATUS_NAMES[mon.status], x + 3, y, '#fff', 8);
  }
  drawFoeBox(g) {
    const m = this.foe.mon, x = 16, y = 18;
    this.box(g, x, y, 200, 52);
    this.text(g, monName(m).toUpperCase().slice(0, 12), x + 10, y + 20);
    this.text(g, 'Lv' + m.level, x + 190, y + 20, '#383838', 10, 'right');
    if (G.poke?.dexCaught(m.species) && this.foe.wild) { g.fillStyle = '#e11d48'; g.beginPath(); g.arc(x + 158, y + 16, 4, Math.PI, 0); g.fill(); g.fillStyle = '#f8f8f8'; g.beginPath(); g.arc(x + 158, y + 16, 4, 0, Math.PI); g.fill(); }
    this.text(g, 'HP', x + 18, y + 40, '#f8b030', 8);
    const k = this.disp.foe / maxHp(m);
    this.bar(g, x + 40, y + 34, 140, k, hpColor(k));
    this.statusTag(g, m, x + 10, y + 50);
  }
  drawMyBox(g) {
    const m = this.me.mon, x = 256, y = 160;
    this.box(g, x, y, 212, 70);
    this.text(g, monName(m).toUpperCase().slice(0, 12), x + 12, y + 20);
    this.text(g, 'Lv' + m.level, x + 200, y + 20, '#383838', 10, 'right');
    this.text(g, 'HP', x + 20, y + 38, '#f8b030', 8);
    const mh = maxHp(m), k = this.disp.me / mh;
    this.bar(g, x + 44, y + 32, 150, k, hpColor(k));
    this.text(g, `${Math.ceil(this.disp.me)}/${mh}`, x + 194, y + 54, '#383838', 9, 'right');
    this.statusTag(g, m, x + 12, y + 54);
    this.text(g, 'EXP', x + 12, y + 65, '#3080f0', 7);
    this.bar(g, x + 44, y + 59, 150, this.expDisp, '#40a8f8', 3);
  }
  drawTextBox(g) {
    const y = 240;
    g.fillStyle = '#284860'; g.fillRect(0, y, W, 80);
    g.fillStyle = '#c84040'; g.fillRect(4, y + 4, W - 8, 72);
    g.fillStyle = '#284860'; g.fillRect(8, y + 8, W - 16, 64);
    const s = this.step;
    let msg = '';
    if (s && s.t === 'text') msg = s.s.slice(0, Math.floor(s.shown));
    else if (this.state === 'menu' && !s && !this.q.length) msg = `What will ${monName(this.me.mon)} do?`;
    else if (this.state === 'learn') msg = this.learnText || '';
    else if (s && s.t === 'levelbox') msg = `${monName(s.mon)} grew to Lv. ${s.mon.level}!`;
    if (this.state === 'fight' && !s && !this.q.length) { this.drawMoves(g); return; }
    if (this.state === 'bag' && !s && !this.q.length) { this.drawBag(g); return; }
    const wrapW = this.state === 'menu' && !s && !this.q.length ? 220 : 440;
    this.wrapText(g, msg, 20, y + 30, wrapW, 18, '#f8f8f8');
    if (s && s.t === 'text' && s.shown >= s.s.length && Math.floor(this.t * 3) % 2) { g.fillStyle = '#f87171'; g.beginPath(); g.moveTo(452, y + 58); g.lineTo(462, y + 58); g.lineTo(457, y + 64); g.fill(); }
    if (this.state === 'menu' && !s && !this.q.length) this.drawMainMenu(g);
    if (this.state === 'learn') this.drawLearn(g);
  }
  wrapText(g, s, x, y, w, lh, col) {
    g.font = `10px ${FONT}`;
    const words = s.split(' ');
    let line = '', yy = y;
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (g.measureText(test).width > w && line) { this.text(g, line, x, yy, col); line = wd; yy += lh; } else line = test;
    }
    if (line) this.text(g, line, x, yy, col);
  }
  drawMainMenu(g) {
    const x = 250, y = 244;
    this.box(g, x, y, 226, 72, '#f8f8f8', '#706880');
    const labels = ['FIGHT', 'BAG', 'POKéMON', 'RUN'];
    labels.forEach((l, i) => {
      const cx = x + 26 + (i % 2) * 104, cy = y + 30 + Math.floor(i / 2) * 26;
      this.text(g, l, cx, cy, '#484848', 10);
      if (this.cursor === i) { g.fillStyle = '#484848'; g.beginPath(); g.moveTo(cx - 14, cy - 9); g.lineTo(cx - 6, cy - 5); g.lineTo(cx - 14, cy - 1); g.fill(); }
      this.hits.push({ x: cx - 18, y: cy - 16, w: 100, h: 24, menu: i });
    });
  }
  drawMoves(g) {
    const moves = this.me.mon.moves;
    this.box(g, 0, 240, 320, 80, '#f8f8f8', '#706880');
    moves.forEach((m, i) => {
      const cx = 24 + (i % 2) * 150, cy = 272 + Math.floor(i / 2) * 26;
      this.text(g, MOVES[m.id].name.toUpperCase().slice(0, 13), cx, cy, m.pp > 0 ? '#484848' : '#a0a0a0', 9);
      if (this.mcursor === i) { g.fillStyle = '#484848'; g.beginPath(); g.moveTo(cx - 14, cy - 9); g.lineTo(cx - 6, cy - 5); g.lineTo(cx - 14, cy - 1); g.fill(); }
      this.hits.push({ x: cx - 18, y: cy - 16, w: 146, h: 24, move: i });
    });
    const m = moves[this.mcursor];
    this.box(g, 320, 240, 160, 80, '#f8f8f8', '#706880');
    if (m) {
      const mv = MOVES[m.id];
      this.text(g, 'PP', 336, 270, '#484848', 9);
      this.text(g, `${m.pp}/${m.max}`, 462, 270, m.pp / m.max < 0.25 ? '#e04040' : '#484848', 9, 'right');
      g.fillStyle = TYPES[mv.type].color; g.fillRect(334, 282, 130, 16);
      this.text(g, `TYPE/${TYPES[mv.type].name.toUpperCase()}`, 340, 294, '#fff', 8);
      this.text(g, mv.cat === 'status' ? 'STATUS' : `${mv.cat === 'phys' ? 'PHYS' : 'SPEC'} ${mv.power}`, 340, 312, '#484848', 7);
    }
    this.hits.push({ x: 320, y: 240, w: 160, h: 80, back: true });
  }
  drawBag(g) {
    const list = this.bagList();
    this.box(g, 0, 240, W, 80, '#f8f8f8', '#706880');
    if (!list.length) { this.text(g, 'The BAG is empty. (Buy Poké Balls at the gas station.)', 20, 270, '#484848', 8); this.hits.push({ x: 0, y: 240, w: W, h: 80, back: true }); return; }
    const start = Math.max(0, Math.min(this.bcursor - 1, list.length - 3));
    list.slice(start, start + 3).forEach((id, j) => {
      const i = start + j, cy = 262 + j * 20;
      this.text(g, `${BAG_ITEMS[id].name.toUpperCase()}`, 40, cy, '#484848', 9);
      this.text(g, `x${this.run.bag[id]}`, 300, cy, '#484848', 9, 'right');
      if (this.bcursor === i) { g.fillStyle = '#484848'; g.beginPath(); g.moveTo(22, cy - 9); g.lineTo(30, cy - 5); g.lineTo(22, cy - 1); g.fill(); }
      this.hits.push({ x: 20, y: cy - 14, w: 300, h: 20, bag: i });
    });
    const it = BAG_ITEMS[list[this.bcursor]];
    if (it) this.wrapText(g, it.desc, 324, 262, 140, 14, '#484848');
    this.text(g, 'BACK', 440, 312, '#a04040', 8, 'right');
    this.hits.push({ x: 380, y: 296, w: 100, h: 24, back: true });
  }
  drawParty(g) {
    g.fillStyle = 'rgba(16,40,72,.94)'; g.fillRect(0, 0, W, 240);
    this.text(g, this.forced ? 'Choose a POKéMON.' : this.useItem ? 'Use on which POKéMON?' : 'Switch to which POKéMON?', 20, 22, '#f8f8f8', 10);
    this.party.forEach((m, i) => {
      const x = i % 2 ? 244 : 12, y = 32 + Math.floor(i / 2) * 68;
      this.box(g, x, y, 224, 62, this.pcursor === i ? '#f8e0a0' : m.hp <= 0 ? '#e0b0b0' : '#d8f0f8', this.pcursor === i ? '#f87030' : '#5070a0');
      g.drawImage(spriteCanvas(m.species, { shiny: m.shiny }), x + 4, y + 4, 52, 52);
      this.text(g, monName(m).toUpperCase().slice(0, 11), x + 60, y + 20, '#383838', 9);
      this.text(g, 'Lv' + m.level, x + 216, y + 20, '#383838', 9, 'right');
      const mh = maxHp(m);
      this.bar(g, x + 60, y + 30, 150, m.hp / mh, hpColor(m.hp / mh));
      this.text(g, `${m.hp}/${mh}`, x + 216, y + 52, '#383838', 8, 'right');
      this.statusTag(g, m, x + 60, y + 52);
      this.hits.push({ x, y, w: 224, h: 62, party: i });
    });
    if (!this.forced) { this.text(g, 'CANCEL', 460, 230, '#f8f8f8', 9, 'right'); this.hits.push({ x: 380, y: 214, w: 100, h: 24, back: true }); }
  }
  drawLevelBox(g, s) {
    const x = 300, y = 20;
    this.box(g, x, y, 170, 150, '#f8f8f8', '#706880');
    ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach((k, i) => {
      const yy = y + 26 + i * 20;
      this.text(g, STAT_NAMES[k].toUpperCase(), x + 14, yy, '#484848', 8);
      this.text(g, s.phase === 0 ? `+${s.deltas[k]}` : String(s.stats[k]), x + 156, yy, '#484848', 9, 'right');
    });
  }
  drawLearn(g) {
    const L = this.learn;
    if (!L) return;
    if (L.phase === 'ask' || L.phase === 'stop') {
      this.box(g, 380, 180, 92, 58, '#f8f8f8', '#706880');
      ['YES', 'NO'].forEach((t, i) => { const cy = 204 + i * 22; this.text(g, t, 406, cy, '#484848', 10); if (L.cursor === i) { g.fillStyle = '#484848'; g.beginPath(); g.moveTo(392, cy - 9); g.lineTo(400, cy - 5); g.lineTo(392, cy - 1); g.fill(); } this.hits.push({ x: 380, y: cy - 16, w: 92, h: 22, yes: i }); });
      return;
    }
    g.fillStyle = 'rgba(16,40,72,.95)'; g.fillRect(0, 0, W, 240);
    this.text(g, 'Which move should be forgotten?', 20, 24, '#f8f8f8', 9);
    const all = [...L.mon.moves.map((m) => m.id), L.move];
    all.forEach((id, i) => {
      const mv = MOVES[id], y = 40 + i * 38;
      this.box(g, 20, y, 300, 34, L.cursor === i ? '#f8e0a0' : i === 4 ? '#e0f0d0' : '#f8f8f8', L.cursor === i ? '#f87030' : '#706880');
      g.fillStyle = TYPES[mv.type].color; g.fillRect(28, y + 9, 50, 16);
      this.text(g, TYPES[mv.type].name.toUpperCase().slice(0, 5), 31, y + 21, '#fff', 7);
      this.text(g, mv.name.toUpperCase(), 86, y + 22, '#383838', 9);
      this.text(g, i === 4 ? 'NEW' : `PP ${L.mon.moves[i].pp}/${L.mon.moves[i].max}`, 312, y + 22, '#383838', 8, 'right');
      this.hits.push({ x: 20, y, w: 300, h: 34, forget: i });
    });
    const mv = MOVES[all[L.cursor]];
    this.box(g, 330, 40, 140, 110, '#f8f8f8', '#706880');
    this.text(g, mv.cat === 'status' ? 'STATUS' : `POWER ${mv.power}`, 340, 64, '#383838', 8);
    this.text(g, `ACC ${mv.acc || '---'}`, 340, 84, '#383838', 8);
    this.text(g, mv.cat.toUpperCase(), 340, 104, '#383838', 8);
    this.text(g, L.cursor === 4 ? '(don\'t learn)' : '', 340, 124, '#a04040', 7);
  }
  get canPause() { return false; }
}

// After a battle (or any time), a Pokémon may need to learn a move with a full set.
export { evolutionFor };
