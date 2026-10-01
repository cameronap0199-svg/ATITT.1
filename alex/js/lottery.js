// K-POP lottery: three scratch-off games sold at the Gas Station kiosk. The outcome is
// rolled first (like a real printed ticket), then a card layout is generated that
// shows exactly that outcome. Pure data + rolls (tested headlessly); the scratching
// UI lives in ui/scratchoff.js and the prizes are paid out in shop.js.

import { poolFor } from './items.js';

export const TICKETS = {
  2: {
    id: 'lucky', price: 2, name: 'LUCKY LIGHTSTICK', tag: 'MATCH 3 SYMBOLS — WIN THAT PRIZE',
    colors: ['#ff4fa3', '#7b2cbf'], blurb: 'Cheap thrills. Wins a lot more than it used to.',
    // [weight, outcome]
    table: [
      [42, { type: 'nothing' }], [18, { type: 'money', amount: 2 }], [12, { type: 'money', amount: 4 }], [8, { type: 'money', amount: 5 }],
      [9, { type: 'money', amount: 10 }], [4, { type: 'money', amount: 25 }], [5, { type: 'item', pool: 'counter' }], [2, { type: 'unusual' }],
    ],
  },
  5: {
    id: 'bingo', price: 5, name: 'BIAS BINGO', tag: 'MATCH ANY OF YOUR NUMBERS TO A WINNING NUMBER',
    colors: ['#4cc9f0', '#3a0ca3'], blurb: 'Your bias number is in here somewhere. Probably.',
    table: [
      [42, { type: 'nothing' }], [15, { type: 'money', amount: 5 }], [13, { type: 'money', amount: 10 }], [8, { type: 'money', amount: 15 }],
      [8, { type: 'money', amount: 30 }], [3, { type: 'money', amount: 75 }], [8, { type: 'item', pool: 'snack' }], [3, { type: 'unusual' }],
    ],
  },
  10: {
    id: 'mega', price: 10, name: 'K-POP MEGA MILLIONS', tag: 'FIND 3 MATCHING AMOUNTS — BONUS BOX DOUBLES IT',
    colors: ['#ffd60a', '#b5179e'], blurb: 'Usually loses. Occasionally changes everything.',
    table: [
      [45, { type: 'nothing' }], [13, { type: 'money', amount: 10 }], [13, { type: 'money', amount: 20 }], [10, { type: 'money', amount: 40 }],
      [5, { type: 'money', amount: 100 }], [10, { type: 'item', pool: 'backwall' }], [1, { type: 'money', amount: 250 }], [1.5, { type: 'jackpot', amount: 500, pool: 'backwall' }],
    ],
  },
};
export const TICKET_PRICES = [2, 5, 10];

export function rollTicket(price, rng) {
  const t = TICKETS[price] || TICKETS[2];
  const pick = rng.weighted(t.table.map(([w, o]) => [o, w]));
  const res = { ...pick, price };
  delete res.pool;
  if (pick.type === 'item' || pick.type === 'jackpot') {
    const pool = poolFor(pick.pool).filter((k) => k !== 'bathroomKey');
    res.item = rng.pick(pool);
  }
  if (pick.type === 'unusual') res.unusual = rng.pick(UNUSUAL);
  // Mega Millions bonus box: sometimes doubles a cash win
  if (t.id === 'mega' && pick.type === 'money' && rng() < 0.18) { res.base = res.amount; res.amount *= 2; res.bonus = '2X'; }
  return res;
}

// How many of each ticket a kiosk has in stock this visit.
export function rollStock(rng) { return { 2: rng.int(3, 5), 5: rng.int(2, 4), 10: rng.int(1, 3) }; }

