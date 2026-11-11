// How well do the two sources agree where they overlap?
//
//   node tools/crosscheck.mjs
//
// FBref exports for seasons the FPL archive also covers go in data/fbref/overlap/ (git-ignored, and not
// read by the card build). This matches each FBref player to the FPL card by name and club and reports
// agreement on goals, assists and games. It is a data-quality check, not a test, because the exports
// are not in the repo.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFbrefSeasons, fbrefNumbers } from './fbref.mjs';
import { FBREF_CLUBS } from './clubs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const { cards } = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'cards.json'), 'utf8'));
const fb = await loadFbrefSeasons(join(ROOT, 'data', 'fbref', 'overlap'));
if (!fb.size) { console.log('nothing in data/fbref/overlap/'); process.exit(0); }

const total = { matched: 0, seen: 0, goals: 0, assists: 0, games: 0 };
for (const [season, rows] of [...fb].sort()) {
  const fpl = new Map();
  for (const c of cards.filter((x) => x.season === season && x.src === 'fpl')) fpl.set(`${norm(c.full)}|${c.club}`, c);
  let matched = 0, seen = 0, goals = 0, assists = 0, games = 0;
  const diffs = [], missed = [];
  for (const r of rows) {
    const n = fbrefNumbers(r);
    if (n.minutes < 270) continue;
    seen++;
    const club = FBREF_CLUBS[r.team.toLowerCase()];
    const c = fpl.get(`${norm(r.player)}|${club}`);
    if (!c) { missed.push(`${r.player} (${r.team})`); continue; }
    matched++;
    if (c.goals === n.goals) goals++; else diffs.push([Math.abs(c.goals - n.goals), `${r.player} ${club}: FBref ${n.goals}, FPL ${c.goals}`]);
    if (c.assists === n.assists) assists++;
    if (Math.abs(c.games - Math.round(n.minutes / 90)) <= 1) games++;
  }
  Object.assign(total, { matched: total.matched + matched, seen: total.seen + seen, goals: total.goals + goals, assists: total.assists + assists, games: total.games + games });
  const pct = (a, b) => `${(100 * a / b).toFixed(1)}%`;
  console.log(`\n${season}: ${matched} of ${seen} FBref players (>= 270 min) matched an FPL card by name + club (${pct(matched, seen)})`);
  console.log(`  of those: goals equal ${pct(goals, matched)} | assists equal ${pct(assists, matched)} | games within 1: ${pct(games, matched)}`);
  console.log(`  biggest goal differences: ${diffs.sort((a, b) => b[0] - a[0]).slice(0, 5).map((d) => d[1]).join(' | ')}`);
  console.log(`  not matched, e.g.: ${missed.slice(0, 10).join(', ')}`);
}
const pct = (a, b) => `${(100 * a / b).toFixed(1)}%`;
console.log(`\nall ${fb.size} seasons: matched ${pct(total.matched, total.seen)}, goals equal ${pct(total.goals, total.matched)}, assists equal ${pct(total.assists, total.matched)}, games within 1 ${pct(total.games, total.matched)}`);
