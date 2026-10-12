/**
 * GRANDSTAND — tone ramps.
 *
 * The single biggest difference between 8-bit and 16-bit-looking art is that
 * every colour is a *ramp*, not a swatch. One base colour becomes five tones,
 * with cool shadows and warm highlights — that's what reads as "painted"
 * rather than "filled in".
 */

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0')}`;
}

/** Shadows drift cool (towards blue), highlights drift warm (towards yellow). */
export function shadow(hex, amount = 1) {
  const [r, g, b] = hexToRgb(hex);
  const k = 1 - 0.34 * amount;
  return rgbToHex(r * k * 0.97, g * k, b * Math.min(1, k * 1.12));
}
export function highlight(hex, amount = 1) {
  const [r, g, b] = hexToRgb(hex);
  const t = 0.34 * amount;
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t * 0.92, b + (255 - b) * t * 0.55);
}

/** Five tones from one colour: the whole art style in one function. */
export function ramp(hex) {
  return {
    darkest: shadow(hex, 1.85),
    dark: shadow(hex, 1),
    base: hex,
    light: highlight(hex, 1),
    lightest: highlight(hex, 1.85),
  };
}

export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export const INK = '#1a1424';       // outline colour for every sprite
export const INK_SOFT = '#2e2440';
