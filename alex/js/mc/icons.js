// Minecraft-style 16×16 item icons, drawn from little pixel templates (tools, ingots,
// gems, food, mob drops…) or as isometric pixel cubes (blocks). Cached as data URLs
// for the UI and as canvases for in-world dropped-item sprites.

import { MC, MC_GEAR, mcInfo, ORES } from './data.js';

// Palette letters: k outline · d dark · a base · h light · w white · b second colour ·
// e dark second colour · s/t stick brown · g glow
const TPL = {
  pick: ['', '....kkkkkk', '...khhhhhhkk', '....kkkaaahhk', '.......kkaaahk', '........ktkaahk', '.......ktskkaak', '......ktsk..kak', '.....ktsk...kak', '....ktsk.....kk', '...ktsk', '..ktsk', '.ktsk', '.kkk'],
  sword: ['', '............kkk', '...........khak', '..........khak', '.........khak', '........khak', '.......khak', '..kk..khak', '..ktkkhak', '...kthak', '....ktk', '...ktktk', '..ktk.ktk', '.kkk...kk'],
  ingot: ['', '', '', '', '....kkkkkkkk', '...khhhhhhhhk', '..khhaaaaaaahk', '.kaaaaaaaaaaaak', '.kaaaaaaaaaaaak', '.kddddddddddddk', '..kkkkkkkkkkkk'],
  gem: ['', '', '.....kkkkkk', '....khhwhhak', '...khwhhhaaak', '..khhhhhaaaadk', '..kaaaaaaaaadk', '...kaaaaaaadk', '....kaaaaadk', '.....kaaadk', '......kadk', '.......kk'],
  raw: ['', '', '', '......kkkk', '....kkhhaakk', '...khhhaaaadk', '..khhaabaaaadk', '..kaaaaaabadk', '..kabaaaaaaadk', '...kaaaabaadk', '....kkddddkk', '......kkkk'],
  coal: ['', '', '', '......kkkk', '....kkaahakk', '...kaaahaaadk', '..kahaaaaahadk', '..kaaaahaaadk', '..kaaaaaaahadk', '...kahaaaaadk', '....kkddddkk', '......kkkk'],
  nugget: ['', '', '', '', '', '', '......kkkk', '.....khhaak', '....khhaaadk', '....kaaaaadk', '.....kdddk', '......kkk'],
  dust: ['', '', '', '', '', '', '', '', '.......h', '.....a.haa.h', '....ahaaadaa', '...aaahadaadaa', '..adaaaaddaaada', '...dddddddddd'],
  stick: ['', '...........kk', '..........ksk', '.........ksk', '........ksk', '.......ksk', '......ksk', '.....ksk', '....ksk', '...ksk', '..ktk', '..kk'],
  rod: ['', '...........kk', '..........kgk', '.........khk', '........kgk', '.......khk', '......kgk', '.....khk', '....kgk', '...khk', '..kgk', '..kk'],
  pearl: ['', '', '.....kkkkkk', '....khhhaaak', '...khwhaaaaak', '..khhhaabaaadk', '..khaaabbbaadk', '..kaaabbbbbadk', '..kaaaabbbaadk', '..kdaaaabaaddk', '...kdaaaaaddk', '....kdddddddk', '.....kkkkkkk'],
  eye: ['', '', '.....kkkkkk', '....khhhaaak', '...khwhbbbaak', '..khhbbbbbbadk', '..khabbkkbbadk', '..kaabbkkbbadk', '..kaaabbbbaadk', '..kdaaabbaaddk', '...kdaaaaaddk', '....kdddddddk', '.....kkkkkkk'],
  string: ['', '', '', '..a', '...a.......a', '...a......a.a', '....a....a...a', '.....a..a', '......aa', '......a.a', '.....a...a', '....a.....a', '...a.......a'],
  feather: ['', '.............k', '...........kak', '.........kahak', '........kahaak', '.......kahaak', '......kahaak', '.....kahaak', '....kahak', '...kdhak', '..kdkk', '.kdk', 'kk'],
  bone: ['', '...........kk', '..........khak', '..........khhak', '.........khakk', '........khak', '.......khak', '......khak', '.....khak', '..kkkhak', '.kahhak', '.kaaak', '..kak'],
  flesh: ['', '', '', '....kkkkk', '...kaabaak', '..kabaaabaak', '..kaaabbaaak', '.kabaaaaabak', '.kaaabaaaak', '..kaaaabak', '...kkaaak', '.....kkk'],
  leather: ['', '', '..kk......kk', '.kaak.kk.kaak', '.kahakaakahak', '..kaahaaaaak', '..kahaaaaaak', '.kaaaaaaaaaak', '.kahaaaaaaaak', '..kaaaaaaaak', '...kdaaaadk', '....kkkkkk'],
  ball: ['', '', '', '.....kkkkk', '....khhaaak', '...khwhaaaak', '...khhaaaadk', '...kaaaaaadk', '...kaaaaaddk', '....kdddddk', '.....kkkkk'],
  tear: ['', '', '.......k', '......kak', '......kak', '.....khaak', '....khwaaak', '....khhaaak', '...khaaaaadk', '...kaaaaaadk', '....kaaaadk', '.....kkkkk'],
  paper: ['', '', '...kkkkkkkk', '...kwwwwwwhk', '...kwwwwwwwhk', '...kwaaaaawwk', '...kwwwwwwwwk', '...kwaaaaaawk', '...kwwwwwwwwk', '...kwaaaawwwk', '...kwwwwwwwwk', '...kkkkkkkkkk'],
  book: ['', '', '..kkkkkkkkk', '.kaaaaaaaaakk', '.kahhhhhhhakbk', '.kaaaaaaaaakbk', '.kaahhhhhaakbk', '.kaaaaaaaaakbk', '.kaaaaaaaaakbk', '.kaaaaaaaaakbk', '.kddddddddkbk', '..kkkkkkkkkk'],
  wheat: ['', '......h.a', '.....hak.a', '......hakha', '.....ahakh', '......hak.a', '.....ahak', '......kak', '.....a.k.a', '......ak', '.......k', '.......k', '.......k'],
  apple: ['', '.......ks', '......kst.bb', '.......sbbe', '...kkkkskkkk', '..khhaaaaaaak', '.khwhaaaaaaadk', '.khhaaaaaaaadk', '.kaaaaaaaaaadk', '.kaaaaaaaaaddk', '..kdaaaaaaddk', '...kkdkkkdkk', '....kk...kk'],
  gapple: ['', '.......ks', '......kst.bb', '.......sbbe', '...kkkkskkkk', '..khhaaaaaaak', '.khwhaaaawaadk', '.khhaaaaaaaadk', '.kaaawaaaaaadk', '.kaaaaaaaaaddk', '..kdaaaaaaddk', '...kkdkkkdkk', '....kk...kk'],
  bread: ['', '', '', '', '.....kkkkkk', '...kkhhhhhhkk', '..khhahhahhaak', '.khahhahhahaadk', '.kaaaaaaaaaaadk', '.kddddddddddddk', '..kkkkkkkkkkkk'],
  flint: ['', '', '.......kk', '......khak', '.....khhak', '....khhaaak', '...khaaaadk', '...kaaaaaadk', '..khaaaaadk', '..kaaaaaddk', '...kaaddk', '....kkkk'],
  flintsteel: ['', '..kkkkkk', '.kaaaaaak', '.kak..kak', '.kak...kak', '.kak....kak', '..kk....kak', '.........kk', '......kkkk', '.....kbbbbk', '....kbeebk', '....kbbek', '.....kkk'],
  torch: ['', '', '......kkk', '.....kgwgk', '.....kgggk', '......kkk', '......ksk', '......ksk', '......ksk', '......ksk', '......ktk', '......ktk', '......kkk'],
  bow: ['', '.......kkkk', '.....kktta.', '....kt...a', '...kt....a', '..kt.....a', '..kt.....a', '..kt.....a', '..kt.....a', '...kt....a', '....kt...a', '.....kktta', '.......kkkk'],
  chest: ['', '..kkk....kkk', '.khhakkkkahak', '.khaaaaaaaaak', '.kaaaaaaaaaak', '..kaaaaaaaak', '..kahaaaaaak', '..kaaaaaaaak', '..kaaaaaaaak', '..kdaaaaaadk', '..kddddddddk', '...kkkkkkkk'],
  helmet: ['', '', '', '...kkkkkkkk', '..khhhhhhhak', '.khaaaaaaaaak', '.kaaaaaaaaaak', '.kaakkkkkkaak', '.kaak....kaak', '.kddk....kddk', '.kkkk....kkkk'],
  shield: ['', '..kkkkkkkkk', '..kaaaaaaaak', '..kaaabaaaak', '..kaabbbaaak', '..kaaabaaaak', '..kaaaaaaaak', '..kaaaaaaaak', '...kaaaaaak', '...kaaaaaak', '....kaaaak', '.....kkkk'],
  minecart: ['', '', '', '', '.kkkkkkkkkkkkk', '.khhhhhhhhhhak', '.kak........ak', '.kak........ak', '.kaaaaaaaaaaak', '.kddddddddddddk', '..kkk.....kkk', '..kbk.....kbk', '..kkk.....kkk'],
  egg: ['', '.....kkkk', '....kaabak', '...kaaaaaak', '...kabaaaaak', '..kaaaaabaak', '..kaabaaaaak', '..kaaaaaabak', '..kabaaaaaak', '..kaaaabaadk', '...kdaaaadk', '....kkkkkk'],
  glass: ['', 'kkkkkkkkkkkkkkkk', 'k..............k', 'k.ww...........k', 'k..ww..........k', 'k...w..........k', 'k..............k', 'k..........w...k', 'k.........ww...k', 'k........ww....k', 'k..............k', 'k..............k', 'kkkkkkkkkkkkkkkk'],
};

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(c, k) { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; }

