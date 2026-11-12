import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson, loadPool } from './helpers.mjs';
import { makeRng } from '../src/engine/rng.js';
import { starterDeck, openPack, TIERS, PACK_WEIGHTS, EDITION_ODDS, nextEdition, upgradedEdition } from '../src/engine/deck.js';
import {
  POSITIONS, CATEGORY_KEYS, statOf, ratingOf, ratingFor, overallOf, OVR_WEIGHTS, RATING_TO_CHIPS, DISCIPLINE_POINTS, cardChips,
  tierOf, TIER_BANDS, EDITION_ORDER,
} from '../src/engine/cards.js';
import { sharedStints } from '../src/engine/hands.js';

const json = loadJson();
const { cards, meta } = json;
const get = (full) => cards.find((c) => c.full === full);
const clubsOf = (c) => c.clubs.map(([k]) => k);

// ---- the cards -------------------------------------------------------------------------------------------------------
test('every card is a well-formed career, and there is only one of each player', () => {
  const ids = new Set();
  for (const c of cards) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    assert.match(c.id, /^[a-z0-9-]+:\d{4}$|^[a-z0-9-]+:$/, `${c.id}: name:birth-year`);
    assert.ok(POSITIONS.includes(c.pos), `${c.id}: position ${c.pos}`);
    assert.ok(c.rating >= 1 && c.rating <= 99, `${c.id}: overall ${c.rating}`);
    for (const k of ['games', 'goals', 'assists', 'yellow', 'red']) assert.ok(Number.isInteger(c[k]) && c[k] >= 0, `${c.id}: ${k}=${c[k]}`);
    assert.ok(Number.isInteger(c.titles) && c.titles >= 0 && c.titles <= c.stints.length, `${c.id}: titles=${c.titles}`);
    for (const k of ['wins', 'cleanSheets']) assert.ok(Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= c.games, `${c.id}: ${k}=${c[k]} from ${c.games} appearances`);
    // RULE: a card carries only stats that exist for every season. Partial stats (clean sheets, saves, bonus points,
    // price) would be missing for most seasons, so they must not be on a card.
    assert.deepEqual(Object.keys(c).sort(),
      ['assists', 'cleanSheets', 'club', 'clubs', 'first', 'full', 'games', 'goals', 'id', 'last', 'name', 'pos', 'rate', 'rating', 'red', 'stints', 'titles', 'wins', 'yellow'], `${c.id}: unexpected fields`);
    assert.deepEqual(Object.keys(c.rate).sort(), [...CATEGORY_KEYS].sort(), `${c.id}: a rating for every category`);
    for (const k of CATEGORY_KEYS) assert.ok(Number.isInteger(c.rate[k]) && c.rate[k] >= 1 && c.rate[k] <= 99, `${c.id}: ${k} rating ${c.rate[k]}`);
  }
  assert.equal(cards.length, meta.count);
});

test('a career adds up: his clubs sum to his appearances, his main club is the one he played most for', () => {
  for (const c of cards) {
    assert.equal(c.clubs.reduce((sum, [, apps]) => sum + apps, 0), c.games, `${c.id}: clubs do not sum to appearances`);
    assert.equal(c.club, c.clubs[0][0], `${c.id}: main club`);
    for (let i = 1; i < c.clubs.length; i++) assert.ok(c.clubs[i - 1][1] >= c.clubs[i][1], `${c.id}: clubs are most-played first`);
    assert.ok(meta.clubs[c.club], `${c.id}: club ${c.club}`);
    assert.equal(new Set(c.stints).size, c.stints.length, `${c.id}: a club-season twice`);
    for (const s of c.stints) {
      assert.match(s, /^[A-Z]{3}\|\d{4}-\d{2}$/, `${c.id}: stint ${s}`);
      const [club, season] = s.split('|');
      assert.ok(clubsOf(c).includes(club), `${c.id}: ${s} is at a club he has no appearances for`);
      assert.ok(season >= c.first && season <= c.last, `${c.id}: ${s} is outside ${c.first} to ${c.last}`);
    }
    assert.ok(c.first <= c.last);
  }
});

