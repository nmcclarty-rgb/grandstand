/**
 * GRANDSTAND — sprites.
 *
 * Generated rather than hand-drawn, but aiming at 16-bit arcade rather than
 * 8-bit console. Four things do that work:
 *
 *   1. Every colour is a five-tone ramp (palette.js), so bodies have form —
 *      cool shadow down one side, warm highlight down the other.
 *   2. Silhouettes are built from ROW PROFILES, not rectangles. A head is a
 *      rounded cranium tapering to a jaw; a torso is a V from shoulder to
 *      waist. Rectangular silhouettes are what make generated art look
 *      generated.
 *   3. Every sprite gets an automatic 1px ink outline traced from its own
 *      silhouette after drawing.
 *   4. Everything is rendered once into an offscreen canvas and cached, so we
 *      can afford the detail and the read-back the outline needs.
 *
 * Fighters are 48x64, drawn at 2x in battle. Portraits are 72x96.
 */

import { ramp, shadow, highlight, mix, INK } from './palette.js';

export const SPRITE_W = 48;
export const SPRITE_H = 64;
export const PORTRAIT_W = 72;
export const PORTRAIT_H = 108;

export const POSE = { IDLE: 'idle', STRIKE: 'strike', GUARD: 'guard' };

const HALF = { lean: 9, normal: 10, heavy: 13 };

/**
 * Half-widths, top to bottom, of a head: rounded crown, full at the temples,
 * tapering through the cheek to the chin. 17 rows.
 */
const HEAD_PROFILE = [4, 6, 7, 8, 8, 8, 8, 8, 8, 8, 8, 7, 7, 6, 6, 5, 3];

/** Torso half-widths as a fraction of the build width: broad shoulders, tucked waist. */
const TORSO_TAPER = [1.30, 1.34, 1.32, 1.24, 1.16, 1.10, 1.05, 1.01, 0.98,
                     0.95, 0.93, 0.92, 0.92, 0.94, 0.97, 1.00, 1.02, 1.03];

// ── offscreen plumbing ─────────────────────────────────────────────────────
function surface(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x };
}

const px = (x, a, b, w, h, col) => {
  if (w <= 0 || h <= 0) return;
  x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h));
};

/**
 * Fill a row-profile shape with a tone ramp: shadow down the left edge, base
 * through the middle, highlight down the right. This is the whole modelling
 * technique in one function.
 */
function fillProfile(x, cx, top, profile, tone, s = 1, opts = {}) {
  const { shadeW = 3, lightW = 2, capTop = true } = opts;
  profile.forEach((hw, i) => {
    const w = hw * 2 * s, left = cx - hw * s, y = top + i * s;
    if (w <= 0) return;
    px(x, left, y, w, s, tone.base);
    px(x, left, y, Math.min(shadeW * s, w), s, tone.dark);
    if (w > (shadeW + lightW) * s) {
      px(x, left + w - lightW * s, y, lightW * s, s, tone.light);
    }
    if (capTop && i === 0) px(x, left + s, y, Math.max(0, w - 2 * s), s, tone.light);
  });
}

/** Trace the silhouette and ink it. Runs once per cached variant. */
function inkOutline(x, w, h, col = INK) {
  const d = x.getImageData(0, 0, w, h).data;
  const solid = (i) => d[i * 4 + 3] > 8;
  x.fillStyle = col;
  for (let y = 0; y < h; y++) {
    for (let a = 0; a < w; a++) {
      const i = y * w + a;
      if (solid(i)) continue;
      if ((a > 0 && solid(i - 1)) || (a < w - 1 && solid(i + 1)) ||
          (y > 0 && solid(i - w)) || (y < h - 1 && solid(i + w))) {
        x.fillRect(a, y, 1, 1);
      }
    }
  }
}

function flashWhite(x, w, h) {
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(255,255,255,0.86)';
  x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
}

