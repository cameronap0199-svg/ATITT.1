// Keyboard, mouse (pointer lock with drag-to-look fallback) and gamepad input.
const BIND = {
  forward: ['KeyW', 'ArrowUp', 'KeyZ'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'KeyQ'],
  right: ['KeyD'],
  turnLeft: ['ArrowLeft'],
  turnRight: ['ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'KeyF', 'Enter', 'Space'],
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
  }

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
    if (!p) { this.pad.buttons = []; return; }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.pad.lx = dz(p.axes[0] || 0); this.pad.ly = dz(p.axes[1] || 0);
    this.pad.x = dz(p.axes[2] || 0); this.pad.y = dz(p.axes[3] || 0);
    const b = p.buttons.map((x) => x.pressed);
    const edge = (i) => b[i] && !this.padPrev[i];
    if (edge(0)) this.pressedSet.add('pad:interact');
    if (edge(1)) this.pressedSet.add('pad:back');
    if (edge(9)) this.pressedSet.add('pad:pause');
    if (edge(8)) this.pressedSet.add('pad:journal');
    if (edge(12)) this.pressedSet.add('pad:up');
    if (edge(13)) this.pressedSet.add('pad:down');
    this.pad.run = b[10] || b[6] || b[4];
    if (b.some((x) => x) || this.pad.lx || this.pad.ly || this.pad.x || this.pad.y) this.usingPad = true;
    this.padPrev = b;
    this.pad.buttons = b;
  }

  down(action) {
    if (action === 'run' && this.pad.run) return true;
    return (BIND[action] || []).some((k) => this.keys.has(k));
  }
  pressed(action) {
    if ((BIND[action] || []).some((k) => this.pressedSet.has(k))) return true;
    if (action === 'interact' && (this.pressedSet.has('pad:interact') || (this.locked && this.mouseClicked))) return true;
    if (action === 'pause' && this.pressedSet.has('pad:pause')) return true;
    if (action === 'journal' && this.pressedSet.has('pad:journal')) return true;
    return false;
  }
  anyAdvance() { return this.pressed('interact') || this.mouseClicked || this.pressedSet.has('pad:back'); }
  code(c) { return this.pressedSet.has(c); }

  consumeLook() { const r = [this.mdx, this.mdy]; this.mdx = 0; this.mdy = 0; return r; }
  endFrame() { this.pressedSet.clear(); this.mouseClicked = false; }
}

export const input = new Input();
