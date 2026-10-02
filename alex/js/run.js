// A run: three floors of rooms around the concert, money, items, weapons, statistics,
// and the Heartline side-effects (cook-offs, nightmares, girlfriend requests).

import * as THREE from 'three';
import { G } from './state.js';
import { makeRng } from './core/rng.js';
import { generateFloor, OPP, DIRS, hasCombat } from './world/floorgen.js';
import { ROOM_TYPES, SPECIAL } from './world/layouts.js';
import { Room } from './world/room.js';
import { combineMods, ITEMS, itemInfo, rollItems } from './items.js';
import { MELEE, RANGED } from './combat/weapons.js';
import { HEARTLINE, COOKOFF_CHANCE, COOKOFF_GAP, NIGHTMARE_CHANCE, ECONOMY, FLOOR_NAMES, FLOOR_PLACES, PLAYER } from './config.js';
import { DK_STATS, CALLERS } from './phone/callers.js';
import { tickPhoneTimers } from './phone/heartline.js';
import { CookOff } from './phone/cookoff.js';
import { HorseMario } from './phone/platformer.js';
import { NightmareHorse } from './phone/nightmare.js';
import { addPedestals, addExit } from './shop.js';
import { rollRift, EVENT_CHANCE } from './world/rifts.js';
import { GADGETS } from './items.js';
import { updateThrown, clearThrown, tickGadgetTimers, spawnPal } from './gadgets.js';
import { mcInit, addMat } from './mc/world.js';
import { ENCHANTS } from './mc/data.js';

const PROFILE = 'akdh2.profile.v1';
export function loadProfile() {
  try { return { runs: 0, wins: 0, bestFloor: 0, deaths: 0, ...JSON.parse(localStorage.getItem(PROFILE) || '{}') }; } catch { return { runs: 0, wins: 0, bestFloor: 0, deaths: 0 }; }
}
export function saveProfile(p) { try { localStorage.setItem(PROFILE, JSON.stringify(p)); } catch { /* ignore */ } }

// Infinite Mode: after the Demon King the show starts over from the parking lot,
// harder every loop. Scaling for loop n (0 = first time through).
export function loopScale(loop) {
  return { hp: 1 + 0.45 * loop, dmg: 1 + 0.25 * loop, budget: 2 * loop, money: 1 + 0.2 * loop, affix: Math.min(0.35, 0.1 * loop), level: 15 * loop };
}

export class Run {
  constructor(seed = (Math.random() * 2 ** 31) | 0, opts = {}) {
    this.seed = seed;
    this.infinite = !!opts.infinite;
    this.loop = 0;
    this.scale = loopScale(0);
    this.rng = makeRng(seed);
    this.floor = 1;
    this.money = 0;
    this.items = [];
    this.buffs = [];
    this.weapons = { melee: 'hunterBlade', ranged: 'micBlaster' };
    this.gadget = null;
    this.realm = 'overworld';
    mcInit(this);
    this.pal = null;
    this.palActor = null;
    this.vehicle = null;
    this.flags = {};
    this.stats = {};
    this.mods = combineMods([], []);
    this.dkStat = this.rng.pick(Object.keys(DK_STATS));
    this.gfIdx = 0;
    this.hadCall = false;
    this.combatRoomsEntered = 0;
    this.nextRoomMod = null;
    this.inputLocked = false;
    this.godMode = false;
    this.nightmare = { active: false, horse: null, floorUsed: 0 };
    this.cookoffFloor = 0;
    this.startTime = G.time;
    this.floorStart = G.time;
    this.heartline = G.phone;
    this.transition = null;
    this.ended = false;
  }

  roomRng(id) { return makeRng((this.seed ^ (this.floor * 100003) ^ (id * 7919) ^ (this.loop * 3571) ^ (this.realmSalt || 0)) | 0); }

  start() {
    const p = loadProfile();
    p.runs++;
    saveProfile(p);
    G.alex.reset();
    this.recomputeMods();
    this.startFloor(1);
  }