// ── feature sets ───────────────────────────────────────────────────────────
export const HAIR = ['flattop', 'mullet', 'spiky', 'curly', 'bald', 'bowl', 'receding', 'perm', 'ponytail'];
export const FACIAL = ['none', 'tash', 'beard', 'stubble', 'chops'];
export const BROW = ['angry', 'neutral', 'raised'];

function featuresOf(f) {
  let h = 0;
  for (const ch of String(f.id || f.name || 'x')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    hair: f.hair || HAIR[h % HAIR.length],
    facial: f.facial || FACIAL[(h >> 3) % FACIAL.length],
    brow: f.brow || BROW[(h >> 6) % BROW.length],
    band: f.band || null,     // headband / sweatband colour
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HEAD — shared by the battle sprite (s=1) and the portrait (s=3)
// ═══════════════════════════════════════════════════════════════════════════

function drawHead(x, cx, top, skin, hair, feat, s = 1) {
  const H = HEAD_PROFILE.length;
  const row = (i) => top + i * s;
  const halfAt = (i) => HEAD_PROFILE[i] * s;

  // ── ears, behind the face ──
  px(x, cx - halfAt(7) - 2 * s, row(7), 2 * s, 4 * s, skin.dark);
  px(x, cx + halfAt(7), row(7), 2 * s, 4 * s, skin.base);
  px(x, cx + halfAt(7), row(8), 2 * s, 2 * s, skin.dark);

  // ── the face itself ──
  fillProfile(x, cx, top, HEAD_PROFILE, skin, s, { shadeW: 3, lightW: 2 });
  // temple and cheekbone shading
  px(x, cx - halfAt(9) + s, row(10), 2 * s, 3 * s, shadow(skin.base, 0.55));
  px(x, cx + halfAt(9) - 3 * s, row(10), 2 * s, 3 * s, skin.light);
  // under the jaw
  px(x, cx - halfAt(H - 2), row(H - 2), halfAt(H - 2) * 2, s, skin.dark);

  const L = cx - 8 * s;   // left edge at full width, for feature placement

  // ── eyes ──
  const eyeY = row(7);
  px(x, L + 2 * s, eyeY - s, 5 * s, 4 * s, shadow(skin.base, 0.7));   // socket
  px(x, L + 9 * s, eyeY - s, 5 * s, 4 * s, shadow(skin.base, 0.45));
  px(x, L + 3 * s, eyeY, 4 * s, 3 * s, '#f2eee6');
  px(x, L + 10 * s, eyeY, 4 * s, 3 * s, '#fbf8f2');
  px(x, L + 4 * s, eyeY, 2 * s, 3 * s, '#3a2a5c');                    // iris
  px(x, L + 11 * s, eyeY, 2 * s, 3 * s, '#3a2a5c');
  px(x, L + 4 * s, eyeY + s, s, s, '#0d0a18');                        // pupil
  px(x, L + 11 * s, eyeY + s, s, s, '#0d0a18');
  if (s >= 2) {                                                        // catchlight
    px(x, L + 5 * s, eyeY, s, s, '#ffffff');
    px(x, L + 12 * s, eyeY, s, s, '#ffffff');
  }

  // ── brows: the entire expression ──
  const browY = eyeY - 3 * s;
  const brow = shadow(hair.base, 0.5);
  if (feat.brow === 'angry') {
    px(x, L + 2 * s, browY, 5 * s, 2 * s, brow);
    px(x, L + 10 * s, browY, 5 * s, 2 * s, brow);
    px(x, L + 6 * s, browY + s, 2 * s, 2 * s, brow);
    px(x, L + 9 * s, browY + s, 2 * s, 2 * s, brow);
  } else if (feat.brow === 'raised') {
    px(x, L + 2 * s, browY - s, 5 * s, 2 * s, brow);
    px(x, L + 10 * s, browY, 5 * s, 2 * s, brow);
  } else {
    px(x, L + 2 * s, browY, 5 * s, 2 * s, brow);
    px(x, L + 10 * s, browY, 5 * s, 2 * s, brow);
  }

  // ── nose ──
  const noseY = eyeY + 3 * s;
  px(x, L + 7 * s, noseY, 3 * s, 3 * s, skin.dark);
  px(x, L + 7 * s, noseY, s, 3 * s, shadow(skin.base, 1.35));
  px(x, L + 8 * s, noseY, 2 * s, 2 * s, skin.light);
  px(x, L + 7 * s, noseY + 3 * s, 3 * s, s, shadow(skin.base, 1.1));

  // ── mouth ──
  const mY = row(13);
  px(x, L + 5 * s, mY, 6 * s, s, shadow(skin.base, 1.95));
  px(x, L + 5 * s, mY + s, 6 * s, s, skin.light);

  drawFacialHair(x, L, top, s, feat, skin, hair, mY);
  drawHair(x, cx, top, s, feat, hair, halfAt);
  if (feat.band) drawBand(x, cx, row(3), s, feat.band, halfAt(3));
}

function drawBand(x, cx, y, s, col, half) {
  const b = ramp(col);
  px(x, cx - half - s, y, half * 2 + 2 * s, 3 * s, b.base);
  px(x, cx - half - s, y, half * 2 + 2 * s, s, b.light);
  px(x, cx - half - s, y + 2 * s, half * 2 + 2 * s, s, b.dark);
}

function drawFacialHair(x, L, top, s, feat, skin, hair, mY) {
  const h = shadow(hair.base, 0.3);
  switch (feat.facial) {
    case 'tash':
      px(x, L + 5 * s, mY - 2 * s, 6 * s, 2 * s, h);
      px(x, L + 5 * s, mY - 2 * s, 6 * s, s, hair.base);
      break;
    case 'beard':
      // tapered: wide at the jaw, narrow at the chin, with the mouth cut back in
      px(x, L + 2 * s, mY - 2 * s, 12 * s, 2 * s, h);
      px(x, L + 3 * s, mY, 10 * s, 2 * s, h);
      px(x, L + 4 * s, mY + 2 * s, 8 * s, 2 * s, h);
      px(x, L + 5 * s, mY + 4 * s, 6 * s, 2 * s, shadow(hair.base, 0.9));
      px(x, L + 2 * s, mY - 2 * s, 2 * s, 5 * s, shadow(hair.base, 1.3));
      px(x, L + 5 * s, mY, 6 * s, s, shadow(skin.base, 1.95));      // the mouth, still readable
      px(x, L + 5 * s, mY + s, 6 * s, s, skin.light);
      break;
    case 'stubble':
      px(x, L + 3 * s, mY - s, 10 * s, 5 * s, mix(skin.dark, h, 0.45));
      px(x, L + 5 * s, mY, 6 * s, s, shadow(skin.base, 1.95));
      px(x, L + 5 * s, mY + s, 6 * s, s, skin.light);
      break;
    case 'chops':
      px(x, L + s, top + 6 * s, 2 * s, 8 * s, h);
      px(x, L + 13 * s, top + 6 * s, 2 * s, 8 * s, h);
      break;
    default: break;
  }
}

function drawHair(x, cx, top, s, feat, hair, halfAt) {
  const style = feat.hair;
  const crown = top - s;
  /** Sideburns and long hair that follow the skull edge rather than float beside it. */
  const side = (row, len, wide, tone) => {
    const h = halfAt(row);
    px(x, cx - h - s, top + row * s, (wide + 1) * s, len * s, tone.dark);
    px(x, cx + h - wide * s + s, top + row * s, (wide + 1) * s, len * s, tone.base);
  };
  switch (style) {
    case 'flattop':
      px(x, cx - 8 * s, crown - 5 * s, 16 * s, 7 * s, hair.base);
      px(x, cx - 8 * s, crown - 5 * s, 16 * s, 2 * s, hair.light);
      px(x, cx - 8 * s, crown - 5 * s, 3 * s, 7 * s, hair.dark);
      px(x, cx + 5 * s, crown - 4 * s, 3 * s, 6 * s, hair.lightest);
      px(x, cx - 8 * s, crown + s, 2 * s, 4 * s, hair.dark);
      px(x, cx + 6 * s, crown + s, 2 * s, 4 * s, hair.base);
      break;
    case 'mullet':
      px(x, cx - 7 * s, crown - 3 * s, 14 * s, 5 * s, hair.base);
      px(x, cx - 6 * s, crown - 4 * s, 12 * s, 2 * s, hair.light);
      // The business at the back has to stay at the back: drawn over the chin
      // it reads as a beard, which is a different decade entirely.
      side(3, 13, 2, hair);
      break;
    case 'spiky': {
      // Irregular heights and a lean, or five even spikes read as a crown.
      px(x, cx - 8 * s, crown - 2 * s, 16 * s, 4 * s, hair.base);
      px(x, cx - 8 * s, crown - 2 * s, 16 * s, s, hair.light);
      const heights = [3, 6, 4, 7, 5, 3];
      const leans = [-1, 0, 0, 1, 1, 2];
      for (let i = 0; i < heights.length; i++) {
        const bx = cx - 8 * s + i * Math.round(2.7 * s);
        const hgt = heights[i] * s;
        px(x, bx, crown - 2 * s - hgt, 2 * s, hgt + s, hair.base);
        px(x, bx + leans[i] * s, crown - 2 * s - hgt, 2 * s, Math.round(hgt * 0.6), hair.dark);
        px(x, bx + leans[i] * s, crown - 2 * s - hgt, s, Math.round(hgt * 0.4), hair.light);
      }
      break;
    }
    case 'curly':
    case 'perm':
      px(x, cx - 9 * s, crown - 4 * s, 18 * s, 7 * s, hair.base);
      for (let i = 0; i < 6; i++) {
        px(x, cx - 9 * s + i * 3 * s, crown - (4 + (i % 3)) * s, 3 * s, 3 * s,
           i % 2 ? hair.light : hair.dark);
      }
      side(4, 6, 2, hair);
      break;
    case 'bald':
      // A bald head is a lit scalp, not a hat: highlight the crown only.
      px(x, cx - 5 * s, top + s, 9 * s, 2 * s, highlight(hair.base, 0.15));
      px(x, cx - 3 * s, top, 5 * s, 2 * s, '#ffffff30');
      px(x, cx - halfAt(5) - s, top + 4 * s, 2 * s, 5 * s, hair.dark);
      break;
    case 'bowl':
      px(x, cx - 9 * s, crown - 3 * s, 18 * s, 9 * s, hair.base);
      px(x, cx - 9 * s, crown - 3 * s, 18 * s, 2 * s, hair.light);
      px(x, cx - 9 * s, crown - 3 * s, 3 * s, 9 * s, hair.dark);
      break;
    case 'receding':
      px(x, cx - 7 * s, crown - 2 * s, 14 * s, 3 * s, hair.base);
      px(x, cx - 3 * s, crown - 2 * s, 6 * s, 2 * s, shadow(hair.base, 2.4));
      side(3, 7, 2, hair);
      break;
    case 'ponytail':
      px(x, cx - 8 * s, crown - 3 * s, 16 * s, 5 * s, hair.base);
      px(x, cx - 8 * s, crown - 3 * s, 16 * s, 2 * s, hair.light);
      px(x, cx - halfAt(5) - 3 * s, top + 4 * s, 3 * s, 8 * s, hair.dark);
      break;
    default:
      px(x, cx - 8 * s, crown - 3 * s, 16 * s, 5 * s, hair.base);
      px(x, cx - 8 * s, crown - 3 * s, 16 * s, 2 * s, hair.light);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIGHTER SPRITE
// ═══════════════════════════════════════════════════════════════════════════

const spriteCache = new Map();

// Vertical layout of a 48x64 fighter. Torso long, legs short: heroic, not chibi.
const HEAD_TOP = 4;
const NECK_Y = 20;
const TORSO_Y = 23;
const TORSO_H = TORSO_TAPER.length;      // 18
const SHORTS_Y = TORSO_Y + TORSO_H;      // 41
const LEG_Y = SHORTS_Y + 7;              // 48
const BOOT_Y = 57;

function renderSprite(f, pose, frame, flash) {
  const { c, x } = surface(SPRITE_W, SPRITE_H);
  const p = f.palette || {};
  const skin = ramp(p.skin || '#f0c49b');
  const kit = ramp(p.kit || '#1d4ed8');
  const hair = ramp(p.hair || '#4b2e13');
  const trim = p.trim || '#facc15';
  const trimR = ramp(trim);
  const feat = featuresOf(f);
  const W = HALF[f.build] || HALF.normal;
  const CX = SPRITE_W / 2;

  const bob = pose === POSE.IDLE ? [0, -1, -1, 0][frame % 4] : 0;

  // ── legs ────────────────────────────────────────────────────────────
  const legY = LEG_Y + bob;
  const drawLeg = (lx, lit) => {
    px(x, lx, legY, 7, 9, skin.base);
    px(x, lx, legY, 2, 9, skin.dark);
    px(x, lx + 5, legY, 2, 8, lit ? skin.light : skin.base);
    px(x, lx + 1, legY + 9, 6, 5, skin.base);       // calf
    px(x, lx + 1, legY + 9, 2, 5, skin.dark);
  };
  drawLeg(CX - W + 1, false);
  drawLeg(CX + W - 8, true);
  // boots
  const bootY = BOOT_Y + bob;
  px(x, CX - W, bootY, 9, 7, '#2b2334');
  px(x, CX - W, bootY, 9, 2, '#544868');
  px(x, CX - W, bootY + 6, 9, 1, trim);
  px(x, CX + W - 9, bootY, 10, 7, '#332a3f');
  px(x, CX + W - 9, bootY, 10, 2, '#645675');
  px(x, CX + W - 9, bootY + 6, 10, 1, trim);

  // ── shorts ──────────────────────────────────────────────────────────
  const shY = SHORTS_Y + bob;
  px(x, CX - W - 1, shY, W * 2 + 2, 8, kit.dark);
  px(x, CX - W - 1, shY, 3, 8, kit.darkest);
  px(x, CX + W - 3, shY, 3, 7, kit.base);
  px(x, CX - W - 1, shY, W * 2 + 2, 2, trimR.base);
  px(x, CX - W - 1, shY, W * 2 + 2, 1, trimR.light);
  px(x, CX - 1, shY + 3, 2, 5, kit.darkest);

  // ── torso ───────────────────────────────────────────────────────────
  const tY = TORSO_Y + bob;
  const torsoProfile = TORSO_TAPER.map((k) => Math.round(W * k));
  fillProfile(x, CX, tY, torsoProfile, kit, 1, { shadeW: 4, lightW: 3 });
  px(x, CX - 2, tY + 2, 4, TORSO_H - 4, trimR.base);        // centre stripe
  px(x, CX - 2, tY + 2, 2, TORSO_H - 4, trimR.light);
  px(x, CX - 6, tY, 12, 2, trimR.base);                     // collar
  px(x, CX - W, tY + TORSO_H - 3, W * 2, 2, kit.darkest);   // waistband shadow

  // ── arms ────────────────────────────────────────────────────────────
  const shoulder = tY + 2;
  const armX = Math.round(W * TORSO_TAPER[1]);
  const drawArm = (ax, lit, len) => {
    px(x, ax, shoulder, 6, 8, kit.base);                    // sleeve
    px(x, ax, shoulder, 6, 2, lit ? kit.lightest : kit.light);
    px(x, ax, shoulder, 2, 8, lit ? kit.base : kit.darkest);
    px(x, ax + 1, shoulder + 8, 5, len, skin.base);         // arm
    px(x, ax + 1, shoulder + 8, 2, len, lit ? skin.base : skin.dark);
    px(x, ax + 4, shoulder + 8, 2, len - 2, lit ? skin.light : skin.base);
  };

  if (pose === POSE.STRIKE) {
    drawArm(CX - armX - 5, false, 9);
    px(x, CX + armX - 2, shoulder, 7, 8, kit.light);
    px(x, CX + armX + 4, shoulder + 2, 12, 6, skin.base);
    px(x, CX + armX + 4, shoulder + 2, 12, 2, skin.light);
    px(x, CX + armX + 14, shoulder, 7, 9, skin.base);       // fist
    px(x, CX + armX + 14, shoulder, 7, 3, skin.light);
    px(x, CX + armX + 14, shoulder + 7, 7, 2, skin.dark);
  } else if (pose === POSE.GUARD) {
    px(x, CX - armX - 4, shoulder + 3, 7, 13, skin.base);
    px(x, CX - armX - 4, shoulder + 3, 2, 13, skin.dark);
    px(x, CX + armX - 3, shoulder + 3, 7, 13, skin.base);
    px(x, CX + armX - 3, shoulder + 3, 7, 3, skin.light);
  } else {
    drawArm(CX - armX - 5, false, 12);
    drawArm(CX + armX - 1, true, 12);
  }

  // ── neck ────────────────────────────────────────────────────────────
  px(x, CX - 5, NECK_Y + bob, 10, 5, skin.base);
  px(x, CX - 5, NECK_Y + bob, 10, 3, shadow(skin.base, 1.5));

  // ── head ────────────────────────────────────────────────────────────
  drawHead(x, CX, HEAD_TOP + bob, skin, hair, feat, 1);

  drawGear(x, f.gear, CX, W, armX, bob, pose, { skin, kit, trim: trimR });

  if (flash) flashWhite(x, SPRITE_W, SPRITE_H);
  inkOutline(x, SPRITE_W, SPRITE_H);
  return c;
}

function drawGear(x, gear, CX, W, armX, bob, pose, cols) {
  const { skin, trim } = cols;
  // Anchor on the actual hand: shoulder + sleeve + forearm, less a little.
  const handY = TORSO_Y + 2 + 8 + 12 - 4 + bob;
  const handX = CX + armX + (pose === POSE.STRIKE ? 14 : 0);
  switch (gear) {
    case 'gloves': {
      const g = ramp('#c9302c');
      px(x, handX - 1, handY - 2, 10, 10, g.base);
      px(x, handX - 1, handY - 2, 10, 3, g.light);
      px(x, handX - 1, handY + 6, 10, 2, g.dark);
      px(x, handX, handY - 1, 3, 3, g.lightest);
      px(x, CX - armX - 9, handY + 3, 9, 9, g.base);
      px(x, CX - armX - 9, handY + 3, 9, 2, g.light);
      px(x, CX - armX - 9, handY + 10, 9, 2, g.dark);
      break;
    }
    case 'cue':
      px(x, CX + armX - 14, handY - 18, 2, 36, '#c8a06a');
      px(x, CX + armX - 14, handY - 18, 1, 36, '#e0bd88');
      px(x, CX + armX - 14, handY - 18, 2, 7, '#2b2334');
      break;
    case 'bat':
      px(x, handX + 1, handY - 18, 7, 19, '#e8c48a');
      px(x, handX + 1, handY - 18, 2, 19, '#c9a067');
      px(x, handX + 6, handY - 18, 1, 19, '#f5deb8');
      px(x, handX + 2, handY + 1, 4, 12, '#8a5524');
      break;
    case 'racket':
      px(x, handX, handY - 22, 12, 14, '#eef2f7');
      px(x, handX + 2, handY - 20, 8, 10, '#3a4a63');
      px(x, handX + 4, handY - 8, 4, 12, '#e8c48a');
      break;
    case 'javelin':
      px(x, CX - 21, handY - 1, 45, 2, '#d4d4d8');
      px(x, CX - 21, handY - 1, 45, 1, '#f6f6f8');
      px(x, CX + 21, handY - 2, 5, 4, '#c9302c');
      break;
    case 'ball': {
      const b = ramp('#f1f5f9');
      px(x, CX + W + 3, 53 + bob, 11, 11, b.base);
      px(x, CX + W + 3, 53 + bob, 11, 3, b.lightest);
      px(x, CX + W + 5, 56 + bob, 4, 4, '#1a1424');
      px(x, CX + W + 3, 61 + bob, 11, 3, shadow(b.base, 0.9));
      break;
    }
    case 'skis':
      px(x, CX - 21, 62 + bob, 42, 3, '#dbeafe');
      px(x, CX - 21, 62 + bob, 42, 1, '#ffffff');
      px(x, CX + 19, 58 + bob, 4, 4, '#1d4ed8');
      break;
    case 'dart':
      px(x, handX - 1, handY + 1, 10, 2, '#cbd5e1');
      px(x, handX + 8, handY - 1, 3, 5, '#22c55e');
      break;
    case 'club':
      px(x, handX + 3, handY - 20, 2, 26, '#9aa6b8');
      px(x, handX + 1, handY + 4, 7, 5, '#5c6b80');
      px(x, handX + 1, handY + 4, 7, 2, '#9aa6b8');
      break;
    case 'helmet': {
      const h = ramp('#c9302c');
      px(x, CX - 10, 2 + bob, 20, 11, h.base);
      px(x, CX - 10, 2 + bob, 20, 3, h.light);
      px(x, CX - 10, 10 + bob, 20, 3, '#1a1424');
      px(x, CX - 8, 3 + bob, 6, 3, h.lightest);
      break;
    }
    case 'baton':
      px(x, handX - 1, handY, 10, 4, trim.base);
      px(x, handX - 1, handY, 10, 1, trim.lightest);
      px(x, handX - 1, handY + 3, 10, 1, trim.dark);
      break;
    case 'mic':
      px(x, handX + 1, handY - 7, 5, 12, '#3a4a63');
      px(x, handX, handY - 11, 7, 5, '#9aa6b8');
      px(x, handX + 1, handY - 10, 2, 2, '#e2e8f0');
      break;
    case 'clipboard':
      px(x, handX - 1, handY, 12, 15, '#f4f7fb');
      px(x, handX - 1, handY, 12, 3, '#c3ccda');
      px(x, handX + 1, handY + 5, 8, 1, '#8d99ab');
      px(x, handX + 1, handY + 8, 8, 1, '#8d99ab');
      px(x, handX + 1, handY + 11, 5, 1, '#8d99ab');
      px(x, handX + 2, handY - 2, 5, 3, '#a16207');
      break;
    default: break;
  }
}

export function drawFighter(ctx, f, ox, oy, opts = {}) {
  const { facing = 1, t = 0, flash = false, down = false, pose, scale = 1 } = opts;
  const p = down ? POSE.GUARD : (pose || POSE.IDLE);
  const frame = p === POSE.IDLE ? Math.floor(t / 11) % 4 : 0;
  const key = `${f.id || f.name}|${p}|${frame}|${flash ? 1 : 0}`;

  let sprite = spriteCache.get(key);
  if (!sprite) { sprite = renderSprite(f, p, frame, flash); spriteCache.set(key, sprite); }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const w = SPRITE_W * scale, h = SPRITE_H * scale;
  if (down) {
    ctx.translate(ox + w / 2, oy + h);
    ctx.rotate((-Math.PI / 2) * facing);
    ctx.drawImage(sprite, -w / 2, -h, w, h);
  } else if (facing < 0) {
    ctx.translate(ox + w, oy);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, w, h);
  } else {
    ctx.drawImage(sprite, ox, oy, w, h);
  }
  ctx.restore();
}

export function drawGroundShadow(ctx, cx, y, w) {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, y, w, w * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// PORTRAIT — the Street Fighter II select panel
// ═══════════════════════════════════════════════════════════════════════════

const portraitCache = new Map();
const P_HEAD_TOP = 20;
const P_SCALE = 3;
const P_NECK_Y = P_HEAD_TOP + HEAD_PROFILE.length * P_SCALE - 4;   // tucked under the jaw
const P_SHOULDER_Y = P_NECK_Y + 10;

function renderPortrait(f) {
  const { c, x } = surface(PORTRAIT_W, PORTRAIT_H);
  const p = f.palette || {};
  const skin = ramp(p.skin || '#f0c49b');
  const kit = ramp(p.kit || '#1d4ed8');
  const hair = ramp(p.hair || '#4b2e13');
  const trim = ramp(p.trim || '#facc15');
  const feat = featuresOf(f);
  const CX = PORTRAIT_W / 2;

  // Shoulders: a wide trapezoid running off the bottom of the panel, so the
  // portrait reads as cropped-in rather than a figurine on a shelf.
  const shRows = [];
  const shH = PORTRAIT_H - P_SHOULDER_Y;
  for (let i = 0; i < shH; i++) shRows.push(Math.round(16 + i * 1.3));
  fillProfile(x, CX, P_SHOULDER_Y, shRows, kit, 1, { shadeW: 9, lightW: 7, capTop: false });
  px(x, CX - 17, P_SHOULDER_Y, 34, 2, kit.lightest);

  // neck, overlapping both so there is no seam
  px(x, CX - 9, P_NECK_Y, 18, P_SHOULDER_Y - P_NECK_Y + 6, skin.base);
  px(x, CX - 9, P_NECK_Y, 18, 6, shadow(skin.base, 1.6));
  px(x, CX + 4, P_NECK_Y + 4, 5, 10, skin.light);

  // collar sits over the neck join
  px(x, CX - 16, P_SHOULDER_Y + 2, 12, 7, kit.darkest);
  px(x, CX + 4, P_SHOULDER_Y + 2, 12, 7, kit.dark);
  px(x, CX - 5, P_SHOULDER_Y + 4, 10, 8, trim.base);
  px(x, CX - 5, P_SHOULDER_Y + 4, 10, 2, trim.light);

  drawHead(x, CX, P_HEAD_TOP, skin, hair, feat, P_SCALE);

  inkOutline(x, PORTRAIT_W, PORTRAIT_H);
  return c;
}

export function getPortrait(f) {
  const key = f.id || f.name;
  let pc = portraitCache.get(key);
  if (!pc) { pc = renderPortrait(f); portraitCache.set(key, pc); }
  return pc;
}

/** Portrait scaled into a box, with the arcade panel frame around it. */
export function drawPortrait(ctx, f, ox, oy, w, h, opts = {}) {
  const { frame = true, dim = false, scale, bg } = opts;
  const pc = getPortrait(f);
  const s = scale || Math.max(1, Math.min(w / PORTRAIT_W, h / PORTRAIT_H));
  const dw = Math.round(PORTRAIT_W * s), dh = Math.round(PORTRAIT_H * s);
  const dx = Math.round(ox + (w - dw) / 2), dy = Math.round(oy + h - dh);

  ctx.save();
  if (frame) {
    const grad = ctx.createLinearGradient(ox, oy, ox, oy + h);
    grad.addColorStop(0, bg || '#5a4a8c');
    grad.addColorStop(1, '#241d3c');
    ctx.fillStyle = grad;
    ctx.fillRect(ox, oy, w, h);
  }
  ctx.beginPath(); ctx.rect(ox, oy, w, h); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  if (dim) ctx.globalAlpha = 0.4;
  ctx.drawImage(pc, dx, dy, dw, dh);
  ctx.restore();
}

/** Square face crop for the select grid and the ladder nodes. */
export function drawFace(ctx, f, ox, oy, size, opts = {}) {
  const pc = getPortrait(f);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (opts.dim) ctx.globalAlpha = 0.35;
  // source box tight around the head, including hair above the crown
  const sx = 6, sy = 4, sw = 60, sh = 74;
  ctx.drawImage(pc, sx, sy, sw, sh, ox, oy, size, Math.round(size * (sh / sw)));
  ctx.restore();
}

export function clearSpriteCache() { spriteCache.clear(); portraitCache.clear(); }
