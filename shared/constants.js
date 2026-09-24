// Core tuning constants for the Knotwood rules engine.
// Everything that shapes pacing lives here so it can be tuned in one place.

export const LANES = 5;            // number of Lanes on the battlefield
export const LANE_WIDTH = 2;       // tiles per Lane (columns)
export const COLS = LANES * LANE_WIDTH;
export const ROWS = 8;             // tiles from one player's edge to the other

export const START_HAND = 6;
export const HAND_LIMIT = 10;
export const SAP_START = 3;        // Sap maximum on a player's first turn
export const SAP_CAP = 10;         // Sap maximum can never exceed this
export const SECOND_PLAYER_BONUS_SAP = 1;
export const MP_REGEN = 2;         // MP restored to each Identity at the start of its controller's turn

export const RETALIATION_COST = 1; // MP spent to retaliate
export const COLLISION_DAMAGE = 1; // damage when forced movement is blocked

export const WIN_RENOWN = 20;      // Renown needed to win
export const RENOWN_PER_LANE = 0;  // Renown at the start of your turn for each Lane you control
export const RENOWN_PER_BUILT_LANE = 1; // Renown at the start of your turn for each controlled Lane with your Structure
export const RENOWN_STRUCTURE_KILL = 3;
export const RENOWN_CAPTURE = 2;   // replacing an enemy Zone with your own
export const RENOWN_LIBERATE = 1;  // clearing an undefended enemy Lane at the end of your turn
export const ROUND_LIMIT = 30;     // after this many rounds the leader wins
export const HOME_LANES = [1, 3];  // each player starts with a Homeland + Base Camp here
export const FORAGE_COST = 1;      // once per turn: pay 1 Sap, discard a card, draw a card

export const DECK_MIN = 60;
export const DECK_MAX = 120;
export const COPY_LIMIT = 3;

// Identity Stat Budget by Sap cost (Stat = ISB x Class Weight x Individual Modifier)
export const ISB_BASE = 8;
export const ISB_PER_COST = 3;
export const RARITY_ISB_BONUS = { Base: 0, Bronze: 0, Silver: 1, Gold: 1, Crystal: 2, Void: 2, Infinite: 3 };

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
