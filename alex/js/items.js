// Item catalogue. Categories follow the Gas Station sections:
// counter (healing / temporary buffs / utility), snack (small passives),
// locked (weapons), backwall (major run upgrades). Pure data + mod math.

import { MELEE, RANGED } from './combat/weapons.js';
import { RIFTS } from './world/rifts.js';

export const ITEMS = {
  // --- Counter ($5–15) --------------------------------------------------------
  energyDrink: { cat: 'counter', name: 'Energy Drink', icon: '🥤', price: 8, desc: '+15% movement speed for the next 4 rooms.', timed: { rooms: 4, mods: { moveMul: 1.15 } } },
  sushi: { cat: 'counter', name: 'Gas Station Sushi', icon: '🍣', price: 5, desc: 'Heals a lot. Small chance of a temporary debuff.', heal: 45, poisonChance: 0.25 },
  hotdog: { cat: 'counter', name: 'Roller Grill Hot Dog', icon: '🌭', price: 9, desc: 'Heals 30. Has been rolling since 2019.', heal: 30 },
  bandages: { cat: 'counter', name: 'Bandage Multipack', icon: '🩹', price: 12, desc: 'Heals 60.', heal: 60 },
  jerky: { cat: 'counter', name: 'Beef Jerky', icon: '🥩', price: 7, desc: '+20% melee damage for the next 3 rooms.', timed: { rooms: 3, mods: { meleeMul: 1.2 } } },
  protein: { cat: 'counter', name: 'Suspicious Protein Shake', icon: '🧃', price: 12, desc: '+10% damage for the rest of this floor.', timed: { floor: true, mods: { dmgMul: 1.1 } } },
  bathroomKey: { cat: 'counter', name: 'Bathroom Key', icon: '🔑', price: 10, desc: 'Unlocks a one-time hidden room somewhere on this floor.', flag: 'bathroomKey' },
  roadAtlas: { cat: 'counter', name: 'Road Atlas', icon: '🗺️', price: 6, desc: 'Reveals this floor\'s map.', flag: 'atlas' },
  charger: { cat: 'counter', name: 'Portable Charger', icon: '🔋', price: 10, desc: 'Calls ring 3 s longer and you get 50% more time to choose (this floor).', timed: { floor: true, mods: { phoneTime: 1.5 } } },
  mints: { cat: 'counter', name: 'Breath Mints', icon: '🍬', price: 6, desc: 'Confidence! The next relationship loss is cancelled.', flag: 'mints' },
  // --- Snack aisle ($10–25) ---------------------------------------------------
  spicyRamen: { cat: 'snack', name: 'Spicy Ramen Cup', icon: '🍜', price: 14, desc: '+8% melee damage.', mods: { meleeMul: 1.08 } },
  gummies: { cat: 'snack', name: 'Gummy Bears', icon: '🐻', price: 11, desc: '+12% dash recharge speed.', mods: { dashRechargeMul: 1.12 } },
  seeds: { cat: 'snack', name: 'Sunflower Seeds', icon: '🌻', price: 10, desc: '+10% chance for demons to drop money.', mods: { moneyChance: 0.1 } },
  mintGum: { cat: 'snack', name: 'Mint Gum', icon: '🫧', price: 12, desc: 'Perfect-dodge window +40 ms.', mods: { perfectWindow: 0.04 } },
  coffee: { cat: 'snack', name: 'Canned Coffee', icon: '☕', price: 16, desc: '+6% movement speed.', mods: { moveMul: 1.06 } },
  riceCrackers: { cat: 'snack', name: 'Rice Crackers', icon: '🍘', price: 13, desc: '+12% ranged fire rate.', mods: { fireRate: 1.12 } },
  lightstick: { cat: 'snack', name: 'K-Pop Lightstick', icon: '🪄', price: 18, desc: 'Enemies hit by melee attacks are occasionally stunned (12%).', mods: { stunChance: 0.12 } },
  tourShirt: { cat: 'snack', name: 'Bootleg Tour Shirt', icon: '👕', price: 22, desc: '+1 max HP. (The tag was printed in a different unit: +10.) Shirt visibly appears on Alex.', mods: { maxHp: 10 }, shirt: true },
  sunglasses: { cat: 'snack', name: 'Cheap Sunglasses', icon: '🕶️', price: 15, desc: 'Projectiles become slightly easier to see and perfect-dodge timing is more forgiving.', mods: { perfectWindow: 0.03, readable: 1 } },
  bananaMilk: { cat: 'snack', name: 'Banana Milk', icon: '🍌', price: 17, desc: 'Heal 4 HP whenever you clear a room.', mods: { clearHeal: 4 } },
  keychain: { cat: 'snack', name: 'Magnet Keychain', icon: '🧲', price: 12, desc: '+60% money pickup radius.', mods: { magnetMul: 1.6 } },
  // --- Back wall ($30–60) -----------------------------------------------------
  sneakers: { cat: 'backwall', name: 'Spare Sneakers', icon: '👟', price: 45, desc: '+1 dash charge.', mods: { dashCharges: 1 } },
  insoles: { cat: 'backwall', name: 'Spring-Loaded Insoles', icon: '🦘', price: 50, desc: '+1 air dash per jump.', mods: { airDashes: 1 } },
  warranty: { cat: 'backwall', name: 'Extended Warranty', icon: '📜', price: 60, desc: 'Revive once at 50% HP.', mods: { revive: 1 } },
  premiumMic: { cat: 'backwall', name: 'Premium Mic', icon: '🎙️', price: 48, desc: '+20% all damage.', mods: { dmgMul: 1.2 } },
  energyCase: { cat: 'backwall', name: 'Energy Drink Case', icon: '📦', price: 38, desc: '+12% movement speed, permanently.', mods: { moveMul: 1.12 } },
  loyalty: { cat: 'backwall', name: 'Loyalty Card', icon: '💳', price: 30, desc: 'Gas Station prices −25%. +$1 whenever you clear a room.', mods: { priceMul: 0.75, clearMoney: 1 } },
  fangs: { cat: 'backwall', name: 'Halloween Fangs', icon: '🧛', price: 40, desc: 'Melee finishers heal 3 HP.', mods: { lifesteal: 3 } },
  vest: { cat: 'backwall', name: 'Security Vest', icon: '🦺', price: 44, desc: 'Take 15% less damage. Says STAFF. You are not staff.', mods: { dmgTakenMul: 0.85 } },
  // --- Lottery / special only -------------------------------------------------
  goldenStick: { cat: 'special', name: 'Golden Lightstick', icon: '✨', price: 0, desc: '+15% damage. It is actually gold-coloured plastic.', mods: { dmgMul: 1.15 } },
  idolContract: { cat: 'special', name: 'Idol Contract', icon: '📝', price: 0, desc: 'Demons drop double money. Seven-year term.', mods: { moneyMul: 2 } },
  catPhoto: { cat: 'special', name: 'Photo of Cameron\'s Cat', icon: '🐈', price: 0, desc: 'It is staring at you. It does nothing.' },
  // --- Crossover rift loot (also sold by the travelling merchant) --------------------
  overshield: { cat: 'rift', franchise: 'halo', name: 'Overshield', icon: '🛡️', price: 40, desc: '+40 shield that recharges after 4 s without taking damage.', mods: { shield: 40 } },
  spartanArmor: { cat: 'rift', franchise: 'halo', name: 'Spartan Armor (Bootleg)', icon: '🪖', price: 45, desc: 'Take 15% less damage, +20 recharging shield. The visor is a sunglasses lens.', mods: { dmgTakenMul: 0.85, shield: 20 } },
  goldenApple: { cat: 'rift', franchise: 'minecraft', name: 'Golden Apple', icon: '🍎', price: 12, desc: 'Heals 30 and grants 30 absorption shield until the next room.', heal: 30, absorb: 30 },
  ironArmor: { cat: 'rift', franchise: 'minecraft', name: 'Iron Armor', icon: '⛓️', price: 35, desc: 'Take 12% less damage, +10 max HP. Clanks.', mods: { dmgTakenMul: 0.88, maxHp: 10 } },
  gumGum: { cat: 'rift', franchise: 'onepiece', name: 'Gum-Gum Fruit', icon: '🍇', price: 48, desc: 'Your arms stretch: +1.5 m melee reach and longer lunges. Devil Fruit: water attacks hurt double.', mods: { meleeRange: 1.5, devilFruit: 1 }, devilFruit: true },
  flameFruit: { cat: 'rift', franchise: 'onepiece', name: 'Flame-Flame Fruit', icon: '🔥', price: 48, desc: 'Dashes leave a trail of fire that burns demons. Devil Fruit: water attacks hurt double.', mods: { fireDash: 1, devilFruit: 1 }, devilFruit: true },
  observationHaki: { cat: 'rift', franchise: 'onepiece', name: 'Observation Haki', icon: '👁️', price: 38, desc: 'Sense attacks early: enemy telegraphs last 20% longer, perfect-dodge window +60 ms.', mods: { foresight: 1.2, perfectWindow: 0.06 } },
  armamentHaki: { cat: 'rift', franchise: 'onepiece', name: 'Armament Haki', icon: '✊', price: 38, desc: 'Melee ignores armour and shields, +12% melee damage.', mods: { pierceArmor: 1, meleeMul: 1.12 } },
  meat: { cat: 'rift', franchise: 'onepiece', name: 'Meat on the Bone', icon: '🍖', price: 14, desc: 'Heals 60 and +5 max HP. MEAAAT!', heal: 60, mods: { maxHp: 5 } },
  rareCandy: { cat: 'rift', franchise: 'pokemon', name: 'Rare Candy', icon: '🍭', price: 25, desc: 'Level up! +5 max HP, +5% damage, and your companion grows stronger.', mods: { maxHp: 5, dmgMul: 1.05, companionDmg: 1.25 } },
  superPotion: { cat: 'rift', franchise: 'pokemon', name: 'Super Potion', icon: '🧪', price: 9, desc: 'Heals 50.', heal: 50 },
  luckyEgg: { cat: 'rift', franchise: 'pokemon', name: 'Lucky Egg', icon: '🥚', price: 30, desc: 'Demons drop 30% more money.', mods: { moneyMul: 1.3 } },
  expShare: { cat: 'rift', franchise: 'pokemon', name: 'Exp. Share', icon: '📡', price: 28, desc: 'Your captured companion deals double damage.', mods: { companionDmg: 2 } },
  manna: { cat: 'rift', franchise: 'bible', name: 'Manna from Heaven', icon: '🍞', price: 10, desc: 'Heals 15, then heals 6 every time you clear a room this floor.', heal: 15, timed: { floor: true, mods: { clearHeal: 6 } } },
  loavesFishes: { cat: 'rift', franchise: 'bible', name: 'Five Loaves & Two Fishes', icon: '🐟', price: 32, desc: 'All healing is doubled.', mods: { healMul: 2 } },
  armorOfGod: { cat: 'rift', franchise: 'bible', name: 'Armor of God', icon: '✝️', price: 46, desc: 'Take 15% less damage; the shield of faith blocks 15% of projectiles outright. (Ephesians 6)', mods: { dmgTakenMul: 0.85, faithBlock: 0.15 } },
  // --- crafted Minecraft gear (crafting table only) -------------------------------
  leatherTunic: { cat: 'special', franchise: 'minecraft', name: 'Leather Tunic', icon: '🦺', price: 0, desc: 'Take 5% less damage, +5 max HP. Crafted.', mods: { dmgTakenMul: 0.95, maxHp: 5 } },
  ironHelmet: { cat: 'special', franchise: 'minecraft', name: 'Iron Helmet', icon: '⛑️', price: 0, desc: 'Take 6% less damage. Crafted.', mods: { dmgTakenMul: 0.94 } },
  goldHelmet: { cat: 'special', franchise: 'minecraft', name: 'Golden Helmet', icon: '👑', price: 0, desc: 'Take 4% less damage. Piglins think you are cool (they ignore you longer).', mods: { dmgTakenMul: 0.96, piglinFriend: 1 } },
  diamondArmor: { cat: 'special', franchise: 'minecraft', name: 'Diamond Chestplate', icon: '💠', price: 0, desc: 'Take 18% less damage, +20 max HP. Crafted.', mods: { dmgTakenMul: 0.82, maxHp: 20 } },
  diamondHelmet: { cat: 'special', franchise: 'minecraft', name: 'Diamond Helmet', icon: '🔷', price: 0, desc: 'Take 9% less damage. Crafted.', mods: { dmgTakenMul: 0.91 } },
  mcShield: { cat: 'special', franchise: 'minecraft', name: 'Shield', icon: '🛡️', price: 0, desc: '+25 recharging shield. Crafted from planks and iron.', mods: { shield: 25 } },
  dragonEgg: { cat: 'special', franchise: 'minecraft', name: 'Dragon Egg', icon: '🥚', price: 0, desc: 'You killed the Ender Dragon. +25% damage, +25 max HP.', mods: { dmgMul: 1.25, maxHp: 25 } },
  blessing: { cat: 'special', name: 'Blessing of the Burning Bush', icon: '🌿', price: 0, desc: 'Full heal and +10 max HP. The bush is fine, by the way.', heal: 999, mods: { maxHp: 10 } },
};

