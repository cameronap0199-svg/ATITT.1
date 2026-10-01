// Procedural audio: synthesized SFX, a K-pop-flavoured step sequencer for the
// soundtrack, the Heartline ringtone and crowd ambience. No audio files.

let ctx = null;
let master, comp, sfxBus, musicBus, phoneBus, crowdGain, noiseBuf;
const vol = { master: 0.8, music: 0.55, sfx: 0.85, phone: 0.9 };
let duck = 1;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.connect(master);
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.connect(comp);
  phoneBus = ctx.createGain(); phoneBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // crowd ambience: looped, filtered noise with a slow swell
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
  src.connect(bp); bp.connect(crowdGain); crowdGain.connect(sfxBus);
  src.start();
  applyVolumes();
  if (pending) { const p = pending; pending = null; playMusic(p.name, p.opts); }
}

export function suspendAudio(on) {
  if (!ctx) return;
  if (on && ctx.state === 'running') ctx.suspend();
  else if (!on && ctx.state === 'suspended') ctx.resume();
}

export function setVolumes(s) {
  vol.master = s.masterVol; vol.music = s.musicVol; vol.sfx = s.sfxVol; vol.phone = s.phoneVol;
  applyVolumes();
}
function applyVolumes() {
  if (!ctx) return;
  master.gain.value = vol.master;
  sfxBus.gain.value = vol.sfx;
  musicBus.gain.setTargetAtTime(vol.music * 0.5 * duck, ctx.currentTime, 0.15);
  phoneBus.gain.value = vol.phone;
}
export function duckMusic(on) { duck = on ? 0.45 : 1; applyVolumes(); }
export function setCrowd(level) { if (ctx) crowdGain.gain.setTargetAtTime(level * 0.16, ctx.currentTime, 0.6); }

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function out(bus, pan) {
  if (!pan) return bus;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(bus);
  return p;
}

