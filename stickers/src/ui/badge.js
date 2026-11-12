// A club badge for the card face, generated from the club's kit colours and pattern: a shield with the club's code.
//
// These are stand-ins, not the real crests. Real crests are trademarks and need licensed artwork; this module is the one
// place to change when that artwork exists (return an <img> or the real SVG from badgeSvg instead).
import { CLUB_COLOURS, CLUB_PATTERNS, inkOn } from './clubs.js';

const SHIELD = 'M8 6 H92 V60 C92 88 72 106 50 114 C28 106 8 88 8 60 Z';
let uid = 0;

// -> an SVG string, 100 x 120 viewBox. `look` ({ colours: [primary, secondary], pattern }) overrides the lookup, for clubs that are not on the cards.
export function badgeSvg(club, look) {
  const [c1, c2] = look?.colours ?? CLUB_COLOURS[club] ?? ['#444444', '#ffffff'];
  const pattern = look?.pattern ?? CLUB_PATTERNS[club] ?? 'solid';
  const id = `bd${++uid}`; // a clip path per badge: ids must be unique on the page
  let over = '';
  if (pattern === 'stripes') over = [1, 3, 5].map((i) => `<rect x="${8 + i * 14}" y="0" width="14" height="120" fill="${c2}"/>`).join('');
  else if (pattern === 'hoops') over = [1, 3, 5, 7].map((i) => `<rect x="0" y="${6 + i * 14}" width="100" height="14" fill="${c2}"/>`).join('');
  else if (pattern === 'halves') over = `<rect x="50" y="0" width="50" height="120" fill="${c2}"/>`;
  else if (pattern === 'sash') over = `<polygon points="0,30 0,56 100,98 100,72" fill="${c2}"/>`;
  const code = club.length > 3 ? club.slice(0, 3) : club;
  return `<svg viewBox="0 0 100 120" role="img" aria-label="${club} badge">
  <defs><clipPath id="${id}"><path d="${SHIELD}"/></clipPath></defs>
  <path d="${SHIELD}" fill="${c1}"/>
  <g clip-path="url(#${id})">${over}<rect x="0" y="0" width="100" height="22" fill="#000" opacity=".16"/></g>
  <rect x="8" y="44" width="84" height="30" fill="#10161c" opacity=".86" clip-path="url(#${id})"/>
  <text x="50" y="66" text-anchor="middle" style="font-family:var(--display);font-weight:800" font-size="26" letter-spacing="1.5" fill="#fff">${code}</text>
  <path d="${SHIELD}" fill="none" stroke="#10161c" stroke-width="5"/>
  <path d="${SHIELD}" fill="none" stroke="${inkOn(c1) === '#ffffff' ? '#ffffffcc' : '#10161ccc'}" stroke-width="1.6" transform="translate(50 60) scale(.93) translate(-50 -60)"/>
</svg>`;
}
