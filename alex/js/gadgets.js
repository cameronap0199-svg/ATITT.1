// Gadgets (the active-item slot) and the things they throw: plasma grenades that
// stick, TNT, ender pearls, capture balls, and the Staff of Moses. Thrown objects
// live in their own small list and are updated from the run.

import * as THREE from 'three';
import { G } from './state.js';
import { GADGETS } from './items.js';
import { glow, mat, textTexture } from './world/props.js';
import { clamp } from './core/math.js';
import { Pal } from './companions.js';

const aimV = new THREE.Vector3();
const thrown = [];
const GRAV = 18;

function ballistic(from, to, speed = 16) {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
  const d = Math.hypot(dx, dz);
  const T = clamp(d / speed, 0.3, 0.95);
  return { vx: dx / T, vz: dz / T, vy: (dy + 0.5 * GRAV * T * T) / T };
}

function ballMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'captureBall') {
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ef4444'));
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#f8fafc'));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 16), mat('#111111'));
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), mat('#ffffff'));
    btn.rotation.x = Math.PI / 2; btn.position.z = 0.2;
    g.add(top, bot, band, btn);
  } else if (kind === 'tnt') {
    const side = new THREE.MeshToonMaterial({ map: textTexture('TNT', { bg: '#dc2626', fg: '#ffffff', w: 128, h: 128, font: 'bold 52px "Arial Black", sans-serif' }) });
    const top = new THREE.MeshToonMaterial({ color: '#a3a3a3' });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), [side, side, top, top, side, side]);
    m.position.y = 0.4;
    g.add(m);
  } else if (kind === 'enderPearl') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), mat('#115e59', { emissive: '#0f766e', emissiveIntensity: 0.5 })));
  } else {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glow('#38bdf8')));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.35, depthWrite: false }));
    g.add(halo);
  }
  return g;
}

function throwThing(kind, onLand, opts = {}) {
  const a = G.alex;
  const from = { x: a.pos.x + Math.sin(a.yaw) * 0.4, y: a.pos.y + 1.4, z: a.pos.z + Math.cos(a.yaw) * 0.4 };
  const to = opts.to || G.targeting.aimPoint(aimV);
  const v = ballistic(from, to, opts.speed || 16);
  const mesh = ballMesh(kind);
  mesh.position.set(from.x, from.y, from.z);
  G.room.group.add(mesh);
  const t = { kind, x: from.x, y: from.y, z: from.z, vx: v.vx, vy: v.vy, vz: v.vz, mesh, onLand, t: 0, stuck: null, done: false, ...opts };
  thrown.push(t);
  G.audio.sfx('jump', { v: 0.7 });
  a.aimYaw = Math.atan2(v.vx, v.vz);
  return t;
}

export function clearThrown() { for (const t of thrown) t.mesh.parent?.remove(t.mesh); thrown.length = 0; }

export function updateThrown(dt) {
  const room = G.room;
  if (!room) return;
  for (const t of thrown) {
    if (t.done) continue;
    t.t += dt;
    if (t.update && t.update(t, dt)) continue;
    if (t.stuck) {
      if (t.stuck.alive) { t.x = t.stuck.pos.x; t.y = t.stuck.pos.y + t.stuck.height * 0.6; t.z = t.stuck.pos.z; }
      t.mesh.position.set(t.x, t.y, t.z);
      continue;
    }
    if (t.resting) { t.mesh.position.set(t.x, t.y, t.z); continue; }
    const px = t.x, pz = t.z;
    t.vy -= GRAV * dt;
    t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt;
    t.mesh.position.set(t.x, t.y, t.z);
    t.mesh.rotation.x += dt * 9;
    // enemy contact
    if (t.hitEnemies) {
      for (const e of room.enemies) {
        if (!e.alive || !e.targetable() || e.intangible) continue;
        if (Math.hypot(e.pos.x - t.x, e.pos.z - t.z) < e.radius + 0.35 && t.y > e.pos.y - 0.2 && t.y < e.pos.y + e.height + 0.3) { t.onLand(t, e); break; }
      }
      if (t.done || t.stuck) continue;
    }
    // walls / ground
    const g = room.world.groundAt(t.x, t.z, t.y + 0.5, 0.15);
    const wall = room.world.projectileBlock(t.x, t.y, t.z, 0.15);
    if (wall && wall !== 'floor') { t.x = px; t.z = pz; t.vx *= -0.2; t.vz *= -0.2; }
    if (t.y <= g.h + 0.15 || wall === 'floor') { t.y = g.h + 0.15; t.onLand(t, null); }
  }
  for (let i = thrown.length - 1; i >= 0; i--) if (thrown[i].done) { thrown[i].mesh.parent?.remove(thrown[i].mesh); thrown.splice(i, 1); }
}

