// Minecraft, for real: materials, tools, shaped and shapeless crafting recipes (2×2
// pocket grid and the 3×3 crafting table), furnace smelting with fuel, XP levels,
// enchantments, ore and block definitions, and drop tables for everything in the
// game — demons, rift mobs, Pokémon, props and blocks. Pure data + pure functions
// (tested headlessly); mc/craftUI.js is the screen, mc/world.js the 3D side.

// ---------------------------------------------------------------------------- items
// icon: the shape the icon painter draws (mc/icons.js); c: its colours.
export const MC = {
  // wood & stone
  oakLog: { name: 'Oak Log', icon: 'log', c: ['#6b4f2a', '#b8945f'], fuel: 1.5 },
  oakPlanks: { name: 'Oak Planks', icon: 'planks', c: ['#b8945f', '#8f7040'], fuel: 1.5 },
  stick: { name: 'Stick', icon: 'stick', c: ['#8f7040'], fuel: 0.5 },
  cobblestone: { name: 'Cobblestone', icon: 'block', c: ['#7b7b7b', '#5a5a5a', '#9a9a9a'] },
  dirt: { name: 'Dirt', icon: 'block', c: ['#8b5a2b', '#6e4520', '#a06a38'] },
  sand: { name: 'Sand', icon: 'block', c: ['#e2d39c', '#cdbd84', '#f0e3b2'] },
  gravel: { name: 'Gravel', icon: 'block', c: ['#857f7c', '#6b6563', '#a19b98'] },
  glass: { name: 'Glass', icon: 'glass', c: ['#cbeef7'] },
  wool: { name: 'White Wool', icon: 'block', c: ['#f2f2f2', '#d9d9d9', '#ffffff'] },
  obsidian: { name: 'Obsidian', icon: 'block', c: ['#1b1029', '#2d1b4e', '#0d0716'], desc: 'Only a diamond pickaxe can mine it. Ten make a Nether Portal frame.' },
  netherrack: { name: 'Netherrack', icon: 'block', c: ['#6e2b2b', '#4f1c1c', '#8a3a3a'] },
  soulSand: { name: 'Soul Sand', icon: 'block', c: ['#54402f', '#3f2f22', '#6a523d'] },
  // ores & minerals
  coal: { name: 'Coal', icon: 'coal', c: ['#1f1f1f', '#3a3a3a'], fuel: 8 },
  charcoal: { name: 'Charcoal', icon: 'coal', c: ['#3a2d22', '#57463a'], fuel: 8 },
  rawIron: { name: 'Raw Iron', icon: 'raw', c: ['#d8af93', '#a87e62'] },
  ironIngot: { name: 'Iron Ingot', icon: 'ingot', c: ['#d8d8d8', '#9e9e9e'] },
  rawGold: { name: 'Raw Gold', icon: 'raw', c: ['#f8d74a', '#c89a1a'] },
  goldIngot: { name: 'Gold Ingot', icon: 'ingot', c: ['#fde047', '#ca8a04'] },
  goldNugget: { name: 'Gold Nugget', icon: 'nugget', c: ['#fde047', '#ca8a04'] },
  diamond: { name: 'Diamond', icon: 'gem', c: ['#67e8f9', '#0e7490'] },
  emerald: { name: 'Emerald', icon: 'gem', c: ['#34d399', '#047857'] },
  redstone: { name: 'Redstone Dust', icon: 'dust', c: ['#ef4444', '#991b1b'] },
  lapis: { name: 'Lapis Lazuli', icon: 'gem', c: ['#3b5bdb', '#1e3a8a'] },
  quartz: { name: 'Nether Quartz', icon: 'gem', c: ['#f1ece4', '#bdb3a6'] },
  flint: { name: 'Flint', icon: 'flint', c: ['#3f3f46', '#18181b'] },
  glowstoneDust: { name: 'Glowstone Dust', icon: 'dust', c: ['#fde68a', '#d97706'] },
  // mob drops
  string: { name: 'String', icon: 'string', c: ['#f5f5f5'] },
  feather: { name: 'Feather', icon: 'feather', c: ['#fafafa', '#cbd5e1'] },
  leather: { name: 'Leather', icon: 'leather', c: ['#a0522d', '#6b3410'] },
  bone: { name: 'Bone', icon: 'bone', c: ['#f1eee3', '#c8c2ad'] },
  gunpowder: { name: 'Gunpowder', icon: 'dust', c: ['#6b6b6b', '#3f3f3f'] },
  rottenFlesh: { name: 'Rotten Flesh', icon: 'flesh', c: ['#a2643a', '#5e7a2c'], food: { heal: 6, hunger: 0.8 } },
  slimeball: { name: 'Slimeball', icon: 'ball', c: ['#7bd36b', '#3f8f32'] },
  enderPearl: { name: 'Ender Pearl', icon: 'pearl', c: ['#1f6f63', '#7ee0c8'] },
  blazeRod: { name: 'Blaze Rod', icon: 'rod', c: ['#fbbf24', '#f97316'], fuel: 12 },
  blazePowder: { name: 'Blaze Powder', icon: 'dust', c: ['#fbbf24', '#ea580c'] },
  ghastTear: { name: 'Ghast Tear', icon: 'tear', c: ['#e0f2fe', '#7dd3fc'] },
  magmaCream: { name: 'Magma Cream', icon: 'ball', c: ['#f97316', '#facc15'] },
  paper: { name: 'Paper', icon: 'paper', c: ['#f8fafc', '#cbd5e1'] },
  wheat: { name: 'Wheat', icon: 'wheat', c: ['#e9c46a', '#b08a2e'] },
  sugarCane: { name: 'Sugar Cane', icon: 'wheat', c: ['#86d06a', '#3f8f32'] },
  book: { name: 'Book', icon: 'book', c: ['#8b4513', '#f8fafc'] },
  // food
  apple: { name: 'Apple', icon: 'apple', c: ['#e11d48', '#7c2d12'], food: { heal: 12 } },
  bread: { name: 'Bread', icon: 'bread', c: ['#d4a056', '#8a5a1e'], food: { heal: 25 } },
  // progression
  eyeOfEnder: { name: 'Eye of Ender', icon: 'eye', c: ['#2f855a', '#a3e635'], use: 'eye', desc: 'Throw it: it flies toward the Stronghold. Put twelve-ish into an End Portal frame.' },
  dragonEgg: { name: 'Dragon Egg', icon: 'egg', c: ['#1a0b2e', '#7c3aed'], desc: 'Proof. +25% damage, +25 max HP while you carry it.' },
  // tools (held in the inventory; the best pickaxe is used automatically)
  woodPickaxe: { name: 'Wooden Pickaxe', icon: 'pick', c: ['#b8945f'], pick: 1, mine: 1.5 },
  stonePickaxe: { name: 'Stone Pickaxe', icon: 'pick', c: ['#8a8a8a'], pick: 2, mine: 2 },
  goldPickaxe: { name: 'Golden Pickaxe', icon: 'pick', c: ['#fde047'], pick: 1, mine: 4 },
  ironPickaxe: { name: 'Iron Pickaxe', icon: 'pick', c: ['#e5e5e5'], pick: 3, mine: 2.6 },
  diamondPickaxe: { name: 'Diamond Pickaxe', icon: 'pick', c: ['#67e8f9'], pick: 4, mine: 3.4 },
  flintAndSteel: { name: 'Flint and Steel', icon: 'flintsteel', c: ['#d4d4d8', '#3f3f46'], desc: 'Lights a Nether Portal frame.' },
  torch: { name: 'Torch', icon: 'torch', c: ['#8f7040', '#fbbf24'], desc: 'Carrying torches lights up the area around Alex.' },
  // placeables
  craftingTable: { name: 'Crafting Table', icon: 'table', c: ['#b8945f', '#6b4f2a'], place: 'craftingTable', desc: 'Place it to craft with the full 3×3 grid.' },
  furnace: { name: 'Furnace', icon: 'furnace', c: ['#7b7b7b', '#3a3a3a'], place: 'furnace', desc: 'Place it to smelt ores, sand and logs. Burns coal, wood or blaze rods.' },
  enchantingTable: { name: 'Enchanting Table', icon: 'enchant', c: ['#1b1029', '#dc2626'], place: 'enchantingTable', desc: 'Place it, then spend XP levels and lapis on enchantments.' },
  bed: { name: 'Bed', icon: 'bed', c: ['#dc2626', '#f8fafc'], use: 'bed', desc: 'Sleep: heal 60. Do not try this in the Nether or the End.' },
};
export const MC_IDS = Object.keys(MC);

