import * as THREE from 'three';
import { startTitleArt, stopTitleArt } from './title.js';
import { $, rand, clamp, renderer, P, camera, L_TRUE, L_MASK, setLayer, renderFrame, snap, lam, basic, tex, texMat, box, plane, ctex, human, sit, entity, Fire, embers, glow } from './core.js';
import { A, stopAll, panner, setPos, listen, sfx, whisper, loopNoise, osc, every, drone, hum, breathing, heartbeat, fireLoop, ritualAudio, tone, burst, setVolume, dryer, music, setTrack, hasTrack, trackMusic, keepTrack, primeTrack, muffle, zippo, zippoOpen, foot, fear, ambience, voice, speak as sayAloud } from './audio.js';

const PI = Math.PI;
// ---------------- input ----------------
const input = { mx: 0, my: 0, dx: 0, dy: 0, keys: {}, left: false, right: false, moved: 0 };
addEventListener('mousemove', (e) => {
  input.mx = e.clientX / innerWidth * 2 - 1; input.my = e.clientY / innerHeight * 2 - 1;
  const dx = e.movementX || 0, dy = e.movementY || 0; input.dx += dx; input.dy += dy; input.moved += Math.abs(dx) + Math.abs(dy);
});
addEventListener('keydown', (e) => { if (paused) return; input.keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); cur?.onKey?.(e.code); });
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
addEventListener('mousedown', (e) => {
  if (paused) return;
  if (e.button === 0) { input.left = true; if (cur?.wantLock && !locked()) requestLock(); cur?.onClick?.(e); }
  if (e.button === 2) input.right = true;
});
document.addEventListener('mouseleave', () => { input.mx = 0; input.my = 0; });
addEventListener('mouseup', (e) => { if (e.button === 0) input.left = false; if (e.button === 2) input.right = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('blur', () => { input.keys = {}; input.left = input.right = false; });
const touch = { on: false, id: null, x: 0, y: 0, lastT: 0 };
addEventListener('touchstart', (e) => {
  if (!touch.on) { touch.on = true; document.body.classList.add('touch'); }
  for (const t of e.changedTouches) { if (t.target.closest && t.target.closest('.tb, button, #texts, #viewer, .ov, input')) continue; if (touch.id == null) { touch.id = t.identifier; touch.x = t.clientX; touch.y = t.clientY; } }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) if (t.identifier === touch.id) { const dx = t.clientX - touch.x, dy = t.clientY - touch.y; input.dx += dx; input.dy += dy; input.moved += Math.abs(dx) + Math.abs(dy); touch.x = t.clientX; touch.y = t.clientY; }
}, { passive: true });
const endTouch = (e) => { for (const t of e.changedTouches) if (t.identifier === touch.id) touch.id = null; };
addEventListener('touchend', endTouch); addEventListener('touchcancel', endTouch);
const TB = { KeyC: 'CAMERA', KeyW: 'RUN', KeyF: 'LIGHTER', KeyE: 'HAND' };
function setTouch(keys) {
  const el = $('touchUI'); el.innerHTML = '';
  for (let k of keys) {
    const label = Array.isArray(k) ? k[1] : TB[k]; if (Array.isArray(k)) k = k[0];
    const b = document.createElement('div'); b.className = 'tb'; b.textContent = label;
    const on = (ev) => { ev.preventDefault(); input.keys[k] = true; b.classList.add('on'); cur?.onKey?.(k); };
    const off = (ev) => { ev.preventDefault(); input.keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('touchstart', on); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
    el.appendChild(b);
  }
}
let paused = false, expectUnlock = false, lockedOnce = false, hadNoCursor = false;
function pause() {
  if (paused || !cur || [SC.title, SC.credits, SC.jump].includes(cur)) return;
  paused = true; hadNoCursor = document.body.classList.contains('nocursor'); cursor(true); $('pause').classList.add('show');
  const names = { opening: 'I \u00b7 THE RITUAL', booth: 'II \u00b7 THE RINK', field: 'III \u00b7 THE FIELD', hosp: 'IV \u00b7 JESSICA', bath: 'V \u00b7 THE WAKE', door: 'VI \u00b7 THE BACK DOOR', mill: 'VII \u00b7 THE MILL', gas: 'VIII \u00b7 LEAVING', bus: 'VIII \u00b7 LEAVING' };
  const k = Object.keys(SC).find((n) => SC[n] === cur); $('pChap').textContent = 'CHAPTER ' + (names[k] || '');
  pauseSel(0); pauseBars();
  try { A.ctx && A.ctx.suspend(); } catch (e) { }
  input.keys = {}; input.left = input.right = false;
}
function resume() {
  if (!paused) return; paused = false; $('pause').classList.remove('show'); cursor(!hadNoCursor);
  try { A.ctx && A.ctx.resume(); } catch (e) { }
  if (cur?.wantLock) requestLock();
}
document.addEventListener('pointerlockchange', () => {
  if (locked()) { lockedOnce = true; return; }
  if (expectUnlock) { expectUnlock = false; return; }
  if (lockedOnce && cur?.wantLock) pause();
});
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { paused ? resume() : pause(); return; }
  if (!paused) return;
  const it = pauseItems();
  if (e.code === 'ArrowDown' || e.code === 'KeyS') pauseSel(pIdx + 1);
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') pauseSel(pIdx - 1);
  else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); it[pIdx].click(); }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { MENU.vol = Math.max(0, Math.min(1.2, MENU.vol + (e.code === 'ArrowRight' ? 0.12 : -0.12))); setVolume(MENU.vol); pauseBars(); }
});
let pIdx = 0;
const pauseItems = () => [...document.querySelectorAll('#pmenu .mi')];
function pauseSel(i) { const it = pauseItems(); pIdx = (i + it.length) % it.length; it.forEach((b, k) => b.classList.toggle('sel', k === pIdx)); }
function pauseBars() { const n = Math.round(MENU.vol / 1.2 * 10); $('pVolBar').textContent = '\u25A0'.repeat(n) + '\u25A1'.repeat(10 - n); $('pFxVal').textContent = MENU.fx ? 'On' : 'Off'; }
document.querySelectorAll('#pmenu .mi').forEach((b) => b.addEventListener('mouseenter', () => pauseSel(pauseItems().indexOf(b))));
const locked = () => document.pointerLockElement === renderer.domElement;
function requestLock() { try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
function unlock() { try { if (locked()) { expectUnlock = true; document.exitPointerLock(); } } catch (e) { } }

// ---------------- look ----------------
const look = { on: false, yaw: 0, pitch: 0, ty: 0, tp: 0, base: 0, bp: 0, ry: 1.2, rp: 0.45, mx0: 0, my0: 0, roll: 0, bob: 0 };
function setLook(base, bp = 0, ry = 1.2, rp = 0.45) { Object.assign(look, { on: true, base, bp, ry, rp, yaw: base, pitch: bp, ty: base, tp: bp, mx0: input.mx, my0: input.my, roll: 0 }); input.dx = input.dy = 0; }
function updateLook(dt) {
  const free = !isFinite(look.ry);
  const sens = touch.on ? 0.006 : locked() ? 0.0024 : 0.0032;
  look.ty -= input.dx * sens; look.tp -= input.dy * sens;
  if (!locked() && !touch.on) {
    const ax = Math.abs(input.mx), ay = Math.abs(input.my);
    if (ax > 0.82) look.ty -= Math.sign(input.mx) * ((ax - 0.82) / 0.18) * dt * 2.4;
    if (ay > 0.85) look.tp -= Math.sign(input.my) * ((ay - 0.85) / 0.15) * dt * 1.2;
  }
  if (!free) look.ty = clamp(look.ty, look.base - look.ry, look.base + look.ry);
  look.tp = clamp(look.tp, look.bp - look.rp, look.bp + look.rp);
  const k = Math.min(1, dt * 9); look.yaw += (look.ty - look.yaw) * k; look.pitch += (look.tp - look.pitch) * k;
  camera.rotation.set(look.pitch, look.yaw, look.roll, 'YXZ');
}
input.dx = input.dy = 0;

// ---------------- ui helpers ----------------
let sayTok = 0;
function noVoice() { }
async function talk(ep, lines) {
  for (const l of lines) {
    if (typeof l === 'number') await wait(l); else if (typeof l === 'function') l();
    else { const [who, text, ms] = l; await say(who ? `${who}: ${text}` : text, ms || Math.max(750, 350 + text.length * 34)); }
    if (!alive(ep)) return false;
  }
  return true;
}
function say(text, ms = 2600) {
  const tok = ++sayTok; const el = $('sub'); el.textContent = ''; let i = 0;
  return new Promise((res) => {
    const iv = setInterval(() => {
      if (tok !== sayTok) { clearInterval(iv); res(); return; }
      i += 1; el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(iv); setTimeout(() => { if (tok === sayTok) el.textContent = ''; res(); }, ms); }
    }, 17);
  });
}
function clearSay() { sayTok++; $('sub').textContent = ''; }
const prompt = (t) => { $('prompt').textContent = t || ''; };
function center(t, big = false) { const el = $('center'); if (t) { el.textContent = t; el.classList.toggle('big', big); el.classList.add('show'); } else el.classList.remove('show'); }
let timers = [];
const wait = (ms) => new Promise((r) => timers.push({ at: T + ms / 1000, r }));
function updateTimers() { for (let i = timers.length - 1; i >= 0; i--) if (T >= timers[i].at) { const r = timers[i].r; timers.splice(i, 1); r(); } }
function cursor(show) { document.body.classList.toggle('nocursor', !show); }
const cross = (s) => { $('cross').style.display = s ? 'block' : 'none'; };

