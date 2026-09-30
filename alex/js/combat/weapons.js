// Weapon definitions. Alex carries one melee and one ranged weapon; Gas Station
// locked-case purchases and Lost & Found drops replace a slot.
// Melee step: dmg, range, arc (deg), startup/active/recover (s), lunge (m), knock,
// stagger, cone (aim-correction family), pose, commit (not dash-cancellable while active).

export const MELEE = {
  hunterBlade: {
    name: 'Lightstick Katana', icon: '🗡️', color: '#ff7ce6', desc: 'Alex\'s trusty demon-hunting lightstick blade.',
    combo: [
      { dmg: 12, range: 2.4, arc: 120, startup: 0.07, active: 0.08, recover: 0.2, lunge: 1.1, knock: 2, stagger: 1, cone: 'basic', pose: 'slash1', sfx: 'slash' },
      { dmg: 12, range: 2.4, arc: 120, startup: 0.06, active: 0.08, recover: 0.2, lunge: 1.1, knock: 2, stagger: 1, cone: 'basic', pose: 'slash2', sfx: 'slash2' },
      { dmg: 22, range: 2.9, arc: 360, startup: 0.1, active: 0.12, recover: 0.3, lunge: 1.4, knock: 7, stagger: 2, cone: 'flashy', pose: 'spin', sfx: 'spin', finisher: true },
    ],
    air: [
      { dmg: 10, range: 2.4, arc: 150, startup: 0.05, active: 0.08, recover: 0.18, lunge: 1.2, knock: 2, stagger: 1, cone: 'flashy', pose: 'airSlash', sfx: 'slash', hover: 2.5 },
      { dmg: 10, range: 2.4, arc: 150, startup: 0.05, active: 0.08, recover: 0.18, lunge: 1.2, knock: 2, stagger: 1, cone: 'flashy', pose: 'airSlash2', sfx: 'slash2', hover: 2.5 },
      { dmg: 16, range: 2.8, arc: 360, startup: 0.08, active: 0.12, recover: 0.25, lunge: 1.2, knock: 6, stagger: 2, cone: 'flashy', pose: 'airSpin', sfx: 'spin', hover: 3.5, finisher: true },
    ],
    dash: { dmg: 16, range: 2.6, arc: 110, startup: 0.04, active: 0.1, recover: 0.2, lunge: 2.2, knock: 4, stagger: 1, cone: 'flashy', pose: 'dashSlash', sfx: 'slash2' },
    charged: { dmg: 18, range: 2.6, arc: 150, startup: 0.12, active: 0.12, recover: 0.34, lunge: 1, knock: 1, stagger: 3, launch: 9.5, cone: 'heavy', pose: 'launcher', sfx: 'spin', commit: true },
    counter: { dmg: 22, range: 3.3, arc: 360, startup: 0.05, active: 0.12, recover: 0.25, lunge: 1.5, knock: 8, stagger: 3, cone: 'flashy', pose: 'counter', sfx: 'spin', finisher: true },
  },
  nunchucks: {
    name: 'Glowstick Nunchucks', icon: '🥢', color: '#39ff14', desc: 'Fast melee. Consecutive hits build combo damage (+6 % each, up to +60 %).', comboBuild: 0.06,
    combo: [
      { dmg: 7, range: 2.2, arc: 130, startup: 0.04, active: 0.06, recover: 0.12, lunge: 1, knock: 1, stagger: 1, cone: 'basic', pose: 'slash1', sfx: 'slash' },
      { dmg: 7, range: 2.2, arc: 130, startup: 0.04, active: 0.06, recover: 0.12, lunge: 1, knock: 1, stagger: 1, cone: 'basic', pose: 'slash2', sfx: 'slash2' },
      { dmg: 7, range: 2.2, arc: 130, startup: 0.04, active: 0.06, recover: 0.12, lunge: 1, knock: 1, stagger: 1, cone: 'basic', pose: 'slash1', sfx: 'slash' },
      { dmg: 12, range: 2.6, arc: 360, startup: 0.06, active: 0.1, recover: 0.22, lunge: 1.2, knock: 5, stagger: 2, cone: 'flashy', pose: 'spin', sfx: 'spin', finisher: true },
    ],
    air: null, dash: null, charged: null, counter: null,
  },
  fanSign: {
    name: 'Fan Sign Buster Sword', icon: '🪧', color: '#ffd60a', desc: 'A giant laminated fan sign. Slow, huge arcs, big stagger.',
    combo: [
      { dmg: 19, range: 3.1, arc: 160, startup: 0.13, active: 0.1, recover: 0.3, lunge: 1.2, knock: 4, stagger: 2, cone: 'heavy', pose: 'slash1', sfx: 'hitHeavy' },
      { dmg: 19, range: 3.1, arc: 160, startup: 0.12, active: 0.1, recover: 0.3, lunge: 1.2, knock: 4, stagger: 2, cone: 'heavy', pose: 'slash2', sfx: 'hitHeavy' },
      { dmg: 32, range: 3.4, arc: 360, startup: 0.16, active: 0.14, recover: 0.4, lunge: 1.4, knock: 9, stagger: 3, cone: 'flashy', pose: 'spin', sfx: 'spin', finisher: true, commit: true },
    ],
    air: null, dash: null, charged: null, counter: null,
  },
};
// Weapons without their own air/dash/charged/counter moves borrow the katana's.
for (const w of Object.values(MELEE)) for (const k of ['air', 'dash', 'charged', 'counter']) if (!w[k]) w[k] = MELEE.hunterBlade[k];

export const RANGED = {
  micBlaster: { name: 'Idol Mic Blaster', icon: '🎤', desc: 'Rapid cyan bolts. Hold to fire.', rate: 6, dmg: 5, speed: 44, r: 0.13, kind: 'bolt', spread: 0.015, knock: 0.8, sfx: 'shot' },
  revolver: { name: 'Demon-Be-Gone™ Revolver', icon: '🔫', desc: 'Slow, heavy shots with high stagger. Pierces one demon.', rate: 1.7, dmg: 24, speed: 70, r: 0.16, kind: 'slug', spread: 0, knock: 4, stagger: 3, pierce: 1, sfx: 'heavyShot', shake: 0.12 },
  shirtCannon: { name: 'Concert T-Shirt Cannon', icon: '👕', desc: 'Launches shirts that knock enemies backward and burst on impact.', rate: 1.25, dmg: 14, speed: 24, r: 0.34, kind: 'shirt', spread: 0, knock: 10, grav: 9, splash: 1.8, splashDmg: 7, sfx: 'shirt', stagger: 2 },
  gasPump: { name: 'Gas Pump Nozzle', icon: '⛽', desc: 'Short-range flamethrower. Completely unexplained. Sets demons on fire.', rate: 22, dmg: 1.5, speed: 16, r: 0.3, kind: 'flame', spread: 0.2, life: 0.42, pierce: 3, knock: 0.2, burn: 2.5, sfx: 'flame' },
  shuriken: { name: 'Photocard Shuriken', icon: '💠', desc: 'Throws three signed photocards in a spread. Bias not included.', rate: 2.6, dmg: 7, speed: 30, r: 0.2, kind: 'star', spread: 0.22, count: 3, knock: 1.5, sfx: 'shot' },
};

export const weaponInfo = (id) => MELEE[id] || RANGED[id];
