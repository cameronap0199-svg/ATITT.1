// Keyboard + mouse, mapped to the 1280x720 logical canvas. Key presses keep their
// DOM timestamps so the rhythm engine can judge them at the moment they happened.

import { W, H } from './data.js';

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export const input = {
  held: new Set(),
  presses: [],        // { code, key, wall }
  clicks: [],         // { x, y, button, wall }
  mouse: { x: W / 2, y: H / 2, down: false, right: false, inside: false },
  wheel: 0,

  init(canvas) {
    const toLogical = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.presses.push({ code: e.code, key: e.key, wall: e.timeStamp / 1000 });
      this.held.add(e.code);
    });
    addEventListener('keyup', (e) => { this.held.delete(e.code); });
    addEventListener('blur', () => { this.held.clear(); this.mouse.down = false; this.mouse.right = false; });
    canvas.addEventListener('mousemove', (e) => { Object.assign(this.mouse, toLogical(e)); this.mouse.inside = true; });
    canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    canvas.addEventListener('mousedown', (e) => {
      Object.assign(this.mouse, toLogical(e));
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.right = true;
      this.clicks.push({ ...toLogical(e), button: e.button, wall: e.timeStamp / 1000 });
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },

  isDown(code) { return this.held.has(code); },
  endFrame() { this.presses.length = 0; this.clicks.length = 0; this.wheel = 0; },
};
