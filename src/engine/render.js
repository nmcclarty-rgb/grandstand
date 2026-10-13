/**
 * GRANDSTAND — scene rendering.
 *
 * Internal resolution is 480x270. Sprites stay crisp and pixel-snapped;
 * backgrounds use gradients and curves. That mix is deliberate — the look we
 * want is a 90s arcade cabinet, where hand-drawn characters sit on painted
 * backdrops, not an 8-bit console where everything is the same chunky grid.
 */

import { drawFighter, drawPortrait, drawFace, drawGroundShadow, drawPresenter,
         SPRITE_W, SPRITE_H, PORTRAIT_W, PORTRAIT_H,
         PRESENTER_W, PRESENTER_H } from './sprites.js';
import { ramp, shadow, highlight, mix } from './palette.js';
import { KIND } from '../game/ladder.js';

export const VIEW_W = 480;
export const VIEW_H = 270;

const px = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };

export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;

  const resize = () => {
    const wrap = canvas.parentElement;
    const scale = Math.min(wrap.clientWidth / VIEW_W, wrap.clientHeight / VIEW_H);
    // Honest tradeoff: whole-number scales keep every source pixel exactly
    // square, but on a 420px-wide phone that means scale 1 and a postage stamp
    // in a black frame. We fit the space and let image-rendering:pixelated do
    // the snapping. Nobody notices a slightly uneven pixel; everybody notices
    // a tiny picture.
    canvas.style.width = `${Math.round(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.round(VIEW_H * scale)}px`;
  };
  resize();
  window.addEventListener('resize', resize);
  return { ctx, resize };
}

// ── shared drawing helpers ─────────────────────────────────────────────────

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Glossy bevelled button, the look of the level-select reference. */
export function drawBadge(c, x, y, w, h, col, opts = {}) {
  const { r = 9, lift = 3, gloss = true } = opts;
  const t = ramp(col);
  c.save();
  // drop shadow
  c.globalAlpha = 0.3;
  roundRect(c, x + 1, y + lift + 2, w, h, r); c.fillStyle = '#000'; c.fill();
  c.globalAlpha = 1;
  // bevel underneath
  roundRect(c, x, y + lift, w, h, r); c.fillStyle = t.darkest; c.fill();
  // face
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, t.light);
  g.addColorStop(0.5, t.base);
  g.addColorStop(1, t.dark);
  roundRect(c, x, y, w, h, r); c.fillStyle = g; c.fill();
  // rim
  roundRect(c, x, y, w, h, r);
  c.strokeStyle = t.darkest; c.lineWidth = 2; c.stroke();
  if (gloss) {
    c.globalAlpha = 0.34;
    roundRect(c, x + 3, y + 2, w - 6, h * 0.36, r * 0.6);
    c.fillStyle = '#ffffff'; c.fill();
    c.globalAlpha = 1;
  }
  c.restore();
}

export function drawStars(c, cx, y, filled, total = 3, size = 7) {
  const gap = size + 2;
  const startX = cx - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) star(c, startX + i * gap, y, size / 2, i < filled);
}

function star(c, cx, cy, r, filled) {
  c.save();
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    c[fn](cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
  }
  c.closePath();
  c.fillStyle = filled ? '#ffd24a' : '#3a3157';
  c.fill();
  c.strokeStyle = filled ? '#a8700c' : '#241f36';
  c.lineWidth = 1; c.stroke();
  c.restore();
}

