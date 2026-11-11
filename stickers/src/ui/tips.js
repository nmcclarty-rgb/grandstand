// What every number on a sticker means, in words. Pure (no DOM), so it is tested.
import { CATEGORIES, CATEGORY_KEYS, EDITIONS, TIER_BANDS, OVR_WEIGHTS, cardChips, safeHands, statOf, ratingOf, tierOf } from '../engine/cards.js';
import { CLUB_LABELS } from './clubs.js';

export const POSITIONS = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
export const TIER_NAMES = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', icon: 'Icon' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const seasonLabel = (s) => `${s.slice(0, 4)}/${s.slice(5)}`; // 2017-18 -> 2017/18
// 1995-96 .. 2014-15 -> "1995/96 to 2014/15"; one season stays one season
export const careerSpan = (card) => (card.first === card.last ? seasonLabel(card.first) : `${seasonLabel(card.first)} to ${seasonLabel(card.last)}`);

// -> { band, rating, pos, name, rows: { goals, assists, games, discipline }, chips: {key: text}, ability?, edition? }
// Each stat row has a RATING (1-99, what scores) and the REAL career total underneath it.
// opts.category + opts.scale (chip scale from cards.json) add the chips explanation for the active row.
export function cardTips(card, { category, scale } = {}) {
  const club = CLUB_LABELS[card.club] ?? card.club;
  const where = card.clubs.length > 1
    ? card.clubs.map(([k, a]) => `${CLUB_LABELS[k] ?? k} ${a}`).join(', ')
    : `${club} only`;
  const rate = (key) => `rated ${ratingOf(card, key)} out of 99`;
  const rows = {
    goals: `${card.goals ? plural(card.goals, 'career goal') : 'No career goals'}: ${rate('goals')}, against the Premier League record of 260`,
    assists: `${card.assists ? plural(card.assists, 'career assist') : 'No career assists'}: ${rate('assists')}`,
    games: `${plural(card.games, 'Premier League appearance')}: ${rate('games')}`,
    discipline: `${plural(statOf(card, 'discipline'), 'discipline point')}: ${plural(card.yellow, 'yellow card')} x 1 + ${plural(card.red, 'red card')} x 3: ${rate('discipline')}`,
  };
  const w = OVR_WEIGHTS[card.pos];
  const tier = tierOf(card.rating);
  const tips = {
    band: `${where}. Premier League career: ${careerSpan(card)}.`,
    rating: `Overall ${card.rating} out of 99, ${TIER_NAMES[tier]}: his ${CATEGORY_KEYS.filter((k) => w[k]).map((k) => `${CATEGORIES[k].short.toLowerCase()} ${Math.round(w[k] * 100)}%`).join(', ')} ratings blended for a ${POSITIONS[card.pos].toLowerCase()}. It sets how rare he is in packs. It is not worth chips.`,
    pos: card.pos === 'GK' ? 'Goalkeeper. Hold him in your hand, rather than playing him, for Safe Hands.' : POSITIONS[card.pos],
    name: `${card.full}: ${careerSpan(card)}`,
    rows,
    chips: {},
  };
  if (category && scale && CATEGORY_KEYS.includes(category)) {
    const r = ratingOf(card, category);
    const per = Math.round(scale[category].perUnit * 1000) / 1000;
    tips.chips[category] = `Worth ${cardChips(card, category, scale)} chips in this matchday's ${CATEGORIES[category].label.toLowerCase()} round: rating ${r} x ${per} chips each`;
  }
  if (card.pos === 'GK') {
    const lvl = card.games >= 250 ? 'first-choice legend: 250+ appearances' : card.games >= 100 ? 'regular: 100 to 249 appearances' : 'deputy: under 100 appearances';
    tips.ability = `Safe Hands: while he is held in your hand, not played, he adds +${safeHands(card)} mult to every hand you play (${lvl}).`;
  }
  const ed = card.edition ?? 'base';
  if (ed !== 'base') tips.edition = `${EDITIONS[ed].label}: ${EDITIONS[ed].blurb} every time this sticker scores.`;
  return tips;
}