function tone(f, dur, o = {}) {
  if (!ctx) return;
  const t = (o.t ?? ctx.currentTime) + (o.at || 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(f, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const v = o.v ?? 0.15, a = o.attack ?? 0.004, r = o.release ?? 0.05;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.setValueAtTime(v, t + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; f2.Q.value = o.q || 0.7; node.connect(f2); node = f2; }
  node.connect(g);
  g.connect(out(o.bus || sfxBus, o.pan));
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, o = {}) {
  if (!ctx) return;
  const t = (o.t ?? ctx.currentTime) + (o.at || 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = o.rate || 1;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 1200, t);
  if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
  f.Q.value = o.q || 0.8;
  const g = ctx.createGain();
  const v = o.v ?? 0.2, a = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out(o.bus || sfxBus, o.pan));
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.02);
}

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------
const last = {};
const SFX = {
  slash: (o) => { noise(0.14, { freq: 2600, sweep: 900, q: 1.2, v: 0.22 * o.v, pan: o.pan }); tone(900 * o.p, 0.08, { type: 'triangle', slide: 400, v: 0.05 * o.v, pan: o.pan }); },
  slash2: (o) => { noise(0.16, { freq: 3200, sweep: 700, q: 1.5, v: 0.24 * o.v, pan: o.pan }); },
  spin: (o) => { noise(0.3, { freq: 900, sweep: 4200, q: 1.5, v: 0.26 * o.v, pan: o.pan }); tone(300, 0.25, { type: 'sawtooth', slide: 900, v: 0.05 * o.v, lp: 2000 }); },
  shot: (o) => { tone(1400 * o.p, 0.07, { type: 'square', slide: 500, v: 0.07 * o.v, pan: o.pan }); noise(0.05, { freq: 5000, v: 0.08 * o.v, pan: o.pan }); },
  heavyShot: (o) => { tone(220, 0.22, { type: 'sawtooth', slide: 60, v: 0.18 * o.v, lp: 1200 }); noise(0.25, { freq: 700, sweep: 150, v: 0.3 * o.v, filter: 'lowpass' }); },
  shirt: (o) => { tone(500, 0.18, { type: 'triangle', slide: 150, v: 0.12 * o.v }); noise(0.18, { freq: 400, v: 0.2 * o.v, filter: 'lowpass' }); },
  flame: (o) => { noise(0.12, { freq: 800, sweep: 400, v: 0.1 * o.v, filter: 'lowpass' }); },
  hit: (o) => { tone(180 * o.p, 0.09, { type: 'square', slide: 70, v: 0.16 * o.v, pan: o.pan }); noise(0.07, { freq: 1600, v: 0.16 * o.v, pan: o.pan }); },
  hitHeavy: (o) => { tone(120, 0.18, { type: 'sawtooth', slide: 40, v: 0.22 * o.v, lp: 900 }); noise(0.18, { freq: 600, v: 0.3 * o.v, filter: 'lowpass' }); },
  armor: (o) => { tone(1800, 0.12, { type: 'square', slide: 1200, v: 0.07 * o.v }); tone(2400, 0.1, { type: 'triangle', v: 0.05 * o.v, at: 0.02 }); },
  die: (o) => { tone(700 * o.p, 0.28, { type: 'square', slide: 90, v: 0.1 * o.v, pan: o.pan }); noise(0.3, { freq: 2000, sweep: 300, v: 0.14 * o.v, pan: o.pan }); },
  hurt: (o) => { tone(300, 0.2, { type: 'sawtooth', slide: 110, v: 0.2 * o.v, lp: 1500 }); noise(0.15, { freq: 900, v: 0.2 * o.v }); },
  dash: (o) => { noise(0.2, { freq: 600, sweep: 3200, q: 0.8, v: 0.2 * o.v }); },
  perfect: (o) => { [0, 4, 7, 12].forEach((s, i) => tone(mtof(84 + s), 0.25, { type: 'triangle', v: 0.09 * o.v, at: i * 0.03 })); noise(0.4, { freq: 6000, sweep: 12000, v: 0.08 * o.v, filter: 'highpass' }); },
  jump: (o) => { noise(0.1, { freq: 1400, sweep: 2600, v: 0.06 * o.v }); },
  land: (o) => { noise(0.08, { freq: 500, v: 0.1 * o.v, filter: 'lowpass' }); },
  landHeavy: (o) => { tone(90, 0.3, { type: 'sine', slide: 35, v: 0.35 * o.v }); noise(0.35, { freq: 300, v: 0.35 * o.v, filter: 'lowpass' }); },
  wallkick: (o) => { tone(260, 0.08, { type: 'square', slide: 520, v: 0.08 * o.v }); noise(0.12, { freq: 900, v: 0.12 * o.v }); },
  vault: (o) => { noise(0.14, { freq: 1100, sweep: 1900, v: 0.09 * o.v }); },
  coin: (o) => { tone(mtof(88), 0.05, { type: 'square', v: 0.05 * o.v }); tone(mtof(95), 0.12, { type: 'square', v: 0.05 * o.v, at: 0.05 }); },
  bill: (o) => { noise(0.12, { freq: 3500, v: 0.08 * o.v }); tone(mtof(91), 0.1, { type: 'triangle', v: 0.06 * o.v, at: 0.03 }); },
  heal: (o) => { [0, 4, 7].forEach((s, i) => tone(mtof(72 + s), 0.18, { type: 'triangle', v: 0.08 * o.v, at: i * 0.06 })); },
  buy: (o) => { tone(mtof(84), 0.06, { type: 'square', v: 0.06 * o.v }); tone(mtof(88), 0.06, { type: 'square', v: 0.06 * o.v, at: 0.06 }); tone(mtof(91), 0.14, { type: 'square', v: 0.06 * o.v, at: 0.12 }); },
  deny: (o) => { tone(160, 0.12, { type: 'square', v: 0.08 * o.v }); tone(120, 0.16, { type: 'square', v: 0.08 * o.v, at: 0.1 }); },
  door: (o) => { tone(mtof(67), 0.1, { type: 'triangle', v: 0.08 * o.v }); tone(mtof(74), 0.2, { type: 'triangle', v: 0.08 * o.v, at: 0.08 }); },
  lock: (o) => { tone(90, 0.3, { type: 'sawtooth', v: 0.14 * o.v, lp: 600 }); noise(0.2, { freq: 300, v: 0.2 * o.v, filter: 'lowpass' }); },
  clear: (o) => { [0, 7, 12, 16, 19].forEach((s, i) => tone(mtof(72 + s), 0.3, { type: 'square', v: 0.05 * o.v, at: i * 0.07, lp: 3000 })); },
  tele: (o) => { tone(mtof(81) * o.p, 0.06, { type: 'square', v: 0.035 * o.v, pan: o.pan }); },
  offscreen: (o) => { tone(mtof(86), 0.07, { type: 'triangle', v: 0.1 * o.v, pan: o.pan }); tone(mtof(86), 0.07, { type: 'triangle', v: 0.1 * o.v, pan: o.pan, at: 0.1 }); },
  boom: (o) => { tone(70, 0.5, { type: 'sine', slide: 30, v: 0.4 * o.v }); noise(0.6, { freq: 900, sweep: 90, v: 0.45 * o.v, filter: 'lowpass', pan: o.pan }); },
  flash: (o) => { noise(0.06, { freq: 7000, v: 0.2 * o.v, filter: 'highpass' }); tone(2400, 0.2, { type: 'sine', slide: 600, v: 0.06 * o.v, at: 0.03 }); },
  screech: (o) => { tone(1500, 0.5, { type: 'sawtooth', slide: 2600, v: 0.08 * o.v, lp: 4000, pan: o.pan }); noise(0.5, { freq: 3000, v: 0.08 * o.v, pan: o.pan }); },
  chant: (o) => { tone(mtof(64 + o.p), 0.22, { type: 'sawtooth', v: 0.07 * o.v, lp: 1800, pan: o.pan }); tone(mtof(71 + o.p), 0.22, { type: 'sawtooth', v: 0.05 * o.v, lp: 1800, pan: o.pan }); },
  shout: (o) => { tone(260, 0.35, { type: 'sawtooth', slide: 180, v: 0.12 * o.v, lp: 1400, pan: o.pan }); noise(0.3, { freq: 1300, v: 0.12 * o.v, pan: o.pan }); },
  rope: (o) => { noise(0.5, { freq: 300, sweep: 1200, v: 0.14 * o.v }); },
  slam: (o) => { tone(60, 0.45, { type: 'sine', slide: 28, v: 0.45 * o.v }); noise(0.4, { freq: 400, sweep: 80, v: 0.4 * o.v, filter: 'lowpass' }); },
  charge: (o) => { tone(90, 0.6, { type: 'sawtooth', slide: 220, v: 0.1 * o.v, lp: 800, pan: o.pan }); },
  roar: (o) => { tone(80, 1.1, { type: 'sawtooth', slide: 50, v: 0.2 * o.v, lp: 700 }); noise(1.1, { freq: 400, v: 0.25 * o.v, filter: 'lowpass' }); },
  cheer: (o) => { noise(1.4, { freq: 1100, v: 0.25 * o.v, q: 0.4, attack: 0.2 }); },
  text: (o) => { tone(mtof(88), 0.05, { type: 'sine', v: 0.1 * o.v, bus: phoneBus }); tone(mtof(93), 0.09, { type: 'sine', v: 0.1 * o.v, at: 0.07, bus: phoneBus }); },
  heartUp: (o) => { [0, 4, 7, 11].forEach((s, i) => tone(mtof(79 + s), 0.14, { type: 'triangle', v: 0.08 * o.v, at: i * 0.05, bus: phoneBus })); },
  heartDown: (o) => { [7, 3, 0].forEach((s, i) => tone(mtof(67 + s), 0.2, { type: 'square', v: 0.06 * o.v, at: i * 0.1, lp: 1500, bus: phoneBus })); },
  blip: (o) => { tone(mtof(76) * o.p, 0.03, { type: 'square', v: 0.03 * o.v, bus: phoneBus }); },
  ui: (o) => { tone(mtof(79) * o.p, 0.05, { type: 'triangle', v: 0.06 * o.v }); },
  uiOk: (o) => { tone(mtof(79), 0.05, { type: 'triangle', v: 0.07 * o.v }); tone(mtof(86), 0.1, { type: 'triangle', v: 0.07 * o.v, at: 0.05 }); },
  scratch: (o) => { noise(0.07, { freq: 4000, v: 0.08 * o.v, rate: 1.4 }); },
  win: (o) => { [0, 4, 7, 12, 16].forEach((s, i) => tone(mtof(76 + s), 0.16, { type: 'square', v: 0.06 * o.v, at: i * 0.08 })); },
  lose: (o) => { tone(mtof(60), 0.3, { type: 'triangle', slide: mtof(52), v: 0.1 * o.v }); },
  static: (o) => { noise(1.2, { freq: 3000, v: 0.3 * o.v, q: 0.3 }); },
  neigh: (o) => { tone(700, 0.7, { type: 'sawtooth', slide: 300, v: 0.12 * o.v, lp: 2200 }); tone(740, 0.5, { type: 'square', slide: 380, v: 0.05 * o.v, at: 0.1 }); },
  pjump: (o) => { tone(300, 0.14, { type: 'square', slide: 900, v: 0.06 * o.v }); },
  pcoin: (o) => { tone(mtof(83), 0.05, { type: 'square', v: 0.06 * o.v }); tone(mtof(88), 0.18, { type: 'square', v: 0.06 * o.v, at: 0.05 }); },
  pstomp: (o) => { tone(400, 0.08, { type: 'square', slide: 150, v: 0.08 * o.v }); },
  pdie: (o) => { [72, 71, 70, 64, 60, 55].forEach((m, i) => tone(mtof(m), 0.12, { type: 'square', v: 0.07 * o.v, at: i * 0.11 })); },
  pbump: (o) => { tone(140, 0.06, { type: 'square', v: 0.07 * o.v }); },
  chop: (o) => { noise(0.05, { freq: 2500, v: 0.18 * o.v }); tone(700, 0.04, { type: 'square', v: 0.05 * o.v }); },
  sizzle: (o) => { noise(0.4, { freq: 6000, v: 0.1 * o.v, filter: 'highpass' }); },
  good: (o) => { tone(mtof(84), 0.08, { type: 'square', v: 0.06 * o.v }); tone(mtof(91), 0.14, { type: 'square', v: 0.06 * o.v, at: 0.07 }); },
  bad: (o) => { tone(mtof(55), 0.25, { type: 'sawtooth', v: 0.08 * o.v, lp: 900 }); },
  spawn: (o) => { tone(200, 0.4, { type: 'triangle', slide: 700, v: 0.05 * o.v, pan: o.pan }); },
  hiss: (o) => { noise(1.4, { freq: 5200, sweep: 7000, v: 0.12 * o.v, filter: 'highpass', pan: o.pan, attack: 0.3 }); },
  teleport: (o) => { tone(300, 0.25, { type: 'sine', slide: 1800, v: 0.08 * o.v, pan: o.pan }); noise(0.25, { freq: 2500, sweep: 600, v: 0.08 * o.v, pan: o.pan }); },
  splash: (o) => { noise(0.35, { freq: 1200, sweep: 300, v: 0.18 * o.v, pan: o.pan, filter: 'lowpass' }); tone(500, 0.15, { type: 'sine', slide: 200, v: 0.05 * o.v, pan: o.pan }); },
  zap: (o) => { noise(0.18, { freq: 6000, v: 0.2 * o.v, filter: 'highpass', pan: o.pan }); tone(1600, 0.15, { type: 'sawtooth', slide: 200, v: 0.07 * o.v, pan: o.pan }); },
  crack: (o) => { noise(0.05, { freq: 1800, v: 0.2 * o.v, q: 3 }); },
};

