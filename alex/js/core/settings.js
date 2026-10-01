// Player settings: defaults, persistence and the spec the Settings screen renders from.

const KEY = 'akdh2.settings.v1';

export const ACTIONS = {
  up: 'Move forward', down: 'Move back', left: 'Move left', right: 'Move right',
  jump: 'Jump / Vault / Wall kick', dash: 'Dash', melee: 'Melee attack', ranged: 'Ranged attack',
  lock: 'Hard focus (lock-on)', targetPrev: 'Switch target ◀', targetNext: 'Switch target ▶',
  interact: 'Interact / Buy', map: 'Map', pause: 'Pause',
  phone1: 'Phone: Accept / Agree / Option 1', phone2: 'Phone: Decline / Provoke / Option 2',
  phone3: 'Phone: Deflect / Option 3', phone4: 'Phone: Option 4',
  gadget: 'Use gadget', ride: 'Hop on / off a vehicle',
};

export const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], dash: ['ShiftLeft', 'ShiftRight'], melee: ['Mouse0', 'KeyJ'], ranged: ['Mouse2', 'KeyK'],
  lock: ['KeyF', 'Mouse1'], targetPrev: ['KeyQ'], targetNext: ['KeyC'],
  interact: ['KeyE'], map: ['Tab'], pause: ['Escape', 'KeyP'],
  phone1: ['Digit1'], phone2: ['Digit2'], phone3: ['Digit3'], phone4: ['Digit4'],
  gadget: ['KeyG', 'KeyR'], ride: ['KeyV'],
};

// Standard gamepad mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start,
// 10 LS, 11 RS, 12 Up, 13 Down, 14 Left, 15 Right.
export const DEFAULT_PAD = {
  jump: [0], dash: [1, 5], melee: [2], ranged: [7], lock: [6], targetPrev: [], targetNext: [],
  interact: [3], map: [8], pause: [9], phone1: [12], phone2: [15], phone3: [13], phone4: [14],
  gadget: [4], ride: [11],
};
export const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

export const DEFAULTS = {
  masterVol: 0.8, musicVol: 0.55, sfxVol: 0.85, phoneVol: 0.9,
  sensX: 1, sensY: 1, padSensX: 1, padSensY: 1, invertX: false, invertY: false,
  fov: 0, camDistance: 1, camShake: 0.75, motionBlur: 'low',
  autoRecenter: true, recenterDelay: 1.5, combatCamAssist: 'normal', aimAssist: 'normal',
  autoTarget: true, autoSwitch: true, lockMode: 'toggle',
  projectileContrast: 'normal', indicatorIntensity: 'normal', perfectAssist: 'off',
  autoSprint: false, vibration: 0.7, rapidFire: false, ledgeProtect: true,
  reduceFlashing: false, flashIntensity: 0.8, damageNumbers: true, enemyBars: true, renderScale: 1,
  showFps: false, seenWarning: false,
  keys: DEFAULT_KEYS, pad: DEFAULT_PAD,
};

const clone = (o) => JSON.parse(JSON.stringify(o));

export function loadSettings() {
  let s = clone(DEFAULTS);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      s = { ...s, ...saved, keys: { ...clone(DEFAULT_KEYS), ...(saved.keys || {}) }, pad: { ...clone(DEFAULT_PAD), ...(saved.pad || {}) } };
    }
  } catch { /* storage unavailable: defaults */ }
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function resetSettings(s) {
  const d = clone(DEFAULTS);
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, d, { seenWarning: true });
  return s;
}

const lvl4 = [['off', 'Off'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High']];
// Settings screen spec: [group, [[key, label, type, options]]]
export const SETTINGS_SPEC = [
  ['Camera', [
    ['sensX', 'Horizontal sensitivity', 'range', { min: 0.2, max: 3, step: 0.05 }],
    ['sensY', 'Vertical sensitivity', 'range', { min: 0.2, max: 3, step: 0.05 }],
    ['padSensX', 'Controller horizontal sensitivity', 'range', { min: 0.2, max: 3, step: 0.05 }],
    ['padSensY', 'Controller vertical sensitivity', 'range', { min: 0.2, max: 3, step: 0.05 }],
    ['invertX', 'Invert X', 'toggle'],
    ['invertY', 'Invert Y', 'toggle'],
    ['fov', 'Base FOV offset', 'range', { min: -10, max: 20, step: 1, fmt: (v) => (v > 0 ? '+' : '') + v + '°' }],
    ['camDistance', 'Camera distance', 'range', { min: 0.75, max: 1.4, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['combatCamAssist', 'Combat camera assistance', 'select', { options: lvl4 }],
    ['autoRecenter', 'Camera recentering', 'toggle'],
    ['recenterDelay', 'Recenter delay', 'range', { min: 0.5, max: 4, step: 0.25, fmt: (v) => v.toFixed(2) + ' s' }],
    ['camShake', 'Camera shake', 'range', { min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['motionBlur', 'Motion blur (dash smear & speed lines)', 'select', { options: [['off', 'Off'], ['low', 'Low'], ['high', 'High']] }],
  ]],
  ['Combat', [
    ['aimAssist', 'Aim assist strength', 'select', { options: lvl4 }],
    ['autoTarget', 'Auto-targeting (Combat Focus)', 'toggle'],
    ['autoSwitch', 'Automatic target switching', 'toggle'],
    ['lockMode', 'Hard focus button', 'select', { options: [['toggle', 'Toggle'], ['hold', 'Hold']] }],
    ['perfectAssist', 'Perfect-dodge timing assistance', 'select', { options: [['off', 'Off'], ['low', 'Low'], ['high', 'High']] }],
    ['rapidFire', 'Rapid-fire: hold instead of repeatedly press', 'toggle'],
    ['autoSprint', 'Auto sprint', 'toggle'],
    ['ledgeProtect', 'Ledge protection', 'toggle'],
    ['damageNumbers', 'Damage numbers', 'toggle'],
    ['enemyBars', 'Enemy health bars & names', 'toggle'],
  ]],
  ['Readability & comfort', [
    ['projectileContrast', 'Projectile contrast', 'select', { options: [['normal', 'Normal'], ['high', 'High'], ['max', 'Maximum']] }],
    ['indicatorIntensity', 'Enemy attack indicator intensity', 'select', { options: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']] }],
    ['reduceFlashing', 'Photosensitivity: reduce flashing', 'toggle'],
    ['flashIntensity', 'Flash & strobe intensity', 'range', { min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['vibration', 'Vibration strength', 'range', { min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['renderScale', 'Render resolution', 'range', { min: 0.5, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['showFps', 'Show FPS', 'toggle'],
  ]],
  ['Audio', [
    ['masterVol', 'Master volume', 'range', { min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['musicVol', 'Music volume', 'range', { min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['sfxVol', 'Effects volume', 'range', { min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
    ['phoneVol', 'Phone & ringtone volume', 'range', { min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' }],
  ]],
];

// Effective flash multiplier used by every strobe / screen flash.
export function flashLevel(s) {
  return s.reduceFlashing ? Math.min(0.25, s.flashIntensity) : s.flashIntensity;
}