  startFloor(n) {
    this.floor = n;
    this.floorStart = G.time;
    this.flags.bathroomKey = 0;
    this.flags.atlas = false;
    this.buffs = this.buffs.filter((b) => !b.floor);
    this.recomputeMods();
    this.map = generateFloor(n, this.rng.fork());
    this.enterRoom(this.map.startId, null);
    G.audio.playMusic('floor' + n, { restart: true });
    G.hud.roomTitle(`${this.loop ? `∞ LOOP ${this.loop + 1} · ` : ''}FLOOR ${n} — ${FLOOR_NAMES[n - 1]}`, FLOOR_PLACES[n - 1]);
    const p = loadProfile();
    p.bestFloor = Math.max(p.bestFloor, n);
    if (this.infinite) p.bestLoop = Math.max(p.bestLoop || 0, this.loop + 1);
    saveProfile(p);
  }

  nextFloor() {
    if (this.transition) return;
    G.audio.sfx('door');
    if (this.floor >= 3 && this.infinite) {
      this.fade(() => {
        this.loop++;
        this.scale = loopScale(this.loop);
        this.stat('loops', 1);
        G.hud.popup(`∞ ENCORE — LOOP ${this.loop + 1}`, '#ff4fa3', 2.4);
        this.startFloor(1);
      });
      return;
    }
    this.fade(() => this.startFloor(this.floor + 1));
  }

