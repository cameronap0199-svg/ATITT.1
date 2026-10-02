// Rideable crossover vehicles. Arcade handling: point the stick where you want to go
// (camera-relative), the vehicle turns toward it and accelerates. Ram demons, smash
// props, and use each ride's own trick. Vehicles follow Alex through doors.
//
//   Warthog (Halo)        tough jeep; Shoot = auto-aimed turret, Dash = nitro, Jump = horn
//   Minecart (Minecraft)  very fast, barely steers; Dash = powered-rail boost
//   Mini-Merry (One Piece) duck-boat on wheels; Shoot = cannon, Dash = Coup de Burst
//   Acro Bike (Pokémon)   nimble, Alex keeps his own gun; Jump = bunny hop
//   Chariot of Fire (Bible) flies over everything, leaves fire; ascends after 30 s

import * as THREE from 'three';
import { G } from './state.js';
import { mat, glow } from './world/props.js';
import { CROSS_MODELS } from './actors/crossoverModels.js';
import { clamp, damp, dampAngle, wrapAngle } from './core/math.js';
import { RANGED } from './combat/weapons.js';

const aimV = new THREE.Vector3();
const UNSMASHABLE = new Set(['wall', 'door', 'vehicle', 'bossBody', 'portal']);
export const smashable = (b) => b.alive && b.solid !== false && !b.wall && !UNSMASHABLE.has(b.kind) && !b.data?.keep && !b.data?.noSmash;

export const VEHICLES = {
  warthog: { name: 'Warthog', franchise: 'halo', icon: '🚙', maxSpeed: 17, accel: 13, turn: 2.3, grip: 5, radius: 1.25, hp: 140, ram: 30, seatY: 0.64, seatZ: 0.1, boost: 'nitro', weapon: 'turret', hint: 'Shoot: turret · Dash: nitro · Jump: horn' },
  minecart: { name: 'Minecart', franchise: 'minecraft', icon: '🛒', maxSpeed: 23, accel: 9, turn: 1.15, grip: 12, radius: 0.8, hp: 80, ram: 38, seatY: 0.26, seatZ: 0, boost: 'rail', hint: 'Barely steers. Dash: powered-rail boost' },
  miniMerry: { name: 'Mini-Merry (Land Edition)', franchise: 'onepiece', icon: '🐑', maxSpeed: 14, accel: 10, turn: 2.0, grip: 3.5, radius: 1.15, hp: 120, ram: 22, seatY: 0.74, seatZ: -0.3, boost: 'burst', weapon: 'cannon', hint: 'Shoot: cannon · Dash: Coup de Burst' },
  bike: { name: 'Acro Bike', franchise: 'pokemon', icon: '🚲', maxSpeed: 19, accel: 22, turn: 3.6, grip: 9, radius: 0.55, hp: 60, ram: 12, seatY: 0.44, seatZ: -0.12, boost: 'pedal', gun: true, hop: true, hint: 'Shoot: your own gun · Jump: bunny hop · Dash: sprint' },
  chariot: { name: 'Chariot of Fire', franchise: 'bible', icon: '🔥', maxSpeed: 20, accel: 16, turn: 2.6, grip: 6, radius: 1.05, hp: 999, ram: 26, seatY: 1.12, seatZ: -0.5, stand: true, fly: 1.3, fire: true, life: 30, boost: 'whirlwind', weapon: 'fireArrows', hint: 'Flies · Shoot: fire arrows · Dash: whirlwind · ascends after 30 s' },
};
export const VEHICLE_IDS = Object.keys(VEHICLES);

// ---------------------------------------------------------------------------- models
function wheel(r, w, color = '#1f2937') { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), mat(color)); m.rotation.z = Math.PI / 2; return m; }
function bx(w, h, d, color, x = 0, y = 0, z = 0, m) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || mat(color)); b.position.set(x, y, z); return b; }

