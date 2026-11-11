// Turn the raw FPL season files into one card per player-season:
//   stickers/src/data/cards.json
//
//   node stickers/tools/build-cards.mjs
//
// A card is a *player in a season* (Panini album style: "Salah, Liverpool
// 2017/18"), not a player. Same player, different season = different card, with
// a shared `pid` so the engine can recognise career arcs.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects } from './csv.mjs';
import { SEASONS } from './seasons.mjs';
import { loadFbrefSeasons, fbrefNumbers } from './fbref.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_MINUTES = 270; // three full games: below that a "season" is a cameo, not a sticker

// FPL team ids are alphabetical within a season. 2016/17-2018/19 ship no
// teams.csv, so the lists are spelled out (checked in test/data.test.mjs).
const LEGACY_TEAMS = {
  '2016-17': ['ARS','BOU','BUR','CHE','CRY','EVE','HUL','LEI','LIV','MCI','MUN','MID','SOU','STK','SUN','SWA','TOT','WAT','WBA','WHU'],
  '2017-18': ['ARS','BOU','BHA','BUR','CHE','CRY','EVE','HUD','LEI','LIV','MCI','MUN','NEW','SOU','STK','SWA','TOT','WAT','WBA','WHU'],
  '2018-19': ['ARS','BOU','BHA','BUR','CAR','CHE','CRY','EVE','FUL','HUD','LEI','LIV','MCI','MUN','NEW','SOU','TOT','WAT','WHU','WOL'],
};
export const CLUB_NAMES = {
  ARS: 'Arsenal', AVL: 'Aston Villa', BOU: 'Bournemouth', BRE: 'Brentford', BHA: 'Brighton',
  BUR: 'Burnley', CAR: 'Cardiff', CHE: 'Chelsea', CRY: 'Crystal Palace', EVE: 'Everton',
  FUL: 'Fulham', HUD: 'Huddersfield', HUL: 'Hull', IPS: 'Ipswich', LEE: 'Leeds', LEI: 'Leicester',
  LIV: 'Liverpool', LUT: 'Luton', MCI: 'Man City', MUN: 'Man Utd', MID: 'Middlesbrough',
  NEW: 'Newcastle', NOR: 'Norwich', NFO: "Nott'm Forest", SHU: 'Sheffield Utd', SOU: 'Southampton', STK: 'Stoke',
  SUN: 'Sunderland', SWA: 'Swansea', TOT: 'Spurs', WAT: 'Watford', WBA: 'West Brom',
  WHU: 'West Ham', WOL: 'Wolves',
  BAR: 'Barnsley', BIR: 'Birmingham', BLA: 'Blackburn', BLP: 'Blackpool', BOL: 'Bolton', BRA: 'Bradford City',
  CHA: 'Charlton', COV: 'Coventry', DER: 'Derby', OLD: 'Oldham', POR: 'Portsmouth', REA: 'Reading',
  QPR: 'QPR', SHW: 'Sheffield Wed', SWI: 'Swindon', WIG: 'Wigan', WIM: 'Wimbledon',
};
// FBref spells clubs its own way; keyed by lower-case name. An unknown club is an error, not a guess.
const FBREF_CLUBS = {
  'arsenal': 'ARS', 'aston villa': 'AVL', 'barnsley': 'BAR', 'birmingham city': 'BIR', 'blackburn': 'BLA',
  'blackburn rovers': 'BLA', 'blackpool': 'BLP', 'bolton': 'BOL', 'bolton wanderers': 'BOL', 'bournemouth': 'BOU',
  'bradford city': 'BRA', 'brighton': 'BHA', 'burnley': 'BUR', 'cardiff city': 'CAR', 'charlton athletic': 'CHA',
  'chelsea': 'CHE', 'coventry city': 'COV', 'crystal palace': 'CRY', 'derby county': 'DER', 'everton': 'EVE',
  'fulham': 'FUL', 'huddersfield town': 'HUD', 'hull city': 'HUL', 'ipswich town': 'IPS', 'leeds united': 'LEE',
  'leicester': 'LEI', 'leicester city': 'LEI', 'liverpool': 'LIV', 'manchester city': 'MCI', 'manchester utd': 'MUN',
  'manchester united': 'MUN', 'middlesbrough': 'MID', 'newcastle': 'NEW', 'newcastle utd': 'NEW', 'newcastle united': 'NEW',
  'norwich city': 'NOR', 'nottingham': 'NFO', "nott'ham forest": 'NFO', 'nottingham forest': 'NFO',
  'oldham athletic': 'OLD', 'portsmouth': 'POR', 'qpr': 'QPR', 'queens park rangers': 'QPR', 'reading': 'REA',
  'sheffield united': 'SHU', 'sheffield utd': 'SHU', 'sheffield weds': 'SHW', 'sheffield wednesday': 'SHW',
  'southampton': 'SOU', 'stoke city': 'STK', 'sunderland': 'SUN', 'swansea city': 'SWA', 'swindon': 'SWI', 'swindon town': 'SWI',
  'tottenham': 'TOT', 'tottenham hotspur': 'TOT', 'watford': 'WAT', 'west brom': 'WBA',
  'west bromwich albion': 'WBA', 'west ham': 'WHU', 'west ham united': 'WHU', 'wigan athletic': 'WIG',
  'wimbledon': 'WIM', 'wolves': 'WOL', 'wolverhampton wanderers': 'WOL',
};
const FBREF_POS = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' };
const PARTICLES = new Set(['van', 'von', 'de', 'der', 'den', 'di', 'da', 'dos', 'du', 'le', 'la', 'el', 'al', 'ten', 'ter']);
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// "Ruud van Nistelrooy" -> "van Nistelrooy"; "Teddy Sheringham" -> "Sheringham"
function displayName(full) {
  const parts = full.split(/\s+/);
  let i = parts.length - 1;
  while (i > 1 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(parts.length === 1 ? 0 : i).join(' ');
}
const POS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }; // 5 = manager, not a sticker