test('the pool is everyone with 20 or more Premier League appearances', () => {
  assert.equal(meta.minApps, 20);
  for (const c of cards) assert.ok(c.games >= 20, `${c.id}: ${c.games} appearances`);
  assert.ok(meta.players > cards.length, 'the exports hold more players than the pool: the rest played under 20 games');
  assert.ok(cards.length > 3000 && cards.length < 3400, `${cards.length} cards`);
});

// ---- the real totals --------------------------------------------------------------------------------------------------------
test('career totals match the Premier League record books (nothing filtered, nothing scaled)', () => {
  // [player, appearances, goals, assists]: these are the published career figures
  const records = [
    ['Frank Lampard', 609, 177, 102], ['Alan Shearer', 441, 260, 64], ['Ryan Giggs', 632, 109, 162], ['Wayne Rooney', 491, 208, 102],
    ['Thierry Henry', 258, 175, 74], ['Gareth Barry', 653, 53, 63], ['Steven Gerrard', 504, 120, 92], ['Sergio Agüero', 275, 184, 48],
    ['Andy Cole', 414, 187, 74],
  ];
  for (const [name, apps, goals, assists] of records) {
    const c = get(name);
    assert.deepEqual([c.games, c.goals, c.assists], [apps, goals, assists], name);
  }
  assert.equal(get('Harry Kane').goals, 213);
  assert.equal(get('Frank Lampard').yellow + get('Frank Lampard').red, 63);
});

test('a career spans clubs and seasons: Lampard, Terry, Giggs and Sánchez', () => {
  const lampard = get('Frank Lampard'), terry = get('John Terry'), giggs = get('Ryan Giggs'), sanchez = get('Alexis Sánchez');
  assert.deepEqual(lampard.clubs, [['CHE', 429], ['WHU', 148], ['MCI', 32]]);
  assert.equal(lampard.club, 'CHE');
  assert.equal(lampard.first, '1995-96');
  assert.equal(lampard.last, '2014-15');
  assert.equal(lampard.stints.length, 20);
  assert.equal(sharedStints([lampard, terry]).length, 13, 'Lampard and Terry were team-mates for 13 seasons');
  assert.equal(sharedStints([lampard, giggs]).length, 0, 'they never were');
  assert.deepEqual(giggs.clubs, [['MUN', 632]]);
  assert.equal(giggs.stints.length, 22, 'a one-club man');
  // a mid-season move is one career with a club-season at each club
  assert.deepEqual(sanchez.stints.filter((s) => s.endsWith('2017-18')), ['ARS|2017-18', 'MUN|2017-18']);
});

test('every season from 1992/93 to 2025/26 is in the exports, all from one source', () => {
  const year = (y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  const all = Array.from({ length: 2025 - 1992 + 1 }, (_, i) => year(1992 + i));
  assert.deepEqual(meta.seasons, all);
  assert.match(meta.source, /FBref/);
  assert.equal(meta.sources, undefined, 'a second source would bring back inconsistent assists and player ids');
  assert.equal(cards.map((c) => c.first).sort()[0], '1992-93');
  assert.equal(cards.map((c) => c.last).sort().at(-1), '2025-26');
});

// ---- ratings and the overall ---------------------------------------------------------------------------------------------------
test('ratings are measured against the record: 99 is the best ever, 1 is none', () => {
  for (const k of CATEGORY_KEYS) {
    const { total, holder } = meta.records[k];
    assert.equal(Math.max(...cards.map((c) => statOf(c, k))), total, `${k}: the record`);
    assert.equal(ratingFor(total, total), 99);
    assert.ok(cards.some((c) => c.full === holder && c.rate[k] === 99), `${k}: ${holder} holds it`);
    for (const c of cards) assert.equal(c.rate[k], ratingFor(statOf(c, k), total), `${c.id} ${k}`);
  }
  assert.equal(ratingFor(0, 260), 1);
  assert.equal(meta.records.goals.holder, 'Alan Shearer');
  assert.equal(meta.records.assists.holder, 'Ryan Giggs');
  assert.equal(meta.records.goals.total, 260);
});

test('a rating never goes down as the total goes up, in every category', () => {
  for (const k of CATEGORY_KEYS) {
    const sorted = [...cards].sort((a, b) => statOf(a, k) - statOf(b, k));
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].rate[k] >= sorted[i - 1].rate[k], `${k}: ${sorted[i - 1].full} (${statOf(sorted[i - 1], k)}) rated above ${sorted[i].full} (${statOf(sorted[i], k)})`);
    }
  }
  // ...and, the point of rating against the record rather than by rank, a legend stays well clear of a long career
  assert.ok(get('Alan Shearer').rate.goals - get('James Milner').rate.goals >= 30, 'Shearer (260 goals) against Milner (56)');
  assert.ok(get('Frank Lampard').rate.goals > 80 && get('Frank Lampard').rate.goals < 95, '177 goals is elite but not the record');
});

