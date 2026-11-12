// Download every season's match results and write data/results.json (committed: both sources are CC0).
//
//   node tools/fetch-results.mjs
//
// Every season is checked before it is written: the right number of matches, every club with the same number of games, goals for
// equal to goals against, and the table leader equal to the champion in champions.mjs.
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAMPIONS } from './champions.mjs';
import { parseSeason, sourceUrl, tableOf, leaderOf } from './results.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = {};
for (const season of Object.keys(CHAMPIONS)) {
  const res = await fetch(sourceUrl(season));
  if (!res.ok) throw new Error(`${season}: ${res.status} from ${sourceUrl(season)}`);
  const matches = parseSeason(season, await res.text());
  const table = tableOf(matches);
  const clubs = Object.keys(table).length, expected = clubs * (clubs - 1);
  if (matches.length !== expected || ![380, 462].includes(expected)) throw new Error(`${season}: ${matches.length} matches for ${clubs} clubs`);
  if (Object.values(table).some((r) => r.P !== (clubs - 1) * 2)) throw new Error(`${season}: a club played the wrong number of games`);
  const gf = Object.values(table).reduce((s, r) => s + r.GF, 0), ga = Object.values(table).reduce((s, r) => s + r.GA, 0);
  if (gf !== ga) throw new Error(`${season}: goals for ${gf} and against ${ga} differ`);
  if (leaderOf(table) !== CHAMPIONS[season]) throw new Error(`${season}: the table leader is ${leaderOf(table)}, champions.mjs says ${CHAMPIONS[season]}`);
  out[season] = matches;
  console.log(season, matches.length, 'matches, champions', CHAMPIONS[season]);
}
await writeFile(join(ROOT, 'data', 'results.json'), `${JSON.stringify(out)}\n`);
console.log('wrote data/results.json');