function textShadowed(c, text, x, y, font, col, shadowCol = '#1a1424', align = 'center') {
  c.save();
  c.font = font; c.textAlign = align;
  c.fillStyle = shadowCol;
  c.fillText(text, x + 1, y + 1);
  c.fillStyle = col;
  c.fillText(text, x, y);
  c.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// CROWD AND ARENA
// ═══════════════════════════════════════════════════════════════════════════

const CROWD_COLS = ['#c9403a', '#3b6ca8', '#d8a53a', '#3f9a5c', '#8b5cf6',
                    '#e2e8f0', '#e06a2b', '#2a9d8f'];

function drawCrowd(c, top, height, t, density = 8) {
  px(c, 0, top, VIEW_W, height, '#191430');
  const rows = Math.floor(height / density);
  for (let row = 0; row < rows; row++) {
    const y = top + 2 + row * density;
    const depth = row / rows;
    for (let x = -6; x < VIEW_W + 6; x += density) {
      // x starts negative for the off-screen bleed, and JS % keeps the sign,
      // so this has to be a floored modulo or the colour lookup goes undefined.
      const seed = (((x * 13 + row * 29) % 101) + 101) % 101;
      const wave = Math.sin(t / 10 - x / 30 + row * 0.35) > 0.72 ? -2 : 0;
      const col = CROWD_COLS[seed % CROWD_COLS.length];
      px(c, x, y + wave, density - 2, density - 2, mix(col, '#191430', 0.45 - depth * 0.3));
      px(c, x + 1, y - 2 + wave, density - 4, density - 4,
         mix(seed % 3 ? '#e8b48a' : '#7a4a21', '#191430', 0.45 - depth * 0.3));
    }
  }
  // roof girder and floodlight spill
  px(c, 0, top, VIEW_W, 4, '#0f0b1c');
  for (let x = 16; x < VIEW_W; x += 78) {
    px(c, x, top - 5, 14, 6, '#fdf3cd');
    c.save();
    c.globalAlpha = 0.12;
    const g = c.createRadialGradient(x + 7, top, 2, x + 7, top, 60);
    g.addColorStop(0, '#fff7d6'); g.addColorStop(1, 'rgba(255,247,214,0)');
    c.fillStyle = g; c.fillRect(x - 53, top - 6, 120, 70);
    c.restore();
  }
}

/**
 * One arena per sport. `props` draws the set dressing on the ground, behind
 * the fighters — a snooker table, a running track, a dartboard — which is what
 * makes rung 6 feel like a different fight from rung 5 rather than the same
 * pitch in a different colour.
 *
 * Fighters stand at x 44..188 and 292..436, so the centre column (188..292) is
 * the one reliably clear strip: central props go there, wide ones go behind.
 */
const ARENAS = {
  football:   { sky: ['#4a6fb5', '#89a8d8'], ground: '#2c8f4a', alt: '#248040', crowd: true,  props: propsFootball },
  boxing:     { sky: ['#241d3c', '#3a3057'], ground: '#b89a6a', alt: '#a98c5e', crowd: true,  props: propsBoxing },
  athletics:  { sky: ['#3d63a8', '#7e9fd0'], ground: '#b24a2c', alt: '#a04227', crowd: true,  props: propsAthletics },
  cricket:    { sky: ['#5f8ac8', '#b3cde8'], ground: '#4aa359', alt: '#419350', crowd: true,  props: propsCricket },
  snooker:    { sky: ['#140f26', '#241a3d'], ground: '#3b2a4a', alt: '#352646', crowd: false, props: propsSnooker },
  darts:      { sky: ['#2a1d18', '#3d2b22'], ground: '#5a3f2e', alt: '#523828', crowd: false, props: propsDarts },
  golf:       { sky: ['#4f7cc0', '#a9c4e4'], ground: '#4a9a42', alt: '#40883a', crowd: false, props: propsGolf },
  tennis:     { sky: ['#4a6fb5', '#9dbbe0'], ground: '#3e6fa8', alt: '#376298', crowd: true,  props: propsTennis },
  motorsport: { sky: ['#2b3446', '#4d5a71'], ground: '#5e6072', alt: '#545667', crowd: true,  props: propsMotorsport },
  rugby:      { sky: ['#4f7cc0', '#8fb0d8'], ground: '#3a9450', alt: '#328446', crowd: true,  props: propsRugby },
  olympics:   { sky: ['#1f2b40', '#46608c'], ground: '#b24a2c', alt: '#a04227', crowd: true,  props: propsOlympics },
  telly:      { sky: ['#0b1f52', '#13327d'], ground: '#2b3f6b', alt: '#25375f', crowd: false, props: propsTelly },
  racing:     { sky: ['#5a86c4', '#a8c3e2'], ground: '#4f9a4a', alt: '#458a42', crowd: true,  props: propsRacing },
  cycling:    { sky: ['#1d1832', '#332a52'], ground: '#9a6a3c', alt: '#8a5e35', crowd: true,  props: propsCycling },
  prem90s:    { sky: ['#0d1026', '#1e2a52'], ground: '#2f9850', alt: '#268842', crowd: true,  props: propsPrem90s },
  any:        { sky: ['#120f24', '#2a2148'], ground: '#2c8f4a', alt: '#248040', crowd: true,  props: propsArena },
};

// ── set dressing ──────────────────────────────────────────────────────────
const HZ = 150;

/**
 * The Premier League '90s arena: a midweek floodlit ground with a mown pitch,
 * perimeter hoardings and the roof stanchion nobody got a refund for.
 *
 * Drawn as its own arena rather than reusing the football one because the
 * decade had a look: lattice pylons, four stands that did not match, and
 * stripes mown in by someone who took it personally.
 */
function propsPrem90s(c, t) {
  // ── mown stripes, converging towards the far touchline ──
  c.save();
  for (let i = 0; i < 10; i++) {
    if (i % 2) continue;
    const tl = 240 + (i - 5) * 30, tr = tl + 30;
    const bl = 240 + (i - 5) * 56, br = bl + 56;
    c.fillStyle = 'rgba(255,255,255,0.055)';
    c.beginPath();
    c.moveTo(tl, HZ); c.lineTo(tr, HZ); c.lineTo(br, VIEW_H); c.lineTo(bl, VIEW_H);
    c.closePath(); c.fill();
  }
  c.restore();

  // halfway line and the centre circle, seen flat-on
  c.strokeStyle = 'rgba(223,243,228,0.72)'; c.lineWidth = 2;
  c.beginPath(); c.arc(240, 228, 72, Math.PI, 0); c.stroke();
  px(c, 239, HZ + 6, 3, VIEW_H - HZ, 'rgba(223,243,228,0.5)');

  // ── stand roof, and the pillar in front of your seat ──
  px(c, 0, 40, VIEW_W, 16, '#120e22');
  px(c, 0, 54, VIEW_W, 3, '#2a2142');
  for (const sx of [86, 240, 394]) {
    px(c, sx, 56, 4, HZ - 60, 'rgba(10,8,18,0.62)');
  }

  // ── perimeter hoardings: eight boards, nothing you could read from the Kop ──
  const BOARD = ['#b2342f', '#1f4f9c', '#1f7a42', '#c9a227', '#2b2b3a', '#8b2f6a'];
  for (let i = 0; i < 8; i++) {
    const bx = i * 60;
    px(c, bx, HZ + 4, 59, 15, BOARD[i % BOARD.length]);
    px(c, bx, HZ + 4, 59, 2, 'rgba(255,255,255,0.22)');
    px(c, bx + 7, HZ + 9, 45, 4, 'rgba(255,255,255,0.68)');
  }
  px(c, 0, HZ + 19, VIEW_W, 2, '#0d0a18');

  // ── floodlight pylons: lattice tower, lamp rack, and the haze off it ──
  for (const base of [46, 420]) {
    const top = 18, bot = HZ - 26;
    for (let y = top + 22; y < bot; y += 6) {
      const w = 7 + ((y - top) / (bot - top)) * 11;
      px(c, base - w / 2, y, w, 2, '#191430');                 // horizontal brace
    }
    px(c, base - 9, top + 20, 3, bot - top - 20, '#241d38');   // legs
    px(c, base + 6, top + 20, 3, bot - top - 20, '#241d38');
    px(c, base - 17, top + 2, 34, 19, '#1b1630');              // lamp rack
    px(c, base - 17, top, 34, 3, '#2e2648');
    for (let ly = 0; ly < 3; ly++) {
      for (let lx = 0; lx < 5; lx++) {
        const flick = ((lx * 7 + ly * 13 + ((t * 2) | 0)) % 23) === 0;
        px(c, base - 14 + lx * 6, top + 5 + ly * 5, 4, 3, flick ? '#fffdf0' : '#ffe9a8');
      }
    }
    const glow = c.createRadialGradient(base, top + 12, 4, base, top + 12, 92);
    glow.addColorStop(0, 'rgba(255,240,190,0.30)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = glow;
    c.fillRect(base - 92, top - 80, 184, 184);
  }
}

function propsFootball(c, t) {
  // goal at the back, penalty arc on the deck
  px(c, 178, HZ - 44, 124, 4, '#f1f5f9');
  px(c, 178, HZ - 44, 4, 46, '#f1f5f9');
  px(c, 298, HZ - 44, 4, 46, '#f1f5f9');
  for (let x = 184; x < 298; x += 8) px(c, x, HZ - 40, 1, 38, 'rgba(255,255,255,0.28)');
  for (let y = HZ - 38; y < HZ; y += 8) px(c, 180, y, 120, 1, 'rgba(255,255,255,0.28)');
  c.strokeStyle = '#dff3e4'; c.lineWidth = 2;
  c.beginPath(); c.arc(240, 238, 58, Math.PI, 0); c.stroke();
  px(c, 0, 196, VIEW_W, 2, '#dff3e4');
}

function propsBoxing(c, t) {
  // canvas, ropes and corner posts
  px(c, 0, HZ, VIEW_W, 6, '#8d7a52');
  for (let i = 0; i < 3; i++) {
    const y = HZ - 54 + i * 18;
    px(c, 0, y, VIEW_W, 3, i === 1 ? '#d8d2e8' : '#c9303c');
  }
  px(c, 26, HZ - 62, 10, 70, '#4a3f58');
  px(c, 26, HZ - 62, 10, 8, '#c9303c');
  px(c, 444, HZ - 62, 10, 70, '#4a3f58');
  px(c, 444, HZ - 62, 10, 8, '#1d4ed8');
  px(c, 0, 206, VIEW_W, 3, '#9a8560');
}

function propsAthletics(c, t) {
  // lanes receding, with white lines and a finish
  for (let i = 0; i < 6; i++) {
    const y = HZ + 6 + i * 18;
    px(c, 0, y, VIEW_W, 2, '#efe7d8');
  }
  px(c, 214, HZ, 6, VIEW_H - HZ, '#f4f0e6');       // finish line
  for (let y = HZ; y < VIEW_H; y += 10) px(c, 214, y, 6, 5, '#2b2334');
  px(c, 36, HZ - 26, 52, 26, '#1d6b3a');           // infield grass
  px(c, 392, HZ - 26, 56, 26, '#1d6b3a');
}

function propsCricket(c, t) {
  px(c, 150, HZ, 180, VIEW_H - HZ, '#c2b183');     // the strip
  px(c, 150, HZ, 180, 3, '#d6c89f');
  const stumpsX = 232;
  for (let i = 0; i < 3; i++) px(c, stumpsX + i * 7, 176, 4, 34, '#f0ead6');
  px(c, stumpsX, 174, 18, 3, '#f0ead6');           // bails
  px(c, 150, 212, 180, 2, '#f4f1e6');              // crease
  px(c, 60, HZ - 34, 70, 34, '#e9e4d6');           // pavilion
  px(c, 60, HZ - 34, 70, 5, '#8a6b4a');
}

function propsSnooker(c, t) {
  // the table, lit from above
  c.save();
  c.globalAlpha = 0.5;
  const beam = c.createLinearGradient(240, HZ - 70, 240, 250);
  beam.addColorStop(0, 'rgba(255,245,200,0.55)');
  beam.addColorStop(1, 'rgba(255,245,200,0)');
  c.fillStyle = beam;
  c.beginPath(); c.moveTo(212, HZ - 74); c.lineTo(268, HZ - 74);
  c.lineTo(360, 244); c.lineTo(120, 244); c.closePath(); c.fill();
  c.restore();
  px(c, 222, HZ - 84, 36, 10, '#2b2334');          // the light
  px(c, 226, HZ - 76, 28, 4, '#fff4c8');

  px(c, 104, 182, 272, 62, '#5a3a24');             // cushions
  px(c, 104, 182, 272, 5, '#7a5234');
  px(c, 112, 188, 256, 48, '#12663c');             // baize
  px(c, 112, 188, 256, 4, '#1a8a52');
  px(c, 112, 230, 256, 6, '#0d4e2d');
  for (const [bx, col] of [[150, '#f4f1e6'], [182, '#c9303c'], [214, '#f0d060'],
                           [252, '#2f7f4f'], [292, '#8a4a2a'], [330, '#1a1424']]) {
    px(c, bx, 204, 11, 11, col);
    px(c, bx + 1, 205, 4, 4, 'rgba(255,255,255,0.5)');
  }
  for (const px_ of [106, 234, 362]) {             // pockets
    px(c, px_, 182, 13, 10, '#120d1c'); px(c, px_, 228, 13, 10, '#120d1c');
  }
}

function propsDarts(c, t) {
  // board on the wall, oche on the floor
  const bx = 240, by = HZ - 54;
  c.save();
  c.beginPath(); c.arc(bx, by, 30, 0, Math.PI * 2); c.fillStyle = '#1a1424'; c.fill();
  c.beginPath(); c.arc(bx, by, 26, 0, Math.PI * 2); c.fillStyle = '#e8dcc0'; c.fill();
  for (let i = 0; i < 20; i++) {
    c.beginPath();
    c.moveTo(bx, by);
    c.arc(bx, by, 26, (i * Math.PI) / 10, ((i + 1) * Math.PI) / 10);
    c.closePath();
    c.fillStyle = i % 2 ? '#1a1424' : '#e8dcc0';
    c.fill();
  }
  c.beginPath(); c.arc(bx, by, 11, 0, Math.PI * 2); c.strokeStyle = '#c9303c'; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.arc(bx, by, 5, 0, Math.PI * 2); c.fillStyle = '#2f7f4f'; c.fill();
  c.beginPath(); c.arc(bx, by, 2.5, 0, Math.PI * 2); c.fillStyle = '#c9303c'; c.fill();
  c.restore();
  px(c, 0, 226, VIEW_W, 4, '#3c2a1e');             // the oche
  px(c, 0, 226, VIEW_W, 1, '#6b4f39');
  px(c, 40, HZ - 44, 46, 44, '#3a2a20');           // bar fittings
  px(c, 44, HZ - 40, 38, 6, '#6b4f39');
  px(c, 400, HZ - 40, 44, 40, '#3a2a20');
}

function propsGolf(c, t) {
  c.save();                                        // the green
  c.fillStyle = '#5fb24e';
  c.beginPath(); c.ellipse(240, 214, 150, 42, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#6ec25a';
  c.beginPath(); c.ellipse(240, 210, 132, 34, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d8c48a';                         // bunker
  c.beginPath(); c.ellipse(78, 188, 48, 16, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  px(c, 238, 180, 5, 5, '#1c1917');                // hole
  px(c, 240, 150, 2, 32, '#f4f1e6');               // pin
  const flap = Math.sin(t / 9) > 0 ? 0 : 1;
  px(c, 242, 150 + flap, 14, 9, '#c9303c');
}

function propsTennis(c, t) {
  px(c, 0, 206, VIEW_W, 3, '#f1f5f9');             // baseline
  px(c, 0, 176, VIEW_W, 2, '#dfe8f2');             // service line
  px(c, 238, 176, 4, 32, '#dfe8f2');
  px(c, 0, HZ + 4, VIEW_W, 26, 'rgba(255,255,255,0.05)');
  for (let x = 0; x < VIEW_W; x += 6) px(c, x, HZ + 2, 3, 24, '#e8eef6');  // the net
  px(c, 0, HZ, VIEW_W, 4, '#1f2d45');
  px(c, 236, HZ + 2, 6, 26, '#f8fbff');
  px(c, 430, HZ - 48, 20, 52, '#3a3a4e');          // umpire chair
  px(c, 426, HZ - 52, 28, 8, '#54546e');
}

function propsMotorsport(c, t) {
  px(c, 0, HZ - 10, VIEW_W, 12, '#2a2f3d');        // pit wall
  for (let x = 0; x < VIEW_W; x += 28) {
    px(c, x, HZ - 10, 14, 12, '#c9303c');
    px(c, x + 14, HZ - 10, 14, 12, '#e8e8ee');
  }
  for (let i = 0; i < 3; i++) {                    // tyre stacks
    const sx = 30 + i * 400 / 3;
    for (let j = 0; j < 3; j++) px(c, sx, HZ - 24 - j * 8, 22, 8, j % 2 ? '#1f1f28' : '#2a2a34');
  }
  const lit = Math.floor(t / 14) % 6;              // start lights
  px(c, 196, HZ - 58, 88, 20, '#15151d');
  for (let i = 0; i < 5; i++) {
    px(c, 202 + i * 17, HZ - 53, 11, 11, i <= lit ? '#ff3b30' : '#3a2024');
  }
  px(c, 0, 220, VIEW_W, 3, '#d8d8e0');
}

function propsRugby(c, t) {
  // Uprights have to clear the fighters' heads (they top out around y=60) or
  // the posts are a crossbar floating between two shoulders.
  px(c, 150, 28, 7, 142, '#f1f5f9');
  px(c, 150, 28, 3, 142, '#c9cfdb');
  px(c, 324, 28, 7, 142, '#f1f5f9');
  px(c, 324, 28, 3, 142, '#c9cfdb');
  px(c, 150, 96, 181, 7, '#f1f5f9');
  px(c, 150, 96, 181, 3, '#ffffff');
  px(c, 0, 200, VIEW_W, 2, '#e6f2ea');
  px(c, 0, 228, VIEW_W, 2, 'rgba(230,242,234,0.5)');
}

function propsOlympics(c, t) {
  for (let i = 0; i < 5; i++) {                    // lanes
    px(c, 0, HZ + 10 + i * 20, VIEW_W, 2, '#efe7d8');
  }
  px(c, 196, 186, 88, 24, '#c8a94a');              // podium
  px(c, 196, 186, 88, 4, '#e2c468');
  px(c, 142, 198, 54, 12, '#aab0bd');
  px(c, 142, 198, 54, 3, '#c6ccd8');
  px(c, 284, 200, 54, 10, '#b1793f');
  px(c, 284, 200, 54, 3, '#cc9354');
  const flick = Math.sin(t / 6) > 0 ? 1 : 0;       // the flame
  px(c, 424, HZ - 58, 14, 34, '#8a8f9e');
  px(c, 422, HZ - 72 - flick, 18, 16, '#ff8a2b');
  px(c, 426, HZ - 78 - flick, 10, 10, '#ffd24a');
}

function propsTelly(c, t) {
  px(c, 0, HZ - 60, VIEW_W, 62, '#152246');
  for (let x = 10; x < VIEW_W; x += 60) {          // monitor wall
    px(c, x, HZ - 52, 46, 34, '#1b1b26');
    px(c, x + 3, HZ - 49, 40, 26, ['#1f5e3a', '#5a2f2f', '#2c3f70', '#5a4a1f'][(x / 60) % 4]);
    px(c, x + 3, HZ - 49 + ((Math.floor(t / 3) + x) % 26), 40, 1, 'rgba(255,255,255,0.18)');
  }
  px(c, 0, 210, VIEW_W, 4, '#5a7fc0');
  px(c, 0, 214, VIEW_W, VIEW_H - 214, '#16254a');
}

function propsRacing(c, t) {
  // running rail, a birch fence, and the stands away in the distance
  px(c, 0, HZ - 36, VIEW_W, 20, '#d8d3c4');        // distant grandstand
  px(c, 0, HZ - 36, VIEW_W, 3, '#8d8575');
  for (let x = 6; x < VIEW_W; x += 24) px(c, x, HZ - 31, 14, 10, '#6e6a60');

  px(c, 150, HZ - 6, 180, 20, '#4a3a22');          // the fence
  px(c, 150, HZ - 10, 180, 6, '#2f6b35');
  px(c, 150, HZ - 13, 180, 4, '#3f8a42');
  px(c, 150, HZ + 12, 180, 3, '#d9d4c6');

  for (let x = 0; x < VIEW_W; x += 34) {           // rail and posts
    px(c, x, 196, 5, 26, '#f1f3f6');
    px(c, x, 196, 5, 3, '#ffffff');
  }
  px(c, 0, 198, VIEW_W, 4, '#f1f3f6');
  px(c, 0, 210, VIEW_W, 3, '#dfe3e9');
}

function propsCycling(c, t) {
  // velodrome: pine boards, the blue cote d'azur and the black measurement line
  for (let y = HZ; y < VIEW_H; y += 4) {
    px(c, 0, y, VIEW_W, 2, y % 8 === 0 ? '#a8763f' : '#916037');
  }
  px(c, 0, HZ, VIEW_W, 5, '#6d4826');
  px(c, 0, 190, VIEW_W, 3, '#1a1424');             // black line
  px(c, 0, 206, VIEW_W, 4, '#c9303c');             // sprinters' line
  px(c, 0, 236, VIEW_W, 8, '#2f7fae');             // cote d'azur
  px(c, 0, 236, VIEW_W, 2, '#49a0d0');
  // banking suggested by the rail curving away at both edges
  c.save();
  c.strokeStyle = '#d8d2c4'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-10, HZ + 26); c.quadraticCurveTo(90, HZ + 4, 190, HZ + 2); c.stroke();
  c.beginPath(); c.moveTo(VIEW_W + 10, HZ + 26); c.quadraticCurveTo(390, HZ + 4, 290, HZ + 2); c.stroke();
  c.restore();
}

function propsArena(c, t) {
  // the final: pitch markings, and a wall of flashbulbs
  c.strokeStyle = '#dff3e4'; c.lineWidth = 2;
  c.beginPath(); c.arc(240, 216, 66, 0, Math.PI * 2); c.stroke();
  px(c, 238, 150, 4, 120, 'rgba(223,243,228,0.5)');
  for (let i = 0; i < 26; i++) {
    const fx = (i * 97) % VIEW_W;
    const fy = HZ - 92 + ((i * 37) % 80);
    if ((Math.floor(t / 3) + i * 7) % 23 < 2) px(c, fx, fy, 3, 3, '#fffbe8');
  }
}

export function drawBattleScene(ctx, s, t) {
  const look = ARENAS[s.sport] || ARENAS.any;
  const HORIZON = HZ;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, look.sky[0]);
  sky.addColorStop(1, look.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, HORIZON);

  if (look.crowd) drawCrowd(ctx, HORIZON - 92, 92, t);
  else drawInteriorWall(ctx, HORIZON - 92, 92, look);

  // ground, receding bands
  for (let y = HORIZON; y < VIEW_H; y += 7) {
    const band = ((y - HORIZON) / 7) | 0;
    px(ctx, 0, y, VIEW_W, 7, band % 2 ? look.ground : look.alt);
  }
  px(ctx, 0, HORIZON, VIEW_W, 3, '#0d0a18');
  px(ctx, 0, HORIZON + 3, VIEW_W, 1, highlight(look.ground, 0.5));

  // ── the set dressing for this sport, behind the fighters ──
  if (look.props) look.props(ctx, t);

  // ── fighters ──
  const SC = 3;
  const feet = 252;
  const top = feet - SPRITE_H * SC;
  const shake = s.shake ? Math.round((Math.random() - 0.5) * s.shake * 5) : 0;
  const pFlash = s.playerFlash > 0, fFlash = s.foeFlash > 0;

  if (s.foe) {
    const fx = 292 + (fFlash ? shake : 0);
    if (!s.foeDown) drawGroundShadow(ctx, fx + (SPRITE_W * SC) / 2, feet - 2, 34);
    drawFighter(ctx, s.foe, fx, top, {
      facing: -1, t, flash: fFlash, down: s.foeDown, pose: s.foePose, scale: SC,
    });
  }
  if (s.player) {
    const px_ = 44 + (pFlash ? shake : 0);
    if (!s.playerDown) drawGroundShadow(ctx, px_ + (SPRITE_W * SC) / 2, feet - 2, 34);
    drawFighter(ctx, s.player, px_, top, {
      facing: 1, t, flash: pFlash, down: s.playerDown, pose: s.playerPose, scale: SC,
    });
  }

  // ── floating damage numbers ──
  for (const f of s.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 40));
    textShadowed(ctx, f.text, f.x, f.y,
      `${f.big ? 22 : 13}px "Press Start 2P", monospace`, f.colour);
    ctx.restore();
  }
}

function drawInteriorWall(c, top, h, look) {
  const base = (look && look.sky && look.sky[1]) || '#2a2340';
  px(c, 0, top, VIEW_W, h, shadow(base, 0.6));
  px(c, 0, top, VIEW_W, 5, shadow(base, 1.4));
  for (let x = 8; x < VIEW_W; x += 52) {
    px(c, x, top + 16, 34, 26, highlight(base, 0.3));
    px(c, x, top + 16, 34, 3, highlight(base, 0.7));
    px(c, x + 3, top + 20, 28, 3, highlight(base, 1));
  }
  for (let x = 24; x < VIEW_W; x += 104) px(c, x, top + 6, 20, 5, '#fdf3cd');
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARACTER SELECT — the Street Fighter II screen
// ═══════════════════════════════════════════════════════════════════════════

export function drawSelectScene(ctx, s, t) {
  // arcade backdrop: deep purple with a slow diagonal shimmer
  const g = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
  g.addColorStop(0, '#3a2c66');
  g.addColorStop(0.5, '#241b45');
  g.addColorStop(1, '#3a2c66');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < VIEW_W + VIEW_H; i += 26) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#c9b6ff';
    ctx.fillRect(i - VIEW_H + ((t / 3) % 26), 0, 8, VIEW_H);
    ctx.setTransform(1, 0.0, -0.6, 1, 0, 0);
    ctx.restore();
  }

  const PW = 146, PH = 210, PY = 26;

  // ── your pick, left ──
  if (s.player) {
    drawPortrait(ctx, s.player, 10, PY, PW, PH, { bg: '#6a55a8' });
    namePlate(ctx, 10, PY + PH - 26, PW, s.player.name, '#4ade80');
  }
  // ── first opponent, right ──
  if (s.foe) {
    ctx.save();
    ctx.translate(VIEW_W - 10, 0); ctx.scale(-1, 1);
    drawPortrait(ctx, s.foe, 0, PY, PW, PH, { bg: '#a8556a' });
    ctx.restore();
    namePlate(ctx, VIEW_W - 10 - PW, PY + PH - 26, PW, s.foe.name, '#f87171');
  }

  // ── centre: the globe, as per the arcade original ──
  drawGlobe(ctx, VIEW_W / 2, 112, 56, t);

  textShadowed(ctx, 'PLAYER SELECT', VIEW_W / 2, 216, '10px "Press Start 2P", monospace', '#ffd24a');
  const blink = Math.sin(t / 12) > -0.2;
  if (blink) {
    textShadowed(ctx, s.hint || 'PICK YOUR FIGHTER', VIEW_W / 2, 236,
      '7px "Press Start 2P", monospace', '#e8e3f5');
  }

  textShadowed(ctx, '1P', 12, 16, '10px "Press Start 2P", monospace', '#4ade80', '#1a1424', 'left');
  textShadowed(ctx, 'CPU', VIEW_W - 12, 16, '10px "Press Start 2P", monospace', '#f87171', '#1a1424', 'right');
}

