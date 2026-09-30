// The Gas Station (a completely mundane convenience store somehow operating inside
// the demon-infested concert route), Lost & Found pedestals, the scalper, lottery
// tickets and the floor exit.

import * as THREE from 'three';
import { G } from './state.js';
import { itemInfo, rollItems, ITEMS, poolFor } from './items.js';
import { mat, glow, textTexture, GEO } from './world/props.js';
import { rollTicket, UNUSUAL_TEXT } from './lottery.js';
export { UNUSUAL_TEXT };

const CASHIER_BUY = ['k.', 'cool.', 'we don\'t do refunds.', 'sure.', '(doesn\'t look up)', 'that it?', 'receipt? no? ok.', 'mm.'];
const CASHIER_BROKE = ['you can\'t afford that.', 'card declined. there is no card.', 'this isn\'t a library.', '...no.'];

const iconCache = new Map();
function iconTexture(icon) {
  if (iconCache.has(icon)) return iconCache.get(icon);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(icon, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  iconCache.set(icon, t);
  return t;
}
function display(item, price, x, y, z, opts = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(item.icon), transparent: true }));
  spr.scale.setScalar(opts.size || 0.7);
  g.add(spr);
  const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: opts.color || '#ffd60a', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = -0.45;
  g.add(glowRing);
  if (price != null) {
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(price === 0 ? 'FREE' : '$' + price, { bg: '#111', fg: price === 0 ? '#3cff8f' : '#ffd60a', w: 256, h: 96, font: 'bold 64px "Bungee", sans-serif', border: '#ffd60a' }) }));
    tag.scale.set(0.6, 0.22, 1);
    tag.position.y = -0.62;
    g.add(tag);
  }
  g.userData.spr = spr;
  g.userData.baseY = y;
  return g;
}

function priceOf(item) { return Math.max(1, Math.round(item.price * (G.run.mods.priceMul || 1))); }

function cashierSay(room, lines) {
  const c = room.cashier;
  if (c) G.hud.bubble(c, G.run.rng.pick(lines), '#ffffff', 1.6);
}

