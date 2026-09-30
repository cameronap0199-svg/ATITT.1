// Item catalogue. Categories follow the Gas Station sections:
// counter (healing / temporary buffs / utility), snack (small passives),
// locked (weapons), backwall (major run upgrades). Pure data + mod math.

import { MELEE, RANGED } from './combat/weapons.js';

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
};

// Weapons sold in the locked case / found in Lost & Found.
export const WEAPON_PRICES = { revolver: 35, nunchucks: 28, shirtCannon: 32, gasPump: 40, fanSign: 38, shuriken: 24 };
export function weaponItem(id) {
  const w = MELEE[id] || RANGED[id];
  return { id: 'w:' + id, weapon: id, slot: MELEE[id] ? 'melee' : 'ranged', cat: 'locked', name: w.name, icon: w.icon, price: WEAPON_PRICES[id] ?? 30, desc: w.desc };
}
export function itemInfo(id) {
  if (id.startsWith('w:')) return weaponItem(id.slice(2));
  return { id, ...ITEMS[id] };
}

export function poolFor(cat) {
  if (cat === 'locked') return Object.keys(WEAPON_PRICES).map((w) => 'w:' + w);
  if (cat === 'treasure') return [...poolFor('snack'), ...poolFor('snack'), ...poolFor('backwall'), ...poolFor('locked')];
  if (cat === 'secret') return poolFor('backwall');
  if (cat === 'boss') return [...poolFor('backwall'), ...poolFor('locked')];
  if (cat === 'key') return ['bathroomKey'];
  return Object.keys(ITEMS).filter((k) => ITEMS[k].cat === cat);
}

// Pick n distinct items from a category, skipping owned passives / equipped weapons.
export function rollItems(cat, n, rng, run) {
  const owned = new Set(run ? run.items : []);
  const equipped = run ? new Set([run.weapons.melee, run.weapons.ranged].map((w) => 'w:' + w)) : new Set();
  const opts = [...new Set(poolFor(cat))].filter((id) => {
    if (equipped.has(id)) return false;
    const it = ITEMS[id];
    if (it && (it.cat === 'backwall' || it.cat === 'snack') && owned.has(id) && ['warranty', 'loyalty', 'tourShirt'].includes(id)) return false;
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
};
const ADDITIVE = new Set(['dashCharges', 'airDashes', 'perfectWindow', 'moneyChance', 'maxHp', 'stunChance', 'lifesteal', 'revive', 'readable', 'clearHeal', 'clearMoney']);

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
  return m;
}
