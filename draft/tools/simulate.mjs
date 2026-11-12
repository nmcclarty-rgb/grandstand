// Balance sim: who wins when the levels play each other, and what does a good draft look like?
//
//   node tools/simulate.mjs                 # 1000 matches per pairing
//   node tools/simulate.mjs --runs 3000
import { readFileSync } from 'node:fs';
import { makePool } from '../../stickers/src/engine/deck.js';
import { newMatch, pick, showdown } from '../src/engine/draft.js';
import { choose, LEVELS } from '../src/engine/bot.js';
import * as H from '../src/engine/draft.js';
import { makeRng } from '../../stickers/src/engine/rng.js';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? Number(process.argv[i + 1]) : dflt; };
const RUNS = arg('runs', 1000);
const REVEAL = process.argv.includes('--reveal') ? process.argv[process.argv.indexOf('--reveal') + 1] : 'before';
const MODE = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'five';
if (process.argv.includes('--budget')) H.MODES[MODE].budget = arg('budget', H.MODES[MODE].budget);
const pool = makePool(JSON.parse(readFileSync(new URL('../../stickers/src/data/cards.json', import.meta.url), 'utf8')));

// a novice who picks at random among legal picks

// policy: 'random' or a bot level
function play(seed, youPolicy, botPolicy) {
  const s = newMatch(pool, seed, { level: botPolicy, mode: MODE, reveal: REVEAL });
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
console.log(`\n${MODE}, budget £${H.MODES[MODE].budget}, attributes ${REVEAL === 'before' ? 'called in advance' : 'rolled after the draft'}, best of three, ${RUNS} matches per pairing. Rows are "you", columns are the opponent. Win % (draws count half).\n`);
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

// what the policies end up with, and how close the showdowns are
console.log('\nmoney left by policy, as "you" against a medium bot, and how close the totals are (all matches)');
for (const a of policies) {
  let left = 0, n = 0;
  for (let i = 0; i < 300; i++) { const { s } = play(`stat-${a}-${i}`, a, 'medium'); left += s.money.you; n++; }
  console.log(`${a.padEnd(8)} £${(left / n).toFixed(1)} left`);
}
{
  // how the best of three is decided, and how close the matches are
  let twoNil = 0, close = 0, nm = 0, draws = 0, n = 0;
  for (let i = 0; i < 600; i++) {
    const { r } = play(`h-${i}`, 'hard', 'medium');
    if (r.matches[0].winner !== 'draw' && r.matches[0].winner === r.matches[1].winner) twoNil++;
    for (const m of r.matches) { const hi = Math.max(m.you.total, m.bot.total), lo = Math.min(m.you.total, m.bot.total); if (hi && (hi - lo) / hi < 0.1) close++; nm++; }
    if (r.winner === 'draw') draws++; n++;
  }
  console.log(`\nhard vs medium: ${(100 * twoNil / n).toFixed(0)}% of series are over after two matches (2-0); ${(100 * close / nm).toFixed(0)}% of matches are within 10%; ${draws} drawn series`);
}