export function sfx(name, o = {}) {
  if (!ctx || !SFX[name]) return;
  const now = ctx.currentTime;
  const gap = o.gap ?? 0.03;
  if (last[name] && now - last[name] < gap) return; // rate-limit stacking of the same sound
  last[name] = now;
  SFX[name]({ v: o.v ?? 1, p: o.p ?? 1, pan: o.pan || 0 });
}

// ---------------------------------------------------------------------------
// Ringtone (original melody) + vibration buzz
// ---------------------------------------------------------------------------
let ringTimer = null;
// Ringtones: [notes (midi, null = rest), step seconds, voice]. Callers have a favourite
// and calls sometimes pick another one at random.
export const RINGTONES = {
  classic: [[76, 79, 84, 83, 79, 76, 81, 79, null, null, null, null], 0.15, 'square'],
  kpop: [[81, 81, 84, 81, 88, null, 86, 84, 81, null, 79, 81], 0.13, 'saw'],
  marimba: [[72, 76, 79, 84, 79, 76, 72, null, 74, 77, 81, null], 0.14, 'mallet'],
  chip: [[84, 88, 91, 96, 91, 88, 84, 88, null, null, 79, null], 0.1, 'square'],
  hymn: [[67, 71, 74, 79, null, 76, 74, 71, 72, null, null, null], 0.24, 'organ'],
  meow: [[88, null, 86, null, 91, null, null, null, 84, null, null, null], 0.16, 'meow'],
  royal: [[60, 60, 67, 67, 68, 67, 65, null, 63, 62, 60, null], 0.18, 'brass'],
  baby: [[84, 81, 84, 81, 86, 84, 81, null, 79, 79, 81, null], 0.17, 'mallet'],
  snail: [[83, 83, 83, null, 83, 83, 83, null, null, null, null, null], 0.11, 'puru'],
};
export function startRing(name = 'classic') {
  if (!ctx || ringTimer) return;
  const [notes, step, voice] = RINGTONES[name] || RINGTONES.classic;
  let i = 0;
  const play = () => {
    const t = ctx.currentTime;
    const n = notes[i % notes.length];
    if (n != null) {
      const f = mtof(n + 12);
      if (voice === 'square') tone(f, step * 0.9, { type: 'square', v: 0.06, lp: 5000, bus: phoneBus, t });
      else if (voice === 'saw') { tone(f, step * 0.9, { type: 'sawtooth', v: 0.05, lp: 3500, bus: phoneBus, t }); tone(f * 2, step * 0.5, { type: 'square', v: 0.02, bus: phoneBus, t }); }
      else if (voice === 'mallet') tone(f, step * 1.4, { type: 'sine', v: 0.11, release: step, bus: phoneBus, t });
      else if (voice === 'organ') { tone(f / 2, step, { type: 'triangle', v: 0.08, bus: phoneBus, t }); tone(f, step, { type: 'sine', v: 0.06, bus: phoneBus, t }); }
      else if (voice === 'meow') tone(f, step * 1.6, { type: 'sawtooth', slide: f * 0.7, v: 0.06, lp: 2400, bus: phoneBus, t });
      else if (voice === 'brass') tone(f / 2, step * 0.95, { type: 'sawtooth', v: 0.07, lp: 1600, bus: phoneBus, t });
      else if (voice === 'puru') tone(f, step * 0.7, { type: 'square', slide: f * 1.3, v: 0.05, lp: 3000, bus: phoneBus, t });
    }
    if (i % 6 === 0) tone(58, 0.35, { type: 'sawtooth', v: 0.1, lp: 180, bus: phoneBus, t });
    i++;
  };
  play();
  ringTimer = setInterval(play, step * 1000);
}
export function stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } }

