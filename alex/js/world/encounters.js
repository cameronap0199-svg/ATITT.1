// Threat-budget encounter composition. Rooms get a budget; enemies cost their Threat
// Value. Pure data so it can be tested and tuned headlessly.

export const ENEMY_INFO = {
  lurker: { name: 'Lightstick Lurker', floor: 1, threat: 1 },
  photocard: { name: 'Photocard Possessed', floor: 1, threat: 1 },
  biasBeast: { name: 'Bias Beast', floor: 1, threat: 1.5 },
  queue: { name: 'Queue Cultist', floor: 1, threat: 2 },
  mimic: { name: 'Merch Mimic', floor: 1, threat: 2.5 },
  fancam: { name: 'Fancam Fiend', floor: 2, threat: 2 },
  stalker: { name: 'Sasaeng Stalker', floor: 2, threat: 2 },
  hoarder: { name: 'Album Hoarder', floor: 2, threat: 3 },
  chanter: { name: 'Fan-Chanter', floor: 2, threat: 2 },
  ultBias: { name: 'Ult-Bias', floor: 2, threat: 3.5, elite: true },
  akgae: { name: 'Akgae', floor: 3, threat: 3 },
  parasocial: { name: 'Parasocial', floor: 3, threat: 3 },
  queen: { name: 'Comeback Queen', floor: 3, threat: 3.5 },
  fanwar: { name: 'Fanwar', floor: 3, threat: 4 },
  delulu: { name: 'Delulu', floor: 3, threat: 6, elite: true },
};

const WEIGHTS = {
  1: { lurker: 10, photocard: 7, biasBeast: 5, queue: 3, mimic: 2 },
  2: { fancam: 5, stalker: 4, hoarder: 3, chanter: 3, ultBias: 2, lurker: 5, photocard: 4, biasBeast: 3, queue: 1.5, mimic: 1.5 },
  3: { akgae: 4, parasocial: 3, queen: 2.5, fanwar: 3, delulu: 0.7, fancam: 2.5, stalker: 2, hoarder: 1.5, chanter: 1.5, ultBias: 1, lurker: 3, photocard: 2, biasBeast: 2 },
};

const CAPS = {
  1: { queue: 2, mimic: 1, biasBeast: 2 },
  2: { ultBias: 1, chanter: 1, stalker: 2, hoarder: 2, fancam: 3, queue: 1, mimic: 1 },
  3: { delulu: 1, queen: 1, fanwar: 2, parasocial: 2, akgae: 2, ultBias: 1, chanter: 1, hoarder: 1, stalker: 2 },
};

// Room flavour: some room families lean towards thematically fitting enemies.
const AFFINITY = {
  '1C': { queue: 2.2 }, '1D': { mimic: 3 }, '1E': { photocard: 1.5 },
  '2B': { hoarder: 1.8, mimic: 2.5 }, '2D': { fancam: 2.2 }, '2E': { stalker: 1.8 },
  '3A': { queen: 1.5 }, '3B': { fancam: 2 }, '3D': { akgae: 1.5 }, '3E': { delulu: 1.8 },
};

export function composeEncounter(floor, budget, rng, opts = {}) {
  const w = { ...WEIGHTS[floor] };
  const aff = AFFINITY[floor + (opts.type || '')] || {};
  for (const k of Object.keys(aff)) if (w[k]) w[k] *= aff[k];
  if (floor === 3 && (budget < 12 || !rng.chance(0.35))) delete w.delulu;
  if (!opts.mimicSpots) w.mimic = (w.mimic || 0) * 0.5;
  const caps = { ...CAPS[floor] };
  if (floor === 1 && budget >= 7) caps.mimic = 2;
  const count = {};
  const list = [];
  let left = budget;
  let elites = 0;
  for (let guard = 0; guard < 40; guard++) {
    const options = Object.entries(w).filter(([k, wt]) => {
      const info = ENEMY_INFO[k];
      if (wt <= 0 || info.threat > left + 1e-6) return false;
      if (caps[k] !== undefined && (count[k] || 0) >= caps[k]) return false;
      if (info.elite && elites >= 1) return false;
      return true;
    });
    if (!options.length) break;
    const k = rng.weighted(options);
    list.push(k);
    count[k] = (count[k] || 0) + 1;
    if (ENEMY_INFO[k].elite) elites++;
    left -= ENEMY_INFO[k].threat;
  }
  while (list.length < 2) { list.push('lurker'); left -= 1; }
  // Waves: big budgets arrive in two pushes (second when the first is mostly down)
  const waves = [];
  const nWaves = opts.waves || (budget > 9.5 ? 2 : 1);
  if (nWaves === 1) waves.push(list);
  else {
    const sorted = rng.shuffle(list.slice());
    const total = sorted.reduce((s, k) => s + ENEMY_INFO[k].threat, 0);
    const a = [], b = [];
    let acc = 0;
    for (const k of sorted) {
      if (acc < total * 0.58) { a.push(k); acc += ENEMY_INFO[k].threat; } else b.push(k);
    }
    waves.push(a);
    if (b.length) waves.push(b);
  }
  return { waves, threat: budget - left };
}

export const threatOf = (list) => list.reduce((s, k) => s + ENEMY_INFO[k].threat, 0);
