import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFbrefTable, mergeSeasonFiles, EXPORT_CAP } from '../tools/fbref.mjs';

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

