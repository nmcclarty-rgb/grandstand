// Is money a difficulty dial? Equal-skill bots with unequal budgets, and a weaker player given more money than a stronger bot.
//
//   node tools/budget-sim.mjs
import { readFileSync } from 'node:fs';
import { makePool } from '../../stickers/src/engine/deck.js';
import { newMatch, nextMatch, pick, showdown, seriesOf, MODES } from '../src/engine/draft.js';
import { choose } from '../src/engine/bot.js';
const pool = makePool(JSON.parse(readFileSync(new URL('../../stickers/src/data/cards.json', import.meta.url), 'utf8')));
// same skill on both sides, but the bot gets `mult` times the money. How often does YOU win a series?
function series(seed, mode, you, bot, mult, youMult = 1) {
  const s = newMatch(pool, seed, { mode, level: bot });
  const base = MODES[mode].budget;
  const give = () => { s.money.you = Math.round(base * youMult); s.money.bot = Math.round(base * mult); };
  give();
  for (;;) {
    while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, who === 'you' ? you : bot)); }
    showdown(s);
    if (s.phase === 'over') return seriesOf(s);
    nextMatch(s); give();
  }
}
const N = 400;
for (const mode of ['five', 'eleven']) {
  const base = MODES[mode].budget;
  console.log(`\n${mode}: base £${base}. Win % of a series for YOU when both play 'medium' and the BOT has x times your money (draws count half)`);
  for (const mult of [1, 1.25, 1.5, 2, 3]) {
    let w = 0;
    for (let i = 0; i < N; i++) { const r = series(`b${mode}${mult}${i}`, mode, 'medium', 'medium', mult); w += r.winner === 'you' ? 1 : r.winner === 'draw' ? 0.5 : 0; }
    console.log(`  bot x${mult} (£${Math.round(base * mult)}): ${(100 * w / N).toFixed(0)}%`);
  }
  console.log(`  ...and when YOU are 'easy' (price-only) against a 'hard' bot, the bot's money needed to even it up:`);
  for (const [you, bot, youMult] of [['easy', 'hard', 1], ['easy', 'hard', 1.5], ['easy', 'hard', 2], ['medium', 'hard', 1], ['medium', 'hard', 1.5]]) {
    let w = 0;
    for (let i = 0; i < N; i++) { const r = series(`h${mode}${you}${youMult}${i}`, mode, you, bot, 1, youMult); w += r.winner === 'you' ? 1 : r.winner === 'draw' ? 0.5 : 0; }
    console.log(`  you '${you}' with x${youMult} the money against a 'hard' bot on x1: ${(100 * w / N).toFixed(0)}%`);
  }
}
