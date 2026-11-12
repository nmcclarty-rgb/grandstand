// Match results, 1992/93 to 2025/26: parsers for the two open datasets, a club-name -> club-code map, and the club-season table.
//
//   1992/93 to 2020/21   footballcsv/england   (CC0)   CSV:  Round,Date,Team 1,FT,Team 2
//   2021/22 to 2025/26   openfootball/england  (CC0)   text: "  15:00  Home FC   2-1 (1-0)  Away FC", or "Home FC  v Away FC  2-1 (1-0)"
//
// fetch-results.mjs downloads them and writes data/results.json: { season: [[home, homeGoals, awayGoals, away], ...] } with club codes.
import { CLUB_NAMES, FBREF_CLUBS } from './clubs.mjs';

const norm = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/\b(fc|afc)\b/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const BY_NAME = new Map();
for (const [code, name] of Object.entries(CLUB_NAMES)) BY_NAME.set(norm(name), code);
for (const [k, code] of Object.entries(FBREF_CLUBS)) BY_NAME.set(norm(k), code);
// full names as the two datasets write them
const ALIAS = {
  'manchester united': 'MUN', 'manchester city': 'MCI', 'tottenham hotspur': 'TOT', 'newcastle united': 'NEW', 'west ham united': 'WHU',
  'wolverhampton wanderers': 'WOL', 'brighton and hove albion': 'BHA', 'leicester city': 'LEI', 'norwich city': 'NOR',
  'queens park rangers': 'QPR', 'blackburn rovers': 'BLA', 'bolton wanderers': 'BOL', 'west bromwich albion': 'WBA', 'wigan athletic': 'WIG',
  'birmingham city': 'BIR', 'swansea city': 'SWA', 'stoke city': 'STK', 'hull city': 'HUL', 'cardiff city': 'CAR', 'huddersfield town': 'HUD',
  'ipswich town': 'IPS', 'coventry city': 'COV', 'oldham athletic': 'OLD', 'swindon town': 'SWI', 'derby county': 'DER', 'charlton athletic': 'CHA',
  'bradford city': 'BRA', 'sheffield wednesday': 'SHW', 'sheffield united': 'SHU', 'nottingham forest': 'NFO', 'leeds united': 'LEE', 'luton town': 'LUT',
  'brighton': 'BHA', 'wolverhampton': 'WOL', 'newcastle': 'NEW', 'tottenham': 'TOT', 'west ham': 'WHU', 'nottingham': 'NFO', 'leeds': 'LEE',
  'man city': 'MCI', 'man utd': 'MUN', 'manchester utd': 'MUN', 'sunderland': 'SUN',
};
export function clubCode(name) {
  const n = norm(name);
  const code = BY_NAME.get(n) ?? ALIAS[n];
  if (!code) throw new Error(`results: no club code for '${name}'`);
  return code;
}

const SCORE = '(\\d+)\\s*[-\u2013]\\s*(\\d+)';
// footballcsv/england: Round,Date,Team 1,FT,Team 2  (the score may use an en dash; names may be quoted)
export function parseFootballcsv(text) {
  const out = [];
  for (const line of text.split('\n').slice(1).map((l) => l.replace(/\r/g, '')).filter(Boolean)) {
    const m = line.match(new RegExp(`^(?:"[^"]*"|[^,]*),(?:"[^"]*"|[^,]*),([^,]+),${SCORE},(.+)$`));
    if (!m) throw new Error(`results: cannot read '${line}'`);
    out.push([clubCode(m[1].replace(/^"|"$/g, '')), Number(m[2]), Number(m[3]), clubCode(m[4].replace(/^"|"$/g, ''))]);
  }
  return out;
}
// openfootball/england: two layouts, with or without a half-time score, with or without a kick-off time
export function parseOpenfootball(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const l = raw.replace(/\r/g, '');
    let m = l.match(new RegExp(`^\\s+(?:\\d\\d:\\d\\d\\s+)?(.+?)\\s+v\\s+(.+?)\\s+${SCORE}(?:\\s+\\(\\d+[-\u2013]\\d+\\))?\\s*$`));
    if (m) { out.push([clubCode(m[1]), Number(m[3]), Number(m[4]), clubCode(m[2])]); continue; }
    m = l.match(new RegExp(`^\\s+(?:\\d\\d:\\d\\d\\s+)?(.+?)\\s+${SCORE}(?:\\s+\\(\\d+[-\u2013]\\d+\\))?\\s+(.+?)\\s*$`));
    if (m && !m[1].startsWith('(')) out.push([clubCode(m[1]), Number(m[2]), Number(m[3]), clubCode(m[4])]);
  }
  return out;
}

// a club-season: P W D L GF GA CS (clean sheets: matches without conceding) Pts
export function tableOf(matches) {
  const t = {};
  const row = (c) => (t[c] ??= { P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, CS: 0, Pts: 0 });
  for (const [h, hg, ag, a] of matches) {
    for (const [c, f, g] of [[h, hg, ag], [a, ag, hg]]) {
      const r = row(c);
      r.P++; r.GF += f; r.GA += g;
      if (g === 0) r.CS++;
      if (f > g) { r.W++; r.Pts += 3; } else if (f === g) { r.D++; r.Pts += 1; } else r.L++;
    }
  }
  return t;
}
// the champions as the results have them: most points, then goal difference
export const leaderOf = (table) => Object.entries(table).sort((a, b) => b[1].Pts - a[1].Pts || (b[1].GF - b[1].GA) - (a[1].GF - a[1].GA) || b[1].GF - a[1].GF)[0][0];

export const sourceUrl = (season) => {
  const y = Number(season.slice(0, 4));
  return y <= 2020
    ? `https://raw.githubusercontent.com/footballcsv/england/master/${Math.floor(y / 10) * 10}s/${season}/eng.1.csv`
    : `https://raw.githubusercontent.com/openfootball/england/master/${season}/1-premierleague.txt`;
};
export const parseSeason = (season, text) => (Number(season.slice(0, 4)) <= 2020 ? parseFootballcsv(text) : parseOpenfootball(text));
