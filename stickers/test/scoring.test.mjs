import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreHand } from '../src/engine/scoring.js';
import { safeHands } from '../src/engine/cards.js';
import { mk, scale } from './helpers.mjs';

const ctx = (over = {}) => ({ category: 'goals', scale, jokers: [], handLevels: {}, state: { handsLeft: 4, discardsLeft: 3 }, ...over });
// a one-two: two Arsenal 17/18 players worth 20 and 10 chips on goals (2 chips per goal)
const pair = (over = [{}, {}]) => [mk({ goals: 10, ...over[0] }), mk({ goals: 5, ...over[1] })];

test('chips x mult: base hand + each scoring card, then multiply', () => {
  const r = scoreHand(pair(), ctx());
  assert.equal(r.type, 'oneTwo');
  assert.equal(r.chips, 10 + 20 + 10);
  assert.equal(r.mult, 2);
  assert.equal(r.total, 80);
});

test('a kicker adds nothing', () => {
  const kicker = mk({ club: 'CHE', goals: 50 });
  const r = scoreHand([...pair(), kicker], ctx());
  assert.equal(r.total, 80);
});

test('kickabout scores only the best card in the round category', () => {
  const cards = [mk({ club: 'ARS', goals: 4, assists: 20 }), mk({ club: 'CHE', goals: 9, assists: 1 })];
  assert.equal(scoreHand(cards, ctx({ category: 'goals' })).total, (5 + 18) * 1);
  assert.equal(scoreHand(cards, ctx({ category: 'assists' })).total, (5 + 20) * 1);
});

test('the category changes what a card is worth, not what hand it makes', () => {
  const cards = pair([{ assists: 7 }, { assists: 1 }]);
  assert.equal(scoreHand(cards, ctx({ category: 'assists' })).total, (10 + 7 + 1) * 2);
});

test('hand training level raises base chips and mult', () => {
  const r = scoreHand(pair(), ctx({ handLevels: { oneTwo: 3 } }));
  assert.equal(r.chips, 40 + 30);
  assert.equal(r.mult, 4);
  assert.equal(r.total, 280);
});

test('editions: shiny +40 chips, holo +6 mult, gold x1.5 mult', () => {
  assert.equal(scoreHand(pair([{ edition: 'shiny' }, {}]), ctx()).total, (40 + 40) * 2);
  assert.equal(scoreHand(pair([{ edition: 'holo' }, {}]), ctx()).total, 40 * (2 + 6));
  assert.equal(scoreHand(pair([{ edition: 'gold' }, {}]), ctx()).total, 40 * 3);
});

test('order matters: a gold card multiplies the mult built so far, a later +mult is not multiplied', () => {
  // DEF at ARS 17/18: Park the Bus adds +4 on that card's turn.
  const cards = [mk({ pos: 'DEF', edition: 'gold', goals: 10 }), mk({ pos: 'DEF', goals: 5 })];
  const r = scoreHand(cards, ctx({ jokers: ['parkTheBus'] }));
  // card 1: x1.5 -> 3, +4 -> 7 ; card 2: +4 -> 11
  assert.equal(r.mult, 11);
  assert.equal(r.total, 40 * 11);
});

test('the trace adds up to the total', () => {
  const r = scoreHand(pair([{ edition: 'gold' }, {}]), ctx({ jokers: ['routeOne', 'addedTime'], state: { handsLeft: 1, discardsLeft: 0 } }));
  const last = r.trace.at(-1);
  assert.equal(Math.floor(last.runChips * last.runMult), r.total);
  assert.equal(r.trace[0].src, 'One-Two');
});

test('unknown manager is an error, not a silent no-op', () => {
  assert.throws(() => scoreHand(pair(), ctx({ jokers: ['nope'] })), /unknown manager/);
});

// ---- managers -------------------------------------------------------------------
const total = (cards, jokers, over = {}) => scoreHand(cards, ctx({ jokers, ...over })).total;
const club = (c, extra = {}) => mk({ club: c, ...extra });

test('Park the Bus: +4 mult per scoring DEF only', () => {
  const cards = [mk({ pos: 'DEF', goals: 10 }), mk({ pos: 'MID', goals: 5 })];
  assert.equal(total(cards, ['parkTheBus']), 40 * (2 + 4));
});

test('Route One: +30 chips per scoring FWD', () => {
  const cards = [mk({ pos: 'FWD', goals: 10 }), mk({ pos: 'FWD', goals: 5 })];
  assert.equal(total(cards, ['routeOne']), (40 + 60) * 2);
});

test('Sweeper Keeper: x2 only when a GK scores', () => {
  const withGk = [mk({ pos: 'GK', goals: 10 }), mk({ pos: 'MID', goals: 5 })];
  assert.equal(total(withGk, ['sweeperKeeper']), 40 * 4);
  assert.equal(total(pair(), ['sweeperKeeper']), 80);
});