test('the overall is his ratings weighted for his position, and discipline is not in it', () => {
  for (const c of cards) assert.equal(c.rating, Math.round(overallOf(c.pos, c.rate)), c.id);
  for (const pos of ['FWD', 'MID', 'DEF']) assert.ok(Math.abs(Object.values(OVR_WEIGHTS[pos]).reduce((a, b) => a + b, 0) - 1) < 1e-9, `${pos} weights sum to 1`);
  assert.equal(OVR_WEIGHTS.GK.games, 0.8, 'a keeper is discounted: we have no keeping stats');
  for (const pos of POSITIONS) assert.ok(!('discipline' in OVR_WEIGHTS[pos]), `${pos}: a booking is not a skill`);
  // two forwards with the same appearances and assists: the one who scores more is the better player
  const fwd = { goals: 80, assists: 40, games: 60, discipline: 99 };
  assert.ok(overallOf('FWD', fwd) > overallOf('FWD', { ...fwd, goals: 50 }));
  assert.equal(overallOf('FWD', fwd), overallOf('FWD', { ...fwd, discipline: 1 }), 'discipline does not change it');
});

test('the overall reads like a Premier League hall of fame', () => {
  const top = cards.slice(0, 15).map((c) => c.full);
  for (const legend of ['Wayne Rooney', 'Alan Shearer', 'Frank Lampard', 'Mohamed Salah', 'Ryan Giggs', 'Steven Gerrard', 'Harry Kane']) assert.ok(top.includes(legend), `${legend} should be in the top 15`);
  // keepers play every week and we have no saving stats: they must not fill the top of the list
  assert.ok(cards.slice(0, 20).every((c) => c.pos !== 'GK'), 'no goalkeeper in the top 20');
  assert.deepEqual(cards.map((c) => c.rating), [...cards.map((c) => c.rating)].sort((a, b) => b - a), 'cards are listed best first');
  // every outfield position is represented near the top
  for (const pos of ['DEF', 'MID', 'FWD']) assert.ok(cards.slice(0, 30).some((c) => c.pos === pos), `${pos} in the top 30`);
});

test('tiers: most of the pool is bronze, an icon is a legend', () => {
  const share = (id) => cards.filter((c) => tierOf(c.rating) === id).length / cards.length;
  assert.deepEqual(TIER_BANDS.map((t) => t.id), ['bronze', 'silver', 'gold', 'icon']);
  assert.ok(share('bronze') > 0.55 && share('bronze') < 0.67, `bronze ${share('bronze')}`);
  assert.ok(share('silver') > 0.22 && share('silver') < 0.32, `silver ${share('silver')}`);
  assert.ok(share('gold') > 0.07 && share('gold') < 0.14, `gold ${share('gold')}`);
  assert.ok(share('icon') > 0.005 && share('icon') < 0.03, `icon ${share('icon')}`);
  assert.equal(tierOf(1), 'bronze');
  assert.equal(tierOf(70), 'icon');
  for (const legend of ['Wayne Rooney', 'Alan Shearer', 'Frank Lampard']) assert.equal(tierOf(get(legend).rating), 'icon', legend);
});

test('chips come from the rating: a rating of 99 is worth about 60 chips', () => {
  assert.deepEqual(Object.keys(meta.chipScale), [...CATEGORY_KEYS]);
  for (const k of CATEGORY_KEYS) assert.equal(meta.chipScale[k].perUnit, RATING_TO_CHIPS);
  const shearer = get('Alan Shearer');
  assert.equal(cardChips(shearer, 'goals', meta.chipScale), Math.round(99 * RATING_TO_CHIPS));
  assert.ok(cardChips(shearer, 'goals', meta.chipScale) >= 59 && cardChips(shearer, 'goals', meta.chipScale) <= 60);
  assert.equal(ratingOf(shearer, 'goals'), 99);
  assert.ok(Math.max(...cards.flatMap((c) => CATEGORY_KEYS.map((k) => cardChips(c, k, meta.chipScale)))) <= 60);
});

