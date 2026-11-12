// A football shirt in a club's colours and design, with the badge letters on the chest. Generated, like the badges: no real kits.
// kit = { colours: [primary, secondary], pattern: 'solid' | 'stripes' | 'hoops' | 'halves' | 'sash' }
import { inkOn } from './clubs.js';

const SHIRT = 'M40 8 L20 16 L3 46 L22 57 L30 47 L30 112 L90 112 L90 47 L98 57 L117 46 L100 16 L80 8 C74 18 46 18 40 8 Z';
let uid = 0;

export function shirtSvg(kit, code = '') {
  const [c1, c2] = kit.colours;
  const id = `sh${++uid}`;
  let over = '';
  if (kit.pattern === 'stripes') over = Array.from({ length: 4 }, (_, i) => `<rect x="${3 + (2 * i + 1) * 14.25}" y="0" width="14.25" height="120" fill="${c2}"/>`).join('');
  else if (kit.pattern === 'hoops') over = Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${8 + (2 * i + 1) * 10.4}" width="120" height="10.4" fill="${c2}"/>`).join('');
  else if (kit.pattern === 'halves') over = `<rect x="60" y="0" width="60" height="120" fill="${c2}"/>`;
  else if (kit.pattern === 'sash') over = `<polygon points="30,30 30,54 90,104 90,80" fill="${c2}"/>`;
  // the collar and cuffs go in whichever colour reads against the shirt
  const trim = inkOn(c1) === '#ffffff' ? c2 : '#14181c';
  const letters = code.slice(0, 3);
  return `<svg viewBox="0 0 120 120" role="img" aria-label="Your shirt">
  <defs><clipPath id="${id}"><path d="${SHIRT}"/></clipPath></defs>
  <path d="${SHIRT}" fill="${c1}"/>
  <g clip-path="url(#${id})">${over}<path d="M30 47 L30 112 L90 112 L90 47" fill="#000" opacity=".06"/><rect x="0" y="8" width="120" height="6" fill="#000" opacity=".08"/></g>
  <path d="M40 8 C46 18 74 18 80 8" fill="none" stroke="${trim}" stroke-width="4" stroke-linecap="round"/>
  <path d="M5 47 L22 57 M115 47 L98 57" stroke="${trim}" stroke-width="5" stroke-linecap="round"/>
  ${letters ? `<g><path d="M44 34 H76 V54 C76 63 68 67 60 71 C52 67 44 63 44 54 Z" fill="#10161c" opacity=".88"/><text x="60" y="52" text-anchor="middle" font-family="Impact, 'Arial Narrow Bold', sans-serif" font-size="11" fill="#fff" textLength="${Math.min(24, letters.length * 8.5)}" lengthAdjust="spacingAndGlyphs">${letters}</text></g>` : ''}
  <path d="${SHIRT}" fill="none" stroke="#10161c" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
}
