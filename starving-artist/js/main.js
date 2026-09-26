// Starving Artist — game orchestration: main loop, modes, pause/menus, fades, the
// chapter flow (Vista Venue -> memory -> Vista Venue ...), and the ending.
import * as THREE from 'three';
import { PS1Renderer, Lights, shared } from './renderer.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Painter } from './painting.js';
import { S, newState, save, load, hasSave, clearSave, loadSettings, saveSettings, counts, neglect, inspiration, ending, meta, recordEnding, peekSave } from './state.js';
import { CHAPTERS, ENDINGS, PAGES } from './story.js';
import { runVenue, buildTitleWorld } from './venue.js';
import { drawVenueMap } from './venue_fx.js';
import { mat, ensureColor } from './renderer.js';
import { canvas as mkCanvas, toTex } from './tex.js';
import { runMemory } from './memories.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const TIPS = [
  'Alienate is drawn to light. Your flashlight helps you see, and helps it see you.',
  'Running is loud. Walking is quiet. Hiding is quieter.',
  'It pauses before it charges. Use that moment.',
  'Look away from a painting, then look back.',
  'Every choice requires neglect. The Venue remembers which one.',
  'Torn sketchbook pages are hidden around the Vista Venue. Some only appear later.',
  'Inspiration is always right about the painting. It is only ever right about the painting.',
  'Black paint footprints show where it has walked.',
  'The journal (Tab) keeps your memories, keepsakes, pages and a map.',
  'If your phone starts to hiss, it is close.',
  'Nobody calls her Natalee but her mother.',
  'A blank canvas is never empty.',
];