const int = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : 0; };

async function read(path) {
  try { return await readFile(path, 'utf8'); } catch { return null; }
}

const cards = [];
const unknownClubs = new Set();
for (const season of SEASONS) {
  const dir = join(ROOT, 'data', 'raw', season);
  const raw = parseCsvObjects(await read(join(dir, 'players_raw.csv')) ?? (() => { throw new Error(`missing ${season}; run fetch-data.mjs`); })());
  const teamsCsv = await read(join(dir, 'teams.csv'));
  const clubOf = {};
  if (teamsCsv) for (const t of parseCsvObjects(teamsCsv)) clubOf[t.id] = t.short_name;
  else LEGACY_TEAMS[season].forEach((short, i) => { clubOf[String(i + 1)] = short; });

  for (const p of raw) {
    const pos = POS[p.element_type];
    const minutes = int(p.minutes);
    if (!pos || minutes < MIN_MINUTES) continue;
    const club = clubOf[p.team];
    if (!club) throw new Error(`${season}: no club for team id ${p.team} (${p.web_name})`);
    if (!CLUB_NAMES[club]) unknownClubs.add(club);
    cards.push({
      id: `${p.code}-${season}`,
      src: 'fpl',
      pid: int(p.code),
      name: p.web_name,
      full: `${p.first_name} ${p.second_name}`.trim(),
      pos, club, season,
      goals: int(p.goals_scored),
      assists: int(p.assists),
      games: Math.round(minutes / 90),
      cleanSheets: int(p.clean_sheets),
      saves: int(p.saves),
      bonus: int(p.bonus),
      price: int(p.now_cost) / 10,
      points: int(p.total_points),
    });
  }
}
// ---- FBref seasons (before the FPL archive starts) ---------------------------------------------
const fbref = await loadFbrefSeasons(join(ROOT, 'data', 'fbref'));
const fbrefSeasons = [...fbref.keys()].filter((x) => !SEASONS.includes(x)).sort();
for (const season of fbrefSeasons) {
  let kept = 0;
  for (const row of fbref.get(season)) {
    const n = fbrefNumbers(row);
    if (n.minutes < MIN_MINUTES) continue; // cameos first: FBref leaves some of their positions blank
    const pos = FBREF_POS[row.position.split(',')[0]];
    if (!pos) throw new Error(`${season}: unknown position '${row.position}' for ${row.player} (${n.minutes} min)`);
    const club = FBREF_CLUBS[row.team.toLowerCase()];
    if (!club) throw new Error(`${season}: unknown club '${row.team}' (${row.player}); add it to FBREF_CLUBS`);
    if (!CLUB_NAMES[club]) unknownClubs.add(club);
    // one card per player per club per season: a mid-season mover has two
    const pid = `fb:${slug(row.player)}:${row.birth_year}`;
    cards.push({
      id: `${pid}-${season}-${club}`, src: 'fbref', pid,
      name: displayName(row.player), full: row.player, pos, club, season,
      goals: n.goals, assists: n.assists, games: Math.round(n.minutes / 90),
      cleanSheets: 0, saves: 0, bonus: 0, price: 0, points: 0, // FBref has none of these for the 1990s
    });
    kept++;
  }
  console.log(`FBref ${season}: ${fbref.get(season).length} rows, ${kept} cards (>= ${MIN_MINUTES} min)`);
}
const allSeasons = [...fbrefSeasons, ...SEASONS];

