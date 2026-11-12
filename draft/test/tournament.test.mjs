import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.mjs';
import { LADDER, LADDER_LEVEL, pathFor, budgetFor, newTournament, currentRung, finishRound, playRound, roundsWon } from '../src/engine/tournament.js';
import { newMatch, nextMatch, pick, showdown, seriesOf, free, canAfford, MODES } from '../src/engine/draft.js';
import { choose } from '../src/engine/bot.js';

const play = (t, you = 'medium') => playRound(t, (s, who) => choose(s, who, who === 'you' ? you : t.level));

test('a series can be any length, with its own budgets: one match is a whole series, and the budgets are each side\'s money', () => {
  const s = newMatch(pool, 'one', { matches: 1, budgets: { you: 10, bot: 13 } });
  assert.deepEqual(s.money, { you: 10, bot: 13 });
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'medium')); }
  showdown(s);
  assert.equal(s.phase, 'over', 'one match is the whole series');
  assert.ok(seriesOf(s).over);
  assert.throws(() => nextMatch(s), /not waiting/);
  // the default is unchanged: a best of three on the mode's budget
  const d = newMatch(pool, 'default');
  assert.equal(d.total, 3); assert.deepEqual(d.money, { you: 10, bot: 10 });
  assert.throws(() => newMatch(pool, 'poor', { budgets: { you: 4, bot: 10 } }), /budget must cover/);
  // a bigger budget is really spendable: a £13 side can buy more than a £10 side
  const rich = newMatch(pool, 'rich', { first: 'bot', budgets: { you: 10, bot: 13 } });
  assert.ok(canAfford(rich, 'bot', 5) && canAfford(rich, 'bot', 9) && !canAfford(rich, 'you', 7));
});