// Gadgets: one active slot (G / LB). Charges refill by one each room clear.
export const GADGETS = {
  plasmaGrenade: { name: 'Plasma Grenade', icon: '🔵', franchise: 'halo', charges: 3, desc: 'Throw a sticky plasma grenade. It sticks to the first demon it touches and explodes. (Halo)' },
  tnt: { name: 'TNT', icon: '🧨', franchise: 'minecraft', charges: 3, desc: 'Drop a block of TNT. Big boom after 2 s. Destroys cover. (Minecraft)' },
  enderPearl: { name: 'Ender Pearl', icon: '🟣', franchise: 'minecraft', charges: 4, desc: 'Throw it and teleport to wherever it lands. (Minecraft)' },
  captureBall: { name: 'Capture Ball', icon: '🔴', franchise: 'pokemon', charges: 3, desc: 'Throw at a weakened demon to catch it. It becomes your companion and fights for you. (Pokémon)' },
  mosesStaff: { name: 'Staff of Moses', icon: '🦯', franchise: 'bible', cooldown: 14, desc: 'Part the sea: clears every enemy shot in a wide lane ahead and shoves demons aside. Recharges. (Exodus 14)' },
};
export function gadgetItem(id) {
  const g = GADGETS[id];
  if (!g) return null;
  return { id: 'g:' + id, gadget: id, cat: 'gadget', name: g.name, icon: g.icon, price: GADGET_PRICES[id] ?? 30, desc: g.desc, franchise: g.franchise };
}
export const GADGET_PRICES = { plasmaGrenade: 30, tnt: 28, enderPearl: 26, captureBall: 34, mosesStaff: 42 };


