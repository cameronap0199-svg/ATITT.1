// Subject 87's two invisible bars (Vitals and Cognitive Load), the Dynamic Psychosis System
// and the combo counter. Pure logic.

import { HALLUCINATIONS, HALLUCINATION_THRESHOLDS, COMBO_VISIBLE } from './data.js';

// 7 of the 11 hallucinations, dealt to the 10%..70% thresholds for this run.
export function assignHallucinations(rng) {
  const ids = rng.shuffle(HALLUCINATIONS.map((h) => h.id)).slice(0, HALLUCINATION_THRESHOLDS.length);
  const out = {};
  HALLUCINATION_THRESHOLDS.forEach((t, i) => { out[t] = ids[i]; });
  return out;
}

// Penalties stack: at 45% the 10/20/30/40 hallucinations are all active.
export function activeHallucinations(assign, load) {
  return HALLUCINATION_THRESHOLDS.filter((t) => load >= t).map((t) => assign[t]);
}

export function vitalsState(hp, maxHp) {
  if (hp <= 0) return 'dead';
  const f = hp / maxHp;
  if (f >= 0.7) return 'stable';
  if (f >= 0.3) return 'trauma';
  return 'critical';
}

export class Psyche {
  constructor(rng) {
    this.load = 0;
    this.assign = assignHallucinations(rng);
    this.active = [];
  }
  // Returns { onset: [...ids], relief: [...ids] } so the game can announce changes.
  set(value) {
    this.load = Math.max(0, Math.min(100, value));
    const next = activeHallucinations(this.assign, this.load);
    const onset = next.filter((id) => !this.active.includes(id));
    const relief = this.active.filter((id) => !next.includes(id));
    this.active = next;
    return { onset, relief };
  }
  add(delta) { return this.set(this.load + delta); }
  has(id) { return this.active.includes(id); }
}

export class Combo {
  constructor() { this.count = 0; this.best = 0; this.score = 0; }
  get visible() { return this.count >= COMBO_VISIBLE; }
  hit(base = 10) {
    this.count++;
    this.best = Math.max(this.best, this.count);
    this.score += base * (1 + Math.floor(this.count / 10));
    return this.count;
  }
  // The Snap. Returns true when there was a combo to break.
  snap() {
    const broke = this.count > 0;
    this.count = 0;
    return broke;
  }
}
