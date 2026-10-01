// 2.5D world collision. Every solid is an oriented box: a rotated rectangle on the
// ground plane extruded from y0 to y1. That is enough for cars, barriers, seat
// tiers, platforms and walls, and keeps movement, camera rays, projectile hits and
// enemy navigation cheap. Pure JS so it runs under node tests.

import { VAULT, JUMP, MOVE } from '../config.js';

let nextId = 1;

export class Block {
  constructor(o) {
    this.id = nextId++;
    this.kind = o.kind || 'box';
    this.x = o.x; this.z = o.z;
    this.hw = o.w / 2; this.hd = o.d / 2;
    this.y0 = o.y0 || 0;
    this.y1 = this.y0 + o.h;
    this.setRot(o.rot || 0);
    const h = o.h, thin = Math.min(o.w, o.d);
    this.clutter = o.clutter ?? (this.y1 <= JUMP.autoHop && this.y0 < 0.1 && !o.wall);
    this.vault = o.vault ?? (!this.clutter && this.y0 < 0.1 && h >= VAULT.minH && h <= VAULT.maxH && thin <= VAULT.maxThick);
    this.hp = o.hp ?? null;
    this.maxHp = this.hp;
    this.cover = o.cover ?? this.y1 >= 1.05;
    this.wall = !!o.wall;
    this.solid = o.solid ?? true;
    this.dyn = !!o.dyn;
    this.camBlock = o.camBlock ?? (this.y1 > 1.9 && !this.clutter);
    this.shoot = o.shoot ?? !this.clutter;   // stops projectiles
    this.alive = true;
    this.data = o;
    this.meshes = null;
  }
  setRot(r) { this.rot = r; this.c = Math.cos(r); this.s = Math.sin(r); }
  toLocal(x, z) {
    const dx = x - this.x, dz = z - this.z;
    return [dx * this.c - dz * this.s, dx * this.s + dz * this.c];
  }
  radius() { return Math.hypot(this.hw, this.hd); }
  containsXZ(x, z, pad = 0) {
    const [lx, lz] = this.toLocal(x, z);
    return Math.abs(lx) <= this.hw + pad && Math.abs(lz) <= this.hd + pad;
  }
  // Push a circle out of the footprint. Returns world normal + penetration or null.
  pushCircle(x, z, r) {
    const [lx, lz] = this.toLocal(x, z);
    const cx = Math.max(-this.hw, Math.min(this.hw, lx));
    const cz = Math.max(-this.hd, Math.min(this.hd, lz));
    let dx = lx - cx, dz = lz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return null;
    let nx, nz, pen;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2);
      nx = dx / d; nz = dz / d; pen = r - d;
    } else {
      const px = this.hw - Math.abs(lx), pz = this.hd - Math.abs(lz);
      if (px < pz) { nx = lx < 0 ? -1 : 1; nz = 0; pen = px + r; } else { nx = 0; nz = lz < 0 ? -1 : 1; pen = pz + r; }
    }
    return { nx: nx * this.c + nz * this.s, nz: -nx * this.s + nz * this.c, pen };
  }
  pointInside(x, y, z, r = 0) {
    if (y < this.y0 - r || y > this.y1 + r) return false;
    return this.containsXZ(x, z, r);
  }
  // Ray (origin o, direction d, unnormalised ok) vs box. Returns {t, nx, ny, nz}.
  rayHit(ox, oy, oz, dx, dy, dz, maxT) {
    const rx = ox - this.x, rz = oz - this.z;
    const o = [rx * this.c - rz * this.s, oy, rx * this.s + rz * this.c];
    const d = [dx * this.c - dz * this.s, dy, dx * this.s + dz * this.c];
    const lo = [-this.hw, this.y0, -this.hd], hi = [this.hw, this.y1, this.hd];
    let tmin = 0, tmax = maxT, axis = -1, sign = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return null; continue; }
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i], sg = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sg = 1; }
      if (t1 > tmin) { tmin = t1; axis = i; sign = sg; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (axis === -1) return { t: 0, nx: 0, ny: 1, nz: 0 };
    const ln = [0, 0, 0]; ln[axis] = sign;
    return { t: tmin, nx: ln[0] * this.c + ln[2] * this.s, ny: ln[1], nz: -ln[0] * this.s + ln[2] * this.c };
  }
}