function explode(x, z, r, dmg, o = {}) {
  const run = G.run;
  dmg *= run.mods.dmgMul || 1;
  for (const e of G.room.enemies) {
    if (!e.alive || e.intangible) continue;
    const d = Math.hypot(e.pos.x - x, e.pos.z - z);
    if (d < r + e.radius) e.hurt(dmg * (d < r * 0.5 ? 1 : 0.7), { source: G.alex, dir: [e.pos.x - x, e.pos.z - z], knock: o.knock ?? 9, stagger: 3, area: true, fire: o.fire });
  }
  G.room.damageBlocksInRadius(x, z, r, o.propDmg ?? dmg);
  G.fx.burst(x, 0.8, z, { n: 40, color: o.colors || ['#ff7b00', '#ffd60a', '#ffffff'], speed: 9, up: 1.5, life: 0.7, size: 0.3 });
  G.fx.ring(x, 0.1, z, { r1: r, color: o.colors?.[0] || '#ff7b00', life: 0.35 });
  G.fx.burst(x, 0.6, z, { n: 14, kind: 'smoke', color: '#555', speed: 3, up: 1, life: 1.2, size: 0.9, grav: -0.5 });
  G.audio.sfx('boom', { pan: G.cam.panOf(x, z) });
  G.cam.shake(0.45, x, z);
  const a = G.alex, ad = Math.hypot(a.pos.x - x, a.pos.z - z);
  if (o.pushAlex && ad < r) { a.vel.x += (a.pos.x - x) / (ad || 1) * 8; a.vel.z += (a.pos.z - z) / (ad || 1) * 8; a.vel.y = 6; a.grounded = false; }
}

// ---------------------------------------------------------------------------
export function useGadget() {
  const run = G.run, gd = run.gadget, a = G.alex;
  if (!gd || !G.room || run.inputLocked || a.state === 'dead') return;
  const def = GADGETS[gd.id];
  if (def.cooldown) {
    if (G.time < (gd.readyAt || 0)) { G.audio.sfx('deny'); G.hud.popup(`${def.name}: ${Math.ceil(gd.readyAt - G.time)} s`, '#ffffff', 0.6, true); return; }
    gd.readyAt = G.time + def.cooldown;
  } else {
    if (gd.charges <= 0) { G.audio.sfx('deny'); G.hud.popup(def.name + ': EMPTY (clear a room to refill)', '#ffffff', 0.8, true); return; }
    gd.charges--;
  }
  run.stat('gadgetsUsed', 1);
  G.hud.gadgetUsed?.();
  USE[gd.id]();
}

