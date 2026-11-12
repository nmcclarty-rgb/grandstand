// The KNOCKOUT CUP: 64 clubs from the English pyramid (pyramid.js), YOU a League Two club in the first slot of the bracket. Six rounds: Round of 64, Round of 32,
// Round of 16, Quarter-final, Semi-final, Final. Lose a round and you are out; win the Final and you are champions.
//
// The bot is always the medium bot. What differs between clubs is MONEY: a club's budget is its division's share of yours, so a Premier League club has more to
// spend than a League Two one (pyramid.js). Every tie is one fresh draft for one attribute (draft.js). YOUR ties are played by you. Every OTHER tie is played by
// the engine, medium bot against medium bot with each club's money, so the bracket fills in with believable results.
//
// WHAT YOU SEE: you do not know who you play until the round starts, and you do not see anything about the clubs on the road ahead either. The bracket fills in
// behind you: when a round starts, the club you are about to play is revealed together with everything that led to it (the clubs it had to get past); the rest of
// the field stays hidden until you reach it. `bracketView(t)` is the only thing the page should draw from: it holds nothing about a slot or a result the player is
// not meant to know yet (the tests check that). The draw is seeded so that the weakest clubs are drawn near you and the strongest in the far half, so the road gets
// harder (with some noise: a big club can be drawn early).
//
// A tie that is level on the attribute goes to the side whose team made more appearances, then to a coin: a knockout needs a winner.
import { makeRng } from '../../../stickers/src/engine/rng.js';
import { newMatch, pick, showdown, MODES } from './draft.js';
import { choose } from './bot.js';
import { opponents, YOUR_TIER, YOUR_MULT, TIERS, kitFor, codeFor } from './pyramid.js';

export const ROUNDS = ['Round of 64', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
export const BOT_LEVEL = 'medium';
export const SIZE = 64;
// how far the draw can wander from "strongest far away": a club's draw position is its strength rank plus up to this many places either way
export const DRAW_NOISE = 14;

export const budgetFor = (mode, mult) => Math.round(MODES[mode].budget * mult);

// your team, from the name you gave it
export function youTeam(mode, name = 'Your Club') {
  const clean = String(name).trim().slice(0, 24) || 'Your Club';
  return { code: codeFor(clean), name: clean, colours: kitFor(clean), pattern: 'solid', tier: YOUR_TIER, tierName: TIERS[YOUR_TIER].name, mult: YOUR_MULT, budget: budgetFor(mode, YOUR_MULT), you: true };
}

// the draw: 64 slots, slot 0 is you
export function drawFor(seed, mode, name) {
  const rng = makeRng(`${seed}|draw`);
  const clubs = opponents().map((c) => ({ ...c, budget: budgetFor(mode, c.mult) }));
  const ranked = clubs.map((c, i) => ({ c, key: i + 0 }));
  // strength rank, weakest first (ties broken by the list order, which is strongest-first within a tier)
  ranked.sort((x, y) => x.c.mult - y.c.mult || y.key - x.key);
  const order = ranked.map((r, rank) => ({ c: r.c, at: rank + (rng.next() + rng.next() - 1) * DRAW_NOISE }));
  order.sort((x, y) => x.at - y.at);
  return [youTeam(mode, name), ...order.map((o) => o.c)];
}

// opts.mode 'five' | 'eleven'; opts.name your club's name; opts.level overrides the bot (tests); opts.teams overrides the draw (tests)
export function newTournament(pool, seed = Date.now(), opts = {}) {
  const mode = opts.mode ?? 'five';
  if (!MODES[mode]) throw new Error(`unknown mode '${mode}'`);
  const teams = opts.teams ?? drawFor(seed, mode, opts.name);
  if (teams.length !== SIZE) throw new Error(`the cup needs ${SIZE} teams`);
  const t = {
    seed: String(seed), mode, level: opts.level ?? BOT_LEVEL, teams,
    bracket: [teams.map((_, i) => i)],   // bracket[r][slot] = a team index; a round is filled in once the round before it is played
    ties: [],                            // ties[r][i] = { a, b, winner, category, aTotal, bTotal, decidedBy }
    round: 0, status: 'playing', history: [], tie: null,
    known: new Set(),                    // slots the player may see: 'round:slot'
    shown: new Set(),                    // tie results the player may see: 'round:tie'
  };
  t.known.add('0:0');   // yourself: nothing else is known until the round starts
  Object.defineProperty(t, 'pool', { value: pool, enumerable: false });
  startRound(t);
  return t;
}

export const base = (t) => MODES[t.mode].budget;
export const youTie = (t) => ({ a: t.bracket[t.round][0], b: t.bracket[t.round][1] });
export const me = (t) => t.teams[0];
export const opponent = (t) => t.teams[t.bracket[t.round][1]];
export const roundName = (t) => ROUNDS[t.round];

// begin the current round's draft for your tie: one match, your budget against the club's
export function startRound(t) {
  const opp = opponent(t);
  t.tie = newMatch(t.pool, `${t.seed}|r${t.round}`, { mode: t.mode, level: t.level, matches: 1, budgets: { you: me(t).budget, bot: opp.budget } });
  return t.tie;
}

// The page calls this when a round starts: your opponent is no longer a secret, and neither is the part of the bracket that produced him. That part is the
// block of round-0 slots [2^R, 2^(R+1)) and everything above it: in round k it is the slots [2^(R-k), 2^(R-k+1)) and the ties [2^(R-k-1), 2^(R-k)).
export function revealOpponent(t) {
  const R = t.round;
  for (let k = 0; k <= R; k++) {
    for (let i = 2 ** (R - k); i < 2 ** (R - k + 1); i++) t.known.add(`${k}:${i}`);
    if (k < R) for (let i = 2 ** (R - k - 1); i < 2 ** (R - k); i++) t.shown.add(`${k}:${i}`);
  }
}

// settle a tie between two teams played by the engine: the medium bot against itself, with each club's money
function simulate(t, r, i, a, b) {
  const seed = `${t.seed}|sim|${r}|${i}`;
  const s = newMatch(t.pool, seed, { mode: t.mode, level: BOT_LEVEL, matches: 1, budgets: { you: t.teams[a].budget, bot: t.teams[b].budget } });
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, BOT_LEVEL)); }
  showdown(s);
  return decide(s, seed, a, b);
}

