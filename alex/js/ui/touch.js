// On-screen controls for touch devices: a floating move stick on the left, drag-to-look
// on the right and action buttons. Phone options are tappable in the Heartline UI.

import { G } from '../state.js';

export function setupTouch(root) {
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (!coarse || !('ontouchstart' in window || navigator.maxTouchPoints > 0)) return false;
  document.body.classList.add('touch');
  root.innerHTML = `
    <div class="stick"><i></i></div>
    <div class="tbtns">
      <button data-a="jump" class="tb big">JUMP</button>
      <button data-a="dash" class="tb big">DASH</button>
      <button data-a="melee" class="tb">ATK</button>
      <button data-a="ranged" class="tb">SHOOT</button>
      <button data-a="lock" class="tb sm">LOCK</button>
      <button data-a="interact" class="tb sm">USE</button>
      <button data-a="map" class="tb sm">MAP</button>
      <button data-a="gadget" class="tb sm">GADGET</button>
      <button data-a="ride" class="tb sm">RIDE</button>
    </div>
    <button data-a="pause" class="tb pausebtn">II</button>`;
  const stick = root.querySelector('.stick'), knob = stick.querySelector('i');
  let moveId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  const R = 60;
  const onStart = (e) => {
    if (G.mode !== 'run' && G.mode !== 'minigame') return;
    for (const t of e.changedTouches) {
      if (t.target.closest('button')) continue;
      if (t.clientX < innerWidth * 0.45 && moveId === null) {
        moveId = t.identifier; sx = t.clientX; sy = t.clientY;
        stick.style.left = sx + 'px'; stick.style.top = sy + 'px';
        stick.classList.add('on');
      } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
  };
  const onMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) {
        let dx = t.clientX - sx, dy = t.clientY - sy;
        const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        G.input.vMove = { x: dx / R, y: -dy / R };
        e.preventDefault();
      } else if (t.identifier === lookId) {
        G.input.vLook.dx += (t.clientX - lx) * 0.006 * G.settings.sensX;
        G.input.vLook.dy += (t.clientY - ly) * 0.005 * G.settings.sensY * (G.settings.invertY ? -1 : 1);
        lx = t.clientX; ly = t.clientY;
        e.preventDefault();
      }
    }
  };
  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) { moveId = null; G.input.vMove = null; knob.style.transform = ''; stick.classList.remove('on'); }
      if (t.identifier === lookId) lookId = null;
    }
  };
  window.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  window.addEventListener('touchcancel', onEnd);
  for (const b of root.querySelectorAll('button[data-a]')) {
    const a = b.dataset.a;
    const on = (e) => { e.preventDefault(); G.input.virtual[a] = true; G.input.virtual['_tap_' + a] = true; b.classList.add('down'); G.audio.initAudio(); };
    const off = (e) => { e.preventDefault(); G.input.virtual[a] = false; b.classList.remove('down'); };
    b.addEventListener('touchstart', on, { passive: false });
    b.addEventListener('touchend', off);
    b.addEventListener('touchcancel', off);
  }
  return true;
}
