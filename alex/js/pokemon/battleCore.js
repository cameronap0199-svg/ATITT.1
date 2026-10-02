// Turn-based battle rules: Gen-3-style damage (STAB, type chart, crits, random roll),
// accuracy, priority and speed order, burn / paralysis / poison / toxic / sleep /
// freeze / confusion / flinch, stat stages, recoil, drain, recharge, Explosion,
// catching with shake checks, and running away. Pure: produces a list of events the
// battle screen plays back. Tested headlessly.

import { MOVES } from './moves.js';
import { SPECIES } from './dex.js';
import { effectiveness } from './types.js';
import { calcStats, monName, maxHp } from './mon.js';

export const STATUS_NAMES = { brn: 'BRN', par: 'PAR', psn: 'PSN', tox: 'PSN', slp: 'SLP', frz: 'FRZ' };
const STAGE_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

export function battler(mon, side) {
  return { mon, side, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, conf: 0, recharge: false, toxN: 1, flinch: false, sleepT: mon.status === 'slp' ? 2 : 0 };
}
const stageMul = (n) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));
export function effStat(b, k) {
  const s = calcStats(b.mon)[k] * stageMul(b.stages[k] || 0);
  if (k === 'spe' && b.mon.status === 'par') return s * 0.5;
  return s;
}
const types = (b) => SPECIES[b.mon.species].types;
const name = (b) => (b.side === 'foe' ? (b.wild ? 'The wild ' : 'The foe\'s ') : '') + monName(b.mon);

// Damage roll for a move. Returns { dmg, eff, crit }.
export function calcDamage(att, def, moveId, rng = Math.random, opts = {}) {
  const mv = MOVES[moveId];
  if (mv.fx.fixed) return { dmg: mv.fx.fixed === 'level' ? att.mon.level : mv.fx.fixed, eff: effectiveness(mv.type, types(def)) ? 1 : 0, crit: false };
  const eff = effectiveness(mv.type, types(def));
  if (eff === 0) return { dmg: 0, eff, crit: false };
  const phys = mv.cat === 'phys';
  const crit = opts.crit ?? rng() < (mv.fx.crit ? 1 / 8 : 1 / 24);
  const ak = phys ? 'atk' : 'spa', dk = phys ? 'def' : 'spd';
  // crits ignore the attacker's drops and the defender's boosts
  const A = calcStats(att.mon)[ak] * stageMul(crit ? Math.max(0, att.stages[ak]) : att.stages[ak]);
  const D = calcStats(def.mon)[dk] * stageMul(crit ? Math.min(0, def.stages[dk]) : def.stages[dk]);
  let base = Math.floor(Math.floor(Math.floor(2 * att.mon.level / 5 + 2) * mv.power * A / D) / 50) + 2;
  if (phys && att.mon.status === 'brn') base = Math.floor(base / 2);
  const stab = types(att).includes(mv.type) ? 1.5 : 1;
  const roll = opts.roll ?? (0.85 + rng() * 0.15);
  const dmg = Math.max(1, Math.floor(base * (crit ? 1.5 : 1) * stab * eff * roll));
  return { dmg, eff, crit };
}

// Who moves first: priority, then speed (ties random).
export function order(a, ma, b, mb, rng = Math.random) {
  const pa = MOVES[ma]?.fx.prio || 0, pb = MOVES[mb]?.fx.prio || 0;
  if (pa !== pb) return pa > pb ? [a, b] : [b, a];
  const sa = effStat(a, 'spe'), sb = effStat(b, 'spe');
  if (sa !== sb) return sa > sb ? [a, b] : [b, a];
  return rng() < 0.5 ? [a, b] : [b, a];
}

