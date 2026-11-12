import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clubCode, parseFootballcsv, parseOpenfootball, tableOf, leaderOf, sourceUrl, parseSeason } from '../tools/results.mjs';
import { CHAMPIONS } from '../tools/champions.mjs';

const results = JSON.parse(readFileSync(new URL('../data/results.json', import.meta.url), 'utf8'));

test('club names from both datasets map to the club codes, and an unknown name is an error', () => {
  assert.equal(clubCode('Manchester United FC'), 'MUN');
  assert.equal(clubCode('Manchester Utd'), 'MUN');
  assert.equal(clubCode('Wolverhampton Wanderers FC'), 'WOL');
  assert.equal(clubCode('Brighton & Hove Albion FC'), 'BHA');
  assert.equal(clubCode('AFC Bournemouth'), 'BOU');
  assert.equal(clubCode('Nottingham Forest FC'), 'NFO');
  assert.equal(clubCode('Liverpool'), 'LIV');
  assert.throws(() => clubCode('Real Madrid'), /no club code/);
});

test('footballcsv rows: a hyphen or an en dash in the score, quoted names', () => {
  const csv = 'Round,Date,Team 1,FT,Team 2\n1,Sat Aug 15 1992,Arsenal FC,2-4,Norwich City FC\n1,Sat Sep 12 2020,Fulham FC,0–3,Arsenal FC\n';
  assert.deepEqual(parseFootballcsv(csv), [['ARS', 2, 4, 'NOR'], ['FUL', 0, 3, 'ARS']]);
  assert.throws(() => parseFootballcsv('Round,Date,Team 1,FT,Team 2\nnot a match\n'), /cannot read/);
});

test('openfootball rows: both layouts, with and without a time or a half-time score, and scorers are ignored', () => {
  const txt = [
    '= English Premier League 2021/22', '', '▪ Matchday 1', 'Fri Aug 13',
    '  20:00  Brentford FC             2-0 (1-0)  Arsenal FC',
    '         Crystal Palace FC        0-0  Brentford FC',
    '    15:00  Arsenal FC              v Wolverhampton Wanderers FC  2-0 (1-0)\r',
    '           Everton FC              v Brighton & Hove Albion FC  0-3 (0-1)',
    '                  (Hugo EKITIKE 37\', Cody GAKPO 49\')',
  ].join('\n');
  assert.deepEqual(parseOpenfootball(txt), [['BRE', 2, 0, 'ARS'], ['CRY', 0, 0, 'BRE'], ['ARS', 2, 0, 'WOL'], ['EVE', 0, 3, 'BHA']]);
});

test('a club-season table, and the champions are the leader on points then goal difference', () => {
  const t = tableOf([['ARS', 2, 0, 'CHE'], ['CHE', 1, 1, 'ARS'], ['ARS', 0, 1, 'MUN'], ['MUN', 3, 0, 'CHE']]);
  assert.deepEqual(t.ARS, { P: 3, W: 1, D: 1, L: 1, GF: 3, GA: 2, CS: 1, Pts: 4 });
  assert.deepEqual(t.MUN, { P: 2, W: 2, D: 0, L: 0, GF: 4, GA: 0, CS: 2, Pts: 6 });
  assert.equal(leaderOf(t), 'MUN');
  assert.equal(sourceUrl('1992-93'), 'https://raw.githubusercontent.com/footballcsv/england/master/1990s/1992-93/eng.1.csv');
  assert.equal(sourceUrl('2025-26'), 'https://raw.githubusercontent.com/openfootball/england/master/2025-26/1-premierleague.txt');
  assert.equal(parseSeason('2000-01', 'Round,Date,Team 1,FT,Team 2\n1,x,Arsenal FC,1-0,Chelsea FC\n').length, 1);
});

test('data/results.json: all 34 seasons, every one complete and consistent', () => {
  assert.deepEqual(Object.keys(results), Object.keys(CHAMPIONS));
  for (const [season, matches] of Object.entries(results)) {
    const t = tableOf(matches);
    const clubs = Object.keys(t).length;
    assert.ok(clubs === 22 || clubs === 20, `${season}: ${clubs} clubs`);
    assert.equal(clubs === 22, ['1992-93', '1993-94', '1994-95'].includes(season), `${season}: 22 clubs only in the first three seasons`);
    assert.equal(matches.length, clubs * (clubs - 1), `${season}: every pairing home and away`);
    for (const r of Object.values(t)) assert.equal(r.P, (clubs - 1) * 2);
    assert.equal(Object.values(t).reduce((s, r) => s + r.GF, 0), Object.values(t).reduce((s, r) => s + r.GA, 0), `${season}: goals for = goals against`);
    assert.equal(leaderOf(t), CHAMPIONS[season], `${season}: the table leader is the champion`);
    for (const r of Object.values(t)) { assert.equal(r.W + r.D + r.L, r.P); assert.equal(r.Pts, 3 * r.W + r.D); assert.ok(r.CS <= r.P); }
  }
});

test('club-seasons that everyone remembers', () => {
  const row = (s, c) => tableOf(results[s])[c];
  assert.deepEqual([row('2003-04', 'ARS').W, row('2003-04', 'ARS').D, row('2003-04', 'ARS').L, row('2003-04', 'ARS').Pts], [26, 12, 0, 90], 'the Invincibles');
  assert.equal(row('2007-08', 'DER').Pts, 11, 'Derby');
  assert.equal(row('2017-18', 'MCI').Pts, 100);
  assert.deepEqual([row('2004-05', 'CHE').Pts, row('2004-05', 'CHE').GA], [95, 15], 'Mourinho\'s Chelsea');
  assert.equal(row('2015-16', 'LEI').Pts, 81);
  assert.deepEqual([row('2018-19', 'MCI').Pts, row('2018-19', 'LIV').Pts], [98, 97]);
  assert.equal(row('2024-25', 'LIV').Pts, 84);
  const a = row('2025-26', 'ARS');
  assert.deepEqual([a.W, a.D, a.L, a.Pts, a.GF, a.GA], [26, 7, 5, 85, 71, 27], 'Arsenal 2025/26');
  assert.equal(row('2025-26', 'MCI').Pts, 78);
  assert.equal(row('2004-05', 'CHE').CS, 25, 'a record 25 clean sheets that season');
});
