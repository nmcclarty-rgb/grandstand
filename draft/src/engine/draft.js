// BLIND FIVE: a budget draft against a bot, on the Sticker Season career cards.
//
// You and the bot each build a five-a-side team over five rounds, with £10 each. Every round the wheel names a position;
// a board of eight players of that position is shown with NAMES AND PRICES ONLY: no stats, no club, no overall. You and the
// bot take turns to pick one from the board, then the board is gone. After five rounds the two teams are revealed and play
// a best-of-three showdown: each match names a category (goals, assists, appearances or discipline), and a team is scored
// exactly as a hand in Sticker Season: its five players are the hand, so team-mates earn Back Four, Invincibles, Spine...
//
// The skill is football knowledge. A price is a hint, not the truth (see PRICE_NOISE): there are bargains and traps.
//
// Pure state machine (no DOM, no clock). Randomness comes from labelled seed streams, so a seed is a whole match.
import { makeRng } from '../../../stickers/src/engine/rng.js';
import { instance } from '../../../stickers/src/engine/deck.js';
import { scoreHand } from '../../../stickers/src/engine/scoring.js';
import { CATEGORY_KEYS, POSITIONS } from '../../../stickers/src/engine/cards.js';

export const RULES = {
  budget: 10,          // each side's money, for the whole team
  rounds: 5,           // one pick each per round: a five-a-side team
  boardSize: 8,
  minGames: 100,       // only players with 100+ Premier League appearances are on a board: you should have heard of them
  maxPerPosition: 2,   // the wheel never gives one position three times
  minPrice: 1, maxPrice: 5,
  matches: 3,          // the showdown is best of three categories
};

// The truth about a board: its eight players' TRUE TIERS (1 cheap to 5 star), by the overall within their position. Three
// of the eight are always tier 1 (and priced £1): that is what guarantees a legal pick for whoever picks second, however the
// money has gone.
export const TIER_SLOTS = [1, 1, 1, 2, 2, 3, 4, 5];
// share of a position's players (best first) in each true tier
const TIER_SHARE = [[5, 0.05], [4, 0.10], [3, 0.20], [2, 0.30], [1, 0.35]];
// A price is the true tier, nudged: tiers 2-4 move one step with this chance (a bargain if down, a trap if up); a star (5)
// can only be a bargain at £4. Tier 1 is always £1.
export const PRICE_NOISE = 0.3;

const WHEEL = { GK: 1, DEF: 2, MID: 2, FWD: 2 };

// ---- who can be on a board ----------------------------------------------------------------------------------------------
const universes = new WeakMap();
// -> { GK: {1: [cards], ... 5: [...]}, DEF: ..., ... }
export function universeOf(pool) {
  if (universes.has(pool)) return universes.get(pool);
  const u = {};
  for (const pos of POSITIONS) {
    const ranked = pool.cards.filter((c) => c.pos === pos && c.games >= RULES.minGames)
      .sort((a, b) => b.rating - a.rating || b.games - a.games || a.id.localeCompare(b.id));
    u[pos] = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    let cut = 0, i = 0;
    for (const [tier, share] of TIER_SHARE) {
      cut += share * ranked.length;
      while (i < Math.round(cut)) u[pos][tier].push(ranked[i++]);
    }
    while (i < ranked.length) u[pos][1].push(ranked[i++]);
  }
  universes.set(pool, u);
  return u;
}

const stream = (state, label) => makeRng(`${state.seed}|${label}`);
const other = (who) => (who === 'you' ? 'bot' : 'you');

// ---- a match -------------------------------------------------------------------------------------------------------------
// opts.level: the bot's level, 'easy' | 'medium' | 'hard' (see bot.js). opts.first: who picks first in round 1.
export function newMatch(pool, seed = Date.now(), opts = {}) {
  const state = {
    seed: String(seed), level: opts.level ?? 'medium', phase: 'draft', round: 1,
    positions: [], first1: opts.first ?? (makeRng(`${seed}|first`).int(2) ? 'bot' : 'you'),
    money: { you: RULES.budget, bot: RULES.budget }, teams: { you: [], bot: [] }, paid: { you: [], bot: [] },
    board: [], shown: [], turn: null, log: [],
  };
  Object.defineProperty(state, 'pool', { value: pool, enumerable: false });
  // positions: weighted wheel, but never one position more than maxPerPosition times
  const rng = stream(state, 'wheel');
  while (state.positions.length < RULES.rounds) {
    const pos = rng.weighted(Object.entries(WHEEL));
    if (state.positions.filter((p) => p === pos).length < RULES.maxPerPosition) state.positions.push(pos);
  }
  dealBoard(state);
  return state;
}