const USE = {
  plasmaGrenade() {
    const focus = G.targeting.focusEnemy() || G.targeting.soft?.enemy || null;
    throwThing('plasmaGrenade', (t, e) => {
      if (t.armed) return;
      t.armed = true;
      if (e) { t.stuck = e; G.hud.bubble(e, 'STUCK!', '#7dd3fc', 1); G.audio.sfx('armor', { v: 0.5 }); } else t.resting = true;
      setTimeoutRun(() => { t.done = true; explode(t.x, t.z, 3.1, 45, { colors: ['#38bdf8', '#7dd3fc', '#ffffff'] }); }, e ? 1.1 : 1.5);
    }, { hitEnemies: true, to: focus ? focus.aimPoint(new THREE.Vector3()) : null, speed: 18 });
  },
  tnt() {
    const a = G.alex;
    const x = a.pos.x + Math.sin(a.yaw) * 1.2, z = a.pos.z + Math.cos(a.yaw) * 1.2;
    const y = G.room.world.groundAt(x, z, a.pos.y + 1, 0.3).h;
    const mesh = ballMesh('tnt');
    mesh.position.set(x, y, z);
    G.room.group.add(mesh);
    const t = { kind: 'tnt', x, y, z, mesh, t: 0, resting: true, update(tt) {
      const flash = Math.floor(tt.t * (4 + tt.t * 6)) % 2 === 0;
      mesh.children[0].material.forEach?.((m) => { if (m.emissive) { m.emissive.set(flash ? '#ffffff' : '#000000'); m.emissiveIntensity = flash ? 0.6 : 0; } });
      mesh.scale.setScalar(1 + (flash ? 0.05 : 0));
      if (tt.t > 2.1) { tt.done = true; explode(x, z, 3.9, 70, { propDmg: 80, knock: 12, pushAlex: true }); }
      return true;
    } };
    thrown.push(t);
    G.audio.sfx('hiss');
    G.hud.bubble({ pos: new THREE.Vector3(x, y, z), height: 0.9, alive: true }, 'tssss…', '#ffffff', 1.6);
  },
  enderPearl() {
    throwThing('enderPearl', (t) => {
      t.done = true;
      const a = G.alex, w = G.room.world;
      const hw = G.room.L.w / 2 - 0.8, hd = G.room.L.d / 2 - 0.8;
      const x = clamp(t.x, -hw, hw), z = clamp(t.z, -hd, hd);
      G.fx.burst(a.pos.x, a.pos.y + 1, a.pos.z, { n: 24, color: ['#14b8a6', '#c77dff', '#ffffff'], speed: 5, life: 0.5 });
      a.pos.set(x, w.groundAt(x, z, t.y + 2, 0.3).h, z);
      a.vel.set(0, 0, 0);
      a.spawnSafe(0.35);
      G.fx.burst(x, a.pos.y + 1, z, { n: 24, color: ['#14b8a6', '#c77dff', '#ffffff'], speed: 5, life: 0.5 });
      G.audio.sfx('teleport');
      G.hud.damageNumber(x, a.pos.y + 2.2, z, '−0 (ouch)', 'alex');
    }, { speed: 20 });
  },
  captureBall() {
    const focus = G.targeting.focusEnemy() || G.targeting.soft?.enemy || null;
    const to = focus ? focus.aimPoint(new THREE.Vector3()) : null;
    throwThing('captureBall', (t, e) => {
      if (t.caught) return;
      if (!e) { t.done = true; G.fx.burst(t.x, t.y, t.z, { n: 8, color: ['#ef4444', '#ffffff'], speed: 3, life: 0.3 }); G.hud.popup('The ball missed.', '#ffffff', 0.8, true); return; }
      t.caught = true;
      tryCatch(t, e);
    }, { hitEnemies: true, to, speed: 18 });
  },
  mosesStaff() {
    const a = G.alex;
    const [fx, fz] = G.cam.forward();
    const len = 22, half = 2.4;
    const inLane = (x, z) => { const dx = x - a.pos.x, dz = z - a.pos.z; const along = dx * fx + dz * fz; const perp = -dx * fz + dz * fx; return along > -1 && along < len && Math.abs(perp) < half ? perp : null; };
    let cleared = 0;
    G.projectiles.list = G.projectiles.list.filter((p) => { if (p.hostile && inLane(p.x, p.z) !== null) { cleared++; return false; } return true; });
    for (const e of G.room.enemies) {
      if (!e.alive || e.intangible) continue;
      const perp = inLane(e.pos.x, e.pos.z);
      if (perp === null) continue;
      const s = Math.sign(perp) || 1;
      e.hurt(12 * (G.run.mods.dmgMul || 1), { source: a, dir: [-fz * s, fx * s], knock: e.heavy ? 6 : 14, stagger: 2, area: true });
    }
    for (let i = 0; i < 16; i++) {
      const d = 1 + i * 1.35;
      for (const s of [-1, 1]) G.fx.burst(a.pos.x + fx * d - fz * half * s, 0.4, a.pos.z + fz * d + fx * half * s, { n: 4, color: ['#38bdf8', '#e0f2fe', '#ffffff'], speed: 2.2, up: 4, life: 0.9, size: 0.3, grav: 6 });
    }
    G.audio.sfx('splash', { v: 1 }); G.audio.sfx('roar', { v: 0.4 });
    G.cam.shake(0.3);
    G.hud.popup(cleared ? `THE SEA PARTS (${cleared} shots cleared)` : 'THE SEA PARTS', '#7dd3fc', 1.2);
  },
};

