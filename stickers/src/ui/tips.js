// What every number on a sticker means, in words. Pure (no DOM), so it is tested.
import { CATEGORIES, CATEGORY_KEYS, EDITIONS, SCALED_SEASONS, cardChips, safeHands, statOf } from '../engine/cards.js';
import { CLUB_LABELS } from './clubs.js';

export const POSITIONS = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const seasonLabel = (s) => `${s.slice(0, 4)}/${s.slice(5)}`; // 2017-18 -> 2017/18

// -> { band, rating, pos, name, rows: { goals, assists, games, discipline }, chips: {key: text}, ability?, edition? }
// opts.category + opts.scale (chip scale from cards.json) add the chips explanation for the active row.
export function cardTips(card, { category, scale } = {}) {
  const season = seasonLabel(card.season);
  const scaled = SCALED_SEASONS.includes(card.season) ? ' (a 42-game season, scaled to 38)' : '';
  const club = CLUB_LABELS[card.club] ?? card.club;
  const rows = {
    goals: card.goals ? `${plural(card.goals, 'goal')} in ${season}${scaled}` : `No goals in ${season}`,
    assists: card.assists ? `${plural(card.assists, 'assist')} in ${season}${scaled}` : `No assists in ${season}`,
    games: `${plural(card.games, 'game')} played in ${season} (minutes ÷ 90)${scaled}`,
    discipline: `${plural(statOf(card, 'discipline'), 'discipline point')}: ${plural(card.yellow, 'yellow card')} × 1 + ${plural(card.red, 'red card')} × 3`
      + (scaled ? scaled : ''),
  };
  const tips = {
    band: `${club}, ${season} season`,
    rating: `Overall ${card.rating} out of 99: how this season ranks among every ${POSITIONS[card.pos].toLowerCase()} since 1992 (goals, assists and games played). It sets how rare the sticker is in packs. It is not worth chips.`,
    pos: card.pos === 'GK' ? 'Goalkeeper. Hold him in your hand, rather than playing him, for Safe Hands.' : POSITIONS[card.pos],
    name: card.full,
    rows,
    chips: {},
  };
  if (category && scale && CATEGORY_KEYS.includes(category)) {
    const v = statOf(card, category);
    const per = Math.round(scale[category].perUnit * 100) / 100;
    tips.chips[category] = `Worth ${cardChips(card, category, scale)} chips in this matchday's ${CATEGORIES[category].label.toLowerCase()} round: ${v} × ${per} chips each`;
  }
  if (card.pos === 'GK') {
    const tier = card.games >= 30 ? 'first choice: 30+ games' : card.games >= 15 ? 'rotation: 15 to 29 games' : 'backup: under 15 games';
    tips.ability = `Safe Hands: while he is held in your hand, not played, he adds +${safeHands(card)} mult to every hand you play (${tier}).`;
  }
  const ed = card.edition ?? 'base';
  if (ed !== 'base') tips.edition = `${EDITIONS[ed].label}: ${EDITIONS[ed].blurb} every time this sticker scores.`;
  return tips;
}
