// One fixture: draw a hand, play and discard until you reach the target or run out of hands.
// Same rules as a Balatro blind: 8 in hand, 4 hands, 3 discards, no reshuffle.
import { scoreHand } from './scoring.js';

export const RULES = { handSize: 8, hands: 4, discards: 3 };

// A season is 38 matchdays, as in the league. Each is one fixture with its own target, climbing smoothly
// (geometrically) from TARGET_START to TARGET_END. The end value is a tuning knob: see tools/simulate.mjs.
export const SEASON_LENGTH = 38;
export const TARGET_START = 100;
export const TARGET_END = 40000; // tools/simulate.mjs: ~2% of a deck-building bot's seasons finish at this value (11% at 25,000, none at 70,000)

// Two significant figures, so targets read as 120 or 1,400 and not 118 or 1,396.
const nice = (x) => { const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };

// matchday: 1..38
export function fixtureTarget(matchday, { start = TARGET_START, end = TARGET_END, length = SEASON_LENGTH } = {}) {
  if (!Number.isInteger(matchday) || matchday < 1 || matchday > length) throw new Error(`matchday must be 1-${length}`);
  return nice(start * (end / start) ** ((matchday - 1) / (length - 1)));
}

// ---- the wheel ---------------------------------------------------------------------------------------------
// Before each fixture the wheel picks the category. Slice sizes are weights. VAR overturns the spin: you get
// VAR_PER_SEASON reviews per season, and each one spins again, to a different category.
export const WHEEL = { goals: 1, assists: 1, games: 1, discipline: 1 };
export const VAR_PER_SEASON = 5;

// not: a category to rule out (VAR never gives you the one you just had)
export function spinWheel(rng, wheel = WHEEL, { not } = {}) {
  const slices = Object.entries(wheel).filter(([k, w]) => w > 0 && k !== not);
  if (!slices.length) throw new Error('the wheel has no slices');
  return rng.weighted(slices);
}

// run: { deck: [card instances], jokers: [ids], handLevels: {}, scale }
export function startRound(run, { target, category, rng, rules = RULES }) {
  const drawPile = rng.shuffle([...run.deck]);
  const state = {
    category, target, rules, rng,
    drawPile, hand: [], discardPile: [],
    score: 0, handsLeft: rules.hands, discardsLeft: rules.discards,
    status: 'playing', plays: [],
    jokers: run.jokers ?? [], handLevels: run.handLevels ?? {}, scale: run.scale,
  };
  refill(state);
  return state;
}

function refill(state) {
  while (state.hand.length < state.rules.handSize && state.drawPile.length) state.hand.push(state.drawPile.pop());
}

function take(state, idxs) {
  const set = [...new Set(idxs)].sort((a, b) => a - b);
  if (!set.length || set.some((i) => !Number.isInteger(i) || i < 0 || i >= state.hand.length)) throw new Error('bad card selection');
  return set;
}

// idxs: positions in state.hand, 1-5 of them. Cards score left to right in hand order.
export function playHand(state, idxs) {
  if (state.status !== 'playing') throw new Error(`round is ${state.status}`);
  const set = take(state, idxs);
  if (set.length > 5) throw new Error('play at most 5 cards');
  const played = set.map((i) => state.hand[i]);
  const held = state.hand.filter((_, i) => !set.includes(i));
  const result = scoreHand(played, {
    category: state.category, scale: state.scale, jokers: state.jokers, handLevels: state.handLevels, held,
    state: { handsLeft: state.handsLeft, discardsLeft: state.discardsLeft },
  });
  state.score += result.total;
  state.handsLeft--;
  state.plays.push({ cards: played, ...result });
  state.hand = state.hand.filter((_, i) => !set.includes(i));
  state.discardPile.push(...played);
  if (state.score >= state.target) state.status = 'won';
  else if (state.handsLeft === 0 || (!state.hand.length && !state.drawPile.length)) state.status = 'lost';
  else refill(state);
  return result;
}

export function discard(state, idxs) {
  if (state.status !== 'playing') throw new Error(`round is ${state.status}`);
  if (state.discardsLeft <= 0) throw new Error('no discards left');
  const set = take(state, idxs);
  if (set.length > 5) throw new Error('discard at most 5 cards');
  state.discardPile.push(...set.map((i) => state.hand[i]));
  state.hand = state.hand.filter((_, i) => !set.includes(i));
  state.discardsLeft--;
  refill(state);
}