export const BUILD = {
  warthog() {
    const g = new THREE.Group(), wheels = [];
    g.add(bx(2.0, 0.55, 3.4, '#5b6b2f', 0, 0.75, 0));
    g.add(bx(1.9, 0.35, 1.1, '#4b5a26', 0, 1.15, 1.05));
    g.add(bx(2.05, 0.12, 3.5, '#3f4a20', 0, 0.48, 0));
    for (const s of [-1, 1]) g.add(bx(0.1, 0.9, 0.1, '#2b2f1a', s * 0.85, 1.45, 0.25));
    g.add(bx(1.8, 0.1, 0.1, '#2b2f1a', 0, 1.9, 0.25));
    for (const s of [-1, 1]) g.add(bx(0.3, 0.16, 0.06, '#fef3c7', s * 0.65, 0.9, 1.72, glow('#fef3c7')));
    for (const [x, z] of [[-1.0, 1.15], [1.0, 1.15], [-1.0, -1.2], [1.0, -1.2]]) { const w = wheel(0.55, 0.42); w.position.set(x, 0.55, z); g.add(w); wheels.push(w); }
    const turret = new THREE.Group(); turret.position.set(0, 1.35, -1.15);
    turret.add(bx(0.5, 0.4, 0.5, '#3f4a20'));
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), mat('#111')); b.rotation.x = Math.PI / 2; b.position.set(-0.1 + i * 0.1, 0.05, 0.6); turret.add(b); }
    const gunner = CROSS_MODELS.grunt();
    gunner.group.scale.setScalar(0.7); gunner.group.position.set(0, -0.25, -0.55);
    turret.add(gunner.group);
    g.add(turret);
    return { group: g, wheels, turret, gunner };
  },
  minecart() {
    const g = new THREE.Group(), wheels = [];
    const iron = mat('#8a8f98');
    g.add(bx(1.3, 0.12, 1.7, '', 0, 0.35, 0, iron));
    for (const [w, d, x, z] of [[1.3, 0.1, 0, 0.82], [1.3, 0.1, 0, -0.82], [0.1, 1.7, 0.62, 0], [0.1, 1.7, -0.62, 0]]) g.add(bx(w, 0.6, d === 0.1 ? 0.1 : d, '', x, 0.68, z, iron));
    for (const [x, z] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) { const w = wheel(0.2, 0.12, '#3a3f47'); w.position.set(x, 0.2, z); g.add(w); wheels.push(w); }
    return { group: g, wheels };
  },
  miniMerry() {
    const g = new THREE.Group(), wheels = [];
    const hull = mat('#c08a5a');
    g.add(bx(1.6, 0.7, 2.6, '', 0, 0.75, 0, hull));
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 4), hull); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.7); bow.position.set(0, 0.75, 1.75); g.add(bow);
    g.add(bx(1.7, 0.12, 2.7, '#f8fafc', 0, 1.12, 0));
    const head = new THREE.Group(); head.position.set(0, 1.45, 1.75);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), mat('#f8fafc')));
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12), mat('#e5e7eb')); c.position.set(s * 0.38, 0.12, -0.05); c.rotation.y = Math.PI / 2; head.add(c); }
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#111')); e.position.set(s * 0.15, 0.08, 0.38); head.add(e); }
    g.add(head);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 10), mat('#1f2937')); cannon.rotation.x = Math.PI / 2 - 0.1; cannon.position.set(0, 1.25, 1.1); g.add(cannon);
    const mast = bx(0.08, 1.6, 0.08, '#78350f', 0, 1.9, -0.5); g.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshToonMaterial({ color: '#ffffff', side: THREE.DoubleSide })); sail.position.set(0, 2.1, -0.45); g.add(sail);
    const jolly = bx(0.3, 0.3, 0.02, '#111', 0, 2.15, -0.43); g.add(jolly);
    for (const s of [-1, 1]) { const w = wheel(0.5, 0.25, '#7c2d12'); w.position.set(s * 0.95, 0.5, -0.3); g.add(w); wheels.push(w); }
    for (const z of [1.0, -1.1]) { const w = wheel(0.3, 1.5, '#292524'); w.position.set(0, 0.3, z); g.add(w); wheels.push(w); }
    return { group: g, wheels, head, sail };
  },
  bike() {
    const g = new THREE.Group(), wheels = [];
    const red = mat('#dc2626');
    for (const z of [0.62, -0.62]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 20), mat('#111')); w.rotation.y = Math.PI / 2; w.position.set(0, 0.42, z); g.add(w); wheels.push(w); }
    const bar = (x0, y0, z0, x1, y1, z1, m = red) => { const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1); const l = a.distanceTo(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, l, 6), m); c.position.copy(a).add(b).multiplyScalar(0.5); c.lookAt(b); c.rotateX(Math.PI / 2); g.add(c); };
    bar(0, 0.42, -0.62, 0, 0.85, -0.1); bar(0, 0.85, -0.1, 0, 0.9, 0.5); bar(0, 0.42, 0.62, 0, 0.95, 0.5); bar(0, 0.42, -0.62, 0, 0.45, 0.05); bar(0, 0.45, 0.05, 0, 0.85, -0.1);
    g.add(bx(0.18, 0.06, 0.32, '#111', 0, 0.9, -0.15));
    g.add(bx(0.6, 0.04, 0.04, '#9ca3af', 0, 1.05, 0.48));
    return { group: g, wheels };
  },
  chariot() {
    const g = new THREE.Group(), wheels = [];
    const gold = mat('#fbbf24', { emissive: '#f97316', emissiveIntensity: 0.4 });
    g.add(bx(1.4, 0.6, 1.0, '', 0, 0.75, -0.5, gold));
    g.add(bx(1.45, 0.08, 1.05, '#fde68a', 0, 1.08, -0.5));
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 6, 16), glow('#ff9f1c')); w.rotation.y = Math.PI / 2; w.position.set(s * 0.8, 0.5, -0.55); g.add(w); wheels.push(w); }
    const horses = [];
    for (const s of [-1, 1]) {
      const h = new THREE.Group(); h.position.set(s * 0.42, 0.95, 1.1);
      h.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 1.0), glow('#ff7b00')));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.28), glow('#ffb703')); head.position.set(0, 0.4, 0.55); head.rotation.x = 0.5; h.add(head);
      const mane = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.8 })); mane.position.set(0, 0.55, 0.15); mane.rotation.x = -0.8; h.add(mane);
      const legs = [];
      for (const [x, z] of [[-0.1, 0.35], [0.1, 0.35], [-0.1, -0.35], [0.1, -0.35]]) { const l = new THREE.Group(); l.position.set(x, -0.2, z); const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), glow('#ff9f1c')); m.position.y = -0.27; l.add(m); h.add(l); legs.push(l); }
      g.add(h); horses.push({ h, legs });
    }
    const light = new THREE.PointLight('#ff9f1c', 1.8, 10, 1.6); light.position.set(0, 1.4, 0.3); g.add(light);
    return { group: g, wheels, horses };
  },
};