// ---------------------------------------------------------------------------
// Music sequencer
// ---------------------------------------------------------------------------
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
const DRUMS = {
  pop: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', c: '............x...' },
  house: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', c: '....x.......x...' },
  trap: { k: 'x......x..x.....', s: '........x.......', h: 'x.x.x.xxx.x.x.xx', c: '........x.......' },
  half: { k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...', c: '' },
  muzak: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.', c: '' },
  chip: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: '' },
  none: { k: '', s: '', h: '', c: '' },
};
// lead: 32 sixteenths of scale degrees (degree+7 per octave), '.' = rest, '-' = hold
const L = (str) => str.split(' ').map((t) => (t === '.' ? null : t === '-' ? '-' : +t));
const SONGS = {
  title: { bpm: 118, root: 57, scale: 'minor', prog: [0, 5, 2, 6], drums: 'pop', bass: 'pulse', lead: L('7 . 9 . 11 . 9 7 - . 4 . 6 . 7 . 9 . 11 . 12 . 11 9 - . 7 . 6 . 4 .'), pad: 'saw' },
  floor1: { bpm: 124, root: 57, scale: 'minor', prog: [0, 5, 2, 6], drums: 'pop', bass: 'offbeat', lead: L('11 . 11 9 . 7 . 9 . . 7 . 4 . . . 11 . 11 9 . 7 . 12 . 11 . 9 - . . .'), pad: 'pluck' },
  floor2: { bpm: 128, root: 54, scale: 'dorian', prog: [0, 3, 5, 4], drums: 'house', bass: 'octave', lead: L('7 . 8 . 9 . 11 . 9 . 8 . 7 . . . 7 . 8 . 9 . 11 . 12 . 11 . 9 . . .'), pad: 'saw' },
  floor3: { bpm: 140, root: 50, scale: 'phrygian', prog: [0, 1, 0, 6], drums: 'trap', bass: 'sub', lead: L('7 . . 8 . . 7 . 5 . . 4 . . 5 . 7 . . 8 . . 10 . 11 . . 10 . . 8 .'), pad: 'dark' },
  shop: { bpm: 96, root: 60, scale: 'major', prog: [0, 5, 3, 4], drums: 'muzak', bass: 'walk', lead: L('4 . . 2 . . 0 . 2 . 4 . . . . . 5 . . 4 . . 2 . 4 . 2 . 0 . . .'), pad: 'organ' },
  boss1: { bpm: 110, root: 60, scale: 'minor', prog: [0, 5, 6, 4], drums: 'pop', bass: 'offbeat', lead: L('7 . 7 . 9 . 10 . 9 . 7 . 5 . 7 . 7 . 7 . 9 . 10 . 12 . 10 . 9 . 7 .'), pad: 'saw' },
  boss2: { bpm: 136, root: 55, scale: 'minor', prog: [0, 3, 5, 6], drums: 'house', bass: 'octave', lead: L('14 . 12 . 11 . 12 . 9 . 11 . 7 . . . 14 . 12 . 11 . 12 . 16 . 14 . 12 . 11 .'), pad: 'saw' },
  boss3: { bpm: 144, root: 50, scale: 'phrygian', prog: [0, 1, 5, 6], drums: 'trap', bass: 'sub', lead: L('7 8 7 . 5 . 4 . 7 8 7 . 10 . 11 . 12 . 11 10 . 8 . 7 8 7 5 . 4 . 3 .'), pad: 'dark' },
  cookoff: { bpm: 150, root: 65, scale: 'major', prog: [0, 3, 4, 0], drums: 'chip', bass: 'offbeat', lead: L('7 9 11 12 . 11 9 . 7 . 4 . 7 . . . 8 10 11 12 . 14 12 . 11 . 9 . 7 . . .'), pad: 'pluck' },
  nightmare: { bpm: 150, root: 60, scale: 'major', prog: [0, 0, 3, 4], drums: 'chip', bass: 'walk', lead: L('7 7 . 7 . 5 7 . 9 . . . 4 . . . 5 . . 4 . . 2 . . 4 . 6 . 5 4 .'), pad: 'none', chip: true },
  victory: { bpm: 120, root: 60, scale: 'major', prog: [0, 4, 5, 3], drums: 'pop', bass: 'offbeat', lead: L('7 . 9 . 11 . 12 . 14 . 12 . 11 . 9 . 11 . 12 . 14 . 16 . 14 . - . - . . .'), pad: 'saw' },
  gameover: { bpm: 72, root: 57, scale: 'minor', prog: [0, 5, 3, 4], drums: 'none', bass: 'sub', lead: L('7 . . . 6 . . . 4 . . . 2 . . . 3 . . . 2 . . . 0 . . . - . . .'), pad: 'dark' },
};