// Crafted items that turn straight into game gear (run.grant), vehicles or gadgets.
export const MC_GEAR = {
  woodSword: { name: 'Wooden Sword', icon: 'sword', c: ['#b8945f'], grant: 'w:woodSword' },
  stoneSword: { name: 'Stone Sword', icon: 'sword', c: ['#8a8a8a'], grant: 'w:stoneSword' },
  ironSword: { name: 'Iron Sword', icon: 'sword', c: ['#e5e5e5'], grant: 'w:ironSword' },
  diamondSword: { name: 'Diamond Sword', icon: 'sword', c: ['#67e8f9'], grant: 'w:diamondSword' },
  bow: { name: 'Bow', icon: 'bow', c: ['#8f7040', '#f5f5f5'], grant: 'w:bow' },
  leatherTunic: { name: 'Leather Tunic', icon: 'chest', c: ['#a0522d'], grant: 'leatherTunic' },
  ironChestplate: { name: 'Iron Chestplate', icon: 'chest', c: ['#e5e5e5'], grant: 'ironArmor' },
  ironHelmet: { name: 'Iron Helmet', icon: 'helmet', c: ['#e5e5e5'], grant: 'ironHelmet' },
  goldHelmet: { name: 'Golden Helmet', icon: 'helmet', c: ['#fde047'], grant: 'goldHelmet' },
  diamondChestplate: { name: 'Diamond Chestplate', icon: 'chest', c: ['#67e8f9'], grant: 'diamondArmor' },
  diamondHelmet: { name: 'Diamond Helmet', icon: 'helmet', c: ['#67e8f9'], grant: 'diamondHelmet' },
  shield: { name: 'Shield', icon: 'shield', c: ['#b8945f', '#9ca3af'], grant: 'mcShield' },
  goldenApple: { name: 'Golden Apple', icon: 'gapple', c: ['#fde047', '#ca8a04'], grant: 'goldenApple' },
  tnt: { name: 'TNT', icon: 'tnt', c: ['#dc2626', '#f8fafc'], grant: 'g:tnt' },
  minecart: { name: 'Minecart', icon: 'minecart', c: ['#9ca3af', '#4b5563'], vehicle: 'minecart' },
};
export const mcInfo = (id) => MC[id] || MC_GEAR[id] || null;

