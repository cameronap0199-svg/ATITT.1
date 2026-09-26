// Starving Artist — game orchestration: main loop, modes, pause/menus, fades, the
// chapter flow (Vista Venue -> memory -> Vista Venue ...), and the ending.
import * as THREE from 'three';
import { PS1Renderer, Lights, shared } from './renderer.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Painter } from './painting.js';
import { S, newState, save, load, hasSave, clearSave, loadSettings, saveSettings, counts, neglect, inspiration, ending, meta, recordEnding } from './state.js';
import { CHAPTERS, ENDINGS } from './story.js';
import { runVenue, buildTitleWorld } from './venue.js';
import { runMemory } from './memories.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
    this.t = 0;
    input.attach(this.canvas);
    input.attachTouch(document.body);
    input.onUnlock = () => this.onUnlock();
    this.ui.hooks = { unlock: () => input.unlock(), relock: () => input.lock(), onSettings: () => this.applySettings() };
    this.canvas.addEventListener('click', () => { audio.init(); if (this.mode === 'play' || this.mode === 'busy' || this.mode === 'cutscene') input.lock(); });
    document.addEventListener('pointerdown', () => audio.init());
    document.addEventListener('keydown', () => audio.init());
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
    this.ui.applyTextSize();
    saveSettings(s);
  }

  // ---------------------------------------------------------------- world & mood
  setWorld(world, spawn) {
    if (this.world && this.world !== world) this.world.dispose();
    this.world = world;
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
    if (m.playerLight !== undefined) this.playerLight.intensity = m.playerLight;
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
      onJournal: () => this.ui.journal(S.cur, CHAPTERS, () => this.pause2()),
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
    p.lookTarget = alien.head.getWorldPosition(new THREE.Vector3());
    audio.play('stinger', { vol: 1.2 });
    audio.play('tear');
    this.pulse('glitch', 1); this.pulse('shake', 0.25);
    this.fx.aberr = 3;
    await wait(900);
    audio.play('static', { vol: 0.8, dur: 1.4 });
    await this.fade(1, 0.35, 0x000000);
    p.lookTarget = null;
    S.cur.deaths++;
    this.ui.subtitle(['It doesn\'t want to hurt you. It wants to be you.', 'Not yet.', 'You got away. This time.', 'It lets you go. It likes the chase.'][S.cur.deaths % 4], 2600);
    await wait(1400);
    respawn();
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
    }
    if (m === 'play' || m === 'busy') S.cur.playTime += dt;
    if (m === 'menu' || m === 'title') this.ui.menuNav();
    if ((m === 'menu') && (input.pressed('pause') || input.code('pad:back')) && this._pauseMenu && this.ui.menuOpen()) this.resume();
    this.ui.update(dt);
    this.painter.tick(dt);
    this.lights.update(this.camera.position, this.t);
    this.ui.needClick(m === 'play' && !input.locked && !input.dragMode && !this.ui.menuOpen() && document.hasFocus());
    input.showTouch((m === 'play' || m === 'busy') && !this.ui.menuOpen());
    this.updatePost(dt);
    if (this.world) this.R.render(this.world.scene, this.camera);
    input.endFrame();
  }

  playTick(dt) {
    const p = this.player, w = this.world;
    if (input.pressed('pause')) { this.pause(); return; }
    if (input.pressed('journal')) { this.pause(); this.ui.journal(S.cur, CHAPTERS, () => this.pause2()); return; }
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
  }

  // ---------------------------------------------------------------- flow
  async boot() {
    document.getElementById('loading')?.remove();
    const q = new URLSearchParams(location.search);
    if (q.has('chapter')) { this.debugStart(+q.get('chapter'), q.get('picks')); return; }
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
    const show = () => this.ui.title({
      hasSave: hasSave(),
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