// ---------------- CONTROL PROMPTS ----------------
// rows: { keys:['KeyE'] | ['LMB'] | ['Space','RMB'], verb, hold, show:()=>bool, fill:()=>0..1 }
const KEYLBL = { Space: 'SPACE', KeyW: 'W', KeyS: 'S', KeyE: 'E', KeyL: 'L', KeyQ: 'Q', KeyF: 'F', KeyR: 'R', Digit1: '1', Digit2: '2', Digit3: '3', Enter: 'ENTER', Escape: 'ESC' };
function keycap(k) {
  if (k === 'LMB' || k === 'RMB') return `<span class="kc mouse ${k}" data-k="${k}"><i></i><i></i><b></b></span>`;
  return `<span class="kc${(KEYLBL[k] || '').length > 2 ? ' wide' : ''}" data-k="${k}">${KEYLBL[k] || k}<u></u></span>`;
}
let ROWS = [];
function controls(rows) {
  ROWS = rows || []; const el = $('ctl');
  if (touch.on) { el.innerHTML = ''; return; }
  el.innerHTML = ROWS.map((r, i) => `<div class="cr" data-i="${i}">${r.keys.map(keycap).join('<em>/</em>')}<span class="verb">${r.verb}</span>${r.hold ? '<span class="hold">HOLD</span>' : ''}</div>`).join('');
  updateControls();
}
function keyDown(k) { if (k === 'LMB') return input.left; if (k === 'RMB') return input.right; return !!input.keys[k]; }
function updateControls() {
  const rows = $('ctl').children;
  ROWS.forEach((r, i) => {
    const el = rows[i]; if (!el) return;
    const vis = !r.show || r.show(); el.classList.toggle('off', !vis);
    let any = false; el.querySelectorAll('.kc').forEach((kc) => { const d = keyDown(kc.dataset.k); kc.classList.toggle('down', d); any ||= d; });
    el.classList.toggle('active', any);
    const f = r.fill ? (r.fill() || 0) : (r.hold && any ? 1 : 0); el.style.setProperty('--f', f.toFixed(3));
  });
}
// spatial tag next to the crosshair
function ctxTag(html) { const el = $('ctx'); if (html) { if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; } el.classList.add('show'); } else el.classList.remove('show'); }
// objective line (top center)
function objective(t) { const el = $('obj'); el.textContent = t || ''; el.classList.toggle('show', !!t); }
// one-time teaching card
const TAUGHT = new Set();
function teach(id, keys, title, body, hold) {
  if (TAUGHT.has(id) || touch.on) return; TAUGHT.add(id);
  const el = $('teach');
  el.innerHTML = `<div class="tk">${keys.map(keycap).join('<em>or</em>')}${hold ? '<span class="hold">HOLD</span>' : ''}</div><div class="tt"><b>${title}</b><span>${body}</span></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); tone({ type: 'square', f: 660, v: 0.05, d: 0.08, lp: 2000 });
  clearTimeout(teach.t); teach.t = setTimeout(() => el.classList.remove('show'), 5200);
}

// ---------------- HOW TO TELL (animated lesson) ----------------
const TELLS = [
  { id: 'eyes', label: 'EYES', good: 'Blinks', bad: 'Never blinks' },
  { id: 'breath', label: 'BREATH', good: 'Breath in the cold', bad: 'No breath' },
  { id: 'shadow', label: 'SHADOW', good: 'Casts a shadow', bad: 'No shadow' },
  { id: 'watch', label: 'WHEN WATCHED', good: 'Keeps moving', bad: 'Freezes' },
  { id: 'voice', label: 'VOICE', good: 'Says new things', bad: 'Repeats itself' },
];
function drawTell(g, id, real, t) {
  const W = 40; g.clearRect(0, 0, W, W); g.imageSmoothingEnabled = false;
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const SK = '#d0a58a', HR = '#6a4524', SH = '#2f4a6a', K = '#120a08';
  const head = (cx, cy) => { P(cx - 6, cy - 7, 12, 14, SK); P(cx - 7, cy - 9, 14, 4, HR); P(cx - 7, cy - 6, 2, 6, HR); P(cx + 5, cy - 6, 2, 6, HR); };
  const body = (cx, top, sway = 0) => { P(cx - 6 + sway, top, 12, 10, SH); P(cx - 9 + sway, top + 1, 3, 9, SH); P(cx + 6 + sway, top + 1, 3, 9, SH); P(cx - 4 + sway, top + 10, 3, 7, '#1c1c22'); P(cx + 1 + sway, top + 10, 3, 7, '#1c1c22'); };
  if (id === 'eyes') {
    const blink = real && (t % 2.2) < 0.18;
    P(4, 12, 32, 16, SK); P(4, 9, 32, 3, HR);
    for (const x of [8, 23]) { if (blink) P(x, 19, 9, 2, K); else { P(x, 15, 9, 8, '#f2ece0'); const j = real ? Math.round(Math.sin(t * 1.3) * 1.5) : (Math.random() < 0.3 ? 1 : 0); P(x + 3 + j, 17, 3, 4, K); } }
  } else if (id === 'breath') {
    head(14, 20); P(11, 24, 6, 1, '#6a2e28');
    if (real) { const k = (t % 2) / 2; const r = 2 + k * 6, a = 1 - k; g.globalAlpha = a * 0.9; P(20 + k * 10, 22 - k * 8 - r / 2, r, r * 0.7, '#e6ecff'); P(22 + k * 12, 20 - k * 10, r * 0.7, r * 0.5, '#cfd8f0'); g.globalAlpha = 1; }
  } else if (id === 'shadow') {
    P(0, 32, 40, 8, '#3a2e26'); head(20, 9); body(20, 16);
    if (real) { g.globalAlpha = 0.75; P(10, 33, 22, 3, '#0a0605'); P(13, 36, 16, 2, '#0a0605'); g.globalAlpha = 1; }
  } else if (id === 'watch') {
    const sway = real ? Math.round(Math.sin(t * 3)) : 0; head(16 + sway, 10); body(16, 17, sway);
    P(28, 4, 10, 6, '#f2ece0'); P(31, 5, 4, 4, K); if (!real) { P(26, 13, 12, 1, '#ff5a3c'); }
  } else if (id === 'voice') {
    const lines = real ? [[4, 22], [4, 14], [4, 26]] : [[4, 20], [4, 20], [4, 20]];
    const n = Math.floor(t / 0.8) % 4;
    lines.slice(0, n).forEach(([x, w], i) => { const y = 4 + i * 12; P(x - 1, y - 1, w + 6, 9, real ? '#2c4a2a' : '#4a1a14'); P(x + 1, y + 2, w, 2, '#f2ece0'); if (real && i === 1) P(x + 1, y + 5, w - 6, 1, '#f2ece0'); });
  }
}
let lessonRaf = 0;
function buildLesson() {
  const g = $('lgrid'); if (g.children.length) return;
  g.innerHTML = TELLS.map((x) => `<div class="lcard"><div class="ll">${x.label}</div><div class="lpair">
    <div class="lside good"><canvas width="40" height="40" data-id="${x.id}" data-real="1"></canvas><span>RYAN</span><b>${x.good}</b></div>
    <div class="lvs">vs</div>
    <div class="lside bad"><canvas width="40" height="40" data-id="${x.id}" data-real="0"></canvas><span>IT</span><b>${x.bad}</b></div></div></div>`).join('');
}
function showLesson() {
  buildLesson(); const el = $('lesson'); el.classList.add('show'); cursor(true);
  const cvs = [...el.querySelectorAll('canvas')]; const t0 = performance.now();
  const loop = () => { lessonRaf = requestAnimationFrame(loop); const t = (performance.now() - t0) / 1000; for (const c of cvs) drawTell(c.getContext('2d'), c.dataset.id, c.dataset.real === '1', t); };
  loop();
  return new Promise((res) => {
    let ok = false; setTimeout(() => { ok = true; $('lgo').classList.add('ready'); }, 1500);
    const done = () => { if (!ok) return; cancelAnimationFrame(lessonRaf); el.classList.remove('show'); $('lgo').classList.remove('ready'); removeEventListener('keydown', key); cursor(false); tone({ type: 'square', f: 780, v: 0.05, d: 0.08, lp: 2200 }); res(); };
    const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') done(); };
    $('lgo').onclick = done; addEventListener('keydown', key);
  });
}

// ---------------- suspense helpers ----------------
function hush(ms) { if (!A.ctx || !A.out) return; const t = A.ctx.currentTime; A.out.gain.cancelScheduledValues(t); A.out.gain.setTargetAtTime(0.03, t, 0.08); A.out.gain.setTargetAtTime(1, t + ms / 1000, 0.02); }
function omen(ms) { hush(ms); setTimeout(() => zippo(null, 1.3), Math.max(0, ms - 420)); }
function relief() {
  P.tint.value.set(1.15, 1.02, 0.9); tween(P.tint.value, 'x', 1, 4); tween(P.tint.value, 'z', 1, 4);
  [220, 277.2, 329.6].forEach((f, i) => tone({ type: 'sine', f, v: 0.09, a: 0.4, d: 2.6, at: i * 0.12 })); burst({ type: 'bandpass', f: 500, q: 1.2, v: 0.9, a: 0.3, d: 1.2 });
}
let ALONE_T = 0, aloneBreath = 0;
function updateAlone(dt) {
  const on = document.body.classList.contains('alone') && !ATK.on;
  ALONE_T = on ? ALONE_T + dt : Math.max(0, ALONE_T - dt * 4);
  const k = Math.min(1, ALONE_T / 28);
  fear(on ? 0.15 + k * 0.85 : 0);
  P.grain.value = (MENU.fx ? 0.07 : 0.02) + k * 0.09; $('aloneV').style.opacity = (k * 0.85).toFixed(2);
  if (on) { aloneBreath -= dt; if (aloneBreath <= 0) { aloneBreath = 3.4 - k * 2.1; burst({ type: 'bandpass', f: 650, q: 1.6, v: 0.25 + k * 0.6, a: 0.5 - k * 0.25, d: 0.5 }); if (k > 0.5) tone({ f: 58, fEnd: 36, v: 0.25 + k * 0.4, d: 0.15, lp: 200 }); } }
}

// ---------------- tweens ----------------
let tweens = [];
function tween(obj, key, to, dur, ease = (x) => x) { return new Promise((res) => tweens.push({ obj, key, from: obj[key], to, dur: Math.max(dur, 0.0001), t: 0, ease, res })); }
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.obj[w.key] = w.from + (w.to - w.from) * w.ease(k); if (k >= 1) { tweens.splice(i, 1); w.res(); } }
}
const fadeIn = (d = 1) => tween(P.fade, 'value', 0, d);
const fadeOut = (d = 1) => tween(P.fade, 'value', 1, d);

// ---------------- phone ----------------
let BAT = 1; const BAT_SECS = 10; let LIGHTER = 2;
const phone = { truth: true, enabled: false, up: false, ready: 0, broken: false, visible: false, upT: 0 };
function setPhone(enabled, broken = false, label = '') {
  phone.enabled = enabled; phone.broken = broken;
  $('phone').classList.toggle('broken', broken); $('phone').querySelector('.lbl').textContent = label;
  phone.truth = true;
  if (!enabled) { phone.up = false; $('phone').classList.remove('up'); }
}
function drawBat() {
  const el = $('bat'); el.classList.toggle('show', phone.enabled && !touch.noBat);
  const pct = Math.ceil(BAT * 100); el.classList.toggle('low', pct <= 30); el.classList.toggle('drain', phone.visible && !phone.broken);
  $('batFill').style.width = pct + '%'; $('batTxt').textContent = pct + '%';
  $('fuel').innerHTML = 'LIGHTER ' + [0, 1].map((i) => `<i class="${i < LIGHTER ? '' : 'used'}"></i>`).join('');
}
function updatePhone(T) {
  const want = !!(phone.enabled && (input.keys.Space || input.right || input.keys.KeyC));
  if (want !== phone.up) { phone.up = want; $('phone').classList.toggle('up', want); phone.ready = T + 0.19; if (want) sfx.click(); }
  phone.visible = phone.up && T > phone.ready;
  if (phone.visible && !phone.broken && !ATK.on) {
    BAT = Math.max(0, BAT - (1 / 60) / BAT_SECS);
    if (BAT <= 0) { phone.broken = true; $('phone').classList.add('broken'); $('phone').querySelector('.lbl').textContent = 'BATTERY 0%'; sfx.click(); say('The battery died.', 1400); }
  }
  drawBat();
  phone.upT = phone.visible ? phone.upT + 1 / 60 : 0;
}
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
function angleTo(p) { camera.getWorldDirection(fwd); tmp.copy(p).sub(camera.position).normalize(); return Math.acos(clamp(fwd.dot(tmp), -1, 1)); }

// ---------------- scene manager ----------------
let cur = null, epoch = 0, T = 0, ENDING = '';
const voidScene = new THREE.Scene(); voidScene.background = new THREE.Color(0);
const AK = { field: 'field', hosp: 'hosp', bath: 'bath', door: 'home', mill: 'mill', bus: 'bus', opening: 'ritual', booth: 'booth' };
const BRIDGE = {
  booth: ['II', 'The Rink', 'Saturday night', 'Ryan still talks to me. He doesn\'t know I\'m the one who told.'],
  field: ['III', 'The Field', 'That night', 'Hunter never came home from the rink, and his phone just rings out.'],
  hosp: ['IV', 'Jessica', 'Murryville Hospital', 'Izzie says a girl in Murryville lived through it. I need to know how.'],
  bath: ['V', 'The Wake', 'Friday. The church hall', 'She said find Ryan. He\'ll be at Hunter\'s wake.'],
  door: ['VI', 'The Back Door', '1:04 AM. Home', 'I ran the whole way home, and Mum was asleep.'],
  mill: ['VII', 'The Mill', 'Midnight. Corrigan Road', 'It hates fire, and the old mill is all dry timber.'],
  bus: ['VIII', 'The Last Bus', 'Sunset', 'There\'s one bus a day out of this town.'],
};
let bridging = false;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
let RUN = null;
function newRun(k) {
  const idx = { opening: 1, booth: 2, field: 3, hosp: 4, bath: 5, door: 6, mill: 7, bus: 8 }; const late = ['door', 'mill', 'bus', 'credits'].includes(k);
  RUN = { step: idx[k] || 1, last: k, did: { hosp: late || k === 'bath', bath: late }, trust: 0, hasLighter: !['opening', 'booth', 'field'].includes(k), log: [], withRyan: false, burnt: false };
}
newRun('opening');
function bridgeLine(from, to, dflt) {
  if (to === 'bath' && from === 'field') return "Ryan's at Hunter's wake. He shouldn't be on his own tonight.";
  if (to === 'hosp' && from === 'bath') return "I've got nothing to fight it with, and Jessica might.";
  if (to === 'door') { if (!RUN.did.bath) return "I went home. Ryan'd be right for one night. That's what I told myself."; if (!RUN.did.hosp) return 'I ran home with nothing, and Mum was asleep.'; if (from === 'hosp') return 'They walked me out of the hospital. I ran the whole way home.'; }
  return dflt;
}
const sceneKey = (sc) => Object.keys(SC).find((n) => SC[n] === sc);
function go(sc, opts = {}) {
  const toK = sceneKey(sc), fromK = sceneKey(cur);
  if (BRIDGE[toK] && (BRIDGE[fromK] || fromK === 'opening' || fromK === 'cross' || fromK === 'first' || fromK === 'porch')) { if (!opts.retry && !opts._b && !opts._d && fromK !== toK) {
      // let the old chapter's sound and picture die away together before the card
      if (bridging) return; bridging = true; const ep0 = epoch;
      if (P.fade.value < 1) tween(P.fade, 'value', 1, 0.7);
      try { const g = A.out.gain, n = A.ctx.currentTime; g.cancelScheduledValues(n); g.setValueAtTime(g.value, n); g.linearRampToValueAtTime(0.0001, n + 0.75); } catch (e) { }
      setTimeout(() => { bridging = false; if (epoch !== ep0) { try { A.out.gain.setValueAtTime(1, A.ctx.currentTime); } catch (e) { } return; } stopAll(); try { const g = A.out.gain, n = A.ctx.currentTime; g.cancelScheduledValues(n); g.setValueAtTime(1, n + 0.05); } catch (e) { } go(SC.bridge, { sc, opts, key: toK }); }, 800);
      return;
    } }
  bridging = false; try { A.out.gain.cancelScheduledValues(A.ctx.currentTime); A.out.gain.setValueAtTime(1, A.ctx.currentTime); } catch (e) { }
  if (cur?.exit) cur.exit();
  if (!opts._b) stopAll(); tweens = []; clearSay(); prompt(''); center(''); cross(false); setPhone(false); controls([]); ctxTag(''); objective(''); $('teach').classList.remove('show');
  P.red.value = 0; P.stat.value = 0; P.flash.value = 0; P.chroma.value = 1; P.warp.value = 0.3; P.tint.value.set(1, 1, 1); look.on = false; look.roll = 0;
  ATK.on = false; RIG.visible = false; atkL.intensity = 0; $('choke').style.opacity = 0; document.body.classList.remove('attacking'); rFace.rotation.z = 0.35;
  epoch++; cur = sc; sc.wantLock = false; $('hp').classList.toggle('show', HP_SCENES().includes(sc)); drawHP(); setTouch([]); timers = []; paused = false; $('pause').classList.remove('show');
  sc.enter(opts, epoch);
  muffle(20000, 0.05); if (AK[toK] && !opts._b) ambience(AK[toK]);
}
const alive = (ep) => ep === epoch;
function scare(retry, variant = 'face') { go(SC.jump, { then: retry, variant }); }

// ---------------- HEALTH + ATTACKS ----------------
const MAXHP = 100; let HP = MAXHP;
const HP_SCENES = () => [SC.first, SC.cross, SC.field, SC.hosp, SC.bath, SC.texts, SC.door, SC.mill];
function drawHP() { $('hpFill').style.width = Math.max(0, HP) + '%'; document.body.classList.toggle('lowhp', HP > 0 && HP <= 34); }
const BC = $('blood'), bctx = BC.getContext('2d'); BC.width = 320; BC.height = 180; let bTok = 0;
const BLOODC = ['#4a0000', '#6e0604', '#8a1006', '#360000', '#a01a0c'];
function splat(x, y, r, n = 40) {
  bctx.fillStyle = BLOODC[1]; bctx.beginPath(); bctx.arc(x, y, r * 0.35, 0, 7); bctx.fill();
  for (let i = 0; i < n; i++) { const a = rand(0, 6.28), d = Math.pow(Math.random(), 0.6) * r, s = Math.ceil(rand(1, 4) * (1 - d / r) + 1); bctx.fillStyle = BLOODC[i % 5]; bctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), s, s); }
  for (let i = 0; i < 4; i++) { bctx.fillStyle = BLOODC[i % 2]; const dx = Math.round(x + rand(-r * 0.4, r * 0.4)); bctx.fillRect(dx, Math.round(y), rand() < 0.5 ? 1 : 2, Math.round(rand(6, 30))); }
}
function claws() {
  for (let i = 0; i < 3; i++) {
    const x0 = 210 + i * 22, y0 = 12 + i * 6, x1 = 70 + i * 22, y1 = 165 - i * 4;
    for (let k = 0; k <= 60; k++) { const u = k / 60, x = x0 + (x1 - x0) * u + rand(-1, 1), y = y0 + (y1 - y0) * u; const w = Math.sin(u * Math.PI) * 4 + 1; bctx.fillStyle = k % 3 ? BLOODC[2] : BLOODC[4]; bctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.ceil(w), 2); if (rand() < 0.08) bctx.fillRect(Math.round(x + rand(-4, 4)), Math.round(y + 2), 1, Math.round(rand(4, 18))); }
  }
  splat(150, 90, 24, 50);
}
function bloodShow(hold = 2600) {
  const tok = ++bTok; BC.classList.add('on');
  setTimeout(() => { if (tok !== bTok) return; BC.classList.remove('on'); setTimeout(() => { if (tok === bTok) bctx.clearRect(0, 0, 320, 180); }, 3100); }, hold);
}
// attacker rig, attached to the camera
const RIG = new THREE.Group(); RIG.visible = false; camera.add(RIG);
const atkL = new THREE.PointLight(0xff5a40, 0, 3, 1.4); atkL.position.set(0, -0.25, -0.1); camera.add(atkL);
const rD = new THREE.MeshLambertMaterial({ color: 0x110d0b }), rE = new THREE.MeshBasicMaterial({ color: 0xffffff }), rM = new THREE.MeshBasicMaterial({ color: 0x1a0000 }), rB = new THREE.MeshLambertMaterial({ color: 0x7a0606, emissive: 0x200000 });
const rFace = new THREE.Group(); RIG.add(rFace);
{ const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), rD); h.scale.set(0.85, 1.4, 0.9); rFace.add(h);
  for (const x of [-0.045, 0.045]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.022, 0.02), rE); e.position.set(x, 0.07, 0.112); rFace.add(e); }
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.2, 0.02), rM); m.position.set(0, -0.07, 0.112); rFace.add(m); rFace.mouth = m;
  for (let i = 0; i < 5; i++) for (const y of [0.02, -0.13]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.01), rE); t.position.set(-0.026 + i * 0.013, y, 0.124); rFace.add(t); }
  for (const [x, l] of [[-0.03, 0.12], [0.02, 0.18], [0.035, 0.08]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, l, 0.01), rB); b.position.set(x, -0.17 - l / 2, 0.118); rFace.add(b); }
  rFace.rotation.z = 0.35; }
function mkHand() {
  const g = new THREE.Group(); RIG.add(g); g.rotation.x = PI / 2;
  const fa = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.55, 2, 6), rD); fa.position.y = -0.34; g.add(fa);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), rD); palm.scale.set(1, 1.1, 0.5); g.add(palm);
  g.fingers = [];
  for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.position.set(-0.033 + i * 0.022, 0.04, 0); f.rotation.z = (i - 1.5) * -0.12; g.add(f); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.13, 2, 4), rD); m.position.y = 0.075; f.add(m); const c = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.02, 0.006), rB); c.position.y = 0.15; f.add(c); g.fingers.push(f); }
  return g;
}
const rHL = mkHand(), rHR = mkHand();
const ATK = { on: false };
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const ease = (k) => { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 3); };
const CH_NAMES = { field: 'III · THE FIELD', bath: 'V · THE WAKE', door: 'VI · THE BACK DOOR', mill: 'VII · THE MILL' };
function attack(kind, dmg, then, tell) {
  if (ATK.on) return; ATK.tell = tell;
  const dur = { strangle: 2.3, shake: 1.8, push: 2.1, claw: 1.5 }[kind];
  Object.assign(ATK, { on: true, kind, dmg, then, t: 0, dur, dealt: false, sc: cur, nextFx: 0, base: camera.position.clone(), rot: camera.rotation.clone(), lookWas: look.on });
  look.on = false; setPhone(false); clearSay(); prompt(''); cross(false);
  RIG.visible = true; rFace.position.set(0, 0.02, -1.6); rFace.visible = true;
  rHL.visible = rHR.visible = true; rHL.fingers.concat(rHR.fingers).forEach((f) => (f.rotation.x = 0));
  rHL.rotation.set(PI / 2, 0, 0); rHR.rotation.set(PI / 2, 0, 0);
  if (kind === 'claw') rHL.visible = false;
  P.flash.value = 1; P.chroma.value = 1.2; P.warp.value = 0.8; P.red.value = 0.25; document.body.classList.add('attacking');
  sfx.scream(kind === 'strangle' ? 0.8 : 1, 1.1, 1.2); sfx.sting(1);
}
function updateAtk(dt) {
  const A_ = ATK; A_.t += dt; const t = A_.t, k = A_.kind;
  camera.position.copy(A_.base); camera.rotation.copy(A_.rot);
  rFace.position.z = lerp(-1.6, -0.42, t / 0.07); rFace.position.x = Math.sin(t * 50) * 0.006; rFace.mouth.scale.y = 1 + Math.sin(t * 30) * 0.15;
  atkL.intensity = 3.5 + Math.random() * 2; P.flash.value = t < 0.05 ? 0.9 : 0; P.stat.value = Math.random() < 0.15 ? 0.25 : 0.04;
  const hand = (h, x0, y0, z0, x1, y1, z1, k0, k1) => { const e = ease((t - k0) / (k1 - k0)); h.position.set(lerp(x0, x1, e), lerp(y0, y1, e), lerp(z0, z1, e)); };
  if (k === 'strangle') {
    hand(rHL, -0.5, -0.5, -0.65, -0.13, -0.15, -0.34, 0.05, 0.3); hand(rHR, 0.5, -0.5, -0.65, 0.13, -0.15, -0.34, 0.05, 0.3);
    rHL.rotation.z = -0.9; rHR.rotation.z = 0.9; rHL.fingers.concat(rHR.fingers).forEach((f) => (f.rotation.x = -ease((t - 0.3) / 0.3) * 1.1));
    camera.position.x += (Math.random() - 0.5) * 0.015; camera.position.y += (Math.random() - 0.5) * 0.015; camera.rotation.x += lerp(0, 0.35, t / 1.5);
    const c = ease((t - 0.3) / 1.6); $('choke').style.opacity = 1; $('choke').style.setProperty('--c', c.toFixed(3));
    P.red.value = 0.25 + c * 0.45;
    if (t > A_.nextFx && t > 0.35) { A_.nextFx = t + rand(0.22, 0.34); burst({ type: 'bandpass', f: rand(450, 750), q: 3, v: 1.6, a: 0.02, d: 0.16 }); tone({ type: 'sawtooth', f: rand(80, 110), v: 0.18, d: 0.15, lp: 420 }); }
    if (t > 0.4 && !A_.blood) { A_.blood = true; splat(150, 150, 30); splat(185, 160, 18); bloodShow(); }
    if (t > 1.9) P.fade.value = (t - 1.9) / 0.4;
  } else if (k === 'shake') {
    hand(rHL, -0.55, -0.4, -0.6, -0.26, -0.15, -0.34, 0.03, 0.15); hand(rHR, 0.55, -0.4, -0.6, 0.26, -0.15, -0.34, 0.03, 0.15);
    rHL.rotation.z = -0.5; rHR.rotation.z = 0.5; rHL.fingers.concat(rHR.fingers).forEach((f) => (f.rotation.x = -0.9));
    const s = Math.sin(t * 52) * (t > 0.15 ? 1 : 0) * (1 - Math.max(0, t - 1.3) * 2);
    camera.position.x += s * 0.11; camera.position.y += Math.cos(t * 47) * 0.05 * Math.abs(s); camera.rotation.z += s * 0.22; camera.rotation.x += Math.cos(t * 40) * 0.08 * Math.abs(s);
    rFace.position.y = 0.02 - s * 0.03; P.red.value = 0.35;
    if (t > A_.nextFx && t > 0.15 && t < 1.35) { A_.nextFx = t + 0.17; tone({ f: 62, fEnd: 34, v: 1.1, d: 0.14 }); burst({ buf: 'brown', f: 400, v: 1.2, d: 0.12 }); }
    if (t > 0.5 && !A_.blood) { A_.blood = true; splat(60, 40, 16); splat(260, 130, 22); splat(140, 170, 14); bloodShow(); }
    if (t > 1.5) P.fade.value = (t - 1.5) / 0.3;
  } else if (k === 'push') {
    hand(rHL, -0.25, -0.2, -0.75, -0.14, -0.12, -0.22, 0.08, 0.22); hand(rHR, 0.25, -0.2, -0.75, 0.14, -0.12, -0.22, 0.08, 0.22);
    rHL.rotation.z = -0.2; rHR.rotation.z = 0.2;
    const f = ease((t - 0.25) / 0.35);
    if (t > 0.25) {
      camera.translateZ(f * 1.3); camera.position.y = lerp(A_.base.y, 0.32, f); camera.rotation.x += f * 0.95; camera.rotation.z += f * 0.35;
      rHL.visible = rHR.visible = t < 0.4; rFace.position.set(lerp(0, 0.03, f), lerp(0.02, -0.03, f), lerp(-0.42, -0.62, f)); rFace.rotation.z = 0.35 + f * 0.5;
    }
    if (t > 0.6 && !A_.slam) { A_.slam = true; sfx.slam(); P.flash.value = 0.8; tone({ f: 4100, v: 0.09, a: 0.01, d: 2.4 }); splat(160, 175, 40); splat(40, 165, 16); bloodShow(); }
    if (t > 0.6 && t < 0.75) { camera.position.y += (Math.random() - 0.5) * 0.08; }
    P.red.value = t > 0.6 ? 0.45 : 0.25; if (t > 0.65) P.flash.value = Math.max(0, 0.8 - (t - 0.6) * 4);
    if (t > 1.7) P.fade.value = (t - 1.7) / 0.4;
  } else if (k === 'claw') {
    hand(rHR, 0.6, 0.4, -0.5, -0.6, -0.4, -0.32, 0.12, 0.3); rHR.rotation.z = 2.3; rHR.fingers.forEach((f) => (f.rotation.x = 0.3));
    if (t > 0.22 && !A_.blood) { A_.blood = true; claws(); bloodShow(3000); burst({ type: 'highpass', f: 2500, v: 1, d: 0.15 }); tone({ type: 'sawtooth', f: 300, fEnd: 90, v: 0.5, d: 0.3, dist: true }); }
    if (t > 0.22) { const kb = Math.max(0, 1 - (t - 0.22) * 3); camera.rotation.z -= kb * 0.35; camera.rotation.y += kb * 0.25; camera.position.x -= kb * 0.08; }
    P.red.value = t > 0.22 ? 0.5 : 0.25;
    if (t > 1.2) P.fade.value = (t - 1.2) / 0.3;
  }
  if (!A_.dealt && t > 0.18) { A_.dealt = true; HP -= A_.dmg; drawHP(); $('hp').classList.remove('hit'); void $('hp').offsetWidth; $('hp').classList.add('hit'); }
  if (t >= A_.dur) {
    ATK.on = false; RIG.visible = false; atkL.intensity = 0; $('choke').style.opacity = 0; document.body.classList.remove('attacking'); rFace.rotation.z = 0.35;
    camera.position.copy(A_.base); camera.rotation.copy(A_.rot);
    P.red.value = 0; P.stat.value = 0; P.chroma.value = 1; P.warp.value = 0.3; P.flash.value = 0;
    if (HP <= 0) { P.fade.value = 1; return go(SC.dead, { sc: A_.sc }); }
    P.fade.value = 1; tween(P.fade, 'value', 0, 0.6); look.on = A_.lookWas;
    if (HP <= 34) heartbeat(96, 0.5);
    if (A_.tell) {
      const el = $('tellFlash'); el.innerHTML = '<span>YOU MISSED IT</span>' + A_.tell; el.classList.add('show'); tone({ type: 'square', f: 180, v: 0.08, d: 0.3, lp: 900 });
      look.on = false; const sc = A_.sc;
      setTimeout(() => { el.classList.remove('show'); if (cur !== sc) return; look.on = A_.lookWas; A_.then && A_.then(); }, 2300);
    } else A_.then && A_.then();
  }
}

const SC = {};

// ======================================================= JUMPSCARE
SC.jump = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x000000);
    const f = this.face = new THREE.Group(); s.add(f);
    const dark = lam({ color: 0x0b0909 }), eye = basic(0xffffff), m = basic(0x140000), red = basic(0x6a0000);
    box(f, 0.62, 0.86, 0.5, dark, 0, 0, 0);
    box(f, 0.11, 0.055, 0.03, eye, -0.14, 0.15, 0.26); box(f, 0.11, 0.055, 0.03, eye, 0.14, 0.15, 0.26);
    box(f, 0.24, 0.5, 0.03, m, 0, -0.2, 0.26); box(f, 0.18, 0.4, 0.02, red, 0, -0.2, 0.272);
    for (let i = 0; i < 6; i++) { box(f, 0.025, 0.07, 0.02, eye, -0.09 + i * 0.036, 0.03, 0.28); box(f, 0.025, 0.07, 0.02, eye, -0.09 + i * 0.036, -0.43, 0.28); }
    f.rotation.z = 0.35;
    const l = this.light = new THREE.PointLight(0xff3a2a, 10, 6, 1.2); l.position.set(0, -0.9, 1.0); s.add(l);
    this.glass = plane(s, 4, 3, new THREE.MeshBasicMaterial({ color: 0x8aa0b0, transparent: true, opacity: 0.12, depthWrite: false }), 0, 0, -0.4);
    this.hands = new THREE.Group(); s.add(this.hands); this.hands.position.z = -0.6;
    for (const x of [-0.55, 0.55]) { box(this.hands, 0.22, 0.3, 0.02, dark, x, 0.05, 0); for (let i = 0; i < 4; i++) box(this.hands, 0.03, 0.28, 0.02, dark, x - 0.08 + i * 0.055, 0.32, 0).rotation.z = (i - 1.5) * 0.12 * Math.sign(x); }
    box(f, 1.4, 0.6, 0.5, dark, 0, -0.85, -0.2);
    s.add(new THREE.AmbientLight(0x402020, 1));
  },
  enter(o, ep) {
    if (!this.scene) this.build(); this.then = o.then; this.v = o.variant || 'face'; this.t = 0; this.scene.add(camera);
    camera.position.set(0, 0, 1.25); camera.rotation.set(0, 0, 0); this.face.position.set(0, 0, -6); this.face.rotation.set(0, 0, 0.35);
    this.glass.visible = this.v === 'window'; this.hands.visible = this.v === 'window'; this.light.intensity = this.v === 'dark' ? 0 : 10;
    P.fade.value = 0; P.red.value = 0; P.stat.value = 0; P.chroma.value = 2.5; P.warp.value = 2; cursor(false);
    this.lunge = this.v === 'dark' ? 1.3 : this.v === 'window' ? 0.15 : 0;
    if (this.v === 'dark') { this.face.position.z = 0.15; noVoice('Naim', null, 2.6); }
    if (this.v === 'window') { this.face.position.z = -0.9; }
    (async () => {
      await wait(this.lunge * 1000); if (!alive(ep)) return;
      this.hit = this.t; P.red.value = 0.5; P.stat.value = 0.18; sfx.scream(this.v === 'window' ? 0.85 : 1, 1.1, 1.3); sfx.sting(1);
      if (this.v === 'window') { sfx.glass(); document.body.classList.add('cracked'); }
      await wait(1150); if (!alive(ep)) return; P.fade.value = 1; document.body.classList.remove('cracked'); await wait(900); if (!alive(ep)) return; this.then();
    })();
  },
  update(dt) {
    this.t += dt; const f = this.face;
    if (this.hit == null || this.t < this.hit) {
      if (this.v === 'dark') { this.light.intensity = 0; f.position.z = 0.15; f.rotation.z = 0.35 + Math.sin(this.t * 3) * 0.05; P.fade.value = 0.55 - Math.min(0.5, this.t * 0.4); }
      if (this.v === 'window') { f.position.z = -0.9; this.light.intensity = 3; }
      return;
    }
    const k = Math.min(1, (this.t - this.hit) / 0.09); P.fade.value = 0; this.light.intensity = 10;
    if (this.v === 'window') { f.position.z = -0.9 + k * 0.35; this.hands.position.z = -0.6 + k * 0.05; }
    else f.position.z = this.v === 'dark' ? 0.15 + k * 0.5 : -6 + k * 6.6;
    f.rotation.z = 0.35 + Math.sin(this.t * 60) * 0.06;
    camera.position.x = rand(-0.04, 0.04); camera.position.y = rand(-0.04, 0.04);
    P.stat.value = rand(0.05, 0.3); P.flash.value = this.t - this.hit < 0.06 ? 0.7 : 0;
  },
  exit() { document.body.classList.remove('cracked'); this.hit = null; },
};

// ======================================================= BRIDGE (chapter card; next scene's sound leads the picture)
SC.bridge = {
  scene: voidScene,
  enter(o, ep) {
    cursor(false); P.fade.value = 1; let [num, name, when, line] = BRIDGE[o.key]; RUN.step++; num = ROMAN[RUN.step] || num; line = bridgeLine(RUN.last, o.key, line); RUN.last = o.key;
    $('cardNum').textContent = 'CHAPTER ' + num; $('cardName').textContent = name.toLowerCase(); $('cardWhen').textContent = when.toUpperCase(); $('cardLine').textContent = '';
    const el = $('card'); el.classList.remove('out'); el.classList.add('show');
    tone({ type: 'sine', f: 55, v: 0.25, a: 0.6, d: 3.2 }); tone({ type: 'sine', f: 82.4, v: 0.1, a: 1.2, d: 2.6 });
    const sc = o.sc; if (!sc.scene && !sc.rs && sc.build) { try { sc.build(); } catch (e) { } }
    (async () => {
      await wait(900); if (!alive(ep)) return; if (AK[o.key]) ambience(AK[o.key]);   // J-cut: hear the place before you see it
      await wait(o.opts.line ? 3300 : 2500); if (!alive(ep)) return; el.classList.add('out');
      await wait(650); if (!alive(ep)) return; el.classList.remove('show');
      go(sc, Object.assign({}, o.opts, { _b: true }));
    })();
  },
  onKey(c) { },
  exit() { $('card').classList.remove('show'); },
};
function prebuild() {
  const list = [SC.booth, SC.field, SC.hosp, SC.bath, SC.door, SC.mill, SC.bus, SC.opening]; let i = 0;
  const step = () => { if (cur !== SC.title || i >= list.length) return; const sc = list[i++]; try { if (!sc.scene && !sc.rs && sc.build) { sc.build(); const sn = sc.scene || sc.rs; if (sn && sn.isScene) renderer.compile(sn, camera); } } catch (e) { } setTimeout(step, 250); };
  setTimeout(step, 1200);
}

// ======================================================= FIRST ENCOUNTER (the hallway, that night)
SC.first = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x010204); s.fog = new THREE.Fog(0x020408, 3, 16);
    const w = lam({ color: 0x4a4640 }); plane(s, 2.4, 16, lam({ color: 0x2a2018 }), 0, 0, -5, -PI / 2); plane(s, 2.4, 16, lam({ color: 0x38342e }), 0, 2.5, -5, PI / 2);
    plane(s, 16, 2.5, w, -1.2, 1.25, -5, 0, PI / 2); plane(s, 16, 2.5, w, 1.2, 1.25, -5, 0, -PI / 2); plane(s, 2.4, 2.5, w, 0, 1.25, -13); plane(s, 2.4, 2.5, w, 0, 1.25, 2.2, 0, PI);
    for (const z of [-2.5, -6]) box(s, 0.04, 0.5, 0.4, lam({ color: 0x1a1612 }), -1.17, 1.55, z);
    box(s, 0.9, 2.05, 0.06, lam({ color: 0x3a2c1e }), 0, 1.02, 2.16); this.gap = box(s, 0.86, 0.03, 0.02, basic(0x000000), 0, 0.02, 2.12);
    this.moon = new THREE.PointLight(0x6a8ac0, 4, 11, 1.2); this.moon.position.set(0.9, 2, -3); s.add(this.moon); s.add(new THREE.AmbientLight(0x2a3448, 1.7)); const bk = new THREE.PointLight(0x7a9ad0, 5, 12, 1.1); bk.position.set(-0.6, 2, -11.5); s.add(bk); this.bk = bk;
    this.dl = new THREE.PointLight(0xffc880, 0, 9, 1.2); this.dl.position.set(0, 1.4, 1.6); s.add(this.dl);
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); s.add(this.ryan.g); setLayer(this.ryan.g, L_MASK);
    this.ent = entity({ tilt: 0.3 }); s.add(this.ent.g); setLayer(this.ent.g, L_TRUE);
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    Object.assign(this, { phase: 'see', pz: 0, ez: -8.5, seeT: 0, stepT: 0, fleeT: 0, done: false }); this.dl.intensity = 0; this.gap.material.color.setHex(0x000000); this.ryan.g.visible = this.ent.g.visible = true; this.ryan.head.rotation.z = 0;
    camera.position.set(0, 1.55, 0); setLook(0.85, -0.1, 1.15, 0.4); P.fade.value = 1; muffle(20000, 1.2); ambience('home'); heartbeat(70, 0.5);
    (async () => { await wait(700); if (!alive(ep)) return; await fadeIn(1.6); })();
  },
  async end(ep, caught) {
    if (this.done) return; this.done = true; controls([]); setTouch([]); objective(''); document.body.classList.remove('alone');
    const fin = async () => { this.dl.intensity = 4; this.gap.material.color.setHex(0xffd890); sfx.slam(); this.ryan.g.visible = this.ent.g.visible = false; relief(); await wait(2300); if (!alive(ep)) return; await fadeOut(0.9); if (!alive(ep)) return; go(SC.booth); };
    if (caught) attack('strangle', 34, fin, 'It moved when you stopped watching'); else fin();
  },
  update(dt, t) {
    const ep = epoch; const facing = Math.abs(look.yaw) < 0.22;
    if (this.phase === 'see') { if (facing && P.fade.value < 0.3) { this.seeT += dt; if (this.seeT > 0.5) { this.phase = 'near'; say('Naim: Ryan?', 1200); controls([{ keys: ['KeyW'], verb: 'Go to him', hold: true }]); setTouch([['KeyW', 'GO TO HIM']]); } } }
    else if (this.phase === 'near') {
      if (input.keys.KeyW || input.keys.ArrowUp) { this.pz -= 1.5 * dt; look.bob += dt * 8; this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.55; foot('wood', 0.7); } }
      if (this.pz < -2.6) { this.phase = 'flee'; controls([]); hush(700); say('Naim: No. You\u2019re not\u2014', 700); this.ryan.head.rotation.z = 0.55;
        setTimeout(() => { if (!alive(ep) || this.done) return; zippo(null, 1.6); sfx.sting(0.6); objective('DON\u2019T LET IT REACH YOU'); document.body.classList.add('alone'); controls([{ keys: ['KeyS'], verb: 'Back away', hold: true }]); setTouch([['KeyS', 'BACK AWAY']]); this.phase = 'run'; }, 900); }
    } else if (this.phase === 'run' && !this.done) {
      this.fleeT += dt; if (this.fleeT > 1.3) objective('FIND SOMEONE'); this.ez += (facing ? 1.7 : 2.9) * dt; fear(clamp(1 - (this.pz - this.ez) / 4, 0, 1));
      if (input.keys.KeyS || input.keys.ArrowDown) { this.pz += 1.55 * dt; look.bob += dt * 10; this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.4; foot('wood', 0.9); } }
      this.gap.material.color.setHex(0x6a5030);
      if (this.pz >= 1.2) this.end(ep, false); else if (this.pz - this.ez < 0.75) this.end(ep, true);
    }
    const sw = this.phase === 'run' ? Math.sin(t * 11) * 0.5 : 0; this.ryan.legL.rotation.x = sw; this.ryan.legR.rotation.x = -sw;
    for (const g of [this.ryan.g, this.ent.g]) g.position.set(0, 0, this.ez);
    if (!ATK.on) camera.position.set(0, 1.55 + Math.sin(look.bob) * 0.03, this.pz);
  },
  exit() { document.body.classList.remove('alone'); fear(0); },
};

// ======================================================= PORCH + BUS STOP (no narration)
SC.porch = {
  scene: voidScene,
  enter(o, ep) {
    cursor(false); P.fade.value = 1; ambience('home'); TOGETHER = true; this.wantLock = true;
    const D = SC.door; if (!D.scene) D.build(); this.walk = [];
    (async () => {
      // the porch: Mum, the bag, the back door
      this.scene = D.scene; D.scene.add(camera); D.ryan.g.visible = false; D.ent.g.visible = false; D.shadow.visible = false; D.piv.rotation.y = 0; D.porch.intensity = 7; D.faceL.intensity = 0;
      const m = D.mom; m.g.position.set(-0.55, 0, -1.9); m.g.rotation.y = PI * 0.85; m.g.visible = true; m.head.rotation.set(0, 0, 0); m.armR.rotation.set(0, 0, 0);
      camera.position.set(0.15, 1.6, -0.4); setLook(D.lookBase ?? 0, -0.02, 0.5, 0.3); look.ty = (D.lookBase ?? 0) - 0.2;
      await wait(900); if (!alive(ep)) return; await fadeIn(1.4); if (!alive(ep)) return;
      if (!await talk(ep, [['Mum', 'I packed some clothes.', 1500], ['Naim', 'You knew.', 1400], () => { m.head.rotation.x = 0.35; }, ['Mum', 'I knew what people here would do to you.', 1600], ['Naim', 'No.', 1000], 1500,
        ['Naim', 'You knew what the prayer did.', 1600], () => { m.head.rotation.x = 0; }, ['Mum', 'I was trying to keep you safe.', 1600], ['Naim', 'You let them hold me down.', 1800], ['Mum', 'I\u2019m your mother.', 1600], ['Naim', 'I know.', 1500],
        () => { m.armR.rotation.set(-1.3, 0, 0); tween(camera.position, 'z', 0.5, 1.6); foot('wood', 1); }, 600, () => foot('wood', 0.9), 600, () => foot('wood', 0.7), 1600])) return;
      RUN.log.push('Took the bag. Stepped away from Mum'); LEFT_MUM = 'spoke';
      await fadeOut(1.2); if (!alive(ep)) return; m.g.visible = false;
      // the bus stop at sunset: the bus pulls in, people get off, Ryan is waiting
      if (!this.bs) this.buildStop(); const B = this.bs; this.scene = B.s; B.s.add(camera);
      B.bus.position.z = -70; sit(B.ryan); B.ryan.g.position.set(0.9, -0.04, 0.6); B.ryan.g.rotation.y = -PI / 2; B.ryan.head.rotation.set(0.2, 0, 0); B.ppl.forEach((h) => { h.g.visible = false; }); this.walk = []; this.ryWalk = false;
      camera.position.set(-2.6, 1.6, 1.6); setLook(-PI / 2 + 0.12, -0.03, 0.7, 0.3); ambience('bus');
      await wait(700); if (!alive(ep)) return; await fadeIn(1.8); if (!alive(ep)) return;
      if (!await talk(ep, [1200, () => { B.ryan.head.rotation.set(0, 0.5, 0); }, ['Ryan', 'Is that for me?', 1700], ['Naim', 'I don\u2019t know.', 2000], () => { B.ryan.head.rotation.set(0.3, 0.5, 0); }, 1300, () => { B.ryan.head.rotation.set(0, 0, 0); }])) return;
      // the bus
      const eng = loopNoise({ buf: 'brown', f: 110, v: 0.05 }); tween(eng.g.gain, 'value', 0.3, 3.5); tween(B.bus.position, 'z', 0, 4.2, (x) => 1 - (1 - x) * (1 - x));
      await wait(4300); if (!alive(ep)) return; sfx.hiss(); await wait(900); if (!alive(ep)) return;
      // people get off. it never comes when there are people.
      B.ppl.forEach((h, i) => setTimeout(() => { if (!alive(ep)) return; h.g.visible = true; h.g.position.set(1.9, 0, -1.2); foot('tile', 0.6); this.walk.push({ h, vx: -0.9 - (i % 2) * 0.3, vz: i % 2 ? 1.0 : -0.5 - i * 0.15, ph: i * 2 }); }, i * 1100));
      await wait(2600); if (!alive(ep)) return;
      const r = B.ryan; r.hips.position.y = 0.92; for (const L of [r.legL, r.legR]) { L.rotation.x = 0; L.knee.rotation.x = 0; } r.g.position.set(0.9, 0, 0.3); r.g.rotation.y = -PI / 2;
      if (!await talk(ep, [600, ['Ryan', 'You getting on?', 1400], ['Naim', 'Are you?', 1300], ['Ryan', 'Yeah.', 1300], ['Naim', 'All right.', 1400]])) return;
      r.g.rotation.y = PI * 0.75; this.ryWalk = true; tween(r.g.position, 'x', 1.9, 1.8); tween(r.g.position, 'z', -1.1, 1.8); tween(camera.position, 'x', -1.2, 2.4);
      await wait(1900); if (!alive(ep)) return; r.g.visible = false; this.ryWalk = false;
      await fadeOut(1.2); if (!alive(ep)) return; r.g.visible = true; go(SC.bus);
    })();
  },
  buildStop() {
    const s = new THREE.Scene(); s.background = new THREE.Color(0x2a1430); s.fog = new THREE.Fog(0x7a3440, 16, 150);
    const skyT = ctex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); [[0, '#140e30'], [0.28, '#43205c'], [0.4, '#b0406a'], [0.46, '#ff7e3a'], [0.495, '#ffd58a'], [0.51, '#5a2420'], [1, '#120808']].forEach(([a, c]) => gr.addColorStop(a, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 1, 1);
    skyT.magFilter = THREE.LinearFilter; skyT.minFilter = THREE.LinearFilter;
    s.add(new THREE.Mesh(new THREE.SphereGeometry(85, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })));
    const sunP = new THREE.Vector3(72, 5.2, -14);
    for (const [r, c, op] of [[15, 0xff7a30, 0.2], [9, 0xffa050, 0.32], [4.6, 0xffe6a8, 1]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, fog: false, depthWrite: false, blending: op < 1 ? THREE.AdditiveBlending : THREE.NormalBlending })); m.position.copy(sunP); m.lookAt(0, 1.6, 0); s.add(m); }
    const hillM = new THREE.MeshBasicMaterial({ color: 0x24102a, fog: false }); for (let i = 0; i < 9; i++) { const hgt = 2.2 + ((i * 37) % 9) * 0.45; const hm = new THREE.Mesh(new THREE.BoxGeometry(12, hgt, 20 + (i % 3) * 7), hillM); hm.position.set(60 + (i % 2) * 6, hgt / 2 - 0.3, -90 + i * 22); s.add(hm); }
    plane(s, 200, 200, lam({ color: 0x6a4a26 }), 0, 0, 0, -PI / 2); plane(s, 6, 200, lam({ color: 0x2a2428 }), 4.2, 0.01, 0, -PI / 2); plane(s, 3.4, 200, lam({ color: 0x4a4038 }), -0.4, 0.012, 0, -PI / 2);
    for (let z = -60; z < 60; z += 6) plane(s, 0.14, 2.4, basic(0xd8c890), 4.2, 0.02, z, -PI / 2);
    // shelter, bench, sign
    const sm = lam({ color: 0x3a4a52 }); box(s, 0.08, 2.3, 0.08, sm, 0.2, 1.15, -0.6); box(s, 0.08, 2.3, 0.08, sm, 0.2, 1.15, 1.8); box(s, 1.5, 0.08, 2.7, sm, 0.75, 2.32, 0.6); box(s, 0.06, 1.5, 2.4, new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.12, depthWrite: false }), 0.2, 1.2, 0.6);
    box(s, 0.5, 0.08, 1.8, lam({ color: 0x6a4a2a }), 0.75, 0.45, 0.6); box(s, 0.08, 0.45, 0.08, sm, 0.75, 0.22, -0.2); box(s, 0.08, 0.45, 0.08, sm, 0.75, 0.22, 1.4);
    box(s, 0.07, 2.6, 0.07, sm, 1.5, 1.3, -2.4); box(s, 0.5, 0.5, 0.05, basic(0xe8c040), 1.5, 2.4, -2.4);
    // the bus
    const bus = new THREE.Group(); s.add(bus); const body = lam({ color: 0xd8cdb0 }), dark = lam({ color: 0x15171c });
    box(bus, 2.5, 2.5, 10.5, body, 3.4, 1.65, 1.5); box(bus, 2.54, 0.35, 10.54, lam({ color: 0x8a2a22 }), 3.4, 1.15, 1.5); box(bus, 2.56, 0.85, 9.2, basic(0x3a2a30), 3.4, 2.2, 1.7);
    for (let i = 0; i < 6; i++) box(bus, 2.58, 0.9, 0.1, body, 3.4, 2.2, -2.2 + i * 1.6);
    box(bus, 0.06, 2.0, 0.95, dark, 2.14, 1.25, -1.2); const dl = new THREE.PointLight(0xffd8a0, 3, 5, 1.3); dl.position.set(1.9, 1.8, -1.2); bus.add(dl);
    for (const z of [-2.4, 4.9]) for (const x of [2.3, 4.5]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), dark); wh.rotation.z = PI / 2; wh.position.set(x, 0.5, z); bus.add(wh); }
    box(bus, 0.3, 0.18, 0.05, basic(0xfff0c0), 2.6, 0.9, -3.77); box(bus, 0.3, 0.18, 0.05, basic(0xfff0c0), 4.2, 0.9, -3.77);
    const SK = [0xc8a590, 0x8a5a44, 0xe0b8a0, 0x6a4636], SH = [0x7a3a3a, 0x3a5a4a, 0x8a8a6a, 0x4a4a6a];
    const ppl = [0, 1, 2, 3].map((i) => { const h = human({ shirt: SH[i], pants: 0x1c1c22, skin: SK[i], hair: [0x1a120c, 0x8a8a84, 0x5a3a1a, 0x2a1a12][i] }); h.g.visible = false; s.add(h.g); return h; });
    const ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); s.add(ryan.g);
    s.add(new THREE.AmbientLight(0x7a5058, 1.7)); const sl = new THREE.DirectionalLight(0xff8e4a, 2.4); sl.position.set(10, 2.2, -2); s.add(sl); const fl = new THREE.PointLight(0xffb890, 2.2, 9, 1.2); fl.position.set(-2, 2, 2); s.add(fl);
    this.bs = { s, bus, ppl, ryan };
  },
  update(dt, t) {
    for (const k of this.walk || []) { k.h.g.position.x += k.vx * dt; k.h.g.position.z += k.vz * dt; k.h.g.rotation.y = Math.atan2(k.vx, k.vz); const sw = Math.sin(t * 7 + k.ph); k.h.legL.rotation.x = sw * 0.5; k.h.legR.rotation.x = -sw * 0.5; k.h.armL.rotation.x = -sw * 0.3; k.h.armR.rotation.x = sw * 0.3; }
    if (this.ryWalk && this.bs) { const sw = Math.sin(t * 8); this.bs.ryan.legL.rotation.x = sw * 0.5; this.bs.ryan.legR.rotation.x = -sw * 0.5; }
  },
  exit() { this.scene = voidScene; this.walk = []; if (SC.door.mom) SC.door.mom.g.visible = false; },
};

// ======================================================= CROSSROADS (the player picks the route; standing still alone costs you)
function crossOpts() {
  const o = [];
  if (!RUN.did.bath) o.push({ name: 'FIND RYAN', desc: 'He\u2019s at the wake.', pick() { RUN.trust++; RUN.log.push(RUN.did.hosp ? 'Then went to find Ryan' : 'Went to find Ryan first, with nothing'); go(SC.bath); } });
  if (!RUN.did.hosp) o.push({ name: 'GO TO JESSICA', desc: 'Izzie said she survived.', pick() { RUN.log.push(RUN.did.bath ? 'Then went to Jessica' : 'Went to Jessica first'); go(SC.hosp, { withRyan: RUN.withRyan }); } });
  o.push({ name: 'GO HOME', desc: 'Mum won\u2019t know I left.', pick() { if (!RUN.did.bath) RUN.trust--; RUN.log.push(!RUN.did.bath && !RUN.did.hosp ? 'Went straight home' : !RUN.did.bath ? 'Went home. Left Ryan at the wake' : !RUN.did.hosp ? 'Went home without the lighter' : 'Went home'); go(SC.door); } });
  return o;
}
SC.cross = {
  scene: voidScene,
  enter(o, ep) {
    cursor(false); P.fade.value = 1; this.opts = crossOpts(); this.time = 13; this.t = this.time; this.open = false; this.tick = 0;
    if (o.id === 'A') RUN.withRyan = !!o.withRyan;
    for (let i = 0; i < 3; i++) { const op = this.opts[i], el = $('crossO' + i); el.style.display = op ? '' : 'none'; el.classList.remove('picked', 'lost'); if (op) { $('crossN' + i).textContent = op.name; $('crossD' + i).textContent = 'Naim: ' + op.desc; } }
    $('crossBar').style.width = '100%'; $('xroad').classList.remove('gone'); $('xroad').classList.add('show'); ambience('field'); heartbeat(64, 0.5);
    (async () => { await wait(1100); if (!alive(ep)) return; this.open = true; setTouch(this.opts.map((_, i) => ['Digit' + (i + 1), String(i + 1)])); })();
  },
  async choose(i, late) {
    if (!this.open || !this.opts[i]) return; this.open = false; const ep = epoch; setTouch([]); document.body.classList.remove('alone');
    if (late) {
      // something breathes behind him. the choices are gone.
      $('xroad').classList.add('gone'); hush(500); burst({ buf: 'brown', type: 'bandpass', f: 500, q: 1.2, v: 1.6, a: 0.5, d: 1.4 }); await wait(1300); if (!alive(ep)) return;
      sfx.sting(0.7); P.red.value = 0.6; tween(P.red, 'value', 0, 1.2); HP = Math.max(1, HP - 17); drawHP(); say('Naim: Shit.', 800); objective('KEEP MOVING'); await wait(1700); if (!alive(ep)) return; objective('');
    } else { for (let k = 0; k < 3; k++) $('crossO' + k).classList.add(k === i ? 'picked' : 'lost'); tone({ type: 'square', f: 520, v: 0.06, d: 0.1, lp: 2000 }); await wait(750); if (!alive(ep)) return; }
    $('xroad').classList.remove('show'); this.opts[i].pick();
  },
  onKey(c) { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(c); const j = ['Numpad1', 'Numpad2', 'Numpad3'].indexOf(c); if (i >= 0) this.choose(i); else if (j >= 0) this.choose(j); },
  update(dt) {
    if (!this.open) return; this.t -= dt; $('crossBar').style.width = Math.max(0, this.t / this.time * 100) + '%';
    if (this.t < 5 && Math.floor(this.t) !== this.tick) { this.tick = Math.floor(this.t); tone({ type: 'sine', f: 70, v: 0.3, d: 0.25 }); fear(1 - this.t / 5); }
    if (this.t <= 0) this.choose(0, true);
  },
  exit() { $('xroad').classList.remove('show'); document.body.classList.remove('alone'); fear(0); objective(''); },
};
for (let i = 0; i < 3; i++) $('crossO' + i).onclick = () => cur === SC.cross && SC.cross.choose(i);

// ======================================================= TITLE
const MENU = { panel: 'menuMain', idx: 0, vol: 0.9, fx: true };
function menuItems() { return [...$(MENU.panel).querySelectorAll('.mi')]; }
function menuSel(i, sound = true) {
  const it = menuItems(); if (!it.length) return;
  MENU.idx = (i + it.length) % it.length; it.forEach((b, k) => b.classList.toggle('sel', k === MENU.idx));
  if (sound) tone({ type: 'square', f: 520, v: 0.04, d: 0.05, lp: 1800 });
}
function menuPanel(id) {
  for (const p of ['menuMain', 'menuChapters', 'menuOptions', 'menuNote']) $(p).classList.toggle('hidden', p !== id);
  MENU.panel = id; menuSel(0, false);
}
function volBar() { const n = Math.round(MENU.vol / 1.2 * 10); $('volBar').textContent = '\u25A0'.repeat(n) + '\u25A1'.repeat(10 - n); }
function titleWake() { if (!A.ctx) { A.init(); setVolume(MENU.vol); } else A.ctx.resume(); primeTrack(); if (cur === SC.title && !SC.title.amb) { SC.title.amb = true; fireLoop(0.18); drone(36.7, 0.03); } }
const SCENES = { field: () => SC.field, hosp: () => SC.hosp, gas: () => SC.gas, opening: () => SC.opening, booth: () => SC.booth, bathroom: () => SC.bath, texts: () => SC.texts, door: () => SC.door, 'door-real': () => SC.door, 'door-fake': () => SC.door, mill: () => SC.mill, bus: () => SC.bus, credits: () => SC.credits };
function startAt(sc) { newRun(sceneKey(sc)); FILM = 3; BAT = 1; LIGHTER = 2; TOGETHER = true; LEFT_MUM = 'silent'; HP = MAXHP; titleWake(); primeTrack(); requestLock(); sfx.lighter(); P.fade.value = 1; go(sc); }
function menuAct(b) {
  titleWake(); tone({ type: 'square', f: 780, v: 0.05, d: 0.08, lp: 2200 });
  const act = b.dataset.act, to = b.dataset.go;
  if (to) return startAt(SCENES[to]());
  if (act === 'start') { const h = location.hash.slice(1); return startAt((SCENES[h] || SCENES.opening)()); }
  if (act === 'chapters') return menuPanel('menuChapters');
  if (act === 'options') return menuPanel('menuOptions');
  if (act === 'note') return menuPanel('menuNote');
  if (act === 'back') return menuPanel('menuMain');
  if (act === 'vol') { MENU.vol = MENU.vol >= 1.2 ? 0 : Math.round((MENU.vol + 0.12) * 100) / 100; setVolume(MENU.vol); $('vol').value = MENU.vol; volBar(); }
  if (act === 'voice') { voice.on = !voice.on; $('voiceVal').textContent = voice.on ? 'On' : 'Off'; if (voice.on) sayAloud('Naim', true); }
  if (act === 'fx') { MENU.fx = !MENU.fx; $('fxVal').textContent = MENU.fx ? 'On' : 'Off'; document.body.classList.toggle('nofx', !MENU.fx); P.grain.value = MENU.fx ? 0.07 : 0.02; P.warp.value = 0; }
}
document.querySelectorAll('#title .mi').forEach((b) => {
  b.addEventListener('mouseenter', () => { const i = menuItems().indexOf(b); if (i >= 0 && i !== MENU.idx) menuSel(i); });
  b.addEventListener('click', (e) => { e.stopPropagation(); menuAct(b); });
});
SC.title = {
  scene: voidScene,
  enter() { cursor(true); unlock(); $('title').classList.add('show'); P.fade.value = 0; this.amb = false; menuPanel('menuMain'); volBar(); startTitleArt(); prebuild(); if (A.ctx) titleWake(); },
  exit() { $('title').classList.remove('show'); stopTitleArt(); this.amb = false; },
  onKey(c) {
    if (c === 'ArrowDown' || c === 'KeyS') menuSel(MENU.idx + 1);
    else if (c === 'ArrowUp' || c === 'KeyW') menuSel(MENU.idx - 1);
    else if (c === 'Enter' || c === 'Space') menuAct(menuItems()[MENU.idx]);
    else if ((c === 'ArrowLeft' || c === 'ArrowRight') && menuItems()[MENU.idx]?.dataset.act === 'vol') { MENU.vol = Math.max(0, Math.min(1.2, MENU.vol + (c === 'ArrowRight' ? 0.12 : -0.12))); setVolume(MENU.vol); volBar(); }
    else if (c === 'Escape' || c === 'Backspace') menuPanel('menuMain');
  },
};

// ======================================================= OPENING (ritual)
SC.opening = {
  build() {
    const s = this.rs = new THREE.Scene(); s.background = new THREE.Color(0); s.fog = new THREE.Fog(0x000000, 2, 9);
    plane(s, 10, 10, texMat('carpet', 6, 6), 0, 0, 0, -PI / 2);
    this.lying = [];
    for (const x of [-0.45, 0.45]) {
      const h = human({ shirt: x < 0 ? 0x6a6a6a : 0x2d3b52 }); h.g.rotation.x = -PI / 2; h.g.position.set(x, 0.14, 0.9); s.add(h.g);
      h.armL.rotation.z = -0.4; h.armR.rotation.z = 0.4; this.lying.push(h);
    }
    this.stand = [];
    const spots = [[-1.2, -0.2], [0, -0.9], [1.25, -0.1], [0.9, 1.9], [-1, 1.8]];
    for (const [x, z] of spots) {
      const h = human({ shirt: 0x141414, pants: 0x121212, skin: 0x6a5048, hair: 0x0a0a0a }); h.g.position.set(x, 0, z); h.g.lookAt(0, 0, 0.9); s.add(h.g);
      h.armL.rotation.x = -2.6; h.armR.rotation.x = -2.6; h.armL.rotation.z = -0.3; h.armR.rotation.z = 0.3; this.stand.push(h);
    }
    this.cl = [];
    for (const [x, z] of [[-1.8, 0.9], [1.8, 0.9], [0, -1.6]]) {
      box(s, 0.06, 0.25, 0.06, basic(0xe8dcc0), x, 0.12, z); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,240,180,1)', 'rgba(255,140,40,0.7)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      fl.scale.set(0.12, 0.2, 1); fl.position.set(x, 0.33, z); s.add(fl);
      const l = new THREE.PointLight(0xffa050, 2.6, 6, 1.4); l.position.set(x, 0.5, z); s.add(l); this.cl.push(l);
    }
    s.add(new THREE.AmbientLight(0x100606, 1));
    this.cam = new THREE.Vector3(0, 3.1, 2.9);
    // POV ritual: faces leaning over you
    const p2 = this.ps = new THREE.Scene(); p2.background = new THREE.Color(0); p2.fog = new THREE.Fog(0x000000, 1.5, 6);
    plane(p2, 8, 8, lam({ color: 0x2a2620 }), 0, 3.2, 0, PI / 2);
    this.over = [];
    const mk = (o, x, z, lean) => { const h = human(o); h.g.position.set(x, 0, z); h.g.lookAt(0, 0, 0); h.torso.rotation.x = lean; h.head.rotation.x = 0.5; h.armL.rotation.x = -1.2; h.armR.rotation.x = -1.2; p2.add(h.g); this.over.push(h); return h; };
    const dk = { shirt: 0x141414, pants: 0x121212, skin: 0x7a6058, hair: 0x0a0a0a };
    mk(dk, -0.75, 0.25, 0.75); mk(dk, 0, 0.95, 0.85); this.healer = mk({ shirt: 0x1a1a1a, pants: 0x121212, skin: 0x8a7468, hair: 0x9a9a94 }, 0, -0.9, 0.7);
    this.mum = mk({ shirt: 0x6a4a5a, pants: 0x4a3a44, hair: 0x2a1a12, skin: 0xb48468 }, 0.8, 0.2, 0.75);
    box(this.healer.torso, 0.03, 0.2, 0.03, basic(0xd8d0b0), 0, 0.62, 0.14); box(this.healer.torso, 0.12, 0.03, 0.03, basic(0xd8d0b0), 0, 0.66, 0.14);
    const lg = this.lgt = new THREE.Group(); p2.add(lg);
    box(lg, 0.05, 0.075, 0.022, lam({ color: 0xc8a050, emissive: 0x3a2808 }), 0, -0.05, 0); box(lg, 0.05, 0.03, 0.022, lam({ color: 0xc8a050 }), -0.035, 0.0, 0).rotation.z = 1.2;
    const fs = this.flameS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,220,1)', 'rgba(255,150,40,0.8)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); fs.position.y = 0.03; lg.add(fs);
    this.flameL = new THREE.PointLight(0xffa040, 0, 3.5, 1.2); lg.add(this.flameL);
    const cl2 = new THREE.PointLight(0xffa050, 3.2, 5, 1.3); cl2.position.set(0.9, 0.5, -0.5); p2.add(cl2); this.cl2 = cl2;
    p2.add(new THREE.AmbientLight(0x180a08, 1));
  },
  enter(o, ep) {
    if (!this.rs) this.build(); cursor(false); this.scene = voidScene; this.flashT = 1.5; this.showT = 0; this.done = false; this.pov = false; this.choking = false; this.mumLook = ''; this.jolt = 0; LIGHTER = 0;
    this.rs.add(camera); camera.position.copy(this.cam); camera.lookAt(0, 0, 0.75); P.fade.value = 0;
    ritualAudio(); this.run(ep);
  },
  async run(ep) {
    await wait(1400); if (!alive(ep)) return;
    center('VICTORIA, AUSTRALIA'); await wait(2600); if (!alive(ep)) return; center(''); await wait(700); if (!alive(ep)) return;
    const thud = () => burst({ buf: 'brown', type: 'lowpass', f: 120, v: 2.2, a: 0.005, d: 0.35 });
    if (!await talk(ep, [['Naim', 'I told them.', 2000], 1000, ["Hunter's father", 'You did the right thing.', 2200], 1300, () => zippoOpen(null, 1.5), 1600, ['Healer', 'Look at the flame.', 2300], 1500, () => { hush(3000); zippo(null, 1.8); }, 2000,
      () => sfx.gasp(), ['Ryan', 'I can\u2019t\u2014', 900], () => { thud(); P.red.value = 0.2; tween(P.red, 'value', 0, 0.8); }, 1100, ['Hunter', 'Dad?', 1500], () => thud(), 3400, ['Naim', 'They stopped moving.', 2800], 1400])) return;
    // Naim's turn: POV on the floor, Mum above
    this.done = true; this.pov = true; this.scene = this.ps; this.ps.add(camera); camera.position.set(0, 0.25, 0); camera.rotation.set(1.35, 0, 0, 'YXZ'); P.stat.value = 0.05; P.fade.value = 1; tween(P.fade, 'value', 0, 1.2);
    this.lz = 1.5; this.lit = false; this.choke = 0; this.lgt.visible = false;
    await wait(900); if (!alive(ep)) return;
    zippoOpen(null, 1.4); await wait(420); if (!alive(ep)) return; this.lgt.visible = true; this.lit = true; tween(this, 'lz', 0.42, 19);
    const cv = ['Hold him.', 'It\u2019s all right, love.', 'Don\u2019t fight it.', 'Let it leave you.', 'That\u2019s it.', 'Nearly done.'];
    heartbeat(92, 0.6);
    for (let i = 0; i < cv.length; i++) {
      whisper(cv[i], panner(i % 2 ? 1.3 : -1.3, 1, -0.5, 0.5), 2.6); if (i < cv.length - 1) setTimeout(() => whisper(cv[i + 1], panner(i % 2 ? -1.5 : 1.5, 1.2, 0.4, 0.5), 1.4), 700);
      if (i === 1 || i === 3) { this.jolt = 1; sfx.gasp(); } if (i === 2) heartbeat(112, 0.8);
      await say(cv[i], 1000); if (!alive(ep)) return; await wait(300); if (!alive(ep)) return;
    }
    if (!await talk(ep, [700, () => { this.jolt = 0.6; }, ['Naim', 'Mum.', 1500], () => { this.mumLook = 'down'; }, 900, ['Mum', 'I\u2019m here.', 2200], 1100,
      () => { this.jolt = 1.4; sfx.gasp(); heartbeat(128, 1.0); }, ['Naim', 'Make them stop.', 2200], () => { this.mumLook = 'away'; }, 2800])) return;
    // silence. then the lid.
    hush(1700); await wait(1500); if (!alive(ep)) return;
    zippo(null, 1.8); this.lit = false; this.lgt.visible = false; this.flameL.intensity = 0; muffle(320, 0.05);
    this.choking = true; this.struggle = 0; this.canStruggle = true; $('choke').style.opacity = 1;
    controls([{ keys: ['Space'], verb: 'Breathe', hold: true, fill: () => this.struggle }]); setTouch([['Space', 'BREATHE']]);
    heartbeat(132, 1.0);
    await wait(7600); if (!alive(ep)) return;
    this.canStruggle = false; this.choking = false; controls([]); setTouch([]); clearSay();
    P.fade.value = 1; $('choke').style.opacity = 0; stopAll(); muffle(20000, 1.5);
    await wait(900); if (!alive(ep)) return; 
    go(SC.first);
  },
  update(dt, t) {
    if (this.pov) {
      const fw = 1.35; this.lgt.position.set(Math.sin(t * 0.9) * 0.02, 0.25 + Math.sin(fw) * this.lz, -Math.cos(fw) * this.lz - 0.02); this.lgt.lookAt(camera.position);
      if (this.lit) { const f = 0.9 + Math.random() * 0.25; this.flameS.scale.set(0.05 * f, 0.09 * f, 1); this.flameL.intensity = 3.2 * f; if (Math.random() < 0.3) burst({ type: 'bandpass', f: 900, q: 0.6, v: 0.05, d: 0.08 }); }
      if (this.choking) { this.choke = Math.min(1, this.choke + dt / 7.5); $('choke').style.setProperty('--c', this.choke.toFixed(3)); P.red.value = this.choke * 0.4;
        if (Math.random() < dt * 2.4) { burst({ type: 'bandpass', f: rand(420, 700), q: 3, v: 1.8, a: 0.02, d: 0.18 }); }
        camera.position.x = (Math.random() - 0.5) * 0.03 * (1 + this.choke * 3); }
      const held = this.canStruggle && input.keys.Space;
      this.struggle = clamp((this.struggle || 0) + (held ? dt * 0.9 : -dt * 1.6), 0, 0.82);
      if (held && this.struggle > 0.8) { this.struggle = 0.1; burst({ type: 'bandpass', f: 500, q: 3, v: 2.2, a: 0.02, d: 0.3 }); }
      const jm = (held ? 4 : 1) * (1 + (this.jolt || 0) * 5); camera.rotation.set(1.35 + Math.sin(t * 9) * 0.02 * jm, Math.sin(t * 7) * 0.03 * jm, 0, 'YXZ');
      for (const h of this.over) { h.torso.rotation.x += (Math.sin(t * 1.7 + h.g.position.x) * 0.04); h.torso.rotation.x = clamp(h.torso.rotation.x, 0.6, 0.95); }
      this.jolt = Math.max(0, (this.jolt || 0) - dt * 1.6); const mh = this.mum.head.rotation; if (this.mumLook === 'down') { mh.y += (0 - mh.y) * dt * 4; mh.x += (0.55 - mh.x) * dt * 4; } else if (this.mumLook === 'away') { mh.y += (1.25 - mh.y) * dt * 2.5; mh.x += (0 - mh.x) * dt * 3; } else mh.y = Math.sin(t * 0.8) * 0.5; this.cl2.intensity = 2.6 + Math.random() * 1.2;
      return;
    }
    if (this.done) return;
    for (const h of this.lying) { h.torso.rotation.x = Math.sin(t * 31 + h.g.position.x * 9) * 0.12; h.head.rotation.y = Math.sin(t * 23) * 0.5; h.armL.rotation.z = -0.4 + Math.sin(t * 27) * 0.3; }
    for (const h of this.stand) h.torso.rotation.x = Math.sin(t * 2 + h.g.position.x) * 0.1;
    for (const l of this.cl) l.intensity = 2 + Math.random() * 1.2;
    camera.position.x = this.cam.x + Math.sin(t * 0.7) * 0.15;
    this.flashT -= dt;
    if (this.scene === this.rs) { this.showT -= dt; if (this.showT <= 0) { this.scene = voidScene; P.stat.value = 0; } }
    else if (this.flashT <= 0) { this.scene = this.rs; this.showT = rand(0.08, 0.22); this.flashT = rand(1.2, 2.8); P.stat.value = 0.12; burst({ type: 'bandpass', f: 1800, q: 0.8, v: 0.5, d: 0.2 }); }
  },
};

// ======================================================= PHOTO BOOTH
SC.booth = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x020101);
    plane(s, 1.8, 2.4, texMat('curtain', 3, 1), 0, 1.2, -0.95);
    plane(s, 1.8, 1.5, texMat('carpet', 2, 2), 0, 0, -0.2, -PI / 2);
    const side = texMat('metal', 1, 2);
    plane(s, 1.5, 2.4, side, -0.9, 1.2, -0.2, 0, PI / 2); plane(s, 1.5, 2.4, side, 0.9, 1.2, -0.2, 0, -PI / 2);
    box(s, 1.6, 0.42, 0.45, lam({ color: 0x3a1a1a }), 0, 0.21, -0.65);
    box(s, 1.8, 0.1, 1.5, lam({ color: 0x151515 }), 0, 2.4, -0.2);
    this.naim = human({ shirt: 0x6b6b66, pants: 0x232631, hair: 0x1a120c, skin: 0xb48468 }); sit(this.naim); this.naim.g.position.set(-0.3, 0, -0.62); s.add(this.naim.g);
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); sit(this.ryan); this.ryan.g.position.set(0.3, 0, -0.62); s.add(this.ryan.g);
    setLayer(this.ryan.g, L_MASK);
    this.ent = entity({ tilt: 0.25 }); this.ent.g.position.set(0.3, -0.95, -0.62); this.ent.g.scale.setScalar(1.05); s.add(this.ent.g); setLayer(this.ent.g, L_TRUE);
    this.key = new THREE.PointLight(0xfff0dc, 3.2, 5, 1.2); this.key.position.set(0, 1.55, 0.6); s.add(this.key);
    this.fill = new THREE.PointLight(0xff3030, 0.8, 4, 1.4); this.fill.position.set(0, 2.2, -0.4); s.add(this.fill);
    s.add(new THREE.AmbientLight(0x2a1c1c, 1));
  },
  pose(i) {
    const n = this.naim, r = this.ryan, e = this.ent;
    for (const h of [n, r]) { h.head.rotation.set(0, 0, 0); h.torso.rotation.set(0, 0, 0); h.armL.rotation.set(0, 0, 0); h.armR.rotation.set(0, 0, 0); }
    e.torso.rotation.set(0.18, 0, 0); e.head.rotation.set(0, 0, 0.25);
    if (i === 1) { r.armL.rotation.z = -1.25; r.armL.rotation.x = 0.35; n.armR.rotation.z = 0.35; n.head.rotation.z = 0.1; }
    if (i === 2) { r.head.rotation.z = 0.32; n.head.rotation.z = -0.32; r.torso.rotation.z = 0.14; n.torso.rotation.z = -0.14; r.armL.rotation.z = -1.25; r.armL.rotation.x = 0.35; }
    if (i === 3) { r.head.rotation.y = -1.15; n.head.rotation.y = 1.15; r.torso.rotation.z = 0.3; n.torso.rotation.z = -0.28; e.torso.rotation.z = 0.32; e.head.rotation.set(0, -1.0, 0.1); }
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera);
    camera.position.set(0, 1.2, 1.05); camera.lookAt(0, 0.98, -0.5); this.base = camera.position.clone();
    const imgs = [...$('strip').querySelectorAll('img')]; imgs.forEach((im) => { im.className = ''; im.removeAttribute('src'); }); $('strip').className = '';
    this.key.intensity = 3.2; this.fill.intensity = 0.8; this.pose(0); this.ryan.head.rotation.set(0, 0, 0);
    loopNoise({ buf: 'brown', f: 220, v: 0.25 }); hum(0.025);
    every(3000, () => burst({ buf: 'brown', f: 300, v: 0.15, d: 1.2, a: 0.4 }));
    this.run(ep);
  },
  waitClick() { return new Promise((r) => { this.onClick = () => { this.onClick = null; r(); }; this.onKey = (c) => { if (c === 'Space' || c === 'Enter') { this.onKey = null; this.onClick = null; r(); } }; }); },
  async run(ep) {
    await fadeIn(1.2); if (!alive(ep)) return;
    if (!await talk(ep, [['Ryan', 'You coming?'], ['Naim', 'Yeah.'], ['Ryan', 'You\u2019ve been weird all night.'], ['Naim', 'I\u2019m fine.'], ['Ryan', 'Right.', 900]])) return;
    const imgs = [...$('strip').querySelectorAll('img')];
    for (let i = 0; i < 4; i++) {
      this.pose(i); controls([{ keys: ['LMB'], verb: `Take photo  ${i + 1}/4` }]); if (touch.on) prompt('TAP  \u00b7  TAKE PHOTO'); await this.waitClick(); if (!alive(ep)) return; controls([]); prompt('');
      for (const c of ['3', '2', '1']) { center(c, true); sfx.beep(i === 3 && c === '1' ? 660 : 880); await wait(560); if (!alive(ep)) return; }
      center(''); sfx.shutter(); const url = snap(this.scene, camera, i === 3, 180, 240); P.flash.value = 1; tween(P.flash, 'value', 0, 0.5);
      imgs[i].src = url; if (i === 0) $('strip').classList.add('show');
      await wait(450); imgs[i].classList.add('in'); if (i === 3) imgs[i].classList.add('bad');
      if (i === 0) { if (!await talk(ep, [['Ryan', 'Move over.'], ['Naim', 'There\u2019s nowhere to move.']])) return; }
      else if (i === 1) { if (!await talk(ep, [['Ryan', 'You\u2019re taking up the whole seat.']])) return; }
      else { await wait(i === 3 ? 600 : 900); if (!alive(ep)) return; }
    }
    $('strip').classList.add('zoom'); sfx.sting(0.5); P.warp.value = 1.2;
    if (!await talk(ep, [['Ryan', 'What?', 1100], ['Ryan', 'Naim?', 1300], ['Ryan', 'I was sitting right next to him.', 1900]])) return;
    sfx.sting(0.3); await showLesson(); if (!alive(ep)) return;
    $('strip').classList.remove('show', 'zoom'); P.warp.value = 0.3;
    // live view: ryan slowly turns to the camera, too far
    this.turning = true; this.turnT = 0; await wait(2200); if (!alive(ep)) return;
    burst({ type: 'bandpass', f: 900, v: 1.5, d: 0.3 }); this.key.intensity = 0; this.fill.intensity = 2.2; P.red.value = 0.25;
    await wait(250); this.key.intensity = 3.2; this.fill.intensity = 0.8; P.red.value = 0; await wait(120);
    this.key.intensity = 0; this.fill.intensity = 0; sfx.slam(); this.turning = false;
    await wait(900); if (!alive(ep)) return;
    await fadeOut(0.7); if (!alive(ep)) return; go(SC.field);
  },
  update(dt, t) {
    camera.position.x = this.base.x + Math.sin(t * 0.5) * 0.01;
    if (this.turning) { this.turnT += dt; const k = Math.min(1, this.turnT / 1.8); this.ryan.head.rotation.y = -1.15 * (1 - k); this.ryan.head.rotation.z = k * 0.6; this.ryan.torso.rotation.z = 0.3 * (1 - k); }
  },
  exit() { $('lesson').classList.remove('show'); $('strip').className = ''; this.onClick = null; this.onKey = null; },
};

// ======================================================= BATHROOM
SC.bath = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0); s.fog = new THREE.Fog(0x040604, 1.5, 13);
    const tile = (rx, ry) => texMat('tile', rx, ry);
    plane(s, 12, 5, texMat('floor', 12, 5), 4, 0, 0, -PI / 2);
    plane(s, 12, 5, lam({ color: 0x3a3e38 }), 4, 3, 0, PI / 2);
    plane(s, 12, 3, tile(12, 3), 4, 1.5, -2.5); plane(s, 12, 3, tile(12, 3), 4, 1.5, 2.5, 0, PI);
    plane(s, 5, 3, tile(5, 3), -2, 1.5, 0, 0, PI / 2); plane(s, 5, 3, tile(5, 3), 10, 1.5, 0, 0, -PI / 2);
    // sinks + mirror
    const porc = lam({ color: 0xc8ccc0 }), steel = lam({ color: 0x8a8e88 });
    box(s, 5.2, 0.12, 0.6, lam({ color: 0x6a6860 }), 2.5, 0.86, 2.2);
    for (const x of [0.6, 1.9, 3.2, 4.5]) { box(s, 0.5, 0.06, 0.38, lam({ color: 0x202420 }), x, 0.93, 2.2); box(s, 0.05, 0.16, 0.05, steel, x, 1.02, 2.42); box(s, 0.05, 0.04, 0.16, steel, x, 1.1, 2.36); }
    plane(s, 5.0, 0.95, lam({ color: 0x182024, emissive: 0x050808 }), 2.5, 1.65, 2.47, 0, PI);
    box(s, 5.1, 0.05, 0.04, steel, 2.5, 2.15, 2.46); box(s, 5.1, 0.05, 0.04, steel, 2.5, 1.17, 2.46);
    // stalls
    const sm = lam({ map: tex('stall') });
    for (const x of [5.0, 6.2, 7.4, 8.6, 9.8]) box(s, 0.05, 1.9, 1.5, sm, x, 1.2, -1.75);
    box(s, 4.85, 0.06, 0.06, steel, 7.4, 2.17, -1.0);
    this.doors = [];
    for (let i = 0; i < 4; i++) {
      const x0 = 5.0 + i * 1.2; const piv = new THREE.Group(); piv.position.set(x0 + 0.06, 0, -1.0); s.add(piv);
      const d = box(piv, 1.08, 1.75, 0.04, i === 2 ? lam({ map: tex('door3') }) : sm, 0.54, 1.12, 0);
      box(piv, 0.03, 0.12, 0.06, steel, 0.98, 1.1, 0.03); this.doors.push({ piv, d });
      box(s, 0.42, 0.42, 0.55, porc, x0 + 0.6, 0.21, -2.15); box(s, 0.42, 0.5, 0.18, porc, x0 + 0.6, 0.65, -2.38);
    }
    this.doors[0].piv.rotation.y = -0.05; this.doors[3].piv.rotation.y = -0.12;
    // exit door + sign
    box(s, 0.08, 2.1, 1.0, lam({ color: 0x4a4a46 }), -1.96, 1.05, 1.0); box(s, 0.1, 0.06, 0.2, steel, -1.9, 1.0, 0.65);
    this.exitSign = box(s, 0.05, 0.18, 0.42, basic(0x22ff66), -1.95, 2.35, 1.0);
    box(s, 0.32, 0.4, 0.2, lam({ color: 0xb8b8b0 }), 6.2, 1.25, 2.38); box(s, 0.12, 0.05, 0.1, steel, 6.2, 1.02, 2.3);
    const exitL = new THREE.PointLight(0x30ff70, 1.4, 4.5, 1.6); exitL.position.set(-1.6, 2.2, 1.0); s.add(exitL);
    // lights
    this.tubes = []; this.lights = [];
    for (const x of [1.4, 7.3]) {
      const tb = box(s, 1.3, 0.05, 0.14, basic(0xe8ffe8), x, 2.96, 0.2); this.tubes.push(tb);
      const l = new THREE.PointLight(0xd8f0d8, 6, 11, 1.25); l.position.set(x, 2.6, 0.2); s.add(l); this.lights.push(l);
    }
    this.amb = new THREE.AmbientLight(0x2a302a, 1); s.add(this.amb);
    this.emerg = new THREE.PointLight(0xff2010, 0, 9, 1.2); this.emerg.position.set(2.5, 2.7, 0.3); s.add(this.emerg);
    // ryan (mask) + truth
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); s.add(this.ryan.g); setLayer(this.ryan.g, L_MASK);
    this.ent = entity(); s.add(this.ent.g); setLayer(this.ent.g, L_TRUE);
    this.stallPos = new THREE.Vector3(8.0, 1.5, -1.8);
    this.lurk = entity({ tilt: 0.45, color: 0x141210 }); this.lurk.g.position.set(-1.3, 0, -1.9); this.lurk.g.rotation.y = 1.0; s.add(this.lurk.g); this.lurkP = new THREE.Vector3(-1.3, 1.6, -1.9);
    // blood: trail into stall 3, smears, handprint
    const bloodTex = (w, h, draw) => { const t = ctex(w, h, draw); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return lam({ map: t, transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); };
    const BL = ['#5a0000', '#760806', '#3e0000', '#8e1208'];
    const pool = bloodTex(64, 64, (g) => { for (let i = 0; i < 9; i++) { g.fillStyle = BL[i % 4]; g.beginPath(); g.ellipse(32 + rand(-14, 14), 32 + rand(-14, 14), rand(6, 16), rand(4, 12), rand(0, 3), 0, 7); g.fill(); } for (let i = 0; i < 40; i++) { g.fillStyle = BL[i % 4]; g.fillRect(rand(0, 64), rand(0, 64), 2, 2); } });
    const trail = bloodTex(32, 128, (g) => { for (let y = 0; y < 128; y += 3) { g.fillStyle = BL[y % 4]; const w = 6 + Math.sin(y * 0.2) * 3 + rand(0, 4); g.fillRect(16 - w / 2 + Math.sin(y * 0.07) * 5, y, w, 3); } for (let i = 0; i < 30; i++) { g.fillStyle = BL[i % 4]; g.fillRect(rand(0, 32), rand(0, 128), 2, 2); } });
    const smear = bloodTex(64, 64, (g) => { for (let i = 0; i < 4; i++) { g.fillStyle = BL[i]; g.fillRect(8 + i * 11, 10 + rand(0, 6), 7, 22 + rand(0, 10)); for (let k = 0; k < 3; k++) g.fillRect(9 + i * 11 + rand(0, 4), 30, 2, rand(10, 30)); } });
    const hand = bloodTex(32, 32, (g) => { g.fillStyle = BL[1]; g.beginPath(); g.ellipse(16, 21, 7, 8, 0, 0, 7); g.fill(); for (let i = 0; i < 4; i++) { g.fillRect(8 + i * 4.5, 3 + Math.abs(i - 1.5) * 2, 3, 12); } g.fillRect(4, 16, 6, 3); g.fillRect(14, 28, 2, 4); });
    plane(s, 1.6, 1.3, pool, 8.0, 0.006, -1.15, -PI / 2);
    plane(s, 0.5, 0.6, pool, 7.6, 0.007, -0.55, -PI / 2, 0.8);
    const tr = plane(s, 0.35, 2.6, trail, 7.0, 0.008, 0.1, -PI / 2); tr.rotation.z = -1.05;
    plane(s, 0.45, 0.45, pool, 6.1, 0.006, 0.75, -PI / 2, 2);
    plane(s, 0.9, 0.9, smear, 7.37, 1.15, -1.1, 0, -PI / 2); plane(s, 0.8, 0.8, smear, 8.25, 1.2, -0.975, 0, 0);
    plane(s, 0.9, 0.9, smear, 8.63, 1.0, -1.15, 0, PI / 2);
    plane(s, 0.3, 0.3, hand, 8.45, 1.7, -0.97, 0, 0); plane(s, 0.28, 0.28, hand, 7.33, 1.5, -1.3, 0, -PI / 2);
    plane(s, 0.16, 0.16, hand, 7.7, 1.25, -0.97, 0, 0.1);
    plane(s, 0.4, 0.4, smear, 8.0, 0.4, -2.47, 0, 0);
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    camera.position.set(6.0, 1.6, 1.3); setLook(PI / 2 + 0.25, -0.05, Infinity, 0.6);
    this.ryan.g.position.set(8.0, 0, -1.85); this.ryan.g.rotation.y = PI; this.ryan.head.rotation.set(0.45, 0, 0); this.ryan.legL.rotation.x = this.ryan.legR.rotation.x = 0; this.ryan.armL.rotation.set(0, 0, 0); this.ryan.armR.rotation.set(0, 0, 0);
    this.ent.g.position.set(8.0, 0, -1.75); this.ent.g.rotation.y = -0.57; this.ent.head.rotation.set(0, 0, 0.5);
    this.doors[2].piv.rotation.y = 1.5;
    this.emerg.intensity = 0; this.lights.forEach((l) => (l.intensity = 6)); this.tubes.forEach((tb) => tb.material.color.setHex(0xe8ffe8)); this.amb.intensity = 1;
    this.lurk.g.visible = false; this.lurkSee = 0; BAT = Math.max(BAT, 0.8); drawBat(); Object.assign(this, { armed: false, revealed: false, chasing: false, seeT: 0, armT: 0, nextW: 0, px: 6.0, ex: 8.0, ez: -1.85, chaseT: 0, stepT: 0, escaped: false, opened: false });
    this.pan = panner(8.0, 1.5, -1.8); this.humG = hum(0.05);
    every(2600, () => sfx.drip(panner(rand(0, 5), 0.9, 2.2)));
    loopNoise({ buf: 'brown', f: 140, v: 0.2 });
    setPhone(true, BAT <= 0, BAT <= 0 ? 'BATTERY 0%' : ''); cross(true); setTouch(['KeyC']);
    this.run(ep, o.retry);
  },
  async run(ep, retry) {
    await fadeIn(retry ? 0.6 : 1.4); if (!alive(ep)) return;
    if (!retry) {
      objective('YOU ARE ALONE'); document.body.classList.add('alone');
      await wait(1200); if (!alive(ep)) return;
      muffle(700, 0.3); if (!await talk(ep, [['Pastor Rod', 'Hunter was troubled. We tried to help him.', 1300], ['Mourner', 'He was seventeen.', 1300], ['Pastor Rod', 'This isn’t the time.', 1300]])) return; muffle(20000, 0.5);
      const tap = loopNoise({ buf: 'white', type: 'highpass', f: 2400, v: 0.05 }); await wait(1800); if (!alive(ep)) return;
      const stop = dryer(0.9); P.warp.value = 1.2; sfx.sting(0.25); await wait(2000); stop(); P.warp.value = 0.3; if (!alive(ep)) return;
    }
    await wait(retry ? 500 : 900); if (!alive(ep)) return;
    sfx.knock(this.pan); await wait(1100); if (!alive(ep)) return;
    await wait(1600); if (!alive(ep)) return; sfx.knock(this.pan); await wait(900); if (!alive(ep)) return;
    this.armed = true; this.armT = T; this.nextW = T + 8; breathing(this.pan, 3.2, 1.0);
    if (touch.on) prompt('HOLD CAMERA  \u00b7  TAP TO GO TO HIM');
    controls([{ keys: ['Space', 'RMB'], verb: 'Camera', hold: true }, { keys: ['LMB'], verb: 'Take photo', show: () => false }]);
    teach('camera', ['Space', 'RMB'], 'Raise your camera', 'It shows what is really there. Your battery is dying: every second costs you.', true);
  },
  onClick() {
    if (!this.armed || this.revealed || this.opened || phone.up) return;
    const ray = new THREE.Raycaster(); ray.layers.enableAll(); ray.setFromCamera(new THREE.Vector2(0, 0), camera); ray.far = 9;
    if (angleTo(this.stallPos) > 0.32) return;
    this.opened = true; prompt(''); ctxTag(''); controls([]); sfx.creak(this.pan); tween(camera.position, 'x', 7.4, 0.5); tween(camera.position, 'z', -0.3, 0.5);
    this.ryan.head.rotation.set(0, 0, 0); this.ryan.g.rotation.y = 0; const ep0 = epoch;
    talk(ep0, [500, 1100, () => { this.ryan.head.rotation.set(0, 0, 1.2); }, 500, ['Naim', 'Ryan?', 500], () => omen(900), 900]).then((ok) => { if (ok && cur === this && this.opened) attack('strangle', 34, () => { this.px = camera.position.x; noVoice('Naim', this.pan); this.reveal(epoch, true); }, 'The blood trail led into that stall.<br>Your camera would have shown you.'); });
  },
  async reveal(ep, quick) {
    this.revealed = true; prompt(''); controls([]); ctxTag(''); if (!quick) { sfx.sting(0.55); P.warp.value = 1.4; }
    if (!quick) { await say('Naim: Ryan?', 800); if (!alive(ep)) return; } else { this.ex = 8.0; this.ez = -1.85; }
    setPhone(false); cross(false);
    for (let i = 0; i < 5; i++) { const on = i % 2; this.lights.forEach((l) => (l.intensity = on ? 6 : 0.3)); this.tubes.forEach((tb) => tb.material.color.setHex(on ? 0xe8ffe8 : 0x111111)); burst({ type: 'bandpass', f: 3000, v: 0.4, d: 0.05 }); await wait(rand(60, 140)); }
    this.lights.forEach((l) => (l.intensity = 0)); this.tubes.forEach((tb) => tb.material.color.setHex(0x0a0a0a)); this.amb.intensity = 0.6; this.emergOn = true;
    if (this.humG) this.humG.gain.value = 0;
    sfx.creak(this.pan); this.ryan.g.rotation.y = 0; this.ryan.head.rotation.set(0, 0, 0.3); drone(41, 0.12); heartbeat(118, 0.9);
    await wait(400); if (!alive(ep)) return;
    objective('RUN'); controls([{ keys: ['KeyW'], verb: 'Run', hold: true }]); teach('run', ['KeyW'], 'Run', 'Keep holding. Do not look back for long.', true); setTouch(['KeyW']); this.chasing = true; this.chaseT = 0;
  },
  update(dt, t) {
    const ep = epoch;
    if (this.armed && !this.revealed && !this.opened) {
      const a = angleTo(this.stallPos);
      ctxTag(!phone.up && a < 0.32 ? keycap('LMB') + '<span>Open the stall</span>' : '');
      if (phone.visible && !phone.broken && a < 0.5) { this.seeT += dt; } else this.seeT = Math.max(0, this.seeT - dt * 0.5);
      if (this.seeT > 0.65) this.reveal(ep);
      if (T > this.nextW) { this.nextW = T + 9; sfx.knock(this.pan); }
      if (T - this.armT > 32) { this.opened = true; controls([]); ctxTag(''); setPhone(false); cross(false); (async () => { await wait(600); if (!alive(ep)) return; for (let i = 0; i < 6; i++) { sfx.step(panner(7 - i * 1.3, 0.1, 0.6, 1), 1.1); await wait(430); if (!alive(ep)) return; } await wait(900); if (!alive(ep)) return; RUN.log.push('Waited in the stall until it left'); this.escape(ep); })(); }
      this.ent.head.rotation.z = 0.5 + Math.sin(t * 13) * 0.05;
      if (this.lurk.g.visible && angleTo(this.lurkP) < 0.3) { this.lurkSee = (this.lurkSee || 0) + dt; if (this.lurkSee > 0.3) { this.lurk.g.visible = false; zippo(panner(-1.3, 1.5, -1.9, 0.6)); hush(1200); } }
    }
    if (this.chasing && !this.escaped) {
      this.chaseT += dt; this.emerg.intensity = 3.5 + Math.sin(t * 7) * 2.5;
      const run = input.keys.KeyW || input.keys.ArrowUp || input.left;
      if (run) { this.px -= 1.6 * dt; look.bob += dt * 11; if (Math.sin(look.bob) > 0.97 && !this.ftLock) { this.ftLock = true; foot('tile', 1); } else if (Math.sin(look.bob) < 0) this.ftLock = false; }
      camera.position.x = this.px; camera.position.z += (1.0 - camera.position.z) * dt * 2;
      camera.position.y = 1.6 + (run ? Math.sin(look.bob) * 0.05 : 0); look.roll = run ? Math.sin(look.bob * 0.5) * 0.02 : 0;
      if (this.chaseT > 1.6) {
        const sp = 2.1 + this.chaseT * 0.08;
        if (this.ez < 0.3) this.ez += sp * dt; else this.ex -= sp * dt;
        this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.26; const p = panner(this.ex, 0.1, this.ez, 1); sfx.step(p, 1.2); }
        this.ryan.g.position.set(this.ex, 0, this.ez);
        this.ryan.g.rotation.y = this.ez < 0.3 ? 0 : -PI / 2;
        const sw = Math.sin(this.chaseT * 14); this.ryan.legL.rotation.x = sw * 0.7; this.ryan.legR.rotation.x = -sw * 0.7;
        this.ryan.armL.rotation.x = -sw * 0.6 - 0.6; this.ryan.armR.rotation.x = sw * 0.6 - 0.6; this.ryan.head.rotation.z = Math.sin(t * 20) * 0.25;
        setPos(this.pan, this.ex, 1.5, this.ez);
        const d = Math.hypot(this.ex - this.px, this.ez - camera.position.z);
        if (d < 0.85 && LIGHTER > 0 && !this.qte && !LIGHTER_SKIP) { this.qte = true; this.escaped = true; qteLighter().then((ok) => { this.qte = false; if (cur !== this) return; if (ok) { this.escaped = false; this.ex = this.px + 4.5; this.ez = 0.6; this.chaseT = 0.2; say('Naim: Get off me!', 900); } else { this.ex = this.px + 0.5; this.escaped = false; LIGHTER_SKIP = true; } }); return; }
        if (d < 0.85) { LIGHTER_SKIP = false; this.escaped = true; attack('push', 34, () => { this.escaped = false; this.ex = this.px + 3.2; this.ez = 0.6; this.chaseT = 0.5; objective('RUN'); controls([{ keys: ['KeyW'], verb: 'Run', hold: true }]); }); return; }
      }
      if (this.px < -1.35) { this.escaped = true; controls([]); objective(''); this.escape(ep); }
    }
  },
  async escape(ep) {
    prompt(''); sfx.slam(); P.fade.value = 1; stopAll(); await wait(1200); if (!alive(ep)) return;
    document.body.classList.remove('alone'); RUN.did.bath = true; if (RUN.did.hosp) go(SC.door); else go(SC.cross, { id: 'B', from: 'bath' });
  },
};

// ======================================================= TEXTS
SC.texts = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x01020a); s.fog = new THREE.Fog(0x02040c, 4, 30);
    plane(s, 4, 4, texMat('carpet', 4, 4), 0, 0, 0, -PI / 2);
    plane(s, 4, 4, lam({ color: 0x2a2620 }), 0, 2.6, 0, PI / 2);
    const pl = (w, h, x, y, z, ry) => plane(s, w, h, texMat('plaster', w / 2, h / 2), x, y, z, 0, ry);
    pl(4, 2.6, 0, 1.3, 2, PI); pl(4, 2.6, -2, 1.3, 0, PI / 2); pl(4, 2.6, 2, 1.3, 0, -PI / 2);
    // window wall with hole x:-0.75..0.75 y:0.5..2.0
    pl(1.25, 2.6, -1.375, 1.3, -2, 0); pl(1.25, 2.6, 1.375, 1.3, -2, 0); pl(1.5, 0.5, 0, 0.25, -2, 0); pl(1.5, 0.6, 0, 2.3, -2, 0);
    const fr = lam({ color: 0xd8d4c8 });
    box(s, 1.6, 0.06, 0.12, fr, 0, 0.5, -2); box(s, 1.6, 0.06, 0.12, fr, 0, 2.0, -2); box(s, 0.06, 1.5, 0.12, fr, -0.78, 1.25, -2); box(s, 0.06, 1.5, 0.12, fr, 0.78, 1.25, -2); box(s, 0.04, 1.5, 0.08, fr, 0, 1.25, -2);
    const poster = plane(s, 0.6, 0.85, lam({ map: tex('poster') }), 1.98, 1.5, -0.6, 0, -PI / 2);
    // bed
    box(s, 1.1, 0.42, 2.0, lam({ color: 0x3a2e28 }), 0.9, 0.21, 1.0); box(s, 1.12, 0.12, 2.0, lam({ color: 0x4a5a7a }), 0.9, 0.48, 1.0); box(s, 0.7, 0.12, 0.35, lam({ color: 0xc8c4b8 }), 0.9, 0.58, 1.8);
    // outside
    plane(s, 60, 60, texMat('asphalt', 30, 30), 0, -1.5, -20, -PI / 2);
    plane(s, 60, 3, lam({ color: 0x3a3a34 }), 0, -1.49, -6, -PI / 2);
    const pole = lam({ color: 0x3a3a3a }); box(s, 0.12, 5.2, 0.12, pole, 1.9, 1.1, -6.2); box(s, 1.0, 0.1, 0.1, pole, 1.45, 3.65, -6.2);
    box(s, 0.4, 0.08, 0.25, basic(0xffd890), 1.0, 3.6, -6.2);
    const sl = new THREE.PointLight(0xffb060, 18, 12, 1.0); sl.position.set(1.0, 3.2, -6.0); s.add(sl);
    for (const [x, z, h] of [[-8, -16, 4], [6, -18, 5], [-3, -22, 3.5], [10, -14, 4]]) { box(s, 4, h, 4, lam({ color: 0x14161c }), x, -1.5 + h / 2, z); box(s, 0.4, 0.5, 0.05, basic(0xffcf80, true), x + 0.6, -0.5, z + 2.03); }
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); this.ryan.g.position.set(0.7, -1.5, -5.4); s.add(this.ryan.g); setLayer(this.ryan.g, L_MASK);
    this.ent = entity({ tilt: 0.45, color: 0x2a2624 }); this.ent.g.position.set(0.7, -1.5, -5.4); this.ent.eyes.forEach((m) => m.scale.set(1.8, 1.8, 1)); this.ent.armR.rotation.z = 2.3; s.add(this.ent.g); setLayer(this.ent.g, L_TRUE);
    this.pcam = new THREE.PerspectiveCamera(42, 0.75, 0.05, 40); this.pcam.position.set(0.25, 1.35, -1.5); this.pcam.lookAt(0.7, -0.3, -5.4);
    const moon = new THREE.DirectionalLight(0x6a80c0, 1.4); moon.position.set(-3, 6, -8); s.add(moon);
    const lamp = new THREE.PointLight(0xffa860, 2.2, 5, 1.3); lamp.position.set(1.6, 0.9, 1.6); s.add(lamp); box(s, 0.12, 0.25, 0.12, basic(0xffd8a0), 1.6, 0.75, 1.65);
    this.glowL = new THREE.PointLight(0x7f9cff, 1.2, 2.5, 1.5); s.add(this.glowL);
    s.add(new THREE.AmbientLight(0x262c3c, 1));
    this.makePhotos();
  },
  makePhotos() {
    // selfie in his room
    const a = new THREE.Scene(); a.background = new THREE.Color(0x1a120c); a.fog = new THREE.Fog(0x1a120c, 1, 5);
    plane(a, 4, 3, texMat('plaster', 2, 1.5), 0, 1.5, -1.2);
    plane(a, 0.5, 0.7, lam({ map: tex('poster') }), -0.55, 1.7, -1.18);
    const r1 = human({ shirt: 0x2f4a6a, hair: 0x6a4524, skin: 0xd0a58a }); r1.g.position.set(0.05, 0, 0); r1.head.rotation.set(-0.1, -0.2, 0.08); r1.armR.rotation.x = -1.4; a.add(r1.g);
    const l = new THREE.PointLight(0xffb070, 1.6, 4, 1.2); l.position.set(0.6, 1.9, 0.9); a.add(l); a.add(new THREE.AmbientLight(0x302018, 1));
    const c = new THREE.PerspectiveCamera(55, 0.75, 0.05, 30); c.position.set(0.12, 1.6, 0.62); c.lookAt(0, 1.55, 0);
    this.p1 = snap(a, c, true, 150, 200, 1.1);
    // "outside" selfie: the truth
    const b = new THREE.Scene(); b.background = new THREE.Color(0x04050a); b.fog = new THREE.Fog(0x04050a, 1, 9);
    plane(b, 20, 20, texMat('asphalt', 10, 10), 0, 0, 0, -PI / 2);
    box(b, 0.12, 5, 0.12, lam({ color: 0x333333 }), -0.9, 2.5, -2);
    const bl = new THREE.PointLight(0xffb060, 5, 8, 1.1); bl.position.set(-0.4, 3.4, -1.4); b.add(bl); b.add(new THREE.AmbientLight(0x101018, 1));
    const e = entity({ tilt: 0.45, color: 0x2a2624 }); e.g.position.set(0.05, -0.45, 0); e.armR.rotation.x = -1.6; b.add(e.g);
    const flash = new THREE.PointLight(0xe8f0ff, 6, 3, 1.3); flash.position.set(0.1, 1.75, 1.0); b.add(flash); e.eyes.forEach((m) => m.scale.set(1.6, 1.6, 1));
    box(b, 4, 3, 0.2, lam({ color: 0x2a2a30 }), 1.5, 1.5, -4); box(b, 0.5, 0.6, 0.05, basic(0xffcf80, true), 0.6, 1.4, -3.88);
    const c2 = new THREE.PerspectiveCamera(60, 0.75, 0.05, 30); c2.position.set(0.15, 1.78, 1.05); c2.lookAt(0, 1.55, 0);
    this.p2 = snap(b, c2, true, 150, 200, 0.95);
    // mill selfie
    const m = new THREE.Scene(); m.background = new THREE.Color(0x050302); m.fog = new THREE.Fog(0x050302, 1, 6);
    for (let i = 0; i < 5; i++) box(m, 0.25, 4, 0.25, lam({ map: tex('wood') }), -2 + i, 2, -2.2 - (i % 2));
    box(m, 6, 0.25, 0.25, lam({ map: tex('wood') }), 0, 2.6, -2);
    const r3 = human({ shirt: 0x2f4a6a, hair: 0x6a4524, skin: 0xd0a58a }); r3.head.rotation.set(0.05, 0.25, -0.1); r3.armL.rotation.x = -1.4; m.add(r3.g);
    const ml = new THREE.PointLight(0xdde6ff, 2.6, 4, 1.4); ml.position.set(-0.3, 1.6, 0.7); m.add(ml); m.add(new THREE.AmbientLight(0x100a08, 1));
    const c3 = new THREE.PerspectiveCamera(55, 0.75, 0.05, 30); c3.position.set(-0.1, 1.62, 0.6); c3.lookAt(0, 1.55, 0);
    this.p3 = snap(m, c3, true, 150, 200, 0.85);
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(true); unlock(); this.scene.add(camera);
    camera.position.set(0.25, 1.3, -0.35); setLook(0.12, -0.1, 0.5, 0.25);
    this.glowL.position.set(0.9, 1.0, 0.5); this.ryan.g.visible = true; this.viewed = false; this.sawTruth = false;
    $('texts').querySelector('.msgs').innerHTML = ''; $('texts').querySelector('.ch').innerHTML = '';
    loopNoise({ buf: 'brown', f: 120, v: 0.22 }); loopNoise({ buf: 'white', type: 'bandpass', f: 400, q: 0.4, v: 0.02 });
    every(7000, () => burst({ buf: 'brown', f: 200, v: 0.3, a: 1.5, d: 2.5 }));
    this.run(ep, o.retry);
  },
  msg(html, photo, del, me) {
    const b = document.createElement('div'); b.className = 'b' + (del ? ' del' : '') + (me ? ' me' : ''); b.innerHTML = html;
    if (photo) { if (!html) b.style.padding = '4px'; const im = new Image(); im.src = photo; im.onclick = () => { const v = $('viewer'); v.querySelector('img').src = photo; v.classList.add('show'); sfx.click(); this.viewed = true; if (photo === this.p2) { this.sawTruth = true; sfx.sting(0.35); } }; b.appendChild(im); }
    $('texts').querySelector('.msgs').appendChild(b); if (!me) sfx.buzz();
  },
  async run(ep, retry) {
    await fadeIn(1.6); if (!alive(ep)) return;
    if (!retry) { await say("Home. 11:48 PM. I can't stop shaking.", 1100); if (!alive(ep)) return; }
    $('texts').classList.add('show'); await wait(800); if (!alive(ep)) return;
    const t = document.createElement('div'); t.className = 't'; t.textContent = 'Today 11:49 PM'; $('texts').querySelector('.msgs').appendChild(t);
    this.msg('u ok?? i heard about the bathroom. im so sorry', this.p1); await wait(2400); if (!alive(ep)) return;
    this.msg("it wasnt me in there. it can look like me. it only comes when ur alone"); await wait(2600); if (!alive(ep)) return;
    sfx.knock(panner(0.7, 0, -5.4, 0.6)); await wait(500); if (!alive(ep)) return;
    await say("Something's outside. Under the streetlight.", 700); if (!alive(ep)) return;
    await say("It's him. He's waving at me.", 900); if (!alive(ep)) return;
    const ch = $('texts').querySelector('.ch');
    const cam = document.createElement('button'); cam.textContent = 'PHOTO THE WINDOW'; ch.append(cam);
    objective('THE CAMERA SHOWS WHAT IS REALLY THERE');
    await new Promise((r) => (cam.onclick = r)); if (!alive(ep)) return;
    ch.innerHTML = ''; prompt(''); sfx.shutter(); P.flash.value = 0.8; tween(P.flash, 'value', 0, 0.4);
    this.p2 = snap(this.scene, this.pcam, true, 150, 200, 0.95);
    this.msg('', this.p2, false, true); sfx.sting(0.4); await wait(900); if (!alive(ep)) return;
    await say("That's not him.", 700); if (!alive(ep)) return;
    this.msg('thats not me. dont go out there'); await wait(1800); if (!alive(ep)) return;
    this.msg("im at the old mill. come at midnight. i think i know how to end it", this.p3); await wait(1600); if (!alive(ep)) return;
    const b1 = document.createElement('button'); b1.textContent = 'GO OUTSIDE';
    const b2 = document.createElement('button'); b2.textContent = 'GO TO THE MILL';
    ch.append(b1, b2);
    this.b1 = b1; b1.onclick = () => { requestLock(); this.leave(ep, 'out'); };
    b2.onclick = () => { requestLock(); this.leave(ep, 'mill'); };
  },
  async leave(ep, where) {
    $('texts').classList.remove('show'); $('viewer').classList.remove('show'); prompt('');
    if (where === 'out') {
      await say('Maybe the photo was wrong. He\'s right there.', 900); if (!alive(ep)) return;
      tween(camera.position, 'z', -1.2, 1.2); this.ryan.head.rotation.z = 0.8; await wait(1100); if (!alive(ep)) return;
      attack('claw', 34, async () => {
        camera.position.z = -0.35; this.ryan.head.rotation.z = 0; sfx.slam();
        await say("I slammed the door. It's still out there.", 1200); if (!alive(ep)) return;
        unlock(); cursor(true); if (this.b1) this.b1.disabled = true; $('texts').classList.add('show');
      }, 'Your photo showed what it really was.<br>Ryan told you not to go out.'); return;
    }
    await fadeOut(1.2); if (!alive(ep)) return; center('Midnight. The old mill on Corrigan Road.'); await wait(1900); if (!alive(ep)) return; center(''); await wait(600); go(SC.mill);
  },
  update(dt, t) {
    this.ryan.armR.rotation.z = 2.4 + Math.sin(t * 3) * 0.35; this.ryan.armR.rotation.x = -0.2;
    this.ryan.head.rotation.x = -0.25; this.glowL.intensity = 1.1 + Math.sin(t * 40) * 0.05;
  },
  exit() { $('texts').classList.remove('show'); $('viewer').classList.remove('show'); cursor(false); },
};
$('viewer').onclick = () => $('viewer').classList.remove('show');

// ======================================================= THE DOOR (judgment encounter)
let FILM = 3, DOOR_RESULT = null;
const TELL_NAMES = { blink: 'never blinked', breath: 'had no breath in the cold', shadow: 'cast no shadow', frozen: 'froze whenever you watched it', repeat: 'repeated the same line, word for word' };
const REAL_LINES = ['Let me in.', 'Please, Naim.', 'It\u2019s cold.', 'Naim.'];
const FAKE_LINES = ['Let me in.', 'Please, Naim.', 'Let me in.', 'Naim.'];
const FAKE_REPEAT = 'Let me in.';
SC.door = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x000000); s.fog = new THREE.Fog(0x020203, 3, 12);
    plane(s, 3, 4.5, texMat('wood', 3, 4), 0, 0, -0.75, -PI / 2);
    plane(s, 3, 4.5, lam({ color: 0x2a2620 }), 0, 2.6, -0.75, PI / 2);
    const pl = (w, h, x, y, z, ry = 0) => plane(s, w, h, texMat('plaster', Math.max(1, w / 2), Math.max(1, h / 2)), x, y, z, 0, ry);
    pl(4.5, 2.6, -1.5, 1.3, -0.75, PI / 2); pl(4.5, 2.6, 1.5, 1.3, -0.75, -PI / 2); pl(3, 2.6, 0, 1.3, 1.5, PI);
    // front wall with door + sidelight openings
    pl(1.0, 2.6, -1.0, 1.3, -3); pl(0.15, 2.6, 0.575, 1.3, -3); pl(0.35, 2.6, 1.325, 1.3, -3);
    pl(1.0, 0.5, 0, 2.35, -3); pl(0.5, 0.65, 0.9, 2.275, -3); pl(0.5, 0.15, 0.9, 0.075, -3);
    const trim = lam({ color: 0xd6d0c2 });
    box(s, 0.06, 2.16, 0.08, trim, -0.53, 1.08, -2.98); box(s, 0.06, 2.16, 0.08, trim, 0.53, 1.08, -2.98); box(s, 1.12, 0.06, 0.08, trim, 0, 2.13, -2.98);
    box(s, 0.56, 0.05, 0.08, trim, 0.9, 1.97, -2.98); box(s, 0.56, 0.05, 0.08, trim, 0.9, 0.13, -2.98); box(s, 0.04, 1.84, 0.08, trim, 0.64, 1.05, -2.98); box(s, 0.04, 1.84, 0.08, trim, 1.16, 1.05, -2.98);
    plane(s, 0.5, 1.8, new THREE.MeshBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.08, depthWrite: false }), 0.9, 1.05, -3.0);
    // door
    this.piv = new THREE.Group(); this.piv.position.set(-0.5, 0, -3); s.add(this.piv);
    const dm = lam({ color: 0x5a3a24 }), dd = lam({ color: 0x46301c });
    box(this.piv, 1.0, 2.1, 0.05, dm, 0.5, 1.05, 0);
    for (const [y, h] of [[1.55, 0.7], [0.55, 0.75]]) for (const x of [0.27, 0.73]) box(this.piv, 0.34, h, 0.012, dd, x, y, 0.03);
    const brass = lam({ color: 0xc8a050 });
    box(this.piv, 0.06, 0.06, 0.08, brass, 0.88, 1.0, 0.05);
    box(this.piv, 0.08, 0.08, 0.02, brass, 0.88, 1.25, 0.035);
    this.bolt = box(this.piv, 0.03, 0.06, 0.03, brass, 0.88, 1.25, 0.055);
    // hallway props
    box(s, 0.5, 0.75, 0.35, lam({ color: 0x3a2a1c }), -1.2, 0.375, -1.2);
    box(s, 0.14, 0.3, 0.14, basic(0xffd8a0), -1.2, 0.9, -1.2);
    const lamp = new THREE.PointLight(0xffa860, 1.6, 4, 1.4); lamp.position.set(-1.1, 1.2, -1.1); s.add(lamp); this.lamp = lamp;
    plane(s, 0.5, 0.7, lam({ map: tex('poster') }), -1.48, 1.5, -2.0, 0, PI / 2);
    for (let i = 0; i < 3; i++) box(s, 0.25, 0.06, 0.12, lam({ color: [0x2a2a30, 0x4a2020, 0x1a2a3a][i] }), 1.2, 0.03, -2.4 + i * 0.3);
    const stairM = lam({ map: tex('wood') });
    for (let i = 0; i < 9; i++) box(s, 0.9, 0.2, 0.28, stairM, -1.0, 0.1 + i * 0.2, 1.3 - i * 0.28 + 0.2).scale.y = 1;
    box(s, 0.05, 0.9, 2.6, lam({ color: 0x3a2a1c }), -0.53, 1.4, 0.4).rotation.x = -0.62;
    this.mom = human({ shirt: 0x6a4a5a, pants: 0x4a3a44, hair: 0x2a1a12, skin: 0xb48468 }); this.mom.g.visible = false; s.add(this.mom.g);
    // porch outside
    plane(s, 5, 4, texMat('wood', 5, 4), 0.5, 0, -5, -PI / 2);
    box(s, 0.18, 0.12, 0.12, basic(0xffe0a0), -0.75, 2.05, -3.08);
    this.porch = new THREE.PointLight(0xffb870, 7, 6, 1.2); this.porch.position.set(-0.6, 2.0, -3.5); s.add(this.porch);
    this.faceL = new THREE.PointLight(0xe6e2dc, 3.0, 2.2, 1.3); this.faceL.position.set(0.8, 2.1, -3.05); s.add(this.faceL);
    for (const x of [-1.6, 2.4]) box(s, 0.14, 2.6, 0.14, lam({ color: 0xc8c0b0 }), x, 1.3, -5.8);
    s.add(new THREE.AmbientLight(0x1c1e26, 1));
    // ryan / disguise
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); s.add(this.ryan.g);
    const lidM = lam({ color: 0xc89a80 });
    this.lids = [box(this.ryan.head, 0.042, 0.028, 0.012, lidM, -0.045, 0.205, 0.119), box(this.ryan.head, 0.042, 0.028, 0.012, lidM, 0.045, 0.205, 0.119)];
    this.ent = entity({ tilt: 0.55, color: 0x2a2624 }); this.ent.eyes.forEach((m) => m.scale.set(1.7, 1.7, 1)); s.add(this.ent.g);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.55, depthWrite: false }));
    this.shadow.rotation.x = -PI / 2; s.add(this.shadow);
    this.breathTex = glow('rgba(235,240,255,0.9)', 'rgba(200,210,230,0.35)'); this.puffs = [];
    this.headW = new THREE.Vector3();
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    camera.position.set(0.15, 1.6, -0.4); setLook(-0.2, -0.02, 1.0, 0.4);
    if (o.film != null) FILM = o.film; this.filmAtEntry = FILM;
    this.real = window.__forceReal ?? (location.hash === '#door-real' ? true : location.hash === '#door-fake' ? false : Math.random() < 0.5);
    const pool = ['blink', 'breath', 'shadow', 'frozen', 'repeat'].sort(() => Math.random() - 0.5);
    this.tells = this.real ? [] : pool.slice(0, Math.random() < 0.35 ? 3 : 2);
    const has = (k) => this.tells.includes(k); this.has = has;
    const r = this.ryan;
    r.g.position.set(0.95, 0, -3.4); r.g.rotation.set(0, 0, 0); r.armL.rotation.set(-1.25, 0, 0.95); r.armR.rotation.set(-1.25, 0, -0.95); r.head.rotation.set(0, 0, 0); r.torso.rotation.set(0, 0, 0);
    setLayer(r.g, this.real ? 0 : L_MASK); this.lids.forEach((l) => (l.visible = false));
    this.ent.g.visible = !this.real; this.ent.g.position.copy(r.g.position); this.ent.g.position.y = -0.18; this.ent.g.scale.setScalar(0.86); this.ent.g.rotation.set(0, 0, 0); setLayer(this.ent.g, L_TRUE);
    this.shadow.visible = !has('shadow'); this.shadow.position.set(0.95, 0.012, -3.35);
    this.piv.rotation.y = 0; this.bolt.position.x = 0.88; this.porch.intensity = 7; this.faceL.intensity = 3.5;
    this.puffs.forEach((p) => this.scene.remove(p.s)); this.puffs = [];
    Object.assign(this, { tLeft: 50, decided: false, asked: false, focusing: 0, blinkT: 2, breathT: 1, lineT: rand(9, 14), knockT: rand(1, 2), lineIdx: Math.floor(rand(0, 6)), frozenNow: false, momHere: false, vanishAt: Math.random() < 0.6 ? rand(18, 30) : -1, vanished: 0 }); this.mom.g.visible = false; this.ryan.g.visible = true;
    this.pan = panner(0.95, 1.5, -3.4, 1.0); this.lean = 0;
    loopNoise({ buf: 'brown', f: 160, v: 0.18 }); loopNoise({ buf: 'white', type: 'bandpass', f: 500, q: 0.4, v: 0.03 }); hum(0.012);
    this.hb = null;
    BAT = Math.max(BAT, 0.5); drawBat(); setPhone(true, BAT <= 0, BAT <= 0 ? 'BATTERY 0%' : '');
    setTouch([['KeyW', 'LEAN'], 'KeyC', ['KeyQ', 'ASK'], ['KeyR', 'MOM'], ['KeyE', 'OPEN'], ['KeyL', 'LOCK']]);
    $('dhud').classList.add('show'); $('film').innerHTML = ''; $('focus').textContent = '';
    this.run(ep, o.retry);
  },
  drawFilm() { $('film').innerHTML = 'PHOTOS&nbsp;' + [0, 1, 2].map((i) => `<i class="${i < FILM ? '' : 'used'}"></i>`).join(''); },
  async run(ep, retry) {
    await fadeIn(retry ? 0.6 : 1.4); if (!alive(ep)) return;
    if (!retry) { if (!await talk(ep, [400, ['Mum, upstairs', 'Naim?'], ['Naim', 'Yeah.'], ['Mum', 'Where were you?'], ['Naim', 'Nowhere.', 1200]])) return; }
    sfx.knock(this.pan); await wait(900); if (!alive(ep)) return;
    if (!retry) { this.speak('Let me in.'); await wait(1900); if (!alive(ep)) return; await say('Naim: What happened?', 900); if (!alive(ep)) return; this.speak('Please, Naim.'); await wait(1700); if (!alive(ep)) return; }
    this.armed = true; this.lineT = 7;
    objective('YOU ARE ALONE'); document.body.classList.add('alone');
    controls([
      { keys: ['KeyW'], verb: 'Lean in', hold: true },
      { keys: ['Space', 'RMB'], verb: 'Camera', hold: true, show: () => BAT > 0 },
      { keys: ['KeyQ'], verb: 'Ask him something', show: () => !this.asked },
      { keys: ['KeyR'], verb: 'Wake Mum', show: () => !this.momHere },
      { keys: ['KeyE'], verb: 'Open' },
      { keys: ['KeyL'], verb: 'Lock' },
    ]);
    teach('lean', ['KeyW'], 'Lean in to the window', 'Watch his face. Does he blink? Can you see his breath?', true);
  },
  tellText() { return 'It ' + this.tells.map((k) => TELL_NAMES[k]).join('.<br>It ') + '.'; },
  speak(line) { if (!this.real) { sfx.knock(this.pan); return; } noVoice(line, !this.real); noVoice(line, this.pan, this.real ? 1.0 : 1.6); say(`Ryan: ${line}`, 1600); },
  onKey(c) {
    if (!this.armed || this.decided) return;
    if (c === 'KeyQ' && !this.asked) this.ask(epoch);
    if (c === 'KeyR' && !this.momHere) this.wakeMom(epoch);
    if (c === 'KeyE') this.decide(epoch, 'open');
    if (c === 'KeyL') this.decide(epoch, 'lock');
  },
  onClick() { },
  async ask(ep) {
    this.asked = true; this.tLeft = Math.max(5, this.tLeft - 6); clearSay();
    await say('Naim: How do I know it’s you?', 700); if (!alive(ep) || this.decided) return;
    this.lineT = 99;
    if (!this.real) this.ryan.head.rotation.z = 0.45; await wait(this.real ? 1100 : 2800); if (!alive(ep) || this.decided) return; this.ryan.head.rotation.z = 0; this.speak('You don’t.');
    await wait(3600); if (!alive(ep) || this.decided) return; this.speak('But you left me there.');
    this.lineT = 6;
  },
  async wakeMom(ep) {
    if (this.decided) return; this.decided = true; this.momHere = true; controls([]); objective(''); setPhone(false); clearSay(); document.body.classList.remove('alone');
    const res = { real: this.real, call: 'mom', tells: this.tells, asked: this.asked, mom: true };
    await fadeOut(0.5); if (!alive(ep)) return;
    for (let i = 0; i < 4; i++) { sfx.step(null, 0.5); await wait(260); if (!alive(ep)) return; }
    for (let i = 0; i < 5; i++) { sfx.step(null, 0.6); await wait(240); if (!alive(ep)) return; }
    this.mom.g.position.set(-0.55, 0, -1.9); this.mom.g.rotation.y = PI * 0.85; this.mom.g.visible = true; this.mom.head.rotation.y = 0;
    camera.position.set(0.15, 1.6, -0.4); look.ty = -0.2; look.tp = -0.02;
    if (!this.real) { this.ryan.g.visible = false; this.ent.g.visible = false; this.shadow.visible = false; }
    await fadeIn(0.6); if (!alive(ep)) return;
    if (this.real) {
      await say('Mum: Who are you talking to?', 1500); if (!alive(ep)) return;
      this.ryan.g.rotation.y = PI; this.walkAway = true; await wait(2600); if (!alive(ep)) return;
      res.good = false;
    } else {
      await say('Mum: Who are you talking to?', 1500); if (!alive(ep)) return; await wait(1800); if (!alive(ep)) return;
      res.good = true;
    }
    await fadeOut(0.9); if (!alive(ep)) return; doorNext(res);
  },
  lighterSave(ep) {
    return new Promise((res) => {
      if (LIGHTER <= 0) return res(false);
      const el = $('qte'); el.classList.add('show'); el.style.setProperty('--q', 1); const t0 = performance.now(); const DUR = 950;
      teach('lighter', ['KeyF'], 'Lighter', 'Fire drives it back. You only have so much fuel.', false);
      let done = false;
      const finish = (ok) => { if (done) return; done = true; el.classList.remove('show'); removeEventListener('keydown', key); cancelAnimationFrame(raf); res(ok); };
      const key = (e) => { if (e.code === 'KeyF') finish(true); };
      let raf; const tick = () => { const k = 1 - (performance.now() - t0) / DUR; el.style.setProperty('--q', Math.max(0, k)); if (k <= 0) finish(false); else raf = requestAnimationFrame(tick); };
      addEventListener('keydown', key); tick();
      sfx.sting(0.4); P.red.value = 0.2;
    }).then(async (ok) => {
      P.red.value = 0;
      if (!ok || !alive(ep)) return false;
      LIGHTER--; sfx.lighter(); await wait(150); P.flash.value = 0.6; P.tint.value.set(1.4, 0.9, 0.6); tween(P.flash, 'value', 0, 0.5);
      sfx.scream(0.75, 1, 1.0); setLayer(this.ent.g, 0); this.ryan.g.visible = false; this.ent.g.position.set(0.5, -0.18, -2.7);
      tween(this.ent.g.position, 'z', -4.5, 0.4); await wait(500); P.tint.value.set(1, 1, 1);
      tween(this.piv.rotation, 'y', 0, 0.2); await wait(220); sfx.slam(); this.bolt.position.x = 0.8; this.ent.g.visible = false;
      return true;
    });
  },
  async decide(ep, call) {
    if (this.decided) return; this.decided = true; prompt(''); controls([]); objective(''); setPhone(false); this.lean = Math.min(this.lean, 0.3); clearSay();
    const res = { real: this.real, call, tells: this.tells, film: FILM, asked: this.asked }; document.body.classList.remove('alone');
    if (call === 'open') {
      sfx.click(); await wait(250); if (!alive(ep)) return; sfx.creak(this.pan); tween(this.piv.rotation, 'y', -1.35, 1.1);
      if (this.real) {
        await wait(900); if (!alive(ep)) return; tween(this.ryan.g.position, 'z', -2.6, 1.4); tween(this.ryan.g.position, 'x', 0.3, 1.4); this.ryan.armL.rotation.set(0, 0, 0); this.ryan.armR.rotation.set(-0.3, 0, 0);
        await wait(700); relief(); heartbeat(64, 0.5); await wait(2600); if (!alive(ep)) return;
        res.died = false; res.good = true;
      } else {
        omen(1300); await wait(1300); if (!alive(ep)) return; this.porch.intensity = 0.5;
        if (await this.lighterSave(ep)) { if (!alive(ep)) return; await wait(900); if (!alive(ep)) return; await fadeOut(0.8); if (!alive(ep)) return; return doorNext(Object.assign(res, { good: true, burned: true })); }
        if (!alive(ep)) return;
        return attack('strangle', 34, async () => { this.piv.rotation.y = 0; this.bolt.position.x = 0.8; this.ryan.g.visible = false; this.lamp.intensity = 1.6; sfx.slam(); await wait(900); if (!alive(ep)) return; await fadeOut(0.8); if (!alive(ep)) return; doorNext(Object.assign(res, { hurt: true, good: false })); }, this.tellText());
      }
    } else if (call === 'lock') {
      sfx.click(); tween(this.bolt.position, 'x', 0.8, 0.15); burst({ buf: 'brown', f: 600, v: 1.2, d: 0.15 }); await wait(500); if (!alive(ep)) return;
      if (this.real) {
        this.speak('Fine.'); await wait(1800); if (!alive(ep)) return;
        this.ryan.g.rotation.y = PI; this.walkAway = true; await wait(3200); if (!alive(ep)) return;
        res.died = false; res.good = false;
      } else {
        await wait(400); sfx.slam(); P.flash.value = 0.15; tween(P.flash, 'value', 0, 0.3); await wait(700); sfx.slam(); await wait(900); if (!alive(ep)) return;
        this.porch.intensity = 0; setLayer(this.ent.g, 0); this.ryan.g.visible = false; this.ent.g.position.set(0.9, 0, -3.2); this.ent.g.rotation.y = 0;
        await wait(250); this.porch.intensity = 3; sfx.sting(0.6); await wait(450); this.porch.intensity = 0; await wait(1300); if (!alive(ep)) return;
        res.died = false; res.good = true;
      }
    } else { // timeout
      if (this.real) { this.speak('Fine.'); await wait(1500); this.ryan.g.rotation.y = PI; this.walkAway = true; await wait(3000); if (!alive(ep)) return; res.died = false; res.good = false; }
      else { sfx.slam(); tween(this.piv.rotation, 'y', -1.5, 0.15); await wait(200); if (!alive(ep)) return; if (await this.lighterSave(ep)) { if (!alive(ep)) return; await wait(900); if (!alive(ep)) return; await fadeOut(0.8); if (!alive(ep)) return; return doorNext(Object.assign(res, { good: true, burned: true })); } if (!alive(ep)) return; return attack('shake', 34, async () => { this.piv.rotation.y = 0; this.bolt.position.x = 0.8; this.ryan.g.visible = false; sfx.slam(); await wait(900); if (!alive(ep)) return; await fadeOut(0.8); if (!alive(ep)) return; doorNext(Object.assign(res, { hurt: true, good: false })); }, this.tellText()); }
    }
    await fadeOut(0.9); if (!alive(ep)) return; doorNext(res);
  },
  update(dt, t) {
    const r = this.ryan, has = this.has;
    // breath puffs
    for (let i = this.puffs.length - 1; i >= 0; i--) { const p = this.puffs[i]; p.t += dt; const k = p.t / 2.0; if (k >= 1) { this.scene.remove(p.s); this.puffs.splice(i, 1); continue; } p.s.position.addScaledVector(p.v, dt); const sc = 0.12 + k * 0.45; p.s.scale.set(sc, sc * 0.8, 1); p.s.material.opacity = 0.8 * (1 - k) * Math.min(1, k * 6); }
    const wantLean = this.armed && !this.decided && (input.keys.KeyW || input.keys.ArrowUp);
    this.lean += ((wantLean ? 1 : 0) - this.lean) * Math.min(1, dt * 3.5);
    const L = this.lean, e = L * L * (3 - 2 * L);
    camera.position.set(0.15 + 0.45 * e, 1.6, -0.4 - 1.8 * e);
    look.base = -0.2 - 0.08 * e; look.bp = -0.02 + 0.1 * e; look.ry = 1.0 - 0.6 * e; look.rp = 0.4 - 0.2 * e;
    if (Math.abs(camera.fov - (70 - 22 * e)) > 0.05) { camera.fov = 70 - 22 * e; camera.updateProjectionMatrix(); }
    if (this.has && this.has('frozen') === false && wantLean && !this.leanSaid && !this.real && Math.random() < 0.002) { this.leanSaid = true; }
    if (!r.g.visible) return;
    r.head.getWorldPosition(this.headW); this.headW.y += 0.15;
    const watched = angleTo(this.headW) < 0.3;
    this.frozenNow = has('frozen') && watched && !this.decided;
    if (!this.frozenNow) {
      r.torso.rotation.z = Math.sin(t * 1.3) * 0.05; r.hips.position.x = Math.sin(t * 0.7) * 0.03;
      r.armL.rotation.z = 0.95 + Math.sin(t * 6) * 0.06; r.armR.rotation.z = -0.95 - Math.sin(t * 6 + 1) * 0.06;
      if (!this.decided) r.head.rotation.y = Math.sin(t * 0.5) * 0.35 + (Math.sin(t * 0.21) > 0.8 ? 0.5 : 0);
    } else r.head.rotation.y += (0 - r.head.rotation.y) * 0.5;
    if (this.walkAway) { r.g.position.z -= dt * 1.1; r.g.position.x += dt * 0.25; const sw = Math.sin(t * 7); r.legL.rotation.x = sw * 0.4; r.legR.rotation.x = -sw * 0.4; this.shadow.position.set(r.g.position.x, 0.012, r.g.position.z + 0.05); }
    // blink
    if (!has('blink')) { this.blinkT -= dt; if (this.blinkT <= 0) { this.lids.forEach((l) => (l.visible = true)); if (this.blinkT < -0.12) { this.lids.forEach((l) => (l.visible = false)); this.blinkT = rand(1.8, 4); } } }
    // breath
    if (!has('breath')) { this.breathT -= dt; if (this.breathT <= 0) { this.breathT = rand(1.8, 2.6); const m = new THREE.SpriteMaterial({ map: this.breathTex, transparent: true, depthWrite: false, opacity: 0.5 }); const s = new THREE.Sprite(m); s.position.copy(this.headW).add(new THREE.Vector3(0, -0.12, 0.15)); this.scene.add(s); this.puffs.push({ s, t: 0, v: new THREE.Vector3(rand(-0.05, 0.05), 0.12, 0.18) }); } }
    if (!this.armed || this.decided) return;
    // timer + pressure
    this.tLeft -= dt; $('dtime').style.width = Math.max(0, this.tLeft / 50 * 100) + '%';
    if (this.tLeft < 15 && this.vanished !== 1) this.porch.intensity = Math.random() < 0.06 ? 1 : 7;
    if (this.tLeft < 12 && !this.hb) this.hb = heartbeat(110, 0.7);
    if (this.tLeft <= 0) { this.decide(epoch, 'timeout'); return; }
    if (this.vanishAt > 0 && 50 - this.tLeft > this.vanishAt && !this.vanished) {
      this.vanished = 1; this.ryan.g.visible = false; this.ent.g.visible = false; this.shadow.visible = false; this.porch.intensity = 2; this.lineT = 99; this.knockT = 99; clearSay();
      setTimeout(() => { if (cur !== this || this.decided) return;  }, 900);
      this.vanishBack = 50 - this.tLeft + rand(5, 8);
    }
    if (this.vanished === 1 && 50 - this.tLeft > this.vanishBack) {
      this.vanished = 2; const r2 = this.ryan; r2.g.position.set(0.82, 0, -3.18); this.shadow.position.set(0.82, 0.012, -3.13);
      r2.g.visible = true; this.ent.g.visible = !this.real; this.ent.g.position.set(0.82, -0.18, -3.18); this.shadow.visible = !this.has('shadow');
      this.porch.intensity = 7; sfx.glass(this.pan); P.flash.value = 0.15; tween(P.flash, 'value', 0, 0.3); this.knockT = 2; this.lineT = 1.2;
    }
    this.knockT -= dt; if (this.knockT <= 0) { this.knockT = this.real ? rand(7, 10) : Math.max(3, 9 - (45 - this.tLeft) * 0.15); sfx.knock(this.pan); }
    this.lineT -= dt;
    if (this.lineT <= 0) { this.lineT = rand(5.5, 7.5); const line = this.real ? REAL_LINES[this.lineIdx++ % REAL_LINES.length] : has('repeat') ? FAKE_REPEAT : FAKE_LINES[this.lineIdx++ % FAKE_LINES.length]; this.speak(line); }
    // live camera: the creature shows its real shape
    if (phone.visible && !phone.broken && !this.real && angleTo(this.headW) < 0.35 && !this.camStung) { this.camStung = true; sfx.sting(0.3); }
  },
  exit() { document.body.classList.remove('alone'); $('qte').classList.remove('show'); camera.fov = 70; camera.updateProjectionMatrix(); $('dhud').classList.remove('show'); this.camStung = false; this.walkAway = false; this.armed = false; this.ryan.g.visible = true; this.lamp.intensity = 1.6; },
};

function doorNext(res) {
  DOOR_RESULT = res; if (res.real) RUN.trust += res.good ? 1 : -1; RUN.log.push(res.mom ? 'Woke Mum instead of deciding' : res.real ? (res.good ? 'Let the real Ryan in' : 'Shut the real Ryan out') : (res.good ? 'Kept it outside the door' : 'Opened the door to it')); P.fade.value = 1; prompt(''); clearSay();
  go(SC.mill, { line: res.mom && res.real ? "A text, an hour later: 'ur mum sent me home. mill. midnight. if you still trust me.'" : res.real && !res.good ? "A text, an hour later: 'mill. midnight. if you still trust me.'" : "A text, an hour later: 'the old mill. midnight. i know how to end it.'" });
}
// ======================================================= VERDICT
let vIdx = 0;
const vItems = () => [...document.querySelectorAll('#vmenu .mi')];
function vSel(i) { const it = vItems(); vIdx = (i + it.length) % it.length; it.forEach((b, k) => b.classList.toggle('sel', k === vIdx)); }
SC.verdict = {
  scene: voidScene,
  enter(o) {
    cursor(true); unlock(); P.fade.value = 0; DOOR_RESULT = o;
    $('vHead').textContent = o.real ? 'it was him' : "it wasn't him"; $('vHead').style.fontSize = '';
    $('vKick').textContent = 'THE DOOR · ' + (o.good ? 'YOU READ IT RIGHT' : o.hurt ? 'IT GOT ITS HANDS ON YOU' : 'YOU GOT IT WRONG');
    const callTxt = { open: 'You opened the door', lock: 'You locked the door', timeout: 'You froze and did nothing' }[o.call];
    const outcome = o.hurt ? 'It got in. You fought it off and lost health.' : o.real ? (o.good ? 'Ryan is safe inside with you.' : 'You turned the real Ryan away.') : 'You kept it out.';
    const tellTxt = o.real ? 'None. He blinked, breathed and cast a shadow.' : o.tells.map((k) => TELL_NAMES[k]).join(' · ');
    const rows = [['Health', Math.max(0, HP) + ' / ' + MAXHP, HP <= 34 ? 'bad' : ''], ['Your call', callTxt, ''], ['What happened', outcome, o.good ? 'good' : 'bad'], [o.real ? 'Tells' : 'Tells you could catch', tellTxt, ''], ['Photos left', String(o.film), ''], ['Asked a question', o.asked ? 'Yes' : 'No', '']];
    $('vRows').innerHTML = rows.map(([a, b, c]) => `<div><span>${a}</span><b class="${c}">${b}</b></div>`).join('');
    const m = $('vmenu'); m.innerHTML = '';
    const add = (label, fn) => { const b = document.createElement('button'); b.className = 'mi'; b.textContent = label; b.onclick = fn; b.onmouseenter = () => vSel(vItems().indexOf(b)); m.appendChild(b); };
    add('Continue', () => this.cont());
    add('Replay the Door (new coin flip)', () => { requestLock(); go(SC.door, { retry: true, film: SC.door.filmAtEntry }); });
    add('Main Menu', () => go(SC.title));
    $('verdict').classList.add('show'); vSel(0);
    tone({ type: 'sine', f: o.good ? 440 : 110, fEnd: o.good ? 660 : 70, v: 0.15, d: 0.8 });
  },
  async cont() {
    const ep = epoch; $('verdict').classList.remove('show'); requestLock(); P.fade.value = 1;
    center(DOOR_RESULT.real && !DOOR_RESULT.good ? "A text, an hour later: 'mill. midnight. if you still trust me.'" : "A text, an hour later: 'the old mill. midnight. i know how to end it.'");
    await wait(2300); if (!alive(ep)) return; center(''); await wait(500); go(SC.mill);
  },
  onKey(c) { if (c === 'ArrowDown' || c === 'KeyS') vSel(vIdx + 1); else if (c === 'ArrowUp' || c === 'KeyW') vSel(vIdx - 1); else if (c === 'Enter' || c === 'Space') vItems()[vIdx].click(); },
  exit() { $('verdict').classList.remove('show'); },
};

// ======================================================= GAME OVER
SC.dead = {
  scene: voidScene,
  enter(o) {
    this.sc = o.sc; cursor(true); unlock(); P.fade.value = 0;
    const k = Object.keys(SC).find((n) => SC[n] === o.sc);
    $('vHead').textContent = "you didn't make it"; $('vHead').style.fontSize = 'clamp(50px,6vw,92px)'; $('vKick').textContent = 'IT GOT YOU · HEALTH 0';
    $('vRows').innerHTML = [['Chapter', CH_NAMES[k] || ''], ['Fake-outs survived', '2 of 3'], ['Tip', 'It never blinks, breathes or casts a shadow. Ryan does.']].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    const m = $('vmenu'); m.innerHTML = '';
    const add = (label, fn) => { const b = document.createElement('button'); b.className = 'mi'; b.textContent = label; b.onclick = fn; b.onmouseenter = () => vSel(vItems().indexOf(b)); m.appendChild(b); };
    add('Restart Chapter (full health)', () => { HP = MAXHP; requestLock(); go(this.sc, { retry: true, film: this.sc === SC.door ? SC.door.filmAtEntry : undefined }); });
    add('Main Menu', () => go(SC.title));
    $('verdict').classList.add('show'); vSel(0); tone({ type: 'sine', f: 110, fEnd: 40, v: 0.2, d: 1.5 });
  },
  onKey(c) { SC.verdict.onKey(c); },
  exit() { $('verdict').classList.remove('show'); },
};

// ---------------- shared: lighter quick-save ----------------
let LIGHTER_SKIP = false; let TOGETHER = true, LEFT_MUM = 'silent';
function qteLighter() {
  return new Promise((res) => {
    if (LIGHTER <= 0) return res(false);
    const el = $('qte'); el.classList.add('show'); const t0 = performance.now(), DUR = 950; let done = false, raf;
    teach('lighter', ['KeyF'], 'Lighter', 'Fire drives it back. You only have so much fuel.', false);
    const finish = (ok) => { if (done) return; done = true; el.classList.remove('show'); removeEventListener('keydown', key); cancelAnimationFrame(raf); if (ok) { LIGHTER--; sfx.lighter(); P.flash.value = 0.6; tween(P.flash, 'value', 0, 0.5); sfx.scream(0.75, 1, 0.9); } res(ok); };
    const key = (e) => { if (e.code === 'KeyF') finish(true); };
    const tick = () => { const k = 1 - (performance.now() - t0) / DUR; el.style.setProperty('--q', Math.max(0, k)); if (k <= 0) finish(false); else raf = requestAnimationFrame(tick); };
    addEventListener('keydown', key); tick(); sfx.sting(0.4);
  });
}

// ======================================================= THE FIELD (searching for Hunter)
SC.field = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x000000); s.fog = new THREE.Fog(0x010203, 5, 22);
    const gt = ctex(64, 64, (g, w, h) => { g.fillStyle = '#2c401e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = ['#3c5828', '#1e2c14', '#4c6634'][i % 3]; g.fillRect(rand(0, w), rand(0, h), 1, rand(1, 4)); } }, 40, 40);
    plane(s, 90, 90, lam({ map: gt }), 0, 0, -20, -PI / 2);
    plane(s, 90, 6, texMat('asphalt', 45, 3), 0, 0.01, 5, -PI / 2);
    const gm = [lam({ color: 0x4a6232 }), lam({ color: 0x3a5226 }), lam({ color: 0x5e7240 })];
    for (let i = 0; i < 420; i++) { const h = rand(0.5, 1.15); const b = box(s, 0.05, h, 0.05, gm[i % 3], rand(-22, 22), h / 2, rand(-40, 1)); b.rotation.z = rand(-0.25, 0.25); b.rotation.y = rand(0, 3); }
    // road light + fence posts
    const pole = lam({ color: 0x3a3a3a }); box(s, 0.14, 5, 0.14, pole, 0, 2.5, 3.2); box(s, 0.5, 0.1, 0.3, basic(0xffc070, true), 0, 4.9, 2.8);
    const rl = new THREE.PointLight(0xffa850, 10, 12, 1.1); rl.position.set(0, 4.4, 2.6); s.add(rl);
    for (let x = -20; x <= 20; x += 2.5) box(s, 0.1, 1.0, 0.1, lam({ color: 0x3a2e22 }), x, 0.5, 1.6);
    // things in the grass
    const BL = ['#5a0000', '#760806', '#3e0000', '#8e1208'];
    const bt = ctex(64, 64, (g) => { for (let i = 0; i < 10; i++) { g.fillStyle = BL[i % 4]; g.beginPath(); g.ellipse(32 + rand(-14, 14), 32 + rand(-14, 14), rand(6, 16), rand(4, 12), rand(0, 3), 0, 7); g.fill(); } }); bt.wrapS = bt.wrapT = THREE.ClampToEdgeWrapping;
    const bm = lam({ map: bt, transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.clues = [
      { p: new THREE.Vector3(1.5, 0, -7), line: "Hunter's shoe.", seen: false },
      { p: new THREE.Vector3(3.5, 0, -14), line: 'The grass is flattened. Something was dragged through here.', seen: false },
    ];
    box(s, 0.12, 0.09, 0.28, lam({ color: 0xd8d8d0 }), 1.5, 0.05, -7).rotation.y = 0.7;
    for (let i = 0; i < 7; i++) plane(s, 0.5, 0.9, bm, 2 + i * 0.55 + rand(-0.2, 0.2), 0.02, -9 - i * 1.9, -PI / 2, rand(0, 3));
    this.body = human({ shirt: 0x5a2a2a, pants: 0x1c1c22, hair: 0x2a1a12, skin: 0x9a8a80 }); this.body.g.rotation.set(-PI / 2, 0, 0.5); this.body.g.position.set(6, 0.14, -24); this.body.head.visible = false; s.add(this.body.g);
    this.body.armL.rotation.z = -1.2; this.body.legR.rotation.x = 0.4;
    plane(s, 2.2, 1.8, bm, 6.1, 0.03, -23.4, -PI / 2); plane(s, 1.2, 1.0, bm, 6.4, 0.035, -22.6, -PI / 2, 1);
    this.ph = box(s, 0.08, 0.015, 0.15, basic(0x9ab4ff, true), 5.2, 0.03, -23.2);
    this.phL = new THREE.PointLight(0x8aa8ff, 1.2, 3, 1.5); this.phL.position.set(5.2, 0.4, -23.2); s.add(this.phL);
    s.add(new THREE.AmbientLight(0x0c1018, 1));
    const moon = new THREE.DirectionalLight(0x3a4a70, 0.5); moon.position.set(-4, 8, 2); s.add(moon);
    this.spot = new THREE.SpotLight(0xfff0d0, 0, 22, 0.5, 0.6, 0.9); this.spot.position.set(0.15, -0.15, 0); this.spot.target.position.set(0, -0.22, -1);
    this.fill = new THREE.PointLight(0xffe8c0, 2.2, 7, 1.3); this.fill.position.set(0, -0.3, -0.6);
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); s.add(this.ryan.g);
    this.ent = entity({ tilt: 0.55, color: 0x2a2624 }); this.ent.eyes.forEach((m) => m.scale.set(1.7, 1.7, 1)); s.add(this.ent.g);
    this.torch = new THREE.PointLight(0xfff0d0, 0, 5, 1.4); s.add(this.torch);
    this.bodyP = new THREE.Vector3(6, 0, -24); this.rp = new THREE.Vector3();
    this.lurk = entity({ tilt: 0.5, color: 0x1a1614 }); this.lurk.g.position.set(-7.5, 0, -9); this.lurk.g.rotation.y = 0.9; s.add(this.lurk.g); this.lurkP = new THREE.Vector3(-7.5, 1.6, -9);
    const sc = new THREE.Group(); sc.position.set(0.3, 0, -18.5); s.add(sc); const scm = lam({ color: 0x3a2e22 });
    box(sc, 0.1, 2.1, 0.1, scm, 0, 1.05, 0); box(sc, 1.5, 0.08, 0.08, scm, 0, 1.55, 0); box(sc, 0.5, 0.7, 0.2, lam({ color: 0x4a3a30 }), 0, 1.3, 0); box(sc, 0.26, 0.3, 0.26, lam({ color: 0x8a7a5a }), 0, 1.9, 0);
    this.scP = new THREE.Vector3(0.3, 1.6, -18.5);
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    camera.add(this.spot); camera.add(this.spot.target); camera.add(this.fill); this.spot.intensity = 60;
    this.pos = new THREE.Vector3(0, 1.6, 1.0); camera.position.copy(this.pos); setLook(0.12, -0.05, Infinity, 0.6);
    this.real = window.__forceReal ?? (Math.random() < 0.4);
    Object.assign(this, { phase: 'search', flee: false, stepT: 0, ringT: 0, done: false, lineT: 0, seenMove: false, said: 0 });
    this.clues.forEach((c) => (c.seen = false)); this.lurk.g.visible = true; this.lurkSee = 0; this.scSeen = false; this.behind = 0;
    this.ryan.g.visible = false; this.ent.g.visible = false; this.torch.intensity = 0;
    setLayer(this.ryan.g, this.real ? 0 : L_MASK); setLayer(this.ent.g, L_TRUE);
    this.ring = panner(5.2, 0.2, -23.2, 0.5);
    loopNoise({ buf: 'brown', f: 220, v: 0.2 }); loopNoise({ buf: 'white', type: 'bandpass', f: 2600, q: 0.3, v: 0.012 });
    every(4200, () => burst({ buf: 'brown', f: 300, v: 0.25, a: 1.2, d: 2.2 }));
    every(9000, () => { if (this.phase === 'search') tone({ f: rand(300, 500), fEnd: 200, v: 0.04, a: 0.3, d: 1.2, dest: panner(rand(-15, 15), 1, rand(-30, -5), 0.5) }); });
    setPhone(true, BAT <= 0, BAT <= 0 ? 'BATTERY 0%' : ''); setTouch(['KeyW', 'KeyC']);
    this.run(ep);
  },
  async run(ep) {
    await fadeIn(1.8); if (!alive(ep)) return;
    say('Naim: Hunter?', 1100); (async () => { await wait(9000); if (alive(ep) && this.phase === 'search') say('Naim: Pick up.', 1100); })();
    objective('FOLLOW THE RINGING'); controls([{ keys: ['KeyW'], verb: 'Walk', hold: true }, { keys: ['Space', 'RMB'], verb: 'Camera', hold: true, show: () => BAT > 0 }]);
    teach('walk', ['KeyW'], 'Walk', 'Move the mouse to look. You walk where you look.', true);
  },
  async found(ep) {
    this.phase = 'found'; objective(''); controls([]); sfx.sting(0.45); P.warp.value = 1.2;
    center('17 MISSED CALLS \u2014 DAD'); await wait(2400); if (!alive(ep)) return; center(''); P.warp.value = 0.3;
    await say('Naim: Oh\u2014', 500); if (!alive(ep)) return;
    this.ring = null; this.phL.intensity = 0; this.ph.visible = false;
    await wait(2600); if (!alive(ep)) return;   // silence
    // someone behind you
    const back = new THREE.Vector3(Math.sin(look.yaw), 0, Math.cos(look.yaw));
    this.rp.copy(this.pos).addScaledVector(back, 9); this.rp.y = 0; this.rp.x = clamp(this.rp.x, -18, 18); this.rp.z = clamp(this.rp.z, -36, -3);
    this.ryan.g.visible = true; this.ent.g.visible = !this.real;
    this.pan = panner(this.rp.x, 1.5, this.rp.z, 0.8);
    if (this.real) { await say('Ryan: Naim!', 900); if (!alive(ep)) return; } else { sfx.sting(0.35); await wait(900); if (!alive(ep)) return; }
    this.phase = 'judge'; this.lineT = 4; heartbeat(84, 0.5);
    objective('YOU ARE ALONE'); document.body.classList.add('alone');
    controls([{ keys: ['KeyW'], verb: 'Face him', hold: true }, { keys: ['KeyE'], verb: 'Run for the road' }, { keys: ['Space', 'RMB'], verb: 'Camera', hold: true, show: () => BAT > 0 }]); setTouch([['KeyW', 'FACE HIM'], ['KeyE', 'RUN'], ['KeyC', 'CAMERA']]);
  },
  async end(ep, how) {
    if (this.done) return; this.done = true; controls([]); objective(''); document.body.classList.remove('alone'); setPhone(false); clearSay();
    const r = this.ryan;
    if (how === 'caught') {
      return attack('shake', 34, async () => {
        this.ryan.g.visible = false; this.ent.g.visible = false;
        await wait(1200); if (!alive(ep)) return; await fadeOut(0.9); if (!alive(ep)) return; this.next(ep, false);
      }, 'It only moved when you looked away.<br>It kept saying the same thing.');
    }
    if (how === 'met') { relief(); noVoice("It's me. Come on", this.pan); if (!await talk(ep, [['Ryan', 'It\u2019s me.', 1000], ['Ryan', 'I saw it too, all right? Come on.', 1400]])) return; await fadeOut(0.9); if (!alive(ep)) return; RUN.trust++; RUN.log.push('Trusted the real Ryan in the field'); return this.next(ep, true); }
    if (how === 'road') {
      if (this.real) { await say('Ryan: Naim, wait!', 1300); if (!alive(ep)) return; }
      else { sfx.whoosh(); P.flash.value = 0.3; tween(P.flash, 'value', 0, 0.6); r.g.visible = false; this.ent.g.visible = false; await say('A car passes. When the headlights are gone, so is he.', 1900); if (!alive(ep)) return; }
      if (this.real) { RUN.trust--; RUN.log.push('Ran from the real Ryan in the field'); } await fadeOut(0.9); if (!alive(ep)) return; this.next(ep, this.real);
    }
  },
  next(ep, withRyan) { go(SC.cross, { id: 'A', withRyan }); },
  onKey(c) {
    if (c !== 'KeyE' || this.phase !== 'judge' || this.done || this.flee) return; this.flee = true; objective('RUN'); clearSay(); sfx.gasp();
    controls([{ keys: ['Space', 'RMB'], verb: 'Camera', hold: true, show: () => BAT > 0 }]); setTouch([['KeyC', 'CAMERA']]);
    const d = (((PI - look.yaw) % (2 * PI)) + 3 * PI) % (2 * PI) - PI; look.ty = look.yaw + d; look.tp = -0.05;
  },
  update(dt, t) {
    const W = input.keys.KeyW || input.keys.ArrowUp; let walk = !this.done && this.phase === 'search' && W;
    if (this.phase === 'judge' && !this.done) {
      if (this.flee) { this.pos.z += 4.4 * dt; look.bob += dt * 13; walk = true; }
      else if (W) { const ax = this.rp.x - this.pos.x, az = this.rp.z - this.pos.z, ad = Math.hypot(ax, az) || 1; this.pos.x += ax / ad * 2.3 * dt; this.pos.z += az / ad * 2.3 * dt; look.bob += dt * 9; walk = true; }
    } else if (walk) {
      const sp = 2.3; this.pos.x -= Math.sin(look.yaw) * sp * dt; this.pos.z -= Math.cos(look.yaw) * sp * dt;
      this.pos.x = clamp(this.pos.x, -20, 20); this.pos.z = clamp(this.pos.z, -38, 2.4);
      look.bob += dt * 9; this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.42; burst({ type: 'bandpass', f: rand(900, 1500), q: 0.6, v: 0.25, d: 0.12 }); }
    }
    camera.position.set(this.pos.x, 1.6 + (walk ? Math.sin(look.bob) * 0.04 : 0), this.pos.z);
    if (walk && Math.sin(look.bob) > 0.97 && !this.ftLock) { this.ftLock = true; foot('grass', 0.9); } else if (Math.sin(look.bob) < 0) this.ftLock = false;
    if (this.phase === 'search') {
      if (walk) { this.behind -= dt; if (this.behind <= 0) { this.behind = 0.42; const bx = this.pos.x + Math.sin(look.yaw) * 4, bz = this.pos.z + Math.cos(look.yaw) * 4; setTimeout(() => { if (cur === this) burst({ type: 'bandpass', f: 700, q: 0.6, v: 0.5, d: 0.14, dest: panner(bx, 0.1, bz, 0.7) }); }, 230); } }
      if (this.lurk.g.visible) { if (angleTo(this.lurkP) < 0.22) this.lurkSee += dt; if (this.lurkSee > 0.25 || this.pos.distanceTo(this.lurkP) < 5) { this.lurk.g.visible = false; zippo(panner(this.lurkP.x, 1.5, this.lurkP.z, 0.4)); hush(900); } }
      if (!this.scSeen && this.pos.distanceTo(this.scP) < 4.5 && angleTo(this.scP) < 0.6) { this.scSeen = true; sfx.sting(0.3); P.warp.value = 1; setTimeout(() => { P.warp.value = 0.3; if (cur === this) talk(epoch, [['Naim', 'Wait.', 1000], ['Naim', 'Nothing. Go.', 900]]); }, 700); }
    }
    this.spot.intensity = 60 + (Math.random() < 0.02 ? -40 : 0);
    if (this.phase === 'search') {
      this.ringT -= dt; if (this.ringT <= 0 && this.ring) { this.ringT = 2.4; for (let i = 0; i < 2; i++) { tone({ type: 'square', f: 1250, v: 0.5, d: 0.18, lp: 3000, dest: this.ring, at: i * 0.3 }); tone({ type: 'square', f: 1050, v: 0.5, d: 0.18, lp: 3000, dest: this.ring, at: i * 0.3 + 0.15 }); } this.phL.intensity = 2.2; }
      this.phL.intensity = Math.max(0.5, this.phL.intensity - dt * 2);
      for (const c of this.clues) if (!c.seen && this.pos.distanceTo(c.p) < 3.2) { c.seen = true; say(c.line, 1600); }
      if (Math.hypot(this.pos.x - 6, this.pos.z + 24) < 3.4) this.found(epoch);
    }
    if (this.phase === 'judge' && !this.done) {
      const r = this.ryan, head = tmpV.set(this.rp.x, 1.5, this.rp.z);
      const watched = angleTo(head) < 0.62;
      const dx = this.pos.x - this.rp.x, dz = this.pos.z - this.rp.z, d = Math.hypot(dx, dz);
      const moving = this.real ? d > 1.6 : !watched;
      if (moving) { const sp = this.real ? 1.15 : this.flee ? 4.9 : 2.9; this.rp.x += dx / d * sp * dt; this.rp.z += dz / d * sp * dt; const sw = Math.sin(t * (this.real ? 6 : 13)); r.legL.rotation.x = sw * 0.45; r.legR.rotation.x = -sw * 0.45; r.armL.rotation.x = -sw * 0.3; r.armR.rotation.x = sw * 0.3; }
      else if (!this.real) { r.legL.rotation.x = r.legR.rotation.x = 0; }
      if (this.real) { r.torso.rotation.z = Math.sin(t * 1.3) * 0.04; r.head.rotation.y = Math.sin(t * 0.6) * 0.3; this.torch.position.set(this.rp.x + dx / d * 0.5, 1.1, this.rp.z + dz / d * 0.5); this.torch.intensity = 3.5 + Math.random() * 0.4; }
      r.g.position.set(this.rp.x, 0, this.rp.z); r.g.rotation.y = Math.atan2(dx, dz);
      this.ent.g.position.set(this.rp.x, -0.18, this.rp.z); this.ent.g.rotation.y = r.g.rotation.y; this.ent.g.scale.setScalar(0.86);
      setPos(this.pan, this.rp.x, 1.5, this.rp.z);
      this.lineT -= dt; if (this.lineT <= 0) { this.lineT = rand(4.5, 6); const real = ['It\u2019s me.', 'I saw it too, all right?', 'Come on.', 'Naim!']; if (this.real) say(`Ryan: ${real[this.said++ % 4]}`, 1300); }
      if (d < 1.5) this.end(epoch, this.real ? 'met' : 'caught');
      else if (this.pos.z > 1.6) this.end(epoch, 'road');
    }
  },
  exit() { camera.remove(this.spot); camera.remove(this.spot.target); camera.remove(this.fill); document.body.classList.remove('alone'); },
};
const tmpV = new THREE.Vector3();

// ======================================================= HOSPITAL (safe room)
SC.hosp = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x05070a); s.fog = new THREE.Fog(0x0a0e12, 7, 22);
    plane(s, 13, 9, lam({ color: 0x5a6660 }), 0, 0, -1.5, -PI / 2); plane(s, 13, 9, lam({ color: 0x8a8e88 }), 0, 2.8, -1.5, PI / 2);
    const w = lam({ color: 0x9aa39c });
    plane(s, 13, 2.8, w, 0, 1.4, -6); plane(s, 9, 2.8, w, -6.5, 1.4, -1.5, 0, PI / 2); plane(s, 9, 2.8, w, 6.5, 1.4, -1.5, 0, -PI / 2); plane(s, 13, 2.8, w, 0, 1.4, 3, 0, PI);
    for (const x of [-3.5, 0, 3.5]) box(s, 1.4, 0.04, 0.3, basic(0xe8f4ff), x, 2.76, -2.4);
    // reception, triage sign, the door to the side rooms
    box(s, 2.6, 1.1, 0.7, lam({ color: 0x6a7a80 }), -4.2, 0.55, -5.3); box(s, 2.6, 0.06, 0.8, lam({ color: 0xc8ccc8 }), -4.2, 1.12, -5.3);
    box(s, 1.5, 0.4, 0.04, basic(0x1a3a2a), -4.2, 2.2, -5.96); this.mon = box(s, 0.5, 0.2, 0.02, basic(0x30ff80), -4.2, 2.2, -5.93);
    box(s, 1.15, 2.15, 0.06, lam({ color: 0x1c2226 }), 4.4, 1.07, -5.96); box(s, 0.5, 0.16, 0.03, basic(0xc02a20), 4.4, 2.32, -5.94);
    this.doorP = new THREE.Vector3(4.4, 0, -5.5);
    // chairs: one row facing you, one down each wall
    const cm = lam({ color: 0x4a6a7a }); const chair = (x, z, ry) => { const c = new THREE.Group(); box(c, 0.52, 0.45, 0.5, cm, 0, 0.22, 0); box(c, 0.52, 0.5, 0.08, cm, 0, 0.68, -0.23); c.position.set(x, 0, z); c.rotation.y = ry; s.add(c); };
    const SK = [0xc8a590, 0x8a5a44, 0xe0b8a0, 0x6a4636, 0xd8a888], SH = [0x7a3a3a, 0x3a5a4a, 0x8a8a6a, 0x4a4a6a, 0x9a6a3a, 0x5a3a5a, 0x2a4a5a], HR = [0x1a120c, 0x5a3a1a, 0x8a8a84, 0x2a1a12, 0xa07a3a];
    let n = 0; const person = (x, z, ry, seated) => { const h = human({ shirt: SH[n % 7], pants: [0x1c1c22, 0x2a2a34, 0x3a3226][n % 3], skin: SK[n % 5], hair: HR[n % 5] }); n++; if (seated) { sit(h); h.g.position.set(x, -0.04, z); h.head.rotation.x = 0.25 + (n % 3) * 0.12; } else h.g.position.set(x, 0, z); h.g.rotation.y = ry; s.add(h.g); return h; };
    this.sitters = [];
    for (let i = 0; i < 7; i++) { const x = -2.4 + i * 0.8; chair(x, -3.4, 0); if (i !== 3 && i !== 4) this.sitters.push(person(x, -3.35, 0, true)); }
    for (let i = 0; i < 5; i++) { const z = -3.6 + i * 0.9; chair(-5.9, z, PI / 2); chair(5.9, z, -PI / 2); if (i % 2 === 0) this.sitters.push(person(-5.85, z, PI / 2, true)); if (i % 2 === 1 || i === 4) this.sitters.push(person(5.85, z, -PI / 2, true)); }
    // Jessica: hospital gown, rubber band on a raw wrist
    this.jess = human({ shirt: 0xa8c4c0, pants: 0xa8c4c0, hair: 0x3a2418, skin: 0xc8a590 }); sit(this.jess); this.jess.g.position.set(0, -0.04, -3.35); s.add(this.jess.g);
    box(this.jess.armR, 0.1, 0.03, 0.1, basic(0xc02020), 0, -0.5, 0); this.jess.armL.rotation.set(-0.9, 0, 0.22); this.jess.armR.rotation.set(-0.9, 0, -0.22);
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); sit(this.ryan); this.ryan.g.position.set(0.8, -0.04, -3.35); s.add(this.ryan.g);
    // people who never stop walking
    this.walkers = [[-1.3, 1.0, 0], [-0.2, 1.35, 1], [-4.6, 0.8, 0], [-2.2, 1.15, 1], [1.2, 0.9, 0], [-5.0, 1.25, 1]].map(([z, sp, d], i) => { const h = i % 3 === 0 ? human({ shirt: 0x3a8a86, pants: 0x3a8a86, skin: SK[i % 5], hair: HR[i % 5] }) : person(0, z, 0, false); if (i % 3 === 0) s.add(h.g); return { h, z, sp, dir: d ? 1 : -1, x: -5.5 + i * 1.9, ph: i * 1.7 }; });
    // two officers by the wall
    const cop = (x, z) => { const h = human({ shirt: 0x1a2440, pants: 0x10141e, skin: SK[(n++) % 5], hair: 0x1a120c }); box(h.head, 0.3, 0.07, 0.3, lam({ color: 0x10141e }), 0, 0.3, 0.02); h.g.position.set(x, 0, z); h.g.rotation.y = -PI / 2; s.add(h.g); return h; };
    this.cops = [cop(5.6, 0.6), cop(5.6, 1.4)];
    const l = new THREE.PointLight(0xeef6ff, 5, 13, 1.1); l.position.set(0, 2.5, -2.4); s.add(l); const l2 = new THREE.PointLight(0xdfeaff, 1.6, 9, 1.3); l2.position.set(-3.5, 2.3, -4.6); s.add(l2);
    const l3 = new THREE.PointLight(0xdfeaff, 2.2, 9, 1.3); l3.position.set(3.5, 2.3, -0.5); s.add(l3);
    this.l1 = l; this.l2 = l2; this.amb = new THREE.AmbientLight(0x48524f, 1); s.add(this.amb);
    this.ent = entity({ tilt: 0.5 }); this.ent.eyes.forEach((m) => m.scale.set(1.8, 1.8, 1)); this.ent.g.visible = false; s.add(this.ent.g);
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    camera.position.set(-0.3, 1.55, 0.9); setLook(-0.07, -0.14, 1.3, 0.4);
    this.ryan.g.visible = !!o.withRyan; this.withRyan = !!o.withRyan; this.asked = new Set(); this.busy = false; this.leaving = false;
    const j = this.jess; sit(j); j.armL.rotation.set(-0.9, 0, 0.22); j.armR.rotation.set(-0.9, 0, -0.22); j.g.visible = true; j.g.position.set(0, -0.04, -3.35); j.g.rotation.set(0, 0, 0); j.torso.rotation.set(0, 0, 0);
    this.cops[0].g.position.set(5.6, 0, 0.6); this.cops[1].g.position.set(5.6, 0, 1.4); this.cops.forEach((c) => { c.g.rotation.y = -PI / 2; c.g.visible = true; }); this.lookPast = false; this.dontLook = false;
    Object.assign(this, { berserk: false, drag: false, snapT: 1, paT: 5, rescue: false, back: 0 });
    hum(0.02); loopNoise({ buf: 'brown', f: 420, v: 0.16 }); loopNoise({ buf: 'white', type: 'bandpass', f: 1400, q: 0.5, v: 0.012 });
    this.run(ep);
  },
  async run(ep) {
    this.timed = false; this.lightsOut = false; this.beepT = 0; this.ryan.g.visible = false; const j = this.jess;
    await fadeIn(1.2); if (!alive(ep)) return;
    HP = Math.min(MAXHP, HP + 34); BAT = Math.min(1, BAT + 0.4); drawHP();
    if (!await talk(ep, [['Naim', 'Jessica?'], ['Jessica', 'Who told you my name?'], ['Naim', 'Izzie.'], () => { this.lookPast = true; }, 700,
      ['Jessica', 'Did you come alone?'], ['Naim', 'Yeah.'], ['Jessica', 'Course you did.'], 500, ['Jessica', 'Leave the door open.'],
      ['Naim', 'She said you knew how to stop it.'], ['Jessica', 'I know how to stay alive.'], ['Naim', 'That’s enough.'], ['Jessica', 'No, it isn’t.'], 1300,
      ['Naim', 'What happened to Marnie?'], ['Jessica', 'She went for a shower.'], ['Naim', 'And?'], ['Jessica', 'And I let her go by herself.', 1500],
      () => { this.ent.g.visible = true; this.ent.g.position.set(-2.9, 0, -4.9); this.ent.g.rotation.y = 0.5; this.dontLook = true; }, 600,
      ['Jessica', 'Don’t look.'], ['Naim', 'At what?'], ['Jessica', 'I said don’t.', 1300],
      () => { this.dontLook = false; this.ent.g.visible = false; LIGHTER = 2; RUN.hasLighter = true; sfx.click(); teach('lighter', ['KeyF'], 'Lighter: 2 strikes', 'When it grabs you, press F fast.', false); }, 500,
      ['Jessica', 'It doesn’t kill it.'], ['Naim', 'Then what’s it for?'], ['Jessica', 'It buys you a second.'], ['Naim', 'A second?'], ['Jessica', 'Sometimes that’s what you get.', 1400],
      ['Naim', 'Why Ryan?'], ['Jessica', 'You know why.', 1600]])) return;
    this.kick(ep);
  },
  async kick(ep) {
    if (this.leaving) return; this.leaving = true; controls([]); setTouch([]); objective(''); clearSay();
    const j = this.jess; omen(900); await wait(950); if (!alive(ep)) return;
    this.ent.g.visible = true; this.ent.g.position.set(-2.9, 0, -4.9); this.ent.g.rotation.y = 0.5; sfx.sting(0.5);
    if (!await talk(ep, [['Jessica', 'She’s here.', 900], ['Naim', 'Jessica—', 500]])) return;
    j.hips.position.y = 0.92; for (const L of [j.legL, j.legR]) { L.rotation.x = 0; L.knee.rotation.x = 0; } j.g.position.set(0, 0, -2.9); this.berserk = true; look.ty = -0.07;
    await say('Jessica: Marnie?', 900); if (!alive(ep)) return; sfx.scream(1.3, 0.7, 1.0);
    this.cops.forEach((c, i) => { tween(c.g.position, 'x', i ? 0.55 : -0.55, 1.1); tween(c.g.position, 'z', -2.85, 1.1); }); this.copWalk = 1.1;
    await wait(1150); if (!alive(ep)) return; this.cops[0].g.rotation.y = PI / 2; this.cops[1].g.rotation.y = -PI / 2;
    if (!await talk(ep, [['Officer', 'Come on. Let’s get you back to your room.'], ['Jessica', 'No. Not by myself.'], ['Officer', 'You’re all right.', 800]])) return;
    this.ent.g.visible = false; this.drag = true; const d = this.doorP;
    for (const [o, dx] of [[j.g, 0], [this.cops[0].g, -0.55], [this.cops[1].g, 0.55]]) { tween(o.position, 'x', d.x + dx * 0.6, 3.4); tween(o.position, 'z', d.z + 0.3, 3.4); }
    look.ty = -0.5;
    if (!await talk(ep, [['Jessica', 'Don’t shut that door.', 800], ['Officer', 'Jessica—', 500], ['Jessica', 'Don’t shut it!', 800]])) return;
    j.g.visible = false; this.berserk = false; this.drag = false; sfx.slam(); this.cops[0].g.visible = false; this.cops[1].g.rotation.y = 0;
    this.lightsOut = true; this.l1.intensity = 1.4; this.amb.intensity = 0.5; hush(1500); await wait(1400); if (!alive(ep)) return;
    zippo(panner(4.4, 1.4, -6.2, 0.5), 1.6); await wait(600); if (!alive(ep)) return;
    controls([{ keys: ['KeyW'], verb: 'Open the door', hold: true, fill: () => this.back }]); setTouch([['KeyW', 'OPEN THE DOOR']]);
    this.rescue = true; this.back = 0; this.rescT = 9; this.cam0 = camera.position.clone();
  },
  async saved(ep) {
    if (!this.rescue) return; this.rescue = false; controls([]); setTouch([]); document.body.classList.remove('alone'); objective('');
    sfx.slam(); this.l1.intensity = 5; this.amb.intensity = 1; this.lightsOut = false; this.cops[1].g.visible = false; hush(3200);
    await wait(3400); if (!alive(ep)) return;
    await say('Officer: What happened to her?', 1500); if (!alive(ep)) return;
    objective('RUN'); await wait(700); if (!alive(ep)) return;
    await fadeOut(0.9); if (!alive(ep)) return; RUN.did.hosp = true; RUN.hasLighter = true; RUN.log.push('Jessica was gone when the door opened'); if (RUN.did.bath) go(SC.door); else go(SC.cross, { id: 'B', from: 'hosp' });
  },
  update(dt, t) {
    const j = this.jess;
    for (const k of this.walkers) { k.x += k.dir * k.sp * dt; if (k.x > 6) k.dir = -1; if (k.x < -6) k.dir = 1; const sw = Math.sin(t * 5.5 * k.sp + k.ph); k.h.g.position.set(k.x, 0, k.z); k.h.g.rotation.y = k.dir > 0 ? PI / 2 : -PI / 2; k.h.legL.rotation.x = sw * 0.5; k.h.legR.rotation.x = -sw * 0.5; k.h.armL.rotation.x = -sw * 0.35; k.h.armR.rotation.x = sw * 0.35; }
    if (this.ryan.g.visible) this.ryan.head.rotation.y = Math.sin(t * 0.4) * 0.2;
    if (this.berserk) { j.torso.rotation.z = Math.sin(t * 26) * 0.16; j.armL.rotation.set(-2.6 + Math.sin(t * 19) * 0.5, 0, -0.4); j.armR.rotation.set(-2.6 + Math.cos(t * 17) * 0.5, 0, 0.4); j.head.rotation.y = Math.sin(t * 9) * 0.7; if (this.drag) j.g.rotation.y = Math.sin(t * 8) * 0.5; }
    else { if (this.dontLook && look.yaw > 0.3) { this.dontLook = false; sfx.sting(0.6); P.warp.value = 1; this.ent.g.position.set(-1.6, 0, -1.6); setTimeout(() => { this.ent.g.visible = false; P.warp.value = 0.3; }, 320); }
      j.torso.rotation.x = 0.12 + Math.sin(t * 3.4) * 0.09; j.head.rotation.y = Math.sin(t * 2.3) * 0.55 + Math.sin(t * 0.9) * 0.3; j.head.rotation.x = 0.1;
      this.snapT -= dt; if (this.snapT <= 0) { this.snapT = rand(0.7, 1.5); burst({ type: 'highpass', f: 2600, v: 0.22, d: 0.03, dest: panner(0, 1, -3.3, 0.5) }); j.armR.rotation.x = -1.15; setTimeout(() => { j.armR.rotation.x = -0.9; }, 90); } }
    if (this.copWalk > 0 || this.drag) { this.copWalk -= dt; const sw = Math.sin(t * 9); for (const c of this.cops) { c.legL.rotation.x = sw * 0.45; c.legR.rotation.x = -sw * 0.45; } } else for (const c of this.cops) { c.legL.rotation.x = c.legR.rotation.x = 0; }
    this.paT -= dt; if (this.paT <= 0 && !this.lightsOut) { this.paT = rand(8, 13); tone({ type: 'sine', f: 660, v: 0.05, d: 0.5 }); tone({ type: 'sine', f: 520, v: 0.05, d: 0.7, at: 0.45 }); }
    if (this.ent.g.visible) this.ent.head.rotation.z = 0.5 + Math.sin(t * 14) * 0.06;
    if (this.timed) {
      this.tLeft -= dt; objective(this.tLeft > 0 ? `SECURITY IS WATCHING  0:${String(Math.ceil(this.tLeft)).padStart(2, '0')}` : '');
      this.l1.intensity = (this.tLeft < 20 && Math.random() < 0.04) ? 1 : 5;
      if (this.tLeft <= 0) this.kick(epoch);
    }
    if (this.lightsOut) this.l1.intensity = Math.random() < 0.12 ? 0.3 : 1.6;
    const rate = this.lightsOut ? 0.28 : this.timed ? 0.45 + this.tLeft / 60 * 0.6 : 1.1;
    this.beepT -= dt; if (this.beepT <= 0) { this.beepT = rate; tone({ type: 'sine', f: this.lightsOut ? 1100 : 880, v: 0.035, d: 0.08 }); this.mon.material.color.setHex(0x80ffb0); setTimeout(() => this.mon.material.color.setHex(this.lightsOut ? 0xff4030 : 0x30ff80), 100); }
    if (this.rescue) {
      this.rescT -= dt; const held = input.keys.KeyW || input.keys.ArrowUp;
      this.back = clamp(this.back + (held ? dt / 1.8 : -dt * 0.8), 0, 1); const b = this.back;
      camera.position.set(this.cam0.x + (3.9 - this.cam0.x) * b, 1.55 + (held ? Math.sin(t * 13) * 0.04 : 0), this.cam0.z + (-4.4 - this.cam0.z) * b); look.ty = -0.5 + b * 0.35;
      if (this.back >= 1) this.saved(epoch, true); else if (this.rescT <= 0) this.saved(epoch, false);
    }
  },
  exit() { document.body.classList.remove('alone'); if (this.l1) { this.l1.intensity = 5; this.amb.intensity = 1; } if (this.ent) this.ent.g.visible = false; },
};

// ======================================================= GAS STATION (Arlene)
SC.gas = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x010103); s.fog = new THREE.Fog(0x03040a, 6, 30);
    plane(s, 60, 60, texMat('asphalt', 30, 30), 0, 0, -8, -PI / 2);
    box(s, 9, 0.4, 6, lam({ color: 0xd8d8d0 }), 0, 4.3, -6); box(s, 8.6, 0.05, 5.6, basic(0xf0f4ff, true), 0, 4.08, -6);
    for (const x of [-3.5, 3.5]) box(s, 0.35, 4.2, 0.35, lam({ color: 0xb02020 }), x, 2.1, -6);
    for (const x of [-1.6, 1.6]) { box(s, 0.6, 1.5, 0.45, lam({ color: 0xc8c8c0 }), x, 0.75, -6.4); box(s, 0.34, 0.24, 0.05, basic(0x40ff80, true), x, 1.15, -6.16); }
    const cl = new THREE.PointLight(0xeef2ff, 16, 16, 1.1); cl.position.set(0, 3.6, -5.5); s.add(cl);
    // car
    const car = lam({ color: 0x4a5a6a }); box(s, 1.8, 0.6, 4.0, car, 1.4, 0.6, -3.6); box(s, 1.6, 0.55, 2.0, car, 1.4, 1.15, -3.8); box(s, 1.5, 0.4, 0.04, basic(0x10161e), 1.4, 1.15, -2.79);
    for (const [x, z] of [[0.55, -2.3], [2.25, -2.3], [0.55, -4.9], [2.25, -4.9]]) box(s, 0.2, 0.6, 0.6, lam({ color: 0x0c0c0c }), x, 0.3, z);
    box(s, 0.3, 0.14, 0.05, basic(0xff3020, true), 0.75, 0.7, -1.59); box(s, 0.3, 0.14, 0.05, basic(0xff3020, true), 2.05, 0.7, -1.59);
    box(s, 7, 3.2, 4, lam({ color: 0x30302c }), -9, 1.6, -9); box(s, 2.6, 1.3, 0.05, basic(0xfff0c0, true), -8, 1.4, -6.97);
    this.mum = human({ shirt: 0x6a4a5a, pants: 0x4a3a44, hair: 0x2a1a12, skin: 0xb48468 }); this.mum.g.position.set(-0.2, 0, -3.4); this.mum.g.rotation.y = 0.15; s.add(this.mum.g);
    this.mum.armL.rotation.set(-1.2, 0, 0.9); this.mum.armR.rotation.set(-1.2, 0, -0.9);
    box(s, 0.12, 3.6, 0.12, lam({ color: 0x3a3a3a }), -6, 1.8, 3); box(s, 0.7, 0.5, 0.06, basic(0x2a50c0, true), -6, 3.3, 3.05);
    s.add(new THREE.AmbientLight(0x1a1e2a, 1));
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    camera.position.set(-0.4, 1.6, -0.6); setLook(0.05, -0.03, 1.3, 0.35); this.choice = false;
    loopNoise({ buf: 'brown', f: 160, v: 0.2 }); hum(0.03); every(6000, () => burst({ buf: 'brown', f: 260, v: 0.5, a: 1.2, d: 2.4 }));
    this.run(ep);
  },
  async run(ep) {
    await fadeIn(1.8); if (!alive(ep)) return;
    await say('Morning. The servo on the highway. Mum filled the tank without looking at me.', 1800); if (!alive(ep)) return;
    await say('"I knew what that prayer could do, Naim. I knew before I let them."', 2200); if (!alive(ep)) return;
    await say('"It can\'t be undone. Maybe that\'s right. Fear keeps a person on the path."', 2400); if (!alive(ep)) return;
    objective('THE BUS STOP IS ACROSS THE ROAD'); this.choice = true;
    controls([{ keys: ['KeyE'], verb: 'Walk away' }, { keys: ['KeyQ'], verb: '"I\'m not afraid of who I am."' }]); setTouch([['KeyE', 'LEAVE'], ['KeyQ', 'SPEAK']]);
  },
  async onKey(c) {
    if (!this.choice || (c !== 'KeyE' && c !== 'KeyQ')) return; this.choice = false; const ep = epoch; controls([]); objective('');
    if (c === 'KeyQ') { LEFT_MUM = 'spoke'; await say('"I\'m not scared of what I am, Mum. I\'m scared of you."', 2200); if (!alive(ep)) return; await say('She doesn\'t answer.', 1500); if (!alive(ep)) return; }
    else { LEFT_MUM = 'silent'; await say('I pick up my bag. I don\'t say goodbye.', 2000); if (!alive(ep)) return; }
    look.ty = look.base + 1.2; for (let i = 0; i < 5; i++) { sfx.step(null, 0.5); await wait(380); if (!alive(ep)) return; }
    await fadeOut(1.5); if (!alive(ep)) return; go(SC.bus);
  },
  update(dt, t) { this.mum.head.rotation.x = 0.25 + Math.sin(t * 0.5) * 0.03; },
};

// ======================================================= MILL
SC.mill = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x140703); s.fog = new THREE.Fog(0x2a1008, 4, 26);
    plane(s, 13, 22, texMat('wood', 8, 14), 0, 0, -8, -PI / 2);
    plane(s, 13, 22, texMat('char', 8, 14), 0, 6, -8, PI / 2);
    const w = (wd, h, x, y, z, ry) => plane(s, wd, h, texMat('char', wd / 2, h / 2), x, y, z, 0, ry);
    w(22, 6, -6.5, 3, -8, PI / 2); w(22, 6, 6.5, 3, -8, -PI / 2); w(13, 6, 0, 3, 3, PI);
    w(5.25, 6, -3.875, 3, -18.5, 0); w(5.25, 6, 3.875, 3, -18.5, 0); w(2.5, 2.2, 0, 4.9, -18.5, 0);
    const wood = lam({ map: tex('wood') });
    for (let z = 1; z > -18; z -= 4) for (const x of [-3, 3]) box(s, 0.32, 6, 0.32, wood, x, 3, z);
    for (let z = 1; z > -18; z -= 4) box(s, 13, 0.3, 0.3, wood, 0, 4.6, z);
    box(s, 1.6, 0.5, 2.4, wood, -4.5, 0.25, -5); box(s, 0.9, 0.9, 0.9, wood, 4.2, 0.45, -3); box(s, 0.9, 0.9, 0.9, wood, 4.4, 1.35, -3.2);
    box(s, 3, 0.1, 0.4, wood, 2.5, 0.05, -8).rotation.y = 0.5; box(s, 2.4, 0.1, 0.3, wood, -2, 0.05, -10).rotation.y = -0.8;
    // doorway glow beyond
    plane(s, 9, 6, basic(0xff6a1a, false), 0, 3, -22);
    this.fires = [];
    const F = (x, z, o) => { const f = new Fire(s, new THREE.Vector3(x, 0, z), o); this.fires.push(f); return f; };
    for (const [x, z] of [[-4.5, -12], [4.6, -13.5], [-2.6, -17.2], [2.6, -17.4], [-5.5, -16], [5.4, -9], [0, -20.5], [-1.4, -20], [1.5, -20.2]]) F(x, z, { rate: 34, spread: 0.7, size: 1.4, lift: 1.6 });
    for (const [x, z] of [[-3, -13], [3, -15], [0, -19]]) F(x, z, { smoke: true, rate: 6, spread: 1.2, size: 3.5, lift: 0.7, life: 4 });
    F(-3, -13, { rate: 18, spread: 0.2, size: 0.9, lift: 2.6 }); F(3, -9, { rate: 14, spread: 0.2, size: 0.8, lift: 2.4 });
    this.fl = [];
    for (const [x, z, i] of [[-4.5, -12, 9], [4.6, -13.5, 9], [0, -18.5, 14], [3, -9, 5]]) { const l = new THREE.PointLight(0xff7a30, i * 2, 18, 1.0); l.position.set(x, 1.5, z); s.add(l); this.fl.push(l); }
    s.add(new THREE.AmbientLight(0x4a2414, 1));
    const nearL = new THREE.PointLight(0xff8a40, 6, 10, 1.2); nearL.position.set(-2, 3, -4); s.add(nearL); this.fl.push(nearL);
    this.rim = new THREE.PointLight(0xffb070, 3, 4, 1.4); s.add(this.rim);
    this.emb = embers(s, new THREE.Vector3(0, 0, -12), 70, 6); this.baseFires = this.fires.length;
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); s.add(this.ryan.g);
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,255,220,1)', 'rgba(255,150,40,0.8)'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
    this.flame.scale.set(0.05, 0.08, 1); this.flame.position.set(0.17, -0.12, -0.4); this.flame.renderOrder = 10;
    this.lighterBody = box(new THREE.Group(), 0.035, 0.07, 0.02, lam({ color: 0xa01818 }), 0.17, -0.18, -0.4);
    this.handL = new THREE.PointLight(0xffa040, 0, 3, 1.4); this.handL.position.set(0.2, -0.1, -0.3);
    this.beam = box(s, 0.3, 0.3, 5, lam({ map: tex('char') }), 1.6, 4.6, -5.5);
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    camera.position.set(0, 1.6, 2.5); setLook(0, 0.02, 0.9, 0.35); this.runIn = 2.5; this.runT = 0; document.body.classList.add('bare');
    camera.add(this.flame); camera.add(this.lighterBody); camera.add(this.handL); this.flame.visible = false; this.lighterBody.visible = false;
    this.rz = -18; this.ryan.g.position.set(0, 0, this.rz); this.ryan.g.rotation.set(0, 0, 0); this.ryan.g.visible = true;
    this.ryan.armR.rotation.set(-1.35, 0, 0); this.ryan.armL.rotation.set(0, 0, 0); this.ryan.head.rotation.set(0, 0, 0);
    this.beam.position.set(1.6, 4.6, -5.5); this.beam.rotation.set(0, 0, 0); this.state = 'walk'; this.choiceOpen = false; this.lines = 0; this.burn = null; this.sawCam = false; this.real = window.__forceReal ?? (Math.random() < 0.5); this.headW = new THREE.Vector3(); this.said = 0;
    fireLoop(0.5); drone(36.7, 0.06); this.pan = panner(0, 1.6, this.rz, 0.8);
    every(5200, () => { burst({ buf: 'brown', f: 160, v: 1.2, a: 0.1, d: 1.6 }); });
    BAT = 0; setPhone(true, true, 'BATTERY 0%'); setTouch(['KeyC', 'KeyF', 'KeyE']);
    this.run(ep);
  },
  async run(ep) {
    P.fade.value = 0; objective('RUN'); document.body.classList.add('alone'); controls([{ keys: ['KeyW'], verb: 'Run', hold: true }]); setTouch(['KeyW']);
    heartbeat(120, 0.8); 
    while (this.runIn > 0) { await wait(50); if (!alive(ep)) return; }
    controls([]); objective(''); sfx.slam(); look.roll = 0.04;
    sfx.creak(); await wait(350); if (!alive(ep)) return;
    tween(this.beam.position, 'y', 0.2, 0.45, (x) => x * x); tween(this.beam.rotation, 'z', 0.5, 0.45); await wait(450); if (!alive(ep)) return;
    sfx.slam(); P.flash.value = 0.25; tween(P.flash, 'value', 0, 0.4); this.fires.push(new Fire(this.scene, new THREE.Vector3(0.9, 0.1, -5.5), { rate: 22, spread: 1.4, size: 0.9, lift: 1.4 }));
    omen(1800); await wait(1900); if (!alive(ep)) return;
    clearSay(); this.seq = 0; this.lineT = 0.6; setTouch(['KeyF', 'KeyE']);
    this.choiceOpen = true; objective('YOU ARE ALONE'); document.body.classList.add('alone');
    controls([{ keys: ['KeyF'], verb: 'Light the fire' }, { keys: ['KeyE'], verb: 'Take his hand' }]);
  },
  onKey(c) {
    if (!this.choiceOpen || this.state !== 'walk') return;
    if (c === 'KeyF') this.lighter(epoch); if (c === 'KeyE') this.hand(epoch);
  },
  async lighter(ep) {
    document.body.classList.remove('alone');
    if (!RUN.hasLighter && !RUN.burnt) { RUN.burnt = true; HP = Math.max(1, HP - 17); drawHP(); P.red.value = 0.55; tween(P.red, 'value', 0, 0.9); sfx.gasp(); RUN.log.push('Burned a hand on the board. No lighter'); }
    if (this.real) {
      this.state = 'flinch'; this.choiceOpen = false; controls([]); objective(''); setPhone(false); clearSay();
      this.lighterBody.visible = true; sfx.lighter(); await wait(200); this.flame.visible = true; this.handL.intensity = 2.5; await wait(500); if (!alive(ep)) return;
      this.ryan.armL.rotation.x = -2.2; this.ryan.armR.rotation.x = -2.2; tween(this, 'rz', this.rz - 2.5, 0.6);
      noVoice('Dont', this.pan, 2.8); await say('Ryan: Don’t.', 1300); if (!alive(ep)) return;
      sfx.creak(); await wait(400); sfx.slam(); P.flash.value = 0.5; tween(P.flash, 'value', 0, 0.6); this.ryan.g.visible = false;
      await wait(900); if (!alive(ep)) return; stopAll(); P.fade.value = 1; TOGETHER = false; ENDING = 'ALONE';
      return go(SC.porch);
    }
    TOGETHER = true;
    this.state = 'burn'; this.choiceOpen = false; prompt(''); controls([]); objective(''); setPhone(false); clearSay();
    this.lighterBody.visible = true; sfx.lighter(); await wait(200); this.flame.visible = true; this.handL.intensity = 2.5;
    await wait(700); if (!alive(ep)) return;
    sfx.whoosh(); const p = this.ryan.g.position;
    this.burn = [new Fire(this.scene, new THREE.Vector3(p.x, 0.2, p.z), { rate: 70, spread: 0.3, size: 1.1, lift: 2.2 }), new Fire(this.scene, new THREE.Vector3(p.x, 1.0, p.z), { rate: 40, spread: 0.25, size: 0.9, lift: 1.8 })];
    const bl = new THREE.PointLight(0xffa040, 10, 8, 1.2); bl.position.set(p.x, 1.4, p.z + 0.5); this.scene.add(bl); this.burnL = bl;
    sfx.scream(0.62, 1, 2.4); await wait(2300); if (!alive(ep)) return;
    tween(P.flash, 'value', 1, 0.5); await wait(600); stopAll(); await wait(1400); if (!alive(ep)) return;
    this.scene.remove(bl); P.flash.value = 0; P.fade.value = 1;
    ENDING = this.hurt ? 'SCARRED' : 'ASHES'; await fadeOut(0.8); if (!alive(ep)) return; go(SC.porch);
  },
  async hand(ep) {
    document.body.classList.remove('alone');
    if (!this.real) {
      this.state = 'grab'; this.choiceOpen = false; controls([]); objective(''); setPhone(false); clearSay();
      tween(this, 'rz', -0.9, 0.4); await wait(450); if (!alive(ep)) return;
      return attack('strangle', 34, async () => { this.hurt = true; this.rz = -2.2; await wait(500); if (!alive(ep)) return; this.lighter(ep); }, 'It only moved when you looked away.<br>It said the same words every time.');
    }
    TOGETHER = true;
    this.state = 'hand'; this.choiceOpen = false; prompt(''); controls([]); objective(''); setPhone(false); clearSay();
    tween(this, 'rz', -0.75, 0.7); this.ryan.armR.rotation.x = -1.5; await wait(800); if (!alive(ep)) return;
    sfx.gasp(); P.fade.value = 1; stopAll(); heartbeat(60, 0.9); await wait(1400); if (!alive(ep)) return;
    relief(); ENDING = 'WARM'; await fadeOut(0.8); if (!alive(ep)) return; go(SC.porch);
  },
  update(dt, t) {
    if (this.runIn > 0) {
      this.runT += dt; const run = input.keys.KeyW || input.keys.ArrowUp;
      if (run) { this.runIn -= dt * 1.5; look.bob += dt * 12; if (Math.sin(look.bob) > 0.97 && !this.ftLock) { this.ftLock = true; foot('wood', 1); } else if (Math.sin(look.bob) < 0) this.ftLock = false; }
      camera.position.z = Math.max(0, this.runIn); camera.position.y = 1.6 + (run ? Math.sin(look.bob) * 0.06 : 0);
      if (Math.floor(this.runT * 3.4) !== Math.floor((this.runT - dt) * 3.4)) sfx.step(panner(0, 0.1, camera.position.z + 2.2 - Math.min(1.8, this.runT * 0.35), 0.8), 1.3);
      if (this.runT > 9 && this.runIn > 0) { this.runIn = 0; camera.position.z = 0; attack('push', 34, () => { }, 'You stopped running.'); }
      if (this.runIn <= 0) { this.runIn = 0; camera.position.set(0, 1.6, 0); }
    }
    for (const f of this.fires) f.update(dt); if (this.burn) this.burn.forEach((f) => f.update(dt)); this.emb(dt, t);
    for (const l of this.fl) l.intensity = l.userData.base ??= l.intensity, l.intensity = l.userData.base * (0.75 + Math.random() * 0.4);
    if (this.flame.visible) { this.flame.scale.set(0.05 + Math.random() * 0.01, 0.08 + Math.random() * 0.02, 1); this.handL.intensity = 2 + Math.random(); }
    
    const r = this.ryan;
    if (this.state === 'walk' && this.runIn <= 0 && this.choiceOpen) {
      r.head.getWorldPosition(this.headW); const watched = angleTo(this.headW) < 0.3;
      const adv = this.real ? true : !watched;
      if (adv) { this.rz = Math.min(-0.9, this.rz + dt * (this.real ? 0.75 : 2.4)); const sw = Math.sin(t * (this.real ? 6 : 12)); r.legL.rotation.x = sw * 0.35; r.legR.rotation.x = -sw * 0.35; r.armL.rotation.x = -sw * 0.2; }
      if (this.real) { r.head.rotation.z = Math.sin(t * 1.3) * 0.08; r.torso.rotation.x = Math.sin(t * 2.1) > 0.92 ? 0.3 : 0; }
      if (this.choiceOpen) { this.lineT = (this.lineT ?? 2) - dt; if (this.lineT <= 0) { const SQ = [['Ryan', 'You came back.'], ['Naim', 'Stay there.'], ['Ryan', 'You always come back.'], ['Ryan', 'Come here.'], ['Naim', 'Ryan?'], ['Ryan', 'Please.']]; const [w, l] = SQ[Math.min(this.seq, 5)]; this.lineT = this.seq++ >= 5 ? 4.5 : 2.3; if (w === 'Naim' || this.real) say(`${w}: ${l}`, 1300); } }
      if (this.rz >= -0.9) this.hand(epoch);
    }
    if (this.state === 'burn') { r.torso.rotation.x = Math.sin(t * 30) * 0.15; r.armL.rotation.x = -2.5 + Math.sin(t * 25) * 0.4; r.armR.rotation.x = -2.5 + Math.cos(t * 23) * 0.4; r.head.rotation.y = Math.sin(t * 17) * 0.6; if (this.burnL) this.burnL.intensity = 8 + Math.random() * 4; }
    r.g.position.z = this.rz; setPos(this.pan, 0, 1.6, this.rz); this.rim.position.set(0.4, 1.8, this.rz + 1.6);
    look.roll += (Math.sin(t * 0.8) * 0.01 - look.roll) * dt * 3;
  },
  exit() { document.body.classList.remove('alone'); document.body.classList.remove('bare'); this.hurt = false; this.lineT = 2; while (this.fires.length > this.baseFires) { const f = this.fires.pop(); f.ps.forEach((p) => (p.s.visible = false)); f.on = false; } camera.remove(this.flame); camera.remove(this.lighterBody); camera.remove(this.handL); if (this.burnL) this.scene.remove(this.burnL); this.burn?.forEach((f) => { f.on = false; f.ps.forEach((p) => (p.s.visible = false)); }); this.burn = null; },
};

// ======================================================= BUS
SC.bus = {
  build() {
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x2a1430); s.fog = new THREE.Fog(0x7a3440, 14, 150);
    const wall = lam({ map: tex('busWall') }), dark = lam({ color: 0x1a1c20 }), fab = lam({ map: tex('fabric') });
    box(s, 2.7, 0.1, 12, lam({ color: 0x202226 }), 0, -0.05, 0); box(s, 2.7, 0.08, 12, wall, 0, 2.4, 0);
    for (const sx of [-1, 1]) {
      const x = sx * 1.32; box(s, 0.06, 0.95, 12, wall, x, 0.475, 0); box(s, 0.06, 0.65, 12, wall, x, 2.075, 0);
      for (let z = -6; z <= 6; z += 1.2) box(s, 0.08, 0.8, 0.08, dark, x, 1.35, z);
      plane(s, 12, 0.8, new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.07, depthWrite: false }), x * 0.995, 1.35, 0, 0, -sx * PI / 2);
    }
    box(s, 2.7, 2.4, 0.08, wall, 0, 1.2, -6); box(s, 2.7, 2.4, 0.08, wall, 0, 1.2, 6);
    for (let z = -4.8; z <= 5; z += 1.05) for (const cx of [-0.7, 0.7]) { box(s, 1.0, 0.12, 0.45, fab, cx, 0.46, z); box(s, 1.0, 0.62, 0.1, fab, cx, 0.82, z + 0.24); box(s, 1.0, 0.06, 0.12, dark, cx, 1.14, z + 0.24); }
    box(s, 0.04, 0.04, 11, lam({ color: 0x9a9a9a }), 0.45, 2.0, 0); box(s, 0.04, 0.04, 11, lam({ color: 0x9a9a9a }), -0.45, 2.0, 0);
    this.tubes = []; this.lights = [];
    for (const z of [-3.5, 0.5, 4]) { this.tubes.push(box(s, 0.18, 0.04, 1.5, basic(0x5a4a40), 0, 2.35, z)); const l = new THREE.PointLight(0xffb880, 1.1, 7, 1.3); l.position.set(0, 2.1, z); s.add(l); this.lights.push(l); }
    s.add(new THREE.AmbientLight(0x6a4048, 1.5));
    // sunset: sky, sun, haze, hills. They ride west into it.
    const skyT = ctex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); [[0, '#140e30'], [0.28, '#43205c'], [0.4, '#b0406a'], [0.46, '#ff7e3a'], [0.495, '#ffd58a'], [0.51, '#5a2420'], [1, '#120808']].forEach(([a, c]) => gr.addColorStop(a, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 1, 1);
    skyT.magFilter = THREE.LinearFilter; skyT.minFilter = THREE.LinearFilter;
    s.add(new THREE.Mesh(new THREE.SphereGeometry(85, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })));
    const sunP = new THREE.Vector3(70, 4.6, -33);
    for (const [r, c, op] of [[15, 0xff7a30, 0.2], [9, 0xffa050, 0.32], [4.6, 0xffe6a8, 1]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, fog: false, depthWrite: false, blending: op < 1 ? THREE.AdditiveBlending : THREE.NormalBlending })); m.position.copy(sunP); m.lookAt(0, 1.4, 0); s.add(m); }
    const hillM = new THREE.MeshBasicMaterial({ color: 0x24102a, fog: false });
    for (let i = 0; i < 9; i++) { const hgt = 5 + ((i * 37) % 9); const hm = new THREE.Mesh(new THREE.BoxGeometry(12, hgt * 0.45, 20 + (i % 3) * 7), hillM); hm.position.set(58 + (i % 2) * 6, hgt * 0.225 - 0.6, -90 + i * 22); s.add(hm); }
    plane(s, 120, 180, lam({ color: 0x6a3a22 }), 61.5, -0.62, 0, -PI / 2);
    const sunL = new THREE.DirectionalLight(0xff8e4a, 2.6); sunL.position.set(10, 2.4, -4.5); s.add(sunL);
    const rim = new THREE.PointLight(0xff8a4a, 3.2, 4.5, 1.3); rim.position.set(1.05, 1.5, -0.2); s.add(rim);
    // ryan asleep in aisle seat
    this.ryan = human({ shirt: 0x2f4a6a, pants: 0x1c1c22, hair: 0x6a4524, skin: 0xd0a58a }); sit(this.ryan); this.ryan.g.position.set(-0.34, 0.0, -0.28); this.ryan.g.rotation.y = PI; s.add(this.ryan.g);
    this.ryan.head.rotation.set(0.05, 1.05, -0.25); this.ryan.torso.rotation.set(0.1, 0, -0.2); this.ryan.armL.rotation.set(-0.9, 0, 0.1); this.ryan.armR.rotation.set(-1.0, 0, -0.1);
    const white = basic(0xeeeeea, true);
    box(this.ryan.head, 0.03, 0.035, 0.03, white, 0.125, 0.17, 0.02);
    const wire = lam({ color: 0xdedad2 });
    box(s, 0.012, 0.5, 0.012, wire, -0.66, 1.0, 0.26).rotation.z = 0.5; box(s, 0.012, 0.3, 0.012, wire, -0.9, 1.2, 0.2).rotation.z = -0.3;
    box(s, 0.08, 0.015, 0.15, lam({ color: 0x111111 }), -0.55, 0.66, 0.34); this.phoneGlow = box(s, 0.07, 0.016, 0.13, basic(0x7a9cff, true), -0.55, 0.668, 0.34);
    const pg = new THREE.PointLight(0x8aa8ff, 0.8, 1.2, 1.5); pg.position.set(-0.55, 0.8, 0.34); s.add(pg);
    // outside world
    const o = this.out = new THREE.Group(); s.add(o);
    plane(o, 80, 200, texMat('asphalt', 40, 100), -20, -0.6, -60, -PI / 2);
    box(o, 10, 0.5, 8, lam({ color: 0xd8d8d0 }), -10, 4.2, 1.5); box(o, 9.6, 0.05, 7.6, basic(0xf0f4ff, true), -10, 3.93, 1.5);
    for (const x of [-7.5, -12.5]) box(o, 0.4, 4, 0.4, lam({ color: 0xb02020 }), x, 2, 1.5);
    for (const x of [-8.5, -11.5]) { box(o, 0.6, 1.6, 0.4, lam({ color: 0xc8c8c0 }), x, 0.2, 1.5); box(o, 0.3, 0.2, 0.05, basic(0x40ff80, true), x, 0.7, 1.72); }
    const cl = new THREE.PointLight(0xeef2ff, 14, 22, 1.1); cl.position.set(-10, 3.2, 1.5); o.add(cl);
    box(o, 6, 3, 4, lam({ color: 0x30302c }), -12, 0.9, -6); box(o, 2.4, 1.2, 0.05, basic(0xfff0c0, true), -11, 1.0, -3.97);
    this.poles = [];
    for (let i = 0; i < 8; i++) { const p = new THREE.Group(); box(p, 0.12, 4.5, 0.12, lam({ color: 0x3a3a3a }), 0, 1.65, 0); box(p, 0.35, 0.08, 0.2, basic(0xffc070, true), 0.4, 3.85, 0); p.position.set(-3.2, 0, -14 - i * 14); o.add(p); this.poles.push(p); }
    this.passL = new THREE.PointLight(0xffb060, 0, 9, 1.2); s.add(this.passL);
    this.ent = entity({ tilt: 0.3 }); this.ent.g.rotation.y = PI / 2; o.add(this.ent.g);
    box(o, 0.12, 4.2, 0.12, lam({ color: 0x3a3a3a }), -3.4, 1.5, 2.2); box(o, 0.4, 0.08, 0.22, basic(0xffc070, true), -3.1, 3.6, 2.2);
    const stopL = new THREE.PointLight(0xffa850, 9, 9, 1.1); stopL.position.set(-3.1, 3.3, 2.0); o.add(stopL);
    box(o, 1.6, 0.06, 0.5, lam({ color: 0x5a5a5a }), -3.6, -0.1, 0.4);
  },
  enter(o, ep) {
    if (!this.scene) this.build(); cursor(false); this.scene.add(camera); this.wantLock = true;
    camera.position.set(-0.98, 1.36, 0.22); setLook(-0.7, -0.12, 1.2, 0.35); this.ryanHead = new THREE.Vector3(); this.ryan.g.updateMatrixWorld(true); this.ryan.head.getWorldPosition(this.ryanHead); this.ryanHead.y += 0.15;
    this.ryan.g.visible = TOGETHER;
    this.out.position.set(0, 0, 0); this.ent.g.position.set(-2.0, -0.6, -1.25); this.ent.head.rotation.set(0, 0, 0.3);
    Object.assign(this, { gaze: 0, knockT: 0, state: 'wait', speed: 0, dead: false, moves: 0, armed: false, sawIt: false });
    this.eng = loopNoise({ buf: 'brown', f: 120, v: 0.12 }); this.engO = osc({ f: 36, v: 0.05 }); this.song = hasTrack(); this.mus = null; this.ryan.g.position.x = 0.32; this.ryan.armR.rotation.set(0, 0, 0); this.offer = false;
    this.pan = panner(-1.9, 1.5, -1.25);
    this.run(ep);
  },
  async run(ep) {
    await fadeIn(2.5); if (!alive(ep)) return;
    await wait(4200); if (!alive(ep)) return;
    // he holds out one earbud
    this.ryan.armR.rotation.set(-1.2, 0, -0.9); this.offer = true; controls([{ keys: ['KeyE'], verb: 'Take it' }]); setTouch([['KeyE', 'TAKE IT']]);
    for (let i = 0; i < 160 && this.offer; i++) { await wait(50); if (!alive(ep)) return; }
    this.offer = false; controls([]); setTouch([]); sfx.click();
    this.mus = trackMusic(0.9, true) || music(0.3); keepTrack(true); if (!this.song) this.mus.f.frequency.value = 2600;
    await wait(900); if (!alive(ep)) return; this.ryan.armR.rotation.set(0, 0, 0); tween(this.ryan.g.position, 'x', -0.34, 1.4);
    await wait(5200); if (!alive(ep)) return;
    this.state = 'go'; this.depart(ep);
  },
  onKey(c) { if (c === 'KeyE' && this.offer) this.offer = false; },
  update(dt, t) {
    const r = this.ryan; r.torso.scale.y = 1 + Math.sin(t * 1.4) * 0.01;
    this.lights.forEach((l, i) => { l.intensity = 1.1; });
    if (this.state === 'go') {
      this.speed = Math.min(14, this.speed + dt * 1.6); this.out.position.z += this.speed * dt;
      for (const p of this.poles) { const wz = p.position.z + this.out.position.z; if (wz > 20) p.position.z -= 112; }
      let near = null, nd = 99; for (const p of this.poles) { const wz = p.position.z + this.out.position.z; if (Math.abs(wz) < nd) { nd = Math.abs(wz); near = wz; } }
      this.passL.position.set(-3, 3.5, near ?? 0); this.passL.intensity = nd < 8 ? 6 : 0;
      if (this.eng.fl.frequency) this.eng.fl.frequency.value = 340 + this.speed * 12;
      camera.position.y = 1.36 + Math.sin(t * 9) * 0.004 * this.speed;
    }
    setPos(this.pan, -1.9, 1.5, this.out.position.z - 1.25);
  },
  async depart(ep) {
    sfx.hiss(); await wait(2600); if (!alive(ep)) return;
    look.ty = 0.55; await wait(2200); if (!alive(ep)) return;
    await say('Ryan: What?', 1300); if (!alive(ep)) return;
    look.ty = -0.7; await wait(900); if (!alive(ep)) return;
    await say('Naim: Nothing.', 1500); if (!alive(ep)) return;
    await wait(9000); if (!alive(ep)) return;
    await fadeOut(3.0); if (!alive(ep)) return; go(SC.credits);
  },
};

// ======================================================= CREDITS
let cIdx = 0;
const cItems = () => [...document.querySelectorAll('#cmenu .mi')];
function cSel(i) { const it = cItems(); cIdx = (i + it.length) % it.length; it.forEach((b, k) => b.classList.toggle('sel', k === cIdx)); }
document.querySelectorAll('#cmenu .mi').forEach((b) => b.addEventListener('mouseenter', () => cSel(cItems().indexOf(b))));
SC.credits = {
  onKey(c) { if (c === 'ArrowDown' || c === 'KeyS') cSel(cIdx + 1); else if (c === 'ArrowUp' || c === 'KeyW') cSel(cIdx - 1); else if (c === 'Enter' || c === 'Space') cItems()[cIdx].click(); },
  scene: voidScene,
  enter() {
    cursor(true); unlock(); P.fade.value = 0;
    $('endName').textContent = ENDING ? `THE END \u00b7 ENDING: ${ENDING}` : 'THE END'; $('credits').classList.add('show'); cSel(0);
    let found = []; try { found = JSON.parse(localStorage.getItem('owa_endings') || '[]'); if (ENDING && !found.includes(ENDING)) { found.push(ENDING); localStorage.setItem('owa_endings', JSON.stringify(found)); } } catch (e) { if (ENDING) found = [ENDING]; }
    const rows = RUN.log.slice(-7).map((l) => `<div>${l}</div>`).join('');
    $('night').innerHTML = RUN.log.length ? `<div class="nk">YOUR NIGHT</div>${rows}<div class="nf">ENDINGS FOUND ${found.length} / 4${found.length < 4 ? '<br>The night goes differently if you choose differently.' : ''}</div>` : ''; $('night').classList.toggle('show', RUN.log.length > 0);
    const m = trackMusic(0.9) || music(0.3); if (!hasTrack()) m.f.frequency.value = 2600; keepTrack(false);
  },
  exit() { $('credits').classList.remove('show'); },
};

// ---------------- boot ----------------
$('again').onclick = () => { ENDING = ''; go(SC.title); };
$('replay').onclick = () => { ENDING = ''; startAt(SC.opening); };
$('resume').onclick = () => resume();
$('restart').onclick = () => { const sc = cur; resume(); go(sc, { retry: true }); };
$('quit').onclick = () => { resume(); unlock(); go(SC.title); };
$('pvol').onclick = () => { MENU.vol = MENU.vol >= 1.2 ? 0 : Math.round((MENU.vol + 0.12) * 100) / 100; setVolume(MENU.vol); pauseBars(); };
$('pfx').onclick = () => { MENU.fx = !MENU.fx; document.body.classList.toggle('nofx', !MENU.fx); P.grain.value = MENU.fx ? 0.07 : 0.02; if (!MENU.fx) P.warp.value = 0; pauseBars(); if ($('fxVal')) $('fxVal').textContent = MENU.fx ? 'On' : 'Off'; };
if (window.__SONG) setTrack(window.__SONG); else $('songCredit').remove();
go(SC.title);

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) {
    T += dt; updateTimers(); updateTweens(dt); updatePhone(T);
    updateControls(); updateAlone(dt);
    if (ATK.on) updateAtk(dt);
    else { if (look.on) updateLook(dt); cur?.update?.(dt, T); }
  }
  input.moved = 0; input.dx = input.dy = 0;
  P.time.value = T; listen(camera);
  renderFrame(cur?.scene || voidScene, phone);
}
frame();
window.__game = { get cur() { return cur; }, get ep() { return epoch; }, showLesson, get FILM() { return FILM; }, get HP() { return HP; }, set HP(v) { HP = v; }, attack, SC, go, P, camera, look, phone, input, pause, resume, hasTrack };
