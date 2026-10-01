// Every tuning number in one place. Units: metres, seconds, degrees unless noted.
// Values follow the design document; comments note where a number is an interpretation.

export const TITLE = 'Alex K-Pop Demon Hunter 2';
export const SUBTITLE = 'Fates Uncertain Hearts Rewired Recircumcised Edition';

export const MOVE = {
  runSpeed: 8.2,
  sprintSpeed: 9.4,        // after running uninterrupted for sprintAfter seconds (or instantly with Auto Sprint)
  sprintAfter: 1.6,
  accelTime: 0.15,         // 0.12–0.18 s to full speed
  decelTime: 0.09,
  reverseBoost: 1.9,       // sharp turns bite harder than plain acceleration
  airControl: 0.72,
  radius: 0.36,
  height: 1.72,
  stepUp: 0.46,
  walkTilt: 0.6,           // analogue tilt below this walks (unless Auto Sprint)
};

export const JUMP = {
  velocity: 9.9,           // full jump apex ≈ 1.8 m
  gravityUp: 27,
  gravityDown: 44,
  cutMul: 0.42,            // releasing early keeps this much upward speed → hop
  coyote: 0.12,
  buffer: 0.15,
  maxFall: 32,
  autoHop: 0.75,           // clutter this short is cleared automatically while running
};

export const DASH = {
  distance: 3.6,           // 3–4 m
  duration: 0.25,
  iframes: 0.15,
  charges: 2,
  recharge: 1.5,
  buffer: 0.1,
  perfectWindow: 0.1,      // start of the dash; widened by Perfect-Dodge assist + Mint Gum
  perfectGraze: 0.55,      // projectile graze radius that counts as "through" the attack
  perfectSlow: 0.2,        // real seconds of heightened time
  perfectScale: 0.38,
  perfectBonus: 1.5,       // next attack damage multiplier + guaranteed stagger
  wallRedirect: 0.8,       // velocity kept along a wall when dashing into it at an angle
};

export const WALLKICK = { out: 7.8, up: 9.4, reach: 0.6, lockout: 0.2, perAir: 1 };
export const VAULT = { minH: 0.55, maxH: 1.95, maxThick: 3.0, reach: 1.35, duration: 0.42 };
export const LAND = { medium: 2.3, huge: 5.2, mediumTime: 0.22, hugeTime: 0.42, hugeCancelAfter: 0.2 };

export const PLAYER = {
  maxHp: 100,
  mercy: 0.75,             // invulnerability after being hit
  spawnSafe: 1.1,          // entering a room, leaving dialogue, closing menus, respawn
  inputQueue: 0.22,
  ledgeDrop: 1.3,          // drops taller than this are protected during combat
  ledgePush: 0.28,         // keep pushing this long to step off deliberately
};

export const CAMERA = {
  states: {
    explore: { dist: 5.4, pitch: 0, fov: 70 },
    combat: { dist: 6.2, pitch: 2, fov: 75 },    // +10–20 %
    crowd: { dist: 7.2, pitch: 5, fov: 78 },
    bullet: { dist: 8.4, pitch: 11, fov: 80 },
  },
  basePitch: 20,
  minPitch: -10,
  maxPitch: 62,
  mouseSens: 0.0023,
  padSens: 3.0,            // rad/s at full tilt
  lookHeight: 1.35,
  inwardRate: 18,
  outwardRate: 2.8,
  collisionPad: 0.3,
  minDist: 1.4,
  crowdEnemies: 5,
  surroundRadius: 7,
  bulletProjectiles: 36,
};

export const TARGET = {
  acquire: 30,             // acquisition cone (from screen centre)
  retain: 90,              // retention cone once targeted
  range: 26,
  switchCooldown: 0.35,
  combatTimeout: 3.2,
  meleeCone: { basic: 55, heavy: 40, precise: 25, flashy: 75 },
  lungeMax: 1.5,
  aimAssist: { off: 0, low: 4, normal: 8, high: 14 },
  camAssist: { off: 0, low: 0.45, normal: 1, high: 1.6 },
};

export const FLOOR_BUDGET = [[4, 7], [7, 11], [10, 15]];
export const FLOOR_NAMES = ['THE ARRIVAL', 'THE VENUE', 'BEHIND THE SHOW'];
export const FLOOR_PLACES = ['Parking Lot → Venue Exterior → Entrance', 'Concourse → Merch / Food → Arena Interior', 'Backstage → Production → Main Stage'];

export const ECONOMY = {
  drop: { normal: [1, 4], elite: [5, 12], mini: [15, 30], boss: [70, 110] },
  dropChance: 0.72,
  magnet: 3.4,
  gasStationChance: 0.6,
  heartDrop: 0.06,
};

export const HEARTLINE = {
  ringTime: 5.5,           // ± random per call
  choiceTime: 12,          // ± random per call
  declineTextDelay: 2,
  cooldown: 11,
  chancePerSecond: 0.06,   // in fights; ~half that while exploring
  minRoomTime: 2,
  scoreMin: -5,
  scoreMax: 5,
  gfRequests: [20, 75, 240, 500, 999],
};

// Relationship score (-5…+5) → hearts shown on the phone (0–5).
export const heartsFor = (score) => Math.max(0, Math.min(5, Math.ceil((score + 5) / 2)));
export const COOKOFF_CHANCE = [0.35, 0.22, 0.12, 0.06, 0.02, 0];       // index = hearts
export const NIGHTMARE_CHANCE = [0.22, 0.12, 0.06, 0, 0, 0];
