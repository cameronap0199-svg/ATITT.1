// Online lobby (quick match / private rooms) and the online battle wiring.
import { el, setScreen, toast, modal } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { Net } from '../net.js';
import { getProfile, getDeck, deckValid, setActiveDeck } from '../profile.js';
import { BattleView, showResults, vsSplash } from '../battle/battle.js';
import { showHub } from './hub.js';
import { topButtons } from './settings.js';

let net = null;
const RESUME_KEY = 'knotwood.resume';

function getNet() {
  if (!net) net = new Net();
  return net;
}

export async function showOnline() {
  playMusic('menu');
  const p = getProfile();
  const status = el('div.muted', 'Connecting to the Knotwood server…');
  const online = el('span.pill', '🌐 …');
  const body = el('div.col', { style: { gap: '14px' } });
  const deckSel = el('select.field', { onchange: () => setActiveDeck(deckSel.value) });
  for (const d of p.decks) {
    const o = el('option', { value: d.id }, `${d.name}${deckValid(d).ok ? '' : ' (invalid)'}`);
    if (d.id === p.activeDeck) o.selected = true;
    deckSel.appendChild(o);
  }
  const codeIn = el('input.field', { placeholder: 'CODE', maxlength: 4, style: { width: '110px', textTransform: 'uppercase', letterSpacing: '.3em', textAlign: 'center', fontWeight: 900 } });
  const waitBox = el('div.win.hidden', { style: { textAlign: 'center' } });
  const hello = () => {
    const deck = getDeck();
    return { name: p.name, avatar: p.avatar, deck: deck.cards };
  };
  const check = () => {
    const v = deckValid(getDeck());
    if (!v.ok) { sfx('error'); toast('Your deck isn’t legal: ' + v.errors[0], 'bad', 3); return false; }
    return true;
  };
  const n = getNet();
  const offs = [];
  const showWaiting = (html, cancel = true) => {
    waitBox.classList.remove('hidden');
    waitBox.innerHTML = '';
    waitBox.append(el('div', { html }), el('div.spinner', { style: { margin: '14px auto' } }), cancel ? el('button.btn.ghost', { onclick: () => { n.send({ t: 'cancel' }); waitBox.classList.add('hidden'); } }, 'Cancel') : '');
  };
  const buttons = el('div.row', { style: { flexWrap: 'wrap', gap: '10px' } },
    el('button.btn.gold.big', { onclick: () => { if (!check()) return; n.send({ t: 'queue', ...hello() }); showWaiting('<b>Searching for an opponent…</b><br><span class="muted tiny">Tip: open a second browser tab to test online play against yourself!</span>'); } }, '⚡ Quick Match'),
    el('button.btn.big', { onclick: () => { if (!check()) return; n.send({ t: 'createRoom', ...hello() }); } }, '🏠 Create Room'),
    el('div.row', codeIn, el('button.btn.big.green', { onclick: () => { if (!check()) return; const c = codeIn.value.trim().toUpperCase(); if (c.length !== 4) { sfx('error'); codeIn.focus(); return; } n.send({ t: 'joinRoom', code: c, ...hello() }); } }, 'Join')));
  body.append(
    el('div.win.gold', el('div.win-title', 'ONLINE DUEL'),
      el('div.row', { style: { justifyContent: 'space-between', flexWrap: 'wrap' } },
        el('div.row', el('div.avatar.small', p.avatar), el('b', p.name)), online),
      el('p.muted', 'Duel real players. Quick Match pairs you with anyone waiting; or create a room and share its 4-letter code with a friend.'),
      el('label.row', el('b', 'Deck:'), deckSel),
      status),
    el('div.win', buttons),
    waitBox);
  const node = el('div.page', el('div.page-head', el('button.btn.ghost', { onclick: () => { cleanup(); showHub(); } }, '← Back'), el('h1', 'Online Duel')), el('div.page-body.scroll', el('div.lobby', body)));
  const wrap = el('div', node, topButtons());
  const cleanup = () => offs.forEach((f) => f());
  wrap.cleanup = cleanup;
  setScreen(wrap);

  offs.push(n.on('online', (m) => { online.textContent = `🌐 ${m.count} online · ${m.matches} duels`; }));
  offs.push(n.on('welcome', (m) => { online.textContent = `🌐 ${m.online} online · ${m.matches} duels`; status.textContent = '✔ Connected. Ready to duel!'; }));
  offs.push(n.on('queued', () => {}));
  offs.push(n.on('room', (m) => { showWaiting(`Share this code with your friend:<div class="room-code">${m.code}</div><span class="muted">Waiting for them to join…</span>`); }));
  offs.push(n.on('error', (m) => { if (!m.soft) { sfx('error'); toast(m.msg, 'bad', 3); waitBox.classList.add('hidden'); } }));
  offs.push(n.on('match', (m) => { cleanup(); startOnlineBattle(n, m); }));
  offs.push(n.on('resumeFailed', () => { try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } }));
  try {
    if (!n.ws || n.ws.readyState > 1) await n.connect();
    n.send({ t: 'hello', ...hello() });
    status.textContent = '✔ Connected. Ready to duel!';
    let resume = null;
    try { resume = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); } catch { /* ignore */ }
    if (resume) n.send({ t: 'resume', ...resume });
  } catch (e) {
    status.innerHTML = '';
    status.append(el('span', { style: { color: '#ff9b9b' } }, '✖ ' + e.message + '. '),
      el('span', 'Online play needs the Knotwood server (run '), el('code', 'npm start'), el('span', ') — or set a server address in Settings. Single-player modes work offline!'));
    buttons.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  }
}