export const positionOf = (state) => state.positions[state.round - 1];
export const firstPicker = (state) => (state.round % 2 === 1 ? state.first1 : other(state.first1));
export const roundsAfter = (state) => RULES.rounds - state.round;

// You must keep £1 for each later round. So the most you can spend this round:
export const maxSpend = (state, who) => state.money[who] - roundsAfter(state) * RULES.minPrice;
export const canAfford = (state, who, price) => price <= maxSpend(state, who);

function dealBoard(state) {
  const pos = positionOf(state);
  const u = universeOf(state.pool)[pos];
  const rng = stream(state, `board|${state.round}`);
  const on = new Set(state.shown);
  const board = TIER_SLOTS.map((tier) => {
    const options = u[tier].filter((c) => !on.has(c.id));
    if (!options.length) throw new Error(`no ${pos} left in tier ${tier}`);
    const card = rng.pick(options);
    on.add(card.id);
    let price = tier;
    if (tier >= 2 && rng.next() < PRICE_NOISE) price += tier === 5 ? -1 : (rng.next() < 0.5 ? -1 : 1);
    return { card, price: Math.max(RULES.minPrice, Math.min(RULES.maxPrice, price)), tier, takenBy: null };
  });
  rng.shuffle(board);
  state.board = board;
  state.shown.push(...board.map((b) => b.card.id));
  state.turn = firstPicker(state);
  state.picksThisRound = 0;
}

// who picks the player with this id from the board. Throws if it is not allowed.
export function pick(state, who, id) {
  if (state.phase !== 'draft') throw new Error('the draft is over');
  if (state.turn !== who) throw new Error(`it is not ${who === 'you' ? 'your' : "the bot's"} turn`);
  const entry = state.board.find((b) => b.card.id === id);
  if (!entry) throw new Error('that player is not on the board');
  if (entry.takenBy) throw new Error('already picked');
  if (!canAfford(state, who, entry.price)) throw new Error(`over budget: you must keep £${RULES.minPrice} for every round still to come`);
  entry.takenBy = who;
  state.money[who] -= entry.price;
  state.teams[who].push(instance(entry.card, 'base'));
  state.paid[who].push(entry.price);
  state.log.push({ round: state.round, who, id, name: entry.card.full, price: entry.price, tier: entry.tier });
  state.picksThisRound++;
  if (state.picksThisRound === 1) { state.turn = other(who); return entry; }
  if (state.round === RULES.rounds) { state.phase = 'showdown'; state.turn = null; return entry; }
  state.round++;
  dealBoard(state);
  return entry;
}

export const free = (state) => state.board.filter((b) => !b.takenBy);

// ---- the showdown -----------------------------------------------------------------------------------------------------------
// Three different categories, each scored for both teams as a Sticker Season hand. Most matches wins; if level, the higher
// total score; if still level, a draw.
export function showdown(state) {
  if (state.phase !== 'showdown' && state.phase !== 'over') throw new Error('the teams are not picked yet');
  const scale = state.pool.scale;
  const cats = stream(state, 'matches').shuffle([...CATEGORY_KEYS]).slice(0, RULES.matches);
  const matches = cats.map((category) => {
    const side = (who) => scoreHand(state.teams[who], { category, scale });
    const you = side('you'), bot = side('bot');
    return { category, you, bot, winner: you.total > bot.total ? 'you' : bot.total > you.total ? 'bot' : 'draw' };
  });
  const wins = { you: matches.filter((m) => m.winner === 'you').length, bot: matches.filter((m) => m.winner === 'bot').length };
  const total = { you: matches.reduce((s, m) => s + m.you.total, 0), bot: matches.reduce((s, m) => s + m.bot.total, 0) };
  const winner = wins.you !== wins.bot ? (wins.you > wins.bot ? 'you' : 'bot') : total.you !== total.bot ? (total.you > total.bot ? 'you' : 'bot') : 'draw';
  state.phase = 'over';
  return { matches, wins, total, winner, decidedBy: wins.you !== wins.bot ? 'matches' : winner === 'draw' ? 'nothing' : 'total score' };
}
