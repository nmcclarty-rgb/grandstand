// Draws one sticker: Panini border and foil, Top Trumps stat block.
import { CATEGORIES, CATEGORY_KEYS, EDITIONS, cardChips } from '../engine/cards.js';
import { CLUB_COLOURS, inkOn } from './clubs.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (key, v) => String(v);
const season = (s) => `${s.slice(0, 4)}/${s.slice(5)}`; // 2017-18 -> 2017/18

// A head-and-shoulders silhouette in the club shirt. No photo, no likeness.
const bust = (c1, c2) => `
<svg viewBox="0 0 100 80" aria-hidden="true">
  <path d="M6 80 C8 56 26 50 50 50 C74 50 92 56 94 80 Z" fill="${c1}"/>
  <path d="M38 50 L50 62 L62 50 Z" fill="${c2}"/>
  <rect x="43" y="40" width="14" height="14" rx="5" fill="#2b2f36"/>
  <ellipse cx="50" cy="27" rx="15" ry="18" fill="#2b2f36"/>
</svg>`;

// card: a card or card instance. opts: { category, scale, selected, state: 'scoring'|'kicker'|null }
export function renderCard(card, opts = {}) {
  const { category, scale, selected = false, state = null } = opts;
  const [c1, c2] = CLUB_COLOURS[card.club] ?? ['#444444', '#ffffff'];
  const edition = card.edition ?? 'base';
  const el = document.createElement('div');
  el.className = `card ed-${edition}${selected ? ' selected' : ''}${state ? ` is-${state}` : ''}`;
  el.style.setProperty('--c1', c1);
  el.style.setProperty('--c2', c2);
  el.style.setProperty('--ink1', inkOn(c1));
  el.style.setProperty('--ink2', inkOn(c2));
  if (card.uid) el.dataset.uid = card.uid;

  const rows = CATEGORY_KEYS.map((key) => {
    const v = card[key];
    const active = key === category;
    const chips = active && scale ? `<b class="chips">${cardChips(card, key, scale)}</b>` : '';
    return `<li class="${active ? 'active' : ''}${v === 0 ? ' zero' : ''}"><span>${CATEGORIES[key].short}</span><i>${v === 0 ? '–' : fmt(key, v)}</i>${chips}</li>`;
  }).join('');

  el.innerHTML = `
    <div class="band"><span>${esc(card.club)}</span><span>${season(card.season)}</span></div>
    <div class="art">
      <div class="rating"><small>OVR</small>${card.rating}</div>
      <div class="pos">${card.pos}</div>
      ${bust(c1, c2)}
      ${edition !== 'base' ? `<div class="edtag">${EDITIONS[edition].label}</div>` : ''}
    </div>
    <div class="name">${esc(card.name)}</div>
    <ul class="stats">${rows}</ul>`;
  return el;
}
