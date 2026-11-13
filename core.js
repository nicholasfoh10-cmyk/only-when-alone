import * as THREE from 'three';
THREE.ColorManagement.enabled = false;

export const $ = (id) => document.getElementById(id);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- renderer + post ----------------
export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.autoClear = true;
$('stage').appendChild(renderer.domElement);

const LOW_H = 210;
const rtOpts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false };
export const mainRT = new THREE.WebGLRenderTarget(360, LOW_H, rtOpts);
const phoneRT = new THREE.WebGLRenderTarget(80, 160, rtOpts);
const snapRT = new THREE.WebGLRenderTarget(180, 240, rtOpts);

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FS = `
uniform sampler2D tDiffuse; uniform vec2 res; uniform float time, flash, fade, red, stat, chroma, grain, levels, warp;
uniform vec3 tint;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
void main(){
  vec2 uv = vUv;
  float line = floor(uv.y * res.y);
  float tear = step(0.985, hash(vec2(line, floor(time * 18.0)))) * warp;
  uv.x += tear * (hash(vec2(line, time)) - 0.5) * 0.06;
  vec2 px = floor(uv * res);
  vec2 cuv = (px + 0.5) / res;
  float ca = chroma / res.x;
  vec3 col;
  col.r = texture2D(tDiffuse, cuv + vec2(ca, 0.0)).r;
  col.g = texture2D(tDiffuse, cuv).g;
  col.b = texture2D(tDiffuse, cuv - vec2(ca, 0.0)).b;
  col *= tint;
  float d = bayer(px) - 0.5;
  col = floor(col * levels + d + 0.5) / levels;
  float n = hash(px + fract(time * 7.13) * 91.7);
  col += (n - 0.5) * grain;
  col = mix(col, vec3(hash(px * 1.7 + floor(time * 30.0))), stat);
  col *= 0.9 + 0.1 * mod(px.y, 2.0);
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 1.35;
  col = mix(col, col * vec3(1.6, 0.28, 0.22) + vec3(0.06, 0.0, 0.0), red);
  col = mix(col, vec3(1.0), flash);
  col = mix(col, vec3(0.0), fade);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
function makePost(tex) {
  return new THREE.ShaderMaterial({
    vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    uniforms: {
      tDiffuse: { value: tex }, res: { value: new THREE.Vector2(360, LOW_H) }, time: { value: 0 },
      flash: { value: 0 }, fade: { value: 1 }, red: { value: 0 }, stat: { value: 0 }, chroma: { value: 1 },
      grain: { value: 0.07 }, levels: { value: 22 }, warp: { value: 0.3 }, tint: { value: new THREE.Vector3(1, 1, 1) },
    },
  });
}
const postMat = makePost(mainRT.texture);
export const P = postMat.uniforms;
const phoneMat = makePost(phoneRT.texture);
const PP = phoneMat.uniforms;
PP.fade.value = 0; PP.tint.value.set(0.85, 1.05, 0.9); PP.grain.value = 0.12; PP.levels.value = 14; PP.chroma.value = 1.5;
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
const phoneScene = new THREE.Scene(); phoneScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), phoneMat));

export const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 90);
export const L_TRUE = 1, L_MASK = 2;
camera.layers.set(0); camera.layers.enable(L_MASK);
const phoneCam = new THREE.PerspectiveCamera(56, 0.5, 0.05, 90);
phoneCam.layers.set(0); phoneCam.layers.enable(L_TRUE);
export function setLayer(o, n) { o.traverse((c) => c.layers.set(n)); }

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  const w = Math.round(LOW_H * innerWidth / innerHeight);
  mainRT.setSize(w, LOW_H); P.res.value.set(w, LOW_H);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const v1 = new THREE.Vector3(), q1 = new THREE.Quaternion();
export function renderFrame(scene, phone) {
  renderer.setRenderTarget(mainRT); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  if (!phone.visible) return;
  const r = $('scr').getBoundingClientRect(); if (r.width < 4) return;
  camera.getWorldPosition(v1); camera.getWorldQuaternion(q1);
  phoneCam.layers.set(0); phoneCam.layers.enable(phone.truth === false ? L_MASK : L_TRUE);
  phoneCam.position.copy(v1); phoneCam.quaternion.copy(q1);
  phoneCam.aspect = r.width / r.height; phoneCam.updateProjectionMatrix();
  const ph = 150, pw = Math.round(ph * r.width / r.height);
  if (phoneRT.width !== pw) phoneRT.setSize(pw, ph);
  PP.res.value.set(pw, ph); PP.time.value = P.time.value; PP.stat.value = phone.broken ? 0.82 : 0.03;
  renderer.setRenderTarget(phoneRT); renderer.render(scene, phoneCam); renderer.setRenderTarget(null);
  const y = innerHeight - r.bottom;
  renderer.setScissorTest(true); renderer.setScissor(r.left, y, r.width, r.height); renderer.setViewport(r.left, y, r.width, r.height);
  renderer.render(phoneScene, postCam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
}

// photo snapshot, returns dataURL. truth = what a camera sees
export function snap(scene, cam, truth, w = 180, h = 240, warm = 1) {
  snapRT.setSize(w, h);
  const mask = cam.layers.mask, asp = cam.aspect;
  cam.layers.set(0); cam.layers.enable(truth ? L_TRUE : L_MASK);
  cam.aspect = w / h; cam.updateProjectionMatrix();
  renderer.setRenderTarget(snapRT); renderer.render(scene, cam);
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(snapRT, 0, 0, w, h, buf);
  renderer.setRenderTarget(null);
  cam.layers.mask = mask; cam.aspect = asp; cam.updateProjectionMatrix();
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const id = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((h - 1 - y) * w + x) * 4, di = (y * w + x) * 4;
    const n = (Math.random() - 0.5) * 30, dx = x / w - 0.5, dy = y / h - 0.5;
    const vig = 1 - (dx * dx + dy * dy) * 1.4;
    id.data[di] = (buf[si] * 1.08 * warm + n) * vig;
    id.data[di + 1] = (buf[si + 1] + n) * vig;
    id.data[di + 2] = (buf[si + 2] * (2 - warm) * 0.92 + n) * vig;
    id.data[di + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

// ---------------- materials / textures ----------------
export function psx(m) {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * vec2(180.0,110.0) + 0.5) / vec2(180.0,110.0) * gl_Position.w;');
  };
  return m;
}
export const lam = (o) => psx(new THREE.MeshLambertMaterial(o));
export const basic = (c, fog = false) => new THREE.MeshBasicMaterial({ color: c, fog });

export function ctex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
export function speckle(g, w, h, amt = 0.14) {
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) { const r = (Math.random() - 0.5) * 255 * amt; d.data[i] += r; d.data[i + 1] += r; d.data[i + 2] += r; }
  g.putImageData(d, 0, 0);
}
export function blotch(g, w, h, n, col) {
  for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(2, w * 0.16), rand(2, h * 0.12), rand(0, 3), 0, 7); g.fill(); }
}
export function drips(g, w, h, n, col) {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) { const x = rand(0, w), l = rand(h * 0.1, h * 0.6), y = rand(0, h * 0.4); g.fillRect(x, y, rand(1, 2), l); }
}
export const TEX = {};
export function tex(name) {
  if (TEX[name]) return TEX[name];
  const mk = {
    tile: () => ctex(128, 128, (g, w, h) => {
      g.fillStyle = '#4c544c'; g.fillRect(0, 0, w, h);
      const n = 8, s = w / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = rand(-14, 10); g.fillStyle = `rgb(${168 + v},${182 + v},${168 + v})`; g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); }
      blotch(g, w, h, 14, 'rgba(70,60,20,0.13)'); drips(g, w, h, 3, 'rgba(60,50,20,0.14)'); speckle(g, w, h, 0.08);
    }),
    floor: () => ctex(128, 128, (g, w, h) => {
      const n = 8, s = w / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = rand(-10, 10); const c = (x + y) % 2 ? 60 : 120; g.fillStyle = `rgb(${c + v},${c + v + 4},${c + v})`; g.fillRect(x * s, y * s, s, s); }
      blotch(g, w, h, 30, 'rgba(30,24,8,0.2)'); speckle(g, w, h, 0.18);
    }),
    stall: () => ctex(64, 128, (g, w, h) => {
      g.fillStyle = '#5f7466'; g.fillRect(0, 0, w, h); blotch(g, w, h, 12, 'rgba(30,40,30,0.25)');
      g.strokeStyle = 'rgba(200,210,200,0.25)'; for (let i = 0; i < 14; i++) { g.beginPath(); const x = rand(0, w), y = rand(0, h); g.moveTo(x, y); g.lineTo(x + rand(-12, 12), y + rand(-8, 8)); g.stroke(); }
      speckle(g, w, h, 0.12);
    }),
    door3: () => ctex(64, 128, (g, w, h) => {
      g.fillStyle = '#5f7466'; g.fillRect(0, 0, w, h); blotch(g, w, h, 12, 'rgba(30,40,30,0.25)');
      g.fillStyle = 'rgba(25,10,10,0.85)'; g.font = 'bold 13px monospace'; g.save(); g.translate(8, 46); g.rotate(-0.12); g.fillText('REPENT', 0, 0); g.restore();
      g.fillStyle = 'rgba(120,10,10,0.8)'; g.font = '9px monospace'; g.fillText('he sees u', 12, 74);
      g.fillText('LEV 18:22', 6, 96);
      speckle(g, w, h, 0.12);
    }),
    wood: () => ctex(128, 128, (g, w, h) => {
      for (let x = 0; x < w; x += 16) { const v = rand(-12, 12); g.fillStyle = `rgb(${66 + v},${46 + v},${30 + v})`; g.fillRect(x, 0, 16, h); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 1, h); }
      g.strokeStyle = 'rgba(20,10,5,0.35)'; for (let i = 0; i < 60; i++) { const x = rand(0, w); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rand(-4, 4), h / 3, x + rand(-4, 4), h / 1.5, x + rand(-3, 3), h); g.stroke(); }
      blotch(g, w, h, 18, 'rgba(0,0,0,0.25)'); speckle(g, w, h, 0.15);
    }),
    char: () => ctex(128, 128, (g, w, h) => {
      for (let x = 0; x < w; x += 16) { const v = rand(-8, 8); g.fillStyle = `rgb(${34 + v},${24 + v},${18 + v})`; g.fillRect(x, 0, 16, h); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, 0, 1, h); }
      blotch(g, w, h, 40, 'rgba(0,0,0,0.4)'); speckle(g, w, h, 0.2);
    }),
    curtain: () => ctex(64, 64, (g, w, h) => {
      for (let x = 0; x < w; x++) { const k = 0.55 + 0.45 * Math.sin(x / w * Math.PI * 6); g.fillStyle = `rgb(${Math.round(120 * k + 20)},${Math.round(14 * k)},${Math.round(18 * k)})`; g.fillRect(x, 0, 1, h); }
      speckle(g, w, h, 0.1);
    }),
    fabric: () => ctex(32, 32, (g, w, h) => {
      g.fillStyle = '#1f3a4a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = ['#c2943a', '#7a2a3a', '#3a6a7a'][i % 3]; g.fillRect(Math.floor(rand(0, w)), Math.floor(rand(0, h)), 2, 1); }
      speckle(g, w, h, 0.15);
    }),
    plaster: () => ctex(64, 64, (g, w, h) => { g.fillStyle = '#7a7466'; g.fillRect(0, 0, w, h); blotch(g, w, h, 16, 'rgba(40,30,20,0.15)'); speckle(g, w, h, 0.1); }),
    carpet: () => ctex(64, 64, (g, w, h) => { g.fillStyle = '#3a3340'; g.fillRect(0, 0, w, h); speckle(g, w, h, 0.25); }),
    asphalt: () => ctex(64, 64, (g, w, h) => { g.fillStyle = '#262626'; g.fillRect(0, 0, w, h); speckle(g, w, h, 0.3); blotch(g, w, h, 8, 'rgba(0,0,0,0.3)'); }),
    metal: () => ctex(64, 64, (g, w, h) => { g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h); blotch(g, w, h, 10, 'rgba(60,40,20,0.2)'); speckle(g, w, h, 0.1); }),
    busWall: () => ctex(64, 64, (g, w, h) => { g.fillStyle = '#b8b09a'; g.fillRect(0, 0, w, h); blotch(g, w, h, 10, 'rgba(60,50,30,0.15)'); speckle(g, w, h, 0.08); }),
    poster: () => ctex(64, 90, (g, w, h) => {
      g.fillStyle = '#d8cfb8'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a1a14'; g.font = 'bold 10px serif'; g.fillText('YOUTH', 14, 18); g.fillText('REVIVAL', 9, 30);
      g.fillStyle = '#8a1c1c'; g.fillRect(28, 38, 8, 30); g.fillRect(18, 46, 28, 8); g.fillStyle = '#2a1a14'; g.font = '7px serif'; g.fillText('FRIDAY 7PM', 13, 80); speckle(g, w, h, 0.1);
    }),
  };
  TEX[name] = mk[name]();
  return TEX[name];
}
export function glow(inner, outer) {
  const t = ctex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, inner); gr.addColorStop(0.4, outer); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// ---------------- geometry helpers ----------------
export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m;
}
export function plane(parent, w, h, mat, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m;
}
export function texMat(name, rx, ry, extra = {}) {
  const t = tex(name).clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
  return lam(Object.assign({ map: t }, extra));
}

// ---------------- figures ----------------
const _geo = {};
const G = (k, f) => (_geo[k] ||= f());
const cap = (r, l, seg = 6) => G('c' + r + l + seg, () => new THREE.CapsuleGeometry(r, l, 2, seg));
function mesh(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
export function human(o = {}) {
  const C = Object.assign({ shirt: 0x2d3b52, pants: 0x1b1c22, skin: 0xbf9172, hair: 0x22160e, shoes: 0x111111 }, o);
  const M = {}; const mat = (c) => (M[c] ||= lam({ color: c }));
  const shirtD = new THREE.Color(C.shirt).multiplyScalar(0.8).getHex();
  const g = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
  mesh(hips, G('pelvis', () => new THREE.CylinderGeometry(0.17, 0.16, 0.16, 8)), mat(C.pants), 0, 0.02, 0, 1, 1, 0.65);
  const leg = (x) => {
    const L = new THREE.Group(); L.position.set(x, 0, 0); hips.add(L);
    mesh(L, cap(0.078, 0.3), mat(C.pants), 0, -0.23, 0);
    const K = new THREE.Group(); K.position.y = -0.46; L.add(K);
    mesh(K, cap(0.064, 0.3), mat(C.pants), 0, -0.21, 0);
    mesh(K, G('shoe', () => new THREE.BoxGeometry(0.12, 0.08, 0.25)), mat(C.shoes), 0, -0.43, 0.045);
    L.knee = K; return L;
  };
  const legL = leg(-0.095), legR = leg(0.095);
  const torso = new THREE.Group(); hips.add(torso);
  mesh(torso, G('chest', () => new THREE.CylinderGeometry(0.205, 0.165, 0.56, 9)), mat(C.shirt), 0, 0.33, 0, 1, 1, 0.62);
  mesh(torso, cap(0.075, 0.3, 6), mat(C.shirt), 0, 0.58, 0, 1, 1, 0.9).rotation.z = Math.PI / 2;
  const head = new THREE.Group(); head.position.y = 0.64; torso.add(head);
  mesh(head, G('neck', () => new THREE.CylinderGeometry(0.048, 0.055, 0.1, 6)), mat(C.skin), 0, 0.03, 0);
  mesh(head, G('skull', () => new THREE.SphereGeometry(0.122, 10, 8)), mat(C.skin), 0, 0.19, 0, 0.92, 1.12, 1.0);
  mesh(head, G('hair', () => new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52)), mat(C.hair), 0, 0.215, -0.012, 0.95, 1.05, 1.03);
  mesh(head, G('hairB', () => new THREE.SphereGeometry(0.12, 8, 6)), mat(C.hair), 0, 0.18, -0.045, 0.92, 0.9, 0.75);
  const eyeG = G('eye', () => new THREE.BoxGeometry(0.036, 0.022, 0.012));
  mesh(head, eyeG, mat(0x1a0f0f), -0.045, 0.205, 0.112); mesh(head, eyeG, mat(0x1a0f0f), 0.045, 0.205, 0.112);
  mesh(head, G('brow', () => new THREE.BoxGeometry(0.05, 0.012, 0.012)), mat(C.hair), -0.045, 0.232, 0.112); mesh(head, G('brow'), mat(C.hair), 0.045, 0.232, 0.112);
  mesh(head, G('nose', () => new THREE.BoxGeometry(0.026, 0.05, 0.03)), mat(C.skin), 0, 0.165, 0.122);
  mesh(head, G('mouth', () => new THREE.BoxGeometry(0.06, 0.012, 0.01)), mat(0x5a2e28), 0, 0.115, 0.108);
  mesh(head, G('ear', () => new THREE.BoxGeometry(0.02, 0.05, 0.035)), mat(C.skin), -0.112, 0.19, 0); mesh(head, G('ear'), mat(C.skin), 0.112, 0.19, 0);
  const arm = (x) => {
    const A = new THREE.Group(); A.position.set(x, 0.57, 0); torso.add(A);
    mesh(A, cap(0.058, 0.22), mat(C.shirt), 0, -0.16, 0);
    mesh(A, cap(0.048, 0.22), mat(C.skin), 0, -0.44, 0.0);
    mesh(A, cap(0.062, 0.08), mat(shirtD), 0, -0.3, 0);
    mesh(A, G('hand', () => new THREE.SphereGeometry(0.05, 6, 5)), mat(C.skin), 0, -0.63, 0.01, 0.8, 1.2, 0.6);
    return A;
  };
  const armL = arm(-0.25), armR = arm(0.25);
  return { g, hips, torso, head, armL, armR, legL, legR };
}
export function sit(h) {
  h.hips.position.y = 0.5;
  for (const L of [h.legL, h.legR]) { L.rotation.x = -Math.PI / 2; L.knee.rotation.x = Math.PI / 2; }
}
export function entity(o = {}) {
  const g = new THREE.Group();
  const dark = lam({ color: o.color ?? 0x0a0908 }), eye = basic(0xffffff), mouth = basic(0x2a0000);
  for (const x of [-0.08, 0.08]) { mesh(g, cap(0.045, 0.52), dark, x, 0.9, 0); mesh(g, cap(0.038, 0.52), dark, x, 0.32, 0.02); }
  const torso = new THREE.Group(); torso.position.y = 1.2; torso.rotation.x = 0.2; g.add(torso);
  mesh(torso, G('etorso', () => new THREE.CylinderGeometry(0.17, 0.1, 0.86, 7)), dark, 0, 0.43, 0, 1, 1, 0.55);
  for (let i = 0; i < 4; i++) mesh(torso, G('rib', () => new THREE.BoxGeometry(0.3, 0.015, 0.1)), lam({ color: 0x161312 }), 0, 0.5 + i * 0.07, 0.04);
  const head = new THREE.Group(); head.position.y = 0.95; head.rotation.z = o.tilt ?? 0.5; torso.add(head);
  mesh(head, G('ehead', () => new THREE.SphereGeometry(0.115, 9, 8)), dark, 0, 0.13, 0, 0.85, 1.45, 0.95);
  const eG = G('eeye', () => new THREE.BoxGeometry(0.034, 0.02, 0.02));
  const eyes = [mesh(head, eG, eye, -0.042, 0.2, 0.1), mesh(head, eG, eye, 0.042, 0.2, 0.1)];
  const m = mesh(head, G('emouth', () => new THREE.BoxGeometry(0.045, 0.16, 0.02)), mouth, 0, 0.03, 0.1);
  const arm = (x, s) => {
    const A = new THREE.Group(); A.position.set(x, 0.8, 0); A.rotation.z = s * 0.08; torso.add(A);
    mesh(A, cap(0.032, 0.6), dark, 0, -0.33, 0); mesh(A, cap(0.028, 0.6), dark, 0, -1.0, 0.02);
    for (let i = -1; i <= 1; i++) mesh(A, cap(0.008, 0.2, 4), dark, i * 0.018, -1.45, 0.02);
    return A;
  };
  const armL = arm(-0.2, -1), armR = arm(0.2, 1);
  return { g, torso, head, armL, armR, eyes, mouth: m };
}

// ---------------- particles ----------------
let fireTexC, smokeTexC;
export class Fire {
  constructor(parent, pos, o = {}) {
    fireTexC ||= glow('rgba(255,250,210,1)', 'rgba(255,140,30,0.8)');
    smokeTexC ||= glow('rgba(40,36,34,0.9)', 'rgba(20,18,18,0.5)');
    this.parent = parent; this.pos = pos.clone(); this.rate = o.rate ?? 28; this.spread = o.spread ?? 0.5; this.size = o.size ?? 1.1;
    this.lift = o.lift ?? 1.4; this.smoke = o.smoke ?? false; this.life = o.life ?? 0.8; this.ps = []; this.free = []; this.acc = 0; this.on = true;
  }
  spawn() {
    let p = this.free.pop();
    if (!p) {
      const m = new THREE.SpriteMaterial({ map: this.smoke ? smokeTexC : fireTexC, blending: this.smoke ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: this.smoke });
      p = { s: new THREE.Sprite(m), v: new THREE.Vector3() }; this.parent.add(p.s);
    }
    p.s.visible = true; p.t = 0; p.max = this.life * rand(0.6, 1.3);
    p.s.position.set(this.pos.x + rand(-1, 1) * this.spread, this.pos.y + rand(0, 0.2), this.pos.z + rand(-1, 1) * this.spread);
    p.v.set(rand(-0.25, 0.25), this.lift * rand(0.6, 1.3), rand(-0.25, 0.25)); p.sz = this.size * rand(0.6, 1.2);
    this.ps.push(p);
  }
  update(dt) {
    if (this.on) { this.acc += dt * this.rate; while (this.acc > 1) { this.acc--; this.spawn(); } }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i]; p.t += dt; const k = p.t / p.max;
      if (k >= 1) { p.s.visible = false; this.ps.splice(i, 1); this.free.push(p); continue; }
      p.s.position.addScaledVector(p.v, dt);
      if (this.smoke) { const sc = p.sz * (0.6 + k * 1.6); p.s.scale.set(sc, sc, 1); p.s.material.opacity = 0.42 * Math.sin(k * Math.PI); }
      else { const sc = p.sz * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.8); p.s.scale.set(sc * 0.8, sc * 1.3, 1); p.s.material.opacity = 1 - k; p.s.material.color.setRGB(1, 1 - k * 0.65, 0.7 - k * 0.7); }
    }
  }
}
export function embers(parent, center, n, spread) {
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = center.x + rand(-spread, spread); pos[i * 3 + 1] = rand(0, 5); pos[i * 3 + 2] = center.z + rand(-spread, spread); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff9a40, size: 2, sizeAttenuation: false, fog: false }));
  parent.add(pts);
  return (dt, t) => {
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] += dt * (0.6 + (i % 7) * 0.15); pos[i * 3] += Math.sin(t * 2 + i) * dt * 0.3;
      if (pos[i * 3 + 1] > 6) { pos[i * 3 + 1] = 0; pos[i * 3] = center.x + rand(-spread, spread); pos[i * 3 + 2] = center.z + rand(-spread, spread); }
    }
    geo.attributes.position.needsUpdate = true;
  };
}