test('Total Football: +12 mult when scoring cards span 3+ clubs', () => {
  const spine = ['GK', 'DEF', 'MID', 'FWD'].map((pos, i) => club(['ARS', 'CHE', 'LIV', 'MCI'][i], { pos, goals: 1 }));
  const plain = scoreHand(spine, ctx());
  assert.equal(scoreHand(spine, ctx({ jokers: ['totalFootball'] })).mult, plain.mult + 12);
  assert.equal(total(pair(), ['totalFootball']), 80); // one club only
});

test('One-Club Man: +6 mult for each scoring player who spent 8+ seasons at one club and no other', () => {
  const seasons = (n) => Array.from({ length: n }, (_, i) => `ARS|${2000 + i}-0${i + 1}`);
  const giggs = mk({ stints: seasons(8), clubs: [['ARS', 300]], goals: 4 });                    // 8 seasons, one club: counts
  const nearly = mk({ stints: seasons(7), clubs: [['ARS', 300]], goals: 4 });                   // 7 seasons: not yet
  const traveller = mk({ stints: seasons(8), clubs: [['ARS', 200], ['CHE', 100]], goals: 4 });  // 8 seasons, two clubs: no
  const base = scoreHand([mk({ goals: 4 })], ctx()).mult;
  assert.equal(scoreHand([giggs], ctx({ jokers: ['oneClubMan'] })).mult, base + 6);
  assert.equal(scoreHand([nearly], ctx({ jokers: ['oneClubMan'] })).mult, base);
  assert.equal(scoreHand([traveller], ctx({ jokers: ['oneClubMan'] })).mult, base);
});
test('Golden Boot: +4 mult for each scoring card with a Goals rating of 60+ (in any category)', () => {
  const cards = [mk({ goals: 60 }), mk({ goals: 59 })];   // the rating equals the number in tests
  const r = scoreHand(cards, ctx({ category: 'assists', jokers: ['goldenBoot'] }));
  assert.equal(r.mult, 2 + 4);                               // only the first clears the bar, and it is not a Goals round
});
test('Playmaker: +4 mult for each scoring card with an Assists rating of 60+', () => {
  const cards = [mk({ assists: 60 }), mk({ assists: 59 })];
  assert.equal(scoreHand(cards, ctx({ jokers: ['playmaker'] })).mult, 2 + 4);
});

test('Added Time: x2 on the last hand only', () => {
  assert.equal(total(pair(), ['addedTime'], { state: { handsLeft: 1, discardsLeft: 0 } }), 160);
  assert.equal(total(pair(), ['addedTime'], { state: { handsLeft: 2, discardsLeft: 0 } }), 80);
});

test('Vintage Stickers: +20 chips per scoring card from the 1990s', () => {
  const nineties = [mk({ season: '1993-94', club: 'NEW', goals: 10 }), mk({ season: '1993-94', club: 'NEW', goals: 5 })];
  assert.equal(total(nineties, ['vintage']), (40 + 40) * 2);
  const modern = [mk({ season: '2018-19', goals: 10 }), mk({ season: '2018-19', goals: 5 })];
  assert.equal(total(modern, ['vintage']), 80);
  // the cut-off is 2000/01: only the best card scores in a Kickabout, so swap which one that is
  const late = [mk({ season: '1999-00', club: 'ARS', goals: 5 }), mk({ season: '2000-01', club: 'CHE', goals: 10 })];
  assert.equal(scoreHand(late, ctx({ jokers: ['vintage'] })).chips, 5 + 20);
  const early = [mk({ season: '1999-00', club: 'ARS', goals: 10 }), mk({ season: '2000-01', club: 'CHE', goals: 5 })];
  assert.equal(scoreHand(early, ctx({ jokers: ['vintage'] })).chips, 5 + 20 + 20);
});

test('Super Sub: +15 chips per discard left', () => {
  assert.equal(total(pair(), ['superSub'], { state: { handsLeft: 4, discardsLeft: 2 } }), (40 + 30) * 2);
});

test("Captain's Armband: the first scoring card scores twice, editions and all", () => {
  const cards = pair([{ edition: 'shiny' }, {}]);
  const r = scoreHand(cards, ctx({ jokers: ['captain'] }));
  assert.equal(r.chips, 10 + (20 + 40) * 2 + 10);
  // a kicker is not the "first scoring card"
  const withKicker = [mk({ club: 'CHE', goals: 99 }), ...pair()];
  assert.equal(scoreHand(withKicker, ctx({ jokers: ['captain'] })).chips, 10 + 20 * 2 + 10);
});

test('specialists: x1.5 only in their category', () => {
  assert.equal(total(pair(), ['poacher'], { category: 'goals' }), 40 * 3);
  const assistPair = pair([{ assists: 10 }, { assists: 5 }]);
  assert.equal(total(assistPair, ['poacher'], { category: 'assists' }), (10 + 15) * 2);
  assert.equal(total(assistPair, ['creator'], { category: 'assists' }), (10 + 15) * 3);
});

