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
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFbrefSeasons, fbrefNumbers } from './fbref.mjs';
import { CLUB_NAMES, FBREF_CLUBS } from './clubs.mjs';
import { CHAMPIONS, TITLE_APPS } from './champions.mjs';
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
      p = { id: pid, full: row.player, titles: 0, apps: 0, goals: 0, assists: 0, yellow: 0, red: 0, clubApps: new Map(), stints: new Set(), posApps: new Map(), first: season, last: season, latest: season };
      players.set(pid, p);
    }
    p.apps += n.games; p.goals += n.goals; p.assists += n.assists; p.yellow += n.yellow; p.red += n.red;
    p.clubApps.set(club, (p.clubApps.get(club) ?? 0) + n.games);
    // a title: a season at the champions with 5+ league appearances for them (a mid-season mover counts for the club he won it with)
    if (CHAMPIONS[season] === club && n.games >= TITLE_APPS) p.titles++;
    p.stints.add(`${club}|${season}`);
    const pos = FBREF_POS[row.position.split(',')[0]];
    if (pos) p.posApps.set(pos, (p.posApps.get(pos) ?? 0) + Math.max(n.games, 0.01));
    if (season < p.first) p.first = season;
    if (season >= p.last) { p.last = season; p.full = row.player; } // the most recent spelling
  }
}
if (unknownClubs.size) throw new Error(`club names missing for: ${[...unknownClubs].join(', ')}`);

// ---- 2. the pool ---------------------------------------------------------------------------------------------------
const pool = [...players.values()].filter((p) => p.apps >= MIN_APPS);
for (const p of pool) {
  if (!p.posApps.size) throw new Error(`${p.full}: no position in any row (${p.apps} apps)`);
  p.pos = [...p.posApps].sort((a, b) => b[1] - a[1])[0][0];                       // where he played most
  p.clubs = [...p.clubApps].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));
  p.club = p.clubs[0][0];                                                          // his club: most appearances
  p.discipline = p.yellow * DISCIPLINE_POINTS.yellow + p.red * DISCIPLINE_POINTS.red;
}

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
  games: p.apps, goals: p.goals, assists: p.assists, yellow: p.yellow, red: p.red, titles: p.titles,
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