const UNUSUAL = ['hug', 'catPhoto', 'otherConcert', 'goldenStick'];
export const UNUSUAL_TEXT = {
  hug: 'A HUG FROM THE CASHIER. (Full heal. They did not look up.)',
  catPhoto: 'A PHOTO OF CAMERON\'S CAT. It is staring at you.',
  otherConcert: 'A TICKET TO A DIFFERENT CONCERT. (Teleports you to the pre-boss room.)',
  goldenStick: 'A GOLDEN LIGHTSTICK. +15% damage.',
};

// ---------------------------------------------------------------------------
// Card layouts: every scratch area gets content consistent with the outcome.
const LUCKY_SYMBOLS = [
  { s: '💖', amount: 2 }, { s: '🎤', amount: 4 }, { s: '🪄', amount: 5 }, { s: '⭐', amount: 10 }, { s: '💎', amount: 25 },
];
const MEGA_AMOUNTS = [10, 20, 40, 100, 250];

export function layoutTicket(res, rng) {
  const t = TICKETS[res.price];
  if (t.id === 'lucky') {
    // six symbols; a winning card has exactly one triple
    let win = null;
    if (res.type === 'money') win = LUCKY_SYMBOLS.find((x) => x.amount === res.amount).s;
    else if (res.type === 'item') win = '🎁';
    else if (res.type === 'unusual') win = '❓';
    const cells = [];
    if (win) cells.push(win, win, win);
    const others = rng.shuffle(LUCKY_SYMBOLS.map((x) => x.s).filter((s) => s !== win));
    // fill with at most pairs so no second triple appears
    let i = 0;
    while (cells.length < 6) { const s = others[i % others.length]; if (cells.filter((c) => c === s).length < 2) cells.push(s); i++; }
    return { kind: 'lucky', cells: rng.shuffle(cells), win, legend: LUCKY_SYMBOLS };
  }
  if (t.id === 'bingo') {
    const nums = rng.shuffle(Array.from({ length: 40 }, (_, k) => k + 1));
    const winning = [nums[0], nums[1]];
    const prizes = [5, 10, 15, 30, 75];
    const mine = [];
    for (let k = 0; k < 6; k++) mine.push({ n: nums[2 + k], prize: '$' + rng.pick(prizes), hit: false });
    if (res.type !== 'nothing') {
      const slot = rng.int(0, 5);
      mine[slot].n = rng.pick(winning);
      mine[slot].hit = true;
      mine[slot].prize = res.type === 'money' ? '$' + res.amount : res.type === 'item' ? '🎁 ITEM' : '❓ ???';
    }
    return { kind: 'bingo', winning, mine };
  }
  // mega: nine amounts + bonus box
  let win = null;
  if (res.type === 'money') win = '$' + (res.base || res.amount);
  else if (res.type === 'item') win = '🎁';
  else if (res.type === 'jackpot') win = '👑';
  const cells = [];
  if (win) cells.push(win, win, win);
  const pool = rng.shuffle([...MEGA_AMOUNTS.map((a) => '$' + a), '🎁', '👑'].filter((s) => s !== win));
  let i = 0;
  while (cells.length < 9) { const s = pool[i % pool.length]; if (cells.filter((c) => c === s).length < 2) cells.push(s); i++; }
  const bonus = res.type === 'jackpot' ? 'JACKPOT' : res.bonus || rng.pick(['TRY AGAIN', 'SO CLOSE', '♥ FIGHTING ♥', 'NOPE']);
  return { kind: 'mega', cells: rng.shuffle(cells), win, bonus };
}

// Description of the prize for the result banner.
export function prizeText(res, itemName) {
  if (res.type === 'nothing') return 'NOT A WINNER';
  if (res.type === 'money') return 'WINNER! $' + res.amount + (res.bonus ? ' (BONUS 2X!)' : '');
  if (res.type === 'item') return 'WINNER! ' + itemName;
  if (res.type === 'jackpot') return '★ JACKPOT ★ $' + res.amount + ' + ' + itemName + ' + IDOL CONTRACT';
  return UNUSUAL_TEXT[res.unusual];
}
