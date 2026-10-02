// Boot + main loop for Alex K-Pop Demon Hunter 2.

import * as THREE from 'three';
import { G } from './state.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { Input } from './core/input.js';
import * as audio from './core/audio.js';
import { FX } from './fx.js';
import { Projectiles } from './combat/projectiles.js';
import { Areas } from './combat/areas.js';
import { Targeting } from './combat/targeting.js';
import { CameraRig } from './cameraRig.js';
import { Alex } from './actors/alex.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { Heartline } from './phone/heartline.js';
import { Run } from './run.js';
import { FLOOR_PALETTE } from './world/builder.js';
import { setupTouch } from './ui/touch.js';
import { loadPortraitOverrides } from './phone/portraits.js';
import { codex } from './ui/compendium.js';

const canvas = document.getElementById('view');
const mini = document.getElementById('mini');
G.debug = /[?&]debug\b/.test(location.search);
G.settings = loadSettings();

// Renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
G.renderer = renderer;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b1033');
scene.fog = new THREE.Fog('#1b1033', 45, 140);
G.scene = scene;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);
G.camera = camera;

function resize() {
  const pr = Math.min(devicePixelRatio || 1, 2) * G.settings.renderScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  mini.width = innerWidth * Math.min(devicePixelRatio || 1, 2);
  mini.height = innerHeight * Math.min(devicePixelRatio || 1, 2);
}
addEventListener('resize', resize);

// Systems -----------------------------------------------------------------
G.input = new Input(G.settings, canvas);
G.audio = audio;
G.fx = new FX(scene);
G.projectiles = new Projectiles(scene);
G.areas = new Areas(scene);
G.targeting = new Targeting(scene);
G.cam = new CameraRig(camera);
G.hud = new HUD(document.getElementById('hud'));
G.phone = new Heartline(document.getElementById('phoneui'));
loadPortraitOverrides();
G.codex = codex;
G.alex = new Alex(scene);
G.alex.model.setVisible(false);
G.touch = setupTouch(document.getElementById('touch'));

function applySettings() {
  audio.setVolumes(G.settings);
  resize();
  document.body.classList.toggle('reduce-flash', !!G.settings.reduceFlashing);
  document.body.classList.toggle('calm', !!G.settings.calmUI || matchMedia('(prefers-reduced-motion: reduce)').matches);
}

const screens = new Screens(document.getElementById('ui'), {
  startRun,
  resume,
  quitToTitle,
  applySettings,
});
G.screens = screens;

// Run lifecycle -------------------------------------------------------------
function startRun(seed) {
  audio.initAudio();
  if (G.room) { G.room.dispose(); G.room = null; }
  G.projectiles.clear(); G.areas.clear(); G.fx.clear();
  G.phone.reset();
  G.time = 0;
  G.run = new Run(seed);
  G.alex.model.setVisible(true);
  screens.clear();
  G.mode = 'run';
  G.hud.show(true);
  G.run.start();
  setFloorLook(1);
  G.input.wantLock = true;
  if (!G.touch) G.input.requestLock();
}
function setFloorLook(n) {
  const pal = FLOOR_PALETTE[n];
  scene.background.set(pal.bg);
  scene.fog.color.set(pal.fog);
}
function resume() {
  screens.clear();
  G.mode = 'run';
  audio.suspendAudio(false);
  G.alex.spawnSafe(0.8);      // leaving a menu never hurts
  G.input.clearBuffers();
  if (!G.touch) G.input.requestLock();
}
function pause() {
  if (G.mode !== 'run') return;
  G.mode = 'paused';
  G.input.releaseLock();
  audio.suspendAudio(true);
  screens.pause();
}
function quitToTitle() {
  audio.suspendAudio(false);
  if (G.room) { G.room.dispose(); G.room = null; }
  G.projectiles.clear(); G.areas.clear(); G.fx.clear();
  G.phone.reset();
  G.hud.show(false);
  G.alex.model.setVisible(false);
  G.run = null;
  G.input.wantLock = false;
  G.input.releaseLock();
  document.getElementById('mini').classList.remove('on');
  G.minigame = null;
  titleScene();
  screens.title();
}

// A slowly orbiting title backdrop.
function titleScene() {
  G.mode = 'title';
  camera.position.set(0, 3, 9);
  camera.lookAt(0, 1.5, 0);
}

