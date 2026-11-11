import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPool } from './helpers.mjs';
import {
  ECONOMY, newSeason, useVar, kickOff, finishMatchday, nextMatchday, rerollShop, rerollCost, buy, takePack, sellManager,
  sellValue, releaseCard, priceOf, trainingPrice, serialize, restore, ownedCopy,
} from '../src/engine/season.js';
import { playHand, SEASON_LENGTH, VAR_PER_SEASON, fixtureTarget } from '../src/engine/round.js';
import { CATEGORY_KEYS } from '../src/engine/cards.js';
import { JOKERS } from '../src/engine/jokers.js';

const pool = loadPool();
const fresh = (seed = 'test') => newSeason(pool, seed);

// force the fixture: lower the target so one hand wins it, or raise it and use up the hands so it loses
function win(run, spareHands) {
  const round = kickOff(run);
  round.target = 1;
  if (spareHands !== undefined) round.handsLeft = spareHands + 1;
  playHand(round, [0]);
  return finishMatchday(run);
}
function lose(run) {
  const round = kickOff(run);
  round.target = 1e12;
  round.handsLeft = 1;
  playHand(round, [0]);
  return finishMatchday(run);
}
// get to the shop with some money
function toShop(run, money = 100) { win(run); run.money = money; return run; }

test('a new season: matchday 1, £4, a 24-card squad, 5 VARs, a category already spun', () => {
  const run = fresh();
  assert.equal(run.matchday, 1);
  assert.equal(run.money, ECONOMY.startMoney);
  assert.equal(run.deck.length, 24);
  assert.equal(run.varLeft, VAR_PER_SEASON);
  assert.equal(run.phase, 'intro');
  assert.equal(run.status, 'playing');
  assert.ok(CATEGORY_KEYS.includes(run.fixture.category));
  assert.equal(run.fixture.target, 100);
  assert.deepEqual(run.jokers, []);
});

test('the same seed is the same season: squad, spin, deal, shop', () => {
  const a = fresh('s1'), b = fresh('s1'), c = fresh('s2');
  assert.equal(a.deck.map((x) => x.id).join(), b.deck.map((x) => x.id).join());
  assert.equal(a.fixture.category, b.fixture.category);
  const [ra, rb] = [kickOff(a), kickOff(b)];
  assert.equal(ra.hand.map((x) => x.id).join(), rb.hand.map((x) => x.id).join());
  assert.notEqual(a.deck.map((x) => x.id).join(), c.deck.map((x) => x.id).join());
  for (const [run, round] of [[a, ra], [b, rb]]) { round.target = 1; playHand(round, [0]); finishMatchday(run); }
  assert.equal(JSON.stringify(a.shop), JSON.stringify(b.shop));
});

test('VAR spins again to a different category, costs one of five, and is only for before kick-off', () => {
  const run = fresh();
  const first = run.fixture.category;
  const second = useVar(run);
  assert.notEqual(second, first);
  assert.equal(run.varLeft, VAR_PER_SEASON - 1);
  assert.equal(run.fixture.varUsed, 1);
  kickOff(run);
  assert.throws(() => useVar(run), /only before kick-off/);
});

test('VAR runs out after five, and the spin it gives is the same every time for a seed', () => {
  const run = fresh('var');
  for (let i = 0; i < VAR_PER_SEASON; i++) useVar(run);
  assert.equal(run.varLeft, 0);
  assert.throws(() => useVar(run), /no VAR reviews left/);
  const again = fresh('var');
  for (let i = 0; i < VAR_PER_SEASON; i++) useVar(again);
  assert.equal(again.fixture.category, run.fixture.category);
});

test('kick-off deals 8 cards with the matchday target and the spun category', () => {
  const run = fresh();
  const round = kickOff(run);
  assert.equal(run.phase, 'play');
  assert.equal(round.hand.length, 8);
  assert.equal(round.target, 100);
  assert.equal(round.category, run.fixture.category);
  assert.throws(() => kickOff(run), /cannot kick off/);
});

test('a win pays £4 plus £1 per spare hand and opens the shop on the next matchday', () => {
  const run = fresh();
  const r = win(run, 2);
  assert.deepEqual(r, { won: true, payout: 6, spare: 2 });
  assert.equal(run.money, ECONOMY.startMoney + 6);
  assert.equal(run.matchday, 2);
  assert.equal(run.cleared, 1);
  assert.equal(run.phase, 'shop');
  assert.equal(run.history.length, 1);
  assert.equal(run.history[0].won, true);
});

