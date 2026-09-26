// Run flow: title → sector map → node decryption → rooms → rewards → elevator → deeper.
// Also the DOM-driven rooms (Containment Cells, Null Zones, reward pedestals) and menus.

import {
  W, H, WEAPONS, CONSUMABLES, ITEMS, itemById, CHEATS, GAG_ROOMS, TIPS, HALLUCINATIONS, TIERS, floorMult,
} from './data.js';
import { LORE } from './lore.js';
import { makeRng } from './rng.js';
import { Psyche, Combo, vitalsState } from './psyche.js';
import { generateFloor, enterNode, clearNode, revealNext } from './map.js';
import { CombatRoom } from './combat.js';
import { BulkheadQTE, DanceDuel } from './minigames.js';
import { TitleScreen, MapScreen, DecryptScreen, ElevatorScreen, GameOverScreen, BackdropScreen } from './screens.js';
import { EKG, EEG, drawItemIcon, drawWeaponIcon } from './hud.js';
import { el, show, push, pop, popTo, clear, toast, depth, typeInto } from './ui.js';
import { sfx, playMusic, stopMusic, setVolumes, setVoice, setTempo } from './audio.js';
import { makeCanvas } from './render.js';

const STORE = 'ttt-psychosis-profile-v1';
const DEFAULT_SETTINGS = { master: 0.8, music: 0.5, sfx: 0.8, reduceFlash: false, shake: true, voice: false, hints: true };

function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { p = null; }
  p = p || {};
  return {
    attempts: 0, bestFloor: 0, bestCombo: 0, bestScore: 0, loreUnlocked: 1, introSeen: false, warned: false, cheats: {}, loadout: null,
    ...p,
    settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) },
  };
}

