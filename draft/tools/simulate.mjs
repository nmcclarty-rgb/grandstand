// Balance sim: who wins when the levels play each other, and what does a good draft look like?
//
//   node tools/simulate.mjs                 # 1000 matches per pairing
//   node tools/simulate.mjs --runs 3000
import { readFileSync } from 'node:fs';
import { makePool } from '../../stickers/src/engine/deck.js';
import { newMatch, pick, showdown, RULES } from '../src/engine/draft.js';
import { choose, LEVELS } from '../src/engine/bot.js';
import * as H from '../src/engine/draft.js';
import { makeRng } from '../../stickers/src/engine/rng.js';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? Number(process.argv[i + 1]) : dflt; };
const RUNS = arg('runs', 1000);
const pool = makePool(JSON.parse(readFileSync(new URL('../../stickers/src/data/cards.json', import.meta.url), 'utf8')));

// a novice who picks at random among legal picks

// policy: 'random' or a bot level
function play(seed, youPolicy, botPolicy) {
  const s = newMatch(pool, seed, { level: botPolicy });
  const rng = makeRng(`${seed}|rand`);
  while (s.phase === 'draft') {
    const who = s.turn, policy = who === 'you' ? youPolicy : botPolicy;
    const id = policy === 'random'
      ? rng.pick(H.free(s).filter((b) => H.canAfford(s, who, b.price))).card.id
      : choose(s, who, policy);
    pick(s, who, id);
  }
  const r = showdown(s);
  return { s, r };
}

const policies = ['random', ...LEVELS];
console.log(`\n${RUNS} matches per pairing. Rows are "you", columns are the opponent. Win % (draws count half).\n`);
console.log(''.padEnd(10) + policies.map((p) => p.padStart(9)).join(''));
const stats = {};
for (const a of policies) {
  let line = a.padEnd(10);
  for (const b of policies) {
    let w = 0, d = 0;
    for (let i = 0; i < RUNS; i++) {
      const { r } = play(`${a}-${b}-${i}`, a, b);
      if (r.winner === 'you') w++; else if (r.winner === 'draw') d++;
    }
    line += `${(100 * (w + d / 2) / RUNS).toFixed(0)}%`.padStart(9);
  }
  console.log(line);
}

// what the policies end up with
console.log('\nmoney left and team power (mean chips per category) by policy, as "you" against a medium bot');
for (const a of policies) {
  let left = 0, pw = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const { s } = play(`stat-${a}-${i}`, a, 'medium');
    left += s.money.you;
    pw += s.teams.you.reduce((t, c) => t + ['goals', 'assists', 'games', 'discipline'].reduce((x, k) => x + c.rate[k] * pool.scale[k].perUnit, 0) / 4, 0);
    n++;
  }
  console.log(`${a.padEnd(8)} £${(left / n).toFixed(1)} left, team power ${(pw / n).toFixed(0)}`);
}

// hand types and series margins
{
  const types = {}; let close = 0, n = 0, ties = 0;
  for (let i = 0; i < 600; i++) {
    const { r } = play(`h-${i}`, 'hard', 'medium');
    for (const m of r.matches) { for (const side of ['you', 'bot']) types[m[side].handName] = (types[m[side].handName] ?? 0) + 1; n++; if (Math.abs(m.you.total - m.bot.total) / Math.max(m.you.total, m.bot.total) < 0.1) close++; }
    if (r.winner === 'draw') ties++;
  }
  console.log(`\nhand types in showdowns (hard vs medium): ${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / (2 * n)).toFixed(0)}%`).join(', ')}`);
  console.log(`matches decided by under 10%: ${(100 * close / n).toFixed(0)}%, drawn series: ${ties}`);
}
