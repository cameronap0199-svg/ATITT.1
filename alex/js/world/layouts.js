// Room layouts: 3 floors × 5 room types × 5 layouts = 75 procedural pool entries,
// plus the special rooms (start, Gas Station, Lost & Found, bathroom, bosses).
// A layout is pure data: blocks (oriented boxes with a visual model), hazards, floor
// zones, decor and floor paint. world/builder.js turns it into meshes + collision.

export const ROOM_TYPES = {
  1: { A: 'Parking Lot', B: 'Tailgate', C: 'Security', D: 'Exterior Vendor', E: 'Entrance Hall' },
  2: { A: 'Concourse', B: 'Merch', C: 'Food Court', D: 'Seating', E: 'Restricted Access' },
  3: { A: 'Backstage', B: 'Production', C: 'Stage Equipment', D: 'Stage Access', E: 'The Performance' },
};

const CAR_COLORS = ['#ece7de', '#2b2d42', '#d64550', '#3a86ff', '#8ecae6', '#ffb703', '#6a994e', '#9d4edd', '#adb5bd', '#f28482'];
const TENT_COLORS = ['#ff5d8f', '#4cc9f0', '#ffd166', '#06d6a0', '#b5179e', '#f77f00'];

// ---------------------------------------------------------------------------
// Layout builder
// ---------------------------------------------------------------------------
export function makeBuilder(w, d, rng) {
  const L = { w, d, blocks: [], hazards: [], zones: [], decor: [], paint: [], lights: [], mimicSpots: [], budgetAdd: 0, waves: null };
  const box = (o) => { L.blocks.push(o); return o; };
  const b = {
    L, rng, w, d,
    box,
    car(x, z, rot = 0, color) {
      return box({ model: 'car', x, z, w: 1.95, d: 4.4, h: 1.45, rot, color: color || rng.pick(CAR_COLORS), hp: 90, cover: true });
    },
    carRow(x0, x1, z, { gap = 0.2, spacing = 2.75, flip = false, paint = true } = {}) {
      for (let x = x0; x <= x1 + 1e-6; x += spacing) {
        if (paint) L.paint.push({ kind: 'stall', x, z, w: spacing, d: 5 });
        if (!rng.chance(gap)) b.car(x + rng.range(-0.15, 0.15), z + rng.range(-0.25, 0.25), (flip ? Math.PI : 0) + rng.range(-0.05, 0.05));
      }
    },
    bus(x, z, rot = 0) { return box({ model: 'bus', x, z, w: 2.8, d: 12, h: 3.4, rot, color: '#ff4fa3', hp: null, vault: false }); },
    truck(x, z, rot = 0, color = '#f4f1de') { return box({ model: 'truck', x, z, w: 2.6, d: 7, h: 3.2, rot, color, vault: false }); },
    barrier(x, z, len = 3, rot = 0) { return box({ model: 'barrier', x, z, w: 0.7, d: len, h: 0.95, rot, color: '#d9d9d9' }); },
    fence(x, z, len, rot = 0, h = 1.1) { return box({ model: 'rail', x, z, w: 0.15, d: len, h, rot, color: '#9aa5b1', camBlock: false }); },
    rail(x, z, len, rot = 0) { return box({ model: 'rail', x, z, w: 0.15, d: len, h: 1.05, rot, color: '#c0c7cf', camBlock: false }); },
    tent(x, z, s = 3.2, color) { return box({ model: 'tent', x, z, w: s, d: s, h: 2.6, color: color || rng.pick(TENT_COLORS), hp: 30, vault: false }); },
    table(x, z, rot = 0, len = 2.2) { return box({ model: 'table', x, z, w: 0.9, d: len, h: 0.8, rot, color: '#e9e3d5' }); },
    chair(x, z, rot = 0) { return box({ model: 'chair', x, z, w: 0.55, d: 0.55, h: 0.55, rot, color: rng.pick(['#3a86ff', '#e63946', '#2a9d8f', '#f4a261']) }); },
    cooler(x, z, rot = 0) { return box({ model: 'cooler', x, z, w: 0.6, d: 0.95, h: 0.55, rot, color: rng.pick(['#e63946', '#3a86ff', '#f1faee']) }); },
    speaker(x, z, rot = 0, h = 1.7) { return box({ model: 'speaker', x, z, w: 1.1, d: 1.0, h, rot, color: '#1b1b22', hp: 40 }); },
    pillar(x, z, s = 1.2, h = 5, color = '#bfc5cc') { return box({ model: 'pillar', x, z, w: s, d: s, h, color, vault: false }); },
    wall(x1, z1, x2, z2, h = 3.2, t = 0.4, color = '#7d7f91', model = 'wall') {
      const len = Math.hypot(x2 - x1, z2 - z1);
      return box({ model, x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: t, d: len, h, rot: Math.atan2(x2 - x1, z2 - z1), color, vault: h <= 1.9 ? undefined : false });
    },
    block(x, z, w, d, h, color = '#7d7f91', model = 'block', extra = {}) { return box({ model, x, z, w, d, h, color, ...extra }); },
    platform(x, z, w, d, h, color = '#6c7086') { return box({ model: 'platform', x, z, w, d, h, color, vault: false, keep: true }); },
    stairs(x, z, rot, width, rise, run, n, y0 = 0, color = '#8d93a8') {
      // steps climb along local +z
      const c = Math.cos(rot), s = Math.sin(rot);
      for (let k = 0; k < n; k++) {
        const lz = (k + 0.5) * run - (n * run) / 2;
        box({ model: 'step', x: x + lz * s, z: z + lz * c, w: width, d: run + 0.02, h: y0 + (k + 1) * rise, rot, color, vault: false, clutter: false, keep: true });
      }
    },
    rack(x, z, rot = 0, len = 2.4) { return box({ model: 'rack', x, z, w: 0.7, d: len, h: 1.75, rot, color: '#c9c9d4', hp: 22, vault: false }); },
    shelf(x, z, rot = 0, len = 5, h = 2.6, color = '#5c677d') { return box({ model: 'shelf', x, z, w: 1.0, d: len, h, rot, color, vault: false }); },
    counter(x, z, rot = 0, len = 3, color = '#e0c9a6') { return box({ model: 'counter', x, z, w: 0.9, d: len, h: 1.0, rot, color }); },
    stall(x, z, rot = 0, color, label = '') { return box({ model: 'stall', x, z, w: 3.2, d: 2.4, h: 2.6, rot, color: color || rng.pick(TENT_COLORS), label, vault: false }); },
    toilet(x, z, rot = 0) { return box({ model: 'toilet', x, z, w: 1.5, d: 1.5, h: 2.4, rot, color: rng.pick(['#4895ef', '#43aa8b', '#f9844a']), hp: 45, vault: false }); },
    turnstile(x, z, rot = 0) { return box({ model: 'turnstile', x, z, w: 0.5, d: 1.2, h: 0.98, rot, color: '#adb5bd' }); },
    detector(x, z, rot = 0) {
      box({ model: 'detpost', x: x - Math.cos(rot) * 0.9, z: z + Math.sin(rot) * 0.9, w: 0.3, d: 0.6, h: 2.3, rot, color: '#8d99ae', vault: false });
      box({ model: 'detpost', x: x + Math.cos(rot) * 0.9, z: z - Math.sin(rot) * 0.9, w: 0.3, d: 0.6, h: 2.3, rot, color: '#8d99ae', vault: false });
      L.decor.push({ kind: 'detbar', x, z, rot });
    },
    planter(x, z, s = 2.2) { return box({ model: 'planter', x, z, w: s, d: s, h: 0.8, color: '#9c6644' }); },
    crate(x, z, s = 1.2, h = 1.2, rot = 0) { return box({ model: 'crate', x, z, w: s, d: s, h, rot, color: '#b08968', hp: h < 1.3 ? 25 : null }); },
    roadcase(x, z, rot = 0, len = 1.8) { return box({ model: 'roadcase', x, z, w: 0.9, d: len, h: 1.15, rot, color: '#22223b', hp: 40 }); },
    couch(x, z, rot = 0, color = '#9d4edd') { return box({ model: 'couch', x, z, w: 1.0, d: 2.4, h: 0.85, rot, color }); },
    mannequin(x, z) { return box({ model: 'mannequin', x, z, w: 0.5, d: 0.5, h: 0.65, color: '#f1e3d3', hp: 8 }); },
    cable(x, z, rot = 0, len = 3) { return box({ model: 'cable', x, z, w: 0.35, d: len, h: 0.25, rot, color: '#111' }); },
    truss(x, z, rot = 0, len = 6, h = 0.6) { return box({ model: 'truss', x, z, w: 0.6, d: len, h, rot, color: '#b8c0cc' }); },
    desk(x, z, rot = 0) { return box({ model: 'desk', x, z, w: 1.0, d: 2.0, h: 0.85, rot, color: '#8d6e63' }); },
    cabinet(x, z, rot = 0) { return box({ model: 'cabinet', x, z, w: 0.9, d: 1.6, h: 2.2, rot, color: '#495057', vault: false }); },
    console(x, z, rot = 0, len = 3) { return box({ model: 'console', x, z, w: 1.2, d: len, h: 1.0, rot, color: '#343a40' }); },
    vanity(x, z, rot = 0) { return box({ model: 'vanity', x, z, w: 0.8, d: 2.2, h: 0.9, rot, color: '#f8edeb' }); },
    fountain(x, z, rot = 0) { return box({ model: 'fountain', x, z, w: 1.2, d: 2.4, h: 1.2, rot, color: '#adb5bd' }); },
    grill(x, z, period = 4.5, offset = 0) {
      box({ model: 'grill', x, z, w: 1.3, d: 0.8, h: 1.0, color: '#2b2d42' });
      L.hazards.push({ type: 'grill', x, z, period, offset });
    },
    stanchion(x, z) { return box({ model: 'stanchion', x, z, w: 0.3, d: 0.3, h: 0.95, color: '#d4af37', clutter: true }); },
    kiosk(x, z, rot = 0, label = '') { return box({ model: 'kiosk', x, z, w: 1.2, d: 1.2, h: 1.9, rot, color: '#3a0ca3', label, vault: false }); },
    bigProp(x, z, kind, s = 2.4) { return box({ model: kind, x, z, w: s, d: s * 0.5, h: s, color: kind === 'bigheart' ? '#ff4d8d' : '#ffd166', hp: 50, vault: false }); },
    seats(x, z, len, rot = 0, y0 = 0) { return box({ model: 'seatrow', x, z, w: len, d: 0.6, h: 0.5, y0, rot, color: '#c1121f', clutter: true, vault: true }); },
    // A seating bowl: tiers stepping up away from (x,z) along local +z.
    tiers(x, z, width, rot, n, rise = 0.45, run = 1.6, seats = true) {
      const c = Math.cos(rot), s = Math.sin(rot);
      for (let k = 0; k < n; k++) {
        const lz = k * run + run / 2;
        const tx = x + lz * s, tz = z + lz * c;
        const top = (k + 1) * rise;
        box({ model: 'tier', x: tx, z: tz, w: width, d: run + 0.02, h: top, rot, color: k % 2 ? '#3d405b' : '#43466a', vault: false, keep: true });
        if (!seats) continue;
        // seat rows with an aisle every ~7 m; Alex hops them, enemies climb them
        const segs = Math.max(1, Math.round(width / 7)), segLen = width / segs;
        for (let q = 0; q < segs; q++) {
          const lx = -width / 2 + segLen * (q + 0.5), off = run * 0.15;
          box({ model: 'seatrow', x: tx + lx * c + off * s, z: tz - lx * s + off * c, w: segLen - 1.4, d: 0.55, h: 0.5, y0: top, rot, color: '#c1121f', vault: true, clutter: true });
        }
      }
    },
    hazard(o) { L.hazards.push(o); },
    zone(o) { L.zones.push(o); },
    decor(o) { L.decor.push(o); },
    paint(o) { L.paint.push(o); },
    light(x, y, z, color, intensity = 1.2, dist = 16) { L.lights.push({ x, y, z, color, intensity, dist }); },
    mimic(x, z, rot = 0) { L.mimicSpots.push({ x, z, rot }); },
  };
  return b;
}

