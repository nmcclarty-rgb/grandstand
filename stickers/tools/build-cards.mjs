// Turn the FBref season exports in data/fbref/ into one CARD PER PLAYER, his whole Premier League career:
//   stickers/src/data/cards.json
//
//   node tools/build-cards.mjs
//
// "Only one Frank Lampard." A card is a player, with his career totals since 1992/93 (every row of every export, cameos
// included, nothing scaled), the clubs and club-seasons he played in, and a 1-99 RATING for each stat so a legend and a
// journeyman can sit in the same hand. The real totals stay on the card; the ratings are what score.
//
// ONE SOURCE: FBref's Standard Stats table, so a stat means the same thing in every season and a player has one id
// (name + birth year) for his whole career.
//
// POOL: players with at least MIN_APPS Premier League appearances.
//
// RULE: only stats that exist for every season: appearances, goals, assists, yellow cards, red cards, and league titles (the champions of
// each season, tools/champions.mjs, attached to the players who made 5+ league appearances for them).
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFbrefSeasons, fbrefNumbers } from './fbref.mjs';
import { CLUB_NAMES, FBREF_CLUBS } from './clubs.mjs';
import { CHAMPIONS, TITLE_APPS } from './champions.mjs';
import { tableOf } from './results.mjs';
import { POSITION_OVERRIDES } from './positions.mjs';
import { CATEGORY_KEYS, DISCIPLINE_POINTS, RATING_TO_CHIPS, RATING_EXPONENT, ratingFor, overallOf } from '../src/engine/cards.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MIN_APPS = 20;

const FBREF_POS = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' };
const PARTICLES = new Set(['van', 'von', 'de', 'der', 'den', 'di', 'da', 'dos', 'du', 'le', 'la', 'el', 'al', 'ten', 'ter',
  'del', 'della', 'dalla', 'dal', 'degli', 'ben', 'boa', 'santa', 'san', 'vaz']);
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Compound surnames the last-word rule gets wrong. Found by reading every 3+ word name in the data.
const COMPOUND = {
  'Alexis Mac Allister': 'Mac Allister', 'Giovani Lo Celso': 'Lo Celso', 'Ramiro Funes Mori': 'Funes Mori',
  'Bruno Martins Indi': 'Martins Indi', 'Emile Smith Rowe': 'Smith Rowe', 'Albert Sambi Lokonga': 'Sambi Lokonga',
  'Bruno Ecuele Manga': 'Ecuele Manga', 'Anthony Vanden Borre': 'Vanden Borre', 'Randal Kolo Muani': 'Kolo Muani',
  'Ben Brereton Díaz': 'Brereton Díaz', 'Armel Bella Kotchap': 'Bella Kotchap', 'Jaden Philogene Bidace': 'Philogene',
};