// ---------------------------------------------------------------------------- vehicle
export class Vehicle {
  constructor(room, type, x, z, yaw = 0, o = {}) {
    this.room = room;
    this.type = type;
    this.def = VEHICLES[type];
    this.m = BUILD[type]();
    this.group = this.m.group;
    this.pos = new THREE.Vector3(x, room.world.groundAt(x, z, 10, 0.4).h, z);
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.speed = 0;
    this.hp = o.hp ?? this.def.hp;
    this.life = o.life ?? this.def.life ?? Infinity;
    this.driver = null;
    this.alive = true;
    this.fireCd = 0; this.boostCd = 0; this.boostT = 0; this.hornCd = 0;
    this.airY = 0; this.vy = 0;
    this.ramHit = new Map();
    this.trail = [];
    this.height = 1.6;
    room.group.add(this.group);
    this._sync(0);
    this._park();
    const self = this;
    this.inter = room.addInteractable({
      x, z, r: this.def.radius + 1.3, id: 'veh' + type,
      prompt: () => self.driver ? { title: `${self.def.icon} ${self.def.name}`, text: self.def.hint, action: 'Hop out' } : { title: `${self.def.icon} ${self.def.name}`, text: `${self.def.hint}. Ram demons, smash props.`, action: 'Hop in' },
      use: () => (self.driver ? self.dismount() : self.mount()),
    });
  }

  _park() {
    if (this.block) this.room.world.remove(this.block);
    if (this.def.fly) { this.block = null; return; }
    this.block = this.room.world.add({ kind: 'vehicle', x: this.pos.x, z: this.pos.z, w: this.def.radius * 1.5, d: this.def.radius * 2.2, h: 1.1, rot: -this.yaw, vault: true, camBlock: false });
  }