test('RULE: the only categories are the stats every season has', () => {
  assert.deepEqual(CATEGORY_KEYS, ['goals', 'assists', 'games', 'discipline']);
});

test('Discipline is one category: a yellow card is 1 point, a red card is 3', () => {
  assert.deepEqual(DISCIPLINE_POINTS, { yellow: 1, red: 3 });
  assert.equal(statOf({ yellow: 5, red: 1 }, 'discipline'), 8);
  assert.equal(statOf({ yellow: 0, red: 2 }, 'discipline'), 6);
  assert.equal(statOf({ goals: 7 }, 'goals'), 7);
  const share = (f) => cards.filter((c) => f(c) > 0).length / cards.length;
  assert.ok(share((c) => statOf(c, 'discipline')) > share((c) => c.red), 'combined it scores for more players than red cards alone');
  assert.ok(share((c) => statOf(c, 'discipline')) > 0.85, 'nearly every career has a record');
});

// ---- the starter squad -------------------------------------------------------------------------------------------------------------
test('starter squad: 24 mid-table players who really were team-mates, two goalkeepers', () => {
  const pool = loadPool();
  let fewest = Infinity;
  for (let seed = 1; seed <= 50; seed++) {
    const deck = starterDeck(pool, makeRng(seed));
    assert.equal(deck.length, 24, `seed ${seed}`);
    assert.equal(new Set(deck.map((c) => c.uid)).size, 24);
    assert.equal(new Set(deck.map((c) => c.id)).size, 24, 'only one of each player');
    assert.deepEqual(POSITIONS.map((p) => deck.filter((c) => c.pos === p).length), [2, 8, 8, 6], `seed ${seed}: GK/DEF/MID/FWD`);
    assert.ok(deck.every((c) => c.rating >= 12 && c.rating <= 54), 'a starter squad is bronze and silver, not stars');
    assert.ok(deck.every((c) => c.edition === 'base'));
    let pairs = 0;
    for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) if (sharedStints([deck[i], deck[j]]).length) pairs++;
    fewest = Math.min(fewest, pairs);
  }
  assert.ok(fewest >= 20, `the squads have team-mates to play with (the least was ${fewest} pairs of 276)`);
});

test('starter squads are reproducible from the seed, and draw on every era', () => {
  const pool = loadPool();
  const ids = (seed) => starterDeck(pool, makeRng(seed)).map((c) => c.id).join();
  assert.equal(ids(3), ids(3));
  assert.notEqual(ids(3), ids(4));
  let nineties = 0, twenties = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const deck = starterDeck(pool, makeRng(`era${seed}`));
    if (deck.some((c) => c.first < '2000-01')) nineties++;
    if (deck.some((c) => c.last >= '2020-21')) twenties++;
  }
  assert.ok(nineties > 30 && twenties > 30, `1990s in ${nineties} of 300 squads, 2020s in ${twenties}`);
});

// ---- packs and duplicates ---------------------------------------------------------------------------------------------------------------
test('pack odds follow the published weights, five different players a pack', () => {
  const pool = loadPool();
  const rng = makeRng(99);
  const counts = { bronze: 0, silver: 0, gold: 0, icon: 0 };
  const editions = { base: 0, shiny: 0, holo: 0, gold: 0 };
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const pack = openPack(pool, rng);
    assert.equal(new Set(pack.map((c) => c.id)).size, 5, 'no player twice in a pack');
    for (const c of pack) { counts[tierOf(c.rating)]++; editions[c.edition]++; }
  }
  const total = N * 5, weight = Object.values(PACK_WEIGHTS).reduce((a, b) => a + b, 0);
  for (const t of TIERS) assert.ok(Math.abs(counts[t.id] / total - PACK_WEIGHTS[t.id] / weight) < 0.012, `${t.id}: ${counts[t.id] / total} against ${PACK_WEIGHTS[t.id] / weight}`);
  assert.ok(Math.abs(editions.shiny / total - 0.08) < 0.01, JSON.stringify(editions));
  assert.ok(Math.abs(editions.gold / total - 0.02) < 0.005, JSON.stringify(editions));
  assert.ok(counts.icon / total < pool.cards.filter((c) => tierOf(c.rating) === 'icon').length / pool.cards.length, 'icons are scarcer in packs than in the pool');
});

