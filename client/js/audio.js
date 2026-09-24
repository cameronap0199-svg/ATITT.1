// Procedural audio: chiptune-flavoured SFX and a tiny step-sequencer for BGM.
// Everything is synthesised with WebAudio — no audio files needed.

let ctx = null;
let master, sfxBus, musicBus;
const vol = { music: 0.35, sfx: 0.6, muted: false };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.connect(master);
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(comp);
  musicBus.connect(comp);
  applyVolumes();
  if (pendingTrack) playMusic(pendingTrack);
}
export function setVolumes(v) { Object.assign(vol, v); applyVolumes(); }
export function getVolumes() { return { ...vol }; }
function applyVolumes() {
  if (!ctx) return;
  master.gain.value = vol.muted ? 0 : 1;
  sfxBus.gain.value = vol.sfx;
  musicBus.gain.value = vol.music * 0.55;
}

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function freq(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const semis = NOTE[m[1]] + (+m[2] + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

function tone(f, dur, { type = 'square', v = 0.15, at = 0, attack = 0.005, release = 0.06, slide = null, bus = sfxBus, detune = 0, vibrato = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq(f), t);
  if (detune) o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq(slide)), t + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t); lfo.stop(t + dur + release);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.setValueAtTime(v, t + Math.max(attack, dur - 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + release + 0.02);
}
let noiseBuf = null;
function noise(dur, { v = 0.2, at = 0, filter = 'highpass', f = 1000, f2 = null, q = 1, bus = sfxBus, release = 0.05 } = {}) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = ctx.createBiquadFilter();
  fl.type = filter;
  fl.frequency.setValueAtTime(f, t);
  fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  src.connect(fl).connect(g).connect(bus);
  src.start(t);
  src.stop(t + dur + release + 0.02);
}
const arp = (notes, step, opts = {}) => notes.forEach((n, i) => tone(n, opts.dur || step * 0.9, { ...opts, at: (opts.at || 0) + i * step }));

