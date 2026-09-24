// Particle effects on a full-screen canvas + ambient background fireflies/leaves.
let cv, cx, parts = [], rings = [], rays = [], projectiles = [], running = false, dpr = 1;
let speed = 1;
export function setFxSpeed(s) { speed = s; }

export function initFx() {
  cv = document.getElementById('fx');
  cx = cv.getContext('2d');
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  addEventListener('resize', resize);
  resize();
  initBackground();
}

function loop() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  const dt = 1 / 60 * speed;
  // rays
  for (const r of rays) {
    r.t += dt;
    const k = r.t / r.life;
    const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    cx.save();
    cx.translate(r.x, r.y);
    cx.rotate(r.rot + r.t * 0.6);
    for (let i = 0; i < r.n; i++) {
      cx.rotate((Math.PI * 2) / r.n);
      const g = cx.createLinearGradient(0, 0, r.len, 0);
      g.addColorStop(0, withA(r.colors[i % r.colors.length], 0.75 * a));
      g.addColorStop(1, withA(r.colors[i % r.colors.length], 0));
      cx.fillStyle = g;
      cx.beginPath();
      cx.moveTo(0, 0);
      cx.lineTo(r.len, -r.width);
      cx.lineTo(r.len, r.width);
      cx.closePath();
      cx.fill();
    }
    cx.restore();
  }
  rays = rays.filter((r) => r.t < r.life);
  // rings
  for (const r of rings) {
    r.t += dt;
    const k = r.t / r.life;
    cx.strokeStyle = withA(r.color, (1 - k) * 0.9);
    cx.lineWidth = r.width * (1 - k) + 1;
    cx.beginPath();
    cx.ellipse(r.x, r.y, r.radius * easeOut(k), r.radius * easeOut(k) * r.squash, 0, 0, Math.PI * 2);
    cx.stroke();
  }
  rings = rings.filter((r) => r.t < r.life);
  // projectiles
  for (const p of projectiles) {
    p.t += dt;
    const k = Math.min(1, p.t / p.life);
    const x = p.x0 + (p.x1 - p.x0) * k;
    const y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * p.arc;
    p.trail.push([x, y]);
    if (p.trail.length > 12) p.trail.shift();
    for (let i = 0; i < p.trail.length; i++) {
      const [tx, ty] = p.trail[i];
      cx.fillStyle = withA(p.color, (i / p.trail.length) * 0.8);
      cx.beginPath();
      cx.arc(tx, ty, p.size * (i / p.trail.length), 0, Math.PI * 2);
      cx.fill();
    }
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.arc(x, y, p.size * 0.6, 0, Math.PI * 2);
    cx.fill();
    if (k >= 1 && !p.done) { p.done = true; p.resolve(); }
  }
  projectiles = projectiles.filter((p) => !p.done);
  // particles
  for (const p of parts) {
    p.t += dt;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt * 60;
    p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
    p.rot += p.vr;
    const k = p.t / p.life;
    const a = k < 0.1 ? k / 0.1 : 1 - k;
    cx.save();
    cx.globalAlpha = Math.max(0, a);
    cx.translate(p.x, p.y);
    cx.rotate(p.rot);
    cx.fillStyle = p.color;
    const s = p.size * (p.shrink ? 1 - k * 0.7 : 1);
    if (p.shape === 'star') star(s);
    else if (p.shape === 'plus') { cx.fillRect(-s, -s * 0.3, s * 2, s * 0.6); cx.fillRect(-s * 0.3, -s, s * 0.6, s * 2); }
    else if (p.shape === 'rect') cx.fillRect(-s, -s * 0.5, s * 2, s);
    else if (p.shape === 'leaf') { cx.beginPath(); cx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); cx.fill(); }
    else if (p.shape === 'spark') { cx.fillRect(-s * 1.8, -s * 0.18, s * 3.6, s * 0.36); }
    else { cx.beginPath(); cx.arc(0, 0, s, 0, Math.PI * 2); cx.fill(); }
    cx.restore();
  }
  parts = parts.filter((p) => p.t < p.life);
  if (parts.length || rings.length || rays.length || projectiles.length) requestAnimationFrame(loop);
  else { running = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
}
function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
function star(s) {
  cx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? s * 0.38 : s;
    const a = (i / 8) * Math.PI * 2;
    cx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  cx.closePath();
  cx.fill();
}
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
function withA(color, a) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }
  return color;
}

