// PS1-style renderer: low-resolution render target, vertex snapping, affine texture
// warping, per-vertex (Gouraud) lighting, vertex fog and a dithered 15-bit colour
// post pass with film grain, vignette, CRT rows and horror distortion effects.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

export const MAXL = 8;

// Uniforms shared by every world material (same {value} objects, so one write updates all).
export const shared = {
  uTime: { value: 0 },
  uSnap: { value: new THREE.Vector2(320, 240) },
  uAffine: { value: 1 },
  uFogColor: { value: new THREE.Color(0xffffff) },
  uFogNear: { value: 6 },
  uFogFar: { value: 40 },
  uLPos: { value: Array.from({ length: MAXL }, () => new THREE.Vector3()) },
  uLCol: { value: Array.from({ length: MAXL }, () => new THREE.Vector3()) },
  uLRange: { value: new Array(MAXL).fill(1) },
  uLCount: { value: 0 },
  uGlobalWob: { value: 0 },
};

const VERT = /* glsl */`
#define MAXL ${MAXL}
uniform float uTime; uniform vec2 uSnap; uniform float uAffine; uniform float uWob; uniform float uGlobalWob;
uniform vec3 uLPos[MAXL]; uniform vec3 uLCol[MAXL]; uniform float uLRange[MAXL]; uniform int uLCount;
uniform float uFogNear; uniform float uFogFar; uniform float uFogMul;
uniform vec3 uProbe; uniform float uUseProbe; uniform float uEmissive; uniform float uDyn;
varying vec3 vUvW; varying vec3 vCol; varying float vFog;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float wob = uWob + uGlobalWob;
  if (wob > 0.0) {
    wp.x += sin(uTime * 1.3 + wp.y * 2.1 + wp.z * 0.7) * wob;
    wp.y += sin(uTime * 1.7 + wp.x * 1.9) * wob * 0.5;
    wp.z += cos(uTime * 1.1 + wp.y * 2.3 + wp.x * 0.6) * wob;
  }
  vec3 wn = normalize(mat3(modelMatrix) * normal);
  vec3 base = color;
  vec3 dyn = vec3(0.0);
  for (int i = 0; i < MAXL; i++) {
    if (i >= uLCount) break;
    vec3 d = uLPos[i] - wp.xyz;
    float dist = length(d);
    float att = clamp(1.0 - dist / uLRange[i], 0.0, 1.0);
    att *= att;
    float ndl = dot(wn, d / max(dist, 0.001)) * 0.5 + 0.5;
    dyn += uLCol[i] * att * ndl;
  }
  // baked geometry: colour already holds light, so add dynamic light; probe-lit objects: colour is albedo
  vec3 lit = mix(base + dyn * uDyn, base * (uProbe + dyn * uDyn), uUseProbe);
  vCol = mix(lit, base, uEmissive);
  vec4 vp = viewMatrix * wp;
  vec4 cp = projectionMatrix * vp;
  if (uSnap.x > 0.0 && cp.w > 0.0) {
    vec2 s = uSnap * 0.5;
    cp.xy = floor(cp.xy / cp.w * s + 0.5) / s * cp.w;
  }
  float w = mix(1.0, cp.w, uAffine);
  vUvW = vec3(uv * w, w);
  vFog = clamp((length(vp.xyz) - uFogNear) / max(uFogFar - uFogNear, 0.01), 0.0, 1.0) * uFogMul;
  gl_Position = cp;
}`;

const FRAG = /* glsl */`
uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; uniform float uAlphaTest;
uniform vec2 uRepeat; uniform vec2 uScroll; uniform vec3 uFogColor; uniform float uTime; uniform vec3 uAdd;
varying vec3 vUvW; varying vec3 vCol; varying float vFog;
void main() {
  vec2 uv = vUvW.xy / vUvW.z;
  vec4 t = texture2D(map, uv * uRepeat + uScroll * uTime);
  if (t.a < uAlphaTest) discard;
  vec3 c = t.rgb * uColor * vCol + uAdd;
  c = mix(c, uFogColor, vFog);
  gl_FragColor = vec4(c, t.a * uOpacity);
}`;

let whiteTex = null;
export function white() {
  if (!whiteTex) {
    whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    whiteTex.needsUpdate = true;
  }
  return whiteTex;
}

// opts: map, color, emissive(0..1), alphaTest, opacity, transparent, side, repeat[2], scroll[2],
//       wob, fog(bool), probe(bool: dynamic object lit by uProbe), dyn(0..1), depthWrite
export function mat(opts = {}) {
  const u = {
    ...shared,
    map: { value: opts.map || white() },
    uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
    uAdd: { value: new THREE.Color(0, 0, 0) },
    uEmissive: { value: opts.emissive ?? 0 },
    uOpacity: { value: opts.opacity ?? 1 },
    uAlphaTest: { value: opts.alphaTest ?? (opts.transparent ? 0.01 : 0.5) },
    uRepeat: { value: new THREE.Vector2(...(opts.repeat || [1, 1])) },
    uScroll: { value: new THREE.Vector2(...(opts.scroll || [0, 0])) },
    uWob: { value: opts.wob ?? 0 },
    uFogMul: { value: opts.fog === false ? 0 : 1 },
    uProbe: { value: new THREE.Vector3(1, 1, 1) },
    uUseProbe: { value: opts.probe ? 1 : 0 },
    uDyn: { value: opts.dyn ?? 1 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VERT, fragmentShader: FRAG, vertexColors: true,
    transparent: !!opts.transparent, side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? !opts.transparent,
  });
  m.userData.opts = opts;
  return m;
}