// ---------------------------------------------------------------------------- recipes
// shape: rows of key letters (' ' = empty); mirrored shapes also match, and a shape
// can sit anywhere in the grid. shapeless: the exact multiset of ingredients.
const P = 'oakPlanks', S = 'stick', C = 'cobblestone', I = 'ironIngot', Gd = 'goldIngot', D = 'diamond';
const tool = (out, m) => ({ out, shape: ['MMM', ' S ', ' S '], key: { M: m, S } });
const sword = (out, m) => ({ out, shape: ['M', 'M', 'S'], key: { M: m, S } });
export const RECIPES = [
  { out: 'oakPlanks', n: 4, shapeless: ['oakLog'] },
  { out: 'stick', n: 4, shape: ['P', 'P'], key: { P } },
  { out: 'craftingTable', shape: ['PP', 'PP'], key: { P } },
  { out: 'furnace', shape: ['CCC', 'C C', 'CCC'], key: { C } },
  { out: 'torch', n: 4, shape: ['K', 'S'], key: { K: 'coal', S } },
  { out: 'torch', n: 4, shape: ['K', 'S'], key: { K: 'charcoal', S } },
  tool('woodPickaxe', P), tool('stonePickaxe', C), tool('ironPickaxe', I), tool('goldPickaxe', Gd), tool('diamondPickaxe', D),
  sword('woodSword', P), sword('stoneSword', C), sword('ironSword', I), sword('diamondSword', D),
  { out: 'bow', shape: [' TX', 'T X', ' TX'], key: { T: S, X: 'string' } },
  { out: 'leatherTunic', shape: ['L L', 'LLL', 'LLL'], key: { L: 'leather' } },
  { out: 'ironChestplate', shape: ['I I', 'III', 'III'], key: { I } },
  { out: 'diamondChestplate', shape: ['D D', 'DDD', 'DDD'], key: { D } },
  { out: 'ironHelmet', shape: ['III', 'I I'], key: { I } },
  { out: 'goldHelmet', shape: ['GGG', 'G G'], key: { G: Gd } },
  { out: 'diamondHelmet', shape: ['DDD', 'D D'], key: { D } },
  { out: 'shield', shape: ['WIW', 'WWW', ' W '], key: { W: P, I } },
  { out: 'flintAndSteel', shapeless: [I, 'flint'] },
  { out: 'minecart', shape: ['I I', 'III'], key: { I } },
  { out: 'tnt', shape: ['GSG', 'SGS', 'GSG'], key: { G: 'gunpowder', S: 'sand' } },
  { out: 'goldenApple', shape: ['GGG', 'GAG', 'GGG'], key: { G: Gd, A: 'apple' } },
  { out: 'bread', shape: ['WWW'], key: { W: 'wheat' } },
  { out: 'goldIngot', shape: ['NNN', 'NNN', 'NNN'], key: { N: 'goldNugget' } },
  { out: 'blazePowder', n: 2, shapeless: ['blazeRod'] },
  { out: 'eyeOfEnder', shapeless: ['enderPearl', 'blazePowder'] },
  { out: 'book', shapeless: ['paper', 'paper', 'paper', 'leather'] },
  { out: 'paper', n: 3, shape: ['SSS'], key: { S: 'sugarCane' } },
  { out: 'enchantingTable', shape: [' B ', 'DOD', 'OOO'], key: { B: 'book', D, O: 'obsidian' } },
  { out: 'bed', shape: ['WWW', 'PPP'], key: { W: 'wool', P } },
  { out: 'wool', shape: ['SS', 'SS'], key: { S: 'string' } },
];

// Normalise a grid (array of ids or null, row-major, size w×h) to its bounding box.
function trim(grid, w) {
  const h = grid.length / w;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const rows = [];
  for (let y = y0; y <= y1; y++) { const r = []; for (let x = x0; x <= x1; x++) r.push(grid[y * w + x] || null); rows.push(r); }
  return rows;
}
function shapeRows(rec) { return rec.shape.map((row) => [...row].map((ch) => (ch === ' ' ? null : rec.key[ch]))); }
function rowsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    if (a[y].length !== b[y].length) return false;
    for (let x = 0; x < a[y].length; x++) if ((a[y][x] || null) !== (b[y][x] || null)) return false;
  }
  return true;
}
// Pad ragged recipe rows (e.g. ['K','S'] or ['III','I I']) to a rectangle.
function rect(rows) { const w = Math.max(...rows.map((r) => r.length)); return rows.map((r) => [...r, ...Array(w - r.length).fill(null)]); }

// Which recipe (if any) the grid currently makes. w = 2 (pocket) or 3 (table).
export function matchRecipe(grid, w = 3) {
  const t = trim(grid, w);
  if (!t) return null;
  const items = grid.filter(Boolean).sort();
  for (const rec of RECIPES) {
    if (rec.shapeless) {
      const want = rec.shapeless.slice().sort();
      if (want.length === items.length && want.every((v, i) => v === items[i])) return rec;
      continue;
    }
    const r = rect(shapeRows(rec));
    if (r.length > w || r[0].length > w) continue;
    if (rowsEqual(t, r) || rowsEqual(t, r.map((row) => row.slice().reverse()))) return rec;
  }
  return null;
}

