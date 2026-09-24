// How to Play: rules reference (also shown inside battles).
import { el, setScreen, clear } from '../ui.js';
import { playMusic } from '../audio.js';
import { WIN_RENOWN, RENOWN_STRUCTURE_KILL, RENOWN_CAPTURE, RENOWN_LIBERATE, DECK_MIN, DECK_MAX, COPY_LIMIT, MP_REGEN, FORAGE_COST } from '../../../shared/constants.js';
import { showHub } from './hub.js';
import { topButtons } from './settings.js';

const SECTIONS = [
  ['🎯 Goal', `
    <h2>Goal of the Game</h2>
    <p>Two rivals battle for control of <b>Knotwood Forest</b>. The battlefield has <b>5 Lanes</b>. Claim Lanes with <b>Zones</b>, build <b>Structures</b> on them, summon <b>Identities</b> to fight, and earn <b>Renown</b>.</p>
    <p>The first player to reach <b>${WIN_RENOWN} Renown</b> wins. You also win instantly by controlling <b>all 5 Lanes</b> at the start of your turn (Dominion). If the game reaches round 30, the Renown leader wins.</p>
    <h3>Earning Renown</h3>
    <ul>
      <li><b>+1 Renown</b> at the start of your turn for each Lane you control that holds <b>your Structure</b>.</li>
      <li><b>+${RENOWN_STRUCTURE_KILL}</b> for destroying an enemy Structure.</li>
      <li><b>+${RENOWN_CAPTURE}</b> for capturing an enemy Lane with your own Zone.</li>
      <li><b>+${RENOWN_LIBERATE}</b> for liberating an undefended enemy Lane (see Lanes).</li>
    </ul>`],
  ['🗺️ Board', `
    <h2>The Battlefield</h2>
    <p>The board is 10 tiles wide and 8 tiles long. Each <b>Lane</b> is 2 tiles wide and runs from your edge to your opponent’s. Your half is the 4 rows nearest you.</p>
    <div class="diagram">${Array.from({ length: 80 }, (_, i) => `<div class="l${Math.floor((i % 10) / 2)} ${i >= 70 && (i % 10 === 2 || i % 10 === 3) ? 'base' : ''} ${i < 10 && (i % 10 === 6 || i % 10 === 7) ? 'foe' : ''}"></div>`).join('')}</div>
    <p>Each player starts with a <b>Homeland</b> Zone and a <b>Base Camp</b> Structure (12 BP, Housing 3) in their home Lane. Structures sit at the edge of their Lane, just behind your first row.</p>
    <p><b>Distance</b> is counted in tiles, diagonals included (a 3×3 square around a tile is “within 1”). Identities move one tile at a time in any of 8 directions.</p>`],
  ['⏱️ Turns', `
    <h2>Your Turn</h2>
    <ol>
      <li><b>Start:</b> refill your <b>Sap</b> (3 on your first turn, +1 each turn, up to 10; the second player gets +1 on their first turn). Gain Renown for Lanes. Your Identities refresh and restore ${MP_REGEN} MP. Draw a card (the first player skips this on turn 1).</li>
      <li><b>Main:</b> in any order — play cards, activate Identities, use abilities and items.</li>
      <li><b>End:</b> press <b>End Turn</b>. Undefended enemy Lanes you have pushed into may be liberated.</li>
    </ol>
    <h3>Forage</h3>
    <p>Once per turn you may spend <b>${FORAGE_COST} Sap</b> to discard a card from your hand and draw a new one — great for swapping out cards you can’t use yet.</p>
    <h3>Hand & Deck</h3>
    <p>Opening hand: 6 cards (always including a Zone and a Structure if your deck has them); you may redraw once. Hand limit 10 — extra draws are discarded. An empty deck costs 2 Renown per missed draw.</p>`],
  ['🃏 Cards', `
    <h2>The Seven Card Types</h2>
    <ul>
      <li><b>Identity</b> — your fighters. Summon one onto an empty tile next to your Structure that has free <b>Housing</b>. Each has a Unique Ability plus a Shared Ability from its Class + Archetype.</li>
      <li><b>Zone</b> — claims a Lane. Play it on an open Lane, or on your own Lane with no Structure (replacing the old Zone). To <b>capture</b> an enemy Lane: it must have no Structure and one of your Identities must stand in the enemy’s half of it.</li>
      <li><b>Structure</b> — build it in a Lane you control that has no Structure. Houses Identities and earns Renown. A Zone can’t be replaced while its Structure stands.</li>
      <li><b>Equipment</b> — attach to a friendly Identity (1 slot). Persistent upgrades.</li>
      <li><b>Consumable</b> — attach to a friendly Identity (1 slot), then use it from the Identity panel. Discarded after use.</li>
      <li><b>Action</b> — immediate tactical effects. Cards marked <b>⚡ Response</b> can be played during the chain, even on your opponent’s turn.</li>
      <li><b>Event</b> — broad or lasting battlefield effects.</li>
    </ul>
    <h3>Stats</h3>
    <ul>
      <li><b>BP</b> Body (health) · <b>SP</b> Soul (attack damage) · <b>MP</b> Mind (spent on abilities) · <b>AP</b> Agility (tiles moved) · <b>RP</b> Range (attack reach).</li>
      <li>Stats come from the Identity Stat Budget × Class weights: Silviculturists are sturdy, Hydrologists mobile & mindful, Understory swift, Poachers deadly, Foragers flexible.</li>
    </ul>`],
  ['⚔️ Combat', `
    <h2>Activations & Combat</h2>
    <p>Click one of your Identities to <b>activate</b> it. During its activation it may move up to its <b>AP</b>, <b>attack once</b>, and use each of its abilities once (paying MP) — in any order. Acting with a different Identity ends the previous activation. Summoned Identities can act right away.</p>
    <ul>
      <li><b>Attack:</b> target an enemy Identity or Structure within <b>RP</b> tiles. It takes damage equal to your SP (after bonuses and reductions).</li>
      <li><b>Retaliation:</b> if the defender survives and the attacker is within its RP, it automatically spends 1 MP to strike back for half its SP (rounded up).</li>
      <li><b>Forced movement:</b> pushes and pulls that are blocked cause 1 collision damage.</li>
      <li><b>Free Steps:</b> some effects let an Identity “move 1 tile” — it gets a Free Step it can use any time this turn, even after its activation.</li>
    </ul>
    <h3>The Chain (Responses)</h3>
    <p>When a player attacks or plays an Action/Event, their opponent may respond with a <b>⚡ Response</b> card. Responses stack and resolve <b>newest to oldest</b>. An attack whose target moved out of range misses; a card whose target is gone fizzles.</p>`],
  ['🚩 Lanes', `
    <h2>Controlling Lanes</h2>
    <ul>
      <li>Your Identities in a Lane you control are <b>defending</b>; in an enemy Lane they are <b>invading</b>. A Lane with Identities from both players is <b>contested</b>.</li>
      <li><b>Liberation:</b> at the end of your turn, any enemy Lane with <b>no enemy Structure</b> and <b>no enemy Identities</b>, where you have an Identity in the <b>enemy’s half</b>, becomes open again (+${RENOWN_LIBERATE} Renown).</li>
      <li><b>Capture:</b> play your own Zone on such a Lane (it needs no enemy Structure and one of your Identities in the enemy half) to take it over (+${RENOWN_CAPTURE}).</li>
      <li>Destroying a Structure earns +${RENOWN_STRUCTURE_KILL} Renown and stops its Lane’s income. Identities it housed stay in play.</li>
    </ul>`],
  ['🎴 Collecting', `
    <h2>Packs & Decks</h2>
    <p>You start with the 60-card <b>Beginner’s Grove</b> deck. Every match earns <b>Acorns</b> — more for wins, harder rivals, destroyed Structures and captured Lanes. Spend Acorns in the Shop on booster packs.</p>
    <p>Each booster has <b>12 cards</b>: 3 Identities, one of every other type, 2 weighted flex cards and a <b>Wildcard that is always Gold or better</b>. Rarities: Base, Bronze, Silver, Gold, Crystal, Void and the ultra-rare <b>Infinite</b> (about 1 in 33 packs). Extra copies beyond 3 are recycled into Acorns.</p>
    <p>Decks hold ${DECK_MIN}–${DECK_MAX} cards with up to ${COPY_LIMIT} copies of each card.</p>`],
  ['🎮 Controls', `
    <h2>Controls</h2>
    <ul>
      <li><b>Left-click</b> an Identity to select it; click a <span style="color:#8ec5ff">blue</span> tile to move, a <span style="color:#ff8d8d">red-ringed</span> enemy to attack. Hover an enemy to preview damage and counter-attacks.</li>
      <li><b>Click or drag</b> a card from your hand onto a glowing target to play it. Keys <span class="kbd">1</span>–<span class="kbd">9</span> select hand cards.</li>
      <li><b>Right-click</b> anything to inspect it · <span class="kbd">Esc</span> cancels.</li>
      <li><span class="kbd">Space</span> End Turn / Pass · <span class="kbd">Tab</span> next ready Identity · <span class="kbd">Z</span> undo move · <span class="kbd">G</span> Forage · <span class="kbd">L</span> battle log.</li>
      <li><b>Camera:</b> drag empty board or right-drag to pan · mouse wheel / pinch to zoom · middle-drag or <span class="kbd">Q</span>/<span class="kbd">E</span> to rotate · <span class="kbd">R</span>/<span class="kbd">F</span> tilt · <span class="kbd">WASD</span> pan · <span class="kbd">C</span> reset.</li>
      <li>Click an enemy to see its danger zone (where it can reach and hit next turn).</li>
    </ul>`],
];

export function rulesBody(compact = false) {
  const art = el('article.win.scroll', { style: compact ? { maxHeight: '64vh', boxShadow: 'none' } : {} });
  const nav = el('nav');
  const items = SECTIONS.map(([title, html], i) => {
    const it = el('div.menu-item', { style: { fontSize: '15px' }, onclick: () => show(i) }, title);
    nav.appendChild(it);
    return it;
  });
  const show = (i) => { art.innerHTML = SECTIONS[i][1]; items.forEach((it, j) => it.classList.toggle('focus', i === j)); art.scrollTop = 0; };
  show(0);
  return el('div.rules', { style: compact ? { height: 'auto' } : {} }, el('div.win', nav), art);
}

export function showRules() {
  playMusic('menu');
  const node = el('div.page', el('div.page-head', el('button.btn.ghost', { onclick: showHub }, '← Back'), el('h1', 'How to Play')), el('div.page-body', rulesBody()));
  setScreen(el('div', node, topButtons()));
  void clear;
}
