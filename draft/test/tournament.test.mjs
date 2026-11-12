import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './helpers.mjs';
import { ROUNDS, SIZE, BOT_LEVEL, budgetFor, drawFor, youTeam, newTournament, opponent, me, finishRound, playRound, roundsWon, revealOpponent, bracketView, champion } from '../src/engine/tournament.js';
import { opponents, FIELD, TIERS, YOUR_TIER, kitFor, codeFor } from '../src/engine/pyramid.js';
import { newMatch, nextMatch, pick, showdown, seriesOf, canAfford, MODES } from '../src/engine/draft.js';
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
  const d = newMatch(pool, 'default');
  assert.equal(d.total, 3); assert.deepEqual(d.money, { you: 10, bot: 10 });
  assert.throws(() => newMatch(pool, 'poor', { budgets: { you: 4, bot: 10 } }), /budget must cover/);
  const rich = newMatch(pool, 'rich', { first: 'bot', budgets: { you: 10, bot: 13 } });
  assert.ok(canAfford(rich, 'bot', 5) && canAfford(rich, 'bot', 9) && !canAfford(rich, 'you', 7));
});

test('the pyramid: 63 clubs, 16 from each of the top three divisions and 15 from League Two, all different; you are the sixteenth League Two club', () => {
  const o = opponents();
  assert.equal(o.length, 63);
  assert.deepEqual(FIELD.map((t) => t.length), [16, 16, 16, 15]);
  assert.equal(new Set(o.map((c) => c.code)).size, 63, 'every club has its own code');
  assert.equal(new Set(o.map((c) => c.name)).size, 63);
  assert.equal(TIERS[YOUR_TIER].name, 'League Two');
  // a bigger division has more money: every division's weakest club is no richer than the one above's strongest, and within a division the list runs strongest first
  for (let t = 0; t < 3; t++) assert.ok(Math.max(...o.filter((c) => c.tier === t + 1).map((c) => c.mult)) <= Math.max(...o.filter((c) => c.tier === t).map((c) => c.mult)));
  for (let t = 0; t < 4; t++) { const m = o.filter((c) => c.tier === t).map((c) => c.mult); assert.deepEqual([...m].sort((a, b) => b - a), m); }
  const prem = o.filter((c) => c.tier === 0), two = o.filter((c) => c.tier === 3);
  assert.ok(Math.min(...prem.map((c) => c.mult)) > Math.max(...two.map((c) => c.mult)), 'every Premier League club is richer than every League Two club');
  for (const c of o) assert.match(c.colours[0], /^#[0-9A-Fa-f]{6}$/);
  assert.match(kitFor('Grandstand Town')[0], /^#[0-9a-f]{6}$/);
  assert.equal(codeFor('Grandstand Town'), 'GRA'); assert.equal(codeFor('  '), 'YOU');
});

test('the draw: you in slot 0, 63 different clubs, the same for a seed, harder clubs further from you', () => {
  const d = drawFor('seed1', 'five', 'Sunday Rovers');
  assert.equal(d.length, 64);
  assert.equal(d[0].name, 'Sunday Rovers'); assert.equal(d[0].you, true); assert.equal(d[0].tierName, 'League Two');
  assert.equal(new Set(d.map((x) => x.name)).size, 64);
  assert.equal(new Set(d.slice(1).map((x) => x.code)).size, 63, 'the opponents have a code each (yours is only the letters on your badge)');
  assert.deepEqual(drawFor('seed1', 'five', 'Sunday Rovers').map((x) => x.code), d.map((x) => x.code));
  assert.notDeepEqual(drawFor('seed2', 'five', 'Sunday Rovers').map((x) => x.code), d.map((x) => x.code));
  // on average, the clubs in each group of slots (the pool for each round's opponent) get richer
  const avg = (seedN, a, b) => { let sum = 0, n = 0; for (let i = 0; i < seedN; i++) { const x = drawFor(`g${i}`, 'five').slice(a, b); sum += x.reduce((s, c) => s + c.mult, 0) / x.length; n++; } return sum / n; };
  const groups = [[1, 2], [2, 4], [4, 8], [8, 16], [16, 32], [32, 64]].map(([a, b]) => avg(40, a, b));
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i] > groups[i - 1], `group ${i} is richer than group ${i - 1}: ${groups.map((g) => g.toFixed(2))}`);
  // budgets are each side's share of the mode's budget
  for (const mode of ['five', 'eleven']) for (const c of drawFor('b', mode)) assert.equal(c.budget, budgetFor(mode, c.mult));
  assert.equal(youTeam('five', 'x').budget, 10); assert.equal(youTeam('eleven', 'x').budget, 30);
  assert.equal(youTeam('five', '   ').name, 'Your Club'); assert.equal(youTeam('five', 'A'.repeat(60)).name.length, 24);
});

