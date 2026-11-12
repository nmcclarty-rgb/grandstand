// PREM WHEEL: a budget draft against a bot, on the Sticker Season career cards. A BEST OF THREE, a fresh team each time.
//
// A series is three matches. Each match:
//   1. An attribute is drawn at the start (goals, assists, goal involvements, appearances, discipline: three different ones in a series).
//   2. You and the bot each draft a FRESH team on a fresh budget, tailored to that attribute. Each round a board of eight players of one
//      position goes up with NAMES AND PRICES ONLY: no stats, no club, no overall. You take turns to pick one. A player used in an
//      earlier match is not on a later board.
//   3. Add up each team's REAL career totals in the attribute. The bigger total wins the match. Two matches win the series.
//
// No hands, no multipliers, no ratings: a team is worth the sum of what its players really did. The skill is football knowledge:
// who scored the goals, who played the games, who got booked. A price is a hint, not the truth (see PRICE_NOISE): there are
// bargains and traps.
//
// TWO MODES, one engine:
//   five    5-a-side. £10m, five rounds: a goalkeeper and a formation of four outfield players (1-2-1, 2-1-1, 1-1-2 or 2-2) rolled at the start of each match.
//   eleven  11-a-side. £30m, eleven rounds. A FORMATION is rolled at the start (4-4-2, 4-3-3, ...) and the draft works through it back
//           to front: the goalkeeper, then the defenders, the midfielders, the forwards. Both teams play the same formation.
//
// Pure state machine (no DOM, no clock). Randomness comes from labelled seed streams, so a seed is a whole series.
import { makeRng } from '../../../stickers/src/engine/rng.js';
import { instance } from '../../../stickers/src/engine/deck.js';
import { POSITIONS } from '../../../stickers/src/engine/cards.js';
import { ATTRIBUTE_KEYS, valueOf, recordOf } from './attributes.js';
export { valueOf };

// What is the same in every mode.
export const COMMON = {
  boardSize: 8,
  minGames: 100,       // only players with 100+ Premier League appearances are on a board: you should have heard of them
  minPrice: 1, maxPrice: 5,
  matches: 3,          // a series is a best of three
};
export const MODES = {
  five:   { id: 'five',   label: '5-a-side',  budget: 10, rounds: 5 },
  eleven: { id: 'eleven', label: '11-a-side', budget: 30, rounds: 11 },
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

// 5-a-side: one goalkeeper and four outfield players, as DEF-MID-FWD. Every one has at least one defender, so a clean-sheets match always has a back line.
export const FIVE_A_SIDE_FORMATIONS = [
  { name: '1-2-1', DEF: 1, MID: 2, FWD: 1, weight: 3 },
  { name: '2-1-1', DEF: 2, MID: 1, FWD: 1, weight: 3 },
  { name: '1-1-2', DEF: 1, MID: 1, FWD: 2, weight: 2 },
  { name: '2-2', DEF: 2, MID: 2, FWD: 0, weight: 1 },
];
export const formationsOf = (mode) => (mode === 'eleven' ? FORMATIONS : FIVE_A_SIDE_FORMATIONS);

// The truth about a board: its eight players' TRUE TIERS (1 cheap to 5 star), by the overall within their position. Three
// of the eight are always tier 1 (and priced £1): that is what guarantees a legal pick for whoever picks second, however the
// money has gone.
export const TIER_SLOTS = [1, 1, 1, 2, 2, 3, 4, 5];
// share of a position's players (best first) in each true tier
const TIER_SHARE = [[5, 0.05], [4, 0.10], [3, 0.20], [2, 0.30], [1, 0.35]];
// MONEY is in £m, to one decimal. A player's FAIR price is his true tier with a fraction for where he sits in it (the best of tier 3 is £3.5m, the worst
// £2.6m; a tier-1 player is always £1m, and a star is £4.5m to £5m). The price on the board is the fair price, nudged: tiers 2-4 move by £0.8m to £1.6m with this
// chance (a bargain if down, a trap if up); a star (5) can only be a bargain.
export const PRICE_NOISE = 0.3;
export const m1 = (x) => Math.round(x * 10) / 10 + 0;       // money stays on one decimal, so sums never drift
// 'bargain' if the board price is half a million or more below the fair price, 'trap' if the same above
export const tagOf = (price, fair) => (m1(price - fair) <= -0.5 ? 'bargain' : m1(price - fair) >= 0.5 ? 'trap' : '');


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
    // the fair price of each: tier 1 is £1m; tiers 2-4 run from tier + 0.45 (best of the tier) down to tier - 0.45; a star from £5m down to £4.5m
    u[pos].fair = new Map();
    for (const tier of [1, 2, 3, 4, 5]) {
      const list = u[pos][tier];
      list.forEach((c, k) => {
        const f = list.length > 1 ? k / (list.length - 1) : 0.5;
        u[pos].fair.set(c.id, tier === 1 ? 1 : tier === 5 ? m1(5 - 0.5 * f) : m1(tier + 0.45 - 0.9 * f));
      });
    }
  }
  universes.set(pool, u);
  return u;
}