const seq = { song: null, name: null, step: 0, next: 0, timer: null, intensity: 1, start: 0, bpm: 120 };
let pending = null;

export function playMusic(name, opts = {}) {
  if (!ctx) { pending = { name, opts }; return; }
  if (seq.name === name && !opts.restart) return;
  stopMusic();
  const song = SONGS[name];
  if (!song) return;
  seq.song = song; seq.name = name; seq.step = 0;
  seq.bpm = opts.bpm || song.bpm;
  seq.next = ctx.currentTime + 0.06;
  seq.start = seq.next;
  seq.timer = setInterval(schedule, 25);
}
export function stopMusic() {
  if (seq.timer) clearInterval(seq.timer);
  seq.timer = null; seq.name = null; seq.song = null;
}
export function setIntensity(v) { seq.intensity = v; }
export function setTempo(bpm) {
  if (!ctx || !seq.song) return;
  // keep the beat position continuous
  const pos = beatPos();
  seq.bpm = bpm;
  seq.start = ctx.currentTime - pos * 60 / bpm;
}
export function musicName() { return seq.name; }
export function beatPos() {
  if (!ctx || !seq.song) return null;
  return (ctx.currentTime - seq.start) / (60 / seq.bpm);
}

function schedule() {
  if (!ctx || !seq.song) return;
  const s = seq.song;
  const spb = 60 / seq.bpm / 4;
  while (seq.next < ctx.currentTime + 0.12) {
    playStep(s, seq.step, seq.next, spb);
    seq.step++;
    seq.next += spb;
  }
}

