// The bot. Three levels, same rules as you: the same board, the same budget, one pick a round, and it knows which attribute is
// being counted (so do you).
//
//   easy    a fan who goes on names: picks the dearest player it can afford, with a little randomness. Price is its only
//           information, so it falls for every trap and walks past every bargain.
//   medium  knows the stats, but through a fog (noise on what it thinks a player's total is).
//   hard    knows exactly what every player has done in the attribute, and looks for the best value for the money.
import { makeRng } from '../../../stickers/src/engine/rng.js';
import { free, canAfford, roundsAfter, pick, valueOf } from './draft.js';

export const LEVELS = ['easy', 'medium', 'hard'];
const FOG = { medium: 55, hard: 0 };   // how far off, in points of the record, the bot's idea of a player can be
export const VALUE_PER_POUND = 6;      // points of the record a pound of budget is worth to the bot while there are rounds to come

// what a player is worth in the attribute, as a share of the all-time record (0 to 100), so the four attributes are on one scale
export const worth = (card, category, pool) => (100 * valueOf(card, category)) / pool.meta.records[category].total;

// -> the board id the bot picks
export function choose(state, who = 'bot', level = state.level) {
  const options = free(state).filter((b) => canAfford(state, who, b.price));
  if (!options.length) throw new Error('no legal pick (the board should always have a £1 player)');
  const rng = makeRng(`${state.seed}|${who}|${state.round}|${level}`);
  if (level === 'easy') {
    return options.reduce((best, b) => { const s = b.price + rng.next() * 2.5; return s > best.s ? { s, b } : best; }, { s: -1 }).b.card.id;
  }
  // while rounds remain, a pound has a price in points; in the last round, money left is worth nothing, so spend it all
  const perPound = roundsAfter(state) > 0 ? VALUE_PER_POUND : 0;
  let best = null;
  for (const b of options) {
    const fog = FOG[level] ? (rng.next() * 2 - 1) * FOG[level] : 0;
    const value = worth(b.card, state.category, state.pool) + fog - perPound * b.price;
    if (!best || value > best.value) best = { value, id: b.card.id };
  }
  return best.id;
}

// the bot takes its turn
export function botMove(state) {
  return pick(state, 'bot', choose(state));
}