  // ---------------------------------------------------------------------------
  enterRoom(id, fromSide) {
    const prev = G.room;
    if (prev) prev.dispose();
    clearThrown();
    if (this.palActor) { this.palActor.dispose(); this.palActor = null; }
    G.projectiles.clear();
    G.areas.clear();
    G.targeting.reset();
    G.hud.plates.clear();
    G.hud.clearRoomUI();
    const def = this.map.rooms[id];
    const firstVisit = !def.visited;
    def.visited = true;
    for (const nid of Object.values(def.doors)) this.map.rooms[nid].seen = true;
    this.roomId = id;
    // doors (the secret bathroom only exists once you own the key)
    let doors = Object.entries(def.doors)
      .filter(([, to]) => !this.map.rooms[to].hidden || this.flags.bathroomKey === this.floor)
      .map(([side, to]) => ({ side, to, kind: this.map.rooms[to].kind }));
    if (def.kind === 'boss') doors = doors.map((d) => ({ ...d, side: 'S', realSide: d.side }));
    const room = new Room(def, this.floor, doors);
    G.room = room;
    // place Alex just inside the door he came through
    let entrySide = fromSide ? OPP[fromSide] : null;
    if (def.kind === 'boss') entrySide = 'S';
    const L = room.L;
    let x = 0, z = 0, yaw = Math.PI;
    if (entrySide) {
      const inset = 3.8;
      if (entrySide === 'N') { z = -L.d / 2 + inset; yaw = 0; }
      if (entrySide === 'S') { z = L.d / 2 - inset; yaw = Math.PI; }
      if (entrySide === 'W') { x = -L.w / 2 + inset; yaw = Math.PI / 2; }
      if (entrySide === 'E') { x = L.w / 2 - inset; yaw = -Math.PI / 2; }
    } else if (def.kind === 'start') { z = 2.5; yaw = Math.PI; }
    const y = room.world.groundAt(x, z, 20, 0.3).h;
    G.alex.place(x, y, z, yaw);
    G.cam.snapBehind(yaw, G.alex.pos);
    G.alex.spawnSafe(PLAYER.spawnSafe);
    G.input.clearBuffers();
    if (firstVisit) {
      for (const b of this.buffs) if (!b.floor) b.roomsLeft--;
      const before = this.buffs.length;
      this.buffs = this.buffs.filter((b) => b.floor || b.roomsLeft > 0);
      if (this.buffs.length !== before) this.recomputeMods();
    }
    if (hasCombat(def) && !def.cleared) this.combatRoomsEntered++;
    // crossover rifts are rolled once, on the first visit to a fight
    if (firstVisit && hasCombat(def) && !def.cleared && def.kind !== 'boss' && def.rift === undefined) def.rift = rollRift(this.floor, this.rng, { chance: this.forceRift ? 1 : undefined });
    if (this.forceRift && def.rift) { if (this.forceRift !== true) def.rift = { id: this.forceRift, plague: this.forceRift === 'bible' ? (this.forcePlague || 'hail') : undefined }; this.forceRift = null; }
    // random room events, rolled once per room (all generous)
    if (firstVisit && !def.ev) {
      const fight = hasCombat(def) && def.kind !== 'boss';
      const r = this.rng;
      def.ev = { vehicle: fight && r() < EVENT_CHANCE.vehicle, merchant: fight && r() < EVENT_CHANCE.merchant, crafting: fight && r() < EVENT_CHANCE.crafting, bush: fight && r() < EVENT_CHANCE.bush };
    }
    G.alex.absorb = 0;
    room.begin();
    if (this.pal) spawnPal();
    // your ride comes through the door with you
    if (this.vehicle) {
      const sv = this.vehicle;
      const v = room.spawnVehicle(sv.type, G.alex.pos.x, G.alex.pos.z, yaw, { hp: sv.hp, life: sv.life });
      v.mount();
    }
    this.stat('roomsEntered', 1);
    // music
    if (def.kind !== 'gas' && def.kind !== 'boss' && G.audio.musicName() !== 'floor' + this.floor) G.audio.playMusic('floor' + this.floor);
    // room title
    const special = { start: 'ARRIVAL', gas: 'GAS & GO — Open 24/7 (Somehow)', treasure: 'LOST & FOUND', secret: 'A BATHROOM?', boss: '♥ THE STAGE ♥', preboss: 'THE LAST DOOR' };
    if (def.kind !== 'start' || fromSide) {
      const title = special[def.kind] && def.kind !== 'preboss' ? special[def.kind] : `${ROOM_TYPES[this.floor][def.type] || ''} — ${L.name}`;
      if (def.kind !== 'boss') G.hud.roomTitle(title, def.cleared ? 'cleared' : hasCombat(def) ? '' : '');
    }
    // nightmare horse follows between rooms; new nightmares roll on entering fights
    if (this.nightmare.active && this.nightmare.horse) {
      const ex = entrySide === 'N' ? [0, -L.d / 2 + 1] : entrySide === 'S' ? [0, L.d / 2 - 1] : entrySide === 'W' ? [-L.w / 2 + 1, 0] : entrySide === 'E' ? [L.w / 2 - 1, 0] : [0, 0];
      this.nightmare.horse.enterRoom(G.room.group, { x: ex[0], z: ex[1] });
    } else if (hasCombat(def) && !def.cleared && this.nightmare.floorUsed !== this.floor && def.kind !== 'boss') {
      const chance = NIGHTMARE_CHANCE[G.phone.hearts('mario')] || 0;
      if (this.rng() < chance) this.pendingNightmare = G.time + 1.4;
    }
  }

  goThroughDoor(door) {
    if (this.transition) return;
    const side = door.realSide || door.side;
    G.audio.sfx('door');
    this.fade(() => this.enterRoom(door.to, side));
  }

  fade(fn) {
    const f = document.getElementById('fade');
    this.transition = { t: 0, fn, done: false };
    this.inputLocked = true;
    f.classList.add('on');
    setTimeout(() => {
      fn();
      this.inputLocked = false;
      setTimeout(() => { f.classList.remove('on'); this.transition = null; }, 60);
    }, 190);
  }

  teleportToPreboss() {
    const pre = this.map.rooms.find((r) => r.kind === 'preboss');
    if (!pre) return;
    G.hud.popup('WRONG CONCERT. RIGHT DIRECTION.', '#ffd60a', 1.6);
    this.fade(() => this.enterRoom(pre.id, null));
  }

