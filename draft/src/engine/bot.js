// The bot. Three levels, same rules as you: the same board, the same budget, one pick a round.
//
//   easy    a fan who goes on names: picks the dearest player it can afford, with a little randomness. Price is its only
//           information, so it falls for every trap and walks past every bargain.
//   medium  knows the stats, but through a fog (noise on what it thinks a player is worth).
//   hard    knows exactly what every player is worth in all four categories, and looks for the best value for the money,
//           with a small bonus for a team-mate of someone it already has (a shared club-season, for the team hands).
import { makeRng } from '../../../stickers/src/engine/rng.js';
import { CATEGORY_KEYS, cardChips } from '../../../stickers/src/engine/cards.js';
import { free, canAfford, roundsAfter, pick } from './draft.js';

export const LEVELS = ['easy', 'medium', 'hard'];
const FOG = { medium: 14, hard: 0 };   // how far off, in chips, the bot's idea of a player can be
export const VALUE_PER_POUND = 7;      // chips a pound of budget is worth to the bot while there are rounds to come
export const TEAMMATE_BONUS = 5;       // chips, for sharing a club-season with someone already on the team

// what a player is worth: his chips in every category, averaged (the bot does not know which categories will be drawn)
export const power = (card, scale) => CATEGORY_KEYS.reduce((s, k) => s + cardChips(card, k, scale), 0) / CATEGORY_KEYS.length;

const shares = (a, b) => a.stints.some((s) => b.stints.includes(s));

// -> the board id the bot picks
export function choose(state, who = 'bot', level = state.level) {
  const options = free(state).filter((b) => canAfford(state, who, b.price));
  if (!options.length) throw new Error('no legal pick (the board should always have a £1 player)');
  const rng = makeRng(`${state.seed}|${who}|${state.round}|${level}`);
  if (level === 'easy') {
    return options.reduce((best, b) => { const s = b.price + rng.next() * 2.5; return s > best.s ? { s, b } : best; }, { s: -1 }).b.card.id;
  }
  const scale = state.pool.scale;
  const mine = state.teams[who];
  // while rounds remain, a pound has a price in chips; in the last round, money left is worth nothing, so spend it all
  const perPound = roundsAfter(state) > 0 ? VALUE_PER_POUND : 0;
  let best = null;
  for (const b of options) {
    const fog = FOG[level] ? (rng.next() * 2 - 1) * FOG[level] : 0;
    const mates = mine.some((m) => shares(m, b.card)) ? TEAMMATE_BONUS : 0;
    const value = power(b.card, scale) + fog + mates - perPound * b.price;
    if (!best || value > best.value) best = { value, id: b.card.id };
  }
  return best.id;
}

// the bot takes its turn
export function botMove(state) {
  return pick(state, 'bot', choose(state));
}
