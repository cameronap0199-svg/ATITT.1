// Grid levels. A level is a 2D grid of cells (walls, floors, water, void, gates) that is
// turned into batched low-poly geometry with lighting baked into vertex colours (with
// grid-traced shadows). The same grid drives collision, line of sight and A* paths.
import * as THREE from 'three';
import { mat, ensureColor } from './renderer.js';
import { tex, rng } from './tex.js';

export const WALL = 0, FLOOR = 1, VOID = 2, WATER = 3;
// Quads per cell edge. Floors, ceilings and walls must match so no T-junction cracks appear.
const SUB = 3;

export class GridBuilder {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.type = new Uint8Array(w * h).fill(WALL);
    this.region = new Array(w * h).fill(null);
    this.gate = new Array(w * h).fill(null);
    this.wallTex = new Array(w * h).fill(null);
    this.markers = {};
  }
  idx(x, z) { return z * this.w + x; }
  fill(x, z, w, h, type, region = null) {
    for (let j = z; j < z + h; j++) for (let i = x; i < x + w; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
      const k = this.idx(i, j);
      this.type[k] = type;
      if (region !== null) this.region[k] = region;
      if (type !== FLOOR) this.gate[k] = null;
    }
    return this;
  }
  room(x, z, w, h, region) { return this.fill(x, z, w, h, FLOOR, region); }
  wall(x, z, w = 1, h = 1, wallTex = null) {
    this.fill(x, z, w, h, WALL);
    if (wallTex) for (let j = z; j < z + h; j++) for (let i = x; i < x + w; i++) this.wallTex[this.idx(i, j)] = wallTex;
    return this;
  }
  voidc(x, z, w = 1, h = 1) { return this.fill(x, z, w, h, VOID); }
  water(x, z, w, h, region) { return this.fill(x, z, w, h, WATER, region); }
  gateAt(x, z, w, h, id, region) {
    this.fill(x, z, w, h, FLOOR, region);
    for (let j = z; j < z + h; j++) for (let i = x; i < x + w; i++) this.gate[this.idx(i, j)] = id;
    return this;
  }
  mark(name, x, z, extra = {}) { (this.markers[name] ||= []).push({ x, z, ...extra }); return this; }
}

export class Level {
  constructor(builder, { cell = 2, regions, lights = [], seed = 7 }) {
    Object.assign(this, { w: builder.w, h: builder.h, type: builder.type, region: builder.region, gate: builder.gate, wallTex: builder.wallTex });
    this.markers = builder.markers;
    this.cell = cell;
    this.regions = regions;
    this.lights = lights.map((l) => ({ intensity: 1, range: 8, y: 2.5, ...l, color: new THREE.Color(l.color ?? 0xffffff) }));
    this.openGates = new Set();
    this.colliders = [];
    this.seed = seed;
    this.group = new THREE.Group();
  }

