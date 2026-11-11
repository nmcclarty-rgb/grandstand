import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/rng.js';
import { startRound, playHand, discard, RULES, fixtureTarget, SEASON_LENGTH, spinWheel, WHEEL, VAR_PER_SEASON } from '../src/engine/round.js';
import { CATEGORY_KEYS } from '../src/engine/cards.js';
import { mk, scale } from './helpers.mjs';

const deck = (n = 24) => Array.from({ length: n }, (_, i) => mk({ goals: i, club: i % 2 ? 'ARS' : 'CHE' }));
const run = (d = deck()) => ({ deck: d, jokers: [], handLevels: {}, scale });
const start = (target = 100, seed = 1, d) => startRound(run(d), { target, category: 'goals', rng: makeRng(seed) });
const all = (s) => s.hand.length + s.drawPile.length + s.discardPile.length;

test('a round deals 8 and keeps every card somewhere', () => {
  const s = start();
  assert.equal(s.hand.length, RULES.handSize);
  assert.equal(all(s), 24);
  assert.equal(s.handsLeft, 4);
  assert.equal(s.discardsLeft, 3);
});

test('same seed, same deal; different seed, different deal', () => {
  const d = deck();
  const ids = (s) => s.hand.map((c) => c.uid).join();
  assert.equal(ids(start(100, 5, d)), ids(start(100, 5, d)));
  assert.notEqual(ids(start(100, 5, d)), ids(start(100, 6, d)));
});

test('playing removes the cards, scores them and refills the hand', () => {
  const s = start();
  const before = s.drawPile.length;
  const r = playHand(s, [0, 1]);
  assert.equal(s.score, r.total);
  assert.equal(s.handsLeft, 3);
  assert.equal(s.hand.length, 8);
  assert.equal(s.drawPile.length, before - 2);
  assert.equal(s.discardPile.length, 2);
  assert.equal(all(s), 24);
});

test('reaching the target wins at once; spare hands are kept', () => {
  const s = start(1);
  playHand(s, [0]);
  assert.equal(s.status, 'won');
  assert.equal(s.handsLeft, 3);
  assert.throws(() => playHand(s, [0]), /round is won/);
});

test('running out of hands under the target loses', () => {
  const s = start(1e9);
  for (let i = 0; i < 4; i++) playHand(s, [0]);
  assert.equal(s.status, 'lost');
});

test('discards are limited and refill the hand without scoring', () => {
  const s = start(1e9);
  for (let i = 0; i < 3; i++) discard(s, [0, 1, 2]);
  assert.equal(s.score, 0);
  assert.equal(s.hand.length, 8);
  assert.equal(s.discardsLeft, 0);
  assert.throws(() => discard(s, [0]), /no discards/);
});

test('bad selections are rejected', () => {
  const s = start();
  assert.throws(() => playHand(s, []), /bad card selection/);
  assert.throws(() => playHand(s, [99]), /bad card selection/);
  assert.throws(() => playHand(s, [0, 1, 2, 3, 4, 5]), /at most 5/);
});

test('no reshuffle: a small deck runs dry and the hand shrinks', () => {
  const s = start(1e9, 1, deck(10));
  playHand(s, [0, 1, 2, 3, 4]);
  assert.equal(s.hand.length, 5); // 8 dealt, 2 left in the pile, 5 played: 3 + 2 draws
  assert.equal(s.drawPile.length, 0);
});

test('a season is 38 matchdays and the target climbs smoothly from 100 to 40,000', () => {
  assert.equal(SEASON_LENGTH, 38);
  const targets = Array.from({ length: SEASON_LENGTH }, (_, i) => fixtureTarget(i + 1));
  assert.equal(targets[0], 100);
  assert.equal(targets[37], 40000);
  for (let i = 1; i < targets.length; i++) assert.ok(targets[i] > targets[i - 1], `matchday ${i + 1} must be harder than ${i}`);
  // geometric: each step is about the same ratio (rounding to 2 figures allows a little wobble)
  for (let i = 1; i < targets.length; i++) assert.ok(targets[i] / targets[i - 1] > 1.1 && targets[i] / targets[i - 1] < 1.3, `step ${i}`);
  // two significant figures
  for (const t of targets) assert.equal(Number(t.toPrecision(2)), t);
});

