import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand, handBase, HANDS, HAND_ORDER } from '../src/engine/hands.js';
import { mk } from './helpers.mjs';

const type = (cards) => evaluateHand(cards).type;
const seasons = ['2016-17', '2017-18', '2018-19', '2019-20', '2020-21'];

test('hand table is ordered by base value, highest first', () => {
  const value = (t) => HANDS[t].chips * HANDS[t].mult;
  for (let i = 1; i < HAND_ORDER.length; i++) {
    assert.ok(value(HAND_ORDER[i - 1]) >= value(HAND_ORDER[i]), `${HAND_ORDER[i - 1]} < ${HAND_ORDER[i]}`);
  }
});

test('kickabout: only the best card in the category scores', () => {
  const a = mk({ club: 'ARS', goals: 3 }), b = mk({ club: 'CHE', goals: 9 }), c = mk({ club: 'LIV', goals: 5 });
  const r = evaluateHand([a, b, c], (card) => card.goals);
  assert.equal(r.type, 'kickabout');
  assert.deepEqual(r.scoring, [1]);
});

test('one-two needs the same club AND season', () => {
  const a = mk({ club: 'ARS', season: '2017-18' });
  assert.equal(type([a, mk({ club: 'ARS', season: '2017-18' }), mk({ club: 'CHE' })]), 'oneTwo');
  assert.equal(type([a, mk({ club: 'ARS', season: '2018-19' }), mk({ club: 'CHE' })]), 'kickabout');
  assert.equal(type([a, mk({ club: 'CHE', season: '2017-18' })]), 'kickabout');
});

test('one-two scores only the pair, not the kickers', () => {
  const cards = [mk({ club: 'CHE' }), mk({ club: 'ARS' }), mk({ club: 'LIV' }), mk({ club: 'ARS' })];
  assert.deepEqual(evaluateHand(cards).scoring, [1, 3]);
});

test('double act, triangle, back four, full strength, invincibles', () => {
  const t = (club, season = '2017-18') => mk({ club, season });
  assert.equal(type([t('ARS'), t('ARS'), t('CHE'), t('CHE'), t('LIV')]), 'doubleAct');
  assert.equal(type([t('ARS'), t('ARS'), t('ARS'), t('CHE'), t('LIV')]), 'triangle');
  assert.equal(type([t('ARS'), t('ARS'), t('ARS'), t('ARS'), t('LIV')]), 'backFour');
  assert.deepEqual(evaluateHand([t('ARS'), t('ARS'), t('ARS'), t('ARS'), t('LIV')]).scoring, [0, 1, 2, 3]);
  assert.equal(type([t('ARS'), t('ARS'), t('ARS'), t('CHE'), t('CHE')]), 'fullStrength');
  assert.equal(type([t('ARS'), t('ARS'), t('ARS'), t('ARS'), t('ARS')]), 'invincibles');
});

test('four-card hands can still make a double act, back four or triangle', () => {
  const t = (club) => mk({ club });
  assert.equal(type([t('ARS'), t('ARS'), t('CHE'), t('CHE')]), 'doubleAct');
  assert.equal(type([t('ARS'), t('ARS'), t('ARS'), t('ARS')]), 'backFour');
  assert.equal(type([t('ARS'), t('ARS'), t('ARS')]), 'triangle');
});

test('club side: five from one club across non-consecutive seasons', () => {
  const cards = ['2016-17', '2016-17', '2018-19', '2019-20', '2025-26'].map((season) => mk({ club: 'CHE', season }));
  // 2016-17 x2 would be a pair, but five of one club outranks it
  assert.equal(type(cards), 'clubSide');
});

test('run of seasons: five consecutive seasons, different clubs', () => {
  const clubs = ['ARS', 'CHE', 'LIV', 'MCI', 'TOT'];
  assert.equal(type(seasons.map((season, i) => mk({ season, club: clubs[i] }))), 'run');
  // a gap breaks it
  const gap = ['2016-17', '2017-18', '2018-19', '2019-20', '2021-22'].map((season, i) => mk({ season, club: clubs[i] }));
  assert.equal(type(gap), 'kickabout');
});

test('dynasty: five consecutive seasons at one club beats club side and run', () => {
  assert.equal(type(seasons.map((season) => mk({ season, club: 'LIV' }))), 'dynasty');
});

test('spine: GK + DEF + MID + FWD all score, kicker included', () => {
  const four = ['GK', 'DEF', 'MID', 'FWD'].map((pos, i) => mk({ pos, club: ['ARS', 'CHE', 'LIV', 'MCI'][i] }));
  const r = evaluateHand(four);
  assert.equal(r.type, 'spine');
  assert.deepEqual(r.scoring, [0, 1, 2, 3]);
  const five = [...four, mk({ pos: 'DEF', club: 'TOT' })];
  assert.deepEqual(evaluateHand(five).scoring, [0, 1, 2, 3, 4]);
  // three positions is not a spine
  assert.equal(type(['GK', 'DEF', 'MID', 'MID'].map((pos, i) => mk({ pos, club: ['ARS', 'CHE', 'LIV', 'MCI'][i] }))), 'kickabout');
});

test('hat-trick: one player, three seasons', () => {
  const salah = (season, club = 'LIV') => mk({ pid: 118748, season, club });
  const r = evaluateHand([salah('2017-18'), mk({ club: 'CHE' }), salah('2018-19'), salah('2019-20')]);
  assert.equal(r.type, 'hatTrick');
  assert.deepEqual(r.scoring, [0, 2, 3]);
});

test('better hands win when several match', () => {
  // Spine in a 4-card hand where two cards are team-mates: spine (30x4) outranks one-two
  const cards = [mk({ pos: 'GK', club: 'ARS' }), mk({ pos: 'DEF', club: 'ARS' }), mk({ pos: 'MID', club: 'LIV' }), mk({ pos: 'FWD', club: 'CHE' })];
  assert.equal(type(cards), 'spine');
  // Triangle beats a spine-less hand of the same size; back four beats spine
  const bf = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => mk({ pos, club: 'ARS' }));
  assert.equal(type(bf), 'backFour');
});

test('hand sizes are enforced', () => {
  assert.throws(() => evaluateHand([]));
  assert.throws(() => evaluateHand(Array.from({ length: 6 }, () => mk())));
});

test('training levels add per level', () => {
  assert.deepEqual(handBase('oneTwo', 1), { chips: 10, mult: 2 });
  assert.deepEqual(handBase('oneTwo', 3), { chips: 10 + 15 * 2, mult: 2 + 1 * 2 });
});