const lay = (key, name, w, d, build, extra = {}) => ({ key, name, w, d, build, ...extra });

// Door approach areas are kept clear of props after generation.
export function clearDoors(L, sides) {
  const pts = {
    N: [0, -L.d / 2], S: [0, L.d / 2], W: [-L.w / 2, 0], E: [L.w / 2, 0],
  };
  const keep = [];
  for (const b of L.blocks) {
    let bad = false;
    for (const s of sides) {
      const [dx, dz] = pts[s];
      const inward = s === 'N' ? [0, 1] : s === 'S' ? [0, -1] : s === 'W' ? [1, 0] : [-1, 0];
      // corridor 4 m wide, 5.5 m deep from the wall
      for (let k = 0; k <= 5.5; k += 0.5) {
        const px = dx + inward[0] * k, pz = dz + inward[1] * k;
        const r = Math.hypot(b.w, b.d) / 2;
        if (Math.hypot(px - b.x, pz - b.z) > r + 2.2) continue;
        const c = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0);
        const lx = (px - b.x) * c - (pz - b.z) * sn, lz = (px - b.x) * sn + (pz - b.z) * c;
        if (Math.abs(lx) < b.w / 2 + 1.9 && Math.abs(lz) < b.d / 2 + 1.9) { bad = true; break; }
      }
      if (bad) break;
    }
    if (!bad || (b.keep && !b._doorSensitive)) keep.push(b);
  }
  L.blocks = keep;
  L.mimicSpots = L.mimicSpots.filter((m) => !sides.some((s) => {
    const [dx, dz] = pts[s];
    return Math.hypot(m.x - dx, m.z - dz) < 7;
  }));
}