function iconCanvas(draw, size = 96) {
  const c = makeCanvas(size, size);
  c.className = 'icon';
  const g = c.getContext('2d');
  draw(g, size);
  return c;
}
const itemIcon = (id, size = 96) => iconCanvas((g, s) => drawItemIcon(g, id, s / 2, s / 2, s * 0.8, 0), size);
const weaponIcon = (id) => iconCanvas((g, s) => drawWeaponIcon(g, id, 6, s * 0.28, s - 12, s * 0.44, '#d8e8dc'), 128);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = 0;
    this.paused = false;
    this.profile = loadProfile();
    this.settings = this.profile.settings;
    this.applySettings();
    this.ekg = new EKG();
    this.eeg = new EEG();
    this.eegNotice = '';
    this.images = {};
    this.rng = makeRng();
    this.run = null;
    this.screen = null;
  }

  // ---------------------------------------------------------------- profile
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.profile)); } catch { /* private mode */ } }
  applySettings() {
    const s = this.settings;
    setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    setVoice(s.voice);
  }
  art(name) {
    if (!this.images[name]) { const img = new Image(); img.src = `assets/art/${name}.jpg`; this.images[name] = img; }
    return this.images[name];
  }
  toggleCheat(code) {
    const c = CHEATS[code];
    if (!c) { sfx('ddrMiss'); return null; }
    const on = !this.profile.cheats[c.id];
    this.profile.cheats[c.id] = on;
    if (c.id === 'unlockAll' && on) this.profile.loreUnlocked = LORE.length;
    this.save();
    sfx(on ? 'uiConfirm' : 'ui');
    if (this.screen instanceof TitleScreen) this.showTitle();
    return { name: c.name, on };
  }
  activeCheats() { return Object.values(CHEATS).filter((c) => this.profile.cheats[c.id]).map((c) => c.name); }

  // ---------------------------------------------------------------- derived stats
  held() {
    const r = this.run;
    return [...r.passives.map(itemById), ...r.actives.map((a) => itemById(a.id)).filter((i) => i.kind === 'both')];
  }
  stats() {
    const st = { maxHp: 0, dmgMul: 0, resist: 0, forgive: 0, ringSlow: 0, scrapMul: 0, window: 0, lazarus: false, guiltImmune: false, suppress: [], dropAlways: false, saveChance: 0, loadGain: 0 };
    let keep = 1;
    for (const it of this.held()) {
      const p = it.passive || {};
      st.maxHp += p.maxHp || 0;
      st.dmgMul += p.dmgMul || 0;
      keep *= 1 - (p.resist || 0);
      st.forgive = Math.max(st.forgive, p.forgive || 0);
      st.ringSlow += p.ringSlow || 0;
      st.scrapMul += p.scrapMul || 0;
      st.window += p.window || 0;
      st.lazarus = st.lazarus || !!p.lazarus;
      st.guiltImmune = st.guiltImmune || !!p.guiltImmune;
      if (p.suppress) st.suppress.push(...p.suppress);
      st.dropAlways = st.dropAlways || !!p.dropAlways;
      st.saveChance = Math.max(st.saveChance, p.saveChance || 0);
      st.loadGain += p.loadGain || 0;
    }
    st.resist = 1 - keep;
    st.ringSlow = Math.min(0.6, st.ringSlow);
    return st;
  }
  maxHp() { return 100 + this.run.maxHpBonus + this.stats().maxHp; }
  vitals() { return vitalsState(this.run.hp, this.maxHp()); }
  heal(n) { this.run.hp = Math.min(this.maxHp(), this.run.hp + n); this.ekg.heal(); }
  addLoad(delta, silent = false) {
    if (!this.run) return;
    if (delta > 0) delta *= 1 + this.stats().loadGain;
    const inCombat = this.screen instanceof CombatRoom;
    const psyche = this.run.psyche;
    const target = inCombat ? psyche.load + delta : Math.min(99, psyche.load + delta);
    const { onset } = psyche.set(target);
    if (onset.length && !silent) {
      const h = HALLUCINATIONS.find((x) => x.id === onset[onset.length - 1]);
      this.eegNotice = `▲ ANOMALY: ${h.name.toUpperCase()}`;
      this.eeg.notice = 2.5;
      sfx('glitch');
    }
    if (psyche.load >= 100 && inCombat) this.screen.startOverload();
  }
  setLoad(v) { this.run.psyche.set(v); }
  giveConsumable(id) {
    const i = this.run.consumables.indexOf(null);
    if (i < 0) return false;
    this.run.consumables[i] = id;
    return true;
  }
  snapshot() {
    const c = makeCanvas(W, H);
    c.getContext('2d').drawImage(this.canvas, 0, 0, W, H);
    return c;
  }

  // ---------------------------------------------------------------- input routing
  onEscape() {
    if (this.paused) { if (depth() > this.pauseDepth + 1) pop(); else this.resume(); return; }
    if (this.screen instanceof TitleScreen) { if (depth() > 1) pop(); return; }
    if (this.screen instanceof GameOverScreen) { this.showTitle(); return; }
    if (this.screen instanceof DecryptScreen || this.screen instanceof ElevatorScreen) return;
    if (this.screen instanceof CombatRoom && (this.screen.death || this.screen.state === 'clear')) return;
    this.pause();
  }

  // ---------------------------------------------------------------- title
  showTitle() {
    this.paused = false;
    this.screen = new TitleScreen(this);
    playMusic('title');
    const p = this.profile;
    const menu = el('div', { class: 'title-menu' },
      el('button', { class: 'btn big', autofocus: true, onclick: () => { sfx('uiConfirm'); this.newRun(); } }, p.attempts ? 'PREPARE NEXT SUBJECT' : 'BEGIN DESCENT'),
      el('button', { class: 'btn', onclick: () => this.archive() }, 'LORE ARCHIVE'),
      el('button', { class: 'btn', onclick: () => this.howTo() }, 'HOW TO SURVIVE'),
      el('button', { class: 'btn', onclick: () => this.settingsPanel() }, 'SETTINGS'),
      p.cheats.unlockAll ? el('button', { class: 'btn', onclick: () => this.armory() }, 'ARMORY (UNLOCKED)') : null,
      el('div', { class: 'hint' }, 'Keyboard + mouse. Type a 4-digit code at the terminal prompt for developer cheats.'),
    );
    show(menu, { modal: false });
    if (!p.warned) this.warning();
  }
  warning() {
    push(el('div', { class: 'panel narrow' },
      el('h2', {}, 'PHOTOSENSITIVITY & CONTENT WARNING'),
      el('p', {}, 'Tap Tap Tactical contains flashing and strobing lights, screen shake, horror imagery, body horror, crude language and religious themes.'),
      el('p', {}, 'Flashing can be reduced and screen shake disabled in Settings at any time.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => { this.settings.reduceFlash = true; this.settings.shake = false; this.profile.warned = true; this.save(); pop(); } }, 'REDUCE FLASHING & SHAKE'),
        el('button', { class: 'btn', autofocus: true, onclick: () => { this.profile.warned = true; this.save(); pop(); } }, 'CONTINUE'),
      ),
    ));
  }

  // ---------------------------------------------------------------- run lifecycle
  newRun() {
    clear();
    this.paused = false;
    const seed = (Math.random() * 2 ** 31) | 0;
    this.rng = makeRng(seed);
    const cheats = { ...this.profile.cheats };
    const loadout = cheats.unlockAll && this.profile.loadout ? this.profile.loadout : ['rifle', 'pistol'];
    this.run = {
      seed, floor: 1, hp: 100, maxHpBonus: 0, scrap: 20,
      weapons: loadout.map((id) => ({ id, ammo: WEAPONS[id].mag, overload: false })), current: 0,
      consumables: ['stim', 'sedative', null, null], actives: [], passives: [],
      psyche: new Psyche(this.rng), combo: new Combo(),
      stats: { kills: 0, rooms: 0, prisoners: 0, perfectReloads: 0, overloads: 0 },
      seen: [], gags: [], lazarusUsed: false, cheats, lastGateway: null,
      map: generateFloor(this.rng, 1),
    };
    this.eegNotice = '';
    this.ekg = new EKG();
    this.eeg = new EEG();
    this.profile.attempts++;
    this.save();
    const go = () => {
      if (cheats.bossSkip) {
        const map = this.run.map;
        for (const n of map.nodes) n.state = 'burnt';
        map.nodes[map.core].state = 'available';
        this.selectNode(map.core);
      } else this.showMap();
    };
    if (!this.profile.introSeen) { this.profile.introSeen = true; this.save(); this.readLore(LORE[0], go, true); } else go();
  }
  showMap() {
    clear();
    setTempo(1);
    this.screen = new MapScreen(this);
    playMusic('map');
  }
  selectNode(id) {
    const node = enterNode(this.run.map, id);
    sfx('decrypt');
    this.screen = new DecryptScreen(this, node, () => this.startNode(node));
  }
  startNode(node) {
    const run = this.run;
    clear();
    for (const a of run.actives) a.used = false;
    const themes = ['chapel', 'morgue', 'reactor', 'abyss'];
    switch (node.type) {
      case 'initiation':
        this.enterRoom({ kind: 'initiation', node: 'initiation', theme: 'chapel', waves: run.floor === 1 ? [['angel', 'angel'], ['angel', 'angel', 'angel']] : combatWaves(this.rng, run.floor, 0) });
        break;
      case 'combat':
        this.enterRoom({ kind: 'combat', node: 'combat', theme: this.rng.pick(themes), waves: combatWaves(this.rng, run.floor, run.stats.rooms) });
        break;
      case 'quarantine': {
        const variant = this.rng.chance(0.45) ? 'aaron' : 'purge';
        this.enterRoom({ kind: 'quarantine', node: 'quarantine', variant, theme: variant === 'aaron' ? 'morgue' : 'abyss', waves: quarantineWaves(this.rng, run.floor, variant) });
        break;
      }
      case 'core':
        this.enterRoom({ kind: 'boss', node: 'core', theme: 'throne', waves: [['warden']] }, 'boss');
        break;
      case 'gateway': {
        const pick = run.lastGateway === 'dance' ? 'bulkhead' : run.lastGateway === 'bulkhead' ? 'dance' : this.rng.pick(['dance', 'bulkhead']);
        run.lastGateway = pick;
        stopMusic();
        this.screen = pick === 'dance' ? new DanceDuel(this) : new BulkheadQTE(this);
        break;
      }
      case 'containment': this.containment(); break;
      case 'null': this.nullZone(); break;
      default: this.showMap();
    }
  }
  enterRoom(cfg, music = 'combat') {
    clear();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.screen = new CombatRoom(this, cfg);
    playMusic(music);
  }
  finishNode(msg) {
    const run = this.run;
    clearNode(run.map, run.map.current);
    run.stats.rooms++;
    this.showMap();
    if (msg) toast(msg, 2600);
  }
  roomComplete(res) {
    const run = this.run;
    const st = this.stats();
    const scrapOf = (n) => Math.round(n * (1 + st.scrapMul));
    switch (res.kind) {
      case 'initiation':
      case 'combat':
      case 'ambush': {
        const scrap = scrapOf(res.scrap + 10);
        run.scrap += scrap;
        let msg = `+${scrap} SCRAP`;
        if (st.dropAlways || this.rng.chance(0.4)) {
          const drop = this.rng.weighted([['stim', 4], ['sedative', 4], ['adrenaline', 2]]);
          if (this.giveConsumable(drop)) msg += ` • ${CONSUMABLES[drop].name.toUpperCase()}`;
          else { run.scrap += scrapOf(15); msg += ` • GRID FULL (+${scrapOf(15)} SCRAP)`; }
        }
        this.finishNode(msg);
        break;
      }
      case 'quarantine': {
        run.scrap += scrapOf(res.scrap + 40);
        this.showBackdrop('abyss', '[QUARANTINE_SECTOR] RESTORED', 'HIGH-TIER REQUISITION: CHOOSE ONE');
        const opts = [this.weaponOffer(), { kind: 'maxhp' }, { kind: 'item', id: this.itemOffers(1, 2)[0] }].filter((o) => o && (o.kind !== 'item' || o.id) && (o.kind !== 'weapon' || o.id));
        this.choose('REQUISITION APPROVED', 'Take one. The rest go back to G.O.D.', opts, () => this.finishNode(`+${scrapOf(res.scrap + 40)} SCRAP`));
        break;
      }
      case 'boss': {
        run.scrap += scrapOf(res.scrap + 80);
        this.unlockLore();
        this.showBackdrop('throne', 'THE FIRST RIPPLE HAS BEEN CAST', 'THE SEA BEGINS TO WAKE');
        const opts = [];
        if (!run.weapons.some((w) => w.id === 'judgment')) opts.push({ kind: 'weapon', id: 'judgment' }); else { const w = this.weaponOffer(); if (w && w.id) opts.push(w); }
        const it = this.itemOffers(1, 2)[0];
        if (it) opts.push({ kind: 'item', id: it });
        opts.push({ kind: 'restore' });
        this.choose('SPOILS OF THE SYSTEM_CORE', 'Choose one before the elevator unlocks.', opts, () => this.descend());
        break;
      }
      case 'bulkhead': {
        if (res.attempts === 0) {
          const revealed = revealNext(run.map, run.map.current);
          run.scrap += scrapOf(30);
          this.finishNode(`PERFECT OVERRIDE • +${scrapOf(30)} SCRAP • INTEL: ${revealed.length} NODE${revealed.length === 1 ? '' : 'S'} DECRYPTED`);
        } else {
          run.scrap += scrapOf(15);
          this.finishNode(`BULKHEAD OPEN AFTER ${res.attempts + 1} TRIES • +${scrapOf(15)} SCRAP`);
        }
        break;
      }
      case 'dance': {
        if (res.won) {
          this.showBackdrop('chapel', 'G.O.D. NEURAL CALIBRATION COMPLETE', 'FUNDING APPROVED — THREE CONTAINMENT PEDESTALS RISE FROM THE FLOOR');
          const opts = [];
          const items = this.itemOffers(2, 2);
          for (const id of items) opts.push({ kind: 'item', id });
          const w = this.weaponOffer(['heavy', 'experimental']);
          if (w && w.id) opts.push(w);
          while (opts.length < 3) opts.push({ kind: 'restore' });
          this.choose('CHOOSE ONE', 'The other two sink back into the floor.', opts.slice(0, 3), () => this.finishNode());
        } else {
          const dmg = 40 * floorMult(run.floor);
          run.hp -= dmg;
          run.combo.snap();
          if (run.hp <= 0) { run.hp = 0; this.gameOver('flatline'); return; }
          toast('ONE SHOT. UNAVOIDABLE. BOOTED TO THE NEAREST COMBAT NODE.', 2600);
          this.enterRoom({ kind: 'ambush', node: 'combat', theme: 'reactor', waves: combatWaves(this.rng, run.floor, run.stats.rooms).slice(0, 2) });
        }
        break;
      }
      default: this.finishNode();
    }
  }
  descend() {
    const run = this.run;
    run.floor++;
    run.lazarusUsed = false;
    run.map = generateFloor(this.rng, run.floor);
    this.profile.bestFloor = Math.max(this.profile.bestFloor, run.floor);
    this.save();
    clear();
    stopMusic();
    sfx('door');
    this.screen = new ElevatorScreen(this, () => this.showMap());
  }
  gameOver(kind) {
    const run = this.run;
    const p = this.profile;
    p.bestFloor = Math.max(p.bestFloor, run.floor);
    p.bestCombo = Math.max(p.bestCombo, run.combo.best);
    p.bestScore = Math.max(p.bestScore, run.combo.score);
    this.save();
    clear();
    stopMusic();
    this.paused = false;
    this.screen = new GameOverScreen(this, kind, { floor: run.floor, rooms: run.stats.rooms, kills: run.stats.kills, prisoners: run.stats.prisoners, perfectReloads: run.stats.perfectReloads, overloads: run.stats.overloads, best: run.combo.best, score: run.combo.score });
  }

  // ---------------------------------------------------------------- items & weapons
  itemOffers(n, minTier = 1) {
    const r = this.run;
    const owned = new Set([...r.passives, ...r.actives.map((a) => a.id)]);
    let pool = ITEMS.filter((i) => !owned.has(i.id) && i.tier >= minTier);
    if (pool.length < n) pool = ITEMS.filter((i) => !owned.has(i.id));
    return this.rng.shuffle(pool.map((i) => i.id)).slice(0, n);
  }
  weaponOffer(tiers = null) {
    const owned = new Set(this.run.weapons.map((w) => w.id));
    const pool = Object.keys(WEAPONS).filter((id) => !owned.has(id) && (!tiers || tiers.includes(WEAPONS[id].tier)));
    return pool.length ? { kind: 'weapon', id: this.rng.pick(pool) } : null;
  }
  acquireItem(id, done) {
    const run = this.run;
    const item = itemById(id);
    const gain = item.passive?.maxHp || 0;
    if (item.kind === 'passive') {
      run.passives.push(id);
      run.hp += gain;
      sfx('reward');
      done(true);
      return;
    }
    const add = () => { run.actives.push({ id, used: false }); if (item.kind === 'both') run.hp += gain; sfx('reward'); done(true); };
    if (run.actives.length < 4) { add(); return; }
    const panel = el('div', { class: 'panel narrow' },
      el('h2', {}, 'RELIC SLOTS FULL (4/4)'),
      el('p', {}, `Discard a relic to make room for ${item.name}.`),
      el('div', { class: 'choices small' }, run.actives.map((a, i) => {
        const it = itemById(a.id);
        return el('button', { class: 'card', onclick: () => {
          pop();
          run.actives.splice(i, 1);
          run.hp = Math.min(run.hp, this.maxHp());
          add();
        } }, itemIcon(a.id, 64), el('b', {}, it.name), el('span', {}, 'DISCARD'));
      })),
      el('button', { class: 'btn', onclick: () => { pop(); done(false); } }, 'KEEP WHAT I HAVE'),
    );
    push(panel);
  }
  acquireWeapon(id, done) {
    const run = this.run;
    const w = { id, ammo: WEAPONS[id].mag, overload: false };
    if (run.weapons.length < 2) { run.weapons.push(w); sfx('reward'); done(true); return; }
    push(el('div', { class: 'panel narrow' },
      el('h2', {}, 'TWO-WEAPON LIMIT'),
      el('p', {}, `${WEAPONS[id].name} (${TIERS[WEAPONS[id].tier].label}). Replace which?`),
      el('div', { class: 'choices small' }, run.weapons.map((cur, i) => el('button', { class: 'card', onclick: () => {
        pop();
        run.weapons[i] = w;
        sfx('reward');
        done(true);
      } }, weaponIcon(cur.id), el('b', {}, `${i === 0 ? 'PRIMARY' : 'SECONDARY'}: ${WEAPONS[cur.id].name}`), el('span', {}, 'REPLACE')))),
      el('button', { class: 'btn', onclick: () => { pop(); done(false); } }, 'LEAVE IT'),
    ));
  }
  applyOption(o, done) {
    const run = this.run;
    if (o.kind === 'item') this.acquireItem(o.id, done);
    else if (o.kind === 'weapon') this.acquireWeapon(o.id, done);
    else if (o.kind === 'maxhp') { run.maxHpBonus += 25; run.hp = this.maxHp(); this.setLoad(Math.max(0, run.psyche.load - 30)); sfx('reward'); done(true); } else if (o.kind === 'restore') { run.hp = this.maxHp(); this.setLoad(0); sfx('reward'); done(true); }
  }
  optionCard(o, onPick) {
    let icon, title, cat, body, flavor = '';
    if (o.kind === 'item') {
      const it = itemById(o.id);
      icon = itemIcon(o.id); title = it.name; cat = it.kind === 'both' ? 'ACTIVE / PASSIVE' : it.kind.toUpperCase(); body = it.effect; flavor = `${it.voice}\n${it.desc}`;
    } else if (o.kind === 'weapon') {
      const w = WEAPONS[o.id];
      icon = weaponIcon(o.id); title = w.name; cat = `${w.kind.toUpperCase()} • ${TIERS[w.tier].label} RELOAD (${TIERS[w.tier].min}–${TIERS[w.tier].max} ARROWS)`; body = w.desc;
    } else if (o.kind === 'maxhp') {
      icon = itemIcon('heart'); title = 'Reinforced Myocardium'; cat = 'UPGRADE'; body = '+25 Max HP, full Vitals restore, −30% Cognitive Load.';
    } else {
      icon = itemIcon('stim'); title = 'Full Restoration'; cat = 'MEDICAL'; body = 'Vitals to maximum. Cognitive Load to 0%.';
    }
    return el('button', { class: 'card pod', onclick: onPick },
      icon, el('b', {}, title), el('i', {}, cat), el('p', {}, body), flavor ? el('small', {}, flavor) : null);
  }
  choose(title, sub, options, done) {
    const panel = el('div', { class: 'panel wide' },
      el('h2', {}, title), el('p', { class: 'sub' }, sub),
      el('div', { class: 'choices' }, options.map((o) => this.optionCard(o, () => {
        this.applyOption(o, (ok) => { if (ok) { clear(); done(); } });
      }))),
    );
    show(panel);
  }
  showBackdrop(theme, title, sub) {
    this.screen = new BackdropScreen(this, theme, { title, sub });
  }

  // ---------------------------------------------------------------- Containment Cell
  containment() {
    const run = this.run;
    this.showBackdrop('morgue', '[CONTAINMENT_CELL]', 'TWO ANOMALIES. EXTRACT ONE. THE SYSTEM LOCKS THE OTHER AWAY FOREVER.');
    playMusic('calm');
    const ids = this.itemOffers(2);
    let taken = false;
    const exit = el('button', { class: 'btn big', disabled: true, onclick: () => this.finishNode(taken ? null : 'LEFT EMPTY-HANDED') }, 'EXIT (LOCKED)');
    const pods = ids.map((id) => {
      const card = this.optionCard({ kind: 'item', id }, () => {
        if (taken) return;
        this.acquireItem(id, (ok) => {
          if (!ok) return;
          taken = true;
          card.classList.add('taken');
          pods.forEach((p) => { if (p !== card) { p.classList.add('locked'); p.disabled = true; } });
          sfx('door');
          exit.disabled = false;
          exit.textContent = 'EXIT TO NETWORK';
          skip.remove();
        });
      });
      return card;
    });
    const skip = el('button', { class: 'btn', onclick: () => { taken = false; this.finishNode('LEFT EMPTY-HANDED'); } }, 'SKIP / LEAVE EMPTY-HANDED');
    show(el('div', { class: 'panel wide vault' },
      el('h2', {}, 'CONTAINMENT UNITS 0x1 / 0x2'),
      el('p', { class: 'sub' }, `Active relics: ${run.actives.length}/4 slots. Passives are unlimited. The door unlocks once you choose.`),
      el('div', { class: 'choices' }, pods),
      el('div', { class: 'row' }, skip, exit),
    ));
  }

  // ---------------------------------------------------------------- Null Zones
  nullZone() {
    const run = this.run;
    this.setLoad(Math.max(0, run.psyche.load - 20));
    playMusic('calm');
    const loreLeft = this.profile.loreUnlocked < LORE.length;
    const gagsLeft = GAG_ROOMS.filter((g) => !run.gags.includes(g.title));
    const kind = this.rng.weighted([['story', loreLeft ? 35 : 0], ['dispensary', 25], ['gag', gagsLeft.length ? 25 : 0], ['armory', 15]]);
    const rest = 'The EKG steadies. The EEG flattens. (−20% Cognitive Load)';
    if (kind === 'story') {
      this.showBackdrop('abyss', '[NULL_ZONE] // ARCHIVE TERMINAL', rest);
      const entry = LORE[this.profile.loreUnlocked];
      this.unlockLore();
      this.setLoad(Math.max(0, run.psyche.load - 10));
      this.readLore(entry, () => this.finishNode(`ARCHIVE ENTRY RECOVERED: ${entry.title.toUpperCase()}`));
    } else if (kind === 'dispensary') {
      this.showBackdrop('morgue', '[NULL_ZONE] // SACRAMENT DISPENSER™', rest);
      this.dispensary();
    } else if (kind === 'gag') {
      const gag = this.rng.pick(gagsLeft);
      run.gags.push(gag.title);
      this.showBackdrop(this.rng.pick(['chapel', 'reactor', 'abyss']), `[NULL_ZONE] // ${gag.title}`, rest);
      this.gagRoom(gag);
    } else {
      this.showBackdrop('reactor', '[NULL_ZONE] // HIDDEN ARMORY', rest);
      this.hiddenArmory();
    }
  }
  dispensary() {
    const run = this.run;
    const render = () => {
      const goods = [
        ...Object.entries(CONSUMABLES).map(([id, c]) => ({ id, name: c.name, price: c.price, desc: c.desc, icon: id, buy: () => this.giveConsumable(id) })),
        { id: 'confession', name: 'Full Confession', price: 40, desc: 'Restores 30 Vitals. "Your sins are forgiven. Your co-pay is not."', icon: 'heart', buy: () => { this.heal(30); return true; } },
      ];
      const full = !run.consumables.includes(null);
      show(el('div', { class: 'panel wide' },
        el('h2', {}, 'SACRAMENT DISPENSER™'),
        el('p', { class: 'sub' }, `"Thank you for choosing G.O.D. Healthcare. Please do not shake the machine." • SCRAP: ${run.scrap} • GRID: ${run.consumables.filter(Boolean).length}/4`),
        el('div', { class: 'choices shop' }, goods.map((g) => {
          const cant = run.scrap < g.price || (g.id !== 'confession' && full) || (g.id === 'confession' && run.hp >= this.maxHp());
          return el('button', { class: 'card', disabled: cant, onclick: () => {
            if (g.buy()) { run.scrap -= g.price; sfx('coin'); render(); }
          } }, itemIcon(g.icon, 80), el('b', {}, g.name), el('i', {}, `${g.price} SCRAP`), el('p', {}, g.desc));
        })),
        el('button', { class: 'btn big', onclick: () => this.finishNode() }, 'LEAVE'),
      ));
    };
    render();
  }
  gagRoom(gag) {
    const run = this.run;
    const out = el('p', { class: 'result' });
    const cont = el('button', { class: 'btn big', style: 'display:none', onclick: () => this.finishNode() }, 'CONTINUE');
    const opts = el('div', { class: 'row wrap' }, gag.options.map((o) => el('button', { class: 'btn', disabled: o.cost && run.scrap < o.cost, onclick: () => {
      if (o.cost) run.scrap -= o.cost;
      const e = o.effect || {};
      const notes = [];
      if (e.load) { this.setLoad(Math.max(0, Math.min(99, run.psyche.load + e.load))); notes.push(`${e.load > 0 ? '+' : ''}${e.load}% LOAD`); }
      if (e.scrap) { const n = Math.round(e.scrap * (1 + this.stats().scrapMul)); run.scrap += n; notes.push(`+${n} SCRAP`); }
      if (e.maxHp) { run.maxHpBonus += e.maxHp; run.hp += e.maxHp; notes.push(`+${e.maxHp} MAX HP`); }
      if (e.consumable) notes.push(this.giveConsumable(e.consumable) ? `+1 ${CONSUMABLES[e.consumable].name.toUpperCase()}` : 'GRID FULL');
      out.textContent = `${o.result}  [${notes.join(' • ') || 'NOTHING HAPPENS'}]`;
      opts.remove();
      cont.style.display = '';
      sfx('uiConfirm');
    } }, o.label + (o.cost ? '' : ''))));
    show(el('div', { class: 'panel' }, el('h2', {}, gag.title), el('p', { class: 'story' }, gag.text), opts, out, cont));
  }
  hiddenArmory() {
    const owned = new Set(this.run.weapons.map((w) => w.id));
    const offers = this.rng.shuffle(Object.keys(WEAPONS).filter((id) => !owned.has(id))).slice(0, 2);
    show(el('div', { class: 'panel wide' },
      el('h2', {}, 'HIDDEN ARMORY'),
      el('p', { class: 'sub' }, 'A F.A.I.T.H. weapons cache behind a false confessional. Take one, or leave them for the next subject.'),
      el('div', { class: 'choices' }, offers.map((id) => this.optionCard({ kind: 'weapon', id }, () => this.acquireWeapon(id, (ok) => { if (ok) this.finishNode(`${WEAPONS[id].name.toUpperCase()} ACQUIRED`); })))),
      el('button', { class: 'btn big', onclick: () => this.finishNode() }, 'LEAVE'),
    ));
  }

  // ---------------------------------------------------------------- lore
  unlockLore() {
    if (this.profile.loreUnlocked < LORE.length) { this.profile.loreUnlocked++; this.save(); }
  }
  readLore(entry, done, intro = false) {
    const body = el('div', { class: 'lore-text' });
    let typer = null;
    const cont = el('button', { class: 'btn big', onclick: () => {
      if (typer && !typer.done) { typer.finish(); return; }
      clear();
      done();
    } }, intro ? 'WAKE UP' : 'CONTINUE');
    show(el('div', { class: 'lore' },
      el('div', { class: 'lore-art', style: `background-image:url("assets/art/${entry.art}.jpg")` }),
      el('div', { class: 'lore-panel' }, el('h2', {}, entry.title), body, cont),
    ));
    typer = typeInto(body, entry.text, intro ? 90 : 240);
  }
  archive() {
    const unlocked = this.profile.cheats.unlockAll ? LORE.length : this.profile.loreUnlocked;
    const list = el('div', { class: 'archive-list' }, LORE.map((e, i) => el('button', { class: 'btn left', disabled: i >= unlocked, onclick: () => {
      push(el('div', { class: 'lore' },
        el('div', { class: 'lore-art', style: `background-image:url("assets/art/${e.art}.jpg")` }),
        el('div', { class: 'lore-panel' }, el('h2', {}, e.title), el('div', { class: 'lore-text' }, e.text), el('button', { class: 'btn big', onclick: () => pop() }, 'BACK')),
      ));
    } }, i < unlocked ? e.title : `[ENCRYPTED ENTRY ${String(i).padStart(2, '0')}]`)));
    push(el('div', { class: 'panel wide' },
      el('h2', {}, 'LORE ARCHIVE'),
      el('p', { class: 'sub' }, `${unlocked}/${LORE.length} entries recovered. Story terminals in [NULL_ZONE] nodes and every fallen Warden decrypt more.`),
      list,
      el('button', { class: 'btn', onclick: () => pop() }, 'BACK'),
    ));
  }

  // ---------------------------------------------------------------- menus
  pause() {
    if (this.paused) return;
    this.paused = true;
    const panel = el('div', { class: 'panel narrow' },
      el('h2', {}, 'PAUSED'),
      el('p', { class: 'sub' }, `FLOOR ${this.run.floor} • SCRAP ${this.run.scrap} • BEST COMBO ×${this.run.combo.best}`),
      el('button', { class: 'btn big', autofocus: true, onclick: () => this.resume() }, 'RESUME'),
      el('button', { class: 'btn', onclick: () => this.howTo() }, 'HOW TO SURVIVE'),
      el('button', { class: 'btn', onclick: () => this.settingsPanel() }, 'SETTINGS'),
      el('button', { class: 'btn', onclick: () => this.psychosisReport() }, 'PSYCH EVALUATION'),
      el('button', { class: 'btn danger', onclick: () => { this.paused = false; clear(); this.gameOver('flatline'); } }, 'ABANDON SUBJECT'),
    );
    this.pauseDepth = depth();
    push(panel);
  }
  resume() {
    this.paused = false;
    popTo(this.pauseDepth);
  }
  psychosisReport() {
    const r = this.run;
    const rows = Object.entries(r.psyche.assign).map(([t, id]) => {
      const h = HALLUCINATIONS.find((x) => x.id === id);
      const on = r.psyche.has(id);
      return el('div', { class: `psy ${on ? 'on' : ''}` }, el('b', {}, `${t}%`), el('span', {}, h.name), el('small', {}, h.desc));
    });
    push(el('div', { class: 'panel' },
      el('h2', {}, 'PSYCH EVALUATION — SUBJECT 87'),
      el('p', { class: 'sub' }, 'The invisible Cognitive Load bar deals 7 of 11 hallucinations to these thresholds each run. They stack. Dropping below a threshold removes that penalty.'),
      el('div', { class: 'psy-list' }, rows),
      el('button', { class: 'btn', onclick: () => pop() }, 'BACK'),
    ));
  }
  howTo() {
    const rows = [
      ['HOLD SPACE', 'Pop up out of cover (exposed). Release to duck.'],
      ['MOUSE / LEFT CLICK', 'Aim / fire (hold for automatic weapons). Shoot grenades out of the air.'],
      ['Q / RIGHT CLICK / WHEEL', 'Swap between Primary and Secondary.'],
      ['R or click a gun (in cover)', 'Start a reload chart. Bigger guns = longer, faster charts.'],
      ['← ↓ ↑ → or W A S D', 'Hit the falling arrows as they overlap the glowing mark.'],
      ['1–4 / 5–8 (in cover)', 'Consumables / relics (or click them in the cover UI).'],
      ['ESC', 'Pause.'],
    ];
    push(el('div', { class: 'panel wide' },
      el('h2', {}, 'HOW TO SURVIVE HADES'),
      el('table', { class: 'keys' }, rows.map(([k, v]) => el('tr', {}, el('td', {}, k), el('td', {}, v)))),
      el('ul', { class: 'tips' }, TIPS.map((t) => el('li', {}, t))),
      el('p', { class: 'sub' }, 'Your Vitals and Cognitive Load are invisible bars. Read the EKG (bottom-left): green = stable, amber = trauma, red = critical. The EEG below it grows taller and sharper as your mind slips.'),
      el('button', { class: 'btn', onclick: () => pop() }, 'BACK'),
    ));
  }
  settingsPanel() {
    const s = this.settings;
    const slider = (key, label) => el('label', { class: 'set' }, el('span', {}, label), el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], oninput: (e) => { s[key] = +e.target.value; this.applySettings(); this.save(); } }));
    const toggle = (key, label) => el('label', { class: 'set' }, el('span', {}, label), el('input', { type: 'checkbox', checked: s[key], onchange: (e) => { s[key] = e.target.checked; this.applySettings(); this.save(); } }));
    push(el('div', { class: 'panel narrow' },
      el('h2', {}, 'SETTINGS'),
      slider('master', 'MASTER VOLUME'), slider('music', 'MUSIC'), slider('sfx', 'EFFECTS'),
      toggle('reduceFlash', 'REDUCE FLASHING'), toggle('shake', 'SCREEN SHAKE'), toggle('voice', 'SYNTH VOICE LINES (TTS)'),
      el('button', { class: 'btn', onclick: () => pop() }, 'BACK'),
    ));
  }
  armory() {
    const lo = this.profile.loadout || ['rifle', 'pistol'];
    const pick = [...lo];
    const render = () => {
      const grid = (slot) => el('div', { class: 'choices small' }, Object.keys(WEAPONS).map((id) => el('button', { class: `card ${pick[slot] === id ? 'taken' : ''}`, disabled: pick[1 - slot] === id, onclick: () => { pick[slot] = id; this.profile.loadout = [...pick]; this.save(); pop(); render(); } }, weaponIcon(id), el('b', {}, WEAPONS[id].name))));
      push(el('div', { class: 'panel wide' },
        el('h2', {}, 'ARMORY (UNLOCK ALL)'),
        el('p', { class: 'sub' }, 'PRIMARY'), grid(0),
        el('p', { class: 'sub' }, 'SECONDARY'), grid(1),
        el('button', { class: 'btn', onclick: () => pop() }, 'DONE'),
      ));
    };
    render();
  }
}

