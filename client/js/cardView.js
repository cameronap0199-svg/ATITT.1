// Card rendering: frames, type layouts, procedural anime-style art, tilt/holo, detail modal.
import { getCard, sharedAbilityFor } from '../../shared/cards.js';
import { CLASS_ICONS, FACTION_ICONS, ARCHETYPE_ICONS, TYPE_ICONS } from '../../shared/constants.js';
import { variantParts } from '../../shared/packs.js';
import { hashString } from '../../shared/rng.js';
import { el, esc, modal } from './ui.js';
import { sfx } from './audio.js';

export const PRIMARY = ['#2f7d6a', '#8e3b52', '#46489e'];
export const SECONDARY = ['#f3c35f', '#68c3ff', '#c99bf0'];
export const ACCENT = ['#ff8fab', '#ffd166', '#8ff7ff'];
export const PATTERN_NAMES = ['Stripes', 'Dots', 'Waves'];
export const PRIMARY_NAMES = ['Jade', 'Crimson', 'Indigo'];
export const SECONDARY_NAMES = ['Sunrise', 'Skyfall', 'Twilight'];
export const ACCENT_NAMES = ['Blossom', 'Amber', 'Frost'];
export const RARITY_COLORS = { Base: '#4a8bff', Bronze: '#d4874a', Silver: '#cfd8e3', Gold: '#ffd24d', Crystal: '#7fd8ff', Void: '#b25cff', Infinite: '#ffffff' };

export const GLOSSARY = {
  BP: 'Body Points — health. At 0 the Identity is defeated (Structures crumble).',
  SP: 'Soul Points — damage dealt by attacks.',
  MP: 'Mind Points — spent on abilities and retaliation. Restores 2 at the start of your turn.',
  AP: 'Agility Points — tiles an Identity can move during its activation (diagonals allowed).',
  RP: 'Range Points — how far (in tiles) an Identity can attack or use targeted abilities.',
  Housing: 'How many living Identities can have been summoned through this Structure.',
  Sap: 'Your resource for playing cards. Refills each turn (3 on turn 1, +1 per turn, max 10).',
  Renown: 'Victory points. Gain 1 per Lane with your Structure each turn; more for destroying Structures and capturing Lanes. First to 20 wins.',
  Barrier: 'Prevents that much damage, then fades.',
  Guard: 'Reduces damage from each source.',
  Marked: 'Attacks against a Marked Identity deal extra damage.',
  Stasis: 'Cannot move or attack.',
  Response: 'Can be played while a chain is open — even on your opponent’s turn.',
  'Free Step': 'Move 1 tile without spending AP — usable even after an Identity’s activation ends.',
  Retaliation: 'When attacked and still standing, an Identity with the attacker in range automatically spends 1 MP to strike back for half its SP.',
  Collision: 'Forced movement that is blocked deals 1 damage.',
};

const TYPE_LABEL = { Identity: 'Identity', Zone: 'Zone', Structure: 'Structure', Equipment: 'Equipment', Consumable: 'Consumable', Action: 'Action', Event: 'Event' };