// Weapons sold in the locked case / found in Lost & Found.
export const WEAPON_PRICES = { revolver: 35, nunchucks: 28, shirtCannon: 32, gasPump: 40, fanSign: 38, shuriken: 24, energySword: 45, diamondSword: 34, samsonJawbone: 36, needler: 38, bow: 30, davidSling: 32 };
const VENUE_WEAPONS = ['revolver', 'nunchucks', 'shirtCannon', 'gasPump', 'fanSign', 'shuriken'];
export function weaponItem(id) {
  const w = MELEE[id] || RANGED[id];
  return { id: 'w:' + id, weapon: id, slot: MELEE[id] ? 'melee' : 'ranged', cat: 'locked', name: w.name, icon: w.icon, price: WEAPON_PRICES[id] ?? 30, desc: w.desc, franchise: w.franchise };
}
export function itemInfo(id) {
  if (id.startsWith('w:')) return weaponItem(id.slice(2));
  if (id.startsWith('g:')) return gadgetItem(id.slice(2));
  return ITEMS[id] ? { id, ...ITEMS[id] } : null;
}

export function poolFor(cat) {
  if (cat === 'locked') return VENUE_WEAPONS.map((w) => 'w:' + w);
  if (cat.startsWith('rift:')) return RIFTS[cat.slice(5)].rewards.slice();
  if (cat === 'merchant') return Object.values(RIFTS).flatMap((r) => r.rewards);
  if (cat === 'treasure') return [...poolFor('snack'), ...poolFor('snack'), ...poolFor('backwall'), ...poolFor('locked'), ...poolFor('merchant')];
  if (cat === 'secret') return poolFor('backwall');
  if (cat === 'boss') return [...poolFor('backwall'), ...poolFor('locked')];
  if (cat === 'key') return ['bathroomKey'];
  return Object.keys(ITEMS).filter((k) => ITEMS[k].cat === cat);
}

