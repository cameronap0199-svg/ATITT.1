// A live room: meshes + collision from the builder, enemy waves with spawn safety,
// locked doors during fights, pickups with magnet collection, destructible props,
// interactables (shop shelves, pedestals, kiosks, exits) and clear rewards.

import * as THREE from 'three';
import { G } from '../state.js';
import { buildLayout } from './layouts.js';
import { buildRoom } from './builder.js';
import { layoutByKey, hasCombat } from './floorgen.js';
import { composeEncounter, ENEMY_INFO } from './encounters.js';
import { makeHazard } from './hazards.js';
import { createEnemy } from '../actors/enemies.js';
import { spawnBoss, tickTimers, clearTimers } from '../actors/bosses.js';
import { ECONOMY, PLAYER } from '../config.js';
import { GEO, glow, mat, textTexture } from './props.js';
import { stockGasStation, addPedestals, addScalper, addExit } from '../shop.js';
import { rollAffix } from '../actors/affixes.js';
import { RIFTS, composeRift, CROSS_INFO, EVENT_CHANCE } from './rifts.js';
import { openRift, updateRift, closeRift, disposeRift } from './riftRoom.js';
import { addCraftingTable, addMerchant, addBurningBush } from './events.js';
import { Vehicle, VEHICLE_IDS } from '../vehicles.js';

const threatOfType = (k) => (ENEMY_INFO[k] || CROSS_INFO[k.replace('rift:', '')])?.threat || 1;

const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14);
const billGeo = new THREE.BoxGeometry(0.42, 0.02, 0.2);
const heartGeo = (() => { const g = new THREE.SphereGeometry(0.22, 10, 8); return g; })();
const blockGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
const blockMats = [new THREE.MeshToonMaterial({ color: '#8b5a2b' }), new THREE.MeshToonMaterial({ color: '#5bb450' })];

export class Room {
  constructor(def, floor, doorsIn) {
    this.def = def;
    this.floor = floor;
    const layout = layoutByKey(floor, def.layout);
    this.layout = layout;
    const rng = G.run.roomRng(def.id);
    this.rng = rng;
    this.L = buildLayout(layout, floor, rng, doorsIn.map((d) => d.side));
    const built = buildRoom(this.L, floor, doorsIn);
    Object.assign(this, built);
    this.world = built.world;
    this.group = built.group;
    G.scene.add(this.group);
    this.enemies = [];
    this.corpses = [];
    this.pickups = [];
    this.interactables = [];
    this.hazards = this.L.hazards.map((h) => makeHazard(this, h)).filter(Boolean);
    this.waves = [];
    this.waveIdx = 0;
    this.cleared = def.cleared || !hasCombat(def) && def.kind !== 'boss';
    this.enteredAt = G.time;
    this.fightStarted = false;
    this.bossInfo = null;
    this.telegraphK = 1;
    this.enemyAtkK = 1;
    this.vehicles = [];
    this.world.buildNav();
    this.flowT = 0;
    if (this.L.concert) G.audio.setCrowd(this.L.concert);
    else G.audio.setCrowd(floor === 3 ? 0.15 : 0);
  }

  // ---------------------------------------------------------------------------
  begin() {
    const def = this.def;
    this.enteredAt = G.time;
    if (!this.cleared && hasCombat(def)) this.spawnEncounter();
    else if (def.kind === 'boss' && !def.cleared) this.startBoss();
    this.setDoorsLocked(!this.cleared);
    // special contents
    if (def.kind === 'gas') stockGasStation(this);
    if (def.kind === 'treasure') addPedestals(this, 'treasure', 2, { choose: true });
    if (def.kind === 'secret') { addPedestals(this, 'secret', 1, {}); if (!def.looted) { this.dropMoney(0, -2, 15); } }
    if (def.kind === 'boss' && def.cleared && this.floor < 3) { addPedestals(this, 'boss', 1, {}); addExit(this); }
    if (def.kind === 'start' && this.floor === 1 && !def.visited) G.hud.tutorial();
    // parked vehicles stay where you left them; some fights come with a free ride
    if (def.parked) { for (const p of def.parked) this.spawnVehicle(p.type, p.x, p.z, p.yaw, p); def.parked = null; }
    if (def.ev?.vehicle && !def.vehicleSpawned) {
      def.vehicleSpawned = true;
      const p = this.world.openPoint(this.rng, [{ x: G.alex.pos.x, z: G.alex.pos.z, r: 4 }], 4, 0.3, 3.5);
      if (p) { const type = this.rng.pick(VEHICLE_IDS); this.spawnVehicle(type, p.x, p.z, this.rng() * Math.PI * 2); G.hud.popup('A RIDE IS PARKED HERE — ' + G.input.glyph('ride') + ' / ' + G.input.glyph('interact') + ' to hop in', '#67f3ff', 2, true); }
    }
    // restore uncollected pickups
    if (def.savedPickups) { for (const p of def.savedPickups) this.addPickup(p.kind, p.x, p.z, p.value, true); def.savedPickups = null; }
  }