// the winner of a finished tie (a is the 'you' side, b the 'bot' side): by the count, then appearances, then a coin
function decide(s, seed, a, b) {
  const r = s.results[0];
  let side = r.winner, decidedBy = 'the count';
  if (side === 'draw') {
    const apps = (who) => s.teams[who].reduce((sum, c) => sum + c.games, 0);
    const x = apps('you'), y = apps('bot');
    if (x !== y) { side = x > y ? 'you' : 'bot'; decidedBy = 'more appearances'; }
    else { side = makeRng(`${seed}|coin`).int(2) ? 'you' : 'bot'; decidedBy = 'a coin'; }
  }
  return { a, b, winner: side === 'you' ? a : b, category: r.category, aTotal: r.you.total, bTotal: r.bot.total, decidedBy };
}

// play every tie of round r that you are not in. (Your tie, ties[r][0], is already decided.)
function settleOthers(t, r) {
  const n = t.bracket[r].length / 2;
  for (let i = 1; i < n; i++) t.ties[r][i] = simulate(t, r, i, t.bracket[r][2 * i], t.bracket[r][2 * i + 1]);
}
const advance = (t, r) => { t.bracket[r + 1] = t.ties[r].map((x) => x.winner); };

// After your tie's showdown: record it, play the rest of the round, and move on (or you are out, or champions).
export function finishRound(t) {
  if (t.tie.phase !== 'over') throw new Error('the round is not finished');
  const r = t.round;
  const { a, b } = youTie(t);
  t.ties[r] = [decide(t.tie, `${t.seed}|r${r}`, a, b)];
  const mine = t.ties[r][0];
  settleOthers(t, r);
  const club = t.teams[b];
  const winner = mine.winner === a ? 'you' : 'bot';
  t.history.push({ round: r, name: ROUNDS[r], club: club.code, clubName: club.name, tierName: club.tierName, budget: club.budget, category: mine.category, you: mine.aTotal, bot: mine.bTotal, winner, decidedBy: mine.decidedBy });
  t.shown.add(`${r}:0`);   // your own result; the rest of the round stays hidden until the road leads there
  if (winner === 'bot') { t.status = 'out'; playOut(t, r); }
  else if (r === ROUNDS.length - 1) { t.status = 'champions'; advance(t, r); revealAll(t); }
  else { advance(t, r); t.known.add(`${r + 1}:0`); t.round = r + 1; startRound(t); }
  return { winner, decidedBy: mine.decidedBy, status: t.status };
}

// you are out: the engine plays the rest of the tournament, and everything becomes visible
function playOut(t, r) {
  advance(t, r);
  for (let k = r + 1; k < ROUNDS.length; k++) {
    t.ties[k] = [];
    for (let i = 0; i < t.bracket[k].length / 2; i++) t.ties[k][i] = simulate(t, k, i, t.bracket[k][2 * i], t.bracket[k][2 * i + 1]);
    advance(t, k);
  }
  revealAll(t);
}
function revealAll(t) {
  for (let r = 0; r < t.bracket.length; r++) for (let i = 0; i < t.bracket[r].length; i++) t.known.add(`${r}:${i}`);
  for (let r = 0; r < t.ties.length; r++) for (let i = 0; i < (t.ties[r]?.length ?? 0); i++) t.shown.add(`${r}:${i}`);
}

export const roundsWon = (t) => t.history.filter((h) => h.winner === 'you').length;
export const champion = (t) => (t.status === 'playing' ? null : t.teams[t.bracket[ROUNDS.length][0]]);

// Everything the page may draw, and nothing it may not.
//   rounds[r][i]: the slot i of round r (64, 32, 16, 8, 4, 2, then the champion): { known: false } or { known, you, code, name, tier, budget, colours, pattern }
//   ties[r][i]:   the result of tie i of round r if the player may see it, else null: { winner: 'a'|'b', category, a, b, decidedBy }
export function bracketView(t) {
  const slot = (r, i) => {
    const idx = t.bracket[r]?.[i];
    if (idx === undefined || !t.known.has(`${r}:${i}`)) return { known: false };
    const x = t.teams[idx];
    return { known: true, you: idx === 0, code: x.code, name: x.name, tier: x.tier, tierName: x.tierName, budget: x.budget, colours: x.colours, pattern: x.pattern };
  };
  const rounds = [];
  for (let r = 0; r <= ROUNDS.length; r++) rounds.push(Array.from({ length: SIZE >> r }, (_, i) => slot(r, i)));
  const ties = ROUNDS.map((_, r) => Array.from({ length: SIZE >> (r + 1) }, (_, i) => {
    const x = t.ties[r]?.[i];
    if (!x || !t.shown.has(`${r}:${i}`)) return null;
    return { winner: x.winner === x.a ? 'a' : 'b', category: x.category, a: x.aTotal, b: x.bTotal, decidedBy: x.decidedBy };
  }));
  return { rounds, ties, round: t.round, status: t.status, names: ROUNDS };
}

// play your round with a policy and finish it (for the simulator and tests): policy(state, who) -> board id
export function playRound(t, policy) {
  const s = t.tie;
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, policy(s, who)); }
  showdown(s);
  return finishRound(t);
}