  // ---------------------------------------------------------------------------
  update(dt) {
    if (this.transition) return;
    const room = G.room;
    this.stat('time', dt);
    room.update(dt);
    tickPhoneTimers();
    updateThrown(dt);
    tickGadgetTimers();
    if (this.palActor && this.palActor.alive) this.palActor.update(dt);
    if (this.pendingNightmare && G.time > this.pendingNightmare) { this.pendingNightmare = null; this.startNightmare(); }
    if (this.nightmare.active && this.nightmare.horse && G.mode === 'run') {
      if (this.nightmare.horse.update(dt)) this.caughtByHorse();
    }
    if (G.mode === 'run' && G.alex.alive) {
      const d = room.doorCrossed();
      if (d) this.goThroughDoor(d);
    }
    // cook-off queued after a room clear (never mid-fight)
    if (this.pendingCookoff && G.time > this.pendingCookoff && !G.phone.busy()) { this.pendingCookoff = null; this.startCookoff(); }
  }

  onRoomCleared(room) {
    G.codex?.save();
    if (this.mods.clearHeal) G.alex.heal(this.mods.clearHeal, true);
    if (this.gadget && !GADGETS[this.gadget.id].cooldown && this.gadget.charges < this.gadget.max) { this.gadget.charges++; G.hud.popup(`${GADGETS[this.gadget.id].icon} +1 ${GADGETS[this.gadget.id].name}`, '#7dd3fc', 1, true); }
    if (this.mods.clearMoney) this.addMoney(this.mods.clearMoney);
    // Ugly Girlfriend: losing hearts raises the Cook-Off chance
    const clears = this.stats.roomsCleared || 0;
    if (this.cookoffFloor !== this.floor && room.def.kind !== 'boss' && clears - (this.lastCookoffClear ?? -COOKOFF_GAP) >= COOKOFF_GAP) {
      const chance = COOKOFF_CHANCE[G.phone.hearts('ugly')] || 0;
      if (this.rng() < chance) { this.cookoffFloor = this.floor; this.lastCookoffClear = clears; this.pendingCookoff = G.time + 1.2; }
    }
  }

  onKill(e) { /* stats handled in enemy.die; hook kept for Demon King lines */ }

  onBossDefeated(room) {
    const b = room.bossInfo;
    G.hud.hideBoss();
    this.stat('bossesDefeated', 1);
    G.fx.confetti(0, 5, -4, 160);
    G.audio.sfx('cheer');
    room.dropMoney(0, -4, 70 + this.rng.int(40));
    G.alex.heal(40);
    if (this.floor < 3) {
      G.hud.popup(this.floor === 1 ? 'THE OPENING ACT IS OVER' : 'THE HEADLINER GUARDIAN FALLS', '#ffd60a', 2.4);
      addPedestals(room, 'boss', 1, {});
      addExit(room);
    } else if (this.infinite) {
      G.hud.popup(`LOOP ${this.loop + 1} CLEARED — THE SHOW GOES ON`, '#ffd60a', 3);
      const p = loadProfile();
      p.wins++;
      saveProfile(p);
      addPedestals(room, 'boss', 2, { choose: false });
      addExit(room);
    } else {
      G.hud.popup('THE K-POP DEMON KING IS DEFEATED', '#ffd60a', 3);
      this.inputLocked = true;
      setTimeout(() => G.screens.victory(), 3600);
    }
  }

  onDeath() {
    if (this.ended) return;
    G.codex?.save();
    this.ended = true;
    const p = loadProfile();
    p.deaths++;
    saveProfile(p);
    setTimeout(() => G.screens.gameOver(), 2300);
  }

  // ---------------------------------------------------------------------------
  addMoney(n, spend) {
    if (n > 0 && !spend) n = Math.round(n * this.scale.money);
    this.money = Math.max(0, this.money + n);
    if (n > 0 && !spend) this.stat('moneyCollected', n);
    if (n < 0) this.stat('moneySpent', -n);
  }

