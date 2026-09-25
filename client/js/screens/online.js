// Online lobby (quick match / private rooms) and the online battle wiring.
import { el, clear, setScreen, toast, modal } from '../ui.js';
import { FORMATS } from '../../../shared/constants.js';
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
  const fmtPick = el('select.field', { 'data-tip': 'Room format' }, ...Object.entries(FORMATS).map(([k, f]) => el('option', { value: k }, f.name)));
  const showRoom = (m) => {
    waitBox.classList.remove('hidden');
    clear(waitBox);
    const host = m.you === 'host';
    const f = FORMATS[m.format];
    const list = el('div.col', { style: { gap: '6px', margin: '10px auto', maxWidth: '320px' } });
    for (let i = 0; i < f.players; i++) {
      const mem = m.members[i];
      const team = m.format === '2v2' ? ` · Team ${f.teams[i] + 1}` : '';
      list.appendChild(el('div.row.win.dark', { style: { padding: '6px 10px', gap: '10px' } },
        el('div.avatar.small', mem ? mem.avatar || '🙂' : '🤖'),
        el('b', mem ? mem.name + (mem.host ? ' 👑' : '') : 'Open seat (bot fills)'), el('span.muted.tiny', `Seat ${i + 1}${team}`)));
    }
    waitBox.append(
      el('div', { html: `Room code — share it with friends:<div class="room-code">${m.code}</div>` }),
      el('div', el('b', f.name), el('span.muted', ` · ${m.members.length}/${f.players} players`)),
      list);
    if (host) {
      const fsel = el('select.field', { onchange: () => n.send({ t: 'roomSettings', format: fsel.value }) },
        ...Object.entries(FORMATS).map(([k, ff]) => el('option', { value: k, selected: k === m.format, disabled: ff.players < m.members.length }, ff.name)));
      const dsel = el('select.field', { onchange: () => n.send({ t: 'roomSettings', botDifficulty: +dsel.value }) },
        ...Array.from({ length: 10 }, (_, i) => el('option', { value: i + 1, selected: i + 1 === m.botDifficulty }, `Bots: difficulty ${i + 1}`)));
      const together = el('input', { type: 'checkbox', checked: true });
      waitBox.append(el('div.row', { style: { justifyContent: 'center', gap: '8px', flexWrap: 'wrap' } }, fsel, dsel),
        m.format === '2v2' && m.members.length === 2 ? el('label.row', { style: { justifyContent: 'center', marginTop: '6px' } }, together, el('span', 'Team up with the other human')) : '',
        el('div.row', { style: { justifyContent: 'center', gap: '8px', marginTop: '10px' } },
          el('button.btn.gold', { onclick: () => n.send({ t: 'startRoom', humansTogether: together.checked }) }, m.members.length < f.players ? '▶ Start (fill with bots)' : '▶ Start'),
          el('button.btn.ghost', { onclick: () => { n.send({ t: 'cancel' }); waitBox.classList.add('hidden'); } }, 'Close Room')));
    } else {
      waitBox.append(el('div.muted', 'Waiting for the host to start…'), el('div.spinner', { style: { margin: '10px auto' } }),
        el('button.btn.ghost', { onclick: () => { n.send({ t: 'cancel' }); waitBox.classList.add('hidden'); } }, 'Leave'));
    }
  };
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
    el('button.btn.big', { onclick: () => { if (!check()) return; n.send({ t: 'createRoom', format: fmtPick.value, ...hello() }); } }, '🏠 Create Room'),
    fmtPick,
    el('div.row', codeIn, el('button.btn.big.green', { onclick: () => { if (!check()) return; const c = codeIn.value.trim().toUpperCase(); if (c.length !== 4) { sfx('error'); codeIn.focus(); return; } n.send({ t: 'joinRoom', code: c, ...hello() }); } }, 'Join')));
  body.append(
    el('div.win.gold', el('div.win-title', 'ONLINE BATTLE'),
      el('div.row', { style: { justifyContent: 'space-between', flexWrap: 'wrap' } },
        el('div.row', el('div.avatar.small', p.avatar), el('b', p.name)), online),
      el('p.muted', 'Play real people. Quick Match pairs you with anyone waiting for a duel. Rooms support 1v1, 2v2 and free-for-all for up to 4 — share the 4-letter code, and bots fill any empty seats.'),
      el('label.row', el('b', 'Deck:'), deckSel),
      status),
    el('div.win', buttons),
    waitBox);
  const node = el('div.page', el('div.page-head', el('button.btn.ghost', { onclick: () => { cleanup(); showHub(); } }, '← Back'), el('h1', 'Online Battle')), el('div.page-body.scroll', el('div.lobby', body)));
  const wrap = el('div', node, topButtons());
  const cleanup = () => offs.forEach((f) => f());
  wrap.cleanup = cleanup;
  setScreen(wrap);

  offs.push(n.on('online', (m) => { online.textContent = `🌐 ${m.count} online · ${m.matches} duels`; }));
  offs.push(n.on('welcome', (m) => { online.textContent = `🌐 ${m.online} online · ${m.matches} duels`; status.textContent = '✔ Connected. Ready to duel!'; }));
  offs.push(n.on('queued', () => {}));
  offs.push(n.on('room', (m) => showRoom(m)));
  offs.push(n.on('roomClosed', () => { waitBox.classList.add('hidden'); toast('The host closed the room.', 'bad', 2.5); }));
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
  const infos = m.players.map((q) => ({ name: q.name, avatar: q.avatar || '🙂' }));
  let ui = null;
  const makeUi = (view) => new BattleView({
    seat: m.seat, side: view.players[m.seat].side, mode: 'online', infos,
    onAct: (action) => { n.send({ t: 'act', action }); return true; },
    onEmote: (id) => n.send({ t: 'emote', id }),
  });
  n.send({ t: 'act', action: { type: 'setAutoRetaliate', on: p.settings.autoRetaliate } });
  const finish = () => {
    offs.forEach((f) => f());
    try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
  };
  const setupUi = (view) => {
    ui = makeUi(view);
    ui.onGameOver = (v) => { finish(); showResults({ ui, view: v, mode: 'online', onFinish: () => showOnline() }); };
    const origDispose = ui.root.cleanup;
    ui.root.cleanup = () => { finish(); origDispose && origDispose(); };
  };
  let first = true;
  let chain = Promise.resolve();
  offs.push(n.on('state', (msg) => {
    chain = chain.then(async () => {
      if (first) {
        first = false;
        setupUi(msg.view);
        ui.sync(msg.view);
        if (!m.resumed) await vsSplash(infos, null, m.format);
      }
      if (ui.closed) return;
      ui.setDeadline(msg.deadline, msg.now, msg.deadlineKind);
      await ui.play(msg.events, msg.view);
    }).catch((e) => console.error(e));
  }));
  offs.push(n.on('error', (msg) => { if (msg.soft && ui) { sfx('error'); toast(msg.msg, 'bad', 1.8); ui.sync(ui.view); } }));
  offs.push(n.on('emote', (msg) => { if (ui) { ui.say(msg.seat, msg.id + ' ' + (EMOTE_TEXT[msg.id] || '')); sfx('cursor'); } }));
  offs.push(n.on('opponentLeft', (msg) => toast(`${msg.name || 'A player'} disconnected — they have ${msg.grace}s to return.`, 'bad', 4)));
  offs.push(n.on('opponentBack', (msg) => toast(`${msg.name || 'A player'} reconnected!`, 'good')));
  offs.push(n.on('reconnected', () => { n.send({ t: 'resume', matchId: m.matchId, secret: m.secret }); toast('Reconnected!', 'good'); }));
  offs.push(n.on('close', () => toast('Connection lost — reconnecting…', 'bad', 2.5)));
  // menu 'leave' → concede
  void modal;
}

const EMOTE_TEXT = { '👋': 'Hello!', '😄': 'Nice move!', '😮': 'Whoa!', '😤': 'Grr…', '🙏': 'Good game!' };