// ---------------------------------------------------------------------------
// FLOOR 1 — THE ARRIVAL
// ---------------------------------------------------------------------------
const F1 = {
  A: [
    lay('f1a1', 'Parking Lanes', 36, 30, (b) => {
      b.carRow(-15, 15, -9, { gap: 0.2 });
      b.carRow(-13.5, 13.5, 0.2, { gap: 0.35, flip: true });
      b.carRow(-15, 15, 9, { gap: 0.2, flip: true });
      b.decor({ kind: 'lamp', x: -8, z: -4.5 }); b.decor({ kind: 'lamp', x: 8, z: 4.5 });
      b.paint({ kind: 'arrow', x: 0, z: -4.5, rot: Math.PI / 2 }); b.paint({ kind: 'arrow', x: 0, z: 4.5, rot: -Math.PI / 2 });
    }, { floor: 'asphalt' }),
    lay('f1a2', 'Four-Way Lot', 36, 36, (b) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          if (b.rng.chance(0.2)) continue;
          b.car(sx * (6 + i * 2.75), sz * (6.5 + j * 5), j ? Math.PI : 0);
        }
        b.decor({ kind: 'lamp', x: sx * 4.5, z: sz * 4.5 });
      }
      b.paint({ kind: 'cross', x: 0, z: 0 });
    }, { floor: 'asphalt' }),
    lay('f1a3', 'Double Row', 40, 28, (b) => {
      b.carRow(-13, 13, 0, { gap: 0, spacing: 2.6 });
      b.carRow(-16, 16, -11, { gap: 0.3 });
      b.carRow(-16, 16, 11, { gap: 0.3, flip: true });
      b.paint({ kind: 'arrow', x: -6, z: -5.5, rot: Math.PI / 2 }); b.paint({ kind: 'arrow', x: 6, z: 5.5, rot: -Math.PI / 2 });
      b.decor({ kind: 'lamp', x: -18, z: 0 }); b.decor({ kind: 'lamp', x: 18, z: 0 });
    }, { floor: 'asphalt' }),
    lay('f1a4', 'Shopping Cart Hell', 34, 34, (b) => {
      for (const [x, z, r] of [[-9, -8, 0], [9, 8, 0], [-9, 9, Math.PI / 2], [10, -9, Math.PI / 2]]) {
        b.box({ model: 'corral', x, z, w: 1.6, d: 4, h: 1.0, rot: r, color: '#9aa5b1' });
      }
      b.car(-3, -12, 0.3); b.car(4, 12, -0.2);
      b.hazard({ type: 'carts', n: 6 });
      b.decor({ kind: 'sign', x: 0, z: -16.2, text: 'RETURN YOUR CARTS' });
    }, { floor: 'asphalt' }),
    lay('f1a5', 'The Bad Parking Job', 36, 32, (b) => {
      const pts = [];
      for (let i = 0; i < 40 && pts.length < 13; i++) {
        const x = b.rng.range(-14, 14), z = b.rng.range(-12, 12);
        if (Math.hypot(x, z) < 3.5 || pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < 5)) continue;
        pts.push([x, z]);
        b.car(x, z, b.rng.range(0, Math.PI));
      }
      b.decor({ kind: 'sign', x: 0, z: -16.2, text: 'COMPACT ONLY' });
      b.decor({ kind: 'lamp', x: 0, z: 0 });
    }, { floor: 'asphalt' }),
  ],
  B: [
    lay('f1b1', 'Circle of Cars', 38, 38, (b) => {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.14;
        if (i % 4 === 3) continue;
        b.car(Math.sin(a) * 10.5, Math.cos(a) * 10.5, a + Math.PI / 2);
      }
      b.cooler(0, 1.5); b.table(2, -1, 0.3); b.decor({ kind: 'bonfire', x: 0, z: 0 });
      b.L.spawnOutside = 12;
    }, { floor: 'asphalt' }),
    lay('f1b2', 'Tent Maze', 36, 34, (b) => {
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if ((i + j) % 2 === 0 && b.rng.chance(0.75) && !(i === 0 && j === 0)) b.tent(i * 6.2 + b.rng.range(-0.4, 0.4), j * 5.8, 3.4);
        else if (b.rng.chance(0.4)) b.table(i * 6.2, j * 5.8, b.rng.range(0, 3));
      }
    }, { floor: 'grass' }),
    lay('f1b3', 'Grill Alley', 38, 26, (b) => {
      for (let i = 0; i < 5; i++) {
        const x = -14 + i * 7;
        b.grill(x, -5, 4.6, i * 0.9);
        b.grill(x + 3.5, 5, 4.6, i * 0.9 + 2.3);
        b.table(x + 1.8, -8.5, Math.PI / 2, 2.4);
        b.table(x + 1.6, 8.5, Math.PI / 2, 2.4);
      }
      b.decor({ kind: 'smoke', x: 0, z: 0 });
    }, { floor: 'asphalt' }),
    lay('f1b4', 'Party Bus', 40, 30, (b) => {
      b.bus(0, 0, 0);
      b.cooler(-5, -6); b.cooler(5, 7); b.cooler(-6, 8);
      b.speaker(-3.5, -9, 0.3); b.speaker(3.5, 9, -2.8);
      b.table(-9, 3, 0); b.table(9, -3, 0);
      b.decor({ kind: 'balloons', x: -1.8, z: -6.5 }); b.decor({ kind: 'balloons', x: 1.8, z: 6.5 });
    }, { floor: 'asphalt' }),
    lay('f1b5', 'Mega Tailgate', 40, 36, (b) => {
      for (let i = 0; i < 26; i++) {
        const x = b.rng.range(-17, 17), z = b.rng.range(-15, 15);
        if (Math.hypot(x, z) < 3) continue;
        const r = b.rng.range(0, Math.PI);
        const k = b.rng();
        if (k < 0.3) b.cooler(x, z, r); else if (k < 0.55) b.chair(x, z, r); else if (k < 0.8) b.table(x, z, r); else b.speaker(x, z, r, 1.5);
      }
      b.tent(-12, -10, 3.6); b.tent(12, 10, 3.6);
    }, { floor: 'grass' }),
  ],
  C: [
    lay('f1c1', 'Metal Detector Lanes', 34, 30, (b) => {
      for (let i = -3; i <= 3; i++) {
        const x = i * 4.2;
        b.detector(x, 0, 0);
        b.hazard({ type: 'zapGate', x, z: 0, period: 3.2, offset: (i + 3) * 0.45 });
        if (i < 3) b.barrier(x + 2.1, 0, 2.2, Math.PI / 2);
      }
      b.table(-10, -8, Math.PI / 2, 3); b.table(10, 8, Math.PI / 2, 3);
    }, { floor: 'plaza' }),
    lay('f1c2', 'Barricade Zigzag', 36, 32, (b) => {
      for (let k = -2; k <= 2; k++) {
        const z = k * 5.5;
        const off = k % 2 === 0 ? -3 : 3;
        for (let x = -15; x <= 15; x += 3.1) if (Math.abs(x - off) > 2.2) b.barrier(x, z, 3, Math.PI / 2);
      }
    }, { floor: 'plaza' }),
    lay('f1c3', 'Bag Check', 32, 30, (b) => {
      for (let r = -1; r <= 1; r++) for (let c = -2; c <= 2; c++) {
        if (b.rng.chance(0.15)) continue;
        b.table(c * 5.5, r * 7, Math.PI / 2, 3.2);
        b.box({ model: 'bin', x: c * 5.5 + 1.8, z: r * 7 + 0.9, w: 0.6, d: 0.6, h: 0.5, color: '#6c757d' });
      }
      b.decor({ kind: 'sign', x: 0, z: -15.2, text: 'CLEAR BAGS ONLY' });
    }, { floor: 'plaza' }),
    lay('f1c4', 'Ticket Scanner Gauntlet', 40, 24, (b) => {
      for (let i = -3; i <= 3; i++) {
        b.kiosk(i * 5, -7.5, 0, 'SCAN'); b.kiosk(i * 5 + 2.5, 7.5, Math.PI, 'SCAN');
      }
      b.hazard({ type: 'lasers', axis: 'x', lines: [-14, -7, 0, 7, 14], period: 3.4, width: 1.3 });
    }, { floor: 'plaza' }),
    lay('f1c5', 'Security Funnel', 36, 34, (b) => {
      for (let k = 0; k < 6; k++) {
        const t = k / 5;
        b.barrier(-14 + t * 10, -12 + t * 18, 3, -0.55);
        b.barrier(14 - t * 10, -12 + t * 18, 3, 0.55);
      }
      b.table(-12, 10, 0.2); b.table(12, 10, -0.2);
      b.decor({ kind: 'sign', x: 0, z: 17.2, text: 'SINGLE FILE PLEASE' });
    }, { floor: 'plaza' }),
  ],
  D: [
    lay('f1d1', 'Bootleg Shirt Stand', 26, 24, (b) => {
      b.stall(0, -6.5, 0, '#ff5d8f', 'OFFICIAL* MERCH');
      b.rack(-5.5, -3, 0.3); b.rack(5.5, -3, -0.3); b.rack(-7, 4, 1.2); b.rack(7, 4, -1.2);
      b.mimic(3, 5, 0);
    }, { floor: 'asphalt', reward: 'money', small: true }),
    lay('f1d2', 'Food Truck Alley', 30, 24, (b) => {
      b.truck(-8, -3, 0, '#ffd166'); b.truck(8, 3, Math.PI, '#06d6a0');
      b.table(0, -6, 0.2); b.table(1, 6, -0.2); b.chair(-1.5, -5, 0); b.chair(2.5, 5, 0);
      b.decor({ kind: 'sign', x: -8, z: -7.2, text: 'TTEOKBOKKI' });
    }, { floor: 'asphalt', reward: 'food', small: true }),
    lay('f1d3', 'Lightstick Vendor', 24, 24, (b) => {
      b.stall(0, 0, 0, '#7b2cbf', 'LIGHTSTICKS 50% OFF');
      b.cooler(-5, 6); b.cooler(5, -6);
      b.decor({ kind: 'lightsticks', x: 0, z: 0 });
      b.mimic(-6, -4, 0.5);
    }, { floor: 'asphalt', reward: 'consumable', small: true }),
    lay('f1d4', 'Scalper Corner', 26, 24, (b) => {
      b.car(-6, -6, 0.5, '#111111'); b.car(6.5, 5, -0.4, '#111111');
      b.box({ model: 'scalper', x: -2, z: -7, w: 0.6, d: 0.6, h: 1.8, color: '#333', vault: false });
      b.planter(6, -6, 1.8); b.planter(-7, 6, 1.8);
    }, { floor: 'asphalt', reward: 'scalper', small: true }),
    lay('f1d5', 'Portable Toilet Kingdom', 28, 26, (b) => {
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) {
        if ((i + j * 3) % 3 === 0 || b.rng.chance(0.35)) continue;
        if (Math.abs(i) < 1 && Math.abs(j) < 1) continue;
        b.toilet(i * 3.6, j * 4.4, b.rng.pick([0, Math.PI / 2, Math.PI]));
      }
    }, { floor: 'grass', reward: 'toilet', small: true }),
  ],
  E: [
    lay('f1e1', 'Grand Entrance', 44, 32, (b) => {
      for (const x of [-16, -8, 8, 16]) { b.planter(x, -12, 2.4); b.planter(x, 12, 2.4); }
      b.decor({ kind: 'arch', x: 0, z: -15.6, text: 'WELCOME, DEMON HUNTERS (NOT WELCOME)' });
      b.decor({ kind: 'banner', x: -12, z: 0 }); b.decor({ kind: 'banner', x: 12, z: 0 });
    }, { floor: 'lobby', walls: 'building' }),
    lay('f1e2', 'Turnstile Grid', 36, 32, (b) => {
      for (let r = -1; r <= 1; r++) for (let c = -7; c <= 7; c++) {
        if (c % 3 === 0) continue;
        b.turnstile(c * 2.1, r * 7.5, 0);
      }
    }, { floor: 'lobby', walls: 'building' }),
    lay('f1e3', 'Ticket Lobby', 38, 34, (b) => {
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if ((i === 0 && j === 0) || b.rng.chance(0.15)) continue;
        b.pillar(i * 6.5 + (j % 2 ? 1.6 : 0), j * 6, 1.4, 5.5);
      }
      b.counter(-14, -12, 0, 5); b.counter(14, -12, 0, 5);
    }, { floor: 'lobby', walls: 'building' }),
    lay('f1e4', 'Escalator Hall', 40, 34, (b) => {
      b.platform(-11.5, -11, 17, 12, 2.7); b.platform(11.5, -11, 17, 12, 2.7);
      b.rail(-13.5, -4.95, 13, Math.PI / 2).y0 = 2.7; b.rail(13.5, -4.95, 13, Math.PI / 2).y0 = 2.7;
      b.stairs(-5.4, -1.7, Math.PI, 2.2, 0.45, 0.9, 6);
      b.stairs(5.4, -1.7, Math.PI, 2.2, 0.45, 0.9, 6);
      b.planter(-10, 8, 2.2); b.planter(10, 8, 2.2);
    }, { floor: 'lobby', walls: 'building' }),
    lay('f1e5', 'VIP Entrance', 26, 24, (b) => {
      for (let x = -9; x <= 9; x += 2) { b.stanchion(x, -4); b.stanchion(x, 4); }
      b.decor({ kind: 'velvet', x: 0, z: -4, len: 18 }); b.decor({ kind: 'velvet', x: 0, z: 4, len: 18 });
      b.couch(-9, -9, Math.PI / 2, '#b5179e'); b.couch(9, 9, Math.PI / 2, '#b5179e');
      b.L.budgetAdd = 1;
    }, { floor: 'carpet', walls: 'building', small: true }),
  ],
};

