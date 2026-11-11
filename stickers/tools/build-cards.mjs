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
};
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
if (unknownClubs.size) throw new Error(`club names missing for: ${[...unknownClubs].join(', ')}`);

// Overall rating: percentile of season points among players in the same position
// (all seasons pooled), 1-99. This is the Top Trumps headline number.
for (const pos of Object.values(POS)) {
  const group = cards.filter((c) => c.pos === pos).sort((a, b) => a.points - b.points);
  let i = 0;
  while (i < group.length) {
    let j = i;
    while (j + 1 < group.length && group[j + 1].points === group[i].points) j++;
    const pct = ((i + j) / 2) / (group.length - 1);
    for (let k = i; k <= j; k++) group[k].rating = Math.max(1, Math.min(99, Math.round(pct * 98) + 1));
    i = j + 1;
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

cards.sort((a, b) => a.season.localeCompare(b.season) || a.club.localeCompare(b.club) || b.points - a.points);
const out = {
  meta: {
    source: 'vaastav/Fantasy-Premier-League (Fantasy Premier League season archive)',
    seasons: SEASONS,
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