  combatLive() { return !this.cleared && (this.enemies.some((e) => e.alive) || this.waveIdx < this.waves.length); }

  spawnEncounter() {
    const def = this.def;
    let budget = (def.budget || 4) + (this.L.budgetAdd || 0);
    const dk = G.run.nextRoomMod;
    if (dk) { budget += dk.threat || 0; this.moneyK = dk.money || 1; this.extra = dk.extra; G.run.nextRoomMod = null; if (dk.text) G.hud.popup(dk.text, '#ff006e', 1.6); }
    const rift = def.rift;
    const enc = composeEncounter(this.floor, rift ? Math.max(2, budget * 0.45) : budget, this.rng, { type: def.type, mimicSpots: this.L.mimicSpots.length > 0, waves: rift ? 1 : this.L.waves });
    this.waves = enc.waves;
    if (this.extra) this.waves[0].push(...this.extra);
    if (rift) {
      // part of the fight comes through the rift, in two pushes
      openRift(this);
      const list = composeRift(rift.id, this.floor, Math.max(2.5, budget * 0.75), this.rng).map((k) => 'rift:' + k);
      if (rift.plague === 'frogs') list.push('rift:frog', 'rift:frog', 'rift:frog');
      if (rift.plague === 'locusts') list.push('rift:locust', 'rift:locust');
      const half = Math.ceil(list.length / 2);
      this.waves[0].push(...list.slice(0, half));
      if (list.length > half) this.waves.push(list.slice(half));
    }
    this.waveIdx = 0;
    this.spawnWave();
  }

  spawnWave() {
    const list = this.waves[this.waveIdx++];
    if (!list) return;
    const a = G.alex;
    const avoid = [{ x: a.pos.x, z: a.pos.z, r: 7.5 }];
    for (const d of this.doors) avoid.push({ x: d.x, z: d.z, r: 4 });
    const mimicSpots = this.L.mimicSpots.slice();
    const [fx, fz] = G.cam.forward();
    let delay = 0;
    for (let type of list) {
      let p = null, extra = {};
      if (type.startsWith('rift:')) {
        type = type.slice(5);
        const r = this.rift;
        if (r) {
          p = this.world.openPointNear(this.rng, r.x, r.z, 4.5, [{ x: a.pos.x, z: a.pos.z, r: 5 }]);
          if (p) G.fx.burst(p.x, 1.2, p.z, { n: 14, color: [r.def.color, r.def.color2, '#ffffff'], speed: 5, life: 0.5 });
        }
      }
      if (type === 'mimic' && mimicSpots.length) { const s = mimicSpots.shift(); p = { x: s.x, z: s.z }; extra = { disguised: true, yaw: s.rot }; }
      for (let tries = 0; !p && tries < 20; tries++) {
        const q = this.world.openPoint(this.rng, avoid, 7.5);
        if (!q) break;
        if (this.L.spawnOutside && Math.hypot(q.x, q.z) < this.L.spawnOutside && tries < 15) continue;
        if (type === 'stalker') {
          // never directly behind Alex
          const dx = q.x - a.pos.x, dz = q.z - a.pos.z, l = Math.hypot(dx, dz) || 1;
          if ((dx * fx + dz * fz) / l < -0.2 && tries < 18) continue;
        }
        p = q;
      }
      if (!p) p = { x: (this.rng() - 0.5) * this.L.w * 0.6, z: (this.rng() - 0.5) * this.L.d * 0.6 };
      const e = this.spawnEnemy(type, p.x, p.z, { readyDelay: 1.3 + delay, ...extra });
      if (e && !e.boss && !extra.disguised) { const af = rollAffix(this.rng, this.floor, type); if (af) e.applyAffix(af); }
      delay += 0.08;
      if (e) avoid.push({ x: p.x, z: p.z, r: 1.6 });
    }
    this.waveThreat = list.reduce((s, k) => s + threatOfType(k), 0);
    this.waveMembers = this.enemies.filter((e) => e.alive);
    this.fightStarted = true;
    G.audio.sfx('spawn', { v: 0.6 });
  }