function namePlate(c, x, y, w, text, col) {
  c.save();
  c.globalAlpha = 0.85;
  px(c, x, y, w, 24, '#120e22');
  c.globalAlpha = 1;
  px(c, x, y, w, 2, col);
  const size = text.length > 15 ? 6 : text.length > 11 ? 7 : 9;
  textShadowed(c, text, x + w / 2, y + 17, `${size}px "Press Start 2P", monospace`, col);
  c.restore();
}

function drawGlobe(c, cx, cy, r, t) {
  c.save();
  // ocean
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#5aa6e8');
  g.addColorStop(0.7, '#2160a3');
  g.addColorStop(1, '#123d70');
  c.beginPath(); c.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  c.fillStyle = g; c.fill();

  // landmasses, roughly Europe-and-friends, scrolling slowly
  c.save();
  c.beginPath(); c.ellipse(cx, cy, r - 1, r * 0.92 - 1, 0, 0, Math.PI * 2); c.clip();
  const off = ((t / 5) % (r * 3)) - r * 1.5;
  const land = [
    [-28, -34, 40, 20], [-8, -18, 26, 30], [12, -6, 22, 38], [-44, 6, 24, 16],
    [26, -32, 34, 18], [34, 10, 20, 26], [-20, 22, 30, 14],
  ];
  for (const [lx, ly, lw, lh] of land) {
    c.beginPath();
    c.ellipse(cx + lx + off, cy + ly, lw / 2, lh / 2, 0, 0, Math.PI * 2);
    c.fillStyle = '#3f8f4e'; c.fill();
    c.beginPath();
    c.ellipse(cx + lx + off, cy + ly - 2, lw / 2.4, lh / 2.6, 0, 0, Math.PI * 2);
    c.fillStyle = '#56a862'; c.fill();
  }
  c.restore();

  // venue pins blinking around the globe
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t / 90;
    const px_ = cx + Math.cos(a) * r * 0.72;
    const py_ = cy + Math.sin(a) * r * 0.62;
    const on = Math.sin(t / 8 + i) > 0;
    c.beginPath(); c.arc(px_, py_, on ? 3.5 : 2.5, 0, Math.PI * 2);
    c.fillStyle = on ? '#ffd24a' : '#9c7ad8'; c.fill();
    c.strokeStyle = '#1a1424'; c.lineWidth = 1; c.stroke();
  }

  // rim light
  c.beginPath(); c.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  c.strokeStyle = '#a8c8f0'; c.lineWidth = 2; c.stroke();
  c.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// THE LADDER — a route through a municipal park, not a dungeon