  mount() {
    const a = G.alex;
    if (this.driver || a.state === 'dead' || a.vehicle) return;
    if (this.block) { this.room.world.remove(this.block); this.block = null; }
    this.driver = a;
    a.vehicle = this;
    a.state = 'move';
    a.atk = a.dash = a.vault = a.land = null;
    G.run.vehicle = { type: this.type, hp: this.hp, life: this.life };
    G.audio.sfx(this.type === 'bike' ? 'pjump' : 'charge', { v: 0.6 });
    G.hud.vehicle?.(this);
    G.hud.popup(`${this.def.icon} ${this.def.name.toUpperCase()}`, '#67f3ff', 1.1, true);
    if (this.type === 'bike' && G.room?.bossInfo) G.hud.bubble(a, 'There\'s a time and place for everything! (…this is it)', '#fde047', 2);
    G.run.stat('vehiclesRidden', 1);
  }

  dismount(eject) {
    const a = this.driver;
    if (!a) return;
    this.driver = null;
    a.vehicle = null;
    G.run.vehicle = null;
    const side = this.yaw + Math.PI / 2;
    const x = this.pos.x + Math.sin(side) * (this.def.radius + 0.9), z = this.pos.z + Math.cos(side) * (this.def.radius + 0.9);
    const hw = this.room.L.w / 2 - 1, hd = this.room.L.d / 2 - 1;
    a.pos.set(clamp(x, -hw, hw), this.room.world.groundAt(x, z, this.pos.y + 3, 0.3).h, clamp(z, -hd, hd));
    a.vel.set(eject ? Math.sin(side) * 6 : 0, eject ? 7 : 0, eject ? Math.cos(side) * 6 : 0);
    a.grounded = !eject;
    a.yaw = this.yaw;
    a.spawnSafe(0.6);
    this.speed = 0;
    this.vel.set(0, 0, 0);
    if (this.alive) { this.airY = 0; this._park(); }
    G.hud.vehicle?.(null);
  }

  damage(n) {
    if (!this.alive || this.def.hp >= 999) return;
    this.hp -= n;
    if (G.run.vehicle) G.run.vehicle.hp = this.hp;
    if (this.hp <= 0) this.destroy();
  }

  destroy(ascend) {
    if (!this.alive) return;
    this.alive = false;
    const x = this.pos.x, z = this.pos.z;
    if (this.driver) this.dismount(true);
    this.room.removeInteractable(this.inter);
    if (this.block) { this.room.world.remove(this.block); this.block = null; }
    if (ascend) {
      G.hud.popup('THE CHARIOT ASCENDS TO HEAVEN', '#fde68a', 1.6);
      this.ascendT = 0;
      return;
    }
    this.group.parent?.remove(this.group);
    G.areas.circle({ x, z, r: 3.4, delay: 0.05, dmg: 0, ff: true, enemyDmg: 35, owner: 'hazard', style: 'fire', sound: 'boom', shake: 0.5, propDmg: 30 });
    G.fx.burst(x, 1, z, { n: 30, kind: 'debris', color: ['#555', '#222', '#ff7b00'], speed: 9, up: 1.5, life: 1, size: 0.3 });
    G.hud.popup(`${this.def.name.toUpperCase()} DESTROYED`, '#ff7b00', 1.2);
  }

  // per-frame: parked or driven
  update(dt) {
    if (this.ascendT != null) {
      this.ascendT += dt;
      this.group.position.y += dt * (2 + this.ascendT * 6);
      this.group.rotation.y += dt * 4;
      if (Math.random() < 0.6) G.fx.burst(this.group.position.x, this.group.position.y, this.group.position.z, { n: 2, color: ['#ff9f1c', '#fde68a'], speed: 2, up: -1, life: 0.6, size: 0.3 });
      if (this.ascendT > 3) { this.group.parent?.remove(this.group); this.ascendT = null; }
      return;
    }
    if (!this.alive) return;
    if (this.driver) this._drive(dt); else { this.speed = damp(this.speed, 0, 4, dt); this.vel.multiplyScalar(Math.exp(-4 * dt)); }
    this.inter.x = this.pos.x; this.inter.z = this.pos.z;
    if (this.def.fire) this._fire(dt);
    this._sync(dt);
  }