function setHp(b, hp, ev) {
  const from = b.mon.hp;
  b.mon.hp = Math.max(0, Math.min(maxHp(b.mon), Math.round(hp)));
  if (b.mon.hp !== from) ev.push({ t: 'hp', who: b.side, from, to: b.mon.hp, max: maxHp(b.mon) });
}
function applyStages(target, changes, ev, rng) {
  for (const [k, n] of Object.entries(changes)) {
    const before = target.stages[k] || 0;
    const after = Math.max(-6, Math.min(6, before + n));
    if (after === before) { ev.push({ t: 'text', s: `${name(target)}'s ${STAGE_NAMES[k]} won't go any ${n > 0 ? 'higher' : 'lower'}!` }); continue; }
    target.stages[k] = after;
    const d = Math.abs(after - before);
    ev.push({ t: 'stat', who: target.side, up: n > 0 });
    ev.push({ t: 'text', s: `${name(target)}'s ${STAGE_NAMES[k]} ${n > 0 ? (d >= 2 ? 'rose sharply' : 'rose') : (d >= 2 ? 'harshly fell' : 'fell')}!` });
  }
}
export function inflict(target, status, ev, rng = Math.random) {
  const tt = types(target);
  if (status === 'conf') {
    if (target.conf > 0) return false;
    target.conf = 2 + Math.floor(rng() * 4);
    ev.push({ t: 'text', s: `${name(target)} became confused!` });
    return true;
  }
  if (target.mon.status || target.mon.hp <= 0) return false;
  if ((status === 'brn' && tt.includes('fire')) || ((status === 'psn' || status === 'tox') && (tt.includes('poison') || tt.includes('steel'))) || (status === 'par' && tt.includes('electric')) || (status === 'frz' && tt.includes('ice'))) return false;
  target.mon.status = status;
  if (status === 'slp') target.sleepT = 1 + Math.floor(rng() * 3);
  if (status === 'tox') target.toxN = 1;
  ev.push({ t: 'status', who: target.side, status });
  ev.push({ t: 'text', s: `${name(target)} ${{ brn: 'was burned!', par: 'is paralyzed! It may be unable to move!', psn: 'was poisoned!', tox: 'was badly poisoned!', slp: 'fell asleep!', frz: 'was frozen solid!' }[status]}` });
  return true;
}