// ═══════════════════════════════════════════════════════════════════════════

export const RUNG_GAP = 108;
export const LADDER_PAD = 120;

export function rungPos(n) {
  return {
    x: LADDER_PAD + (n - 1) * RUNG_GAP,
    y: 176 + Math.sin(n * 0.85) * 34,
  };
}
export function ladderWidth(total) { return LADDER_PAD * 2 + (total - 1) * RUNG_GAP; }

export function drawLadderScene(ctx, ladder, at, camX, t, playerChar) {
  // ── sky ──
  const sky = ctx.createLinearGradient(0, 0, 0, 150);
  sky.addColorStop(0, '#5b8ad0');
  sky.addColorStop(0.6, '#9dc0e6');
  sky.addColorStop(1, '#cfe3f2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ── clouds, slow parallax ──
  for (let i = 0; i < 7; i++) {
    const cx = ((i * 137 - camX * 0.12 + t * 0.10) % (VIEW_W + 140)) - 70;
    cloud(ctx, cx, 24 + (i % 3) * 22, 20 + (i % 4) * 7);
  }

  // ── distant hills ──
  hills(ctx, camX * 0.25, 118, '#6f9f6a', 44);
  hills(ctx, camX * 0.4, 132, '#5a8f57', 34);

  // ── the grass the whole thing sits on ──
  const grass = ctx.createLinearGradient(0, 128, 0, VIEW_H);
  grass.addColorStop(0, '#6cbb55');
  grass.addColorStop(0.45, '#57a844');
  grass.addColorStop(1, '#3f8a34');
  ctx.fillStyle = grass; ctx.fillRect(0, 128, VIEW_W, VIEW_H - 128);
  for (let y = 140; y < VIEW_H; y += 14) {
    ctx.save(); ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, y, VIEW_W, 6);
    ctx.restore();
  }

  // ── floodlight pylons, mid parallax ──
  for (let i = 0; i < 6; i++) {
    const x = i * 220 - (camX * 0.55) % 220 - 60;
    pylon(ctx, x, 128);
  }

  // ── trees, behind the path so they never sit on top of a badge ──
  for (let i = 0; i < 10; i++) {
    const x = i * 168 - (camX * 0.85) % 168 - 80;
    tree(ctx, x, 142 + (i % 3) * 8, 0.85 + (i % 3) * 0.12);
  }

  // ── the path itself ──
  drawPath(ctx, ladder, camX);

  // ── rung badges ──
  for (const r of ladder.rungs) {
    const p = rungPos(r.n);
    const x = p.x - camX;
    if (x < -70 || x > VIEW_W + 70) continue;
    drawRung(ctx, r, x, p.y, ladder.available(r.n), r.n === at, t);
  }

  // ── you, standing just along from your rung ──
  // Dead-centre on the badge hides the face of whoever you are about to fight,
  // which is the one thing the ladder screen exists to show you.
  const here = rungPos(at);
  const hx = here.x - camX + 40;
  if (playerChar && hx > -60 && hx < VIEW_W + 60) {
    const feet = here.y + 38;
    drawGroundShadow(ctx, hx, feet, 15);
    drawFighter(ctx, playerChar, hx - SPRITE_W / 2, feet - SPRITE_H, { t, scale: 1, facing: -1 });
  }
}

