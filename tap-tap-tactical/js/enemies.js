// Enemy behaviour. Positions are in "scene space" (the standing view); the room converts
// to screen space when Subject 87 is crouched.

import { W, ENEMIES } from './data.js';
import { groundY, scaleAt } from './scene.js';
import { drawFigure, drawSoldier, drawPrisoner, drawBerserker, drawCrawler, drawWarden, drawAaron, weakPointOffset, cannonPos, aaronWeak } from './figures.js';
import { easeInOut, easeOut, lerp, clamp, COLORS, text, FONT, dist } from './render.js';

const RING_COLOR = (p, t) => (p < 0.5 ? COLORS.cyan : p < 0.85 ? '#ffd24a' : Math.sin(t * 40) > 0 ? '#ff2a2a' : '#ff9a9a');

export function drawThreatRing(ctx, x, y, r, p, t, lw = 4) {
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(0,229,255,0.35)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  const c = RING_COLOR(p, t);
  ctx.strokeStyle = c;
  ctx.shadowColor = c;
  ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  if (p >= 0.85) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export class Enemy {
  constructor(room, type) {
    this.room = room;
    this.type = type;
    const def = ENEMIES[type] || { hp: 10 };
    this.maxHp = this.hp = Math.round(def.hp * room.hpMult);
    this.flash = 0;
    this.dying = 0;
    this.dead = false;
    this.burnT = 0;
    this.salt = 0;
    this.age = 0;
    this.hostile = true;
    this.boss = false;
  }
  tick(dt) {
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.dying > 0) {
      this.dying += dt / (this.salt > 0 ? 1.4 : 0.6);
      if (this.salt > 0) this.salt = Math.min(1, this.salt + dt * 3);
      if (this.dying >= 1) this.dead = true;
      return false;
    }
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.damage(this.room.burnDps * dt, 'burn');
    }
    return true;
  }
  damage(n, part = 'body') {
    if (this.dying > 0) return false;
    this.hp -= n;
    if (part !== 'burn') this.flash = 1;
    if (this.hp <= 0) { this.hp = 0; this.die(part); }
    return true;
  }
  die(part) {
    this.dying = 0.001;
    this.room.onKill(this, part);
  }
  get alive() { return this.dying === 0 && !this.dead; }
  drawOverlay() {}
  hitTest() { return null; }
}

// ---------------------------------------------------------------------------
// Tier 1 Angel / Seraph Guard / Uriel's Ember / Phantom Hostile: cover-bound soldiers.
// ---------------------------------------------------------------------------
export class Soldier extends Enemy {
  constructor(room, type, spot) {
    super(room, type === 'phantom' ? 'angel' : type);
    this.kind = type;
    this.phantom = type === 'phantom';
    if (this.phantom) { this.hostile = false; this.life = room.rng.range(5, 8); }
    this.def = ENEMIES[type === 'phantom' ? 'angel' : type];
    this.spot = spot;
    spot.enemy = this;
    const fromLeft = spot.x < W / 2 ? room.rng.chance(0.8) : room.rng.chance(0.2);
    this.startX = fromLeft ? -90 : W + 90;
    this.x = this.phantom ? spot.x : this.startX;
    this.state = this.phantom ? 'rise' : 'enter';
    this.timer = 0;
    this.rise = this.phantom ? 0 : 0.55;
    this.ring = 0;
    this.ringDur = 1;
    this.burst = 0;
    this.fireFlash = 0;
    this.windup = 0;
  }
  get z() { return this.spot.z - 0.001; }
  get s() { return this.spot.s; }
  get y() { return this.spot.y - 4 * this.s; }
  torso() { return { x: this.x, y: this.y - 150 * this.s + (1 - this.rise) * 175 * this.s }; }