// ---------------------------------------------------------------------------
export function stockGasStation(room) {
  const def = room.def;
  const run = G.run;
  G.audio.playMusic('shop');
  room.cashier = { pos: new THREE.Vector3(0, 0, -9.6), height: 1.8, alive: true };
  if (!def.stock) {
    const r = room.rng;
    const counter = rollItems('counter', 3, r, run);
    const snack = rollItems('snack', r.chance(0.5) ? 3 : 2, r, run);
    const locked = rollItems('locked', r.chance(0.35) ? 2 : 1, r, run);
    const back = rollItems('backwall', 1, r, run);
    const slots = [
      [counter[0], -2.4, 1.45, -8.2, 'counter'], [counter[1], -0.8, 1.45, -8.2, 'counter'], [counter[2], 11.0, 1.6, -2.5, 'fridge'],
      [snack[0], -7, 2.05, -0.5, 'snack'], [snack[1], -3.5, 2.05, 2.2, 'snack'], [snack[2], -7, 2.05, 2.8, 'snack'],
      [locked[0], -11.2, 1.45, -5.8, 'locked'], [locked[1], -11.2, 1.45, -4.2, 'locked'],
      [back[0], 5.5, 1.7, 9.6, 'backwall'],
    ].filter((s) => s[0]);
    def.stock = slots.map(([id, x, y, z, sec]) => ({ id, x, y, z, sec, sold: false }));
  }
  for (const s of def.stock) {
    if (s.sold) continue;
    const item = itemInfo(s.id);
    const mesh = display(item, priceOf(item), s.x, s.y, s.z, { color: s.sec === 'locked' ? '#4cc9f0' : s.sec === 'backwall' ? '#ff4fa3' : '#ffd60a' });
    const standX = s.sec === 'locked' ? -10 : s.sec === 'fridge' ? 9.8 : s.x;
    const standZ = s.sec === 'counter' ? -7.1 : s.sec === 'backwall' ? 8.6 : s.z;
    const it = room.addInteractable({
      x: standX, z: standZ, r: s.sec === 'snack' ? 1.9 : 1.5, mesh, item,
      prompt: () => ({ title: item.name + '  ' + (item.icon || ''), text: item.desc, price: priceOf(item), action: 'Buy' }),
      use: () => {
        const p = priceOf(item);
        if (run.money < p) { G.audio.sfx('deny'); cashierSay(room, CASHIER_BROKE); return; }
        run.addMoney(-p, true);
        run.stat('itemsPurchased', 1);
        run.grant(s.id);
        s.sold = true;
        G.audio.sfx('buy');
        cashierSay(room, CASHIER_BUY);
        room.removeInteractable(it);
      },
    });
  }
  // lottery tickets
  const tickets = [['$2 SCRATCHER', 2, 5.6], ['$5 SCRATCHER', 5, 7.0], ['$10 K-POP MEGA MILLIONS', 10, 8.4]];
  for (const [name, price, x] of tickets) {
    const mesh = display({ icon: price === 10 ? '🎰' : '🎟️' }, price, x, 1.95, -7.9, { size: 0.5, color: '#ff006e' });
    room.addInteractable({
      x, z: -7.2, r: 0.75, mesh,
      prompt: () => ({ title: name, text: price === 10 ? 'Usually loses. Very rarely changes everything.' : price === 5 ? 'Lower chance of winning, much larger prizes.' : 'Cheap thrills. Mostly nothing.', price, action: 'Scratch' }),
      use: () => {
        if (G.hud.scratching) return;
        if (run.money < price) { G.audio.sfx('deny'); cashierSay(room, CASHIER_BROKE); return; }
        run.addMoney(-price, true);
        run.stat('lotteryTickets', 1);
        const res = rollTicket(price, run.rng);
        G.hud.scratchCard(name, res, () => applyTicket(res, room));
      },
    });
  }
  room.animators.push((t) => { for (const o of room.interactables) if (o.mesh) { o.mesh.position.y = (o.mesh.userData.baseY || 1.5) + Math.sin(t * 2 + o.x) * 0.06; } });
}

function applyTicket(res, room) {
  const run = G.run;
  if (res.type === 'nothing') { G.audio.sfx('lose'); return; }
  G.audio.sfx('win');
  if (res.amount) { run.addMoney(res.amount); run.stat('lotteryWinnings', res.amount); }
  if (res.item) run.grant(res.item);
  if (res.type === 'jackpot') { run.grant('idolContract'); G.fx.confetti(G.alex.pos.x, 3, G.alex.pos.z, 120); G.hud.popup('K-POP MEGA MILLIONS JACKPOT!!!', '#ffd60a', 3); }
  if (res.type === 'unusual') {
    const u = res.unusual;
    if (u === 'hug') G.alex.heal(999);
    if (u === 'catPhoto') run.grant('catPhoto');
    if (u === 'goldenStick') run.grant('goldenStick');
    if (u === 'otherConcert') setTimeout(() => run.teleportToPreboss(), 1200);
  }
}