const stream = (state, label) => makeRng(`${state.seed}|${label}`);
const other = (who) => (who === 'you' ? 'bot' : 'you');

// ---- a series -------------------------------------------------------------------------------------------------------------
// opts.mode: 'five' (default) or 'eleven'. opts.level: the bot's level, 'easy' | 'medium' | 'hard' (see bot.js). opts.first: who picks
// first in round 1 of match 1. opts.matches: the length of the series (3 by default: first to two; a tournament round is 1). opts.budgets: { you, bot }, each
// side's money in every match (the mode's budget for both by default): the tournament gives a bigger club a bigger budget. For tests: opts.categories forces the attributes (one per match), opts.formation forces an 11-a-side
// formation by name (every match).
export function newMatch(pool, seed = Date.now(), opts = {}) {
  const mode = opts.mode ?? 'five';
  if (!MODES[mode]) throw new Error(`unknown mode '${mode}'`);
  const state = {
    seed: String(seed), mode, level: opts.level ?? 'medium',
    phase: 'draft',               // 'draft' -> 'showdown' (teams picked) -> 'between' (next match to come) or 'over'
    match: 1, total: opts.matches ?? COMMON.matches, budgets: opts.budgets ?? null, results: [], used: [], forcedCategories: opts.categories ?? null, forcedFormation: opts.formation ?? null,
    first1: opts.first ?? (makeRng(`${seed}|first`).int(2) ? 'bot' : 'you'),
    shown: [], log: [],           // players put on a board, and every pick, across the whole series
  };
  Object.defineProperty(state, 'pool', { value: pool, enumerable: false });
  beginMatch(state);
  return state;
}

// Start a match's draft: draw its attribute, roll its formation (11-a-side), reset the money and the teams, deal the first board.
function beginMatch(state) {
  const rules = rulesOf(state);
  state.phase = 'draft';
  state.round = 1;
  state.formation = null;
  state.positions = [];
  state.money = { you: state.budgets?.you ?? rules.budget, bot: state.budgets?.bot ?? rules.budget };
  if (Math.min(state.money.you, state.money.bot) < rules.rounds * COMMON.minPrice) throw new Error('a budget must cover the minimum price for every round');
  state.teams = { you: [], bot: [] };
  state.paid = { you: [], bot: [] };
  state.board = [];
  state.turn = null;
  // the attribute is drawn now, at the start of the match, from the ones not yet used in this series
  const left = ATTRIBUTE_KEYS.filter((k) => !state.used.includes(k));
  const forced = state.forcedCategories?.[state.match - 1];
  state.category = forced ?? stream(state, `attribute|${state.match}`).pick(left);
  state.used.push(state.category);
  // the formation is rolled at the start of every match, and the draft works through it back to front: goalkeeper, defenders, midfielders, forwards
  const list = formationsOf(state.mode);
  const roll = stream(state, `formation|${state.match}`);
  state.formation = state.forcedFormation ? list.find((f) => f.name === state.forcedFormation) : roll.weighted(list.map((f) => [f, f.weight]));
  if (!state.formation) throw new Error(`unknown formation '${state.forcedFormation}'`);
  state.positions = formationPositions(state.formation);
  dealBoard(state);
}

// After a match, on to the next: a fresh draft.
export function nextMatch(state) {
  if (state.phase !== 'between') throw new Error('the series is not waiting for another match');
  state.match++;
  beginMatch(state);
}

export const positionOf = (state) => state.positions[state.round - 1];
// Alternates every round, and the side that picked first in the last round of a match goes second in the first round of the next
export const firstPicker = (state) => ((state.round + state.match) % 2 === 0 ? state.first1 : other(state.first1));
export const roundsAfter = (state) => rulesOf(state).rounds - state.round;