test('the ladder: seven rounds, the budget climbing from 0.6 to 1.2 of yours, and the clubs get bigger', () => {
  assert.equal(LADDER.length, 7);
  assert.deepEqual(LADDER.map((r) => r.mult), [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2]);
  assert.equal(LADDER.at(-1).name, 'Final');
  assert.equal(LADDER_LEVEL, 'medium', 'the bot is always the medium bot: the difficulty is its money');
  const all = LADDER.flatMap((r) => r.clubs);
  assert.equal(new Set(all).size, all.length, 'a club is on one rung only');
  for (const c of all) assert.ok(pool.clubs[c], `${c} is a club in the data`);
  for (const mode of ['five', 'eleven']) {
    const b = MODES[mode].budget;
    assert.deepEqual(LADDER.map((r) => budgetFor(mode, r.mult)), LADDER.map((r) => Math.round(b * r.mult)));
    for (const r of LADDER) assert.ok(budgetFor(mode, r.mult) >= MODES[mode].rounds, `${mode} ${r.name}: the budget covers the minimum price`);
  }
  assert.deepEqual(LADDER.map((r) => budgetFor('five', r.mult)), [6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(LADDER.map((r) => budgetFor('eleven', r.mult)), [18, 21, 24, 27, 30, 33, 36]);
});

test('the path is one club per rung from the seed, the same for a seed, different across seeds', () => {
  const p = pathFor('seed1', 'five');
  assert.equal(p.length, 7);
  p.forEach((r, i) => { assert.ok(LADDER[i].clubs.includes(r.club)); assert.equal(r.budget, budgetFor('five', LADDER[i].mult)); assert.equal(r.mult, LADDER[i].mult); });
  assert.deepEqual(pathFor('seed1', 'five').map((r) => r.club), p.map((r) => r.club));
  const finals = new Set(); for (let i = 0; i < 60; i++) finals.add(pathFor(`s${i}`, 'five')[6].club);
  assert.deepEqual([...finals].sort(), ['LIV', 'MCI', 'MUN'], 'every possible final opponent comes up');
});

test('a round is a single fresh draft: your budget against the club\'s, the medium bot', () => {
  const t = newTournament(pool, 'r1', { mode: 'five' });
  assert.equal(t.status, 'playing'); assert.equal(t.round, 0);
  assert.equal(t.tie.total, 1);
  assert.equal(t.tie.level, 'medium');
  assert.deepEqual(t.tie.money, { you: 10, bot: 6 }, 'round 1: the club has 60% of your money');
  const e = newTournament(pool, 'r1', { mode: 'eleven' });
  assert.deepEqual(e.tie.money, { you: 30, bot: 18 });
  assert.equal(currentRung(t).name, 'Round 1');
});

test('lose and you are out; win and you go through to a bigger club; win the Final and you are champions', () => {
  let outs = 0, champions = 0, through = 0;
  for (let i = 0; i < 80; i++) {
    const t = newTournament(pool, `k${i}`);
    for (let guard = 0; guard < 8 && t.status === 'playing'; guard++) {
      const before = t.round;
      const r = play(t, 'hard');   // a strong player, so we see rounds won as well as lost
      assert.ok(['you', 'bot'].includes(r.winner), 'a knockout always has a winner');
      if (r.winner === 'you') { through++; if (t.status === 'playing') { assert.equal(t.round, before + 1); assert.deepEqual(t.tie.money, { you: 10, bot: t.path[t.round].budget }); } }
    }
    assert.ok(t.status === 'out' || t.status === 'champions');
    assert.equal(t.history.length, t.status === 'champions' ? 7 : roundsWon(t) + 1);
    if (t.status === 'out') { outs++; assert.equal(t.history.at(-1).winner, 'bot'); } else { champions++; assert.equal(roundsWon(t), 7); }
  }
  assert.ok(outs > 0 && through > 80, `${outs} knocked out, ${through} rounds won`);
});

test('the history records each round: the club, its budget, the attribute and both totals', () => {
  const t = newTournament(pool, 'hist');
  play(t, 'hard');
  const h = t.history[0];
  assert.equal(h.name, 'Round 1'); assert.equal(h.club, t.path[0].club); assert.equal(h.budget, 6);
  assert.ok(h.category && Number.isFinite(h.you) && Number.isFinite(h.bot));
  assert.equal(h.winner, h.you > h.bot ? 'you' : h.bot > h.you ? 'bot' : h.winner);
});

test('a drawn round is decided: more appearances goes through, then a coin', () => {
  const t = newTournament(pool, 'draw');
  const s = t.tie;
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'medium')); }
  showdown(s);
  // force a level round, with the bot's team having made more appearances
  s.results[0].you.total = s.results[0].bot.total; s.results[0].winner = 'draw';
  s.teams.bot.forEach((c, i) => { c.games = 1000 + i; });
  s.teams.you.forEach((c) => { c.games = 10; });
  const r = finishRound(t);
  assert.equal(r.winner, 'bot'); assert.equal(r.decidedBy, 'more appearances');
  // level on appearances too: a coin, the same for a seed
  const t2 = newTournament(pool, 'draw'), s2 = t2.tie;
  while (s2.phase === 'draft') { const who = s2.turn; pick(s2, who, choose(s2, who, 'medium')); }
  showdown(s2);
  s2.results[0].you.total = s2.results[0].bot.total; s2.results[0].winner = 'draw';
  s2.teams.bot.forEach((c) => { c.games = 50; }); s2.teams.you.forEach((c) => { c.games = 50; });
  const r2 = finishRound(t2);
  assert.equal(r2.decidedBy, 'a coin');
  assert.throws(() => finishRound(newTournament(pool, 'early')), /not finished/);
});

test('the ladder is a real climb: a medium-skill player goes through the early rounds and rarely wins the Final', () => {
  const reached = [0, 0, 0, 0, 0, 0, 0, 0]; const N = 150;
  for (let i = 0; i < N; i++) {
    const t = newTournament(pool, `climb${i}`);
    while (t.status === 'playing') play(t, 'medium');
    reached[roundsWon(t)]++;
  }
  const atLeast = (n) => reached.slice(n).reduce((a, b) => a + b, 0) / N;
  assert.ok(atLeast(1) > 0.5, `most players win round 1 (${atLeast(1)})`);
  assert.ok(atLeast(1) > atLeast(3) && atLeast(3) > atLeast(5), 'each stage is rarer than the one before');
  assert.ok(atLeast(7) < 0.25, `the Final is a rare win (${atLeast(7)})`);
});