function palette(c) {
  const a = c[0], b = c[1] || shade(c[0], -0.3);
  return { k: shade(a, -0.7), d: shade(a, -0.3), a, h: shade(a, 0.35), w: '#ffffff', b: b.startsWith('#') ? b : b, e: b.startsWith('#') ? shade(b, -0.35) : b, s: '#8f7040', t: '#5c4423', g: '#fde047' };
}

function drawTemplate(g, rows, c) {
  const P = palette(c);
  const y0 = Math.max(0, Math.floor((16 - rows.length) / 2));
  rows.forEach((row, y) => {
    for (let x = 0; x < Math.min(16, row.length); x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = P[ch] || c[0];
      g.fillRect(x, y + y0, 1, 1);
    }
  });
}

// Deterministic pixel noise for block faces (8 px for icons, 16 px for world blocks).
export function faceTex(kind, c, seed, n = 8) {
  const cv = document.createElement('canvas'); cv.width = cv.height = n;
  const g = cv.getContext('2d');
  const q = n / 8;
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const x = Math.floor(px / q), y = Math.floor(py / q);
    let col = c[0];
    if (kind === 'ore') col = (rnd() < 0.2 / q && x > 0 && y > 0 && x < 7 && y < 7) || (q > 1 && ((x * 7 + y * 13 + seed) % 11 === 0) && x > 0 && y > 0 && x < 7 && y < 7) ? shade(c[1], (rnd() - 0.5) * 0.3) : shade(c[0], (rnd() - 0.5) * 0.25);
    else if (kind === 'log') col = x % 3 === 0 ? shade(c[0], -0.25) : shade(c[0], (rnd() - 0.5) * 0.2);
    else if (kind === 'logtop') col = (Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5)) | 0) % 2 ? c[1] : shade(c[1], -0.15);
    else if (kind === 'planks') col = y % 4 === 3 ? shade(c[0], -0.3) : shade(c[0], (rnd() - 0.5) * 0.15);
    else if (kind === 'brick') col = y % 4 === 3 || (x + (y >> 2) * 4) % 8 === 0 ? shade(c[0], -0.35) : shade(c[c[1] && rnd() < 0.2 ? 1 : 0], (rnd() - 0.5) * 0.15);
    else if (kind === 'grassside') col = y < 2 || (y === 2 && rnd() < 0.5) ? shade(c[0], (rnd() - 0.5) * 0.2) : shade(c[1], (rnd() - 0.5) * 0.25);
    else if (kind === 'tnt') col = y >= 3 && y <= 4 ? '#f5f5f5' : shade(c[0], (rnd() - 0.5) * 0.15);
    else if (kind === 'furnace') col = x >= 2 && x <= 5 && y >= 4 && y <= 6 ? (y === 6 && rnd() < 0.5 ? '#f97316' : '#1a1a1a') : shade(c[0], (rnd() - 0.5) * 0.3);
    else if (kind === 'tabletop') col = (x === 0 || y === 0 || x === 7 || y === 7) ? shade(c[1], -0.2) : shade(c[0], (rnd() - 0.5) * 0.15);
    else if (kind === 'enchant') col = y < 2 ? '#dc2626' : y < 3 ? '#38bdf8' : shade(c[0], (rnd() - 0.5) * 0.3);
    else if (kind === 'glow') col = rnd() < 0.4 ? c[0] : shade(c[1], (rnd() - 0.3) * 0.3);
    else if (kind === 'leaves') col = rnd() < 0.18 ? shade(c[1], -0.4) : shade(c[0], (rnd() - 0.5) * 0.35);
    else if (kind === 'obsidian') col = rnd() < 0.12 ? c[1] : shade(c[0], (rnd() - 0.5) * 0.5);
    else if (kind === 'endframe') col = y < 2 ? shade('#2f6b5f', (rnd() - 0.5) * 0.3) : shade(c[0], (rnd() - 0.5) * 0.15);
    else if (kind === 'lava') col = shade(rnd() < 0.3 ? '#fde047' : '#f97316', (rnd() - 0.5) * 0.25);
    else col = shade(c[rnd() < 0.15 && c[2] ? 2 : rnd() < 0.25 && c[1] ? 1 : 0], (rnd() - 0.5) * 0.25);
    g.fillStyle = col;
    g.fillRect(px, py, 1, 1);
  }
  return cv;
}