// Every geometry needs a colour attribute for the shared shader.
export function ensureColor(geo, color = 0xffffff) {
  if (!geo.getAttribute('color')) {
    const n = geo.getAttribute('position').count;
    const c = new THREE.Color(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return geo;
}

const POST_FRAG = /* glsl */`
uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime;
uniform float uDither; uniform float uLevels; uniform float uCRT; uniform float uVignette; uniform float uGrain;
uniform float uDesat; uniform vec3 uTint; uniform float uGlitch; uniform float uAberr; uniform vec3 uFadeColor;
uniform float uFade; uniform float uWarp; uniform float uBloom; uniform float uInvert;
varying vec2 vUv;
float hash(vec2 p) { p = mod(p, 512.0); return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
  float m[16];
  m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
  m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0;
  return 0.0;
}
void main() {
  vec2 uv = vUv;
  if (uWarp > 0.0) {
    uv.x += sin(uv.y * 9.0 + uTime * 1.3) * 0.006 * uWarp;
    uv.y += cos(uv.x * 7.0 + uTime * 1.1) * 0.004 * uWarp;
  }
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 30.0);
    float t = floor(uTime * 24.0);
    if (hash(vec2(band, t)) < uGlitch * 0.35) uv.x += (hash(vec2(t, band)) - 0.5) * 0.12 * uGlitch;
  }
  vec2 px = floor(uv * uRes);
  vec2 suv = (px + 0.5) / uRes;
  vec3 c;
  if (uAberr > 0.0) {
    float o = uAberr / uRes.x;
    c = vec3(texture2D(tScene, suv + vec2(o, 0.0)).r, texture2D(tScene, suv).g, texture2D(tScene, suv - vec2(o, 0.0)).b);
  } else c = texture2D(tScene, suv).rgb;
  if (uBloom > 0.0) {
    vec3 b = vec3(0.0);
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
      vec3 s = texture2D(tScene, suv + vec2(float(i), float(j)) * 2.0 / uRes).rgb;
      b += max(s - 0.62, 0.0);
    }
    c += b / 25.0 * uBloom * 2.2;
  }
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(l), uDesat);
  c *= uTint;
  c = mix(c, 1.0 - c, uInvert);
  c += (hash(px + fract(uTime * 7.13) * 100.0) - 0.5) * uGrain;
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * uVignette;
  if (uDither > 0.0) c += (bayer(px) - 0.5) / uLevels;
  c = floor(clamp(c, 0.0, 1.0) * uLevels + 0.5) / uLevels;
  if (uCRT > 0.0) c *= 1.0 - uCRT * 0.14 * step(0.62, fract(vUv.y * uRes.y));
  c = mix(c, uFadeColor, uFade);
  gl_FragColor = vec4(c, 1.0);
}`;

export class PS1Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.autoClear = true;
    this.targetHeight = 240;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
    });
    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(320, 240) }, uTime: shared.uTime,
        uDither: { value: 1 }, uLevels: { value: 31 }, uCRT: { value: 1 }, uVignette: { value: 1.1 }, uGrain: { value: 0.035 },
        uDesat: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uGlitch: { value: 0 }, uAberr: { value: 0 },
        uFadeColor: { value: new THREE.Color(0, 0, 0) }, uFade: { value: 1 }, uWarp: { value: 0 }, uBloom: { value: 0.6 },
        uInvert: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.postScene = new THREE.Scene();
    const q = new THREE.Mesh(tri, this.post); q.frustumCulled = false;
    this.postScene.add(q);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.vertexSnap = true;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get fx() { return this.post.uniforms; }

  setQuality(height) { this.targetHeight = height; this.resize(); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const th = this.targetHeight;
    const tw = Math.round(th * (w / h));
    this.rt.setSize(tw, th);
    this.post.uniforms.uRes.value.set(tw, th);
    shared.uSnap.value.set(this.vertexSnap ? tw * 0.5 : 0, this.vertexSnap ? th * 0.5 : 0);
    this.aspect = w / h;
  }

  setVertexSnap(on) { this.vertexSnap = on; this.resize(); }

  render(scene, camera) {
    camera.aspect = this.aspect; camera.updateProjectionMatrix();
    this.gl.setRenderTarget(this.rt);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCam);
  }
}

// Dynamic light pool: pick the MAXL lights nearest the camera each frame.
export class Lights {
  constructor() { this.list = []; }
  add(l) { this.list.push({ intensity: 1, range: 6, flicker: 0, on: true, ...l }); return this.list[this.list.length - 1]; }
  remove(l) { this.list = this.list.filter((x) => x !== l); }
  clear() { this.list = []; }
  update(camPos, t) {
    const act = this.list.filter((l) => l.on).map((l) => {
      const p = l.obj ? l.obj.getWorldPosition(tmpV) : l.pos;
      return { l, p: p.clone(), d: p.distanceToSquared(camPos) };
    }).sort((a, b) => a.d - b.d).slice(0, MAXL);
    act.forEach((a, i) => {
      let k = a.l.intensity;
      if (a.l.flicker) k *= 1 - a.l.flicker * (Math.sin(t * 23 + i * 7) * Math.sin(t * 7.1 + i) > 0.3 ? 0.85 : 0) * (Math.random() < 0.5 ? 1 : 0.6);
      shared.uLPos.value[i].copy(a.p);
      const c = a.l.color;
      shared.uLCol.value[i].set(c.r * k, c.g * k, c.b * k);
      shared.uLRange.value[i] = a.l.range;
    });
    shared.uLCount.value = act.length;
  }
}
const tmpV = new THREE.Vector3();
