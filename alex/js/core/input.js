// Unified keyboard / mouse / gamepad / touch input with remappable actions,
// press buffering (for jump / dash / attack queues) and a text-capture mode.

import { ACTIONS } from './settings.js';
import { CAMERA } from '../config.js';

const DEAD = 0.18;

export class Input {
  constructor(settings, canvas) {
    this.s = settings;
    this.canvas = canvas;
    this.down = new Set();        // raw codes currently held (keys + Mouse0..2)
    this.tapped = new Set();      // raw codes pressed since last update
    this.held = {};
    this.pressedNow = {};
    this.releasedNow = {};
    this.lastPress = {};          // action -> real time of last press
    this.consumed = {};           // action -> press time already consumed
    for (const a of Object.keys(ACTIONS)) { this.held[a] = false; this.lastPress[a] = -99; }
    this.move = { x: 0, y: 0, mag: 0 };
    this.look = { dx: 0, dy: 0 };
    this.lookRate = 0;            // rad/s of recent manual camera input (for camera-assist suppression)
    this.flick = 0;               // -1 / +1 when a decisive horizontal flick happened this frame
    this.device = 'kbm';
    this.pad = null;
    this.padPrev = [];
    this.virtual = {};            // touch buttons: action -> held
    this.vMove = null;            // touch stick {x,y}
    this.vLook = { dx: 0, dy: 0 };
    this.textCapture = null;      // fn(char|'Backspace'|'Enter')
    this.bindCapture = null;      // fn(code)
    this.pointerLocked = false;
    this.wantLock = false;
    this.mouseHist = [];
    this.rsPrevMag = 0;
    this.now = 0;
    this._bind();
  }