// One Pokémon uses a move. Mutates both battlers; pushes events.
export function useMove(user, target, moveId, ev, rng = Math.random, ctx = {}) {
  const mv = MOVES[moveId];
  const slot = user.mon.moves.find((m) => m.id === moveId);
  if (user.recharge) { user.recharge = false; ev.push({ t: 'text', s: `${name(user)} must recharge!` }); return; }
  // status that stops you moving
  if (user.mon.status === 'slp') {
    if (user.sleepT > 0) { user.sleepT--; ev.push({ t: 'text', s: `${name(user)} is fast asleep.` }); ev.push({ t: 'anim', who: user.side, kind: 'zzz' }); return; }
    user.mon.status = null; ev.push({ t: 'status', who: user.side, status: null }); ev.push({ t: 'text', s: `${name(user)} woke up!` });
  }
  if (user.mon.status === 'frz') {
    if (rng() < 0.2 || mv.type === 'fire') { user.mon.status = null; ev.push({ t: 'status', who: user.side, status: null }); ev.push({ t: 'text', s: `${name(user)} thawed out!` }); }
    else { ev.push({ t: 'text', s: `${name(user)} is frozen solid!` }); return; }
  }
  if (user.flinch) { user.flinch = false; ev.push({ t: 'text', s: `${name(user)} flinched and couldn't move!` }); return; }
  if (user.mon.status === 'par' && rng() < 0.25) { ev.push({ t: 'text', s: `${name(user)} is paralyzed! It can't move!` }); ev.push({ t: 'anim', who: user.side, kind: 'par' }); return; }
  if (user.conf > 0) {
    user.conf--;
    if (user.conf === 0) ev.push({ t: 'text', s: `${name(user)} snapped out of its confusion!` });
    else {
      ev.push({ t: 'text', s: `${name(user)} is confused!` });
      if (rng() < 1 / 3) {
        const st = calcStats(user.mon);
        const d = Math.max(1, Math.floor((Math.floor(2 * user.mon.level / 5 + 2) * 40 * st.atk / st.def) / 50 + 2));
        ev.push({ t: 'text', s: 'It hurt itself in its confusion!' });
        ev.push({ t: 'anim', who: user.side, kind: 'hit', target: user.side });
        setHp(user, user.mon.hp - d, ev);
        return;
      }
    }
  }
  if (slot) slot.pp = Math.max(0, slot.pp - 1);
  ev.push({ t: 'text', s: `${name(user)} used ${mv.name}!`, move: moveId });
  if (mv.fx.splash) { ev.push({ t: 'anim', who: user.side, kind: 'splash' }); ev.push({ t: 'text', s: 'But nothing happened!' }); return; }
  // accuracy
  if (mv.acc && rng() * 100 >= mv.acc) { ev.push({ t: 'text', s: `${name(user)}'s attack missed!` }); return; }
  if (mv.cat === 'status') {
    ev.push({ t: 'anim', who: user.side, kind: 'status', move: moveId, target: mv.fx.self || mv.fx.heal || mv.fx.rest ? user.side : target.side });
    let did = false;
    if (mv.fx.heal) { const mh = maxHp(user.mon); if (user.mon.hp >= mh) ev.push({ t: 'text', s: `${name(user)}'s HP is full!` }); else { setHp(user, user.mon.hp + mh * mv.fx.heal, ev); ev.push({ t: 'text', s: `${name(user)} regained health!` }); } did = true; }
    if (mv.fx.rest) { setHp(user, maxHp(user.mon), ev); user.mon.status = 'slp'; user.sleepT = 2; ev.push({ t: 'status', who: user.side, status: 'slp' }); ev.push({ t: 'text', s: `${name(user)} slept and became healthy!` }); did = true; }
    if (mv.fx.self) { applyStages(user, mv.fx.self, ev, rng); did = true; }
    if (mv.fx.foe) { applyStages(target, mv.fx.foe, ev, rng); did = true; }
    if (mv.fx.status) { if (!inflict(target, mv.fx.status, ev, rng)) ev.push({ t: 'text', s: 'But it failed!' }); did = true; }
    if (!did) ev.push({ t: 'text', s: 'But it failed!' });
    return;
  }
  // damaging
  const hits = mv.fx.multi ? mv.fx.multi[0] + Math.floor(rng() * (mv.fx.multi[1] - mv.fx.multi[0] + 1)) : 1;
  let total = 0, n = 0, lastEff = 1;
  for (let h = 0; h < hits && target.mon.hp > 0; h++) {
    const r = calcDamage(user, target, moveId, rng);
    lastEff = r.eff;
    if (r.eff === 0) { ev.push({ t: 'text', s: `It doesn't affect ${name(target)}...` }); return; }
    ev.push({ t: 'anim', who: user.side, kind: mv.cat === 'phys' ? 'phys' : 'spec', move: moveId, target: target.side, eff: r.eff });
    setHp(target, target.mon.hp - r.dmg, ev);
    total += r.dmg; n++;
    if (r.crit) ev.push({ t: 'text', s: 'A critical hit!' });
  }
  if (lastEff > 1) ev.push({ t: 'text', s: 'It\'s super effective!' });
  else if (lastEff < 1) ev.push({ t: 'text', s: 'It\'s not very effective...' });
  if (hits > 1) ev.push({ t: 'text', s: `Hit ${n} time${n === 1 ? '' : 's'}!` });
  if (mv.fx.money && ctx.onMoney) { ctx.onMoney(user.mon.level * 5); ev.push({ t: 'text', s: 'Coins scattered everywhere!' }); }
  if (mv.fx.drain && total > 0) { setHp(user, user.mon.hp + Math.max(1, total * mv.fx.drain), ev); ev.push({ t: 'text', s: `${name(target)} had its energy drained!` }); }
  if (mv.fx.recoil && total > 0) { setHp(user, user.mon.hp - Math.max(1, total * mv.fx.recoil), ev); ev.push({ t: 'text', s: `${name(user)} is damaged by recoil!` }); }
  if (mv.fx.selfKO) setHp(user, 0, ev);
  if (mv.fx.recharge) user.recharge = true;
  if (target.mon.hp > 0) {
    const ch = mv.fx.chance ?? 1;
    if (mv.fx.status && rng() < ch) inflict(target, mv.fx.status, ev, rng);
    if (mv.fx.foe && rng() < ch) applyStages(target, mv.fx.foe, ev, rng);
    if (mv.fx.flinch && rng() < mv.fx.flinch) target.flinch = true;
  }
  if (mv.fx.self && user.mon.hp > 0 && rng() < (mv.fx.chance ?? 1)) applyStages(user, mv.fx.self, ev, rng);
}