function drawPath(c, ladder, camX) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const pts = ladder.rungs.map((r) => {
    const p = rungPos(r.n);
    return { x: p.x - camX, y: p.y + 12 };
  });
  const trace = () => {
    c.beginPath();
    c.moveTo(pts[0].x - 90, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      c.quadraticCurveTo((a.x + b.x) / 2, a.y, b.x, b.y);
    }
    c.lineTo(pts[pts.length - 1].x + 90, pts[pts.length - 1].y);
  };
  trace(); c.strokeStyle = '#9d7a49'; c.lineWidth = 22; c.stroke();
  trace(); c.strokeStyle = '#d8b878'; c.lineWidth = 17; c.stroke();
  trace(); c.strokeStyle = '#eddcb4'; c.lineWidth = 9; c.stroke();
  c.restore();
}

const RUNG_LOOK = {
  [KIND.FIGHT]:  { col: '#4a9be0', label: null },
  [KIND.BOSS]:   { col: '#e0574a', label: null },
  [KIND.PHYSIO]: { col: '#4ec97a', label: '+' },
  [KIND.WATER]:  { col: '#3fb6d8', label: '~' },
};

function drawRung(c, r, x, y, available, current, t) {
  const look = RUNG_LOOK[r.kind] || RUNG_LOOK[KIND.FIGHT];
  const locked = !available;
  const size = r.kind === KIND.BOSS ? 54 : 44;
  const bx = x - size / 2, by = y - size / 2;

  // pulsing ring on the rung you are standing on
  if (current) {
    const pulse = 4 + Math.sin(t / 7) * 3;
    c.save();
    c.globalAlpha = 0.55;
    c.beginPath(); c.arc(x, y + 2, size / 2 + pulse, 0, Math.PI * 2);
    c.strokeStyle = '#ffd24a'; c.lineWidth = 3; c.stroke();
    c.restore();
  }

  drawBadge(c, bx, by, size, size,
    locked ? '#6b6580' : r.cleared ? '#54b06a' : look.col,
    { r: r.kind === KIND.BOSS ? 12 : 10 });

  if (locked) {
    padlock(c, x, y + 2, 14);
  } else if (r.fighter) {
    c.save();
    roundRect(c, bx + 4, by + 3, size - 8, size - 8, 7); c.clip();
    drawFace(c, r.fighter, bx + 4, by - 1, size - 8);
    c.restore();
  } else if (look.label) {
    textShadowed(c, look.label, x, y + 9, '20px "Press Start 2P", monospace', '#ffffff');
  }

  // rung number badge
  c.save();
  c.beginPath(); c.arc(bx + 3, by + 3, 9, 0, Math.PI * 2);
  c.fillStyle = '#1a1424'; c.fill();
  c.strokeStyle = locked ? '#6b6580' : '#ffd24a'; c.lineWidth = 2; c.stroke();
  textShadowed(c, String(r.n), bx + 3, by + 7, '8px "Press Start 2P", monospace',
    locked ? '#9c93b8' : '#ffd24a');
  c.restore();

  if (r.cleared) drawStars(c, x, y + size / 2 + 12, r.stars, 3, 9);
  if (r.kind === KIND.BOSS && !locked) {
    textShadowed(c, 'FINAL', x, by - 8, '7px "Press Start 2P", monospace', '#ffd24a');
  }
}