test('a round is a single fresh draft: your budget against the club\'s, the medium bot', () => {
  const t = newTournament(pool, 'r1', { mode: 'five', name: 'Sunday Rovers' });
  assert.equal(t.status, 'playing'); assert.equal(t.round, 0);
  assert.equal(t.tie.total, 1); assert.equal(t.tie.level, BOT_LEVEL); assert.equal(BOT_LEVEL, 'medium');
  assert.deepEqual(t.tie.money, { you: 10, bot: opponent(t).budget });
  const e = newTournament(pool, 'r1', { mode: 'eleven' });
  assert.equal(e.tie.money.you, 30); assert.equal(e.tie.money.bot, opponent(e).budget);
  assert.equal(me(t).name, 'Sunday Rovers');
  assert.throws(() => newTournament(pool, 'x', { teams: [] }), /64 teams/);
});

test('lose and you are out; win and you go through to the next round; win the Final and you are champions', () => {
  let outs = 0, champions = 0, through = 0;
  for (let i = 0; i < 40; i++) {
    const t = newTournament(pool, `k${i}`);
    for (let guard = 0; guard < 8 && t.status === 'playing'; guard++) {
      const before = t.round;
      const r = play(t, 'hard');
      assert.ok(['you', 'bot'].includes(r.winner), 'a knockout always has a winner');
      if (r.winner === 'you') { through++; if (t.status === 'playing') { assert.equal(t.round, before + 1); assert.deepEqual(t.tie.money, { you: 10, bot: opponent(t).budget }); } }
    }
    assert.ok(t.status === 'out' || t.status === 'champions');
    assert.equal(t.history.length, t.status === 'champions' ? 6 : roundsWon(t) + 1);
    if (t.status === 'out') { outs++; assert.equal(t.history.at(-1).winner, 'bot'); assert.notEqual(champion(t).code, me(t).code); }
    else { champions++; assert.equal(roundsWon(t), 6); assert.equal(champion(t).you, true); }
  }
  assert.ok(outs > 0 && through > 40, `${outs} knocked out, ${through} rounds won, ${champions} champions`);
});

test('the bracket is complete and consistent: every winner came from the tie before', () => {
  const t = newTournament(pool, 'full', { name: 'Sunday Rovers' });
  while (t.status === 'playing') play(t, 'hard');
  assert.equal(t.bracket.length, 7);
  assert.deepEqual(t.bracket.map((r) => r.length), [64, 32, 16, 8, 4, 2, 1]);
  assert.deepEqual(t.ties.map((r) => r.length), [32, 16, 8, 4, 2, 1]);
  t.ties.forEach((round, r) => round.forEach((x, i) => {
    assert.equal(x.a, t.bracket[r][2 * i]); assert.equal(x.b, t.bracket[r][2 * i + 1]);
    assert.ok(x.winner === x.a || x.winner === x.b);
    assert.equal(t.bracket[r + 1][i], x.winner);
  }));
  assert.equal(new Set(t.bracket[0]).size, 64);
});

test('the history records each round: the club, its budget, the attribute and both totals', () => {
  const t = newTournament(pool, 'hist');
  const opp = opponent(t);
  play(t, 'hard');
  const h = t.history[0];
  assert.equal(h.name, 'Round of 64'); assert.equal(h.club, opp.code); assert.equal(h.clubName, opp.name); assert.equal(h.budget, opp.budget);
  assert.ok(h.category && Number.isFinite(h.you) && Number.isFinite(h.bot));
  assert.equal(h.winner, h.you > h.bot ? 'you' : h.bot > h.you ? 'bot' : h.winner);
});

test('a drawn round is decided: more appearances goes through, then a coin', () => {
  const t = newTournament(pool, 'draw');
  const s = t.tie;
  while (s.phase === 'draft') { const who = s.turn; pick(s, who, choose(s, who, 'medium')); }
  showdown(s);
  s.results[0].you.total = s.results[0].bot.total; s.results[0].winner = 'draw';
  s.teams.bot.forEach((c, i) => { c.games = 1000 + i; });
  s.teams.you.forEach((c) => { c.games = 10; });
  const r = finishRound(t);
  assert.equal(r.winner, 'bot'); assert.equal(r.decidedBy, 'more appearances');
  const t2 = newTournament(pool, 'draw'), s2 = t2.tie;
  while (s2.phase === 'draft') { const who = s2.turn; pick(s2, who, choose(s2, who, 'medium')); }
  showdown(s2);
  s2.results[0].you.total = s2.results[0].bot.total; s2.results[0].winner = 'draw';
  s2.teams.bot.forEach((c) => { c.games = 50; }); s2.teams.you.forEach((c) => { c.games = 50; });
  assert.equal(finishRound(t2).decidedBy, 'a coin');
  assert.throws(() => finishRound(newTournament(pool, 'early')), /not finished/);
});

