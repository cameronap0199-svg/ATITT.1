// Crossover rifts: a combat room sometimes tears open into another universe and part
// of the fight comes from somewhere else entirely — Halo, Minecraft, One Piece,
// Pokémon or the Bible. Pure data + rolls (tested headlessly); room.js builds the
// portal and spawns, actors/crossover.js holds the enemies.
// All crossover enemies are affectionate parodies: original procedural models and
// behaviour, names riffing on the source.

export const RIFTS = {
  halo: {
    name: 'HALO', title: 'RIFT: THE RING', color: '#3a86ff', color2: '#a855f7', tag: 'HALO',
    intro: 'Covenant forces have entered the venue.', vehicle: 'warthog',
    weights: { grunt: 10, jackal: 6, elite: 4, hunter: 1.2 }, caps: { hunter: 1, elite: 2 },
    rewards: ['overshield', 'w:energySword', 'w:needler', 'g:plasmaGrenade', 'spartanArmor'],
  },
  minecraft: {
    name: 'MINECRAFT', title: 'RIFT: THE OVERWORLD', color: '#5bb450', color2: '#8b5a2b', tag: 'MC',
    intro: 'The floor is suddenly made of blocks. Something is hissing.', vehicle: 'minecart',
    weights: { zombie: 10, skeleton: 7, creeper: 6, spider: 5, enderman: 3 }, caps: { enderman: 2, creeper: 3, spider: 3 },
    rewards: ['w:diamondSword', 'w:bow', 'g:tnt', 'g:enderPearl', 'goldenApple', 'ironArmor'],
  },
  onepiece: {
    name: 'ONE PIECE', title: 'RIFT: THE GRAND LINE', color: '#e63946', color2: '#1d4ed8', tag: 'OP',
    intro: 'The Marines are here. Nobody bought a ticket.', vehicle: 'miniMerry',
    weights: { marine: 10, fishman: 5, pacifista: 1.4, seaKing: 1.1 }, caps: { pacifista: 1, seaKing: 1 },
    rewards: ['gumGum', 'flameFruit', 'observationHaki', 'armamentHaki', 'meat'],
  },
  pokemon: {
    name: 'POKÉMON', title: 'RIFT: TALL GRASS', color: '#f4a100', color2: '#e63946', tag: 'PKMN',
    intro: 'A wild encounter!', vehicle: 'bike',
    weights: { pikachew: 8, gastlee: 6, magikrap: 6, snorelax: 2.5, gyarados: 0.4 }, caps: { snorelax: 1, gyarados: 1, magikrap: 2 },
    rewards: ['g:captureBall', 'rareCandy', 'superPotion', 'luckyEgg', 'expShare'],
  },
  bible: {
    name: 'THE BIBLE', title: 'RIFT: THE PLAGUES', color: '#c9a227', color2: '#7f1d1d', tag: 'BIBLE',
    intro: 'Let my people go. (To the next room.)', vehicle: 'chariot',
    weights: { frog: 8, locust: 8, charioteer: 3, goldenCalf: 2, goliath: 0.9 }, caps: { goliath: 1, goldenCalf: 1, charioteer: 2 },
    rewards: ['w:davidSling', 'w:samsonJawbone', 'g:mosesStaff', 'manna', 'loavesFishes', 'armorOfGod'],
    plagues: ['frogs', 'locusts', 'hail', 'darkness'],
  },
};
export const RIFT_IDS = Object.keys(RIFTS);