test('managers stack in order: +mult then xmult is not the same as xmult then +mult', () => {
  const cards = [mk({ pos: 'DEF', goals: 10 }), mk({ pos: 'DEF', goals: 5 })];
  // Park the Bus +4 per DEF on the cards (mult 2 -> 10) comes before Added Time's x2 on the hand (-> 20), not 2x2+8 = 12
  assert.equal(scoreHand(cards, ctx({ jokers: ['parkTheBus', 'addedTime'], state: { handsLeft: 1, discardsLeft: 0 } })).mult, 20);
});

// ---- the keeper's ability: Safe Hands ------------------------------------------------------------
const gk = (games, over = {}) => mk({ pos: 'GK', games, club: 'WBA', ...over });

test('Safe Hands is worth +3 / +2 / +1 mult by career appearances (250+ / 100+ / fewer), and only goalkeepers have it', () => {
  assert.deepEqual([572, 250, 249, 100, 99, 20].map((g) => safeHands(gk(g))), [3, 3, 2, 2, 1, 1]);
  for (const pos of ['DEF', 'MID', 'FWD']) assert.equal(safeHands(mk({ pos, games: 38 })), 0);
});

test('a keeper held in hand adds his mult to the hand you play', () => {
  assert.equal(scoreHand(pair(), ctx({ held: [gk(300)] })).total, 40 * (2 + 3));
  assert.equal(scoreHand(pair(), ctx({ held: [gk(150)] })).total, 40 * (2 + 2));
  assert.equal(scoreHand(pair(), ctx({ held: [gk(30)] })).total, 40 * (2 + 1));
});

test('keepers held in hand stack; outfield players held add nothing', () => {
  assert.equal(scoreHand(pair(), ctx({ held: [gk(300), gk(150)] })).total, 40 * (2 + 3 + 2));
  assert.equal(scoreHand(pair(), ctx({ held: [mk({ pos: 'DEF', games: 38 }), mk({ pos: 'MID' })] })).total, 80);
  assert.equal(scoreHand(pair(), ctx({ held: [] })).total, 80);
  assert.equal(scoreHand(pair(), ctx()).total, 80); // held is optional
});

test('hold or play: a keeper you play does not add Safe Hands', () => {
  const played = [gk(300, { goals: 10 }), mk({ goals: 5 }), gk(250, { club: 'CHE' })];
  const r = scoreHand(played, ctx({ held: [] }));
  assert.ok(!r.trace.some((t) => /Safe Hands/.test(t.src)));
});

test('Safe Hands comes after the cards and before the managers, and shows in the trace', () => {
  // Added Time (x2 on the last hand) comes after: (2 + 3) x 2 = 10, not 2 x 2 + 3 = 7
  const r = scoreHand(pair(), ctx({ jokers: ['addedTime'], state: { handsLeft: 1, discardsLeft: 0 }, held: [gk(300, { name: 'Foster' })] }));
  assert.equal(r.mult, 10);
  assert.equal(r.total, 40 * 10);
  const order = r.trace.map((t) => t.src);
  assert.ok(order.indexOf('Safe Hands: Foster (held)') > order.indexOf(r.trace.find((t) => t.src.startsWith('P')).src));
  assert.ok(order.indexOf('Safe Hands: Foster (held)') < order.indexOf('Added Time'));
});

test('Discipline is a category: a yellow is 1 point, a red is 3, and it is worth chips like any stat', () => {
  // 7 yellows + 2 reds = 13 points; 3 yellows = 3 points; 2 chips a point in the test scale
  const cards = [mk({ club: 'ARS', yellow: 7, red: 2 }), mk({ club: 'CHE', yellow: 3, red: 0 })];
  assert.equal(scoreHand(cards, ctx({ category: 'discipline' })).chips, 5 + 13 * 2);
  // a red card alone is worth 3 points: a card with one red beats a card with two yellows
  const hardMan = [mk({ club: 'ARS', yellow: 0, red: 1 }), mk({ club: 'CHE', yellow: 2, red: 0 })];
  assert.equal(scoreHand(hardMan, ctx({ category: 'discipline' })).chips, 5 + 3 * 2);
  assert.equal(scoreHand(cards, ctx({ category: 'goals' })).chips, 5); // no goals: only the hand's base
});

test('Hard Man: x1.5 mult on Discipline fixtures only', () => {
  const dirty = [mk({ yellow: 5 }), mk({ yellow: 2 })];
  assert.equal(scoreHand(dirty, ctx({ category: 'discipline', jokers: ['hardMan'] })).mult, 2 * 1.5);
  assert.equal(scoreHand(dirty, ctx({ category: 'goals', jokers: ['hardMan'] })).mult, 2);
});
