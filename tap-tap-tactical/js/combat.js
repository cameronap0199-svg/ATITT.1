// The rail-shooter room: cover and pop-up, shooting, the DDR utility belt, waves, the
// Psychosis System's in-room effects, Terminal Overload and the flatline.

import {
  W, H, WEAPONS, CONSUMABLES, TIERS, ENEMIES, itemById, floorMult, speedMult, IFRAMES, LOAD_DRAIN,
  JOLT, DDR_MISS_LOAD, BOTCH_LOAD, PERFECT_RELOAD_RELIEF, OVERLOAD_SECONDS, BARKS, WARDEN_LINES, AARON_LINES, NODE_TYPES,
} from './data.js';
import { Chart, randomSteps, dirForCode, DIRS } from './ddr.js';
import { vitalsState } from './psyche.js';
import { buildScene, drawSceneDynamic, drawProp, drawBarrier, drawHands, CROUCH_SHIFT, STAND_TOP, CROUCH_TOP } from './scene.js';
import { Soldier, Prisoner, Berserker, Crawler, Warden, Aaron } from './enemies.js';
import { drawTrack } from './ddrView.js';
import {
  TRACK, coverLayout, inRect, drawCoverUI, drawAmmo, drawCombo, drawCrosshair, drawSubtitle, drawBossBar, drawBanner,
} from './hud.js';
import { drawRat, drawHorse, drawEye, drawGrain, drawGuilt, makeCracks, drawCracks, drawShatter, drawPowerDown } from './hallucinations.js';
import { drawGun } from './viewmodel.js';
import { text, FONT, COLORS, clamp, lerp, dist, hash, scanlines, vignette, roundRect } from './render.js';
import { sfx, speak, setTempo } from './audio.js';
import { input } from './input.js';

const SKIN_FOR = { reload: 'brass', consumable: 'pill', emergency: 'pill' };

