// How far does each kind of player get in the 64-club cup? Equal-skill play against the medium bot, each club with its division's money.
//
//   node tools/cup-sim.mjs [--runs 200]
import { readFileSync } from 'node:fs';
import { makePool } from '../../stickers/src/engine/deck.js';
import { newTournament, playRound, roundsWon, ROUNDS } from '../src/engine/tournament.js';
import { choose } from '../src/engine/bot.js';
import { free, canAfford } from '../src/engine/draft.js';
import { makeRng } from '../../stickers/src/engine/rng.js';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? Number(process.argv[i + 1]) : dflt; };
const RUNS = arg('runs', 200);
const pool = makePool(JSON.parse(readFileSync(new URL('../../stickers/src/data/cards.json', import.meta.url), 'utf8')));
const policyFor = (kind, seed) => {
  const rng = makeRng(`${seed}|rand`);
  return (s, who) => (who === 'bot' || kind !== 'random' ? choose(s, who, who === 'bot' ? 'medium' : kind) : rng.pick(free(s).filter((b) => canAfford(s, who, b.price))).card.id);
};
for (const mode of (process.argv.includes('--five') ? ['five'] : ['five', 'eleven'])) {
  console.log(`\n${mode}: share of players who WIN at least n rounds (of ${ROUNDS.length}), ${RUNS} cups each`);
  console.log('player'.padEnd(10) + ROUNDS.map((r, i) => `R${i + 1}`.padStart(6)).join('') + '   champions');
  for (const kind of ['random', 'easy', 'medium', 'hard']) {
    const won = Array(ROUNDS.length + 1).fill(0);
    for (let i = 0; i < RUNS; i++) {
      const t = newTournament(pool, `${mode}${kind}${i}`, { mode });
      while (t.status === 'playing') playRound(t, policyFor(kind, `${mode}${kind}${i}${t.round}`));
      won[roundsWon(t)]++;
    }
    const atLeast = (n) => won.slice(n).reduce((a, b) => a + b, 0) / RUNS;
    console.log(kind.padEnd(10) + ROUNDS.map((_, i) => `${(100 * atLeast(i + 1)).toFixed(0)}%`.padStart(6)).join('') + `   ${(100 * atLeast(ROUNDS.length)).toFixed(0)}%`);
  }
}