  _drive(dt) {
    const a = this.driver, inp = G.input, d = this.def, w = this.room.world, run = G.run;
    const locked = run.inputLocked;
    // stick → desired heading (camera-relative)
    const [fx, fz] = G.cam.forward(), [rx, rz] = G.cam.right();
    const mag = locked ? 0 : inp.move.mag;
    let dx = fx * inp.move.y + rx * inp.move.x, dz = fz * inp.move.y + rz * inp.move.x;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const boosting = this.boostT > 0;
    this.boostT = Math.max(0, this.boostT - dt);
    this.boostCd = Math.max(0, this.boostCd - dt);
    const top = d.maxSpeed * (boosting ? 1.55 : 1) * (run.mods.moveMul || 1);
    if (mag > 0.25) {
      const want = Math.atan2(dx, dz);
      let diff = wrapAngle(want - this.yaw);
      const reverse = Math.abs(diff) > 2.5 && this.speed < 4;
      if (reverse) diff = wrapAngle(diff + Math.PI);
      const turnK = clamp(Math.abs(this.speed) / 5, 0.45, 1) * (this.airY > 0.3 && !d.fly ? 0.3 : 1);
      this.yaw += clamp(diff, -d.turn * turnK * dt, d.turn * turnK * dt);
      const target = reverse ? -d.maxSpeed * 0.4 : top * mag * (Math.abs(diff) > 1.6 ? 0.45 : 1);
      this.speed = damp(this.speed, target, d.accel / Math.max(4, d.maxSpeed) * 1.4, dt);
    } else this.speed = damp(this.speed, 0, this.type === 'minecart' ? 0.8 : 2.2, dt);
    if (this.type === 'minecart') this.speed = Math.max(this.speed, Math.min(this.speed + dt * 2, 6));
    // velocity with lateral grip (drifts)
    const fwdX = Math.sin(this.yaw), fwdZ = Math.cos(this.yaw);
    const k = 1 - Math.exp(-d.grip * dt);
    this.vel.x += (fwdX * this.speed - this.vel.x) * k;
    this.vel.z += (fwdZ * this.speed - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // vertical: hops / flight / ground
    const g = w.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2, d.radius * 0.6);
    if (d.fly) { this.pos.y = damp(this.pos.y, Math.max(g.h, 0) + d.fly + Math.sin(G.time * 3) * 0.12, 5, dt); }
    else {
      this.vy -= 26 * dt;
      this.airY = Math.max(0, this.airY + this.vy * dt);
      if (this.airY <= 0) { this.airY = 0; if (this.vy < -8) { G.cam.shake(0.15); G.audio.sfx('land', { v: 0.6 }); } this.vy = 0; }
      this.pos.y = damp(this.pos.y, g.h, 18, dt) ;
    }
    // anything that isn't a wall or a door gets smashed out of the way
    if (Math.abs(this.speed) > 2.5) this._smash(fwdX, fwdZ);
    // collisions (flyers skip anything they can float over; ramps and tiers are climbed)
    const py = this.pos.y;
    const hits = w.collide(this.pos, d.radius * 0.8, 1.4, { ignoreClutter: true, stepUp: d.fly ? 1.6 : 0.5 + this.airY, ignore: (b) => b.data?.keep && b.y1 <= py + 1.35 });
    const wall = hits.find((c) => c.block.wall || c.block.y1 > this.pos.y + 0.8);
    if (wall && Math.abs(this.speed) > 3) {
      const hard = Math.abs(this.speed) > 9;
      if (wall.block.hp != null && hard) this.room.damageBlock(wall.block, Math.abs(this.speed) * 3);
      if (hard) { G.cam.shake(0.25); G.audio.sfx('slam', { v: 0.5 }); this.damage(Math.abs(this.speed) * 0.6); G.fx.burst(this.pos.x + fwdX * d.radius, 0.8, this.pos.z + fwdZ * d.radius, { n: 10, color: ['#ffd60a', '#ffffff'], speed: 5, life: 0.3 }); }
      this.speed *= -0.25;
      this.vel.multiplyScalar(-0.2);
    }
    // keep inside the room
    const hw = this.room.L.w / 2 - d.radius * 0.6, hd = this.room.L.d / 2 - d.radius * 0.6;
    this.pos.x = clamp(this.pos.x, -hw, hw); this.pos.z = clamp(this.pos.z, -hd, hd);
    this._ram(dt);
    // controls: boost (dash), horn / hop (jump), weapon (shoot)
    if (!locked && inp.buffered('dash', 0.1) && this.boostCd <= 0) { inp.consume('dash'); this._boost(); }
    if (!locked && inp.pressed('jump')) this._jumpBtn();
    this.fireCd -= dt;
    if (!locked && d.weapon && inp.isHeld('ranged')) this._weapon();
    if (!locked && inp.pressed('ride')) { this.dismount(); return; }
    // chariot of fire ascends
    if (this.life !== Infinity) {
      this.life -= dt;
      if (G.run.vehicle) G.run.vehicle.life = this.life;
      if (this.life < 5 && Math.floor(this.life * 2) !== Math.floor((this.life + dt) * 2)) G.hud.popup(`ASCENDING IN ${Math.ceil(this.life)}…`, '#fde68a', 0.5, true);
      if (this.life <= 0) this.destroy(true);
    }
    // Alex rides along
    a.pos.set(this.pos.x + fwdX * d.seatZ, this.pos.y + this.airY + d.seatY, this.pos.z + fwdZ * d.seatZ);
    a.vel.copy(this.vel);
    a.yaw = this.yaw; a.aimYaw = d.gun ? a.aimYaw : this.yaw;
    a.grounded = true;
    a.lastGrounded = G.time;
    if (Math.abs(this.speed) > 12) G.fx.speed(0.4);
    G.cam.vehicleYaw = this.yaw;
    G.cam.vehicleSpeed = Math.abs(this.speed);
  }