// The phone Nate holds once she has it: a low-poly hand, a glowing screen that
// dissolves into static when Alienate is near, and an LED flashlight.
function phoneModel() {
  const g = new THREE.Group();
  const part = (w, h, d, col, x, y, z, em = 0.35) => {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed(); ensureColor(geo, col);
    const m = new THREE.Mesh(geo, mat({ emissive: em * 0.6, probe: true, fog: false }));
    m.material.depthTest = false; m.renderOrder = 50; m.position.set(x, y, z); g.add(m); return m;
  };
  part(0.075, 0.14, 0.012, 0x1a1a1e, 0, 0, 0);
  part(0.05, 0.06, 0.05, 0xd8a080, 0.012, -0.075, 0.018, 0.25);
  part(0.018, 0.07, 0.022, 0xd8a080, -0.043, -0.02, 0.012, 0.25);
  const [c, gg] = mkCanvas(16, 28);
  const tex = toTex(c, { repeat: false });
  const scr = new THREE.Mesh(ensureColor(new THREE.PlaneGeometry(0.064, 0.122)), mat({ map: tex, emissive: 0.85, fog: false }));
  scr.material.depthTest = false; scr.renderOrder = 51; scr.position.z = 0.0065; g.add(scr);
  const led = part(0.012, 0.012, 0.004, 0x444444, 0.022, 0.058, -0.008, 1);
  g.userData = { c, g: gg, tex, led };
  return g;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('view');
    this.R = new PS1Renderer(this.canvas);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 400);
    this.player = new Player(this.camera);
    this.lights = new Lights();
    this.settings = loadSettings();
    this.ui = new UI(document.body, this.settings);
    this.painter = new Painter(document.body);
    this.world = null;
    this.mode = 'boot';
    this.fx = { glitch: 0, aberr: 0, warp: 0, fade: 1, invert: 0 };
    this.fadeColor = new THREE.Color(0, 0, 0);
    this.mood = { desat: 0, tint: [1, 1, 1], vignette: 1.1, grain: 0.035, bloom: 0.6, warp: 0, fog: [0xffffff, 8, 50] };
    this.proximity = 0;
    this.playerLight = this.lights.add({ pos: new THREE.Vector3(), color: new THREE.Color(1, 0.86, 0.68), intensity: 0, range: 11 });
    this.flash = { avail: false, on: false, level: 0, dir: new THREE.Vector3(0, 0, -1) };
    this.phone = phoneModel();
    this.phone.visible = false;
    this.camera.add(this.phone);
    this.phoneT = 0;
    this.t = 0;
    input.attach(this.canvas);
    input.attachTouch(document.body);
    input.onUnlock = () => this.onUnlock();
    this.ui.hooks = { unlock: () => input.unlock(), relock: () => input.lock(), onSettings: () => this.applySettings() };
    this.canvas.addEventListener('click', () => { audio.init(); if (this.mode === 'play' || this.mode === 'busy' || this.mode === 'cutscene') input.lock(); });
    document.addEventListener('pointerdown', () => audio.init());
    document.addEventListener('keydown', () => audio.init());
    const autoPause = () => { if (this.mode === 'play' || this.mode === 'busy') this.pause(); };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    this.applySettings();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  applySettings() {
    const s = this.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    audio.blips = s.blips;
    Object.assign(this.player.settings, { sens: s.sens, invertY: s.invertY, headBob: s.headBob, fov: s.fov });
    if (this.R.targetHeight !== s.res) this.R.setQuality(s.res);
    this.R.setVertexSnap(s.snap);
    shared.uAffine.value = s.affine ? 1 : 0;
    this.R.fx.uGamma.value = s.gamma || 1;
    this.ui.applyTextSize();
    saveSettings(s);
  }

  // ---------------------------------------------------------------- world & mood
  setWorld(world, spawn) {
    if (this.world && this.world !== world) this.world.dispose();
    this.world = world;
    world.scene.add(this.camera);
    if (spawn) this.player.place(spawn.pos, spawn.yaw);
    this.player.hidden = null;
    this.player.lookTarget = null;
    this.ui.setHiding(false);
    this.camera.fov = this.settings.fov;
  }
  setMood(m) {
    Object.assign(this.mood, m);
    const [fc, near, far] = this.mood.fog;
    shared.uFogColor.value.set(fc); shared.uFogNear.value = near; shared.uFogFar.value = far;
    if (m.music) audio.setMood(m.music, m.corrupt ?? audio.corrupt);
    if (m.ambient) audio.setAmbient(m.ambient);
    if (m.playerLight !== undefined) { this.playerLight.intensity = m.playerLight; this.mood.playerLight = m.playerLight; }
  }

  async fade(to, dur = 1, color = null) {
    if (color !== null) this.fadeColor.set(color);
    const from = this.fx.fade;
    const t0 = performance.now();
    while (true) {
      const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
      this.fx.fade = from + (to - from) * k;
      if (k >= 1) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
  }
  pulse(kind, amt = 1) {
    const rf = this.settings.reduceFlash;
    if (kind === 'glitch') this.fx.glitch = Math.max(this.fx.glitch, rf ? amt * 0.15 : amt);
    if (kind === 'aberr') this.fx.aberr = Math.max(this.fx.aberr, amt);
    if (kind === 'shake') this.player.shake = Math.max(this.player.shake, rf ? amt * 0.3 : amt);
  }

  // ---------------------------------------------------------------- helpers for scripts
  async say(name, text, opts) {
    const prev = this.mode; if (prev === 'play') this.mode = 'busy';
    await this.ui.say(name, text, opts);
    if (this.mode === 'busy' && prev === 'play') this.mode = 'play';
  }
  async think(text) { return this.say('', text, { kind: 'none', italic: true }); }
  async choose(opts, prompt) {
    const prev = this.mode; if (prev === 'play') this.mode = 'busy';
    const r = await this.ui.choose(opts, prompt);
    if (this.mode === 'busy' && prev === 'play') this.mode = 'play';
    return r;
  }
  async narrate(lines) { await this.ui.narrate(lines); }
  // A wait the player can cut short with interact (used for narration beats).
  skippable(ms) {
    this.skipReq = false;
    return new Promise((res) => {
      const t0 = performance.now();
      const f = () => { if (this.skipReq || performance.now() - t0 >= ms) { this.skipReq = false; res(); } else requestAnimationFrame(f); };
      f();
    });
  }
  async paint(cfg) {
    const prev = this.mode;
    this.mode = 'paint';
    input.unlock();
    this.ui.hideHud(true);
    audio.setAmbient([]);
    const comp = await this.painter.open(cfg);
    this.ui.hideHud(false);
    this.mode = prev === 'paint' ? 'play' : prev;
    input.lock();
    return comp;
  }
  hint(text, label) { this.ui.setObjective(text, label); }

  setFlashlight(avail, on = this.flash.on) { this.flash.avail = avail; this.flash.on = avail && on; this.phone.visible = avail; }
  async beginLoad(light = false) {
    this.ui.loading(true, TIPS[Math.floor(Math.random() * TIPS.length)], light);
    this._loadT = performance.now();
    await frame();
  }
  async endLoad() {
    const el = performance.now() - (this._loadT || 0);
    if (el < 1300) await wait(1300 - el);
    this.ui.loading(false);
  }
  mapFn() {
    const V = this.venue;
    if (!V || this.world !== V.world) return null;
    return (c) => drawVenueMap(c, V, this.player);
  }
  // Collect a sketchbook page (saved immediately).
  async takePage(id) {
    if (S.cur.pages.includes(id)) return;
    const i = PAGES.findIndex((p) => p.id === id);
    S.cur.pages.push(id);
    save(); this.ui.saveIcon();
    const prev = this.mode; this.mode = 'busy';
    await this.ui.readNote(PAGES[i], i);
    this.ui.itemCard({ icon: 'frame', kick: 'SKETCHBOOK PAGE', name: PAGES[i].title, desc: `${S.cur.pages.length} of ${PAGES.length} found · read them again in the Journal` });
    if (this.mode === 'busy') this.mode = prev === 'busy' ? 'play' : prev;
  }

  // ---------------------------------------------------------------- pause/menu
  onUnlock() {
    if (this.mode === 'play' || this.mode === 'busy' || this.mode === 'cutscene') this.pause();
  }
  pause() {
    if (this.mode === 'menu' || this.mode === 'title') return;
    this.pausedMode = this.mode;
    this.mode = 'menu';
    input.unlock();
    const back = () => this.pause2();
    this._pauseMenu = back;
    back();
  }
  pause2() {
    this.ui.pause({
      onResume: () => this.resume(),
      onJournal: () => this.ui.journal(S.cur, CHAPTERS, () => this.pause2(), 'mem', this.mapFn()),
      onSettings: () => this.ui.settingsPanel(() => this.pause2()),
      onControls: () => this.ui.controlsPanel(() => this.pause2()),
      onQuit: async () => {
        if (await this.ui.confirm('Quit to the title? You will resume from your last return to the Vista Venue.', 'Quit', 'Stay')) location.reload();
        else this.pause2();
      },
    });
  }
  resume() {
    this.ui.hideMenu();
    this.mode = this.pausedMode || 'play';
    input.lock();
  }

  // ---------------------------------------------------------------- catch / respawn
  async caught(alien, respawn) {
    if (this.mode === 'cutscene') return;
    this.mode = 'cutscene';
    const p = this.player;
    p.hidden = null; this.ui.setHiding(false);
    const prevMode = alien.mode;
    // it closes the last of the distance in one frame and fills your view
    const dir = alien.pos.clone().sub(p.pos).setY(0).normalize();
    alien.place(p.pos.clone().addScaledVector(dir, 0.75), p.pos);
    alien.mode = 'caught';
    alien.armL.rotation.x = -1.5; alien.armR.rotation.x = -1.3; alien.head.rotation.z = 0.6;
    p.lookTarget = alien.headWorld();
    audio.play('stinger', { vol: 1.2 }); audio.play('scream', { pos: alien.headWorld() });
    audio.play('tear');
    this.pulse('glitch', 1); this.pulse('shake', 0.3);
    this.fx.aberr = 3; this.fx.red = 1;
    await wait(650);
    if (!this.settings.reduceFlash) { this.fx.invert = 1; await wait(70); this.fx.invert = 0; await wait(90); this.fx.invert = 1; await wait(50); this.fx.invert = 0; }
    audio.play('static', { vol: 0.9, dur: 1.4 });
    await this.fade(1, 0.2, 0x000000);
    this.fx.red = 0;
    p.lookTarget = null;
    S.cur.deaths++;
    this.ui.subtitle(['It doesn\'t want to hurt you. It wants to be you.', 'Not yet.', 'You got away. This time.', 'It lets you go. It likes the chase.'][S.cur.deaths % 4], 2600);
    await wait(1400);
    respawn();
    if (prevMode === 'scripted') alien.mode = 'scripted';
    this.fx.red = 0; this.proximity = 0;
    await this.fade(0, 1);
    this.mode = 'play';
  }

  // ---------------------------------------------------------------- main loop
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    shared.uTime.value = this.t;
    input.pollPad();
    const m = this.mode;
    const p = this.player;
    if (this.world) {
      if (m === 'title' && this.titleCam) this.titleCam(dt, this.t);
      else if (m === 'play' || m === 'busy' || m === 'cutscene') {
        p.frozen = m !== 'play';
        const fy = this.world.level.floorAt(p.pos.x, p.pos.z);
        p.floorY = (p.floorY ?? fy) + (fy - (p.floorY ?? fy)) * Math.min(1, dt * 10);
        p.update(dt, this.world.level, (pos) => this.world.surface(pos));
      }
      if (m !== 'menu' && m !== 'paint') this.world.update(dt, this.camera);
      if (m === 'play') this.playTick(dt);
      else this.ui.setPrompt(null);
      this.playerLight.pos.copy(this.camera.position);
      audio.setListener(this.camera.position, p.lookDir());
      this.updateFlashlight(dt);
    }
    this.ui.cinematic(m === 'cutscene');
    audio.setStatic(this.flash.avail ? Math.max(0, this.proximity * 1.4 - 0.1) : this.proximity * 0.5);
    audio.setTension(this.alert || 0);
    if (m === 'play' || m === 'busy') S.cur.playTime += dt;
    if (m === 'menu' || m === 'title') this.ui.menuNav();
    if ((m === 'menu') && (input.pressed('pause') || input.code('pad:back')) && this._pauseMenu && this.ui.menuOpen()) this.resume();
    if (m === 'cutscene' && !this.ui.inDialogue() && input.anyAdvance()) this.skipReq = true;
    this.ui.update(dt);
    this.painter.tick(dt);
    this.lights.update(this.camera.position, this.t);
    this.ui.needClick(m === 'play' && !input.locked && !input.dragMode && !this.ui.menuOpen() && document.hasFocus());
    input.showTouch((m === 'play' || m === 'busy') && !this.ui.menuOpen(), this.flash.avail);
    this.updatePost(dt);
    if (this.world) this.R.render(this.world.scene, this.camera);
    input.endFrame();
  }

  playTick(dt) {
    const p = this.player, w = this.world;
    if (input.pressed('pause')) { this.pause(); return; }
    if (input.pressed('journal')) { this.pause(); this.ui.journal(S.cur, CHAPTERS, () => this.pause2(), 'mem', this.mapFn()); return; }
    if (input.pressed('flashlight') && this.flash.avail) { this.flash.on = !this.flash.on; audio.play('flashlight'); }
    this.ui.setStamina(p.stamina, p.stamina < 0.98);
    if (p.hidden) {
      this.ui.setPrompt(null);
      if (input.pressed('interact')) { const h = p.hidden; p.hidden = null; p.pos.copy(h.front); this.ui.setHiding(false); audio.play('door', { pos: h.front }); }
      return;
    }
    for (const t of w.triggers) {
      if (t.fired && t.once) continue;
      if (t.when && !t.when()) continue;
      if (Math.hypot(p.pos.x - t.pos.x, p.pos.z - t.pos.z) < t.r) { t.fired = true; t.fn(); }
    }
    const target = w.findTarget(p.eyePos(), p.lookDir());
    if (target) {
      const txt = typeof target.prompt === 'function' ? target.prompt() : target.prompt;
      const dim = target.dim ? target.dim() : false;
      this.ui.setPrompt(txt, dim);
      if (input.pressed('interact') && txt) {
        this.mode = 'busy';
        this.ui.setPrompt(null);
        Promise.resolve(target.use()).catch((e) => console.error(e)).finally(() => { if (this.mode === 'busy') this.mode = 'play'; });
      }
    } else this.ui.setPrompt(null);
  }

  updateFlashlight(dt) {
    const f = this.flash, p = this.player;
    const target = f.avail && f.on ? 1 : 0;
    f.level += (target - f.level) * Math.min(1, dt * 20);
    f.dir.lerp(p.lookDir(), Math.min(1, dt * 11)).normalize();
    let k = f.level;
    // near Alienate the light stutters
    if (k > 0 && this.proximity > 0.2 && Math.random() < this.proximity * 0.3) k *= Math.random() * 0.25;
    shared.uSpotCol.value.set(1.65 * k, 1.55 * k, 1.35 * k);
    const cam = this.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    shared.uSpotPos.value.copy(cam.position).addScaledVector(right, 0.18).y -= 0.2;
    shared.uSpotDir.value.copy(f.dir);
    p.lightOn = f.avail && f.on;
    // with the flashlight in hand, the ambient fill around Nate is dimmer so the beam matters
    this.playerLight.intensity = (this.mood.playerLight ?? 0) * (f.avail ? (f.level > 0.5 ? 0.45 : 0.7) : 1);
    // phone viewmodel: bob, sway, lag, screen
    if (this.phone.visible) {
      this.phoneT += dt;
      const bob = p.settings.headBob ? p.bobAmt : 0;
      this.phone.position.set(0.26 + Math.sin(p.bob) * 0.012 * bob, -0.26 + Math.abs(Math.cos(p.bob)) * 0.014 * bob + Math.sin(this.phoneT * 1.3) * 0.004, -0.46);
      this.phone.rotation.set(0.12, -0.28, 0.06 + Math.sin(this.phoneT * 0.9) * 0.01);
      const ud = this.phone.userData;
      ud.led.material.uniforms.uColor.value.setScalar(f.on ? 1 : 0.3);
      if ((this._phoneProbeT = (this._phoneProbeT || 0) - dt) <= 0 && this.world) {
        this._phoneProbeT = 0.3;
        const pr = this.world.level.probe(cam.position);
        const k = 0.35 + (this.playerLight.intensity || 0) * 0.25;
        this.phone.traverse((o) => { if (o.isMesh && o.material.uniforms.uUseProbe.value) o.material.uniforms.uProbe.value.set(Math.min(1.2, pr.r + k), Math.min(1.2, pr.g + k), Math.min(1.2, pr.b + k)); });
      }
      if (Math.floor(this.phoneT * 10) !== this._phoneFrame) {
        this._phoneFrame = Math.floor(this.phoneT * 10);
        const g = ud.g, pr = this.proximity;
        g.fillStyle = '#10202c'; g.fillRect(0, 0, 16, 28);
        if (pr > 0.08) {
          for (let y = 0; y < 28; y++) for (let x = 0; x < 16; x++) { const v = Math.random() * 255 * Math.min(1, pr * 1.8) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); }
        } else {
          g.fillStyle = '#9ad6ff'; g.font = '6px monospace'; g.fillText('3:33', 2, 9);
          g.fillStyle = '#9ad6ff'; for (let i = 0; i < 4; i++) g.fillRect(2 + i * 3, 24 - i * 2, 2, 2 + i * 2);
          g.fillStyle = f.on ? '#ffe36e' : '#3a4a5a'; g.fillRect(11, 14, 3, 3);
        }
        ud.tex.needsUpdate = true;
      }
    }
  }

  updatePost(dt) {
    const U = this.R.fx, s = this.settings, mood = this.mood, fx = this.fx;
    fx.glitch = Math.max(0, fx.glitch - dt * 1.5);
    fx.aberr = Math.max(0, fx.aberr - dt * 2);
    const prox = this.proximity;
    const rf = s.reduceFlash ? 0.25 : 1;
    U.uGlitch.value = Math.min(1, fx.glitch + prox * 0.12 * rf);
    U.uAberr.value = Math.min(3, fx.aberr + prox * 1.4) * (s.reduceFlash ? 0.4 : 1);
    U.uWarp.value = mood.warp + fx.warp + prox * 0.5;
    U.uDesat.value = Math.min(1, mood.desat + prox * 0.3);
    U.uTint.value.set(mood.tint[0], mood.tint[1] * (1 - prox * 0.15), mood.tint[2] * (1 - prox * 0.2));
    U.uVignette.value = mood.vignette + prox * 0.8;
    U.uGrain.value = s.grain ? mood.grain + prox * 0.05 : 0;
    U.uBloom.value = mood.bloom;
    U.uDither.value = s.dither ? 1 : 0;
    U.uCRT.value = s.crt ? 1 : 0;
    U.uFade.value = fx.fade;
    U.uFadeColor.value.copy(this.fadeColor);
    U.uInvert.value = fx.invert;
    fx.red = Math.max(0, (fx.red || 0) - dt * 0.8);
    U.uRed.value = Math.min(1, fx.red + prox * 0.32 * (0.65 + 0.35 * Math.sin(this.t * 7.5)));
    U.uTrack.value = Math.min(1, prox * 0.9 + (fx.track || 0));
    U.uGamma.value = s.gamma || 1;
  }

  // ---------------------------------------------------------------- flow
  async boot() {
    document.getElementById('loading')?.remove();
    const q = new URLSearchParams(location.search);
    if (q.has('chapter')) { this.debugStart(+q.get('chapter'), q.get('picks')); return; }
    if (!q.has('skipboot')) {
      await this.ui.gate();
      audio.init();
      await this.ui.bootLogo();
      if (!this.settings.calibrated) await this.ui.calibrate(() => this.applySettings());
    }
    this.ui.hideBoot();
    await this.title();
  }

  // Developer shortcut: ?chapter=N&picks=cb,bd,cd,... starts at the Venue after N memories.
  async debugStart(n, picks) {
    const P = (picks || 'cb,bd,cd,cb,bd,cb').split(',');
    const M = { c: 'create', b: 'bond', d: 'duty' };
    S.cur = newState();
    S.cur.flags.bedDoor = 2;
    for (let i = 0; i < n; i++) {
      const picked = P[i % P.length].split('').map((x) => M[x]);
      const neglected = ['create', 'bond', 'duty'].find((x) => !picked.includes(x));
      const comp = picked.includes('create')
        ? { bg: ['dusk', 'home', 'fever', 'mirror', 'snow', 'gallery'][i], items: [{ id: 'chair', x: 60, y: 130, s: 1.2 }, { id: 'tree', x: 150, y: 120, s: 1.3 }, { id: 'sun', x: 150, y: 60, s: 1 }], strokes: [], seed: i + 9, title: `Test ${i + 1}`,
          insp: [{ kind: 'empty', x: 96, y: 128, r: 16, followed: true, following: i % 2 === 0 }], alien: { x: 96, y: 128, s: 0.8, behind: -1, reason: 'empty' } }
        : { blank: true, seed: i + 3, insp: [], alien: { x: 90, y: 128, s: 0.6, behind: -1, reason: 'space' } };
      S.cur.records.push({ picked, neglected, comp, notes: [] });
    }
    S.cur.chapter = n;
    this.titleCam = null;
    this.ui.hideHud(false);
    this.fx.fade = 1;
    await this.run();
  }

  async title() {
    this.mode = 'title';
    this.ui.hideHud(true);
    const tw = buildTitleWorld(this);
    this.setWorld(tw.world, tw.spawn);
    this.titleCam = tw.cam;
    this.setMood(tw.mood);
    audio.setMood('title', 0);
    this.fade(0, 2.5, 0x000000);
    const m = meta();
    const ps = peekSave();
    const contLabel = ps ? (ps.chapter >= 6 ? 'The last canvas' : `Memory ${ps.chapter + 1} of 6 · ${CHAPTERS[ps.chapter].title}`) : '';
    const show = () => this.ui.title({
      hasSave: hasSave(), contLabel,
      endings: m.endings.length,
      onContinue: () => this.start(false),
      onNew: async () => {
        if (hasSave() && !(await this.ui.confirm('Start a new memory? Your current progress will be lost.', 'Start over', 'Back'))) { show(); return; }
        this.start(true);
      },
      onSettings: () => this.ui.settingsPanel(show),
      onControls: () => this.ui.controlsPanel(show),
      onEndings: () => this.ui.endingsPanel(m.endings, show),
    });
    show();
  }

  async start(fresh) {
    this.ui.hideMenu();
    audio.init();
    if (fresh) {
      await this.ui.contentNote();
      this.ui.hideMenu();
      clearSave();
      S.cur = newState();
      S.cur.flags.bedDoor = 1 + Math.floor(Math.random() * 3);
    } else load();
    this.titleCam = null;
    input.lock();
    await this.fade(1, 1.2, 0x000000);
    this.ui.hideHud(false);
    if (fresh) {
      this.mode = 'cutscene';
      audio.setMood('none');
      await wait(600);
      await this.ui.endingText(['You wake up somewhere you have been before.', 'It smells like turpentine and rain.'], '', { hold: 400 });
      this.ui.hideEnding();
    }
    await this.run();
  }

  async run() {
    while (S.cur.chapter < 6) {
      const k = S.cur.chapter;
      await runVenue(this, k);
      const rec = await runMemory(this, k);
      S.cur.records.push(rec);
      S.cur.chapter++;
      save();
      this.ui.saveIcon();
    }
    const res = await runVenue(this, 6);
    await this.finish(res);
  }

  async finish() {
    const id = ending(S.cur);
    const E = ENDINGS[id];
    this.mode = 'ending';
    this.ui.hideHud(true);
    input.unlock();
    await this.fade(1, 2.5, id === 'good' ? 0xfff6ec : 0x000000);
    audio.setAmbient([]);
    audio.setMood(id === 'good' || id === 'boring' ? 'ending' : 'void', id === 'good' ? 0 : 0.6);
    await this.ui.endingText(E.lines, E.name, { hold: 3500, light: id === 'good' });
    recordEnding(id);
    const c = counts(S.cur), n = neglect(S.cur), ins = inspiration(S.cur);
    const mins = Math.round(S.cur.playTime / 60);
    const stats = `Create <b>${c.create}</b> · Bond <b>${c.bond}</b> · Duty <b>${c.duty}</b><br>
      Most neglected: <b>${Object.entries(n).sort((a, b) => b[1] - a[1])[0][0].toUpperCase()}</b><br>
      Inspiration followed: <b>${Math.round(ins.ratio * 100)}%</b> · Caught: <b>${S.cur.deaths}</b> · Time: <b>${mins} min</b>`;
    const comps = [...S.cur.records.map((r) => r.comp), S.cur.finalComp].filter((x) => x !== undefined);
    await this.ui.credits({ stats, comps, endingName: E.name });
    clearSave();
    location.reload();
  }
}

const game = new Game();
window.__game = game;
window.__input = input;
game.boot();
