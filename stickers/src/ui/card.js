// Draws one sticker: Panini border and foil, Top Trumps stat block.
import { CATEGORIES, CATEGORY_KEYS, EDITIONS, cardChips, safeHands, statOf, ratingOf, tierOf, surnameOf, firstNameOf } from '../engine/cards.js';
import { cardTips, TIER_NAMES, careerSpan } from './tips.js';
import { CLUB_COLOURS, CLUB_LABELS, inkOn } from './clubs.js';
import { badgeSvg } from './badge.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (key, v) => String(v);
// 1995-96 .. 2014-15 -> '95-15'
const span = (card) => (card.first === card.last ? card.first.slice(0, 4) : `${card.first.slice(2, 4)}-${String(Number(card.last.slice(0, 4)) + 1).slice(2)}`);

// card: a card or card instance. opts: { category, scale, selected, state: 'scoring'|'kicker'|null }
export function renderCard(card, opts = {}) {
  const { category, scale, selected = false, state = null } = opts;
  const [c1, c2] = CLUB_COLOURS[card.club] ?? ['#444444', '#ffffff'];
  const edition = card.edition ?? 'base';
  const tier = tierOf(card.rating);
  const first = firstNameOf(card);
  const sur = surnameOf(card);
  const tips = cardTips(card, { category, scale });
  const el = document.createElement('div');
  el.className = `card tier-${tier} ed-${edition}${selected ? ' selected' : ''}${state ? ` is-${state}` : ''}`;
  el.style.setProperty('--c1', c1);
  el.style.setProperty('--c2', c2);
  el.style.setProperty('--ink1', inkOn(c1));
  el.style.setProperty('--ink2', inkOn(c2));
  if (card.uid) el.dataset.uid = card.uid;

  const rows = CATEGORY_KEYS.map((key) => {
    const v = statOf(card, key);
    const r = ratingOf(card, key);
    const active = key === category;
    const chips = active && scale ? `<b class="chips" data-tip="${esc(tips.chips[key])}">${cardChips(card, key, scale)}</b>` : '';
    return `<li data-tip="${esc(tips.rows[key])}" class="${active ? 'active' : ''}${v === 0 ? ' zero' : ''}"><span>${CATEGORIES[key].short}<em>${v === 0 ? 'none' : fmt(key, v)}</em></span><i>${r}</i>${chips}</li>`;
  }).join('');

  el.innerHTML = `
    <div class="band" data-tip="${esc(tips.band)}"><span class="club">${esc(CLUB_LABELS[card.club] ?? card.club)}</span><span>${span(card)}</span></div>
    <div class="art">
      <div class="rating" data-tip="${esc(tips.rating)}"><b>${card.rating}</b><small>${card.pos}</small></div>
      <div class="pos" data-tip="${esc(tips.pos)}">${TIER_NAMES[tier].toUpperCase()}</div>
      ${badgeSvg(card.club)}
      ${tips.ability ? `<div class="abil" data-tip="${esc(tips.ability)}">SAFE HANDS +${safeHands(card)}</div>` : ''}
      ${edition !== 'base' ? `<div class="edtag" data-tip="${esc(tips.edition)}">${EDITIONS[edition].label}</div>` : ''}
    </div>
    <div class="name${first ? '' : ' solo'}${sur.length > 15 ? ' xl' : sur.length > 11 ? ' long' : ''}" data-tip="${esc(tips.name)}">${first ? `<small>${esc(first)}</small>` : ''}<span>${esc(sur)}</span></div>
    <ul class="stats">${rows}</ul>`;
  return el;
}
