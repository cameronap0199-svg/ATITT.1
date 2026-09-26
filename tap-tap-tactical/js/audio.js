// Everything you hear is synthesised with WebAudio: guns, pills, the heart monitor,
// the choir, the Dance Soldier's bassline and a whisper that sounds like her name.

let ctx = null;
let master, sfxBus, musicBus, comp, noiseBuf, shaper;
const vol = { master: 0.8, music: 0.5, sfx: 0.8 };
let voiceOn = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.connect(master).connect(ctx.destination);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(comp);
  musicBus.connect(comp);
  const len = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 6); }
  shaper.curve = curve;
  shaper.connect(musicBus);
  applyVolumes();
  if (pending) playMusic(pending);
}

export function setVolumes(v) { Object.assign(vol, v); applyVolumes(); }
export function setVoice(on) { voiceOn = !!on; if (!on && window.speechSynthesis) speechSynthesis.cancel(); }
function applyVolumes() {
  if (!ctx) return;
  master.gain.value = vol.master;
  sfxBus.gain.value = vol.sfx;
  musicBus.gain.value = vol.music * 0.6;
}

function tone(f, dur, { type = 'sine', v = 0.2, at = 0, attack = 0.004, release = 0.05, slide = null, bus = sfxBus, detune = 0, filter = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.setValueAtTime(v, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  let node = o.connect(g);
  if (filter) {
    const bq = ctx.createBiquadFilter();
    bq.type = filter.type || 'lowpass';
    bq.frequency.value = filter.f;
    bq.Q.value = filter.q || 1;
    node = g.connect(bq);
  }
  node.connect(bus);
  o.start(t);
  o.stop(t + dur + release + 0.02);
}

function noise(dur, { v = 0.3, at = 0, type = 'bandpass', f = 1200, q = 1, slide = null, attack = 0.002, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const bq = ctx.createBiquadFilter();
  bq.type = type;
  bq.frequency.setValueAtTime(f, t);
  if (slide) bq.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
  bq.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bq).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

const boom = (v = 0.5, at = 0, f = 110) => { tone(f, 0.25, { v, at, slide: 32, type: 'sine', release: 0.12 }); noise(0.35, { v: v * 0.7, at, type: 'lowpass', f: 2200, slide: 200 }); };

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'pistol': noise(0.12, { v: 0.45, type: 'bandpass', f: 1900, q: 0.7 }); tone(150, 0.08, { v: 0.35, slide: 50 }); break;
    case 'rifle': noise(0.08, { v: 0.35, type: 'bandpass', f: 2400, q: 0.8 }); tone(120, 0.06, { v: 0.3, slide: 45 }); break;
    case 'shotgun': boom(0.6, 0, 90); noise(0.25, { v: 0.4, type: 'highpass', f: 1500 }); break;
    case 'slapper': boom(0.8, 0, 70); noise(0.05, { v: 0.6, type: 'highpass', f: 3000 }); tone(900, 0.06, { v: 0.15, type: 'square', slide: 300, at: 0.02 }); break;
    case 'cannon': for (let i = 0; i < 4; i++) boom(0.35, i * 0.035, 95); break;
    case 'launcher': tone(220, 0.12, { v: 0.4, slide: 80, type: 'triangle' }); noise(0.1, { v: 0.2, f: 600 }); break;
    case 'needler': tone(1800, 0.05, { v: 0.12, slide: 2600, type: 'triangle' }); noise(0.03, { v: 0.1, f: 5000 }); break;
    case 'railgun': tone(160, 0.18, { v: 0.2, slide: 2600, type: 'sawtooth', filter: { f: 3000 } }); noise(0.4, { v: 0.6, type: 'highpass', f: 800, at: 0.02 }); tone(55, 0.5, { v: 0.4, at: 0.02, slide: 30 }); break;
    case 'explosion': boom(0.7, 0, 70); noise(0.8, { v: 0.4, type: 'lowpass', f: 900, slide: 120, at: 0.03 }); break;
    case 'pop': tone(700, 0.05, { v: 0.12, slide: 200 }); noise(0.08, { v: 0.15, f: 1500 }); break;
    case 'empty': tone(2200, 0.015, { v: 0.2, type: 'square' }); tone(1400, 0.02, { v: 0.12, type: 'square', at: 0.05 }); break;
    case 'swap': noise(0.05, { v: 0.2, f: 3000 }); tone(600, 0.04, { v: 0.1, type: 'square', at: 0.04 }); break;
    case 'ping': tone(2637, 0.25, { v: 0.16, release: 0.3 }); tone(3951, 0.18, { v: 0.1, release: 0.3, detune: 12 }); tone(5274, 0.1, { v: 0.06, at: 0.02 }); break;
    case 'hit': noise(0.07, { v: 0.35, f: 500, q: 1.2 }); tone(180, 0.05, { v: 0.2, slide: 90 }); break;
    case 'headshot': noise(0.08, { v: 0.4, f: 900 }); tone(1200, 0.08, { v: 0.12, type: 'square', slide: 600 }); break;
    case 'kill': tone(90, 0.3, { v: 0.35, slide: 40 }); noise(0.2, { v: 0.2, f: 300 }); break;
    case 'hurt': noise(0.2, { v: 0.6, type: 'lowpass', f: 700 }); tone(70, 0.3, { v: 0.5, slide: 35 }); tone(2400, 0.4, { v: 0.05, type: 'sine', at: 0.05 }); break;
    case 'ricochet': tone(3200, 0.12, { v: 0.1, slide: 900, type: 'triangle' }); noise(0.04, { v: 0.15, f: 4000 }); break;
    case 'enemyShot': noise(0.06, { v: 0.2, f: 1300 }); tone(200, 0.04, { v: 0.1, slide: 80 }); break;
    case 'ddrHit': tone(880, 0.04, { v: 0.12, type: 'square' }); break;
    case 'ddrPerfect': tone(1320, 0.06, { v: 0.12, type: 'triangle' }); tone(1760, 0.08, { v: 0.1, type: 'triangle', at: 0.03 }); break;
    case 'ddrMiss': tone(90, 0.16, { v: 0.25, type: 'sawtooth', filter: { f: 700 } }); noise(0.1, { v: 0.15, f: 250 }); break;
    case 'chamber': noise(0.03, { v: 0.35, f: 3500, q: 3 }); noise(0.05, { v: 0.3, f: 2200, q: 2, at: 0.08 }); tone(300, 0.04, { v: 0.2, at: 0.08, type: 'square' }); break;
    case 'overloadRounds': tone(440, 0.4, { v: 0.12, slide: 1760, type: 'sawtooth', filter: { f: 2400 } }); tone(1760, 0.3, { v: 0.08, at: 0.3 }); break;
    case 'pill': noise(0.06, { v: 0.3, f: 2800, q: 2 }); tone(500, 0.05, { v: 0.1, at: 0.02, slide: 250 }); break;
    case 'inject': noise(0.45, { v: 0.18, type: 'highpass', f: 4000 }); tone(1600, 0.4, { v: 0.05, slide: 900 }); break;
    case 'botch': noise(0.15, { v: 0.3, f: 400 }); tone(110, 0.3, { v: 0.2, type: 'sawtooth', slide: 60, filter: { f: 500 } }); break;
    case 'throw': noise(0.35, { v: 0.2, f: 900, slide: 300 }); break;
    case 'fire': noise(1.2, { v: 0.4, type: 'lowpass', f: 600, attack: 0.05 }); noise(1.2, { v: 0.15, type: 'bandpass', f: 2600, q: 0.5 }); break;
    case 'laserCharge': tone(200, 0.8, { v: 0.12, slide: 1200, type: 'sawtooth', filter: { f: 2000 } }); break;
    case 'laser': tone(1400, 0.9, { v: 0.14, type: 'sawtooth', slide: 700, filter: { f: 3000 } }); tone(1405, 0.9, { v: 0.1, type: 'square', slide: 705 }); break;
    case 'slam': boom(0.9, 0, 60); noise(0.4, { v: 0.3, f: 200 }); break;
    case 'crystal': tone(1975, 0.3, { v: 0.1 }); tone(2960, 0.3, { v: 0.08, at: 0.04 }); tone(3950, 0.3, { v: 0.06, at: 0.08 }); break;
    case 'heartbeat': tone(55, 0.09, { v: 0.35, slide: 40 }); tone(50, 0.1, { v: 0.28, slide: 38, at: 0.18 }); break;
    case 'flatline': tone(980, 2.4, { v: 0.12, type: 'sine', attack: 0.01, release: 0.2 }); break;
    case 'crtOff': tone(15000, 0.6, { v: 0.05, slide: 3000 }); noise(0.15, { v: 0.25, f: 800, at: 0.02 }); break;
    case 'glitch': for (let i = 0; i < 6; i++) tone(200 + Math.random() * 2400, 0.03, { v: 0.07, type: 'square', at: i * 0.035 }); break;
    case 'whisper': whisper(); break;
    case 'ui': tone(1200, 0.03, { v: 0.08, type: 'square' }); break;
    case 'uiConfirm': tone(660, 0.05, { v: 0.1, type: 'square' }); tone(990, 0.08, { v: 0.1, type: 'square', at: 0.05 }); break;
    case 'type': tone(1800 + Math.random() * 400, 0.012, { v: 0.04, type: 'square' }); break;
    case 'door': tone(45, 1.4, { v: 0.4, type: 'sawtooth', filter: { f: 180 }, attack: 0.2 }); noise(1.4, { v: 0.2, type: 'lowpass', f: 300, attack: 0.3 }); break;
    case 'scratch': noise(0.35, { v: 0.5, f: 3000, slide: 300, q: 2 }); noise(0.25, { v: 0.4, f: 400, slide: 2500, q: 2, at: 0.2 }); break;
    case 'gunshotBig': boom(1, 0, 60); noise(0.6, { v: 0.5, type: 'highpass', f: 900 }); break;
    case 'horse': tone(900, 0.6, { v: 0.12, type: 'sawtooth', slide: 500, filter: { f: 1800 } }); tone(700, 0.3, { v: 0.1, type: 'sawtooth', slide: 1100, at: 0.5, filter: { f: 1800 } }); break;
    case 'squeak': tone(2600, 0.06, { v: 0.08, slide: 3400 }); break;
    case 'alarm': for (let i = 0; i < 4; i++) { tone(880, 0.22, { v: 0.12, type: 'square', at: i * 0.5, filter: { f: 2000 } }); tone(660, 0.22, { v: 0.12, type: 'square', at: i * 0.5 + 0.25, filter: { f: 2000 } }); } break;
    case 'shatter': for (let i = 0; i < 10; i++) noise(0.12, { v: 0.2, type: 'highpass', f: 3000 + Math.random() * 5000, at: i * 0.025 }); tone(4000, 0.5, { v: 0.05, slide: 8000 }); break;
    case 'bell': [220, 440 * 1.19, 440 * 1.5, 440 * 2.0, 440 * 2.74].forEach((f, i) => tone(f, 3.5, { v: 0.12 / (i + 1), attack: 0.003, release: 1.5 })); break;
    case 'decrypt': for (let i = 0; i < 8; i++) tone(1000 + Math.random() * 1600, 0.02, { v: 0.05, type: 'square', at: i * 0.05 }); break;
    case 'reward': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { v: 0.1, type: 'triangle', at: i * 0.08 })); break;
    case 'coin': tone(1760, 0.05, { v: 0.1, type: 'square' }); tone(2637, 0.1, { v: 0.08, type: 'square', at: 0.05 }); break;
    case 'wetlaugh': for (let i = 0; i < 5; i++) { tone(180 - i * 12, 0.12, { v: 0.2, type: 'sawtooth', at: i * 0.14, filter: { f: 600, q: 4 } }); noise(0.1, { v: 0.12, f: 350, at: i * 0.14 + 0.02 }); } break;
    case 'splash': noise(0.6, { v: 0.35, type: 'lowpass', f: 1500, slide: 300 }); break;
    case 'hymn': chord([293.7, 370, 440], 1.6, 0.05); break;
    default: break;
  }
}

