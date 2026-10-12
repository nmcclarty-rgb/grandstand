/**
 * GRANDSTAND — scene rendering.
 *
 * Internal resolution is 480x270. Sprites stay crisp and pixel-snapped;
 * backgrounds use gradients and curves. That mix is deliberate — the look we
 * want is a 90s arcade cabinet, where hand-drawn characters sit on painted
 * backdrops, not an 8-bit console where everything is the same chunky grid.
 */

import { drawFighter, drawPortrait, drawFace, drawGroundShadow,
         SPRITE_W, SPRITE_H, PORTRAIT_W, PORTRAIT_H } from './sprites.js';
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

const VENUE_LOOK = {
  'THE REC':               { ground: '#2c8f4a', alt: '#248040', sky: ['#4a6fb5', '#89a8d8'], crowd: true },
  'THE LEISURE CENTRE':    { ground: '#3f7fae', alt: '#37729e', sky: ['#2b2448', '#4a3f6e'], crowd: false },
  'THE ATHLETICS TRACK':   { ground: '#b24a2c', alt: '#a04227', sky: ['#3d63a8', '#7e9fd0'], crowd: true },
  'THE SNOOKER CLUB':      { ground: '#1a7046', alt: '#16613d', sky: ['#1b1530', '#2e2450'], crowd: false },
  'THE TENNIS COURTS':     { ground: '#3e6fa8', alt: '#376298', sky: ['#4a6fb5', '#9dbbe0'], crowd: true },
  'THE MUNICIPAL LINKS':   { ground: '#4a9a42', alt: '#40883a', sky: ['#4f7cc0', '#a9c4e4'], crowd: false },
  'THE SPORTS HALL':       { ground: '#c08a48', alt: '#ad7b3f', sky: ['#241d3c', '#3a3057'], crowd: true },
  'THE PADDOCK':           { ground: '#5e6072', alt: '#545667', sky: ['#2b3446', '#4d5a71'], crowd: true },
  'THE COUNTY GROUND':     { ground: '#3a9450', alt: '#328446', sky: ['#4f7cc0', '#a9c4e4'], crowd: true },
  'THE OLD BATHS':         { ground: '#2f7fa8', alt: '#2a7197', sky: ['#1f2b40', '#3c4d6b'], crowd: false },
  'THE VELODROME':         { ground: '#9a6a3c', alt: '#8a5e35', sky: ['#1d1832', '#332a52'], crowd: true },
  'THE MAIN ARENA':        { ground: '#2c8f4a', alt: '#248040', sky: ['#120f24', '#2a2148'], crowd: true },
};

export function drawBattleScene(ctx, s, t) {
  const look = VENUE_LOOK[s.venue] || VENUE_LOOK['THE REC'];
  const HORIZON = 150;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, look.sky[0]);
  sky.addColorStop(1, look.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, HORIZON);

  if (look.crowd) drawCrowd(ctx, HORIZON - 92, 92, t);
  else drawInteriorWall(ctx, HORIZON - 92, 92);

  // ground, receding bands
  for (let y = HORIZON; y < VIEW_H; y += 7) {
    const band = ((y - HORIZON) / 7) | 0;
    px(ctx, 0, y, VIEW_W, 7, band % 2 ? look.ground : look.alt);
  }
  px(ctx, 0, HORIZON, VIEW_W, 3, '#0d0a18');
  px(ctx, 0, HORIZON + 3, VIEW_W, 1, highlight(look.ground, 0.5));

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

function drawInteriorWall(c, top, h) {
  px(c, 0, top, VIEW_W, h, '#2a2340');
  px(c, 0, top, VIEW_W, 5, '#191330');
  for (let x = 8; x < VIEW_W; x += 52) {
    px(c, x, top + 16, 34, 26, '#3b3257');
    px(c, x, top + 16, 34, 3, '#4d4370');
    px(c, x + 3, top + 20, 28, 3, '#5c5185');
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

  const PW = 146, PH = 214, PY = 22;

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

  textShadowed(ctx, 'PLAYER SELECT', VIEW_W / 2, 214, '13px "Press Start 2P", monospace', '#ffd24a');
  const blink = Math.sin(t / 12) > -0.2;
  if (blink) {
    textShadowed(ctx, s.hint || 'PICK YOUR FIGHTER', VIEW_W / 2, 236,
      '8px "Press Start 2P", monospace', '#e8e3f5');
  }

  textShadowed(ctx, '1P', 22, 28, '11px "Press Start 2P", monospace', '#4ade80', '#1a1424', 'left');
  textShadowed(ctx, 'CPU', VIEW_W - 22, 28, '11px "Press Start 2P", monospace', '#f87171', '#1a1424', 'right');
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
  [KIND.BONUS]:  { col: '#e0b040', label: '★' },
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

export function drawTitleScene(ctx, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, 170);
  sky.addColorStop(0, '#0d0a1e');
  sky.addColorStop(1, '#2b2151');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  for (let i = 0; i < 60; i++) {
    const x = (i * 71) % VIEW_W, y = (i * 37) % 96;
    if (Math.sin(t / 28 + i) > 0.25) px(ctx, x, y, 2, 2, '#6f63a0');
  }

  drawCrowd(ctx, 96, 74, t);

  for (let y = 170; y < VIEW_H; y += 8) {
    px(ctx, 0, y, VIEW_W, 8, ((y - 170) / 8) % 2 ? '#2c8f4a' : '#248040');
  }
  px(ctx, 0, 170, VIEW_W, 3, '#0d0a18');

  // floodlight cones
  ctx.save();
  ctx.globalAlpha = 0.1 + Math.sin(t / 40) * 0.025;
  ctx.fillStyle = '#fff7d6';
  ctx.beginPath(); ctx.moveTo(44, 62); ctx.lineTo(-40, VIEW_H); ctx.lineTo(200, VIEW_H); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(436, 62); ctx.lineTo(280, VIEW_H); ctx.lineTo(520, VIEW_H); ctx.closePath(); ctx.fill();
  ctx.restore();
  px(ctx, 36, 54, 16, 9, '#fdf3cd');
  px(ctx, 428, 54, 16, 9, '#fdf3cd');
  px(ctx, 42, 63, 3, 20, '#59617a');
  px(ctx, 434, 63, 3, 20, '#59617a');
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
