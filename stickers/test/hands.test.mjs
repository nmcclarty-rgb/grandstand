import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand, handBase, HANDS, HAND_ORDER, sharedStints } from '../src/engine/hands.js';
import { mk } from './helpers.mjs';

const type = (cards) => evaluateHand(cards).type;
// a career: where he played, as club-seasons, and the clubs that makes
const career = (stints, over = {}) => {
  const clubs = [...new Set(stints.map((s) => s.split('|')[0]))];
  return mk({ stints, club: clubs[0], clubs: clubs.map((c) => [c, 100]), first: stints[0].split('|')[1], ...over });
};

test('hand table is ordered by base value, highest first', () => {
  const value = (t) => HANDS[t].chips * HANDS[t].mult;
  for (let i = 1; i < HAND_ORDER.length; i++) {
    assert.ok(value(HAND_ORDER[i - 1]) >= value(HAND_ORDER[i]), `${HAND_ORDER[i - 1]} < ${HAND_ORDER[i]}`);
  }
  assert.equal(HAND_ORDER.length, 11);
  assert.ok(!HAND_ORDER.includes('dynasty') && !HAND_ORDER.includes('run'), 'consecutive seasons mean nothing for a career card');
});

test('kickabout: only the best card in the category scores', () => {
  const cards = [mk({ club: 'ARS', goals: 3 }), mk({ club: 'CHE', goals: 9 }), mk({ club: 'LIV', goals: 5 })];
  const r = evaluateHand(cards, (c) => c.goals);
  assert.equal(r.type, 'kickabout');
  assert.deepEqual(r.scoring, [1]);
});

test('team-mates share a club-season: same club AND same season', () => {
  const a = mk({ club: 'ARS', season: '2017-18' });
  assert.equal(type([a, mk({ club: 'ARS', season: '2017-18' }), mk({ club: 'CHE' })]), 'oneTwo');
  assert.equal(type([a, mk({ club: 'ARS', season: '2018-19' })]), 'kickabout');   // same club, different seasons
  assert.equal(type([a, mk({ club: 'CHE', season: '2017-18' })]), 'kickabout');   // same season, different clubs
});

test('a career spans seasons: two players who overlapped in ANY season were team-mates', () => {
  const lampard = career(['WHU|1999-00', 'CHE|2004-05', 'CHE|2005-06', 'MCI|2014-15']);
  const terry = career(['CHE|2004-05', 'CHE|2005-06', 'CHE|2006-07']);
  const cole = career(['ARS|2003-04', 'CHE|2005-06', 'CHE|2006-07']);
  const keeper = career(['WHU|2014-15']);
  assert.deepEqual(sharedStints([lampard, terry]).sort(), ['CHE|2004-05', 'CHE|2005-06']);
  assert.equal(type([lampard, terry]), 'oneTwo');
  assert.equal(type([lampard, keeper]), 'kickabout');           // both at West Ham, but 15 years apart
  assert.equal(type([lampard, terry, cole]), 'triangle');       // all three were at Chelsea in 2005-06
});

test('one-two scores only the pair, not the kickers, and picks the better pair', () => {
  const [X1, X2] = ['ARS|2001-02', 'ARS|2002-03'];
  const a = career([X1, X2], { goals: 5 }), b = career([X1], { goals: 9 }), c = career([X2], { goals: 2 }), d = career(['LIV|2010-11']);
  // a-b share X1, a-c share X2, b-c share nothing: the pair with the most chips scores
  const r = evaluateHand([a, b, c, d], (card) => card.goals);
  assert.equal(r.type, 'oneTwo');
  assert.deepEqual(r.scoring, [0, 1]);
  assert.deepEqual(evaluateHand([d, a, c], (card) => card.goals).scoring, [1, 2]);
});

test('triangle, back four, invincibles: all of them need ONE club-season in common', () => {
  const s = 'CHE|2004-05';
  const mates = (n) => Array.from({ length: n }, (_, i) => career([s, `CHE|200${5 + (i % 3)}-0${6 + (i % 3)}`])); // all at Chelsea in 2004-05, then different seasons
  let strangers = 0;
  const other = () => career([`LIV|20${10 + strangers}-${11 + strangers++}`]); // each a different season, so no two are team-mates
  assert.equal(type([...mates(3), other(), other()]), 'triangle');
  assert.equal(type([...mates(4), other()]), 'backFour');
  assert.deepEqual(evaluateHand([...mates(4), other()]).scoring, [0, 1, 2, 3]);
  assert.equal(type(mates(5)), 'invincibles');
  assert.equal(type([...mates(2), other()]), 'oneTwo');
});

test('three players who each overlapped with another, but never all together, are not a triangle', () => {
  const a = career(['X|2000-01', 'Y|2001-02']), b = career(['X|2000-01', 'Z|2002-03']), c = career(['Y|2001-02', 'Z|2002-03']);
  assert.deepEqual(sharedStints([a, b, c]), []);
  assert.equal(type([a, b, c]), 'oneTwo');   // only a pair of them
});

