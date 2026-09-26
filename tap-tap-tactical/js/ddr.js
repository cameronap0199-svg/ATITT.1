// The rhythm engine behind every reload, injection, relic, bulkhead and dance-off.
// Time-based and DOM-free: notes carry an absolute hit time; the view decides how they fall.

export const DIRS = ['left', 'down', 'up', 'right'];
export const ARROW = { left: '←', down: '↓', up: '↑', right: '→' };
export const WINDOW = { perfect: 0.055, good: 0.12 };

const KEYMAP = {
  ArrowLeft: 'left', ArrowDown: 'down', ArrowUp: 'up', ArrowRight: 'right',
  KeyA: 'left', KeyS: 'down', KeyW: 'up', KeyD: 'right',
};
export const dirForCode = (code) => KEYMAP[code] || null;

// Random steps. Each step is an array of 1 or 2 simultaneous directions.
export function randomSteps(rng, n, { doubles = 0 } = {}) {
  const steps = [];
  let prev = null;
  for (let i = 0; i < n; i++) {
    if (doubles && rng() < doubles) {
      const a = Math.floor(rng() * 4);
      let b = Math.floor(rng() * 3);
      if (b >= a) b++;
      steps.push([DIRS[a], DIRS[b]]);
      prev = null;
    } else {
      let d = DIRS[Math.floor(rng() * 4)];
      if (d === prev && rng() < 0.6) d = DIRS[(DIRS.indexOf(d) + 1 + Math.floor(rng() * 3)) % 4];
      steps.push([d]);
      prev = d;
    }
  }
  return steps;
}

// Relative hit times. Heavy/experimental charts pack notes into dense clusters.
export function stepOffsets(n, spacing, { clusters = false, rng = Math.random } = {}) {
  const out = [];
  let t = 0;
  let left = 0;
  for (let i = 0; i < n; i++) {
    out.push(+t.toFixed(4));
    if (!clusters) { t += spacing; continue; }
    if (left <= 0) left = 2 + Math.floor(rng() * 2);
    left--;
    t += left > 0 ? Math.max(0.13, spacing * 0.6) : spacing * 1.5;
  }
  return out;
}

export class Chart {
  // onMiss: 'restart' (reloads: back to the first arrow), 'fail' (injections), 'requeue'
  // (Emergency Sedative: the missed pill goes to the back of the line), 'continue' (dance-offs).
  constructor(steps, {
    spacing = 0.4, travel = 1.2, lead = null, clusters = false, stutter = false, rng = Math.random,
    onMiss = 'restart', strayMisses = true, windowScale = 1, forgive = null, now = 0,
  } = {}) {
    this.spacing = spacing;
    this.travel = travel;
    this.lead = lead ?? travel + 0.1;
    this.stutter = stutter;
    this.onMiss = onMiss;
    this.strayMisses = strayMisses;
    this.windowScale = windowScale;
    this.forgive = forgive;
    this.steps = steps;
    const offsets = stepOffsets(steps.length, spacing, { clusters, rng });
    this.notes = [];
    steps.forEach((dirs, i) => {
      for (const dir of dirs) this.notes.push({ dir, step: i, offset: offsets[i], time: 0, state: null, seed: rng(), requeued: false });
    });
    this.status = 'active';
    this.stats = { perfect: 0, good: 0, miss: 0, restarts: 0 };
    this.passClean = true; // every note of the current pass was PERFECT
    this.start(now);
  }

  start(now) {
    this.t0 = now;
    for (const n of this.notes) { n.time = now + this.lead + n.offset; n.state = null; }
    this.passClean = true;
  }

  get windows() {
    return { perfect: WINDOW.perfect * this.windowScale, good: WINDOW.good * this.windowScale };
  }
  get pending() { return this.notes.filter((n) => n.state === null); }
  get total() { return this.notes.filter((n) => !n.requeued).length; }
  get progress() { // 0..1 of notes cleared this pass
    const live = this.notes.filter((n) => n.state !== 'miss' || !n.requeued);
    return live.length ? live.filter((n) => n.state === 'perfect' || n.state === 'good').length / live.length : 1;
  }
  get perfectRun() { return this.status === 'done' && this.passClean; }
  get endTime() { return Math.max(...this.notes.map((n) => n.time)); }

  // Late notes become misses. Returns the judgement events that happened.
  update(now) {
    if (this.status !== 'active') return [];
    const events = [];
    const good = this.windows.good;
    for (const n of this.pending.sort((a, b) => a.time - b.time)) {
      if (now - n.time > good) {
        events.push(this._miss(n, now, 'late'));
        if (this.status !== 'active' || this.onMiss === 'restart') break;
      }
    }
    this._checkDone();
    return events;
  }

  press(dir, now) {
    if (this.status !== 'active') return null;
    const { perfect, good } = this.windows;
    const pend = this.pending.sort((a, b) => a.time - b.time);
    const inWin = pend.filter((n) => Math.abs(n.time - now) <= good);
    let ev;
    if (inWin.length) {
      const match = inWin.filter((n) => n.dir === dir).sort((a, b) => Math.abs(a.time - now) - Math.abs(b.time - now))[0];
      if (match) {
        const q = Math.abs(match.time - now) <= perfect ? 'perfect' : 'good';
        match.state = q;
        this.stats[q]++;
        if (q !== 'perfect') this.passClean = false;
        ev = { type: q, note: match, dt: now - match.time };
      } else {
        ev = this._miss(inWin[0], now, 'wrong');
      }
    } else if (pend.length && this.strayMisses) {
      ev = this._miss(pend[0], now, 'early');
    } else {
      ev = { type: 'stray' };
    }
    this._checkDone();
    return ev;
  }

  cancel() { if (this.status === 'active') this.status = 'cancelled'; }

  _miss(note, now, reason) {
    if (this.forgive && this.forgive()) {
      if (reason === 'early') return { type: 'forgiven', reason };
      note.state = 'good';
      this.stats.good++;
      this.passClean = false;
      return { type: 'good', note, reason, forgiven: true };
    }
    this.stats.miss++;
    this.passClean = false;
    switch (this.onMiss) {
      case 'restart':
        this.stats.restarts++;
        this.start(now);
        return { type: 'miss', note, reason, restart: true };
      case 'fail':
        note.state = 'miss';
        this.status = 'failed';
        return { type: 'miss', note, reason, failed: true };
      case 'requeue': {
        note.state = 'miss';
        note.requeued = true;
        const last = Math.max(now + this.travel, ...this.pending.map((n) => n.time + this.spacing));
        this.notes.push({ dir: note.dir, step: note.step, offset: 0, time: last, state: null, seed: note.seed, requeued: false });
        return { type: 'miss', note, reason, requeue: true };
      }
      default:
        note.state = 'miss';
        return { type: 'miss', note, reason };
    }
  }

  _checkDone() {
    if (this.status === 'active' && this.pending.length === 0) this.status = 'done';
  }

  // Seconds until the note reaches the mark, as drawn. Experimental charts stutter: notes freeze
  // briefly and then snap forward, but they always arrive on time.
  visualRemaining(note, now) {
    const rem = note.time - now;
    if (!this.stutter || rem < 0.2) return rem;
    const k = Math.min(1, (rem - 0.2) / 0.4);
    const phase = (now * 1.6 + note.seed) % 1;
    return rem + (phase < 0.3 ? phase / 1.6 : 0) * k;
  }
}
