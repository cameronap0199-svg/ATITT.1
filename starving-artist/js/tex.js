// Procedural low-resolution textures, drawn on canvases and cached by key.
import * as THREE from 'three';

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function toTex(c, { repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const cache = new Map();
export function tex(key) {
  if (cache.has(key)) return cache.get(key);
  const fn = GEN[key];
  if (!fn) throw new Error('no texture ' + key);
  const t = toTex(fn());
  cache.set(key, t);
  return t;
}

function noise(g, w, h, amt, seed, base) {
  const r = rng(seed);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amt;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    if (base) img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

function checker(a, b, n = 8, size = 64, seed = 3) {
  const [c, g] = canvas(size, size);
  const s = size / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * s, y * s, s, s); }
  noise(g, size, size, 14, seed);
  return c;
}

function tiles(bg, line, n = 4, size = 32, seed = 5) {
  const [c, g] = canvas(size, size);
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  noise(g, size, size, 10, seed);
  g.fillStyle = line;
  const s = size / n;
  for (let i = 0; i < n; i++) { g.fillRect(i * s, 0, 1, size); g.fillRect(0, i * s, size, 1); }
  return c;
}

function stripes(a, b, n, size = 64, flowers = null, seed = 9) {
  const [c, g] = canvas(size, size);
  const s = size / n;
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * s, 0, s, size); }
  if (flowers) {
    const r = rng(seed);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(r() * size), y = Math.floor(r() * size);
      g.fillStyle = flowers[0]; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = flowers[1]; g.fillRect(x, y, 1, 1);
    }
  }
  noise(g, size, size, 12, seed);
  return c;
}

function plain(col, amt = 16, size = 32, seed = 2) {
  const [c, g] = canvas(size, size);
  g.fillStyle = col; g.fillRect(0, 0, size, size);
  noise(g, size, size, amt, seed);
  return c;
}

