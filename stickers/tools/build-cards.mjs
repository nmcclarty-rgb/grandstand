// Turn the FBref season exports in data/fbref/ into one card per player-season:
//   stickers/src/data/cards.json
//
//   node tools/build-cards.mjs
//
// A card is a *player in a season* (Panini album style: "Salah, Liverpool 2017/18"), not a player.
// Same player, different season = different card with the same `pid`, so the engine can recognise a
// player across his whole career.
//
// ONE SOURCE. Every season, 1992/93 to 2025/26, comes from FBref's Standard Stats table, so an assist
// means the same thing in every season, a mid-season mover is handled the same way in every season, and a
// player has the same id throughout. (An earlier build used the Fantasy Premier League archive for
// 2016/17 onward; the two sources disagreed on assists for ~30% of players, so it was dropped.)
//
// RULE: a card carries only stats that exist for EVERY season: goals, assists, games (minutes / 90),
// yellow cards, red cards. The four categories are goals, assists, games and Discipline (yellows + 3 x reds).
//
// 38 GAMES. 1992/93 to 1994/95 were 42-game seasons (22 clubs). Their counting stats are scaled by 38/42
// so every season is a 38-game season, the same length as a run.
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFbrefSeasons, fbrefNumbers } from './fbref.mjs';
import { CLUB_NAMES, FBREF_CLUBS } from './clubs.mjs';
import { CATEGORY_KEYS, statOf } from '../src/engine/cards.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_MINUTES = 270; // three full games: below that a "season" is a cameo, not a sticker
const SEASON_GAMES = 38;

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

const cards = [];
const unknownClubs = new Set();
const scaled = [];
let missingBirthYear = 0;

for (const season of seasons) {
  const rows = fbref.get(season);
  const clubOf = (row) => {
    const club = FBREF_CLUBS[row.team.toLowerCase()];
    if (!club) throw new Error(`${season}: unknown club '${row.team}' (${row.player}); add it to tools/clubs.mjs`);
    if (!CLUB_NAMES[club]) unknownClubs.add(club);
    return club;
  };
  const clubs = new Set(rows.map(clubOf));
  const gamesPerTeam = 2 * (clubs.size - 1); // 22 clubs -> 42, 20 clubs -> 38
  const factor = SEASON_GAMES / gamesPerTeam;
  if (factor !== 1) scaled.push(season);
  const sc = (x) => Math.round(x * factor);

  let kept = 0;
  for (const row of rows) {
    const n = fbrefNumbers(row);
    if (n.minutes < MIN_MINUTES) continue; // cameos first: FBref leaves some of their positions blank
    const pos = FBREF_POS[row.position.split(',')[0]];
    if (!pos) throw new Error(`${season}: unknown position '${row.position}' for ${row.player} (${n.minutes} min)`);
    if (!row.birth_year) missingBirthYear++;
    const club = clubOf(row);
    // one card per player per club per season: a mid-season mover has two
    const pid = `fb:${slug(row.player)}:${row.birth_year}`;
    cards.push({
      id: `${pid}-${season}-${club}`, pid,
      name: displayName(row.player), full: row.player, pos, club, season,
      goals: sc(n.goals), assists: sc(n.assists), games: sc(n.minutes / 90),
      yellow: sc(n.yellow), red: sc(n.red),
    });
    kept++;
  }
  console.log(`${season}: ${rows.length} rows, ${kept} cards, ${clubs.size} clubs${factor !== 1 ? `, scaled ${gamesPerTeam}->${SEASON_GAMES} games` : ''}`);
}
if (unknownClubs.size) throw new Error(`club names missing for: ${[...unknownClubs].join(', ')}`);
if (missingBirthYear) console.warn(`warning: ${missingBirthYear} cards have no birth year in the export, so their pid is less reliable`);

// A surname shared by several players ("Smith", "Johnson") gets the first initial, so two cards in one
// hand are not both just "SMITH". COMMON is how many different players must share a name before it does.
const COMMON = 4;
const players = {};
for (const c of cards) (players[c.name] ??= new Set()).add(c.pid);
for (const c of cards) {
  if (players[c.name].size >= COMMON && c.full.includes(' ')) {
    c.name = `${c.full.normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0].toUpperCase()}.${c.name}`;
  }
}

// Overall rating: percentile within position across the whole data set (1-99). It is the Top Trumps
// headline number and decides pack rarity. One formula for every card: goal involvement plus availability;
// a keeper has neither, so goalkeepers rank on games. Discipline does not count.
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const score = (c) => (c.pos === 'GK' ? c.games : c.goals * 2 + c.assists + c.games * 0.15);
for (const pos of POSITIONS) {
  const group = cards.filter((c) => c.pos === pos).sort((a, b) => score(a) - score(b));
  let i = 0;
  while (i < group.length) {
    let j = i;
    while (j + 1 < group.length && score(group[j + 1]) === score(group[i])) j++;
    const pct = ((i + j) / 2) / (group.length - 1);
    for (let k = i; k <= j; k++) group[k].rating = Math.max(1, Math.min(99, Math.round(pct * 98) + 1));
    i = j + 1;
  }
}

// Chip scale per category: the 99th percentile of non-zero values is worth 60 chips, so no category is
// inherently stronger than another. Categories and the derived Discipline score come from the engine.
const chipScale = {};
for (const key of CATEGORY_KEYS) {
  const vals = cards.map((c) => statOf(c, key)).filter((v) => v > 0).sort((a, b) => a - b);
  const p99 = vals[Math.floor(vals.length * 0.99)];
  chipScale[key] = { p99, perUnit: Math.round((60 / p99) * 1000) / 1000 };
}

cards.sort((a, b) => a.season.localeCompare(b.season) || a.club.localeCompare(b.club) || b.rating - a.rating || a.id.localeCompare(b.id));
const out = {
  meta: {
    source: 'FBref Standard Stats exports, one per season, 1992-93 to 2025-26',
    seasons,
    scaled: { seasons: scaled, to: SEASON_GAMES },
    minMinutes: MIN_MINUTES,
    chipScale,
    clubs: Object.fromEntries([...new Set(cards.map((c) => c.club))].sort().map((k) => [k, CLUB_NAMES[k]])),
    count: cards.length,
  },
  cards,
};
await writeFile(join(ROOT, 'src', 'data', 'cards.json'), JSON.stringify(out));
console.log(`${cards.length} cards, ${new Set(cards.map((c) => c.pid)).size} players, ${Object.keys(out.meta.clubs).length} clubs`);
console.log('chip scale (p99 -> 60 chips):', JSON.stringify(chipScale));