// "Ruud van Nistelrooy" -> "van Nistelrooy"; "Teddy Sheringham" -> "Sheringham"; "Alan Kelly Jr." -> "Kelly".
// FBref writes some East Asian names surname-first ("Son Heung-min"): a two-word name whose last word is
// "Xxx-yyy" shows the first word.
export function displayName(full) {
  if (COMPOUND[full]) return COMPOUND[full];
  const parts = full.replace(/\s+(jr|sr|jnr|snr)\.?$/i, '').split(/\s+/);
  if (parts.length === 2 && /^[A-Z][a-z]+-[a-z]+$/.test(parts[1])) return parts[0];
  let i = parts.length - 1;
  while (i > 1 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(parts.length === 1 ? 0 : i).join(' ');
}

const fbref = await loadFbrefSeasons(join(ROOT, 'data', 'fbref'));
const seasons = [...fbref.keys()].sort();
if (!seasons.length) throw new Error('no FBref exports in data/fbref/');
for (const season of seasons) if (!CHAMPIONS[season]) throw new Error(`${season}: no champion in tools/champions.mjs`);

// Match results (data/results.json, from fetch-results.mjs) give each club-season's wins and clean sheets exactly. A player's share of them
// is ESTIMATED from his minutes: a club-season's wins (or clean sheets) times his minutes / the club's minutes (matches x 90).
//   wins          every player, for the club's wins while he was on the pitch (estimated)
//   cleanSheets   goalkeepers and defenders only (the row's first listed position is GK or DF, season by season, so a player who moved
//                 up the pitch earns none in those seasons), for the club's clean sheets while he was on the pitch (estimated)
const results = JSON.parse(await readFile(join(ROOT, 'data', 'results.json'), 'utf8'));
const tables = {};
for (const season of seasons) { if (!results[season]) throw new Error(`${season}: no match results in data/results.json`); tables[season] = tableOf(results[season]); }
const shareSum = {}, gkShare = {};   // per club-season, to check the estimate adds up

// ---- 1. every row of every season, summed per player ---------------------------------------------------------------
const players = new Map();
const unknownClubs = new Set();
for (const season of seasons) {
  for (const row of fbref.get(season)) {
    const club = FBREF_CLUBS[row.team.toLowerCase()];
    if (!club) throw new Error(`${season}: unknown club '${row.team}' (${row.player}); add it to tools/clubs.mjs`);
    if (!CLUB_NAMES[club]) unknownClubs.add(club);
    const n = fbrefNumbers(row);
    const pid = `${slug(row.player)}:${row.birth_year}`;
    let p = players.get(pid);
    if (!p) {
      p = { id: pid, full: row.player, titles: 0, wins: 0, cleanSheets: 0, apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, clubApps: new Map(), stints: new Set(), posApps: new Map(), first: season, last: season, latest: season };
      players.set(pid, p);
    }
    p.apps += n.games; p.goals += n.goals; p.assists += n.assists; p.yellow += n.yellow; p.red += n.red;
    p.clubApps.set(club, (p.clubApps.get(club) ?? 0) + n.games);
    // wins and clean sheets while on the pitch, estimated from his share of the club's minutes
    const tab = tables[season][club];
    if (!tab) throw new Error(`${season}: no results for ${club} (${row.player})`);
    const share = n.minutes / (tab.P * 90);
    const key = `${season}|${club}`;
    shareSum[key] = (shareSum[key] ?? 0) + share;
    p.wins += tab.W * share;
    const first = row.position.split(',')[0];
    if (first === 'GK') gkShare[key] = (gkShare[key] ?? 0) + share;
    // a hand-corrected position (positions.mjs) overrides the row's: Essien and Butt are listed "DF,MF" but are midfielders, so earn no clean sheets
    const back = POSITION_OVERRIDES[pid] ? ['GK', 'DEF'].includes(POSITION_OVERRIDES[pid]) : first === 'GK' || first === 'DF';
    if (back) p.cleanSheets += tab.CS * share;
    // a title: a season at the champions with 5+ league appearances for them (a mid-season mover counts for the club he won it with)
    if (CHAMPIONS[season] === club && n.games >= TITLE_APPS) p.titles++;
    p.stints.add(`${club}|${season}`);
    const pos = FBREF_POS[row.position.split(',')[0]];
    if (pos) p.posApps.set(pos, (p.posApps.get(pos) ?? 0) + Math.max(n.games, 0.01));
    if (season < p.first) p.first = season;
    if (season >= p.last) { p.last = season; p.full = row.player; } // the most recent spelling
  }
}
// the estimate adds up: 11 players are on the pitch at once, and exactly one of them is the goalkeeper
{
  const sums = Object.values(shareSum), gks = Object.keys(shareSum).map((k) => gkShare[k] ?? 0);
  console.log(`minutes shares per club-season: all players ${Math.min(...sums).toFixed(2)} to ${Math.max(...sums).toFixed(2)} (11 on the pitch), goalkeepers ${Math.min(...gks).toFixed(2)} to ${Math.max(...gks).toFixed(2)} (one on the pitch)`);
  if (Math.min(...sums) < 10.2 || Math.max(...sums) > 11.3) throw new Error('a club-season does not have about 11 players\' worth of minutes: check the exports');
  if (Math.min(...gks) < 0.9 || Math.max(...gks) > 1.05) throw new Error('a club-season does not have about one goalkeeper\'s worth of minutes: check the exports');
}
if (unknownClubs.size) throw new Error(`club names missing for: ${[...unknownClubs].join(', ')}`);

// ---- 2. the pool ---------------------------------------------------------------------------------------------------
const pool = [...players.values()].filter((p) => p.apps >= MIN_APPS);
for (const p of pool) {
  if (!p.posApps.size) throw new Error(`${p.full}: no position in any row (${p.apps} apps)`);
  p.pos = [...p.posApps].sort((a, b) => b[1] - a[1])[0][0];                       // where he played most
  const override = POSITION_OVERRIDES[p.id];
  if (override) {
    if (override === p.pos) throw new Error(`positions.mjs: ${p.full} is already ${p.pos}; remove the override`);
    p.posFrom = p.pos; p.pos = override;
  }
  p.clubs = [...p.clubApps].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));
  p.club = p.clubs[0][0];                                                          // his club: most appearances
  p.discipline = p.yellow * DISCIPLINE_POINTS.yellow + p.red * DISCIPLINE_POINTS.red;
}

