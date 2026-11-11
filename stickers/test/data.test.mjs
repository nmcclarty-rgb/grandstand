import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson, loadPool } from './helpers.mjs';
import { parseFbrefTable, mergeSeasonFiles, EXPORT_CAP } from '../tools/fbref.mjs';
import { makeRng } from '../src/engine/rng.js';
import { starterDeck, openPack, TIERS } from '../src/engine/deck.js';
import { POSITIONS, CATEGORY_KEYS, teamKey, statOf, DISCIPLINE_POINTS, surnameOf, firstNameOf } from '../src/engine/cards.js';
import { evaluateHand } from '../src/engine/hands.js';

const json = loadJson();
const { cards, meta } = json;
// name: the card's display name, or a surname / full name ("Wright" finds Ian Wright whatever initial is shown)
const matches = (c, name) => c.name === name || c.full === name || c.full.endsWith(` ${name}`);
const find = (name, season) => cards.find((c) => matches(c, name) && c.season === season);
const SEASON_GAMES = 38;

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
    for (const k of ['goals', 'assists', 'games', 'yellow', 'red']) assert.ok(Number.isInteger(c[k]) && c[k] >= 0, `${c.id}: ${k}=${c[k]}`);
    // RULE: a card carries only stats that exist for every season. Partial stats (clean sheets, saves, bonus
    // points, price) would be zero for most seasons, so they must not be on a card.
    assert.deepEqual(Object.keys(c).sort(), ['assists', 'club', 'full', 'games', 'goals', 'id', 'name', 'pid', 'pos', 'rating', 'red', 'season', 'yellow'], `${c.id}: unexpected fields`);
  }
});

