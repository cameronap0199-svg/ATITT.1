// Elite affixes: random variants rolled onto ordinary encounter demons. Each one adds a
// title to the enemy's nameplate, a coloured aura and a twist, and pays out better.
// Pure data + rolls (tested headlessly); the effects live in enemy.js.

export const AFFIXES = {
  swift: { title: 'Swift', color: '#4cc9f0', weight: 3, desc: 'Moves 35% faster, attacks a little faster.', money: 'elite' },
  armored: { title: 'Armored', color: '#c0c7d1', weight: 3, desc: 'Takes 35% less damage.', money: 'elite' },
  giant: { title: 'Giant', color: '#ff9f1c', weight: 2, desc: 'Bigger, heavier, +60% HP.', money: 'elite' },
  regen: { title: 'Regenerating', color: '#3cff8f', weight: 2, desc: 'Heals when left alone for a moment.', money: 'elite' },
  volatile: { title: 'Volatile', color: '#ff2e4d', weight: 2, desc: 'Explodes shortly after dying.', money: 'elite' },
  frenzied: { title: 'Frenzied', color: '#ff4fa3', weight: 2, desc: 'Gets faster and angrier below half HP.', money: 'elite' },
  shiny: { title: 'Shiny', color: '#ffd60a', weight: 0, desc: 'Rare. Sparkles. Drops a fortune.', money: 'mini' },
};

// Generous by design: roughly one in five demons on floor 3 carries an affix.
export const AFFIX_CHANCE = [0.12, 0.17, 0.22];
export const SHINY_CHANCE = 0.035;
const NO_AFFIX = new Set(['soloA', 'soloB', 'dancer', 'mimic', 'splashcarp', 'frog']);

export function rollAffix(rng, floor, type) {
  if (NO_AFFIX.has(type)) return null;
  if (rng() < SHINY_CHANCE) return 'shiny';
  if (rng() >= AFFIX_CHANCE[Math.max(0, Math.min(2, floor - 1))]) return null;
  return rng.weighted(Object.entries(AFFIXES).filter(([, a]) => a.weight > 0).map(([k, a]) => [k, a.weight]));
}