const CELL = 4;
const NAV = 0.8;

export class World {
  constructor(w, d) {
    this.w = w; this.d = d;
    this.blocks = [];
    this.dynamic = [];
    this.gx = Math.ceil((w + 8) / CELL); this.gz = Math.ceil((d + 8) / CELL);
    this.grid = null;
    this.navDirty = true;
    this.zones = [];      // non-solid floor zones: grease / sticky / hot
    this._stamp = 0;
  }

  add(o) {
    const b = o instanceof Block ? o : new Block(o);
    this.blocks.push(b);
    if (b.dyn) this.dynamic.push(b);
    this.grid = null;
    this.navDirty = true;
    return b;
  }
  remove(b) {
    b.alive = false;
    this.blocks = this.blocks.filter((x) => x !== b);
    this.dynamic = this.dynamic.filter((x) => x !== b);
    this.grid = null;
    this.navDirty = true;
  }

  _buildGrid() {
    this.grid = Array.from({ length: this.gx * this.gz }, () => []);
    for (const b of this.blocks) {
      if (b.dyn) continue;
      const r = b.radius();
      const [x0, z0] = this._cell(b.x - r, b.z - r), [x1, z1] = this._cell(b.x + r, b.z + r);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) this.grid[j * this.gx + i].push(b);
    }
  }
  _cell(x, z) {
    return [
      Math.max(0, Math.min(this.gx - 1, Math.floor((x + this.w / 2 + 4) / CELL))),
      Math.max(0, Math.min(this.gz - 1, Math.floor((z + this.d / 2 + 4) / CELL))),
    ];
  }
  // Blocks whose cells overlap the query square. Each block reported once.
  near(x, z, r, out = []) {
    if (!this.grid) this._buildGrid();
    out.length = 0;
    const stamp = ++this._stamp;
    const [x0, z0] = this._cell(x - r, z - r), [x1, z1] = this._cell(x + r, z + r);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      for (const b of this.grid[j * this.gx + i]) if (b._s !== stamp) { b._s = stamp; out.push(b); }
    }
    for (const b of this.dynamic) out.push(b);
    return out;
  }

  // Highest standable surface under (x,z) that is not above y + stepUp.
  groundAt(x, z, y, r = 0.3, stepUp = MOVE.stepUp) {
    let best = 0, block = null;
    for (const b of this.near(x, z, r + 0.1, this._tmp || (this._tmp = []))) {
      if (!b.alive || !b.solid) continue;
      if (b.y1 > y + stepUp + 1e-4 || b.y1 <= best) continue;
      if (b.containsXZ(x, z, r * 0.55)) { best = b.y1; block = b; }
    }
    return { h: best, block };
  }
  // Highest top at a point regardless of height (navigation heights).
  topAt(x, z, pad = 0, ignoreClutter = true) {
    let best = 0;
    for (const b of this.near(x, z, pad + 0.1, this._tmp2 || (this._tmp2 = []))) {
      if (!b.alive || !b.solid || (ignoreClutter && b.clutter) || b.dyn) continue;
      if (b.y1 > best && b.y0 < 0.5 && b.containsXZ(x, z, pad)) best = b.y1;
    }
    return best;
  }

  // Resolve a vertical capsule (feet at p.y) against walls. Mutates p. Returns contacts.
  collide(p, r, height, opts = {}) {
    const contacts = [];
    const stepUp = opts.stepUp ?? MOVE.stepUp;
    const list = this.near(p.x, p.z, r + 0.2, this._tmp3 || (this._tmp3 = []));
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (const b of list) {
        if (!b.alive || !b.solid) continue;
        if (opts.ignoreClutter && b.clutter) continue;
        if (opts.ignore && opts.ignore(b)) continue;
        if (b.y1 <= p.y + stepUp || b.y0 >= p.y + height) continue;
        const hit = b.pushCircle(p.x, p.z, r);
        if (!hit) continue;
        p.x += hit.nx * hit.pen; p.z += hit.nz * hit.pen;
        if (pass === 0 || !contacts.some((c) => c.block === b)) contacts.push({ nx: hit.nx, nz: hit.nz, block: b });
        any = true;
      }
      if (!any) break;
    }
    // room bounds (safety net behind the wall blocks)
    const hx = this.w / 2 + 1.5, hz = this.d / 2 + 1.5;
    if (!opts.noBounds) { p.x = Math.max(-hx, Math.min(hx, p.x)); p.z = Math.max(-hz, Math.min(hz, p.z)); }
    return contacts;
  }

  raycast(ox, oy, oz, dx, dy, dz, maxT, filter) {
    let best = null;
    // coarse: all blocks (rooms hold < 200 solids; cheap enough and exact)
    for (const b of this.blocks) {
      if (!b.alive || !b.solid || (filter && !filter(b))) continue;
      const h = b.rayHit(ox, oy, oz, dx, dy, dz, best ? best.t : maxT);
      if (h && (!best || h.t < best.t)) { best = h; best.block = b; }
    }
    return best;
  }
  losClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    return !this.raycast(ax, ay, az, dx, dy, dz, 1, (b) => b.shoot && !b.clutter);
  }
  projectileBlock(x, y, z, r) {
    for (const b of this.near(x, z, r + 0.1, this._tmp4 || (this._tmp4 = []))) {
      if (b.alive && b.solid && b.shoot && b.pointInside(x, y, z, r * 0.5)) return b;
    }
    if (y < -0.2) return 'floor';
    return null;
  }

  // -------------------------------------------------------------------------
  // Navigation: height grid + Dijkstra flow field toward a target.
  // -------------------------------------------------------------------------
  buildNav() {
    this.navDirty = false;
    const cols = Math.ceil(this.w / NAV), rows = Math.ceil(this.d / NAV);
    this.nav = { cols, rows, h: new Float32Array(cols * rows), dist: new Float64Array(cols * rows).fill(Infinity), tx: 0, tz: 0 };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const [x, z] = this.cellCenter(i, j);
      this.nav.h[j * cols + i] = this.topAt(x, z, 0.32);
    }
  }
  cellCenter(i, j) { return [-this.w / 2 + (i + 0.5) * NAV, -this.d / 2 + (j + 0.5) * NAV]; }
  cellOf(x, z) {
    const n = this.nav;
    const i = Math.floor((x + this.w / 2) / NAV), j = Math.floor((z + this.d / 2) / NAV);
    if (i < 0 || j < 0 || i >= n.cols || j >= n.rows) return -1;
    return j * n.cols + i;
  }
  walkable(c) { return c >= 0 && this.nav.h[c] < 2.6; }
  _edge(a, b) { const h = this.nav.h; return h[b] < 2.6 && Math.abs(h[a] - h[b]) <= 0.55; }

  flowTo(x, z, y = 0) {
    if (this.navDirty || !this.nav) this.buildNav();
    const n = this.nav, { cols, rows } = n;
    const dist = n.dist;
    dist.fill(Infinity);
    n.tx = x; n.tz = z;
    const heap = [];
    const push = (c, d) => { heap.push([d, c]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], lastE = heap.pop(); if (heap.length) { heap[0] = lastE; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    // Seed: target cell, or every walkable cell near the target (target on a car roof etc.)
    const tc = this.cellOf(x, z);
    if (tc >= 0 && this.walkable(tc) && Math.abs(n.h[tc] - y) < 1.2) { dist[tc] = 0; push(tc, 0); } else {
      const ti = Math.floor((x + this.w / 2) / NAV), tj = Math.floor((z + this.d / 2) / NAV);
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const i = ti + di, j = tj + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const c = j * cols + i;
        if (!this.walkable(c)) continue;
        const d0 = Math.hypot(di, dj) * 0.5;
        if (d0 < dist[c]) { dist[c] = d0; push(c, d0); }
      }
    }
    const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      const [d, c] = pop();
      if (d > dist[c]) continue;
      const i = c % cols, j = (c / cols) | 0;
      for (let k = 0; k < 8; k++) {
        const ni = i + DI[k], nj = j + DJ[k];
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nc = nj * cols + ni;
        if (!this._edge(c, nc)) continue;
        if (k >= 4 && (!this._edge(c, nj * cols + i) || !this._edge(c, j * cols + ni))) continue;
        const nd = d + (k >= 4 ? 1.414 : 1);
        if (nd < dist[nc]) { dist[nc] = nd; push(nc, nd); }
      }
    }
  }

  // Direction (unit xz) an actor at (x,z) should walk to follow the flow field.
  flowDir(x, z) {
    const n = this.nav;
    if (!n) return null;
    const c = this.cellOf(x, z);
    if (c < 0) return null;
    const { cols, rows, dist } = n;
    const i = c % cols, j = (c / cols) | 0;
    let best = dist[c], bi = -1, bj = -1;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const nc = nj * cols + ni;
      if (dist[nc] < best - 1e-4) { best = dist[nc]; bi = ni; bj = nj; }
    }
    if (bi < 0) return null;
    const [cx, cz] = this.cellCenter(bi, bj);
    const dx = cx - x, dz = cz - z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l, dist[c]];
  }

  // Random walkable floor point, away from `avoid` points.
  // Like openPoint, but sampled within rmax of (cx, cz).
  openPointNear(rng, cx, cz, rmax, avoid = [], maxH = 0.6) {
    if (this.navDirty || !this.nav) this.buildNav();
    const n = this.nav;
    for (let tries = 0; tries < 120; tries++) {
      const a = rng() * Math.PI * 2, r = rmax * Math.sqrt(rng());
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (Math.abs(x) > this.w / 2 - 1.5 || Math.abs(z) > this.d / 2 - 1.5) continue;
      const c = this.cellOf(x, z);
      if (c < 0 || n.h[c] > maxH) continue;
      if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < (p.r ?? 1))) continue;
      return { x, z, y: n.h[c] };
    }
    return null;
  }
  openPoint(rng, avoid = [], minDist = 6, maxH = 0.6, margin = 2.5) {
    if (this.navDirty || !this.nav) this.buildNav();
    const n = this.nav;
    for (let tries = 0; tries < 400; tries++) {
      const x = rng.range(-this.w / 2 + margin, this.w / 2 - margin);
      const z = rng.range(-this.d / 2 + margin, this.d / 2 - margin);
      const c = this.cellOf(x, z);
      if (c < 0 || n.h[c] > maxH) continue;
      // require clearance: neighbours walkable at the same height
      const i = c % n.cols, j = (c / n.cols) | 0;
      let ok = true;
      for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n.cols || nj >= n.rows) { ok = false; break; }
        if (Math.abs(n.h[nj * n.cols + ni] - n.h[c]) > 0.3) { ok = false; break; }
      }
      if (!ok) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < (a.r ?? minDist))) continue;
      return { x, z, y: n.h[c] };
    }
    return null;
  }

  zoneAt(x, z) {
    for (const zn of this.zones) {
      if (zn.shape === 'circle' ? Math.hypot(x - zn.x, z - zn.z) < zn.r : Math.abs(x - zn.x) < zn.w / 2 && Math.abs(z - zn.z) < zn.d / 2) return zn;
    }
    return null;
  }
}