  _bind() {
    const kd = (e) => {
      if (this.bindCapture) { e.preventDefault(); const f = this.bindCapture; this.bindCapture = null; f(e.code); return; }
      if (this.textCapture && !e.ctrlKey && !e.metaKey) {
        if (e.key.length === 1 && /[a-z']/i.test(e.key)) { e.preventDefault(); this.textCapture(e.key.toLowerCase()); return; }
        if (e.key === 'Backspace' || e.key === 'Enter') { e.preventDefault(); this.textCapture(e.key); return; }
      }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !isFormField(e.target)) e.preventDefault();
      if (isFormField(e.target)) return;
      this.device = 'kbm';
      if (!this.down.has(e.code)) this.tapped.add(e.code);
      this.down.add(e.code);
    };
    const ku = (e) => { this.down.delete(e.code); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', () => { this.down.clear(); });

    const md = (e) => {
      if (this.bindCapture) { e.preventDefault(); const f = this.bindCapture; this.bindCapture = null; f('Mouse' + e.button); return; }
      if (e.target !== this.canvas && !this.pointerLocked) return;
      this.device = 'kbm';
      const c = 'Mouse' + e.button;
      if (!this.down.has(c)) this.tapped.add(c);
      this.down.add(c);
      if (this.wantLock && !this.pointerLocked) this.requestLock();
    };
    const mu = (e) => { this.down.delete('Mouse' + e.button); };
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    window.addEventListener('contextmenu', (e) => { if (e.target === this.canvas || this.pointerLocked) e.preventDefault(); });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      const k = CAMERA.mouseSens;
      const dx = e.movementX * k * this.s.sensX * (this.s.invertX ? -1 : 1);
      const dy = e.movementY * k * this.s.sensY * (this.s.invertY ? -1 : 1);
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return; // browser lock glitch
      this.look.dx += dx;
      this.look.dy += dy;
      this.mouseHist.push([performance.now(), e.movementX]);
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) this.down.clear();
    });
    window.addEventListener('gamepadconnected', () => { this.device = 'pad'; });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch { /* ignore */ } });
    } catch { /* ignore */ }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  _codeHeld(code) { return this.down.has(code); }

  update(realDt) {
    this.now = performance.now() / 1000;
    const keys = this.s.keys, padMap = this.s.pad;
    // Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    const pb = this.pad ? this.pad.buttons.map((b) => b.pressed || b.value > 0.5) : [];
    if (pb.some(Boolean)) this.device = 'pad';

    for (const a of Object.keys(ACTIONS)) {
      let h = false, tap = false;
      for (const c of keys[a] || []) { if (this.down.has(c)) h = true; if (this.tapped.has(c)) tap = true; }
      for (const b of padMap[a] || []) if (pb[b]) { h = true; if (!this.padPrev[b]) tap = true; }
      if (this.virtual[a]) { h = true; if (!this.virtual['_prev_' + a]) tap = true; }
      this.virtual['_prev_' + a] = !!this.virtual[a];
      const was = this.held[a];
      this.pressedNow[a] = tap || (h && !was);
      this.releasedNow[a] = !h && was;
      this.held[a] = h;
      if (this.pressedNow[a]) this.lastPress[a] = this.now;
    }
    this.padPrev = pb;
    this.tapped.clear();

    // Movement axis (forward = +y)
    // Letter keys belong to the text field while the Bible Check wants typing; arrows still move.
    const k = (a) => (keys[a] || []).some((c) => this.down.has(c) && !(this.textCapture && /^Key/.test(c)));
    let x = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
    let y = (k('up') ? 1 : 0) - (k('down') ? 1 : 0);
    const km = Math.hypot(x, y);
    if (km > 1) { x /= km; y /= km; }
    if (this.pad) {
      const ax = this.pad.axes[0] || 0, ay = -(this.pad.axes[1] || 0);
      const m = Math.hypot(ax, ay);
      if (m > DEAD && m > Math.hypot(x, y)) {
        const s = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
        x = ax * s; y = ay * s;
        this.device = 'pad';
      }
      // Right stick → camera
      const rx = this.pad.axes[2] || 0, ry = this.pad.axes[3] || 0;
      const rm = Math.hypot(rx, ry);
      if (rm > DEAD) {
        const k = (Math.min(1, (rm - DEAD) / (1 - DEAD)) ** 1.6) / rm;
        this.look.dx += rx * k * CAMERA.padSens * this.s.padSensX * realDt * (this.s.invertX ? -1 : 1);
        this.look.dy += ry * k * CAMERA.padSens * this.s.padSensY * realDt * (this.s.invertY ? -1 : 1);
        this.device = 'pad';
      }
      // Flick detection: stick snapped hard sideways from near rest
      this.flick = 0;
      if (rm > 0.85 && this.rsPrevMag < 0.35 && Math.abs(rx) > Math.abs(ry)) this.flick = Math.sign(rx);
      this.rsPrevMag = rm;
    } else this.flick = 0;
    if (this.vMove && Math.hypot(this.vMove.x, this.vMove.y) > Math.hypot(x, y)) { x = this.vMove.x; y = this.vMove.y; this.device = 'touch'; }
    this.look.dx += this.vLook.dx; this.look.dy += this.vLook.dy;
    this.vLook.dx = 0; this.vLook.dy = 0;
    this.move.x = x; this.move.y = y; this.move.mag = Math.min(1, Math.hypot(x, y));

    // Mouse flick: > 160 px horizontally inside 90 ms
    const t = performance.now();
    this.mouseHist = this.mouseHist.filter((h) => t - h[0] < 90);
    if (!this.flick) {
      const sum = this.mouseHist.reduce((s, h) => s + h[1], 0);
      if (Math.abs(sum) > 160) { this.flick = Math.sign(sum) * (this.s.invertX ? -1 : 1); this.mouseHist.length = 0; }
    }
    const rate = Math.hypot(this.look.dx, this.look.dy) / Math.max(realDt, 1e-3);
    this.lookRate = Math.max(rate, this.lookRate * Math.exp(-10 * realDt));
  }

  endFrame() { this.look.dx = 0; this.look.dy = 0; }

  pressed(a) { return this.pressedNow[a]; }
  released(a) { return this.releasedNow[a]; }
  isHeld(a) { return this.held[a]; }
  // Was the action pressed within `window` seconds and not yet consumed?
  buffered(a, window) {
    const t = this.lastPress[a];
    return this.now - t <= window && this.consumed[a] !== t;
  }
  consume(a) { this.consumed[a] = this.lastPress[a]; }
  clearBuffers() { for (const a of Object.keys(this.lastPress)) this.consumed[a] = this.lastPress[a]; }

  rumble(strength, ms = 120) {
    const v = strength * this.s.vibration;
    if (v <= 0.01 || !this.pad || !this.pad.vibrationActuator) return;
    try { this.pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, v), weakMagnitude: Math.min(1, v * 0.7) }); } catch { /* ignore */ }
  }

  // Human-readable glyph for an action on the active device.
  glyph(a) {
    if (this.device === 'pad') {
      const b = (this.s.pad[a] || [])[0];
      return b === undefined ? '—' : ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', '▲', '▼', '◀', '▶'][b] || 'B' + b;
    }
    const c = (this.s.keys[a] || [])[0];
    return codeLabel(c);
  }
}

export function codeLabel(c) {
  if (!c) return '—';
  if (c === 'Mouse0') return 'LMB';
  if (c === 'Mouse1') return 'MMB';
  if (c === 'Mouse2') return 'RMB';
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[c];
  if (c === 'ShiftLeft' || c === 'ShiftRight') return 'Shift';
  if (c === 'Space') return 'Space';
  if (c === 'Escape') return 'Esc';
  return c.replace(/(Left|Right)$/, '');
}

function isFormField(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}