// ---------------------------------------------------------------------------
// FLOOR 2 — THE VENUE
// ---------------------------------------------------------------------------
const F2 = {
  A: [
    lay('f2a1', 'Circular Concourse', 38, 38, (b) => {
      b.block(0, 0, 13, 13, 4, '#6b705c', 'core');
      for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) b.pillar(x, z, 1.4, 5);
      b.kiosk(-9, 0, Math.PI / 2, 'INFO'); b.kiosk(9, 0, -Math.PI / 2, 'SNACKS');
    }, { floor: 'concrete' }),
    lay('f2a2', 'Four-Way Junction', 38, 38, (b) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(sx * 12.5, sz * 12.5, 13, 13, 4, '#5a5f73', 'block');
      b.decor({ kind: 'sign', x: 0, z: -6.2, text: 'SECTIONS 101–120 →' });
    }, { floor: 'concrete' }),
    lay('f2a3', 'Escalator Crossing', 40, 32, (b) => {
      b.platform(-13, -9, 12, 12, 2.7); b.platform(13, 9, 12, 12, 2.7);
      b.stairs(-5.3, -9, -Math.PI / 2, 2.2, 0.45, 0.8, 6, 0);
      b.stairs(5.3, 9, Math.PI / 2, 2.2, 0.45, 0.8, 6, 0);
      b.rail(-13, -2.95, 12, Math.PI / 2).y0 = 2.7;
      b.rail(13, 2.95, 12, Math.PI / 2).y0 = 2.7;
      b.pillar(0, 0, 1.2, 5);
    }, { floor: 'concrete' }),
    lay('f2a4', 'Bathroom Junction', 34, 32, (b) => {
      b.block(-10, -9, 10, 8, 3.2, '#8ecae6', 'restroom', { label: 'MEN' });
      b.block(10, -9, 10, 8, 3.2, '#ffafcc', 'restroom', { label: 'WOMEN' });
      b.block(-10, 9, 10, 8, 3.2, '#cdb4db', 'restroom', { label: 'ALL' });
      b.fountain(10, 8, 0); b.fountain(8, 11, Math.PI / 2);
      b.zone({ type: 'sticky', shape: 'circle', x: 3, z: 3, r: 2.4 });
    }, { floor: 'tile' }),
    lay('f2a5', 'Balcony Concourse', 40, 34, (b) => {
      b.platform(-11.5, -11, 17, 12, 2.6); b.platform(11.5, -11, 17, 12, 2.6);
      b.rail(-9.5, -4.95, 13, Math.PI / 2).y0 = 2.6;
      b.rail(9.5, -4.95, 13, Math.PI / 2).y0 = 2.6;
      b.stairs(-17.5, -2.2, Math.PI, 2.2, 0.43, 0.9, 6);
      b.stairs(17.5, -2.2, Math.PI, 2.2, 0.43, 0.9, 6);
      b.kiosk(-8, 9, 0, 'MERCH'); b.kiosk(8, 9, 0, 'FOOD');
    }, { floor: 'concrete' }),
  ],
  B: [
    lay('f2b1', 'Merch Maze', 36, 34, (b) => {
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
        if (b.rng.chance(0.45) || (Math.abs(i) < 1 && Math.abs(j) < 1)) continue;
        b.rack(i * 4.6, j * 4.4, b.rng.chance(0.5) ? 0 : Math.PI / 2, 3.2);
      }
      b.mimic(-10, 10); b.mimic(10, -10);
    }, { floor: 'carpet' }),
    lay('f2b2', 'Lightstick Warehouse', 38, 34, (b) => {
      for (let i = -2; i <= 2; i++) if (i) { b.shelf(i * 6.5, -8, 0, 9, 2.8, '#3c096c'); b.shelf(i * 6.5, 8, 0, 9, 2.8, '#3c096c'); }
      b.decor({ kind: 'lightsticks', x: 0, z: 0, spread: 14 });
      b.crate(-15, 0, 1.2, 1.0); b.crate(15, 0, 1.2, 1.0);
    }, { floor: 'concrete', dark: true }),
    lay('f2b3', 'T-Shirt Fortress', 38, 36, (b) => {
      const s = 6.5;
      b.block(-s, -s, 7, 1.4, 2.2, '#f1c0e8', 'shirtwall', { hp: 60 }); b.block(s, -s, 7, 1.4, 2.2, '#f1c0e8', 'shirtwall', { hp: 60 });
      b.block(-s, s, 7, 1.4, 2.2, '#f1c0e8', 'shirtwall', { hp: 60 }); b.block(s, s, 7, 1.4, 2.2, '#f1c0e8', 'shirtwall', { hp: 60 });
      b.block(-s - 3.2, 0, 1.4, 7, 2.2, '#cfbaf0', 'shirtwall', { hp: 60 }); b.block(s + 3.2, 0, 1.4, 7, 2.2, '#cfbaf0', 'shirtwall', { hp: 60 });
      b.rack(-14, -13, 0.4); b.rack(14, 13, 0.4); b.rack(-14, 13, -0.4); b.rack(14, -13, -0.4);
    }, { floor: 'carpet' }),
    lay('f2b4', 'Checkout Lines', 36, 32, (b) => {
      for (let i = -3; i <= 3; i++) {
        b.counter(i * 4.6, -4, 0, 4.2, '#90e0ef');
        for (let k = 0; k < 3; k++) b.stanchion(i * 4.6 + 1.6, 1 + k * 2.2);
      }
      b.rack(-13, 11, Math.PI / 2, 4); b.rack(13, 11, Math.PI / 2, 4);
    }, { floor: 'tile' }),
    lay('f2b5', 'Sold Out', 36, 34, (b) => {
      b.rack(-16, -10, 0, 4); b.rack(-16, 10, 0, 4); b.rack(16, -10, 0, 4); b.rack(16, 10, 0, 4);
      b.decor({ kind: 'sign', x: 0, z: -17.2, text: 'SOLD OUT' });
      b.L.budgetAdd = 2; b.L.waves = 2;
    }, { floor: 'carpet' }),
  ],
  C: [
    lay('f2c1', 'Food Stall Circle', 40, 38, (b) => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 8;
        b.stall(Math.sin(a) * 14, Math.cos(a) * 14, a + Math.PI, undefined, ['RAMYEON', 'CORN DOG', 'KIMBAP', 'HOTTEOK', 'BUBBLE TEA', 'CHIMAEK', 'BINGSU', 'FISHCAKE'][i]);
      }
      for (let i = 0; i < 5; i++) { const a = i * 1.26; b.table(Math.sin(a) * 5, Math.cos(a) * 5, a); }
      b.zone({ type: 'grease', shape: 'circle', x: -6, z: 7, r: 3 });
      b.zone({ type: 'grease', shape: 'circle', x: 7, z: -6, r: 2.6 });
    }, { floor: 'tile' }),
    lay('f2c2', 'Table Maze', 36, 34, (b) => {
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
        if (b.rng.chance(0.3)) continue;
        const x = i * 4.6, z = j * 4.2;
        b.table(x, z, (i + j) % 2 ? 0 : Math.PI / 2, 2.2);
        if (b.rng.chance(0.6)) b.chair(x + 1.1, z + 0.9, b.rng.range(0, 3));
      }
    }, { floor: 'tile' }),
    lay('f2c3', 'Kitchen', 34, 30, (b) => {
      b.counter(-8, -6, 0, 9, '#ced4da'); b.counter(8, 6, 0, 9, '#ced4da');
      b.counter(0, -12, Math.PI / 2, 10, '#adb5bd');
      b.zone({ type: 'hot', shape: 'rect', x: -8, z: 6, w: 3, d: 6 });
      b.zone({ type: 'hot', shape: 'rect', x: 8, z: -6, w: 3, d: 6 });
      b.zone({ type: 'grease', shape: 'rect', x: 0, z: 2, w: 6, d: 4 });
    }, { floor: 'tile' }),
    lay('f2c4', 'Concession Corridor', 44, 20, (b) => {
      for (let i = -3; i <= 3; i++) {
        b.stall(i * 6, -8, 0, undefined, ['NACHOS', 'PRETZEL', 'POPCORN', 'SODA', 'HOT DOG', 'CHURRO', 'TTEOK'][i + 3]);
        b.stall(i * 6 + 3, 8, Math.PI, undefined, ['ICE', 'CANDY', 'COFFEE', 'KIMCHI FRIES', 'MANDU', 'SUNDAE', 'BEER'][i + 3]);
      }
      b.hazard({ type: 'cans', n: 8 });
    }, { floor: 'tile' }),
    lay('f2c5', 'Drink Station', 34, 30, (b) => {
      for (let i = -2; i <= 2; i++) b.fountain(i * 6, -3, 0);
      b.zone({ type: 'sticky', shape: 'circle', x: -6, z: 4, r: 2.8 });
      b.zone({ type: 'sticky', shape: 'circle', x: 6, z: 5, r: 2.4 });
      b.zone({ type: 'sticky', shape: 'circle', x: 0, z: -9, r: 2.2 });
      b.cooler(-12, 9); b.cooler(12, -9);
    }, { floor: 'tile' }),
  ],
  D: [
    lay('f2d1', 'Lower Bowl', 40, 36, (b) => {
      b.tiers(-12.5, -3, 15, Math.PI, 6);
      b.tiers(12.5, -3, 15, Math.PI, 6);
      b.barrier(-6, 8, 3, Math.PI / 2); b.barrier(6, 8, 3, Math.PI / 2);
    }, { floor: 'concrete', walls: 'arena' }),
    lay('f2d2', 'Stairway', 34, 36, (b) => {
      b.tiers(-9.5, 2, 11, Math.PI, 9, 0.45, 1.1);
      b.tiers(9.5, 2, 11, Math.PI, 9, 0.45, 1.1);
      b.stairs(0, -3, Math.PI, 3, 0.45, 1.1, 9);
    }, { floor: 'concrete', walls: 'arena' }),
    lay('f2d3', 'Section Split', 40, 34, (b) => {
      b.tiers(-12, 8, 13, 0, 5);
      b.tiers(12, 8, 13, 0, 5);
      b.tiers(-12, -8, 13, Math.PI, 5);
      b.tiers(12, -8, 13, Math.PI, 5);
    }, { floor: 'concrete', walls: 'arena' }),
    lay('f2d4', 'Luxury Box', 22, 20, (b) => {
      b.couch(-6, -5, 0.2); b.couch(6, 5, 0.2, '#7209b7');
      b.counter(0, -7.5, Math.PI / 2, 5, '#2b2d42');
      b.table(0, 2, Math.PI / 2, 1.6); b.chair(-7, 5); b.chair(7, -5);
    }, { floor: 'carpet', small: true }),
    lay('f2d5', 'Empty Arena', 44, 40, (b) => {
      b.tiers(-13, -13, 15, Math.PI, 5, 0.5, 1.4);
      b.tiers(13, -13, 15, Math.PI, 5, 0.5, 1.4);
      b.tiers(-15, 7.5, 12, -Math.PI / 2, 4, 0.5, 1.4);
      b.tiers(15, -7.5, 12, Math.PI / 2, 4, 0.5, 1.4);
      b.L.budgetAdd = 1;
    }, { floor: 'arena', walls: 'arena' }),
  ],
  E: [
    lay('f2e1', 'Staff Corridor', 44, 22, (b) => {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        b.wall(i * 6, -11, i * 6, -5, 3.2, 0.4, '#6c757d');
        b.wall(i * 6 + 3, 11, i * 6 + 3, 5, 3.2, 0.4, '#6c757d');
      }
      b.roadcase(-12, 0, 0.3); b.roadcase(10, 1, -0.4);
      b.decor({ kind: 'sign', x: 0, z: -11.2, text: 'STAFF ONLY — REALLY' });
    }, { floor: 'concrete', walls: 'interior' }),
    lay('f2e2', 'Storage Room', 36, 32, (b) => {
      for (let i = 0; i < 18; i++) {
        const x = b.rng.range(-15, 15), z = b.rng.range(-13, 13);
        const h = b.rng.pick([0.9, 1.2, 1.8, 2.6]);
        b.crate(x, z, b.rng.range(1.1, 2), h, b.rng.range(0, 1.5));
      }
      b.shelf(-16, 0, 0, 10, 3.2); b.shelf(16, 0, 0, 10, 3.2);
    }, { floor: 'concrete', walls: 'interior' }),
    lay('f2e3', 'Dressing Rooms', 36, 32, (b) => {
      for (let i = -2; i <= 2; i++) {
        b.wall(i * 7, -16, i * 7, -7, 2.8, 0.3, '#e5989b');
        b.wall(i * 7, 16, i * 7, 7, 2.8, 0.3, '#e5989b');
        if (i < 2) { b.vanity(i * 7 + 3.5, -14.2, Math.PI / 2); b.vanity(i * 7 + 3.5, 14.2, Math.PI / 2); }
      }
      b.rack(-5, 0, Math.PI / 2, 3); b.rack(5, 0, Math.PI / 2, 3);
    }, { floor: 'carpet', walls: 'interior' }),
    lay('f2e4', 'Equipment Hall', 40, 34, (b) => {
      for (let i = 0; i < 16; i++) {
        const x = b.rng.range(-17, 17), z = b.rng.range(-14, 14);
        b.roadcase(x, z, b.rng.range(0, 3), b.rng.pick([1.6, 2.2, 3]));
      }
      b.speaker(-15, -12, 0.5, 2.2); b.speaker(15, 12, -2.5, 2.2);
    }, { floor: 'concrete', walls: 'interior' }),
    lay('f2e5', 'Loading Dock', 42, 34, (b) => {
      b.platform(-11.5, -11, 19, 12, 1.3, '#495057'); b.platform(11.5, -11, 19, 12, 1.3, '#495057');
      b.truck(-12, -12, Math.PI / 2, '#e9ecef').y0 = 1.3;
      b.stairs(-5, -3.2, Math.PI, 2.5, 0.43, 0.8, 3);
      b.stairs(5, -3.2, Math.PI, 2.5, 0.43, 0.8, 3);
      b.crate(-12, 6, 1.4, 1.2); b.crate(12, 8, 1.4, 1.8); b.roadcase(0, 9, Math.PI / 2);
    }, { floor: 'concrete', walls: 'interior' }),
  ],
};