test('a loss ends the season and pays nothing', () => {
  const run = fresh();
  const r = lose(run);
  assert.equal(r.won, false);
  assert.equal(run.status, 'lost');
  assert.equal(run.phase, 'over');
  assert.equal(run.money, ECONOMY.startMoney);
  assert.equal(run.cleared, 0);
  assert.equal(run.history[0].won, false);
  assert.throws(() => nextMatchday(run), /not in the shop/);
});

test('winning matchday 38 wins the season', () => {
  const run = fresh();
  run.matchday = SEASON_LENGTH;
  run.fixture.matchday = SEASON_LENGTH;
  run.fixture.target = fixtureTarget(SEASON_LENGTH);
  win(run);
  assert.equal(run.status, 'won');
  assert.equal(run.phase, 'over');
  assert.equal(run.shop, null);
});

test('the shop has two packs, two managers you do not own and two trainings, and is seeded', () => {
  const run = toShop(fresh());
  const kinds = run.shop.offers.map((o) => o.kind).sort();
  assert.deepEqual(kinds, ['manager', 'manager', 'pack', 'pack', 'training', 'training']);
  const managers = run.shop.offers.filter((o) => o.kind === 'manager');
  assert.equal(new Set(managers.map((o) => o.id)).size, 2);
  for (const m of managers) assert.equal(m.price, JOKERS[m.id].cost);
  const packs = run.shop.offers.filter((o) => o.kind === 'pack');
  for (const p of packs) assert.equal(p.price, ECONOMY.pack[p.type]);
});

test('buying a manager takes the money, adds him, and cannot be done twice or without money', () => {
  const run = toShop(fresh(), 100);
  const offer = run.shop.offers.find((o) => o.kind === 'manager');
  buy(run, offer.slot);
  assert.equal(run.money, 100 - offer.price);
  assert.deepEqual(run.jokers, [offer.id]);
  assert.throws(() => buy(run, offer.slot), /already bought/);
  const other = run.shop.offers.find((o) => o.kind === 'manager' && !o.bought);
  run.money = other.price - 1;
  assert.throws(() => buy(run, other.slot), /not enough money/);
});

test('five manager slots: a sixth needs a sale', () => {
  const run = toShop(fresh(), 1000);
  run.jokers = ['parkTheBus', 'routeOne', 'sweeperKeeper', 'totalFootball', 'oneClubMan'];
  const offer = run.shop.offers.find((o) => o.kind === 'manager');
  assert.throws(() => buy(run, offer.slot), /no room/);
  const before = run.money;
  sellManager(run, 'parkTheBus');
  assert.equal(run.money, before + sellValue('parkTheBus'));
  assert.equal(sellValue('parkTheBus'), 2); // half of £4
  buy(run, offer.slot);
  assert.equal(run.jokers.length, 5);
});

test('training levels a hand up, and each level costs more than the last', () => {
  const run = toShop(fresh(), 100);
  const t = run.shop.offers.find((o) => o.kind === 'training');
  assert.equal(priceOf(run, t), ECONOMY.trainingBase);
  buy(run, t.slot);
  assert.equal(run.handLevels[t.hand], 2);
  assert.equal(trainingPrice(run, t.hand), ECONOMY.trainingBase + ECONOMY.trainingStep);
  run.handLevels[t.hand] = 4;
  assert.equal(trainingPrice(run, t.hand), ECONOMY.trainingBase + 3 * ECONOMY.trainingStep);
});

test('a pack has five different players; you keep one; club and squad packs only draw from what you own', () => {
  for (const type of ['standard', 'club', 'squad']) {
    const run = toShop(fresh(`pack-${type}`), 100);
    run.shop.offers[0] = { slot: 'p0', kind: 'pack', type, price: ECONOMY.pack[type], bought: false };
    buy(run, 'p0');
    assert.equal(run.pack.cards.length, 5, type);
    assert.equal(new Set(run.pack.cards.map((c) => c.id)).size, 5, 'five different players');
    const clubs = new Set(run.deck.flatMap((c) => c.clubs.map(([k]) => k))), stints = new Set(run.deck.flatMap((c) => c.stints));
    if (type === 'club') assert.ok(run.pack.cards.every((c) => c.clubs.some(([k]) => clubs.has(k))), 'every player has played for a club in your squad');
    if (type === 'squad') assert.ok(run.pack.cards.every((c) => c.stints.some((s) => stints.has(s))), 'every player was a team-mate of someone you own');
    const keep = run.pack.cards.slice(0, ECONOMY.pick).map((c) => c.uid);
    const before = run.deck.length;
    const [got] = takePack(run, keep);
    assert.equal(run.deck.length, before + (got.upgraded ? 0 : 1));
    assert.equal(run.pack, null);
  }
});