  update(dt, t) {
    this.fireFlash = Math.max(0, this.fireFlash - dt * 8);
    if (!this.tick(dt)) { if (this.dead) this.spot.enemy = null; return; }
    if (this.phantom) { this.life -= dt; if (this.life <= 0) { this.dead = true; this.spot.enemy = null; return; } }
    const room = this.room;
    if (room.frozen) return;
    const sp = room.speed;
    this.timer -= dt;
    switch (this.state) {
      case 'enter': {
        this.enterT = (this.enterT || 0) + (dt * sp) / 0.65;
        this.x = lerp(this.startX, this.spot.x, easeOut(this.enterT));
        if (this.enterT >= 1) { this.x = this.spot.x; this.state = 'hide'; this.timer = room.rng.range(0.4, 1.3) / sp; }
        break;
      }
      case 'hide':
        this.rise = Math.max(0, this.rise - dt * 6);
        if (this.timer <= 0) this.state = 'rise';
        break;
      case 'rise':
        this.rise = Math.min(1, this.rise + dt * 6);
        if (this.rise >= 1) {
          if (this.kind === 'ember') { this.state = 'windup'; this.windup = 0; this.timer = this.def.windup / sp; room.telegraphGrenade(this); } else {
            this.state = 'aim';
            this.ring = 0;
            const [a, b] = this.def.ring;
            this.ringDur = (room.rng.range(a, b) / sp) * room.ringMul;
          }
        }
        break;
      case 'aim':
        this.ring += dt / this.ringDur;
        if (this.ring >= 1) { this.state = 'fire'; this.burst = this.def.burst || 3; this.timer = 0; }
        break;
      case 'fire':
        if (this.timer <= 0) {
          this.fireFlash = 1;
          if (!this.phantom) room.enemyFire(this, this.def.dmg, this.def.load);
          else room.phantomFire(this);
          this.burst--;
          this.timer = 0.1;
          if (this.burst <= 0) { this.state = 'duck'; this.timer = 0.2; }
        }
        break;
      case 'windup':
        this.windup = clamp(1 - this.timer / (this.def.windup / sp), 0, 1);
        if (this.timer <= 0) { room.throwGrenade(this); this.state = 'recover'; this.timer = 0.45; this.windup = 0; }
        break;
      case 'recover':
        if (this.timer <= 0) { this.state = 'duck'; this.timer = 0.1; }
        break;
      case 'duck':
        this.rise = Math.max(0, this.rise - dt * 6);
        if (this.rise <= 0) {
          this.state = 'hide';
          this.timer = this.kind === 'ember' ? room.rng.range(3.5, 5.5) / sp : room.rng.range(0.9, 2.1) / sp;
        }
        break;
      default: break;
    }
  }

  draw(ctx, t) {
    // Crouched soldiers sink behind their cover; never let them poke through the floor.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-200, -400, W + 400, this.spot.y + 400);
    ctx.clip();
    drawFigure(ctx, drawSoldier, this.x, this.y, this.s, {
      rise: this.rise, variant: this.phantom ? 'phantom' : this.kind, t, flash: this.flash, fire: this.fireFlash,
      windup: this.windup, holdGrenade: this.state === 'windup', dying: this.dying, glitch: this.phantom,
      burn: this.burnT > 0 ? 1 : 0, salt: this.salt,
    });
    ctx.restore();
  }

  drawOverlay(ctx, t) {
    if (!this.alive || this.state !== 'aim' && this.state !== 'fire') return;
    const c = this.torso();
    drawThreatRing(ctx, c.x, c.y - 20 * this.s, 48 * this.s + 14, this.state === 'fire' ? 1 : this.ring, t, Math.max(3, 5 * this.s));
  }

