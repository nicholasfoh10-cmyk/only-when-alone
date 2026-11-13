import * as THREE from 'three';

export const A = { ctx: null };
const keepers = [];
export function keep(fn) { keepers.push(fn); return fn; }
export function stopAll() { keepers.splice(0).forEach((f) => { try { f(); } catch (e) { } }); }

A.init = function () {
  if (this.ctx) { this.ctx.resume(); return; }
  const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 6;
  this.master = c.createGain(); this.master.gain.value = this.vol ?? 0.9; this.comp.connect(this.master); this.master.connect(c.destination);
  this.out = c.createGain(); this.out.gain.value = 1; this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.out.connect(this.lp); this.lp.connect(this.comp);
  const ir = c.createBuffer(2, c.sampleRate * 2.6, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  this.verb = c.createConvolver(); this.verb.buffer = ir; this.send = c.createGain(); this.send.gain.value = 0.32;
  this.lp.connect(this.send); this.send.connect(this.verb); this.verb.connect(this.comp);
  const len = c.sampleRate * 3;
  this.white = c.createBuffer(1, len, c.sampleRate); const w = this.white.getChannelData(0); for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
  this.brown = c.createBuffer(1, len, c.sampleRate); const b = this.brown.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  const n = 2048, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; cv[i] = Math.tanh(x * 6); }
  this.curve = cv;
};
const now = () => A.ctx.currentTime;
const ok = () => !!A.ctx;
function gainNode(v, dest) { const g = A.ctx.createGain(); g.gain.value = v; if (dest !== null) g.connect(dest || A.out); return g; }
function filt(type, f, q = 1) { const x = A.ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
function noiseSrc(buf, loop) { const s = A.ctx.createBufferSource(); s.buffer = A[buf]; s.loop = loop; return s; }

export function panner(x, y, z, roll = 1.3) {
  if (!ok()) return null;
  const p = A.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = roll; p.maxDistance = 60;
  setPos(p, x, y, z); p.connect(A.out); return p;
}
export function setPos(p, x, y, z) { if (!p) return; if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
const lv = new THREE.Vector3(), lf = new THREE.Vector3(), lu = new THREE.Vector3(), lq = new THREE.Quaternion();
export function listen(cam) {
  if (!ok()) return; const l = A.ctx.listener;
  cam.getWorldPosition(lv); cam.getWorldQuaternion(lq); lf.set(0, 0, -1).applyQuaternion(lq); lu.set(0, 1, 0).applyQuaternion(lq);
  if (l.positionX) { l.positionX.value = lv.x; l.positionY.value = lv.y; l.positionZ.value = lv.z; l.forwardX.value = lf.x; l.forwardY.value = lf.y; l.forwardZ.value = lf.z; l.upX.value = lu.x; l.upY.value = lu.y; l.upZ.value = lu.z; }
  else { l.setPosition(lv.x, lv.y, lv.z); l.setOrientation(lf.x, lf.y, lf.z, lu.x, lu.y, lu.z); }
}

// ---------- one-shots ----------
export function burst({ buf = 'white', type = 'lowpass', f = 800, q = 1, v = 0.5, a = 0.005, d = 0.2, dest, at = 0, fEnd } = {}) {
  if (!ok()) return; const t = now() + at;
  const s = noiseSrc(buf, false); const fl = filt(type, f, q); const g = gainNode(0, dest);
  if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + a + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  s.connect(fl); fl.connect(g); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.1);
}
export function tone({ type = 'sine', f = 440, fEnd, v = 0.3, a = 0.005, d = 0.3, dest, at = 0, dist = false, lp } = {}) {
  if (!ok()) return; const t = now() + at;
  const o = A.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + a + d);
  const g = gainNode(0, dest); let node = o;
  if (dist) { const ws = A.ctx.createWaveShaper(); ws.curve = A.curve; node.connect(ws); node = ws; }
  if (lp) { const fl = filt('lowpass', lp); node.connect(fl); node = fl; }
  node.connect(g);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  o.start(t); o.stop(t + a + d + 0.1);
}
export const sfx = {
  knock(dest) { for (let i = 0; i < 3; i++) { burst({ buf: 'brown', f: 300, v: 1.4, d: 0.1, at: i * 0.3, dest }); tone({ f: 95, fEnd: 50, v: 0.8, d: 0.12, at: i * 0.3, dest }); } },
  step(dest, v = 0.6) { burst({ buf: 'brown', f: 420, v, d: 0.13, dest }); tone({ f: 70, fEnd: 40, v: v * 0.6, d: 0.1, dest }); },
  drip(dest) { tone({ f: rand(1300, 1800), fEnd: 600, v: 0.12, d: 0.07, dest }); },
  shutter() { burst({ type: 'highpass', f: 2500, v: 0.7, d: 0.04 }); burst({ type: 'highpass', f: 1800, v: 0.5, d: 0.06, at: 0.07 }); },
  beep(f = 880) { tone({ type: 'square', f, v: 0.09, d: 0.12, lp: 3000 }); },
  click() { burst({ type: 'highpass', f: 3000, v: 0.35, d: 0.025 }); },
  sting(v = 1) {
    burst({ type: 'highpass', f: 400, v: 0.9 * v, d: 1.6 });
    tone({ type: 'sawtooth', f: 1100, fEnd: 55, v: 0.55 * v, d: 1.5, dist: true });
    tone({ type: 'square', f: 46, v: 0.5 * v, d: 1.8, lp: 300 });
    tone({ type: 'sawtooth', f: 1480, fEnd: 1320, v: 0.25 * v, d: 1.2, dist: true });
  },
  scream(pitch = 1, v = 1, dur = 1.4) {
    if (!ok()) return; const t = now();
    const g = gainNode(0); const bp = filt('bandpass', 1500 * pitch, 0.8); const ws = A.ctx.createWaveShaper(); ws.curve = A.curve;
    ws.connect(bp); bp.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.04); g.gain.setValueAtTime(0.9 * v, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (let i = 0; i < 5; i++) {
      const o = A.ctx.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'square';
      const base = (360 + i * 110) * pitch; o.frequency.setValueAtTime(base * 0.8, t); o.frequency.exponentialRampToValueAtTime(base * 1.25, t + dur * 0.4); o.frequency.exponentialRampToValueAtTime(base * 0.6, t + dur);
      const lfo = A.ctx.createOscillator(); lfo.frequency.value = 7 + i * 1.7; const lg = A.ctx.createGain(); lg.gain.value = base * 0.06; lfo.connect(lg); lg.connect(o.frequency);
      const og = A.ctx.createGain(); og.gain.value = 0.25; o.connect(og); og.connect(ws);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    }
    burst({ type: 'bandpass', f: 2600 * pitch, q: 0.7, v: 0.9 * v, a: 0.03, d: dur });
  },
  lighter() { burst({ type: 'highpass', f: 3500, v: 0.6, d: 0.03 }); burst({ type: 'highpass', f: 3000, v: 0.5, d: 0.04, at: 0.14 }); burst({ type: 'bandpass', f: 400, fEnd: 2400, q: 0.6, v: 0.9, a: 0.08, d: 0.7, at: 0.2 }); },
  slam() { burst({ buf: 'brown', f: 260, v: 1.6, d: 0.6 }); tone({ f: 55, fEnd: 30, v: 1, d: 0.5 }); burst({ type: 'highpass', f: 1500, v: 0.3, d: 0.3 }); },
  creak(dest) { tone({ type: 'sawtooth', f: 95, fEnd: 165, v: 0.35, a: 0.3, d: 1.6, lp: 900, dest }); tone({ type: 'sawtooth', f: 190, fEnd: 120, v: 0.2, a: 0.2, d: 1.4, lp: 1400, dest, at: 0.3 }); },
  glass(dest) { tone({ f: 80, fEnd: 45, v: 1.1, d: 0.25, dest }); burst({ buf: 'brown', f: 600, v: 1.4, d: 0.2, dest }); burst({ type: 'highpass', f: 2200, v: 0.3, d: 0.25, dest }); },
  buzz() { tone({ type: 'square', f: 155, v: 0.1, d: 0.32, lp: 400 }); tone({ type: 'square', f: 155, v: 0.1, d: 0.32, lp: 400, at: 0.45 }); },
  hiss() { burst({ type: 'highpass', f: 2600, v: 0.35, a: 0.05, d: 1.1 }); },
  whoosh() { burst({ buf: 'brown', type: 'lowpass', f: 200, fEnd: 2000, v: 1.2, a: 0.1, d: 0.6 }); },
  gasp() { burst({ type: 'bandpass', f: 1100, q: 2, v: 1.6, a: 0.05, d: 0.35 }); },
};
function rand(a, b) { return a + Math.random() * (b - a); }