  idx(i, j) { return j * this.w + i; }
  inside(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
  cellOf(x, z) { return [Math.floor(x / this.cell), Math.floor(z / this.cell)]; }
  center(i, j) { return new THREE.Vector3((i + 0.5) * this.cell, 0, (j + 0.5) * this.cell); }
  marker(name, k = 0) { const m = this.markers[name]?.[k]; return m ? this.center(m.x, m.z) : null; }
  markerCells(name) { return this.markers[name] || []; }
  reg(i, j) { return this.regions[this.region[this.idx(i, j)]] || this.regions.default; }

  isWalkable(i, j) {
    if (!this.inside(i, j)) return false;
    const k = this.idx(i, j);
    if (this.type[k] !== FLOOR) return false;
    const g = this.gate[k];
    return !g || this.openGates.has(g);
  }
  blocksLight(i, j) { return !this.inside(i, j) || this.type[this.idx(i, j)] === WALL; }
  blocksSight(i, j) {
    if (!this.inside(i, j)) return true;
    const k = this.idx(i, j);
    if (this.type[k] === WALL) return true;
    const g = this.gate[k];
    return !!g && !this.openGates.has(g);
  }

  openGate(id) { this.openGates.add(id); }
  closeGate(id) { this.openGates.delete(id); }
  gateBounds(id) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, reg = null;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) if (this.gate[this.idx(i, j)] === id) {
      x0 = Math.min(x0, i); z0 = Math.min(z0, j); x1 = Math.max(x1, i); z1 = Math.max(z1, j); reg = this.region[this.idx(i, j)];
    }
    if (x0 > x1) return null;
    const c = this.cell;
    return { x0: x0 * c, z0: z0 * c, x1: (x1 + 1) * c, z1: (z1 + 1) * c, cx: (x0 + x1 + 1) * c / 2, cz: (z0 + z1 + 1) * c / 2, w: (x1 - x0 + 1) * c, d: (z1 - z0 + 1) * c, region: reg };
  }

  addCollider(minx, minz, maxx, maxz, tag = null) {
    const c = { minx, minz, maxx, maxz, on: true, tag };
    this.colliders.push(c);
    return c;
  }
  colliderAround(obj, pad = 0) {
    const b = new THREE.Box3().setFromObject(obj);
    return this.addCollider(b.min.x - pad, b.min.z - pad, b.max.x + pad, b.max.z + pad);
  }

  // Resolve a circle against solid cells and box colliders. Mutates pos.
  collide(pos, r) {
    for (let it = 0; it < 3; it++) {
      const [ci, cj] = this.cellOf(pos.x, pos.z);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        if (this.isWalkable(i, j)) continue;
        this._pushBox(pos, r, i * this.cell, j * this.cell, (i + 1) * this.cell, (j + 1) * this.cell);
      }
      for (const c of this.colliders) if (c.on) this._pushBox(pos, r, c.minx, c.minz, c.maxx, c.maxz);
    }
    return pos;
  }
  _pushBox(pos, r, x0, z0, x1, z1) {
    const cx = Math.max(x0, Math.min(pos.x, x1)), cz = Math.max(z0, Math.min(pos.z, z1));
    let dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 < 1e-8) {
      // centre inside the box: push out along the shallowest axis
      const opts = [[pos.x - x0 + r, -1, 0], [x1 - pos.x + r, 1, 0], [pos.z - z0 + r, 0, -1], [z1 - pos.z + r, 0, 1]].sort((a, b) => a[0] - b[0]);
      pos.x += opts[0][1] * opts[0][0]; pos.z += opts[0][2] * opts[0][0];
      return;
    }
    const d = Math.sqrt(d2);
    pos.x += dx / d * (r - d); pos.z += dz / d * (r - d);
  }

  // Grid DDA line test (world coords). blockFn(i,j) -> bool
  trace(ax, az, bx, bz, blockFn) {
    const c = this.cell;
    let x = ax / c, z = az / c; const ex = bx / c, ez = bz / c;
    let i = Math.floor(x), j = Math.floor(z);
    const ti = Math.floor(ex), tj = Math.floor(ez);
    const dx = ex - x, dz = ez - z;
    const si = Math.sign(dx), sj = Math.sign(dz);
    const tdx = si ? Math.abs(1 / dx) : Infinity, tdz = sj ? Math.abs(1 / dz) : Infinity;
    let tmx = si > 0 ? (i + 1 - x) * tdx : si < 0 ? (x - i) * tdx : Infinity;
    let tmz = sj > 0 ? (j + 1 - z) * tdz : sj < 0 ? (z - j) * tdz : Infinity;
    for (let n = 0; n < 400; n++) {
      if (i === ti && j === tj) return true;
      if (tmx < tmz) { tmx += tdx; i += si; } else { tmz += tdz; j += sj; }
      if (i === ti && j === tj) return true;
      if (blockFn(i, j)) return false;
    }
    return true;
  }
  los(a, b) { return this.trace(a.x, a.z, b.x, b.z, (i, j) => this.blocksSight(i, j)); }

  // A* over walkable cells (8-way, no corner cutting). Returns array of world Vector3 or null.
  path(from, to, maxNodes = 6000) {
    let [si, sj] = this.cellOf(from.x, from.z);
    let [ti, tj] = this.cellOf(to.x, to.z);
    if (!this.isWalkable(ti, tj)) { const n = this.nearestWalkable(ti, tj); if (!n) return null; [ti, tj] = n; }
    if (!this.isWalkable(si, sj)) { const n = this.nearestWalkable(si, sj); if (!n) return null; [si, sj] = n; }
    const W = this.w, start = sj * W + si, goal = tj * W + ti;
    const g = new Map([[start, 0]]), came = new Map();
    const open = [[this._h(si, sj, ti, tj), start]];
    const closed = new Set();
    let n = 0;
    while (open.length && n++ < maxNodes) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) break;
      if (closed.has(cur)) continue;
      closed.add(cur);
      const ci = cur % W, cj = (cur - ci) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.isWalkable(ni, nj)) continue;
        if (di && dj && (!this.isWalkable(ci + di, cj) || !this.isWalkable(ci, cj + dj))) continue;
        const nk = nj * W + ni;
        const cost = g.get(cur) + (di && dj ? 1.414 : 1);
        if (cost < (g.get(nk) ?? Infinity)) { g.set(nk, cost); came.set(nk, cur); open.push([cost + this._h(ni, nj, ti, tj), nk]); }
      }
    }
    if (!came.has(goal) && goal !== start) return null;
    const out = [];
    let k = goal;
    while (k !== start) { out.push(this.center(k % W, Math.floor(k / W))); k = came.get(k); }
    out.reverse();
    return out;
  }
  _h(a, b, c, d) { const dx = Math.abs(a - c), dz = Math.abs(b - d); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); }
  nearestWalkable(i, j) {
    for (let r = 0; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.isWalkable(i + di, j + dj)) return [i + di, j + dj];
    return null;
  }

  // ---------------- lighting bake ----------------
  lightAt(p, n, regionAmb) {
    const out = new THREE.Color(regionAmb[0], regionAmb[1], regionAmb[2]);
    const px = p.x + n.x * 0.08, pz = p.z + n.z * 0.08;
    for (const l of this.lights) {
      const dx = l.x - p.x, dy = l.y - p.y, dz = l.z - p.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > l.range * l.range) continue;
      const d = Math.sqrt(d2);
      let att = 1 - d / l.range; att *= att;
      const ndl = Math.max(0, (dx * n.x + dy * n.y + dz * n.z) / (d || 1)) * 0.7 + 0.3;
      const vis = this.trace(l.x, l.z, px, pz, (i, j) => this.blocksLight(i, j)) ? 1 : 0.12;
      const k = att * ndl * vis * l.intensity;
      out.r += l.color.r * k; out.g += l.color.g * k; out.b += l.color.b * k;
    }
    return out;
  }
  floorAt(x, z) { const [i, j] = this.cellOf(x, z); return this.inside(i, j) && this.type[this.idx(i, j)] === FLOOR ? (this.reg(i, j).floorY || 0) : 0; }
  regionAt(x, z) { const [i, j] = this.cellOf(x, z); return this.inside(i, j) ? this.reg(i, j) : this.regions.default; }
  probe(p) {
    const r = this.regionAt(p.x, p.z);
    return this.lightAt(new THREE.Vector3(p.x, p.y + 1, p.z), new THREE.Vector3(0, 1, 0), r.ambient || [0.5, 0.5, 0.5]);
  }

  // Bake lighting into a static object's vertex colours (albedo already in the colour attribute).
  bakeObject(obj, boost = 1) {
    obj.updateMatrixWorld(true);
    const v = new THREE.Vector3(), nn = new THREE.Vector3(), nm = new THREE.Matrix3();
    obj.traverse((m) => {
      if (!m.isMesh || m.userData.noBake) return;
      const geo = m.geometry;
      ensureColor(geo);
      const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), col = geo.getAttribute('color');
      const alb = m.userData.albedo || (m.userData.albedo = col.array.slice());
      if (!geo.getAttribute('albedo')) geo.setAttribute('albedo', new THREE.BufferAttribute(new Float32Array(alb), 3));
      nm.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (nor) nn.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); else nn.set(0, 1, 0);
        const r = this.regionAt(v.x, v.z);
        const L = this.lightAt(v, nn, r.ambient || [0.5, 0.5, 0.5]);
        col.setXYZ(i, alb[i * 3] * L.r * boost, alb[i * 3 + 1] * L.g * boost, alb[i * 3 + 2] * L.b * boost);
      }
      col.needsUpdate = true;
    });
  }

  // ---------------- geometry ----------------
  build() {
    const buckets = new Map();
    const R = rng(this.seed);
    const bucket = (texKey, scale = 2) => {
      const k = texKey + '|' + scale;
      if (!buckets.has(k)) buckets.set(k, { texKey, scale, pos: [], nor: [], uv: [], col: [] });
      return buckets.get(k);
    };
    const c = this.cell;
    const tmpP = new THREE.Vector3(), tmpN = new THREE.Vector3();
    const bakeCache = new Map();
    // Emit a quad subdivided into nu x nv, corner p0, edge vectors eu, ev, normal n. UV from world coords.
    const quad = (b, p0, eu, ev, n, nu, nv, uvFn, amb, tint, dark = null) => {
      const verts = [];
      for (let jv = 0; jv <= nv; jv++) {
        const row = [];
        for (let iu = 0; iu <= nu; iu++) {
          tmpP.set(p0.x + eu.x * iu / nu + ev.x * jv / nv, p0.y + eu.y * iu / nu + ev.y * jv / nv, p0.z + eu.z * iu / nu + ev.z * jv / nv);
          // neighbouring quads share edge vertices: bake each position+normal once
          const key = Math.round(tmpP.x * 64) * 73856093 ^ Math.round(tmpP.y * 64) * 19349663 ^ Math.round(tmpP.z * 64) * 83492791 ^ ((n.x + 2) * 3 + (n.y + 2) * 17 + (n.z + 2) * 131) | 0;
          let L = bakeCache.get(key);
          if (!L || L.amb !== amb) { L = this.lightAt(tmpP, n, amb); L.amb = amb; bakeCache.set(key, L); }
          const j = 1 + (R() - 0.5) * 0.06;
          let dk = 1;
          if (dark) dk = dark(tmpP);
          row.push({ p: tmpP.clone(), uv: uvFn(tmpP), c: [L.r * tint[0] * j * dk, L.g * tint[1] * j * dk, L.b * tint[2] * j * dk] });
        }
        verts.push(row);
      }
      for (let jv = 0; jv < nv; jv++) for (let iu = 0; iu < nu; iu++) {
        const a = verts[jv][iu], bb = verts[jv][iu + 1], cc = verts[jv + 1][iu + 1], d = verts[jv + 1][iu];
        for (const q of [a, bb, cc, a, cc, d]) {
          b.pos.push(q.p.x, q.p.y, q.p.z); b.nor.push(n.x, n.y, n.z); b.uv.push(q.uv[0], q.uv[1]); b.col.push(...q.c);
        }
      }
    };
    // winding: we build with eu x ev == normal direction
    const floorY = (i, j) => { const r = this.reg(i, j); return (r.floorY || 0) + (this.type[this.idx(i, j)] === WATER ? -(r.poolDepth || 1.3) : 0); };
    const topY = (i, j) => { const r = this.reg(i, j); return (r.floorY || 0) + r.h; };
    const open = (i, j) => this.inside(i, j) && (this.type[this.idx(i, j)] === FLOOR || this.type[this.idx(i, j)] === WATER);
    const waterQuads = [];

    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      if (!open(i, j)) continue;
      const r = this.reg(i, j);
      const amb = r.ambient || [0.5, 0.5, 0.5];
      const tint = r.tint || [1, 1, 1];
      const fy = floorY(i, j), ty = topY(i, j);
      const x0 = i * c, z0 = j * c;
      const isWater = this.type[this.idx(i, j)] === WATER;
      // floor (normal up): eu = +z, ev = +x  -> z cross x = +y
      const fKey = isWater ? (r.poolFloor || r.floor) : r.floor;
      const fs = r.floorScale || 2;
      const nearWallDark = (p) => {
        const fx = p.x / c - i, fz = p.z / c - j;
        let k = 1;
        if (fx < 0.01 && !open(i - 1, j)) k *= 0.82; if (fx > 0.99 && !open(i + 1, j)) k *= 0.82;
        if (fz < 0.01 && !open(i, j - 1)) k *= 0.82; if (fz > 0.99 && !open(i, j + 1)) k *= 0.82;
        return k;
      };
      quad(bucket(fKey, fs), new THREE.Vector3(x0, fy, z0), new THREE.Vector3(0, 0, c), new THREE.Vector3(c, 0, 0), new THREE.Vector3(0, 1, 0), SUB, SUB,
        (p) => [p.x / fs, p.z / fs], amb, tint, nearWallDark);
      if (isWater) waterQuads.push([x0, z0, r]);
      // ceiling (normal down): eu = +x, ev = +z -> x cross z = -y
      if (r.ceil) {
        quad(bucket(r.ceil, r.ceilScale || 2), new THREE.Vector3(x0, ty, z0), new THREE.Vector3(c, 0, 0), new THREE.Vector3(0, 0, c), new THREE.Vector3(0, -1, 0), SUB, SUB,
          (p) => [p.x / (r.ceilScale || 2), p.z / (r.ceilScale || 2)], amb, tint);
      }
      // four edges
      const edges = [
        [0, -1, new THREE.Vector3(x0, 0, z0), new THREE.Vector3(c, 0, 0), new THREE.Vector3(0, 0, 1)],          // north edge, faces +z
        [0, 1, new THREE.Vector3(x0 + c, 0, z0 + c), new THREE.Vector3(-c, 0, 0), new THREE.Vector3(0, 0, -1)], // south edge, faces -z
        [-1, 0, new THREE.Vector3(x0, 0, z0 + c), new THREE.Vector3(0, 0, -c), new THREE.Vector3(1, 0, 0)],     // west edge, faces +x
        [1, 0, new THREE.Vector3(x0 + c, 0, z0), new THREE.Vector3(0, 0, c), new THREE.Vector3(-1, 0, 0)],      // east edge, faces -x
      ];
      for (const [di, dj, p0, eu, n] of edges) {
        const ni = i + di, nj = j + dj;
        const ws = r.wallScale || 2;
        const uvW = (p) => [(Math.abs(n.x) > 0 ? p.z : p.x) / ws, p.y / ws];
        const wallDark = (p) => (p.y - fy < 0.35 ? 0.72 : 1);
        if (!this.inside(ni, nj) || this.type[this.idx(ni, nj)] === WALL) {
          const wt = this.inside(ni, nj) && this.wallTex[this.idx(ni, nj)] || r.wall;
          const hgt = ty - fy;
          quad(bucket(wt, ws), new THREE.Vector3(p0.x, fy, p0.z), eu, new THREE.Vector3(0, hgt, 0), n, SUB, Math.max(2, Math.round(hgt / 1.1)), uvW, amb, tint, wallDark);
        } else if (this.type[this.idx(ni, nj)] === VOID) {
          // slab edge: floor seen from the side, dropping into the void
          quad(bucket(r.edge || r.wall, ws), new THREE.Vector3(p0.x, fy - 0.6, p0.z), eu, new THREE.Vector3(0, 0.6, 0), n, SUB, 1, uvW, amb, [tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.6]);
        } else {
          // step between different floor heights / ceiling heights
          const nfy = floorY(ni, nj), nty = topY(ni, nj);
          if (nfy > fy) quad(bucket(isWater ? (r.poolFloor || r.wall) : r.wall, ws), new THREE.Vector3(p0.x, fy, p0.z), eu, new THREE.Vector3(0, nfy - fy, 0), n, SUB, 1, uvW, amb, tint);
          if (nty < ty && r.ceil) {
            const nr = this.reg(ni, nj);
            if (nr.ceil) quad(bucket(r.wall, ws), new THREE.Vector3(p0.x, nty, p0.z), eu, new THREE.Vector3(0, ty - nty, 0), n, SUB, 1, uvW, amb, tint);
          }
        }
      }
    }

    for (const b of buckets.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat({ map: tex(b.texKey) }));
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
    // water surfaces
    if (waterQuads.length) {
      const pos = [], uv = [], col = [], nor = [];
      for (const [x0, z0, r] of waterQuads) {
        const y = (r.floorY || 0) - (r.waterDrop ?? 0.3);
        const q = [[x0, z0], [x0, z0 + c], [x0 + c, z0 + c], [x0, z0], [x0 + c, z0 + c], [x0 + c, z0]];
        for (const [x, z] of q) { pos.push(x, y, z); uv.push(x / 4, z / 4); col.push(...(r.waterColor || [0.9, 1, 1])); nor.push(0, 1, 0); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      this.waterMat = mat({ map: tex('water'), transparent: true, opacity: 0.72, scroll: [0.03, 0.017], emissive: 0.35 });
      const m = new THREE.Mesh(geo, this.waterMat);
      m.renderOrder = 2;
      this.group.add(m);
    }
    return this.group;
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
  }
}
