// Knotwood game server: serves the web client and hosts authoritative online matches
// over WebSockets: 1v1 quick match, private rooms for every format (bots fill empty
// seats), and reconnection.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createMatch, Game, viewFor, redactEvents } from '../shared/engine.js';
import { validateDeck, deckToList, buildDeck } from '../shared/decks.js';
import { aiPlan } from '../shared/ai.js';
import { makeRng } from '../shared/rng.js';
import { FORMATS } from '../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8080);
const TURN_SECONDS = +(process.env.TURN_SECONDS || 100);
const RESPONSE_SECONDS = 25;
const SETUP_SECONDS = 45;
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
const rooms = new Map();   // code -> room { code, host, format, members, botDifficulty }
let queue = [];            // quick match (1 vs 1)

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcastOnline = () => { for (const c of clients.values()) send(c.ws, { t: 'online', count: clients.size, matches: matches.size }); };
const BOT_NAMES = [['Fox Bot', '🦊'], ['Owl Bot', '🦉'], ['Frog Bot', '🐸'], ['Hedgehog Bot', '🦔'], ['Bear Bot', '🐻'], ['Raccoon Bot', '🦝']];

function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function roomInfo(room) {
  return {
    t: 'room', code: room.code, format: room.format, players: FORMATS[room.format].players, botDifficulty: room.botDifficulty,
    members: room.members.map((m) => ({ name: m.name, avatar: m.avatar, host: m === room.host })),
  };
}
function broadcastRoom(room) { for (const m of room.members) send(m.ws, { ...roomInfo(room), you: m === room.host ? 'host' : 'guest' }); }

function leaveLobby(c) {
  queue = queue.filter((q) => q !== c);
  const room = c.room && rooms.get(c.room);
  c.room = null;
  if (!room) return;
  room.members = room.members.filter((m) => m !== c);
  if (room.host === c || !room.members.length) {
    rooms.delete(room.code);
    for (const m of room.members) { m.room = null; send(m.ws, { t: 'roomClosed' }); }
  } else broadcastRoom(room);
}

// seats: clients and/or bots ({ bot: true, name, avatar, difficulty }) in seat order
function startMatch(seats, format) {
  for (const c of seats) if (!c.bot) leaveLobby(c);
  const seed = crypto.randomInt(2 ** 31);
  const first = crypto.randomInt(seats.length);
  const botDeck = (c) => deckToList(buildDeck(makeRng(seed ^ crypto.randomInt(2 ** 30)), { quality: Math.min(0.9, c.difficulty / 10), rarityCap: c.difficulty >= 8 ? 'Infinite' : c.difficulty >= 5 ? 'Gold' : 'Silver' }));
  const state = createMatch({
    seed, first, format,
    players: seats.map((c) => ({ name: c.name, deck: c.bot ? botDeck(c) : deckToList(c.deck), avatar: c.avatar, bot: !!c.bot })),
  });
  const m = {
    id: crypto.randomUUID(), state, game: new Game(state), format,
    seats, secrets: seats.map(() => crypto.randomBytes(12).toString('hex')),
    deadline: null, deadlineKind: null, timer: null, botTimer: null, gone: seats.map(() => null), over: false,
  };
  m.game.noUndo = false;
  matches.set(m.id, m);
  seats.forEach((c, seat) => {
    if (c.bot) return;
    c.match = m; c.seat = seat;
    send(c.ws, matchMsg(m, seat));
  });
  pushState(m, []);
  broadcastOnline();
}
function matchMsg(m, seat, resumed = false) {
  return {
    t: 'match', matchId: m.id, seat, secret: m.secrets[seat], format: m.format, resumed,
    players: m.seats.map((c) => ({ name: c.name, avatar: c.avatar, bot: !!c.bot })),
  };
}

function whoMustAct(m) {
  const s = m.state;
  if (s.phase === 'over') return null;
  if (s.chain.length) return s.priority;
  return s.active;
}