test('a new signing joins the squad; a player you already own is not a second copy, he upgrades yours', () => {
  const run = toShop(fresh('dupes'), 100);
  const mine = run.deck[0];
  assert.equal(mine.edition, 'base');
  run.pack = { type: 'standard', cards: [{ ...mine, uid: 'dupe1', edition: 'base' }, { ...run.pool.cards.find((c) => !run.deck.some((d) => d.id === c.id)), uid: 'new1', edition: 'base' }] };
  const before = run.deck.length;
  const [r] = takePack(run, ['dupe1']);
  assert.equal(run.deck.length, before, 'no second copy');
  assert.equal(r.upgraded, 'shiny');
  assert.equal(mine.edition, 'shiny', 'your copy went up one edition');
  assert.equal(ownedCopy(run, mine), mine);
  // and again: a shiny duplicate of a shiny goes to holo
  run.pack = { type: 'standard', cards: [{ ...mine, uid: 'dupe2', edition: 'shiny' }] };
  assert.equal(takePack(run, ['dupe2'])[0].upgraded, 'holo');
  run.pack = { type: 'standard', cards: [{ ...mine, uid: 'dupe3', edition: 'base' }] };
  assert.equal(takePack(run, ['dupe3'])[0].upgraded, 'gold');
  run.pack = { type: 'standard', cards: [{ ...mine, uid: 'dupe4', edition: 'base' }] };
  assert.equal(takePack(run, ['dupe4'])[0].upgraded, 'gold', 'gold stays gold');
  // a signing is not an upgrade
  const fresh1 = run.pool.cards.find((c) => !run.deck.some((d) => d.id === c.id));
  run.pack = { type: 'standard', cards: [{ ...fresh1, uid: 'new2', edition: 'base' }] };
  const [s] = takePack(run, ['new2']);
  assert.equal(s.upgraded, null);
  assert.equal(run.deck.length, before + 1);
});

test('pack rules: keep one, only from the pack, and nothing else until it is open', () => {
  const run = toShop(fresh(), 100);
  const slot = run.shop.offers.find((o) => o.kind === 'pack').slot;
  buy(run, slot);
  assert.throws(() => nextMatchday(run), /open your pack first/);
  assert.throws(() => rerollShop(run), /cannot reroll/);
  assert.throws(() => buy(run, run.shop.offers.find((o) => o.kind === 'training').slot), /open your pack first/);
  const uids = run.pack.cards.map((c) => c.uid);
  assert.equal(ECONOMY.pick, 1);
  assert.throws(() => takePack(run, uids.slice(0, 2)), /keep at most 1/);
  assert.throws(() => takePack(run, ['nope']), /not in the pack/);
  takePack(run, []); // taking none is allowed
  assert.equal(run.deck.length, 24);
  nextMatchday(run);
  assert.equal(run.phase, 'intro');
  assert.equal(run.matchday, 2);
});

test('rerolling costs £2, then £3, then £4, and replaces the stock', () => {
  const run = toShop(fresh(), 100);
  const first = JSON.stringify(run.shop.offers);
  assert.equal(rerollCost(run), 2);
  rerollShop(run);
  assert.equal(run.money, 98);
  assert.equal(rerollCost(run), 3);
  rerollShop(run);
  assert.equal(run.money, 95);
  assert.equal(rerollCost(run), 4);
  assert.notEqual(JSON.stringify(run.shop.offers), first);
  run.money = 3;
  assert.throws(() => rerollShop(run), /not enough money/);
});

test('releasing a sticker costs £1 and the squad cannot go under 16', () => {
  const run = toShop(fresh(), 100);
  const uid = run.deck[0].uid;
  releaseCard(run, uid);
  assert.equal(run.deck.length, 23);
  assert.equal(run.money, 99);
  assert.throws(() => releaseCard(run, uid), /not in your squad/);
  while (run.deck.length > ECONOMY.minDeck) releaseCard(run, run.deck[0].uid);
  assert.throws(() => releaseCard(run, run.deck[0].uid), /at least 16/);
  run.money = 0;
  run.deck.push(run.deck[0]);
  assert.throws(() => releaseCard(run, run.deck[0].uid), /not enough money/);
});