test('you do not see who you play next, or anything on the road ahead, until the round starts', () => {
  const t = newTournament(pool, 'veil', { name: 'Sunday Rovers' });
  const known = (v) => v.rounds.flatMap((r, k) => r.map((x, i) => (x.known ? `${k}:${i}` : null)).filter(Boolean));
  const shown = (v) => v.ties.flatMap((r, k) => r.map((x, i) => (x ? `${k}:${i}` : null)).filter(Boolean));
  // before round 1 starts: yourself and nothing else, in the view and in what the view carries (no club names but yours)
  let v = bracketView(t);
  assert.deepEqual(known(v), ['0:0']); assert.deepEqual(shown(v), []);
  assert.equal(v.rounds[0][0].you, true);
  assert.equal(v.rounds[0][1].known, false); assert.equal(v.rounds[0][1].name, undefined, 'an unknown slot carries no club');
  const secret = JSON.stringify(t.teams.slice(1).map((x) => x.name));
  const others = t.teams.slice(1).map((x) => x.name);
  for (const name of others) assert.ok(!JSON.stringify(v).includes(name), `${name} is not in the view`);
  void secret;
  // the round starts: the opponent is revealed
  revealOpponent(t);
  v = bracketView(t);
  assert.deepEqual(known(v), ['0:0', '0:1']);
  assert.equal(v.rounds[0][1].name, opponent(t).name);
  const second = t.teams[t.bracket[0][2]].name;
  assert.ok(!JSON.stringify(v).includes(second), 'nobody else is in the view');
  // play on: after each round, round r+1 slot 0 is you; the next opponent is still hidden; the block that produced him appears at the next round start
  const winnersOnly = (cb) => { while (t.status === 'playing') { play(t, 'hard'); if (t.status !== 'playing') break; cb(); } };
  winnersOnly(() => {
    const w = bracketView(t), R = t.round;
    assert.equal(w.rounds[R][0].you, true, 'you are in the next round');
    assert.equal(w.rounds[R][1].known, false, 'the next opponent is hidden');
    for (const k of Object.keys(w.rounds)) void k;
    const nextClub = t.teams[t.bracket[R][1]].name;
    assert.ok(!JSON.stringify(w).includes(nextClub), 'his name is nowhere in the view');
    // and neither are the clubs he had to beat to get there
    const pool0 = t.bracket[0].slice(2 ** R, 2 ** (R + 1)).map((i) => t.teams[i].name);
    for (const name of pool0) assert.ok(!JSON.stringify(w).includes(name), `${name} is not shown yet`);
    revealOpponent(t);
    const x = bracketView(t);
    assert.equal(x.rounds[R][1].name, t.teams[t.bracket[R][1]].name);
    for (const name of pool0) assert.ok(JSON.stringify(x).includes(name), `${name} is shown now`);
    const tiePrev = x.ties[R - 1][1];
    assert.ok(tiePrev && (tiePrev.winner === 'a' || tiePrev.winner === 'b'), 'the tie that produced him is shown');
  });
  // the end of the cup shows everything
  const e = bracketView(t);
  assert.ok(known(e).length === 127 && shown(e).length === 63, `${known(e).length} slots, ${shown(e).length} results`);
});

test('the cup is a real climb: a medium-skill player is an underdog, and winning it is rare', () => {
  const reached = Array(ROUNDS.length + 1).fill(0); const N = 60;
  for (let i = 0; i < N; i++) {
    const t = newTournament(pool, `climb${i}`);
    while (t.status === 'playing') play(t, 'medium');
    reached[roundsWon(t)]++;
  }
  const atLeast = (n) => reached.slice(n).reduce((a, b) => a + b, 0) / N;
  assert.ok(atLeast(1) > 0.5, `most players win round 1 (${atLeast(1)})`);
  assert.ok(atLeast(1) > atLeast(3) && atLeast(3) > atLeast(5), 'each stage is rarer than the one before');
  assert.ok(atLeast(6) < 0.15, `winning the cup is rare (${atLeast(6)})`);
  assert.equal(SIZE, 64); assert.equal(MODES.five.budget, 10);
});
