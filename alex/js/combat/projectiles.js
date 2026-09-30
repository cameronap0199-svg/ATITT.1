// Pooled projectiles rendered with instanced meshes. Hostile projectiles share one
// visual language — bright core, dark outline, stretched along their velocity — so
// they read against K-pop lighting, confetti and Alex's own (cyan, outline-free) shots.

import * as THREE from 'three';
import { G } from '../state.js';
import { heartShape } from '../world/props.js';

const KINDS = {
  orb: { geo: () => new THREE.SphereGeometry(1, 12, 8), max: 700, stretch: 1.45 },
  card: { geo: () => new THREE.BoxGeometry(1.4, 0.12, 2), max: 200, flat: true },
  heart: { geo: () => { const g = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.35, bevelEnabled: false }); g.center(); g.scale(1.6, 1.6, 1); return g; }, max: 300, flat: true },
  cd: { geo: () => new THREE.CylinderGeometry(1, 1, 0.14, 20), max: 150, flat: true },
  bubble: { geo: () => new THREE.BoxGeometry(1.8, 1.1, 0.5), max: 120 },
  crescent: { geo: () => { const g = new THREE.TorusGeometry(1, 0.22, 6, 20, Math.PI); g.rotateX(Math.PI / 2); g.rotateY(Math.PI / 2); return g; }, max: 40 },
  // friendly
  bolt: { geo: () => new THREE.CapsuleGeometry(0.5, 2.4, 3, 8).rotateX(Math.PI / 2), max: 300, friendly: true },
  slug: { geo: () => new THREE.SphereGeometry(1, 10, 8), max: 60, friendly: true, stretch: 2.2 },
  shirt: { geo: () => new THREE.BoxGeometry(1.6, 0.25, 1.3), max: 40, friendly: true, tumble: true },
  flame: { geo: () => new THREE.IcosahedronGeometry(1, 0), max: 260, friendly: true, tumble: true },
  star: { geo: () => { const g = new THREE.OctahedronGeometry(1, 0); return g; }, max: 80, friendly: true, tumble: true },
};

const HOSTILE_CORE = { orb: '#ffe3f5', card: '#fff7fb', heart: '#ff9ccf', cd: '#e8f7ff', bubble: '#ffffff', crescent: '#ffd0f2' };
const RIM = '#2a0014';