const GEN = {
  checkerPink: () => checker('#f4c6d6', '#fbf3f0', 8),
  checkerBW: () => checker('#1d1b24', '#e9e6ea', 8),
  checkerBlue: () => checker('#a9c7ee', '#f3f6fb', 8),
  checkerRed: () => checker('#5a1219', '#1a0b0e', 8),
  poolTile: () => tiles('#bfe6f2', '#8fc2d6', 4),
  poolTileDark: () => tiles('#5b8894', '#3f6570', 4),
  whiteTile: () => tiles('#ecebe6', '#bcbab3', 4),
  wallpaperCream: () => stripes('#efe3cc', '#e8d9bd', 8, 64, ['#e8a6b4', '#f6d36b']),
  wallpaperBlue: () => stripes('#cfe0f2', '#c3d6ec', 8, 64, ['#ffffff', '#f6d36b']),
  wallpaperKids: () => {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#f5d9e6'; g.fillRect(0, 0, 64, 64);
    const r = rng(12);
    const cols = ['#9ad0f5', '#ffe38a', '#b8e7b0', '#ffffff'];
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * 60), y = Math.floor(r() * 60);
      g.fillStyle = cols[i % 4];
      if (i % 3 === 0) { g.fillRect(x, y + 1, 5, 1); g.fillRect(x + 2, y - 1, 1, 5); g.fillRect(x + 1, y, 3, 3); }
      else if (i % 3 === 1) { g.beginPath(); g.arc(x + 2, y + 2, 2.5, 0, 7); g.fill(); }
      else { g.fillRect(x, y, 4, 2); g.fillRect(x + 1, y - 1, 2, 1); }
    }
    noise(g, 64, 64, 10, 12);
    return c;
  },
  wallpaperRot: () => {
    const c = stripes('#b9a98a', '#a8977a', 8, 64, ['#6b4a46', '#3a2a28'], 13);
    const g = c.getContext('2d');
    const r = rng(40);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(40,30,20,${0.2 + r() * 0.3})`; const x = r() * 64; g.fillRect(x, r() * 30, 1 + r() * 2, 10 + r() * 40); }
    return c;
  },
  marble: () => {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#f1eef2'; g.fillRect(0, 0, 64, 64);
    const r = rng(21);
    g.strokeStyle = 'rgba(160,150,190,0.5)';
    for (let i = 0; i < 5; i++) {
      g.beginPath(); let x = r() * 64, y = 0; g.moveTo(x, y);
      while (y < 64) { x += (r() - 0.5) * 10; y += 4 + r() * 6; g.lineTo(x, y); }
      g.stroke();
    }
    noise(g, 64, 64, 8, 21);
    return c;
  },
  plaster: () => plain('#ece7e0', 14, 32),
  plasterDark: () => plain('#403a44', 14, 32),
  concrete: () => {
    const c = plain('#77736e', 30, 64, 4);
    const g = c.getContext('2d');
    const r = rng(8);
    for (let i = 0; i < 20; i++) { g.fillStyle = `rgba(30,30,30,${r() * 0.25})`; g.fillRect(r() * 64, r() * 64, 2 + r() * 8, 1 + r() * 3); }
    return c;
  },
  wood: () => {
    const [c, g] = canvas(64, 64);
    const r = rng(31);
    for (let y = 0; y < 8; y++) {
      const off = Math.floor(r() * 64);
      const base = 120 + r() * 30;
      for (let x = 0; x < 64; x++) {
        const k = base + Math.sin((x + off) * 0.4) * 6 + (r() - 0.5) * 14;
        g.fillStyle = `rgb(${k * 1.05 | 0},${k * 0.72 | 0},${k * 0.45 | 0})`;
        g.fillRect(x, y * 8, 1, 8);
      }
      g.fillStyle = 'rgba(40,20,10,0.6)'; g.fillRect(0, y * 8, 64, 1); g.fillRect(off, y * 8, 1, 8);
    }
    return c;
  },
  woodDark: () => {
    const c = GEN.wood(); const g = c.getContext('2d');
    g.fillStyle = 'rgba(30,10,10,0.55)'; g.fillRect(0, 0, 64, 64); return c;
  },
  carpetRed: () => {
    const c = plain('#7a1a24', 22, 32, 7); const g = c.getContext('2d');
    g.fillStyle = '#c9a24a'; g.fillRect(0, 0, 32, 2); g.fillRect(0, 30, 32, 2); return c;
  },
  carpetKids: () => {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#2d3a78'; g.fillRect(0, 0, 64, 64);
    const r = rng(77); const cols = ['#f6d36b', '#e8637a', '#6fd3c1', '#b28cf0'];
    for (let i = 0; i < 18; i++) {
      g.fillStyle = cols[i % 4]; const x = r() * 60, y = r() * 60;
      if (i % 2) g.fillRect(x, y, 4, 4); else { g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x + 3, y); g.lineTo(x + 6, y + 5); g.fill(); }
    }
    noise(g, 64, 64, 18, 77); return c;
  },
  carpetBeige: () => plain('#b9a88e', 22, 32, 17),
  grass: () => {
    const [c, g] = canvas(32, 32);
    g.fillStyle = '#7fc36b'; g.fillRect(0, 0, 32, 32);
    const r = rng(41);
    for (let i = 0; i < 120; i++) { g.fillStyle = r() < 0.5 ? '#95d77c' : '#5fa856'; g.fillRect(r() * 32 | 0, r() * 32 | 0, 1, 2); }
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#fff', '#ffe36e', '#f6a6c1'][i % 3]; g.fillRect(r() * 32 | 0, r() * 32 | 0, 1, 1); }
    return c;
  },
  water: () => {
    const [c, g] = canvas(32, 32);
    g.fillStyle = '#7fd0ea'; g.fillRect(0, 0, 32, 32);
    const r = rng(51);
    for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.6)' : 'rgba(80,160,210,0.6)'; g.fillRect(r() * 32 | 0, r() * 32 | 0, 3 + r() * 5 | 0, 1); }
    return c;
  },
  sheet: () => plain('#dcd8d0', 12, 32, 61),
  curtain: () => {
    const [c, g] = canvas(32, 32);
    for (let x = 0; x < 32; x++) { const k = 110 + Math.sin(x * 0.8) * 40; g.fillStyle = `rgb(${k | 0},${k * 0.12 | 0},${k * 0.18 | 0})`; g.fillRect(x, 0, 1, 32); }
    return c;
  },
  brick: () => {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#5b5550'; g.fillRect(0, 0, 64, 64);
    const r = rng(19);
    for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) {
      const k = 130 + r() * 40;
      g.fillStyle = `rgb(${k | 0},${k * 0.55 | 0},${k * 0.45 | 0})`;
      g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 8 + 1, 14, 6);
    }
    return c;
  },
  shelf: () => {
    const [c, g] = canvas(32, 32);
    g.fillStyle = '#3c3026'; g.fillRect(0, 0, 32, 32);
    const r = rng(23);
    for (let s = 0; s < 4; s++) {
      g.fillStyle = '#5c4a38'; g.fillRect(0, s * 8 + 7, 32, 1);
      let x = 1;
      while (x < 30) { const w = 1 + (r() * 3 | 0); const k = 80 + r() * 120; g.fillStyle = `rgb(${k | 0},${k * 0.8 | 0},${k * 0.6 | 0})`; g.fillRect(x, s * 8 + 1 + (r() * 2 | 0), w, 6); x += w + 1; }
    }
    return c;
  },
  ceilingTile: () => tiles('#e5e2d6', '#b5b1a3', 2, 32, 71),
  skyDay: () => {
    const [c, g] = canvas(128, 64);
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#7fb2f0'); gr.addColorStop(0.6, '#bcd8f7'); gr.addColorStop(1, '#fbe3ec');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    cloudsOn(g, 128, 64, 5, '#ffffff', 90);
    return c;
  },
  skyDusk: () => {
    const [c, g] = canvas(128, 64);
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#473a78'); gr.addColorStop(0.55, '#d77b9c'); gr.addColorStop(1, '#ffc38a');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    cloudsOn(g, 128, 64, 5, '#f7b7c3', 91);
    return c;
  },
  skyNight: () => {
    const [c, g] = canvas(128, 64);
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#07060f'); gr.addColorStop(0.7, '#1b1030'); gr.addColorStop(1, '#3b1426');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    const r = rng(92);
    for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.8 ? '#cfc8e8' : '#ffd9a0'; g.fillRect(r() * 128 | 0, r() * 44 | 0, 1, 1); }
    return c;
  },
  skyBlood: () => {
    const [c, g] = canvas(128, 64);
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#12040a'); gr.addColorStop(0.6, '#4a0c18'); gr.addColorStop(1, '#8a2a1c');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    cloudsOn(g, 128, 64, 4, '#2a0810', 93);
    return c;
  },
  skyWhite: () => {
    const [c, g] = canvas(128, 64);
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#f7efe6'); gr.addColorStop(1, '#fffaf2');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    cloudsOn(g, 128, 64, 3, '#ffffff', 94);
    return c;
  },
  skyVoid: () => {
    const [c, g] = canvas(128, 64);
    g.fillStyle = '#000000'; g.fillRect(0, 0, 128, 64);
    const r = rng(95);
    for (let i = 0; i < 40; i++) { g.fillStyle = '#ffffff'; g.fillRect(r() * 128 | 0, r() * 64 | 0, 1, 1); }
    return c;
  },
  cloud: () => {
    const [c, g] = canvas(64, 32);
    g.fillStyle = '#ffffff';
    const blobs = [[14, 20, 10], [26, 14, 12], [40, 17, 11], [51, 22, 8], [30, 23, 11]];
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#dfe7f7';
    g.fillRect(8, 26, 48, 3);
    return c;
  },
  eye: () => {
    const [c, g] = canvas(32, 16);
    g.fillStyle = '#f7f1ea'; g.beginPath(); g.ellipse(16, 8, 15, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#4a7bc8'; g.beginPath(); g.arc(16, 8, 5, 0, 7); g.fill();
    g.fillStyle = '#0a0a12'; g.beginPath(); g.arc(16, 8, 2.5, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillRect(17, 5, 2, 2);
    g.strokeStyle = '#2a1a1a'; g.lineWidth = 1; g.beginPath(); g.ellipse(16, 8, 15, 7, 0, 0, 7); g.stroke();
    return c;
  },
  paper: () => plain('#f4efe2', 10, 32, 101),
  canvasBlank: () => {
    const c = plain('#f6f2ea', 8, 32, 111); const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 32; i += 2) g.fillRect(0, i, 32, 1);
    return c;
  },
  fabricBlue: () => plain('#5a78b8', 18, 32, 121),
  fabricPink: () => plain('#e6a3bd', 18, 32, 122),
  fabricGreen: () => plain('#7aa071', 18, 32, 123),
  metal: () => {
    const c = plain('#8c8e94', 18, 32, 131); const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 4, 32, 1); g.fillRect(0, 20, 32, 1); return c;
  },
  elevator: () => {
    const [c, g] = canvas(32, 32);
    g.fillStyle = '#9c8a5f'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#7a6a45'; for (let i = 0; i < 32; i += 8) g.fillRect(i, 0, 1, 32);
    noise(g, 32, 32, 14, 141); return c;
  },
  void: () => plain('#060508', 6, 16, 151),
  static: () => {
    const [c, g] = canvas(64, 64);
    const r = rng(161);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const k = r() * 255 | 0; g.fillStyle = `rgb(${k},${k},${k})`; g.fillRect(x, y, 1, 1); }
    return c;
  },
};

function cloudsOn(g, w, h, n, col, seed) {
  const r = rng(seed);
  g.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const cx = r() * w, cy = h * 0.5 + r() * (h * 0.22), s = 3 + r() * 4;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx + (k - 2) * s * 0.9, cy + Math.sin(k * 2) * s * 0.3, s * (0.7 + r() * 0.5), 0, 7); g.fill(); }
  }
}

// ----- Text textures (weirdcore wall messages, signs, plaques) -----
export function textTex(text, { w = 128, h = 32, color = '#1a1a1a', bg = null, font = 'VT323, monospace', size = 18, align = 'center', italic = false, shadow = null } = {}) {
  const [c, g] = canvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = `${italic ? 'italic ' : ''}${size}px ${font}`;
  g.textAlign = align; g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lh = size * 1.05;
  lines.forEach((ln, i) => {
    const y = h / 2 + (i - (lines.length - 1) / 2) * lh;
    const x = align === 'center' ? w / 2 : 4;
    if (shadow) { g.fillStyle = shadow; g.fillText(ln, x + 1, y + 1); }
    g.fillStyle = color; g.fillText(ln, x, y);
  });
  // crunch to hard pixels
  const img = g.getImageData(0, 0, w, h);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0;
  g.putImageData(img, 0, 0);
  return toTex(c, { repeat: false });
}

// Face texture for NPC heads. mood: 'happy' | 'neutral' | 'sad' | 'blank' | 'scribbled'
export function faceTex(skin, hair, mood = 'neutral', { eyes = '#1b1622' } = {}) {
  const key = `face:${skin}:${hair}:${mood}:${eyes}`;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas(16, 16);
  g.fillStyle = skin; g.fillRect(0, 0, 16, 16);
  g.fillStyle = hair; g.fillRect(0, 0, 16, 4); g.fillRect(0, 0, 2, 8); g.fillRect(14, 0, 2, 8);
  if (mood === 'blank') { /* nothing: faceless */ }
  else if (mood === 'scribbled') {
    g.fillStyle = '#111';
    for (let i = 0; i < 18; i++) g.fillRect(3 + (i * 7) % 10, 5 + (i * 3) % 8, 2, 1);
  } else {
    g.fillStyle = eyes; g.fillRect(4, 7, 2, 2); g.fillRect(10, 7, 2, 2);
    g.fillStyle = 'rgba(230,120,130,0.6)'; g.fillRect(3, 10, 2, 1); g.fillRect(11, 10, 2, 1);
    g.fillStyle = '#6a2a30';
    if (mood === 'happy') { g.fillRect(6, 11, 4, 1); g.fillRect(5, 10, 1, 1); g.fillRect(10, 10, 1, 1); }
    else if (mood === 'sad') { g.fillRect(6, 11, 4, 1); g.fillRect(5, 12, 1, 1); g.fillRect(10, 12, 1, 1); }
    else g.fillRect(6, 11, 4, 1);
  }
  const t = toTex(c, { repeat: false });
  cache.set(key, t);
  return t;
}