  // Plough through props: cars, tents, crates, shelves, pillars, blocks, chairs…
  // Walls, doors, parked rides, stairs and platforms stay (the last two are climbed).
  _smash(fwdX, fwdZ) {
    const d = this.def, room = this.room, w = room.world;
    if (room.def.kind === 'gas') return;   // "NOT IN MY STORE"
    const cx = this.pos.x + fwdX * d.radius * 0.45, cz = this.pos.z + fwdZ * d.radius * 0.45;
    const r = d.radius * 0.95 + 0.25, y = this.pos.y + this.airY;
    const low = d.fly ? 1.0 : 0.04;
    let big = 0;
    for (const b of w.near(cx, cz, r + 3, [])) {
      if (!smashable(b) || b.y1 <= y + low || b.y0 > y + 1.8) continue;
      if (!b.pushCircle(cx, cz, r) && !b.containsXZ(cx, cz, 0.1)) continue;
      big = Math.max(big, b.radius());
      room.destroyBlock(b, { vehicle: true });
      G.run.stat('propsRammed', 1);
    }
    if (big) {
      this.speed *= big > 2.2 ? 0.86 : big > 1 ? 0.95 : 0.99;
      G.cam.shake(Math.min(0.3, 0.06 + big * 0.06));
      if (G.time > (this._smashSfx || 0)) { this._smashSfx = G.time + 0.12; G.audio.sfx('slam', { v: 0.35 + Math.min(0.4, big * 0.1) }); }
    }
  }