// Ingredients a recipe needs, as { id: count }.
export function recipeCost(rec) {
  const need = {};
  const list = rec.shapeless || rec.shape.join('').split('').filter((ch) => ch !== ' ').map((ch) => rec.key[ch]);
  for (const id of list) need[id] = (need[id] || 0) + 1;
  return need;
}
export function canAfford(inv, rec, times = 1) {
  const need = recipeCost(rec);
  return Object.entries(need).every(([id, n]) => (inv[id] || 0) >= n * times);
}
export const recipeFits = (rec, w) => (rec.shapeless ? rec.shapeless.length <= w * w : rec.shape.length <= w && Math.max(...rec.shape.map((r) => r.length)) <= w);
// Lay a recipe into an empty grid (the recipe book's auto-fill).
export function layout(rec, w = 3) {
  const grid = Array(w * w).fill(null);
  if (rec.shapeless) { rec.shapeless.forEach((id, i) => { grid[i] = id; }); return grid; }
  const r = rect(shapeRows(rec));
  for (let y = 0; y < r.length; y++) for (let x = 0; x < r[y].length; x++) grid[y * w + x] = r[y][x];
  return grid;
}

// ---------------------------------------------------------------------------- smelting
export const SMELT = { rawIron: 'ironIngot', rawGold: 'goldIngot', sand: 'glass', oakLog: 'charcoal', netherrack: 'quartz', rottenFlesh: 'leather' };
export const SMELT_XP = { rawIron: 0.7, rawGold: 1, sand: 0.1, oakLog: 0.15, netherrack: 0.2, rottenFlesh: 0.1 };
export const fuelValue = (id) => MC[id]?.fuel || 0;

// ---------------------------------------------------------------------------- XP levels
// Minecraft's own curve: points needed to go from level L to L+1.
export function xpToNext(L) { return L < 16 ? 2 * L + 7 : L < 31 ? 5 * L - 38 : 9 * L - 158; }
export function levelFromXp(points) {
  let L = 0, p = points;
  while (p >= xpToNext(L)) { p -= xpToNext(L); L++; }
  return { level: L, into: p, need: xpToNext(L), frac: p / xpToNext(L) };
}
export function xpForLevel(L) { let s = 0; for (let i = 0; i < L; i++) s += xpToNext(i); return s; }

