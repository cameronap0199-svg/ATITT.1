// Random room events: a free crafting table (and sometimes a furnace), the travelling
// crossover merchant, and the burning bush (a free blessing). Rolled per room in run.js.

import * as THREE from 'three';
import { G } from '../state.js';
import { itemInfo, rollItems } from '../items.js';
import { placeStation } from '../mc/world.js';
import { display, priceOf } from '../shop.js';
import { mat, glow, textTexture } from './props.js';

function spot(room, near = 0) {
  const a = G.alex;
  return room.world.openPoint(room.rng, [{ x: a.pos.x, z: a.pos.z, r: 3 + near }, ...room.interactables.map((o) => ({ x: o.x, z: o.z, r: 3 }))], 3, 0.4, 3.5) || { x: 0, z: 2 };
}

export function addCraftingTable(room) {
  const p = spot(room);
  const x = Math.round(p.x), z = Math.round(p.z);
  placeStation(room, 'craftingTable', x, z);
  if (room.rng() < 0.45) placeStation(room, 'furnace', x + 1.5, z);
  room.world.buildNav();
  G.hud.bubble({ pos: new THREE.Vector3(x, 0, z), height: 1.4, alive: true }, '⚒ A CRAFTING TABLE APPEARED', '#c2a26a', 2.2);
}

export function addMerchant(room) {
  const p = spot(room);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 10), mat('#6d28d9'));
  body.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat('#f3cfae'));
  head.position.y = 1.65;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 10), mat('#facc15'));
  hat.position.y = 2.05;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), mat('#92400e'));
  pack.position.set(0, 1.1, -0.4);
  g.add(body, head, hat, pack);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = Math.atan2(G.alex.pos.x - p.x, G.alex.pos.z - p.z);
  room.group.add(g);
  const npc = { pos: new THREE.Vector3(p.x, 0, p.z), height: 2.2, alive: true };
  G.hud.bubble(npc, room.rng.pick(['Wares from other worlds! Cheap-ish!', 'I take dollars, blocks and Berries. Mostly dollars.', 'Psst. Got stuff from across the multiverse.']), '#fde68a', 3);
  const items = rollItems('merchant', 3, room.rng, G.run);
  items.forEach((id, i) => {
    const it = itemInfo(id);
    const price = Math.max(4, Math.round(priceOf(it) * 0.9));
    const a = (i - 1) * 0.9 + g.rotation.y;
    const x = p.x + Math.sin(a) * 1.8, z = p.z + Math.cos(a) * 1.8;
    const mesh = display(it, price, x, 1.5, z, { color: '#a855f7' });
    const o = room.addInteractable({
      x, z, r: 1.1, mesh, item: it,
      prompt: () => ({ title: it.name + '  ' + (it.icon || ''), text: it.desc + ' (Travelling merchant — from another universe.)', price, action: 'Buy' }),
      use: () => {
        if (G.run.money < price) { G.audio.sfx('deny'); G.hud.bubble(npc, 'Come back with money, hero.', '#fde68a', 1.4); return; }
        G.run.addMoney(-price, true);
        G.run.grant(id);
        G.audio.sfx('buy');
        G.hud.bubble(npc, room.rng.pick(['Pleasure!', 'No refunds across dimensions.', 'Excellent choice.']), '#fde68a', 1.4);
        room.removeInteractable(o);
      },
    });
  });
  room.animators.push((t) => { head.position.y = 1.65 + Math.sin(t * 3) * 0.03; });
}

export function addBurningBush(room) {
  const p = spot(room);
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random() * 0.2, 10, 8), mat('#3f6212')); b.position.set((Math.random() - 0.5) * 0.9, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.9); g.add(b); }
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 10), new THREE.MeshBasicMaterial({ color: '#ff9f1c', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  fire.position.y = 1.3;
  g.add(fire);
  const light = new THREE.PointLight('#ffb703', 1.6, 9, 1.6);
  light.position.y = 1.5;
  g.add(light);
  g.position.set(p.x, 0, p.z);
  room.group.add(g);
  room.world.add({ kind: 'bush', x: p.x, z: p.z, w: 1.2, d: 1.2, h: 1, vault: true });
  G.hud.bubble({ pos: new THREE.Vector3(p.x, 0, p.z), height: 2.2, alive: true }, 'A bush is burning, but it is not consumed.', '#ffd166', 3);
  room.animators.push((t) => { fire.scale.set(1 + Math.sin(t * 9) * 0.08, 1 + Math.sin(t * 13) * 0.12, 1); light.intensity = 1.4 + Math.sin(t * 17) * 0.3; if (Math.random() < 0.3) G.fx.burst(p.x, 1.4, p.z, { n: 1, color: ['#ff7b00', '#ffd60a'], speed: 0.6, up: 2.4, life: 0.5, size: 0.25, grav: -2, kind: 'spark' }); });
  const o = room.addInteractable({
    x: p.x, z: p.z, r: 2, id: 'bush',
    prompt: () => ({ title: '🔥 The Burning Bush', text: '"Take off thy shoes." (You keep them on.) Receive a blessing: full heal and +10 max HP.', price: 0, action: 'Approach' }),
    use: () => {
      G.run.grant('blessing');
      G.fx.flash(0.35, '#ffd166');
      G.audio.sfx('perfect');
      G.hud.popup('BLESSED', '#ffd166', 1.4);
      const d = G.phone.change('jesus', 1);
      if (d) G.phone.toast('jesus', 'I saw that. Good.', d);
      room.removeInteractable(o);
      fire.visible = false; light.intensity = 0.3;
    },
  });
}
