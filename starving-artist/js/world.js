// A World is one playable space (the Vista Venue, or a memory): grid level + props +
// interactables + per-frame updaters + sky/fog/post "mood".
import * as THREE from 'three';
import { Level } from './level.js';
import { mat, ensureColor } from './renderer.js';
import { tex } from './tex.js';
import { makeDynamic, setProbe } from './props.js';

export class World {
  constructor(game, cfg) {
    this.game = game;
    this.cfg = cfg;
    this.scene = new THREE.Scene();
    this.interactables = [];
    this.updaters = [];
    this.dynamics = [];
    this.billboards = [];
    this.triggers = [];
    this.dynLights = [];
    this.t = 0;
    this.level = new Level(cfg.builder, { regions: cfg.regions, lights: cfg.lights || [], seed: cfg.seed || 7 });
    this.scene.add(this.level.build());
    this.c = this.level.cell;
    if (cfg.sky) this.setSky(cfg.sky);
  }

  setSky(key) {
    if (!this.sky) {
      const geo = ensureColor(new THREE.SphereGeometry(300, 16, 10));
      this.skyMat = mat({ map: tex(key), emissive: 1, fog: false, side: THREE.BackSide, depthWrite: false });
      this.sky = new THREE.Mesh(geo, this.skyMat);
      this.sky.renderOrder = -10;
      this.sky.frustumCulled = false;
      this.scene.add(this.sky);
    } else this.skyMat.uniforms.map.value = tex(key);
  }

  // cell -> world position helpers
  at(i, j, dx = 0, dz = 0) { return new THREE.Vector3((i + 0.5) * this.c + dx, 0, (j + 0.5) * this.c + dz); }
  wall(i, j, side, y = 1.5, inset = 0.06, along = 0) {
    const c = this.c;
    switch (side) {
      case 'n': return { pos: new THREE.Vector3((i + 0.5) * c + along, y, j * c + inset), ry: 0 };
      case 's': return { pos: new THREE.Vector3((i + 0.5) * c + along, y, (j + 1) * c - inset), ry: Math.PI };
      case 'w': return { pos: new THREE.Vector3(i * c + inset, y, (j + 0.5) * c + along), ry: Math.PI / 2 };
      default: return { pos: new THREE.Vector3((i + 1) * c - inset, y, (j + 0.5) * c + along), ry: -Math.PI / 2 };
    }
  }

  // Place a prop. opts: ry, y, dx, dz, collide (bool|pad), bake (default true), dynamic
  prop(obj, i, j, opts = {}) {
    const p = opts.pos || this.at(i, j, opts.dx || 0, opts.dz || 0);
    obj.position.set(p.x, opts.y ?? p.y ?? 0, p.z);
    if (opts.ry !== undefined) obj.rotation.y = opts.ry;
    if (opts.scale) obj.scale.setScalar(opts.scale);
    this.scene.add(obj);
    obj.updateMatrixWorld(true);
    if (opts.collide) obj.userData.collider = this.level.colliderAround(obj, typeof opts.collide === 'number' ? opts.collide : 0.05);
    if (opts.dynamic) { makeDynamic(obj); this.dynamics.push(obj); }
    else if (opts.bake !== false) this.level.bakeObject(obj, opts.boost || 1);
    return obj;
  }
  onWall(obj, i, j, side, y = 1.5, opts = {}) {
    const w = this.wall(i, j, side, y, opts.inset ?? 0.06, opts.along || 0);
    return this.prop(obj, i, j, { ...opts, pos: w.pos, y: w.pos.y, ry: w.ry });
  }
  remove(obj) {
    this.scene.remove(obj);
    if (obj.userData.collider) obj.userData.collider.on = false;
    this.dynamics = this.dynamics.filter((d) => d !== obj);
  }

  billboard(obj, pos, opts = {}) {
    obj.position.copy(pos);
    this.scene.add(obj);
    this.billboards.push({ obj, yOnly: opts.yOnly ?? false });
    return obj;
  }

  // Interactable: { obj | pos, r, reach, prompt (string|fn), use: async fn, enabled: fn, dim: fn -> string|false }
  interact(def) {
    const it = { r: 0.6, reach: 2.4, enabled: () => true, ...def };
    this.interactables.push(it);
    return it;
  }
  removeInteract(it) { this.interactables = this.interactables.filter((x) => x !== it); }

  trigger(def) { const t = { r: 1.5, once: true, fired: false, ...def }; this.triggers.push(t); return t; }

  onUpdate(fn) { this.updaters.push(fn); return fn; }

  addLight(l) { const x = this.game.lights.add(l); this.dynLights.push(x); return x; }

  surface(pos) { return this.level.regionAt(pos.x, pos.z).surface || 'hard'; }

  findTarget(eye, dir) {
    let best = null, bd = 1e9;
    const v = new THREE.Vector3();
    for (const it of this.interactables) {
      if (!it.enabled()) continue;
      const p = it.obj ? it.obj.getWorldPosition(v) : v.copy(it.pos);
      if (it.offsetY) p.y += it.offsetY;
      const to = p.clone().sub(eye);
      const d = to.length();
      if (d > it.reach + it.r) continue;
      const along = to.dot(dir);
      if (along < 0) continue;
      const perp = Math.sqrt(Math.max(0, d * d - along * along));
      const tol = it.r + d * 0.05;
      if (perp > tol) continue;
      if (!this.level.los(eye, p)) {
        // allow targets sitting right against a wall face
        const back = p.clone().sub(to.clone().normalize().multiplyScalar(0.3));
        if (!this.level.los(eye, back)) continue;
      }
      const score = d + perp * 2;
      if (score < bd) { bd = score; best = it; }
    }
    return best;
  }

  update(dt, cam) {
    this.t += dt;
    if (this.sky) this.sky.position.copy(cam.position);
    for (const b of this.billboards) {
      if (b.yOnly) { const dx = cam.position.x - b.obj.position.x, dz = cam.position.z - b.obj.position.z; b.obj.rotation.set(0, Math.atan2(dx, dz), 0); }
      else b.obj.quaternion.copy(cam.quaternion);
    }
    // re-sample baked light for moving objects only when they have actually moved
    for (const d of this.dynamics) {
      if (!d.visible) continue;
      const lp = d.userData._probeAt;
      if (!lp || lp.distanceToSquared(d.position) > 0.09) { setProbe(d, this.level.probe(d.position)); d.userData._probeAt = d.position.clone(); }
    }
    for (const f of [...this.updaters]) f(dt, this.t);
  }

  dispose() {
    for (const l of this.dynLights) this.game.lights.remove(l);
    this.level.dispose();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
