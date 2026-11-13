// Title screen art: dithered background + pixel-art Zippo with a live flame.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
let running = false, raf = 0, flick = 1, t0 = performance.now(), lastStep = 0;
const embers = [];

function hash(x, y, s) { const n = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return n - Math.floor(n); }

// ---------- background ----------
function drawBg(cv, t) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  const lx = W * cvLight.x, ly = H * cvLight.y, R = H * 0.95;
  const seed = Math.floor(t * 12);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, b = BAYER[(y & 3) * 4 + (x & 3)];
    // red vertical stripes, chunky + broken
    const sx = Math.floor(x / 6);
    const stripe = (sx % 4 === 0 || sx % 4 === 1) ? 1 : 0;
    const crack = hash(sx, Math.floor(y / 3), 1) > 0.82 ? 0.4 : 1;
    let r = 6 + stripe * 36 * crack, gg = 3 + stripe * 5 * crack, bb = 6 + stripe * 8 * crack;
    if (stripe && ((x + y) & 1)) { r *= 0.55; gg *= 0.6; bb *= 0.6; }
    // warm lighter glow
    const dx = (x - lx) / 1.15, dy = y - ly, dist = Math.sqrt(dx * dx + dy * dy) / R;
    const glow = Math.max(0, 1 - dist * 1.25) ** 2.6 * flick;
    r += glow * 120; gg += glow * 58; bb += glow * 14;
    // vignette
    const vx = x / W - 0.5, vy = y / H - 0.5, vig = Math.max(0, 1 - (vx * vx + vy * vy) * 2.2);
    // grain
    const n = (hash(x, y, seed) - 0.5) * 22;
    const q = (v) => Math.max(0, Math.min(255, Math.round((v * vig + n) / 17 + b) * 17));
    d[i] = q(r); d[i + 1] = q(gg); d[i + 2] = q(bb); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const cvLight = { x: 0.68, y: 0.42 };

