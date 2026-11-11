// BLIND FIVE: a budget draft against a bot, on the Sticker Season career cards.
//
//   1. Pick a five-a-side team. £10 each, five rounds; each round the wheel names a position and a board of eight players of that
//      position is shown with NAMES AND PRICES ONLY: no stats, no club, no overall. You and the bot take turns to pick one.
//   2. Roll which attribute is being counted: goals, assists, appearances or discipline. NOT KNOWN until the teams are picked.
//   3. Add up each team's REAL career totals in that attribute. The biggest total wins.
//
// No hands, no multipliers, no ratings: a team is worth the sum of what its players really did. The skill is football knowledge:
// who scored the goals, who played the games, who got booked. A price is a hint, not the truth (see PRICE_NOISE): there are
// bargains and traps.
//
// TWO MODES, one engine:
//   five    5-a-side. £10, five rounds, and the WHEEL names the position each round.
//   eleven  11-a-side. £25, eleven rounds. A FORMATION is rolled at the start (4-4-2, 4-3-3, ...) and the draft works through it back
//           to front: the goalkeeper, then the defenders, the midfielders, the forwards. Both teams play the same formation.
//
// Pure state machine (no DOM, no clock). Randomness comes from labelled seed streams, so a seed is a whole match.
import { makeRng } from '../../../stickers/src/engine/rng.js';
import { instance } from '../../../stickers/src/engine/deck.js';
import { CATEGORY_KEYS, POSITIONS, statOf } from '../../../stickers/src/engine/cards.js';

// What is the same in every mode.
export const COMMON = {
  boardSize: 8,
  minGames: 100,       // only players with 100+ Premier League appearances are on a board: you should have heard of them
  minPrice: 1, maxPrice: 5,
};
export const MODES = {
  five:   { id: 'five',   label: '5-a-side',  budget: 10, rounds: 5,  maxPerPosition: 2 },   // the wheel never gives one position three times
  eleven: { id: 'eleven', label: '11-a-side', budget: 25, rounds: 11 },
};
// the five-a-side rules, for callers that do not care about the mode
export const RULES = { ...COMMON, ...MODES.five };
export const rulesOf = (state) => ({ ...COMMON, ...MODES[state.mode] });

// The formations rolled in 11-a-side, with how often: a goalkeeper, then DEF-MID-FWD
export const FORMATIONS = [
  { name: '4-4-2', DEF: 4, MID: 4, FWD: 2, weight: 3 },
  { name: '4-3-3', DEF: 4, MID: 3, FWD: 3, weight: 3 },
  { name: '4-5-1', DEF: 4, MID: 5, FWD: 1, weight: 2 },
  { name: '3-5-2', DEF: 3, MID: 5, FWD: 2, weight: 2 },
  { name: '3-4-3', DEF: 3, MID: 4, FWD: 3, weight: 1 },
  { name: '5-3-2', DEF: 5, MID: 3, FWD: 2, weight: 1 },
];
export const formationPositions = (f) => ['GK', ...Array(f.DEF).fill('DEF'), ...Array(f.MID).fill('MID'), ...Array(f.FWD).fill('FWD')];

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
    const ranked = pool.cards.filter((c) => c.pos === pos && c.games >= COMMON.minGames)
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
// opts.mode: 'five' (default) or 'eleven'. opts.level: the bot's level, 'easy' | 'medium' | 'hard' (see bot.js).
// opts.first: who picks first in round 1. opts.formation: force an 11-a-side formation by name (tests).
export function newMatch(pool, seed = Date.now(), opts = {}) {
  const mode = opts.mode ?? 'five';
  if (!MODES[mode]) throw new Error(`unknown mode '${mode}'`);
  const rules = { ...COMMON, ...MODES[mode] };
  const state = {
    seed: String(seed), mode, level: opts.level ?? 'medium', phase: 'draft', round: 1, formation: null,
    // the attribute being counted: null until the draft is over, then rolled (opts.category forces it, for tests)
    category: null, forcedCategory: opts.category ?? null,
    positions: [], first1: opts.first ?? (makeRng(`${seed}|first`).int(2) ? 'bot' : 'you'),
    money: { you: rules.budget, bot: rules.budget }, teams: { you: [], bot: [] }, paid: { you: [], bot: [] },
    board: [], shown: [], turn: null, log: [],
  };
  Object.defineProperty(state, 'pool', { value: pool, enumerable: false });
  if (mode === 'eleven') {
    // the formation is rolled once, and the draft works through it: goalkeeper, defenders, midfielders, forwards
    const roll = stream(state, 'formation');
    state.formation = opts.formation ? FORMATIONS.find((f) => f.name === opts.formation) : roll.weighted(FORMATIONS.map((f) => [f, f.weight]));
    if (!state.formation) throw new Error(`unknown formation '${opts.formation}'`);
    state.positions = formationPositions(state.formation);
  } else {
    // positions: weighted wheel, but never one position more than maxPerPosition times
    const rng = stream(state, 'wheel');
    while (state.positions.length < rules.rounds) {
      const pos = rng.weighted(Object.entries(WHEEL));
      if (state.positions.filter((p) => p === pos).length < rules.maxPerPosition) state.positions.push(pos);
    }
  }
  dealBoard(state);
  return state;
}