// ---------------------------------------------------------------------------
// FLOOR 3 — BEHIND THE SHOW
// ---------------------------------------------------------------------------
const F3 = {
  A: [
    lay('f3a1', 'Dressing Room Hall', 42, 26, (b) => {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        b.wall(i * 6, -13, i * 6, -6, 3, 0.35, '#7b2cbf');
        b.decor({ kind: 'mirror', x: i * 6 + 3, z: -12.6 });
        b.wall(i * 6 + 3, 13, i * 6 + 3, 6, 3, 0.35, '#7b2cbf');
      }
      b.rack(-8, 1, Math.PI / 2, 3); b.rack(9, -1, Math.PI / 2, 3);
    }, { floor: 'carpet', walls: 'interior' }),
    lay('f3a2', 'Green Room', 34, 30, (b) => {
      b.couch(-7, -6, Math.PI / 2, '#2d6a4f'); b.couch(7, -6, Math.PI / 2, '#2d6a4f');
      b.couch(-7, 6, Math.PI / 2, '#40916c'); b.couch(7, 6, Math.PI / 2, '#40916c');
      b.table(0, 0, Math.PI / 2, 3); b.counter(-14, 0, 0, 8, '#b7e4c7');
      b.decor({ kind: 'sign', x: 0, z: -15.2, text: 'GREEN ROOM (IT IS NOT GREEN)' });
    }, { floor: 'carpet', walls: 'interior' }),
    lay('f3a3', 'Costume Department', 36, 32, (b) => {
      for (let i = 0; i < 12; i++) b.rack(b.rng.range(-15, 15), b.rng.range(-12, 12), b.rng.range(0, 3), 3);
      for (let i = 0; i < 10; i++) b.mannequin(b.rng.range(-15, 15), b.rng.range(-12, 12));
    }, { floor: 'wood', walls: 'interior' }),
    lay('f3a4', 'Makeup Department', 36, 30, (b) => {
      for (let r = -1; r <= 1; r++) for (let c = -3; c <= 3; c++) {
        if (c === 0) continue;
        b.vanity(c * 4.6, r * 8, Math.PI / 2);
        b.chair(c * 4.6, r * 8 + 1.3);
      }
      b.decor({ kind: 'mirrorRow', x: 0, z: -14.6 });
    }, { floor: 'tile', walls: 'interior' }),
    lay('f3a5', 'Artist Corridor', 46, 20, (b) => {
      for (let i = -4; i <= 4; i++) {
        if (i === 0) continue;
        b.pillar(i * 5, -6, 1.1, 4.5, '#9d4edd'); b.pillar(i * 5 + 2.5, 6, 1.1, 4.5, '#9d4edd');
      }
      b.decor({ kind: 'posters', x: 0, z: -9.8 });
    }, { floor: 'carpet', walls: 'interior' }),
  ],
  B: [
    lay('f3b1', 'Lighting Control', 36, 32, (b) => {
      b.console(0, -9, Math.PI / 2, 8); b.console(-10, 6, 0.4, 4); b.console(10, 6, -0.4, 4);
      b.hazard({ type: 'spotlight', n: 2 });
    }, { floor: 'grid', walls: 'interior', dark: true }),
    lay('f3b2', 'Sound Booth', 34, 32, (b) => {
      b.console(0, 0, Math.PI / 2, 6);
      for (const [x, z] of [[-12, -10], [12, -10], [-12, 10], [12, 10]]) { b.speaker(x, z, Math.atan2(-x, -z), 2.4); b.hazard({ type: 'speaker', x, z, period: 4.2, offset: (x + z + 40) / 20 }); }
    }, { floor: 'grid', walls: 'interior', dark: true }),
    lay('f3b3', 'Camera Control', 36, 32, (b) => {
      for (const [x, z] of [[-15, -13], [15, -13], [0, 14.5]]) { b.box({ model: 'tripod', x, z, w: 0.8, d: 0.8, h: 2.2, color: '#212529', vault: false }); b.hazard({ type: 'camera', x, z }); }
      b.console(-6, 0, 0, 5); b.console(6, 0, 0, 5);
    }, { floor: 'grid', walls: 'interior', dark: true }),
    lay('f3b4', 'Electrical Room', 36, 32, (b) => {
      for (let i = -3; i <= 3; i++) { b.cabinet(i * 4.8, -13.5, Math.PI / 2); b.cabinet(i * 4.8 + 2.4, 13.5, Math.PI / 2); }
      b.hazard({ type: 'arcs', axis: 'z', lines: [-12, -6, 0, 6, 12], period: 3.8, width: 1.4 });
    }, { floor: 'grid', walls: 'interior', dark: true }),
    lay('f3b5', 'Production Office', 36, 32, (b) => {
      for (let r = -1; r <= 1; r++) for (let c = -2; c <= 2; c++) if (c) b.desk(c * 6, r * 8, Math.PI / 2);
      b.hazard({ type: 'rigSweep', x: 0, z: 0, len: 30, speed: 0.55 });
    }, { floor: 'carpet', walls: 'interior', dark: true }),
  ],
  C: [
    lay('f3c1', 'Speaker Warehouse', 38, 34, (b) => {
      for (let i = 0; i < 10; i++) {
        const x = b.rng.range(-16, 16), z = b.rng.range(-14, 14);
        if (Math.hypot(x, z) < 4) continue;
        b.speaker(x, z, b.rng.range(0, 6), b.rng.pick([1.6, 2.4, 3.2]));
      }
      b.hazard({ type: 'speaker', x: -14, z: 0, period: 3.6, offset: 0 });
      b.hazard({ type: 'speaker', x: 14, z: 0, period: 3.6, offset: 1.8 });
      b.speaker(-15, 0, Math.PI / 2, 3); b.speaker(15, 0, -Math.PI / 2, 3);
    }, { floor: 'concrete', walls: 'interior', dark: true }),
    lay('f3c2', 'Lighting Rig', 38, 34, (b) => {
      for (let i = -2; i <= 2; i++) b.truss(i * 7, 0, 0, 22, 0.6);
      b.hazard({ type: 'rigSweep', x: -6, z: 0, len: 26, speed: 0.7 });
      b.hazard({ type: 'rigSweep', x: 6, z: 0, len: 26, speed: -0.6 });
    }, { floor: 'grid', walls: 'interior', dark: true }),
    lay('f3c3', 'Cable Hell', 36, 32, (b) => {
      for (let i = 0; i < 28; i++) b.cable(b.rng.range(-16, 16), b.rng.range(-14, 14), b.rng.range(0, 3), b.rng.range(2, 5));
      b.roadcase(-10, -8); b.roadcase(10, 8); b.roadcase(-6, 10, 1.2);
      b.hazard({ type: 'arcs', axis: 'x', lines: [-10, 0, 10], period: 3.2, width: 1.6 });
    }, { floor: 'concrete', walls: 'interior', dark: true }),
    lay('f3c4', 'Prop Storage', 38, 34, (b) => {
      const kinds = ['bigheart', 'bigstar', 'bigheart', 'bigstar', 'bigheart', 'bigstar'];
      kinds.forEach((k, i) => b.bigProp(-15 + i * 6, (i % 2 ? 8 : -8) + b.rng.range(-2, 2), k, b.rng.range(2.2, 3.2)));
      b.crate(-4, 0, 1.4, 1.2); b.crate(5, 1, 1.4, 1.0);
      b.box({ model: 'giantmic', x: 0, z: 12, w: 1.2, d: 1.2, h: 4, color: '#adb5bd', vault: false });
    }, { floor: 'wood', walls: 'interior', dark: true }),
    lay('f3c5', 'Pyrotechnics Storage', 36, 34, (b) => {
      for (let i = 0; i < 10; i++) b.crate(b.rng.range(-15, 15), b.rng.range(-13, 13), 1.2, 1.1);
      b.hazard({ type: 'pyro', grid: 4, period: 3.0 });
      b.decor({ kind: 'sign', x: 0, z: -17.2, text: 'DANGER: EXPLOSIVES (VIBES)' });
    }, { floor: 'concrete', walls: 'interior', dark: true }),
  ],
  D: [
    lay('f3d1', 'Stage Left', 38, 32, (b) => {
      b.decor({ kind: 'curtains', x: 0, z: -15.6 });
      for (let i = 0; i < 4; i++) b.wall(-14 + i * 3, -6 + i * 4, -14 + i * 3, -2 + i * 4, 3.4, 0.3, '#370617', 'curtain');
      b.roadcase(8, -6); b.roadcase(10, 6, 1.4); b.speaker(12, -10, -2.4, 2.6);
      b.L.budgetAdd = 1; b.L.concert = 0.6;
    }, { floor: 'wood', walls: 'interior', dark: true }),
    lay('f3d2', 'Stage Right', 38, 32, (b) => {
      b.decor({ kind: 'curtains', x: 0, z: -15.6 });
      for (let i = 0; i < 4; i++) b.wall(14 - i * 3, -6 + i * 4, 14 - i * 3, -2 + i * 4, 3.4, 0.3, '#370617', 'curtain');
      b.roadcase(-8, -6); b.roadcase(-10, 6, 1.4); b.speaker(-12, -10, 2.4, 2.6);
      b.L.budgetAdd = 1; b.L.concert = 0.6;
    }, { floor: 'wood', walls: 'interior', dark: true }),
    lay('f3d3', 'Understage', 38, 34, (b) => {
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) if ((i + j) % 2 === 0 && (i || j)) b.pillar(i * 5, j * 6, 0.9, 2.8, '#6c757d');
      b.decor({ kind: 'lowCeiling' });
      b.L.budgetAdd = 1; b.L.concert = 0.8;
    }, { floor: 'concrete', walls: 'interior', dark: true }),
    lay('f3d4', 'Catwalk', 40, 34, (b) => {
      b.platform(-12, -7.5, 12, 3, 2.8, '#8d99ae'); b.platform(12, -7.5, 12, 3, 2.8, '#8d99ae');
      b.platform(-12, 7.5, 12, 3, 2.8, '#8d99ae'); b.platform(12, 7.5, 12, 3, 2.8, '#8d99ae');
      b.platform(-7.5, 0, 3, 12, 2.8, '#8d99ae'); b.platform(7.5, 0, 3, 12, 2.8, '#8d99ae');
      b.stairs(-12, -11.2, 0, 2.4, 0.46, 0.8, 6); b.stairs(12, 11.2, Math.PI, 2.4, 0.46, 0.8, 6);
      b.L.budgetAdd = 1; b.L.concert = 0.7;
    }, { floor: 'grid', walls: 'interior', dark: true }),
    lay('f3d5', 'Stage Lift', 38, 34, (b) => {
      const lift = b.box({ model: 'lift', x: 0, z: 0, w: 7, d: 7, h: 0.3, color: '#ffd166', vault: false, dyn: true, keep: true });
      b.hazard({ type: 'lift', ref: lift, lo: 0.3, hi: 3.0, period: 7 });
      b.platform(-14, -11, 6, 6, 1.6, '#495057'); b.platform(14, 11, 6, 6, 1.6, '#495057');
      b.L.budgetAdd = 1; b.L.concert = 0.8;
    }, { floor: 'wood', walls: 'interior', dark: true }),
  ],
  E: [
    lay('f3e1', 'Backup Dancers', 40, 36, (b) => {
      b.hazard({ type: 'dancers', n: 6 });
      b.hazard({ type: 'lasers', axis: 'z', lines: [-12, -4, 4, 12], period: 3.6, width: 1.4 });
    }, { floor: 'stage', walls: 'void', surreal: true }),
    lay('f3e2', 'Lighting Check', 40, 36, (b) => {
      for (let i = 0; i < 8; i++) b.box({ model: 'lightcube', x: b.rng.range(-15, 15), z: b.rng.range(-13, 13), w: 1.6, d: 1.6, h: 1.6, color: '#fdf0d5' });
      b.hazard({ type: 'spotlight', n: 3 });
    }, { floor: 'stage', walls: 'void', surreal: true }),
    lay('f3e3', 'Sound Check', 40, 36, (b) => {
      b.hazard({ type: 'eqBars', n: 10 });
      b.hazard({ type: 'speaker', x: 0, z: -15, period: 4, offset: 0 });
    }, { floor: 'stage', walls: 'void', surreal: true }),
    lay('f3e4', 'Opening Number', 40, 36, (b) => {
      b.bigProp(-10, -8, 'bigheart', 3); b.bigProp(10, -8, 'bigheart', 3); b.bigProp(0, 9, 'bigstar', 3.4);
      b.hazard({ type: 'pyro', grid: 3, period: 2.8 });
    }, { floor: 'stage', walls: 'void', surreal: true }),
    lay('f3e5', 'Final Countdown', 40, 36, (b) => {
      b.decor({ kind: 'countdown', x: 0, z: -12 });
      b.hazard({ type: 'pyro', grid: 4, period: 2.6 });
      b.hazard({ type: 'rigSweep', x: 0, z: 0, len: 30, speed: 0.5 });
      b.L.budgetAdd = 1;
    }, { floor: 'stage', walls: 'void', surreal: true }),
  ],
};