  spawnEnemy(type, x, z, opts = {}) {
    const e = createEnemy(type, x, z, opts);
    if (!e) return null;
    G.codex?.see(type);
    this.enemies.push(e);
    return e;
  }

  startBoss() {
    const info = spawnBoss(this.floor, this);
    this.bossInfo = info;
    for (const e of info.list) this.enemies.push(e);
    if (this.floor === 3) this.world.add({ kind: 'bossBody', x: 0, z: -14.5, w: 6, d: 4.5, h: 8, shoot: false, camBlock: false, vault: false });
    this.fightStarted = true;
    G.hud.bossIntro(info.title, info.subtitle);
    G.audio.playMusic('boss' + this.floor, { restart: true });
    G.alex.spawnSafe(2.5);
    this.telegraphK = G.run.mods.telegraphK || 1;
  }

  setDoorsLocked(locked) {
    for (const d of this.doors) {
      if (d.locked === locked) continue;
      d.locked = locked;
      d.frame.userData.tape.visible = locked;
      if (locked) d.blocker = this.world.add({ ...d.blockerDesc });
      else if (d.blocker) { this.world.remove(d.blocker); d.blocker = null; }
    }
  }

  // ---------------------------------------------------------------------------
  onEnemyDeath(e, info) {
    const moneyKind = e.money;
    if (!e.noDrop) this.dropFromEnemy(e, moneyKind);
    if (!e.noDrop && (e.franchise === 'minecraft' || Math.random() < 0.06)) this.addPickup('block', e.pos.x, e.pos.z, e.franchise === 'minecraft' ? 1 + (Math.random() < 0.45 ? 1 : 0) : 1);
    if (!e.noRevive && !e.boss) this.corpses.push({ type: e.type, x: e.pos.x, z: e.pos.z, used: false, noRevive: false });
    G.run.onKill(e, info);
  }

  dropFromEnemy(e, kind) {
    const r = ECONOMY.drop[kind] || ECONOMY.drop.normal;
    const chance = kind === 'normal' ? Math.min(1, ECONOMY.dropChance + (G.run.mods.moneyChance || 0)) : 1;
    if (Math.random() < chance) {
      let amt = Math.round(r[0] + Math.random() * (r[1] - r[0]));
      amt = Math.round(amt * (this.moneyK || 1) * (G.run.mods.moneyMul || 1));
      this.dropMoney(e.pos.x, e.pos.z, amt);
    }
    if (Math.random() < ECONOMY.heartDrop + (e.elite ? 0.25 : 0)) this.addPickup('heart', e.pos.x, e.pos.z, 12);
  }
  dropMoney(x, z, amt) {
    let bills = Math.floor(amt / 5), coins = amt % 5;
    if (bills > 12) { coins += (bills - 12) * 5; bills = 12; }
    for (let i = 0; i < bills; i++) this.addPickup('bill', x, z, 5);
    for (let i = 0; i < Math.min(coins, 30); i++) this.addPickup('coin', x, z, 1 + (i === 29 ? coins - 30 : 0));
  }
  addPickup(kind, x, z, value, still) {
    let mesh;
    if (kind === 'coin') mesh = new THREE.Mesh(coinGeo, mat('#ffd60a', { emissive: '#b8860b', emissiveIntensity: 0.4 }));
    else if (kind === 'bill') mesh = new THREE.Mesh(billGeo, mat('#52b788', { emissive: '#1b4332', emissiveIntensity: 0.4 }));
    else if (kind === 'block') mesh = new THREE.Mesh(blockGeo, [blockMats[0], blockMats[0], blockMats[1], blockMats[0], blockMats[0], blockMats[0]]);
    else mesh = new THREE.Mesh(heartGeo, glow('#ff4d6d'));
    const y = this.world.groundAt(x, z, 10, 0.1).h;
    mesh.position.set(x, y + 0.3, z);
    this.group.add(mesh);
    const a = Math.random() * Math.PI * 2, sp = still ? 0 : 2 + Math.random() * 3;
    this.pickups.push({ kind, value, mesh, x, y: y + 0.3, z, vx: Math.sin(a) * sp, vy: still ? 0 : 5 + Math.random() * 2, vz: Math.cos(a) * sp, t: 0, ground: y });
  }