const SFX = {
  cursor: () => tone('A5', 0.03, { v: 0.05 }),
  hover: () => tone('E6', 0.02, { v: 0.025, type: 'triangle' }),
  confirm: () => { tone('E5', 0.05, { v: 0.09 }); tone('B5', 0.08, { v: 0.09, at: 0.05 }); },
  cancel: () => { tone('E5', 0.05, { v: 0.08 }); tone('A4', 0.08, { v: 0.08, at: 0.05 }); },
  open: () => tone('C5', 0.12, { type: 'triangle', v: 0.12, slide: 'G5' }),
  error: () => { tone(160, 0.12, { v: 0.1 }); tone(150, 0.12, { v: 0.1, at: 0.13 }); },
  card: () => noise(0.12, { v: 0.18, filter: 'bandpass', f: 4000, f2: 1500, q: 0.8 }),
  flip: () => { noise(0.08, { v: 0.15, filter: 'highpass', f: 3000 }); tone('C6', 0.05, { type: 'sine', v: 0.08, at: 0.03 }); },
  select: () => { tone('G5', 0.04, { v: 0.07, type: 'triangle' }); tone('D6', 0.06, { v: 0.07, type: 'triangle', at: 0.04 }); },
  play: () => { noise(0.18, { v: 0.2, filter: 'bandpass', f: 2500, f2: 600 }); arp(['G5', 'B5', 'D6'], 0.05, { type: 'triangle', v: 0.1, at: 0.08 }); },
  step: () => tone('C4', 0.025, { type: 'triangle', v: 0.05, slide: 'G3' }),
  move: () => noise(0.15, { v: 0.08, filter: 'lowpass', f: 900, f2: 300 }),
  swing: () => noise(0.14, { v: 0.2, filter: 'bandpass', f: 1200, f2: 4000, q: 1.2 }),
  hit: () => { noise(0.12, { v: 0.35, filter: 'lowpass', f: 2400, f2: 400 }); tone(140, 0.14, { type: 'sine', v: 0.4, slide: 50 }); },
  crit: () => { noise(0.2, { v: 0.4, filter: 'lowpass', f: 5000, f2: 300 }); tone(180, 0.25, { type: 'square', v: 0.2, slide: 40 }); tone('C6', 0.1, { v: 0.08, at: 0.02 }); },
  block: () => { tone('A5', 0.05, { type: 'triangle', v: 0.12 }); tone('E6', 0.12, { type: 'triangle', v: 0.1, at: 0.04 }); },
  shoot: () => { noise(0.1, { v: 0.12, filter: 'highpass', f: 2000 }); tone('E6', 0.12, { type: 'square', v: 0.05, slide: 'E5' }); },
  heal: () => arp(['C6', 'E6', 'G6', 'C7'], 0.06, { type: 'sine', v: 0.09 }),
  mana: () => arp(['A5', 'E6', 'A6'], 0.05, { type: 'sine', v: 0.07 }),
  buff: () => arp(['D5', 'F#5', 'A5', 'D6'], 0.045, { type: 'triangle', v: 0.08 }),
  debuff: () => arp(['A5', 'F5', 'D5', 'A4'], 0.05, { type: 'square', v: 0.05 }),
  ability: () => { tone('C5', 0.35, { type: 'sine', v: 0.1, slide: 'C6', vibrato: 12 }); noise(0.3, { v: 0.06, filter: 'highpass', f: 6000 }); },
  summon: () => { arp(['G4', 'C5', 'E5', 'G5', 'C6'], 0.06, { type: 'triangle', v: 0.1 }); noise(0.5, { v: 0.07, filter: 'highpass', f: 5000, at: 0.1 }); },
  defeat: () => { tone('A4', 0.4, { type: 'square', v: 0.1, slide: 'A2' }); noise(0.35, { v: 0.15, filter: 'lowpass', f: 1200, f2: 200 }); },
  build: () => { tone(90, 0.3, { type: 'sine', v: 0.3, slide: 60 }); noise(0.25, { v: 0.12, filter: 'lowpass', f: 700 }); arp(['C5', 'G5'], 0.1, { type: 'triangle', v: 0.08, at: 0.2 }); },
  crumble: () => { noise(0.9, { v: 0.35, filter: 'lowpass', f: 900, f2: 120 }); tone(70, 0.8, { type: 'sine', v: 0.35, slide: 35 }); },
  zone: () => { noise(0.4, { v: 0.1, filter: 'bandpass', f: 800, f2: 3000 }); arp(['F5', 'A5', 'C6'], 0.07, { type: 'sine', v: 0.08 }); },
  turn: () => arp(['C5', 'E5', 'G5', 'C6'], 0.07, { type: 'square', v: 0.07, dur: 0.1 }),
  enemyTurn: () => arp(['A4', 'C5', 'E5', 'D#5'], 0.07, { type: 'square', v: 0.06, dur: 0.1 }),
  renown: () => { tone('E6', 0.08, { type: 'triangle', v: 0.1 }); tone('B6', 0.2, { type: 'triangle', v: 0.1, at: 0.07 }); },
  coin: () => { tone('B5', 0.06, { v: 0.1 }); tone('E6', 0.25, { v: 0.1, at: 0.06 }); },
  tear: () => noise(0.45, { v: 0.25, filter: 'bandpass', f: 800, f2: 6000, q: 0.7 }),
  whoosh: () => noise(0.35, { v: 0.15, filter: 'bandpass', f: 400, f2: 3000 }),
  fanfare: () => { arp(['C5', 'C5', 'C5', 'C5'], 0.11, { v: 0.1, dur: 0.08 }); arp(['Ab4', 'Bb4', 'C5'], 0.15, { v: 0.1, at: 0.5 }); tone('C5', 0.5, { v: 0.1, at: 0.95 }); tone('E5', 0.5, { v: 0.08, at: 0.95 }); tone('G5', 0.5, { v: 0.08, at: 0.95 }); },
  lose: () => { arp(['G4', 'F4', 'Eb4', 'D4'], 0.22, { type: 'triangle', v: 0.12, dur: 0.2 }); tone('C4', 0.8, { type: 'triangle', v: 0.12, at: 0.9 }); },
  reveal0: () => tone('C6', 0.1, { type: 'triangle', v: 0.08 }),
  reveal1: () => arp(['C6', 'E6'], 0.06, { type: 'triangle', v: 0.09 }),
  reveal2: () => arp(['C6', 'E6', 'G6'], 0.06, { type: 'triangle', v: 0.1 }),
  reveal3: () => { arp(['C6', 'E6', 'G6', 'C7'], 0.06, { type: 'square', v: 0.07 }); noise(0.4, { v: 0.06, filter: 'highpass', f: 7000, at: 0.1 }); },
  reveal4: () => { arp(['E6', 'G#6', 'B6', 'E7', 'B6', 'E7'], 0.05, { type: 'sine', v: 0.1 }); noise(0.6, { v: 0.08, filter: 'highpass', f: 8000 }); },
  reveal5: () => { tone(60, 0.8, { type: 'sawtooth', v: 0.15, slide: 30 }); arp(['A3', 'C4', 'D#4', 'F#4', 'A4'], 0.08, { type: 'sawtooth', v: 0.06 }); noise(0.8, { v: 0.12, filter: 'lowpass', f: 600 }); },
  reveal6: () => { arp(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7', 'E7'], 0.05, { type: 'triangle', v: 0.1 }); arp(['G6', 'C7', 'E7', 'G7'], 0.12, { type: 'sine', v: 0.08, at: 0.45 }); noise(1.2, { v: 0.08, filter: 'highpass', f: 7000 }); },
};

export function sfx(name) {
  if (!ctx || vol.muted) return;
  const f = SFX[name];
  if (f) try { f(); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Music sequencer
// ---------------------------------------------------------------------------
// Each track: bpm, chords (bass roots + triad per bar), melody tokens per 8th note.
const TRACKS = {
  title: {
    bpm: 84, swing: 0,
    chords: [['A2', 'A3', 'C4', 'E4'], ['F2', 'F3', 'A3', 'C4'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'G3', 'B3', 'D4'],
      ['A2', 'A3', 'C4', 'E4'], ['F2', 'F3', 'A3', 'C4'], ['D3', 'F3', 'A3', 'D4'], ['E2', 'E3', 'G#3', 'B3']],
    melody: 'E5 - - D5 C5 - B4 C5 | A4 - - - - - E4 - | C5 - - B4 C5 - D5 E5 | D5 - - - B4 - - - | E5 - - F5 E5 - D5 C5 | A5 - - G5 F5 - E5 - | D5 - E5 F5 E5 - D5 C5 | B4 - - - G#4 - - - ',
    drums: 'k . . . s . . . | k . . . s . . k',
    arp: true, lead: 'triangle',
  },
  menu: {
    bpm: 104,
    chords: [['C3', 'C4', 'E4', 'G4'], ['A2', 'A3', 'C4', 'E4'], ['F2', 'F3', 'A3', 'C4'], ['G2', 'G3', 'B3', 'D4']],
    melody: 'E5 . G5 . C6 - B5 A5 | G5 - E5 . C5 . D5 E5 | F5 . A5 . C6 - A5 F5 | G5 - - . D5 . E5 F5 | E5 . G5 . C6 - D6 C6 | B5 - A5 . G5 . E5 . | F5 . E5 . D5 . C5 . | D5 - - - - . . . ',
    drums: 'k . h . s . h . | k . h k s . h h',
    arp: true, lead: 'square',
  },
  shop: {
    bpm: 116,
    chords: [['F2', 'F3', 'A3', 'C4'], ['C3', 'C4', 'E4', 'G4'], ['D3', 'D4', 'F4', 'A4'], ['Bb2', 'Bb3', 'D4', 'F4']],
    melody: 'A5 . C6 . A5 . F5 . | G5 . E5 . C5 - - . | D5 . F5 . A5 . D6 . | C6 - Bb5 . A5 . G5 . | A5 . C6 . F6 - E6 D6 | C6 . G5 . E5 . C5 . | D5 E5 F5 . A5 . D6 . | C6 - - - . . . . ',
    drums: 'k . s . k k s . | k . s . k . s h',
    arp: false, lead: 'square',
  },
  battle: {
    bpm: 148,
    chords: [['A2', 'A3', 'C4', 'E4'], ['G2', 'G3', 'B3', 'D4'], ['F2', 'F3', 'A3', 'C4'], ['E2', 'E3', 'G#3', 'B3']],
    melody: 'A5 - E5 A5 C6 - B5 A5 | G5 - D5 G5 B5 - A5 G5 | F5 - C5 F5 A5 - G5 F5 | E5 - B4 E5 G#5 - - - | A5 - C6 - E6 - D6 C6 | B5 - D6 - G5 - - B5 | A5 G5 F5 E5 F5 G5 A5 C6 | B5 - G#5 - E5 - - - ',
    drums: 'k h s h k k s h | k h s h k h s s',
    bassEighths: true, arp: true, lead: 'square',
  },
  boss: {
    bpm: 160,
    chords: [['D3', 'D4', 'F4', 'A4'], ['Bb2', 'Bb3', 'D4', 'F4'], ['C3', 'C4', 'E4', 'G4'], ['A2', 'A3', 'C#4', 'E4']],
    melody: 'D6 - A5 - F5 - D5 E5 | F5 - G5 - A5 - Bb5 A5 | G5 - E5 - C5 - E5 G5 | A5 - - - C#6 - E6 - | D6 - F6 - E6 - D6 C6 | Bb5 - A5 - G5 - F5 E5 | F5 - G5 - E5 - C5 - | A5 - C#6 - E6 - A6 - ',
    drums: 'k h s k k h s h | k k s h k h s s',
    bassEighths: true, arp: true, lead: 'sawtooth',
  },
  victory: {
    bpm: 132, once: true,
    chords: [['C3', 'C4', 'E4', 'G4'], ['F2', 'F3', 'A3', 'C4'], ['G2', 'G3', 'B3', 'D4'], ['C3', 'C4', 'E4', 'G4']],
    melody: 'C6 . C6 . C6 . G5 A5 | C6 - A5 . C6 . F6 - | D6 . C6 . B5 . G5 . | C6 - - - - - - - ',
    drums: 'k . s . k . s . | k . s . k k s s',
    arp: true, lead: 'square',
  },
};

let music = null;
let pendingTrack = null;
export function playMusic(name) {
  pendingTrack = name;
  if (!ctx) return;
  if (music && music.name === name) return;
  stopMusic();
  const tr = TRACKS[name];
  if (!tr) return;
  const melody = tr.melody.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  const drums = tr.drums.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  const step = 60 / tr.bpm / 2; // eighth notes
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(musicBus);
  gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
  const m = { name, i: 0, next: ctx.currentTime + 0.1, gain, timer: null };
  const barLen = 8;
  const schedule = () => {
    while (m.next < ctx.currentTime + 0.25) {
      const i = m.i;
      const t = m.next - ctx.currentTime;
      const bar = Math.floor(i / barLen) % tr.chords.length;
      const chord = tr.chords[bar];
      const pos = i % barLen;
      // bass
      if (tr.bassEighths) tone(chord[0], step * 0.8, { type: 'triangle', v: 0.22, at: t, bus: gain, release: 0.03 });
      else if (pos === 0 || pos === 4) tone(chord[0], step * 3.6, { type: 'triangle', v: 0.24, at: t, bus: gain });
      // arpeggio
      if (tr.arp) tone(chord[1 + (pos % 3)], step * 0.5, { type: 'square', v: 0.028, at: t, bus: gain, release: 0.02 });
      else if (pos % 2 === 0) { tone(chord[1], step * 0.6, { type: 'square', v: 0.025, at: t, bus: gain }); tone(chord[2], step * 0.6, { type: 'square', v: 0.025, at: t, bus: gain }); }
      // melody
      const tok = melody[i % melody.length];
      if (tok && tok !== '-' && tok !== '.') {
        let len = 1;
        while (melody[(i + len) % melody.length] === '-' && len < 8) len++;
        tone(tok, step * len * 0.92, { type: tr.lead, v: tr.lead === 'triangle' ? 0.13 : 0.06, at: t, bus: gain, vibrato: len > 2 ? 4 : 0, release: 0.08 });
      }
      // drums
      const d = drums[i % drums.length];
      if (d === 'k') { tone(150, 0.08, { type: 'sine', v: 0.35, slide: 45, at: t, bus: gain }); }
      else if (d === 's') noise(0.07, { v: 0.12, filter: 'bandpass', f: 1800, at: t, bus: gain });
      else if (d === 'h') noise(0.025, { v: 0.05, filter: 'highpass', f: 7000, at: t, bus: gain });
      m.i++;
      m.next += step;
      if (tr.once && m.i >= melody.length) { stopMusic(); return; }
    }
  };
  m.timer = setInterval(schedule, 40);
  schedule();
  music = m;
}
export function stopMusic() {
  if (!music) return;
  clearInterval(music.timer);
  const g = music.gain;
  try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5); } catch { /* ignore */ }
  setTimeout(() => g.disconnect(), 700);
  music = null;
}
export function currentTrack() { return music ? music.name : pendingTrack; }