// Capture: the bigger the wound, the better the odds. Bosses can't be caught.
function tryCatch(t, e) {
  if (e.boss) { t.done = true; G.hud.bubble(e, 'It swatted the ball away!', '#ffffff', 1.2); return; }
  const missing = 1 - e.hp / e.maxHp;
  let chance = 0.15 + missing * 0.85;
  if (e.elite) chance *= 0.7;
  if (e.stunUntil > G.time) chance += 0.15;
  chance = clamp(chance, 0.08, 0.97);
  t.stuck = null; t.resting = true;
  t.x = e.pos.x; t.z = e.pos.z; t.y = e.pos.y + 0.2;
  e.capturing = true;
  e.intangible = true;
  e.group.visible = false;
  e.interrupt();
  e.stunUntil = G.time + 3;
  G.audio.sfx('teleport');
  G.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, { n: 20, color: ['#ef4444', '#ffffff'], speed: 4, life: 0.4 });
  const ok = Math.random() < chance;
  let wiggles = 0;
  const fail = ok ? 99 : 1 + Math.floor(Math.random() * 3);
  const step = () => {
    if (!e.alive) { t.done = true; return; }
    wiggles++;
    t.mesh.rotation.z = (wiggles % 2 ? 0.5 : -0.5);
    G.audio.sfx('pbump');
    if (wiggles >= fail) {
      t.done = true;
      e.capturing = false; e.intangible = false; e.group.visible = true;
      e.stunUntil = G.time + 0.6;
      G.hud.bubble(e, 'Oh no! It broke free!', '#ffffff', 1.4);
      G.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, { n: 16, color: ['#ef4444', '#ffffff'], speed: 5, life: 0.4 });
      return;
    }
    if (wiggles >= 3) {
      t.done = true;
      G.hud.popup(`Gotcha! ${e.name.toUpperCase()} was caught!`, '#fde047', 2);
      G.audio.sfx('win');
      G.fx.confetti(e.pos.x, 1.5, e.pos.z, 40);
      const old = G.run.pal;
      G.run.pal = { type: e.type, name: e.name, franchise: e.franchise || null, threat: e.threat || 1, level: 1 };
      G.run.stat('caught', 1);
      if (old) G.hud.popup(`${old.name} was sent to the PC.`, '#ffffff', 1.6, true);
      e.die({ source: G.alex, captured: true });
      spawnPal();
      return;
    }
    setTimeoutRun(step, 0.6);
  };
  setTimeoutRun(step, 0.6);
}

export function spawnPal() {
  if (G.run.palActor) G.run.palActor.dispose();
  G.run.palActor = G.run.pal ? new Pal(G.run.pal) : null;
}

// game-time timeouts that die with the room
const timers = [];
function setTimeoutRun(fn, t) { timers.push({ at: G.time + t, fn, room: G.room }); }
export function tickGadgetTimers() {
  for (let i = timers.length - 1; i >= 0; i--) {
    const tm = timers[i];
    if (tm.room !== G.room) { timers.splice(i, 1); continue; }
    if (G.time >= tm.at) { timers.splice(i, 1); tm.fn(); }
  }
}