test('full strength: a trio who shared a club-season and a pair who shared another', () => {
  const trio = [1, 2, 3].map(() => career(['CHE|2004-05']));
  const pair = [1, 2].map(() => career(['MUN|1998-99']));
  assert.equal(type([...trio, ...pair]), 'fullStrength');
  // a trio and two strangers is only a triangle
  assert.equal(type([...trio, career(['MUN|1998-99']), career(['LIV|2010-11'])]), 'triangle');
});

test('double act: two pairs of team-mates, four cards score', () => {
  const [a, b] = [1, 2].map(() => career(['ARS|2003-04']));
  const [c, d] = [1, 2].map(() => career(['EVE|2008-09']));
  const r = evaluateHand([a, c, mk({ club: 'LIV', season: '2010-11' }), b, d]);
  assert.equal(r.type, 'doubleAct');
  assert.deepEqual(r.scoring, [0, 1, 3, 4]);
});

test('club side: five who all played for one club, whenever, with no club-season in common', () => {
  const players = [['ARS|1993-94'], ['ARS|1998-99'], ['ARS|2003-04'], ['ARS|2009-10'], ['ARS|2016-17']].map((s, i) => career(s, { first: `${1993 + 5 * i}-0${i}` }));
  assert.equal(type(players), 'clubSide');
  // one of them never played there
  players[2] = career(['CHE|2003-04']);
  assert.notEqual(type(players), 'clubSide');
});

test('club side counts every club a player has been at, not only his main one', () => {
  const players = [
    career(['WHU|1995-96', 'CHE|2001-02']), career(['LEE|1996-97', 'CHE|2003-04']), career(['MUN|1999-00', 'CHE|2008-09']),
    career(['AVL|2000-01', 'CHE|2011-12']), career(['TOT|2002-03', 'CHE|2014-15']),
  ];
  assert.equal(type(players), 'clubSide');
});

test('class of: five who all debuted within three seasons of each other', () => {
  const debut = (y) => career([`CLUB${y}|${y}-${String(y + 1).slice(2)}`], { first: `${y}-${String(y + 1).slice(2)}` });
  assert.equal(type([1992, 1993, 1994, 1993, 1992].map(debut)), 'classOf');
  assert.notEqual(type([1992, 1993, 1994, 1993, 1996].map(debut)), 'classOf', 'a four-season spread is not a class');
  assert.equal(type([1992, 1993, 1994].map(debut)), 'kickabout', 'it needs five');
});

test('hat-trick: three foil stickers, and only the foils score', () => {
  const foil = (edition) => mk({ club: 'ARS', season: '2001-02', edition, name: edition, stints: [`X${edition}|2000-01`], first: '2000-01' });
  const cards = [foil('shiny'), mk({ club: 'LIV', season: '2005-06' }), foil('holo'), foil('gold')];
  const r = evaluateHand(cards);
  assert.equal(r.type, 'hatTrick');
  assert.deepEqual(r.scoring, [0, 2, 3]);
  assert.notEqual(type([foil('shiny'), foil('holo'), mk({ club: 'LIV', season: '2005-06' })]), 'hatTrick');
});

test('spine: GK + DEF + MID + FWD all score, kicker included', () => {
  const four = ['GK', 'DEF', 'MID', 'FWD'].map((pos, i) => mk({ pos, club: ['ARS', 'CHE', 'LIV', 'MCI'][i] }));
  const r = evaluateHand(four);
  assert.equal(r.type, 'spine');
  assert.deepEqual(r.scoring, [0, 1, 2, 3]);
  const five = [...four, mk({ pos: 'DEF', club: 'TOT' })];
  assert.deepEqual(evaluateHand(five).scoring, [0, 1, 2, 3, 4]);
  assert.equal(type(['GK', 'DEF', 'MID', 'MID'].map((pos, i) => mk({ pos, club: ['ARS', 'CHE', 'LIV', 'MCI'][i] }))), 'kickabout');
});

test('better hands win when several match', () => {
  // five team-mates who also all played for one club: Invincibles outranks Club Side
  assert.equal(type(Array.from({ length: 5 }, () => career(['ARS|2003-04']))), 'invincibles');
  // a spine of four where two are team-mates: Spine (15x2) outranks One-Two (10x2)
  const spine = [mk({ pos: 'GK', club: 'ARS' }), mk({ pos: 'DEF', club: 'ARS' }), mk({ pos: 'MID', club: 'LIV' }), mk({ pos: 'FWD', club: 'CHE' })];
  assert.equal(type(spine), 'spine');
  // a spine of four team-mates is a Back Four, which is worth more
  assert.equal(type(['GK', 'DEF', 'MID', 'FWD'].map((pos) => mk({ pos, club: 'ARS' }))), 'backFour');
});

test('hand sizes are enforced', () => {
  assert.throws(() => evaluateHand([]));
  assert.throws(() => evaluateHand(Array.from({ length: 6 }, () => mk())));
});

test('training levels add per level', () => {
  assert.deepEqual(handBase('oneTwo', 1), { chips: 10, mult: 2 });
  assert.deepEqual(handBase('oneTwo', 3), { chips: 10 + 15 * 2, mult: 2 + 1 * 2 });
});