// Isometric pixel cube (block items). top / left / right faces.
function drawCube(g, top, left, right) {
  g.imageSmoothingEnabled = false;
  // top: rhombus from (8,1) (15,4.5) (8,8) (1,4.5)
  g.save(); g.setTransform(7 / 8, 3.5 / 8, -7 / 8, 3.5 / 8, 8, 1); g.drawImage(top, 0, 0); g.restore();
  g.save(); g.setTransform(7 / 8, 3.5 / 8, 0, 7.5 / 8, 1, 4.5); g.drawImage(left, 0, 0); g.restore();
  g.save(); g.setTransform(7 / 8, -3.5 / 8, 0, 7.5 / 8, 8, 8); g.drawImage(right, 0, 0); g.restore();
  // shade the side faces
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.beginPath(); g.moveTo(1, 4.5); g.lineTo(8, 8); g.lineTo(8, 15.5); g.lineTo(1, 12); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.38)';
  g.beginPath(); g.moveTo(8, 8); g.lineTo(15, 4.5); g.lineTo(15, 12); g.lineTo(8, 15.5); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
}

const CUBES = {
  block: (c, s) => { const f = faceTex('noise', c, s); return [f, f, f]; },
  log: (c, s) => [faceTex('logtop', c, s), faceTex('log', c, s), faceTex('log', c, s + 1)],
  planks: (c, s) => { const f = faceTex('planks', c, s); return [f, f, f]; },
  table: (c, s) => [faceTex('tabletop', c, s), faceTex('planks', c, s), faceTex('planks', [c[1]], s)],
  furnace: (c, s) => [faceTex('noise', c, s), faceTex('furnace', c, s), faceTex('noise', c, s + 2)],
  enchant: (c, s) => [faceTex('noise', ['#dc2626'], s), faceTex('enchant', c, s), faceTex('enchant', c, s + 1)],
  tnt: (c, s) => [faceTex('noise', ['#f5f5f5', '#dc2626'], s), faceTex('tnt', c, s), faceTex('tnt', c, s + 1)],
  bed: (c, s) => [faceTex('noise', [c[0]], s), faceTex('noise', [c[1]], s), faceTex('planks', ['#b8945f'], s)],
  ore: (c, s) => { const f = faceTex('ore', c, s); return [f, f, faceTex('ore', c, s + 3)]; },
  grass: (c, s) => [faceTex('noise', [c[0]], s), faceTex('grassside', c, s), faceTex('grassside', c, s + 1)],
  brick: (c, s) => { const f = faceTex('brick', c, s); return [f, f, f]; },
  glow: (c, s) => { const f = faceTex('glow', c, s); return [f, f, f]; },
};