test('a filtered pack only deals players the filter allows', () => {
  const pool = loadPool();
  const filter = (c) => c.club === 'ARS';
  for (let i = 0; i < 40; i++) assert.ok(openPack(pool, makeRng(i), 5, { filter }).every((c) => c.club === 'ARS'));
  assert.throws(() => openPack(pool, makeRng(1), 5, { filter: (c) => c.id === get('Frank Lampard').id }), /not enough players/);
});

test('a duplicate upgrades the copy you own: one edition above the better of the two, gold stays gold', () => {
  assert.deepEqual(EDITION_ORDER, ['base', 'shiny', 'holo', 'gold']);
  assert.equal(nextEdition('base'), 'shiny');
  assert.equal(nextEdition('holo'), 'gold');
  assert.equal(nextEdition('gold'), 'gold');
  assert.equal(upgradedEdition('base', 'base'), 'shiny');
  assert.equal(upgradedEdition('shiny', 'base'), 'holo');   // your shiny is the better copy, so it goes up one
  assert.equal(upgradedEdition('base', 'shiny'), 'holo');   // a shiny duplicate counts for more than a base one
  assert.equal(upgradedEdition('base', 'gold'), 'gold');
  assert.equal(upgradedEdition('gold', 'base'), 'gold');
  assert.equal(upgradedEdition('holo', 'holo'), 'gold');
});

// ---- league titles -----------------------------------------------------------------------------------------------------------
import { CHAMPIONS, TITLE_APPS } from '../tools/champions.mjs';

test('a champion for every season, 34 of them, and the club counts are the real ones', () => {
  assert.deepEqual(Object.keys(CHAMPIONS), meta.seasons);
  const by = {};
  for (const c of Object.values(CHAMPIONS)) by[c] = (by[c] ?? 0) + 1;
  assert.deepEqual(by, { MUN: 13, MCI: 8, CHE: 5, ARS: 4, LIV: 2, BLA: 1, LEI: 1 });
  assert.equal(TITLE_APPS, 5);
  for (const club of new Set(Object.values(CHAMPIONS))) assert.ok(meta.clubs[club], `${club} is a club in the data`);
});

test('titles: a season at the champions with 5+ league appearances, checked against the careers everyone knows', () => {
  const t = (name) => get(name).titles;
  assert.equal(t('Ryan Giggs'), 13);
  assert.equal(t('Paul Scholes'), 11);
  assert.equal(t('Gary Neville'), 8);
  assert.equal(t('Wayne Rooney'), 5);
  assert.equal(t('John Terry'), 5);
  assert.equal(t('Frank Lampard'), 3, 'his season on loan at Man City, the year Chelsea won, is not a title');
  assert.equal(t('Thierry Henry'), 2);
  assert.equal(t('Alan Shearer'), 1);
  assert.equal(t('Eric Cantona'), 4);
  assert.equal(t('Vincent Kompany'), 4);
  assert.equal(t('Harry Kane'), 0);
  assert.equal(t('Steven Gerrard'), 0);
  assert.equal(t('Mohamed Salah'), 2, 'two with Liverpool; two league games for Chelsea in 2014/15 do not count');
  assert.equal(Math.max(...cards.map((c) => c.titles)), 13);
});

test('a title needs the stint at the champions: nobody has more titles than seasons at title-winning clubs', () => {
  for (const c of cards) {
    const possible = c.stints.filter((s) => CHAMPIONS[s.split('|')[1]] === s.split('|')[0]).length;
    assert.ok(c.titles <= possible, `${c.id}: ${c.titles} titles from ${possible} champion seasons`);
  }
  // and a player who only cameoed for the champions does not get one
  const cameo = cards.find((c) => c.stints.some((s) => CHAMPIONS[s.split('|')[1]] === s.split('|')[0]) && c.titles === 0);
  assert.ok(cameo, 'some players were at a title-winning club without winning a title');
});

