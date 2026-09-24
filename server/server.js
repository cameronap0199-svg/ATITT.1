// Knotwood game server: serves the web client and hosts authoritative online matches
// over WebSockets (quick match queue + private room codes + reconnection).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createMatch, Game, viewFor, redactEvents } from '../shared/engine.js';
import { validateDeck, deckToList } from '../shared/decks.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8080);
const TURN_SECONDS = +(process.env.TURN_SECONDS || 100);
const RESPONSE_SECONDS = 25;
const MULLIGAN_SECONDS = 40;
const DISCONNECT_GRACE = 60;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
};
const PUBLIC = ['index.html', 'client/', 'shared/', 'favicon.svg', 'manifest.webmanifest'];

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (rel === '' || rel === '/') rel = 'index.html';
  if (rel === 'health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, online: clients.size, matches: matches.size })); return; }
  const allowed = PUBLIC.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
  const file = path.resolve(ROOT, rel);
  if (!allowed || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ---------------------------------------------------------------------------
// Lobby & matches
// ---------------------------------------------------------------------------
const clients = new Map(); // ws -> client
const matches = new Map(); // matchId -> match
const rooms = new Map();   // code -> client
let queue = [];

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcastOnline = () => { for (const c of clients.values()) send(c.ws, { t: 'online', count: clients.size, matches: matches.size }); };

function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function leaveLobby(c) {
  queue = queue.filter((q) => q !== c);
  if (c.room) { rooms.delete(c.room); c.room = null; }
}

function startMatch(a, b) {
  leaveLobby(a); leaveLobby(b);
  const seed = crypto.randomInt(2 ** 31);
  const first = crypto.randomInt(2);
  const state = createMatch({
    seed, first,
    players: [
      { name: a.name, deck: deckToList(a.deck), avatar: a.avatar },
      { name: b.name, deck: deckToList(b.deck), avatar: b.avatar },
    ],
  });
  const m = {
    id: crypto.randomUUID(), state, game: new Game(state),
    seats: [a, b], secrets: [crypto.randomBytes(12).toString('hex'), crypto.randomBytes(12).toString('hex')],
    deadline: null, deadlineKind: null, timer: null, gone: [null, null], over: false,
  };
  matches.set(m.id, m);
  [a, b].forEach((c, seat) => {
    c.match = m; c.seat = seat;
    send(c.ws, { t: 'match', matchId: m.id, seat, secret: m.secrets[seat], opponent: { name: m.seats[1 - seat].name, avatar: m.seats[1 - seat].avatar } });
  });
  pushState(m, []);
  broadcastOnline();
}

function whoMustAct(m) {
  const s = m.state;
  if (s.phase === 'over') return null;
  if (s.phase === 'mulligan') return null;
  if (s.chain.length) return s.priority;
  return s.active;
}

function armTimer(m) {
  clearTimeout(m.timer);
  const s = m.state;
  if (s.phase === 'over') { m.deadline = null; return; }
  let secs;
  let kind;
  if (s.phase === 'mulligan') { secs = MULLIGAN_SECONDS; kind = 'mulligan'; }
  else if (s.chain.length) { secs = RESPONSE_SECONDS; kind = 'response'; }
  else { secs = TURN_SECONDS; kind = 'turn'; }
  const key = kind + ':' + s.turnSerial + ':' + s.chain.length;
  if (m.deadlineKey !== key) { m.deadline = Date.now() + secs * 1000; m.deadlineKey = key; m.deadlineKind = kind; }
  m.timer = setTimeout(() => onTimeout(m), Math.max(0, m.deadline - Date.now()) + 50);
}

function onTimeout(m) {
  const s = m.state;
  if (m.over) return;
  if (s.phase === 'mulligan') {
    for (let p = 0; p < 2; p++) if (!s.players[p].mulligan) apply(m, p, { type: 'mulligan', redraw: false });
    return;
  }
  const p = whoMustAct(m);
  if (p === null) return;
  apply(m, p, s.chain.length ? { type: 'pass' } : { type: 'endTurn' });
}

function pushState(m, events) {
  armTimer(m);
  m.seats.forEach((c, seat) => {
    send(c && c.ws, { t: 'state', view: viewFor(m.state, seat), events: redactEvents(events, seat), deadline: m.deadline, deadlineKind: m.deadlineKind, now: Date.now() });
  });
  if (m.state.phase === 'over' && !m.over) {
    m.over = true;
    clearTimeout(m.timer);
    setTimeout(() => matches.delete(m.id), 10 * 60 * 1000);
    broadcastOnline();
  }
}

function apply(m, seat, action) {
  const r = m.game.act(seat, action);
  if (!r.ok) return r;
  pushState(m, r.events);
  return r;
}

// ---------------------------------------------------------------------------
// WebSocket protocol
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });

wss.on('connection', (ws) => {
  const c = { ws, name: 'Wanderer', avatar: '🧑', deck: null, match: null, seat: null, room: null, alive: true };
  clients.set(ws, c);
  broadcastOnline();
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    handle(c, msg);
  });
  ws.on('close', () => {
    clients.delete(ws);
    leaveLobby(c);
    const m = c.match;
    if (m && !m.over && m.seats[c.seat] === c) {
      const seat = c.seat;
      m.gone[seat] = Date.now();
      send(m.seats[1 - seat] && m.seats[1 - seat].ws, { t: 'opponentLeft', grace: DISCONNECT_GRACE });
      setTimeout(() => {
        if (!m.over && m.gone[seat] && Date.now() - m.gone[seat] >= DISCONNECT_GRACE * 1000 - 100) {
          apply(m, seat, { type: 'concede' });
        }
      }, DISCONNECT_GRACE * 1000);
    }
    broadcastOnline();
  });
});

function setProfile(c, msg) {
  if (typeof msg.name === 'string') c.name = msg.name.replace(/[^\p{L}\p{N} _\-'.!?]/gu, '').slice(0, 20) || 'Wanderer';
  if (typeof msg.avatar === 'string') c.avatar = [...msg.avatar].slice(0, 8).join('');
  if (msg.deck && typeof msg.deck === 'object') c.deck = msg.deck;
}

function handle(c, msg) {
  switch (msg.t) {
    case 'hello': {
      setProfile(c, msg);
      send(c.ws, { t: 'welcome', online: clients.size, matches: matches.size });
      break;
    }
    case 'queue': {
      setProfile(c, msg);
      const v = validateDeck(c.deck);
      if (!v.ok) { send(c.ws, { t: 'error', msg: v.errors[0] }); return; }
      if (c.match && !c.match.over) { send(c.ws, { t: 'error', msg: 'You are already in a match.' }); return; }
      leaveLobby(c);
      const other = queue.find((q) => q !== c && q.ws.readyState === 1);
      if (other) startMatch(other, c);
      else { queue.push(c); send(c.ws, { t: 'queued' }); }
      break;
    }
    case 'createRoom': {
      setProfile(c, msg);
      const v = validateDeck(c.deck);
      if (!v.ok) { send(c.ws, { t: 'error', msg: v.errors[0] }); return; }
      leaveLobby(c);
      c.room = roomCode();
      rooms.set(c.room, c);
      send(c.ws, { t: 'room', code: c.room });
      break;
    }
    case 'joinRoom': {
      setProfile(c, msg);
      const v = validateDeck(c.deck);
      if (!v.ok) { send(c.ws, { t: 'error', msg: v.errors[0] }); return; }
      const code = String(msg.code || '').toUpperCase().trim();
      const host = rooms.get(code);
      if (!host || host === c || host.ws.readyState !== 1) { send(c.ws, { t: 'error', msg: 'No room with that code.' }); return; }
      startMatch(host, c);
      break;
    }
    case 'cancel': leaveLobby(c); send(c.ws, { t: 'cancelled' }); break;
    case 'act': {
      const m = c.match;
      if (!m || m.over) return;
      const r = apply(m, c.seat, msg.action || {});
      if (!r.ok) send(c.ws, { t: 'error', msg: r.error, soft: true });
      break;
    }
    case 'emote': {
      const m = c.match;
      if (!m) return;
      const id = String(msg.id || '').slice(0, 24);
      const now = Date.now();
      if (c.lastEmote && now - c.lastEmote < 1500) return;
      c.lastEmote = now;
      m.seats.forEach((s) => send(s && s.ws, { t: 'emote', seat: c.seat, id }));
      break;
    }
    case 'resume': {
      const m = matches.get(msg.matchId);
      if (!m || m.over) { send(c.ws, { t: 'resumeFailed' }); return; }
      const seat = m.secrets.indexOf(msg.secret);
      if (seat < 0) { send(c.ws, { t: 'resumeFailed' }); return; }
      const old = m.seats[seat];
      if (old && old !== c && old.ws.readyState === 1) old.ws.close();
      m.seats[seat] = c;
      m.gone[seat] = null;
      c.match = m; c.seat = seat;
      c.name = m.state.players[seat].name;
      send(c.ws, { t: 'match', matchId: m.id, seat, secret: m.secrets[seat], opponent: { name: m.seats[1 - seat].name, avatar: m.seats[1 - seat].avatar }, resumed: true });
      send(c.ws, { t: 'state', view: viewFor(m.state, seat), events: [], deadline: m.deadline, deadlineKind: m.deadlineKind, now: Date.now() });
      send(m.seats[1 - seat] && m.seats[1 - seat].ws, { t: 'opponentBack' });
      break;
    }
    case 'leave': {
      const m = c.match;
      if (m && !m.over) apply(m, c.seat, { type: 'concede' });
      c.match = null;
      break;
    }
    case 'ping': send(c.ws, { t: 'pong', now: Date.now() }); break;
    default: break;
  }
}

// keep-alive
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    try { c.ws.ping(); } catch { /* ignore */ }
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`\n  🌳 Knotwood is running!  Open http://localhost:${PORT}\n`);
});