const cache = new Map();
let seedN = 1;
export function iconCanvas(id) {
  const key = id;
  if (cache.has(key)) return cache.get(key).canvas;
  const it = mcInfo(id) || (id.startsWith('ore:') ? { icon: 'ore', c: ORES[id.slice(4)]?.c || ['#777'], tex: ORES[id.slice(4)]?.tex } : null);
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  if (it) {
    let shape = it.icon;
    if (id.startsWith('ore:')) shape = { ore: 'ore', log: 'log', grass: 'grass', brick: 'brick', glow: 'glow', leaves: 'block', obsidian: 'block' }[it.tex] || 'block';
    if (CUBES[shape]) { const [t, l, r] = CUBES[shape](it.c, seedN++); drawCube(g, t, l, r); } else drawTemplate(g, TPL[shape] || TPL.raw, it.c);
  }
  cache.set(key, { canvas: cv, url: null });
  return cv;
}
export function iconURL(id) {
  iconCanvas(id);
  const e = cache.get(id);
  if (!e.url) e.url = e.canvas.toDataURL();
  return e.url;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// <span class="mci"> with the icon and a stack count, like a Minecraft slot.
export function iconHTML(id, n, title = true) {
  const it = mcInfo(id);
  return `<span class="mci"${title && it ? ` title="${esc(it.name)}"` : ''}><img src="${iconURL(id)}" alt="">${n > 1 ? `<b>${n}</b>` : ''}</span>`;
}
export const ALL_ICON_IDS = [...Object.keys(MC), ...Object.keys(MC_GEAR)];