// End of turn: burn and poison damage.
export function endOfTurn(b, ev) {
  if (b.mon.hp <= 0) return;
  const mh = maxHp(b.mon);
  if (b.mon.status === 'brn') { ev.push({ t: 'text', s: `${name(b)} is hurt by its burn!` }); ev.push({ t: 'anim', who: b.side, kind: 'brn' }); setHp(b, b.mon.hp - Math.max(1, mh / 16), ev); }
  if (b.mon.status === 'psn') { ev.push({ t: 'text', s: `${name(b)} is hurt by poison!` }); ev.push({ t: 'anim', who: b.side, kind: 'psn' }); setHp(b, b.mon.hp - Math.max(1, mh / 8), ev); }
  if (b.mon.status === 'tox') { ev.push({ t: 'text', s: `${name(b)} is hurt by poison!` }); ev.push({ t: 'anim', who: b.side, kind: 'psn' }); setHp(b, b.mon.hp - Math.max(1, mh * b.toxN / 16), ev); b.toxN = Math.min(15, b.toxN + 1); }
}

// A wild Pokémon picks a random move with PP left; trainers usually pick the hardest hitter.
export function chooseMove(b, foe, rng = Math.random, smart = false) {
  const opts = b.mon.moves.filter((m) => m.pp > 0);
  if (!opts.length) return 'struggle';
  if (smart && rng() < 0.75) {
    let best = null, bv = -1;
    for (const m of opts) {
      const mv = MOVES[m.id];
      const v = mv.cat === 'status' ? (rng() * 20) : mv.power * effectiveness(mv.type, types(foe)) * (types(b).includes(mv.type) ? 1.5 : 1) * ((mv.acc || 100) / 100);
      if (v > bv) { bv = v; best = m.id; }
    }
    return best;
  }
  return opts[Math.floor(rng() * opts.length)].id;
}

// Catching (Gen 3): returns the number of successful shakes (4 = caught).
export const BALLS = { pokeBall: 1, greatBall: 1.5, ultraBall: 2, masterBall: 255 };
export function catchShakes(foe, ball, rng = Math.random) {
  const sp = SPECIES[foe.mon.species];
  const mh = maxHp(foe.mon);
  const bonus = foe.mon.status === 'slp' || foe.mon.status === 'frz' ? 2 : foe.mon.status ? 1.5 : 1;
  const a = ((3 * mh - 2 * foe.mon.hp) * sp.catchRate * (BALLS[ball] || 1)) / (3 * mh) * bonus;
  if (a >= 255 || ball === 'masterBall') return 4;
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
  let n = 0;
  for (let i = 0; i < 4; i++) { if (rng() * 65536 < b) n++; else break; }
  return n;
}
// Running from a wild battle.
export function canRun(me, foe, tries, rng = Math.random) {
  const a = effStat(me, 'spe'), b = Math.max(1, effStat(foe, 'spe'));
  if (a >= b) return true;
  const f = (a * 128) / b + 30 * tries;
  return rng() * 256 < f;
}

// Struggle when out of PP.
MOVES.struggle = { name: 'Struggle', type: 'normal', cat: 'phys', power: 50, acc: 0, pp: 1, fx: { recoil: 0.25 } };