// ---------------------------------------------------------------------------
// Encounter tables
// ---------------------------------------------------------------------------
export function combatWaves(rng, floor, roomNo) {
  const n = rng.int(2, 3) + (floor >= 3 ? 1 : 0);
  const waves = [];
  for (let w = 0; w < n; w++) {
    const size = rng.int(2, 3 + Math.min(2, floor - 1 + (roomNo > 3 ? 1 : 0)));
    const wave = [];
    let big = 0;
    for (let i = 0; i < size; i++) {
      let type = rng.weighted([['angel', 6], ['ember', roomNo >= 1 ? 2 : 0], ['elite', floor >= 2 ? 1.6 : 0.3], ['berserker', roomNo >= 2 ? 1.1 : 0], ['crawler', floor >= 2 ? 0.9 : roomNo >= 3 ? 0.4 : 0]]);
      if (type === 'berserker' && big++) type = 'angel';
      wave.push(type);
    }
    waves.push(wave);
  }
  return waves;
}

export function quarantineWaves(rng, floor, variant) {
  const total = variant === 'aaron' ? 20 : 30;
  const waves = [];
  let left = total;
  while (left > 0) {
    const size = Math.min(left, rng.int(5, 6));
    const wave = [];
    for (let i = 0; i < size; i++) wave.push(rng.weighted([['angel', 5], ['elite', 2.5], ['ember', 1.5], ['crawler', floor >= 2 ? 1.6 : 0.8], ['berserker', floor >= 2 ? 0.6 : 0.4]]));
    waves.push(wave);
    left -= size;
  }
  if (variant === 'aaron') waves.push(['aaron']);
  return waves;
}