for (const id of Object.keys(POSITION_OVERRIDES)) if (!pool.some((p) => p.id === id)) throw new Error(`positions.mjs: '${id}' is not a player in the pool`);
console.log(`${Object.keys(POSITION_OVERRIDES).length} position overrides applied`);

// ---- 3. ratings: each stat against the record, 1-99 -----------------------------------------------------------------
const STAT = { goals: (p) => p.goals, assists: (p) => p.assists, games: (p) => p.apps, discipline: (p) => p.discipline };
const record = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, Math.max(...pool.map(STAT[k]))]));
for (const p of pool) p.rate = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, ratingFor(STAT[k](p), record[k])]));

// ---- 4. OVR: his ratings weighted for his position -------------------------------------------------------------------
for (const p of pool) p.rating = Math.round(overallOf(p.pos, p.rate));

// ---- 5. display names: a first initial for a surname shared by four or more players ---------------------------------
const COMMON = 4;
const byName = {};
for (const p of pool) { p.name = displayName(p.full); (byName[p.name] ??= new Set()).add(p.id); }
for (const p of pool) {
  if (byName[p.name].size >= COMMON && p.full.includes(' ')) p.name = `${p.full.normalize('NFD').replace(/[̀-ͯ]/g, '')[0].toUpperCase()}.${p.name}`;
}

// ---- 6. out --------------------------------------------------------------------------------------------------------
const cards = pool.map((p) => ({
  id: p.id, name: p.name, full: p.full, pos: p.pos, club: p.club,
  clubs: p.clubs.map(([c, a]) => [c, a]),
  stints: [...p.stints].sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]) || a.localeCompare(b)),
  first: p.first, last: p.last,
  games: p.apps, goals: p.goals, assists: p.assists, yellow: p.yellow, red: p.red, titles: p.titles, wins: Math.round(p.wins), cleanSheets: Math.round(p.cleanSheets),
  rate: p.rate, rating: p.rating,
})).sort((a, b) => b.rating - a.rating || b.games - a.games || a.id.localeCompare(b.id));

const out = {
  meta: {
    source: 'FBref Standard Stats exports, one per season, 1992-93 to 2025-26',
    seasons,
    minApps: MIN_APPS,
    players: players.size,           // everyone in the exports; the pool is the cards
    // chips = rating x this, so a rating of 99 is worth 60 chips
    ratingExponent: RATING_EXPONENT,
    records: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, { total: record[k], holder: pool.find((p) => STAT[k](p) === record[k]).full }])),
    chipScale: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, { perUnit: RATING_TO_CHIPS }])),
    clubs: Object.fromEntries([...new Set(cards.flatMap((c) => c.clubs.map(([k]) => k)))].sort().map((k) => [k, CLUB_NAMES[k]])),
    count: cards.length,
  },
  cards,
};
await writeFile(join(ROOT, 'src', 'data', 'cards.json'), JSON.stringify(out));
console.log(`${seasons.length} seasons, ${players.size} players in the exports, ${cards.length} with ${MIN_APPS}+ appearances (the pool)`);
console.log('records:', Object.entries(out.meta.records).map(([k, r]) => `${k} ${r.total} (${r.holder})`).join(', '));
