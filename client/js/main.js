// Entry point: boot, title screen, onboarding and global shortcuts.
import { initAudio, sfx, playMusic, setVolumes } from './audio.js';
import { initFx } from './fx.js';
import { el, setScreen, initTooltips, closeTopModal, modal, toast } from './ui.js';
import { loadProfile, getProfile, saveProfile, claimDaily } from './profile.js';
import { showHub } from './screens/hub.js';

const AVATARS = ['🧑‍🌾', '🧝', '🧙', '🥷', '🧚', '🦊', '🦉', '🐺', '🐸', '🤖', '👻', '🐉'];

function boot() {
  loadProfile();
  const p = getProfile();
  setVolumes({ music: p.settings.music, sfx: p.settings.sfx, muted: p.settings.muted });
  document.documentElement.style.setProperty('--anim', p.settings.animSpeed || 1);
  initFx();
  initTooltips();
  const unlock = () => { initAudio(); };
  addEventListener('pointerdown', unlock, { once: false, capture: true });
  addEventListener('keydown', unlock, { once: false, capture: true });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (closeTopModal()) e.stopPropagation(); } }, true);
  // UI sound for any button
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.menu-item, .chip, .icon-btn');
    if (b) sfx('cursor');
  });
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.menu-item, .btn, .feature, .rival');
    if (b && !b.contains(e.relatedTarget)) sfx('hover');
  });
  showTitle();
}

export function showTitle() {
  playMusic('title');
  const start = async () => {
    initAudio();
    playMusic('title');
    sfx('confirm');
    const p = getProfile();
    if (!p.name) await onboarding();
    const daily = claimDaily();
    showHub();
    if (daily) setTimeout(() => toast('Daily gift: +100 Acorns! 🌰', 'gold', 3.2), 700);
  };
  const node = el('div.title-screen',
    el('div',
      el('div.logo-tree', '🌳'),
      el('div.logo', 'KNOTWOOD'),
      el('div.logo-sub', 'TACTICAL CARD BATTLE'),
      el('div.press-start', { onclick: start }, '— PRESS START —')),
    el('div.title-foot', 'Set 1 · Knotwood Forest · 280 cards · Duel AI rivals or friends online'));
  setScreen(node, { wipe: false });
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { removeEventListener('keydown', onKey); start(); } };
  addEventListener('keydown', onKey);
  node.cleanup = () => removeEventListener('keydown', onKey);
}

async function onboarding() {
  const p = getProfile();
  let avatar = AVATARS[0];
  const name = el('input.field', { placeholder: 'Your name', maxlength: 18, style: { width: '100%' } });
  const grid = el('div.onboard-avatars');
  AVATARS.forEach((a, i) => {
    const b = el('button', { onclick: () => { avatar = a; [...grid.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); sfx('cursor'); } }, a);
    if (!i) b.classList.add('on');
    grid.appendChild(b);
  });
  const body = el('div', { style: { maxWidth: '460px' } },
    el('p', { style: { marginTop: 0, lineHeight: 1.5 } }, 'Welcome, traveller, to ', el('b', 'Knotwood Forest'), '! Lanes to claim, creatures to befriend, and a certain mad doctor causing trouble… What should we call you?'),
    name,
    el('p.muted.tiny', 'Choose your portrait:'),
    grid);
  await modal({
    title: 'A New Adventure', body, closable: false,
    actions: [{ label: 'Begin!', cls: 'gold', onClick: (close) => {
      const v = name.value.trim();
      if (!v) { name.focus(); sfx('error'); return false; }
      p.name = v;
      p.avatar = avatar;
      saveProfile();
      close(true);
      return false;
    } }],
  });
  await modal({
    title: 'Welcome Gifts',
    body: el('div', { style: { maxWidth: '460px', lineHeight: 1.55 } },
      el('p', 'You receive the ', el('b', 'Beginner’s Grove'), ' deck (60 cards), ', el('b.acorns', '300 Acorns'), ' and ', el('b', '1 free Booster Pack'), '!'),
      el('p', 'Earn Acorns by playing — win or lose — then spend them in the Shop on booster packs to grow your collection and build stronger decks.'),
      el('p.muted', 'Tip: open “How to Play” from the menu any time. In battle, hover anything for details and right-click a card to inspect it.')),
    actions: [{ label: 'Let’s go!', cls: 'gold', value: true }],
  });
}

boot();