// ---- wins and clean sheets (estimated) --------------------------------------------------------------------------------------------------
test('clean sheets (est.) agree with the published goalkeeper totals to within a few per cent', () => {
  const cs = (n) => get(n).cleanSheets;
  assert.ok(Math.abs(cs('Petr Čech') - 202) <= 6, `Čech ${cs('Petr Čech')} against 202`);
  assert.ok(Math.abs(cs('David James') - 169) <= 6, `James ${cs('David James')} against 169`);
  assert.ok(Math.abs(cs('David de Gea') - 147) <= 8, `de Gea ${cs('David de Gea')} against 147`);
  assert.equal(Math.max(...cards.filter((c) => c.pos === 'GK').map((c) => c.cleanSheets)), cs('Petr Čech'), 'Čech is the best goalkeeper');
});

test('clean sheets are credited to goalkeepers and defenders only, season by season', () => {
  for (const n of ['Alan Shearer', 'Harry Kane', 'Wayne Rooney', 'Thierry Henry', 'Ryan Giggs', 'Frank Lampard', 'Steven Gerrard', 'Gareth Barry']) assert.equal(get(n).cleanSheets, 0, n);
  const share = (pos) => cards.filter((c) => c.pos === pos && c.cleanSheets > 0).length / cards.filter((c) => c.pos === pos).length;
  assert.equal(share('GK'), 1); assert.equal(share('DEF'), 1);
  assert.ok(share('MID') < 0.06, `${share('MID')} of midfielders have some (seasons listed as a defender)`);
  assert.ok(share('FWD') < 0.01);
  assert.equal(get('James Milner').cleanSheets, 0, 'Milner is a midfielder (positions.mjs), so earns none');
  // the defenders everyone would name
  const top = [...cards].sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 6).map((c) => c.full);
  for (const n of ['John Terry', 'Petr Čech', 'Rio Ferdinand', 'Jamie Carragher']) assert.ok(top.includes(n), `${n} in the top six: ${top}`);
});

test('wins (est.) are credited to everyone, from the minutes he was on the pitch, and the best are the long careers at the best clubs', () => {
  assert.ok(cards.filter((c) => c.wins > 0).length / cards.length > 0.99, 'nearly every player with 20+ appearances has been on the pitch for wins');
  const top = [...cards].sort((a, b) => b.wins - a.wins).slice(0, 6).map((c) => c.full);
  for (const n of ['Ryan Giggs', 'Frank Lampard', 'John Terry']) assert.ok(top.includes(n), `${n} in the top six: ${top}`);
  assert.ok(get('Ryan Giggs').wins > get('Harry Kane').wins);
  // wins while on the pitch are a share of his appearances, between a third and four fifths for anyone who played at the top
  assert.ok(get('Ryan Giggs').wins / get('Ryan Giggs').games > 0.4);
});

// ---- positions -----------------------------------------------------------------------------------------------------------------------
import { POSITION_OVERRIDES } from '../tools/positions.mjs';

test('position corrections: the midfielders FBref lists as "DF,MF" are midfielders, and the full-backs and centre-backs stay defenders', () => {
  for (const n of ['Michael Essien', 'Nicky Butt', 'James Milner', 'Gilberto Silva', 'Emmanuel Petit', 'Jack Rodwell', 'Fabian Delph', 'Kevin Kilbane', 'Matthew Taylor', 'Jesús Navas']) assert.equal(get(n).pos, 'MID', n);
  for (const n of ['Jamie Carragher', 'Kyle Walker', 'Séamus Coleman', 'César Azpilicueta', 'Ledley King', 'Pablo Zabaleta', 'Martin Keown', 'Phil Neville', 'Danny Rose', 'Reece James']) assert.equal(get(n).pos, 'DEF', n);
  for (const [id, pos] of Object.entries(POSITION_OVERRIDES)) { const c = cards.find((x) => x.id === id); assert.ok(c, `${id} is in the pool`); assert.equal(c.pos, pos, id); }
  assert.ok(Object.keys(POSITION_OVERRIDES).length >= 30);
  // a corrected midfielder earns no clean sheets, and his overall is a midfielder's
  for (const [id, pos] of Object.entries(POSITION_OVERRIDES)) if (pos === 'MID') assert.equal(cards.find((x) => x.id === id).cleanSheets, 0, id);
  assert.equal(get('Michael Essien').rating, Math.round(overallOf('MID', get('Michael Essien').rate)));
});