// Crossover enemy roster. threat = Threat Value (same scale as the venue demons).
export const CROSS_INFO = {
  // Halo
  grunt: { name: 'Grunt', franchise: 'halo', threat: 1 },
  jackal: { name: 'Jackal', franchise: 'halo', threat: 1.5 },
  elite: { name: 'Elite', franchise: 'halo', threat: 3 },
  hunter: { name: 'Hunter', franchise: 'halo', threat: 4.5, elite: true },
  // Minecraft
  zombie: { name: 'Zombie', franchise: 'minecraft', threat: 1 },
  skeleton: { name: 'Skeleton', franchise: 'minecraft', threat: 1.5 },
  creeper: { name: 'Creeper', franchise: 'minecraft', threat: 1.5 },
  enderman: { name: 'Enderman', franchise: 'minecraft', threat: 2.5 },
  spider: { name: 'Spider', franchise: 'minecraft', threat: 1.5 },
  // One Piece
  marine: { name: 'Marine', franchise: 'onepiece', threat: 1 },
  fishman: { name: 'Fish-Man Karate Master', franchise: 'onepiece', threat: 2.5 },
  pacifista: { name: 'Pacifista', franchise: 'onepiece', threat: 4, elite: true },
  seaKing: { name: 'Sea King', franchise: 'onepiece', threat: 5, elite: true },
  // Pokémon
  pikachew: { name: 'Pikachew', franchise: 'pokemon', threat: 1.5 },
  gastlee: { name: 'Gastlee', franchise: 'pokemon', threat: 1.5 },
  magikrap: { name: 'Magikrap', franchise: 'pokemon', threat: 0.5 },
  snorelax: { name: 'Snorelax', franchise: 'pokemon', threat: 3 },
  gyarados: { name: 'Gyara-DOS', franchise: 'pokemon', threat: 5, elite: true },
  // The Bible
  frog: { name: 'Plague Frog', franchise: 'bible', threat: 0.5 },
  locust: { name: 'Locust Swarm', franchise: 'bible', threat: 1 },
  charioteer: { name: 'Pharaoh\'s Charioteer', franchise: 'bible', threat: 2.5 },
  goldenCalf: { name: 'Golden Calf', franchise: 'bible', threat: 2 },
  goliath: { name: 'Goliath of Gath', franchise: 'bible', threat: 6, elite: true },
};

// Generous: roughly every third or fourth fight on floor 3 opens a rift.
export const RIFT_CHANCE = [0.24, 0.3, 0.36];

export function rollRift(floor, rng, opts = {}) {
  if (rng() >= (opts.chance ?? RIFT_CHANCE[Math.max(0, Math.min(2, floor - 1))])) return null;
  const id = rng.pick(RIFT_IDS);
  const r = { id };
  if (id === 'bible') r.plague = rng.pick(RIFTS.bible.plagues);
  return r;
}

// Rift enemies for a threat budget. Frogs arrive in threes; bigger budgets can include
// the franchise's heavy hitter.
export function composeRift(id, floor, budget, rng) {
  const R = RIFTS[id];
  const w = { ...R.weights };
  if (floor === 1) { for (const k of Object.keys(w)) if (CROSS_INFO[k].threat >= 4.5) w[k] *= 0.35; }
  const count = {};
  const list = [];
  let left = budget;
  for (let guard = 0; guard < 40; guard++) {
    const cost = (k) => CROSS_INFO[k].threat * (k === 'frog' ? 3 : 1);
    const opts = Object.entries(w).filter(([k, wt]) => wt > 0 && cost(k) <= left + 1e-6 && (R.caps[k] === undefined || (count[k] || 0) < R.caps[k]));
    if (!opts.length) break;
    const k = rng.weighted(opts);
    const n = k === 'frog' ? 3 : 1;
    for (let i = 0; i < n; i++) list.push(k);
    count[k] = (count[k] || 0) + n;
    left -= CROSS_INFO[k].threat * n;
  }
  if (!list.length) list.push(Object.keys(R.weights)[0]);
  return list;
}

// Random room events beyond rifts (all generous). Rolled once per room.
export const EVENT_CHANCE = {
  vehicle: 0.12,        // a parked vehicle waits in a fight room
  merchant: 0.14,       // a travelling crossover merchant appears on clear
  crafting: 0.12,       // a crafting table appears on clear
  bush: 0.07,           // a burning bush offers a blessing on clear
  bonusDrop: 0.55,      // extra clear reward (money / heart / blocks)
};