function padlock(c, x, y, s) {
  px(c, x - s / 2, y - s / 4, s, s * 0.7, '#cfd3e0');
  px(c, x - s / 2, y - s / 4, s, 2, '#eef1f7');
  c.beginPath();
  c.arc(x, y - s / 4, s * 0.3, Math.PI, 0);
  c.strokeStyle = '#cfd3e0'; c.lineWidth = 3; c.stroke();
  px(c, x - 1.5, y + s * 0.05, 3, 5, '#5c6480');
}

function cloud(c, x, y, r) {
  c.save();
  c.globalAlpha = 0.85;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(x, y, r * 0.6, 0, Math.PI * 2);
  c.arc(x + r * 0.55, y - r * 0.2, r * 0.45, 0, Math.PI * 2);
  c.arc(x + r * 1.05, y + r * 0.05, r * 0.5, 0, Math.PI * 2);
  c.arc(x + r * 0.5, y + r * 0.3, r * 0.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function hills(c, off, baseY, col, h) {
  c.save();
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-20, VIEW_H);
  for (let x = -20; x <= VIEW_W + 20; x += 10) {
    const y = baseY - Math.sin((x + off) / 66) * h * 0.5 - h * 0.4;
    c.lineTo(x, y);
  }
  c.lineTo(VIEW_W + 20, VIEW_H);
  c.closePath();
  c.fill();
  c.restore();
}

function tree(c, x, y, s) {
  const trunkH = 26 * s;
  px(c, x - 3 * s, y, 6 * s, trunkH, '#7a5230');
  px(c, x - 3 * s, y, 2 * s, trunkH, '#8f6238');
  c.save();
  c.fillStyle = '#2f7d3a';
  c.beginPath();
  c.arc(x, y - 6 * s, 17 * s, 0, Math.PI * 2);
  c.arc(x - 13 * s, y + 2 * s, 12 * s, 0, Math.PI * 2);
  c.arc(x + 13 * s, y + 2 * s, 12 * s, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#3f9c49';
  c.beginPath();
  c.arc(x - 3 * s, y - 11 * s, 11 * s, 0, Math.PI * 2);
  c.arc(x + 9 * s, y - 2 * s, 8 * s, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#55b85c';
  c.beginPath(); c.arc(x - 6 * s, y - 14 * s, 6 * s, 0, Math.PI * 2); c.fill();
  c.restore();
}

function pylon(c, x, groundY) {
  const h = 78;
  px(c, x, groundY - h, 4, h, '#6d7590');
  px(c, x, groundY - h, 2, h, '#8b93ad');
  px(c, x - 12, groundY - h - 16, 28, 16, '#59617a');
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      px(c, x - 10 + i * 9, groundY - h - 14 + j * 7, 7, 5, '#fdf3cd');
}

// ═══════════════════════════════════════════════════════════════════════════
// TITLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * THE STUDIO.
 *
 * A Saturday-afternoon sports programme: monitor stack on the left, the set's
 * backdrop with its orbiting graphic behind, the production gallery working
 * away in the background, and the host at the desk. This is the frame the
 * whole game sits inside — he introduces every rung, so the opening shot had
 * better be his studio.
 *
 * It is a pastiche of a genre, not of any particular programme: the station
 * ident is our own and no real broadcaster's marks appear anywhere.
 */
export function drawTitleScene(ctx, t, host, talking = false) {
  // ── the cyclorama ──
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#0b1f52');
  g.addColorStop(0.55, '#13327d');
  g.addColorStop(1, '#091634');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Orbiting set graphics pushed out to the corners, so the wordmark and the
  // host both sit in clear air.
  atom(ctx, 62, 48, 34, t);
  atom(ctx, 418, 42, 29, t * 0.8);

  setLogo(ctx, VIEW_W / 2, 44, t);
  drawMonitorStack(ctx, 4, 106, t);
  drawGallery(ctx, 334, 112, t);

  // ── the host, framed head-and-shoulders behind his desk ──
  const hx = Math.round(VIEW_W / 2 - PRESENTER_W);      // scale 2
  drawPresenter(ctx, host, hx, 96, 2, t, talking);

  drawDesk(ctx, 212);
}

/** The set's orbiting graphic — every sports programme had one. */
function atom(c, cx, cy, r, t) {
  c.save();
  c.globalAlpha = 0.5;
  const glow = c.createRadialGradient(cx, cy, 2, cx, cy, r * 1.4);
  glow.addColorStop(0, 'rgba(120,190,255,0.5)');
  glow.addColorStop(1, 'rgba(120,190,255,0)');
  c.fillStyle = glow;
  c.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);
  c.globalAlpha = 0.85;
  c.strokeStyle = '#7cc0ff';
  c.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    c.save();
    c.translate(cx, cy);
    c.rotate((i * Math.PI) / 3 + t / 180);
    c.beginPath();
    c.ellipse(0, 0, r, r * 0.36, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  c.globalAlpha = 1;
  c.beginPath();
  c.arc(cx, cy, 5, 0, Math.PI * 2);
  c.fillStyle = '#d6ecff';
  c.fill();
  c.restore();
}

/** The programme's name, up on the set behind him. Doubles as the title. */
function setLogo(c, cx, y, t) {
  const pulse = 0.82 + Math.sin(t / 50) * 0.08;
  c.save();
  c.textAlign = 'center';
  // glow behind the letters
  c.globalAlpha = pulse * 0.35;
  const gl = c.createRadialGradient(cx, y - 7, 4, cx, y - 7, 150);
  gl.addColorStop(0, 'rgba(140,200,255,0.85)');
  gl.addColorStop(1, 'rgba(140,200,255,0)');
  c.fillStyle = gl;
  c.fillRect(cx - 160, y - 42, 320, 70);
  c.globalAlpha = 1;

  c.font = '26px "Press Start 2P", monospace';
  c.fillStyle = '#061436';
  c.fillText('GRANDSTAND', cx + 3, y + 3);
  c.fillStyle = '#2f5fa8';
  c.fillText('GRANDSTAND', cx + 1, y + 1);
  c.fillStyle = '#ffd24a';
  c.fillText('GRANDSTAND', cx, y);

  c.font = '8px "Press Start 2P", monospace';
  c.fillStyle = '#07152f';
  c.fillText('TRIVIA ATHLETIC', cx + 1, y + 21);
  c.fillStyle = '#bcd8f8';
  c.fillText('TRIVIA ATHLETIC', cx, y + 20);
  c.restore();
}

/** Bank of CRTs, each showing its own flickering nonsense. */
function drawMonitorStack(c, x, y, t) {
  const W = 58, H = 42;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const mx = x + col * (W + 4), my = y + row * (H + 4);
      px(c, mx, my, W, H, '#1b1b26');
      px(c, mx, my, W, 2, '#3a3a4e');
      const sx = mx + 4, sy = my + 4, sw = W - 8, sh = H - 10;
      const tint = ['#1f5e3a', '#5a2f2f', '#2c3f70', '#5a4a1f'][(row * 2 + col) % 4];
      px(c, sx, sy, sw, sh, tint);
      // a crowd-ish blur of moving blocks, so the screens look live
      for (let i = 0; i < 7; i++) {
        const bx = sx + (((i * 13 + Math.floor(t / 4) + row * 7) % sw));
        px(c, bx, sy + 3 + ((i * 5) % (sh - 6)), 4, 3, highlight(tint, 1.3));
      }
      px(c, sx, sy + ((Math.floor(t / 2) * 3) % sh), sw, 1, 'rgba(255,255,255,0.16)');
      px(c, mx + 2, my + H - 4, W - 4, 2, '#2a2a38');
    }
  }
}

/** The gallery: people at desks, still working while he talks. */
function drawGallery(c, x, y, t) {
  const SKIN = ['#e8b48a', '#7a4a21', '#f0c49b', '#5a3418', '#e8a878'];
  const HAIR = ['#3a2a18', '#1a1a1a', '#6b5a3a', '#2a2018', '#9a9a9a'];
  const TOP = ['#2f3a55', '#46324f', '#2c4a46', '#4a3a2c', '#38384a'];
  for (let i = 0; i < 4; i++) {
    const gx = x + 4 + i * 34;
    const gy = y + 18 + (i % 2) * 7;
    const lean = Math.sin(t / 38 + i * 2.1) > 0.75 ? 1 : 0;
    px(c, gx + 2 + lean, gy + 6, 16, 16, TOP[i % 5]);          // shoulders
    px(c, gx + 2 + lean, gy + 6, 5, 16, shadow(TOP[i % 5], 1));
    px(c, gx + 6 + lean, gy - 4, 9, 10, SKIN[i % 5]);          // head
    px(c, gx + 6 + lean, gy - 6, 9, 4, HAIR[i % 5]);           // hair
    px(c, gx + 8 + lean, gy + 1, 2, 1, '#2a2436');             // a suggestion of a face
    px(c, gx + 12 + lean, gy + 1, 2, 1, '#2a2436');
  }
  // the desk they are all sitting at, with monitor glow coming off it
  px(c, x, y + 30, VIEW_W - x, 5, '#2a4272');
  px(c, x, y + 30, VIEW_W - x, 2, '#4f73ad');
  px(c, x, y + 35, VIEW_W - x, 24, '#101f3f');
  for (let i = 0; i < 4; i++) {
    const mx = x + 8 + i * 34;
    px(c, mx, y + 21, 14, 11, '#16294d');
    px(c, mx + 1, y + 22, 12, 8, i % 2 ? '#2f5f8f' : '#2f7f6f');
    px(c, mx + 2, y + 23 + ((Math.floor(t / 6) + i) % 6), 10, 1, 'rgba(255,255,255,0.22)');
  }
}

/** The desk the whole programme is presented from. */
function drawDesk(c, y) {
  const g = c.createLinearGradient(0, y, 0, VIEW_H);
  g.addColorStop(0, '#2b3f6b');
  g.addColorStop(0.18, '#1b2a4d');
  g.addColorStop(1, '#0d1730');
  c.fillStyle = g;
  c.fillRect(0, y, VIEW_W, VIEW_H - y);
  px(c, 0, y, VIEW_W, 3, '#5a7fc0');
  px(c, 0, y + 3, VIEW_W, 2, '#16254a');
  // a sheaf of running order on the desk
  px(c, 300, y + 12, 44, 26, '#e8e6dd');
  px(c, 300, y + 12, 44, 2, '#ffffff');
  for (let i = 0; i < 4; i++) px(c, 305, y + 18 + i * 5, 32, 1, '#9aa0b0');
  px(c, 118, y + 16, 30, 20, '#dcdad2');
  px(c, 118, y + 16, 30, 2, '#ffffff');
}

export function drawTitleWordmark(ctx, t) {
  const bounce = Math.round(Math.sin(t / 34) * 2);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '26px "Press Start 2P", monospace';
  ctx.fillStyle = '#7a1f1a'; ctx.fillText('GRANDSTAND', VIEW_W / 2 + 3, 46 + bounce);
  ctx.fillStyle = '#c9403a'; ctx.fillText('GRANDSTAND', VIEW_W / 2 + 1, 44 + bounce);
  ctx.fillStyle = '#ffd24a'; ctx.fillText('GRANDSTAND', VIEW_W / 2, 42 + bounce);
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillStyle = '#1a1424'; ctx.fillText('TRIVIA ATHLETIC', VIEW_W / 2 + 1, 66 + bounce);
  ctx.fillStyle = '#e8e3f5'; ctx.fillText('TRIVIA ATHLETIC', VIEW_W / 2, 65 + bounce);
  ctx.restore();
}

export { drawPortrait, drawFace };

/**
 * Seconds out. Drawn between the two fighters, where you are already looking.
 * `p` is 0..1 progress through the current beat: the number pops in oversized
 * and settles, then fades, so each beat reads as a distinct count rather than
 * a number quietly changing.
 */
export function drawCountdown(ctx, label, p, isGo) {
  const cx = VIEW_W / 2, cy = 152;
  const pop = 1 + Math.max(0, 0.75 - p * 2.6);
  const fade = p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1;

  // A solid backing, not a wash: the crowd behind is busy and high-contrast,
  // and a number that competes with it is a number nobody reads in time.
  ctx.save();
  ctx.globalAlpha = 0.92 * fade;
  const ring = ctx.createRadialGradient(cx, cy - 15, 6, cx, cy - 15, 52);
  ring.addColorStop(0, 'rgba(8,6,16,0.96)');
  ring.addColorStop(0.6, 'rgba(8,6,16,0.82)');
  ring.addColorStop(1, 'rgba(8,6,16,0)');
  ctx.fillStyle = ring;
  ctx.fillRect(cx - 56, cy - 70, 112, 112);
  ctx.restore();

  // No caption. "3 - 2 - 1" explains itself, and every attempt at a label
  // either collided with the far fighter or washed out against the crowd.
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.font = `${isGo ? 20 : 42}px "Press Start 2P", monospace`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0d0a18';
  ctx.strokeText(label, 0, 0);
  ctx.fillStyle = isGo ? '#ff7a6e' : '#ffd24a';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}
