// The Baby Mario Nightmare trigger: music stops, the world pixelates, and a horrible
// pixelated horse appears behind Alex. It follows him between rooms, cannot be killed,
// ignores demons, and only wants Alex. If it touches him: Horse Mario.

import * as THREE from 'three';
import { G } from '../state.js';
import { horseCanvas } from './platformer.js';

export class NightmareHorse {
  constructor() {
    const tex = new THREE.CanvasTexture(horseCanvas(8, true));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
    this.sprite.scale.set(3.2, 3.2, 1);
    this.pos = new THREE.Vector3();
    this.speed = 3.4;
    this.t = 0;
    this.hidden = Infinity;       // dormant until it appears behind Alex
    this.neighT = 3;
  }

  enterRoom(scene, entry) {
    scene.add(this.sprite);
    this.sprite.visible = false;
    this.hidden = 2.6;            // arrives through the same door a moment later
    this.pos.set(entry.x, 0, entry.z);
  }
  spawnBehind(scene) {
    scene.add(this.sprite);
    const a = G.alex;
    const [fx, fz] = G.cam.forward();
    this.pos.set(a.pos.x - fx * 12, 0, a.pos.z - fz * 12);
    const L = G.room.L;
    this.pos.x = Math.max(-L.w / 2 + 1, Math.min(L.w / 2 - 1, this.pos.x));
    this.pos.z = Math.max(-L.d / 2 + 1, Math.min(L.d / 2 - 1, this.pos.z));
    this.hidden = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.hidden === Infinity) { this.sprite.visible = false; return false; }
    if (this.hidden > 0) {
      this.hidden -= dt;
      if (this.hidden <= 0) { this.sprite.visible = true; G.audio.sfx('neigh', { v: 0.8 }); G.hud.popup('IT FOLLOWED YOU', '#e63946', 1.2); }
      return false;
    }
    this.sprite.visible = true;
    this.speed = Math.min(8.8, this.speed + dt * 0.075);
    const a = G.alex;
    const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.01) { this.pos.x += (dx / d) * Math.min(d, this.speed * dt); this.pos.z += (dz / d) * Math.min(d, this.speed * dt); }
    const bob = Math.abs(Math.sin(this.t * 7)) * 0.25;
    this.sprite.position.set(this.pos.x, 1.6 + bob, this.pos.z);
    // flip to face its direction of travel on screen
    const sx = new THREE.Vector3(dx, 0, dz).applyQuaternion(G.camera.quaternion.clone().invert()).x;
    this.sprite.material.rotation = 0;
    this.sprite.scale.x = sx < 0 ? -3.2 : 3.2;
    this.neighT -= dt;
    if (this.neighT <= 0) { this.neighT = 4 + Math.random() * 4; G.audio.sfx('neigh', { v: 0.5, pan: G.cam.panOf(this.pos.x, this.pos.z) }); }
    return d < 0.95 && Math.abs(a.pos.y) < 2.2 && a.state !== 'dead';
  }

  remove() { this.sprite.parent?.remove(this.sprite); }
}