  _ram(dt) {
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 4) return;
    const d = this.def, run = G.run;
    for (const e of this.room.enemies) {
      if (!e.alive || !e.targetable() || e.intangible) continue;
      if (Math.abs(e.pos.y - (this.pos.y + this.airY)) > (d.fly ? 2.5 : 1.8)) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      if (Math.hypot(dx, dz) > d.radius + e.radius) continue;
      if (G.time < (this.ramHit.get(e) || 0)) continue;
      this.ramHit.set(e, G.time + 0.45);
      const dmg = Math.max(6, d.ram * sp / d.maxSpeed) * (run.mods.dmgMul || 1);
      e.hurt(dmg, { source: G.alex, dir: [this.vel.x, this.vel.z], knock: e.heavy ? 2 : 6 + sp * 0.6, launch: !e.heavy && sp > 12 ? 8 : 0, stagger: 3, ram: true });
      G.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, { n: 12, color: ['#ffd60a', '#ffffff'], speed: 6, life: 0.3 });
      G.audio.sfx('hitHeavy', { v: 0.7 });
      G.cam.shake(0.18);
      run.stat('ramKills', e.alive ? 0 : 1);
      if (e.heavy) { this.speed *= 0.3; this.damage(8); }
    }
  }

  _boost() {
    const d = this.def;
    this.boostCd = d.boost === 'burst' ? 4 : 2.8;
    if (d.boost === 'burst') {
      // Coup de Burst: launches the ship into the air and forward
      this.speed = d.maxSpeed * 2.2; this.boostT = 1.2; this.vy = 9; this.airY = 0.05;
      G.hud.bubble(G.alex, 'COUP DE BURST!', '#fca5a5', 1);
      G.fx.burst(this.pos.x - Math.sin(this.yaw) * 1.5, 0.8, this.pos.z - Math.cos(this.yaw) * 1.5, { n: 40, kind: 'smoke', color: '#e5e7eb', speed: 6, up: 0.6, life: 0.8, size: 0.7 });
      G.audio.sfx('boom', { v: 0.7 });
    } else if (d.boost === 'whirlwind') {
      this.boostT = 1; this.speed = d.maxSpeed * 1.5;
      G.areas.ring({ x: this.pos.x, z: this.pos.z, r0: 1, r1: 7, speed: 12, width: 0.6, height: 1, dmg: 0, owner: 'alexRing', color: '#ffb703' });
      for (const e of this.room.enemies) if (e.alive && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 7) e.hurt(14 * (G.run.mods.dmgMul || 1), { source: G.alex, dir: [e.pos.x - this.pos.x, e.pos.z - this.pos.z], knock: 10, area: true, fire: true });
      G.audio.sfx('roar', { v: 0.4 });
    } else {
      this.boostT = d.boost === 'rail' ? 1.4 : 1.0;
      this.speed = Math.max(this.speed, d.maxSpeed);
      G.audio.sfx('dash', { v: 0.8 });
      if (d.boost === 'rail') G.fx.burst(this.pos.x, 0.3, this.pos.z, { n: 16, color: ['#ef4444', '#fde047'], speed: 4, life: 0.4 });
    }
    G.fx.speed(0.8);
  }

  _jumpBtn() {
    const d = this.def;
    if (d.hop) { if (this.airY <= 0.01) { this.vy = 8.5; this.airY = 0.02; G.audio.sfx('pjump'); } return; }
    if (this.hornCd > G.time) return;
    this.hornCd = G.time + 0.8;
    // horn: knocks nearby demons back a little
    G.audio.sfx(this.type === 'chariot' ? 'cheer' : 'shout', { v: 0.6 });
    G.hud.bubble(G.alex, this.type === 'warthog' ? 'BEEP BEEP' : this.type === 'miniMerry' ? 'BAAA (horn)' : this.type === 'minecart' ? '*clank*' : 'HALLELUJAH', '#ffffff', 0.8);
    for (const e of this.room.enemies) if (e.alive && !e.heavy && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 5) { e.vel.x += (e.pos.x - this.pos.x) * 2; e.vel.z += (e.pos.z - this.pos.z) * 2; }
  }

  _weapon() {
    if (this.fireCd > 0) return;
    const d = this.def, run = G.run;
    const aim = G.targeting.aimPoint(aimV);
    const dmgK = run.mods.dmgMul || 1;
    if (d.weapon === 'turret') {
      this.fireCd = 0.11;
      const t = this.m.turret;
      const wp = new THREE.Vector3(); t.getWorldPosition(wp);
      wp.y += 0.1;
      let vx = aim.x - wp.x, vy = aim.y - wp.y, vz = aim.z - wp.z; const l = Math.hypot(vx, vy, vz) || 1;
      t.rotation.y = Math.atan2(vx, vz) - this.yaw;
      G.projectiles.spawn({ hostile: false, kind: 'bolt', x: wp.x, y: wp.y, z: wp.z, vx: vx / l * 50 + (Math.random() - 0.5) * 2, vy: vy / l * 50, vz: vz / l * 50 + (Math.random() - 0.5) * 2, r: 0.13, dmg: 5 * dmgK, knock: 1, life: 1.2, color: '#fde68a' });
      G.audio.sfx('shot', { v: 0.5, gap: 0.03, p: 0.8 });
      run.stat('shotsFired', 1);
    } else if (d.weapon === 'cannon') {
      this.fireCd = 1.0;
      const sx = this.pos.x + Math.sin(this.yaw) * 1.6, sz = this.pos.z + Math.cos(this.yaw) * 1.6, sy = this.pos.y + this.airY + 1.3;
      const dx = aim.x - sx, dz = aim.z - sz, dist = Math.hypot(dx, dz), T = clamp(dist / 22, 0.3, 1.2);
      G.projectiles.spawn({ hostile: false, kind: 'shirt', x: sx, y: sy, z: sz, vx: dx / T, vy: (aim.y - sy + 0.5 * 12 * T * T) / T, vz: dz / T, grav: 12, r: 0.35, dmg: 30 * dmgK, knock: 10, stagger: 3, life: T + 0.3, color: '#1f2937',
        onHit: (p) => { for (const e of this.room.enemies) if (e.alive && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 2.6 + e.radius) e.hurt(18 * dmgK, { source: G.alex, dir: [e.pos.x - p.x, e.pos.z - p.z], knock: 8, area: true }); G.fx.burst(p.x, p.y, p.z, { n: 24, color: ['#ff7b00', '#ffd60a', '#555'], speed: 7, life: 0.5 }); G.audio.sfx('boom', { v: 0.5 }); } });
      G.audio.sfx('heavyShot');
      G.cam.shake(0.15);
    } else if (d.weapon === 'fireArrows') {
      this.fireCd = 0.28;
      const sx = this.pos.x, sz = this.pos.z, sy = this.pos.y + 1.6;
      const vx = aim.x - sx, vy = aim.y - sy, vz = aim.z - sz, l = Math.hypot(vx, vy, vz) || 1;
      G.projectiles.spawn({ hostile: false, kind: 'farrow', x: sx, y: sy, z: sz, vx: vx / l * 38, vy: vy / l * 38, vz: vz / l * 38, r: 0.15, dmg: 10 * dmgK, knock: 2, life: 1.2, color: '#ffb703', onHit: (p, e) => { if (e && e.alive) e.burn = { until: G.time + 2.5, dps: 6 }; } });
      G.audio.sfx('flame', { v: 0.5 });
    }
  }

  _fire(dt) {
    if (!this.driver) return;
    this.fireT = (this.fireT || 0) - dt;
    if (this.fireT <= 0 && Math.hypot(this.vel.x, this.vel.z) > 3) { this.fireT = 0.06; this.trail.push({ x: this.pos.x, z: this.pos.z, t: 1.6 }); }
    for (const f of this.trail) {
      f.t -= dt;
      if (Math.random() < dt * 8) G.fx.burst(f.x, 0.2, f.z, { n: 1, color: ['#ff7b00', '#ffd60a'], speed: 0.6, up: 2, life: 0.4, size: 0.3, grav: -2, kind: 'spark' });
      for (const e of this.room.enemies) if (e.alive && !e.flying && Math.hypot(e.pos.x - f.x, e.pos.z - f.z) < e.radius + 0.8 && !(e.burn && G.time < e.burn.until - 1.5)) e.burn = { until: G.time + 2.2, dps: 7 * (G.run.mods.dmgMul || 1) };
    }
    this.trail = this.trail.filter((f) => f.t > 0);
  }

  _sync(dt) {
    const g = this.group;
    g.position.set(this.pos.x, this.pos.y + this.airY, this.pos.z);
    g.rotation.y = this.yaw;
    const sp = this.speed;
    for (const w of this.m.wheels) { if (this.type === 'bike') w.rotation.x += sp * dt * 2.4; else w.rotation.x += sp * dt * 1.8; }
    if (this.type === 'warthog') { g.rotation.z = damp(g.rotation.z, clamp(-(this.yawRate || 0) * 0.04, -0.12, 0.12), 6, dt); this.m.gunner.anim?.({ pos: this.pos, vel: new THREE.Vector3(), pose: G.input.isHeld('ranged') && this.driver ? 'shoot' : null }, dt); }
    if (this.type === 'miniMerry') { g.rotation.x = Math.sin(G.time * 2.5) * 0.04; this.m.head.rotation.y = Math.sin(G.time * 1.5) * 0.2; }
    if (this.type === 'bike') g.rotation.z = damp(g.rotation.z, this.driver ? clamp(-(this._lastYaw !== undefined ? wrapAngle(this.yaw - this._lastYaw) / Math.max(dt, 1e-4) : 0) * 0.08, -0.4, 0.4) : 0.25, 6, dt);
    if (this.type === 'chariot') for (const { legs } of this.m.horses) legs.forEach((l, i) => { l.rotation.x = Math.sin(G.time * 12 + i * 1.6) * 0.7; });
    this._lastYaw = this.yaw;
  }
}
