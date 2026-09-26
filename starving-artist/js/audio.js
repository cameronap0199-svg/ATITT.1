// Procedural WebAudio: music beds (dream pads + music box, lo-fi memory keys, horror
// drones), ambience loops, positional sound effects. No audio files.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.7, sfx: 0.9 };
    this.mood = 'none';
    this.corrupt = 0;
    this.beds = {};
    this.ambient = new Map();
    this.blips = true;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.comp.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.comp);
    this.sfx = ctx.createGain(); this.sfx.connect(this.comp);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._impulse(3.2, 2.6);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.9;
    this.reverb.connect(this.revGain); this.revGain.connect(this.comp);
    this.noiseBuf = this._noise(2);
    this.applyVolumes();
    this._tick = setInterval(() => this._schedule(), 90);
    this.setMood(this._pendingMood || 'title');
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }
  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }

  _impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  _noise(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ------------------------------------------------------------ music
  setMood(mood, corrupt = this.corrupt) {
    this.corrupt = corrupt;
    if (!this.ctx) { this._pendingMood = mood; return; }
    if (mood === this.mood && this.bedGain) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (this.bedGain) { const old = this.bedGain; old.gain.setTargetAtTime(0, t, 0.8); setTimeout(() => old.disconnect(), 4000); }
    for (const o of this.bedOsc || []) { try { o.stop(t + 4); } catch { /* already stopped */ } }
    this.bedOsc = [];
    this.mood = mood;
    const g = this.bedGain = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, t, 1.2);
    const lp = this.bedLP = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(g); g.connect(this.music);
    const send = ctx.createGain(); send.gain.value = 0.5; g.connect(send); send.connect(this.reverb);
    this.nextNote = t + 0.3; this.step = 0; this.chordAt = t + 0.2; this.chordIdx = 0;
    if (mood === 'horror' || mood === 'void' || mood === 'chase') this._drone(mood);
  }

  _drone(mood) {
    const ctx = this.ctx;
    const base = mood === 'void' ? 36.7 : 41.2;
    const oscs = [];
    for (const [f, type, gv] of [[base, 'sawtooth', 0.12], [base * 1.007, 'sawtooth', 0.1], [base * 1.5 * 0.994, 'triangle', 0.06], [base * 2.12, 'sine', 0.04]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = gv;
      o.connect(og); og.connect(this.bedLP); o.start(); oscs.push(o);
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = mood === 'chase' ? 500 : 260;
    lfo.connect(lg); lg.connect(this.bedLP.frequency); lfo.start(); oscs.push(lfo);
    this.bedLP.frequency.value = mood === 'chase' ? 700 : 420;
    this.bedOsc = oscs;
  }

  _schedule() {
    if (!this.ctx || !this.bedGain) return;
    const ctx = this.ctx, now = ctx.currentTime, ahead = now + 0.35;
    const m = this.mood;
    if (m === 'venue' || m === 'title' || m === 'memory' || m === 'ending') {
      const progs = {
        venue: [[60, 64, 67, 71], [57, 60, 64, 67, 74], [53, 57, 60, 64], [55, 59, 62, 69]],
        title: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]],
        memory: [[62, 65, 69, 72], [58, 62, 65, 69], [60, 64, 67, 70], [57, 60, 64, 67]],
        ending: [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 67]],
      }[m];
      const chordLen = m === 'memory' ? 4.2 : 6.4;
      while (this.chordAt < ahead) {
        const ch = progs[this.chordIdx % progs.length];
        this._pad(ch, this.chordAt, chordLen * 1.1, m === 'memory' ? 'epiano' : 'pad');
        this.chordAt += chordLen; this.chordIdx++;
      }
      const scale = [72, 74, 76, 79, 81, 84, 86, 88];
      const lull = [76, 74, 72, 74, 76, 76, 76, null, 74, 74, 74, null, 76, 79, 79, null, 76, 74, 72, 74, 76, 76, 76, 76, 74, 74, 76, 74, 72, null, null, null];
      while (this.nextNote < ahead) {
        let n = null, dt;
        if (m === 'title' || m === 'ending') { n = lull[this.step % lull.length]; dt = 0.52; }
        else if (m === 'memory') { if (Math.random() < 0.35) n = scale[Math.floor(Math.random() * 5)] - 12; dt = 0.6; }
        else { if (Math.random() < 0.55) n = scale[Math.floor(Math.random() * scale.length)]; dt = 0.45 + Math.random() * 0.9; }
        if (n !== null) {
          let nn = n;
          if (this.corrupt > 0 && Math.random() < this.corrupt * 0.35) nn += [1, -1, 6, -6][Math.floor(Math.random() * 4)];
          this._musicBox(NOTE(nn), this.nextNote, m === 'memory' ? 0.07 : 0.1);
        }
        this.nextNote += dt * (1 + this.corrupt * 0.4); this.step++;
      }
    } else if (m === 'horror' || m === 'void' || m === 'chase') {
      while (this.nextNote < ahead) {
        if (Math.random() < (m === 'chase' ? 0.5 : 0.22)) {
          const base = [61, 62, 66, 67, 73, 74][Math.floor(Math.random() * 6)] + (m === 'void' ? 12 : 0);
          this._musicBox(NOTE(base) * (1 + (Math.random() - 0.5) * 0.02 * (1 + this.corrupt * 3)), this.nextNote, 0.05, 3.5);
        }
        this.nextNote += m === 'chase' ? 0.25 : 1.2 + Math.random() * 2;
      }
    }
  }

  _pad(notes, t, dur, kind) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    const peak = kind === 'epiano' ? 0.07 : 0.045;
    g.gain.linearRampToValueAtTime(peak, t + (kind === 'epiano' ? 0.02 : 1.6));
    g.gain.setTargetAtTime(0, t + dur - (kind === 'epiano' ? 3 : 1.5), 0.7);
    g.connect(this.bedLP);
    for (const n of notes) {
      for (const det of kind === 'epiano' ? [0] : [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = kind === 'epiano' ? 'sine' : 'triangle';
        o.frequency.value = NOTE(n - (kind === 'pad' ? 12 : 0));
        o.detune.value = det + (this.corrupt ? Math.sin(t) * 30 * this.corrupt : 0);
        if (this.corrupt > 0.2) { o.detune.setValueAtTime(o.detune.value, t); o.detune.linearRampToValueAtTime(o.detune.value - 40 * this.corrupt, t + dur); }
        o.connect(g); o.start(t); o.stop(t + dur + 2);
        if (kind === 'epiano') {
          const trem = ctx.createOscillator(); trem.frequency.value = 4.5;
          const tg = ctx.createGain(); tg.gain.value = 0.015; trem.connect(tg); tg.connect(g.gain); trem.start(t); trem.stop(t + dur + 2);
        }
      }
    }
  }

  _musicBox(freq, t, vol = 0.1, decay = 1.6) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 3.01;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(this.bedGain || this.music);
    if (this.corrupt > 0.3) { o.detune.setValueAtTime(0, t); o.detune.linearRampToValueAtTime(-30 * this.corrupt, t + decay); }
    o.start(t); o2.start(t); o.stop(t + decay + 0.1); o2.stop(t + decay + 0.1);
  }

  // ------------------------------------------------------------ ambience loops
  setAmbient(names) {
    if (!this.ctx) return;
    const want = new Set(names);
    for (const [k, node] of this.ambient) if (!want.has(k)) { node.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6); setTimeout(() => node.stop(), 3000); this.ambient.delete(k); }
    for (const k of want) if (!this.ambient.has(k)) this.ambient.set(k, this._loop(k));
  }
  _loop(kind) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain(); g.gain.value = 0;
    const extra = [];
    let vol = 0.1;
    if (kind === 'rain') { f.type = 'highpass'; f.frequency.value = 900; vol = 0.09; }
    else if (kind === 'crackle') { f.type = 'highpass'; f.frequency.value = 3000; vol = 0.012; }
    else if (kind === 'hum') {
      f.type = 'lowpass'; f.frequency.value = 200; vol = 0.02;
      const o = ctx.createOscillator(); o.frequency.value = 60; o.type = 'sawtooth';
      const og = ctx.createGain(); og.gain.value = 0.012; o.connect(og); og.connect(this.sfx); o.start(); extra.push(o, og);
    } else if (kind === 'water') {
      f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8; vol = 0.05;
      const l = ctx.createOscillator(); l.frequency.value = 0.3; const lg = ctx.createGain(); lg.gain.value = 250; l.connect(lg); lg.connect(f.frequency); l.start(); extra.push(l);
    } else if (kind === 'murmur') {
      f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 2.5; vol = 0.08;
      const l = ctx.createOscillator(); l.frequency.value = 3.1; const lg = ctx.createGain(); lg.gain.value = 180; l.connect(lg); lg.connect(f.frequency); l.start(); extra.push(l);
    } else if (kind === 'wind') {
      f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 3; vol = 0.06;
      const l = ctx.createOscillator(); l.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = 200; l.connect(lg); lg.connect(f.frequency); l.start(); extra.push(l);
    } else if (kind === 'room') { f.type = 'lowpass'; f.frequency.value = 180; vol = 0.05; }
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start();
    g.gain.setTargetAtTime(vol, t, 1);
    let crackT = null;
    if (kind === 'crackle') crackT = setInterval(() => { if (Math.random() < 0.6) this._tick2(0.02 + Math.random() * 0.03); }, 140);
    return { g, stop: () => { try { src.stop(); } catch { /* */ } extra.forEach((e) => { try { e.stop && e.stop(); e.disconnect(); } catch { /* */ } }); if (crackT) clearInterval(crackT); } };
  }
  _tick2(v) {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
    s.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.02);
  }

  // ------------------------------------------------------------ positional helpers
  setListener(pos, fwd) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  }
  _out(pos) {
    if (!pos) return this.sfx;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.3; p.maxDistance = 60;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.5; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y ?? 1.5, pos.z);
    p.connect(this.sfx);
    return p;
  }

  _env(node, t, a, peak, d, out) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g); g.connect(out);
    return g;
  }
  _noiseHit({ t = this.ctx.currentTime, type = 'lowpass', freq = 800, q = 1, a = 0.005, peak = 0.3, d = 0.15, pos = null, rev = 0 } = {}) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f);
    const out = this._out(pos);
    const g = this._env(f, t, a, peak, d, out);
    if (rev) { const rg = this.ctx.createGain(); rg.gain.value = rev; g.connect(rg); rg.connect(this.reverb); }
    s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
    return f;
  }
  _tone({ t = this.ctx.currentTime, freq = 440, type = 'sine', a = 0.005, peak = 0.2, d = 0.3, pos = null, slide = 0, rev = 0 } = {}) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + a + d);
    const out = this._out(pos);
    const g = this._env(o, t, a, peak, d, out);
    if (rev) { const rg = this.ctx.createGain(); rg.gain.value = rev; g.connect(rg); rg.connect(this.reverb); }
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }

  // ------------------------------------------------------------ sfx
  play(name, opts = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const pos = opts.pos || null;
    switch (name) {
      case 'step': {
        const surf = opts.surface || 'hard';
        const freq = { hard: 1400, carpet: 500, grass: 2600, wood: 900, water: 1800, tile: 1900 }[surf] || 1200;
        this._noiseHit({ type: 'bandpass', freq: freq * (0.85 + Math.random() * 0.3), q: 1.2, peak: (surf === 'carpet' ? 0.08 : 0.12) * (opts.vol || 1), d: 0.09, rev: 0.15 });
        if (surf === 'water') this._tone({ freq: 300 + Math.random() * 200, slide: 2, peak: 0.03, d: 0.08 });
        break;
      }
      case 'click': this._tone({ freq: 880, type: 'square', peak: 0.03, d: 0.04 }); break;
      case 'hover': this._tone({ freq: 1320, type: 'sine', peak: 0.02, d: 0.05 }); break;
      case 'back': this._tone({ freq: 520, type: 'triangle', peak: 0.05, d: 0.08, slide: 0.7 }); break;
      case 'blip': this._tone({ freq: opts.freq || 600, type: 'square', peak: 0.012, d: 0.03 }); break;
      case 'chime': [0, 4, 7, 12].forEach((n, i) => this._tone({ t: t + i * 0.07, freq: NOTE(79 + n), peak: 0.06, d: 0.8, rev: 0.6 })); break;
      case 'choose': [0, 7].forEach((n, i) => this._tone({ t: t + i * 0.06, freq: NOTE(72 + n), type: 'triangle', peak: 0.07, d: 0.5, rev: 0.5 })); break;
      case 'unchoose': this._tone({ freq: NOTE(67), type: 'triangle', peak: 0.05, d: 0.3, slide: 0.8 }); break;
      case 'inspire': [0, 5, 9, 14].forEach((n, i) => this._tone({ t: t + i * 0.09, freq: NOTE(84 + n - Math.round(this.corrupt * 2)), peak: 0.035, d: 1.4, rev: 1 })); break;
      case 'place': this._noiseHit({ type: 'lowpass', freq: 700, peak: 0.18, d: 0.12 }); this._tone({ freq: 180, slide: 0.6, peak: 0.08, d: 0.1 }); break;
      case 'brush': this._noiseHit({ type: 'bandpass', freq: 2400, q: 0.6, peak: 0.03, d: 0.06 }); break;
      case 'remove': this._noiseHit({ type: 'highpass', freq: 1500, peak: 0.08, d: 0.15 }); break;
      case 'door': this._noiseHit({ type: 'lowpass', freq: 300, peak: 0.25, d: 0.5, pos, rev: 0.3 }); this._tone({ freq: 90, slide: 0.7, peak: 0.12, d: 0.4, pos }); break;
      case 'locked': this._noiseHit({ type: 'bandpass', freq: 1800, q: 4, peak: 0.12, d: 0.06, pos }); this._noiseHit({ t: t + 0.1, type: 'bandpass', freq: 1500, q: 4, peak: 0.1, d: 0.06, pos }); break;
      case 'knock': [0, 0.22, 0.44].forEach((d) => this._noiseHit({ t: t + d, type: 'lowpass', freq: 380, peak: 0.35, d: 0.12, pos, rev: 0.4 })); break;
      case 'gate': {
        const f = this._noiseHit({ type: 'lowpass', freq: 200, peak: 0.25, a: 0.3, d: 2.2, pos, rev: 0.6 });
        f.frequency.linearRampToValueAtTime(600, t + 2.4);
        this._tone({ freq: 55, type: 'sawtooth', peak: 0.06, a: 0.3, d: 2, pos });
        break;
      }
      case 'phone': [0, 0.45].forEach((d) => { this._tone({ t: t + d, freq: 440, type: 'square', peak: 0.03, a: 0.01, d: 0.38, pos }); this._tone({ t: t + d, freq: 480, type: 'square', peak: 0.03, a: 0.01, d: 0.38, pos }); }); break;
      case 'ding': this._tone({ freq: 1568, peak: 0.08, d: 1.2, rev: 0.5, pos }); break;
      case 'pickup': [0, 5, 9].forEach((n, i) => this._tone({ t: t + i * 0.06, freq: NOTE(76 + n), type: 'triangle', peak: 0.06, d: 0.4, rev: 0.4 })); break;
      case 'heartbeat': {
        const v = opts.vol ?? 0.4;
        this._tone({ freq: 60, slide: 0.6, peak: v, d: 0.14 });
        this._tone({ t: t + 0.18, freq: 52, slide: 0.6, peak: v * 0.75, d: 0.16 });
        break;
      }
      case 'stinger': {
        const v = opts.vol ?? 1;
        [49, 50, 55, 56, 61].forEach((n) => this._tone({ freq: NOTE(n + 12), type: 'sawtooth', a: 0.01, peak: 0.05 * v, d: 1.8, rev: 0.8 }));
        this._noiseHit({ type: 'highpass', freq: 3000, a: 0.01, peak: 0.25 * v, d: 1.2, rev: 0.6 });
        this._tone({ freq: 80, slide: 0.5, peak: 0.35 * v, d: 1 });
        break;
      }
      case 'whisper': {
        const f = this._noiseHit({ type: 'bandpass', freq: 1800, q: 6, a: 0.3, peak: 0.12 * (opts.vol || 1), d: 1.4, pos, rev: 0.8 });
        for (let i = 0; i < 6; i++) f.frequency.setValueAtTime(900 + Math.random() * 2400, t + i * 0.22);
        break;
      }
      case 'drip': this._tone({ freq: 1200 + Math.random() * 600, slide: 2.2, peak: 0.05, d: 0.08, pos, rev: 0.7 }); break;
      case 'static': this._noiseHit({ type: 'highpass', freq: 2500, a: 0.01, peak: 0.25 * (opts.vol || 1), d: opts.dur || 0.6 }); break;
      case 'scrape': {
        const f = this._noiseHit({ type: 'bandpass', freq: 600, q: 8, a: 0.2, peak: 0.3, d: 1.1, pos, rev: 0.5 });
        f.frequency.linearRampToValueAtTime(1400, t + 1.2);
        break;
      }
      case 'monsterStep': this._noiseHit({ type: 'lowpass', freq: 220, peak: 0.5, d: 0.25, pos, rev: 0.4 }); this._tone({ freq: 70, slide: 0.5, peak: 0.25, d: 0.2, pos }); break;
      case 'breaker': this._noiseHit({ type: 'lowpass', freq: 900, peak: 0.4, d: 0.12, pos }); this._tone({ t: t + 0.05, freq: 120, type: 'square', peak: 0.06, d: 0.5, pos }); break;
      case 'elevator': {
        const o = this._tone({ freq: 70, type: 'sawtooth', a: 0.8, peak: 0.08, d: opts.dur || 6 });
        o.frequency.linearRampToValueAtTime(58, t + (opts.dur || 6));
        this._noiseHit({ type: 'lowpass', freq: 160, a: 0.8, peak: 0.12, d: opts.dur || 6 });
        break;
      }
      case 'thud': this._tone({ freq: 55, slide: 0.5, peak: 0.6, d: 0.5 }); this._noiseHit({ type: 'lowpass', freq: 200, peak: 0.5, d: 0.4, rev: 0.5 }); break;
      case 'tear': this._noiseHit({ type: 'bandpass', freq: 3200, q: 0.8, a: 0.02, peak: 0.3, d: 0.6, rev: 0.3 }); break;
      case 'splash': this._noiseHit({ type: 'lowpass', freq: 1400, peak: 0.3, d: 0.6, pos, rev: 0.4 }); break;
      case 'breath': this._noiseHit({ type: 'bandpass', freq: 700, q: 1, a: 0.35, peak: 0.05 * (opts.vol || 1), d: 0.6 }); break;
      case 'gasp': this._noiseHit({ type: 'bandpass', freq: 1100, q: 1.5, a: 0.05, peak: 0.2, d: 0.35 }); break;
      case 'shutter': this._noiseHit({ type: 'highpass', freq: 3000, peak: 0.2, d: 0.05, pos }); this._noiseHit({ t: t + 0.07, type: 'highpass', freq: 2500, peak: 0.15, d: 0.05, pos }); break;
      case 'clap': for (let i = 0; i < 24; i++) this._noiseHit({ t: t + Math.random() * 1.6, type: 'bandpass', freq: 1500 + Math.random() * 1000, q: 1, peak: 0.05, d: 0.04, rev: 0.3 }); break;
      case 'train': { const o = this._tone({ freq: 330, type: 'triangle', peak: 0.06, a: 0.3, d: 1.8, rev: 0.6 }); o.frequency.linearRampToValueAtTime(300, t + 2); this._tone({ freq: 392, type: 'triangle', peak: 0.05, a: 0.3, d: 1.8, rev: 0.6 }); break; }
      case 'pour': this._noiseHit({ type: 'bandpass', freq: 1200, q: 2, a: 0.1, peak: 0.1, d: 0.9 }); break;
      case 'steam': this._noiseHit({ type: 'highpass', freq: 4000, a: 0.1, peak: 0.08, d: 1.2 }); break;
      case 'shovel': this._noiseHit({ type: 'lowpass', freq: 1200, a: 0.05, peak: 0.2, d: 0.35 }); break;
      case 'type': for (let i = 0; i < 8; i++) this._noiseHit({ t: t + i * 0.07 + Math.random() * 0.03, type: 'bandpass', freq: 3000, q: 2, peak: 0.05, d: 0.02 }); break;
      default: break;
    }
  }
}

export const audio = new AudioEngine();