if (unknownClubs.size) throw new Error(`club names missing for: ${[...unknownClubs].join(', ')}`);

// Overall rating: percentile within position and within source (1-99). It is the Top Trumps
// headline number and decides pack rarity. FPL cards rank on fantasy points. FBref cards have
// none, so they rank on goal involvement and availability; a keeper has neither, so on games.
// Ranking within a source stops a 1990s striker being measured against a 2020s one.
const score = (c) => (c.src === 'fpl' ? c.points : c.pos === 'GK' ? c.games : c.goals * 2 + c.assists + c.games * 0.15);
for (const src of ['fpl', 'fbref']) {
  for (const pos of Object.values(POS)) {
    const group = cards.filter((c) => c.src === src && c.pos === pos).sort((a, b) => score(a) - score(b));
    if (group.length < 2) { group.forEach((c) => { c.rating = 50; }); continue; }
    let i = 0;
    while (i < group.length) {
      let j = i;
      while (j + 1 < group.length && score(group[j + 1]) === score(group[i])) j++;
      const pct = ((i + j) / 2) / (group.length - 1);
      for (let k = i; k <= j; k++) group[k].rating = Math.max(1, Math.min(99, Math.round(pct * 98) + 1));
      i = j + 1;
    }
  }
}

// Chip scale per category: the 99th percentile of non-zero values is worth 60 chips,
// so no category is inherently stronger than another.
const CATEGORY_KEYS = ['goals', 'assists', 'games', 'cleanSheets', 'saves', 'bonus', 'price'];
const chipScale = {};
for (const key of CATEGORY_KEYS) {
  const vals = cards.map((c) => c[key]).filter((v) => v > 0).sort((a, b) => a - b);
  const p99 = vals[Math.floor(vals.length * 0.99)];
  chipScale[key] = { p99, perUnit: Math.round((60 / p99) * 1000) / 1000 };
}

cards.sort((a, b) => a.season.localeCompare(b.season) || a.club.localeCompare(b.club) || b.rating - a.rating || a.id.localeCompare(b.id));
const out = {
  meta: {
    source: 'FPL season archive (vaastav/Fantasy-Premier-League) for 2016-17 onward; FBref Standard Stats exports before that',
    seasons: allSeasons,
    sources: { fpl: SEASONS, fbref: fbrefSeasons },
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
