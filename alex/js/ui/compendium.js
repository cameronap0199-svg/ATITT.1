// The Compendium: every demon, crossover creature, item and ride, with rendered 3D
// portraits (the actual in-game models, lit and framed) and illustrated item cards.
// Things you haven't met yet stay as silhouettes. Progress persists between runs.

import * as THREE from 'three';
import { G } from '../state.js';
import { MODELS } from '../actors/enemyModels.js';
import { CROSS_MODELS } from '../actors/crossoverModels.js';
import { MC_MODELS, MC_INFO } from '../mc/mobs.js';
import { SPECIES_LIST } from '../pokemon/dex.js';
import { TYPES } from '../pokemon/types.js';
import { spriteURL } from '../pokemon/sprites.js';
import { ENEMY_INFO } from '../world/encounters.js';
import { CROSS_INFO } from '../world/rifts.js';
import { ITEMS, GADGETS, itemInfo, WEAPON_PRICES } from '../items.js';
import { VEHICLES, BUILD } from '../vehicles.js';
import { MELEE, RANGED } from '../combat/weapons.js';

const KEY = 'akdh2.codex.v1';
export const codex = {
  data: (() => { try { return { seen: {}, kills: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { seen: {}, kills: {} }; } })(),
  dirty: false,
  see(k) { if (!this.data.seen[k]) { this.data.seen[k] = 1; this.dirty = true; } },
  kill(k) { this.data.kills[k] = (this.data.kills[k] || 0) + 1; this.data.seen[k] = 1; this.dirty = true; },
  save() { if (!this.dirty) return; this.dirty = false; try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ } },
};

const DESC = {
  lurker: 'Swings a cursed lightstick in three-hit strings. Commits to the last one.',
  photocard: 'Shoots photocards from a binder. Break the binder to stop the volleys.',
  biasBeast: 'Screams its bias\'s name and charges. Make it hit a wall.',
  queue: 'Summons queue ropes. Low rope: jump. High rope: stay down.',
  mimic: 'Pretends to be merch. Is not merch.',
  fancam: 'A camera frame that lags behind you. Keep moving. Hits other demons too.',
  stalker: 'Slow while you look at it. Very fast while you don\'t.',
  hoarder: 'Armoured by albums. Hits from behind spill CDs.',
  chanter: 'Buffs nearby demons. Buffs don\'t stack. It still tries.',
  ultBias: 'An elite that follows you from room to room in spirit.',
  akgae: 'Hits everything. Changes target whenever anyone hits it.',
  parasocial: 'Grabs and drags. Attack to break free; its stretched arm is the weak point.',
  queen: 'Revives fallen demons with a costume change.',
  fanwar: 'Splits into two Solo Stans who hate each other.',
  delulu: 'Verse, pre-chorus, chorus, final pose, encore.',
  grunt: 'Little methane-breathing alien. Panics. Sometimes charges you holding two plasma grenades.',
  jackal: 'Holds a shield in front. Get around it, or break it.',
  elite: 'Recharging shield and an energy sword lunge. Pop the shield, then punish.',
  hunter: 'Armoured slab with a fuel rod cannon. The glowing back is very soft.',
  zombie: 'Slow, sturdy, groans a lot. Sometimes a baby. Sometimes brings friends.',
  skeleton: 'Kites you and shoots arrows that drop a little.',
  creeper: 'Walks up silently and hisses. Run away and it gives up. Stand still and it doesn\'t.',
  enderman: 'Harmless until you stare at it. Teleports away from bullets.',
  marine: 'Lines up a rifle shot down a lane. Step out of the lane.',
  fishman: 'Flicks water bullets (Devil Fruit users take double) and palm-strikes up close.',
  pacifista: 'A cyborg with mouth lasers and palm beams. Carries a book for some reason.',
  seaKing: 'Swims under the floor and surfaces under you. Only hittable when it\'s up.',
  pikachew: 'Calls lightning around you and Quick Attacks. Very upset about something.',
  gastlee: 'Phases through attacks, licks, and fires rings of shadow.',
  magikrap: 'Useless. Flops. If you ignore it for long enough it becomes a problem.',
  gyarados: 'What Magikrap becomes. Hyper Beam, then it has to recharge.',
  snorelax: 'Sleeps through most damage. Wakes up and body slams. Rests to heal.',
  frog: 'A plague. Comes in threes. Tongue lash.',
  locust: 'A swarm. Burns easily, shrugs off slashes.',
  charioteer: 'Charges across the room in straight lines. Arrows in between.',
  goldenCalf: 'An idol that buffs everything nearby and sprays coins. Drops a fortune.',
  goliath: 'A giant. Headshots hurt. A sling stone ends him.',
  spider: 'Leaps from a distance. Red eyes. Climbs nothing here, thankfully.',
  piglin: 'Neutral. Hit one and every zombified piglin in the room comes for you.',
  piglinBrute: 'Guards bastions. Gold axe. Does not care about your gold helmet.',
  ghast: 'Floats high, cries, spits explosive fireballs. Swing at a fireball to send it back.',
  blaze: 'Hovers in fortresses. Charges up and spits three fireballs. Drops blaze rods.',
  magmaCube: 'Hops at you. Splits into smaller cubes when it dies.',
  witherSkeleton: 'Tall, black, stone sword. Lives in Nether fortresses.',
  silverfish: 'Tiny. Fast. Hurt one and its friends crawl out of the walls.',
};