export function burst(x, y, { colors = ['#fff', '#ffd76a'], count = 24, speed: sp = 5, size = 4, gravity = 0.12, life = 0.8, shape = 'circle', drag = 0.94, spread = Math.PI * 2, dir = -Math.PI / 2, shrink = true } = {}) {
  if (!cx) return;
  for (let i = 0; i < count; i++) {
    const a = dir + (Math.random() - 0.5) * spread;
    const v = sp * (0.35 + Math.random() * 0.8);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, drag, t: 0, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], shape, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, shrink });
  }
  kick();
}
export function ring(x, y, { color = '#ffffff', radius = 60, life = 0.6, width = 6, squash = 1 } = {}) {
  if (!cx) return;
  rings.push({ x, y, color, radius, life, width, squash, t: 0 });
  kick();
}
export function lightRays(x, y, { colors = ['#fff6c0'], n = 14, len = 420, width = 26, life = 1.6 } = {}) {
  if (!cx) return;
  rays.push({ x, y, colors, n, len, width, life, t: 0, rot: Math.random() * 6 });
  kick();
}
export function projectile(from, to, { color = '#ffd76a', life = 0.28, size = 7, arc = 30 } = {}) {
  if (!cx) return Promise.resolve();
  return new Promise((resolve) => {
    projectiles.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, color, life: life / 1, size, arc, t: 0, trail: [], resolve });
    kick();
  });
}
export function confetti() {
  const colors = ['#ff5f6d', '#ffc371', '#fff96b', '#6bffb8', '#6bd6ff', '#b06bff'];
  for (let i = 0; i < 6; i++) {
    setTimeout(() => burst(innerWidth * (0.1 + Math.random() * 0.8), -10, { colors, count: 30, speed: 4, gravity: 0.1, life: 3, shape: 'rect', size: 6, dir: Math.PI / 2, spread: 1.6, drag: 0.985, shrink: false }), i * 180);
  }
}
export function hitSparks(x, y, color = '#ffe28a', big = false) {
  burst(x, y, { colors: [color, '#ffffff'], count: big ? 34 : 18, speed: big ? 9 : 6, size: big ? 5 : 3.5, gravity: 0.05, life: 0.45, shape: 'spark', drag: 0.9 });
  ring(x, y, { color, radius: big ? 70 : 42, life: 0.35, width: big ? 8 : 5 });
}
export function healSparkles(x, y, color = '#8dffb5') {
  burst(x, y + 20, { colors: [color, '#ffffff'], count: 14, speed: 2.2, size: 5, gravity: -0.06, life: 1, shape: 'plus', dir: -Math.PI / 2, spread: 1.2, drag: 0.98 });
}
export function magicCircle(x, y, color = '#9ad0ff') {
  ring(x, y, { color, radius: 70, life: 0.8, width: 5, squash: 0.45 });
  ring(x, y, { color: '#ffffff', radius: 50, life: 0.6, width: 3, squash: 0.45 });
  burst(x, y, { colors: [color, '#ffffff'], count: 26, speed: 3, size: 3, gravity: -0.12, life: 1, shape: 'star', dir: -Math.PI / 2, spread: 2.2, drag: 0.96 });
}
export function explode(x, y, colors = ['#ff9f43', '#ffd76a', '#ff5252', '#ffffff']) {
  burst(x, y, { colors, count: 50, speed: 9, size: 5, gravity: 0.15, life: 1, drag: 0.93 });
  ring(x, y, { color: '#ffd76a', radius: 110, life: 0.5, width: 10 });
}

// Screen shake helper (applies CSS animation to an element)
export function shake(node, strength = 1) {
  if (!node) return;
  node.style.setProperty('--shake', strength * 8 + 'px');
  node.classList.remove('shaking');
  void node.offsetWidth;
  node.classList.add('shaking');
  setTimeout(() => node.classList.remove('shaking'), 450);
}

// ---------------------------------------------------------------------------
// Ambient background: fireflies + drifting leaves
// ---------------------------------------------------------------------------
function initBackground() {
  const c = document.getElementById('bg-particles');
  const g = c.getContext('2d');
  let W, H;
  const flies = [];
  const leaves = [];
  const resize = () => { W = c.width = innerWidth; H = c.height = innerHeight; };
  addEventListener('resize', resize);
  resize();
  for (let i = 0; i < 38; i++) flies.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.2, s: 0.2 + Math.random() * 0.5, p: Math.random() * 6 });
  for (let i = 0; i < 10; i++) leaves.push(newLeaf(W, H, true));
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) { requestAnimationFrame(tick); return; }
    g.clearRect(0, 0, W, H);
    for (const f of flies) {
      f.p += dt * 2;
      f.y -= f.s * dt * 30;
      f.x += Math.sin(f.p) * 0.3;
      if (f.y < -10) { f.y = H + 10; f.x = Math.random() * W; }
      const a = 0.35 + Math.sin(f.p * 1.7) * 0.35;
      g.fillStyle = `rgba(255, 240, 150, ${a})`;
      g.shadowColor = 'rgba(255, 230, 120, .9)';
      g.shadowBlur = 8;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      l.t += dt;
      l.x += (l.vx + Math.sin(l.t * 1.5) * 20) * dt;
      l.y += l.vy * dt;
      l.rot += l.vr * dt;
      if (l.y > H + 20) leaves[i] = newLeaf(W, H, false);
      g.save();
      g.translate(l.x, l.y);
      g.rotate(l.rot);
      g.scale(1, Math.abs(Math.sin(l.t * 2)) * 0.8 + 0.2);
      g.fillStyle = l.color;
      g.beginPath(); g.ellipse(0, 0, l.s, l.s * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function newLeaf(W, H, anywhere) {
  const colors = ['#e8a33d', '#d9622b', '#9bc34a', '#f2c14e', '#c94c2e'];
  return { x: Math.random() * W, y: anywhere ? Math.random() * H : -20, vx: 10 + Math.random() * 20, vy: 25 + Math.random() * 35, t: Math.random() * 10, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, s: 5 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)] };
}