  grant(id) {
    const it = itemInfo(id);
    if (!it) return;
    if (it.gadget) {
      const g = GADGETS[it.gadget];
      this.gadget = { id: it.gadget, charges: g.charges || 0, max: g.charges || 0, readyAt: 0 };
      G.hud.popup('GADGET: ' + it.icon + ' ' + it.name + ' — press ' + G.input.glyph('gadget'), '#7dd3fc', 2);
      this.stat('gadgetsFound', 1);
      return;
    }
    if (it.devilFruit && this.items.some((k) => ITEMS[k]?.devilFruit)) {
      G.hud.popup('YOU ATE A SECOND DEVIL FRUIT. THAT IS NOT HOW THIS WORKS.', '#e63946', 2.2);
      G.alex.hp = Math.max(1, G.alex.hp - 30);
      G.fx.flash(0.3, '#e63946');
    }
    if (it.absorb) G.alex.absorb = Math.max(G.alex.absorb || 0, it.absorb);
    if (it.weapon) {
      this.weapons[it.slot] = it.weapon;
      G.hud.popup('EQUIPPED: ' + it.name, '#4cc9f0', 1.6);
      if (it.slot === 'melee') G.alex.model.setBladeColor(MELEE[it.weapon].color);
      this.stat('weaponsFound', 1);
      return;
    }
    if (it.heal) G.alex.heal(it.heal);
    if (it.poisonChance && this.rng() < it.poisonChance) {
      this.buffs.push({ id: 'sushi', roomsLeft: 2, mods: { moveMul: 0.85, dashRechargeMul: 0.8 } });
      G.hud.popup('FOOD POISONING (2 rooms)', '#9ef01a', 1.6);
    }
    if (it.timed) this.buffs.push({ id, roomsLeft: it.timed.rooms || 0, floor: !!it.timed.floor, mods: it.timed.mods });
    if (it.mods) this.items.push(id);
    if (it.flag === 'bathroomKey') {
      this.flags.bathroomKey = this.floor;
      const sec = this.map.rooms.find((r) => r.kind === 'secret');
      if (sec) sec.seen = true;
      G.hud.popup('A DOOR APPEARS SOMEWHERE ON THIS FLOOR', '#b5838d', 1.8);
      // reveal the door if we're standing in the room next to it
      const cur = this.map.rooms[this.roomId];
      if (sec && Object.values(cur.doors).includes(sec.id)) setTimeout(() => this.fade(() => this.enterRoom(this.roomId, null)), 800);
    }
    if (it.flag === 'atlas') { this.flags.atlas = true; G.hud.popup('MAP REVEALED', '#ffd60a', 1.4); }
    if (it.flag === 'mints') { this.flags.mints = true; }
    if (it.shirt) G.alex.model.setShirt(true);
    this.recomputeMods();
    if (!it.heal && !it.weapon) G.hud.popup('GOT: ' + (it.icon || '') + ' ' + it.name, '#ffd60a', 1.4, true);
  }

  // Enchantments and carried trophies act like permanent buffs.
  passiveBuffs() {
    const out = [];
    for (const [id, lvl] of Object.entries(this.ench || {})) for (let i = 0; i < lvl; i++) out.push({ mods: ENCHANTS[id]?.mods });
    if (this.inv?.dragonEgg) out.push({ mods: ITEMS.dragonEgg.mods });
    return out;
  }

  recomputeMods() {
    this.mods = combineMods(this.items, [...this.buffs, ...this.passiveBuffs()]);
    const a = G.alex;
    const newMax = PLAYER.maxHp + this.mods.maxHp;
    if (newMax !== a.maxHp) { const gain = newMax - a.maxHp; a.maxHp = newMax; if (gain > 0) a.hp += gain; a.hp = Math.min(a.hp, a.maxHp); }
  }

  consumeRevive() {
    const i = this.items.indexOf('warranty');
    if (i < 0) return false;
    this.items.splice(i, 1);
    this.recomputeMods();
    this.stat('revives', 1);
    return true;
  }