// Loop ---------------------------------------------------------------------
let last = performance.now();
let pixelated = false;
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  simulate(realDt);
  if (G.mode !== 'minigame') renderer.render(scene, camera);
  G.input.endFrame();
}
function simulate(realDt) {
  G.realTime += realDt;
  let scale = 1;
  if (G.realTime < G.slowUntil) scale = G.slowScale;
  if (G.realTime < G.hitstopUntil) scale = Math.min(scale, 0.06);
  G.timeScale = scale;
  const dt = realDt * scale;
  G.dt = dt;
  G.input.update(realDt);
  if (G.mode !== frame.lastMode) { frame.lastMode = G.mode; document.body.classList.toggle('playing', G.mode === 'run'); document.body.classList.toggle('minigame', G.mode === 'minigame'); }

  if (G.mode === 'run') {
    if (G.input.pressed('pause')) { pause(); return; }
    G.time += dt;
    if (G.run.floor !== G._lookFloor) { G._lookFloor = G.run.floor; setFloorLook(G.run.floor); }
    G.targeting.update(dt);
    if (!G.run.transition) G.alex.update(dt);
    G.run.update(dt);
    G.projectiles.update(dt);
    G.areas.update(dt);
    G.cam.update(dt, realDt);
    G.fx.update(dt, realDt);
    G.phone.update(dt);
    G.hud.update(dt, realDt);
    audio.setIntensity(G.room && G.room.combatLive() ? 1 : 0.5);
    if (G.debug) debugKeys();
  } else if (G.mode === 'minigame' && G.minigame) {
    // (minigames can't be paused: the nightmare waits for no one)
    const m = G.minigame;
    m.update(realDt);
    if (G.minigame === m) m.draw(mini.getContext('2d'), mini.width, mini.height);
  } else if (G.mode === 'title') {
    const t = G.realTime * 0.15;
    camera.position.set(Math.sin(t) * 9, 3.5, Math.cos(t) * 9);
    camera.lookAt(0, 1.2, 0);
  }
  // nightmare pixelation
  const px = G.realTime < (G.pixelateUntil || 0);
  if (px !== pixelated) {
    pixelated = px;
    renderer.setPixelRatio(px ? 0.12 : Math.min(devicePixelRatio || 1, 2) * G.settings.renderScale);
    renderer.setSize(innerWidth, innerHeight, false);
    canvas.classList.toggle('pixel', px);
  }
}
// Fast-forward for automated tests: simulate `seconds` of game time without rendering.
function advance(seconds, step = 1 / 60, render = true) {
  for (let t = 0; t < seconds - 1e-9; t += step) { simulate(step); G.input.endFrame(); }
  if (render) renderer.render(scene, camera);
}

// Debug helpers (?debug) ----------------------------------------------------------
function debugKeys() {
  const d = G.input.down;
  const edge = (c) => { if (d.has(c) && !debugKeys[c]) { debugKeys[c] = true; return true; } if (!d.has(c)) debugKeys[c] = false; return false; };
  if (edge('F1')) { G.run.godMode = !G.run.godMode; G.hud.popup('GOD MODE ' + (G.run.godMode ? 'ON' : 'OFF')); }
  if (edge('F2')) G.run.addMoney(100);
  if (edge('F3')) for (const e of G.room.enemies) if (e.alive) e.die({ source: G.alex });
  if (edge('F4')) G.phone.forceCall(['gf', 'ugly', 'cat', 'mario', 'demonKing', 'jesus'][Math.floor(Math.random() * 6)], {});
  if (edge('F6')) G.run.startNightmare();
  if (edge('F7')) { const b = G.run.map.rooms.find((r) => r.kind === 'boss'); G.run.fade(() => G.run.enterRoom(b.id, null)); }
  if (edge('F8')) G.run.startCookoff();
}

window.addEventListener('pointerdown', () => audio.initAudio(), { once: false });
window.addEventListener('keydown', () => audio.initAudio());

// Test hook for automated smoke tests.
window.__game = { G, startRun, pause, resume, quitToTitle, THREE, advance };

// Boot ---------------------------------------------------------------------------
applySettings();
titleScene();
// A little idol-demon diorama behind the title menu.
(async () => {
  const { MODELS } = await import('./actors/enemyModels.js');
  const hemi = new THREE.HemisphereLight('#ffc6d9', '#3a2f55', 1.4);
  const dir = new THREE.DirectionalLight('#ffd6a5', 1.4);
  dir.position.set(-5, 10, 4);
  const group = new THREE.Group();
  group.add(hemi, dir);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshLambertMaterial({ color: '#2b1d4a' }));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.6, 8, 64), new THREE.MeshBasicMaterial({ color: '#ff4fa3', side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
  group.add(ring);
  const kinds = ['lurker', 'photocard', 'biasBeast', 'fancam', 'ultBias', 'delulu', 'akgae', 'queen'];
  kinds.forEach((k, i) => {
    const m = MODELS[k]();
    const a = (i / kinds.length) * Math.PI * 2;
    m.group.position.set(Math.sin(a) * 5, 0, Math.cos(a) * 5);
    m.group.rotation.y = a + Math.PI;
    group.add(m.group);
  });
  G.alex.model.setVisible(true);
  G.alex.model.root.position.set(0, 0, 0);
  G.alex.model.apply({ torsoX: 0.1, shRX: -2.6, shRZ: -0.4, elR: -0.2, shLZ: 0.9, legLX: -0.3, legRX: 0.2, bladeX: 0 }, 1, true);
  group.userData.title = true;
  scene.add(group);
  G.titleGroup = group;
  const tick = () => {
    if (G.mode === 'title' || G.mode === 'boot') { group.visible = true; G.alex.model.root.visible = true; G.alex.model.root.rotation.y = G.realTime * 0.6; G.alex.model.secondary(1 / 60, new THREE.Vector3()); } else group.visible = false;
    requestAnimationFrame(tick);
  };
  tick();
})();

resize();
requestAnimationFrame(frame);
if (!G.settings.seenWarning) screens.warning(() => screens.title()); else screens.title();
saveSettings(G.settings);