test('matchdays outside 1-38 are an error, and the curve can be retuned', () => {
  assert.throws(() => fixtureTarget(0), /matchday must be 1-38/);
  assert.throws(() => fixtureTarget(39), /matchday must be 1-38/);
  assert.throws(() => fixtureTarget(1.5), /matchday must be 1-38/);
  assert.equal(fixtureTarget(38, { end: 70000 }), 70000);
});

test('playing a hand passes the cards still in hand, so a held keeper adds Safe Hands', () => {
  // an 8-card deck is dealt whole: seven outfielders and one keeper
  const outfield = Array.from({ length: 7 }, (_, i) => mk({ pos: 'MID', club: `C${i}`, goals: 4 }));
  const keeper = mk({ pos: 'GK', club: 'WBA', games: 33, name: 'Foster' });
  const s = startRound(run([...outfield, keeper]), { target: 1e9, category: 'goals', rng: makeRng(1) });
  const gkIdx = s.hand.findIndex((c) => c.pos === 'GK');
  const midIdx = s.hand.findIndex((c) => c.pos === 'MID');
  const held = playHand(s, [midIdx]);
  assert.equal(held.mult, 1 + 3, 'keeper held: Kickabout x1 + Safe Hands 3');
  assert.ok(held.trace.some((t) => t.src === 'Safe Hands: Foster (held)'));
  // play the keeper himself and nothing is held, so no Safe Hands
  const s2 = startRound(run([...outfield, { ...keeper, uid: 'k2' }]), { target: 1e9, category: 'goals', rng: makeRng(1) });
  const played = playHand(s2, [s2.hand.findIndex((c) => c.pos === 'GK')]);
  assert.equal(played.mult, 1);
  assert.ok(gkIdx >= 0);
});

// ---- the wheel and VAR -----------------------------------------------------------------------------
test('the wheel has a slice for every category, and VAR gives you five a season', () => {
  assert.deepEqual(Object.keys(WHEEL).sort(), [...CATEGORY_KEYS].sort());
  assert.equal(VAR_PER_SEASON, 5);
});

test('a fair wheel lands on every category about equally often', () => {
  const rng = makeRng(7);
  const n = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
  for (let i = 0; i < 10000; i++) n[spinWheel(rng, WHEEL)]++;
  for (const k of CATEGORY_KEYS) assert.ok(Math.abs(n[k] / 10000 - 1 / CATEGORY_KEYS.length) < 0.02, `${k}: ${n[k]}`);
});

test('slice sizes are weights, and a zero slice never comes up', () => {
  const rng = makeRng(3);
  const n = { goals: 0, assists: 0, games: 0 };
  for (let i = 0; i < 9000; i++) n[spinWheel(rng, { goals: 6, assists: 3, games: 0, red: 0 })]++;
  assert.equal(n.games, 0);
  assert.ok(Math.abs(n.goals / 9000 - 2 / 3) < 0.03, JSON.stringify(n));
});

test('VAR spins again to a different category, and the same seed gives the same spins', () => {
  const rng = makeRng(11);
  for (let i = 0; i < 500; i++) {
    const first = spinWheel(rng);
    assert.notEqual(spinWheel(rng, WHEEL, { not: first }), first);
  }
  const seq = (seed) => { const r = makeRng(seed); return Array.from({ length: 12 }, () => spinWheel(r)).join(); };
  assert.equal(seq(5), seq(5));
  assert.notEqual(seq(5), seq(6));
  assert.throws(() => spinWheel(makeRng(1), { goals: 1 }, { not: 'goals' }), /no slices/);
});
