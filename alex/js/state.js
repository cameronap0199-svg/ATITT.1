// Shared runtime context. Systems register themselves here at boot so they can reach
// each other without long import chains (the game is a single scene at a time).

export const G = {
  mode: 'boot',          // boot | title | run | paused | minigame | gameover | victory
  time: 0,               // scaled game time
  realTime: 0,
  dt: 0,
  timeScale: 1,
  slowUntil: 0,          // real time
  slowScale: 1,
  hitstopUntil: 0,
  debug: false,

  renderer: null,
  scene: null,
  camera: null,
  input: null,
  settings: null,
  audio: null,
  fx: null,
  hud: null,
  cam: null,
  targeting: null,
  projectiles: null,
  areas: null,
  phone: null,
  run: null,
  room: null,
  alex: null,
};

// Slow motion in real seconds (perfect dodge) and hit stop.
export function slowMo(duration, scale) {
  const active = G.slowUntil > G.realTime;
  G.slowScale = active ? Math.min(G.slowScale, scale) : scale;
  G.slowUntil = Math.max(G.slowUntil, G.realTime + duration);
}
export function hitStop(duration) {
  G.hitstopUntil = Math.max(G.hitstopUntil, G.realTime + duration);
}
