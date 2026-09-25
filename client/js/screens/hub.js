// Main hub: JRPG command menu + player status + featured activities.
import { el, setScreen, fmt } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { getProfile, collectionCount, getDeck, deckValid } from '../profile.js';
import { RIVALS } from '../../../shared/decks.js';
import { cardCount } from '../../../shared/cards.js';
import { showLadder, showFreeBattle } from './ladder.js';
import { showShop } from './shop.js';
import { showCollection } from './collection.js';
import { showDeckBuilder } from './deckBuilder.js';
import { showOnline } from './online.js';
import { showRules } from './rules.js';
import { openSettings, topButtons } from './settings.js';

export function showHub() {
  playMusic('menu');
  document.body.classList.remove('battle-mode');
  const p = getProfile();
  const deck = getDeck();
  const valid = deckValid(deck);
  const nextRival = RIVALS.find((r) => !p.ladder.beaten.includes(r.id)) || RIVALS[RIVALS.length - 1];

  const items = [
    { ic: '⚔️', label: 'Adventure', sub: 'Climb the Rival Ladder', go: showLadder },
    { ic: '🎲', label: 'Free Battle', sub: 'Duel, 2v2 or FFA vs AI bots', go: showFreeBattle },
    { ic: '🌐', label: 'Online Duel', sub: 'Battle other players', go: showOnline },
    { ic: '🛒', label: 'Shop', sub: 'Buy booster packs', go: showShop, badge: p.packs ? `${p.packs} to open` : null },
    { ic: '🃏', label: 'Deck Workshop', sub: 'Build and tune decks', go: showDeckBuilder },
    { ic: '📖', label: 'Collection', sub: `${collectionCount()} / ${cardCount()} cards`, go: showCollection },
    { ic: '❓', label: 'How to Play', sub: 'Rules & controls', go: showRules },
    { ic: '⚙️', label: 'Settings', sub: 'Sound, speed, camera', go: () => openSettings() },
  ];
  const list = el('ul.menu-list');
  let focus = 0;
  const lis = items.map((it, i) => {
    const li = el('li.menu-item', { onclick: () => { sfx('confirm'); it.go(); }, onpointerenter: () => setFocus(i) },
      el('span.mi-ic.emoji', it.ic),
      el('span', it.label, el('span.sub', it.sub)),
      it.badge ? el('span.pill', { style: { marginLeft: 'auto', background: '#d11d56' } }, it.badge) : null);
    list.appendChild(li);
    return li;
  });
  const setFocus = (i) => { focus = (i + lis.length) % lis.length; lis.forEach((l, j) => l.classList.toggle('focus', j === focus)); };
  setFocus(0);

  const playerWin = el('div.win.gold',
    el('div.win-title', 'ADVENTURER'),
    el('div.player-card',
      el('div.avatar', p.avatar),
      el('div',
        el('div.player-name', p.name || 'Wanderer'),
        el('div.player-meta',
          el('span.pill.acorns', { 'data-tip': '<b>Acorns</b> — earned by playing. Spend them in the Shop.' }, fmt(p.points)),
          el('span.pill', { 'data-tip': 'Unopened booster packs' }, '🎁 ' + p.packs),
          el('span.pill', { 'data-tip': 'Wins / Losses' }, `🏆 ${p.stats.wins} / ${p.stats.losses}`),
          p.stats.streak > 1 ? el('span.pill', '🔥 ' + p.stats.streak) : null))));

  const deckWin = el('div.win',
    el('div.win-title', 'ACTIVE DECK'),
    el('div.row', { style: { justifyContent: 'space-between' } },
      el('div', el('b', deck.name), el('div.tiny', { cls: valid.ok ? 'deck-status ok' : 'deck-status bad' }, valid.ok ? `✔ Ready · ${valid.size} cards` : '✖ ' + valid.errors[0])),
      el('button.btn.small', { onclick: showDeckBuilder }, 'Edit')));

  const feature = el('div.win.feature', { onclick: showLadder, style: { '--rc': nextRival.color } },
    el('div.win-title', 'NEXT RIVAL'),
    el('h3', nextRival.name),
    el('p', nextRival.title + ' — “' + nextRival.quote + '”'),
    el('p', { style: { marginTop: '8px' } }, el('span.stars', '★'.repeat(Math.ceil(nextRival.difficulty / 2))), '  ', el('span.acorns', '+' + nextRival.reward)),
    el('div.f-ic', nextRival.avatar));

  const shopTile = el('div.win.feature' + (p.packs ? '.hot' : ''), { onclick: showShop },
    el('h3', p.packs ? 'Packs Waiting!' : 'Booster Shop'),
    el('p', p.packs ? `You have ${p.packs} unopened booster pack${p.packs > 1 ? 's' : ''}. Rip ’em open!` : 'Every pack: 12 cards, at least one Gold-or-better Wildcard.'),
    el('div.f-ic', '🎁'));
  const onlineTile = el('div.win.feature', { onclick: showOnline },
    el('h3', 'Online Battle'), el('p', 'Quick duels, or rooms for up to 4 players.'), el('div.f-ic', '🌐'));
  const collTile = el('div.win.feature', { onclick: showCollection },
    el('h3', 'Collection'),
    el('p', `${collectionCount()} of ${cardCount()} cards discovered.`),
    el('div.progress', { style: { marginTop: '10px', maxWidth: '70%' } }, el('div', { style: { width: (collectionCount() / cardCount()) * 100 + '%' } })),
    el('div.f-ic', '📖'));

  const news = el('div.win',
    el('div.win-title', 'TRAVELLER’S NOTES'),
    el('div.news', { html: `
      <p><b>Goal:</b> eliminate your rivals! A player is out once they have no Structures and no Identities left. Destroy Structures, then capture their Lanes with your own Zones.</p>
      <p><b>Tip:</b> Click an Identity to see where it can move (blue) and what it can hit (red). Hover an enemy to preview damage.</p>
      <p><b>Tip:</b> Identities fully heal at the start of their owner’s turn — focus fire to finish them. Attacks cost 2 MP, so high-MP Identities can strike several times!</p>
      <p><b>New:</b> 2v2 and Free-for-All battles for up to 4 players, against bots or online.</p>` }));

  const node = el('div.hub',
    el('div.hub-left', el('div.hub-logo', 'KNOTWOOD'), playerWin, el('div.win', list), deckWin),
    el('div.hub-right', el('div.hub-feature', feature, shopTile, onlineTile, collTile), news));
  const wrap = el('div', node, topButtons());
  setScreen(wrap);
  const onKey = (e) => {
    if (document.querySelector('.modal-back')) return;
    if (e.key === 'ArrowDown' || e.key === 's') { setFocus(focus + 1); sfx('cursor'); }
    else if (e.key === 'ArrowUp' || e.key === 'w') { setFocus(focus - 1); sfx('cursor'); }
    else if (e.key === 'Enter') lis[focus].click();
  };
  addEventListener('keydown', onKey);
  wrap.cleanup = () => removeEventListener('keydown', onKey);
}