  hitTest(x, y) {
    if (!this.alive || this.rise < 0.4) return null;
    const s = this.s;
    const off = (1 - this.rise) * 175 * s;
    const coverLine = this.state === 'enter' ? Infinity : this.spot.coverTop;
    if (y > coverLine) return null;
    if (dist(x, y, this.x, this.y - 230 * s + off) < 26 * s + 3) return { part: 'head' };
    if (Math.abs(x - this.x) < 46 * s && y > this.y - 208 * s + off && y < this.y - 60 * s + off) return { part: 'body' };
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prisoner of F.A.I.T.H.: a moral obstacle. 10 HP. Never hostile.
// ---------------------------------------------------------------------------
export class Prisoner extends Enemy {
  constructor(room) {
    super(room, 'prisoner');
    this.hostile = false;
    this.zz = room.rng.range(0.5, 0.82);
    this.dir = room.rng.chance(0.5) ? 1 : -1;
    this.x = this.dir > 0 ? -60 : W + 60;
    this.speed = room.rng.range(70, 120);
    this.state = 'walk';
    this.timer = room.rng.range(0.6, 1.4);
    this.life = room.rng.range(13, 19);
  }
  get z() { return this.zz; }
  get s() { return scaleAt(this.zz); }
  get y() { return groundY(this.zz); }
  update(dt, t) {
    if (!this.tick(dt)) return;
    const room = this.room;
    if (room.frozen) return;
    this.life -= dt;
    this.timer -= dt;
    if (this.life <= 0 && this.state !== 'exit') { this.state = 'exit'; this.dir = this.x < W / 2 ? -1 : 1; }
    if (this.state === 'walk' || this.state === 'exit') {
      this.x += this.dir * this.speed * this.s * dt;
      if (this.state === 'walk' && this.targetX !== undefined && Math.abs(this.x - this.targetX) < 10) {
        this.state = 'freeze';
        this.timer = room.rng.range(1.2, 2.6);
        this.targetX = undefined;
      }
    }
    if (this.state === 'exit' && (this.x < -120 || this.x > W + 120)) { this.dead = true; return; }
    if (this.state === 'freeze' && this.timer <= 0) { this.state = 'walk'; this.timer = room.rng.range(0.6, 1.4); }
    if (this.state === 'walk' && this.timer <= 0) {
      this.timer = room.rng.range(0.6, 1.4);
      const aiming = room.enemies.find((e) => e instanceof Soldier && e.alive && e.state === 'aim' && e.z < this.zz);
      if (aiming && room.rng.chance(0.45)) {
        // The Panic Trigger: stop dead in someone's line of fire.
        this.targetX = aiming.x;
        this.dir = aiming.x > this.x ? 1 : -1;
      } else if (room.rng.chance(0.3)) {
        this.state = 'freeze';
        this.timer = room.rng.range(1, 2.5);
      } else {
        if (room.rng.chance(0.35)) this.dir *= -1;
        this.speed = room.rng.range(60, 140);
      }
      if (this.x < 40) this.dir = 1;
      if (this.x > W - 40) this.dir = -1;
    }
  }
  draw(ctx, t) {
    drawFigure(ctx, drawPrisoner, this.x, this.y, this.s, { t, moving: this.state !== 'freeze', flash: this.flash, dying: this.dying, facing: this.dir });
  }
  hitTest(x, y) {
    if (!this.alive) return null;
    const s = this.s;
    if (Math.abs(x - this.x) < 30 * s && y > this.y - 240 * s && y < this.y) return { part: 'body' };
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bejeweled Berserker: armored, weak point hunts, lunge & reset.
// ---------------------------------------------------------------------------
export class Berserker extends Enemy {
  constructor(room) {
    super(room, 'berserker');
    this.z0 = room.rng.range(0.12, 0.2);
    this.zz = this.z0;
    this.x = room.rng.range(330, 950);
    this.state = 'march';
    this.weak = 'core';
    this.weakT = 1.8;
    this.strike = 0;
    this.timer = 0;
    room.sfxOnce('crystal');
  }
  get z() { return this.zz; }
  get s() { return scaleAt(this.zz); }
  get y() { return groundY(this.zz); }
  update(dt, t) {
    if (!this.tick(dt)) return;
    const room = this.room;
    if (room.frozen) return;
    const sp = room.speed;
    this.weakT -= dt;
    if (this.weakT <= 0) {
      const opts = ['visor', 'core', 'heel'].filter((w) => w !== this.weak);
      this.weak = room.rng.pick(opts);
      this.weakT = 1.8 / Math.sqrt(sp);
    }
    this.timer -= dt;
    switch (this.state) {
      case 'march':
        this.zz += ((0.84 - this.z0) / (ENEMIES.berserker.march / sp)) * dt;
        if (this.zz >= 0.84) { this.state = 'windup'; this.timer = 0.9 / sp; }
        break;
      case 'windup':
        this.strike = clamp(1 - this.timer / (0.9 / sp), 0, 1);
        if (this.timer <= 0) {
          room.meleeStrike(this, ENEMIES.berserker.dmg, ENEMIES.berserker.load, false);
          this.state = 'hop';
          this.timer = 0.7;
          this.hopFrom = this.zz;
        }
        break;
      case 'hop': {
        const p = 1 - this.timer / 0.7;
        this.strike = Math.max(0, 1 - p * 3);
        this.zz = lerp(this.hopFrom, this.z0, easeInOut(p));
        if (this.timer <= 0) { this.state = 'march'; this.zz = this.z0; }
        break;
      }
      default: break;
    }
  }
  hop() { return this.state === 'hop' ? Math.sin((1 - this.timer / 0.7) * Math.PI) * 60 * this.s : 0; }
  draw(ctx, t) {
    this.wpos = drawFigure(ctx, drawBerserker, this.x, this.y - this.hop(), this.s, { t, weak: this.weak, strike: this.strike, flash: this.flash, dying: this.dying, salt: this.salt, burn: this.burnT > 0 ? 1 : 0 });
  }
  hitTest(x, y) {
    if (!this.alive) return null;
    const u = this.s * 1.15;
    const bob = Math.abs(Math.sin(this.room.t * 3.2)) * 4 * u;
    const wp = weakPointOffset(this.weak, u, bob);
    const wx = this.x + wp.x, wy = this.y - this.hop() + wp.y;
    if (dist(x, y, wx, wy) < 11 * u + 4) return { part: 'weak' };
    if (Math.abs(x - this.x) < 62 * u && y > this.y - this.hop() - 270 * u && y < this.y) return { part: 'armor' };
    return null;
  }
}

// ---------------------------------------------------------------------------
// Failed Subject: a bunker-buster. Crawls over your cover and bites, stance or not.
// ---------------------------------------------------------------------------
export class Crawler extends Enemy {
  constructor(room) {
    super(room, 'crawler');
    this.zz = room.rng.range(0.18, 0.3);
    this.x = room.rng.range(260, 1020);
    this.baseX = this.x;
    this.state = 'crawl';
    this.timer = 0;
    this.lunge = 0;
    this.num = room.rng.pick([84, 85, 86]);
  }
  get z() { return this.zz; }
  get s() { return scaleAt(this.zz) * 1.1; }
  get y() { return groundY(this.zz); }
  update(dt, t) {
    if (!this.tick(dt)) return;
    const room = this.room;
    if (room.frozen) return;
    const sp = room.speed;
    this.timer -= dt;
    if (this.state === 'crawl') {
      this.zz += (0.62 / (ENEMIES.crawler.crawl / sp)) * dt;
      this.x = this.baseX + Math.sin(t * 2.3 + this.num) * 60 * this.s;
      if (this.zz >= 0.9) { this.state = 'lunge'; this.timer = 0.55; room.sfxOnce('squeak'); }
    } else if (this.state === 'lunge') {
      this.lunge = clamp(1 - this.timer / 0.55, 0, 1);
      if (this.timer <= 0) {
        room.meleeStrike(this, ENEMIES.crawler.dmg, ENEMIES.crawler.load, true);
        this.state = 'retreat';
        this.timer = 0.9;
        this.from = this.zz;
      }
    } else if (this.state === 'retreat') {
      const p = 1 - this.timer / 0.9;
      this.lunge = Math.max(0, 1 - p * 2);
      this.zz = lerp(this.from, 0.4, easeOut(p));
      if (this.timer <= 0) this.state = 'crawl';
    }
  }
  draw(ctx, t) {
    drawFigure(ctx, drawCrawler, this.x, this.y, this.s, { t, lunge: this.lunge, flash: this.flash, dying: this.dying, num: this.num, burn: this.burnT > 0 ? 1 : 0, salt: this.salt });
  }
  hitTest(x, y) {
    if (!this.alive) return null;
    const s = this.s;
    const ly = this.y - this.lunge * 80 * s;
    if (dist(x, y, this.x, ly - 84 * s) < 22 * s + 3) return { part: 'head' };
    if (Math.abs(x - this.x) < 60 * s && y > ly - 80 * s && y < ly + 4) return { part: 'body' };
    return null;
  }
}

// ---------------------------------------------------------------------------
// Archangel Unit-01 "The Warden" — three phases.
// ---------------------------------------------------------------------------
export class Warden extends Enemy {
  constructor(room, unit = 1) {
    super(room, 'warden');
    this.boss = true;
    this.unit = unit;
    this.phase = 1;
    this.x = 640;
    this.zz = 0.1;
    this.rings = [];
    this.ringCool = 2.5;
    this.summonT = 15;
    this.laser = null;
    this.laserT = 7;
    this.judgment = 0;
    this.coreHits = 0;
    this.slam = 0;
    this.fireFlash = 0;
    this.moveT = 0;
    this.phaseHp = this.maxHp / 3;
  }
  get z() { return this.zz; }
  get s() { return lerp(1.0, 1.32, clamp((this.zz - 0.1) / 0.4, 0, 1)); }
  get y() { return groundY(this.zz) - 6; }
  get name() { return this.unit === 1 ? ENEMIES.warden.name : `ARCHANGEL UNIT-0${Math.min(9, this.unit)} "THE WARDEN"`; }
  cannon() { const c = cannonPos(this.s); return { x: this.x + c.x, y: this.y + c.y }; }
  core() { return { x: this.x, y: this.y - 165 * this.s + Math.sin(this.room.t * 1.4) * 3 * this.s }; }

  update(dt, t) {
    this.fireFlash = Math.max(0, this.fireFlash - dt * 6);
    this.slam = Math.max(0, this.slam - dt * 2);
    if (!this.tick(dt)) return;
    const room = this.room;
    if (room.frozen) return;
    const sp = room.speed;
    // phase changes
    if (this.phase === 1 && this.hp <= this.maxHp * (2 / 3)) {
      this.phase = 2;
      this.rings = [];
      this.ringCool = 1.5;
      room.phaseChange(2);
    } else if (this.phase === 2 && this.hp <= this.maxHp / 3) {
      this.phase = 3;
      this.rings = [];
      this.laser = null;
      this.moveT = 0.001;
      this.hp = this.maxHp / 3;
      this.judgment = 0;
      room.phaseChange(3);
    }
    if (this.phase < 3) {
      // Threat Rings around the cannon: click every ring to break the shot.
      this.ringCool -= dt;
      if (!this.rings.length && this.ringCool <= 0) {
        const c = this.cannon();
        const fast = this.phase === 2 ? 1.25 : 1;
        this.rings = [[-58, -52], [58, -52], [-58, 52], [58, 52]].map(([ox, oy]) => ({
          x: c.x + ox * this.s, y: c.y + oy * this.s, p: 0,
          dur: (room.rng.range(2.4, 3.8) / sp / fast) * room.ringMul, broken: 0,
        }));
      }
      for (const r of this.rings) {
        if (r.broken) { r.broken += dt; continue; }
        r.p += dt / r.dur;
        if (r.p >= 1) {
          this.fireFlash = 1;
          room.bossBarrage(this, 20, 15);
          this.rings = [];
          this.ringCool = 1.8 / sp;
          break;
        }
      }
      if (this.rings.length && this.rings.every((r) => r.broken)) { this.rings = []; this.ringCool = 1.6 / sp; room.floatText(this.cannon().x, this.cannon().y, 'SHOT BROKEN', '#7affc1'); }
      this.summonT -= dt;
      if (this.summonT <= 0) {
        this.summonT = 15;
        room.bossSummon(this.phase === 2 ? ['ember'] : ['angel', 'angel']);
      }
    }
    if (this.phase === 2) {
      // The Great Divider
      this.laserT -= dt;
      if (!this.laser && this.laserT <= 0) { this.laser = { t: 0, warn: 1.1 / Math.sqrt(sp), dur: 1.0, hit: false }; room.laserWarning(); }
      if (this.laser) {
        this.laser.t += dt;
        if (this.laser.t < this.laser.warn) this.slam = Math.max(this.slam, this.laser.t / this.laser.warn);
        const p = (this.laser.t - this.laser.warn) / this.laser.dur;
        if (p >= 0 && !this.laser.fired) { this.laser.fired = true; room.sfxOnce('laser'); room.sfxOnce('slam'); room.shake = Math.max(room.shake, 0.4); }
        this.laser.x = lerp(-60, 1340, clamp(p, 0, 1));
        if (!this.laser.hit && this.laser.x >= 640) { this.laser.hit = true; room.laserSweep(30); }
        if (p >= 1) { this.laser = null; this.laserT = room.rng.range(6.5, 9) / Math.sqrt(sp); }
      }
    }
    if (this.phase === 3) {
      if (this.moveT > 0 && this.moveT < 1) {
        this.moveT = Math.min(1, this.moveT + dt / 2.2);
        this.zz = lerp(0.1, 0.5, easeInOut(this.moveT));
      }
      if (this.moveT >= 1) {
        this.judgment += dt / ((12 / Math.sqrt(sp)) * room.ringMul);
        if (this.judgment >= 1) {
          this.judgment = 0;
          room.finalJudgment(this);
        }
      }
    }
  }

  damage(n, part) {
    if (this.phase === 3) {
      if (part !== 'weak' && part !== 'stone' && part !== 'flood' && part !== 'burn') return false;
      if (part === 'weak') {
        this.coreHits++;
        n = n >= 99999 ? n : this.phaseHp / 15;
      }
    }
    return super.damage(n, part);
  }

  draw(ctx, t) {
    drawFigure(ctx, drawWarden, this.x, this.y, this.s, { t, phase: this.phase, flash: this.flash * 0.6, slam: this.slam, dying: this.dying, fire: this.fireFlash });
  }
  drawOverlay(ctx, t) {
    if (!this.alive) return;
    for (const r of this.rings) {
      if (r.broken) {
        if (r.broken < 0.3) {
          ctx.save();
          ctx.globalAlpha = 1 - r.broken / 0.3;
          ctx.strokeStyle = '#7affc1';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(r.x, r.y, 26 + r.broken * 80, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        continue;
      }
      drawThreatRing(ctx, r.x, r.y, 26, r.p, t, 5);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(r.x, r.y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (this.phase === 3 && this.moveT >= 1) {
      const c = this.core();
      drawThreatRing(ctx, 640, 340, 250, this.judgment, t, 10);
      text(ctx, 'FINAL JUDGMENT', 640, 80, { size: 26, font: FONT.title, color: '#fff', align: 'center', glow: 12, alpha: 0.9 });
      text(ctx, `CORE ${this.coreHits % 15}/15`, c.x, c.y + 70 * this.s, { size: 22, color: COLORS.violet, align: 'center', glow: 8, stroke: { color: 'rgba(0,0,0,0.8)', width: 4 } });
    }
  }
  hitTest(x, y) {
    if (!this.alive) return null;
    for (const r of this.rings) if (!r.broken && dist(x, y, r.x, r.y) < 28) return { part: 'ring', ring: r };
    const s = this.s;
    if (this.phase === 3) {
      const c = this.core();
      if (dist(x, y, c.x, c.y) < 16 * s + 4) return { part: 'weak' };
      if (Math.abs(x - this.x) < 110 * s && y > this.y - 340 * s && y < this.y) return { part: 'armor' };
      return null;
    }
    const shield = { x: this.x - 112 * s, y: this.y - 250 * s + this.slam * 60 * s, w: 68 * s, h: 190 * s };
    if (x > shield.x && x < shield.x + shield.w && y > shield.y && y < shield.y + shield.h) return { part: 'shield' };
    if (dist(x, y, this.x, this.y - 262 * s) < 30 * s) return { part: 'head' };
    if (Math.abs(x - this.x) < 60 * s && y > this.y - 232 * s && y < this.y - 20 * s) return { part: 'body' };
    const c = this.cannon();
    if (dist(x, y, c.x, c.y) < 34 * s) return { part: 'body' };
    return null;
  }
}

// ---------------------------------------------------------------------------
// Experiment A-4RON (Quarantine Sector mini-boss).
// ---------------------------------------------------------------------------
export class Aaron extends Enemy {
  constructor(room) {
    super(room, 'aaron');
    this.boss = true;
    this.x = 640;
    this.zz = 0.12;
    this.state = 'lumber';
    this.timer = 0;
    this.swing = 0;
    this.vomitT = 6;
    this.vomit = 0;
    this.lines = 0;
  }
  get name() { return ENEMIES.aaron.name; }
  get z() { return this.zz; }
  get s() { return scaleAt(this.zz) * 1.25; }
  get y() { return groundY(this.zz); }
  update(dt, t) {
    this.vomit = Math.max(0, this.vomit - dt * 2);
    if (!this.tick(dt)) return;
    const room = this.room;
    if (room.frozen) return;
    const sp = room.speed;
    this.timer -= dt;
    this.x = 640 + Math.sin(t * 0.6) * 180;
    if (this.lines === 0 && this.hp < this.maxHp * 0.66) { this.lines = 1; room.say(...room.rng.pick([['A-4RON', "Go back to Mom before I tell her you're annoying me again…"], ['A-4RON', 'LEAH! Where did you take her?!']])); }
    if (this.lines === 1 && this.hp < this.maxHp * 0.33) { this.lines = 2; room.say('SUBJECT 87', "Time for the ol' Aaron special. Again."); }
    if (this.state === 'lumber') {
      this.zz += (0.55 / (10 / sp)) * dt;
      if (this.zz >= 0.66) { this.state = 'windup'; this.timer = 1.0 / sp; room.sfxOnce('wetlaugh'); }
    } else if (this.state === 'windup') {
      this.swing = clamp(1 - this.timer / (1.0 / sp), 0, 1);
      if (this.timer <= 0) {
        room.meleeStrike(this, 25, 10, false);
        this.state = 'stagger';
        this.timer = 1.2;
        this.from = this.zz;
      }
    } else if (this.state === 'stagger') {
      const p = 1 - this.timer / 1.2;
      this.swing = Math.max(0, 1 - p * 2);
      this.zz = lerp(this.from, 0.35, easeOut(p));
      if (this.timer <= 0) this.state = 'lumber';
    }
    this.vomitT -= dt;
    if (this.vomitT <= 0 && this.state === 'lumber') {
      this.vomitT = room.rng.range(6, 8) / Math.sqrt(sp);
      this.vomit = 1;
      room.throwGrenade(this, 'bile');
    }
  }
  mouth() { return { x: this.x + Math.sin(this.room.t * 1.8) * 8 * this.s, y: this.y - 250 * this.s }; }
  draw(ctx, t) {
    drawFigure(ctx, drawAaron, this.x, this.y, this.s, { t, swing: this.swing, flash: this.flash * 0.6, dying: this.dying, vomit: this.vomit });
  }
  hitTest(x, y) {
    if (!this.alive) return null;
    const s = this.s;
    const w = aaronWeak(s);
    if (dist(x, y, this.x + w.x, this.y + w.y) < 14 * s + 3) return { part: 'weak', mul: 3 };
    const sway = Math.sin(this.room.t * 1.8) * 6 * s;
    if (dist(x, y, this.x + sway * 1.3, this.y - 270 * s) < 30 * s) return { part: 'head' };
    if (dist(x, y, this.x + sway, this.y - 170 * s) < 76 * s) return { part: 'body' };
    return null;
  }
}