export class CombatRoom {
  constructor(game, cfg) {
    this.game = game;
    this.run = game.run;
    this.cfg = cfg;
    this.kind = cfg.kind;
    this.rng = game.rng;
    const floor = this.run.floor;
    this.hpMult = floorMult(floor);
    this.dmgMult = floorMult(floor);
    this.speed = speedMult(floor);
    this.scene = buildScene(this.rng, cfg.theme, { boss: cfg.kind === 'boss' });
    this.spots = this.scene.spots;
    this.enemies = [];
    this.grenades = [];
    this.bolts = [];
    this.stuck = [];
    this.blasts = [];
    this.parts = [];
    this.floats = [];
    this.eyes = [];
    this.ghosts = [];
    this.horse = null;
    this.ddr = null;
    this.ddrFx = [];
    this.t = game.time;
    this.t0 = game.time;
    this.state = 'intro';
    this.stand = 0;
    this.exposedT = 0;
    this.iframes = 0;
    this.fireCd = 0;
    this.recoil = 0;
    this.muzzle = 0;
    this.shake = 0.8;
    this.hitFlash = 0;
    this.guilt = 0;
    this.fireT = 0;
    this.fireTick = 0;
    this.bile = 0;
    this.flood = 0;
    this.unlimited = 0;
    this.adrenaline = 0;
    this.throwReady = null;
    this.frozen = false;
    this.overload = null;
    this.death = null;
    this.sub = null;
    this.subQueue = [];
    this.banner = { text: NODE_TYPES[cfg.node || 'combat'].tag, sub: `${this.scene.theme.name} // FLOOR ${floor}${floor > 1 ? ` // THREAT ×${floorMult(floor).toFixed(2)}` : ''}`, t0: this.t, dur: 1.8, y: 250, color: COLORS.phosphor };
    this.comboFx = { pulse: 0, snap: 0 };
    this.waves = cfg.waves || [];
    this.waveIdx = -1;
    this.spawnQueue = [];
    this.spawnT = 0.6;
    this.waveGap = 0;
    this.prisonerT = this.kind === 'boss' ? Infinity : this.rng.range(4, 9);
    this.phantomT = this.rng.range(3, 6);
    this.horseT = this.rng.range(3, 7);
    this.eyeT = 1;
    this.ghostT = 0;
    this.kills = 0;
    this.scrap = 0;
    this.boss = null;
    this.bossName = '';
    this.spawnedTotal = 0;
    this.quarantineTotal = this.waves.flat().length;
    this.hints = cfg.kind === 'initiation' && this.run.floor === 1 ? { popped: false, fired: false, ducked: false, reloaded: false } : null;
    this.clearT = 0;
    this.barkT = 0;
    this.st = game.stats();
    this.ringMul = 1 + this.st.ringSlow;
    this.burnDps = 15;
    if (this.kind === 'boss') this.bossIntro();
    else if (this.rng.chance(0.5)) this.say('SUBJECT 87', this.rng.pick(BARKS.roomStart), 2.4);
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------
  get exposed() { return this.stand > 0.55; }
  cursor() { return this.stand > 0.5 && !this.death ? 'none' : 'default'; }
  get barrierTop() { return lerp(CROUCH_TOP, STAND_TOP, this.stand); }
  shift() {
    const intro = this.state === 'intro' ? Math.max(0, 1 - (this.t - this.t0) / 0.5) * 140 : 0;
    return CROUCH_SHIFT * (1 - this.stand) - intro;
  }
  has(id) {
    if (this.st.suppress.includes(id)) return false;
    return this.run.psyche.has(id);
  }
  sfxOnce(name) { sfx(name); }
  say(who, line, dur) {
    const d = dur || clamp(line.length * 0.055, 2.2, 6.5);
    const entry = { who, text: line, dur: d };
    if (this.sub && this.t - this.sub.t0 < this.sub.dur - 0.3) this.subQueue.push(entry);
    else this.showSub(entry);
  }
  showSub(entry) {
    this.sub = { ...entry, t0: this.t };
    speak(entry.text, entry.who === 'SUBJECT 87' ? { pitch: 0.8, rate: 1.05 } : entry.who.includes('A-4RON') ? { pitch: 0.4, rate: 0.85 } : { pitch: 0.6, rate: 0.95 });
  }
  bark(kind, chance = 1) {
    if (this.t < this.barkT || !this.rng.chance(chance)) return;
    this.barkT = this.t + 6;
    this.say('SUBJECT 87', this.rng.pick(BARKS[kind]));
  }
  setBanner(textStr, sub, color = '#fff', dur = 1.6, y = 250) { this.banner = { text: textStr, sub, color, t0: this.t, dur, y }; }
  floatText(x, y, str, color = '#fff', screen = false) { this.floats.push({ x, y, text: str, color, t0: this.t, screen }); }
  burst(x, y, color, n = 8, { speed = 240, size = 3, grav = 500, life = 0.5, screen = false } = {}) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const v = speed * (0.3 + this.rng() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life, max: life, color, size: size * (0.6 + this.rng() * 0.8), grav, screen });
    }
  }
  hostiles() { return this.enemies.filter((e) => e.hostile && !e.dead); }

  // -------------------------------------------------------------------------
  // waves & spawning
  // -------------------------------------------------------------------------
  spawn(type) {
    let e = null;
    if (type === 'angel' || type === 'elite' || type === 'ember' || type === 'phantom') {
      let free = this.spots.filter((s) => !s.enemy);
      if (type === 'ember') free = free.filter((s) => s.z < 0.6).length ? free.filter((s) => s.z < 0.6) : free;
      if (!free.length) return false;
      e = new Soldier(this, type, this.rng.pick(free));
    } else if (type === 'berserker') {
      if (this.enemies.filter((x) => x instanceof Berserker && x.alive).length >= 2) return false;
      e = new Berserker(this);
    } else if (type === 'crawler') e = new Crawler(this);
    else if (type === 'prisoner') e = new Prisoner(this);
    else if (type === 'warden') { e = new Warden(this, this.run.floor); this.boss = e; this.bossName = e.name; } else if (type === 'aaron') {
      e = new Aaron(this);
      this.boss = e;
      this.bossName = e.name;
      sfx('wetlaugh');
      this.say(...AARON_LINES.intro);
      this.say(...AARON_LINES.intro87);
    }
    if (!e) return false;
    this.enemies.push(e);
    if (e.hostile) this.spawnedTotal++;
    if (!this.run.seen.includes(type) && ENEMIES[type]?.voice && type !== 'phantom' && type !== 'prisoner') {
      this.run.seen.push(type);
      this.say('SUBJECT 87', ENEMIES[type].voice);
    }
    return true;
  }
  nextWave() {
    this.waveIdx++;
    if (this.waveIdx >= this.waves.length) return false;
    this.spawnQueue.push(...this.waves[this.waveIdx]);
    if (this.waves.length > 1 && this.kind !== 'boss' && this.waveIdx > 0) {
      const left = this.quarantineTotal - this.spawnedTotal;
      this.floatText(W / 2, 200, this.kind === 'quarantine' ? `CONTAINMENT: ${left} HOSTILES REMAIN` : `WAVE ${this.waveIdx + 1}/${this.waves.length}`, COLORS.amber, true);
    }
    return true;
  }
  bossSummon(types) {
    for (const t of types) this.spawnQueue.push(t);
    this.floatText(W / 2, 200, 'REINFORCEMENTS', COLORS.cyan, true);
  }
  bossIntro() {
    sfx('bell');
    if (this.run.floor === 1) this.say(...WARDEN_LINES.intro);
    else this.say(WARDEN_LINES.introRepeat[0], WARDEN_LINES.introRepeat[1].replace('{n}', String(Math.min(9, this.run.floor))));
  }
  phaseChange(p) {
    sfx('bell');
    this.shake = 0.7;
    if (p === 2) {
      setTempo(1.25);
      this.say(...WARDEN_LINES.phase2);
      this.setBanner('PHASE 2', 'THE WORLD DANCES FASTER', COLORS.cyan);
    } else {
      setTempo(1.4);
      this.say(...WARDEN_LINES.phase3);
      this.setBanner('PHASE 3', 'THE FALLING STAR — SHOOT THE CORE', COLORS.violet);
    }
  }

  // -------------------------------------------------------------------------
  // enemy → player
  // -------------------------------------------------------------------------
  enemyFire(e, dmg, load) {
    sfx('enemyShot');
    if (this.exposed) this.hurt(dmg * this.dmgMult, load);
    else if (this.rng.chance(0.5)) {
      sfx('ricochet');
      this.burst(this.rng.range(200, 1080), this.barrierTop, '#ffe7a0', 5, { screen: true, speed: 200 });
    }
  }
  phantomFire() { sfx('glitch'); }
  meleeStrike(e, dmg, load, bunkerBuster) {
    this.shake = Math.max(this.shake, 0.6);
    sfx('slam');
    if (bunkerBuster || this.exposed) this.hurt(dmg * this.dmgMult, load);
    else this.floatText(W / 2, 330, 'DODGED', COLORS.phosphor, true);
  }
  bossBarrage(b, dmg, load) {
    sfx('cannon');
    this.shake = Math.max(this.shake, 0.5);
    if (this.exposed) this.hurt(dmg * this.dmgMult, load);
  }
  laserWarning() {
    sfx('laserCharge');
    this.setBanner('▼ GET DOWN ▼', 'THE GREAT DIVIDER', COLORS.cyan, 1.1, 200);
  }
  laserSweep(dmg) {
    if (this.exposed) this.hurt(dmg * this.dmgMult, 6);
    else this.floatText(W / 2, 260, 'DUCKED', COLORS.phosphor, true);
  }
  finalJudgment() {
    sfx('explosion');
    this.shake = 1.2;
    this.hitFlash = 1;
    this.hurt(45 * this.dmgMult, 0, { bypass: true });
    if (!this.death) {
      this.setBanner('JUDGMENT', 'COGNITIVE LOAD REDLINED', '#fff', 1.4);
      this.game.addLoad(100);
    }
  }
  telegraphGrenade(e) { e.arcTarget = this.rng.range(360, 920); }
  throwGrenade(e, kind = 'ember') {
    const from = kind === 'bile' ? e.mouth() : { x: e.x + 40 * e.s, y: e.y - 262 * e.s };
    const tx = kind === 'bile' ? this.rng.range(420, 860) : e.arcTarget ?? this.rng.range(360, 920);
    this.grenades.push({ kind, sx: from.x, sy: from.y, tx, p: 0, dur: 1.5 / Math.sqrt(this.speed), x: from.x, y: from.y, r: 26 });
    sfx('throw');
  }

  hurt(amount, load = 0, opts = {}) {
    if (this.death) return false;
    if (this.run.cheats.invincible) { this.hitFlash = 0.25; return false; }
    if (this.iframes > 0 && !opts.tick && !opts.bypass) return false;
    amount *= 1 - this.st.resist;
    this.run.hp -= amount;
    if (!opts.tick) {
      this.iframes = IFRAMES;
      this.game.ekg.hurt();
      this.hitFlash = 1;
      this.shake = Math.max(this.shake, 0.5);
      sfx('hurt');
      this.breakCombo();
      this.bark('hurt', 0.25);
    } else this.hitFlash = Math.max(this.hitFlash, 0.3);
    if (load) this.game.addLoad(load);
    if (this.run.hp <= 0) {
      if (this.st.lazarus && !this.run.lazarusUsed) {
        this.run.hp = 1;
        this.run.lazarusUsed = true;
        this.setBanner('LAZARUS FIRMWARE', 'REBOOT SUCCESSFUL. FIXED RISING.', COLORS.phosphor, 2);
        sfx('reward');
      } else this.die('flatline');
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // combo
  // -------------------------------------------------------------------------
  comboHit() {
    this.run.combo.hit();
    this.comboFx.pulse = 1;
    this.game.onComboHit?.();
  }
  missShot() {
    if (this.st.forgive && this.rng() < this.st.forgive) { this.floatText(input.mouse.x, input.mouse.y - 30, 'FORGIVEN', '#ffd24a', true); return; }
    this.breakCombo();
  }
  breakCombo() {
    if (this.run.combo.snap()) {
      this.comboFx.snap = 1;
      this.game.addLoad(JOLT);
    }
  }

  // -------------------------------------------------------------------------
  // shooting
  // -------------------------------------------------------------------------
  spread() {
    if (this.adrenaline > 0) return 0;
    return clamp((this.exposedT - 1.3) * 16, 0, 60);
  }
  tryFire(fromClick) {
    const w = this.run.weapons[this.run.current];
    const def = WEAPONS[w.id];
    if (this.fireCd > 0) return;
    if (!def.auto && !fromClick) return;
    if (w.ammo <= 0 && this.unlimited <= 0) {
      if (fromClick) { sfx('empty'); this.fireCd = 0.2; }
      return;
    }
    this.fireCd = def.interval * (this.adrenaline > 0 ? 0.7 : 1);
    const overload = w.overload;
    if (this.unlimited <= 0) {
      w.ammo--;
      if (w.ammo <= 0) w.overload = false;
    }
    sfx(def.sound);
    this.recoil = 1;
    this.muzzle = 0.07;
    if (def.tier === 'heavy' || w.id === 'slapper' || w.id === 'railgun') this.shake = Math.max(this.shake, 0.25);
    this.burst(930, 610, '#d9a84a', 1, { screen: true, speed: 380, size: 4, grav: 1400, life: 0.7 });
    if (this.hints) this.hints.fired = true;
    const dmg = def.dmg * (1 + this.st.dmgMul) * (overload ? 1.5 : 1);
    const spread = this.spread();
    const ax = input.mouse.x, ay = input.mouse.y;
    const shift = this.shift();
    const jitter = () => { const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * spread; return [Math.cos(a) * r, Math.sin(a) * r]; };
    const [jx, jy] = jitter();
    if (w.id === 'needler') {
      this.bolts.push({ x: 930, y: 560, tx: ax + jx, ty: ay + jy, dmg, homing: this.nearestHostile(ax + jx, ay + jy + shift, 110) });
      return;
    }
    if (w.id === 'thurible') {
      this.blasts.push({ x: ax + jx, y: ay + jy + shift, t: 0.22, r: def.splash, dmg, judge: true });
      return;
    }
    const pellets = def.pellets || 1;
    let anyHit = false;
    for (let i = 0; i < pellets; i++) {
      let ox = 0, oy = 0;
      if (def.pattern === 'quad') { ox = (i % 2 ? 1 : -1) * 16; oy = (i < 2 ? -1 : 1) * 16; } else if (pellets > 1) {
        const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * def.spread;
        ox = Math.cos(a) * r; oy = Math.sin(a) * r;
      }
      const res = this.resolveShot(ax + jx + ox, ay + jy + oy + shift, dmg, { pierce: def.pierce, quiet: i > 0 });
      if (res.hit) anyHit = true;
      if (res.prisoner || res.phantom) { anyHit = false; break; }
    }
    if (def.pierce) { this.parts.push({ beam: true, x0: 900, y0: 560, x1: ax + jx, y1: ay + jy, life: 0.15, max: 0.15, screen: true }); }
    if (anyHit) this.comboHit(); else this.missShot();
  }

  nearestHostile(x, y, radius) {
    let best = null, bd = radius;
    for (const e of this.enemies) {
      if (!e.alive || !e.hostile) continue;
      const cy = e.y - 150 * e.s;
      const d = dist(x, y, e.x, cy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Resolve one bullet at scene coordinates. Front-most target takes it.
  resolveShot(sx, sy, dmg, { pierce = false, quiet = false } = {}) {
    const shift = this.shift();
    for (const g of this.grenades) {
      if (dist(sx, sy - shift, g.x, g.y - shift) < g.r + 8) {
        this.detonateGrenade(g);
        return { hit: true };
      }
    }
    const targets = this.enemies.filter((e) => e.alive).sort((a, b) => b.z - a.z);
    let hit = false;
    for (const e of targets) {
      const r = e.hitTest(sx, sy);
      if (!r) continue;
      if (r.part === 'ring') {
        r.ring.broken = 0.001;
        sfx('ping');
        this.burst(r.ring.x, r.ring.y, '#7affc1', 10);
        return { hit: true };
      }
      if (e.phantom) {
        e.dead = true;
        e.spot.enemy = null;
        sfx('glitch');
        this.floatText(sx, sy, 'NOT REAL', '#ff3df2');
        return { hit: false, phantom: true };
      }
      if (r.part === 'armor' || r.part === 'shield') {
        if (!quiet) sfx('ping');
        this.burst(sx, sy, r.part === 'armor' ? '#e8c8ff' : '#fff', 6, { speed: 300, size: 2.5 });
        if (!quiet) this.floatText(sx, sy - 10, 'PING', '#e8c8ff');
        if (!pierce) return { hit: false, ping: true };
        continue;
      }
      if (e instanceof Prisoner) {
        e.damage(999, 'body');
        this.burst(sx, sy, '#7a0a10', 16);
        return { hit: false, prisoner: true };
      }
      const mul = r.part === 'head' ? 2 : r.part === 'weak' ? r.mul || 1 : 1;
      const dealt = this.run.cheats.oneShot ? 99999 : dmg * mul;
      e.damage(dealt, r.part);
      if (!quiet) sfx(r.part === 'head' || r.part === 'weak' ? 'headshot' : 'hit');
      this.burst(sx, sy, e instanceof Berserker ? '#ff4d8d' : e.boss ? '#e8e2d2' : '#8a0f16', r.part === 'weak' ? 12 : 6);
      if (r.part === 'head' && !quiet) this.floatText(sx, sy - 18, 'HEADSHOT', COLORS.gold);
      if (r.part === 'weak' && !quiet) this.floatText(sx, sy - 18, e instanceof Warden ? `CORE ${e.coreHits % 15 || 15}/15` : 'WEAK POINT', '#ff9ad0');
      hit = true;
      if (!pierce) return { hit: true };
    }
    if (!hit) this.burst(sx, sy, '#bbb', 3, { speed: 120, size: 2 });
    return { hit };
  }

  explode(x, y, r, dmg, { harmlessToPlayer = true } = {}) {
    sfx('explosion');
    this.shake = Math.max(this.shake, 0.35);
    this.parts.push({ ring: true, x, y, r, life: 0.35, max: 0.35 });
    this.burst(x, y, '#ffb020', 18, { speed: 380, size: 4 });
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.phantom) continue;
      if (dist(x, y, e.x, e.y - 130 * e.s) < r + 40 * e.s) {
        if (e instanceof Warden && e.phase === 3) continue;
        if (e instanceof Berserker) { e.flash = 1; continue; }
        e.damage(this.run.cheats.oneShot ? 99999 : dmg, 'body');
        if (e.hostile) n++;
      }
    }
    return n;
  }

  detonateGrenade(g) {
    const idx = this.grenades.indexOf(g);
    if (idx >= 0) this.grenades.splice(idx, 1);
    this.floatText(g.x, g.y - 30, 'INTERCEPTED', COLORS.phosphor);
    if (g.kind === 'bile') { sfx('splash'); this.burst(g.x, g.y, '#0a0a0a', 20); return; }
    this.explode(g.x, g.y, 120, ENEMIES.ember.splash);
  }

  // -------------------------------------------------------------------------
  // DDR utility (cover only)
  // -------------------------------------------------------------------------
  startDDR(kind, steps, opts, meta) {
    if (this.overload && kind !== 'emergency') return false;
    if (this.stand > 0.2 && kind !== 'emergency') { this.floatText(W / 2, 420, 'DROP INTO COVER FIRST', COLORS.amber, true); return false; }
    if (this.ddr && this.ddr.kind !== 'emergency') this.cancelDDR(true);
    const chart = new Chart(steps, {
      rng: this.rng, now: this.t, windowScale: 1 + this.st.window,
      forgive: this.st.forgive ? () => this.rng() < this.st.forgive : null,
      ...opts,
    });
    this.ddr = { kind, chart, skin: meta.skin || SKIN_FOR[kind], label: meta.label, ...meta };
    this.ddrFx = [];
    this.ghosts = [];
    return true;
  }
  startReload(i) {
    const w = this.run.weapons[i];
    if (!w) return;
    const def = WEAPONS[w.id];
    if (w.ammo >= def.mag) { this.floatText(410, 190 + i * 92, 'MAG FULL', '#9fb', true); return; }
    const tier = TIERS[def.tier];
    const n = this.rng.int(tier.min, tier.max);
    const steps = randomSteps(this.rng, n, { doubles: def.tier === 'heavy' || def.tier === 'experimental' ? 0.12 : 0 });
    if (this.startDDR('reload', steps, { spacing: tier.spacing, travel: tier.travel, clusters: tier.clusters, stutter: tier.stutter, onMiss: 'restart' }, { weapon: i, label: `RELOAD // ${def.name.toUpperCase()}`, sub: `${tier.label} ×${n}` })) {
      sfx('swap');
      if (this.hints) this.hints.reloaded = true;
    }
  }
  useConsumable(i) {
    const id = this.run.consumables[i];
    if (!id) return;
    const c = CONSUMABLES[id];
    this.startDDR('consumable', randomSteps(this.rng, c.notes), { spacing: c.spacing, travel: c.travel, onMiss: 'fail' }, { slot: i, item: id, label: c.name.toUpperCase(), sub: 'ADMINISTER' });
  }
  useActive(i) {
    const a = this.run.actives[i];
    if (!a) return;
    if (a.used) { this.floatText(910, 190, 'SPENT THIS ROOM', '#888', true); return; }
    const item = itemById(a.id);
    const act = item.active;
    this.startDDR('active', randomSteps(this.rng, act.notes), { spacing: 0.32, travel: 1.1, onMiss: 'fail' }, { slot: i, item: a.id, skin: act.skin, label: item.name.toUpperCase(), sub: 'INVOKE' });
  }
  cancelDDR(silent = false) {
    if (!this.ddr || this.ddr.kind === 'emergency') return;
    this.ddr.chart.cancel();
    if (!silent) this.floatText(TRACK.x + TRACK.w / 2, 440, 'INTERRUPTED', COLORS.amber, true);
    this.ddr = null;
    this.ghosts = [];
  }
  ddrPress(dir, time) {
    const d = this.ddr;
    if (!d) return;
    this.handleDDR(d.chart.update(time));
    if (this.ddr !== d) return;
    const ev = d.chart.press(dir, time);
    // Ghost Arrows: tapping one when no real arrow is at the mark is a missed beat.
    if (ev && ev.type === 'stray' && this.ghosts.some((g) => g.dir === dir && Math.abs(g.time - time) < 0.15)) {
      this.handleDDR([{ type: 'miss', reason: 'ghost' }]);
      return;
    }
    this.handleDDR([ev]);
  }
  handleDDR(events) {
    const d = this.ddr;
    if (!d) return;
    for (const ev of events) {
      if (!ev) continue;
      const dir = ev.note ? ev.note.dir : null;
      if (ev.type === 'perfect' || ev.type === 'good') {
        this.comboHit();
        this.ddrFx.push({ dir, type: ev.type, t0: this.t, forgiven: ev.forgiven });
        if (d.skin === 'brass') sfx(ev.type === 'perfect' ? 'chamber' : 'ddrHit');
        else if (d.skin === 'pill') { sfx(ev.type === 'perfect' ? 'pill' : 'ddrHit'); this.pillCrush(dir); } else sfx(ev.type === 'perfect' ? 'ddrPerfect' : 'ddrHit');
      } else if (ev.type === 'forgiven') {
        this.ddrFx.push({ dir: null, type: 'good', t0: this.t, forgiven: true });
      } else if (ev.type === 'miss') {
        sfx('ddrMiss');
        this.ddrFx.push({ dir, type: 'miss', t0: this.t });
        this.breakCombo();
        this.game.addLoad(DDR_MISS_LOAD);
        if (ev.restart) this.floatText(TRACK.x + TRACK.w / 2, 300, 'JAMMED — RACK THE SLIDE', '#ff6a6a', true);
      }
    }
    if (!this.ddr) return;
    if (d.chart.status === 'done') this.finishDDR(true);
    else if (d.chart.status === 'failed') this.finishDDR(false);
  }
  pillCrush(dir) {
    const x = TRACK.x + (TRACK.w / 4) * (DIRS.indexOf(dir) + 0.5);
    for (let i = 0; i < 6; i++) {
      this.parts.push({ x, y: TRACK.hitY, vx: (150 - x) * (1.4 + this.rng() * 0.6), vy: (540 - TRACK.hitY) * 1.6 + this.rng() * 60, life: 0.6, max: 0.6, color: '#e9f7ff', size: 3, grav: 0, screen: true });
    }
  }
  finishDDR(ok) {
    const d = this.ddr;
    this.ddr = null;
    this.ghosts = [];
    const run = this.run;
    if (d.kind === 'reload') {
      if (!ok) return;
      const w = run.weapons[d.weapon];
      w.ammo = WEAPONS[w.id].mag;
      if (d.chart.perfectRun) {
        w.overload = true;
        sfx('overloadRounds');
        this.game.addLoad(-PERFECT_RELOAD_RELIEF);
        this.floatText(TRACK.x + TRACK.w / 2, 300, 'PERFECT — OVERLOAD ROUNDS', COLORS.gold, true);
        run.stats.perfectReloads++;
        this.bark('perfectReload', 0.3);
      } else {
        sfx('chamber');
        this.floatText(TRACK.x + TRACK.w / 2, 300, 'RELOADED', COLORS.phosphor, true);
      }
    } else if (d.kind === 'consumable') {
      const keep = ok && this.st.saveChance && this.rng() < this.st.saveChance;
      if (!keep) run.consumables[d.slot] = null;
      if (!ok) {
        sfx('botch');
        this.game.addLoad(BOTCH_LOAD);
        this.floatText(TRACK.x + TRACK.w / 2, 300, 'BOTCHED — WASTED', '#ff6a6a', true);
        return;
      }
      const c = CONSUMABLES[d.item];
      if (c.heal) { this.game.heal(c.heal); sfx('inject'); this.floatText(TRACK.x + TRACK.w / 2, 300, 'VITALS RESTORED', COLORS.phosphor, true); }
      if (c.load) { this.game.addLoad(c.load); sfx('pill'); this.bark('pills', 0.5); this.floatText(TRACK.x + TRACK.w / 2, 300, 'SEDATED', COLORS.cyan, true); }
      if (c.buff) { this.adrenaline = c.buff; sfx('inject'); this.floatText(TRACK.x + TRACK.w / 2, 300, 'ADRENALINE', '#ff6a6a', true); }
      if (keep) this.floatText(TRACK.x + TRACK.w / 2, 330, 'LOAVES & FISHES: NOT CONSUMED', COLORS.gold, true);
    } else if (d.kind === 'active') {
      if (!ok) { sfx('botch'); this.game.addLoad(BOTCH_LOAD); this.floatText(TRACK.x + TRACK.w / 2, 300, 'THE RELIC IS SILENT', '#ff6a6a', true); return; }
      run.actives[d.slot].used = true;
      this.invoke(itemById(d.item));
    } else if (d.kind === 'emergency') {
      if (ok) this.overloadSuccess();
    }
  }
  invoke(item) {
    const a = item.active;
    sfx('hymn');
    switch (a.type) {
      case 'sanity': this.game.addLoad(-a.amount); this.floatText(W / 2, 300, 'THE DOVE RETURNS', '#fff', true); break;
      case 'heal': this.game.heal(a.amount); this.floatText(W / 2, 300, 'YOU HAVE NEVER FOUGHT ALONE', '#ff9aa8', true); break;
      case 'stone':
      case 'salt': this.throwReady = { type: a.type, amount: a.amount, name: item.name }; this.floatText(W / 2, 300, 'POP UP AND CLICK A TARGET', COLORS.gold, true); break;
      case 'flood':
        sfx('splash');
        this.flood = 1.4;
        this.fireT = 0;
        this.bile = 0;
        for (const e of this.hostiles()) if (e.alive) e.damage(this.run.cheats.oneShot ? 99999 : a.amount, 'flood');
        break;
      case 'burn':
        sfx('fire');
        for (const e of this.hostiles()) if (e.alive) e.burnT = a.duration;
        break;
      default: break;
    }
  }
  throwRelic(x, y) {
    const tr = this.throwReady;
    const sy = y + this.shift();
    const target = this.enemies.filter((e) => e.alive && e.hostile).sort((a, b) => b.z - a.z).find((e) => e.hitTest(x, sy) || dist(x, sy, e.x, e.y - 140 * e.s) < 60 * e.s);
    if (!target) { this.floatText(x, y - 24, 'NO TARGET', '#aaa', true); return; }
    this.throwReady = null;
    sfx('throw');
    if (tr.type === 'salt') {
      if (target.boss) target.damage(tr.amount, 'stone');
      else { target.salt = 0.01; target.damage(99999, 'salt'); }
      this.burst(x, sy, '#fff', 20, { speed: 200 });
      this.floatText(x, sy - 30, 'PILLAR OF SALT', '#fff');
    } else {
      target.damage(tr.amount, 'stone');
      sfx('slam');
      this.burst(x, sy, '#8a8580', 14);
      this.floatText(x, sy - 30, `${tr.amount}`, COLORS.gold);
    }
    this.comboHit();
  }

  // -------------------------------------------------------------------------
  // Terminal Overload (100% Cognitive Load)
  // -------------------------------------------------------------------------
  startOverload() {
    if (this.overload || this.death || this.state === 'clear') return;
    if (this.ddr) { this.ddr.chart.cancel(); this.ddr = null; }
    this.overload = { t0: this.t, cracks: makeCracks(this.rng) };
    this.frozen = true;
    sfx('alarm');
    const n = this.rng.int(15, 20);
    this.startDDR('emergency', randomSteps(this.rng, n), { spacing: 0.4, travel: 1.25, lead: 1.6, onMiss: 'requeue' }, { skin: 'pill', label: 'EMERGENCY SEDATIVE', sub: `${n} DOSES` });
    this.run.stats.overloads++;
  }
  overloadSuccess() {
    sfx('shatter');
    this.overload = null;
    this.frozen = false;
    this.shatterT = this.t;
    this.game.setLoad(0);
    this.unlimited = 5;
    this.forceUp = 0.7;
    this.setBanner('SEDATIVE ADMINISTERED', 'UNLIMITED AMMO — 5 SECONDS', COLORS.phosphor, 2);
    this.say('SUBJECT 87', this.rng.pick(BARKS.overloadWin));
  }

  die(kind) {
    if (this.death) return;
    this.run.hp = Math.max(0, this.run.hp);
    if (this.ddr) { this.ddr.chart.cancel(); this.ddr = null; }
    this.death = { t0: this.t, kind };
    this.frozen = true;
    if (kind === 'flatline') { this.game.ekg.flatline(); sfx('flatline'); } else { sfx('crtOff'); }
  }

  onKill(e, part) {
    if (e instanceof Prisoner) {
      this.run.stats.prisoners++;
      this.game.addLoad(ENEMIES.prisoner.killLoad);
      if (!this.st.guiltImmune) this.guilt = ENEMIES.prisoner.guilt;
      sfx('whisper');
      this.breakCombo();
      this.say('SUBJECT 87', ENEMIES.prisoner.voice);
      return;
    }
    if (!e.hostile) return;
    this.kills++;
    this.run.stats.kills++;
    this.scrap += 5;
    sfx('kill');
    if (e instanceof Warden) {
      this.shake = 1.4;
      this.bossDeathT = this.t;
      sfx('bell');
      for (const x of this.enemies) if (x !== e && x.alive && x.hostile) x.damage(99999);
    } else if (e instanceof Aaron) {
      this.say(...AARON_LINES.death);
      this.bossDeathT = this.t;
    } else this.bark('kill', 0.12);
  }

  // -------------------------------------------------------------------------
  // input
  // -------------------------------------------------------------------------
  onKey(code, time) {
    if (this.death || this.state === 'clear') return;
    const dir = dirForCode(code);
    if (dir) { if (this.ddr) this.ddrPress(dir, time); return; }
    if (code === 'KeyR') this.startReload(this.run.current);
    else if (code === 'KeyQ') this.swap();
    else if (/^Digit[1-4]$/.test(code)) this.useConsumable(+code.slice(5) - 1);
    else if (/^Digit[5-8]$/.test(code)) this.useActive(+code.slice(5) - 5);
  }
  onClick(x, y, button) {
    if (this.death || this.state === 'clear') return;
    if (button === 2) { this.swap(); return; }
    if (button !== 0) return;
    if (this.stand >= 0.85) {
      if (this.throwReady) this.throwRelic(x, y);
      else this.tryFire(true);
      return;
    }
    if (this.stand > 0.3) return;
    const L = coverLayout();
    L.weapons.forEach((r, i) => { if (inRect(r, x, y)) this.startReload(i); });
    L.consumables.forEach((r, i) => { if (inRect(r, x, y)) this.useConsumable(i); });
    L.actives.forEach((r, i) => { if (inRect(r, x, y)) this.useActive(i); });
  }
  onWheel(n) { if (n) this.swap(); }
  swap() {
    if (this.run.weapons.length < 2) return;
    this.run.current = 1 - this.run.current;
    this.fireCd = Math.max(this.fireCd, 0.08);
    sfx('swap');
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  update(dt, t) {
    this.t = t;
    const run = this.run;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.guilt = Math.max(0, this.guilt - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.comboFx.pulse = Math.max(0, this.comboFx.pulse - dt * 6);
    this.comboFx.snap = Math.max(0, this.comboFx.snap - dt * 1.8);
    this.unlimited = Math.max(0, this.unlimited - dt);
    this.adrenaline = Math.max(0, this.adrenaline - dt);
    this.bile = Math.max(0, this.bile - dt);
    this.flood = Math.max(0, this.flood - dt);
    this.forceUp = Math.max(0, (this.forceUp || 0) - dt);
    if (this.sub && t - this.sub.t0 > this.sub.dur && this.subQueue.length) this.showSub(this.subQueue.shift());
    const vs = vitalsState(run.hp, this.game.maxHp());
    this.game.ekg.update(dt, this.death ? 'critical' : vs);
    this.game.eeg.update(dt, run.psyche.load);
    this.updateParticles(dt);

    if (this.death) { this.updateDeath(dt); return; }

    if (this.state === 'intro' && t - this.t0 > 0.7) { this.state = 'fight'; this.nextWave(); }

    // Stance
    const wantUp = input.isDown('Space') && !this.overload && this.state !== 'intro';
    const target = this.forceUp > 0 ? 1 : wantUp ? 1 : 0;
    this.stand = clamp(this.stand + Math.sign(target - this.stand) * dt * 9, 0, 1);
    if (this.stand > 0.25 && this.ddr && this.ddr.kind !== 'emergency') this.cancelDDR();
    this.exposedT = this.exposed ? this.exposedT + dt : 0;
    if (this.hints) {
      if (this.stand > 0.8) this.hints.popped = true;
      if (this.hints.popped && this.stand < 0.2) this.hints.ducked = true;
    }
    if (this.stand >= 0.85 && input.mouse.down && !this.throwReady) this.tryFire(false);

    // Psychosis: slow drain
    if (!this.overload) this.game.addLoad(-LOAD_DRAIN * dt, true);

    // DDR timing (late misses)
    if (this.ddr) this.handleDDR(this.ddr.chart.update(t));
    if (this.ddr && this.has('ghosts')) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) {
        this.ghostT = this.rng.range(0.35, 0.8);
        this.ghosts.push({ dir: this.rng.pick(DIRS), time: t + this.ddr.chart.travel });
      }
      this.ghosts = this.ghosts.filter((g) => g.time > t - 0.4);
    }

    // Overload clock
    if (this.overload) {
      const left = OVERLOAD_SECONDS - (t - this.overload.t0);
      if (left <= 0) { this.die('neural'); return; }
    }

    // Enemies
    for (const e of this.enemies) e.update(dt, t);
    this.enemies = this.enemies.filter((e) => !e.dead || e === this.boss);

    // Grenades & bile
    if (!this.frozen) {
      for (const g of [...this.grenades]) {
        g.p += dt / g.dur;
        const shift = this.shift();
        const ex = g.tx, ey = this.barrierTop + shift;
        g.x = lerp(g.sx, ex, g.p);
        g.y = lerp(g.sy, ey, g.p) - Math.sin(Math.PI * g.p) * 230;
        g.r = 22 + g.p * 22;
        if (g.p >= 1) {
          this.grenades.splice(this.grenades.indexOf(g), 1);
          if (g.kind === 'bile') {
            sfx('splash');
            this.bile = 3;
            this.game.addLoad(8);
          } else {
            sfx('fire');
            this.fireT = ENEMIES.ember.fireTime;
            this.shake = Math.max(this.shake, 0.5);
            this.setBanner('COVER IGNITED', 'STAYING DOWN WILL BURN YOU', COLORS.blueFire, 1.2, 200);
          }
        }
      }
    }
    // Blue fire: ducking into burning cover hurts
    if (this.fireT > 0) {
      this.fireT -= dt;
      if (this.stand < 0.4) {
        this.fireTick += dt;
        while (this.fireTick >= 0.25) {
          this.fireTick -= 0.25;
          this.hurt(ENEMIES.ember.fireDps * 0.25 * this.dmgMult, ENEMIES.ember.fireLoad * 0.25, { tick: true });
        }
      }
    }
    // Needler bolts
    for (const b of [...this.bolts]) {
      if (b.homing && b.homing.alive) { b.tx = b.homing.x; b.ty = b.homing.y - 150 * b.homing.s - this.shift(); }
      const d = dist(b.x, b.y, b.tx, b.ty);
      const step = 1700 * dt;
      if (d <= step) {
        this.bolts.splice(this.bolts.indexOf(b), 1);
        const res = this.resolveShot(b.tx, b.ty + this.shift(), b.dmg, { quiet: true });
        if (res.hit) {
          this.comboHit();
          this.stuck.push({ x: b.tx, y: b.ty + this.shift(), t: 0.5 });
        } else this.missShot();
      } else { b.x += ((b.tx - b.x) / d) * step; b.y += ((b.ty - b.y) / d) * step; }
    }
    for (const s of [...this.stuck]) {
      s.t -= dt;
      if (s.t <= 0) {
        this.stuck.splice(this.stuck.indexOf(s), 1);
        sfx('pop');
        this.parts.push({ ring: true, x: s.x, y: s.y, r: WEAPONS.needler.splash, life: 0.2, max: 0.2 });
        for (const e of this.enemies) if (e.alive && e.hostile && !(e instanceof Berserker) && dist(s.x, s.y, e.x, e.y - 130 * e.s) < WEAPONS.needler.splash + 30 * e.s) e.damage(WEAPONS.needler.splashDmg * (1 + this.st.dmgMul), 'body');
      }
    }
    // Delayed explosions (Thurible)
    for (const b of [...this.blasts]) {
      b.t -= dt;
      if (b.t <= 0) {
        this.blasts.splice(this.blasts.indexOf(b), 1);
        const n = this.explode(b.x, b.y, b.r, b.dmg);
        if (b.judge) { if (n) this.comboHit(); else this.missShot(); }
      }
    }

    // Spawning
    if (this.state === 'fight') this.updateSpawns(dt);

    // Hallucinations with a life of their own
    if (this.has('phantoms') && this.state === 'fight') {
      this.phantomT -= dt;
      if (this.phantomT <= 0) {
        this.phantomT = this.rng.range(5, 8);
        if (this.enemies.filter((e) => e.phantom && !e.dead).length < 2) this.spawn('phantom');
      }
    }
    if (this.has('horse')) {
      this.horseT -= dt;
      if (!this.horse && this.horseT <= 0) {
        const dir = this.rng.chance(0.5) ? 1 : -1;
        this.horse = { x: dir > 0 ? -340 : W + 340, dir };
        sfx('horse');
      }
    }
    if (this.horse) {
      this.horse.x += this.horse.dir * 820 * dt;
      if (this.horse.x < -400 || this.horse.x > W + 400) { this.horse = null; this.horseT = this.rng.range(9, 15); }
    }
    if (this.has('eyes')) {
      this.eyeT -= dt;
      if (this.eyeT <= 0 && this.eyes.length < 4) {
        this.eyeT = this.rng.range(1.5, 3);
        this.eyes.push({ x: this.rng.range(80, W - 80), y: this.rng.range(80, 460), size: this.rng.range(28, 62), t0: t, dur: this.rng.range(4, 6.5), seed: this.rng() * 100, hue: this.rng.chance(0.5) ? 0 : 1 });
      }
    }
    this.eyes = this.eyes.filter((e) => t - e.t0 < e.dur);
    if (run.psyche.load >= 45 && this.rng.chance(dt * 0.02)) this.bark('lowSanity', 1);
    if (vs === 'critical' && this.rng.chance(dt * 0.03)) this.bark('critical', 1);

    // Room cleared?
    if (this.state === 'fight' && this.waveIdx >= this.waves.length - 1 && !this.spawnQueue.length && !this.hostiles().some((e) => e.alive) && (!this.boss || this.boss.dead)) {
      const wait = this.boss ? 2.2 : 0.4;
      if (!this.bossDeathT || t - this.bossDeathT > wait) this.roomClear();
    }
    if (this.state === 'clear' && t - this.clearT > (this.kind === 'boss' ? 4.2 : 2.2)) {
      this.state = 'done';
      this.game.roomComplete({ kind: this.kind, scrap: this.scrap, kills: this.kills, variant: this.cfg.variant });
    }
  }

  updateSpawns(dt) {
    if (this.spawnQueue.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && !this.frozen) {
        if (this.spawn(this.spawnQueue[0])) this.spawnQueue.shift();
        this.spawnT = this.kind === 'quarantine' ? 0.5 : 0.4;
      }
    }
    const alive = this.hostiles().filter((e) => e.alive && !e.boss).length;
    const threshold = this.kind === 'quarantine' ? 2 : 0;
    if (!this.spawnQueue.length && this.waveIdx < this.waves.length - 1 && alive <= threshold && !(this.boss && this.boss.alive && this.kind === 'boss')) {
      this.waveGap += dt;
      if (this.waveGap > (this.kind === 'quarantine' ? 0.6 : 1.1)) { this.waveGap = 0; this.nextWave(); }
    }
    // Prisoners wander in
    this.prisonerT -= dt;
    if (this.prisonerT <= 0 && !this.frozen) {
      this.prisonerT = this.rng.range(10, 17);
      const n = this.enemies.filter((e) => e instanceof Prisoner && !e.dead).length;
      if (n < (this.kind === 'quarantine' ? 2 : 1)) this.spawn('prisoner');
    }
  }

  roomClear() {
    this.state = 'clear';
    this.clearT = this.t;
    if (this.ddr && this.ddr.kind !== 'emergency') this.cancelDDR(true);
    for (const e of this.enemies) if (e instanceof Prisoner && e.alive) { e.state = 'exit'; e.dir = e.x < W / 2 ? -1 : 1; }
    this.grenades = [];
    this.fireT = 0;
    setTempo(1);
    if (this.kind === 'boss') {
      this.setBanner('THE WARDEN HAS FALLEN', WARDEN_LINES.victory, '#fff', 4, 260);
      sfx('reward');
    } else {
      this.setBanner(this.kind === 'quarantine' ? 'QUARANTINE RESTORED' : 'SECTOR CLEARED', `${this.kills} DOWN • +${Math.round(this.scrap * (1 + this.st.scrapMul))} SCRAP`, COLORS.phosphor, 2.2);
      sfx('uiConfirm');
    }
  }

  updateParticles(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.beam || p.ring) continue;
      p.vy += (p.grav ?? 500) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.floats = this.floats.filter((f) => this.t - f.t0 < 1);
  }

  updateDeath() {
    const d = this.death;
    const age = this.t - d.t0;
    if (d.kind === 'flatline') {
      if (age > 1.5 && !d.snap) { d.snap = this.game.snapshot(); sfx('crtOff'); }
      if (age > 2.6 && !d.done) { d.done = true; this.game.gameOver('flatline'); }
    } else if (age > 1.6 && !d.done) { d.done = true; this.game.gameOver('neural'); }
  }

  // -------------------------------------------------------------------------
  // draw
  // -------------------------------------------------------------------------
  draw(ctx, t) {
    const d = this.death;
    if (d) {
      const age = t - d.t0;
      if (d.kind === 'neural') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
      if (d.snap) { drawPowerDown(ctx, d.snap, clamp((age - 1.5) / 1.0, 0, 1)); return; }
    }
    const settings = this.game.settings;
    const run = this.run;
    const shift = this.shift();
    ctx.save();
    if (this.shake > 0 && settings.shake) ctx.translate((this.rng() - 0.5) * 22 * this.shake, (this.rng() - 0.5) * 22 * this.shake);

    // ----- the room -----
    ctx.save();
    ctx.translate(0, -shift);
    ctx.drawImage(this.scene.bg, 0, 0);
    drawSceneDynamic(ctx, this.scene, t);
    const items = [];
    for (const s of this.spots) items.push({ z: s.z, fn: () => drawProp(ctx, s, this.scene.theme, t) });
    for (const e of this.enemies) if (!e.dead) items.push({ z: e.z, fn: () => e.draw(ctx, t) });
    items.sort((a, b) => a.z - b.z).forEach((i) => i.fn());
    // Ember telegraph arcs
    for (const e of this.enemies) {
      if (!(e instanceof Soldier) || e.state !== 'windup' || !e.alive) continue;
      const sx = e.x + 40 * e.s, sy = e.y - 262 * e.s;
      const ex = e.arcTarget, ey = this.barrierTop + shift;
      ctx.save();
      ctx.strokeStyle = COLORS.blueFire;
      ctx.shadowColor = COLORS.blueFire;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -t * 60;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const p = i / 24;
        const x = lerp(sx, ex, p), y = lerp(sy, ey, p) - Math.sin(Math.PI * p) * 230;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(ex, ey, 46, 12, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (const e of this.enemies) if (!e.dead) e.drawOverlay(ctx, t);
    // Grenades in flight: clickable
    for (const g of this.grenades) {
      ctx.save();
      const col = g.kind === 'bile' ? '#1a1a12' : '#9fd8ff';
      ctx.shadowColor = g.kind === 'bile' ? '#c8ff3a' : COLORS.blueFire;
      ctx.shadowBlur = 20;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = g.kind === 'bile' ? '#c8ff3a' : '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r + 6 + Math.sin(t * 20) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (const s of this.stuck) { ctx.fillStyle = '#ff5fb8'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill(); }
    this.drawParticles(ctx, false);
    for (const f of this.floats) if (!f.screen) this.drawFloat(ctx, f, t);
    ctx.restore();

    // Laser sweep (screen space)
    if (this.boss instanceof Warden && this.boss.laser) {
      const L = this.boss.laser;
      ctx.save();
      if (L.t < L.warn) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30);
        ctx.strokeStyle = '#ff2a2a';
        ctx.setLineDash([16, 12]);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 420 - shift * 0.3); ctx.lineTo(W, 420 - shift * 0.3); ctx.stroke();
      } else if (L.x !== undefined) {
        const x = L.x;
        const grd = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
        grd.addColorStop(0, 'rgba(0,229,255,0)');
        grd.addColorStop(0.5, 'rgba(0,229,255,0.85)');
        grd.addColorStop(1, 'rgba(0,229,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(x - 60, 60, 120, 520 - shift);
        ctx.strokeStyle = 'rgba(200,255,255,0.9)';
        ctx.lineWidth = 1;
        for (let y = 70; y < 560 - shift; y += 26) { ctx.beginPath(); ctx.moveTo(x - 50, y); ctx.lineTo(x + 50, y); ctx.stroke(); }
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#e8ffff';
        ctx.fillRect(x - 3, 60, 6, 520 - shift);
      }
      ctx.restore();
    }

    // ----- the barrier, hands, cover UI -----
    const top = this.barrierTop;
    drawBarrier(ctx, top, t, { anatomy: this.has('anatomy') && this.stand < 0.6, fire: this.fireT > 0 ? Math.min(1, this.fireT) : 0, reduceFlash: settings.reduceFlash });
    const cover = 1 - clamp(this.stand * 2.2, 0, 1);
    if (cover > 0.01) {
      ctx.save();
      ctx.globalAlpha = cover;
      drawHands(ctx, t, { flayed: this.has('flayed'), busy: !!this.ddr });
      drawCoverUI(ctx, run, this, t, input.mouse, { scrambled: this.has('scramble') });
      if (this.ddr) {
        drawTrack(ctx, this.ddr.chart, t, {
          ...TRACK, skin: this.ddr.skin, ghosts: this.ghosts, invert: this.has('invert'), fx: this.ddrFx,
          label: this.has('scramble') ? this.ddr.label.replace(/[A-Z]/g, (c, i) => (hash(i + Math.floor(t * 8)) > 0.5 ? '▓' : c)) : this.ddr.label, sub: this.ddr.sub,
        });
      } else if (!this.overload) {
        ctx.save();
        ctx.fillStyle = 'rgba(4,10,6,0.55)';
        roundRect(ctx, TRACK.x - 10, TRACK.y + 150, TRACK.w + 20, 110, 10);
        ctx.fill();
        text(ctx, 'IN COVER', TRACK.x + TRACK.w / 2, TRACK.y + 190, { size: 26, color: COLORS.phosphor, align: 'center', glow: 8 });
        text(ctx, 'CLICK A GUN / [R] RELOAD', TRACK.x + TRACK.w / 2, TRACK.y + 218, { size: 18, color: '#bfe', align: 'center' });
        text(ctx, 'CLICK AN ITEM / [1-8] USE', TRACK.x + TRACK.w / 2, TRACK.y + 240, { size: 18, color: '#bfe', align: 'center' });
        ctx.restore();
      }
      ctx.restore();
    }
    if (this.stand > 0.3) {
      const w = run.weapons[run.current];
      drawGun(ctx, w.id, t, { recoil: this.recoil, muzzle: this.muzzle, aimX: input.mouse.x, aimY: input.mouse.y, overload: w.overload || this.unlimited > 0, drop: (1 - this.stand) * 320, sway: clamp(this.exposedT - 1.3, 0, 3) });
    }
    // Needler bolts & railgun beams (screen)
    for (const b of this.bolts) { ctx.save(); ctx.fillStyle = '#ff5fb8'; ctx.shadowColor = '#ff5fb8'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    this.drawParticles(ctx, true);

    // ----- hallucination overlays -----
    if (this.horse) drawHorse(ctx, this.horse, t);
    for (const e of this.eyes) drawEye(ctx, e, t, input.mouse.x, input.mouse.y);
    if (this.has('grain')) drawGrain(ctx, t, 0.16 + 0.14 * Math.max(0, Math.sin(t * 0.8)));
    if (this.bile > 0) this.drawBile(ctx, t);
    if (this.flood > 0) this.drawFlood(ctx, t);
    drawGuilt(ctx, t, this.guilt / 2);
    ctx.restore();

    // ----- HUD -----
    const vs = vitalsState(run.hp, this.game.maxHp());
    if (vs === 'critical' && !this.death) {
      const beat = (Math.sin(t * Math.PI * 1.5) + 1) / 2;
      vignette(ctx, 'rgba(120,0,0,0.95)', 0.25, settings.reduceFlash ? 0.5 : 0.35 + beat * 0.55);
    }
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hitFlash * (settings.reduceFlash ? 0.15 : 0.35);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.stand >= 0.6 && !this.death) {
      const cx = input.mouse.x, cy = input.mouse.y;
      if (this.has('rat')) drawRat(ctx, cx, cy, t);
      else {
        const off = this.has('shift') ? [(hash(Math.floor(t * 9)) - 0.5) * 34, (hash(Math.floor(t * 9) + 5) - 0.5) * 34] : [0, 0];
        drawCrosshair(ctx, cx + off[0], cy + off[1], this.spread(), t, { overload: run.weapons[run.current].overload || this.unlimited > 0 });
      }
      if (this.throwReady) text(ctx, `${this.throwReady.name.toUpperCase()}: CLICK A TARGET`, cx, cy + 44, { size: 18, color: COLORS.gold, align: 'center', glow: 6 });
      drawAmmo(ctx, run, t, { scrambled: this.has('scramble'), unlimited: this.unlimited > 0 });
    }
    for (const f of this.floats) if (f.screen) this.drawFloat(ctx, f, t);
    this.game.ekg.draw(ctx, 16, H - 250, this.death ? 'critical' : vs, t, { reduceFlash: settings.reduceFlash, iframes: this.iframes });
    this.game.eeg.draw(ctx, 16, H - 124, run.psyche.load, t, this.game.eegNotice);
    drawCombo(ctx, run.combo, t, this.comboFx);
    if (this.boss && !this.boss.dead) drawBossBar(ctx, this.bossName, this.boss.hp, this.boss.maxHp, this.boss instanceof Warden ? 3 : 1, t, this.boss instanceof Warden && this.boss.phase === 3 ? COLORS.violet : this.boss instanceof Aaron ? '#c8ff3a' : '#fff');
    if (this.adrenaline > 0) text(ctx, `ADRENALINE ${this.adrenaline.toFixed(1)}s`, W / 2, H - 16, { size: 20, color: '#ff6a6a', align: 'center' });
    if (this.unlimited > 0) text(ctx, `SEDATIVE HIGH — ∞ AMMO ${this.unlimited.toFixed(1)}s`, W / 2, H - 16, { size: 20, color: COLORS.phosphor, align: 'center', glow: 6 });
    if (this.hints && this.state === 'fight' && t - this.t0 > 2) this.drawHints(ctx, t);
    if (this.overload) this.drawOverload(ctx, t);
    if (this.shatterT && t - this.shatterT < 0.9) drawShatter(ctx, (t - this.shatterT) / 0.9);
    drawSubtitle(ctx, this.sub, t);
    drawBanner(ctx, this.banner, t);
    scanlines(ctx, 0.07);
  }

  drawParticles(ctx, screen) {
    for (const p of this.parts) {
      if (!!p.screen !== screen) continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (p.beam) {
        ctx.strokeStyle = COLORS.cyan;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 6 * a;
        ctx.beginPath(); ctx.moveTo(p.x0, p.y0); ctx.lineTo(p.x1, p.y1); ctx.stroke();
      } else if (p.ring) {
        ctx.strokeStyle = '#ffb020';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.2 - a * 0.5), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,160,40,0.25)';
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }
  drawFloat(ctx, f, t) {
    const age = t - f.t0;
    text(ctx, f.text, f.x, f.y - age * 40, { size: 20, color: f.color, align: 'center', alpha: 1 - age, glow: 6, stroke: { color: 'rgba(0,0,0,0.7)', width: 4 } });
  }
  drawBile(ctx, t) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.bile) * 0.9;
    ctx.fillStyle = '#0a0b06';
    for (let i = 0; i < 18; i++) {
      const x = hash(i) * W;
      const len = (0.3 + hash(i + 3) * 0.7) * H * (1 - this.bile / 3 * 0.3);
      ctx.beginPath();
      ctx.ellipse(x, 0, 40 + hash(i + 1) * 70, len, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  drawFlood(ctx, t) {
    const p = 1 - this.flood / 1.4;
    ctx.save();
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.6;
    const y = H - p * H * 1.4;
    const g = ctx.createLinearGradient(0, y, 0, y + 400);
    g.addColorStop(0, 'rgba(120,200,255,0.9)');
    g.addColorStop(1, 'rgba(10,40,90,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 8) * 20);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.restore();
  }
  drawOverload(ctx, t) {
    const age = t - this.overload.t0;
    const left = Math.max(0, OVERLOAD_SECONDS - age);
    drawCracks(ctx, this.overload.cracks, age / OVERLOAD_SECONDS);
    const shake = this.game.settings.shake ? 6 : 0;
    text(ctx, left.toFixed(2), W / 2 + (this.rng() - 0.5) * shake, 78 + (this.rng() - 0.5) * shake, { size: 80, font: FONT.mono, color: left < 3 ? '#ff3a3a' : '#fff', align: 'center', glow: 20 });
    const blink = this.game.settings.reduceFlash ? 1 : 0.6 + 0.4 * Math.sin(t * 14);
    text(ctx, '[CRITICAL: TERMINAL OVERLOAD IMPINENT - ADMINISTER SEDATIVE]', W / 2, 106, { size: 20, color: COLORS.phosphor, align: 'center', glow: 10, alpha: blink, stroke: { color: 'rgba(0,0,0,0.85)', width: 4 } });
  }
  drawHints(ctx, t) {
    const h = this.hints;
    let msg = null;
    const w = this.run.weapons[this.run.current];
    if (!h.popped) msg = 'HOLD [SPACE] TO POP UP FROM COVER';
    else if (!h.fired) msg = 'AIM WITH THE MOUSE • CLICK TO SHOOT';
    else if (this.enemies.some((e) => e instanceof Soldier && e.state === 'aim' && e.ring > 0.7) && this.exposed) msg = 'RING TURNING RED — RELEASE [SPACE] TO DUCK!';
    else if (!h.ducked) msg = 'RELEASE [SPACE] TO DROP BACK INTO COVER';
    else if (w.ammo < WEAPONS[w.id].mag * 0.5 && !h.reloaded) msg = 'IN COVER: PRESS [R] OR CLICK YOUR GUN, THEN HIT THE FALLING ARROWS';
    if (!msg) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, W / 2 - 330, 176, 660, 40, 6);
    ctx.fill();
    text(ctx, msg, W / 2, 204, { size: 22, color: COLORS.gold, align: 'center', alpha: 0.75 + 0.25 * Math.sin(t * 5) });
    ctx.restore();
  }
}