function degree(song, d, oct = 0) {
  const sc = SCALES[song.scale];
  const o = Math.floor(d / 7);
  const i = ((d % 7) + 7) % 7;
  return song.root + sc[i] + 12 * (o + oct);
}

function playStep(s, step, t, spb) {
  const i16 = step % 16;
  const bar = Math.floor(step / 16);
  const chord = s.prog[bar % s.prog.length];
  const inten = seq.intensity;
  const d = DRUMS[s.drums];
  const B = musicBus;
  // Drums
  if (d.k[i16] === 'x' && (inten > 0.25 || i16 % 8 === 0)) { tone(140, 0.18, { type: 'sine', slide: 42, v: 0.5, t, bus: B, release: 0.12 }); }
  if (d.s[i16] === 'x' && inten > 0.3) { noise(0.14, { freq: 1900, v: 0.22, t, bus: B }); tone(190, 0.08, { type: 'triangle', v: 0.1, t, bus: B }); }
  if (d.c && d.c[i16] === 'x' && inten > 0.6) noise(0.1, { freq: 1300, q: 2, v: 0.14, t, bus: B, at: 0.01 });
  if (d.h[i16] === 'x' && inten > 0.45) noise(0.035, { freq: 9000, filter: 'highpass', v: i16 % 4 === 2 ? 0.09 : 0.05, t, bus: B });
  // Bass
  const root = degree(s, chord, -2);
  const bt = s.bass;
  let bnote = null;
  if (bt === 'offbeat' && i16 % 4 === 2) bnote = root;
  else if (bt === 'pulse' && i16 % 2 === 0) bnote = root;
  else if (bt === 'octave' && i16 % 2 === 0) bnote = root + (i16 % 4 === 2 ? 12 : 0);
  else if (bt === 'sub' && (i16 === 0 || i16 === 7 || i16 === 10)) bnote = root - 12;
  else if (bt === 'walk' && i16 % 4 === 0) bnote = degree(s, chord + [0, 2, 4, 2][i16 / 4], -2);
  if (bnote !== null) {
    if (s.chip) tone(mtof(bnote + 12), spb * 1.6, { type: 'triangle', v: 0.16, t, bus: B });
    else tone(mtof(bnote), bt === 'sub' ? spb * 5 : spb * 1.8, { type: bt === 'sub' ? 'sine' : 'sawtooth', v: bt === 'sub' ? 0.32 : 0.16, lp: 520, t, bus: B, release: 0.04 });
  }
  // Pad / chords
  if (s.pad !== 'none') {
    const notes = [0, 2, 4].map((k) => degree(s, chord + k, 0));
    if (s.pad === 'pluck' && (i16 === 0 || i16 === 3 || i16 === 6 || i16 === 10)) notes.forEach((n) => tone(mtof(n), spb * 1.5, { type: 'square', v: 0.035, lp: 2200, t, bus: B }));
    else if ((s.pad === 'saw' || s.pad === 'dark') && i16 === 0) notes.forEach((n, k) => tone(mtof(n - (s.pad === 'dark' ? 12 : 0)), spb * 15, { type: 'sawtooth', v: 0.03, lp: s.pad === 'dark' ? 900 : 1600, detune: (k - 1) * 8, attack: 0.25, release: 0.4, t, bus: B }));
    else if (s.pad === 'organ' && i16 % 4 === 0) notes.forEach((n) => tone(mtof(n), spb * 3, { type: 'sine', v: 0.05, t, bus: B }));
  }
  // Lead
  if (inten > 0.55 || s.chip || seq.name === 'title' || seq.name === 'shop' || seq.name === 'cookoff') {
    const ld = s.lead[step % s.lead.length];
    if (typeof ld === 'number') {
      let len = 1;
      while (s.lead[(step + len) % s.lead.length] === '-' && len < 8) len++;
      tone(mtof(degree(s, ld, 0)), spb * len * 0.95, { type: s.chip ? 'square' : 'square', v: s.chip ? 0.07 : 0.045, lp: s.chip ? 6000 : 3200, t, bus: B, detune: 4 });
    }
  }
}