export function whisper(text, dest, v = 2.2) {
  let t = 0;
  for (const w of text.split(/\s+/)) {
    const syl = Math.max(1, Math.round(w.replace(/[^a-z]/gi, '').length / 2.7));
    for (let i = 0; i < syl; i++) {
      const f = rand(500, 2100);
      burst({ type: 'bandpass', f, q: 4, v, a: 0.03, d: 0.15, dest, at: t });
      burst({ type: 'bandpass', f: f * 2.2, q: 7, v: v * 0.6, a: 0.03, d: 0.12, dest, at: t });
      t += rand(0.16, 0.22);
    }
    t += 0.12;
  }
  return t;
}

// ---------- loops (auto-stopped on scene change) ----------
export function loopNoise({ buf = 'white', type = 'lowpass', f = 1000, q = 1, v = 0.1, dest } = {}) {
  if (!ok()) return { g: { gain: { value: 0, setTargetAtTime() { } } }, fl: { frequency: { value: 0, setTargetAtTime() { } } } };
  const s = noiseSrc(buf, true); const fl = filt(type, f, q); const g = gainNode(v, dest);
  s.connect(fl); fl.connect(g); s.start(0, Math.random() * 2);
  keep(() => { g.gain.setTargetAtTime(0, now(), 0.05); s.stop(now() + 0.4); });
  return { s, fl, g };
}
export function osc({ type = 'sine', f = 100, v = 0.1, dest, lp } = {}) {
  if (!ok()) return { o: { frequency: { value: 0, setTargetAtTime() { } } }, g: { gain: { value: 0, setTargetAtTime() { } } } };
  const o = A.ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = gainNode(v, dest);
  if (lp) { const fl = filt('lowpass', lp); o.connect(fl); fl.connect(g); } else o.connect(g);
  o.start(); keep(() => { g.gain.setTargetAtTime(0, now(), 0.05); o.stop(now() + 0.4); });
  return { o, g };
}
export function every(ms, fn) { const id = setInterval(() => { if (A.ctx && A.ctx.state === 'running') fn(); }, ms); keep(() => clearInterval(id)); return id; }
export function drone(f = 55, v = 0.08) {
  if (!ok()) return null; const g = gainNode(v); const fl = filt('lowpass', 260, 3); fl.connect(g);
  for (const d of [-9, 0, 7]) { const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(fl); o.start(); keep(() => o.stop(now() + 0.3)); }
  const lfo = A.ctx.createOscillator(); lfo.frequency.value = 0.08; const lg = A.ctx.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
  keep(() => { g.gain.setTargetAtTime(0, now(), 0.1); lfo.stop(now() + 0.4); });
  return g;
}
export function hum(v = 0.05) {
  if (!ok()) return null; const g = gainNode(v);
  const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120; const fl = filt('lowpass', 520, 2); o.connect(fl); fl.connect(g); o.start();
  const o2 = A.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 60; const g2 = A.ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(fl); o2.start();
  const s = noiseSrc('white', true); const bp = filt('bandpass', 4200, 3); const g3 = A.ctx.createGain(); g3.gain.value = 0.25; s.connect(bp); bp.connect(g3); g3.connect(g); s.start();
  keep(() => { g.gain.setTargetAtTime(0, now(), 0.03); o.stop(now() + 0.3); o2.stop(now() + 0.3); s.stop(now() + 0.3); });
  return g;
}
export function breathing(dest, period = 3.4, v = 0.9) {
  const go = () => { burst({ type: 'bandpass', f: 750, q: 1.5, v, a: 1.0, d: 0.7, dest }); burst({ type: 'bandpass', f: 520, q: 1.2, v: v * 1.1, a: 0.25, d: 1.1, dest, at: period * 0.48 }); };
  go(); return every(period * 1000, go);
}
export function heartbeat(bpm = 70, v = 0.8) {
  const go = () => { tone({ f: 62, fEnd: 38, v, d: 0.16, lp: 200 }); tone({ f: 55, fEnd: 35, v: v * 0.7, d: 0.14, lp: 200, at: 0.24 }); };
  go(); return every(60000 / bpm, go);
}
export function fireLoop(v = 0.4) {
  loopNoise({ buf: 'brown', f: 500, v: v * 0.8 });
  loopNoise({ buf: 'white', type: 'bandpass', f: 900, q: 0.5, v: v * 0.12 });
  every(45, () => { if (Math.random() < 0.55) burst({ type: 'highpass', f: rand(1500, 5000), v: rand(0.05, 0.45) * v * 2, d: rand(0.01, 0.04) }); });
}
export function ritualAudio() {
  drone(49, 0.1); drone(73.5, 0.05);
  loopNoise({ buf: 'brown', f: 180, v: 0.35 });
  const vowel = () => {
    if (!ok()) return; const t = now(); const base = [98, 110, 82.4, 123.5][Math.floor(Math.random() * 4)];
    const g = gainNode(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    for (const fm of [700, 1150, 2500]) { const bp = filt('bandpass', fm * rand(0.9, 1.1), 7); bp.connect(g);
      for (const d of [-12, 0, 10]) { const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base; o.detune.value = d + rand(-6, 6); o.connect(bp); o.start(t); o.stop(t + 1.9); } }
  };
  vowel(); every(1700, vowel);
  every(2300, () => { if (Math.random() < 0.4) whisper('in the name', null, 1.4); });
  heartbeat(58, 0.6);
}

export function setVolume(v) { A.vol = v; if (A.master) A.master.gain.value = v; }
export function setReverb(v) { if (A.send) A.send.gain.value = v; }
export function dryer(v = 0.7) {
  const n = loopNoise({ buf: 'white', type: 'bandpass', f: 900, q: 0.6, v });
  const m = osc({ type: 'sawtooth', f: 112, v: v * 0.25, lp: 500 });
  return () => { n.g.gain.setTargetAtTime(0, now(), 0.3); m.g.gain.setTargetAtTime(0, now(), 0.3); };
}

// soft original "earbud" music: warm electric-piano chords, muffled
export function music(v = 0.22) {
  if (!ok()) return { g: { gain: { value: 0, setTargetAtTime() { } } }, f: { frequency: { value: 0, setTargetAtTime() { } } } };
  const c = A.ctx; const g = gainNode(v); const f = filt('lowpass', 900, 0.7); f.connect(g);
  const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let i = 0;
  const play = () => {
    const t = now(); const ch = chords[i % 4]; i++;
    ch.forEach((m, k) => {
      for (const [type, mul, lv] of [['triangle', 1, 0.16], ['sine', 2, 0.05]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = hz(m) * mul; o.detune.value = Math.random() * 8 - 4;
        const e = c.createGain(); e.gain.setValueAtTime(0, t + k * 0.04); e.gain.linearRampToValueAtTime(lv, t + k * 0.04 + 0.03); e.gain.exponentialRampToValueAtTime(lv * 0.25, t + 1.2); e.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
        o.connect(e); e.connect(f); o.start(t); o.stop(t + 3);
      }
    });
    const bass = c.createOscillator(); bass.type = 'sine'; bass.frequency.value = hz(ch[0] - 12); const bg = c.createGain();
    bg.gain.setValueAtTime(0.22, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 2.8); bass.connect(bg); bg.connect(f); bass.start(t); bass.stop(t + 3);
    [0.75, 1.5, 2.25].forEach((d, k) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz(ch[(k + 1) % 4] + 12); const e = c.createGain(); e.gain.setValueAtTime(0, t + d); e.gain.linearRampToValueAtTime(0.05, t + d + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.7); o.connect(e); e.connect(f); o.start(t + d); o.stop(t + d + 0.8); });
    burst({ type: 'highpass', f: 6000, v: 0.04, d: 0.05, dest: f, at: 0.75 }); burst({ type: 'highpass', f: 6000, v: 0.04, d: 0.05, dest: f, at: 2.25 });
  };
  play(); every(3000, play);
  return { g, f };
}

// built-in / player-supplied song, decoded into the Web Audio graph (no <audio> element, so no autoplay blocks)
const track = { url: null, buf: null, decoding: null, node: null, gain: null, keep: false, startAt: 0 };
window.__track = track;
export function setTrack(file) {
  track.url = typeof file === 'string' ? file : URL.createObjectURL(file); track.buf = null; track.decoding = null;
  if (A.ctx) decodeTrack();
}
export const hasTrack = () => !!track.url;
function decodeTrack() {
  if (track.buf || track.decoding || !track.url || !A.ctx) return track.decoding;
  track.decoding = (async () => {
    let ab;
    if (track.url.startsWith('data:')) { const b64 = track.url.slice(track.url.indexOf(',') + 1); const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ab = u.buffer; }
    else ab = await (await fetch(track.url)).arrayBuffer();
    track.buf = await new Promise((res, rej) => { const p = A.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    track.err = null; return track.buf;
  })().catch((e) => { track.err = String(e); track.decoding = null; });
  return track.decoding;
}
function playing() { return track.node && !track.ended; }
export function trackMusic(v = 0.6, restart = false) {
  if (!ok() || !track.url) return null;
  if (!track.gain) { track.gain = A.ctx.createGain(); track.gain.connect(A.comp); }
  const dummyF = { frequency: { value: 20000, setTargetAtTime() { } } };
  const start = () => {
    if (track.node) { try { track.node.stop(); } catch (e) { } }
    const n = A.ctx.createBufferSource(); n.buffer = track.buf; n.connect(track.gain);
    track.ended = false; n.onended = () => { if (track.node === n) track.ended = true; };
    n.start(); track.node = n; track.startAt = now();
  };
  track.gain.gain.cancelScheduledValues(now()); track.gain.gain.setValueAtTime(v, now());
  if (restart || !playing()) {
    if (track.buf) start(); else (decodeTrack() || Promise.resolve()).then(() => { if (track.buf && track.want) start(); });
  }
  track.want = true;
  keep(() => { if (track.keep) return; track.want = false; track.gain.gain.setTargetAtTime(0, now(), 0.4); const n = track.node; setTimeout(() => { if (!track.keep && track.node === n) { try { n.stop(); } catch (e) { } track.node = null; } }, 1600); });
  return { g: track.gain, f: dummyF };
}
export function keepTrack(on) { track.keep = on; }
// call inside a click: make sure the context is running and the song is decoded before it is needed
export function primeTrack() { if (!ok() || !track.url) return; try { A.ctx.resume(); } catch (e) { } decodeTrack(); }

// ================= SOUND DESIGN LAYER =================
// master tone: muffle the whole world (suffocation, shock)
export function muffle(freq = 20000, time = 0.15) { if (A.lp) A.lp.frequency.setTargetAtTime(freq, now(), time); }
// the entity's signature: a Zippo lid. You hear it before you see it.
export function zippo(dest, v = 1) {
  tone({ type: 'triangle', f: 3400, fEnd: 2500, v: 0.5 * v, a: 0.001, d: 0.09, dest }); tone({ type: 'square', f: 5200, v: 0.12 * v, a: 0.001, d: 0.03, dest });
  burst({ type: 'highpass', f: 4200, v: 0.5 * v, a: 0.001, d: 0.025, dest }); tone({ type: 'triangle', f: 2100, v: 0.2 * v, a: 0.001, d: 0.22, dest, at: 0.012 });
}
export function zippoOpen(dest, v = 1) { tone({ type: 'triangle', f: 2300, fEnd: 3600, v: 0.35 * v, a: 0.001, d: 0.07, dest }); burst({ type: 'highpass', f: 3500, v: 0.4 * v, d: 0.03, dest, at: 0.16 }); burst({ type: 'bandpass', f: 500, fEnd: 2200, q: 0.7, v: 0.7 * v, a: 0.06, d: 0.5, dest, at: 0.2 }); }
// footsteps that change with the surface
export function foot(surface = 'tile', v = 1, dest) {
  if (surface === 'grass') { burst({ type: 'highpass', f: rand(1800, 2600), v: 0.22 * v, a: 0.02, d: 0.16, dest }); burst({ buf: 'brown', f: 300, v: 0.5 * v, d: 0.1, dest }); }
  else if (surface === 'wood') { tone({ f: rand(85, 110), fEnd: 50, v: 0.7 * v, d: 0.12, dest }); burst({ buf: 'brown', f: 700, v: 0.7 * v, d: 0.08, dest }); if (Math.random() < 0.2) tone({ type: 'sawtooth', f: rand(140, 220), fEnd: 260, v: 0.08 * v, a: 0.05, d: 0.25, lp: 900, dest }); }
  else { burst({ type: 'bandpass', f: rand(1100, 1500), q: 2, v: 0.6 * v, a: 0.001, d: 0.05, dest }); tone({ f: 120, fEnd: 70, v: 0.35 * v, d: 0.07, dest }); }
}
// fear emitter: a sub rumble you feel and a thin high tone, mixed live by how close the danger is
const fearN = {};
export function fear(k) {
  if (!ok()) return;
  if (!fearN.g) {
    const c = A.ctx; fearN.g = c.createGain(); fearN.g.gain.value = 0; fearN.g.connect(A.comp);
    for (const f of [38, 41.5]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(fearN.g); o.start(); }
    fearN.h = c.createGain(); fearN.h.gain.value = 0; fearN.h.connect(A.comp);
    for (const f of [3120, 3187, 6230]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.value = f > 5000 ? 0.3 : 1; o.connect(g); g.connect(fearN.h); o.start(); }
  }
  fearN.g.gain.setTargetAtTime(k * 0.5, now(), 0.4); fearN.h.gain.setTargetAtTime(k * k * 0.012, now(), 0.6);
}
// layered ambience: base bed + detail + rare events. Stopped automatically on scene change.
function windBed(v, f = 420) { const n = loopNoise({ buf: 'brown', type: 'bandpass', f, q: 0.5, v }); let ph = Math.random() * 9; every(400, () => { ph += 0.11; n.fl.frequency.setTargetAtTime(f * (0.7 + 0.5 * Math.sin(ph) + 0.25 * Math.sin(ph * 2.7)), now(), 0.6); n.g.gain.setTargetAtTime(v * (0.55 + 0.45 * Math.sin(ph * 0.6 + 1)), now(), 0.8); }); }
function rare(minS, maxS, fn) { const go = () => { const id = setTimeout(() => { if (A.ctx.state === 'running') fn(); go(); }, (minS + Math.random() * (maxS - minS)) * 1000); keep(() => clearTimeout(id)); }; go(); }
export function ambience(kind) {
  if (!ok()) return;
  const far = () => panner(rand(-25, 25), rand(0, 4), rand(-25, 25), 0.35);
  if (kind === 'field') {
    setReverb(0.06); windBed(0.5); loopNoise({ buf: 'white', type: 'highpass', f: 5000, v: 0.012 });
    osc({ type: 'sawtooth', f: 49, v: 0.035, lp: 140 });   // the flare stack / plant on the horizon
    every(170, () => { if (Math.random() < 0.5) tone({ type: 'sine', f: 4300 + Math.random() * 300, v: 0.012, a: 0.005, d: 0.04, dest: panner(8, 0, -6, 0.3) }); });   // crickets, one side
    rare(7, 16, () => burst({ type: 'bandpass', f: rand(900, 1600), q: 3, v: 0.5, a: 0.001, d: 0.05, dest: far() }));   // twig
    rare(14, 30, () => { const p = far(); for (let i = 0; i < 2; i++) tone({ type: 'sawtooth', f: 380, fEnd: 260, v: 0.2, a: 0.01, d: 0.14, lp: 1200, dest: p, at: i * 0.3 }); });   // far dog
    rare(10, 22, () => burst({ buf: 'brown', type: 'bandpass', f: 700, q: 0.6, v: 0.9, a: 0.4, d: 1.4, dest: far() }));   // grass moving that isn't you
  } else if (kind === 'hosp') {
    setReverb(0.28); loopNoise({ buf: 'brown', f: 260, v: 0.2 }); osc({ type: 'sawtooth', f: 100, v: 0.02, lp: 400 });
    rare(9, 18, () => { const p = panner(4, 1.5, 6, 0.4); tone({ f: 660, v: 0.1, d: 0.5, dest: p }); tone({ f: 523, v: 0.1, d: 0.7, dest: p, at: 0.45 }); });   // PA chime down the hall
    rare(6, 14, () => { const p = panner(rand(-6, 6), 0.2, 6, 0.5); for (let i = 0; i < 6; i++) burst({ type: 'bandpass', f: 1800, q: 4, v: 0.25, d: 0.03, dest: p, at: i * 0.19 }); });   // trolley wheel
    rare(12, 25, () => burst({ type: 'bandpass', f: 600, q: 2, v: 0.5, a: 0.3, d: 0.6, dest: panner(-6, 1.4, 5, 0.5) }));   // someone coughing
  } else if (kind === 'bath') {
    setReverb(0.62); loopNoise({ buf: 'brown', f: 110, v: 0.16 });
    rare(8, 16, () => tone({ type: 'sawtooth', f: rand(55, 75), fEnd: 48, v: 0.3, a: 0.6, d: 1.6, lp: 260, dest: panner(9, 2.5, -2, 0.5) }));   // pipes
    rare(5, 11, () => { const p = panner(-4, 1.5, 6, 0.3); [196, 233, 262].forEach((f) => { for (const d of [-8, 7]) tone({ type: 'sawtooth', f: f + d * 0.1, v: 0.05, a: 0.8, d: 2.6, lp: 500, dest: p }); }); });   // the hymn through the wall
    rare(15, 30, () => burst({ type: 'bandpass', f: 900, q: 0.8, v: 0.5, a: 0.002, d: 0.3, dest: panner(-3, 1, 4, 0.4) }));   // a door somewhere
  } else if (kind === 'home') {
    setReverb(0.18); osc({ type: 'sawtooth', f: 60, v: 0.02, lp: 180 }); windBed(0.14, 300);
    every(1000, () => burst({ type: 'bandpass', f: 2400, q: 6, v: 0.08, a: 0.001, d: 0.02, dest: panner(-1.4, 1.6, 0.6, 0.6) }));   // clock
    rare(9, 20, () => tone({ type: 'sawtooth', f: rand(90, 140), fEnd: rand(150, 200), v: 0.14, a: 0.2, d: 0.9, lp: 700, dest: panner(rand(-2, 2), 2.6, rand(0, 3), 0.5) }));   // house settling upstairs
    rare(14, 28, () => { const p = panner(6, 0, -12, 0.3); burst({ buf: 'brown', type: 'bandpass', f: 300, fEnd: 180, q: 0.6, v: 1.2, a: 1.5, d: 2.5, dest: p }); });   // car passing
  } else if (kind === 'mill') { setReverb(0.36); rare(4, 9, () => { tone({ type: 'sawtooth', f: rand(60, 90), fEnd: 40, v: 0.5, a: 0.2, d: 1.2, lp: 300, dest: far() }); }); }
  else if (kind === 'bus') setReverb(0.1);
  else if (kind === 'ritual') setReverb(0.45);
  else setReverb(0.3);
}
// real words, when the browser can speak. Low, slow, and wrong for the entity.
export const voice = { on: true };
export function speak(text, wrong = false) {
  try {
    if (!voice.on || !window.speechSynthesis || A.ctx.state !== 'running') return;
    const u = new SpeechSynthesisUtterance(text.replace(/["“”]/g, '')); u.volume = wrong ? 0.55 : 0.5; u.rate = wrong ? 0.72 : 0.9; u.pitch = wrong ? 0.35 : 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { }
}
