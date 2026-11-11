// One fixture: draw a hand, play and discard until you reach the target or run out of hands.
// Same rules as a Balatro blind: 8 in hand, 4 hands, 3 discards, no reshuffle.
import { scoreHand } from './scoring.js';

export const RULES = { handSize: 8, hands: 4, discards: 3 };

// Balatro's ante curve (small blind), ×1 / ×1.5 / ×2 for the three fixtures of a stage.
// Placeholder until the balance sim says otherwise: see tools/simulate.mjs.
export const STAGE_BASE = [100, 300, 800, 2000, 5000, 11000, 20000, 35000];
export const FIXTURE_KINDS = [
  { id: 'league', name: 'League', factor: 1 },
  { id: 'cup',    name: 'Cup tie', factor: 1.5 },
  { id: 'derby',  name: 'Derby',  factor: 2 },
];
export const fixtureTarget = (stage, slot, base = STAGE_BASE) => Math.round(base[stage] * FIXTURE_KINDS[slot].factor);

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
  const result = scoreHand(played, {
    category: state.category, scale: state.scale, jokers: state.jokers, handLevels: state.handLevels,
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