function armTimer(m) {
  clearTimeout(m.timer);
  const s = m.state;
  if (s.phase === 'over') { m.deadline = null; return; }
  let secs;
  let kind;
  if (s.phase === 'setup') { secs = SETUP_SECONDS; kind = 'setup'; }
  else if (s.chain.length) { secs = RESPONSE_SECONDS; kind = 'response'; }
  else { secs = TURN_SECONDS; kind = 'turn'; }
  const key = kind + ':' + s.turnSerial + ':' + s.active + ':' + s.chain.length + ':' + s.priority;
  if (m.deadlineKey !== key) { m.deadline = Date.now() + secs * 1000; m.deadlineKey = key; m.deadlineKind = kind; }
  m.timer = setTimeout(() => onTimeout(m), Math.max(0, m.deadline - Date.now()) + 50);
}

function onTimeout(m) {
  const s = m.state;
  if (m.over) return;
  const p = whoMustAct(m);
  if (p === null || p === undefined) return;
  apply(m, p, s.phase === 'setup' ? { type: 'ready' } : s.chain.length ? { type: 'pass' } : { type: 'endTurn' });
}

function pushState(m, events) {
  armTimer(m);
  m.seats.forEach((c, seat) => {
    if (c.bot) return;
    send(c && c.ws, { t: 'state', view: viewFor(m.state, seat), events: redactEvents(events, seat), deadline: m.deadline, deadlineKind: m.deadlineKind, now: Date.now() });
  });
  if (m.state.phase === 'over' && !m.over) {
    m.over = true;
    clearTimeout(m.timer);
    clearTimeout(m.botTimer);
    setTimeout(() => matches.delete(m.id), 10 * 60 * 1000);
    broadcastOnline();
    return;
  }
  scheduleBot(m, events.length ? 250 + events.length * 120 : 400);
}

function apply(m, seat, action) {
  const r = m.game.act(seat, action);
  if (!r.ok) return r;
  pushState(m, r.events);
  return r;
}

// Bots think on the server and act one step at a time so clients can animate.
function scheduleBot(m, delay) {
  clearTimeout(m.botTimer);
  const p = whoMustAct(m);
  if (p === null || p === undefined || !m.seats[p] || !m.seats[p].bot || m.over) return;
  m.botTimer = setTimeout(() => {
    if (m.over || whoMustAct(m) !== p) return;
    const bot = m.seats[p];
    let plan = [];
    try { plan = aiPlan(m.state, p, bot.difficulty, crypto.randomInt(2 ** 30)); } catch (e) { console.error('bot error', e); }
    const s = m.state;
    const fallback = s.phase === 'setup' ? { type: 'ready' } : s.chain.length ? { type: 'pass' } : { type: 'endTurn' };
    bot.plans = bot.turn === s.turnSerial ? (bot.plans || 0) + 1 : 1;
    bot.turn = s.turnSerial;
    const a = plan && plan.length && bot.plans < 60 ? plan[0] : fallback;
    const r = apply(m, p, a);
    if (!r.ok) apply(m, p, fallback);
  }, Math.min(2500, delay));
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
    try { handle(c, msg); } catch (e) { console.error('handler error', e); }
  });
  ws.on('close', () => {
    clients.delete(ws);
    leaveLobby(c);
    const m = c.match;
    if (m && !m.over && m.seats[c.seat] === c) {
      const seat = c.seat;
      m.gone[seat] = Date.now();
      notifyOthers(m, seat, { t: 'opponentLeft', name: c.name, grace: DISCONNECT_GRACE });
      setTimeout(() => {
        if (!m.over && m.gone[seat] && Date.now() - m.gone[seat] >= DISCONNECT_GRACE * 1000 - 100) {
          apply(m, seat, { type: 'concede' });
        }
      }, DISCONNECT_GRACE * 1000);
    }
    broadcastOnline();
  });
});

function notifyOthers(m, seat, msg) { m.seats.forEach((o, q) => { if (q !== seat && !o.bot) send(o.ws, msg); }); }

