// Core tuning constants for the Knotwood rules engine.
// Everything that shapes pacing lives here so it can be tuned in one place.

// ---------------------------------------------------------------------------
// Battlefield (Phase 1 — Core Game Rules)
// A square board. Each seated player owns one side with three adjacent Home Lanes,
// each 5 tiles wide and 12 tiles long. The centre (and every unseated area) is the Void.
// ---------------------------------------------------------------------------
export const LANE_W = 5;                 // tiles across a Lane
export const LANE_L = 12;                // tiles deep
export const HOME_LANES = 3;             // Home Lanes per player
export const ARM = LANE_W * HOME_LANES;  // 15 — width of a player's territory
export const VOID = ARM;                 // central Void is a 15 x 15 square
export const SIZE = LANE_L * 2 + VOID;   // 39 x 39 board
export const SIDES = ['S', 'W', 'N', 'E']; // clockwise seating

export const FORMATS = {
  '1v1': { name: '1 vs 1', players: 2, sides: ['S', 'N'], teams: [0, 1] },
  '2v2': { name: '2 vs 2', players: 4, sides: ['S', 'W', 'N', 'E'], teams: [0, 1, 0, 1] },
  ffa3: { name: 'Free-for-All (3)', players: 3, sides: ['S', 'W', 'N'], teams: [0, 1, 2] },
  ffa4: { name: 'Free-for-All (4)', players: 4, sides: ['S', 'W', 'N', 'E'], teams: [0, 1, 2, 3] },
};

// Turn structure: Draw → Zone → Build → Summon → Equipment → Movement/Combat → End
export const STEPS = ['zone', 'build', 'summon', 'equip', 'combat', 'end'];
export const STEP_NAMES = { draw: 'Draw', zone: 'Zone', build: 'Build', summon: 'Summon', equip: 'Equipment', combat: 'Movement & Combat', end: 'End' };

export const HAND_SIZE = 7;              // draw up to this many each turn; hand maximum
export const ATTACK_COST = 2;            // MP cost of a basic attack (and of retaliating)
export const COLLISION_DAMAGE = 1;       // damage when forced movement is blocked
export const ROUND_LIMIT = 60;           // safety valve against endless stalemates
export const TOKEN_CAP = 6;              // most tokens one player may have on the battlefield

export const DECK_MIN = 60;
export const DECK_MAX = 120;
export const COPY_LIMIT = 3;

// Identity Stat Budget (Stat = ISB x Class Weight x Individual Modifier).
// Each Identity has a power tier (1-6); ISB grows with tier and rarity.
export const ISB_BASE = 16;
export const ISB_PER_TIER = 4;
export const RARITY_ISB_BONUS = { Base: 0, Bronze: 0, Silver: 2, Gold: 2, Crystal: 4, Void: 4, Infinite: 6 };
export const STAT_CAPS = { ap: 8, rp: 5 };
// Body multiplier: gives Identities enough BP that fights last more than one hit,
// so retaliation and multiple attacks per turn matter.
export const BP_SCALE = 2;

// Housing Capacity is determined by a Structure's Class
export const HOUSING_BY_CLASS = { Shelter: 3, Bastion: 2, Den: 5, Landmark: 3, Facility: 3 };
export const STRUCTURE_BP_SCALE = 2.5;

export const CARD_TYPES = ['Identity', 'Zone', 'Structure', 'Equipment', 'Consumable', 'Action', 'Event'];
export const RARITIES = ['Base', 'Bronze', 'Silver', 'Gold', 'Crystal', 'Void', 'Infinite'];

// Class systems (Set 1 — Knotwood Forest). Index = "Class slot" shared across card types.
export const CLASSES = {
  Identity: ['Silviculturist', 'Hydrologist', 'Understory', 'Poacher', 'Forager'],
  Zone: ['Environmental', 'Terrain', 'Property', 'Domain', 'Territory'],
  Structure: ['Shelter', 'Bastion', 'Den', 'Landmark', 'Facility'],
  Equipment: ['Tool', 'Accessory', 'Armor', 'Weapon', 'Trap'],
  Consumable: ['Trinket', 'Enchantment', 'Recovery', 'Provision', 'Catalyst'],
  Action: ['Interaction', 'Command', 'Maneuver', 'Technique', 'Reaction'],
  Event: ['Object', 'Weather', 'Space-Time', 'Customs', 'Ecology'],
};

export const CLASS_WEIGHTS = {
  Silviculturist: { bp: 0.30, sp: 0.20, mp: 0.18, ap: 0.12, rp: 0.20 },
  Hydrologist: { bp: 0.16, sp: 0.16, mp: 0.28, ap: 0.24, rp: 0.16 },
  Understory: { bp: 0.16, sp: 0.18, mp: 0.18, ap: 0.30, rp: 0.18 },
  Poacher: { bp: 0.15, sp: 0.32, mp: 0.15, ap: 0.23, rp: 0.15 },
  Forager: { bp: 0.21, sp: 0.18, mp: 0.25, ap: 0.18, rp: 0.18 },
};

export const FACTIONS = ['Feathered', 'Pelted', 'Scales', 'Arthropod', 'Knot-Bots', 'Ghoul', 'Magically-Mutated', 'Character'];

export const ARCHETYPES = [
  'Ancestry', 'Succulence', 'Stagnation', 'Hardpan', 'Friction', 'Scarcity', 'Obscurity', 'Seclusion',
  'Venom', 'Monopoly', 'Labor', 'Infrastructure', 'Persistence', 'Erosion', 'Predation',
];

export const FACTION_ICONS = {
  Feathered: '🪶', Pelted: '🐾', Scales: '🐉', Arthropod: '🐞', 'Knot-Bots': '⚙️', Ghoul: '👻', 'Magically-Mutated': '🧬', Character: '⭐',
};

export const CLASS_ICONS = {
  Silviculturist: '🌳', Hydrologist: '💧', Understory: '🌿', Poacher: '🏹', Forager: '🧺',
  Environmental: '🌫️', Terrain: '⛰️', Property: '🏡', Domain: '🏗️', Territory: '🚩',
  Shelter: '🛖', Bastion: '🏰', Den: '🕳️', Landmark: '🗿', Facility: '🏭',
  Tool: '🔧', Accessory: '💍', Armor: '🛡️', Weapon: '🗡️', Trap: '🪤',
  Trinket: '🎲', Enchantment: '✨', Recovery: '💚', Provision: '🍖', Catalyst: '⚡',
  Interaction: '🎯', Command: '📯', Maneuver: '💨', Technique: '🥋', Reaction: '❗',
  Object: '📦', Weather: '🌧️', 'Space-Time': '⏳', Customs: '🎎', Ecology: '🍃',
};

export const TYPE_ICONS = {
  Identity: '👤', Zone: '🗺️', Structure: '🏛️', Equipment: '⚔️', Consumable: '🧪', Action: '⚡', Event: '🌠',
};

export const ARCHETYPE_ICONS = {
  Ancestry: '🧬', Succulence: '💧', Stagnation: '🕸️', Hardpan: '🪨', Friction: '🔥', Scarcity: '🥀', Obscurity: '🌑',
  Seclusion: '🏝️', Venom: '☠️', Monopoly: '👑', Labor: '⚒️', Infrastructure: '🌉', Persistence: '♾️', Erosion: '🌊', Predation: '🦷',
};

export const STAT_NAMES = { bp: 'Body', sp: 'Soul', mp: 'Mind', ap: 'Agility', rp: 'Range' };