// ---------------------------------------------------------------------------- portraits
let R = null;
const cache = new Map();
function renderer() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(176, 176, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a2a66', 1.7));
  const key = new THREE.DirectionalLight('#ffffff', 1.8); key.position.set(3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#ff4fa3', 1.2); rim.position.set(-4, 2, -4); scene.add(rim);
  R = { r, scene, cam: new THREE.PerspectiveCamera(32, 1, 0.1, 200) };
  return R;
}
function portrait(id, make) {
  if (cache.has(id)) return cache.get(id);
  let url = '';
  try {
    const { r, scene, cam } = renderer();
    const m = make();
    const fake = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), pose: null, surfaceK: 1, _dt: 0.016 };
    m.anim?.(fake, 0.016, false);
    scene.add(m.group);
    m.group.rotation.y = -0.45;
    m.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m.group);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const h = Math.max(size.y, size.x * 0.9, size.z * 0.6, 0.8);
    cam.position.set(c.x, c.y + h * 0.12, c.z + h * 2.1);
    cam.lookAt(c);
    r.render(scene, cam);
    url = r.domElement.toDataURL();
    scene.remove(m.group);
    m.group.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.(); });
  } catch { url = ''; }
  cache.set(id, url);
  return url;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TAG = { halo: 'HALO', minecraft: 'MC', onepiece: 'OP', pokemon: 'PKMN', bible: 'BIBLE' };

function enemyCards(keys, info, make) {
  return keys.map((k) => {
    const seen = codex.data.seen[k];
    const i = info[k];
    const img = portrait('e:' + k, make(k));
    const fr = i.franchise;
    return `<div class="comp-card ${seen ? '' : 'locked'}" data-franchise="${fr || ''}">
      <div class="cc-art">${img ? `<img src="${img}" alt="">` : ''}${fr ? `<span class="cc-tag">${TAG[fr]}</span>` : ''}</div>
      <b>${seen ? esc(i.name) : '???'}</b>
      <small>${seen ? esc(DESC[k] || '') : 'Not encountered yet.'}</small>
      <i>Threat ${i.threat}${codex.data.kills[k] ? ' · defeated ' + codex.data.kills[k] : ''}</i></div>`;
  }).join('');
}

function itemCards() {
  const all = [...Object.keys(ITEMS).filter((k) => ITEMS[k].cat !== 'special' || k === 'catPhoto'), ...Object.keys(WEAPON_PRICES).map((w) => 'w:' + w), ...Object.keys(GADGETS).map((g) => 'g:' + g)];
  return all.map((id) => {
    const it = itemInfo(id);
    const cat = it.franchise ? 'rift' : it.cat;
    return `<div class="comp-card item" data-cat="${cat}" data-franchise="${it.franchise || ''}"><div class="cc-art"><span class="cc-icon">${it.icon || '✦'}</span>${it.franchise ? `<span class="cc-tag">${TAG[it.franchise]}</span>` : ''}</div><b>${esc(it.name)}</b><small>${esc(it.desc || '')}</small><i>${it.weapon ? 'Weapon' : it.gadget ? 'Gadget' : cat === 'counter' ? 'Counter' : cat === 'snack' ? 'Snack aisle' : cat === 'backwall' ? 'Back wall' : cat === 'rift' ? 'Rift loot' : 'Special'}${it.price ? ' · $' + it.price : ''}</i></div>`;
  }).join('');
}

