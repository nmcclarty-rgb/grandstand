// Download the Fantasy Premier League season archive (vaastav/Fantasy-Premier-League)
// into stickers/data/raw/<season>/. Raw files are untrusted input: they are
// only ever parsed as CSV by build-cards.mjs, never executed.
//
//   node stickers/tools/fetch-data.mjs            # all complete seasons
//   node stickers/tools/fetch-data.mjs 2023-24    # one season
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEASONS } from './seasons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data';

const FILES = ['players_raw.csv', 'teams.csv'];

async function get(url) {
  for (let attempt = 0, wait = 2000; ; attempt++, wait *= 2) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : SEASONS;
for (const season of wanted) {
  const dir = join(ROOT, 'data', 'raw', season);
  await mkdir(dir, { recursive: true });
  for (const file of FILES) {
    const text = await get(`${BASE}/${season}/${file}`);
    if (text === null) { console.log(`${season}/${file}: not published (ok)`); continue; }
    await writeFile(join(dir, file), text);
    console.log(`${season}/${file}: ${text.length.toLocaleString()} bytes`);
  }
}