export const positionOf = (state) => state.positions[state.round - 1];
export const firstPicker = (state) => (state.round % 2 === 1 ? state.first1 : other(state.first1));
export const roundsAfter = (state) => rulesOf(state).rounds - state.round;

// You must keep £1 for each later round. So the most you can spend this round:
export const maxSpend = (state, who) => state.money[who] - roundsAfter(state) * COMMON.minPrice;
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
    return { card, price: Math.max(COMMON.minPrice, Math.min(COMMON.maxPrice, price)), tier, takenBy: null };
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
  if (!canAfford(state, who, entry.price)) throw new Error(`over budget: you must keep £${COMMON.minPrice} for every round still to come`);
  entry.takenBy = who;
  state.money[who] -= entry.price;
  state.teams[who].push(instance(entry.card, 'base'));
  state.paid[who].push(entry.price);
  state.log.push({ round: state.round, who, id, name: entry.card.full, price: entry.price, tier: entry.tier });
  state.picksThisRound++;
  if (state.picksThisRound === 1) { state.turn = other(who); return entry; }
  if (state.round === rulesOf(state).rounds) { state.phase = 'showdown'; state.turn = null; return entry; }
  state.round++;
  dealBoard(state);
  return entry;
}

export const free = (state) => state.board.filter((b) => !b.takenBy);

// ---- the showdown -----------------------------------------------------------------------------------------------------------
// A player's REAL career total in the attribute: goals, assists, appearances, or discipline points (a yellow card is 1, a red 3).
export const valueOf = (card, category) => statOf(card, category);

// The roll, once the teams are picked: which attribute is counted.
export function rollAttribute(state) {
  if (state.phase !== 'showdown' && state.phase !== 'over') throw new Error('the teams are not picked yet');
  state.category ??= state.forcedCategory ?? stream(state, 'category').pick(CATEGORY_KEYS);
  return state.category;
}

// Roll the attribute, add each team up. The biggest total wins; equal totals are a draw.
export function showdown(state) {
  const category = rollAttribute(state);
  const side = (who) => {
    const players = state.teams[who].map((card, i) => ({ card, value: valueOf(card, category), paid: state.paid[who][i] }));
    return { players, total: players.reduce((sum, p) => sum + p.value, 0) };
  };
  const you = side('you'), bot = side('bot');
  state.phase = 'over';
  return { category, you, bot, winner: you.total > bot.total ? 'you' : bot.total > you.total ? 'bot' : 'draw' };
}