  addBlocks(n) { addMat('cobblestone', n); }
  stat(name, n) { this.stats[name] = (this.stats[name] || 0) + n; }
  statValue(name) {
    const s = this.stats;
    if (name === 'accuracy') return s.shotsFired ? Math.round(((s.shotsHit || 0) / s.shotsFired) * 100) : 0;
    if (name === 'moneyHeld') return this.money;
    if (name === 'floorTime') return Math.round(G.time - this.floorStart);
    return Math.round(s[name] || 0);
  }

  gfRequest() { const r = HEARTLINE.gfRequests; return { idx: Math.min(this.gfIdx, r.length - 1), amount: r[Math.min(this.gfIdx, r.length - 1)] }; }
  advanceGfRequest(n = 1) { this.gfIdx += n; }
  girlfriendGift() {
    const pool = rollItems(this.rng() < 0.5 ? 'counter' : 'snack', 1, this.rng, this).filter((k) => k !== 'bathroomKey');
    if (pool[0]) { this.grant(pool[0]); G.hud.popup('GIRLFRIEND SENT: ' + (ITEMS[pool[0]]?.name || ''), '#ff4fa3', 1.8); } else G.alex.heal(25);
  }

  // ---------------------------------------------------------------------------
  startCookoff() {
    if (G.mode !== 'run') return;
    G.hud.popup('UGLY KITCHEN COOK-OFF', '#2ec4b6', 1.2);
    G.mode = 'minigame';
    G.input.releaseLock();
    const done = () => {
      G.minigame = null;
      document.getElementById('mini').classList.remove('on');
      G.mode = 'run';
      G.audio.playMusic('floor' + this.floor, { restart: true });
      G.alex.spawnSafe(1.5);
      G.input.clearBuffers();
    };
    G.minigame = new CookOff(done);
    document.getElementById('mini').classList.add('on');
    this.stat('cookoffs', 1);
  }

  startNightmare() {
    if (G.mode !== 'run' || this.nightmare.active) return;
    this.nightmare.active = true;
    this.nightmare.floorUsed = this.floor;
    G.audio.stopMusic();
    G.audio.sfx('static');
    G.pixelateUntil = G.realTime + 1.4;
    const horse = new NightmareHorse();
    this.nightmare.horse = horse;
    setTimeout(() => { if (this.nightmare.horse === horse) { horse.spawnBehind(G.room.group); G.audio.sfx('neigh'); G.hud.popup('...', '#e63946', 1.4); } }, 1400);
    this.stat('nightmares', 1);
  }

  caughtByHorse() {
    const horse = this.nightmare.horse;
    const hpBefore = G.alex.hp;
    G.mode = 'minigame';
    G.input.releaseLock();
    G.audio.sfx('neigh');
    G.pixelateUntil = G.realTime + 0.8;
    document.getElementById('mini').classList.add('on');
    G.minigame = new HorseMario((won) => {
      horse.remove();
      this.nightmare.active = false;
      this.nightmare.horse = null;
      G.minigame = null;
      document.getElementById('mini').classList.remove('on');
      G.mode = 'run';
      G.audio.playMusic('floor' + this.floor, { restart: true });
      G.alex.spawnSafe(2);
      G.input.clearBuffers();
      if (won) {
        const d = G.phone.change('mario', 2);
        G.phone.toast('mario', 'thank you horse', d);
        this.stat('nightmaresSurvived', 1);
      } else {
        // out of lives: Alex wakes up where he was, with half the health he had
        G.alex.hp = Math.max(1, Math.round(hpBefore / 2));
        G.fx.hurtVignette(0.9);
        G.hud.popup('THE HORSE WON — HALF HEALTH', '#e63946', 2);
        G.phone.toast('mario', 'horse won. baby mario sorry', 0);
        this.stat('nightmaresLost', 1);
      }
    });
  }
}