export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.meshes = {};
    for (const [k, def] of Object.entries(KINDS)) {
      const geo = def.geo();
      const core = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: !!def.friendly, opacity: def.friendly ? 0.85 : 1, depthWrite: !def.friendly }), def.max);
      core.frustumCulled = false; core.count = 0;
      core.setColorAt(0, new THREE.Color());
      scene.add(core);
      let outline = null;
      if (!def.friendly) {
        outline = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: RIM, side: THREE.BackSide }), def.max);
        outline.frustumCulled = false; outline.count = 0;
        outline.renderOrder = -1;
        scene.add(outline);
        // halo so hostile shots stay visible on dark floors too
        const halo = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ff2e7e', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }), def.max);
        halo.frustumCulled = false; halo.count = 0;
        scene.add(halo);
        this.meshes[k] = { core, outline, halo, def };
      } else this.meshes[k] = { core, def };
    }
    this.d = new THREE.Object3D();
    this.col = new THREE.Color();
    this.v = new THREE.Vector3();
    this.hostileCount = 0;
  }

  spawn(o) {
    const p = {
      hostile: o.hostile ?? true, kind: o.kind || (o.hostile === false ? 'bolt' : 'orb'),
      x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      r: o.r ?? 0.3, dmg: o.dmg ?? 7, life: o.life ?? 5, t: 0,
      color: o.color || null, grav: o.grav || 0, owner: o.owner || null, ff: !!o.ff,
      pierce: o.pierce || 0, knock: o.knock ?? 2.5, stagger: o.stagger || 0, onHit: o.onHit || null,
      spin: o.spin ?? (Math.random() * 10), rot: 0, homing: o.homing || 0, hit: new Set(), grazed: false,
      propDmg: o.propDmg ?? (o.hostile === false ? 0.4 : 0.6), accel: o.accel || 0, delay: o.delay || 0,
      bounce: o.bounce || 0, weapon: o.weapon || null, noBlock: !!o.noBlock, perfect: !!o.perfect, tag: o.tag,
    };
    this.list.push(p);
    return p;
  }

  clear() { this.list.length = 0; }
  clearHostile() { this.list = this.list.filter((p) => !p.hostile); }

  update(dt) {
    const world = G.room?.world;
    const alex = G.alex;
    const keep = [];
    this.hostileCount = 0;
    for (const p of this.list) {
      if (p.delay > 0) { p.delay -= dt; keep.push(p); continue; }
      p.t += dt;
      if (p.t > p.life) continue;
      if (p.homing && p.hostile && alex) {
        const dx = alex.pos.x - p.x, dz = alex.pos.z - p.z, l = Math.hypot(dx, dz) || 1;
        const sp = Math.hypot(p.vx, p.vz);
        p.vx += (dx / l * sp - p.vx) * Math.min(1, p.homing * dt);
        p.vz += (dz / l * sp - p.vz) * Math.min(1, p.homing * dt);
      }
      if (p.accel) { const s = 1 + p.accel * dt; p.vx *= s; p.vz *= s; }
      p.vy -= p.grav * dt;
      // sub-step fast projectiles so they can't tunnel through thin walls / Alex
      const dist = Math.hypot(p.vx, p.vy, p.vz) * dt;
      const steps = Math.max(1, Math.ceil(dist / 0.35));
      let dead = false;
      for (let s = 0; s < steps && !dead; s++) {
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps; p.z += p.vz * dt / steps;
        p.rot += p.spin * dt / steps;
        dead = this._collide(p, world, alex);
      }
      if (dead) continue;
      if (p.hostile) this.hostileCount++;
      keep.push(p);
    }
    this.list = keep;
    this._render();
  }

  _collide(p, world, alex) {
    if (world && !p.noBlock) {
      const b = world.projectileBlock(p.x, p.y, p.z, p.r);
      if (b) {
        if (b === 'floor') {
          if (p.bounce > 0) { p.bounce--; p.vy = Math.abs(p.vy) * 0.6; p.y = 0.05; return false; }
        } else if (b.hp != null && G.room) G.room.damageBlock(b, p.dmg * p.propDmg, p);
        if (p.onHit) p.onHit(p, null);
        G.fx.burst(p.x, p.y, p.z, { n: 5, color: p.hostile ? '#ff9ccf' : '#8ff7ff', speed: 3, life: 0.25, size: 0.12 });
        return true;
      }
    }
    if (p.hostile) {
      if (alex && alex.alive) {
        const res = alex.testProjectile(p);
        if (res === 'hit') { if (p.onHit) p.onHit(p, alex); return true; }
      }
      if (p.ff && G.room) {
        for (const e of G.room.enemies) {
          if (!e.alive || e === p.owner || p.hit.has(e)) continue;
          const part = e.hitTest(p.x, p.y, p.z, p.r);
          if (part) {
            p.hit.add(e);
            e.hurt(p.dmg, { source: p.owner || 'hazard', dir: [p.vx, p.vz], knock: p.knock, part, friendly: true });
            if (p.pierce-- <= 0) return true;
          }
        }
      }
    } else if (G.room) {
      for (const e of G.room.enemies) {
        if (!e.alive || p.hit.has(e) || e.intangible) continue;
        const part = e.hitTest(p.x, p.y, p.z, p.r);
        if (part) {
          p.hit.add(e);
          G.run?.stat('shotsHit', 1);
          const dealt = e.hurt(p.dmg, { source: G.alex, dir: [p.vx, p.vz], knock: p.knock, part, stagger: p.stagger, ranged: true, weapon: p.weapon, perfect: p.perfect });
          if (p.onHit) p.onHit(p, e, dealt);
          if (p.pierce-- <= 0) return true;
        }
      }
    }
    return false;
  }

  _render() {
    const d = this.d;
    const lv = Math.min(2, ['normal', 'high', 'max'].indexOf(G.settings.projectileContrast) + (G.run?.mods.readable || 0));
    const contrast = ['normal', 'high', 'max'][Math.max(0, lv)];
    const cs = contrast === 'max' ? 1.35 : contrast === 'high' ? 1.18 : 1;
    const rimScale = contrast === 'max' ? 1.5 : contrast === 'high' ? 1.38 : 1.28;
    const counts = {};
    for (const k of Object.keys(this.meshes)) counts[k] = 0;
    const camPos = G.camera.position;
    for (const p of this.list) {
      if (p.delay > 0) continue;
      const M = this.meshes[p.kind];
      if (!M) continue;
      const i = counts[p.kind];
      if (i >= M.def.max) continue;
      counts[p.kind]++;
      d.position.set(p.x, p.y, p.z);
      const sp = Math.hypot(p.vx, p.vy, p.vz);
      if (M.def.flat) {
        d.rotation.set(0, Math.atan2(p.vx, p.vz) + (p.kind === 'heart' ? 0 : p.rot), 0);
        if (p.kind === 'heart') { d.lookAt(camPos); }
      } else if (M.def.tumble) {
        d.rotation.set(p.rot, p.rot * 0.6, 0);
      } else if (sp > 0.01) {
        this.v.set(p.x + p.vx, p.y + p.vy, p.z + p.vz);
        d.lookAt(this.v);
      }
      const r = p.r * (p.hostile ? cs : 1);
      const st = M.def.stretch && sp > 1 ? M.def.stretch : 1;
      if (p.kind === 'bolt') d.scale.set(r, r, r);
      else d.scale.set(r, r, r * st);
      d.updateMatrix();
      M.core.setMatrixAt(i, d.matrix);
      let col = p.color || (p.hostile ? HOSTILE_CORE[p.kind] : '#9ff6ff');
      if (p.hostile && contrast === 'max') col = '#fff9c4';
      this.col.set(col);
      M.core.setColorAt(i, this.col);
      if (M.outline) {
        d.scale.multiplyScalar(rimScale);
        d.updateMatrix();
        M.outline.setMatrixAt(i, d.matrix);
        d.scale.multiplyScalar(1.3);
        d.updateMatrix();
        M.halo.setMatrixAt(i, d.matrix);
      }
    }
    for (const [k, M] of Object.entries(this.meshes)) {
      M.core.count = counts[k];
      M.core.visible = counts[k] > 0;
      M.core.instanceMatrix.needsUpdate = true;
      if (M.core.instanceColor) M.core.instanceColor.needsUpdate = true;
      if (M.outline) {
        M.outline.count = counts[k]; M.outline.instanceMatrix.needsUpdate = true; M.outline.visible = counts[k] > 0;
        M.halo.count = counts[k]; M.halo.instanceMatrix.needsUpdate = true; M.halo.visible = counts[k] > 0;
      }
    }
  }

  // Helpers for patterns
  fan(o, n, spread, yaw, speed) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = yaw + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
      out.push(this.spawn({ ...o, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed }));
    }
    return out;
  }
  ring(o, n, speed, offset = 0) {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * Math.PI * 2;
      this.spawn({ ...o, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed });
    }
  }
}
