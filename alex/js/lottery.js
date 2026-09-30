// Lottery tickets: pure odds (tested headlessly). Effects are applied in shop.js.

import { poolFor } from './items.js';

export function rollTicket(price, rng) {
  const r = rng();
  if (price === 2) {
    if (r < 0.45) return { type: 'nothing' };
    if (r < 0.75) return { type: 'money', amount: rng.int(3, 6) };
    if (r < 0.9) return { type: 'money', amount: 10 };
    if (r < 0.98) return { type: 'item', item: rng.pick(poolFor('counter').filter((k) => k !== 'bathroomKey')) };
    return { type: 'unusual', unusual: rng.pick(UNUSUAL) };
  }
  if (price === 5) {
    if (r < 0.58) return { type: 'nothing' };
    if (r < 0.8) return { type: 'money', amount: rng.int(8, 14) };
    if (r < 0.9) return { type: 'money', amount: 25 };
    if (r < 0.97) return { type: 'item', item: rng.pick(poolFor('snack')) };
    return { type: 'unusual', unusual: rng.pick(UNUSUAL) };
  }
  if (r < 0.82) return { type: 'nothing' };
  if (r < 0.92) return { type: 'money', amount: rng.int(15, 25) };
  if (r < 0.97) return { type: 'item', item: rng.pick(poolFor('backwall')) };
  if (r < 0.994) return { type: 'money', amount: 60 };
  return { type: 'jackpot', amount: 150, item: rng.pick(poolFor('backwall')) };
}
const UNUSUAL = ['hug', 'catPhoto', 'otherConcert', 'goldenStick'];
export const UNUSUAL_TEXT = {
  hug: 'A HUG FROM THE CASHIER. (Full heal. They did not look up.)',
  catPhoto: 'A PHOTO OF CAMERON\'S CAT. It is staring at you.',
  otherConcert: 'A TICKET TO A DIFFERENT CONCERT. (Teleports you to the pre-boss room.)',
  goldenStick: 'A GOLDEN LIGHTSTICK. +15% damage.',
};
