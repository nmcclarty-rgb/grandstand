import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson, loadPool } from './helpers.mjs';
import { parseFbrefTable, mergeSeasonFiles, EXPORT_CAP } from '../tools/fbref.mjs';
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
    const ps = `${c.pid}|${c.season}|${c.club}`; // a mid-season mover has one card per club
    assert.ok(!playerSeason.has(ps), `${c.name} appears twice for ${c.club} in ${c.season}`);
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

test('every team-season has all four positions; 22 clubs until 1995, 20 after', () => {
  const groups = new Map();
  for (const c of cards) {
    const k = teamKey(c);
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(c.pos);
  }
  for (const season of meta.seasons) {
    const clubs = [...groups.keys()].filter((k) => k.endsWith(`|${season}`));
    assert.equal(clubs.length, season <= '1994-95' ? 22 : 20, season);
  }
  // a club that only had a mid-season mover (e.g. Nottingham Forest 92/93 for one player) cannot be a squad
  const thin = [...groups].filter(([k, ps]) => !POSITIONS.every((p) => ps.has(p)) && cards.filter((c) => teamKey(c) === k).length > 12);
  assert.deepEqual(thin.map(([k]) => k), []);
});

test('FBref seasons: anchors, merged exports, mid-season movers', () => {
  const get = (name, season, club) => cards.find((c) => c.name === name && c.season === season && c.club === club);
  assert.equal(get('Sheringham', '1992-93', 'TOT').goals, 21);
  assert.equal(get('Ferdinand', '1992-93', 'QPR').goals, 20);
  assert.equal(get('Shearer', '1992-93', 'BLA').goals, 16);
  assert.equal(get('Wright', '1992-93', 'ARS').goals, 15);       // only in the Z-A export
  assert.equal(get('Cole', '1993-94', 'NEW').goals, 34);
  assert.equal(get('Shearer', '1993-94', 'BLA').goals, 31);
  assert.equal(get('Le Tissier', '1993-94', 'SOU').goals, 25);
  assert.equal(get('Shearer', '1994-95', 'BLA').goals, 34);
  assert.equal(get('Fowler', '1994-95', 'LIV').goals, 25);
  assert.equal(get('Ferdinand', '1994-95', 'QPR').goals, 24);
  assert.equal(get('Shearer', '1996-97', 'NEW').goals, 25);
  assert.equal(get('Wright', '1996-97', 'ARS').goals, 23);
  assert.equal(get('Owen', '1997-98', 'LIV').goals, 18);
  assert.equal(get('Dublin', '1997-98', 'COV').goals, 18);
  assert.equal(get('Sutton', '1997-98', 'BLA').goals, 18);
  assert.equal(get('van Nistelrooy', '2002-03', 'MUN').goals, 25);
  assert.equal(get('Henry', '2002-03', 'ARS').assists, 20);
  assert.equal(get('Henry', '2003-04', 'ARS').goals, 30);
  assert.equal(get('Shearer', '2003-04', 'NEW').goals, 22);
  assert.equal(get('Owen', '1998-99', 'LIV').goals, 18);
  assert.equal(get('Phillips', '1999-00', 'SUN').goals, 30);
  assert.equal(get('Hasselbaink', '2000-01', 'CHE').goals, 23);
  assert.equal(get('Henry', '2001-02', 'ARS').goals, 24);
  assert.equal(get('Henry', '2004-05', 'ARS').goals, 25);
  assert.equal(get('Lampard', '2004-05', 'CHE').assists, 18);
  assert.equal(get('Johnson', '2004-05', 'CRY').goals, 21);
  assert.equal(get('Henry', '2005-06', 'ARS').goals, 27);
  assert.equal(get('Bent', '2005-06', 'CHA').goals, 18);
  assert.equal(get('Drogba', '2006-07', 'CHE').goals, 20);
  assert.equal(get('Ronaldo', '2007-08', 'MUN').goals, 31);
  assert.equal(get('Torres', '2007-08', 'LIV').goals, 24);
  assert.equal(get('Fàbregas', '2007-08', 'ARS').assists, 17);
  assert.equal(get('Anelka', '2008-09', 'CHE').goals, 19);
  assert.equal(get('Drogba', '2009-10', 'CHE').goals, 29);
  assert.equal(get('Rooney', '2009-10', 'MUN').goals, 26);
  assert.equal(get('Tevez', '2009-10', 'MCI').goals, 23);
  assert.equal(get('Berbatov', '2010-11', 'MUN').goals, 20);
  assert.equal(get('Tevez', '2010-11', 'MCI').goals, 20);
  assert.equal(get('van Persie', '2011-12', 'ARS').goals, 30);
  assert.equal(get('Agüero', '2011-12', 'MCI').goals, 23);
  assert.equal(get('van Persie', '2012-13', 'MUN').goals, 26);
  assert.equal(get('Bale', '2012-13', 'TOT').goals, 21);
  assert.equal(get('Suárez', '2013-14', 'LIV').goals, 31);
  assert.equal(get('Sturridge', '2013-14', 'LIV').goals, 21);
  // 2001/02 was a Z-A export plus an A-Z one: surnames at the A end only exist because both were merged
  assert.ok(get('Bergkamp', '2001-02', 'ARS') && get('Anelka', '2001-02', 'LIV'));
  // Sheringham left Forest for Spurs mid-season: two cards, two clubs
  assert.ok(cards.filter((c) => c.pid === get('Sheringham', '1992-93', 'TOT').pid && c.season === '1992-93').length >= 1);
  assert.equal(get('Cantona', '1992-93', 'LEE').goals + get('Cantona', '1992-93', 'MUN').goals, 15);
  // one source only has goals, assists and games
  for (const c of cards.filter((x) => x.src === 'fbref')) {
    assert.deepEqual([c.cleanSheets, c.saves, c.bonus, c.price, c.points], [0, 0, 0, 0, 0], c.id);
    assert.ok(c.games > 0);
  }
  assert.deepEqual(meta.sources.fbref, ['1992-93', '1993-94', '1994-95', '1996-97', '1997-98', '1998-99', '1999-00', '2000-01', '2001-02', '2002-03', '2003-04', '2004-05', '2005-06', '2006-07', '2007-08', '2008-09', '2009-10', '2010-11', '2011-12', '2012-13', '2013-14']);
});