// Pick n distinct items from a category, skipping owned passives / equipped weapons.
export function rollItems(cat, n, rng, run) {
  const owned = new Set(run ? run.items : []);
  const equipped = run ? new Set([...[run.weapons.melee, run.weapons.ranged].map((w) => 'w:' + w), run.gadget ? 'g:' + run.gadget.id : '']) : new Set();
  const opts = [...new Set(poolFor(cat))].filter((id) => {
    if (equipped.has(id)) return false;
    const it = ITEMS[id];
    if (it && (it.cat === 'backwall' || it.cat === 'snack' || it.cat === 'rift') && owned.has(id) && ['warranty', 'loyalty', 'tourShirt', 'gumGum', 'flameFruit', 'armamentHaki', 'observationHaki', 'loavesFishes', 'expShare'].includes(id)) return false;
    if (id === 'bathroomKey' && run && run.flags.bathroomKey === run.floor) return false;
    return true;
  });
  rng.shuffle(opts);
  return opts.slice(0, n);
}

export const BASE_MODS = {
  dmgMul: 1, meleeMul: 1, rangedMul: 1, moveMul: 1, fireRate: 1, dashCharges: 0, dashRechargeMul: 1, airDashes: 0,
  perfectWindow: 0, moneyChance: 0, moneyMul: 1, magnetMul: 1, maxHp: 0, stunChance: 0, lifesteal: 0, dmgTakenMul: 1,
  priceMul: 1, revive: 0, readable: 0, clearHeal: 0, clearMoney: 0, phoneTime: 1, attackSpeed: 1,
  shield: 0, healMul: 1, meleeRange: 0, fireDash: 0, devilFruit: 0, pierceArmor: 0, foresight: 1, faithBlock: 0, companionDmg: 1,
  mineMul: 1, mcFortune: 0, mcLoot: 0, fireAspect: 0, piglinFriend: 0,
};
const ADDITIVE = new Set(['dashCharges', 'airDashes', 'perfectWindow', 'moneyChance', 'maxHp', 'stunChance', 'lifesteal', 'revive', 'readable', 'clearHeal', 'clearMoney', 'shield', 'meleeRange', 'fireDash', 'devilFruit', 'pierceArmor', 'faithBlock', 'mcFortune', 'mcLoot', 'fireAspect', 'piglinFriend']);

export function combineMods(itemIds, buffs) {
  const m = { ...BASE_MODS };
  const apply = (mods) => {
    for (const [k, v] of Object.entries(mods || {})) {
      if (ADDITIVE.has(k)) m[k] += v; else m[k] *= v;
    }
  };
  for (const id of itemIds) apply(ITEMS[id]?.mods);
  for (const b of buffs) apply(b.mods);
  m.stunChance = Math.min(0.5, m.stunChance);
  m.dmgTakenMul = Math.max(0.5, m.dmgTakenMul);
  m.faithBlock = Math.min(0.35, m.faithBlock);
  m.meleeRange = Math.min(2.5, m.meleeRange);
  return m;
}
