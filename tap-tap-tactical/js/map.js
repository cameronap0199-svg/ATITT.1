// "The Mainframe Topology": an ARPANET-style subnet of rooms. Forward-only routing,
// burnt nodes, encrypted contents, and every path funnels into the [SYSTEM_CORE].

import { FLOOR_COUNTS, W, H } from './data.js';

export function generateFloor(rng, floor = 1) {
  const counts = {};
  for (const [type, [lo, hi]] of Object.entries(FLOOR_COUNTS)) counts[type] = rng.int(lo, hi);
  const bag = [];
  for (const [type, n] of Object.entries(counts)) for (let i = 0; i < n; i++) bag.push(type);
  rng.shuffle(bag);

  const M = bag.length;
  const L = Math.max(5, Math.min(7, Math.round(M / 2.7)));
  const sizes = new Array(L).fill(2);
  let rem = M - 2 * L;
  while (rem > 0) {
    const i = rng.int(0, L - 1);
    if (sizes[i] < 4) { sizes[i]++; rem--; }
  }

  // Deal types into layers; keep quarantines out of the first layer after the breach.
  const layers = [];
  let k = 0;
  for (let l = 0; l < L; l++) layers.push(bag.slice(k, (k += sizes[l])));
  for (let i = 0; i < layers[0].length; i++) {
    if (layers[0][i] !== 'quarantine') continue;
    for (let l = 1; l < L; l++) {
      const j = layers[l].findIndex((t) => t !== 'quarantine');
      if (j >= 0) { [layers[0][i], layers[l][j]] = [layers[l][j], layers[0][i]]; break; }
    }
  }

  const nodes = [];
  const byLayer = [];
  const mk = (layer, row, rows, type) => {
    const n = {
      id: nodes.length, layer, row, type,
      known: type === 'initiation' || type === 'core' || type === 'quarantine',
      state: 'locked',
      x: 0, y: 0,
    };
    const x0 = 120, x1 = W - 120;
    n.x = Math.round(x0 + (layer / (L + 1)) * (x1 - x0) + (layer > 0 && layer <= L ? rng.range(-18, 18) : 0));
    const top = 136, bottom = H - 212;
    n.y = rows === 1 ? Math.round((top + bottom) / 2) : Math.round(top + (row / (rows - 1)) * (bottom - top) + rng.range(-16, 16));
    nodes.push(n);
    return n;
  };
  byLayer.push([mk(0, 0, 1, 'initiation')]);
  layers.forEach((types, l) => byLayer.push(types.map((t, r) => mk(l + 1, r, types.length, t))));
  byLayer.push([mk(L + 1, 0, 1, 'core')]);

  const edges = [];
  const has = (a, b) => edges.some((e) => e[0] === a && e[1] === b);
  const link = (a, b) => { if (!has(a, b)) edges.push([a, b]); };
  for (let l = 0; l < byLayer.length - 1; l++) {
    const A = byLayer[l], B = byLayer[l + 1];
    const n = A.length, m = B.length;
    A.forEach((a, j) => {
      const pos = n === 1 ? (m - 1) / 2 : (j * (m - 1)) / (n - 1);
      link(a.id, B[Math.round(pos)].id);
      if (n === 1) { B.forEach((b) => link(a.id, b.id)); return; }
      if (rng.chance(0.45)) {
        const alt = Math.round(pos) + (rng.chance(0.5) ? 1 : -1);
        if (alt >= 0 && alt < m) link(a.id, B[alt].id);
      }
    });
    B.forEach((b, j) => {
      if (edges.some((e) => e[1] === b.id)) return;
      const pos = m === 1 ? 0 : (j * (n - 1)) / (m - 1);
      link(A[Math.round(pos)].id, b.id);
    });
  }

  const map = { floor, nodes, edges, layers: L + 2, current: null, start: 0, core: nodes.length - 1, path: [] };
  nodes[0].state = 'available';
  return map;
}

export const nextOf = (map, id) => map.edges.filter((e) => e[0] === id).map((e) => map.nodes[e[1]]);
export const prevOf = (map, id) => map.edges.filter((e) => e[1] === id).map((e) => map.nodes[e[0]]);

// Enter a node (it becomes current). Siblings in the same layer burn: no going back.
export function enterNode(map, id) {
  const node = map.nodes[id];
  for (const n of map.nodes) {
    if (n.state === 'available') n.state = n.id === id ? 'current' : 'burnt';
  }
  node.state = 'current';
  node.known = true;
  map.current = id;
  map.path.push(id);
  return node;
}

// The room was survived: its line burns out behind you and the next layer opens.
export function clearNode(map, id) {
  const node = map.nodes[id];
  node.state = 'cleared';
  for (const n of nextOf(map, id)) if (n.state === 'locked') n.state = 'available';
  for (const n of map.nodes) if (n.layer <= node.layer && n.state === 'locked') n.state = 'burnt';
  return nextOf(map, id);
}

// Intel from a perfect gateway: decrypt everything one layer ahead.
export function revealNext(map, fromId) {
  const out = [];
  for (const n of nextOf(map, fromId)) { if (!n.known) { n.known = true; out.push(n); } }
  return out;
}
