// Keyboard, mouse (pointer lock with drag-to-look fallback) and gamepad input.
const BIND = {
  forward: ['KeyW', 'ArrowUp', 'KeyZ'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'KeyQ'],
  right: ['KeyD'],
  turnLeft: ['ArrowLeft'],
  turnRight: ['ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter', 'Space'],
  flashlight: ['KeyF', 'KeyL'],
  pause: ['Escape', 'KeyP'],
  journal: ['Tab', 'KeyJ'],
};

class Input {
  constructor() {
    this.keys = new Set();
    this.pressedSet = new Set();
    this.mdx = 0; this.mdy = 0;
    this.locked = false;
    this.dragMode = false;
    this.dragging = false;
    this.mouseClicked = false;
    this.canvas = null;
    this.onUnlock = null;
    this.expectUnlock = false;
    this.pad = { x: 0, y: 0, lx: 0, ly: 0, buttons: [] };
    this.padPrev = [];
    this.usingPad = false;
    this.touch = false;
    this.touchRun = false;
  }

  // Virtual stick (left), drag-to-look (right), tap to interact, buttons.
  attachTouch(root) {
    const el = document.createElement('div');
    el.id = 'touch'; el.className = 'hidden';
    el.innerHTML = '<div class="t-stick"><div class="t-knob"></div></div><div class="t-look"></div>' +
      '<button class="t-btn t-use">E</button><button class="t-btn t-run">RUN</button><button class="t-btn t-light hidden">☀</button><button class="t-btn t-pause">II</button><button class="t-btn t-jour">J</button>';
    root.appendChild(el);
    this.touchEl = el;
    const stick = el.querySelector('.t-stick'), knob = el.querySelector('.t-knob'), look = el.querySelector('.t-look');
    let sId = null, sx = 0, sy = 0, lId = null, lx = 0, ly = 0, lStart = 0, lMoved = 0;
    const R = 50;
    stick.addEventListener('pointerdown', (e) => { sId = e.pointerId; sx = e.clientX; sy = e.clientY; try { stick.setPointerCapture(e.pointerId); } catch { /* synthetic */ } e.preventDefault(); });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sId) return;
      let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.pad.lx = dx / R; this.pad.ly = dy / R;
    });
    const endStick = (e) => { if (e.pointerId !== sId) return; sId = null; knob.style.transform = ''; this.pad.lx = 0; this.pad.ly = 0; };
    stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
    look.addEventListener('pointerdown', (e) => { lId = e.pointerId; lx = e.clientX; ly = e.clientY; lStart = performance.now(); lMoved = 0; try { look.setPointerCapture(e.pointerId); } catch { /* synthetic */ } e.preventDefault(); });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lId) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; lMoved += Math.abs(dx) + Math.abs(dy);
      this.mdx += dx * 1.7; this.mdy += dy * 1.7;
    });
    const endLook = (e) => { if (e.pointerId !== lId) return; lId = null; if (lMoved < 12 && performance.now() - lStart < 300) this.pressedSet.add('pad:interact'); };
    look.addEventListener('pointerup', endLook); look.addEventListener('pointercancel', endLook);
    const btn = (sel, fn) => el.querySelector(sel).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    btn('.t-use', () => this.pressedSet.add('pad:interact'));
    btn('.t-run', () => { this.touchRun = !this.touchRun; el.querySelector('.t-run').classList.toggle('on', this.touchRun); });
    btn('.t-pause', () => this.pressedSet.add('pad:pause'));
    btn('.t-light', () => this.pressedSet.add('pad:light'));
    btn('.t-jour', () => this.pressedSet.add('pad:journal'));
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !this.touch) { this.touch = true; this.dragMode = true; document.body.classList.add('is-touch'); } }, true);
  }
  showTouch(on, light = false) { if (!this.touchEl) return; this.touchEl.classList.toggle('hidden', !(on && this.touch)); this.touchEl.querySelector('.t-light').classList.toggle('hidden', !light); }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedSet.add(e.code);
      this.keys.add(e.code);
      this.usingPad = false;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.locked || (this.dragMode && this.dragging)) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseClicked = true; if (this.dragMode) this.dragging = true; }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) {
        if (this.expectUnlock) this.expectUnlock = false;
        else if (this.onUnlock) this.onUnlock();
      }
    });
    document.addEventListener('pointerlockerror', () => { this.dragMode = true; });
  }

  lock() {
    if (this.dragMode || !this.canvas || this.locked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.dragMode = true; });
    } catch { this.dragMode = true; }
  }
  unlock() {
    if (!this.locked) return;
    this.expectUnlock = true;
    document.exitPointerLock();
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find((x) => x);
    if (!p) { this.pad.buttons = []; this.pad.run = false; return; }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.pad.lx = dz(p.axes[0] || 0); this.pad.ly = dz(p.axes[1] || 0);
    this.pad.x = dz(p.axes[2] || 0); this.pad.y = dz(p.axes[3] || 0);
    const b = p.buttons.map((x) => x.pressed);
    const edge = (i) => b[i] && !this.padPrev[i];
    if (edge(0)) this.pressedSet.add('pad:interact');
    if (edge(1)) this.pressedSet.add('pad:back');
    if (edge(9)) this.pressedSet.add('pad:pause');
    if (edge(8)) this.pressedSet.add('pad:journal');
    if (edge(3)) this.pressedSet.add('pad:light');
    if (edge(12)) this.pressedSet.add('pad:up');
    if (edge(13)) this.pressedSet.add('pad:down');
    this.pad.run = b[10] || b[6] || b[4];
    if (b.some((x) => x) || this.pad.lx || this.pad.ly || this.pad.x || this.pad.y) this.usingPad = true;
    this.padPrev = b;
    this.pad.buttons = b;
  }

  down(action) {
    if (action === 'run' && (this.pad.run || this.touchRun)) return true;
    return (BIND[action] || []).some((k) => this.keys.has(k));
  }
  pressed(action) {
    if ((BIND[action] || []).some((k) => this.pressedSet.has(k))) return true;
    if (action === 'interact' && (this.pressedSet.has('pad:interact') || (this.locked && this.mouseClicked))) return true;
    if (action === 'pause' && this.pressedSet.has('pad:pause')) return true;
    if (action === 'journal' && this.pressedSet.has('pad:journal')) return true;
    if (action === 'flashlight' && this.pressedSet.has('pad:light')) return true;
    return false;
  }
  anyAdvance() { return this.pressed('interact') || this.mouseClicked || this.pressedSet.has('pad:back'); }
  code(c) { return this.pressedSet.has(c); }

  consumeLook() { const r = [this.mdx, this.mdy]; this.mdx = 0; this.mdy = 0; return r; }
  endFrame() { this.pressedSet.clear(); this.mouseClicked = false; }
}

export const input = new Input();