// ---------------------------------------------------------------------------
export function addPedestals(room, pool, n, { choose = false } = {}) {
  const def = room.def;
  const key = 'ped_' + pool;
  if (!def[key]) def[key] = rollItems(pool, n, room.rng, G.run).map((id) => ({ id, taken: false }));
  const list = def[key];
  if (list.some((p) => p.taken) && choose) return;
  const group = [];
  list.forEach((p, i) => {
    if (p.taken) return;
    const x = list.length === 1 ? 0 : -2.6 + (5.2 * i) / (list.length - 1), z = pool === 'boss' ? -4 : 0;
    const item = itemInfo(p.id);
    const g = new THREE.Group();
    const ped = new THREE.Mesh(GEO.box, mat('#3c096c'));
    ped.scale.set(0.9, 1.0, 0.9); ped.position.y = 0.5;
    const top = new THREE.Mesh(GEO.box, glow('#ff4fa3'));
    top.scale.set(0.95, 0.06, 0.95); top.position.y = 1.02;
    g.add(ped, top);
    g.position.set(x, 0, z);
    room.group.add(g);
    const blk = room.world.add({ kind: 'pedestal', x, z, w: 0.9, d: 0.9, h: 1.0, vault: true });
    const mesh = display(item, null, x, 1.7, z, { color: '#ff4fa3' });
    const it = room.addInteractable({
      x, z, r: 1.5, mesh, item,
      prompt: () => ({ title: item.name + '  ' + (item.icon || ''), text: item.desc + (choose && list.length > 1 ? '  (Choose one — the other disappears.)' : ''), price: 0, action: 'Take' }),
      use: () => {
        p.taken = true;
        G.run.grant(p.id);
        G.audio.sfx('buy');
        G.fx.hearts(x, 1.8, z, 6, '#ffd60a');
        room.removeInteractable(it);
        if (choose) for (const o of group) if (o !== it) room.removeInteractable(o);
        if (choose) for (const q of list) q.taken = true;
      },
    });
    group.push(it);
    g.userData.block = blk;
  });
  room.animators.push((t) => { for (const o of group) if (o.mesh) o.mesh.position.y = 1.7 + Math.sin(t * 2 + o.x) * 0.08; });
}

export function addScalper(room) {
  const def = room.def;
  if (!def.scalperItem) def.scalperItem = rollItems(room.rng.chance(0.5) ? 'snack' : 'backwall', 1, room.rng, G.run)[0];
  if (!def.scalperItem || def.scalperSold) return;
  const item = itemInfo(def.scalperItem);
  const price = Math.round(priceOf(item) * 1.5);
  const npc = { pos: new THREE.Vector3(-2, 0, -7), height: 1.8, alive: true };
  G.hud.bubble(npc, 'psst. wanna buy something? no refunds.', '#ffffff', 2.5);
  const mesh = display(item, price, -2, 2.4, -6.2, { color: '#ff9f1c' });
  const it = room.addInteractable({
    x: -2, z: -5.8, r: 1.6, mesh, item,
    prompt: () => ({ title: item.name + '  ' + (item.icon || ''), text: item.desc + ' (Scalper markup: +50%.)', price, action: 'Buy' }),
    use: () => {
      if (G.run.money < price) { G.audio.sfx('deny'); G.hud.bubble(npc, 'then stop looking.', '#ffffff', 1.5); return; }
      G.run.addMoney(-price, true);
      G.run.grant(def.scalperItem);
      def.scalperSold = true;
      G.audio.sfx('buy');
      G.hud.bubble(npc, 'pleasure doing business.', '#ffffff', 1.5);
      room.removeInteractable(it);
    },
  });
}

export function addExit(room) {
  const floor = room.floor;
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.15, 10, 40), glow('#ffffff'));
  ring.position.y = 1.6;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32), new THREE.MeshBasicMaterial({ color: '#ff4fa3', transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  disc.position.y = 1.6;
  g.add(ring, disc);
  g.position.set(0, 0, -6);
  room.animators.push((t) => { ring.rotation.z = t; disc.material.opacity = 0.3 + Math.sin(t * 3) * 0.1; });
  room.addInteractable({
    x: 0, z: -6, r: 1.8, mesh: g,
    prompt: () => ({ title: floor === 1 ? 'ENTER THE VENUE' : 'GO BACKSTAGE', text: floor === 1 ? 'Floor 2 — THE VENUE' : 'Floor 3 — BEHIND THE SHOW', action: 'Go' }),
    use: () => G.run.nextFloor(),
  });
}