test('anchors: known season totals survive the export round-trip', () => {
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

test('well-known player and club pairings come out right', () => {
  const expect = [
    ['Agüero', '2017-18', 'MCI'], ['Mané', '2018-19', 'LIV'], ['Aubameyang', '2018-19', 'ARS'],
    ['Sánchez', '2016-17', 'ARS'], ['Costa', '2016-17', 'CHE'], ['Fabiański', '2018-19', 'WHU'],
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

test('anchors across the eras: merged exports, 38-game scaling, mid-season movers', () => {
  const get = (name, season, club) => cards.find((c) => matches(c, name) && c.season === season && c.club === club);
  // 1992/93 to 1994/95 were 42-game seasons: counting stats are scaled by 38/42 and rounded, so the real
  // figure is written here and the scaling is part of the assertion.
  const s38 = (x) => Math.round((x * 38) / 42);
  assert.equal(get('Sheringham', '1992-93', 'TOT').goals, s38(21));
  assert.equal(get('Ferdinand', '1992-93', 'QPR').goals, s38(20));
  assert.equal(get('Shearer', '1992-93', 'BLA').goals, s38(16));
  assert.equal(get('Wright', '1992-93', 'ARS').goals, s38(15));      // only in the Z-A export
  assert.equal(get('Cole', '1993-94', 'NEW').goals, s38(34));
  assert.equal(get('Shearer', '1993-94', 'BLA').goals, s38(31));
  assert.equal(get('Le Tissier', '1993-94', 'SOU').goals, s38(25));
  assert.equal(get('Shearer', '1994-95', 'BLA').goals, s38(34));
  assert.equal(get('Fowler', '1994-95', 'LIV').goals, s38(25));
  assert.equal(get('Ferdinand', '1994-95', 'QPR').goals, s38(24));
  // 38-game seasons are as recorded
  const exact = [
    ['Shearer', '1995-96', 'BLA', 31], ['Fowler', '1995-96', 'LIV', 28], ['Ferdinand', '1995-96', 'NEW', 25],
    ['Shearer', '1996-97', 'NEW', 25], ['Wright', '1996-97', 'ARS', 23], ['Owen', '1997-98', 'LIV', 18],
    ['Dublin', '1997-98', 'COV', 18], ['Sutton', '1997-98', 'BLA', 18], ['Owen', '1998-99', 'LIV', 18],
    ['Phillips', '1999-00', 'SUN', 30], ['Hasselbaink', '2000-01', 'CHE', 23], ['Henry', '2001-02', 'ARS', 24],
    ['van Nistelrooy', '2002-03', 'MUN', 25], ['Henry', '2003-04', 'ARS', 30], ['Shearer', '2003-04', 'NEW', 22],
    ['Henry', '2004-05', 'ARS', 25], ['Johnson', '2004-05', 'CRY', 21], ['Henry', '2005-06', 'ARS', 27],
    ['Bent', '2005-06', 'CHA', 18], ['Drogba', '2006-07', 'CHE', 20], ['Ronaldo', '2007-08', 'MUN', 31],
    ['Torres', '2007-08', 'LIV', 24], ['Anelka', '2008-09', 'CHE', 19], ['Drogba', '2009-10', 'CHE', 29],
    ['Rooney', '2009-10', 'MUN', 26], ['Tevez', '2009-10', 'MCI', 23], ['Berbatov', '2010-11', 'MUN', 20],
    ['Tevez', '2010-11', 'MCI', 20], ['van Persie', '2011-12', 'ARS', 30], ['Agüero', '2011-12', 'MCI', 23],
    ['van Persie', '2012-13', 'MUN', 26], ['Bale', '2012-13', 'TOT', 21], ['Suárez', '2013-14', 'LIV', 31],
    ['Sturridge', '2013-14', 'LIV', 21], ['Agüero', '2014-15', 'MCI', 26], ['Kane', '2014-15', 'TOT', 21],
    ['Vardy', '2015-16', 'LEI', 24], ['Kane', '2015-16', 'TOT', 25],
  ];
  for (const [name, season, club, goals] of exact) assert.equal(get(name, season, club)?.goals, goals, `${name} ${season}`);
  assert.equal(get('Henry', '2002-03', 'ARS').assists, 20);
  assert.equal(get('Lampard', '2004-05', 'CHE').assists, 18);
  assert.equal(get('Fàbregas', '2007-08', 'ARS').assists, 17);
  // 2001/02 was a Z-A export plus an A-Z one: surnames at the A end only exist because both were merged
  assert.ok(get('Bergkamp', '2001-02', 'ARS') && get('Anelka', '2001-02', 'LIV'));
  // mid-season movers have one card per club, in every season
  assert.equal(get('Cantona', '1992-93', 'LEE').goals + get('Cantona', '1992-93', 'MUN').goals, s38(6) + s38(9));
  assert.deepEqual(cards.filter((c) => c.full === 'Alexis Sánchez' && c.season === '2017-18').map((c) => c.club).sort(), ['ARS', 'MUN']);
  for (const c of cards) assert.ok(c.games > 0, c.id);
});

test('every season is a 38-game season: no card shows more than 38 games, and the 42-game ones are scaled', () => {
  assert.equal(Math.max(...cards.map((c) => c.games)), SEASON_GAMES);
  assert.deepEqual(meta.scaled, { seasons: ['1992-93', '1993-94', '1994-95'], to: 38 });
  // a regular of a 42-game season played about 42 games and now shows 38; of a 38-game season, 38 either way
  const schmeichel = cards.find((c) => c.name === 'Schmeichel' && c.season === '1992-93');
  assert.equal(schmeichel.games, 38);
});

test('players keep one id across their whole career, so cards link across 2016', () => {
  const kane = cards.filter((c) => c.full === 'Harry Kane');
  assert.equal(new Set(kane.map((c) => c.pid)).size, 1);
  assert.ok(kane.length >= 9);
  const careers = new Map();
  for (const c of cards) careers.set(c.pid, (careers.get(c.pid) ?? new Set()).add(c.season));
  assert.ok(Math.max(...[...careers.values()].map((x) => x.size)) >= 20, 'someone played 20+ seasons (Milner: 23)');
  // a Hat-trick that spans the old FPL/FBref boundary: three Kane seasons in one hand
  const three = ['2014-15', '2015-16', '2016-17'].map((season) => cards.find((c) => c.full === 'Harry Kane' && c.season === season));
  assert.equal(evaluateHand(three).type, 'hatTrick');
});

test('every season has a plausible number of goals on the cards', () => {
  // Every season is 38 games a team, so n clubs play n x 38 / 2 matches at about 2.5 goals each (2023/24 was a
  // record, 3.3). Own goals are not credited to a player, so a little under. A season of zeros (the wrong FBref
  // table) or a half-imported one fails this.
  for (const season of meta.seasons) {
    const inSeason = cards.filter((c) => c.season === season);
    const clubs = new Set(inSeason.map((c) => c.club)).size;
    const matches = (clubs * SEASON_GAMES) / 2;
    const goals = inSeason.reduce((sum, c) => sum + c.goals, 0);
    assert.ok(goals > 2.2 * matches && goals < 3.4 * matches, `${season}: ${goals} goals in ${matches} matches`);
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

test('display names keep compound surnames, drop suffixes and tell shared surnames apart', () => {
  const shown = (full) => [...new Set(cards.filter((c) => c.full === full).map((c) => c.name))];
  assert.deepEqual(shown('Roque Santa Cruz'), ['Santa Cruz']);
  assert.deepEqual(shown('Luís Boa Morte'), ['Boa Morte']);
  assert.deepEqual(shown('Samuele Dalla Bona'), ['Dalla Bona']);
  assert.deepEqual(shown('Tal Ben Haim'), ['Ben Haim']);
  assert.deepEqual(shown('Asier del Horno'), ['del Horno']);
  assert.deepEqual(shown('Ricardo Vaz Tê'), ['Vaz Tê']);
  assert.deepEqual(shown('Alexis Mac Allister'), ['Mac Allister']);
  assert.deepEqual(shown('Son Heung-min'), ['Son']);         // FBref writes some names surname-first
  // ordinary middle names are not part of the surname
  assert.deepEqual(shown('Ole Gunnar Solskjær'), ['Solskjær']);
  assert.deepEqual(shown('Jimmy Floyd Hasselbaink'), ['Hasselbaink']);
  // a surname shared by 4+ different players gets an initial, so two cards in a hand are not both "WRIGHT"
  assert.deepEqual(shown('Ian Wright'), ['I.Wright']);
  assert.deepEqual(shown('Adam Smith'), ['A.Smith']);
  assert.deepEqual(shown('Alan Kelly Jr.'), ['A.Kelly']);   // and the suffix is gone
  assert.deepEqual(shown('Alan Shearer'), ['Shearer']);       // a distinctive surname stays plain
  // a suffix left behind ("Jr.") is the bug; a real short mononym ("Jô") is not
  assert.ok(cards.every((c) => c.name.length >= 2 && !c.name.endsWith('.')), 'no stub names like "Jr."');
  assert.deepEqual(shown('Jô'), ['Jô']);
});

test('every season from 1992/93 to 2025/26 is covered, all from one source', () => {
  const year = (y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  const all = Array.from({ length: 2025 - 1992 + 1 }, (_, i) => year(1992 + i));
  assert.deepEqual(all.filter((x) => !meta.seasons.includes(x)), [], 'missing seasons');
  assert.deepEqual(meta.seasons, all);
  assert.match(meta.source, /FBref/);
  assert.equal(meta.sources, undefined, 'a second source would bring back inconsistent assists and player ids');
});

test('starter squads draw on every era, because every card has the same stats', () => {
  const pool = loadPool();
  let nineties = 0, twenties = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const deck = starterDeck(pool, makeRng(`era${seed}`));
    if (deck.some((c) => c.season < '2000')) nineties++;
    if (deck.some((c) => c.season >= '2020')) twenties++;
  }
  assert.ok(nineties > 30, `1990s cards in only ${nineties} of 300 starter squads`);
  assert.ok(twenties > 30, `2020s cards in only ${twenties} of 300 starter squads`);
});

test('RULE: the only categories are the stats every season has', () => {
  assert.deepEqual(CATEGORY_KEYS, ['goals', 'assists', 'games', 'discipline']);
  assert.deepEqual(Object.keys(meta.chipScale), ['goals', 'assists', 'games', 'discipline']);
});

test('RULE: one rating formula for every card, so ratings are comparable across eras', () => {
  const score = (c) => (c.pos === 'GK' ? c.games : c.goals * 2 + c.assists + c.games * 0.15);
  for (const pos of POSITIONS) {
    const group = cards.filter((c) => c.pos === pos).sort((a, b) => score(a) - score(b));
    for (let i = 1; i < group.length; i++) {
      assert.ok(group[i].rating >= group[i - 1].rating, `${pos}: ${group[i - 1].id} (${score(group[i - 1])}) rated above ${group[i].id} (${score(group[i])})`);
    }
    const r = group.map((c) => c.rating).sort((a, b) => a - b);
    assert.ok(r[r.length >> 1] > 30 && r[r.length >> 1] < 70, `${pos} median rating ${r[r.length >> 1]}`);
  }
  // not skewed to an era: the top decile is spread across the four decades roughly like the cards are
  const era = (c) => (c.season < '2000' ? 0 : c.season < '2010' ? 1 : c.season < '2020' ? 2 : 3);
  const share = (list) => [0, 1, 2, 3].map((e) => list.filter((c) => era(c) === e).length / list.length);
  const all = share(cards), top = share(cards.filter((c) => c.rating >= 90));
  for (let e = 0; e < 4; e++) assert.ok(Math.abs(all[e] - top[e]) < 0.10, `era ${e}: ${all[e].toFixed(2)} of cards, ${top[e].toFixed(2)} of 90+`);
});

test('Discipline is one category: a yellow card is 1 point, a red card is 3', () => {
  assert.deepEqual(DISCIPLINE_POINTS, { yellow: 1, red: 3 });
  assert.equal(statOf({ yellow: 5, red: 1 }, 'discipline'), 8);
  assert.equal(statOf({ yellow: 0, red: 2 }, 'discipline'), 6);
  assert.equal(statOf({ goals: 7 }, 'goals'), 7);
  // the reason it is one category: red cards alone are on a tenth of cards, the combined score on most
  const share = (f) => cards.filter((c) => f(c) > 0).length / cards.length;
  assert.ok(share((c) => c.red) < 0.2, `red alone ${share((c) => c.red)}`);
  assert.ok(share((c) => statOf(c, 'discipline')) > 0.7, `discipline ${share((c) => statOf(c, 'discipline'))}`);
  // and every card that has a record is worth chips
  const s = meta.chipScale.discipline;
  assert.ok(Math.abs(s.p99 * s.perUnit - 60) < 2);
});

test('first name and surname for the card face', () => {
  const split = (full) => { const c = cards.find((x) => x.full === full); return [firstNameOf(c), surnameOf(c)]; };
  assert.deepEqual(split('Ian Wright'), ['Ian', 'Wright']);                 // the card face drops the initial: the first name replaces it
  assert.deepEqual(split('Adam Smith'), ['Adam', 'Smith']);
  assert.deepEqual(split('Alan Shearer'), ['Alan', 'Shearer']);
  assert.deepEqual(split('Cesc Fàbregas'), ['Cesc', 'Fàbregas']);
  assert.deepEqual(split('Jimmy Floyd Hasselbaink'), ['Jimmy', 'Hasselbaink']);  // the first of several given names
  assert.deepEqual(split('Ole Gunnar Solskjær'), ['Ole', 'Solskjær']);
  assert.deepEqual(split('Alexis Mac Allister'), ['Alexis', 'Mac Allister']);    // a compound surname stays whole
  assert.deepEqual(split('Roque Santa Cruz'), ['Roque', 'Santa Cruz']);
  assert.deepEqual(split('Ruud van Nistelrooy'), ['Ruud', 'van Nistelrooy']);
  assert.deepEqual(split('Alan Kelly Jr.'), ['Alan', 'Kelly']);               // a suffix is not a name
  assert.deepEqual(split('Son Heung-min'), ['Heung-min', 'Son']);             // FBref writes this one surname-first
  assert.deepEqual(split('Ki Sung-yueng'), ['Sung-yueng', 'Ki']);
  assert.deepEqual(split('El Hadji Diouf'), ['El Hadji', 'Diouf']);           // "El Hadji" is a first name
  assert.deepEqual(split('Al Bangura'), ['Al', 'Bangura']);                   // and "Al" is one too
  for (const mononym of ['Rodri', 'Willian', 'Jô']) assert.deepEqual(split(mononym), ['', mononym], mononym);
});

test('every card splits into a first name and a surname that both come from its full name', () => {
  let mononyms = 0;
  for (const c of cards) {
    const sur = surnameOf(c), first = firstNameOf(c);
    assert.ok(sur.length > 0, `${c.id}: no surname`);
    assert.ok(c.full.includes(sur), `${c.id}: surname '${sur}' is not in '${c.full}'`);
    assert.ok(!/^[A-Z]\./.test(sur), `${c.id}: the initial is still on the surname`);
    if (first === '') { mononyms++; assert.ok(!c.full.includes(' '), `${c.id}: '${c.full}' has a first name we lost`); continue; }
    assert.ok(c.full.includes(first), `${c.id}: first name '${first}' is not in '${c.full}'`);
    assert.notEqual(first, sur, c.id);
  }
  assert.ok(mononyms > 50 && mononyms < 400, `${mononyms} mononyms`);
});

test('two different players who share a surname are told apart by first name on the card', () => {
  // the reason the face shows a first name: Ian Wright and Mark Wright are both "Wright"
  const wrights = [...new Map(cards.filter((c) => surnameOf(c) === 'Wright').map((c) => [c.pid, firstNameOf(c)])).values()];
  assert.ok(wrights.length >= 4);
  assert.ok(wrights.includes('Ian') && wrights.includes('Mark'));
});

// ---- the card face: badges and tooltips --------------------------------------------------------------------------
test('every club has a name, kit colours and a valid badge pattern', async () => {
  const { CLUB_COLOURS, CLUB_LABELS, CLUB_PATTERNS, PATTERNS } = await import('../src/ui/clubs.js');
  for (const k of Object.keys(meta.clubs)) {
    assert.ok(CLUB_LABELS[k], `${k}: no label`);
    assert.ok(CLUB_COLOURS[k], `${k}: no colours`);
    assert.ok(PATTERNS.includes(CLUB_PATTERNS[k] ?? 'solid'), `${k}: pattern ${CLUB_PATTERNS[k]}`);
  }
  assert.deepEqual(Object.keys(CLUB_PATTERNS).filter((k) => !meta.clubs[k]), [], 'a pattern for a club that is not in the data');
});

test('the badge is a shield with the club code, in the club colours, with its own clip path', async () => {
  const { badgeSvg } = await import('../src/ui/badge.js');
  const { CLUB_COLOURS } = await import('../src/ui/clubs.js');
  const ids = new Set();
  for (const k of Object.keys(meta.clubs)) {
    const svg = badgeSvg(k);
    assert.ok(svg.startsWith('<svg') && svg.trim().endsWith('</svg>'), k);
    assert.ok(svg.includes(`>${k}</text>`), `${k}: the code is on the badge`);
    assert.ok(svg.toLowerCase().includes(CLUB_COLOURS[k][0].toLowerCase()), `${k}: primary colour`);
    const id = /clipPath id="(bd\d+)"/.exec(svg)[1];
    assert.ok(!ids.has(id), `${k}: clip path id ${id} is reused`);   // two badges on one page must not share an id
    ids.add(id);
  }
  assert.match(badgeSvg('NEW'), /<rect x="22"/, 'Newcastle is striped');
  assert.doesNotMatch(badgeSvg('ARS'), /<polygon/, 'Arsenal is a plain shield');
});

test('the scaled seasons the card tooltips mention are the ones the build scaled', async () => {
  const { SCALED_SEASONS } = await import('../src/engine/cards.js');
  assert.deepEqual(SCALED_SEASONS, meta.scaled.seasons);
});

test('tooltips say what each number is, with the right numbers', async () => {
  const { cardTips } = await import('../src/ui/tips.js');
  const get = (full, season, club) => cards.find((c) => c.full === full && c.season === season && (!club || c.club === club));
  const henry = get('Thierry Henry', '2003-04');
  const t = cardTips(henry, { category: 'goals', scale: meta.chipScale });
  assert.equal(t.band, 'Arsenal, 2003/04 season');
  assert.equal(t.name, 'Thierry Henry');
  assert.equal(t.rows.goals, '30 goals in 2003/04');
  assert.equal(t.rows.assists, '6 assists in 2003/04');
  assert.match(t.rows.games, /^37 games played in 2003\/04 \(minutes ÷ 90\)$/);
  const y = henry.yellow, r = henry.red;
  assert.equal(t.rows.discipline, `${y + 3 * r} discipline points: ${y} yellow card${y === 1 ? '' : 's'} × 1 + ${r} red card${r === 1 ? '' : 's'} × 3`);
  assert.equal(t.chips.goals, `Worth ${Math.round(30 * meta.chipScale.goals.perUnit)} chips in this matchday's goals round: 30 × ${meta.chipScale.goals.perUnit} chips each`);
  assert.deepEqual(Object.keys(t.chips), ['goals'], 'only the active category explains its chips');
  assert.match(t.rating, /^Overall \d+ out of 99: how this season ranks among every forward since 1992/);
  assert.match(t.rating, /not worth chips/);
  assert.equal(t.pos, 'Forward');
  assert.equal(t.ability, undefined, 'only keepers have an ability');
  assert.equal(t.edition, undefined, 'a plain sticker has no edition');

  // one of something, and none of it
  const one = cards.find((c) => c.goals === 1), none = cards.find((c) => c.goals === 0 && c.pos === 'FWD');
  assert.match(cardTips(one).rows.goals, /^1 goal in /);
  assert.match(cardTips(none).rows.goals, /^No goals in /);

  // the 42-game seasons say so; the others do not
  assert.match(cardTips(get('Teddy Sheringham', '1992-93', 'TOT')).rows.goals, /\(a 42-game season, scaled to 38\)$/);
  assert.doesNotMatch(cardTips(henry).rows.goals, /42-game/);

  // keepers explain Safe Hands, by tier
  const gk = (min, max) => cards.find((c) => c.pos === 'GK' && c.games >= min && c.games <= max);
  assert.match(cardTips(gk(30, 38)).ability, /\+3 mult .*first choice: 30\+ games/);
  assert.match(cardTips(gk(15, 29)).ability, /\+2 mult .*rotation: 15 to 29 games/);
  assert.match(cardTips(gk(0, 14)).ability, /\+1 mult .*backup: under 15 games/);
  assert.equal(cardTips(gk(30, 38)).pos.startsWith('Goalkeeper'), true);

  // an edition explains itself
  assert.match(cardTips({ ...henry, edition: 'gold' }).edition, /^GOLD: ×1\.5 mult every time this sticker scores\.$/);
  assert.match(cardTips({ ...henry, edition: 'shiny' }).edition, /^SHINY: \+40 chips/);
});

test('no tooltip on any card ever says undefined or NaN, in any category', async () => {
  const { cardTips } = await import('../src/ui/tips.js');
  for (const c of cards) {
    for (const category of CATEGORY_KEYS) {
      const t = cardTips(c, { category, scale: meta.chipScale });
      const text = [t.band, t.rating, t.pos, t.name, ...Object.values(t.rows), ...Object.values(t.chips), t.ability ?? '', t.edition ?? ''].join(' | ');
      assert.ok(!/undefined|NaN|null/.test(text), `${c.id} ${category}: ${text}`);
      assert.ok(Object.values(t.rows).every((r) => r.length > 8), c.id);
    }
  }
});
