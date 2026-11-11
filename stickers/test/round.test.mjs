import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/rng.js';
import { startRound, playHand, discard, RULES, fixtureTarget, SEASON_LENGTH } from '../src/engine/round.js';
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
