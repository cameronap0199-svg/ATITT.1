// The 18 types and the full effectiveness chart (attacker → defender multiplier).

export const TYPES = {
  normal: { name: 'Normal', color: '#a8a77a' },
  fire: { name: 'Fire', color: '#ee8130' },
  water: { name: 'Water', color: '#6390f0' },
  electric: { name: 'Electric', color: '#f7d02c' },
  grass: { name: 'Grass', color: '#7ac74c' },
  ice: { name: 'Ice', color: '#96d9d6' },
  fighting: { name: 'Fighting', color: '#c22e28' },
  poison: { name: 'Poison', color: '#a33ea1' },
  ground: { name: 'Ground', color: '#e2bf65' },
  flying: { name: 'Flying', color: '#a98ff3' },
  psychic: { name: 'Psychic', color: '#f95587' },
  bug: { name: 'Bug', color: '#a6b91a' },
  rock: { name: 'Rock', color: '#b6a136' },
  ghost: { name: 'Ghost', color: '#735797' },
  dragon: { name: 'Dragon', color: '#6f35fc' },
  dark: { name: 'Dark', color: '#705746' },
  steel: { name: 'Steel', color: '#b7b7ce' },
  fairy: { name: 'Fairy', color: '#d685ad' },
};

// [super effective against], [not very effective against], [no effect on]
const CHART = {
  normal: [[], ['rock', 'steel'], ['ghost']],
  fire: [['grass', 'ice', 'bug', 'steel'], ['fire', 'water', 'rock', 'dragon'], []],
  water: [['fire', 'ground', 'rock'], ['water', 'grass', 'dragon'], []],
  electric: [['water', 'flying'], ['electric', 'grass', 'dragon'], ['ground']],
  grass: [['water', 'ground', 'rock'], ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], []],
  ice: [['grass', 'ground', 'flying', 'dragon'], ['fire', 'water', 'ice', 'steel'], []],
  fighting: [['normal', 'ice', 'rock', 'dark', 'steel'], ['poison', 'flying', 'psychic', 'bug', 'fairy'], ['ghost']],
  poison: [['grass', 'fairy'], ['poison', 'ground', 'rock', 'ghost'], ['steel']],
  ground: [['fire', 'electric', 'poison', 'rock', 'steel'], ['grass', 'bug'], ['flying']],
  flying: [['grass', 'fighting', 'bug'], ['electric', 'rock', 'steel'], []],
  psychic: [['fighting', 'poison'], ['psychic', 'steel'], ['dark']],
  bug: [['grass', 'psychic', 'dark'], ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], []],
  rock: [['fire', 'ice', 'flying', 'bug'], ['fighting', 'ground', 'steel'], []],
  ghost: [['psychic', 'ghost'], ['dark'], ['normal']],
  dragon: [['dragon'], ['steel'], ['fairy']],
  dark: [['psychic', 'ghost'], ['fighting', 'dark', 'fairy'], []],
  steel: [['ice', 'rock', 'fairy'], ['fire', 'water', 'electric', 'steel'], []],
  fairy: [['fighting', 'dragon', 'dark'], ['fire', 'poison', 'steel'], []],
};

export function typeMul(atk, def) {
  const c = CHART[atk];
  if (!c) return 1;
  if (c[2].includes(def)) return 0;
  if (c[0].includes(def)) return 2;
  if (c[1].includes(def)) return 0.5;
  return 1;
}
export function effectiveness(atk, defTypes) {
  let k = 1;
  for (const t of defTypes) k *= typeMul(atk, t);
  return k;
}
export const TYPE_IDS = Object.keys(TYPES);
