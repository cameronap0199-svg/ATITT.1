// How to Play: rules reference (also shown inside battles).
import { el, setScreen, clear } from '../ui.js';
import { playMusic } from '../audio.js';
import { DECK_MIN, DECK_MAX, COPY_LIMIT, HAND_SIZE, ATTACK_COST, LANE_W, LANE_L, SIZE } from '../../../shared/constants.js';
import { showHub } from './hub.js';
import { topButtons } from './settings.js';

const SECTIONS = [
  ['🎯 Goal', `
    <h2>Goal of the Game</h2>
    <p>Dominate <b>Knotwood Forest</b> by expanding your territory and <b>eliminating</b> the other players. The last player (or team) standing wins.</p>
    <p>You stay in the game as long as you control <b>at least one Structure or one Identity</b>. Lose every Structure <i>and</i> every Identity and you are eliminated. Destroying someone's last Structure doesn't knock them out while their Identities still stand.</p>
    <h3>Formats</h3>
    <ul>
      <li><b>1 vs 1</b> — a classic duel.</li>
      <li><b>2 vs 2</b> — two teams. A team wins when both opposing players are eliminated; teammates sit across from each other.</li>
      <li><b>Free-for-All</b> — up to 4 players, every one for themselves.</li>
    </ul>
    <p class="muted">Territory flows <b>Lane → Zone → Structure → Identity</b>: Lanes let you place Zones, Zones let you build Structures, Structures let you summon Identities.</p>`],
  ['🗺️ Battlefield', `
    <h2>The Battlefield</h2>
    <p>A square, tile-based board (${SIZE}×${SIZE}). Each player sits on one side with <b>three adjacent Home Lanes</b>, each <b>${LANE_W} tiles wide and ${LANE_L} tiles long</b>. Your side is always shown at the bottom.</p>
    <p>The dark middle is <b>the Void</b>: neutral no-man's-land. It can't be claimed and can't hold Zones or Structures, but Identities can cross and stand in it. Sides without a player are Void too.</p>
    <p>Each Lane holds <b>one Zone</b>, <b>one Structure</b>, and any number of Identities (as tiles and Housing allow).</p>
    <h3>Setup</h3>
    <p>Before the first turn, every player may place Zones into their own <b>Home Lanes</b>. Then turns go clockwise from a random first player.</p>`],
  ['🔄 Turn', `
    <h2>Turn Structure</h2>
    <ol>
      <li><b>Draw</b> — draw until you hold ${HAND_SIZE} cards. An empty deck reshuffles your discard pile.</li>
      <li><b>Zone</b> — claim Lanes / capture eligible enemy Lanes.</li>
      <li><b>Build</b> — build Structures on Zones you control.</li>
      <li><b>Summon</b> — summon Identities through Structures with free Housing.</li>
      <li><b>Equipment</b> — attach Equipment and Consumables.</li>
      <li><b>Movement &amp; Combat</b> — activate your Identities one at a time.</li>
      <li><b>End</b> — end-of-turn effects expire, then you may <b>discard any cards</b> you don't want (you'll draw back to ${HAND_SIZE} next turn).</li>
    </ol>
    <p>Playing a card moves you to its phase automatically, but you can't go back — e.g. once you summon, you can't build any more this turn. The phase tracker (bottom right) shows where you are; click a later phase to skip ahead.</p>
    <p><b>Actions and Events</b> can be played any time during your own turn. ⚡<b>Response</b> cards can also be played while a response sequence is open.</p>
    <p>At the start of each of your turns, your Identities fully recover their <b>BP and MP</b> — damage doesn't carry over, so finish your targets within a turn!</p>`],
  ['🚩 Territory', `
    <h2>Zones, Structures &amp; Capture</h2>
    <ul>
      <li><b>Zones</b> claim an unclaimed Lane. Your Home Lanes can be claimed at any time; any other Lane needs one of your Identities standing in it.</li>
      <li><b>Structures</b> are built on a tile inside a Lane you control (one per Lane). They have BP and <b>Housing</b>: how many of your living Identities may have been summoned through them (Shelter 3, Bastion 2, Den 5, Landmark 3, Facility 3).</li>
      <li>Identities are summoned onto any empty tile of that Structure's Lane. If a Structure falls, Identities it summoned stay in play.</li>
      <li>An enemy Zone can't be replaced while its Structure stands.</li>
    </ul>
    <h3>Capturing a Lane</h3>
    <ol>
      <li>Destroy the enemy Structure in that Lane.</li>
      <li>Its owner gets <b>their next turn to rebuild</b> — the Zone can't be replaced until then.</li>
      <li>If it's still unbuilt afterwards and you have an Identity in the Lane, play your own Zone there. The Lane is yours!</li>
    </ol>
    <p class="muted">Enemy Identities don't have to be cleared out first.</p>`],
  ['⚔️ Combat', `
    <h2>Movement &amp; Combat</h2>
    <p>Select an Identity to activate it. Each Identity may <b>move once per turn</b>, up to its <b>AP</b> in tiles (diagonals allowed, no passing through other units). After it starts attacking or using abilities, it can't keep moving unless an effect says so. Activating another Identity finishes the current one.</p>
    <ul>
      <li><b>Attack</b> any enemy Identity or Structure within <b>RP</b> tiles for damage equal to <b>SP</b>. Each attack costs <b>${ATTACK_COST} MP</b>.</li>
      <li><b>Abilities</b> cost MP too. An Identity can keep attacking and using abilities as long as it has the MP.</li>
      <li><b>Retaliation</b>: a surviving Identity that is attacked strikes back for its SP if the attacker is within its RP, paying the attack cost (${ATTACK_COST} MP) from its own MP. Toggle auto-retaliate in Settings.</li>
      <li>Other units don't block attacks; Structures can be attacked even with defenders nearby.</li>
      <li><b>Forced movement</b> that is blocked deals 1 collision damage.</li>
    </ul>
    <h3>Response sequence</h3>
    <p>When an attack, Action, Event or Consumable is used, every other player in turn may respond with a ⚡Response. The newest item resolves first. Attacks whose target has moved out of range miss.</p>`],
  ['🃏 Cards', `
    <h2>Card Types</h2>
    <ul>
      <li><b>Zone</b> — claims a Lane; may give ongoing effects.</li>
      <li><b>Structure</b> — BP, Housing and one ability; summons Identities into its Lane.</li>
      <li><b>Identity</b> — your fighters. Stats come from the Identity Stat Budget × Class weights: Silviculturists are sturdy, Hydrologists mobile &amp; mindful, Understory swift, Poachers deadly, Foragers flexible. Each has a unique ability plus a shared Class + Archetype ability. The number in the corner is its power <b>tier</b>.</li>
      <li><b>Equipment</b> — one per Identity; stays until it leaves play.</li>
      <li><b>Consumable</b> — one per Identity; use it later (some as ⚡Responses), then it's discarded.</li>
      <li><b>Action</b> / <b>Event</b> — tactical tricks and big battlefield-wide effects.</li>
    </ul>
    <h3>Decks</h3>
    <p>${DECK_MIN}–${DECK_MAX} cards, at most ${COPY_LIMIT} copies of any card. Include Zones (to claim your 3 Home Lanes) and Structures!</p>`],
  ['🎮 Controls', `
    <h2>Controls</h2>
    <ul>
      <li><b>Drag</b> a card onto the board, or click it and then click a glowing target.</li>
      <li>Click an Identity: blue tiles = where it can move, red rings = what it can hit. Click a target to attack.</li>
      <li>Right-click any card or unit to inspect it. Hover an enemy while one of yours is selected to preview damage.</li>
      <li>Camera: drag to pan, wheel to zoom, middle-drag to orbit, <span class="kbd">Q</span>/<span class="kbd">E</span> rotate, <span class="kbd">C</span> home view, <span class="kbd">V</span> whole battlefield.</li>
      <li><span class="kbd">Space</span> End Turn / Pass / Ready · <span class="kbd">Tab</span> next ready Identity · <span class="kbd">Z</span> undo move · <span class="kbd">L</span> battle log · <span class="kbd">1</span>–<span class="kbd">9</span> pick a hand card.</li>
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