// ---------------------------------------------------------------------------
// Procedural art
// ---------------------------------------------------------------------------
const artCache = new Map();
export function artSVG(card, variant = 0) {
  const k = card.id + ':' + variant;
  if (artCache.has(k)) return artCache.get(k);
  const vp = variantParts(variant);
  const c1 = PRIMARY[vp.primary], c2 = SECONDARY[vp.secondary], c3 = ACCENT[vp.accent];
  let seed = hashString(card.id);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const id = ('a' + card.id + '-' + variant).replace(/[^\w-]/g, '');
  const parts = [];
  parts.push(`<defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset=".65" stop-color="${mix(c2, '#ffffff', 0.45)}"/><stop offset="1" stop-color="${mix(c1, '#ffffff', 0.3)}"/></linearGradient>
    <radialGradient id="${id}r" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".35" stop-color="${c3}" stop-opacity=".35"/><stop offset="1" stop-color="${c3}" stop-opacity="0"/></radialGradient>
  </defs>`);
  parts.push(`<rect width="100" height="100" fill="url(#${id}s)"/>`);
  const t = card.type;
  if (t === 'Action' || t === 'Event') {
    // anime speed lines / impact burst
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.1;
      const w = 0.03 + rnd() * 0.05;
      const x1 = 50 + Math.cos(a - w) * 90, y1 = 55 + Math.sin(a - w) * 90;
      const x2 = 50 + Math.cos(a + w) * 90, y2 = 55 + Math.sin(a + w) * 90;
      parts.push(`<polygon points="50,55 ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="${i % 2 ? '#ffffff' : c3}" opacity="${(0.18 + rnd() * 0.25).toFixed(2)}"/>`);
    }
    if (t === 'Event') parts.push(`<circle cx="50" cy="55" r="${30 + rnd() * 8}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5" stroke-dasharray="3 4"/>`);
  } else {
    // sunburst rays
    const n = 14;
    for (let i = 0; i < n; i += 2) {
      const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
      parts.push(`<polygon points="50,52 ${(50 + Math.cos(a1) * 90).toFixed(1)},${(52 + Math.sin(a1) * 90).toFixed(1)} ${(50 + Math.cos(a2) * 90).toFixed(1)},${(52 + Math.sin(a2) * 90).toFixed(1)}" fill="#ffffff" opacity=".13"/>`);
    }
  }
  parts.push(`<circle cx="50" cy="54" r="40" fill="url(#${id}r)"/>`);
  // background forest silhouettes
  const dark = mix(c1, '#000000', 0.35);
  if (t !== 'Action') {
    let ridge = 'M0,100 L0,' + (74 + rnd() * 6).toFixed(0);
    for (let x = 0; x <= 100; x += 8) ridge += ` L${x},${(66 + rnd() * 14).toFixed(0)}`;
    parts.push(`<path d="${ridge} L100,100 Z" fill="${mix(c1, '#ffffff', 0.15)}" opacity=".55"/>`);
    for (let i = 0; i < 7; i++) {
      const x = rnd() * 100, h = 14 + rnd() * 20, w = 5 + rnd() * 5, base = 92 + rnd() * 6;
      parts.push(`<polygon points="${x},${base - h} ${x - w},${base} ${x + w},${base}" fill="${dark}" opacity=".75"/>`);
    }
    parts.push(`<rect y="90" width="100" height="10" fill="${dark}"/>`);
  }
  // sparkles
  for (let i = 0; i < 6; i++) {
    const x = 6 + rnd() * 88, y = 6 + rnd() * 50, s = 1 + rnd() * 2.2;
    parts.push(`<path d="M${x},${y - s * 2} L${x + s * 0.5},${y - s * 0.5} L${x + s * 2},${y} L${x + s * 0.5},${y + s * 0.5} L${x},${y + s * 2} L${x - s * 0.5},${y + s * 0.5} L${x - s * 2},${y} L${x - s * 0.5},${y - s * 0.5} Z" fill="#fff" opacity="${(0.5 + rnd() * 0.5).toFixed(2)}"/>`);
  }
  const svg = `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${parts.join('')}</svg>`;
  artCache.set(k, svg);
  return svg;
}
function mix(a, b, t) {
  const pa = hex(a), pb = hex(b);
  const r = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// ---------------------------------------------------------------------------
// Card element
// ---------------------------------------------------------------------------
export function cardEl(cardId, opts = {}) {
  const card = typeof cardId === 'string' ? getCard(cardId) : cardId;
  const { width = 200, variant = 0, foil = false, mini = false, count = null, unowned = false, tilt = false, isNew = false, back = false, cls = '' } = opts;
  const root = el('div.card');
  root.style.setProperty('--w', width + 'px');
  if (back || !card) {
    root.classList.add('back');
    root.appendChild(el('div.c-frame'));
    return root;
  }
  const vp = variantParts(variant);
  root.style.setProperty('--c1', PRIMARY[vp.primary]);
  root.style.setProperty('--c2', SECONDARY[vp.secondary]);
  root.style.setProperty('--c3', ACCENT[vp.accent]);
  root.dataset.pattern = vp.pattern;
  root.dataset.id = card.id;
  root.classList.add('r-' + card.rarity.toLowerCase(), 't-' + card.type.toLowerCase());
  if (card.play && card.play.timing === 'response') root.classList.add('resp');
  if (mini) root.classList.add('mini');
  if (foil) root.classList.add('foil');
  if (unowned) root.classList.add('unowned');
  if (tilt) { root.classList.add('tilt'); attachTilt(root); }
  if (cls) root.className += ' ' + cls;

  const inner = el('div.c-inner');
  const head = el('div.c-head',
    el('div.c-cost', { 'data-tip': card.type === 'Identity' ? `<b>Sap cost</b> — Identity Stat Budget ${card.isb || '?'}` : '<b>Sap cost</b>' }, String(card.cost)),
    el('div.c-name', card.name),
    el('div.c-type', { 'data-tip': `<b>${TYPE_LABEL[card.type]}</b>` }, TYPE_ICONS[card.type] || '❔'));
  inner.appendChild(head);

  const art = el('div.c-art', { html: artSVG(card, variant) });
  art.appendChild(el('div.c-subject', card.emoji || '❔'));
  if (card.type === 'Zone') art.appendChild(el('div.c-lane', 'LANE ZONE'));
  if (card.type === 'Structure') {
    art.appendChild(el('div.c-badge.c-bp', { 'data-tip': '<b>Body Points</b>' }, String(card.bp)));
    art.appendChild(el('div.c-badge.c-hs', { 'data-tip': `<b>Housing</b> — ${GLOSSARY.Housing}` }, String(card.housing)));
  }
  if (card.type === 'Equipment') art.appendChild(el('div.c-ribbon', 'EQUIP'));
  if (card.type === 'Consumable') art.appendChild(el('div.c-ribbon', 'ONE USE'));
  if (card.type === 'Action') art.appendChild(el('div.c-timing', card.play && card.play.timing === 'response' ? '⚡ RESPONSE' : 'MAIN'));
  if (card.type === 'Event') {
    art.appendChild(el('div.c-timing', card.play && card.play.timing === 'response' ? '⚡ RESPONSE' : 'MAIN'));
    if (card.duration) art.appendChild(el('div.c-duration', '⏳ ' + card.duration));
  }
  inner.appendChild(art);

  inner.appendChild(el('div.c-tags',
    el('span', { 'data-tip': `<b>Class:</b> ${card.cls}` }, (CLASS_ICONS[card.cls] || '') + ' ' + card.cls),
    el('span', { 'data-tip': `<b>Faction:</b> ${card.faction}` }, (FACTION_ICONS[card.faction] || '') + ' ' + card.faction),
    card.archetype ? el('span', { 'data-tip': `<b>Archetype:</b> ${card.archetype}` }, (ARCHETYPE_ICONS[card.archetype] || '') + ' ' + card.archetype) : null));

  if (card.type === 'Identity' && card.stats) inner.appendChild(statRow(card.stats));

  if (!mini) {
    const text = el('div.c-text');
    if (card.type === 'Identity') {
      text.appendChild(el('div.ab.unique', { html: abilityHtml(card) }));
      if (card.shared) text.appendChild(el('div.ab.shared', { html: `<b>${esc(card.shared.name)}</b> <em>${esc(card.cls)} + ${esc(card.archetype)}</em> — ${esc(card.shared.text)}` }));
    } else {
      text.appendChild(el('div.ab', { html: keywordize(esc(card.text)) }));
      if (card.type === 'Consumable') text.appendChild(el('div.flavor', 'Discard after use.'));
    }
    if (card.flavor && width >= 260) text.appendChild(el('div.flavor', '“' + card.flavor + '”'));
    inner.appendChild(text);
    inner.appendChild(el('div.c-foot',
      el('span.slots', card.type === 'Identity' ? '⚔️🧪' : ''),
      el('span', card.id || ''),
      el('span', { style: { color: RARITY_COLORS[card.rarity] } }, card.rarity.toUpperCase())));
  }
  const frame = el('div.c-frame', inner);
  root.appendChild(frame);
  root.appendChild(el('div.c-shine'));
  if (foil) root.appendChild(el('div.foil-tag', 'FOIL'));
  if (count !== null && count !== undefined) root.appendChild(el('div.count-badge', '×' + count));
  if (isNew) root.appendChild(el('div.new-badge', 'NEW!'));
  return root;
}

export function statRow(stats, cur = null) {
  const row = el('div.c-stats');
  for (const k of ['bp', 'sp', 'mp', 'ap', 'rp']) {
    const v = cur ? cur[k] : stats[k];
    row.appendChild(el('div.st.' + k, { 'data-tip': `<b>${k.toUpperCase()}</b> — ${GLOSSARY[k.toUpperCase()]}` }, el('i', k.toUpperCase()), el('b', String(v))));
  }
  return row;
}

function abilityHtml(card) {
  const u = card.unique;
  if (!u) return '';
  if (u.combo) return `<b>${esc(u.name)}</b> — ${keywordize(esc(u.text))}`;
  if (u.active) return `<b>${esc(u.active.name)}</b> <span class="mpc">${u.active.cost} MP</span> ${keywordize(esc(u.text))}`;
  return `<b>${esc(u.name)}</b> — ${keywordize(esc(u.text))}`;
}
function keywordize(s) {
  return s.replace(/\b(Response)\b/g, '<b>$1</b>');
}

// Mouse-follow tilt + shine
export function attachTilt(node, strength = 14) {
  node.addEventListener('pointermove', (e) => {
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    node.style.setProperty('--mx', x * 100 + '%');
    node.style.setProperty('--my', y * 100 + '%');
    node.style.transform = `perspective(700px) rotateY(${(x - 0.5) * strength}deg) rotateX(${(0.5 - y) * strength}deg) scale(1.03)`;
  });
  node.addEventListener('pointerleave', () => { node.style.transform = ''; });
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------
export function showCardModal(cardId, { variant = 0, foil = false, owned = null, variants = null, extra = null } = {}) {
  const card = getCard(cardId);
  if (!card) return;
  sfx('flip');
  const big = cardEl(card, { width: Math.min(340, innerWidth * 0.8), variant, foil, tilt: true });
  const info = el('div.card-info.col');
  info.appendChild(el('h2', card.name));
  info.appendChild(el('div.row', { style: { flexWrap: 'wrap', gap: '6px' } },
    el('span.pill', { style: { borderColor: RARITY_COLORS[card.rarity], color: RARITY_COLORS[card.rarity] } }, '◆ ' + card.rarity),
    el('span.pill', TYPE_ICONS[card.type] + ' ' + card.type),
    el('span.pill', (CLASS_ICONS[card.cls] || '') + ' ' + card.cls),
    el('span.pill', (FACTION_ICONS[card.faction] || '') + ' ' + card.faction),
    card.archetype ? el('span.pill', (ARCHETYPE_ICONS[card.archetype] || '') + ' ' + card.archetype) : null));
  if (card.type === 'Identity') {
    info.appendChild(el('p.muted.tiny', `Identity Stat Budget ${card.isb} · ${card.cls} weights. Summon it next to one of your Structures with free Housing.`));
    info.appendChild(el('div', { html: `<h3>Unique Ability</h3><p>${abilityHtml(card)}</p>` }));
    if (card.shared) info.appendChild(el('div', { html: `<h3>Shared Ability · ${esc(card.cls)} + ${esc(card.archetype)}</h3><p><b>${esc(card.shared.name)}</b> — ${esc(card.shared.text)}</p>` }));
  } else {
    const how = {
      Zone: 'Play into an unclaimed Lane (or your own Lane with no Structure) to claim it. You can also capture an enemy Lane with no Structure if one of your Identities is in the enemy half of it.',
      Structure: 'Build in a Lane you control that has no Structure. Structures house Identities and generate Renown each turn.',
      Equipment: 'Attach to a friendly Identity (one Equipment each). Stays until the Identity leaves play.',
      Consumable: 'Attach to a friendly Identity (one Consumable each), then use it from the Identity panel. Discarded after use.',
      Action: card.play && card.play.timing === 'response' ? 'Response: play it any time you have priority — including in reply to an attack or card on your opponent’s turn.' : 'Play during your turn. Resolves immediately (unless your opponent responds).',
      Event: 'Play during your turn. Events create broad or lasting effects.',
    }[card.type];
    info.appendChild(el('div', { html: `<h3>Effect</h3><p>${esc(card.text)}</p><p class="muted tiny">${esc(how || '')}</p>` }));
  }
  if (card.flavor) info.appendChild(el('p.muted', { style: { fontStyle: 'italic' } }, '“' + card.flavor + '”'));
  if (owned !== null) info.appendChild(el('p', el('b', 'Owned: '), String(owned) + (owned ? '' : ' — find it in booster packs!')));
  if (variants && variants.length) {
    const names = variants.slice(0, 6).map((v) => { const p = variantParts(v); return `${PRIMARY_NAMES[p.primary]} · ${SECONDARY_NAMES[p.secondary]} · ${ACCENT_NAMES[p.accent]} · ${PATTERN_NAMES[p.pattern]}`; });
    info.appendChild(el('div', { html: `<h3>Your Versions</h3><p class="tiny muted">${names.map(esc).join('<br>')}</p>` }));
  }
  if (extra) info.appendChild(extra);
  const body = el('div.card-modal', el('div.center', big), info);
  return modal({ title: card.type, body, actions: [{ label: 'Close', cls: 'gold', value: true }] });
}

export function cardName(id) { const c = getCard(id); return c ? c.name : id; }
export { sharedAbilityFor };