export async function startOnlineBattle(n, m) {
  const p = getProfile();
  try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ matchId: m.matchId, secret: m.secret })); } catch { /* ignore */ }
  playMusic('battle');
  const offs = [];
  const ui = new BattleView({
    seat: m.seat, mode: 'online',
    me: { name: p.name, avatar: p.avatar }, foe: { name: m.opponent.name, avatar: m.opponent.avatar || '🙂' },
    onAct: (action) => { n.send({ t: 'act', action }); return true; },
    onEmote: (id) => n.send({ t: 'emote', id }),
  });
  const finish = () => {
    offs.forEach((f) => f());
    try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
  };
  ui.onGameOver = (view) => { finish(); showResults({ ui, view, mode: 'online', onFinish: () => showOnline() }); };
  const origDispose = ui.root.cleanup;
  ui.root.cleanup = () => { finish(); origDispose && origDispose(); };
  let first = true;
  let chain = Promise.resolve();
  offs.push(n.on('state', (msg) => {
    chain = chain.then(async () => {
      if (ui.closed) return;
      if (first) {
        first = false;
        ui.sync(msg.view);
        if (!m.resumed) await vsSplash({ name: p.name, avatar: p.avatar }, { name: m.opponent.name, avatar: m.opponent.avatar || '🙂' }, null);
      }
      ui.setDeadline(msg.deadline, msg.now, msg.deadlineKind);
      await ui.play(msg.events, msg.view);
    }).catch((e) => console.error(e));
  }));
  offs.push(n.on('error', (msg) => { if (msg.soft) { sfx('error'); toast(msg.msg, 'bad', 1.8); ui.sync(ui.view); } }));
  offs.push(n.on('emote', (msg) => { ui.say(msg.seat === ui.seat ? ui.seat : 1 - ui.seat, msg.id + ' ' + (EMOTE_TEXT[msg.id] || '')); sfx('cursor'); }));
  offs.push(n.on('opponentLeft', (msg) => toast(`Opponent disconnected — they have ${msg.grace}s to return.`, 'bad', 4)));
  offs.push(n.on('opponentBack', () => toast('Opponent reconnected!', 'good')));
  offs.push(n.on('reconnected', () => { n.send({ t: 'resume', matchId: m.matchId, secret: m.secret }); toast('Reconnected!', 'good'); }));
  offs.push(n.on('close', () => toast('Connection lost — reconnecting…', 'bad', 2.5)));
  // menu 'leave' → concede
  void modal;
}

const EMOTE_TEXT = { '👋': 'Hello!', '😄': 'Nice move!', '😮': 'Whoa!', '😤': 'Grr…', '🙏': 'Good game!' };