  // ---------------------------------------------------------------------------
  damageBlock(b, dmg, src) {
    if (!b || b.hp == null || !b.alive) return;
    b.hp -= dmg;
    if (b.meshes) { b.meshes.position.x = b.x + (Math.random() - 0.5) * 0.08; setTimeout(() => { if (b.meshes) b.meshes.position.x = b.x; }, 60); }
    if (b.hp > 0) return;
    this.destroyBlock(b);
  }
  destroyBlock(b) {
    this.world.remove(b);
    if (b.meshes) { this.group.remove(b.meshes); }
    const col = b.data.color || '#999';
    const cx = b.x, cz = b.z, cy = (b.y0 + b.y1) / 2;
    G.fx.burst(cx, cy, cz, { n: 24, kind: 'debris', color: [col, '#444', '#ddd'], speed: 7, up: 1, life: 1.0, size: 0.25 });
    if (b.kind === 'rack' || b.data.model === 'shirtwall' || b.data.model === 'rack') G.fx.confetti(cx, cy + 0.5, cz, 40);
    if (b.kind === 'block') this.addPickup('block', cx, cz, 1);
    if (b.data.model === 'car') {
      G.areas.circle({ x: cx, z: cz, r: 2.8, delay: 0.05, dmg: 14, ff: true, enemyDmg: 20, owner: 'hazard', style: 'fire', sound: 'boom', shake: 0.4, propDmg: 20 });
      G.hud.bubble({ pos: new THREE.Vector3(cx, 0, cz), height: 1.5, alive: true }, 'CAR ALARM!', '#ff2e4d', 1.2);
    }
    G.audio.sfx('hitHeavy', { v: 0.5, pan: G.cam.panOf(cx, cz) });
    G.run.stat('propsDestroyed', 1);
  }
  damageBlocksInRadius(x, z, r, dmg) {
    for (const b of this.world.blocks.slice()) if (b.hp != null && b.alive && Math.hypot(b.x - x, b.z - z) < r + b.radius() * 0.6) this.damageBlock(b, dmg);
  }
  damageBlocksInArc(x, z, yaw, range, halfArc, dmg) {
    for (const b of this.world.blocks.slice()) {
      if (b.hp == null || !b.alive) continue;
      const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
      if (d - b.radius() * 0.7 > range) continue;
      const a = Math.abs(((Math.atan2(dx, dz) - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (a < halfArc + 0.3 || d < 1.2) this.damageBlock(b, dmg);
    }
  }

  // ---------------------------------------------------------------------------
  addInteractable(o) { this.interactables.push(o); if (o.mesh) this.group.add(o.mesh); return o; }
  removeInteractable(o) { this.interactables = this.interactables.filter((x) => x !== o); if (o.mesh) this.group.remove(o.mesh); }

  update(dt) {
    const a = G.alex;
    tickTimers();
    // flow field toward Alex for navigation
    this.flowT -= dt;
    if (this.flowT <= 0) { this.flowT = 0.22; this.world.flowTo(a.pos.x, a.pos.z, a.pos.y); }
    for (const e of this.enemies) e.update(dt);
    if (this.bossInfo?.ctrl) this.bossInfo.ctrl.update(dt);
    const live = this.combatLive() && G.time - this.enteredAt > 1.4;
    for (const h of this.hazards) h.update(dt, live);
    for (const fn of this.animators) fn(G.time, dt);
    updateRift(this, dt);
    for (const v of this.vehicles) if (!v.driver) v.update(dt);
    // waves
    if (!this.cleared && this.fightStarted) {
      if (this.waveIdx < this.waves.length) {
        const alive = this.waveMembers.filter((e) => e.alive);
        const left = alive.reduce((s, e) => s + (e.threat || 1), 0);
        if (!alive.length || left < this.waveThreat * 0.3) this.spawnWave();
      } else if (!this.enemies.some((e) => e.alive)) this.onClear();
    }
    this._pickups(dt);
    this._interact();
    this.enemies = this.enemies.filter((e) => e.alive || G.time - (e.deadAt || 0) < 0);
    if (this.enemies.length > 60) this.enemies = this.enemies.filter((e) => e.alive);
  }

  onClear() {
    this.cleared = true;
    this.def.cleared = true;
    this.setDoorsLocked(false);
    G.projectiles.clearHostile();
    G.areas.clear();
    clearTimers();
    G.hud.hideBoss();
    G.audio.sfx('clear');
    const a = G.alex;
    if (this.def.kind === 'boss') {
      G.audio.playMusic('floor' + this.floor);
      G.run.onBossDefeated(this);
      return;
    }
    G.run.stat('roomsCleared', 1);
    G.hud.popup('ROOM CLEARED', '#3cff8f', 1.1);
    if (this.rift) closeRift(this);
    // Isaac-style clear reward
    const reward = this.L.reward;
    const cx = a.pos.x * 0.3, cz = a.pos.z * 0.3;
    if (reward === 'money') this.dropMoney(0, 0, 8 + Math.floor(Math.random() * 7));
    else if (reward === 'food') { this.addPickup('heart', -1, 0, 12); this.addPickup('heart', 1, 0, 12); G.hud.popup('THE FOOD TRUCK LEFT SNACKS', '#ffd166', 1.4); }
    else if (reward === 'consumable') addPedestals(this, 'counter', 1, {});
    else if (reward === 'scalper') addScalper(this);
    else if (reward === 'toilet') { this.dropMoney(0, 0, 6 + Math.floor(Math.random() * 6)); if (Math.random() < 0.3) addPedestals(this, 'key', 1, {}); }
    else if (Math.random() < EVENT_CHANCE.bonusDrop) {
      if (Math.random() < 0.5) this.dropMoney(cx, cz, 3 + Math.floor(Math.random() * 6));
      else this.addPickup('heart', cx, cz, 12);
    }
    if (this.def.kind === 'preboss') this.addPickup('heart', 0, 0, 25);
    const ev = this.def.ev || {};
    if (ev.crafting || this.rift?.id === 'minecraft') addCraftingTable(this);
    if (ev.merchant) addMerchant(this);
    if (ev.bush || (this.rift?.id === 'bible' && Math.random() < 0.35)) addBurningBush(this);
    G.run.onRoomCleared(this);
  }

  _pickups(dt) {
    const a = G.alex;
    const magnet = ECONOMY.magnet * (G.run.mods.magnetMul || 1);
    this.pickups = this.pickups.filter((p) => {
      p.t += dt;
      const dx = a.pos.x - p.x, dz = a.pos.z - p.z, dy = a.pos.y + 0.8 - p.y;
      const d = Math.hypot(dx, dz);
      if (p.t > 0.35 && d < magnet && p.kind !== 'heart' || (p.kind === 'heart' && d < 1.4 && a.hp < a.maxHp)) {
        const sp = 10 + p.t * 4;
        p.vx = (dx / (d || 1)) * sp; p.vz = (dz / (d || 1)) * sp; p.vy = dy * 6;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      } else {
        p.vy -= 20 * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.vx *= Math.exp(-3 * dt); p.vz *= Math.exp(-3 * dt);
        if (p.y < p.ground + 0.15) { p.y = p.ground + 0.15; p.vy = Math.abs(p.vy) > 2 ? -p.vy * 0.35 : 0; }
        const hw = this.L.w / 2 - 0.5, hd = this.L.d / 2 - 0.5;
        p.x = Math.max(-hw, Math.min(hw, p.x)); p.z = Math.max(-hd, Math.min(hd, p.z));
      }
      p.mesh.position.set(p.x, p.y + Math.sin(p.t * 4) * 0.05, p.z);
      p.mesh.rotation.y += dt * 4;
      if (p.kind === 'bill') p.mesh.rotation.z = Math.sin(p.t * 5) * 0.3;
      if (Math.hypot(dx, dz) < 0.8 && Math.abs(dy) < 1.6 && p.t > 0.2) {
        if (p.kind === 'heart') { if (a.hp >= a.maxHp) return true; a.heal(p.value); }
        else if (p.kind === 'block') { G.run.addBlocks(p.value); G.audio.sfx('pcoin', { gap: 0.03, p: 0.8 }); G.hud.damageNumber(p.x, p.y + 0.6, p.z, '+' + p.value + ' ◼', 'block'); }
        else { G.run.addMoney(p.value); G.audio.sfx(p.kind === 'coin' ? 'coin' : 'bill', { gap: 0.02 }); }
        this.group.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  _interact() {
    const a = G.alex;
    let best = null, bd = Infinity;
    for (const o of this.interactables) {
      if (o.disabled) continue;
      const d = Math.hypot(a.pos.x - o.x, a.pos.z - o.z);
      if (d < (o.r || 1.6) && d < bd) { bd = d; best = o; }
    }
    this.focusInteract = best;
    G.hud.prompt(best ? best.prompt() : null, best);
    if (best && G.input.pressed('interact') && !G.run.inputLocked) best.use();
  }

  // Door crossing → run handles the transition
  doorCrossed() {
    const a = G.alex;
    const m = a.vehicle ? a.vehicle.def.radius + 0.7 : 0.25;
    for (const d of this.doors) {
      if (d.locked) continue;
      const half = 1.6;
      if (d.side === 'N' && a.pos.z < -this.L.d / 2 + m && Math.abs(a.pos.x) < half) return d;
      if (d.side === 'S' && a.pos.z > this.L.d / 2 - m && Math.abs(a.pos.x) < half) return d;
      if (d.side === 'W' && a.pos.x < -this.L.w / 2 + m && Math.abs(a.pos.z) < half) return d;
      if (d.side === 'E' && a.pos.x > this.L.w / 2 - m && Math.abs(a.pos.z) < half) return d;
    }
    return null;
  }

  spawnVehicle(type, x, z, yaw = 0, o = {}) {
    const v = new Vehicle(this, type, x, z, yaw, o);
    this.vehicles.push(v);
    G.fx.burst(x, 1, z, { n: 20, color: ['#67f3ff', '#ffffff'], speed: 5, life: 0.5 });
    return v;
  }

  dispose() {
    const parked = this.vehicles.filter((v) => v.alive && !v.driver).map((v) => ({ type: v.type, x: v.pos.x, z: v.pos.z, yaw: v.yaw, hp: v.hp, life: v.life }));
    this.def.parked = parked.length ? parked : null;
    if (G.alex.vehicle) G.alex.vehicle = null;
    // keep uncollected money for revisits
    const keep = this.pickups.filter((p) => p.kind !== 'heart' || true).map((p) => ({ kind: p.kind, x: p.x, z: p.z, value: p.value }));
    this.def.savedPickups = keep.length ? keep : null;
    for (const e of this.enemies) if (e.alive) e.alive = false;
    for (const h of this.hazards) h.dispose();
    G.scene.remove(this.group);
    this.group.traverse((c) => {
      if (c.isMesh || c.isInstancedMesh) {
        if (c.geometry && !Object.values(GEO).includes(c.geometry) && c.geometry !== coinGeo && c.geometry !== billGeo && c.geometry !== heartGeo && c.geometry !== blockGeo) c.geometry.dispose();
        if (c.material && c.material.map && c.material.map.isCanvasTexture && c.userData.ownTex) c.material.map.dispose();
      }
    });
    G.cam.clearFades();
    clearTimers();
    disposeRift(this);
  }

  // Rift loot: choose one of two items from the franchise, plus a little extra.
  riftReward(r) {
    addPedestals(this, 'rift:' + r.id, 2, { choose: true });
    this.dropMoney(r.x, r.z, 6 + Math.floor(Math.random() * 8));
    if (r.id === 'minecraft') this.addPickup('block', r.x, r.z, 4);
    if (this.spawnVehicle && Math.random() < 0.55) this.spawnVehicle(r.def.vehicle, r.x, r.z);
  }
}
