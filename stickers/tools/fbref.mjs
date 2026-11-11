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
  const body = html.split('</thead>')[1];
  if (!body) throw new Error('no <thead>: is this an FBref table export?');
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

// -> Map season -> rows (merged, de-duplicated)
export async function loadFbrefSeasons(dir) {
  let files;
  try { files = await readdir(dir); } catch { return new Map(); }
  const bySeason = new Map();
  for (const f of files.sort()) {
    const m = /^(\d{4}-\d{2}).*\.xls$/i.exec(f);
    if (!m) continue;
    const rows = parseFbrefTable(await readFile(join(dir, f), 'utf8'));
    if (!bySeason.has(m[1])) bySeason.set(m[1], new Map());
    const seen = bySeason.get(m[1]);
    for (const row of rows) {
      const key = `${row.player}|${row.team}|${row.birth_year}`;
      const { ranker, ...rest } = row;
      const prev = seen.get(key);
      if (prev && JSON.stringify(prev) !== JSON.stringify(rest)) throw new Error(`${f}: row for ${key} disagrees with an earlier file`);
      seen.set(key, rest);
    }
  }
  return new Map([...bySeason].map(([season, rows]) => [season, [...rows.values()]]));
}
