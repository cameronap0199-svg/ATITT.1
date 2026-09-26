// Boot, letterboxed resize and the frame loop. Key presses are handed to screens with
// their real event time so the rhythm engine can judge them precisely.

import { W, H } from './data.js';
import { input } from './input.js';
import { initAudio } from './audio.js';
import { initUI } from './ui.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiRoot = document.getElementById('ui');
const stage = document.getElementById('stage');

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const k = Math.min(vw / W, vh / H);
  const cw = Math.floor(W * k), ch = Math.floor(H * k);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);
  stage.style.width = `${cw}px`;
  stage.style.height = `${ch}px`;
  uiRoot.style.transform = `scale(${k})`;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.imageSmoothingEnabled = true;
}

async function boot() {
  resize();
  addEventListener('resize', resize);
  initUI(uiRoot);
  input.init(canvas);
  const unlock = () => initAudio();
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
  try {
    await Promise.race([
      Promise.all(['40px VT323', '40px Anton', '20px "Share Tech Mono"', '20px Caudex'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fonts are optional */ }
  const game = new Game(canvas);
  window.__ttt = game;
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { e.preventDefault(); game.onEscape(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.run && !game.paused && game.screen && game.screen.constructor.name === 'CombatRoom') game.pause();
  });
  game.showTitle();
  let last = performance.now() / 1000;
  const frame = (nowMs) => {
    const wall = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0, wall - last));
    last = wall;
    if (!game.paused) game.time += dt;
    const scr = game.screen;
    const uiBusy = !!uiRoot.querySelector('.layer') && !(scr && scr.constructor.name === 'TitleScreen');
    for (const p of input.presses) {
      if (p.code === 'Escape' || game.paused || !scr) continue;
      if (uiBusy && scr.constructor.name !== 'TitleScreen') continue;
      scr.onKey?.(p.code, game.time - Math.max(0, wall - p.wall));
    }
    if (!game.paused && scr) {
      for (const c of input.clicks) scr.onClick?.(c.x, c.y, c.button);
      if (input.wheel) scr.onWheel?.(input.wheel);
      scr.update(dt, game.time);
    }
    input.endFrame();
    ctx.save();
    game.screen?.draw(ctx, game.time);
    ctx.restore();
    canvas.style.cursor = game.screen?.cursor ? game.screen.cursor() : 'default';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
