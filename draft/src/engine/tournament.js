// The KNOCKOUT LADDER: a tournament of single matches against clubs whose budgets climb. Lose and you are out; win the Final and you are champions.
//
// The bot is always the same bot (medium: it knows the stats through a fog). What changes up the ladder is its MONEY: a bigger club has a bigger budget,
// so beating Man City is an upset and beating Luton is not. Budget is the difficulty dial because it is smooth: the simulator found that 25% more money
// is enough to turn a coin flip into a heavy loss for a bot of equal skill. You always have the mode's base budget (£10, or £30 in 11-a-side).
//
// A round is one fresh draft for one attribute (see draft.js). If a round is level on the attribute, the side whose team has made more appearances goes
// through, and if that is level too, the seed flips a coin: a knockout needs a winner.
import { makeRng } from '../../../stickers/src/engine/rng.js';
import { newMatch, pick, showdown, seriesOf, MODES } from './draft.js';

// The path, round by round: the budget as a multiple of yours, and the clubs it can be (one is picked from the seed).
export const LADDER = [
  { name: 'Round 1',       mult: 0.6, clubs: ['LUT', 'SHU', 'NOR', 'WAT', 'HUD', 'CAR'] },
  { name: 'Round 2',       mult: 0.7, clubs: ['BOU', 'BRE', 'FUL', 'CRY', 'IPS', 'STK'] },
  { name: 'Round 3',       mult: 0.8, clubs: ['WOL', 'SOU', 'BHA', 'LEE', 'SUN', 'WBA'] },
  { name: 'Round 4',       mult: 0.9, clubs: ['EVE', 'WHU', 'LEI', 'AVL'] },
  { name: 'Quarter-final', mult: 1.0, clubs: ['NEW', 'TOT'] },
  { name: 'Semi-final',    mult: 1.1, clubs: ['ARS', 'CHE'] },
  { name: 'Final',         mult: 1.2, clubs: ['MCI', 'LIV', 'MUN'] },
];
// the bot is the medium bot, always
export const LADDER_LEVEL = 'medium';

export const budgetFor = (mode, mult) => Math.round(MODES[mode].budget * mult);

// the path: one club per round (from the seed), and their budgets
export function pathFor(seed, mode) {
  const rng = makeRng(`${seed}|path`);
  return LADDER.map((r) => ({ name: r.name, mult: r.mult, club: rng.pick(r.clubs), budget: budgetFor(mode, r.mult) }));
}

// opts.mode 'five' | 'eleven'; opts.level overrides the bot (tests); opts.path overrides the path (tests)
export function newTournament(pool, seed = Date.now(), opts = {}) {
  const mode = opts.mode ?? 'five';
  if (!MODES[mode]) throw new Error(`unknown mode '${mode}'`);
  const t = { seed: String(seed), mode, level: opts.level ?? LADDER_LEVEL, path: opts.path ?? pathFor(seed, mode), round: 0, status: 'playing', history: [], tie: null };
  Object.defineProperty(t, 'pool', { value: pool, enumerable: false });
  startRound(t);
  return t;
}

export const currentRung = (t) => t.path[t.round];
export const base = (t) => MODES[t.mode].budget;

// begin the current round's draft: one match, your budget against the club's
export function startRound(t) {
  const rung = currentRung(t);
  t.tie = newMatch(t.pool, `${t.seed}|r${t.round}`, { mode: t.mode, level: t.level, matches: 1, budgets: { you: base(t), bot: rung.budget } });
  return t.tie;
}

// After the round's showdown (the tie is over): who goes through, and on to the next round or the end.
export function finishRound(t) {
  if (t.tie.phase !== 'over') throw new Error('the round is not finished');
  const rung = currentRung(t);
  const ser = seriesOf(t.tie);
  let winner = ser.winner, decidedBy = ser.decidedBy;
  if (winner === 'draw') {
    // level on the attribute: more appearances goes through, then a coin
    const apps = (who) => t.tie.teams[who].reduce((sum, c) => sum + c.games, 0);
    const ay = apps('you'), ab = apps('bot');
    if (ay !== ab) { winner = ay > ab ? 'you' : 'bot'; decidedBy = 'more appearances'; }
    else { winner = makeRng(`${t.seed}|coin|${t.round}`).int(2) ? 'you' : 'bot'; decidedBy = 'a coin'; }
  }
  const result = t.tie.results[0];
  t.history.push({ round: t.round, name: rung.name, club: rung.club, budget: rung.budget, category: result.category, you: result.you.total, bot: result.bot.total, winner, decidedBy });
  if (winner === 'bot') t.status = 'out';
  else if (t.round === t.path.length - 1) t.status = 'champions';
  else { t.round++; startRound(t); }
  return { winner, decidedBy, status: t.status };
}

// how far you got: rounds won
export const roundsWon = (t) => t.history.filter((h) => h.winner === 'you').length;

// play the match of the current round with a policy and finish it (for the simulator and tests): policy(state, who) -> board id
export function playRound(t, policy) {
  const s = t.tie;
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, policy(s, who)); }
  showdown(s);
  return finishRound(t);
}