function chord(fs, dur, v = 0.06, at = 0, bus = sfxBus) {
  for (const f of fs) {
    tone(f, dur, { v, at, type: 'sawtooth', attack: 0.3, release: 0.6, bus, filter: { f: 1100, q: 3 }, detune: -6 });
    tone(f, dur, { v: v * 0.8, at, type: 'sawtooth', attack: 0.3, release: 0.6, bus, filter: { f: 800, q: 4 }, detune: 7 });
  }
}

// Filtered noise shaped into three syllables: la-'a-nah.
function whisper() {
  const syll = [[900, 0.18], [1300, 0.14], [800, 0.3]];
  let at = 0;
  for (const [f, d] of syll) {
    noise(d, { v: 0.22, f, q: 6, at, attack: 0.04 });
    noise(d, { v: 0.12, f: f * 2.3, q: 8, at, attack: 0.04 });
    at += d + 0.03;
  }
}

export function speak(text, { pitch = 1, rate = 1 } = {}) {
  if (!voiceOn || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*[^*]+\*/g, ''));
    u.pitch = pitch;
    u.rate = rate;
    u.volume = vol.master * 0.8;
    speechSynthesis.speak(u);
  } catch { /* speech is optional */ }
}

// ---------------------------------------------------------------------------
// Music: a lookahead step sequencer with a handful of procedural tracks.
// ---------------------------------------------------------------------------
let pending = null;
let track = null;
let timer = null;
let step = 0;
let nextTime = 0;
let tempoMul = 1;

