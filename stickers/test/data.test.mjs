import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson, loadPool } from './helpers.mjs';
import { makeRng } from '../src/engine/rng.js';
import { starterDeck, openPack, TIERS } from '../src/engine/deck.js';
import { POSITIONS, CATEGORY_KEYS, teamKey } from '../src/engine/cards.js';

const json = loadJson();
const { cards, meta } = json;
const find = (name, season) => cards.find((c) => c.name === name && c.season === season);

test('every card is well-formed and unique', () => {
  const ids = new Set();
  const playerSeason = new Set();
  for (const c of cards) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    const ps = `${c.pid}|${c.season}`;
    assert.ok(!playerSeason.has(ps), `${c.name} appears twice in ${c.season}`);
    playerSeason.add(ps);
    assert.ok(POSITIONS.includes(c.pos), `${c.id}: position ${c.pos}`);
    assert.ok(meta.seasons.includes(c.season), `${c.id}: season ${c.season}`);
    assert.ok(meta.clubs[c.club], `${c.id}: club ${c.club}`);
    assert.ok(c.rating >= 1 && c.rating <= 99, `${c.id}: rating ${c.rating}`);
    for (const k of [...CATEGORY_KEYS, 'points']) assert.ok(Number.isFinite(c[k]) && c[k] >= 0, `${c.id}: ${k}=${c[k]}`);
  }
});

test('parsing anchors: known season totals survive the CSV round-trip', () => {
  assert.equal(find('Kane', '2016-17').goals, 29);
  assert.equal(find('Kane', '2016-17').club, 'TOT');
  assert.equal(find('Lukaku', '2016-17').goals, 25);
  assert.equal(find('Lukaku', '2016-17').club, 'EVE');
  assert.equal(find('Salah', '2017-18').goals, 32);
  assert.equal(find('Salah', '2017-18').club, 'LIV');
  assert.equal(find('Vardy', '2019-20').goals, 23);
  assert.equal(find('Haaland', '2022-23').goals, 36);
  assert.equal(find('Haaland', '2022-23').club, 'MCI');
  assert.equal(find('Heaton', '2016-17').club, 'BUR');
});

test('legacy seasons without teams.csv map clubs correctly (alphabetical id fallback)', () => {
  // Each of these is a well-known player/club pairing in a season that has no teams.csv.
  const expect = [
    ['Agüero', '2017-18', 'MCI'], ['Mané', '2018-19', 'LIV'], ['Aubameyang', '2018-19', 'ARS'],
    ['Sánchez', '2016-17', 'ARS'], ['Costa', '2016-17', 'CHE'], ['Fabianski', '2018-19', 'WHU'],
  ];
  for (const [name, season, club] of expect) assert.equal(find(name, season)?.club, club, `${name} ${season}`);
});

test('every season has all four positions at every club', () => {
  const groups = new Map();
  for (const c of cards) {
    const k = teamKey(c);
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(c.pos);
  }
  assert.equal(groups.size, meta.seasons.length * 20, 'ten seasons x 20 clubs');
  for (const [k, ps] of groups) assert.ok(POSITIONS.every((p) => ps.has(p)), `${k} is missing a position`);
});

test('chip scale: the 99th percentile in each category is worth about 60 chips', () => {
  for (const k of CATEGORY_KEYS) {
    const s = meta.chipScale[k];
    assert.ok(Math.abs(s.p99 * s.perUnit - 60) < 2, `${k}: p99 ${s.p99} x ${s.perUnit}`);
  }
});

test('starter deck: 24 mid-table cards, three clubs x three consecutive seasons, two goalkeepers', () => {
  const pool = loadPool();
  for (let seed = 1; seed <= 50; seed++) {
    const deck = starterDeck(pool, makeRng(seed));
    assert.equal(deck.length, 24, `seed ${seed}`);
    assert.equal(new Set(deck.map((c) => c.uid)).size, 24);
    assert.equal(deck.filter((c) => c.pos === 'GK').length, 2);
    assert.equal(deck.filter((c) => c.pos === 'FWD').length, 6);
    assert.ok(deck.every((c) => c.rating >= 25 && c.rating <= 80), 'starter squad is mid-table, not stars');
    const clubs = new Map();
    for (const c of deck) clubs.set(c.club, (clubs.get(c.club) ?? new Set()).add(c.season));
    assert.equal(clubs.size, 3, `seed ${seed}: clubs`);
    for (const [club, seasons] of clubs) {
      const years = [...seasons].map((x) => Number.parseInt(x, 10)).sort();
      assert.equal(years.length, 3, `${club} should span 3 seasons`);
      assert.deepEqual(years, [years[0], years[0] + 1, years[0] + 2], `${club} seasons must be consecutive`);
    }
  }
});

test('starter squads are reproducible from the seed', () => {
  const pool = loadPool();
  const ids = (seed) => starterDeck(pool, makeRng(seed)).map((c) => c.id).join();
  assert.equal(ids(3), ids(3));
  assert.notEqual(ids(3), ids(4));
});

test('pack odds land near the published rarity weights', () => {
  const pool = loadPool();
  const rng = makeRng(99);
  const counts = { common: 0, uncommon: 0, rare: 0, legend: 0 };
  const editions = { base: 0, shiny: 0, holo: 0, gold: 0 };
  const N = 4000;
  for (let i = 0; i < N; i++) {
    for (const c of openPack(pool, rng)) {
      counts[TIERS.find((t) => c.rating >= t.min && c.rating <= t.max).id]++;
      editions[c.edition]++;
    }
  }
  const total = N * 5;
  assert.ok(Math.abs(counts.common / total - 0.60) < 0.02, JSON.stringify(counts));
  assert.ok(Math.abs(counts.rare / total - 0.10) < 0.01, JSON.stringify(counts));
  assert.ok(Math.abs(counts.legend / total - 0.02) < 0.005, JSON.stringify(counts));
  assert.ok(Math.abs(editions.shiny / total - 0.08) < 0.01, JSON.stringify(editions));
  assert.ok(Math.abs(editions.gold / total - 0.02) < 0.005, JSON.stringify(editions));
});