// You must keep £1 for each later round. So the most you can spend this round:
export const maxSpend = (state, who) => m1(state.money[who] - roundsAfter(state) * COMMON.minPrice);
export const canAfford = (state, who, price) => m1(price) <= maxSpend(state, who);

function dealBoard(state) {
  const pos = positionOf(state);
  const u = universeOf(state.pool)[pos];
  const rng = stream(state, `board|${state.match}|${state.round}`);
  const on = new Set(state.shown);
  const board = TIER_SLOTS.map((slot) => {
    // a tier can run out over a whole series (there are only five star goalkeepers): take the nearest tier that has someone left
    let tier = slot, options = [];
    for (let d = 0; d <= 4 && !options.length; d++) {
      for (const t of d === 0 ? [slot] : [slot - d, slot + d]) {
        if (t >= 1 && t <= 5 && !options.length) { options = u[t].filter((c) => !on.has(c.id)); tier = t; }
      }
    }
    if (!options.length) throw new Error(`no ${pos} left`);
    const card = rng.pick(options);
    on.add(card.id);
    const fair = u.fair.get(card.id);
    let price = fair;
    if (tier >= 2 && rng.next() < PRICE_NOISE) {
      const down = tier === 5 || rng.next() < 0.5;
      price += (down ? -1 : 1) * (0.8 + 0.8 * rng.next());
    }
    return { card, price: Math.max(COMMON.minPrice, Math.min(COMMON.maxPrice, m1(price))), fair, tier, takenBy: null };
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
  if (!canAfford(state, who, entry.price)) throw new Error(`over budget: you must keep £${COMMON.minPrice}m for every round still to come`);
  entry.takenBy = who;
  state.money[who] = m1(state.money[who] - entry.price);
  state.teams[who].push(instance(entry.card, 'base'));
  state.paid[who].push(entry.price);
  state.log.push({ round: state.round, who, id, name: entry.card.full, price: entry.price, fair: entry.fair, tier: entry.tier });
  state.picksThisRound++;
  if (state.picksThisRound === 1) { state.turn = other(who); return entry; }
  if (state.round === rulesOf(state).rounds) { state.phase = 'showdown'; state.turn = null; return entry; }
  state.round++;
  dealBoard(state);
  return entry;
}

export const free = (state) => state.board.filter((b) => !b.takenBy);

// ---- the showdown -----------------------------------------------------------------------------------------------------------
// Add each team up in this match's attribute: the bigger total wins the match (equal totals are a draw). Then: if one side has two
// matches, or all three have been played, the series is over; otherwise it waits for the next match.
export function showdown(state) {
  if (state.phase !== 'showdown') throw new Error('the teams are not picked yet');
  const category = state.category;
  const side = (who) => {
    const players = state.teams[who].map((card, i) => ({ card, value: valueOf(card, category), paid: state.paid[who][i] }));
    return { players, total: players.reduce((sum, p) => sum + p.value, 0) };
  };
  const you = side('you'), bot = side('bot');
  const result = { match: state.match, category, formation: state.formation, you, bot, winner: you.total > bot.total ? 'you' : bot.total > you.total ? 'bot' : 'draw' };
  state.results.push(result);
  const s = seriesOf(state);
  state.phase = s.over ? 'over' : 'between';
  return { ...result, series: s };
}

// Where the series stands. Most matches wins; if all three are played and it is level, the larger share of each attribute's all-time
// record wins; otherwise a draw.
export function seriesOf(state) {
  const wins = { you: 0, bot: 0 };
  for (const r of state.results) if (r.winner !== 'draw') wins[r.winner]++;
  const need = Math.ceil(state.total / 2);   // first to two in a best of three; one match in a tournament round
  const over = wins.you >= need || wins.bot >= need || state.results.length >= state.total;
  let winner = null, decidedBy = null;
  if (over) {
    if (wins.you !== wins.bot) { winner = wins.you > wins.bot ? 'you' : 'bot'; decidedBy = 'matches'; }
    else {
      const share = (who) => state.results.reduce((sum, r) => sum + r[who].total / recordOf(state.pool, r.category), 0);
      const sy = share('you'), sb = share('bot');
      winner = sy !== sb ? (sy > sb ? 'you' : 'bot') : 'draw';
      decidedBy = winner === 'draw' ? 'nothing' : 'share of the records';
    }
  }
  return { wins, over, winner, decidedBy, played: state.results.length };
}