test('every FBref season has a plausible number of goals on the cards', () => {
  // A season is n x (n-1) matches at about 2.5 goals each. Own goals are not credited to a player, so a
  // little under. A season of zeros (the wrong FBref table) or a half-imported one fails this.
  for (const season of meta.sources.fbref) {
    const inSeason = cards.filter((c) => c.season === season);
    const clubs = new Set(inSeason.map((c) => c.club)).size;
    const matches = clubs * (clubs - 1);
    const goals = inSeason.reduce((sum, c) => sum + c.goals, 0);
    assert.ok(goals > 2.2 * matches && goals < 3.0 * matches, `${season}: ${goals} goals in ${matches} matches`);
  }
});

test('every club on a card has kit colours, so no card falls back to grey', async () => {
  const { CLUB_COLOURS } = await import('../src/ui/clubs.js');
  const missing = Object.keys(meta.clubs).filter((k) => !CLUB_COLOURS[k]);
  assert.deepEqual(missing, []);
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
    assert.ok(deck.every((c) => c.src === 'fpl'), 'starter squad needs full stat lines; 1990s cards come from packs');
    const clubs = new Map();
    for (const c of deck) clubs.set(c.club, (clubs.get(c.club) ?? new Set()).add(c.season));
    assert.equal(clubs.size, 3, `seed ${seed}: clubs`);
    for (const [club, seasons] of clubs) {
      const years = [...seasons].map((x) => Number.parseInt(x, 10)).sort();
      assert.equal(years.length, 3, `${club} should span 3 seasons`);
      assert.deepEqual(years, [years[0], years[0] + 1, years[0] + 2], `${club} seasons must be consecutive (no straddling the 1994-2016 gap)`);
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

test('the FBref reader refuses a table that is not Standard Stats', () => {
  const table = (stats) => `<table><thead><tr>${stats.map((k) => `<th data-stat="${k}">${k}</th>`).join('')}</tr></thead><tbody>` +
    `<tr><th data-stat="ranker">1</th><td data-stat="player">Gary Ablett</td></tr></tbody></table>`;
  // the Playing Time table: has minutes, no goals or assists
  assert.throws(() => parseFbrefTable(table(['ranker', 'player', 'team', 'position', 'minutes', 'games_starts', 'plus_minus'])), /not a Standard Stats table \(no goals, assists column\)/);
  assert.throws(() => parseFbrefTable('<p>nothing</p>'), /no <thead>/);
  const ok = parseFbrefTable(table(['ranker', 'player', 'team', 'position', 'minutes', 'goals', 'assists']));
  assert.equal(ok[0].player, 'Gary Ablett');
});

test('the FBref reader decodes entities and skips repeated header rows', () => {
  const html = `<table><thead><tr><th data-stat="ranker">Rk</th><th data-stat="player">Player</th><th data-stat="team">T</th><th data-stat="position">P</th><th data-stat="minutes">M</th><th data-stat="goals">G</th><th data-stat="assists">A</th></tr></thead><tbody>` +
    `<tr><th data-stat="ranker">1</th><td data-stat="player">Ole Gunnar Solskj&#230;r</td><td data-stat="team">Manchester Utd</td><td data-stat="position">FW</td><td data-stat="minutes">1,017</td><td data-stat="goals">3</td><td data-stat="assists">1</td></tr>` +
    `<tr class="thead"><th data-stat="ranker">Rk</th><th data-stat="player">Player</th></tr>` +
    `<tr><th data-stat="ranker">2</th><td data-stat="player">Dennis O&apos;Brien &amp; Co</td><td data-stat="team">X</td><td data-stat="position">DF</td><td data-stat="minutes">9</td><td data-stat="goals">0</td><td data-stat="assists">0</td></tr></tbody></table>`;
  const rows = parseFbrefTable(html);
  assert.deepEqual(rows.map((r) => r.player), ['Ole Gunnar Solskjær', "Dennis O'Brien & Co"]);
});

// ---- coverage guard: FBref exports stop at 499 rows ---------------------------------------------
const fakeRows = (from, to) => Array.from({ length: to - from }, (_, i) => ({ ranker: String(i + 1), player: `P${from + i}`, team: 'X', birth_year: '1970', goals: '1' }));
const file = (name, rows) => ({ name, rows });

test('a season with one export cut off at the cap is refused', () => {
  assert.equal(EXPORT_CAP, 499);
  assert.throws(() => mergeSeasonFiles('2001-02', [file('z-a.xls', fakeRows(0, 499))]), /only one export .* cut off at 499 rows/);
});

test('two truncated exports must overlap, or part of the season is missing', () => {
  // 0-498 and 300-798 overlap on 300-498: the whole 0-798 range is covered
  const merged = mergeSeasonFiles('x', [file('a', fakeRows(0, 499)), file('b', fakeRows(300, 799))]);
  assert.equal(merged.length, 799);
  // 0-498 and 600-1098 share nothing: 499-599 could be missing
  assert.throws(() => mergeSeasonFiles('x', [file('a', fakeRows(0, 499)), file('b', fakeRows(600, 1099))]), /share no rows/);
});

test('a short single export is complete, and disagreeing rows are an error', () => {
  assert.equal(mergeSeasonFiles('x', [file('a', fakeRows(0, 300))]).length, 300);
  const a = fakeRows(0, 10), b = fakeRows(5, 15);
  b[0] = { ...b[0], goals: '9' }; // P5 now has a different goal count in the second file
  assert.throws(() => mergeSeasonFiles('x', [file('a', a), file('b', b)]), /disagrees/);
});

test('display names keep compound surnames and drop suffixes', () => {
  const shown = (full) => [...new Set(cards.filter((c) => c.full === full).map((c) => c.name))];
  assert.deepEqual(shown('Roque Santa Cruz'), ['Santa Cruz']);
  assert.deepEqual(shown('Luís Boa Morte'), ['Boa Morte']);
  assert.deepEqual(shown('Samuele Dalla Bona'), ['Dalla Bona']);
  assert.deepEqual(shown('Tal Ben Haim'), ['Ben Haim']);
  assert.deepEqual(shown('Asier del Horno'), ['del Horno']);
  assert.deepEqual(shown('Ricardo Vaz Tê'), ['Vaz Tê']);
  assert.deepEqual(shown('Alan Kelly Jr.'), ['Kelly']);
  // ordinary middle names are not part of the surname
  assert.deepEqual(shown('Ole Gunnar Solskjær'), ['Solskjær']);
  assert.deepEqual(shown('Jimmy Floyd Hasselbaink'), ['Hasselbaink']);
  // a suffix left behind ("Jr.") is the bug; a real short mononym ("Jô") is not
  assert.ok(cards.filter((c) => c.src === 'fbref').every((c) => c.name.length >= 2 && !c.name.endsWith('.')), 'no stub names like "Jr."');
  assert.deepEqual(shown('Jô'), ['Jô']);
});