const TRACKS = {
  title: { bpm: 60, steps: 32, fn: titleStep },
  map: { bpm: 90, steps: 32, fn: mapStep },
  combat: { bpm: 96, steps: 64, fn: combatStep },
  boss: { bpm: 128, steps: 64, fn: bossStep },
  dance: { bpm: 172, steps: 32, fn: danceStep },
  calm: { bpm: 70, steps: 32, fn: calmStep },
};

export function playMusic(name) {
  pending = name;
  if (!ctx) return;
  if (track && track.name === name) return;
  stopMusic();
  if (!name || !TRACKS[name]) return;
  track = { name, ...TRACKS[name] };
  step = 0;
  tempoMul = 1;
  nextTime = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}
export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  track = null;
}
export function setTempo(mul) { tempoMul = mul; }

function schedule() {
  if (!ctx || !track) return;
  const spb = 60 / (track.bpm * tempoMul) / 4; // 16th notes
  while (nextTime < ctx.currentTime + 0.12) {
    track.fn(step % track.steps, nextTime - ctx.currentTime, spb);
    step++;
    nextTime += spb;
  }
}

const m = (f, dur, o = {}) => tone(f, dur, { bus: musicBus, ...o });
const mn = (dur, o = {}) => noise(dur, { bus: musicBus, ...o });
const kick = (at, v = 0.5) => m(120, 0.18, { at, v, slide: 40 });
const snare = (at, v = 0.25) => { mn(0.14, { at, v, type: 'highpass', f: 1500 }); m(200, 0.06, { at, v: v * 0.6, type: 'triangle' }); };
const hat = (at, v = 0.07) => mn(0.03, { at, v, type: 'highpass', f: 7000 });
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function titleStep(s, at) {
  if (s === 0) { chordM([50, 57, 62, 65], at, 7); }
  if (s === 16) { chordM([46, 53, 58, 62], at, 7); }
  if (s % 8 === 4) m(hz(86 - (s % 3) * 5), 0.4, { at, v: 0.03, type: 'triangle', release: 0.8 });
  if (s === 24) m(55, 0.1, { at, v: 0.2 });
  if (s === 26) m(50, 0.1, { at, v: 0.16 });
}
function mapStep(s, at) {
  if (s % 16 === 0) m(hz(38), 2.6, { at, v: 0.12, type: 'sawtooth', filter: { f: 220 }, attack: 0.4 });
  if (s % 4 === 2 && Math.random() < 0.5) m(hz(84 + Math.floor(Math.random() * 12)), 0.03, { at, v: 0.035, type: 'square' });
}
function combatStep(s, at, spb) {
  const bar = Math.floor(s / 16);
  const roots = [38, 34, 36, 33];
  if (s % 16 === 0) {
    m(hz(roots[bar] - 12), spb * 16, { at, v: 0.16, type: 'sawtooth', filter: { f: 260, q: 2 }, attack: 0.05 });
    chordM([roots[bar] + 12, roots[bar] + 15, roots[bar] + 19], at, spb * 16, 0.025);
  }
  if (s % 8 === 0) kick(at, 0.35);
  if (s % 8 === 3) kick(at, 0.18);
  if (s % 16 === 12) snare(at, 0.12);
  if (s % 2 === 1) hat(at, 0.035);
  if (s % 4 === 2) m(hz(roots[bar] + 24 + [0, 7, 3, 10][(s / 4) % 4 | 0]), spb * 1.5, { at, v: 0.03, type: 'square', filter: { f: 1800 } });
}
function bossStep(s, at, spb) {
  const bar = Math.floor(s / 16);
  const roots = [38, 38, 34, 37];
  if (s % 16 === 0) chordM([roots[bar] + 12, roots[bar] + 15, roots[bar] + 19, roots[bar] + 24], at, spb * 16, 0.035);
  if (s === 0) m(110, 2, { at, v: 0.1 }) ;
  if (s % 4 === 0) kick(at, 0.45);
  if (s % 8 === 4) snare(at, 0.22);
  hat(at, s % 2 ? 0.03 : 0.06);
  if (s % 2 === 0) m(hz(roots[bar] - 12 + (s % 8 === 6 ? 12 : 0)), spb * 1.6, { at, v: 0.16, type: 'sawtooth', filter: { f: 500, q: 3 } });
  if (s % 32 === 0) [220, 330, 523, 880].forEach((f, i) => m(f, 2.5, { at, v: 0.05 / (i + 1), release: 1 }));
}
function danceStep(s, at, spb) {
  const bass = [38, 38, 50, 38, 41, 38, 50, 43, 38, 38, 50, 38, 45, 43, 41, 40];
  if (s % 4 === 0) kick(at, 0.55);
  if (s % 8 === 4) snare(at, 0.3);
  if (s % 2 === 1) hat(at, 0.08);
  if (ctx) {
    const f = hz(bass[s % 16] - 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const t = ctx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.95);
    o.connect(g).connect(shaper);
    o.start(t);
    o.stop(t + spb);
  }
  if (s % 8 === 2) m(hz(74 + [0, 3, 7, 10][(s / 8) | 0]), spb, { at, v: 0.05, type: 'square', filter: { f: 3000 } });
}
function calmStep(s, at) {
  if (s % 16 === 0) chordM(s === 0 ? [50, 57, 62, 66] : [47, 54, 59, 62], at, 6, 0.03);
  if (s % 4 === 0) m(hz([74, 78, 81, 78, 76, 74, 73, 69][(s / 4) % 8 | 0]), 0.6, { at, v: 0.035, type: 'triangle', release: 0.9 });
}
function chordM(notes, at, dur, v = 0.035) {
  for (const n of notes) {
    m(hz(n), dur, { at, v, type: 'sawtooth', attack: 0.6, release: 1.2, filter: { f: 900, q: 5 }, detune: -8 });
    m(hz(n), dur, { at, v: v * 0.7, type: 'sawtooth', attack: 0.6, release: 1.2, filter: { f: 1300, q: 6 }, detune: 9 });
  }
}