function pokedexCards() {
  const d = codex.data.dex || { seen: {}, caught: {} };
  const seen = SPECIES_LIST.filter((s) => d.seen[s.id]).length, caught = SPECIES_LIST.filter((s) => d.caught[s.id]).length;
  return `<p class="sub" style="grid-column:1/-1">Seen ${seen} · Caught ${caught} · ${SPECIES_LIST.length} in the regional dex</p><div class="dex-grid" style="grid-column:1/-1">` + SPECIES_LIST.map((s, i) => {
    const sn = d.seen[s.id], ct = d.caught[s.id];
    return `<div class="dex-card ${sn ? '' : 'unseen'} ${ct ? 'caught' : ''}" style="--i:${Math.min(i, 60)}"><img src="${spriteURL(s.id)}" alt=""><b>${sn ? esc(s.name) : '???'}</b><i>No.${String(s.no).padStart(3, '0')}${sn ? ' · ' + s.types.map((t) => TYPES[t].name).join('/') : ''}</i></div>`;
  }).join('') + '</div>';
}

function vehicleCards() {
  return Object.entries(VEHICLES).map(([k, v]) => {
    const img = portrait('v:' + k, () => ({ group: BUILD[k]().group }));
    return `<div class="comp-card" data-franchise="${v.franchise}"><div class="cc-art">${img ? `<img src="${img}" alt="">` : ''}<span class="cc-tag">${TAG[v.franchise]}</span></div><b>${v.icon} ${esc(v.name)}</b><small>${esc(v.hint)}</small><i>Top speed ${v.maxSpeed} · ${v.hp >= 999 ? 'indestructible' : v.hp + ' HP'}</i></div>`;
  }).join('');
}

export function compendiumPanel(onBack, makeButton) {
  const n = document.createElement('div');
  n.className = 'panel compendium';
  const venue = Object.keys(ENEMY_INFO), cross = Object.keys(CROSS_INFO), mobs = Object.keys(MC_INFO).filter((k) => !CROSS_INFO[k]);
  const seenCount = [...venue, ...cross, ...mobs].filter((k) => codex.data.seen[k]).length;
  n.innerHTML = `<h2>📖 COMPENDIUM</h2><p class="sub">${seenCount} / ${venue.length + cross.length + mobs.length} creatures encountered. Rift creatures come from Halo, Minecraft, One Piece, Pokémon and the Bible.</p>`;
  const tabs = document.createElement('div'); tabs.className = 'tabs';
  const body = document.createElement('div'); body.className = 'comp-grid';
  const pages = {
    'Venue demons': () => enemyCards(venue, ENEMY_INFO, (k) => () => MODELS[k]()),
    'Rift creatures': () => enemyCards(cross, CROSS_INFO, (k) => () => (CROSS_MODELS[k] || MC_MODELS[k])()),
    'Nether & End': () => enemyCards(mobs, MC_INFO, (k) => () => MC_MODELS[k]()),
    'Pokédex': pokedexCards,
    'Items & weapons': itemCards,
    'Vehicles': vehicleCards,
  };
  let token = 0;
  const show = (name) => {
    const my = ++token;
    [...tabs.children].forEach((t) => t.classList.toggle('on', t.textContent === name));
    body.innerHTML = '<p class="sub">Rendering portraits…</p>';
    requestAnimationFrame(() => {
      if (my !== token) return;
      body.innerHTML = pages[name]();
      body.querySelectorAll('.comp-card').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 24)));
    });
  };
  for (const name of Object.keys(pages)) { const t = document.createElement('button'); t.className = 'tab'; t.textContent = name; t.addEventListener('click', () => show(name)); tabs.appendChild(t); }
  n.appendChild(tabs);
  n.appendChild(body);
  const row = document.createElement('div'); row.className = 'row';
  row.appendChild(makeButton('Back', onBack, 'primary'));
  n.appendChild(row);
  setTimeout(() => show('Venue demons'), 0);
  return n;
}