function setProfile(c, msg) {
  if (typeof msg.name === 'string') c.name = msg.name.replace(/[^\p{L}\p{N} _\-'.!?]/gu, '').slice(0, 20) || 'Wanderer';
  if (typeof msg.avatar === 'string') c.avatar = [...msg.avatar].slice(0, 8).join('');
  if (msg.deck && typeof msg.deck === 'object') c.deck = msg.deck;
}
function deckOk(c) {
  const v = validateDeck(c.deck);
  if (!v.ok) send(c.ws, { t: 'error', msg: v.errors[0] });
  return v.ok;
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
      if (!deckOk(c)) return;
      if (c.match && !c.match.over) { send(c.ws, { t: 'error', msg: 'You are already in a match.' }); return; }
      leaveLobby(c);
      const other = queue.find((q) => q !== c && q.ws.readyState === 1);
      if (other) startMatch([other, c], '1v1');
      else { queue.push(c); send(c.ws, { t: 'queued' }); }
      break;
    }
    case 'createRoom': {
      setProfile(c, msg);
      if (!deckOk(c)) return;
      leaveLobby(c);
      const format = FORMATS[msg.format] ? msg.format : '1v1';
      const room = { code: roomCode(), host: c, format, members: [c], botDifficulty: 5 };
      rooms.set(room.code, room);
      c.room = room.code;
      broadcastRoom(room);
      break;
    }
    case 'joinRoom': {
      setProfile(c, msg);
      if (!deckOk(c)) return;
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || room.host === c || room.host.ws.readyState !== 1) { send(c.ws, { t: 'error', msg: 'No room with that code.' }); return; }
      if (room.members.length >= FORMATS[room.format].players) { send(c.ws, { t: 'error', msg: 'That room is full.' }); return; }
      leaveLobby(c);
      room.members.push(c);
      c.room = room.code;
      broadcastRoom(room);
      // a full duel room starts right away
      if (room.format === '1v1' && room.members.length === 2) { rooms.delete(room.code); startMatch(room.members.slice(), '1v1'); }
      break;
    }
    case 'roomSettings': {
      const room = c.room && rooms.get(c.room);
      if (!room || room.host !== c) return;
      if (FORMATS[msg.format] && FORMATS[msg.format].players >= room.members.length) room.format = msg.format;
      if (msg.botDifficulty) room.botDifficulty = Math.max(1, Math.min(10, msg.botDifficulty | 0));
      broadcastRoom(room);
      break;
    }
    case 'startRoom': {
      const room = c.room && rooms.get(c.room);
      if (!room || room.host !== c) return;
      const need = FORMATS[room.format].players;
      const seats = room.members.slice(0, need);
      const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      while (seats.length < need) {
        const [name, avatar] = names.pop();
        seats.push({ bot: true, name, avatar, difficulty: room.botDifficulty });
      }
      // 2v2: keep humans on the same team when there are exactly two (seats 0 and 2 are partners)
      if (room.format === '2v2' && room.members.length === 2 && msg.humansTogether) [seats[1], seats[2]] = [seats[2], seats[1]];
      rooms.delete(room.code);
      startMatch(seats, room.format);
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
      m.seats.forEach((s) => { if (!s.bot) send(s.ws, { t: 'emote', seat: c.seat, id }); });
      break;
    }
    case 'resume': {
      const m = matches.get(msg.matchId);
      if (!m || m.over) { send(c.ws, { t: 'resumeFailed' }); return; }
      const seat = m.secrets.indexOf(msg.secret);
      if (seat < 0 || m.seats[seat].bot) { send(c.ws, { t: 'resumeFailed' }); return; }
      const old = m.seats[seat];
      if (old && old !== c && old.ws.readyState === 1) old.ws.close();
      m.seats[seat] = c;
      m.gone[seat] = null;
      c.match = m; c.seat = seat;
      c.name = m.state.players[seat].name;
      send(c.ws, matchMsg(m, seat, true));
      send(c.ws, { t: 'state', view: viewFor(m.state, seat), events: [], deadline: m.deadline, deadlineKind: m.deadlineKind, now: Date.now() });
      notifyOthers(m, seat, { t: 'opponentBack', name: c.name });
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