export const LAYOUTS = { 1: F1, 2: F2, 3: F3 };

// ---------------------------------------------------------------------------
// Special rooms
// ---------------------------------------------------------------------------
export const SPECIAL = {
  start: lay('start', 'Arrival', 26, 24, (b, floor) => {
    if (floor === 1) { b.car(-6, -5, 0.2, '#ff4fa3'); b.decor({ kind: 'sign', x: 0, z: -12.2, text: 'CONCERT PARKING →' }); }
    if (floor === 2) { b.pillar(-7, -6, 1.2, 5); b.pillar(7, 6, 1.2, 5); b.decor({ kind: 'sign', x: 0, z: -12.2, text: 'WELCOME TO THE VENUE' }); }
    if (floor === 3) { b.roadcase(-6, -5, 0.4); b.roadcase(6, 5, -0.2); b.decor({ kind: 'sign', x: 0, z: -12.2, text: 'AUTHORIZED PERSONNEL ONLY' }); }
  }, { small: true }),
  gas: lay('gas', 'Gas Station', 26, 22, (b) => {
    b.counter(0, -8.3, Math.PI / 2, 7, '#e5e5e5');
    b.box({ model: 'register', x: 1.8, z: -8.3, w: 0.6, d: 0.5, h: 0.4, y0: 1.0, color: '#333', clutter: false, solid: false });
    b.box({ model: 'cashier', x: 0, z: -9.6, w: 0.6, d: 0.6, h: 1.75, color: '#f4a261', vault: false });
    b.shelf(-7, 1, 0, 6, 1.6, '#e63946'); b.shelf(-3.5, 1, 0, 6, 1.6, '#457b9d');
    b.box({ model: 'fridge', x: 11.8, z: 0, w: 1.2, d: 10, h: 2.4, color: '#caf0f8', vault: false });
    b.box({ model: 'lockedcase', x: -11.6, z: -5, w: 1.0, d: 3, h: 2.0, color: '#8d99ae', vault: false });
    b.box({ model: 'lottery', x: 7, z: -8.5, w: 1.4, d: 0.8, h: 1.7, color: '#ffd60a', vault: false });
    b.box({ model: 'backwall', x: 5.5, z: 10.4, w: 8, d: 0.8, h: 2.6, color: '#ffb703', vault: false });
  }, { floor: 'gasTile', walls: 'store', small: true }),
  treasure: lay('treasure', 'Lost & Found', 22, 20, (b) => {
    b.decor({ kind: 'sign', x: 0, z: -10.2, text: 'LOST & FOUND' });
    b.crate(-7, -6, 1.2, 1.0); b.crate(7, 6, 1.2, 1.0);
  }, { small: true }),
  secret: lay('secret', 'Mysterious Bathroom', 18, 16, (b) => {
    b.toilet(-5, -5); b.toilet(0, -5.6); b.toilet(5, -5);
    b.decor({ kind: 'sign', x: 0, z: -8.2, text: 'WHY IS THIS HERE' });
  }, { floor: 'tile', walls: 'store', small: true }),
  boss1: lay('boss1', 'The Opening Stage', 38, 36, (b) => {
    b.platform(0, -15, 16, 5, 1.1, '#3a0ca3');
    b.speaker(-10, -15, 0, 3); b.speaker(10, -15, 0, 3);
    b.decor({ kind: 'screen', x: 0, z: -17.4, w: 14, text: 'OPENING ACT' });
    b.decor({ kind: 'crowd', x: -19, z: 0, w: 26, rot: -Math.PI / 2 }); b.decor({ kind: 'crowd', x: 19, z: 0, w: 26, rot: Math.PI / 2 });
  }, { floor: 'plaza', walls: 'fence' }),
  boss2: lay('boss2', 'Arena Floor', 40, 38, (b) => {
    b.platform(0, -16, 22, 5, 1.2, '#240046');
    b.decor({ kind: 'screen', x: -12, z: -18.4, w: 8, text: 'HEADLINER' }); b.decor({ kind: 'screen', x: 12, z: -18.4, w: 8, text: 'HEADLINER' });
    b.decor({ kind: 'crowd', x: -20, z: 0, w: 30, rot: -Math.PI / 2 }); b.decor({ kind: 'crowd', x: 20, z: 0, w: 30, rot: Math.PI / 2 });
  }, { floor: 'arena', walls: 'arena' }),
  boss3: lay('boss3', 'THE MAIN STAGE', 44, 40, (b) => {
    b.decor({ kind: 'screen', x: -15, z: -19.4, w: 10, text: '♥ ♥ ♥' }); b.decor({ kind: 'screen', x: 15, z: -19.4, w: 10, text: '♥ ♥ ♥' });
    b.decor({ kind: 'crowd', x: -22, z: 2, w: 34, rot: -Math.PI / 2 }); b.decor({ kind: 'crowd', x: 22, z: 2, w: 34, rot: Math.PI / 2 });
    b.decor({ kind: 'stageLights' });
  }, { floor: 'stage', walls: 'void', surreal: true }),
};

// Every layout key → layout, for tests and debug jumps.
export function allLayouts() {
  const out = [];
  for (const f of [1, 2, 3]) for (const t of 'ABCDE') for (const l of LAYOUTS[f][t]) out.push({ ...l, style: l.floor, floor: f, type: t });
  return out;
}

export function buildLayout(layout, floor, rng, doors = []) {
  const b = makeBuilder(layout.w, layout.d, rng);
  layout.build(b, floor);
  const L = b.L;
  L.key = layout.key; L.name = layout.name;
  L.floorStyle = layout.floor || (floor === 1 ? 'asphalt' : floor === 2 ? 'concrete' : 'grid');
  L.walls = layout.walls || (floor === 1 ? 'fence' : 'interior');
  L.dark = !!layout.dark; L.surreal = !!layout.surreal; L.small = !!layout.small;
  L.reward = layout.reward || null;
  clearDoors(L, doors);
  return L;
}
