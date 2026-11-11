// Read FBref "Standard Stats" player tables saved with Share & Export -> Excel.
// The ".xls" is really an HTML table, so this is a small tag-aware reader, not a spreadsheet parser.
//
// Files live in stickers/data/fbref/ and are named by season: 1992-93.xls, 1993-94.xls.
// A season may be split over several files (FBref truncates an export at 499 rows, so
// 1992-93 is an A-Z export plus a Z-A one): rows are merged and de-duplicated, and rows
// that appear in two files must agree exactly.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const decode = (s) => s
  .replace(/<[^>]*>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .trim();

export function parseFbrefTable(html) {
  const [head, body] = html.split('</thead>');
  if (!body) throw new Error('no <thead>: is this an FBref table export?');
  // FBref has several tables per season (Standard Stats, Playing Time, Shooting...). Only Standard
  // Stats has goals and assists; importing another would silently produce a season of zeros.
  const columns = new Set([...head.matchAll(/<th[^>]*data-stat="([^"]+)"/g)].map((m) => m[1]));
  const missing = ['player', 'team', 'position', 'minutes', 'goals', 'assists'].filter((c) => !columns.has(c));
  if (missing.length) throw new Error(`not a Standard Stats table (no ${missing.join(', ')} column); re-export the "Standard Stats" table`);
  const rows = [];
  for (const [, tr] of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = {};
    for (const [, key, cell] of tr.matchAll(/<t[dh][^>]*data-stat="([^"]*)"[^>]*>([\s\S]*?)<\/t[dh]>/g)) row[key] = decode(cell);
    if (row.player && /^\d+$/.test(row.ranker ?? '')) rows.push(row); // skips repeated header rows
  }
  return rows;
}

const num = (v) => Number.parseInt(String(v ?? '').replace(/,/g, ''), 10) || 0;
export const fbrefNumbers = (row) => ({
  games: num(row.games), starts: num(row.games_starts), minutes: num(row.minutes),
  goals: num(row.goals), assists: num(row.assists), yellow: num(row.cards_yellow), red: num(row.cards_red),
});

// FBref cuts an export at this many rows, whatever the season's size.
export const EXPORT_CAP = 499;

// Merge the exports for one season. files: [{ name, rows }]. Rows that appear in two files must agree.
// A file at the cap is truncated, so the season is only complete if truncated files overlap each other:
// with nothing shared, there could be a gap between "where the A-Z one stopped" and "where the Z-A one stopped"
// (or, with a single file, a whole end of the alphabet missing).
export function mergeSeasonFiles(season, files) {
  const merged = new Map();
  for (const { name, rows } of files) {
    for (const row of rows) {
      const key = `${row.player}|${row.team}|${row.birth_year}`;
      const { ranker, ...rest } = row;
      const prev = merged.get(key);
      if (prev && JSON.stringify(prev) !== JSON.stringify(rest)) throw new Error(`${season} ${name}: row for ${key} disagrees with an earlier file`);
      merged.set(key, rest);
    }
  }
  const truncated = files.filter((f) => f.rows.length >= EXPORT_CAP);
  if (truncated.length === 1 && files.length === 1) {
    throw new Error(`${season}: only one export (${truncated[0].name}) and it is cut off at ${EXPORT_CAP} rows. Add the reverse-sorted export (click the Player header, export again)`);
  }
  if (truncated.length >= 2) {
    const keys = truncated.map((f) => new Set(f.rows.map((r) => `${r.player}|${r.team}|${r.birth_year}`)));
    const shared = [...keys[0]].filter((k) => keys[1].has(k)).length;
    if (shared === 0) throw new Error(`${season}: the two truncated exports share no rows, so part of the season is missing`);
  }
  return [...merged.values()];
}

// -> Map season -> rows (merged, de-duplicated, checked for coverage)
export async function loadFbrefSeasons(dir) {
  let names;
  try { names = await readdir(dir); } catch { return new Map(); }
  const bySeason = new Map();
  for (const f of names.sort()) {
    const m = /^(\d{4}-\d{2}).*\.xls$/i.exec(f);
    if (!m) continue;
    if (!bySeason.has(m[1])) bySeason.set(m[1], []);
    bySeason.get(m[1]).push({ name: f, rows: parseFbrefTable(await readFile(join(dir, f), 'utf8')) });
  }
  return new Map([...bySeason].map(([season, files]) => [season, mergeSeasonFiles(season, files)]));
}