test('the shop is only open between matchdays', () => {
  const run = fresh();
  assert.throws(() => buy(run, 'm0'), /not in the shop/);
  assert.throws(() => sellManager(run, 'routeOne'), /not in the shop/);
  assert.throws(() => releaseCard(run, run.deck[0].uid), /not in the shop/);
});

test('a saved game resumes exactly, including a half-opened shop and an open pack', () => {
  const run = toShop(fresh('save'), 100);
  buy(run, run.shop.offers.find((o) => o.kind === 'manager').slot);
  buy(run, run.shop.offers.find((o) => o.kind === 'pack').slot);
  const data = JSON.parse(JSON.stringify(serialize(run))); // through JSON, as localStorage would
  const back = restore(pool, data);
  assert.equal(back.seed, run.seed);
  assert.equal(back.matchday, run.matchday);
  assert.equal(back.money, run.money);
  assert.deepEqual(back.jokers, run.jokers);
  assert.deepEqual(back.deck.map((c) => [c.id, c.edition]), run.deck.map((c) => [c.id, c.edition]));
  assert.deepEqual(back.pack.cards.map((c) => c.id), run.pack.cards.map((c) => c.id));
  assert.equal(JSON.stringify(back.shop), JSON.stringify(run.shop));
  assert.equal(back.pool, pool);
  takePack(back, back.pack.cards.slice(0, 1).map((c) => c.uid));
  nextMatchday(back);
  assert.equal(back.phase, 'intro');
});

test('a game saved mid-fixture resumes at that matchday with the same category and the same deal', () => {
  const run = fresh('mid');
  useVar(run);
  const round = kickOff(run);
  const hand = round.hand.map((c) => c.id).join();
  const back = restore(pool, JSON.parse(JSON.stringify(serialize(run))));
  assert.equal(back.phase, 'intro', 'a fixture under way restarts from kick-off');
  assert.equal(back.fixture.category, run.fixture.category);
  assert.equal(back.varLeft, run.varLeft);
  assert.equal(kickOff(back).hand.map((c) => c.id).join(), hand);
});

test('restoring a save with an unknown card or version is an error, not a silent gap', () => {
  const data = JSON.parse(JSON.stringify(serialize(fresh())));
  assert.throws(() => restore(pool, { ...data, v: 99 }), /unrecognised save/);
  assert.throws(() => restore(pool, { ...data, deck: [{ id: 'nope', edition: 'base' }] }), /unknown card/);
  assert.throws(() => restore(pool, null), /unrecognised save/);
});

test('money is conserved: what you hold is what you earned minus what you spent', () => {
  const run = fresh('ledger');
  let earned = ECONOMY.startMoney, spent = 0;
  for (let i = 0; i < 4; i++) {
    const r = win(run, 1);
    earned += r.payout;
    const t = run.shop.offers.find((o) => o.kind === 'training');
    if (run.money >= priceOf(run, t)) { spent += priceOf(run, t); buy(run, t.slot); }
    nextMatchday(run);
  }
  assert.equal(run.money, earned - spent);
  assert.equal(run.matchday, 5);
});

test('training offers the hand you play most, plus a different one', () => {
  const run = fresh('train');
  // two Kickabouts (one card each), then a One-Two
  for (let i = 0; i < 2; i++) { win(run); nextMatchday(run); }
  assert.equal(run.played.kickabout, 2);
  const round = kickOff(run);
  round.target = 1;
  const mates = [0, 1].map((i) => round.hand[i]);
  mates[1].stints = [...mates[0].stints]; // force a pair of team-mates
  playHand(round, [0, 1]);
  finishMatchday(run);
  assert.equal(run.played.oneTwo, 1);
  const [t0, t1] = run.shop.offers.filter((o) => o.kind === 'training');
  assert.equal(t0.hand, 'kickabout', 'the most-played hand is offered');
  assert.notEqual(t1.hand, t0.hand);
});

test('what you have played survives a save', () => {
  const run = toShop(fresh('played'), 10);
  const back = restore(pool, JSON.parse(JSON.stringify(serialize(run))));
  assert.deepEqual(back.played, run.played);
  assert.ok(Object.keys(back.played).length >= 1);
});