// ---------------------------------------------------------------------------- enchanting
export const ENCHANTS = {
  sharpness: { name: 'Sharpness', icon: '⚔️', mods: { meleeMul: 1.15 }, max: 5 },
  power: { name: 'Power', icon: '🏹', mods: { rangedMul: 1.15 }, max: 5 },
  protection: { name: 'Protection', icon: '🛡️', mods: { dmgTakenMul: 0.92 }, max: 4 },
  efficiency: { name: 'Efficiency', icon: '⛏️', mods: { mineMul: 1.5 }, max: 5 },
  fortune: { name: 'Fortune', icon: '🍀', mods: { mcFortune: 1 }, max: 3 },
  looting: { name: 'Looting', icon: '💰', mods: { mcLoot: 1, moneyMul: 1.08 }, max: 3 },
  featherFalling: { name: 'Feather Falling', icon: '🪶', mods: { dashRechargeMul: 1.08 }, max: 4 },
  mending: { name: 'Mending', icon: '💚', mods: { clearHeal: 3 }, max: 1 },
  fireAspect: { name: 'Fire Aspect', icon: '🔥', mods: { fireAspect: 1 }, max: 2 },
  unbreaking: { name: 'Unbreaking', icon: '🔩', mods: { maxHp: 6 }, max: 3 },
};
// Three offers like the real table: cost 1, 2 and 3 levels (and as many lapis).
export function rollEnchantOffers(rng, owned = {}) {
  const ids = Object.keys(ENCHANTS).filter((k) => (owned[k] || 0) < ENCHANTS[k].max);
  const pick = [];
  const pool = ids.slice();
  for (let i = 0; i < 3 && pool.length; i++) pick.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return pick.map((id, i) => ({ id, cost: i + 1, lapis: i + 1, level: Math.min(ENCHANTS[id].max, (owned[id] || 0) + 1) }));
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export const roman = (n) => ROMAN[n] || String(n);

// ---------------------------------------------------------------------------- blocks in the world
// tier: pickaxe needed to get the drop (0 = hand). hp: hits to break scale with tool.
export const ORES = {
  log: { name: 'Oak Log', hp: 30, tier: 0, drop: [['oakLog', 1, 1, 1]], c: ['#6b4f2a', '#b8945f'], tex: 'log', xp: 0 },
  leaves: { name: 'Oak Leaves', hp: 6, tier: 0, drop: [['apple', 0.18, 1, 1], ['stick', 0.35, 1, 2]], c: ['#3f8f32', '#2f6b25'], tex: 'leaves', xp: 0, soft: true },
  grass: { name: 'Grass Block', hp: 14, tier: 0, drop: [['dirt', 1, 1, 1], ['wheat', 0.15, 1, 1]], c: ['#5bb450', '#8b5a2b'], tex: 'grass', xp: 0 },
  dirt: { name: 'Dirt', hp: 12, tier: 0, drop: [['dirt', 1, 1, 1]], c: ['#8b5a2b', '#6e4520'], tex: 'dirt', xp: 0 },
  sand: { name: 'Sand', hp: 12, tier: 0, drop: [['sand', 1, 1, 2], ['sugarCane', 0.3, 1, 2]], c: ['#e2d39c', '#cdbd84'], tex: 'sand', xp: 0 },
  gravel: { name: 'Gravel', hp: 14, tier: 0, drop: [['flint', 0.4, 1, 1], ['gravel', 0.6, 1, 1]], c: ['#857f7c', '#6b6563'], tex: 'gravel', xp: 0 },
  stone: { name: 'Stone', hp: 40, tier: 1, drop: [['cobblestone', 1, 1, 1]], c: ['#7b7b7b', '#6a6a6a'], tex: 'stone', xp: 0 },
  coalOre: { name: 'Coal Ore', hp: 45, tier: 1, drop: [['coal', 1, 1, 2]], c: ['#7b7b7b', '#1f1f1f'], tex: 'ore', xp: 1 },
  ironOre: { name: 'Iron Ore', hp: 55, tier: 2, drop: [['rawIron', 1, 1, 2]], c: ['#7b7b7b', '#d8af93'], tex: 'ore', xp: 1 },
  goldOre: { name: 'Gold Ore', hp: 60, tier: 3, drop: [['rawGold', 1, 1, 2]], c: ['#7b7b7b', '#f8d74a'], tex: 'ore', xp: 2 },
  lapisOre: { name: 'Lapis Ore', hp: 55, tier: 2, drop: [['lapis', 1, 3, 6]], c: ['#7b7b7b', '#3b5bdb'], tex: 'ore', xp: 3 },
  redstoneOre: { name: 'Redstone Ore', hp: 60, tier: 3, drop: [['redstone', 1, 3, 5]], c: ['#7b7b7b', '#ef4444'], tex: 'ore', xp: 2 },
  diamondOre: { name: 'Diamond Ore', hp: 70, tier: 3, drop: [['diamond', 1, 1, 1]], c: ['#7b7b7b', '#67e8f9'], tex: 'ore', xp: 6 },
  emeraldOre: { name: 'Emerald Ore', hp: 70, tier: 3, drop: [['emerald', 1, 1, 1]], c: ['#7b7b7b', '#34d399'], tex: 'ore', xp: 5 },
  obsidian: { name: 'Obsidian', hp: 220, tier: 4, drop: [['obsidian', 1, 1, 1]], c: ['#1b1029', '#3b2468'], tex: 'obsidian', xp: 0 },
  netherrack: { name: 'Netherrack', hp: 18, tier: 1, drop: [['netherrack', 1, 1, 1]], c: ['#6e2b2b', '#4f1c1c'], tex: 'stone', xp: 0 },
  quartzOre: { name: 'Nether Quartz Ore', hp: 40, tier: 1, drop: [['quartz', 1, 1, 2]], c: ['#6e2b2b', '#f1ece4'], tex: 'ore', xp: 3 },
  netherGoldOre: { name: 'Nether Gold Ore', hp: 40, tier: 1, drop: [['goldNugget', 1, 2, 6]], c: ['#6e2b2b', '#fde047'], tex: 'ore', xp: 1 },
  glowstone: { name: 'Glowstone', hp: 10, tier: 0, drop: [['glowstoneDust', 1, 2, 4]], c: ['#fde68a', '#d97706'], tex: 'glow', xp: 0, light: '#fbbf24' },
  soulSand: { name: 'Soul Sand', hp: 14, tier: 0, drop: [['soulSand', 1, 1, 1]], c: ['#54402f', '#3f2f22'], tex: 'sand', xp: 0 },
  netherBrick: { name: 'Nether Bricks', hp: 80, tier: 1, drop: [['netherrack', 0.5, 1, 1]], c: ['#2c1418', '#4a2228'], tex: 'brick', xp: 0 },
  stoneBrick: { name: 'Stone Bricks', hp: 80, tier: 1, drop: [['cobblestone', 1, 1, 1]], c: ['#7a7a7a', '#5e5e5e'], tex: 'brick', xp: 0 },
  endStone: { name: 'End Stone', hp: 50, tier: 1, drop: [['cobblestone', 0.5, 1, 1]], c: ['#e8e4a8', '#cfc98a'], tex: 'stone', xp: 0 },
  crimsonStem: { name: 'Crimson Stem', hp: 30, tier: 0, drop: [['oakLog', 1, 1, 1]], c: ['#5c1f2e', '#8a2a3f'], tex: 'log', xp: 0 },
  warpedStem: { name: 'Warped Stem', hp: 30, tier: 0, drop: [['oakLog', 1, 1, 1]], c: ['#1f4f4a', '#3a8a7f'], tex: 'log', xp: 0 },
  netherWart: { name: 'Nether Wart Block', hp: 8, tier: 0, drop: [['stick', 0.25, 1, 1]], c: ['#8a1a1a', '#5a0f0f'], tex: 'leaves', xp: 0, soft: true },
  warpedWart: { name: 'Warped Wart Block', hp: 8, tier: 0, drop: [['stick', 0.25, 1, 1]], c: ['#167a72', '#0f5a55'], tex: 'leaves', xp: 0, soft: true },
  shroomlight: { name: 'Shroomlight', hp: 8, tier: 0, drop: [['glowstoneDust', 1, 1, 2]], c: ['#fdba74', '#ea580c'], tex: 'glow', xp: 0 },
  boneBlock: { name: 'Bone Block', hp: 40, tier: 1, drop: [['bone', 1, 2, 4]], c: ['#e8e3d0', '#cfc9b3'], tex: 'stone', xp: 0 },
  basalt: { name: 'Basalt', hp: 50, tier: 1, drop: [['cobblestone', 0.6, 1, 1]], c: ['#4a4a52', '#2f2f36'], tex: 'log', xp: 0 },
  blackstone: { name: 'Blackstone', hp: 60, tier: 1, drop: [['cobblestone', 1, 1, 1]], c: ['#2a2629', '#3d383c'], tex: 'stone', xp: 0 },
  goldBlock: { name: 'Block of Gold', hp: 60, tier: 2, drop: [['goldIngot', 1, 3, 5]], c: ['#fde047', '#facc15'], tex: 'stone', xp: 2 },
};

// Ore mix by depth. Floor 1 is the surface; floor 3 is diamond country.
export const ORE_WEIGHTS = {
  1: { stone: 10, coalOre: 7, ironOre: 4, lapisOre: 1, goldOre: 0.8, diamondOre: 0.35, gravel: 2, sand: 2 },
  2: { stone: 8, coalOre: 5, ironOre: 5, lapisOre: 2.5, goldOre: 2, redstoneOre: 2.5, diamondOre: 0.8, emeraldOre: 0.4, gravel: 1.5, sand: 1.5 },
  3: { stone: 7, coalOre: 3, ironOre: 4, lapisOre: 2.5, goldOre: 3, redstoneOre: 3, diamondOre: 1.6, emeraldOre: 0.8, obsidian: 1.2, gravel: 1 },
  nether: { netherrack: 10, quartzOre: 4, netherGoldOre: 4, glowstone: 2, soulSand: 3 },
};

// The pickaxe Alex has (best one in the inventory).
export function bestPick(inv) {
  let best = { tier: 0, mine: 1, id: null };
  for (const id of ['woodPickaxe', 'goldPickaxe', 'stonePickaxe', 'ironPickaxe', 'diamondPickaxe']) {
    if ((inv[id] || 0) > 0 && (MC[id].pick > best.tier || (MC[id].pick === best.tier && MC[id].mine > best.mine))) best = { tier: MC[id].pick, mine: MC[id].mine, id };
  }
  return best;
}

// ---------------------------------------------------------------------------- drop tables
// [id, chance, min, max]
const T = (...rows) => rows;
export const DROPS = {
  // venue demons
  lurker: T(['stick', 0.5, 1, 2], ['string', 0.35, 1, 2], ['glowstoneDust', 0.12, 1, 1]),
  photocard: T(['paper', 0.75, 1, 3], ['leather', 0.15, 1, 1]),
  biasBeast: T(['leather', 0.55, 1, 2], ['bone', 0.35, 1, 2]),
  queue: T(['string', 0.7, 1, 3], ['ironIngot', 0.15, 1, 1]),
  mimic: T(['oakPlanks', 0.85, 2, 4], ['goldIngot', 0.3, 1, 2], ['diamond', 0.06, 1, 1]),
  fancam: T(['glass', 0.5, 1, 2], ['redstone', 0.55, 1, 3]),
  stalker: T(['coal', 0.45, 1, 2], ['enderPearl', 0.18, 1, 1], ['obsidian', 0.1, 1, 1]),
  hoarder: T(['paper', 0.6, 2, 4], ['goldNugget', 0.55, 2, 5], ['lapis', 0.25, 1, 3]),
  chanter: T(['lapis', 0.45, 1, 3], ['glowstoneDust', 0.3, 1, 2]),
  ultBias: T(['diamond', 0.25, 1, 1], ['goldIngot', 0.55, 1, 2]),
  akgae: T(['coal', 0.6, 1, 3], ['flint', 0.3, 1, 1]),
  parasocial: T(['string', 0.7, 1, 3], ['slimeball', 0.3, 1, 1]),
  queen: T(['goldIngot', 0.6, 1, 3], ['emerald', 0.3, 1, 1]),
  fanwar: T(['flint', 0.45, 1, 2], ['gunpowder', 0.35, 1, 1]),
  soloStan: T(['flint', 0.3, 1, 1], ['string', 0.3, 1, 1]),
  delulu: T(['glowstoneDust', 0.6, 1, 3], ['emerald', 0.15, 1, 1], ['diamond', 0.1, 1, 1]),
  // Halo
  grunt: T(['redstone', 0.4, 1, 2], ['gunpowder', 0.3, 1, 1]),
  jackal: T(['feather', 0.45, 1, 2], ['ironIngot', 0.2, 1, 1]),
  elite: T(['redstone', 0.5, 1, 3], ['ironIngot', 0.35, 1, 2], ['diamond', 0.1, 1, 1]),
  hunter: T(['ironIngot', 0.9, 2, 5], ['diamond', 0.25, 1, 2], ['obsidian', 0.3, 1, 2]),
  // Minecraft (the real deal)
  zombie: T(['rottenFlesh', 0.9, 1, 2], ['rawIron', 0.1, 1, 1], ['ironIngot', 0.05, 1, 1]),
  skeleton: T(['bone', 0.9, 1, 2], ['flint', 0.2, 1, 1], ['string', 0.15, 1, 1]),
  creeper: T(['gunpowder', 0.95, 1, 2]),
  enderman: T(['enderPearl', 0.85, 1, 1]),
  spider: T(['string', 0.9, 1, 2], ['bone', 0.1, 1, 1]),
  silverfish: T(['cobblestone', 0.3, 1, 1]),
  piglin: T(['rottenFlesh', 0.8, 1, 2], ['goldNugget', 0.8, 1, 3], ['goldIngot', 0.12, 1, 1]),
  ghast: T(['ghastTear', 0.6, 1, 1], ['gunpowder', 0.9, 1, 2]),
  blaze: T(['blazeRod', 0.8, 1, 2]),
  magmaCube: T(['magmaCream', 0.5, 1, 1]),
  witherSkeleton: T(['coal', 0.7, 1, 2], ['bone', 0.7, 1, 2]),
  // One Piece
  marine: T(['gunpowder', 0.4, 1, 2], ['ironIngot', 0.2, 1, 1], ['bread', 0.2, 1, 1]),
  fishman: T(['bone', 0.4, 1, 2], ['lapis', 0.3, 1, 2], ['sugarCane', 0.4, 1, 3]),
  pacifista: T(['ironIngot', 0.9, 2, 4], ['redstone', 0.9, 2, 5], ['diamond', 0.2, 1, 1]),
  seaKing: T(['bone', 0.9, 3, 6], ['leather', 0.8, 2, 4], ['diamond', 0.3, 1, 2]),
  // Pokémon (real-time rift versions)
  pikachew: T(['redstone', 0.6, 1, 3], ['goldNugget', 0.3, 1, 2]),
  gastlee: T(['glowstoneDust', 0.35, 1, 2], ['enderPearl', 0.12, 1, 1]),
  magikrap: T(['bone', 0.3, 1, 1], ['string', 0.2, 1, 1]),
  gyarados: T(['diamond', 0.35, 1, 2], ['lapis', 0.8, 2, 5], ['leather', 0.6, 1, 3]),
  snorelax: T(['bread', 0.9, 2, 4], ['apple', 0.9, 2, 4], ['wool', 0.5, 1, 2]),
  // The Bible
  frog: T(['slimeball', 0.5, 1, 1]),
  locust: T(['wheat', 0.45, 1, 2]),
  charioteer: T(['goldIngot', 0.4, 1, 2], ['leather', 0.5, 1, 2], ['oakPlanks', 0.4, 1, 3]),
  goldenCalf: T(['goldIngot', 0.95, 3, 6], ['goldNugget', 0.9, 4, 9]),
  goliath: T(['ironIngot', 0.95, 3, 6], ['diamond', 0.5, 1, 3]),
  // bosses
  boss1: T(['diamond', 1, 2, 3], ['ironIngot', 1, 3, 6], ['goldIngot', 1, 2, 4]),
  member: T(['diamond', 0.5, 1, 1], ['emerald', 0.5, 1, 1], ['lapis', 0.6, 2, 4]),
  boss3: T(['diamond', 1, 4, 6], ['obsidian', 1, 4, 8], ['emerald', 1, 2, 4]),
  _default: T(['cobblestone', 0.3, 1, 2], ['coal', 0.2, 1, 1]),
};
// Pokémon drop by their primary type.
export const TYPE_DROPS = {
  fire: T(['coal', 0.5, 1, 2], ['blazePowder', 0.1, 1, 1]), water: T(['lapis', 0.4, 1, 2], ['sand', 0.3, 1, 2]),
  grass: T(['oakLog', 0.5, 1, 2], ['apple', 0.3, 1, 1], ['wheat', 0.3, 1, 2], ['sugarCane', 0.25, 1, 2]), electric: T(['redstone', 0.6, 1, 3]),
  rock: T(['cobblestone', 0.7, 1, 3], ['flint', 0.3, 1, 1], ['rawIron', 0.2, 1, 1]), ground: T(['dirt', 0.6, 1, 3], ['sand', 0.4, 1, 2], ['flint', 0.2, 1, 1]),
  ghost: T(['glowstoneDust', 0.3, 1, 2], ['enderPearl', 0.12, 1, 1]), psychic: T(['enderPearl', 0.15, 1, 1], ['lapis', 0.3, 1, 2]),
  bug: T(['string', 0.75, 1, 2]), flying: T(['feather', 0.85, 1, 2]), poison: T(['slimeball', 0.45, 1, 1]),
  normal: T(['leather', 0.4, 1, 1], ['wool', 0.3, 1, 1]), fighting: T(['bone', 0.45, 1, 2], ['ironIngot', 0.1, 1, 1]),
  ice: T(['glass', 0.35, 1, 1]), dragon: T(['diamond', 0.15, 1, 1], ['obsidian', 0.12, 1, 1]), steel: T(['ironIngot', 0.6, 1, 2]),
  dark: T(['coal', 0.5, 1, 2], ['obsidian', 0.05, 1, 1]), fairy: T(['glowstoneDust', 0.4, 1, 2], ['lapis', 0.3, 1, 1]),
};
// Props, by their model.
const metal = T(['ironIngot', 0.9, 1, 3], ['glass', 0.7, 1, 2], ['redstone', 0.4, 1, 2], ['coal', 0.3, 1, 1]);
export const PROP_DROPS = {
  car: metal, bus: T(['ironIngot', 1, 3, 5], ['glass', 1, 2, 4], ['redstone', 0.6, 1, 3]), truck: T(['ironIngot', 1, 2, 4], ['oakPlanks', 0.5, 1, 3]),
  crate: T(['oakPlanks', 0.9, 2, 4], ['stick', 0.5, 1, 3], ['apple', 0.12, 1, 1]), table: T(['oakPlanks', 0.8, 1, 3], ['stick', 0.4, 1, 2]),
  chair: T(['stick', 0.8, 1, 2], ['oakPlanks', 0.3, 1, 1]), tent: T(['wool', 0.7, 1, 3], ['stick', 0.6, 1, 3], ['string', 0.5, 1, 2]),
  cooler: T(['apple', 0.4, 1, 2], ['bread', 0.3, 1, 1]), speaker: T(['redstone', 0.8, 1, 3], ['ironIngot', 0.4, 1, 1], ['oakPlanks', 0.3, 1, 2]),
  barrier: T(['cobblestone', 0.8, 1, 3]), pillar: T(['cobblestone', 0.9, 2, 4]), planter: T(['dirt', 0.9, 1, 3], ['oakLog', 0.35, 1, 1], ['apple', 0.2, 1, 1], ['sugarCane', 0.4, 1, 2]),
  rack: T(['wool', 0.8, 1, 3], ['string', 0.5, 1, 2], ['ironIngot', 0.2, 1, 1]), shirtwall: T(['wool', 0.8, 1, 3], ['string', 0.5, 1, 2]),
  toilet: T(['paper', 0.85, 1, 3], ['glass', 0.3, 1, 1]), mannequin: T(['leather', 0.5, 1, 1], ['wool', 0.4, 1, 1]),
  roadcase: T(['ironIngot', 0.5, 1, 1], ['oakPlanks', 0.6, 1, 2], ['redstone', 0.3, 1, 2]), console: T(['redstone', 0.9, 2, 4], ['glass', 0.4, 1, 1], ['goldNugget', 0.3, 1, 2]),
  cabinet: T(['ironIngot', 0.6, 1, 2], ['paper', 0.5, 1, 3]), desk: T(['oakPlanks', 0.8, 2, 3], ['paper', 0.5, 1, 2]),
  kiosk: T(['oakPlanks', 0.7, 1, 3], ['redstone', 0.4, 1, 2]), stall: T(['oakPlanks', 0.7, 1, 3], ['wool', 0.3, 1, 2], ['bread', 0.2, 1, 1]),
  bigheart: T(['wool', 0.6, 1, 3], ['goldNugget', 0.4, 1, 3]), bigstar: T(['wool', 0.6, 1, 3], ['glowstoneDust', 0.5, 1, 2]),
  shelf: T(['oakPlanks', 0.8, 2, 4], ['paper', 0.4, 1, 2]), counter: T(['oakPlanks', 0.7, 1, 3]), couch: T(['wool', 0.8, 2, 3], ['leather', 0.4, 1, 1]),
  truss: T(['ironIngot', 0.7, 1, 2]), turnstile: T(['ironIngot', 0.7, 1, 1]), vanity: T(['glass', 0.7, 1, 2], ['paper', 0.3, 1, 1]),
  fountain: T(['cobblestone', 0.7, 1, 2], ['sand', 0.4, 1, 2]), corral: T(['ironIngot', 0.6, 1, 2]), block: T(['cobblestone', 0.3, 1, 1]),
  _default: T(['cobblestone', 0.35, 1, 1], ['stick', 0.3, 1, 1]),
};

// Roll a drop table. bonus = Looting/Fortune levels (each adds a roll chance and +1 max).
export function rollDrops(table, rng, bonus = 0) {
  const out = [];
  for (const [id, chance, min, max] of table || []) {
    if (rng() >= Math.min(1, chance * (1 + bonus * 0.25))) continue;
    const n = min + Math.floor(rng() * (max + bonus - min + 1));
    if (n > 0) out.push([id, n]);
  }
  return out;
}
export function dropTableFor(kind, key, extra) {
  if (kind === 'prop') return PROP_DROPS[key] || PROP_DROPS._default;
  if (kind === 'ore') return ORES[key]?.drop || [];
  if (kind === 'pokemon') return TYPE_DROPS[extra] || TYPE_DROPS.normal;
  return DROPS[key] || DROPS._default;
}

// XP orbs from killing something with the given threat value.
export const xpForKill = (threat = 1, boss = false) => (boss ? 60 : Math.max(1, Math.round(threat * 3)));

// ---------------------------------------------------------------------------- portals
export const PORTAL_OBSIDIAN = 10;     // the minimum frame (no corners), like the real thing
export const END_FRAME_SLOTS = 12;
// How many frames already hold an eye when you find the portal (each 10 % in Minecraft;
// a little kinder here so a run can finish).
export function prefilledEyes(rng) { let n = 0; for (let i = 0; i < END_FRAME_SLOTS; i++) if (rng() < 0.4) n++; return Math.min(n, 9); }