// ---------- lighter ----------
const P = {
  k: '#050404', d1: '#1e1208', d2: '#3e260f', m1: '#6e4419', m2: '#9a6326', l1: '#c98d43', l2: '#ebba6c', hi: '#fff0c4',
  f0: '#4a62c8', f1: '#8a2a06', f2: '#d55a10', f3: '#f39a26', f4: '#ffd25a', f5: '#fff6d2',
};
function px(g, x, y, c, w = 1, h = 1) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function brass(x, x0, x1, light) {
  // horizontal metal shading with a bright band, light = flame strength
  const u = (x - x0) / (x1 - x0);
  const band = Math.exp(-((u - 0.28) ** 2) / 0.012);
  const v = 0.25 + 0.5 * (1 - u) * 0.6 + band * 0.75 * light;
  const ramp = [P.d1, P.d2, P.m1, P.m2, P.l1, P.l2, P.hi];
  return ramp[Math.max(0, Math.min(6, Math.round(v * 6)))];
}
function drawLighter(cv, t, step) {
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const L = 0.75 + flick * 0.35;
  // open lid, swung back to the left
  g.save(); g.translate(31, 70); g.rotate(-0.38);
  for (let y = -42; y < 0; y++) for (let x = -3; x < 3; x++) px(g, x, y, x === 2 ? P.m2 : x === 1 ? P.m1 : x === -3 ? P.k : P.d2);
  px(g, -2, -42, P.l1, 5, 1);
  g.restore();
  // body
  const bx0 = 26, bx1 = 70, by0 = 72, by1 = 118;
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
    const corner = (y > by1 - 3 && (x < bx0 + 2 || x > bx1 - 3)) || (y < by0 + 1 && (x === bx0 || x === bx1 - 1));
    if (corner) continue;
    let c = brass(x, bx0, bx1, L * (1 - (y - by0) / (by1 - by0) * 0.3));
    if (y > by1 - 5) c = y > by1 - 2 ? P.d1 : P.d2;
    if (y === by0 || y === by0 + 1) c = y === by0 ? P.l2 : P.m2; // lid seam
    if (x === bx0) c = P.d2; if (x === bx1 - 1) c = P.k;
    px(g, x, y, c);
  }
  // engraving
  // chimney
  const cx0 = 31, cx1 = 64, cy0 = 50, cy1 = 72;
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
    let c = brass(x, cx0, cx1, L * 1.1);
    if (y === cy0) c = P.l2; if (x === cx0) c = P.m1; if (x === cx1 - 1) c = P.d1;
    px(g, x, y, c);
  }
  const holes = [[35, 54], [42, 54], [49, 54], [56, 54], [38, 60], [45, 60], [52, 60], [35, 66], [42, 66], [49, 66], [56, 66]];
  for (const [x, y] of holes) { px(g, x + 1, y, P.k, 2, 1); px(g, x, y + 1, P.k, 4, 2); px(g, x + 1, y + 3, P.k, 2, 1); px(g, x + 1, y + 4, P.l1, 2, 1); px(g, x + 4, y + 1, P.d2, 1, 2); }
  // wheel + cam
  const wx = 66, wy = 54;
  for (let a = 0; a < 28; a++) { const an = (a / 28) * Math.PI * 2 + t * 0; const x = Math.round(wx + Math.cos(an) * 6), y = Math.round(wy + Math.sin(an) * 6); px(g, x, y, a % 2 ? P.m1 : P.d1); }
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y < 22) px(g, wx + x, wy + y, (x + y) < -2 ? P.m2 : P.d2);
  px(g, wx - 1, wy - 1, P.l2, 3, 3); px(g, wx, wy, P.k);
  for (let y = wy + 6; y < cy1; y++) px(g, 64, y, P.d2, 3, 1);
  // wick
  px(g, 45, 44, P.d1, 4, 6); px(g, 46, 43, P.k, 2, 1);
  // flame (stepped animation for a hand-drawn feel)
  const s = step * 0.37, base = 45, top = 4 + Math.round(Math.sin(s * 1.7) * 2 + hash(step, 0, 3) * 3);
  const Hf = base - top;
  for (let y = top; y < base; y++) {
    const u = (y - top) / Hf; // 0 top .. 1 base
    const w = Math.round(13 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.05)), 0.75) * (0.55 + u * 0.55));
    const sway = Math.round(Math.sin(s + u * 3.1) * (1 - u) * 3.2 + Math.sin(s * 2.3 + u * 7) * (1 - u) * 1.2);
    const cx = 47 + sway;
    for (let x = -w; x <= w; x++) {
      const e = Math.abs(x) / Math.max(1, w); // 0 center .. 1 edge
      const heat = (1 - e) * (0.4 + u * 0.75) - (1 - u) * 0.25 + (hash(x, y, step) - 0.5) * 0.12;
      let c = heat > 0.82 ? P.f5 : heat > 0.6 ? P.f4 : heat > 0.38 ? P.f3 : heat > 0.18 ? P.f2 : P.f1;
      if (u > 0.9 && e < 0.6) c = u > 0.96 ? P.f0 : P.f5;
      if (e > 0.92 && hash(x, y, step + 9) > 0.5) continue;
      px(g, cx + x, y, c);
    }
  }
  // embers
  if (hash(step, 1, 5) > 0.55) embers.push({ x: 47 + (hash(step, 2, 1) - 0.5) * 8, y: top + 2, v: 0.3 + hash(step, 3, 2) * 0.4, life: 1 });
  for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.y -= e.v * 2.2; e.x += Math.sin(e.y * 0.3) * 0.4; e.life -= 0.05; if (e.life <= 0 || e.y < 0) { embers.splice(i, 1); continue; } px(g, Math.round(e.x), Math.round(e.y), e.life > 0.5 ? P.f4 : P.f2); }
  // warm light on the body top from the flame
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.12 * flick; px(g, 31, 50, P.f3, 33, 6); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

export function startTitleArt() {
  if (running) return; running = true;
  const bg = document.getElementById('tbg'), lt = document.getElementById('tlighter');
  const resize = () => { bg.width = Math.ceil(innerWidth / 4); bg.height = Math.ceil(innerHeight / 4); const r = lt.getBoundingClientRect(); if (r.width) { cvLight.x = (r.left + r.width * 0.49) / innerWidth; cvLight.y = (r.top + r.height * 0.22) / innerHeight; } };
  resize(); addEventListener('resize', resize);
  const loop = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000; const step = Math.floor(t * 11);
    if (step === lastStep) return; lastStep = step;
    flick = 0.82 + Math.sin(t * 7.3) * 0.06 + hash(step, 4, 4) * 0.14;
    if (step % 30 === 0) resize();
    drawBg(bg, t); drawLighter(lt, t, step);
    document.documentElement.style.setProperty('--flick', flick.toFixed(3));
  };
  raf = requestAnimationFrame(loop);
}
export function stopTitleArt() { running = false; cancelAnimationFrame(raf); }
